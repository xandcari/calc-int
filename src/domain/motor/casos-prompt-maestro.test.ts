import Decimal from "decimal.js";
import { describe, expect, it } from "vitest";

import {
  CONFIGURACION_INICIAL,
  PRECIO_INICIAL,
  type Calculo,
  type CostoFijo,
  type CostoIndirecto,
  type CostoVariable,
  type TrabajoPropio,
} from "@/domain/types";

import { calcularResumenCostos } from "./costos";
import { analizarPrecio, precioPorMargen } from "./precio";

/**
 * Casos de referencia del prompt maestro de la reingeniería del MVP (A, B y C). Son datos de prueba del motor,
 * no datos comerciales reales. Política de redondeo: el motor no redondea; acá se compara el valor exacto
 * con una tolerancia de 0,000001 (los importes se muestran con 2 decimales solo en pantalla).
 */

type Entrada = Pick<Calculo, "configuracion" | "costosFijos" | "costosVariables" | "costosIndirectos" | "trabajoPropio" | "precio">;

const fijo = (monto: string): CostoFijo => ({ id: "f", nombre: "Gastos fijos", categoria: "fijo", monto, frecuencia: "mensual" });
const indirecto = (monto: string): CostoIndirecto => ({ id: "i", nombre: "Indirectos", categoria: "indirecto", monto, frecuencia: "mensual" });
const variable = (id: string, montoUnitario: string): CostoVariable => ({ id, nombre: id, categoria: "variable", montoUnitario });
const trabajo = (parcial: Partial<TrabajoPropio>): TrabajoPropio => ({
  incluir: true,
  horasPorLote: "",
  horasMensuales: "",
  valorHora: "",
  sueldoMensual: "",
  modoSueldo: "fijo",
  horasAlMes: "",
  ...parcial,
});

function cercano(obtenido: string | null | undefined, esperado: string) {
  expect(obtenido).toBeTruthy();
  const diferencia = new Decimal(obtenido as string).minus(esperado).abs();
  expect(diferencia.lessThan("0.000001")).toBe(true);
}

/** Corre una entrada por el motor común y devuelve todo lo que el prompt pide comparar. */
function correr(entrada: Entrada, margenPct: string) {
  const resumen = calcularResumenCostos(entrada);
  const precio = precioPorMargen(entrada, margenPct);
  const analisis = precio ? analizarPrecio(entrada, precio) : null;
  return { resumen, precio, analisis };
}

describe("Prueba A — productor por lotes (margen 30 %)", () => {
  // 20 unidades por lote × 5 lotes; 2 hs por lote a $5.000; insumos por lote $20.000 → $1.000 por unidad.
  const entrada: Entrada = {
    configuracion: { ...CONFIGURACION_INICIAL, ruta: "lotes", unidadesPorLote: "20", lotes: "5", volumenMensual: "100" },
    costosFijos: [fijo("30000")],
    costosIndirectos: [indirecto("10000")],
    costosVariables: [variable("insumos", "1000")],
    trabajoPropio: trabajo({ horasPorLote: "2", horasMensuales: "10", valorHora: "5000" }),
    precio: PRECIO_INICIAL,
  };
  const { resumen, precio, analisis } = correr(entrada, "30");

  it("volumen 100, trabajo $50.000, CFT $90.000, CVU $1.000 y costo unitario $1.900", () => {
    expect(resumen.volumenMensual).toBe("100");
    expect(resumen.totalTrabajoPropioMensual).toBe("50000");
    expect(resumen.costoFijoTotalMensual).toBe("90000");
    expect(resumen.costoVariableUnitario).toBe("1000");
    expect(resumen.costoUnitario).toBe("1900");
  });

  it("precio $2.714,285714…, contribución $1.714,285714…", () => {
    cercano(precio, "2714.285714285714");
    cercano(analisis?.contribucion, "1714.285714285714");
  });

  it("equilibrio 53 unidades y facturación ≈ $143.857,14", () => {
    expect(analisis?.puntoEquilibrioUnidades).toBe("53");
    cercano(analisis?.facturacionMinima, "143857.142857142857");
  });
});

describe("Prueba B — productor por unidad a medida (margen 25 %)", () => {
  const entrada: Entrada = {
    configuracion: { ...CONFIGURACION_INICIAL, ruta: "unidad", unidadesPorLote: "1", lotes: "10", volumenMensual: "10" },
    costosFijos: [fijo("20000")],
    costosIndirectos: [indirecto("10000")],
    costosVariables: [variable("insumos", "15000")],
    trabajoPropio: trabajo({ horasPorLote: "3", horasMensuales: "30", valorHora: "4000" }),
    precio: PRECIO_INICIAL,
  };
  const { resumen, precio, analisis } = correr(entrada, "25");

  it("volumen 10, trabajo $120.000, CFT $150.000, CVU $15.000 y costo unitario $30.000", () => {
    expect(resumen.volumenMensual).toBe("10");
    expect(resumen.totalTrabajoPropioMensual).toBe("120000");
    expect(resumen.costoFijoTotalMensual).toBe("150000");
    expect(resumen.costoVariableUnitario).toBe("15000");
    expect(resumen.costoUnitario).toBe("30000");
  });

  it("precio $40.000, contribución $25.000, equilibrio 6 unidades y facturación $240.000", () => {
    expect(precio).toBe("40000");
    expect(analisis?.contribucion).toBe("25000");
    expect(analisis?.puntoEquilibrioUnidades).toBe("6");
    expect(analisis?.facturacionMinima).toBe("240000");
  });
});

