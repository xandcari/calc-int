"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

interface Paso {
  etiqueta: string;
  /** Ruta del paso. Sin ruta = todavía no está construido (se muestra deshabilitado). */
  href?: string;
}

const PASOS: Paso[] = [
  { etiqueta: "Tu producto", href: "/calculadora/producto" },
  { etiqueta: "Costos", href: "/calculadora/costos" },
  { etiqueta: "Resumen", href: "/calculadora/resumen" },
  { etiqueta: "Precio", href: "/calculadora/precio" },
  { etiqueta: "Simulador", href: "/calculadora/simulador" },
];

/** Barra de progreso de 5 pasos. Los pasos ya recorridos son enlaces; los que faltan construir, no. */
export function Pasos() {
  const pathname = usePathname();
  const actual = PASOS.findIndex((p) => p.href === pathname);

  return (
    <nav aria-label="Pasos del cálculo">
      <ol className="flex flex-wrap items-center gap-1 sm:gap-2">
        {PASOS.map((paso, i) => {
          const esActual = i === actual;
          const completado = actual > i;
          const contenido = (
            <>
              <span
                aria-hidden="true"
                className={`flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                  esActual
                    ? "bg-accent-400 text-primary-900"
                    : completado
                      ? "bg-primary-900 text-white"
                      : "bg-gray-200 text-gray-700"
                }`}
              >
                {completado ? "✓" : i + 1}
              </span>
              <span
                className={`text-sm font-semibold ${esActual ? "" : "hidden sm:inline"} ${
                  esActual || completado ? "text-primary-900" : "text-gray-500"
                }`}
              >
                {paso.etiqueta}
                {completado ? <span className="sr-only"> (completado)</span> : null}
              </span>
            </>
          );
          const clases = "flex items-center gap-2 rounded-lg px-2 py-1.5";

          return (
            <li key={paso.etiqueta} className="flex items-center gap-1 sm:gap-2">
              {paso.href && (completado || esActual) ? (
                <Link
                  href={paso.href}
                  aria-current={esActual ? "step" : undefined}
                  className={`${clases} focus-visible:outline-2 focus-visible:outline-primary-600`}
                >
                  {contenido}
                </Link>
              ) : (
                <span className={`${clases} opacity-80`} aria-disabled="true">
                  {contenido}
                  <span className="sr-only"> (próximamente)</span>
                </span>
              )}
              {i < PASOS.length - 1 ? (
                <span aria-hidden="true" className="hidden h-px w-4 bg-gray-400 sm:block" />
              ) : null}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
