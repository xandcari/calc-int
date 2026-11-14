"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";

import type { Calculo, PasoRecorrido } from "@/domain/types";
import { cargarCalculo, hayBorradorLocal } from "@/store/cargar-calculo";
import { useCalculoStore } from "@/store/calculo-store";

const RUTA_DE_PASO: Record<PasoRecorrido, string> = {
  configuracion: "/calculadora/producto",
  costos: "/calculadora/costos",
  resumen: "/calculadora/resumen",
  precio: "/calculadora/precio",
  simulador: "/calculadora/simulador",
};

/**
 * Vuelca el cálculo del link en el store y redirige al recorrido.
 *  - Dueño: vuelve al paso donde había quedado y puede ir hacia atrás y editar.
 *  - Otra persona: va directo al resumen. El servidor igual rechaza (403) cualquier intento de guardar.
 * (Que un visitante no pueda editar en pantalla es decisión del frontend; esto solo carga los datos.)
 */
export function CargadorCompartido({ calculo, esDueno }: { calculo: Calculo; esDueno: boolean }) {
  const router = useRouter();
  // En desarrollo React ejecuta los efectos dos veces: este candado evita preguntar dos veces.
  const yaCorrio = useRef(false);

  useEffect(() => {
    if (yaCorrio.current) return;
    yaCorrio.current = true;

    void (async () => {
      // El store no lee localStorage solo (skipHydration): se lee ahora para saber qué borrador hay.
      await useCalculoStore.persist.rehydrate();

      const esElMismoCalculo = useCalculoStore.getState().calculo.id === calculo.id;
      if (!esElMismoCalculo && hayBorradorLocal()) {
        const continuar = window.confirm(
          "Tenés un cálculo sin guardar en este navegador. Si abrís este link, se va a reemplazar. ¿Continuar?",
        );
        if (!continuar) {
          router.replace("/calculadora/producto");
          return;
        }
      }

      cargarCalculo(calculo);
      router.replace(esDueno ? RUTA_DE_PASO[calculo.pasoActual] : RUTA_DE_PASO.resumen);
    })();
  }, [calculo, esDueno, router]);

  return <p className="p-8 text-center text-gray-600">Cargando tu cálculo…</p>;
}
