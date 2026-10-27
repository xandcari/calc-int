import { describe, expect, it } from "vitest";

import { compararConBase, escalaDeGanancias, escenariosDeMayorGanancia } from "./comparacion";
import type { Situacion } from "./escenarios";

// Situación del diseño de Figma (remeras): costo $1.255, precio $2.000, margen 37,3 %, equilibrio 51 uds, ganancia $149.000.
const base: Situacion = {
  costoUnitario: "1255",
  precio: "2000",
  margenNetoPct: "37.3",
  puntoEquilibrio: "51",
  gananciaMensual: "149000",
};

const escenario = (parcial: Partial<Situacion>): Situacion => ({ ...base, ...parcial });

describe("compararConBase", () => {
  it("escenario mejor: baja el costo y el equilibrio, sube el margen y la ganancia (valores del diseño)", () => {
    const c = compararConBase(
      base,
      escenario({ costoUnitario: "1170", precio: "2460", margenNetoPct: "52.5", puntoEquilibrio: "35", gananciaMensual: "387000" }),
    );
    expect(c.costoUnitario).toMatchObject({ direccion: "baja", valoracion: "mejora", diferencia: "-85" });
    expect(c.precio).toMatchObject({ direccion: "sube", valoracion: "neutro", diferencia: "460", porcentaje: "23" });
    expect(c.margenNeto).toMatchObject({ direccion: "sube", valoracion: "mejora", diferencia: "15.2", porcentaje: null });
    expect(c.puntoEquilibrio).toMatchObject({ direccion: "baja", valoracion: "mejora", diferencia: "-16" });
    expect(Number(c.puntoEquilibrio.porcentaje)).toBeCloseTo(-31.37, 1);
    expect(c.gananciaMensual).toMatchObject({ direccion: "sube", valoracion: "mejora", diferencia: "238000" });
    expect(Number(c.gananciaMensual.porcentaje)).toBeCloseTo(159.7, 1);
  });

  it("escenario peor: sube el costo y el equilibrio, baja la ganancia", () => {
    const c = compararConBase(
      base,
      escenario({ costoUnitario: "1746", puntoEquilibrio: "114", gananciaMensual: "79500", margenNetoPct: "13.6" }),
    );
    expect(c.costoUnitario.valoracion).toBe("empeora");
    expect(c.puntoEquilibrio).toMatchObject({ direccion: "sube", valoracion: "empeora", diferencia: "63" });
    expect(c.margenNeto).toMatchObject({ direccion: "baja", valoracion: "empeora" });
    expect(c.gananciaMensual).toMatchObject({ direccion: "baja", valoracion: "empeora", diferencia: "-69500" });
    expect(Number(c.gananciaMensual.porcentaje)).toBeCloseTo(-46.6, 1);
  });

  it("sin cambios: todo igual a la base", () => {
    const c = compararConBase(base, base);
    for (const cambio of Object.values(c)) {
      expect(cambio).toMatchObject({ direccion: "igual", valoracion: "sin-cambios", porcentaje: null });
    }
  });

  it("el precio nunca es ni mejora ni empeora: solo «más alto» o «más bajo»", () => {
    expect(compararConBase(base, escenario({ precio: "2500" })).precio.valoracion).toBe("neutro");
    expect(compararConBase(base, escenario({ precio: "1500" })).precio.valoracion).toBe("neutro");
  });

  it("un cambio menor que la tolerancia cuenta como sin cambios", () => {
    const c = compararConBase(base, escenario({ costoUnitario: "1255.001", margenNetoPct: "37.31" }));
    expect(c.costoUnitario.valoracion).toBe("sin-cambios");
    expect(c.margenNeto.valoracion).toBe("sin-cambios");
  });

  it("la base negativa toma el valor absoluto para el porcentaje", () => {
    const perdida = escenario({ gananciaMensual: "-1000" });
    const c = compararConBase(perdida, escenario({ gananciaMensual: "500" }));
    expect(c.gananciaMensual).toMatchObject({ direccion: "sube", valoracion: "mejora", diferencia: "1500", porcentaje: "150" });
  });

  it("base con ganancia cero: no hay porcentaje", () => {
    const c = compararConBase(escenario({ gananciaMensual: "0" }), escenario({ gananciaMensual: "500" }));
    expect(c.gananciaMensual).toMatchObject({ direccion: "sube", valoracion: "mejora", diferencia: "500", porcentaje: null });
  });

  describe("punto de equilibrio no viable", () => {
    it("el escenario pierde el equilibrio: empeora y no hay diferencia numérica", () => {
      const c = compararConBase(base, escenario({ puntoEquilibrio: null }));
      expect(c.puntoEquilibrio).toEqual({
        direccion: "sube",
        valoracion: "empeora",
        diferencia: null,
        porcentaje: null,
        situacionEquilibrio: "pasa-a-no-viable",
      });
    });

    it("la base no tenía equilibrio y el escenario sí: mejora", () => {
      const c = compararConBase(escenario({ puntoEquilibrio: null }), base);
      expect(c.puntoEquilibrio).toMatchObject({ valoracion: "mejora", situacionEquilibrio: "pasa-a-viable" });
    });

    it("ninguno tiene equilibrio: sin cambios", () => {
      const sin = escenario({ puntoEquilibrio: null });
      expect(compararConBase(sin, sin).puntoEquilibrio).toMatchObject({
        valoracion: "sin-cambios",
        situacionEquilibrio: "sigue-no-viable",
      });
    });
  });
});

