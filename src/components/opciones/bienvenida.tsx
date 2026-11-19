"use client";

import { useEffect, useRef } from "react";

import { BIENVENIDA } from "@/lib/opciones-amigables";

import { Carrusel } from "./carrusel";

/** Opción B: ventana de bienvenida con tres tarjetas. Usa el <dialog> nativo (foco, Escape y fondo ya resueltos). */
export function Bienvenida({ abierta, alCerrar }: { abierta: boolean; alCerrar: () => void }) {
  const dialogo = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const d = dialogo.current;
    if (!d) return;
    if (abierta && !d.open) d.showModal();
    if (!abierta && d.open) d.close();
  }, [abierta]);

  return (
    <dialog
      ref={dialogo}
      aria-label="Bienvenida"
      onClose={alCerrar}
      className="anim-sheet m-auto w-[min(92vw,28rem)] rounded-3xl border-0 bg-white p-0 shadow-2xl backdrop:bg-primary-900/50 print:hidden"
    >
      <div className="p-6">
        <div className="flex items-start justify-between gap-3">
          <p className="text-xs font-bold uppercase tracking-widest text-primary-600">Bienvenida</p>
          <button
            type="button"
            onClick={alCerrar}
            aria-label="Cerrar la bienvenida"
            className="-mr-2 -mt-2 inline-flex size-11 items-center justify-center rounded-full text-lg text-gray-700 hover:bg-gray-100 focus-visible:outline-2 focus-visible:outline-primary-700"
          >
            ✕
          </button>
        </div>
        <div className="mt-3">
          <Carrusel
            etiqueta="Cómo funciona"
            textoFinal="¡Empezar!"
            alTerminar={alCerrar}
            tarjetas={BIENVENIDA.map((t) => ({
              id: t.titulo,
              contenido: (
                <div className="text-center">
                  <p aria-hidden="true" className="text-5xl">{t.icono}</p>
                  <h2 className="mt-3 text-xl font-bold text-primary-900">{t.titulo}</h2>
                  <p className="mt-2 text-base leading-relaxed text-gray-800">{t.texto}</p>
                </div>
              ),
            }))}
          />
        </div>
      </div>
    </dialog>
  );
}
