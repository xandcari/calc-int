import { boolean, pgTable, real, text, timestamp, uuid } from "drizzle-orm/pg-core";

/**
 * Observaciones de usabilidad de la app de prueba (solo con NEXT_PUBLIC_MODO_PRUEBA=1).
 *
 * A propósito NO se exporta desde `schema/index.ts`: no forma parte del producto, así que `db:push` del equipo
 * no la toca. La tabla se crea sola la primera vez que se usa (ver `server/prueba/repositorio.ts`).
 */
export const observacionPrueba = pgTable("observacion_prueba", {
  id: uuid("id").primaryKey().defaultRandom(),
  creadaEn: timestamp("creada_en", { withTimezone: true }).notNull().defaultNow(),
  /** Nombre que escribió la persona (no hay cuentas en la prueba). */
  nombre: text("nombre").notNull(),
  /** Identificador al azar de ese navegador: permite borrar las notas propias. Nunca se devuelve. */
  tokenAutor: text("token_autor").notNull(),
  version: text("version").notNull(),
  ruta: text("ruta").notNull(),
  tipo: text("tipo").notNull(),
  texto: text("texto").notNull(),
  elemento: text("elemento").notNull(),
  selector: text("selector"),
  general: boolean("general").notNull().default(false),
  fx: real("fx").notNull(),
  fy: real("fy").notNull(),
  dx: real("dx").notNull(),
  dy: real("dy").notNull(),
  dispositivo: text("dispositivo").notNull(),
  resuelta: boolean("resuelta").notNull().default(false),
});

export type ObservacionPrueba = typeof observacionPrueba.$inferSelect;
