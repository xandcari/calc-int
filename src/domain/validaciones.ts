import { z } from "zod";

import { calcularResumenCostos } from "@/domain/motor/costos";
import { estaVacio, leerNumero } from "@/domain/motor/numeros";
import type { Calculo, ErrorValidacion, RutaProduccion } from "@/domain/types";

/**
 * Validaciones del recorrido (Semana 1). Una sola fuente de reglas, con Zod:
 * el formulario de «Tu producto» usa `configuracionSchema` y las pantallas de costos usan `validarCostos`.
 *
 * Los textos hablan en voseo y en lenguaje simple: son los que ve el usuario.
 * Las cantidades llegan YA normalizadas (coma decimal → punto; `normalizarNumero` se aplica una sola vez,
 * al ingresar el dato en el campo). Acá no se vuelve a normalizar: hacerlo dos veces podría cambiar el valor.
 */

const MENSAJES = {
  nombreVacio: "Poné el nombre de tu producto.",
  nombreLargo: "Usá un nombre más corto (hasta 80 caracteres).",
  unidadVacia: "Elegí la unidad en la que vendés.",
  unidadesVacias: "Indicá cuántas unidades producís por lote.",
  lotesVacios: "Indicá cuántos lotes producís por mes.",
  noEsNumero: "Ingresá solo números, por ejemplo 20 o 12,5.",
  noPositivo: "Tiene que ser un número mayor a cero.",
  noEntero: "Ingresá un número entero, por ejemplo 1 o 6.",
  montoVacio: "Ingresá el monto.",
  montoNegativo: "El monto no puede ser negativo.",
  conceptoSinNombre: "Poné un nombre para este concepto.",
  horasVacias: "Indicá cuántas horas le dedicás a cada lote.",
  horasNegativas: "Las horas no pueden ser negativas.",
  valorHoraVacio: "Indicá cuánto querés ganar por hora.",
  sueldoVacio: "Indicá cuánto querés ganar por mes.",
  horasMesVacias: "Indicá cuántas horas trabajás por mes.",
} as const;

/**
 * Textos que cambian según la ruta del paso 1 («lotes», «unidad» o «reventa»).
 * Las rutas «unidad» y «reventa» cargan el volumen total en `lotes` (regla del 1 de Data).
 */
export const MENSAJES_RUTA: Record<RutaProduccion, { volumenVacio: string; horasVacias: string }> = {
  lotes: {
    volumenVacio: MENSAJES.lotesVacios,
    horasVacias: MENSAJES.horasVacias,
  },
  unidad: {
    volumenVacio: "Indicá cuántas unidades producís por mes.",
    horasVacias: "Indicá cuántas horas le dedicás a cada unidad.",
  },
  reventa: {
    volumenVacio: "Indicá cuántas unidades vendés por mes.",
    horasVacias: MENSAJES.sueldoVacio,
  },
};

/** Número mayor a cero (opcionalmente entero). */
function numeroPositivo(mensajeVacio: string, { entero = false }: { entero?: boolean } = {}) {
  return z
    .string()
    .trim()
    .min(1, mensajeVacio)
    .superRefine((valor, ctx) => {
      if (valor === "") return;
      const n = leerNumero(valor);
      if (!n) {
        ctx.addIssue({ code: "custom", message: MENSAJES.noEsNumero });
      } else if (!n.isPositive() || n.isZero()) {
        ctx.addIssue({ code: "custom", message: MENSAJES.noPositivo });
      } else if (entero && !n.isInteger()) {
        ctx.addIssue({ code: "custom", message: MENSAJES.noEntero });
      }
    });
}

/** Importe ≥ 0. */
function montoNoNegativo(mensajeVacio: string, mensajeNegativo: string = MENSAJES.montoNegativo) {
  return z
    .string()
    .trim()
    .min(1, mensajeVacio)
    .superRefine((valor, ctx) => {
      if (valor === "") return;
      const n = leerNumero(valor);
      if (!n) {
        ctx.addIssue({ code: "custom", message: MENSAJES.noEsNumero });
      } else if (n.isNegative()) {
        ctx.addIssue({ code: "custom", message: mensajeNegativo });
      }
    });
}

/**
 * Paso 1 — «Tu producto». Los campos son los que el usuario completa en el formulario.
 * En las rutas «unidad» y «reventa» no se pregunta por las unidades por lote (queda fija en 1).
 */
export function crearConfiguracionSchema(ruta: RutaProduccion = "lotes") {
  return z.object({
    nombre: z.string().trim().min(1, MENSAJES.nombreVacio).max(80, MENSAJES.nombreLargo),
    unidadVenta: z.string().trim().min(1, MENSAJES.unidadVacia),
    unidadesPorLote: ruta === "lotes" ? numeroPositivo(MENSAJES.unidadesVacias) : z.string(),
    lotes: numeroPositivo(MENSAJES_RUTA[ruta].volumenVacio, { entero: true }),
  });
}

export const configuracionSchema = crearConfiguracionSchema("lotes");

export type ConfiguracionFormulario = z.infer<typeof configuracionSchema>;

const esquemaMonto = montoNoNegativo(MENSAJES.montoVacio);

/** Primer mensaje de error de un monto ya cargado, o null si es válido. */
export function errorDeMonto(valor: string): string | null {
  const resultado = esquemaMonto.safeParse(valor);
  return resultado.success ? null : resultado.error.issues[0].message;
}

