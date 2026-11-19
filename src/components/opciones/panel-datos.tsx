"use client";

import Decimal from "decimal.js";
import { useId, useState } from "react";

import { leerNumero } from "@/domain/motor/numeros";
import { nivelDeMargen, precioPorMargen } from "@/domain/motor/precio";
import { useAnalisisPrecio } from "@/hooks/use-analisis-precio";
import { formatearCantidad, formatearMonto, formatearPorcentaje } from "@/lib/formato";
import { useCalculoStore } from "@/store/calculo-store";

type Tono = "ok" | "aviso" | "alerta" | "info";

interface Sugerencia {
  id: string;
  tono: Tono;
  texto: string;
  /** Acción opcional: fija el precio por margen en el paso 4 (se puede deshacer cambiando el margen ahí). */
  aplicar?: { etiqueta: string; margenPct: string };
}

const TONOS: Record<Tono, string> = {
  ok: "border-success-700 bg-success-50 text-gray-900",
  aviso: "border-warning-700 bg-warning-50 text-gray-900",
  alerta: "border-danger-600 bg-danger-50 text-gray-900",
  info: "border-primary-600 bg-primary-50 text-gray-900",
};

function Indicador({ etiqueta, valor, tono }: { etiqueta: string; valor: string; tono?: "bien" | "mal" }) {
  const color = tono === "bien" ? "text-success-700" : tono === "mal" ? "text-danger-700" : "text-gray-900";
  return (
    <div className="min-w-28 shrink-0 px-3 py-1.5">
      <dt className="text-[0.7rem] font-semibold uppercase tracking-wider text-gray-700">{etiqueta}</dt>
      <dd className={`text-lg font-bold leading-tight ${color}`}>{valor}</dd>
    </div>
  );
}

/**
 * Opción C (cliente exigente): barra fija de indicadores + panel de sugerencias con reglas simples.
 * Solo lee lo que ya calcula el motor; la única acción es fijar el precio por margen (la misma del paso 4).
 */
