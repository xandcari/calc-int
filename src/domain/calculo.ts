import { horasMensualesDesdeLotes, volumenDesdeLotes } from "@/domain/motor/costos";
import { estaVacio } from "@/domain/motor/numeros";
import {
  CONFIGURACION_INICIAL,
  PRECIO_INICIAL,
  TRABAJO_PROPIO_INICIAL,
  type CategoriaCosto,
  type Calculo,
  type Configuracion,
  type PasoRecorrido,
  type Precio,
  type TrabajoPropio,
} from "@/domain/types";

/**
 * Transiciones del borrador del cálculo: funciones puras (sin React ni zustand).
 * El store solo las aplica; acá viven las reglas, para poder probarlas sin navegador.
 *
 * Los importes que llegan acá ya están normalizados (punto decimal, sin miles).
 */

const EPOCH = "1970-01-01T00:00:00.000Z";

/** Datos que se pueden cambiar de un concepto. Según la categoría se usa `monto` o `montoUnitario`. */
export interface CambiosConcepto {
  nombre?: string;
  monto?: string;
  montoUnitario?: string;
}

/**
 * Borrador vacío. Empieza con una fila en blanco de fijos y de variables (ids fijos, para que el
 * estado inicial sea igual en servidor y cliente). El id del cálculo también es fijo: el MVP maneja un solo borrador.
 */
export function crearCalculoInicial(): Calculo {
  return {
    id: "borrador",
    configuracion: { ...CONFIGURACION_INICIAL },
    costosFijos: [{ id: "fijo-inicial", categoria: "fijo", nombre: "", monto: "", frecuencia: "mensual" }],
    costosVariables: [{ id: "variable-inicial", categoria: "variable", nombre: "", montoUnitario: "" }],
    costosIndirectos: [],
    trabajoPropio: { ...TRABAJO_PROPIO_INICIAL },
    precio: { ...PRECIO_INICIAL },
    pasoActual: "configuracion",
    creadoEn: EPOCH,
    actualizadoEn: EPOCH,
  };
}

/** Marca la modificación (y la fecha de creación la primera vez que se toca el borrador). */
function tocar(calculo: Calculo, ahora: string): Calculo {
  return {
    ...calculo,
    creadoEn: calculo.creadoEn === EPOCH ? ahora : calculo.creadoEn,
    actualizadoEn: ahora,
  };
}

/** Recalcula lo derivado de los lotes: volumen mensual y horas mensuales. */
function sincronizarLotes(calculo: Calculo): Calculo {
  const { unidadesPorLote, lotes } = calculo.configuracion;
  return {
    ...calculo,
    configuracion: { ...calculo.configuracion, volumenMensual: volumenDesdeLotes(unidadesPorLote, lotes) },
    // En modo «sueldo» las horas al mes las carga el usuario (opcional): no se derivan de los lotes.
    trabajoPropio:
      calculo.trabajoPropio.modo === "sueldo"
        ? calculo.trabajoPropio
        : {
            ...calculo.trabajoPropio,
            horasMensuales: horasMensualesDesdeLotes(calculo.trabajoPropio.horasPorLote, lotes),
          },
  };
}

export function actualizarConfiguracion(
  calculo: Calculo,
  cambios: Partial<Omit<Configuracion, "volumenMensual">>,
  ahora: string,
): Calculo {
  return tocar(
    sincronizarLotes({ ...calculo, configuracion: { ...calculo.configuracion, ...cambios } }),
    ahora,
  );
}

