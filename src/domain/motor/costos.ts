import Decimal from "decimal.js";

import type {
  Calculo,
  ConceptoCosto,
  Configuracion,
  CostoVariable,
  DecimalString,
  Frecuencia,
} from "@/domain/types";

import { aDecimalString } from "./decimal";
import { leerNumero } from "./numeros";
import { aMensual } from "./periodo";

/**
 * Resumen de costos del recorrido. Funciones puras, sin React.
 * Todos los importes salen sin redondear: el redondeo es solo visual.
 *
 * Fórmulas (Data, «Glosario - Reglas de negocio»):
 *   Costo Fijo Total = gastos fijos + costos indirectos + trabajo propio   (todo mensual)
 *   CVU              = suma de los insumos variables por unidad
 *                      (un insumo cargado por lote se divide por las unidades del lote; uno cargado por unidad, no)
 *   Costo Total      = Costo Fijo Total + CVU × volumen mensual
 *   Costo Unitario   = Costo Total ÷ volumen mensual
 */

const CERO = new Decimal(0);

/**
 * Importe válido (número, no negativo). Lo demás cuenta como cero SOLO para mostrar subtotales parciales:
 * `calcularResumenCostos` avisa con `tieneImportesInvalidos` y no entrega costo unitario, así un dato
 * inválido nunca cambia el resultado sin que el usuario lo sepa.
 */
export function importeValido(valor: DecimalString): Decimal {
  const d = leerNumero(valor);
  return d && !d.isNegative() ? d : CERO;
}

/** Monto de un concepto por período, normalizado a mensual. */
export function montoMensual(monto: DecimalString, frecuencia: Frecuencia): Decimal {
  return aMensual(importeValido(monto), frecuencia);
}

/** Un importe cargado que no sirve: no es un número o es negativo. Vacío no cuenta (todavía no lo cargó). */
function importeInvalido(valor: DecimalString): boolean {
  if (valor.trim() === "") return false;
  const d = leerNumero(valor);
  return !d || d.isNegative();
}

type EntradaImportes = Pick<
  Calculo,
  "configuracion" | "costosFijos" | "costosVariables" | "costosIndirectos" | "trabajoPropio"
>;

/**
 * Hay algún importe cargado que no es un número o es negativo. Mira solo los datos que usa la ruta elegida:
 * el sueldo (o las horas al mes y el valor por hora) en «reventa»; las horas y el valor por hora en las otras dos.
 */
export function hayImportesInvalidos(calculo: EntradaImportes): boolean {
  const { trabajoPropio, configuracion } = calculo;
  const delTrabajo =
    configuracion.ruta !== "reventa"
      ? [trabajoPropio.horasPorLote, trabajoPropio.valorHora]
      : trabajoPropio.modoSueldo === "horas"
        ? [trabajoPropio.horasAlMes, trabajoPropio.valorHora]
        : [trabajoPropio.sueldoMensual];
  return [
    ...calculo.costosFijos.map((c) => c.monto),
    ...calculo.costosIndirectos.map((c) => c.monto),
    ...calculo.costosVariables.map((c) => c.montoUnitario),
    ...delTrabajo,
  ].some(importeInvalido);
}

function sumarPorPeriodo(conceptos: Extract<ConceptoCosto, { frecuencia: Frecuencia }>[]): Decimal {
  return conceptos.reduce((total, c) => total.plus(montoMensual(c.monto, c.frecuencia)), CERO);
}

type ConfiguracionDeInsumos = Pick<Configuracion, "ruta" | "unidadesPorLote">;

/** El insumo se cargó por lote. Solo cuenta en la ruta «lotes»: en las otras la base se ignora. */
export function insumoSeCargaPorLote(insumo: CostoVariable, ruta: Configuracion["ruta"]): boolean {
  return ruta === "lotes" && insumo.base === "lote";
}

/** Unidades por lote usadas como divisor: solo si es un número mayor que cero. */
function unidadesDelLote(configuracion: ConfiguracionDeInsumos): Decimal | null {
  const unidades = leerNumero(configuracion.unidadesPorLote);
  return unidades && unidades.isPositive() && !unidades.isZero() ? unidades : null;
}

/**
 * Costo del insumo para UNA unidad terminada.
 * - Cargado por unidad: se usa tal cual, sin dividir.
 * - Cargado por lote (ruta «lotes»): costo del insumo en el lote ÷ unidades por lote.
 * Devuelve null cuando es por lote y las unidades por lote todavía no sirven de divisor (vacías, cero o negativas):
 * no se inventa un valor.
 */
export function costoVariableUnitarioDe(insumo: CostoVariable, configuracion: ConfiguracionDeInsumos): Decimal | null {
  const importe = importeValido(insumo.montoUnitario);
  if (!insumoSeCargaPorLote(insumo, configuracion.ruta)) return importe;
  const unidades = unidadesDelLote(configuracion);
  return unidades ? importe.dividedBy(unidades) : null;
}

/** Suma de insumos por unidad. `faltanUnidadesPorLote`: hay un insumo por lote con importe que no se pudo dividir. */
function sumarVariables(
  conceptos: CostoVariable[],
  configuracion: ConfiguracionDeInsumos,
): { total: Decimal; faltanUnidadesPorLote: boolean } {
  let total = CERO;
  let faltanUnidadesPorLote = false;
  for (const concepto of conceptos) {
    const porUnidad = costoVariableUnitarioDe(concepto, configuracion);
    if (porUnidad) total = total.plus(porUnidad);
    else if (importeValido(concepto.montoUnitario).greaterThan(0)) faltanUnidadesPorLote = true;
  }
  return { total, faltanUnidadesPorLote };
}

