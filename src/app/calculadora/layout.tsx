import type { ReactNode } from "react";

import { Recorrido } from "@/components/calculadora/recorrido";
import { OpcionesAmigables } from "@/components/opciones/opciones-amigables";

export default function CalculadoraLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <Recorrido>{children}</Recorrido>
      {/* Capa opcional: no hace nada salvo que se elija un estilo (?estilo=a|b|c). */}
      <OpcionesAmigables />
    </>
  );
}
