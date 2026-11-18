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

/**
 * Cómo produce o consigue lo que vende el usuario (primer paso del recorrido, «¿Cómo producís?»).
 * - `lotes`: produce en tandas (pastelería, velas). Unidades por lote × lotes por mes.
 * - `unidad`: arma cada producto a medida. Carga el volumen por mes y las horas por unidad.
 * - `reventa`: compra productos terminados. Carga las ventas por mes y el tiempo que le lleva cada venta.
 *
 * Las rutas `unidad` y `reventa` siguen la «regla del 1» de Data: 1 unidad por lote y, en «lotes», el volumen total.
 * Así el motor es el mismo para las tres y solo cambia lo que se le pregunta al usuario.
 */
export type RutaProduccion = "lotes" | "unidad" | "reventa";

export const RUTAS_PRODUCCION: RutaProduccion[] = ["lotes", "unidad", "reventa"];

/** El MVP trabaja solo en pesos argentinos. */
export type Moneda = "ARS";

/**
 * Frecuencia con la que el usuario carga un importe en la interfaz.
 * El motor la normaliza a mensual: semanal × 4, anual ÷ 12.
 */
export type Frecuencia = "semanal" | "mensual" | "anual";

export interface Configuracion {
  tipo: TipoOferta;
  /** Ruta elegida en el paso 1. Cambia las preguntas de volumen y de tiempo, no las fórmulas. */
  ruta: RutaProduccion;
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
 * Base en la que el usuario cargó el monto de un insumo.
 * - `unidad`: lo que cuesta ese insumo para una unidad terminada (se usa tal cual).
 * - `lote`: lo que cuesta ese insumo para todo el lote (ruta «lotes»); el motor lo divide por las unidades del lote.
 */
export type BaseInsumo = "unidad" | "lote";

/**
 * Insumo directamente atribuible a cada unidad vendida. Ej: harina, envase.
 * Es el único costo con base por unidad.
 */
export interface CostoVariable extends ConceptoBase {
  categoria: "variable";
  /**
   * Monto del insumo, en la base indicada por `base` (por unidad si no se indica). Se llama «unitario» por la
   * base habitual; para obtener el costo por unidad siempre usar `costoVariableUnitarioDe` (motor/costos.ts).
   */
  montoUnitario: DecimalString;
  /** Base del monto. Solo la ruta «lotes» admite `lote`; en las demás se ignora. */
  base?: BaseInsumo;
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
 * Cómo define su sueldo quien revende (ruta «reventa»): un monto fijo por mes, o las horas que trabaja al mes
 * por lo que vale cada hora. Las otras rutas no lo usan.
 */
export type ModoSueldo = "fijo" | "horas";

export const MODOS_SUELDO: ModoSueldo[] = ["fijo", "horas"];

export interface TrabajoPropio {
  /** Si el usuario decide incluir el valor de su tiempo en el costo. */
  incluir: boolean;
  /** Horas que le dedica a cada lote (ruta «lotes») o a cada unidad (ruta «unidad»). La ruta «reventa» no las usa. */
  horasPorLote: DecimalString;
  /**
   * Horas trabajadas por mes = `horasPorLote × lotes`.
   * Se mantiene sincronizado al editar (ver `horasMensualesDesdeLotes` en motor/costos.ts).
   */
  horasMensuales: DecimalString;
  /** Cuánto vale una hora de trabajo. */
  valorHora: DecimalString;
  /**
   * Sueldo fijo que quiere ganar por mes. Solo lo usa la ruta «reventa» (Alternativa 2 del glosario de Data,
   * elegida por el equipo): entra directo como costo fijo y no se multiplica por el volumen.
   */
  sueldoMensual: DecimalString;
  /** Solo «reventa»: si el sueldo se carga como monto fijo o como horas al mes × valor por hora. */
  modoSueldo: ModoSueldo;
  /**
   * Solo «reventa» con `modoSueldo: "horas"`: horas que trabaja por mes, cargadas directamente (no se multiplican
   * por el volumen). El trabajo propio vale `horasAlMes × valorHora`.
   */
  horasAlMes: DecimalString;
}

// ─────────────────────────────────────────────
// 4. Borrador del cálculo (estado global del recorrido)
// ─────────────────────────────────────────────

/**
 * Pasos del recorrido, tal como los muestra el diseño (Figma «Preciar»):
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

/** Escenario del simulador (paso 5): cuánto se mueve cada variable respecto de la situación base. */
export interface EscenarioUsuario {
  id: Id;
  nombre: string;
  /** Cambio porcentual (−50 a +100) del costo variable unitario. "0" = sin cambio. */
  insumosPct: DecimalString;
  /** Cambio porcentual (−50 a +100) del precio de venta. */
  precioPct: DecimalString;
  /** Cambio porcentual (−50 a +100) del volumen mensual. */
  produccionPct: DecimalString;
}

/** Máximo de escenarios que se pueden tener a la vez. */
export const MAX_ESCENARIOS = 6;

/** Escenarios con los que arranca el simulador (ids fijos: mismo estado en servidor y cliente). */
export const ESCENARIOS_INICIALES: EscenarioUsuario[] = [
  { id: "escenario-insumos", nombre: "Suba de insumos", insumosPct: "20", precioPct: "0", produccionPct: "0" },
  { id: "escenario-precio", nombre: "Cambio de precio", insumosPct: "0", precioPct: "15", produccionPct: "0" },
  { id: "escenario-produccion", nombre: "Más producción", insumosPct: "0", precioPct: "0", produccionPct: "30" },
];

export interface Calculo {
  id: Id;
  configuracion: Configuracion;
  costosFijos: CostoFijo[];
  costosVariables: CostoVariable[];
  costosIndirectos: CostoIndirecto[];
  trabajoPropio: TrabajoPropio;
  precio: Precio;
  escenarios: EscenarioUsuario[];
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
  ruta: "lotes",
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
  sueldoMensual: "",
  modoSueldo: "fijo",
  horasAlMes: "",
};
