import Decimal from "decimal.js";
import { describe, expect, it } from "vitest";

import { CONFIGURACION_INICIAL, type Calculo } from "@/domain/types";

import { calcularResumenCostos } from "./costos";
import { simularEscenario } from "./escenarios";
import { analizarPrecio, precioPorMargen } from "./precio";
import { costoTotalPorLote } from "./resumen";

/**
 * Casos de la planilla «Validación de fórmulas» de Data (hojas Cálculos, Resultados, Escenarios y Pruebas).
 * Producto: remera · 100 unidades/mes · margen 25 % · fijos $200.000 + $30.000 · sueldo propio $70.000 · variables $3.000 + $1.500 + $500.
 */

type Entrada = Pick<
  Calculo,
  "configuracion" | "costosFijos" | "costosVariables" | "costosIndirectos" | "trabajoPropio"
>;

function remeras(volumen = "100"): Entrada {
  return {
    configuracion: { ...CONFIGURACION_INICIAL, nombre: "remera", volumenMensual: volumen },
    costosFijos: [
      { id: "a", nombre: "Alquiler", categoria: "fijo", monto: "200000", frecuencia: "mensual" },
      { id: "b", nombre: "Internet", categoria: "fijo", monto: "30000", frecuencia: "mensual" },
    ],
    costosIndirectos: [],
    // «Sueldo propio $70.000» = 70 hs × $1.000 (equivalente mensual).
    trabajoPropio: { incluir: true, horasPorLote: "70", horasMensuales: "70", valorHora: "1000", sueldoMensual: "", modoSueldo: "fijo", horasAlMes: "" },
    costosVariables: [
      { id: "c", nombre: "Tela", categoria: "variable", montoUnitario: "3000" },
      { id: "d", nombre: "Estampa", categoria: "variable", montoUnitario: "1500" },
      { id: "e", nombre: "Packaging", categoria: "variable", montoUnitario: "500" },
    ],
  };
}

const dec = (v: string | null, d = 2) => new Decimal(v ?? "0").toDecimalPlaces(d).toFixed(d);

describe("hoja «Cálculos» de Data", () => {
  const r = calcularResumenCostos(remeras());

  it("costo fijo total 300.000, CVU 5.000, costo total 800.000, costo unitario 8.000", () => {
    expect(r.costoFijoTotalMensual).toBe("300000");
    expect(r.costoVariableUnitario).toBe("5000");
    expect(r.costoTotalMensual).toBe("800000");
    expect(r.costoUnitario).toBe("8000");
  });

  it("precio sugerido con margen 25 % = 10.666,67", () => {
    expect(dec(precioPorMargen(remeras(), "25"))).toBe("10666.67");
  });

  const a = analizarPrecio(remeras(), precioPorMargen(remeras(), "25")!)!;

  it("contribución 5.666,67 y equilibrio 52,94 → 53 unidades (hacia arriba)", () => {
    expect(dec(a.contribucion)).toBe("5666.67");
    expect(a.puntoEquilibrioUnidades).toBe("53");
  });

  it("ventas en el equilibrio: 53 unidades (redondeadas hacia arriba) × precio = $565.333,33 (confirmado por Data el 3/10)", () => {
    expect(dec(a.facturacionMinima)).toBe("565333.33");
  });
});

describe("hoja «Resultados»: precio manual", () => {
  it("con $10.666,67 el margen real es ~25 %, la contribución 5.666,67 y el equilibrio 53", () => {
    const a = analizarPrecio(remeras(), "10666.67")!;
    expect(dec(a.margenResultantePct, 4)).toBe("25.0000");
    expect(dec(a.contribucion)).toBe("5666.67");
    expect(a.puntoEquilibrioUnidades).toBe("53");
  });
});

