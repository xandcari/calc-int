"use client";

import { useEffect, useId, useRef, useState } from "react";

import { Carrusel } from "./carrusel";
import { TOTAL_PASOS, type GuiaPaso } from "@/lib/opciones-amigables";

interface Props {
  guia: GuiaPaso;
  /** A: lista corta de palabras. B: las palabras como tarjetas de un carrusel. */
  variante: "a" | "b";
  /** Estilo B: vuelve a mostrar la bienvenida. */
  verBienvenida?: () => void;
}

/**
 * Botón flotante «¿Te ayudo?» que abre una ventana con lo esencial del paso en que está la persona:
 * qué hacer, un ejemplo y las palabras difíciles en simple. No tapa el contenido hasta que se pide.
 */
export function VentanaAyuda({ guia, variante, verBienvenida }: Props) {
  const [abierta, setAbierta] = useState(false);
  const idTitulo = useId();
  const titulo = useRef<HTMLHeadingElement>(null);
  const boton = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (abierta) titulo.current?.focus();
  }, [abierta]);

  function cerrar() {
    setAbierta(false);
    boton.current?.focus();
  }

  return (
    <>
      <button
        ref={boton}
        type="button"
        aria-expanded={abierta}
        aria-haspopup="dialog"
        onClick={() => setAbierta((v) => !v)}
        className="anim-flotante fab-ayuda fixed bottom-24 right-4 z-40 inline-flex min-h-12 items-center gap-2 rounded-full bg-primary-900 px-5 text-sm font-semibold text-white shadow-lg hover:bg-primary-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-700 print:hidden"
      >
        <span aria-hidden="true" className="flex size-6 items-center justify-center rounded-full bg-accent-400 text-base font-bold text-primary-900">
          ?
        </span>
        ¿Te ayudo?
      </button>

      {abierta ? (
        <>
          <div aria-hidden="true" onClick={cerrar} className="fixed inset-0 z-40 bg-primary-900/30 sm:hidden" />
          <div
            role="dialog"
            aria-labelledby={idTitulo}
            onKeyDown={(e) => {
              if (e.key === "Escape") cerrar();
            }}
            className="anim-sheet sheet-ayuda fixed inset-x-0 bottom-0 z-50 max-h-[85vh] overflow-y-auto rounded-t-3xl bg-white p-6 shadow-2xl sm:inset-x-auto sm:bottom-40 sm:right-4 sm:max-h-[calc(100dvh-11rem)] sm:w-96 sm:rounded-3xl print:hidden"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-primary-600">
                  Paso {guia.numero} de {TOTAL_PASOS}
                </p>
                <h2 id={idTitulo} ref={titulo} tabIndex={-1} className="mt-1 text-xl font-bold text-primary-900 focus:outline-none">
                  {guia.titulo}: ¿qué hago acá?
                </h2>
              </div>
              <button
                type="button"
                onClick={cerrar}
                aria-label="Cerrar ayuda"
                className="inline-flex size-11 shrink-0 items-center justify-center rounded-full text-lg text-gray-700 hover:bg-gray-100 focus-visible:outline-2 focus-visible:outline-primary-700"
              >
                ✕
              </button>
            </div>

            <p className="mt-3 text-base leading-relaxed text-gray-800">{guia.queHacer}</p>
            <p className="mt-3 rounded-2xl bg-primary-50 p-3 text-sm leading-relaxed text-primary-900">
              <strong>Por ejemplo: </strong>
              {guia.ejemplo}
            </p>

            <h3 className="mt-5 text-sm font-bold text-primary-900">Palabras en simple</h3>
            {variante === "b" ? (
              <div className="mt-2 rounded-2xl border border-gray-200 p-4">
                <Carrusel
                  etiqueta="Palabras en simple"
                  tarjetas={guia.palabras.map((p) => ({
                    id: p.palabra,
                    contenido: (
                      <div>
                        <p className="text-lg font-bold text-primary-700">{p.palabra}</p>
                        <p className="mt-1 text-base leading-relaxed text-gray-800">{p.significa}</p>
                      </div>
                    ),
                  }))}
                />
              </div>
            ) : (
              <dl className="mt-2 flex flex-col gap-3">
                {guia.palabras.map((p) => (
                  <div key={p.palabra} className="rounded-2xl border border-gray-200 p-3">
                    <dt className="font-bold text-primary-700">{p.palabra}</dt>
                    <dd className="mt-0.5 text-sm leading-relaxed text-gray-800">{p.significa}</dd>
                  </div>
                ))}
              </dl>
            )}

            <div className="mt-5 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={cerrar}
                className="inline-flex min-h-11 items-center rounded-full bg-primary-900 px-6 text-sm font-semibold text-white hover:bg-primary-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-700"
              >
                Entendido, sigo
              </button>
              {verBienvenida ? (
                <button
                  type="button"
                  onClick={() => {
                    cerrar();
                    verBienvenida();
                  }}
                  className="inline-flex min-h-11 items-center rounded-full px-4 text-sm font-semibold text-primary-700 underline underline-offset-4 hover:bg-primary-50 focus-visible:outline-2 focus-visible:outline-primary-700"
                >
                  Ver cómo funciona
                </button>
              ) : null}
            </div>
          </div>
        </>
      ) : null}
    </>
  );
}
