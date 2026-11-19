"use client";

import { useEffect } from "react";

import { ESTILOS, guardarEstilo, useEstilo, useModoOpciones, type ValorEstilo } from "@/lib/opciones-amigables";

const OPCIONES: { id: ValorEstilo; corto: string; nombre: string }[] = [
  { id: "original", corto: "Original", nombre: "Versión original" },
  ...ESTILOS.map((e) => ({ id: e.id, corto: e.id.toUpperCase(), nombre: `${e.nombre}: ${e.para}` })),
];

/**
 * Barra fina arriba para comparar las versiones. Solo aparece con `?opciones` o si ya hay un estilo elegido;
 * no es parte del recorrido. Deja un margen arriba de la página para no tapar nada.
 */
export function SelectorEstilo() {
  const estilo = useEstilo();
  const modoOpciones = useModoOpciones();
  const visible = modoOpciones || estilo !== "ninguno";

  useEffect(() => {
    if (!visible) return;
    const raiz = document.documentElement;
    raiz.dataset.selector = "1";
    return () => {
      delete raiz.dataset.selector;
    };
  }, [visible]);

  if (!visible) return null;

  const activo = estilo === "ninguno" ? "original" : estilo;
  return (
    <div
      role="group"
      aria-label="Comparar versiones de la calculadora"
      className="fixed inset-x-0 top-0 z-50 flex h-8 items-center justify-center gap-1 border-b border-gray-300 bg-gray-100 text-xs print:hidden"
    >
      <span className="mr-1 font-semibold text-gray-700">Versión:</span>
      {OPCIONES.map((o) => (
        <button
          key={o.id}
          type="button"
          title={o.nombre}
          aria-label={o.nombre}
          aria-pressed={activo === o.id}
          onClick={() => guardarEstilo(o.id)}
          className={`min-h-7 min-w-8 rounded-full px-2.5 font-semibold focus-visible:outline-2 focus-visible:outline-primary-700 ${
            activo === o.id ? "bg-primary-900 text-white" : "text-primary-700 hover:bg-white"
          }`}
        >
          {o.corto}
        </button>
      ))}
    </div>
  );
}
