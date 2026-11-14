import { describe, expect, it } from "vitest";

import { esOrigenPropio } from "./origen";

const pedir = (encabezados: Record<string, string>) => new Request("https://app.com/api/calculos", { method: "POST", headers: encabezados });

describe("esOrigenPropio", () => {
  it("acepta el mismo sitio", () => {
    expect(esOrigenPropio(pedir({ origin: "https://app.com", host: "app.com" }))).toBe(true);
  });
  it("acepta si no hay Origin (curl, servidor a servidor)", () => {
    expect(esOrigenPropio(pedir({ host: "app.com" }))).toBe(true);
  });
  it("usa x-forwarded-host detrás de un proxy", () => {
    expect(esOrigenPropio(pedir({ origin: "https://app.com", host: "interno:3000", "x-forwarded-host": "app.com" }))).toBe(true);
  });
  it("rechaza otro sitio, otro subdominio y Origin inválido", () => {
    expect(esOrigenPropio(pedir({ origin: "https://malo.com", host: "app.com" }))).toBe(false);
    expect(esOrigenPropio(pedir({ origin: "https://app.com.malo.com", host: "app.com" }))).toBe(false);
    expect(esOrigenPropio(pedir({ origin: "null", host: "app.com" }))).toBe(false);
  });
});
