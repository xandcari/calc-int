import { and, count, desc, eq } from "drizzle-orm";
import type { BatchItem } from "drizzle-orm/batch";

import { getDb } from "@/db";
import { calculo, costoFijo, costoIndirecto, costoVariable, escenario } from "@/db/schema";
import type { Calculo } from "@/domain/types";

import {
  calculoAColumnas,
  calculoAFilasHijas,
  filasACalculo,
  type CalculoParaGuardar,
  type FilasHijas,
} from "./mapeo";

/**
 * Acceso a la BD para los cálculos. Un cálculo ocupa varias tablas (ver db/schema/calculo.ts), y el
 * driver HTTP de Neon no tiene transacciones interactivas: por eso cada escritura se manda con
 * `db.batch([...])`, que Neon ejecuta como UNA sola transacción (o se guarda todo o no se guarda nada).
 */

/** Máximo de cálculos guardados por usuario (freno contra abuso; ajustalo si el equipo quiere otro). */
export const MAX_CALCULOS_POR_USUARIO = 50;

type Db = ReturnType<typeof getDb>;
type Consulta = BatchItem<"pg">;

/** `db.batch` exige al menos una consulta: lo garantizamos con este tipo. */
const comoLote = (consultas: Consulta[]) => consultas as [Consulta, ...Consulta[]];

/** Inserts de las filas hijas. Las listas vacías se omiten (un INSERT sin filas da error). */
function insertarHijas(db: Db, hijas: FilasHijas): Consulta[] {
  const consultas: Consulta[] = [];
  if (hijas.fijos.length) consultas.push(db.insert(costoFijo).values(hijas.fijos));
  if (hijas.indirectos.length) consultas.push(db.insert(costoIndirecto).values(hijas.indirectos));
  if (hijas.variables.length) consultas.push(db.insert(costoVariable).values(hijas.variables));
  if (hijas.escenarios.length) consultas.push(db.insert(escenario).values(hijas.escenarios));
  return consultas;
}

/** Guarda un cálculo nuevo para `usuarioId`. Devuelve el id (UUID) que va en el link. */
export async function crearCalculo(usuarioId: string, datos: CalculoParaGuardar) {
  const db = getDb();
  // El id se genera acá (no en la BD) porque las filas hijas lo necesitan dentro del mismo lote.
  const id = crypto.randomUUID();
  const ahora = new Date();

  await db.batch(
    comoLote([
      db.insert(calculo).values({
        id,
        usuarioId,
        ...calculoAColumnas(datos),
        creadoEn: ahora,
        actualizadoEn: ahora,
      }),
      ...insertarHijas(db, calculoAFilasHijas(datos, id)),
    ]),
  );
  return { id, creadoEn: ahora.toISOString(), actualizadoEn: ahora.toISOString() };
}

/**
 * Reemplaza TODO el contenido de un cálculo existente (las listas se borran y se vuelven a insertar,
 * así los elementos eliminados en el frontend también desaparecen de la BD).
 * No verifica el dueño: el llamador tiene que haberlo comprobado con `buscarDueno`.
 */
export async function reemplazarCalculo(id: string, datos: CalculoParaGuardar) {
  const db = getDb();
  const ahora = new Date();

  await db.batch(
    comoLote([
      db
        .update(calculo)
        .set({ ...calculoAColumnas(datos), versionEsquema: 1, actualizadoEn: ahora })
        .where(eq(calculo.id, id)),
      db.delete(costoFijo).where(eq(costoFijo.calculoId, id)),
      db.delete(costoIndirecto).where(eq(costoIndirecto.calculoId, id)),
      db.delete(costoVariable).where(eq(costoVariable.calculoId, id)),
      db.delete(escenario).where(eq(escenario.calculoId, id)),
      ...insertarHijas(db, calculoAFilasHijas(datos, id)),
    ]),
  );
  return { id, actualizadoEn: ahora.toISOString() };
}

/** Dueño y estado de compartido de un cálculo (consulta liviana, sin traer las listas). */
export async function buscarDueno(id: string) {
  const [fila] = await getDb()
    .select({ usuarioId: calculo.usuarioId, compartido: calculo.compartido })
    .from(calculo)
    .where(eq(calculo.id, id))
    .limit(1);
  return fila ?? null;
}

/** Lee un cálculo completo y lo devuelve con la forma `Calculo` del frontend. null si no existe. */
export async function leerCalculo(
  id: string,
): Promise<{ calculo: Calculo; usuarioId: string; compartido: boolean } | null> {
  const db = getDb();
  // Las 5 lecturas viajan en una sola petición HTTP.
  const [filas, fijos, indirectos, variables, escenarios] = await db.batch([
    db.select().from(calculo).where(eq(calculo.id, id)).limit(1),
    db.select().from(costoFijo).where(eq(costoFijo.calculoId, id)),
    db.select().from(costoIndirecto).where(eq(costoIndirecto.calculoId, id)),
    db.select().from(costoVariable).where(eq(costoVariable.calculoId, id)),
    db.select().from(escenario).where(eq(escenario.calculoId, id)),
  ]);

  const fila = filas[0];
  if (!fila) return null;
  return {
    calculo: filasACalculo(fila, { fijos, indirectos, variables, escenarios }),
    usuarioId: fila.usuarioId,
    compartido: fila.compartido,
  };
}

/** Activa o desactiva el link para los demás. Devuelve false si el cálculo no es del usuario. */
export async function cambiarCompartido(id: string, usuarioId: string, compartido: boolean): Promise<boolean> {
  const filas = await getDb()
    .update(calculo)
    .set({ compartido, actualizadoEn: new Date() })
    .where(and(eq(calculo.id, id), eq(calculo.usuarioId, usuarioId)))
    .returning({ id: calculo.id });
  return filas.length > 0;
}

/** Borra el cálculo y (por ON DELETE CASCADE) todas sus filas hijas. Solo si es del usuario. */
export async function borrarCalculo(id: string, usuarioId: string): Promise<boolean> {
  const filas = await getDb()
    .delete(calculo)
    .where(and(eq(calculo.id, id), eq(calculo.usuarioId, usuarioId)))
    .returning({ id: calculo.id });
  return filas.length > 0;
}

export async function contarCalculos(usuarioId: string): Promise<number> {
  const [fila] = await getDb().select({ total: count() }).from(calculo).where(eq(calculo.usuarioId, usuarioId));
  return fila?.total ?? 0;
}

/** Lista liviana de los cálculos de un usuario (sin las listas de costos), del más reciente al más viejo. */
export async function listarCalculos(usuarioId: string) {
  return getDb()
    .select({
      id: calculo.id,
      nombre: calculo.nombre,
      tipo: calculo.tipo,
      pasoActual: calculo.pasoActual,
      compartido: calculo.compartido,
      creadoEn: calculo.creadoEn,
      actualizadoEn: calculo.actualizadoEn,
    })
    .from(calculo)
    .where(eq(calculo.usuarioId, usuarioId))
    .orderBy(desc(calculo.actualizadoEn))
    .limit(MAX_CALCULOS_POR_USUARIO);
}