describe("escenariosDeMayorGanancia", () => {
  const e = (id: string, g: string) => ({ id, gananciaMensual: g });

  it("destaca el escenario de mayor ganancia si supera a la base", () => {
    expect(escenariosDeMayorGanancia(base, [e("a", "387000"), e("b", "325000"), e("c", "79500")])).toEqual(["a"]);
  });

  it("no destaca ninguno si ningún escenario supera a la base", () => {
    expect(escenariosDeMayorGanancia(base, [e("a", "100000"), e("b", "79500")])).toEqual([]);
  });

  it("con un solo escenario no destaca nada", () => {
    expect(escenariosDeMayorGanancia(base, [e("a", "387000")])).toEqual([]);
  });

  it("con empate destaca a todos los empatados", () => {
    expect(escenariosDeMayorGanancia(base, [e("a", "200000"), e("b", "200000"), e("c", "10")])).toEqual(["a", "b"]);
  });
});

describe("escalaDeGanancias", () => {
  it("todas positivas: las barras arrancan en 0 y el máximo ocupa todo el ancho", () => {
    const escala = escalaDeGanancias(["149000", "387000", "325000", "79500"], "149000");
    expect(escala.ceroPct).toBeNull();
    expect(escala.barras[1]).toEqual({ inicioPct: 0, anchoPct: 100 });
    expect(escala.barras[0].anchoPct).toBeCloseTo(38.5, 1);
    expect(escala.basePct).toBeCloseTo(38.5, 1);
  });

  it("con una ganancia negativa, la barra se dibuja hacia la izquierda del cero", () => {
    const escala = escalaDeGanancias(["100", "-50"], "100");
    expect(escala.ceroPct).toBeCloseTo(33.3, 1);
    expect(escala.barras[0].inicioPct).toBeCloseTo(33.3, 1);
    expect(escala.barras[0].anchoPct).toBeCloseTo(66.7, 1);
    expect(escala.barras[1].inicioPct).toBe(0);
    expect(escala.barras[1].anchoPct).toBeCloseTo(33.3, 1);
  });

  it("todo en cero no divide por cero", () => {
    const escala = escalaDeGanancias(["0", "0"], "0");
    expect(escala.barras).toEqual([
      { inicioPct: 0, anchoPct: 0 },
      { inicioPct: 0, anchoPct: 0 },
    ]);
    expect(escala.basePct).toBe(0);
  });
});
