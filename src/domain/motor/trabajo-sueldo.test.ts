import { describe, expect, it } from "vitest";

import { actualizarConfiguracion, actualizarTrabajoPropio, crearCalculoInicial } from "@/domain/calculo";
import { CONFIGURACION_INICIAL, TRABAJO_PROPIO_INICIAL, type Calculo } from "@/domain/types";
import { hayErrores, validarCostos } from "@/domain/validaciones";

import { calcularResumenCostos, totalTrabajoMensual, valorHoraEquivalente } from "./costos";
import { detalleDeCostos } from "./resumen";

/**
 * Ejemplo propuesto para el modo revendedor (decisión del equipo, 2/10/26): además del valor por hora,
 * se puede elegir «sueldo pretendido», un monto fijo por mes que pasa directo al costo fijo.
 * Todo lo de este archivo es del ejemplo: si se descarta, se borra este archivo junto con el commit.
 */

const AHORA = "2026-10-02T12:00:00.000Z";

type EntradaResumen = Pick<
  Calculo,
  "configuracion" | "costosFijos" | "costosVariables" | "costosIndirectos" | "trabajoPropio"
>;

function calculo(trabajoPropio: EntradaResumen["trabajoPropio"]): EntradaResumen {
  return {
    configuracion: { ...CONFIGURACION_INICIAL, unidadesPorLote: "1", lotes: "30", volumenMensual: "30" },
    costosFijos: [],
    costosVariables: [{ id: "v", categoria: "variable", nombre: "Producto", montoUnitario: "1000" }],
    costosIndirectos: [],
    trabajoPropio,
  };
}

describe("sueldo pretendido: motor", () => {
  it("suma el sueldo tal cual al costo fijo, sin multiplicar por horas ni lotes", () => {
    const r = calcularResumenCostos(
      calculo({ ...TRABAJO_PROPIO_INICIAL, incluir: true, modo: "sueldo", sueldoMensual: "150000" }),
    );
    expect(r.totalTrabajoPropioMensual).toBe("150000");
    expect(r.costoFijoTotalMensual).toBe("150000");
    expect(r.costoUnitario).toBe("6000"); // (150.000 + 1.000 × 30) ÷ 30
  });

  it("ignora horas y valor por hora cargados en el otro modo", () => {
    const t = {
      incluir: true,
      modo: "sueldo" as const,
      sueldoMensual: "150000",
      horasPorLote: "10",
      horasMensuales: "300",
      valorHora: "9999",
    };
    expect(totalTrabajoMensual(t).toString()).toBe("150000");
  });

  it("sin modo (borradores viejos) o en modo hora calcula como siempre: horas × valor por hora", () => {
    const base = { incluir: true, horasPorLote: "4", horasMensuales: "24", valorHora: "20000" };
    expect(totalTrabajoMensual(base).toString()).toBe("480000");
    expect(totalTrabajoMensual({ ...base, modo: "hora", sueldoMensual: "1" }).toString()).toBe("480000");
  });

  it("no cuenta el sueldo si no está incluido o está vacío", () => {
    expect(totalTrabajoMensual({ ...TRABAJO_PROPIO_INICIAL, incluir: false, modo: "sueldo", sueldoMensual: "5" }).toString()).toBe("0");
    expect(totalTrabajoMensual({ ...TRABAJO_PROPIO_INICIAL, incluir: true, modo: "sueldo", sueldoMensual: "" }).toString()).toBe("0");
  });

  it("calcula el valor por hora equivalente (solo informativo)", () => {
    expect(valorHoraEquivalente("160000", "40")).toBe("4000");
    expect(valorHoraEquivalente("160000", "")).toBeNull();
    expect(valorHoraEquivalente("", "40")).toBeNull();
    expect(valorHoraEquivalente("160000", "0")).toBeNull();
  });

  it("el detalle del resumen marca el modo sueldo", () => {
    const d = detalleDeCostos(calculo({ ...TRABAJO_PROPIO_INICIAL, incluir: true, modo: "sueldo", sueldoMensual: "150000" }));
    expect(d.trabajoPropio).toMatchObject({ modo: "sueldo", totalMensual: "150000" });
  });
});

