import { and, count, desc, eq, gt, sql } from "drizzle-orm";

import { getDb } from "@/db";
import { observacionPrueba, type ObservacionPrueba } from "@/db/schema/prueba";

import type { NuevaObservacion } from "./esquema";

/**
 * La tabla se crea sola la primera vez (una vez por instancia del servidor): así la prueba funciona con solo
 * conectar una base vacía, sin correr migraciones ni tocar el esquema del producto.
 */
let tablaLista: Promise<void> | undefined;

function asegurarTabla(): Promise<void> {
  tablaLista ??= (async () => {
    const db = getDb();
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS observacion_prueba (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        creada_en timestamptz NOT NULL DEFAULT now(),
        nombre text NOT NULL,
        token_autor text NOT NULL,
        version text NOT NULL,
        ruta text NOT NULL,
        tipo text NOT NULL,
        texto text NOT NULL,
        elemento text NOT NULL,
        selector text,
        general boolean NOT NULL DEFAULT false,
        fx real NOT NULL,
        fy real NOT NULL,
        dx real NOT NULL,
        dy real NOT NULL,
        dispositivo text NOT NULL,
        resuelta boolean NOT NULL DEFAULT false
      )
    `);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS observacion_prueba_ruta_version_idx ON observacion_prueba (ruta, version)`);
  })().catch((error) => {
    tablaLista = undefined; // que el próximo pedido reintente
    throw error;
  });
  return tablaLista;
}

export async function listarObservaciones(): Promise<ObservacionPrueba[]> {
  await asegurarTabla();
  return getDb().select().from(observacionPrueba).orderBy(desc(observacionPrueba.creadaEn)).limit(1000);
}

export async function contarDelAutor(token: string): Promise<{ total: number; ultimoMinuto: number }> {
  await asegurarTabla();
  const db = getDb();
  const haceUnMinuto = new Date(Date.now() - 60_000);
  const [[todas], [recientes]] = await Promise.all([
    db.select({ n: count() }).from(observacionPrueba).where(eq(observacionPrueba.tokenAutor, token)),
    db
      .select({ n: count() })
      .from(observacionPrueba)
      .where(and(eq(observacionPrueba.tokenAutor, token), gt(observacionPrueba.creadaEn, haceUnMinuto))),
  ]);
  return { total: Number(todas?.n ?? 0), ultimoMinuto: Number(recientes?.n ?? 0) };
}

export async function crearObservacion(token: string, datos: NuevaObservacion): Promise<ObservacionPrueba> {
  await asegurarTabla();
  const [fila] = await getDb()
    .insert(observacionPrueba)
    .values({ ...datos, tokenAutor: token })
    .returning();
  return fila;
}

export async function cambiarResuelta(id: string, resuelta: boolean): Promise<boolean> {
  await asegurarTabla();
  const filas = await getDb()
    .update(observacionPrueba)
    .set({ resuelta })
    .where(eq(observacionPrueba.id, id))
    .returning({ id: observacionPrueba.id });
  return filas.length > 0;
}

/** Borra solo si la nota es de ese navegador (mismo token). */
export async function borrarPropia(id: string, token: string): Promise<boolean> {
  await asegurarTabla();
  const filas = await getDb()
    .delete(observacionPrueba)
    .where(and(eq(observacionPrueba.id, id), eq(observacionPrueba.tokenAutor, token)))
    .returning({ id: observacionPrueba.id });
  return filas.length > 0;
}

/** Lo que se le muestra a cualquiera: sin el token del autor. */
export function paraCliente(fila: ObservacionPrueba, tokenQuePide: string | null) {
  const { tokenAutor, creadaEn, ...resto } = fila;
  return { ...resto, creadaEn: creadaEn.toISOString(), mia: !!tokenQuePide && tokenAutor === tokenQuePide };
}
