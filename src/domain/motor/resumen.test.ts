import Decimal from "decimal.js";
import { describe, expect, it } from "vitest";

import { CONFIGURACION_INICIAL, TRABAJO_PROPIO_INICIAL, type Calculo } from "@/domain/types";

import {
  composicionCostoUnitario,
  contribucionUnitaria,
  costoTotalPorLote,
  detalleDeCostos,
  MARGEN_REFERENCIA,
  precioSugerido,
} from "./resumen";

const dosDecimales = (v: string | null) => new Decimal(v ?? "0").toDecimalPlaces(2).toFixed(2);

// Caso del diseño (Figma, torta): 20 u × 6 lotes = 120 u/mes.
const torta: Pick<Calculo, "configuracion" | "costosFijos" | "costosVariables" | "costosIndirectos" | "trabajoPropio"> = {
  configuracion: { ...CONFIGURACION_INICIAL, unidadesPorLote: "20", lotes: "6", volumenMensual: "120" },
  costosFijos: [
    { id: "a", nombre: "Arriendo", categoria: "fijo", monto: "8000", frecuencia: "mensual" },
    { id: "b", nombre: "Servicios", categoria: "fijo", monto: "5000", frecuencia: "mensual" },
    { id: "c", nombre: "Internet", categoria: "fijo", monto: "2000", frecuencia: "mensual" },
    { id: "vacio", nombre: "", categoria: "fijo", monto: "", frecuencia: "mensual" },
  ],
  costosIndirectos: [{ id: "d", nombre: "Comisiones", categoria: "indirecto", monto: "1200", frecuencia: "mensual" }],
  trabajoPropio: { incluir: true, horasPorLote: "4", horasMensuales: "24", valorHora: "20000", sueldoMensual: "", modoSueldo: "fijo", horasAlMes: "" },
  costosVariables: [
    { id: "e", nombre: "Materia prima", categoria: "variable", montoUnitario: "60" },
    { id: "f", nombre: "Empaque", categoria: "variable", montoUnitario: "15" },
    { id: "g", nombre: "Etiqueta", categoria: "variable", montoUnitario: "10" },
  ],
};

describe("precio y contribución (margen de referencia 40 %)", () => {
  it("precio sugerido y contribución del diseño: $7.033 y $6.948", () => {
    const precio = precioSugerido("4220", MARGEN_REFERENCIA);
    expect(dosDecimales(precio)).toBe("7033.33");
    expect(dosDecimales(contribucionUnitaria(precio!, "85"))).toBe("6948.33");
  });

  it("coincide con la planilla de Backend: 1.355,67 → 2.259,44 y contribución 2.174,44", () => {
    const precio = precioSugerido("1355.6666666666666667", MARGEN_REFERENCIA);
    expect(dosDecimales(precio)).toBe("2259.44");
    expect(dosDecimales(contribucionUnitaria(precio!, "85"))).toBe("2174.44");
  });

  it("rechaza márgenes fuera de 0–99 %", () => {
    expect(precioSugerido("100", "1")).toBeNull();
    expect(precioSugerido("100", "-0.1")).toBeNull();
    expect(precioSugerido("100", "abc")).toBeNull();
    expect(precioSugerido("100", "0")).toBe("100");
  });
});

describe("costoTotalPorLote", () => {
  it("costo unitario × unidades por lote = $84.400", () => {
    expect(costoTotalPorLote("4220", "20")).toBe("84400");
  });
  it("null si falta un dato", () => {
    expect(costoTotalPorLote("4220", "")).toBeNull();
  });
});

describe("composicionCostoUnitario (torta)", () => {
  const c = composicionCostoUnitario(torta)!;

  it("reparte el costo unitario de $4.220", () => {
    expect(c.trabajoPropio.porUnidad).toBe("4000");
    expect(c.gastosFijos.porUnidad).toBe("125");
    expect(c.indirectos.porUnidad).toBe("10");
    expect(c.materiales.porUnidad).toBe("85");
  });

  it("los porcentajes suman 100 y coinciden con el diseño (94,8 / 3,0 / 0,2 / 2,0)", () => {
    const pct = [c.trabajoPropio, c.gastosFijos, c.indirectos, c.materiales].map((p) => new Decimal(p.porcentaje));
    expect(pct.reduce((a, b) => a.plus(b)).toDecimalPlaces(6).toString()).toBe("100");
    expect(pct.map((p) => p.toDecimalPlaces(1).toFixed(1))).toEqual(["94.8", "3.0", "0.2", "2.0"]);
  });

  it("null sin volumen", () => {
    expect(composicionCostoUnitario({ ...torta, configuracion: { ...torta.configuracion, volumenMensual: "" } })).toBeNull();
  });
});

describe("detalleDeCostos", () => {
  const d = detalleDeCostos(torta);

  it("omite filas en blanco y lista el resto", () => {
    expect(d.gastosFijos.map((l) => l.nombre)).toEqual(["Arriendo", "Servicios", "Internet"]);
    expect(d.indirectos).toHaveLength(1);
    expect(d.variables.map((l) => l.monto)).toEqual(["60", "15", "10"]);
  });

  it("trabajo propio: 4 hs × $20.000 × 6 lotes = $480.000", () => {
    expect(d.trabajoPropio).toMatchObject({ horasPorLote: "4", valorHora: "20000", lotes: "6", totalMensual: "480000" });
  });

  it("sin trabajo propio si no se incluye", () => {
    expect(detalleDeCostos({ ...torta, trabajoPropio: { ...TRABAJO_PROPIO_INICIAL } }).trabajoPropio).toBeNull();
  });
});
