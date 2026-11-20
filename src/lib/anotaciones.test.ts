import { describe, expect, it } from "vitest";

import {
  claveVersion,
  codificarMarca,
  cuerpoIssue,
  desdeIssue,
  leerMarca,
  tituloIssue,
  urlNotaGeneral,
  urlNuevoIssue,
  type Anotacion,
  type IssueGitHub,
} from "./anotaciones";

const nota: Anotacion = {
  id: "l1",
  idLocal: "l1",
  ruta: "/calculadora/producto",
  version: "b",
  tipo: "confusion",
  texto: "No entendí qué es «lote» --> ni cómo se llena",
  elemento: "botón «Por lotes/tandas»",
  selector: "body > main:nth-of-type(1) > div:nth-of-type(2) > button:nth-of-type(1)",
  fx: 0.5,
  fy: 0.25,
  dx: 0.4,
  dy: 320,
  remota: false,
};

describe("marca oculta", () => {
  it("se escribe y se lee sin perder datos", () => {
    const marca = leerMarca(codificarMarca(nota));
    expect(marca).toMatchObject({ v: 1, i: "l1", r: nota.ruta, e: "b", s: nota.selector, fx: 0.5, fy: 0.25, dx: 0.4, dy: 320, t: "confusion" });
  });

  it("no puede cerrar el comentario HTML aunque el selector lo contenga", () => {
    const m = codificarMarca({ ...nota, selector: "a--b > c" });
    expect(m.slice(4, -3)).not.toContain("-->");
    expect(leerMarca(m)?.s).toBe("a--b > c");
  });

  it("rechaza marcas rotas o incompletas", () => {
    expect(leerMarca(null)).toBeNull();
    expect(leerMarca("sin marca")).toBeNull();
    expect(leerMarca("<!--preciar-anotacion:%7Bno-es-json-->")).toBeNull();
    expect(leerMarca(`<!--preciar-anotacion:${encodeURIComponent(JSON.stringify({ v: 1, r: "/" }))}-->`)).toBeNull();
    expect(leerMarca(`<!--preciar-anotacion:${encodeURIComponent(JSON.stringify({ v: 2 }))}-->`)).toBeNull();
  });
});

describe("Issue de la nota", () => {
  it("el cuerpo trae la nota, la versión, la pantalla y la marca", () => {
    const cuerpo = cuerpoIssue(nota, "pantalla de 390×844 px");
    expect(cuerpo).toContain("### Nota");
    expect(cuerpo).toContain("**Versión:** B · Emprendedor");
    expect(cuerpo).toContain("**Pantalla:** /calculadora/producto");
    expect(cuerpo).toContain("preciar-anotacion:");
  });

  it("el título resume la nota y no es larguísimo", () => {
    const t = tituloIssue({ ...nota, texto: "x".repeat(200) });
    expect(t.startsWith("Anotación · B · Emprendedor · /calculadora/producto · ")).toBe(true);
    expect(t.length).toBeLessThan(140);
  });

  it("la dirección apunta al repositorio, con etiqueta y sin pasar de un largo razonable", () => {
    const url = urlNuevoIssue(nota, "pantalla de 390×844 px");
    expect(url).toMatch(/^https:\/\/github\.com\/[^/]+\/[^/]+\/issues\/new\?/);
    expect(new URL(url).searchParams.get("labels")).toBe("usabilidad");
    expect(url.length).toBeLessThan(4000);
  });

  it("la nota general no lleva marca (no es un pin)", () => {
    const url = new URL(urlNotaGeneral("/calculadora/costos", "c", "pantalla"));
    expect(url.searchParams.get("body")).not.toContain("preciar-anotacion");
    expect(url.searchParams.get("title")).toContain("C · Con datos");
  });
});

describe("lectura de los Issues del equipo", () => {
  const issue = (cuerpo: string | null, extra: Partial<IssueGitHub> = {}): IssueGitHub => ({
    number: 12,
    title: "título",
    body: cuerpo,
    html_url: "https://github.com/xandcari/calc-int/issues/12",
    comments: 2,
    user: { login: "belu" },
    ...extra,
  });

  it("un Issue creado por la app vuelve a ser un pin con su texto, autor y respuestas", () => {
    const a = desdeIssue(issue(cuerpoIssue(nota, "pantalla")));
    expect(a).toMatchObject({ id: "12", idLocal: "l1", remota: true, autor: "belu", comentarios: 2, version: "b", tipo: "confusion", elemento: "botón «Por lotes/tandas»" });
    expect(a?.texto).toBe("No entendí qué es «lote» --> ni cómo se llena");
  });

  it("ignora Issues sin marca y Pull Requests", () => {
    expect(desdeIssue(issue("una observación cualquiera"))).toBeNull();
    expect(desdeIssue(issue(cuerpoIssue(nota, "p"), { pull_request: {} }))).toBeNull();
    expect(desdeIssue(issue(null))).toBeNull();
  });
});

describe("claveVersion", () => {
  it("sin estilo elegido es la versión original", () => {
    expect(claveVersion("ninguno")).toBe("original");
    expect(claveVersion("original")).toBe("original");
    expect(claveVersion("a")).toBe("a");
    expect(claveVersion("c")).toBe("c");
  });
});