/** Unidades por mes = unidades por lote × lotes. Vacío si falta alguno o no son números. */
export function volumenDesdeLotes(unidadesPorLote: DecimalString, lotes: DecimalString): DecimalString {
  const u = leerNumero(unidadesPorLote);
  const l = leerNumero(lotes);
  return u && l ? aDecimalString(u.times(l)) : "";
}

/** Horas por mes = horas por lote × lotes. Vacío si falta alguno o no son números. */
export function horasMensualesDesdeLotes(horasPorLote: DecimalString, lotes: DecimalString): DecimalString {
  const h = leerNumero(horasPorLote);
  const l = leerNumero(lotes);
  return h && l ? aDecimalString(h.times(l)) : "";
}

export interface ResumenCostos {
  /** Gastos fijos mensuales (alquiler, servicios…). */
  totalGastosFijosMensual: DecimalString;
  /** Otros costos indirectos, tratados como fijos del mes. */
  totalIndirectosMensual: DecimalString;
  /** Valor del tiempo propio por mes (horas mensuales × valor por hora, o el sueldo mensual en «reventa»). */
  totalTrabajoPropioMensual: DecimalString;
  /** Gastos fijos + indirectos + trabajo propio. */
  costoFijoTotalMensual: DecimalString;
  /** Suma de insumos variables por unidad. */
  costoVariableUnitario: DecimalString;
  /** Unidades por mes (> 0), o null si todavía no está definido. */
  volumenMensual: DecimalString | null;
  /** Costo total del mes; null sin volumen. */
  costoTotalMensual: DecimalString | null;
  /** Costo total ÷ volumen; null sin volumen. */
  costoUnitario: DecimalString | null;
  /** Hay algún costo fijo, indirecto o de trabajo propio cargado (> 0). */
  tieneCostosFijos: boolean;
  /** Hay algún insumo variable cargado (> 0). */
  tieneCostosVariables: boolean;
  /** Algún importe cargado no es un número o es negativo: no se calcula el costo unitario hasta corregirlo. */
  tieneImportesInvalidos: boolean;
  /**
   * Hay un insumo cargado por lote pero las unidades por lote no sirven de divisor (vacías, cero o negativas):
   * el costo por unidad queda incompleto y no se calcula el costo unitario hasta completarlas.
   */
  faltanUnidadesPorLote: boolean;
}

type EntradaResumen = Pick<
  Calculo,
  "configuracion" | "costosFijos" | "costosVariables" | "costosIndirectos" | "trabajoPropio"
>;

/**
 * Valor del tiempo propio por mes.
 * - «lotes» y «unidad»: horas mensuales × valor por hora.
 * - «reventa» (Alternativa 2 de Data): el sueldo mensual que quiere ganar, directo y sin multiplicar por el volumen.
 *   Si elige «horas al mes»: horas al mes × valor por hora (tampoco se multiplica por el volumen).
 */
export function trabajoPropioMensual(calculo: EntradaResumen): Decimal {
  const { trabajoPropio, configuracion } = calculo;
  if (!trabajoPropio.incluir) return CERO;
  if (configuracion.ruta !== "reventa") {
    return importeValido(trabajoPropio.horasMensuales).times(importeValido(trabajoPropio.valorHora));
  }
  return trabajoPropio.modoSueldo === "horas"
    ? importeValido(trabajoPropio.horasAlMes).times(importeValido(trabajoPropio.valorHora))
    : importeValido(trabajoPropio.sueldoMensual);
}

export function calcularResumenCostos(calculo: EntradaResumen): ResumenCostos {
  const gastosFijos = sumarPorPeriodo(calculo.costosFijos);
  const indirectos = sumarPorPeriodo(calculo.costosIndirectos);

  const trabajo = trabajoPropioMensual(calculo);

  const costoFijoTotal = gastosFijos.plus(indirectos).plus(trabajo);
  const { total: cvu, faltanUnidadesPorLote } = sumarVariables(calculo.costosVariables, calculo.configuracion);

  const volumen = leerNumero(calculo.configuracion.volumenMensual);
  const volumenValido = volumen && volumen.isPositive() && !volumen.isZero() ? volumen : null;

  const importesInvalidos = hayImportesInvalidos(calculo);
  const costoTotal =
    volumenValido && !importesInvalidos && !faltanUnidadesPorLote ? costoFijoTotal.plus(cvu.times(volumenValido)) : null;
  const costoUnitario = costoTotal && volumenValido ? costoTotal.dividedBy(volumenValido) : null;

  return {
    totalGastosFijosMensual: aDecimalString(gastosFijos),
    totalIndirectosMensual: aDecimalString(indirectos),
    totalTrabajoPropioMensual: aDecimalString(trabajo),
    costoFijoTotalMensual: aDecimalString(costoFijoTotal),
    costoVariableUnitario: aDecimalString(cvu),
    volumenMensual: volumenValido ? aDecimalString(volumenValido) : null,
    costoTotalMensual: costoTotal ? aDecimalString(costoTotal) : null,
    costoUnitario: costoUnitario ? aDecimalString(costoUnitario) : null,
    tieneCostosFijos: costoFijoTotal.greaterThan(0),
    tieneCostosVariables: cvu.greaterThan(0),
    tieneImportesInvalidos: importesInvalidos,
    faltanUnidadesPorLote,
  };
}
