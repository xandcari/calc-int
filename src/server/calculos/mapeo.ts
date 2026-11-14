import type {
  Calculo,
  CostoFijo,
  CostoIndirecto,
  CostoVariable,
  EscenarioUsuario,
  Frecuencia,
  ModoPrecio,
  PasoRecorrido,
  TipoOferta,
} from "@/domain/types";

/**
 * Traducción entre el objeto `Calculo` del frontend y las filas de la BD.
 * Son funciones puras (sin BD ni red), para poder probarlas con vitest.
 *
 * El tipo `Calculo` NO se modifica: acá se adapta la BD a él, no al revés.
 * Reglas de la traducción:
 *  - Importe vacío ("") ↔ NULL.
 *  - `nota` ausente o vacía ↔ NULL (al leer, si es NULL el campo se omite).
 *  - `id`, `creadoEn` y `actualizadoEn` del objeto NO se guardan: los pone el servidor.
 *    Al leer, `id` es el UUID de la fila (el mismo que va en el link).
 */

/** Lo que el frontend manda para guardar: un `Calculo` sin los campos que decide el servidor. */
export type CalculoParaGuardar = Omit<Calculo, "id" | "creadoEn" | "actualizadoEn">;

// ─── Filas (forma de las tablas; coinciden con src/db/schema/calculo.ts) ───

/** Datos escalares del cálculo, sin id, dueño ni fechas (esos los maneja el repositorio). */
export interface ColumnasCalculo {
  tipo: TipoOferta;
  nombre: string;
  moneda: "ARS";
  unidadVenta: string;
  unidadesPorLote: string | null;
  lotes: string | null;
  volumenMensual: string | null;
  trabajoIncluir: boolean;
  trabajoHorasPorLote: string | null;
  trabajoHorasMensuales: string | null;
  trabajoValorHora: string | null;
  precioModo: ModoPrecio;
  precioMargenPct: string | null;
  precioManual: string | null;
  pasoActual: PasoRecorrido;
}

export interface FilaCalculo extends ColumnasCalculo {
  id: string;
  usuarioId: string;
  compartido: boolean;
  creadoEn: Date;
  actualizadoEn: Date;
}

interface FilaConceptoBase {
  calculoId: string;
  id: string;
  orden: number;
  nombre: string;
  nota: string | null;
}

export interface FilaPorPeriodo extends FilaConceptoBase {
  monto: string | null;
  frecuencia: Frecuencia;
}

export interface FilaVariable extends FilaConceptoBase {
  montoUnitario: string | null;
}

export interface FilaEscenario {
  calculoId: string;
  id: string;
  orden: number;
  nombre: string;
  insumosPct: string | null;
  precioPct: string | null;
  produccionPct: string | null;
}

/** Todas las filas hijas de un cálculo. */
export interface FilasHijas {
  fijos: FilaPorPeriodo[];
  indirectos: FilaPorPeriodo[];
  variables: FilaVariable[];
  escenarios: FilaEscenario[];
}

// ─── Helpers ───

/** "" (o solo espacios) → null; cualquier otro importe se guarda sin tocar. */
const aColumna = (valor: string): string | null => (valor.trim() === "" ? null : valor.trim());

/** null → "" (el dominio usa "" para «todavía no cargó nada»). */
const aDominio = (valor: string | null): string => valor ?? "";

const notaAColumna = (nota: string | undefined): string | null => (nota && nota.trim() !== "" ? nota : null);

/** Agrega `nota` solo si existe, para no dejar `nota: undefined` en el objeto. */
const conNota = (nota: string | null): { nota?: string } => (nota === null ? {} : { nota });

// ─── Calculo → filas ───

export function calculoAColumnas(c: CalculoParaGuardar): ColumnasCalculo {
  return {
    tipo: c.configuracion.tipo,
    nombre: c.configuracion.nombre,
    moneda: c.configuracion.moneda,
    unidadVenta: c.configuracion.unidadVenta,
    unidadesPorLote: aColumna(c.configuracion.unidadesPorLote),
    lotes: aColumna(c.configuracion.lotes),
    volumenMensual: aColumna(c.configuracion.volumenMensual),
    trabajoIncluir: c.trabajoPropio.incluir,
    trabajoHorasPorLote: aColumna(c.trabajoPropio.horasPorLote),
    trabajoHorasMensuales: aColumna(c.trabajoPropio.horasMensuales),
    trabajoValorHora: aColumna(c.trabajoPropio.valorHora),
    precioModo: c.precio.modo,
    precioMargenPct: aColumna(c.precio.margenPct),
    precioManual: aColumna(c.precio.precioManual),
    pasoActual: c.pasoActual,
  };
}

