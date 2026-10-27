import Decimal from "decimal.js";

import type { DecimalString } from "@/domain/types";

import { aDecimalString } from "./decimal";
import type { Situacion } from "./escenarios";
import { leerNumero } from "./numeros";

/**
 * Comparación entre la situación base y cada escenario (paso 5, issues #17 y #19).
 * Funciones puras; los importes salen sin redondear: el redondeo es solo visual.
 *
 * El estado de cada cambio nunca depende solo del color: la interfaz lo muestra con flecha,
 * signo y una etiqueta de texto («Mejora», «Empeora»…). Acá se decide qué etiqueta corresponde.
 */

export type IndicadorId = "costoUnitario" | "precio" | "margenNeto" | "puntoEquilibrio" | "gananciaMensual";

/** Hacia dónde se movió el valor respecto de la base. */
export type Direccion = "sube" | "baja" | "igual";

/**
 * Cómo se valora el cambio:
 *   - mejora / empeora: el indicador tiene un sentido bueno claro (menos costo, más ganancia…).
 *   - neutro: el cambio no es bueno ni malo por sí mismo (el precio: subirlo no siempre conviene).
 *   - sin-cambios: el valor es el mismo que el de la base.
 */
export type Valoracion = "mejora" | "empeora" | "neutro" | "sin-cambios";

export interface CambioIndicador {
  direccion: Direccion;
  valoracion: Valoracion;
  /** Valor del escenario − valor de la base. En margen son puntos porcentuales. Null si no se puede calcular. */
  diferencia: DecimalString | null;
  /** Cambio porcentual respecto de la base (la base negativa se toma en valor absoluto). Null con base cero o sin cálculo. */
  porcentaje: DecimalString | null;
  /**
   * Solo en el punto de equilibrio: cuando un lado no tiene equilibrio (el precio no cubre el costo variable)
   * no hay diferencia numérica y se explica con texto.
   */
  situacionEquilibrio?: "pasa-a-no-viable" | "pasa-a-viable" | "sigue-no-viable";
}

/** Un cambio menor que esta tolerancia se muestra igual que «sin cambios». */
const TOLERANCIA: Record<IndicadorId, number> = {
  costoUnitario: 0.005,
  precio: 0.005,
  margenNeto: 0.05,
  puntoEquilibrio: 0.5,
  gananciaMensual: 0.005,
};

/** Si subir el valor mejora el resultado. `null` = ni bueno ni malo. */
const SUBIR_ES_BUENO: Record<IndicadorId, boolean | null> = {
  costoUnitario: false,
  precio: null,
  margenNeto: true,
  puntoEquilibrio: false,
  gananciaMensual: true,
};

function valoracionDe(indicador: IndicadorId, direccion: Direccion): Valoracion {
  if (direccion === "igual") return "sin-cambios";
  const subirEsBueno = SUBIR_ES_BUENO[indicador];
  if (subirEsBueno === null) return "neutro";
  const mejora = subirEsBueno ? direccion === "sube" : direccion === "baja";
  return mejora ? "mejora" : "empeora";
}

function direccionDe(diferencia: Decimal, indicador: IndicadorId): Direccion {
  if (diferencia.abs().lessThan(TOLERANCIA[indicador])) return "igual";
  return diferencia.isPositive() ? "sube" : "baja";
}

function porcentajeSobre(diferencia: Decimal, base: Decimal): DecimalString | null {
  if (base.isZero()) return null;
  return aDecimalString(diferencia.dividedBy(base.abs()).times(100));
}

function cambioNumerico(indicador: IndicadorId, nuevo: Decimal, base: Decimal, conPorcentaje: boolean): CambioIndicador {
  const diferencia = nuevo.minus(base);
  const direccion = direccionDe(diferencia, indicador);
  return {
    direccion,
    valoracion: valoracionDe(indicador, direccion),
    diferencia: aDecimalString(diferencia),
    porcentaje: conPorcentaje && direccion !== "igual" ? porcentajeSobre(diferencia, base) : null,
  };
}