/** Validación del paso 1. Un error por campo (el primero). */
export function validarConfiguracion(configuracion: Calculo["configuracion"]): ErrorValidacion[] {
  const resultado = crearConfiguracionSchema(configuracion.ruta).safeParse({
    nombre: configuracion.nombre,
    unidadVenta: configuracion.unidadVenta,
    unidadesPorLote: configuracion.unidadesPorLote,
    lotes: configuracion.lotes,
  });
  if (resultado.success) return [];

  const vistos = new Set<string>();
  const errores: ErrorValidacion[] = [];
  for (const issue of resultado.error.issues) {
    const campo = `configuracion.${String(issue.path[0])}`;
    if (vistos.has(campo)) continue;
    vistos.add(campo);
    errores.push({ campo, mensaje: issue.message, severidad: "error" });
  }
  return errores;
}

interface FilaConcepto {
  nombre: string;
  valor: string;
}

/** Filas en blanco se ignoran; una fila a medio completar es un error. */
function validarFilas(filas: FilaConcepto[], lista: string, campoValor: string): ErrorValidacion[] {
  const errores: ErrorValidacion[] = [];
  filas.forEach((fila, i) => {
    if (estaVacio(fila.nombre) && estaVacio(fila.valor)) return;
    if (estaVacio(fila.nombre)) {
      errores.push({ campo: `${lista}.${i}.nombre`, mensaje: MENSAJES.conceptoSinNombre, severidad: "error" });
    }
    const mensaje = errorDeMonto(fila.valor);
    if (mensaje) {
      errores.push({ campo: `${lista}.${i}.${campoValor}`, mensaje, severidad: "error" });
    }
  });
  return errores;
}

/** Validación del paso 2 («Costos»): fijos, variables, indirectos y trabajo propio. */
export function validarCostos(calculo: Calculo): ErrorValidacion[] {
  const errores: ErrorValidacion[] = [
    ...validarFilas(
      calculo.costosFijos.map((c) => ({ nombre: c.nombre, valor: c.monto })),
      "costosFijos",
      "monto",
    ),
    ...validarFilas(
      calculo.costosIndirectos.map((c) => ({ nombre: c.nombre, valor: c.monto })),
      "costosIndirectos",
      "monto",
    ),
    ...validarFilas(
      calculo.costosVariables.map((c) => ({ nombre: c.nombre, valor: c.montoUnitario })),
      "costosVariables",
      "montoUnitario",
    ),
  ];

  // Trabajo propio. «Reventa» con sueldo fijo: un solo dato, el sueldo mensual. Las otras rutas, y «reventa» por horas
  // al mes: si completó uno de los dos datos (horas y valor por hora), el otro también.
  const { horasPorLote, valorHora, sueldoMensual, modoSueldo, horasAlMes } = calculo.trabajoPropio;
  const reventaPorHoras = calculo.configuracion.ruta === "reventa" && modoSueldo === "horas";
  if (calculo.configuracion.ruta === "reventa" && !reventaPorHoras) {
    if (!estaVacio(sueldoMensual)) {
      // El sueldo pretendido puede ser cero (el MVP pide mayor o igual a cero).
      const sueldo = montoNoNegativo(MENSAJES.sueldoVacio).safeParse(sueldoMensual);
      if (!sueldo.success) {
        errores.push({ campo: "trabajoPropio.sueldoMensual", mensaje: sueldo.error.issues[0].message, severidad: "error" });
      }
    }
  } else if (!estaVacio(reventaPorHoras ? horasAlMes : horasPorLote) || !estaVacio(valorHora)) {
    // Las horas no pueden ser negativas; cero es válido.
    const mensajeHorasVacias = reventaPorHoras ? MENSAJES.horasMesVacias : MENSAJES_RUTA[calculo.configuracion.ruta].horasVacias;
    const horas = montoNoNegativo(mensajeHorasVacias, MENSAJES.horasNegativas).safeParse(
      reventaPorHoras ? horasAlMes : horasPorLote,
    );
    if (!horas.success) {
      errores.push({
        campo: reventaPorHoras ? "trabajoPropio.horasAlMes" : "trabajoPropio.horasPorLote",
        mensaje: horas.error.issues[0].message,
        severidad: "error",
      });
    }
    const valor = montoNoNegativo(MENSAJES.valorHoraVacio).safeParse(valorHora);
    if (!valor.success) {
      errores.push({ campo: "trabajoPropio.valorHora", mensaje: valor.error.issues[0].message, severidad: "error" });
    }
  }

  // Advertencias: informan, no bloquean.
  const resumen = calcularResumenCostos(calculo);
  if (!resumen.tieneCostosVariables) {
    errores.push({
      campo: "costosVariables",
      mensaje: "Todavía no cargaste insumos por unidad: el costo unitario va a quedar incompleto.",
      severidad: "advertencia",
    });
  }
  if (!resumen.tieneCostosFijos) {
    errores.push({
      campo: "costosFijos",
      mensaje: "Todavía no cargaste costos fijos ni tu tiempo: el costo unitario va a quedar incompleto.",
      severidad: "advertencia",
    });
  }
  if (!calculo.trabajoPropio.incluir) {
    errores.push({
      campo: "trabajoPropio",
      mensaje: "No incluiste el valor de tu tiempo. Es el error más frecuente al fijar precios.",
      severidad: "advertencia",
    });
  }

  return errores;
}

/** Hay algún error que bloquea el avance (las advertencias no bloquean). */
export function hayErrores(errores: ErrorValidacion[]): boolean {
  return errores.some((e) => e.severidad === "error");
}
