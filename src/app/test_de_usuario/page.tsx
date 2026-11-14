"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

import {
  borrarCalculoGuardado,
  cambiarCompartido,
  listarMisCalculos,
  rutaCompartida,
  type ResumenCalculo,
} from "@/lib/api-calculos";
import { useSession } from "@/lib/auth-client";

/**
 * PÁGINA DE PRUEBA del backend (sin diseño): «Mis cálculos».
 * Lista TODOS los cálculos que guardó el usuario logueado, con orden elegible y el contador de cupo.
 * «Abrir y editar» entra por /c/[id], que carga los datos en los 5 pasos de /calculadora; ahí se puede ir
 * hacia atrás, modificar y volver a guardar (actualiza el mismo cálculo).
 * Borrar esta carpeta cuando la interfaz real esté lista.
 */

const PASOS: Record<string, string> = {
  configuracion: "Tu producto",
  costos: "Costos",
  resumen: "Resumen",
  precio: "Precio",
  simulador: "Simulador",
};

type Orden = "recientes" | "antiguos" | "az" | "za";

const ORDENES: Array<{ valor: Orden; etiqueta: string }> = [
  { valor: "recientes", etiqueta: "Más recientes primero" },
  { valor: "antiguos", etiqueta: "Más antiguos primero" },
  { valor: "az", etiqueta: "Nombre (A → Z)" },
  { valor: "za", etiqueta: "Nombre (Z → A)" },
];

/**
 * Compara por nombre sin distinguir mayúsculas ni tildes ("Árbol" va junto a "arbol").
 * Los cálculos sin nombre quedan siempre al final, tanto de A→Z como de Z→A.
 */
function porNombre(a: ResumenCalculo, b: ResumenCalculo, descendente = false): number {
  const sinA = !a.nombre.trim();
  const sinB = !b.nombre.trim();
  if (sinA !== sinB) return sinA ? 1 : -1;
  const orden = a.nombre.localeCompare(b.nombre, "es", { sensitivity: "base" });
  return descendente ? -orden : orden;
}

function ordenar(lista: ResumenCalculo[], orden: Orden): ResumenCalculo[] {
  const copia = [...lista]; // no se modifica la lista original
  switch (orden) {
    case "recientes":
      return copia.sort((a, b) => b.actualizadoEn.localeCompare(a.actualizadoEn));
    case "antiguos":
      return copia.sort((a, b) => a.actualizadoEn.localeCompare(b.actualizadoEn));
    case "az":
      return copia.sort((a, b) => porNombre(a, b));
    case "za":
      return copia.sort((a, b) => porNombre(a, b, true));
  }
}

const fecha = (iso: string) => new Date(iso).toLocaleString("es-AR");

export default function PruebaDeUsuario() {
  const { data: sesion, isPending } = useSession();
  // null = todavía cargando (o falló); [] = sin cálculos guardados.
  const [datos, setDatos] = useState<{ calculos: ResumenCalculo[]; limite: number } | null>(null);
  const [orden, setOrden] = useState<Orden>("recientes");
  const [mensaje, setMensaje] = useState("");
  const hayUsuario = Boolean(sesion);

  const recargar = useCallback(async () => {
    setDatos(await listarMisCalculos());
  }, []);

  useEffect(() => {
    if (hayUsuario) void recargar();
  }, [hayUsuario, recargar]);

  const lista = useMemo(() => (datos ? ordenar(datos.calculos, orden) : []), [datos, orden]);

  async function alternarLink(c: ResumenCalculo) {
    const ok = await cambiarCompartido(c.id, !c.compartido);
    setMensaje(ok ? "" : "No se pudo cambiar el link.");
    await recargar();
  }

  async function borrar(c: ResumenCalculo) {
    if (!window.confirm(`¿Borrar «${c.nombre || "sin nombre"}»? No se puede deshacer.`)) return;
    const ok = await borrarCalculoGuardado(c.id);
    setMensaje(ok ? "" : "No se pudo borrar.");
    await recargar();
  }

  async function copiar(c: ResumenCalculo) {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}${rutaCompartida(c.id)}`);
      setMensaje("Link copiado.");
    } catch {
      setMensaje("No se pudo copiar. Copialo desde la barra al abrir el cálculo.");
    }
  }

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-4 p-6">
      <h1 className="text-xl font-bold">Mis cálculos (prueba del backend)</h1>
      <div className="flex gap-4">
        <Link className="underline" href="/calculadora/producto">← Volver a la calculadora</Link>
        <Link className="underline" href="/test_de_guardado">Cuenta y guardado</Link>
      </div>

      {isPending ? (
        <p>Cargando sesión…</p>
      ) : !sesion ? (
        <p>
          No iniciaste sesión. Entrá desde <Link className="underline" href="/test_de_guardado">/test_de_guardado</Link>.
        </p>
      ) : (
        <>
          <p>Sesión: {sesion.user.email}</p>
          {mensaje ? <p>{mensaje}</p> : null}

          {datos === null ? (
            <p>Cargando tus cálculos…</p>
          ) : (
            <>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="font-semibold">
                  {datos.calculos.length} de {datos.limite} cálculos guardados
                </p>
                <label className="flex items-center gap-2 text-sm">
                  Ordenar por
                  <select
                    className="rounded border p-1"
                    value={orden}
                    onChange={(e) => setOrden(e.target.value as Orden)}
                  >
                    {ORDENES.map((o) => (
                      <option key={o.valor} value={o.valor}>
                        {o.etiqueta}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              {lista.length === 0 ? (
                <p>Todavía no guardaste ningún cálculo.</p>
              ) : (
                <ul className="flex flex-col gap-3">
                  {lista.map((c) => (
                    <li key={c.id} className="flex flex-col gap-2 rounded border p-3">
                      <div>
                        <strong>{c.nombre || "(sin nombre)"}</strong> · {c.tipo}
                        <br />
                        <span className="text-sm text-gray-600">
                          Quedó en: {PASOS[c.pasoActual] ?? c.pasoActual} · Modificado: {fecha(c.actualizadoEn)}
                        </span>
                        <br />
                        <span className="text-sm">Link: {c.compartido ? "activo" : "desactivado"}</span>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Link className="rounded bg-black px-3 py-1 text-white" href={rutaCompartida(c.id)}>
                          Abrir y editar
                        </Link>
                        <button className="rounded border px-3 py-1" onClick={() => copiar(c)}>Copiar link</button>
                        <button className="rounded border px-3 py-1" onClick={() => alternarLink(c)}>
                          {c.compartido ? "Desactivar link" : "Activar link"}
                        </button>
                        <button className="rounded border px-3 py-1" onClick={() => borrar(c)}>Borrar</button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </>
      )}
    </main>
  );
}