function cambioEquilibrio(nuevo: DecimalString | null, base: DecimalString | null): CambioIndicador {
  const n = leerNumero(nuevo ?? "");
  const b = leerNumero(base ?? "");
  if (n && b) return cambioNumerico("puntoEquilibrio", n, b, true);
  if (!n && !b) {
    return { direccion: "igual", valoracion: "sin-cambios", diferencia: null, porcentaje: null, situacionEquilibrio: "sigue-no-viable" };
  }
  // Un lado sin equilibrio: el precio no cubre el costo variable, así que no hay unidades que comparar.
  return n
    ? { direccion: "baja", valoracion: "mejora", diferencia: null, porcentaje: null, situacionEquilibrio: "pasa-a-viable" }
    : { direccion: "sube", valoracion: "empeora", diferencia: null, porcentaje: null, situacionEquilibrio: "pasa-a-no-viable" };
}

export type ComparacionConBase = Record<IndicadorId, CambioIndicador>;

/** Compara la situación de un escenario contra la base, indicador por indicador. */
export function compararConBase(base: Situacion, escenario: Situacion): ComparacionConBase {
  const dec = (v: DecimalString) => new Decimal(v);
  return {
    costoUnitario: cambioNumerico("costoUnitario", dec(escenario.costoUnitario), dec(base.costoUnitario), true),
    precio: cambioNumerico("precio", dec(escenario.precio), dec(base.precio), true),
    margenNeto: cambioNumerico("margenNeto", dec(escenario.margenNetoPct), dec(base.margenNetoPct), false),
    puntoEquilibrio: cambioEquilibrio(escenario.puntoEquilibrio, base.puntoEquilibrio),
    gananciaMensual: cambioNumerico("gananciaMensual", dec(escenario.gananciaMensual), dec(base.gananciaMensual), true),
  };
}

/**
 * Ids de los escenarios con la mayor ganancia mensual, solo si superan a la base.
 * Con un solo escenario o sin ninguno que supere la base no se destaca ninguno.
 */
export function escenariosDeMayorGanancia(
  base: Pick<Situacion, "gananciaMensual">,
  escenarios: { id: string; gananciaMensual: DecimalString }[],
): string[] {
  if (escenarios.length < 2) return [];
  const gananciaBase = new Decimal(base.gananciaMensual);
  const maxima = Decimal.max(...escenarios.map((e) => new Decimal(e.gananciaMensual)));
  if (!maxima.greaterThan(gananciaBase)) return [];
  return escenarios.filter((e) => new Decimal(e.gananciaMensual).equals(maxima)).map((e) => e.id);
}

export interface BarraGanancia {
  /** Inicio de la barra, de 0 a 100 (% del ancho disponible). */
  inicioPct: number;
  /** Ancho de la barra, de 0 a 100. */
  anchoPct: number;
}

export interface EscalaGanancias {
  barras: BarraGanancia[];
  /** Posición de la línea punteada de la base, de 0 a 100. */
  basePct: number;
  /** Posición del cero (eje) cuando hay ganancias negativas; null si todas son positivas. */
  ceroPct: number | null;
}

/**
 * Calcula las barras de «Ganancia mensual». La escala va del menor valor (o cero) al mayor (o cero),
 * así una ganancia negativa se dibuja hacia el otro lado del cero y no desaparece.
 * `valores` son los importes de cada fila de barra (la base más los escenarios).
 */
export function escalaDeGanancias(valores: DecimalString[], base: DecimalString): EscalaGanancias {
  const nums = valores.map((v) => new Decimal(v));
  const baseNum = new Decimal(base);
  const minimo = Decimal.min(new Decimal(0), ...nums, baseNum);
  const maximo = Decimal.max(new Decimal(0), ...nums, baseNum);
  const rango = maximo.minus(minimo);
  const pos = (v: Decimal) => (rango.isZero() ? 0 : v.minus(minimo).dividedBy(rango).times(100).toNumber());

  return {
    barras: nums.map((v) => {
      const desde = Decimal.min(v, new Decimal(0));
      const ancho = rango.isZero() ? 0 : v.abs().dividedBy(rango).times(100).toNumber();
      return { inicioPct: pos(desde), anchoPct: ancho };
    }),
    basePct: pos(baseNum),
    ceroPct: minimo.isNegative() ? pos(new Decimal(0)) : null,
  };
}
