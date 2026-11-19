"use client";

import { useRef, useState, type KeyboardEvent, type PointerEvent, type ReactNode } from "react";

interface Props {
  /** Qué contiene el carrusel (lo lee el lector de pantalla). */
  etiqueta: string;
  tarjetas: { id: string; contenido: ReactNode }[];
  /** Texto del botón de la última tarjeta; si se pasa, ese botón llama a `alTerminar`. */
  textoFinal?: string;
  alTerminar?: () => void;
}

const BOTON =
  "inline-flex min-h-11 min-w-11 items-center justify-center whitespace-nowrap rounded-full px-3 text-sm font-semibold " +
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-700 disabled:opacity-40";

/**
 * Carrusel de tarjetas simple y accesible: se mueve con botones, con las flechas del teclado o deslizando.
 * No avanza solo (nadie se pierde lo que está leyendo) y sin animación si el sistema pide menos movimiento.
 */
export function Carrusel({ etiqueta, tarjetas, textoFinal, alTerminar }: Props) {
  const [actual, setActual] = useState(0);
  const inicioX = useRef<number | null>(null);
  const total = tarjetas.length;
  const ultima = actual === total - 1;
  const ir = (n: number) => setActual(Math.min(Math.max(n, 0), total - 1));

  function alTeclear(e: KeyboardEvent) {
    if (e.key === "ArrowRight") ir(actual + 1);
    if (e.key === "ArrowLeft") ir(actual - 1);
  }
  function alSoltar(e: PointerEvent) {
    if (inicioX.current === null) return;
    const dx = e.clientX - inicioX.current;
    inicioX.current = null;
    if (Math.abs(dx) > 40) ir(actual + (dx < 0 ? 1 : -1));
  }

  return (
    <section
      aria-roledescription="carrusel"
      aria-label={etiqueta}
      onKeyDown={alTeclear}
      onPointerDown={(e) => {
        inicioX.current = e.clientX;
      }}
      onPointerUp={alSoltar}
      className="touch-pan-y select-none"
    >
      <div
        key={actual}
        role="group"
        aria-roledescription="tarjeta"
        aria-label={`${actual + 1} de ${total}`}
        aria-live="polite"
        className="anim-tarjeta min-h-40"
      >
        {tarjetas[actual].contenido}
      </div>

      <div className="mt-4 flex items-center justify-between gap-2">
        <button type="button" className={`${BOTON} text-primary-700 hover:bg-primary-50`} onClick={() => ir(actual - 1)} disabled={actual === 0}>
          ← Antes
        </button>
        <div className="flex items-center" role="group" aria-label="Elegir tarjeta">
          {tarjetas.map((t, i) => (
            <button
              key={t.id}
              type="button"
              aria-label={`Ir a la tarjeta ${i + 1}`}
              aria-current={i === actual}
              onClick={() => ir(i)}
              className="relative inline-flex size-6 items-center justify-center focus-visible:outline-2 focus-visible:outline-primary-700"
            >
              <span className={`block rounded-full transition-all ${i === actual ? "h-2.5 w-6 bg-primary-700" : "size-2.5 bg-gray-300"}`} />
            </button>
          ))}
        </div>
        {ultima && textoFinal ? (
          <button type="button" className={`${BOTON} bg-primary-900 text-white hover:bg-primary-700`} onClick={alTerminar}>
            {textoFinal}
          </button>
        ) : (
          <button type="button" className={`${BOTON} text-primary-700 hover:bg-primary-50`} onClick={() => ir(actual + 1)} disabled={ultima}>
            Siguiente →
          </button>
        )}
      </div>
    </section>
  );
}
