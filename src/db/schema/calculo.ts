import {
  boolean,
  index,
  integer,
  numeric,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

import { user } from "./auth";

/**
 * Un `Calculo` (src/domain/types.ts) se guarda NORMALIZADO: una fila en `calculo` con todos los
 * campos escalares, y una tabla hija por cada lista (costos fijos, variables, indirectos y escenarios).
 * Cada lista tiene tantas filas como elementos: 3 costos fijos = 3 filas, 100 = 100 filas.
 *
 * Los importes (`DecimalString`) van en columnas `numeric` SIN precisión fija: Postgres conserva
 * los decimales tal como se cargaron ("12.50" vuelve como "12.50") y Drizzle los devuelve como string,
 * que es justo el formato del dominio. Un importe vacío ("") se guarda como NULL.
 *
 * Los ids de cada elemento (`CostoFijo.id`, etc.) los genera el frontend y se conservan tal cual
 * (`text`): así el objeto que vuelve de la BD es idéntico al que se guardó.
 */

export const tipoOferta = pgEnum("tipo_oferta", ["producto", "servicio"]);
export const moneda = pgEnum("moneda", ["ARS"]);
export const frecuencia = pgEnum("frecuencia", ["semanal", "mensual", "anual"]);
export const modoPrecio = pgEnum("modo_precio", ["margen", "manual"]);
export const pasoRecorrido = pgEnum("paso_recorrido", [
  "configuracion",
  "costos",
  "resumen",
  "precio",
  "simulador",
]);

/** Un cálculo guardado. Su `id` es el que va en el link para compartir. */
export const calculo = pgTable(
  "calculo",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** Dueño: el único que puede modificar, (des)compartir o borrar. */
    usuarioId: text("usuario_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    /** Versión del formato de las columnas, por si algún día hay que migrar datos viejos. */
    versionEsquema: integer("version_esquema").notNull().default(1),
    /** false = el link deja de funcionar para los demás (el dueño lo sigue viendo). */
    compartido: boolean("compartido").notNull().default(true),

    // Configuracion (paso 1)
    tipo: tipoOferta("tipo").notNull(),
    nombre: text("nombre").notNull(),
    moneda: moneda("moneda").notNull().default("ARS"),
    unidadVenta: text("unidad_venta").notNull(),
    unidadesPorLote: numeric("unidades_por_lote"),
    lotes: numeric("lotes"),
    volumenMensual: numeric("volumen_mensual"),

    // TrabajoPropio
    trabajoIncluir: boolean("trabajo_incluir").notNull().default(false),
    trabajoHorasPorLote: numeric("trabajo_horas_por_lote"),
    trabajoHorasMensuales: numeric("trabajo_horas_mensuales"),
    trabajoValorHora: numeric("trabajo_valor_hora"),

    // Precio (paso 4)
    precioModo: modoPrecio("precio_modo").notNull(),
    precioMargenPct: numeric("precio_margen_pct"),
    precioManual: numeric("precio_manual"),

    /** Paso en el que quedó el usuario (para retomar). */
    pasoActual: pasoRecorrido("paso_actual").notNull(),

    creadoEn: timestamp("creado_en", { withTimezone: true }).notNull().defaultNow(),
    actualizadoEn: timestamp("actualizado_en", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("calculo_usuario_idx").on(t.usuarioId)],
);

/** Columnas comunes de un concepto de costo (clave primaria: cálculo + id del concepto). Es función para crear columnas nuevas en cada tabla. */
const columnasDeConcepto = () => ({
  calculoId: uuid("calculo_id")
    .notNull()
    .references(() => calculo.id, { onDelete: "cascade" }),
  id: text("id").notNull(),
  /** Posición dentro de la lista: se guarda para devolver los elementos en el mismo orden. */
  orden: integer("orden").notNull(),
  nombre: text("nombre").notNull(),
  nota: text("nota"),
});

export const costoFijo = pgTable(
  "costo_fijo",
  {
    ...columnasDeConcepto(),
    monto: numeric("monto"),
    frecuencia: frecuencia("frecuencia").notNull(),
  },
  (t) => [primaryKey({ columns: [t.calculoId, t.id] })],
);

export const costoIndirecto = pgTable(
  "costo_indirecto",
  {
    ...columnasDeConcepto(),
    monto: numeric("monto"),
    frecuencia: frecuencia("frecuencia").notNull(),
  },
  (t) => [primaryKey({ columns: [t.calculoId, t.id] })],
);

export const costoVariable = pgTable(
  "costo_variable",
  {
    ...columnasDeConcepto(),
    montoUnitario: numeric("monto_unitario"),
  },
  (t) => [primaryKey({ columns: [t.calculoId, t.id] })],
);

export const escenario = pgTable(
  "escenario",
  {
    calculoId: uuid("calculo_id")
      .notNull()
      .references(() => calculo.id, { onDelete: "cascade" }),
    id: text("id").notNull(),
    orden: integer("orden").notNull(),
    nombre: text("nombre").notNull(),
    insumosPct: numeric("insumos_pct"),
    precioPct: numeric("precio_pct"),
    produccionPct: numeric("produccion_pct"),
  },
  (t) => [primaryKey({ columns: [t.calculoId, t.id] })],
);
