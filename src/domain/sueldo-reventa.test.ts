import { describe, expect, it } from "vitest";

import {
  actualizarConfiguracion,
  actualizarTrabajoPropio,
  cambiarRuta,
  crearCalculoInicial,
  datosQueSePierdenAlCambiarRuta,
} from "./calculo";
import { calcularResumenCostos } from "./motor/costos";
import type { Calculo } from "./types";
import { validarCostos } from "./validaciones";

const AHORA = "2026-11-02T12:00:00.000Z";

/** Cálculo en la ruta «reventa» con las ventas por mes indicadas. */
function reventa(ventasPorMes = "80"): Calculo {
  return actualizarConfiguracion(cambiarRuta(crearCalculoInicial(), "reventa", AHORA), { lotes: ventasPorMes }, AHORA);
}

const POR_HORAS = { modoSueldo: "horas", horasAlMes: "40", valorHora: "5000" } as const;

describe("«reventa»: sueldo fijo u horas al mes", () => {
  it("arranca con sueldo fijo y sin horas al mes", () => {
    const { trabajoPropio } = crearCalculoInicial();
    expect(trabajoPropio.modoSueldo).toBe("fijo");
    expect(trabajoPropio.horasAlMes).toBe("");
  });

  it("por horas, el trabajo propio del mes es horas al mes × valor por hora", () => {
    const c = actualizarTrabajoPropio(reventa(), POR_HORAS, AHORA);
    const resumen = calcularResumenCostos(c);

    expect(c.trabajoPropio.incluir).toBe(true);
    expect(resumen.totalTrabajoPropioMensual).toBe("200000");
    expect(resumen.costoFijoTotalMensual).toBe("200000");
  });

  it("por horas da lo mismo que el sueldo fijo equivalente", () => {
    const porHoras = actualizarTrabajoPropio(reventa(), POR_HORAS, AHORA);
    const fijo = actualizarTrabajoPropio(reventa(), { sueldoMensual: "200000" }, AHORA);

    expect(calcularResumenCostos(porHoras)).toEqual(calcularResumenCostos(fijo));
  });

  it("las horas al mes no se multiplican por las ventas del mes", () => {
    const pocas = calcularResumenCostos(actualizarTrabajoPropio(reventa("10"), POR_HORAS, AHORA));
    const muchas = calcularResumenCostos(actualizarTrabajoPropio(reventa("500"), POR_HORAS, AHORA));

    expect(pocas.totalTrabajoPropioMensual).toBe("200000");
    expect(muchas.totalTrabajoPropioMensual).toBe("200000");
  });

  it("cada modo ignora los datos del otro y al volver se conservan", () => {
    let c = actualizarTrabajoPropio(reventa(), { sueldoMensual: "300000", horasAlMes: "40", valorHora: "5000" }, AHORA);
    expect(calcularResumenCostos(c).totalTrabajoPropioMensual).toBe("300000");

    c = actualizarTrabajoPropio(c, { modoSueldo: "horas" }, AHORA);
    expect(calcularResumenCostos(c).totalTrabajoPropioMensual).toBe("200000");

    c = actualizarTrabajoPropio(c, { modoSueldo: "fijo" }, AHORA);
    expect(calcularResumenCostos(c).totalTrabajoPropioMensual).toBe("300000");
  });

  it("el tiempo propio solo cuenta si cargó algo del modo elegido", () => {
    let c = actualizarTrabajoPropio(reventa(), { horasAlMes: "40", valorHora: "5000" }, AHORA);
    expect(c.trabajoPropio.incluir).toBe(false);

    c = actualizarTrabajoPropio(c, { modoSueldo: "horas" }, AHORA);
    expect(c.trabajoPropio.incluir).toBe(true);

    c = actualizarTrabajoPropio(c, { modoSueldo: "fijo" }, AHORA);
    expect(c.trabajoPropio.incluir).toBe(false);
  });

  it("al cambiar de ruta se vacían las horas al mes (y se avisa), y el valor por hora se conserva", () => {
    let c = actualizarTrabajoPropio(reventa(), POR_HORAS, AHORA);
    expect(datosQueSePierdenAlCambiarRuta(c, "unidad")).toContain("las horas de trabajo");

    c = cambiarRuta(c, "unidad", AHORA);
    expect(c.trabajoPropio.horasAlMes).toBe("");
    expect(c.trabajoPropio.valorHora).toBe("5000");
  });
});

describe("«reventa» por horas: validaciones", () => {
  const error = (c: Calculo, campo: string) => validarCostos(c).find((e) => e.campo === campo && e.severidad === "error");

  it("horas negativas son un error y bloquean el costo unitario", () => {
    const c = actualizarTrabajoPropio(reventa(), { ...POR_HORAS, horasAlMes: "-3" }, AHORA);
    const resumen = calcularResumenCostos(c);

    expect(error(c, "trabajoPropio.horasAlMes")).toBeDefined();
    expect(resumen.tieneImportesInvalidos).toBe(true);
    expect(resumen.costoUnitario).toBeNull();
  });

  it("si cargó el valor por hora, también pide las horas al mes", () => {
    const c = actualizarTrabajoPropio(reventa(), { modoSueldo: "horas", valorHora: "5000" }, AHORA);
    expect(error(c, "trabajoPropio.horasAlMes")?.mensaje).toBe("Indicá cuántas horas trabajás por mes.");
  });

  it("si cargó las horas al mes, también pide el valor por hora", () => {
    const c = actualizarTrabajoPropio(reventa(), { modoSueldo: "horas", horasAlMes: "40" }, AHORA);
    expect(error(c, "trabajoPropio.valorHora")).toBeDefined();
  });

  it("sin cargar nada no hay errores", () => {
    const c = actualizarTrabajoPropio(reventa(), { modoSueldo: "horas" }, AHORA);
    expect(error(c, "trabajoPropio.horasAlMes")).toBeUndefined();
    expect(error(c, "trabajoPropio.valorHora")).toBeUndefined();
  });

  it("con sueldo fijo, las horas al mes sin sentido no molestan", () => {
    const c = actualizarTrabajoPropio(reventa(), { horasAlMes: "-3", sueldoMensual: "300000" }, AHORA);
    expect(error(c, "trabajoPropio.horasAlMes")).toBeUndefined();
    expect(calcularResumenCostos(c).tieneImportesInvalidos).toBe(false);
  });
});
