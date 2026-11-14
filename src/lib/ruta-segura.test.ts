import { describe, expect, it } from "vitest";

import { rutaSegura } from "./ruta-segura";

describe("rutaSegura", () => {
  it("acepta rutas internas, con query y hash", () => {
    expect(rutaSegura("/calculadora/costos")).toBe("/calculadora/costos");
    expect(rutaSegura("/c/abc?x=1#y")).toBe("/c/abc?x=1#y");
  });

  it("rechaza destinos externos o ambiguos", () => {
    for (const malo of [
      "https://malo.com",
      "//malo.com",
      "/\\malo.com",
      "javascript:alert(1)",
      "calculadora",
      "/ok\n//malo.com",
      "/ok\t",
    ]) {
      expect(rutaSegura(malo)).toBe("/calculadora/producto");
    }
  });

  it("usa el destino por defecto si falta", () => {
    expect(rutaSegura(null)).toBe("/calculadora/producto");
    expect(rutaSegura(undefined, "/inicio")).toBe("/inicio");
  });
});
