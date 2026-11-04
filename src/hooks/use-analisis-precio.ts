"use client";

import { useMemo } from "react";

import { calcularResumenCostos } from "@/domain/motor/costos";
import { analizarPrecio, datosGrafico, precioElegido } from "@/domain/motor/precio";
import type { Calculo } from "@/domain/types";
import { useCalculoStore } from "@/store/calculo-store";

/**
 * El análisis es una función pura del borrador, y el store devuelve un objeto nuevo en cada cambio.
 * El paso «Precio» lo pide desde varios componentes (formulario, gráfico, resumen en vivo): con esta
 * caché se calcula una sola vez por cambio en lugar de una por componente.
 */
const cache = new WeakMap<Calculo, ReturnType<typeof calcularAnalisisPrecio>>();

export function calcularAnalisisPrecio(calculo: Calculo) {
  const resumen = calcularResumenCostos(calculo);
  const precio = precioElegido(calculo);
  return {
    calculo,
    resumen,
    precio,
    analisis: precio ? analizarPrecio(calculo, precio) : null,
    grafico: precio ? datosGrafico(calculo, precio) : null,
  };
}

/** Costos, precio elegido y análisis del paso 4, recalculados cuando cambia el borrador. */
export function useAnalisisPrecio() {
  const calculo = useCalculoStore((s) => s.calculo);
  return useMemo(() => {
    const guardado = cache.get(calculo);
    if (guardado) return guardado;
    const nuevo = calcularAnalisisPrecio(calculo);
    cache.set(calculo, nuevo);
    return nuevo;
  }, [calculo]);
}
