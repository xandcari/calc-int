import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import {
  actualizarConcepto as aplicarActualizarConcepto,
  actualizarConfiguracion as aplicarActualizarConfiguracion,
  actualizarEscenario as aplicarActualizarEscenario,
  actualizarPrecio as aplicarActualizarPrecio,
  actualizarTrabajoPropio as aplicarActualizarTrabajoPropio,
  agregarConcepto as aplicarAgregarConcepto,
  agregarEscenario as aplicarAgregarEscenario,
  cambiarPaso as aplicarCambiarPaso,
  cambiarRuta as aplicarCambiarRuta,
  crearCalculoInicial,
  duplicarEscenario as aplicarDuplicarEscenario,
  eliminarConcepto as aplicarEliminarConcepto,
  eliminarEscenario as aplicarEliminarEscenario,
  type CambiosConcepto,
  type CambiosEscenario,
} from "@/domain/calculo";
import {
  ESCENARIOS_INICIALES,
  PRECIO_INICIAL,
  type CategoriaCosto,
  type Calculo,
  type Configuracion,
  type PasoRecorrido,
  type Precio,
  type RutaProduccion,
  type TrabajoPropio,
} from "@/domain/types";

/**
 * Estado del recorrido. Las reglas viven en `domain/calculo.ts`; el store solo las aplica y persiste
 * el borrador en el navegador (localStorage), así no se pierde al navegar entre pasos ni al recargar.
 *
 * `skipHydration`: el estado inicial es idéntico en servidor y cliente; la lectura de localStorage la dispara
 * `Hidratador` ya en el navegador (ver components/calculadora/hidratador.tsx), para no romper la hidratación de React.
 */

interface EstadoCalculo {
  calculo: Calculo;
  actualizarConfiguracion: (cambios: Partial<Omit<Configuracion, "volumenMensual">>) => void;
  cambiarRuta: (ruta: RutaProduccion) => void;
  actualizarTrabajoPropio: (cambios: Partial<Pick<TrabajoPropio, "horasPorLote" | "valorHora" | "sueldoMensual" | "modoSueldo" | "horasAlMes">>) => void;
  actualizarPrecio: (cambios: Partial<Precio>) => void;
  agregarConcepto: (categoria: CategoriaCosto, nombre?: string) => void;
  actualizarConcepto: (categoria: CategoriaCosto, id: string, cambios: CambiosConcepto) => void;
  eliminarConcepto: (categoria: CategoriaCosto, id: string) => void;
  agregarEscenario: () => void;
  duplicarEscenario: (id: string) => void;
  actualizarEscenario: (id: string, cambios: CambiosEscenario) => void;
  eliminarEscenario: (id: string) => void;
  cambiarPaso: (paso: PasoRecorrido) => void;
  reiniciar: () => void;
}

const ahora = () => new Date().toISOString();

export const useCalculoStore = create<EstadoCalculo>()(
  persist(
    (set) => ({
      calculo: crearCalculoInicial(),
      actualizarConfiguracion: (cambios) =>
        set((s) => ({ calculo: aplicarActualizarConfiguracion(s.calculo, cambios, ahora()) })),
      cambiarRuta: (ruta) => set((s) => ({ calculo: aplicarCambiarRuta(s.calculo, ruta, ahora()) })),
      actualizarTrabajoPropio: (cambios) =>
        set((s) => ({ calculo: aplicarActualizarTrabajoPropio(s.calculo, cambios, ahora()) })),
      actualizarPrecio: (cambios) =>
        set((s) => ({ calculo: aplicarActualizarPrecio(s.calculo, cambios, ahora()) })),
      agregarConcepto: (categoria, nombre) =>
        set((s) => ({
          calculo: aplicarAgregarConcepto(s.calculo, categoria, crypto.randomUUID(), ahora(), nombre),
        })),
      actualizarConcepto: (categoria, id, cambios) =>
        set((s) => ({ calculo: aplicarActualizarConcepto(s.calculo, categoria, id, cambios, ahora()) })),
      eliminarConcepto: (categoria, id) =>
        set((s) => ({ calculo: aplicarEliminarConcepto(s.calculo, categoria, id, ahora()) })),
      agregarEscenario: () =>
        set((s) => ({ calculo: aplicarAgregarEscenario(s.calculo, crypto.randomUUID(), ahora()) })),
      duplicarEscenario: (id) =>
        set((s) => ({ calculo: aplicarDuplicarEscenario(s.calculo, id, crypto.randomUUID(), ahora()) })),
      actualizarEscenario: (id, cambios) =>
        set((s) => ({ calculo: aplicarActualizarEscenario(s.calculo, id, cambios, ahora()) })),
      eliminarEscenario: (id) =>
        set((s) => ({ calculo: aplicarEliminarEscenario(s.calculo, id, ahora()) })),
      cambiarPaso: (paso) => set((s) => ({ calculo: aplicarCambiarPaso(s.calculo, paso, ahora()) })),
      reiniciar: () => set({ calculo: crearCalculoInicial() }),
    }),
    {
      name: "calc-int:calculo",
      version: 6,
      // v1 no tenía el paso «precio», v2 no tenía los escenarios, v3 no tenía la ruta de producción y
      // v4 no tenía el sueldo mensual de «reventa» y v5 no tenía su modo (fijo u horas al mes): se completan con los valores iniciales.
      migrate: (persistido) => {
        const estado = persistido as { calculo?: Calculo } | undefined;
        if (estado?.calculo && !estado.calculo.precio) estado.calculo.precio = { ...PRECIO_INICIAL };
        if (estado?.calculo && !estado.calculo.escenarios) {
          estado.calculo.escenarios = ESCENARIOS_INICIALES.map((e) => ({ ...e }));
        }
        if (estado?.calculo && !estado.calculo.configuracion.ruta) estado.calculo.configuracion.ruta = "lotes";
        if (estado?.calculo && estado.calculo.trabajoPropio.sueldoMensual === undefined) {
          estado.calculo.trabajoPropio.sueldoMensual = "";
        }
        if (estado?.calculo && estado.calculo.trabajoPropio.modoSueldo === undefined) {
          estado.calculo.trabajoPropio.modoSueldo = "fijo";
          estado.calculo.trabajoPropio.horasAlMes = "";
        }
        return estado as unknown as EstadoCalculo;
      },
      skipHydration: true,
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({ calculo: s.calculo }),
    },
  ),
);