import { crearCalculoInicial } from "@/domain/calculo";
import type { Calculo } from "@/domain/types";
import { useCalculoStore } from "@/store/calculo-store";

/**
 * Autocompletado: carga un cálculo (el que devuelve GET /api/calculos/:id) en el store del frontend.
 * Después de llamarla, todos los pasos (/calculadora/producto, costos, etc.) muestran esos datos y se pueden
 * editar hacia atrás. No modifica el store ni el tipo `Calculo`: usa el `setState` de zustand.
 *
 * Ojo: el store persiste en localStorage, así que esto REEMPLAZA el borrador que hubiera en este navegador.
 * Usá `hayBorradorLocal()` antes si querés avisarle al usuario.
 */
export function cargarCalculo(datos: Calculo): void {
  useCalculoStore.setState({ calculo: datos });
}

/**
 * Marca el borrador actual como guardado: le pone el UUID que devolvió el servidor.
 * Con ese id, el próximo «Guardar» sabe que tiene que hacer PUT (actualizar) y no POST (crear uno nuevo).
 * No cambia nada más del cálculo.
 */
export function marcarComoGuardado(id: string): void {
  useCalculoStore.setState((s) => ({ calculo: { ...s.calculo, id } }));
}

/** `true` si el borrador de este navegador ya fue tocado (es decir, difiere del cálculo vacío inicial). */
export function hayBorradorLocal(): boolean {
  return useCalculoStore.getState().calculo.creadoEn !== crearCalculoInicial().creadoEn;
}
