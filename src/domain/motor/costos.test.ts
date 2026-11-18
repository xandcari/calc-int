import Decimal from "decimal.js";
import { describe, expect, it } from "vitest";

import {
  CONFIGURACION_INICIAL,
  TRABAJO_PROPIO_INICIAL,
  type Calculo,
  type CostoFijo,
  type CostoIndirecto,
  type CostoVariable,
  type Frecuencia,
} from "@/domain/types";

import { calcularResumenCostos, horasMensualesDesdeLotes, volumenDesdeLotes } from "./costos";

const fijo = (nombre: string, monto: string, frecuencia: Frecuencia = "mensual"): CostoFijo => ({
  id: nombre,
  nombre,
  categoria: "fijo",
  monto,
  frecuencia,
});
const indirecto = (nombre: string, monto: string, frecuencia: Frecuencia = "mensual"): CostoIndirecto => ({
  id: nombre,
  nombre,
  categoria: "indirecto",
  monto,
  frecuencia,
});
const variable = (nombre: string, montoUnitario: string): CostoVariable => ({
  id: nombre,
  nombre,
  categoria: "variable",
  montoUnitario,
});

function calculo(parcial: Partial<Calculo>): Pick<
  Calculo,
  "configuracion" | "costosFijos" | "costosVariables" | "costosIndirectos" | "trabajoPropio"
> {
  return {
    configuracion: { ...CONFIGURACION_INICIAL },
    costosFijos: [],
    costosVariables: [],
    costosIndirectos: [],
    trabajoPropio: { ...TRABAJO_PROPIO_INICIAL },
    ...parcial,
  };
}

describe("volumenDesdeLotes / horasMensualesDesdeLotes", () => {
  it("multiplica por los lotes", () => {
    expect(volumenDesdeLotes("20", "6")).toBe("120");
    expect(horasMensualesDesdeLotes("4", "6")).toBe("24");
  });

  it("vacío si falta alguno o no es número", () => {
    expect(volumenDesdeLotes("", "6")).toBe("");
    expect(volumenDesdeLotes("20", "abc")).toBe("");
    expect(horasMensualesDesdeLotes("4", "")).toBe("");
  });
});

describe("calcularResumenCostos — caso de referencia de Data (100 remeras)", () => {
  // Fijos 200.000 + 30.000, sueldo propio 70.000 (70 hs × $1.000, 1 lote), variables 3.000 + 1.500 + 500.
  const datos = calculo({
    configuracion: { ...CONFIGURACION_INICIAL, unidadesPorLote: "100", lotes: "1", volumenMensual: "100" },
    costosFijos: [fijo("Alquiler", "200000"), fijo("Internet", "30000")],
    trabajoPropio: { incluir: true, horasPorLote: "70", horasMensuales: "70", valorHora: "1000", sueldoMensual: "", modoSueldo: "fijo", horasAlMes: "" },
    costosVariables: [variable("Tela", "3000"), variable("Estampa", "1500"), variable("Packaging", "500")],
  });

  it("Costo Fijo Total = 300.000", () => {
    expect(calcularResumenCostos(datos).costoFijoTotalMensual).toBe("300000");
  });

  it("CVU = 5.000", () => {
    expect(calcularResumenCostos(datos).costoVariableUnitario).toBe("5000");
  });

  it("Costo Total = 800.000 y Costo Unitario = 8.000", () => {
    const r = calcularResumenCostos(datos);
    expect(r.costoTotalMensual).toBe("800000");
    expect(r.costoUnitario).toBe("8000");
  });
});

describe("calcularResumenCostos — caso del diseño (Figma, torta)", () => {
  // Fijos 8.000 + 5.000 + 2.000, indirectos 1.200, tiempo 4 hs × $20.000 × 6 lotes, variables 60 + 15 + 10 (+ 0),
  // 20 unidades × 6 lotes = 120 unidades/mes.
  const datos = calculo({
    configuracion: { ...CONFIGURACION_INICIAL, unidadesPorLote: "20", lotes: "6", volumenMensual: "120" },
    costosFijos: [fijo("Arriendo", "8000"), fijo("Servicios", "5000"), fijo("Internet", "2000")],
    costosIndirectos: [indirecto("Comisiones MercadoPago", "1200")],
    trabajoPropio: { incluir: true, horasPorLote: "4", horasMensuales: "24", valorHora: "20000", sueldoMensual: "", modoSueldo: "fijo", horasAlMes: "" },
    costosVariables: [variable("Materia prima", "60"), variable("Empaque", "15"), variable("Etiqueta", "10")],
  });

  it("desglosa gastos fijos, indirectos y trabajo propio", () => {
    const r = calcularResumenCostos(datos);
    expect(r.totalGastosFijosMensual).toBe("15000");
    expect(r.totalIndirectosMensual).toBe("1200");
    expect(r.totalTrabajoPropioMensual).toBe("480000");
    expect(r.costoFijoTotalMensual).toBe("496200");
  });

  it("variables por unidad suman 85 (no 145)", () => {
    expect(calcularResumenCostos(datos).costoVariableUnitario).toBe("85");
  });

  it("costo total mensual 506.400 y unitario 4.220", () => {
    const r = calcularResumenCostos(datos);
    expect(r.costoTotalMensual).toBe("506400");
    expect(r.costoUnitario).toBe("4220");
    expect(r.volumenMensual).toBe("120");
  });
});