export function actualizarTrabajoPropio(
  calculo: Calculo,
  cambios: Partial<Pick<TrabajoPropio, "horasPorLote" | "valorHora" | "modo" | "sueldoMensual" | "horasMensuales">>,
  ahora: string,
): Calculo {
  const trabajoPropio = { ...calculo.trabajoPropio, ...cambios };
  // Al pasar a «sueldo» las horas al mes arrancan vacías (son un dato aparte, opcional); al volver a «hora» se
  // recalculan desde los lotes. Los datos del otro modo no se borran: cambiar de modo se puede deshacer.
  if (cambios.modo === "sueldo" && calculo.trabajoPropio.modo !== "sueldo" && cambios.horasMensuales === undefined) {
    trabajoPropio.horasMensuales = "";
  }
  // Se incluye el tiempo apenas el usuario completa el dato que corresponde al modo elegido.
  trabajoPropio.incluir =
    trabajoPropio.modo === "sueldo"
      ? !estaVacio(trabajoPropio.sueldoMensual ?? "")
      : !estaVacio(trabajoPropio.horasPorLote) || !estaVacio(trabajoPropio.valorHora);
  return tocar(sincronizarLotes({ ...calculo, trabajoPropio }), ahora);
}

export function agregarConcepto(
  calculo: Calculo,
  categoria: CategoriaCosto,
  id: string,
  ahora: string,
  nombre = "",
): Calculo {
  switch (categoria) {
    case "fijo":
      return tocar(
        {
          ...calculo,
          costosFijos: [...calculo.costosFijos, { id, categoria, nombre, monto: "", frecuencia: "mensual" }],
        },
        ahora,
      );
    case "indirecto":
      return tocar(
        {
          ...calculo,
          costosIndirectos: [
            ...calculo.costosIndirectos,
            { id, categoria, nombre, monto: "", frecuencia: "mensual" },
          ],
        },
        ahora,
      );
    case "variable":
      return tocar(
        {
          ...calculo,
          costosVariables: [...calculo.costosVariables, { id, categoria, nombre, montoUnitario: "" }],
        },
        ahora,
      );
  }
}

export function actualizarConcepto(
  calculo: Calculo,
  categoria: CategoriaCosto,
  id: string,
  cambios: CambiosConcepto,
  ahora: string,
): Calculo {
  switch (categoria) {
    case "fijo":
      return tocar(
        {
          ...calculo,
          costosFijos: calculo.costosFijos.map((c) =>
            c.id === id ? { ...c, nombre: cambios.nombre ?? c.nombre, monto: cambios.monto ?? c.monto } : c,
          ),
        },
        ahora,
      );
    case "indirecto":
      return tocar(
        {
          ...calculo,
          costosIndirectos: calculo.costosIndirectos.map((c) =>
            c.id === id ? { ...c, nombre: cambios.nombre ?? c.nombre, monto: cambios.monto ?? c.monto } : c,
          ),
        },
        ahora,
      );
    case "variable":
      return tocar(
        {
          ...calculo,
          costosVariables: calculo.costosVariables.map((c) =>
            c.id === id
              ? {
                  ...c,
                  nombre: cambios.nombre ?? c.nombre,
                  montoUnitario: cambios.montoUnitario ?? c.montoUnitario,
                }
              : c,
          ),
        },
        ahora,
      );
  }
}

export function eliminarConcepto(calculo: Calculo, categoria: CategoriaCosto, id: string, ahora: string): Calculo {
  switch (categoria) {
    case "fijo":
      return tocar({ ...calculo, costosFijos: calculo.costosFijos.filter((c) => c.id !== id) }, ahora);
    case "indirecto":
      return tocar({ ...calculo, costosIndirectos: calculo.costosIndirectos.filter((c) => c.id !== id) }, ahora);
    case "variable":
      return tocar({ ...calculo, costosVariables: calculo.costosVariables.filter((c) => c.id !== id) }, ahora);
  }
}

export function actualizarPrecio(calculo: Calculo, cambios: Partial<Precio>, ahora: string): Calculo {
  return tocar({ ...calculo, precio: { ...calculo.precio, ...cambios } }, ahora);
}

export function cambiarPaso(calculo: Calculo, paso: PasoRecorrido, ahora: string): Calculo {
  return tocar({ ...calculo, pasoActual: paso }, ahora);
}
