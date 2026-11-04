import type { ReactNode } from "react";

interface PropsComoSeCalcula {
  /** La fórmula en palabras. Ej.: «Precio − costo variable por unidad». */
  formula: ReactNode;
  /** La misma fórmula con los números del usuario. Ej.: «$2.092 − $1.000 = $1.092». */
  cuenta: ReactNode;
  /** «oscuro» para tarjetas con fondo marino (por ejemplo, el punto de equilibrio). */
  tono?: "claro" | "oscuro";
  /** Texto del desplegable. */
  etiqueta?: string;
}

/**
 * Desplegable «Ver cómo se calcula» (diseño de Figma). Solo MUESTRA la cuenta con valores que ya
 * calculó el motor: no hace ningún cálculo propio.
 */
export function ComoSeCalcula({ formula, cuenta, tono = "claro", etiqueta = "Ver cómo se calcula" }: PropsComoSeCalcula) {
  const oscuro = tono === "oscuro";
  return (
    <details className="group mt-3">
      <summary
        className={`inline-flex min-h-6 cursor-pointer list-none items-center gap-1.5 rounded text-sm font-medium underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 [&::-webkit-details-marker]:hidden ${
          oscuro ? "text-accent-400 focus-visible:outline-white" : "text-primary-700 focus-visible:outline-primary-700"
        }`}
      >
        <span aria-hidden="true" className="inline-block text-xs transition-transform group-open:rotate-180">
          ▼
        </span>
        {etiqueta}
      </summary>
      <div
        className={`mt-2 rounded-xl px-4 py-3 text-sm ${
          oscuro ? "bg-white/10 text-white" : "bg-white/70 text-gray-900 ring-1 ring-primary-100"
        }`}
      >
        <p className={oscuro ? "text-white/80" : "text-gray-700"}>{formula}</p>
        <p className="mt-1 font-semibold">{cuenta}</p>
      </div>
    </details>
  );
}
