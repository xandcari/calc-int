import { describe, expect, it } from "vitest";

import {
  actualizarConcepto,
  actualizarConfiguracion,
  actualizarEscenario,
  actualizarPrecio,
  actualizarTrabajoPropio,
  agregarConcepto,
  agregarEscenario,
  cambiarPaso,
  cambiarRuta,
  crearCalculoInicial,
} from "./calculo";
import { calcularResumenCostos } from "./motor/costos";
import { simularVariaciones } from "./motor/escenarios";
import { analizarPrecio, precioElegido } from "./motor/precio";
import type { Calculo } from "./types";
import { calcularAnalisisPrecio } from "@/hooks/use-analisis-precio";

/**
 * Recorridos críticos de punta a punta sobre las mismas funciones que aplica el store, en el orden
 * en que los recorre una persona: ruta → producto → costos → precio → escenarios. Cubren lo que los
 * tests del motor no tocan: que cada paso del recorrido deje el borrador listo para el siguiente.
 */

const AHORA = "2026-11-04T12:00:00.000Z";

function conIdFijo(calculo: Calculo, categoria: "fijo" | "variable" | "indirecto", id: string, nombre: string) {
  return agregarConcepto(calculo, categoria, id, AHORA, nombre);
}

describe("Recorrido crítico — ruta «lotes» (Prueba A)", () => {
  it("de borrador vacío a precio, equilibrio y escenario, sin pasos intermedios inválidos", () => {
    let c = crearCalculoInicial();
    expect(precioElegido(c)).toBeNull(); // sin datos todavía no hay precio

    c = actualizarConfiguracion(c, { ruta: "lotes", unidadesPorLote: "20", lotes: "5" }, AHORA);
    c = cambiarPaso(c, "costos", AHORA);
    c = actualizarTrabajoPropio(c, { horasPorLote: "2", valorHora: "5000" }, AHORA);
    c = actualizarConcepto(c, "fijo", c.costosFijos[0].id, { nombre: "Alquiler", monto: "30000" }, AHORA);
    c = actualizarConcepto(c, "variable", c.costosVariables[0].id, { nombre: "Insumos", montoUnitario: "1000" }, AHORA);
    c = conIdFijo(c, "indirecto", "ind-1", "Indirectos");
    c = actualizarConcepto(c, "indirecto", "ind-1", { monto: "10000" }, AHORA);

    c = cambiarPaso(c, "precio", AHORA);
    c = actualizarPrecio(c, { modo: "margen", margenPct: "30" }, AHORA);

    const { resumen, precio, analisis, grafico } = calcularAnalisisPrecio(c);
    expect(resumen.volumenMensual).toBe("100");
    expect(resumen.costoUnitario).toBe("1900");
    expect(precio).not.toBeNull();
    expect(analisis?.puntoEquilibrioUnidades).toBe("53");
    expect(analisis?.estado).toBe("supera");
    expect(grafico?.puntos).toHaveLength(2);

    c = cambiarPaso(c, "simulador", AHORA);
    c = agregarEscenario(c, "esc-1", AHORA);
    c = actualizarEscenario(c, "esc-1", { precioPct: "10", insumosPct: "-5", produccionPct: "20" }, AHORA);
    const escenario = c.escenarios.find((e) => e.id === "esc-1");
    expect(escenario).toBeDefined();
    const sim = simularVariaciones(c, precio as string, escenario!);
    expect(sim).not.toBeNull();
    // Subir precio, bajar insumos y vender más no puede empeorar la ganancia mensual.
    expect(Number(sim!.gananciaMensual)).toBeGreaterThan(Number(analisis!.gananciaNetaMensual));
  });
});

describe("Recorrido crítico — cambio de ruta a mitad de camino", () => {
  it("pasar de «lotes» a «reventa» conserva los costos y deja el sueldo mensual como único trabajo propio", () => {
    let c = crearCalculoInicial();
    c = actualizarConfiguracion(c, { ruta: "lotes", unidadesPorLote: "20", lotes: "5" }, AHORA);
    c = actualizarTrabajoPropio(c, { horasPorLote: "2", valorHora: "5000" }, AHORA);
    c = actualizarConcepto(c, "fijo", c.costosFijos[0].id, { monto: "50000" }, AHORA);

    c = cambiarRuta(c, "reventa", AHORA);
    c = actualizarConfiguracion(c, { lotes: "100" }, AHORA);
    c = actualizarTrabajoPropio(c, { sueldoMensual: "300000" }, AHORA);
    c = actualizarConcepto(c, "variable", c.costosVariables[0].id, { montoUnitario: "5500" }, AHORA);

    expect(c.costosFijos[0].monto).toBe("50000");
    const resumen = calcularResumenCostos(c);
    expect(resumen.totalTrabajoPropioMensual).toBe("300000");
    expect(resumen.volumenMensual).toBe("100");
    c = actualizarPrecio(c, { modo: "margen", margenPct: "20" }, AHORA);
    expect(analizarPrecio(c, precioElegido(c) as string)?.gananciaNetaMensual).toBeDefined();
  });
});

describe("Rendimiento — tiempos de cálculo", () => {
  it("un borrador grande (150 costos y 6 escenarios) se calcula en menos de 250 ms", () => {
    let c = crearCalculoInicial();
    c = actualizarConfiguracion(c, { ruta: "lotes", unidadesPorLote: "50", lotes: "20" }, AHORA);
    c = actualizarTrabajoPropio(c, { horasPorLote: "3", valorHora: "4000" }, AHORA);
    for (let i = 0; i < 50; i++) {
      c = agregarConcepto(c, "fijo", `f${i}`, AHORA, `Fijo ${i}`);
      c = actualizarConcepto(c, "fijo", `f${i}`, { monto: String(1000 + i) }, AHORA);
      c = agregarConcepto(c, "variable", `v${i}`, AHORA, `Variable ${i}`);
      c = actualizarConcepto(c, "variable", `v${i}`, { montoUnitario: String(10 + i) }, AHORA);
      c = agregarConcepto(c, "indirecto", `i${i}`, AHORA, `Indirecto ${i}`);
      c = actualizarConcepto(c, "indirecto", `i${i}`, { monto: String(500 + i) }, AHORA);
    }
    c = actualizarPrecio(c, { modo: "margen", margenPct: "35" }, AHORA);

    const inicio = performance.now();
    const { precio } = calcularAnalisisPrecio(c);
    for (let i = 0; i < 5; i++) c = agregarEscenario(c, `e${i}`, AHORA);
    for (const e of c.escenarios) simularVariaciones(c, precio as string, e);
    const duracion = performance.now() - inicio;

    expect(precio).not.toBeNull();
    expect(duracion).toBeLessThan(250);
  });
});
