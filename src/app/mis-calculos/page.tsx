import type { Metadata } from "next";

import { Cabecera, Pie } from "@/components/calculadora/cabecera";
import { ListaCalculos } from "@/components/mis-calculos/lista-calculos";

export const metadata: Metadata = {
  title: "Mis cálculos — Preciar",
  description: "Volvé a ver, editá, compartí o borrá los cálculos que guardaste",
};

/** Pantalla «Mis cálculos»: la lista de cálculos guardados de la persona con sesión iniciada. */
export default function PaginaMisCalculos() {
  return (
    <>
      <Cabecera />
      <main id="contenido" className="mx-auto w-full max-w-3xl flex-1 px-4 py-8 sm:px-6 lg:py-12">
        <ListaCalculos />
      </main>
      <Pie />
    </>
  );
}
