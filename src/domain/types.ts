/**
 * Tipos del dominio — Calculadora Inteligente de Costos, Precios y Punto de Equilibrio.
 *
 * Convención de importes: se guardan como `string` (ej. "1250.50") y NO como `number`,
 * para no perder precisión. El motor de cálculo los convierte con Decimal.js.
 * El redondeo a 2 decimales y el formato ($ 1.250,50) son solo visuales, al mostrar.
 *
 * Convención de período: el motor trabaja SIEMPRE en base mensual. Los importes cargados
 * con otra frecuencia se normalizan con `aMensual()` (motor/periodo.ts) antes de calcular.
 */

/** Importe o cantidad decimal en formato string, parseable por Decimal.js. */
export type DecimalString = string;

/** Identificador único (usar crypto.randomUUID()). */
export type Id = string;

// ─────────────────────────────────────────────
// 1. Configuración inicial (paso 1 del recorrido)
// ─────────────────────────────────────────────

export type TipoOferta = "producto" | "servicio";

/** El MVP trabaja solo en pesos argentinos. */
export type Moneda = "ARS";

/**
 * Frecuencia con la que el usuario carga un importe en la interfaz.
 * El motor la normaliza a mensual: semanal × 4, anual ÷ 12.
 */
export type Frecuencia = "semanal" | "mensual" | "anual";

export interface Configuracion {
  tipo: TipoOferta;
  /** Nombre del producto o servicio. Ej: "Torta de chocolate". */
  nombre: string;
  moneda: Moneda;
  /** Unidad en la que se vende. Ej: "unidad", "kg", "hora", "sesión". */
  unidadVenta: string;
  /** Unidades que se producen en cada lote (tanda). Ej: 20 tortas por tanda. Debe ser > 0. */
  unidadesPorLote: DecimalString;
  /** Lotes (tandas) que se producen por mes. Entero > 0. */
  lotes: DecimalString;
  /**
   * Unidades/servicios que se estima vender por mes = `unidadesPorLote × lotes`.
   * Se mantiene sincronizado al editar (ver `volumenDesdeLotes` en motor/costos.ts). Debe ser > 0.
   */
  volumenMensual: DecimalString;
}

// ─────────────────────────────────────────────
// 2. Conceptos de costo
// ─────────────────────────────────────────────

/** Campos comunes a todo concepto de costo (base del componente reutilizable). */
interface ConceptoBase {
  id: Id;
  /** Descripción libre. Ej: "Alquiler", "Harina", "Comisión Mercado Pago". */
  nombre: string;
  /** Nota opcional para el usuario. */
  nota?: string;
}

/** Concepto que se paga por período. El motor lo normaliza a mensual. */
interface ConceptoPorPeriodo extends ConceptoBase {
  monto: DecimalString;
  /** Frecuencia con la que se cargó `monto`. */
  frecuencia: Frecuencia;
}

/** Se mantiene igual dentro del mes, sin importar cuánto se venda. Ej: alquiler. */
export interface CostoFijo extends ConceptoPorPeriodo {
  categoria: "fijo";
}

/**
 * Insumo directamente atribuible a cada unidad vendida. Ej: harina, envase.
 * Es el único costo con base por unidad.
 */
export interface CostoVariable extends ConceptoBase {
  categoria: "variable";
  /** Costo por cada unidad de venta. */
  montoUnitario: DecimalString;
}

/**
 * Otros costos que suelen quedar afuera del cálculo intuitivo. Ej: luz del taller, contador.
 * En el MVP se tratan como fijos del mes: así no se duplican con los variables
 * y el usuario no tiene que prorratearlos por unidad. Se separan de `CostoFijo`
 * solo para mostrarlos en su propio bloque de la interfaz.
 */
export interface CostoIndirecto extends ConceptoPorPeriodo {
  categoria: "indirecto";
}

export type ConceptoCosto = CostoFijo | CostoVariable | CostoIndirecto;
export type CategoriaCosto = ConceptoCosto["categoria"];

// ─────────────────────────────────────────────
// 3. Trabajo propio
// ─────────────────────────────────────────────

/**
 * Cómo cuenta su trabajo el usuario (ejemplo propuesto para el modo revendedor, pendiente de validar):
 * «hora» (por defecto) = horas por lote × valor por hora; «sueldo» = sueldo pretendido, un monto fijo por mes.
 */
