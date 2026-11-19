"use client";

import { useEffect, useRef, useState } from "react";

import { TOTAL_PASOS, type GuiaPaso } from "@/lib/opciones-amigables";

/**
 * Opción A (para quien no se lleva bien con la tecnología): una guía que habla en una burbuja fija abajo.
 * Dice una sola cosa por vez y explica las palabras difíciles solo si la persona las toca.
 * Se pide con `key={ruta}` para que arranque de cero en cada paso.
 */
export function GuiaConversacional({ guia }: { guia: GuiaPaso }) {
  const [abierta, setAbierta] = useState(true);
  const [palabra, setPalabra] = useState<string | null>(null);
  // En pantallas chicas la guía arranca resumida (una frase) y se abre con «Ver más».
  const [detalle, setDetalle] = useState(false);
  const caja = useRef<HTMLElement>(null);
  const significado = guia.palabras.find((p) => p.palabra === palabra);

  // Avisa al CSS cuánto mide la guía para que la barra «Atrás / Siguiente» y el final de la página queden por encima.
  useEffect(() => {
    const raiz = document.documentElement;
    const el = caja.current;
    if (!abierta || !el) {
      raiz.style.removeProperty("--guia-alto");
      return;
    }
    const medir = () => raiz.style.setProperty("--guia-alto", `${el.offsetHeight + 12}px`);
    medir();
    const observador = new ResizeObserver(medir);
    observador.observe(el);
    return () => {
      observador.disconnect();
      raiz.style.removeProperty("--guia-alto");
    };
  }, [abierta]);

  if (!abierta) {
    return (
      <button
        type="button"
        onClick={() => setAbierta(true)}
        className="anim-flotante fixed bottom-24 right-4 z-40 inline-flex min-h-14 items-center gap-3 rounded-full bg-primary-900 px-6 text-base font-bold text-white shadow-lg hover:bg-primary-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-700 print:hidden"
      >
        <span aria-hidden="true" className="text-xl">💬</span>
        Necesito ayuda
      </button>
    );
  }

  return (
    <aside
      ref={caja}
      aria-label="Guía del paso"
      className="anim-sheet fixed inset-x-3 bottom-3 z-40 mx-auto flex max-w-2xl gap-3 rounded-3xl border-2 border-primary-700 bg-white p-3 shadow-2xl sm:p-4 print:hidden"
    >
      <div aria-hidden="true" className="flex size-14 shrink-0 items-center justify-center rounded-full bg-primary-900 text-3xl">
        🙂
      </div>
      <div className="min-w-0 flex-1" aria-live="polite">
        <p className="text-sm font-bold uppercase tracking-wider text-primary-600">
          Paso {guia.numero} de {TOTAL_PASOS} · {guia.titulo}
        </p>
        <p className="anim-escribe mt-1 text-lg font-semibold leading-snug text-primary-900" style={{ animationDelay: "0ms" }}>
          {guia.animo}
        </p>
        <p className={`anim-escribe mt-1 text-lg leading-snug text-gray-900 ${detalle ? "" : "max-sm:hidden"}`} style={{ animationDelay: "500ms" }}>
          {guia.queHacer}
        </p>

        {guia.palabras.length > 0 ? (
          <div className={`anim-escribe mt-2 ${detalle ? "" : "max-sm:hidden"}`} style={{ animationDelay: "1000ms" }}>
            <p className="text-base text-gray-800">¿Una palabra rara? Tocala:</p>
            <ul className="mt-2 flex flex-wrap gap-2">
              {guia.palabras.map((p) => (
                <li key={p.palabra}>
                  <button
                    type="button"
                    aria-pressed={palabra === p.palabra}
                    onClick={() => setPalabra(palabra === p.palabra ? null : p.palabra)}
                    className={`inline-flex min-h-12 items-center rounded-full border-2 px-5 text-base font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-700 ${
                      palabra === p.palabra
                        ? "border-primary-900 bg-primary-900 text-white"
                        : "border-primary-700 bg-white text-primary-700 hover:bg-primary-50"
                    }`}
                  >
                    {p.palabra}
                  </button>
                </li>
              ))}
            </ul>
            {significado ? (
              <p role="status" className="anim-tarjeta mt-3 rounded-2xl bg-primary-50 p-3 text-lg leading-snug text-primary-900">
                <strong>{significado.palabra}:</strong> {significado.significa}
              </p>
            ) : null}
          </div>
        ) : null}

        <button
          type="button"
          aria-expanded={detalle}
          onClick={() => setDetalle((v) => !v)}
          className="mt-2 inline-flex min-h-11 items-center rounded-full px-3 text-base font-semibold text-primary-700 underline underline-offset-4 hover:bg-primary-50 focus-visible:outline-2 focus-visible:outline-primary-700 sm:hidden"
        >
          {detalle ? "Ver menos" : "Ver más"}
        </button>
      </div>
      <button
        type="button"
        onClick={() => setAbierta(false)}
        aria-label="Minimizar la guía"
        className="inline-flex size-12 shrink-0 items-center justify-center self-start rounded-full text-xl text-gray-700 hover:bg-gray-100 focus-visible:outline-2 focus-visible:outline-primary-700"
      >
        ✕
      </button>
    </aside>
  );
}
