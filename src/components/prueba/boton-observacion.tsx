"use client";

import { usePathname } from "next/navigation";

import { useEstilo } from "@/lib/opciones-amigables";

/** Repositorio donde se anotan las observaciones (Issues). Se puede cambiar con NEXT_PUBLIC_REPO_OBSERVACIONES. */
const REPO = process.env.NEXT_PUBLIC_REPO_OBSERVACIONES ?? "xandcari/calc-int";

const NOMBRE_VERSION: Record<string, string> = {
  a: "A · Paso a paso",
  b: "B · Emprendedor",
  c: "C · Con datos",
  original: "Original",
  ninguno: "Original",
};

/**
 * Solo en la app de prueba (NEXT_PUBLIC_MODO_PRUEBA=1). Abre un Issue del repositorio con la pantalla y la versión
 * que se estaban mirando, para que cada persona cuente qué le costó entender o qué cambiaría.
 */
export function BotonObservacion() {
  const ruta = usePathname();
  const estilo = useEstilo();
  const version = NOMBRE_VERSION[estilo] ?? "Original";

  const cuerpo = [
    `**Pantalla:** ${ruta}`,
    `**Versión:** ${version}`,
    "**Dispositivo:** (celular / tablet / compu)",
    "",
    "### ¿Qué estabas tratando de hacer?",
    "",
    "### ¿Qué te costó entender o no funcionó?",
    "",
    "### ¿Qué cambiarías?",
    "",
  ].join("\n");

  const params = new URLSearchParams({
    title: `Observación de usabilidad · ${version} · ${ruta}`,
    body: cuerpo,
    labels: "usabilidad",
  });

  return (
    <a
      href={`https://github.com/${REPO}/issues/new?${params.toString()}`}
      target="_blank"
      rel="noopener noreferrer"
      className="fixed bottom-4 left-4 z-40 inline-flex min-h-11 items-center rounded-full bg-primary-900 px-4 text-sm font-semibold text-white shadow-lg hover:bg-primary-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-700 print:hidden"
    >
      Dejar observación
      <span className="sr-only"> (se abre en una pestaña nueva)</span>
    </a>
  );
}