describe("calcularResumenCostos — simulador de Backend (Simulador_App_Flujo.xlsx)", () => {
  // 10 u × 30 lotes = 300 u/mes; 6 hs por lote × $2.000 × 30 lotes = $360.000.
  const c = calculo({
    configuracion: { ...CONFIGURACION_INICIAL, unidadesPorLote: "10", lotes: "30", volumenMensual: "300" },
    costosFijos: [fijo("Alquiler / Taller", "15000"), fijo("Servicios", "5000")],
    trabajoPropio: { incluir: true, horasPorLote: "6", horasMensuales: "180", valorHora: "2000", sueldoMensual: "", modoSueldo: "fijo", horasAlMes: "" },
    costosIndirectos: [indirecto("Comisiones bancarias fijas", "1200")],
    costosVariables: [variable("Insumos", "60"), variable("Empaque", "15"), variable("Etiquetas", "10")],
  });
  const r = calcularResumenCostos(c);

  it("coincide con costo fijo total, CVU y costo total mensual de la planilla", () => {
    expect(r.totalTrabajoPropioMensual).toBe("360000");
    expect(r.costoFijoTotalMensual).toBe("381200");
    expect(r.costoVariableUnitario).toBe("85");
    expect(r.costoTotalMensual).toBe("406700");
  });

  it("costo unitario real $1.355,67", () => {
    expect(new Decimal(r.costoUnitario ?? "0").toDecimalPlaces(2).toFixed(2)).toBe("1355.67");
  });
});

describe("calcularResumenCostos — bordes", () => {
  it("sin datos: todo en cero y sin costo unitario", () => {
    const r = calcularResumenCostos(calculo({}));
    expect(r.costoFijoTotalMensual).toBe("0");
    expect(r.costoVariableUnitario).toBe("0");
    expect(r.costoUnitario).toBeNull();
    expect(r.costoTotalMensual).toBeNull();
    expect(r.tieneCostosFijos).toBe(false);
    expect(r.tieneCostosVariables).toBe(false);
  });

  it("volumen cero o negativo no produce costo unitario (evita dividir por cero)", () => {
    for (const volumen of ["0", "-5"]) {
      const r = calcularResumenCostos(
        calculo({
          configuracion: { ...CONFIGURACION_INICIAL, volumenMensual: volumen },
          costosFijos: [fijo("Alquiler", "1000")],
        }),
      );
      expect(r.volumenMensual).toBeNull();
      expect(r.costoUnitario).toBeNull();
    }
  });

  it("con un monto inválido o negativo no entrega costo unitario y lo avisa (nunca lo reemplaza por cero en silencio)", () => {
    const r = calcularResumenCostos(
      calculo({
        costosFijos: [fijo("Alquiler", "1000"), fijo("Roto", "abc"), fijo("Negativo", "-500"), fijo("Vacío", "")],
        costosVariables: [variable("Harina", "50"), variable("Malo", "x")],
      }),
    );
    expect(r.tieneImportesInvalidos).toBe(true);
    expect(r.costoUnitario).toBeNull();
    expect(r.costoTotalMensual).toBeNull();
    // Los subtotales parciales siguen mostrando solo lo válido.
    expect(r.totalGastosFijosMensual).toBe("1000");
    expect(r.costoVariableUnitario).toBe("50");
  });

  it("los vacíos no son inválidos y sin importes inválidos se calcula igual", () => {
    const r = calcularResumenCostos(
      calculo({
        configuracion: { ...CONFIGURACION_INICIAL, volumenMensual: "10" },
        costosFijos: [fijo("Alquiler", "1000"), fijo("Vacío", "")],
        costosVariables: [variable("Harina", "50")],
      }),
    );
    expect(r.tieneImportesInvalidos).toBe(false);
    expect(r.costoUnitario).toBe("150");
  });

  it("la ruta elegida decide qué datos de trabajo se miran: en «reventa» las horas viejas no cuentan", () => {
    const base = calculo({
      configuracion: { ...CONFIGURACION_INICIAL, ruta: "reventa", volumenMensual: "10" },
      trabajoPropio: { incluir: true, horasPorLote: "abc", horasMensuales: "", valorHora: "", sueldoMensual: "1000", modoSueldo: "fijo", horasAlMes: "" },
    });
    expect(calcularResumenCostos(base).tieneImportesInvalidos).toBe(false);
    expect(
      calcularResumenCostos({ ...base, configuracion: { ...base.configuracion, ruta: "unidad" } }).tieneImportesInvalidos,
    ).toBe(true);
  });

  it("normaliza la frecuencia a mensual (semanal × 4, anual ÷ 12)", () => {
    const r = calcularResumenCostos(
      calculo({
        costosFijos: [fijo("Semanal", "2500", "semanal"), fijo("Anual", "120000", "anual")],
        costosIndirectos: [indirecto("Anual", "12000", "anual")],
      }),
    );
    expect(r.totalGastosFijosMensual).toBe("20000"); // 10.000 + 10.000
    expect(r.totalIndirectosMensual).toBe("1000");
  });

  it("no suma el trabajo propio si el usuario no lo incluye", () => {
    const r = calcularResumenCostos(
      calculo({ trabajoPropio: { incluir: false, horasPorLote: "4", horasMensuales: "24", valorHora: "100", sueldoMensual: "", modoSueldo: "fijo", horasAlMes: "" } }),
    );
    expect(r.totalTrabajoPropioMensual).toBe("0");
  });

  it("conserva la precisión decimal: sin redondeo interno", () => {
    const r = calcularResumenCostos(
      calculo({
        configuracion: { ...CONFIGURACION_INICIAL, volumenMensual: "3" },
        costosFijos: [fijo("Alquiler", "100")],
      }),
    );
    // Sin redondeo a 2 decimales: el redondeo es solo visual.
    expect(r.costoUnitario).toBe("33.333333333333333333");
    expect(new Decimal(r.costoUnitario ?? "0").toDecimalPlaces(2).toString()).toBe("33.33");
  });
});