describe("Prueba C — revendedor con sueldo mensual directo (margen 20 %)", () => {
  // Compra $5.000 + packaging $500; sueldo $300.000 una sola vez; sin horas ni valor hora.
  const entrada: Entrada = {
    configuracion: { ...CONFIGURACION_INICIAL, ruta: "reventa", unidadesPorLote: "1", lotes: "100", volumenMensual: "100" },
    costosFijos: [fijo("50000")],
    costosIndirectos: [indirecto("20000")],
    costosVariables: [variable("compra", "5000"), variable("packaging", "500")],
    trabajoPropio: trabajo({ sueldoMensual: "300000" }),
    precio: PRECIO_INICIAL,
  };
  const { resumen, precio, analisis } = correr(entrada, "20");

  it("volumen 100, trabajo $300.000, CFT $370.000, CVU $5.500 y costo unitario $9.200", () => {
    expect(resumen.volumenMensual).toBe("100");
    expect(resumen.totalTrabajoPropioMensual).toBe("300000");
    expect(resumen.costoFijoTotalMensual).toBe("370000");
    expect(resumen.costoVariableUnitario).toBe("5500");
    expect(resumen.costoUnitario).toBe("9200");
  });

  it("precio $11.500, contribución $6.000, equilibrio 62 unidades y facturación $713.000", () => {
    expect(precio).toBe("11500");
    expect(analisis?.contribucion).toBe("6000");
    expect(analisis?.puntoEquilibrioUnidades).toBe("62");
    expect(analisis?.facturacionMinima).toBe("713000");
  });

  it("el sueldo entra una sola vez: la ganancia del mes es ingresos − costos, sin descontarlo de nuevo", () => {
    expect(analisis?.costosTotalesMensual).toBe("920000"); // 370.000 + 5.500 × 100
    expect(analisis?.ingresosTotalesMensual).toBe("1150000");
    expect(analisis?.gananciaNetaMensual).toBe("230000");
  });

  it("las horas y el valor hora cargados antes en otra ruta no cambian el resultado", () => {
    const conRestos = {
      ...entrada,
      trabajoPropio: trabajo({ sueldoMensual: "300000", horasPorLote: "5", horasMensuales: "500", valorHora: "9999" }),
    };
    expect(calcularResumenCostos(conRestos).costoUnitario).toBe("9200");
  });
});

describe("Casos límite del motor común", () => {
  const base: Entrada = {
    configuracion: { ...CONFIGURACION_INICIAL, ruta: "reventa", unidadesPorLote: "1", lotes: "100", volumenMensual: "100" },
    costosFijos: [fijo("50000")],
    costosIndirectos: [indirecto("20000")],
    costosVariables: [variable("compra", "5500")],
    trabajoPropio: trabajo({ sueldoMensual: "300000" }),
    precio: PRECIO_INICIAL,
  };

  it("margen 0 %: el precio es el costo unitario y la ganancia es cero", () => {
    const { precio, analisis } = correr(base, "0");
    expect(precio).toBe("9200");
    expect(analisis?.gananciaNetaMensual).toBe("0");
  });

  it("margen 99 %: el precio es 100 veces el costo unitario", () => {
    expect(correr(base, "99").precio).toBe("920000");
  });

  it("margen 100 % o mayor, o negativo: no hay precio sugerido", () => {
    for (const margen of ["100", "120", "-10", "abc", ""]) {
      expect(correr(base, margen).precio).toBeNull();
    }
  });

  it("volumen cero o inválido: no hay costo unitario ni precio", () => {
    for (const volumen of ["0", "", "x"]) {
      const { resumen, precio } = correr({ ...base, configuracion: { ...base.configuracion, volumenMensual: volumen } }, "20");
      expect(resumen.costoUnitario).toBeNull();
      expect(precio).toBeNull();
    }
  });

  it("precio por debajo del costo variable: el equilibrio es inalcanzable (no hay cifra finita)", () => {
    const a = analizarPrecio(base, "5000");
    expect(a?.estado).toBe("inalcanzable");
    expect(a?.puntoEquilibrioUnidades).toBeNull();
    expect(a?.facturacionMinima).toBeNull();
  });

  it("costos fijos en cero: el equilibrio es 0 unidades y $0", () => {
    const sinFijos: Entrada = { ...base, costosFijos: [], costosIndirectos: [], trabajoPropio: trabajo({ sueldoMensual: "0" }) };
    const { analisis } = correr(sinFijos, "20");
    expect(analisis?.puntoEquilibrioUnidades).toBe("0");
    expect(analisis?.facturacionMinima).toBe("0");
  });

  it("un importe negativo o con formato inválido no se descarta en silencio: no hay resultado", () => {
    for (const monto of ["-50000", "abc", "1e15"]) {
      const { resumen, precio } = correr({ ...base, costosFijos: [fijo(monto)] }, "20");
      expect(resumen.tieneImportesInvalidos).toBe(true);
      expect(resumen.costoUnitario).toBeNull();
      expect(precio).toBeNull();
    }
  });

  it("decimales e importes grandes mantienen la precisión (sin errores de coma flotante)", () => {
    const decimales: Entrada = {
      ...base,
      costosFijos: [fijo("0.1")],
      costosIndirectos: [indirecto("0.2")],
      costosVariables: [variable("v", "0.1")],
      trabajoPropio: trabajo({ sueldoMensual: "0" }),
    };
    expect(calcularResumenCostos(decimales).costoFijoTotalMensual).toBe("0.3");
    expect(calcularResumenCostos(decimales).costoUnitario).toBe("0.103");
    const grande = calcularResumenCostos({ ...base, costosFijos: [fijo("999999999999999")] });
    expect(grande.costoFijoTotalMensual).toBe("1000000000319999");
  });
});
