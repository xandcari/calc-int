import { describe, expect, it } from "vitest";

import { actualizarConfiguracion, actualizarPrecio, crearCalculoInicial } from "@/domain/calculo";

import { calcularAnalisisPrecio } from "./use-analisis-precio";

describe("calcularAnalisisPrecio", () => {
  it("devuelve nulos (sin romper) mientras no hay datos suficientes para el precio", () => {
    const r = calcularAnalisisPrecio(crearCalculoInicial());
    expect(r.precio).toBeNull();
    expect(r.analisis).toBeNull();
    expect(r.grafico).toBeNull();
  });

  it("no muta el borrador que recibe", () => {
    const base = actualizarPrecio(
      actualizarConfiguracion(crearCalculoInicial(), { unidadesPorLote: "10", lotes: "2" }, "2026-11-04T12:00:00.000Z"),
      { modo: "manual", precioManual: "500" },
      "2026-11-04T12:00:00.000Z",
    );
    const copia = structuredClone(base);
    calcularAnalisisPrecio(base);
    expect(base).toEqual(copia);
  });
});
