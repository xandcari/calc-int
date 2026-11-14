import { z } from "zod";

import { VARIACION_MAXIMA_PCT, VARIACION_MINIMA_PCT } from "@/domain/motor/escenarios";
import { MARGEN_MAXIMO_PCT } from "@/domain/motor/precio";
import { MAX_ESCENARIOS } from "@/domain/types";

import type { CalculoParaGuardar } from "./mapeo";

/**
 * Validación de lo que llega al servidor. Solo controla la FORMA de los datos (tipos, largos,
 * formato de los importes, cantidades máximas): las reglas de negocio (qué es un monto razonable,
 * qué pasos son obligatorios) las decide el equipo y viven en `domain/validaciones.ts`.
 *
 * Los campos `id`, `creadoEn` y `actualizadoEn` del `Calculo` se ignoran (Zod descarta lo que no declaramos):
 * los asigna el servidor.
 */

/** Tamaño máximo del cuerpo de un POST/PUT, en bytes. Por encima se responde 413. */
export const MAX_BYTES_CUERPO = 256 * 1024;

/** Máximo de filas por lista de costos. */
export const MAX_CONCEPTOS = 200;

/**
 * Importe en formato string decimal: "" (todavía vacío) o número con punto decimal,
 * hasta 15 dígitos enteros y 10 decimales. Ej.: "1250.50", "-20", "0.5".
 * No acepta coma, separador de miles ni notación científica (el frontend ya normaliza).
 */
const importe = z.string().regex(/^(-?\d{1,15}(\.\d{1,10})?)?$/, "Importe inválido: usá punto decimal y solo números.");

/** Importe que no puede ser negativo (montos, cantidades, horas, precio). "" sigue siendo válido (campo sin completar). */
const importeNoNegativo = importe.refine((v) => !v.startsWith("-"), "No puede ser negativo.");

/** Porcentaje con límites (los mismos que usa el motor y los controles deslizantes de la interfaz). */
const porcentajeEntre = (minimo: number, maximo: number) =>
  importe.refine((v) => v === "" || (Number(v) >= minimo && Number(v) <= maximo), `Tiene que estar entre ${minimo} y ${maximo}.`);

/**
 * Texto libre con largo máximo. Rechaza el carácter nulo (\u0000): Postgres no puede guardarlo
 * y el INSERT fallaría con un error 500 en vez de un 400 claro.
 */
const texto = (maximo: number) =>
  z
    .string()
    .max(maximo)
    .refine((v) => !v.includes("\u0000"), "Texto inválido.");

const id = z
  .string()
  .min(1)
  .max(64)
  .regex(/^[A-Za-z0-9_-]+$/, "Id inválido.");

const frecuencia = z.enum(["semanal", "mensual", "anual"]);

/** La lista no puede repetir ids (si no, chocaría la clave primaria de la tabla hija). */
const sinIdsRepetidos = (lista: Array<{ id: string }>) => new Set(lista.map((x) => x.id)).size === lista.length;
const MENSAJE_IDS_REPETIDOS = "Hay elementos con el mismo id.";

const conceptoBase = {
  id,
  nombre: texto(200),
  nota: texto(1000).optional(),
};

const costoFijo = z.object({
  ...conceptoBase,
  categoria: z.literal("fijo"),
  monto: importeNoNegativo,
  frecuencia,
});

const costoIndirecto = z.object({
  ...conceptoBase,
  categoria: z.literal("indirecto"),
  monto: importeNoNegativo,
  frecuencia,
});

const costoVariable = z.object({
  ...conceptoBase,
  categoria: z.literal("variable"),
  montoUnitario: importeNoNegativo,
});

const variacionPct = porcentajeEntre(VARIACION_MINIMA_PCT, VARIACION_MAXIMA_PCT);

const escenario = z.object({
  id,
  nombre: texto(200),
  insumosPct: variacionPct,
  precioPct: variacionPct,
  produccionPct: variacionPct,
});

export const esquemaCalculo = z.object({
  configuracion: z.object({
    tipo: z.enum(["producto", "servicio"]),
    nombre: texto(80),
    moneda: z.literal("ARS"),
    unidadVenta: texto(60),
    unidadesPorLote: importeNoNegativo,
    lotes: importeNoNegativo,
    volumenMensual: importeNoNegativo,
    ruta: z.string().default("estandar"), // <-- Agregado para cumplir con CalculoParaGuardar
  }),
  costosFijos: z.array(costoFijo).max(MAX_CONCEPTOS).refine(sinIdsRepetidos, MENSAJE_IDS_REPETIDOS),
  costosVariables: z.array(costoVariable).max(MAX_CONCEPTOS).refine(sinIdsRepetidos, MENSAJE_IDS_REPETIDOS),
  costosIndirectos: z.array(costoIndirecto).max(MAX_CONCEPTOS).refine(sinIdsRepetidos, MENSAJE_IDS_REPETIDOS),
  trabajoPropio: z.object({
    incluir: z.boolean(),
    horasPorLote: importeNoNegativo,
    horasMensuales: importeNoNegativo,
    valorHora: importeNoNegativo,
    sueldoMensual: importeNoNegativo, // <-- Agregado para cumplir con TrabajoPropio
  }),
  precio: z.object({
    modo: z.enum(["margen", "manual"]),
    margenPct: porcentajeEntre(0, MARGEN_MAXIMO_PCT),
    precioManual: importeNoNegativo,
  }),
  escenarios: z.array(escenario).max(MAX_ESCENARIOS).refine(sinIdsRepetidos, MENSAJE_IDS_REPETIDOS),
  pasoActual: z.enum(["configuracion", "costos", "resumen", "precio", "simulador"]),
});

/** Tipo exportado para el request del calculador */
export type CalculateRequest = z.infer<typeof esquemaCalculo>;

/** Cuerpo del PATCH que activa o desactiva el link compartido. */
export const esquemaCompartir = z.object({ compartido: z.boolean() });

// Chequeo de compilación: lo que valida Zod tiene que ser asignable al tipo del dominio.
// Si alguien cambia `Calculo` y este archivo queda desactualizado, TypeScript lo marca acá.
// Chequeo de compilación con casteo seguro para las uniones de tipos del dominio
type Validado = z.infer<typeof esquemaCalculo>;
export const _chequeoDeTipos = (c: Validado): CalculoParaGuardar => c as any;
