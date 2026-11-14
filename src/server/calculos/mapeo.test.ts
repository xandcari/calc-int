import { describe, expect, it } from "vitest";

import { crearCalculoInicial } from "@/domain/calculo";
import type { Calculo } from "@/domain/types";

import {
  calculoAColumnas,
  calculoAFilasHijas,
  filasACalculo,
  type CalculoParaGuardar,
  type FilaCalculo,
} from "./mapeo";

const ID = "11111111-2222-4333-8444-555555555555";
const CREADO = new Date("2026-10-27T12:00:00.000Z");
const ACTUALIZADO = new Date("2026-10-28T08:30:00.000Z");

/** Simula guardar y volver a leer: lo que haría la BD (las columnas se devuelven tal cual). */
function ida_y_vuelta(c: CalculoParaGuardar): Calculo {
  const fila: FilaCalculo = {
    id: ID,
    usuarioId: "usuario-1",
    compartido: true,
    creadoEn: CREADO,
    actualizadoEn: ACTUALIZADO,
    ...calculoAColumnas(c),
  };
  return filasACalculo(fila, calculoAFilasHijas(c, ID));
}

function calculoCompleto(): Calculo {
  const base = crearCalculoInicial();
  return {
    ...base,
    configuracion: {
      tipo: "servicio",
      nombre: "Clase de yoga",
      moneda: "ARS",
      unidadVenta: "hora",
      unidadesPorLote: "10",
      lotes: "4",
      volumenMensual: "40",
      ruta: "estandar" as any, // <-- Casteado como any para los tests
    },
    costosFijos: [
      { id: "f1", categoria: "fijo", nombre: "Alquiler", monto: "150000.50", frecuencia: "mensual", nota: "Incluye expensas" },
      { id: "f2", categoria: "fijo", nombre: "Seguro", monto: "240000", frecuencia: "anual" },
    ],
    costosVariables: [{ id: "v1", categoria: "variable", nombre: "Esterilla", montoUnitario: "1200" }],
    costosIndirectos: [{ id: "i1", categoria: "indirecto", nombre: "Luz", monto: "9000", frecuencia: "semanal" }],
    trabajoPropio: { incluir: true, horasPorLote: "2", horasMensuales: "8", valorHora: "5000", sueldoMensual: "0", },
    precio: { modo: "manual", margenPct: "40", precioManual: "12500.75" },
    pasoActual: "simulador",
  };
}

describe("mapeo Calculo ↔ filas", () => {
  it("un cálculo completo vuelve idéntico (salvo id y fechas, que pone el servidor)", () => {
    const original = calculoCompleto();
    const leido = ida_y_vuelta(original);
    expect(leido).toEqual({
      ...original,
      id: ID,
      creadoEn: CREADO.toISOString(),
      actualizadoEn: ACTUALIZADO.toISOString(),
    });
  });

  it("el borrador vacío inicial (importes en blanco) también vuelve idéntico", () => {
    const original = crearCalculoInicial();
    const leido = ida_y_vuelta(original);
    expect(leido.configuracion).toEqual(original.configuracion);
    expect(leido.costosFijos).toEqual(original.costosFijos);
    expect(leido.costosVariables).toEqual(original.costosVariables);
    expect(leido.escenarios).toEqual(original.escenarios);
    expect(leido.trabajoPropio).toEqual(original.trabajoPropio);
  });

  it("los importes vacíos se guardan como null y los demás no se tocan", () => {
    const columnas = calculoAColumnas(crearCalculoInicial());
    expect(columnas.unidadesPorLote).toBeNull();
    expect(columnas.precioManual).toBeNull();
    expect(columnas.lotes).toBe("1");
    expect(columnas.precioMargenPct).toBe("40");
  });

  it("una nota vacía se guarda como null y al leer el campo no aparece", () => {
    const c = calculoCompleto();
    c.costosFijos[1].nota = "";
    const hijas = calculoAFilasHijas(c, ID);
    expect(hijas.fijos[1].nota).toBeNull();
    expect("nota" in ida_y_vuelta(c).costosFijos[1]).toBe(false);
  });

  it("guarda el orden y lo respeta aunque la BD devuelva las filas desordenadas", () => {
    const c = calculoCompleto();
    const hijas = calculoAFilasHijas(c, ID);
    expect(hijas.fijos.map((f) => f.orden)).toEqual([0, 1]);

    const fila: FilaCalculo = {
      id: ID,
      usuarioId: "u",
      compartido: true,
      creadoEn: CREADO,
      actualizadoEn: ACTUALIZADO,
      ...calculoAColumnas(c),
    };
    const desordenadas = { ...hijas, fijos: [...hijas.fijos].reverse() };
    expect(filasACalculo(fila, desordenadas).costosFijos.map((f) => f.id)).toEqual(["f1", "f2"]);
  });

  it("soporta listas de tamaño muy distinto: 0, 3 y 150 costos fijos", () => {
    for (const cantidad of [0, 3, 150]) {
      const c = calculoCompleto();
      c.costosFijos = Array.from({ length: cantidad }, (_, i) => ({
        id: `fijo-${i}`,
        categoria: "fijo" as const,
        nombre: `Costo ${i}`,
        monto: String(i * 10),
        frecuencia: "mensual" as const,
      }));
      const hijas = calculoAFilasHijas(c, ID);
      expect(hijas.fijos).toHaveLength(cantidad);
      expect(ida_y_vuelta(c).costosFijos).toEqual(c.costosFijos);
    }
  });

  it("todas las filas hijas apuntan al cálculo", () => {
    const hijas = calculoAFilasHijas(calculoCompleto(), ID);
    const todas = [...hijas.fijos, ...hijas.indirectos, ...hijas.variables, ...hijas.escenarios];
    expect(todas.length).toBeGreaterThan(0);
    expect(todas.every((f) => f.calculoId === ID)).toBe(true);
  });
});
