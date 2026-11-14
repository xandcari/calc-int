"use client";

import { useId, useState } from "react";

interface PropsAyuda {
  /** Qué explica. Lenguaje simple. */
  texto: string;
  /** Ejemplo concreto, opcional. */
  ejemplo?: string;
  /** Nombre del dato que se explica (para el lector de pantalla). */
  sobre: string;
}

/**
 * Ícono «?» con explicación. Se abre con clic, foco o mouse y se cierra con Escape o al salir:
 * funciona con teclado y lector de pantalla.
 */
export function Ayuda({ texto, ejemplo, sobre }: PropsAyuda) {
  const [abierta, setAbierta] = useState(false);
  const id = useId();

  return (
    <span className="relative inline-flex" onMouseEnter={() => setAbierta(true)} onMouseLeave={() => setAbierta(false)}>
      <button
        type="button"
        aria-label={`Ayuda: ${sobre}`}
        aria-expanded={abierta}
        aria-describedby={abierta ? id : undefined}
        onClick={() => setAbierta((v) => !v)}
        onFocus={() => setAbierta(true)}
        onBlur={() => setAbierta(false)}
        onKeyDown={(e) => {
          if (e.key === "Escape") setAbierta(false);
        }}
        className="relative inline-flex size-6 items-center justify-center rounded-full bg-gray-200 text-xs font-bold text-gray-700 before:absolute before:-inset-2 before:content-[''] hover:bg-gray-300 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary-600"
      >
        ?
      </button>
      {abierta ? (
        <span
          id={id}
          role="tooltip"
          className="absolute left-1/2 top-full z-10 mt-2 w-64 -translate-x-1/2 rounded-xl bg-gray-900 p-3 text-left text-sm font-normal leading-snug text-white shadow-lg"
        >
          {texto}
          {ejemplo ? <span className="mt-2 block text-sm text-gray-200">Ej: {ejemplo}</span> : null}
        </span>
      ) : null}
    </span>
  );
}