describe("sueldo pretendido: borrador", () => {
  it("incluye el tiempo apenas se carga el sueldo", () => {
    let c = actualizarTrabajoPropio(crearCalculoInicial(), { modo: "sueldo" }, AHORA);
    expect(c.trabajoPropio.incluir).toBe(false);
    c = actualizarTrabajoPropio(c, { sueldoMensual: "150000" }, AHORA);
    expect(c.trabajoPropio.incluir).toBe(true);
  });

  it("cambiar de modo no borra lo cargado en el otro: volver a «hora» recupera todo", () => {
    let c = actualizarConfiguracion(crearCalculoInicial(), { unidadesPorLote: "20", lotes: "6" }, AHORA);
    c = actualizarTrabajoPropio(c, { horasPorLote: "4", valorHora: "20000" }, AHORA);
    expect(c.trabajoPropio.horasMensuales).toBe("24");

    c = actualizarTrabajoPropio(c, { modo: "sueldo", sueldoMensual: "150000" }, AHORA);
    expect(c.trabajoPropio.horasMensuales).toBe(""); // las horas de referencia arrancan vacías
    expect(c.trabajoPropio.horasPorLote).toBe("4");
    expect(c.trabajoPropio.valorHora).toBe("20000");

    c = actualizarTrabajoPropio(c, { modo: "hora" }, AHORA);
    expect(c.trabajoPropio.horasMensuales).toBe("24"); // se recalcula desde los lotes
    expect(c.trabajoPropio.incluir).toBe(true);
    expect(totalTrabajoMensual(c.trabajoPropio).toString()).toBe("480000");
  });

  it("en modo sueldo, cambiar los lotes no pisa las horas al mes que cargó el usuario", () => {
    let c = actualizarTrabajoPropio(crearCalculoInicial(), { modo: "sueldo", sueldoMensual: "150000", horasMensuales: "40" }, AHORA);
    c = actualizarConfiguracion(c, { lotes: "10" }, AHORA);
    expect(c.trabajoPropio.horasMensuales).toBe("40");
  });
});

describe("sueldo pretendido: validaciones", () => {
  const conTrabajo = (cambios: Parameters<typeof actualizarTrabajoPropio>[1]) =>
    validarCostos(actualizarTrabajoPropio(crearCalculoInicial(), cambios, AHORA));

  it("en modo sueldo no pide horas por lote ni valor por hora", () => {
    const errores = conTrabajo({ modo: "sueldo", sueldoMensual: "150000" });
    expect(hayErrores(errores)).toBe(false);
  });

  it("rechaza un sueldo que no es un número o es negativo", () => {
    expect(conTrabajo({ modo: "sueldo", sueldoMensual: "abc" })).toContainEqual(
      expect.objectContaining({ campo: "trabajoPropio.sueldoMensual", severidad: "error" }),
    );
    expect(conTrabajo({ modo: "sueldo", sueldoMensual: "-5" })).toContainEqual(
      expect.objectContaining({ campo: "trabajoPropio.sueldoMensual", severidad: "error" }),
    );
  });

  it("las horas al mes son opcionales, pero si se cargan tienen que ser mayores a cero", () => {
    expect(hayErrores(conTrabajo({ modo: "sueldo", sueldoMensual: "150000", horasMensuales: "" }))).toBe(false);
    expect(conTrabajo({ modo: "sueldo", sueldoMensual: "150000", horasMensuales: "0" })).toContainEqual(
      expect.objectContaining({ campo: "trabajoPropio.horasMensuales", severidad: "error" }),
    );
  });

  it("en modo hora sigue exigiendo los dos datos", () => {
    expect(conTrabajo({ horasPorLote: "5" })).toContainEqual(
      expect.objectContaining({ campo: "trabajoPropio.valorHora", severidad: "error" }),
    );
  });
});
