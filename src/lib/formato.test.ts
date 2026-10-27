import { describe, expect, it } from "vitest";

import {
  formatearCantidad,
  formatearDiferenciaMonto,
  formatearDiferenciaPuntos,
  formatearDiferenciaUnidades,
  formatearMonto,
} from "./formato";

describe("formatearMonto", () => {
  it("enteros con punto de miles, sin decimales", () => {
    expect(formatearMonto("4220")).toBe("$4.220");
    expect(formatearMonto("496200")).toBe("$496.200");
    expect(formatearMonto("0")).toBe("$0");
  });

  it("redondea a 2 decimales solo al mostrar, con coma decimal", () => {
    expect(formatearMonto("10666.666666")).toBe("$10.666,67");
    expect(formatearMonto("5666.6")).toBe("$5.666,6");
  });

  it("vacío, null o inválido muestran un guion", () => {
    expect(formatearMonto("")).toBe("—");
    expect(formatearMonto(null)).toBe("—");
    expect(formatearMonto(undefined)).toBe("—");
    expect(formatearMonto("abc")).toBe("—");
  });

  it("negativos llevan el signo adelante", () => {
    expect(formatearMonto("-1500")).toBe("-$1.500");
  });
});

describe("formatearCantidad", () => {
  it("sin símbolo y con coma decimal", () => {
    expect(formatearCantidad("120")).toBe("120");
    expect(formatearCantidad("12.5")).toBe("12,5");
    expect(formatearCantidad("1200")).toBe("1.200");
  });

  it("inválido muestra un guion", () => {
    expect(formatearCantidad("")).toBe("—");
  });
});

describe("diferencias con signo", () => {
  it("importes: signo antes del símbolo", () => {
    expect(formatearDiferenciaMonto("460")).toBe("+$460");
    expect(formatearDiferenciaMonto("-85")).toBe("-$85");
    expect(formatearDiferenciaMonto("238000")).toBe("+$238.000");
    expect(formatearDiferenciaMonto("0")).toBe("$0");
    expect(formatearDiferenciaMonto(null)).toBe("—");
  });

  it("unidades: singular y plural", () => {
    expect(formatearDiferenciaUnidades("63")).toBe("+63 uds");
    expect(formatearDiferenciaUnidades("-16")).toBe("-16 uds");
    expect(formatearDiferenciaUnidades("1")).toBe("+1 ud");
    expect(formatearDiferenciaUnidades("0")).toBe("0 uds");
    expect(formatearDiferenciaUnidades("abc")).toBe("—");
  });

  it("puntos porcentuales con un decimal", () => {
    expect(formatearDiferenciaPuntos("15.2")).toBe("+15,2 pts");
    expect(formatearDiferenciaPuntos("-23.74")).toBe("-23,7 pts");
    expect(formatearDiferenciaPuntos("0.01")).toBe("0,0 pts");
    expect(formatearDiferenciaPuntos(undefined)).toBe("—");
  });
});
