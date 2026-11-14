"use client";

import { useEffect } from "react";

import { Boton, BotonLink } from "@/components/ui/boton";

/**
 * Si algo falla dentro del recorrido, la pantalla no queda en blanco: explica qué pasó y deja volver a
 * intentar. Lo que la persona ya cargó está guardado en este dispositivo (se lee de nuevo al reintentar).
 */
export default function ErrorCalculadora({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div role="alert" className="mx-auto flex max-w-xl flex-col gap-4 rounded-2xl border border-danger-100 bg-danger-50 p-6">
      <h1 className="text-xl font-bold text-danger-700">Algo salió mal en esta pantalla</h1>
      <p className="text-sm text-gray-800">
        No pudimos mostrar este paso. No te preocupes: los datos que ya cargaste siguen guardados en este dispositivo.
      </p>
      <div className="flex flex-wrap gap-3">
        <Boton onClick={reset}>Volver a intentar</Boton>
        <BotonLink href="/calculadora" variante="secundario">
          Ir al inicio del recorrido
        </BotonLink>
      </div>
    </div>
  );
}