describe("hoja «Pruebas» de Data", () => {
  it("Prueba 1 — caso normal: volumen 100 → costo unitario $8.000", () => {
    expect(calcularResumenCostos(remeras("100")).costoUnitario).toBe("8000");
  });

  it("Prueba 2 — volumen 0: el costo unitario no se calcula", () => {
    const r = calcularResumenCostos(remeras("0"));
    expect(r.costoUnitario).toBeNull();
    expect(r.costoTotalMensual).toBeNull();
    expect(analizarPrecio(remeras("0"), "10000")).toBeNull();
  });

  it("Prueba 3 — precio igual al costo variable ($5.000): contribución $0, no viable", () => {
    const a = analizarPrecio(remeras(), "5000")!;
    expect(a.contribucion).toBe("0");
    expect(a.estado).toBe("inalcanzable");
  });

  it("Prueba 4 — precio menor al costo variable ($4.000): contribución −$1.000, no viable", () => {
    const a = analizarPrecio(remeras(), "4000")!;
    expect(a.contribucion).toBe("-1000");
    expect(a.estado).toBe("inalcanzable");
  });

  it("Prueba 5 — precio $9.000: margen 11,11 %", () => {
    expect(dec(analizarPrecio(remeras(), "9000")!.margenResultantePct)).toBe("11.11");
  });

  it("precio manual de $5.000 «no es viable» y de $9.000 sí (comentario de la hoja)", () => {
    expect(analizarPrecio(remeras(), "5000")!.estado).toBe("inalcanzable");
    expect(analizarPrecio(remeras(), "9000")!.estado).not.toBe("inalcanzable");
  });
});

describe("hoja «Escenarios» de Data (volumen ±20 %, el precio no cambia)", () => {
  const precio = precioPorMargen(remeras(), "25")!;

  it("optimista: 120 unidades → costo total 900.000 y costo unitario 7.500", () => {
    const e = simularEscenario(remeras(), precio, "produccion", "20")!;
    expect(dec(e.costoUnitario, 0)).toBe("7500");
    expect(e.precio).toBe(precio);
  });

  it("conservador: 80 unidades → costo total 700.000 y costo unitario 8.750", () => {
    const e = simularEscenario(remeras(), precio, "produccion", "-20")!;
    expect(dec(e.costoUnitario, 0)).toBe("8750");
  });

  it("el equilibrio no depende del volumen: 53 en los tres escenarios", () => {
    for (const v of ["-20", "0", "20"]) {
      expect(simularEscenario(remeras(), precio, "produccion", v)!.puntoEquilibrio).toBe("53");
    }
  });
});

describe("«Regla del 1» de Data (reventa): 1 unidad por lote y en «Lotes por mes» el volumen total", () => {
  // Revendedor: 200 ventas al mes, 0,25 hs de atención por venta a $2.000/h, compra a $3.000 c/u, fijos $20.000.
  const reventa: Entrada = {
    configuracion: { ...CONFIGURACION_INICIAL, unidadesPorLote: "1", lotes: "200", volumenMensual: "200" },
    costosFijos: [{ id: "a", nombre: "Local", categoria: "fijo", monto: "20000", frecuencia: "mensual" }],
    costosIndirectos: [],
    trabajoPropio: { incluir: true, horasPorLote: "0.25", horasMensuales: "50", valorHora: "2000", sueldoMensual: "", modoSueldo: "fijo", horasAlMes: "" },
    costosVariables: [{ id: "b", nombre: "Compra del producto", categoria: "variable", montoUnitario: "3000" }],
  };

  it("el volumen es 200, el tiempo propio 0,25 × $2.000 × 200 = $100.000 y el costo unitario $3.600", () => {
    const r = calcularResumenCostos(reventa);
    expect(r.volumenMensual).toBe("200");
    expect(r.totalTrabajoPropioMensual).toBe("100000");
    expect(r.costoFijoTotalMensual).toBe("120000");
    expect(r.costoUnitario).toBe("3600");
  });

  it("el costo total por lote es el de una sola unidad", () => {
    expect(costoTotalPorLote("3600", "1")).toBe("3600");
  });
});

/**
 * «Simulador bifurcado» de Data (Nuevo_Simulador_App.xlsx, revisado el 27/10): pestañas 1_MODO_LOTES, 2_MODO_UNIDAD y
 * 4_REVENDEDOR_ALT2 (la alternativa que eligió el equipo). Fijos: alquiler $15.000 y servicios $5.000; indirectos $1.200;
 * margen 40 %. Las cifras de la pestaña 4 están tal cual las muestra la planilla.
 */
function simulador(parcial: Pick<Entrada, "configuracion" | "trabajoPropio"> & { cvu: [string, string] }): Entrada {
  return {
    configuracion: parcial.configuracion,
    trabajoPropio: parcial.trabajoPropio,
    costosFijos: [
      { id: "a", nombre: "Alquiler / Taller", categoria: "fijo", monto: "15000", frecuencia: "mensual" },
      { id: "b", nombre: "Servicios", categoria: "fijo", monto: "5000", frecuencia: "mensual" },
    ],
    costosIndirectos: [{ id: "i", nombre: "Otros indirectos", categoria: "indirecto", monto: "1200", frecuencia: "mensual" }],
    costosVariables: [
      { id: "v1", nombre: "Insumo", categoria: "variable", montoUnitario: parcial.cvu[0] },
      { id: "v2", nombre: "Empaque", categoria: "variable", montoUnitario: parcial.cvu[1] },
    ],
  };
}

