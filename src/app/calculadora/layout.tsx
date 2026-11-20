import type { ReactNode } from "react";

import { Recorrido } from "@/components/calculadora/recorrido";
import { OpcionesAmigables } from "@/components/opciones/opciones-amigables";
import { BotonObservacion } from "@/components/prueba/boton-observacion";

export default function CalculadoraLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <Recorrido>{children}</Recorrido>
      {/* Capa opcional: no hace nada salvo que se elija un estilo (?estilo=a|b|c). */}
      <OpcionesAmigables />
      {/* Solo en la app de prueba (NEXT_PUBLIC_MODO_PRUEBA=1): botón para dejar observaciones de usabilidad. */}
      {process.env.NEXT_PUBLIC_MODO_PRUEBA === "1" ? <BotonObservacion /> : null}
    </>
  );
}
