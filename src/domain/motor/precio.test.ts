import Decimal from "decimal.js";
import { describe, expect, it } from "vitest";

import { CONFIGURACION_INICIAL, PRECIO_INICIAL, type Calculo } from "@/domain/types";

import { analizarPrecio, datosGrafico, nivelDeMargen, precioElegido, precioPorMargen } from "./precio";

const redondear = (v: string | null, d = 2) => new Decimal(v ?? "0").toDecimalPlaces(d).toFixed(d);

type Entrada = Pick<
  Calculo,
  "configuracion" | "costosFijos" | "costosVariables" | "costosIndirectos" | "trabajoPropio" | "precio"
>;

// Caso del diseño (Figma, torta): 120 u/mes, CFT 496.200, CVU 85, costo unitario 4.220.
const torta: Entrada = {
  configuracion: { ...CONFIGURACION_INICIAL, unidadesPorLote: "20", lotes: "6", volumenMensual: "120" },
  costosFijos: [{ id: "a", nombre: "Fijos", categoria: "fijo", monto: "15000", frecuencia: "mensual" }],
  costosIndirectos: [{ id: "d", nombre: "Comisiones", categoria: "indirecto", monto: "1200", frecuencia: "mensual" }],
  trabajoPropio: { incluir: true, horasPorLote: "4", horasMensuales: "24", valorHora: "20000", sueldoMensual: "", modoSueldo: "fijo", horasAlMes: "" },
  costosVariables: [{ id: "e", nombre: "Insumos", categoria: "variable", montoUnitario: "85" }],
  precio: { ...PRECIO_INICIAL },
};

// Simulador de Backend: 300 u/mes, CFT 381.200, CVU 85.
const planilla: Entrada = {
  configuracion: { ...CONFIGURACION_INICIAL, unidadesPorLote: "10", lotes: "30", volumenMensual: "300" },
  costosFijos: [{ id: "a", nombre: "Fijos", categoria: "fijo", monto: "20000", frecuencia: "mensual" }],
  costosIndirectos: [{ id: "d", nombre: "Comisiones", categoria: "indirecto", monto: "1200", frecuencia: "mensual" }],
  trabajoPropio: { incluir: true, horasPorLote: "6", horasMensuales: "180", valorHora: "2000", sueldoMensual: "", modoSueldo: "fijo", horasAlMes: "" },
  costosVariables: [{ id: "e", nombre: "Insumos", categoria: "variable", montoUnitario: "85" }],
  precio: { ...PRECIO_INICIAL },
};

describe("precio por margen — torta del diseño", () => {
  it("40 % → precio sugerido $7.033", () => {
    expect(redondear(precioPorMargen(torta, "40"))).toBe("7033.33");
  });

  const a = analizarPrecio(torta, precioPorMargen(torta, "40")!)!;

  it("contribución $6.948 (98,8 % del precio)", () => {
    expect(redondear(a.contribucion)).toBe("6948.33");
    expect(redondear(a.contribucionPct, 1)).toBe("98.8");
  });

  it("proyección mensual: ingresos $844.000, costos $506.400, ganancia $337.600", () => {
    expect(redondear(a.ingresosTotalesMensual)).toBe("844000.00");
    expect(a.costosTotalesMensual).toBe("506400");
    expect(redondear(a.gananciaNetaMensual)).toBe("337600.00");
  });

  it("equilibrio: 72 unidades, facturación mínima $506.400 (72 × precio), supera el equilibrio", () => {
    expect(a.puntoEquilibrioUnidades).toBe("72");
    expect(redondear(a.facturacionMinima, 0)).toBe("506400");
    expect(a.estado).toBe("supera");
  });

  it("el margen resultante vuelve a ser 40 %", () => {
    expect(redondear(a.margenResultantePct, 1)).toBe("40.0");
  });
});

describe("precio manual — $200 sobre la torta del diseño", () => {
  const a = analizarPrecio(torta, "200")!;

  it("margen resultante −2010 %", () => {
    expect(redondear(a.margenResultantePct, 1)).toBe("-2010.0");
  });

  it("contribución $115 (57,5 %)", () => {
    expect(a.contribucion).toBe("115");
    expect(redondear(a.contribucionPct, 1)).toBe("57.5");
  });

  it("proyección: ingresos $24.000, costos $506.400, ganancia −$482.400", () => {
    expect(a.ingresosTotalesMensual).toBe("24000");
    expect(a.gananciaNetaMensual).toBe("-482400");
  });

  it("equilibrio: 4.315 unidades, facturación mínima $863.000 (4.315 × $200), bajo el equilibrio", () => {
    expect(a.puntoEquilibrioUnidades).toBe("4315");
    expect(redondear(a.facturacionMinima, 0)).toBe("863000");
    expect(a.estado).toBe("bajo");
  });
});

