import Decimal from "decimal.js";
import { describe, expect, it } from "vitest";

import { actualizarConcepto, agregarConcepto, cambiarRuta, crearCalculoInicial, datosQueSePierdenAlCambiarRuta } from "./calculo";
import { calcularResumenCostos, costoVariableUnitarioDe } from "./motor/costos";
import { analizarPrecio, precioPorMargen } from "./motor/precio";
import { detalleDeCostos } from "./motor/resumen";
import {
  CONFIGURACION_INICIAL,
  PRECIO_INICIAL,
  type BaseInsumo,
  type Calculo,
  type CostoVariable,
  type RutaProduccion,
  type TrabajoPropio,
} from "./types";

/**
 * Insumos cargados por lote en la ruta A (prompt maestro, ruta A):
 *   CVU = costo del insumo en el lote ÷ unidades por lote
 * Un insumo cargado por unidad se usa tal cual, sin volver a dividirlo. El motor no redondea.
 */

type Entrada = Pick<Calculo, "configuracion" | "costosFijos" | "costosVariables" | "costosIndirectos" | "trabajoPropio" | "precio">;

const insumo = (id: string, montoUnitario: string, base?: BaseInsumo): CostoVariable => ({
  id,
  nombre: id,
  categoria: "variable",
  montoUnitario,
  ...(base ? { base } : {}),
});

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

function entradaLotes(costosVariables: CostoVariable[], ruta: RutaProduccion = "lotes", unidadesPorLote = "20"): Entrada {
  return {
    configuracion: { ...CONFIGURACION_INICIAL, ruta, unidadesPorLote, lotes: "5", volumenMensual: "100" },
    costosFijos: [{ id: "f", nombre: "Gastos fijos", categoria: "fijo", monto: "30000", frecuencia: "mensual" }],
    costosIndirectos: [{ id: "i", nombre: "Indirectos", categoria: "indirecto", monto: "10000", frecuencia: "mensual" }],
    costosVariables,
    trabajoPropio: trabajo({ horasPorLote: "2", horasMensuales: "10", valorHora: "5000" }),
    precio: PRECIO_INICIAL,
  };
}

function cercano(obtenido: string | null | undefined, esperado: string) {
  expect(obtenido).toBeTruthy();
  expect(new Decimal(obtenido as string).minus(esperado).abs().lessThan("0.000001")).toBe(true);
}

describe("Prueba A cargando el insumo por lote", () => {
  // Insumos del lote: $20.000 para 20 unidades → $1.000 por unidad (mismo resultado que cargarlo por unidad).
  const entrada = entradaLotes([insumo("cera", "20000", "lote")]);
  const resumen = calcularResumenCostos(entrada);
  const precio = precioPorMargen(entrada, "30");
  const analisis = precio ? analizarPrecio(entrada, precio) : null;

  it("el CVU es $20.000 ÷ 20 = $1.000 y el resto del resumen no cambia", () => {
    cercano(resumen.costoVariableUnitario, "1000");
    cercano(resumen.costoFijoTotalMensual, "90000");
    cercano(resumen.costoUnitario, "1900");
    expect(resumen.faltanUnidadesPorLote).toBe(false);
  });

  it("precio, contribución, equilibrio y facturación coinciden con la Prueba A", () => {
    cercano(precio, "2714.285714285714");
    cercano(analisis?.contribucion, "1714.285714285714");
    expect(analisis?.puntoEquilibrioUnidades).toBe("53");
    cercano(analisis?.facturacionMinima, "143857.142857142857");
  });

  it("da exactamente lo mismo que cargarlo por unidad", () => {
    const porUnidad = entradaLotes([insumo("cera", "1000")]);
    expect(calcularResumenCostos(porUnidad)).toEqual(resumen);
    expect(precioPorMargen(porUnidad, "30")).toBe(precio);
  });
});

describe("Normalización por lote", () => {
  const config = { ruta: "lotes" as const, unidadesPorLote: "20" };

  it("mezcla insumos por lote y por unidad sin dividir dos veces los de por unidad", () => {
    const entrada = entradaLotes([insumo("cera", "20000", "lote"), insumo("mecha", "500", "unidad"), insumo("pote", "250")]);
    cercano(calcularResumenCostos(entrada).costoVariableUnitario, "1750");
  });

  it("un insumo con base «unidad» explícita o sin base se usa tal cual", () => {
    expect(costoVariableUnitarioDe(insumo("a", "85"), config)?.toString()).toBe("85");
    expect(costoVariableUnitarioDe(insumo("a", "85", "unidad"), config)?.toString()).toBe("85");
  });

  it("conserva los decimales: $100 por lote de 3 unidades = 33,333…", () => {
    const porUnidad = costoVariableUnitarioDe(insumo("a", "100", "lote"), { ruta: "lotes", unidadesPorLote: "3" });
    cercano(porUnidad?.toString(), "33.333333333333333333");
  });

  it("acepta unidades por lote decimales y montos con decimales", () => {
    const porUnidad = costoVariableUnitarioDe(insumo("a", "12.5", "lote"), { ruta: "lotes", unidadesPorLote: "2.5" });
    cercano(porUnidad?.toString(), "5");
  });

  it("un monto por lote enorme sigue siendo exacto", () => {
    const porUnidad = costoVariableUnitarioDe(insumo("a", "1000000000000", "lote"), { ruta: "lotes", unidadesPorLote: "1000" });
    expect(porUnidad?.toString()).toBe("1000000000");
  });

  it("fuera de la ruta «lotes» la base «lote» se ignora y el monto se usa tal cual", () => {
    for (const ruta of ["unidad", "reventa"] as const) {
      const entrada = entradaLotes([insumo("a", "20000", "lote")], ruta, "20");
      cercano(calcularResumenCostos(entrada).costoVariableUnitario, "20000");
    }
  });

  it("un insumo vacío o en cero por lote aporta cero y no activa la advertencia aunque falten las unidades", () => {
    const entrada = entradaLotes([insumo("a", "", "lote"), insumo("b", "0", "lote")], "lotes", "");
    const resumen = calcularResumenCostos(entrada);
    expect(resumen.costoVariableUnitario).toBe("0");
    expect(resumen.faltanUnidadesPorLote).toBe(false);
  });
});

