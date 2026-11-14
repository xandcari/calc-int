import { calcularResumenCostos, horasMensualesDesdeLotes, volumenDesdeLotes } from "@/domain/motor/costos";
import { estaVacio, leerNumero } from "@/domain/motor/numeros";
import { analizarPrecio, MARGEN_MAXIMO_PCT, precioElegido, type AnalisisPrecio } from "@/domain/motor/precio";
import { PRECIO_INICIAL, type Calculo, type DecimalString, type ModoPrecio } from "@/domain/types";
import { MENSAJES_RUTA, validarConfiguracion, validarCostos } from "@/domain/validaciones";
import type { CalculateRequest } from "@/server/calculos/esquema";

/**
 * Cálculo del endpoint `POST /api/v1/calculator/calculate`.
 *
 * El endpoint NO tiene fórmulas propias: arma el mismo `Calculo` que arma la pantalla, lo valida con las mismas
 * reglas y lo resuelve con el motor oficial (`domain/motor`). Así la API y la interfaz no pueden diferir.
 * Funciones puras, sin Next: se prueban sin levantar el servidor.
 */

const EPOCH = "1970-01-01T00:00:00.000Z";

export interface ErrorSolicitud {
  /** Campo de la solicitud con el problema. Ej.: «configuracion.volumenMensual». */
  campo: string;
  mensaje: string;
}

/** Análisis del precio del motor (contribución, equilibrio, facturación mínima…) más cómo se eligió el precio. */
export type AnalisisPrecioDTO = AnalisisPrecio & { modo: ModoPrecio };

export interface DatosResultado {
  /** Gastos fijos del mes (sin indirectos ni trabajo propio). Nombre heredado del contrato `ResultadoCostos`. */
  totalCostosFijosMensual: DecimalString;
  totalIndirectosMensual: DecimalString;
  totalTrabajoPropioMensual: DecimalString;
  /** Gastos fijos + indirectos + trabajo propio. */
  costoFijoTotalMensual: DecimalString;
  costoVariableUnitario: DecimalString;
  volumenMensual: DecimalString;
  costoTotalMensual: DecimalString;
  costoUnitario: DecimalString;
  /** Solo si la solicitud trae `precio`. */
  precio: AnalisisPrecioDTO | null;
}

export type ResultadoSolicitud = { exito: true; datos: DatosResultado } | { exito: false; errores: ErrorSolicitud[] };

function distintos(a: DecimalString, b: DecimalString): boolean {
  const x = leerNumero(a);
  const y = leerNumero(b);
  return Boolean(x && y && !x.equals(y));
}

/**
 * Arma el `Calculo` de la solicitud con las mismas reglas que el paso 1 de la pantalla:
 * - «lotes»: volumen = unidades por lote × lotes; horas mensuales = horas por lote × lotes.
 * - «unidad» y «reventa» (regla del 1 de Data): 1 unidad por lote y `volumenMensual` unidades por mes en «lotes».
 * Un dato derivado que el cliente también envía tiene que coincidir: no se descarta en silencio.
 */
export function armarCalculo(solicitud: CalculateRequest): { calculo: Calculo; errores: ErrorSolicitud[] } {
  const { configuracion: c, trabajoPropio: t } = solicitud;
  const errores: ErrorSolicitud[] = [];

  const porLotes = c.ruta === "lotes";
  const unidadesPorLote = porLotes ? c.unidadesPorLote : "1";
  const lotes = porLotes ? c.lotes : c.volumenMensual;
  const volumenMensual = volumenDesdeLotes(unidadesPorLote, lotes);
  const horasMensuales = horasMensualesDesdeLotes(t.horasPorLote, lotes);

  if (porLotes && !estaVacio(c.volumenMensual) && volumenMensual !== "" && distintos(c.volumenMensual, volumenMensual)) {
    errores.push({
      campo: "configuracion.volumenMensual",
      mensaje: `No coincide con unidades por lote × lotes por mes (${volumenMensual}). Enviá un valor coherente o no lo envíes.`,
    });
  }
  if (c.ruta !== "reventa" && !estaVacio(t.horasMensuales) && horasMensuales !== "" && distintos(t.horasMensuales, horasMensuales)) {
    errores.push({
      campo: "trabajoPropio.horasMensuales",
      mensaje: `No coincide con horas × ${porLotes ? "lotes por mes" : "unidades por mes"} (${horasMensuales}). Enviá un valor coherente o no lo envíes.`,
    });
  }

  const calculo: Calculo = {
    id: "solicitud-api",
    configuracion: {
      tipo: c.tipo,
      ruta: c.ruta as any, // <-- Casteamos como any para satisfacer el tipo estricto del dominio
      nombre: c.nombre,
      moneda: c.moneda,
      unidadVenta: c.unidadVenta,
      unidadesPorLote,
      lotes,
      volumenMensual,
    },
    costosFijos: solicitud.costosFijos,
    costosVariables: solicitud.costosVariables,
    costosIndirectos: solicitud.costosIndirectos,
    trabajoPropio: {
      incluir: t.incluir,
      horasPorLote: t.horasPorLote,
      horasMensuales,
      valorHora: t.valorHora,
      sueldoMensual: t.sueldoMensual,
    },
    precio: solicitud.precio ?? PRECIO_INICIAL,
    escenarios: [],
    pasoActual: "resumen",
    creadoEn: EPOCH,
    actualizadoEn: EPOCH,
  };

  return { calculo, errores };
}

