import Decimal from "decimal.js";

import type { Calculo, DecimalString } from "@/domain/types";

import { calcularResumenCostos, importeValido, montoMensual, totalTrabajoMensual } from "./costos";
import { aDecimalString } from "./decimal";
import { leerNumero } from "./numeros";

/**
 * Datos del paso 3 «Resumen de costos». Funciones puras; los importes salen sin redondear.
 *
 * Margen de referencia: el paso 3 muestra la contribución por unidad antes de que el usuario elija su margen
 * (paso 4). El diseño usa 40 %, igual que el simulador de Backend (Simulador_App_Flujo.xlsx).
 */
export const MARGEN_REFERENCIA: DecimalString = "0.4";

type EntradaResumen = Pick<
  Calculo,
  "configuracion" | "costosFijos" | "costosVariables" | "costosIndirectos" | "trabajoPropio"
>;

/** Precio = costo unitario ÷ (1 − margen). El margen va de 0 a 0,99 (convención «margen sobre ventas»). */
export function precioSugerido(costoUnitario: DecimalString, margen: DecimalString): DecimalString | null {
  const c = leerNumero(costoUnitario);
  const m = leerNumero(margen);
  if (!c || !m || m.isNegative() || m.greaterThan("0.99")) return null;
  return aDecimalString(c.dividedBy(new Decimal(1).minus(m)));
}

/** Contribución por unidad = precio − costo variable unitario. */
export function contribucionUnitaria(precio: DecimalString, costoVariableUnitario: DecimalString): DecimalString | null {
  const p = leerNumero(precio);
  const v = leerNumero(costoVariableUnitario);
  return p && v ? aDecimalString(p.minus(v)) : null;
}

/** Costo total por lote = costo unitario × unidades por lote. */
export function costoTotalPorLote(costoUnitario: DecimalString, unidadesPorLote: DecimalString): DecimalString | null {
  const c = leerNumero(costoUnitario);
  const u = leerNumero(unidadesPorLote);
  return c && u ? aDecimalString(c.times(u)) : null;
}

export interface PartidaComposicion {
  /** Aporte de esta partida al costo de UNA unidad. */
  porUnidad: DecimalString;
  /** Porcentaje del costo unitario (0–100). */
  porcentaje: DecimalString;
}

export interface ComposicionCostoUnitario {
  trabajoPropio: PartidaComposicion;
  gastosFijos: PartidaComposicion;
  indirectos: PartidaComposicion;
  materiales: PartidaComposicion;
}

/** Cómo se reparte el costo unitario: cada costo fijo mensual ÷ volumen, más los insumos. Null sin volumen. */
export function composicionCostoUnitario(calculo: EntradaResumen): ComposicionCostoUnitario | null {
  const r = calcularResumenCostos(calculo);
  const volumen = leerNumero(r.volumenMensual ?? "");
  const total = leerNumero(r.costoUnitario ?? "");
  if (!volumen || !total) return null;

  const partida = (porUnidad: Decimal): PartidaComposicion => ({
    porUnidad: aDecimalString(porUnidad),
    porcentaje: total.isZero() ? "0" : aDecimalString(porUnidad.dividedBy(total).times(100)),
  });

  return {
    trabajoPropio: partida(new Decimal(r.totalTrabajoPropioMensual).dividedBy(volumen)),
    gastosFijos: partida(new Decimal(r.totalGastosFijosMensual).dividedBy(volumen)),
    indirectos: partida(new Decimal(r.totalIndirectosMensual).dividedBy(volumen)),
    materiales: partida(new Decimal(r.costoVariableUnitario)),
  };
}

export interface LineaDetalle {
  id: string;
  nombre: string;
  monto: DecimalString;
}

export interface DetalleTrabajoPropio {
  /** «sueldo»: el total es el sueldo pretendido y no hay horas × valor por hora para mostrar. */
  modo: "hora" | "sueldo";
  horasPorLote: DecimalString;
  valorHora: DecimalString;
  lotes: DecimalString;
  totalMensual: DecimalString;
}

export interface DetalleCostos {
  gastosFijos: LineaDetalle[];
  indirectos: LineaDetalle[];
  variables: LineaDetalle[];
  trabajoPropio: DetalleTrabajoPropio | null;
}

const NOMBRE_VACIO = "Sin nombre";

/** Líneas con importe cargado (> 0). Los fijos e indirectos se muestran en su equivalente mensual. */
export function detalleDeCostos(calculo: EntradaResumen): DetalleCostos {
  const conMonto = (l: LineaDetalle) => new Decimal(l.monto).greaterThan(0);

  const gastosFijos = calculo.costosFijos
    .map((c) => ({
      id: c.id,
      nombre: c.nombre.trim() || NOMBRE_VACIO,
      monto: aDecimalString(montoMensual(c.monto, c.frecuencia)),
    }))
    .filter(conMonto);
  const indirectos = calculo.costosIndirectos
    .map((c) => ({
      id: c.id,
      nombre: c.nombre.trim() || NOMBRE_VACIO,
      monto: aDecimalString(montoMensual(c.monto, c.frecuencia)),
    }))
    .filter(conMonto);
  const variables = calculo.costosVariables
    .map((c) => ({
      id: c.id,
      nombre: c.nombre.trim() || NOMBRE_VACIO,
      monto: aDecimalString(importeValido(c.montoUnitario)),
    }))
    .filter(conMonto);

  const t = calculo.trabajoPropio;
  const totalTrabajo = totalTrabajoMensual(t);
  const trabajoPropio: DetalleTrabajoPropio | null =
    t.incluir && totalTrabajo.greaterThan(0)
      ? {
          modo: t.modo ?? "hora",
          horasPorLote: t.horasPorLote,
          valorHora: t.valorHora,
          lotes: calculo.configuracion.lotes,
          totalMensual: aDecimalString(totalTrabajo),
        }
      : null;

  return { gastosFijos, indirectos, variables, trabajoPropio };
}