export function calculoAFilasHijas(c: CalculoParaGuardar, calculoId: string): FilasHijas {
  const porPeriodo = (lista: Array<CostoFijo | CostoIndirecto>): FilaPorPeriodo[] =>
    lista.map((x, orden) => ({
      calculoId,
      id: x.id,
      orden,
      nombre: x.nombre,
      nota: notaAColumna(x.nota),
      monto: aColumna(x.monto),
      frecuencia: x.frecuencia,
    }));

  return {
    fijos: porPeriodo(c.costosFijos),
    indirectos: porPeriodo(c.costosIndirectos),
    variables: c.costosVariables.map((x, orden) => ({
      calculoId,
      id: x.id,
      orden,
      nombre: x.nombre,
      nota: notaAColumna(x.nota),
      montoUnitario: aColumna(x.montoUnitario),
    })),
    escenarios: c.escenarios.map((x, orden) => ({
      calculoId,
      id: x.id,
      orden,
      nombre: x.nombre,
      insumosPct: aColumna(x.insumosPct),
      precioPct: aColumna(x.precioPct),
      produccionPct: aColumna(x.produccionPct),
    })),
  };
}

// ─── Filas → Calculo ───

const porOrden = <T extends { orden: number }>(filas: T[]): T[] => [...filas].sort((a, b) => a.orden - b.orden);

export function filasACalculo(fila: FilaCalculo, hijas: FilasHijas): Calculo {
  const fijos: CostoFijo[] = porOrden(hijas.fijos).map((x) => ({
    id: x.id,
    categoria: "fijo",
    nombre: x.nombre,
    ...conNota(x.nota),
    monto: aDominio(x.monto),
    frecuencia: x.frecuencia,
  }));
  const indirectos: CostoIndirecto[] = porOrden(hijas.indirectos).map((x) => ({
    id: x.id,
    categoria: "indirecto",
    nombre: x.nombre,
    ...conNota(x.nota),
    monto: aDominio(x.monto),
    frecuencia: x.frecuencia,
  }));
  const variables: CostoVariable[] = porOrden(hijas.variables).map((x) => ({
    id: x.id,
    categoria: "variable",
    nombre: x.nombre,
    ...conNota(x.nota),
    montoUnitario: aDominio(x.montoUnitario),
  }));
  const escenarios: EscenarioUsuario[] = porOrden(hijas.escenarios).map((x) => ({
    id: x.id,
    nombre: x.nombre,
    insumosPct: aDominio(x.insumosPct),
    precioPct: aDominio(x.precioPct),
    produccionPct: aDominio(x.produccionPct),
  }));

  return {
    id: fila.id,
    configuracion: {
      tipo: fila.tipo,
      nombre: fila.nombre,
      moneda: fila.moneda,
      unidadVenta: fila.unidadVenta,
      unidadesPorLote: aDominio(fila.unidadesPorLote),
      lotes: aDominio(fila.lotes),
      volumenMensual: aDominio(fila.volumenMensual),
      ruta: (fila as any).ruta ?? "estandar",
    },
    costosFijos: fijos,
    costosVariables: variables,
    costosIndirectos: indirectos,
    trabajoPropio: {
      incluir: fila.trabajoIncluir,
      horasPorLote: aDominio(fila.trabajoHorasPorLote),
      horasMensuales: aDominio(fila.trabajoHorasMensuales),
      valorHora: aDominio(fila.trabajoValorHora),
      sueldoMensual: (fila as any).sueldoMensual ?? "0"
    },
    precio: {
      modo: fila.precioModo,
      margenPct: aDominio(fila.precioMargenPct),
      precioManual: aDominio(fila.precioManual),
    },
    escenarios,
    pasoActual: fila.pasoActual,
    creadoEn: fila.creadoEn.toISOString(),
    actualizadoEn: fila.actualizadoEn.toISOString(),
  };
}
