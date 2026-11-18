import Decimal from "decimal.js";
import { describe, expect, it } from "vitest";

import { CONFIGURACION_INICIAL, type Calculo } from "@/domain/types";

import { metaDeVentas, simularEscenario, simularVariaciones, situacionBase } from "./escenarios";
import { precioPorMargen } from "./precio";

const redondear = (v: string | null, d = 0) => new Decimal(v ?? "0").toDecimalPlaces(d).toFixed(d);

type Entrada = Pick<
  Calculo,
  "configuracion" | "costosFijos" | "costosVariables" | "costosIndirectos" | "trabajoPropio"
>;

// Torta del diseño: 120 u/mes, CFT $496.200, CVU $85, precio $7.033,33 (margen 40 %).
const torta: Entrada = {
  configuracion: { ...CONFIGURACION_INICIAL, unidadesPorLote: "20", lotes: "6", volumenMensual: "120" },
  costosFijos: [{ id: "a", nombre: "Fijos", categoria: "fijo", monto: "15000", frecuencia: "mensual" }],
  costosIndirectos: [{ id: "d", nombre: "Comisiones", categoria: "indirecto", monto: "1200", frecuencia: "mensual" }],
  trabajoPropio: { incluir: true, horasPorLote: "4", horasMensuales: "24", valorHora: "20000", sueldoMensual: "", modoSueldo: "fijo", horasAlMes: "" },
  costosVariables: [{ id: "e", nombre: "Insumos", categoria: "variable", montoUnitario: "85" }],
};
const precio = precioPorMargen(torta, "40")!;

describe("situación base (torta)", () => {
  const b = situacionBase(torta, precio)!;
  it("costo $4.220, precio $7.033, equilibrio 72, ganancia $337.600", () => {
    expect(b.costoUnitario).toBe("4220");
    expect(redondear(b.precio)).toBe("7033");
    expect(b.puntoEquilibrio).toBe("72");
    expect(redondear(b.gananciaMensual)).toBe("337600");
  });
});

describe("suba de insumos +20 % (el precio no se toca)", () => {
  const e = simularEscenario(torta, precio, "insumos", "20")!;
  it("costo unitario $4.237 (+0,4 %) y precio igual", () => {
    expect(redondear(e.costoUnitario)).toBe("4237");
    expect(redondear(e.variaciones.costoUnitarioPct, 1)).toBe("0.4");
    expect(redondear(e.variaciones.precioPct, 1)).toBe("0.0");
  });
  it("equilibrio 72 (+0,2 %), ganancia $335.560 (−0,6 %), margen neto 39,8 %", () => {
    expect(e.puntoEquilibrio).toBe("72");
    expect(redondear(e.variaciones.equilibrioPct, 1)).toBe("0.2");
    expect(redondear(e.gananciaMensual)).toBe("335560");
    expect(redondear(e.variaciones.gananciaPct, 1)).toBe("-0.6");
    expect(redondear(e.margenNetoPct, 1)).toBe("39.8");
  });
});

describe("cambio de precio +15 %", () => {
  const e = simularEscenario(torta, precio, "precio", "15")!;
  it("precio $8.088 (+15 %), costo unitario igual", () => {
    expect(redondear(e.precio)).toBe("8088");
    expect(redondear(e.variaciones.precioPct, 1)).toBe("15.0");
    expect(redondear(e.variaciones.costoUnitarioPct, 1)).toBe("0.0");
  });
  it("equilibrio 62 (−13,2 %), ganancia $464.200 (+37,5 %), margen neto 47,8 %", () => {
    expect(e.puntoEquilibrio).toBe("62");
    expect(redondear(e.variaciones.equilibrioPct, 1)).toBe("-13.2");
    expect(redondear(e.gananciaMensual)).toBe("464200");
    expect(redondear(e.variaciones.gananciaPct, 1)).toBe("37.5");
    expect(redondear(e.margenNetoPct, 1)).toBe("47.8");
  });
});

describe("más producción +30 %", () => {
  const e = simularEscenario(torta, precio, "produccion", "30")!;
  it("costo unitario $3.266 (−22,6 %), precio igual", () => {
    expect(redondear(e.costoUnitario)).toBe("3266");
    expect(redondear(e.variaciones.costoUnitarioPct, 1)).toBe("-22.6");
  });
  it("equilibrio sin cambios (72), ganancia $587.740 (+74,1 %), margen neto 53,6 %", () => {
    expect(e.puntoEquilibrio).toBe("72");
    expect(redondear(e.variaciones.equilibrioPct, 1)).toBe("0.0");
    expect(redondear(e.gananciaMensual)).toBe("587740");
    expect(redondear(e.variaciones.gananciaPct, 1)).toBe("74.1");
    expect(redondear(e.margenNetoPct, 1)).toBe("53.6");
  });
});

