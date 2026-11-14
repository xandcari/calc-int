import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";

import * as schema from "./schema";

/**
 * Conexión a Postgres (Neon) por HTTP. Se crea la primera vez que se usa, no al importar el archivo:
 * así `next build` no falla si en ese momento no está definida DATABASE_URL.
 *
 * Importante: el driver HTTP no admite transacciones interactivas (`db.transaction`).
 * Para escrituras atómicas usá `db.batch([...])`: Neon lo ejecuta todo en UNA transacción.
 */
function crearDb() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("Falta DATABASE_URL. Definila en .env.local (ver .env.example).");
  }
  return drizzle(neon(url), { schema });
}

export type Db = ReturnType<typeof crearDb>;

let instancia: Db | undefined;

export function getDb(): Db {
  instancia ??= crearDb();
  return instancia;
}
