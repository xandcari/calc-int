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
  useCalculoStore.setState({ calculo: conValoresPorDefecto(datos) });
}

/**
 * Red de seguridad: si al cálculo le falta algún campo que se agregó después de que se guardó (por ejemplo,
 * la ruta de producción o el sueldo mensual), se completa con el valor inicial. Sin esto, un solo campo
 * ausente o inválido rompe las pantallas, y como el borrador queda en el navegador, el error se repetiría
 * en cada recarga. Lo ya cargado por el usuario nunca se pisa: los iniciales solo rellenan lo que falta
 * (campo ausente o `undefined`).
 */
function conValoresPorDefecto(datos: Calculo): Calculo {
  const inicial = crearCalculoInicial();
  const completar = <T extends object>(porDefecto: T, recibido: T): T => {
    const lleno = Object.fromEntries(Object.entries(recibido).filter(([, valor]) => valor !== undefined));
    return { ...porDefecto, ...lleno };
  };
  return {
    ...datos,
    configuracion: completar(inicial.configuracion, datos.configuracion),
    trabajoPropio: completar(inicial.trabajoPropio, datos.trabajoPropio),
    precio: completar(inicial.precio, datos.precio),
  };
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