export function PanelDatos() {
  const { calculo, resumen, precio, analisis } = useAnalisisPrecio();
  const actualizarPrecio = useCalculoStore((s) => s.actualizarPrecio);
  const [abierto, setAbierto] = useState(false);
  const idPanel = useId();

  const costo = leerNumero(resumen.costoUnitario ?? "");
  const precioN = leerNumero(precio ?? "");
  const gananciaUnidad = costo && precioN ? precioN.minus(costo) : null;
  const gananciaMes = analisis ? Number(analisis.gananciaNetaMensual) : null;
  const volumen = leerNumero(resumen.volumenMensual ?? "");

  const sugerencias: Sugerencia[] = [];
  if (!costo) {
    sugerencias.push({ id: "costos", tono: "info", texto: "Cargá tus costos y las unidades por mes para ver los indicadores y las sugerencias." });
  } else if (!resumen.tieneCostosFijos) {
    sugerencias.push({ id: "fijos", tono: "aviso", texto: "Todavía no cargaste costos fijos ni tu tiempo: el costo por unidad puede estar subestimado." });
  }
  if (costo && !analisis) {
    sugerencias.push({ id: "precio", tono: "info", texto: "Elegí un precio en el paso 4 para ver ganancia, margen y punto de equilibrio." });
  }
  if (analisis) {
    const margen = analisis.margenResultantePct;
    const nivel = nivelDeMargen(margen);
    const por30 = precioPorMargen(calculo, "30");
    if (analisis.estado === "inalcanzable") {
      sugerencias.push({
        id: "inalcanzable",
        tono: "alerta",
        texto: "Tu precio no cubre ni el costo variable de cada unidad: cuanto más vendas, más perdés.",
        aplicar: por30 ? { etiqueta: `Probar con ${formatearMonto(por30)} (margen 30%)`, margenPct: "30" } : undefined,
      });
    } else if (new Decimal(margen).isNegative()) {
      sugerencias.push({
        id: "bajo-costo",
        tono: "alerta",
        texto: `Vendés por debajo de tu costo por unidad (margen ${formatearPorcentaje(margen)}).`,
        aplicar: por30 ? { etiqueta: `Probar con ${formatearMonto(por30)} (margen 30%)`, margenPct: "30" } : undefined,
      });
    } else if (nivel === "muy-bajo" || nivel === "bajo") {
      sugerencias.push({
        id: "margen",
        tono: "aviso",
        texto: `Tu margen es ${formatearPorcentaje(margen)}: queda poco para imprevistos.`,
        aplicar: por30 ? { etiqueta: `Subir a ${formatearMonto(por30)} (margen 30%)`, margenPct: "30" } : undefined,
      });
    }
    if (analisis.estado === "bajo" && analisis.puntoEquilibrioUnidades && volumen) {
      const falta = new Decimal(analisis.puntoEquilibrioUnidades).minus(volumen);
      sugerencias.push({
        id: "equilibrio",
        tono: "aviso",
        texto: `Con tu volumen actual no llegás al equilibrio: necesitás ${formatearCantidad(analisis.puntoEquilibrioUnidades)} por mes (te faltan ${formatearCantidad(falta.toString())}).`,
      });
    }
    if (analisis.estado === "supera" && analisis.puntoEquilibrioUnidades && volumen) {
      const sobra = volumen.minus(analisis.puntoEquilibrioUnidades);
      sugerencias.push({
        id: "supera",
        tono: "ok",
        texto: `Superás el punto de equilibrio por ${formatearCantidad(sobra.toString())} por mes. Cada venta extra es ganancia.`,
      });
    }
    if (nivel === "bueno" || nivel === "alto") {
      sugerencias.push({ id: "margen-ok", tono: "ok", texto: `Margen de ${formatearPorcentaje(margen)}: es un buen colchón para imprevistos.` });
    }
  }

  return (
    <>
      {abierto ? (
        <section
          id={idPanel}
          aria-label="Sugerencias"
          className="anim-sheet fixed inset-x-3 bottom-20 z-40 mx-auto max-h-[60vh] max-w-2xl overflow-y-auto rounded-2xl border border-gray-300 bg-white p-4 shadow-2xl print:hidden"
        >
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-sm font-bold uppercase tracking-widest text-primary-900">Sugerencias para vos</h2>
            <button
              type="button"
              onClick={() => setAbierto(false)}
              aria-label="Cerrar sugerencias"
              className="inline-flex size-11 items-center justify-center rounded-full text-gray-700 hover:bg-gray-100 focus-visible:outline-2 focus-visible:outline-primary-700"
            >
              ✕
            </button>
          </div>
          <ul className="mt-2 flex flex-col gap-2">
            {sugerencias.map((s) => (
              <li key={s.id} className={`rounded-xl border-l-4 p-3 text-sm leading-snug ${TONOS[s.tono]}`}>
                <p>{s.texto}</p>
                {s.aplicar ? (
                  <button
                    type="button"
                    onClick={() => actualizarPrecio({ modo: "margen", margenPct: s.aplicar!.margenPct })}
                    className="mt-2 inline-flex min-h-11 items-center rounded-full bg-primary-900 px-4 text-sm font-semibold text-white hover:bg-primary-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-700"
                  >
                    {s.aplicar.etiqueta}
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-gray-700">Las sugerencias salen de las reglas de tu cálculo; el precio lo decidís vos.</p>
        </section>
      ) : null}

      <div
        role="region"
        aria-label="Indicadores"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-gray-300 bg-white/95 shadow-[0_-4px_12px_rgba(16,27,59,0.08)] backdrop-blur print:hidden"
      >
        <div className="mx-auto flex max-w-6xl items-center gap-2 px-2">
          <dl className="flex min-w-0 flex-1 divide-x divide-gray-200 overflow-x-auto">
            <Indicador etiqueta="Costo / unidad" valor={costo ? formatearMonto(resumen.costoUnitario) : "—"} />
            <Indicador etiqueta="Precio" valor={precio ? formatearMonto(precio) : "—"} />
            <Indicador
              etiqueta="Ganancia / unidad"
              valor={gananciaUnidad ? formatearMonto(gananciaUnidad.toString()) : "—"}
              tono={gananciaUnidad ? (gananciaUnidad.isNegative() ? "mal" : "bien") : undefined}
            />
            <Indicador etiqueta="Margen" valor={analisis ? formatearPorcentaje(analisis.margenResultantePct) : "—"} />
            <Indicador etiqueta="Equilibrio" valor={analisis?.puntoEquilibrioUnidades ? `${formatearCantidad(analisis.puntoEquilibrioUnidades)} u.` : "—"} />
            <Indicador
              etiqueta="Ganancia / mes"
              valor={analisis ? formatearMonto(analisis.gananciaNetaMensual) : "—"}
              tono={gananciaMes === null ? undefined : gananciaMes < 0 ? "mal" : "bien"}
            />
          </dl>
          <button
            type="button"
            aria-expanded={abierto}
            aria-controls={abierto ? idPanel : undefined}
            onClick={() => setAbierto((v) => !v)}
            className="relative my-2 inline-flex min-h-11 shrink-0 items-center gap-2 rounded-full bg-primary-900 px-4 text-sm font-semibold text-white hover:bg-primary-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-700"
          >
            Sugerencias
            <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-accent-400 px-1.5 text-xs font-bold text-primary-900">
              {sugerencias.length}
            </span>
          </button>
        </div>
      </div>
    </>
  );
}