describe("casos límite", () => {
  it("variación 0 % deja todo igual que la base", () => {
    const e = simularEscenario(torta, precio, "insumos", "0")!;
    expect(e.costoUnitario).toBe("4220");
    expect(redondear(e.variaciones.gananciaPct, 1)).toBe("0.0");
  });

  it("limita la variación a −50 % … +100 %", () => {
    const a = simularEscenario(torta, precio, "precio", "500")!;
    const b = simularEscenario(torta, precio, "precio", "100")!;
    expect(a.precio).toBe(b.precio);
    const c = simularEscenario(torta, precio, "precio", "-90")!;
    const d = simularEscenario(torta, precio, "precio", "-50")!;
    expect(c.precio).toBe(d.precio);
  });

  it("si el precio deja de cubrir el costo variable, no hay equilibrio", () => {
    const e = simularEscenario(torta, "80", "insumos", "0")!;
    expect(e.puntoEquilibrio).toBeNull();
    expect(e.variaciones.equilibrioPct).toBeNull();
  });

  it("con base en pérdida, mejorar la ganancia da variación positiva", () => {
    const mejor = simularEscenario(torta, "200", "precio", "100")!;
    expect(new Decimal(mejor.variaciones.gananciaPct!).greaterThan(0)).toBe(true);
  });

  it("sin volumen o con datos inválidos devuelve null", () => {
    const sinVolumen = { ...torta, configuracion: { ...torta.configuracion, volumenMensual: "" } };
    expect(simularEscenario(sinVolumen, precio, "precio", "10")).toBeNull();
    expect(simularEscenario(torta, precio, "precio", "abc")).toBeNull();
    expect(situacionBase(torta, "0")).toBeNull();
  });
});

describe("metaDeVentas", () => {
  it("30 % por encima del equilibrio, hacia arriba: 72 → 94", () => {
    expect(metaDeVentas("72")).toBe("94");
  });
  it("null sin equilibrio", () => {
    expect(metaDeVentas(null)).toBeNull();
  });
});

describe("simularVariaciones (varias variables a la vez)", () => {
  it("con una sola variación da lo mismo que simularEscenario", () => {
    expect(simularVariaciones(torta, precio, { insumosPct: "20" })).toEqual(
      simularEscenario(torta, precio, "insumos", "20"),
    );
    expect(simularVariaciones(torta, precio, { precioPct: "15" })).toEqual(
      simularEscenario(torta, precio, "precio", "15"),
    );
    expect(simularVariaciones(torta, precio, { produccionPct: "30" })).toEqual(
      simularEscenario(torta, precio, "produccion", "30"),
    );
  });

  it("sin variaciones devuelve la situación base, con cambios en cero", () => {
    const base = situacionBase(torta, precio)!;
    const r = simularVariaciones(torta, precio, {})!;
    expect(r).toMatchObject(base);
    expect(Number(r.variaciones.costoUnitarioPct)).toBe(0);
    expect(Number(r.variaciones.precioPct)).toBe(0);
    expect(Number(r.variaciones.equilibrioPct)).toBe(0);
    expect(Number(r.variaciones.gananciaPct)).toBe(0);
  });

  it("insumos +20 % y precio +10 % juntos: costo $4.237, equilibrio 65, ganancia $419.960", () => {
    const r = simularVariaciones(torta, precio, { insumosPct: "20", precioPct: "10" })!;
    expect(redondear(r.costoUnitario)).toBe("4237");
    expect(r.puntoEquilibrio).toBe("65");
    expect(redondear(r.gananciaMensual)).toBe("419960");
  });

  it("en un escenario combinado, cada variable conserva su efecto", () => {
    const combinado = simularVariaciones(torta, precio, { insumosPct: "20", precioPct: "10" })!;
    const soloInsumos = simularEscenario(torta, precio, "insumos", "20")!;
    const soloPrecio = simularEscenario(torta, precio, "precio", "10")!;
    expect(combinado.variaciones.costoUnitarioPct).toBe(soloInsumos.variaciones.costoUnitarioPct);
    expect(combinado.variaciones.precioPct).toBe(soloPrecio.variaciones.precioPct);
  });

  it("limita cada variación al rango permitido (máximo +100 %)", () => {
    expect(simularVariaciones(torta, precio, { precioPct: "500" })).toEqual(
      simularVariaciones(torta, precio, { precioPct: "100" }),
    );
  });

  it("devuelve null si una variación no es un número", () => {
    expect(simularVariaciones(torta, precio, { insumosPct: "abc" })).toBeNull();
  });
});
