import { describe, expect, it } from "vitest";

import { crearCalculoInicial } from "@/domain/calculo";

import { esquemaCalculo, esquemaCompartir, MAX_CONCEPTOS } from "./esquema";

/** El borrador inicial del frontend (con id y fechas) tiene que pasar tal cual. */
const valido = () => structuredClone(crearCalculoInicial());

describe("esquemaCalculo", () => {
  it("acepta el borrador vacío inicial y descarta id y fechas", () => {
    const r = esquemaCalculo.safeParse(valido());
    expect(r.success).toBe(true);
    if (r.success) {
      expect("id" in r.data).toBe(false);
      expect("creadoEn" in r.data).toBe(false);
    }
  });

  it("rechaza importes con coma, letras o notación científica", () => {
    for (const malo of ["12,5", "abc", "1e5", "1.2.3", " 5", "12."]) {
      const c = valido();
      c.costosFijos[0].monto = malo;
      expect(esquemaCalculo.safeParse(c).success, malo).toBe(false);
    }
  });

  it("acepta importes decimales y negativos con punto", () => {
    const c = valido();
    c.costosFijos[0].monto = "1250.50";
    c.escenarios[0].insumosPct = "-20";
    expect(esquemaCalculo.safeParse(c).success).toBe(true);
  });

  it("rechaza enums inválidos", () => {
    const c = valido() as unknown as { configuracion: { tipo: string } };
    c.configuracion.tipo = "otro";
    expect(esquemaCalculo.safeParse(c).success).toBe(false);
  });

  it("rechaza ids repetidos en una lista", () => {
    const c = valido();
    c.costosFijos.push({ ...c.costosFijos[0] });
    expect(esquemaCalculo.safeParse(c).success).toBe(false);
  });

  it("rechaza listas por encima del máximo", () => {
    const c = valido();
    c.costosFijos = Array.from({ length: MAX_CONCEPTOS + 1 }, (_, i) => ({
      id: `f${i}`,
      categoria: "fijo" as const,
      nombre: "x",
      monto: "1",
      frecuencia: "mensual" as const,
    }));
    expect(esquemaCalculo.safeParse(c).success).toBe(false);
  });

  it("rechaza más de 6 escenarios", () => {
    const c = valido();
    c.escenarios = Array.from({ length: 7 }, (_, i) => ({
      id: `e${i}`,
      nombre: "x",
      insumosPct: "0",
      precioPct: "0",
      produccionPct: "0",
    }));
    expect(esquemaCalculo.safeParse(c).success).toBe(false);
  });

  it("rechaza si falta una sección", () => {
    const c = valido() as unknown as Record<string, unknown>;
    delete c.precio;
    expect(esquemaCalculo.safeParse(c).success).toBe(false);
  });
});

describe("esquemaCalculo: límites y valores peligrosos", () => {
  it("rechaza importes negativos donde no tienen sentido", () => {
    const c = valido();
    c.costosFijos[0].monto = "-1";
    expect(esquemaCalculo.safeParse(c).success).toBe(false);
    const d = valido();
    d.precio.precioManual = "-5";
    expect(esquemaCalculo.safeParse(d).success).toBe(false);
    const e = valido();
    e.costosVariables[0].montoUnitario = "-0.5";
    expect(esquemaCalculo.safeParse(e).success).toBe(false);
  });

  it("rechaza números demasiado grandes o con demasiados decimales", () => {
    for (const malo of ["1234567890123456", "1.12345678901", "9".repeat(40)]) {
      const c = valido();
      c.costosFijos[0].monto = malo;
      expect(esquemaCalculo.safeParse(c).success, malo).toBe(false);
    }
    const ok = valido();
    ok.costosFijos[0].monto = "999999999999999.1234567890";
    expect(esquemaCalculo.safeParse(ok).success).toBe(true);
  });

  it("el margen va de 0 a 99 y las variaciones de escenario de -50 a 100", () => {
    const casos: Array<[(c: ReturnType<typeof valido>, v: string) => void, string, boolean]> = [
      [(c, v) => (c.precio.margenPct = v), "99", true],
      [(c, v) => (c.precio.margenPct = v), "100", false],
      [(c, v) => (c.precio.margenPct = v), "-1", false],
      [(c, v) => (c.escenarios[0].precioPct = v), "-50", true],
      [(c, v) => (c.escenarios[0].precioPct = v), "-51", false],
      [(c, v) => (c.escenarios[0].produccionPct = v), "100", true],
      [(c, v) => (c.escenarios[0].produccionPct = v), "101", false],
    ];
    for (const [aplicar, valor, esperado] of casos) {
      const c = valido();
      aplicar(c, valor);
      expect(esquemaCalculo.safeParse(c).success, valor).toBe(esperado);
    }
  });

  it("rechaza el carácter nulo en textos (Postgres no puede guardarlo)", () => {
    const c = valido();
    c.configuracion.nombre = "Torta\u0000";
    expect(esquemaCalculo.safeParse(c).success).toBe(false);
    const d = valido();
    d.costosFijos[0].nombre = "a".repeat(201);
    expect(esquemaCalculo.safeParse(d).success).toBe(false);
  });
});

describe("esquemaCompartir", () => {
  it("exige un booleano", () => {
    expect(esquemaCompartir.safeParse({ compartido: false }).success).toBe(true);
    expect(esquemaCompartir.safeParse({ compartido: "no" }).success).toBe(false);
    expect(esquemaCompartir.safeParse({}).success).toBe(false);
  });
});