/** Errores que bloquean el cálculo, con las reglas de la pantalla. Los nombres de los conceptos no condicionan el cálculo. */
export function validarSolicitud(calculo: Calculo, solicitud: CalculateRequest): ErrorSolicitud[] {
  const errores: ErrorSolicitud[] = [];
  const { ruta } = calculo.configuracion;

  for (const e of validarConfiguracion(calculo.configuracion)) {
    if (e.campo === "configuracion.unidadesPorLote") errores.push({ campo: e.campo, mensaje: e.mensaje });
    // En «unidad» y «reventa» el volumen viaja en `lotes` por dentro: se informa con el nombre que usa la API.
    if (e.campo === "configuracion.lotes") {
      errores.push({ campo: ruta === "lotes" ? e.campo : "configuracion.volumenMensual", mensaje: e.mensaje });
    }
  }

  for (const e of validarCostos(calculo)) {
    if (e.severidad === "error" && !e.campo.endsWith(".nombre")) errores.push({ campo: e.campo, mensaje: e.mensaje });
  }

  // Declarar que se incluye el trabajo propio sin enviar el dato no puede valer cero en silencio.
  const t = calculo.trabajoPropio;
  if (t.incluir) {
    if (ruta === "reventa") {
      if (estaVacio(t.sueldoMensual)) errores.push({ campo: "trabajoPropio.sueldoMensual", mensaje: "Indicá cuánto querés ganar por mes." });
    } else {
      if (estaVacio(t.horasPorLote)) errores.push({ campo: "trabajoPropio.horasPorLote", mensaje: MENSAJES_RUTA[ruta].horasVacias });
      if (estaVacio(t.valorHora)) errores.push({ campo: "trabajoPropio.valorHora", mensaje: "Indicá cuánto querés ganar por hora." });
    }
  }

  if (solicitud.precio) {
    const { modo, margenPct, precioManual } = solicitud.precio;
    if (modo === "margen") {
      const m = leerNumero(margenPct);
      if (!m || m.isNegative() || m.greaterThan(MARGEN_MAXIMO_PCT)) {
        errores.push({
          campo: "precio.margenPct",
          mensaje: `El margen esperado tiene que ser un número de 0 a ${MARGEN_MAXIMO_PCT} (porcentaje sobre el precio de venta).`,
        });
      }
    } else {
      const p = leerNumero(precioManual);
      if (!p || !p.greaterThan(0)) errores.push({ campo: "precio.precioManual", mensaje: "Ingresá un precio de venta mayor a cero." });
    }
  }

  // Un mismo campo, un solo mensaje (el primero).
  const vistos = new Set<string>();
  return errores.filter((e) => (vistos.has(e.campo) ? false : Boolean(vistos.add(e.campo))));
}

export function calcularSolicitud(solicitud: CalculateRequest): ResultadoSolicitud {
  const { calculo, errores: deCoherencia } = armarCalculo(solicitud);
  const errores = [...deCoherencia, ...validarSolicitud(calculo, solicitud)];
  if (errores.length > 0) return { exito: false, errores };

  const r = calcularResumenCostos(calculo);
  if (!r.volumenMensual || !r.costoTotalMensual || !r.costoUnitario) {
    return {
      exito: false,
      errores: [{ campo: "configuracion", mensaje: "No se pudo calcular el costo unitario con los datos enviados." }],
    };
  }

  let precio: AnalisisPrecioDTO | null = null;
  if (solicitud.precio) {
    const precioVenta = precioElegido(calculo);
    const analisis = precioVenta ? analizarPrecio(calculo, precioVenta) : null;
    if (!analisis) {
      return { exito: false, errores: [{ campo: "precio", mensaje: "No se pudo calcular el precio con los datos enviados." }] };
    }
    precio = { modo: solicitud.precio.modo, ...analisis };
  }

  return {
    exito: true,
    datos: {
      totalCostosFijosMensual: r.totalGastosFijosMensual,
      totalIndirectosMensual: r.totalIndirectosMensual,
      totalTrabajoPropioMensual: r.totalTrabajoPropioMensual,
      costoFijoTotalMensual: r.costoFijoTotalMensual,
      costoVariableUnitario: r.costoVariableUnitario,
      volumenMensual: r.volumenMensual,
      costoTotalMensual: r.costoTotalMensual,
      costoUnitario: r.costoUnitario,
      precio,
    },
  };
}