describe("planilla de Backend (300 u/mes, CFT $381.200)", () => {
  it("precio $2.259,44 → equilibrio en 176 unidades", () => {
    const precio = precioPorMargen(planilla, "40")!;
    expect(redondear(precio)).toBe("2259.44");
    expect(analizarPrecio(planilla, precio)!.puntoEquilibrioUnidades).toBe("176");
  });
});

describe("casos límite", () => {
  it("precio por debajo del costo variable: no hay equilibrio", () => {
    const a = analizarPrecio(torta, "50")!;
    expect(a.estado).toBe("inalcanzable");
    expect(a.puntoEquilibrioUnidades).toBeNull();
    expect(a.facturacionMinima).toBeNull();
  });

  it("precio igual al costo variable: tampoco hay equilibrio", () => {
    expect(analizarPrecio(torta, "85")!.estado).toBe("inalcanzable");
  });

  it("sin costos fijos (issue #7): equilibrio en 0 unidades y facturación mínima $0, sin error", () => {
    const sinFijos: Entrada = {
      ...torta,
      costosFijos: [],
      costosIndirectos: [],
      trabajoPropio: { ...torta.trabajoPropio, incluir: false },
    };
    const a = analizarPrecio(sinFijos, "200")!;
    expect(a.puntoEquilibrioUnidades).toBe("0");
    expect(a.facturacionMinima).toBe("0");
    expect(a.estado).toBe("supera");
  });

  it("sin volumen o con precio inválido devuelve null", () => {
    expect(analizarPrecio({ ...torta, configuracion: { ...torta.configuracion, volumenMensual: "" } }, "100")).toBeNull();
    expect(analizarPrecio(torta, "0")).toBeNull();
    expect(analizarPrecio(torta, "")).toBeNull();
    expect(analizarPrecio(torta, "abc")).toBeNull();
  });

  it("margen 0 % → precio igual al costo unitario; 99 % es el tope", () => {
    expect(precioPorMargen(torta, "0")).toBe("4220");
    expect(precioPorMargen(torta, "99")).not.toBeNull();
    expect(precioPorMargen(torta, "100")).toBeNull();
    expect(precioPorMargen(torta, "-1")).toBeNull();
  });
});

describe("precioElegido", () => {
  it("usa el margen o el precio manual según el modo", () => {
    expect(redondear(precioElegido(torta))).toBe("7033.33");
    expect(precioElegido({ ...torta, precio: { modo: "manual", margenPct: "40", precioManual: "200" } })).toBe("200");
    expect(precioElegido({ ...torta, precio: { modo: "manual", margenPct: "40", precioManual: "" } })).toBeNull();
  });
});

describe("nivelDeMargen", () => {
  it("clasifica por tramos y rechaza lo que está fuera de 0–99", () => {
    expect(nivelDeMargen("5")).toBe("muy-bajo");
    expect(nivelDeMargen("20")).toBe("bajo");
    expect(nivelDeMargen("40")).toBe("bueno");
    expect(nivelDeMargen("80")).toBe("alto");
    expect(nivelDeMargen("100")).toBeNull();
    expect(nivelDeMargen("x")).toBeNull();
  });
});

describe("datosGrafico", () => {
  it("el eje llega a 1,2 × el mayor entre volumen y equilibrio, y las rectas se cruzan en el equilibrio", () => {
    const g = datosGrafico(torta, "7033.3333333333333333")!;
    expect(g.maxUnidades).toBeCloseTo(144, 5); // 120 × 1,2
    expect(g.cruce).toBeCloseTo(71.42, 1);
    expect(g.puntos[0].costos).toBe(496200);
  });

  it("con precio manual bajo, el eje crece hasta el equilibrio (4.315 × 1,2)", () => {
    expect(datosGrafico(torta, "200")!.maxUnidades).toBeCloseTo(5178, 5);
  });
});
