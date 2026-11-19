import { horasMensualesDesdeLotes, volumenDesdeLotes } from "@/domain/motor/costos";
import { estaVacio } from "@/domain/motor/numeros";
import {
  CONFIGURACION_INICIAL,
  ESCENARIOS_INICIALES,
  MAX_ESCENARIOS,
  PRECIO_INICIAL,
  TRABAJO_PROPIO_INICIAL,
  type BaseInsumo,
  type CategoriaCosto,
  type Calculo,
  type Configuracion,
  type EscenarioUsuario,
  type PasoRecorrido,
  type Precio,
  type RutaProduccion,
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
  /** Solo para los variables: si el monto es por unidad o por lote. */
  base?: BaseInsumo;
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
    escenarios: ESCENARIOS_INICIALES.map((e) => ({ ...e })),
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

/**
 * El tiempo propio entra al costo apenas el usuario completa algún dato de su ruta:
 * el sueldo mensual en «reventa»; las horas o el valor por hora en las otras dos.
 */
function trabajoIncluido(ruta: RutaProduccion, t: TrabajoPropio): boolean {
  if (ruta !== "reventa") return !estaVacio(t.horasPorLote) || !estaVacio(t.valorHora);
  return t.modoSueldo === "horas" ? !estaVacio(t.horasAlMes) || !estaVacio(t.valorHora) : !estaVacio(t.sueldoMensual);
}

/** Recalcula lo derivado de los lotes: volumen mensual y horas mensuales. */
function sincronizarLotes(calculo: Calculo): Calculo {
  const { unidadesPorLote, lotes } = calculo.configuracion;
  return {
    ...calculo,
    configuracion: { ...calculo.configuracion, volumenMensual: volumenDesdeLotes(unidadesPorLote, lotes) },
    trabajoPropio: {
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

/**
 * Qué datos ya cargados se borrarían al pasar a otra ruta (los mismos que vacía `cambiarRuta`), en palabras del usuario.
 * Lista vacía = no se pierde nada y se puede cambiar sin avisar. Los costos y el valor por hora no se tocan.
 */
export function datosQueSePierdenAlCambiarRuta(calculo: Calculo, ruta: RutaProduccion): string[] {
  const actual = calculo.configuracion.ruta;
  if (actual === ruta) return [];

  const { unidadesPorLote, lotes } = calculo.configuracion;
  const perdidos: string[] = [];

  const directaAntes = actual !== "lotes";
  const directaAhora = ruta !== "lotes";
  if (directaAntes !== directaAhora) {
    if (actual === "lotes") {
      // «1» lote es el valor con el que arranca el formulario: no cuenta como dato cargado.
      if (!estaVacio(unidadesPorLote)) perdidos.push("las unidades por lote");
      if (!estaVacio(lotes) && lotes.trim() !== "1") perdidos.push("los lotes por mes");
    } else if (!estaVacio(lotes)) {
      perdidos.push("las unidades por mes");
    }
  }
  // Un monto cargado «por lote» no significa nada fuera de la ruta «lotes»: se vacía, no se reinterpreta como «por unidad».
  if (actual === "lotes" && calculo.costosVariables.some((c) => c.base === "lote" && !estaVacio(c.montoUnitario))) {
    perdidos.push("los insumos cargados por lote");
  }
  if (!estaVacio(calculo.trabajoPropio.horasPorLote) || !estaVacio(calculo.trabajoPropio.horasAlMes)) {
    perdidos.push("las horas de trabajo");
  }
  return perdidos;
}

/**
 * Cambia la ruta de producción del paso 1.
 * - De «lotes» a otra ruta (o al revés) se vacía el volumen: significa otra cosa y no hay que arrastrarlo.
 * - Entre «unidad» y «reventa» se conserva el volumen, porque las dos lo cargan por mes directamente.
 * - Las horas siempre se vacían (por lote, por unidad…) y el valor por hora y el sueldo mensual se conservan.
 * - Al salir de «lotes», los insumos cargados por lote se vacían y vuelven a «por unidad»: sin lotes ese monto no
 *   se puede dividir y tampoco debe pasar a contarse como si fuera por unidad.
 * Las rutas que no usan lotes quedan con 1 unidad por lote y el volumen total en «lotes» (regla del 1 de Data).
 */
export function cambiarRuta(calculo: Calculo, ruta: RutaProduccion, ahora: string): Calculo {
  const actual = calculo.configuracion.ruta;
  if (actual === ruta) return calculo;

  const directaAntes = actual !== "lotes";
  const directaAhora = ruta !== "lotes";
  const conservar = directaAntes && directaAhora;

  const configuracion: Configuracion = {
    ...calculo.configuracion,
    ruta,
    unidadesPorLote: directaAhora ? "1" : "",
    lotes: directaAhora ? (conservar ? calculo.configuracion.lotes : "") : "1",
  };
  const trabajoPropio: TrabajoPropio = { ...calculo.trabajoPropio, horasPorLote: "", horasAlMes: "" };
  trabajoPropio.incluir = trabajoIncluido(ruta, trabajoPropio);

  const costosVariables = calculo.costosVariables.map((c) =>
    actual === "lotes" && c.base === "lote" ? { ...c, base: "unidad" as const, montoUnitario: "" } : c,
  );

  return tocar(sincronizarLotes({ ...calculo, configuracion, trabajoPropio, costosVariables }), ahora);
}

export function actualizarTrabajoPropio(
  calculo: Calculo,
  cambios: Partial<Pick<TrabajoPropio, "horasPorLote" | "valorHora" | "sueldoMensual" | "modoSueldo" | "horasAlMes">>,
  ahora: string,
): Calculo {
  const trabajoPropio = { ...calculo.trabajoPropio, ...cambios };
  trabajoPropio.incluir = trabajoIncluido(calculo.configuracion.ruta, trabajoPropio);
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
                  ...(cambios.base ? { base: cambios.base } : {}),
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

/** Datos que se pueden cambiar de un escenario. */
export interface CambiosEscenario {
  nombre?: string;
  insumosPct?: string;
  precioPct?: string;
  produccionPct?: string;
}

/** Agrega un escenario sin cambios. No hace nada si ya se alcanzó el máximo. */
export function agregarEscenario(calculo: Calculo, id: string, ahora: string): Calculo {
  if (calculo.escenarios.length >= MAX_ESCENARIOS) return calculo;
  const nuevo: EscenarioUsuario = {
    id,
    nombre: `Escenario ${calculo.escenarios.length + 1}`,
    insumosPct: "0",
    precioPct: "0",
    produccionPct: "0",
  };
  return tocar({ ...calculo, escenarios: [...calculo.escenarios, nuevo] }, ahora);
}

/** Copia un escenario y deja la copia justo a continuación. No hace nada si no existe o si se alcanzó el máximo. */
export function duplicarEscenario(calculo: Calculo, idOrigen: string, idNuevo: string, ahora: string): Calculo {
  if (calculo.escenarios.length >= MAX_ESCENARIOS) return calculo;
  const posicion = calculo.escenarios.findIndex((e) => e.id === idOrigen);
  if (posicion === -1) return calculo;
  const origen = calculo.escenarios[posicion];
  const copia: EscenarioUsuario = { ...origen, id: idNuevo, nombre: `${origen.nombre} (copia)` };
  const escenarios = [...calculo.escenarios.slice(0, posicion + 1), copia, ...calculo.escenarios.slice(posicion + 1)];
  return tocar({ ...calculo, escenarios }, ahora);
}

export function actualizarEscenario(calculo: Calculo, id: string, cambios: CambiosEscenario, ahora: string): Calculo {
  return tocar(
    {
      ...calculo,
      escenarios: calculo.escenarios.map((e) =>
        e.id === id
          ? {
              ...e,
              nombre: cambios.nombre ?? e.nombre,
              insumosPct: cambios.insumosPct ?? e.insumosPct,
              precioPct: cambios.precioPct ?? e.precioPct,
              produccionPct: cambios.produccionPct ?? e.produccionPct,
            }
          : e,
      ),
    },
    ahora,
  );
}

export function eliminarEscenario(calculo: Calculo, id: string, ahora: string): Calculo {
  return tocar({ ...calculo, escenarios: calculo.escenarios.filter((e) => e.id !== id) }, ahora);
}