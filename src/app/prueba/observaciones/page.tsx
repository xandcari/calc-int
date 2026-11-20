import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { NOMBRE_VERSION, etiquetaTipo } from "@/lib/anotaciones";
import { modoPruebaActivo } from "@/server/prueba/esquema";
import { listarObservaciones } from "@/server/prueba/repositorio";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Observaciones de la prueba",
  robots: { index: false, follow: false },
};

type Busqueda = { nombre?: string; version?: string; estado?: string };

const celda = "border-b border-gray-200 px-3 py-2 align-top text-sm text-gray-900";
const cabecera = "border-b border-gray-300 bg-gray-100 px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-gray-700";

export default async function ObservacionesPage({ searchParams }: { searchParams: Promise<Busqueda> }) {
  if (!modoPruebaActivo()) notFound();
  const filtros = await searchParams;

  let todas: Awaited<ReturnType<typeof listarObservaciones>> = [];
  let error: string | null = null;
  try {
    todas = await listarObservaciones();
  } catch {
    error = "No se pudo leer la base de datos de la prueba. Revisá que esté conectada en Vercel (variable DATABASE_URL de Preview).";
  }

  const nombres = [...new Set(todas.map((n) => n.nombre))].sort((a, b) => a.localeCompare(b, "es"));
  const filtradas = todas.filter(
    (n) =>
      (!filtros.nombre || n.nombre === filtros.nombre) &&
      (!filtros.version || n.version === filtros.version) &&
      (!filtros.estado || (filtros.estado === "resuelta") === n.resuelta),
  );

  const resumen = nombres.map((nombre) => {
    const suyas = todas.filter((n) => n.nombre === nombre);
    return { nombre, total: suyas.length, abiertas: suyas.filter((n) => !n.resuelta).length };
  });

  return (
    <main className="mx-auto max-w-6xl px-4 py-10">
      <h1 className="text-2xl font-bold text-primary-900">Observaciones de la prueba</h1>
      <p className="mt-1 text-sm text-gray-700">
        Notas de usabilidad del equipo sobre las versiones A, B, C y la original. {todas.length} en total.
      </p>

      {error ? (
        <p role="alert" className="mt-6 rounded-lg bg-danger-50 px-4 py-3 text-sm text-danger-700">
          {error}
        </p>
      ) : (
        <>
          {resumen.length > 0 ? (
            <ul className="mt-6 flex flex-wrap gap-2" aria-label="Notas por persona">
              {resumen.map((r) => (
                <li key={r.nombre} className="rounded-full border border-gray-300 bg-white px-3 py-1 text-sm text-primary-900">
                  <strong>{r.nombre}</strong>: {r.total} ({r.abiertas} abiertas)
                </li>
              ))}
            </ul>
          ) : null}

          <form method="get" className="mt-6 flex flex-wrap items-end gap-3">
            <label className="text-sm text-primary-900">
              <span className="block font-medium">Persona</span>
              <select name="nombre" defaultValue={filtros.nombre ?? ""} className="mt-1 min-h-11 rounded-lg border border-gray-300 bg-white px-2">
                <option value="">Todas</option>
                {nombres.map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm text-primary-900">
              <span className="block font-medium">Versión</span>
              <select name="version" defaultValue={filtros.version ?? ""} className="mt-1 min-h-11 rounded-lg border border-gray-300 bg-white px-2">
                <option value="">Todas</option>
                {Object.entries(NOMBRE_VERSION).map(([id, etiqueta]) => (
                  <option key={id} value={id}>
                    {etiqueta}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm text-primary-900">
              <span className="block font-medium">Estado</span>
              <select name="estado" defaultValue={filtros.estado ?? ""} className="mt-1 min-h-11 rounded-lg border border-gray-300 bg-white px-2">
                <option value="">Todas</option>
                <option value="abierta">Abiertas</option>
                <option value="resuelta">Resueltas</option>
              </select>
            </label>
            <button type="submit" className="min-h-11 rounded-full bg-primary-900 px-4 text-sm font-semibold text-white hover:bg-primary-700">
              Filtrar
            </button>
            {/* Descarga de un archivo, no una navegación entre páginas: un <Link> la precargaría. */}
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
            <a href="/api/prueba/observaciones?formato=csv" className="inline-flex min-h-11 items-center text-sm font-semibold text-primary-900 underline">
              Descargar todo en CSV (Excel)
            </a>
          </form>

          <div className="mt-6 overflow-x-auto rounded-lg border border-gray-200">
            <table className="w-full min-w-[760px] border-collapse">
              <caption className="sr-only">Observaciones ({filtradas.length})</caption>
              <thead>
                <tr>
                  {["Fecha", "Quién", "Versión", "Tipo", "Nota", "Pantalla", "Estado"].map((t) => (
                    <th key={t} scope="col" className={cabecera}>
                      {t}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtradas.length === 0 ? (
                  <tr>
                    <td colSpan={7} className={celda}>
                      Todavía no hay notas con estos filtros.
                    </td>
                  </tr>
                ) : (
                  filtradas.map((n) => (
                    <tr key={n.id}>
                      <td className={celda}>{n.creadaEn.toLocaleString("es-AR", { timeZone: "America/Argentina/Buenos_Aires", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</td>
                      <td className={celda}>{n.nombre}</td>
                      <td className={celda}>{NOMBRE_VERSION[n.version] ?? n.version}</td>
                      <td className={celda}>{etiquetaTipo(n.tipo)}</td>
                      <td className={`${celda} whitespace-pre-wrap`}>
                        {n.texto}
                        <span className="mt-1 block text-xs text-gray-700">{n.general ? "Nota general" : `Sobre: ${n.elemento}`}</span>
                      </td>
                      <td className={celda}>
                        <a className="font-semibold text-primary-900 underline" href={`${n.ruta}?estilo=${n.version}`}>
                          {n.ruta}
                          <span className="sr-only"> (abrir en la app)</span>
                        </a>
                      </td>
                      <td className={celda}>{n.resuelta ? "Resuelta" : "Abierta"}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </main>
  );
}