describe("Simulador bifurcado · pestaña 4_REVENDEDOR_ALT2 (sueldo fijo)", () => {
  const caso = simulador({
    configuracion: { ...CONFIGURACION_INICIAL, ruta: "reventa", unidadesPorLote: "1", lotes: "100", volumenMensual: "100" },
    trabajoPropio: { incluir: true, horasPorLote: "", horasMensuales: "", valorHora: "", sueldoMensual: "150000", modoSueldo: "fijo", horasAlMes: "" },
    cvu: ["3000", "50"],
  });
  const r = calcularResumenCostos(caso);

  it("subtotal de trabajo $150.000, CFT $171.200 y CVU $3.050", () => {
    expect(r.totalTrabajoPropioMensual).toBe("150000");
    expect(r.costoFijoTotalMensual).toBe("171200");
    expect(r.costoVariableUnitario).toBe("3050");
  });

  it("costo unitario real $4.762", () => {
    expect(r.costoUnitario).toBe("4762");
  });

  it("precio sugerido $7.936,67, contribución $4.886,67, equilibrio 36 u. y $285.720", () => {
    const precio = precioPorMargen(caso, "40")!;
    expect(dec(precio)).toBe("7936.67");
    const a = analizarPrecio(caso, precio)!;
    expect(dec(a.contribucion)).toBe("4886.67");
    expect(a.puntoEquilibrioUnidades).toBe("36");
    expect(dec(a.facturacionMinima)).toBe("285720.00");
  });
});

describe("Simulador bifurcado · pestaña 1_MODO_LOTES", () => {
  it("4 lotes × 6 hs × $2.000 = $48.000 de trabajo y CFT $69.200 (la planilla tiene el volumen en 0)", () => {
    const caso = simulador({
      configuracion: { ...CONFIGURACION_INICIAL, ruta: "lotes", unidadesPorLote: "25", lotes: "4", volumenMensual: "100" },
      trabajoPropio: { incluir: true, horasPorLote: "6", horasMensuales: "24", valorHora: "2000", sueldoMensual: "", modoSueldo: "fijo", horasAlMes: "" },
      cvu: ["60", "25"],
    });
    const r = calcularResumenCostos(caso);
    expect(r.totalTrabajoPropioMensual).toBe("48000");
    expect(r.costoFijoTotalMensual).toBe("69200");
    expect(r.costoVariableUnitario).toBe("85");
  });
});

describe("Simulador bifurcado · pestaña 2_MODO_UNIDAD", () => {
  it("8 hs por unidad × $2.500 × 10 unidades = $200.000 de trabajo (la planilla tiene el volumen en 0)", () => {
    const caso = simulador({
      configuracion: { ...CONFIGURACION_INICIAL, ruta: "unidad", unidadesPorLote: "1", lotes: "10", volumenMensual: "10" },
      trabajoPropio: { incluir: true, horasPorLote: "8", horasMensuales: "80", valorHora: "2500", sueldoMensual: "", modoSueldo: "fijo", horasAlMes: "" },
      cvu: ["60", "25"],
    });
    const r = calcularResumenCostos(caso);
    expect(r.totalTrabajoPropioMensual).toBe("200000");
    expect(r.costoFijoTotalMensual).toBe("221200");
  });
});

describe("Simulador bifurcado · pestaña 4, paso 5: suba de costos del 20 %", () => {
  it("el CVU pasa de $3.050 a $3.660, el costo unitario a $5.372 y el equilibrio a 41 unidades", () => {
    const caso = simulador({
      configuracion: { ...CONFIGURACION_INICIAL, ruta: "reventa", unidadesPorLote: "1", lotes: "100", volumenMensual: "100" },
      trabajoPropio: { incluir: true, horasPorLote: "", horasMensuales: "", valorHora: "", sueldoMensual: "150000", modoSueldo: "fijo", horasAlMes: "" },
      cvu: ["3000", "50"],
    });
    const nuevo = simularEscenario(caso, precioPorMargen(caso, "40")!, "insumos", "20")!;
    expect(nuevo.costoUnitario).toBe("5372");
    expect(nuevo.puntoEquilibrio).toBe("41");
  });
});