export type ModoTrabajo = "hora" | "sueldo";

export interface TrabajoPropio {
  /** Si el usuario decide incluir el valor de su tiempo en el costo. */
  incluir: boolean;
  /** Ausente = «hora» (así siguen funcionando los borradores guardados antes de este cambio). */
  modo?: ModoTrabajo;
  /** Sueldo pretendido por mes. Solo se usa en modo «sueldo»: pasa directo al costo fijo, sin multiplicar. */
  sueldoMensual?: DecimalString;
  /** Horas que le dedica a cada lote. */
  horasPorLote: DecimalString;
  /**
   * Horas trabajadas por mes = `horasPorLote × lotes`.
   * Se mantiene sincronizado al editar (ver `horasMensualesDesdeLotes` en motor/costos.ts).
   * En modo «sueldo» es un dato opcional y solo informativo (horas al mes que le dedica): no entra al cálculo.
   */
  horasMensuales: DecimalString;
  /** Cuánto vale una hora de trabajo. */
  valorHora: DecimalString;
}

// ─────────────────────────────────────────────
// 4. Borrador del cálculo (estado global del recorrido)
// ─────────────────────────────────────────────

/**
 * Pasos del recorrido, tal como los muestra el diseño (Figma «PreciJusto»):
 * Tu producto → Costos (pestañas Fijos y Variables) → Resumen → Precio → Simulador.
 * Trabajo propio e indirectos viven dentro del paso «costos».
 */
export type PasoRecorrido =
  | "configuracion"
  | "costos"
  | "resumen"
  | "precio"
  | "simulador";

/** Cómo define el usuario su precio de venta (paso 4). */
export type ModoPrecio = "margen" | "manual";

export interface Precio {
  modo: ModoPrecio;
  /** Margen esperado en porcentaje (0–99), convención «margen sobre ventas». Ej.: "40". */
  margenPct: DecimalString;
  /** Precio que ingresa el usuario cuando elige «Ingresé mi precio». */
  precioManual: DecimalString;
}

export const PRECIO_INICIAL: Precio = {
  modo: "margen",
  margenPct: "40",
  precioManual: "",
};

export interface Calculo {
  id: Id;
  configuracion: Configuracion;
  costosFijos: CostoFijo[];
  costosVariables: CostoVariable[];
  costosIndirectos: CostoIndirecto[];
  trabajoPropio: TrabajoPropio;
  precio: Precio;
  /** Paso en el que quedó el usuario (para retomar). */
  pasoActual: PasoRecorrido;
  creadoEn: string; // ISO 8601
  actualizadoEn: string; // ISO 8601
}

// ─────────────────────────────────────────────
// 5. Resultados del motor (Semana 2 — se dejan definidos para acordar el contrato)
// Todos los importes son mensuales y sin redondear.
// ─────────────────────────────────────────────

export interface ResultadoCostos {
  totalCostosFijosMensual: DecimalString;
  totalIndirectosMensual: DecimalString;
  totalTrabajoPropioMensual: DecimalString;
  costoVariableUnitario: DecimalString;
  /** Costo total del mes para el volumen mensual estimado. */
  costoTotalMensual: DecimalString;
  /** Costo total mensual / volumen mensual. */
  costoUnitario: DecimalString;
}

// ─────────────────────────────────────────────
// 6. Validaciones
// ─────────────────────────────────────────────

/** "error" bloquea el cálculo; "advertencia" solo informa. */
export type Severidad = "error" | "advertencia";

export interface ErrorValidacion {
  /** Ruta del campo con problema. Ej: "configuracion.volumenMensual", "costosFijos.2.monto". */
  campo: string;
  mensaje: string;
  severidad: Severidad;
}

// ─────────────────────────────────────────────
// 7. Valores iniciales
// ─────────────────────────────────────────────

export const CONFIGURACION_INICIAL: Configuracion = {
  tipo: "producto",
  nombre: "",
  moneda: "ARS",
  unidadVenta: "unidad",
  unidadesPorLote: "",
  lotes: "1",
  volumenMensual: "",
};

export const TRABAJO_PROPIO_INICIAL: TrabajoPropio = {
  incluir: false,
  horasPorLote: "",
  horasMensuales: "",
  valorHora: "",
};
