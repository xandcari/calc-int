import { describe, expect, it } from "vitest";

import { aCsv, celdaCsv, esTokenValido, esquemaObservacion, esquemaResuelta } from "./esquema";

const valida = {
  nombre: "Rocío",
  version: "b",
  ruta: "/calculadora/producto",
  tipo: "confusion",
  texto: "No entendí qué es el margen",
  elemento: "Botón «Siguiente»",
  selector: "body > main:nth-of-type(1)",
  general: false,
  fx: 0.5,
  fy: 0.25,
  dx: 0.4,
  dy: 320,
  dispositivo: "pantalla de 390×844 px (táctil)",
};

describe("esquemaObservacion", () => {
  it("acepta una nota completa y recorta espacios", () => {
    const r = esquemaObservacion.parse({ ...valida, nombre: "  Rocío ", texto: " hola " });
    expect(r.nombre).toBe("Rocío");
    expect(r.texto).toBe("hola");
  });

  it("acepta la versión original y una nota general sin selector", () => {
    expect(esquemaObservacion.safeParse({ ...valida, version: "original", general: true, selector: null }).success).toBe(true);
  });

  it.each([
    ["nombre vacío", { nombre: "   " }],
    ["nombre largo", { nombre: "a".repeat(41) }],
    ["texto vacío", { texto: " " }],
    ["texto largo", { texto: "a".repeat(501) }],
    ["versión desconocida", { version: "z" }],
    ["tipo desconocido", { tipo: "otro" }],
    ["ruta con parámetros", { ruta: "/x?a=1" }],
    ["ruta sin barra", { ruta: "x" }],
    ["fracción fuera de rango", { fx: 1.5 }],
    ["dy negativo", { dy: -1 }],
  ])("rechaza: %s", (_n, cambio) => {
    expect(esquemaObservacion.safeParse({ ...valida, ...cambio }).success).toBe(false);
  });
});

describe("esquemaResuelta y token", () => {
  it("solo acepta un booleano", () => {
    expect(esquemaResuelta.safeParse({ resuelta: true }).success).toBe(true);
    expect(esquemaResuelta.safeParse({ resuelta: "si" }).success).toBe(false);
  });

  it("valida el formato del token", () => {
    expect(esTokenValido("abcdefghijklmnop")).toBe(true);
    expect(esTokenValido("corto")).toBe(false);
    expect(esTokenValido("con espacios y simbolos!!")).toBe(false);
    expect(esTokenValido(null)).toBe(false);
  });
});

describe("CSV", () => {
  it("escapa comillas y neutraliza fórmulas", () => {
    expect(celdaCsv('dijo "hola"')).toBe('"dijo ""hola"""');
    expect(celdaCsv("=SUMA(A1)")).toBe(`"'=SUMA(A1)"`);
    expect(celdaCsv("@cmd")).toBe(`"'@cmd"`);
  });

  it("arma el archivo con BOM, separador ; y una fila por nota", () => {
    const csv = aCsv([
      {
        creadaEn: new Date("2026-11-20T03:45:00Z"),
        nombre: "Cari",
        version: "c",
        ruta: "/calculadora/producto",
        tipo: "idea",
        elemento: "Título",
        texto: "una; nota\ncon salto",
        general: true,
        resuelta: false,
        dispositivo: "pantalla de 1280×800 px",
      },
    ]);
    expect(csv.startsWith("﻿")).toBe(true);
    const lineas = csv.trimEnd().split("\r\n");
    expect(lineas[0]).toContain('"Fecha";"Quién"');
    expect(csv).toContain('"2026-11-20 03:45"');
    expect(csv).toContain('"Pantalla completa";"Abierta"');
  });
});