describe("Unidades por lote que no sirven de divisor", () => {
  for (const unidadesPorLote of ["", "0", "-5", "abc"]) {
    it(`con «${unidadesPorLote}» no se inventa un valor: no hay costo unitario y se avisa`, () => {
      const entrada = entradaLotes([insumo("cera", "20000", "lote"), insumo("mecha", "500")], "lotes", unidadesPorLote);
      const resumen = calcularResumenCostos(entrada);
      expect(resumen.faltanUnidadesPorLote).toBe(true);
      expect(resumen.costoUnitario).toBeNull();
      expect(resumen.costoTotalMensual).toBeNull();
      // El insumo por lote no se cuenta ni se divide por cero: queda solo el que ya era por unidad.
      cercano(resumen.costoVariableUnitario, "500");
      expect(costoVariableUnitarioDe(insumo("cera", "20000", "lote"), { ruta: "lotes", unidadesPorLote })).toBeNull();
    });
  }
});

describe("Detalle del paso 3", () => {
  it("muestra el insumo por lote ya por unidad y deja su origen", () => {
    const { variables } = detalleDeCostos(entradaLotes([insumo("cera", "20000", "lote"), insumo("mecha", "500")]));
    expect(variables).toHaveLength(2);
    expect(variables[0]).toMatchObject({ nombre: "cera", monto: "1000", porLote: { montoLote: "20000", unidadesPorLote: "20" } });
    expect(variables[1].monto).toBe("500");
    expect(variables[1].porLote).toBeUndefined();
  });

  it("el total del detalle coincide con el CVU del resumen", () => {
    const entrada = entradaLotes([insumo("cera", "20000", "lote"), insumo("mecha", "500")]);
    const total = detalleDeCostos(entrada).variables.reduce((acc, l) => acc.plus(l.monto), new Decimal(0));
    cercano(total.toString(), calcularResumenCostos(entrada).costoVariableUnitario);
  });
});

describe("Estado: base del insumo y cambio de ruta", () => {
  const AHORA = "2026-10-27T12:00:00.000Z";

  function conInsumosPorLote(): Calculo {
    let calculo = crearCalculoInicial();
    calculo = actualizarConcepto(calculo, "variable", "variable-inicial", { nombre: "Cera", montoUnitario: "20000", base: "lote" }, AHORA);
    calculo = agregarConcepto(calculo, "variable", "mecha", AHORA, "Mecha");
    return actualizarConcepto(calculo, "variable", "mecha", { montoUnitario: "500" }, AHORA);
  }

  it("un insumo nuevo no tiene base (se carga por unidad) y elegir la base no toca el monto ni el nombre", () => {
    const calculo = conInsumosPorLote();
    expect(calculo.costosVariables[1]).toEqual({ id: "mecha", categoria: "variable", nombre: "Mecha", montoUnitario: "500" });
    expect(calculo.costosVariables[0]).toMatchObject({ nombre: "Cera", montoUnitario: "20000", base: "lote" });
  });

  it("al salir de «lotes» vacía los insumos por lote y conserva los de por unidad", () => {
    const calculo = cambiarRuta(conInsumosPorLote(), "unidad", AHORA);
    expect(calculo.costosVariables[0]).toMatchObject({ nombre: "Cera", montoUnitario: "", base: "unidad" });
    expect(calculo.costosVariables[1].montoUnitario).toBe("500");
  });

  it("no reinterpreta un monto por lote como si fuera por unidad", () => {
    const calculo = cambiarRuta(conInsumosPorLote(), "reventa", AHORA);
    cercano(calcularResumenCostos(calculo).costoVariableUnitario, "500");
  });

  it("avisa que se pierden los insumos por lote solo si tienen monto", () => {
    const calculo = conInsumosPorLote();
    expect(datosQueSePierdenAlCambiarRuta(calculo, "unidad")).toContain("los insumos cargados por lote");

    const sinMonto = actualizarConcepto(calculo, "variable", "variable-inicial", { montoUnitario: "" }, AHORA);
    expect(datosQueSePierdenAlCambiarRuta(sinMonto, "unidad")).not.toContain("los insumos cargados por lote");
  });

  it("no avisa nada si los insumos están cargados por unidad", () => {
    let calculo = crearCalculoInicial();
    calculo = actualizarConcepto(calculo, "variable", "variable-inicial", { montoUnitario: "85" }, AHORA);
    expect(datosQueSePierdenAlCambiarRuta(calculo, "unidad")).toEqual([]);
  });

  it("entre «unidad» y «reventa» no toca los insumos", () => {
    let calculo = cambiarRuta(crearCalculoInicial(), "unidad", AHORA);
    calculo = actualizarConcepto(calculo, "variable", "variable-inicial", { montoUnitario: "85" }, AHORA);
    const otra = cambiarRuta(calculo, "reventa", AHORA);
    expect(otra.costosVariables).toEqual(calculo.costosVariables);
  });
});
