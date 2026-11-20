/**
 * Anotaciones de usabilidad sobre la pantalla (solo en la app de prueba, NEXT_PUBLIC_MODO_PRUEBA=1).
 *
 * Cada nota se publica como un Issue del repositorio con una marca oculta (comentario HTML) que guarda
 * dónde se hizo: pantalla, versión (A/B/C/original), elemento y posición. Así todo el equipo ve las notas
 * como pines sobre la propia pantalla, sin base de datos ni servidor.
 */

/** Repositorio donde se publican las notas (Issues). Se puede cambiar con NEXT_PUBLIC_REPO_OBSERVACIONES. */
export const REPO = process.env.NEXT_PUBLIC_REPO_OBSERVACIONES ?? "xandcari/calc-int";

export const ETIQUETA_ISSUE = "usabilidad";

export const NOMBRE_VERSION: Record<string, string> = {
  a: "A · Paso a paso",
  b: "B · Emprendedor",
  c: "C · Con datos",
  original: "Original",
};

export type TipoNota = "confusion" | "error" | "idea";

export const TIPOS: { id: TipoNota; etiqueta: string }[] = [
  { id: "confusion", etiqueta: "Me confundió" },
  { id: "error", etiqueta: "No funciona" },
  { id: "idea", etiqueta: "Idea / mejora" },
];

export type Anotacion = {
  /** Identificador local (borradores) o número del Issue (notas del equipo). */
  id: string;
  /** Identificador local con el que se creó, para no repetir un borrador ya publicado. */
  idLocal: string;
  ruta: string;
  version: string;
  tipo: TipoNota;
  texto: string;
  /** Descripción legible del elemento señalado («botón «Siguiente»»). */
  elemento: string;
  /** Selector del elemento (relativo a <body>) o null si no se pudo fijar a uno. */
  selector: string | null;
  /** Posición dentro del elemento (0 a 1). */
  fx: number;
  fy: number;
  /** Posición de respaldo en la página: fracción del ancho y píxeles desde arriba. */
  dx: number;
  dy: number;
  remota: boolean;
  autor?: string;
  url?: string;
  comentarios?: number;
};

export function claveVersion(estilo: string): string {
  return estilo === "a" || estilo === "b" || estilo === "c" ? estilo : "original";
}

/* ---------- Marca oculta dentro del Issue ---------- */

type Marca = {
  v: 1;
  i: string;
  r: string;
  e: string;
  s: string | null;
  fx: number;
  fy: number;
  dx: number;
  dy: number;
  t: TipoNota;
};

const PATRON_MARCA = /<!--preciar-anotacion:([^>]*?)-->/;

export function codificarMarca(a: Anotacion): string {
  const marca: Marca = {
    v: 1,
    i: a.idLocal,
    r: a.ruta,
    e: a.version,
    s: a.selector,
    fx: a.fx,
    fy: a.fy,
    dx: a.dx,
    dy: a.dy,
    t: a.tipo,
  };
  // encodeURIComponent evita que el contenido pueda cerrar el comentario HTML («-->»).
  return `<!--preciar-anotacion:${encodeURIComponent(JSON.stringify(marca))}-->`;
}

const esNumero = (n: unknown): n is number => typeof n === "number" && Number.isFinite(n);

export function leerMarca(texto: string | null | undefined): Marca | null {
  const m = PATRON_MARCA.exec(texto ?? "");
  if (!m) return null;
  try {
    const d = JSON.parse(decodeURIComponent(m[1])) as Partial<Marca>;
    if (
      d.v !== 1 ||
      typeof d.r !== "string" ||
      typeof d.e !== "string" ||
      typeof d.i !== "string" ||
      !(d.s === null || typeof d.s === "string") ||
      !esNumero(d.fx) ||
      !esNumero(d.fy) ||
      !esNumero(d.dx) ||
      !esNumero(d.dy) ||
      !TIPOS.some((t) => t.id === d.t)
    ) {
      return null;
    }
    return d as Marca;
  } catch {
    return null;
  }
}

/* ---------- Publicación como Issue ---------- */

const etiquetaTipo = (t: TipoNota) => TIPOS.find((x) => x.id === t)?.etiqueta ?? t;

export function cuerpoIssue(a: Anotacion, dispositivo: string): string {
  return [
    "### Nota",
    "",
    a.texto.trim(),
    "",
    `**Tipo:** ${etiquetaTipo(a.tipo)}`,
    `**Versión:** ${NOMBRE_VERSION[a.version] ?? a.version}`,
    `**Pantalla:** ${a.ruta}`,
    `**Elemento:** ${a.elemento}`,
    `**Dispositivo:** ${dispositivo}`,
    "",
    codificarMarca(a),
  ].join("\n");
}

export function tituloIssue(a: Anotacion): string {
  const resumen = a.texto.trim().replace(/\s+/g, " ");
  const corto = resumen.length > 60 ? `${resumen.slice(0, 57)}…` : resumen;
  return `Anotación · ${NOMBRE_VERSION[a.version] ?? a.version} · ${a.ruta} · ${corto}`;
}

export function urlNuevoIssue(a: Anotacion, dispositivo: string): string {
  const params = new URLSearchParams({
    title: tituloIssue(a),
    body: cuerpoIssue(a, dispositivo),
    labels: ETIQUETA_ISSUE,
  });
  return `https://github.com/${REPO}/issues/new?${params.toString()}`;
}

/** Nota general (sin pin): formulario para contar qué costó entender, sin señalar un punto de la pantalla. */
export function urlNotaGeneral(ruta: string, version: string, dispositivo: string): string {
  const cuerpo = [
    `**Pantalla:** ${ruta}`,
    `**Versión:** ${NOMBRE_VERSION[version] ?? version}`,
    `**Dispositivo:** ${dispositivo}`,
    "",
    "### ¿Qué estabas tratando de hacer?",
    "",
    "### ¿Qué te costó entender o no funcionó?",
    "",
    "### ¿Qué cambiarías?",
    "",
  ].join("\n");
  const params = new URLSearchParams({
    title: `Observación de usabilidad · ${NOMBRE_VERSION[version] ?? version} · ${ruta}`,
    body: cuerpo,
    labels: ETIQUETA_ISSUE,
  });
  return `https://github.com/${REPO}/issues/new?${params.toString()}`;
}

/* ---------- Lectura de las notas del equipo (Issues abiertos con la etiqueta) ---------- */

export type IssueGitHub = {
  number: number;
  title: string;
  body: string | null;
  html_url: string;
  comments: number;
  user?: { login?: string } | null;
  pull_request?: unknown;
};

export function urlListaIssues(): string {
  return `https://api.github.com/repos/${REPO}/issues?labels=${ETIQUETA_ISSUE}&state=open&per_page=100`;
}

function textoDeNota(issue: IssueGitHub): string {
  const m = /### Nota\s+([\s\S]*?)\n\s*\n\*\*Tipo:\*\*/.exec(issue.body ?? "");
  const texto = m?.[1]?.trim();
  return texto || issue.title;
}

function elementoDeNota(issue: IssueGitHub): string {
  const m = /\*\*Elemento:\*\*\s*(.+)/.exec(issue.body ?? "");
  return m?.[1]?.trim() ?? "";
}

/** Convierte un Issue en pin; devuelve null si no es una anotación (no tiene la marca) o es un Pull Request. */
export function desdeIssue(issue: IssueGitHub): Anotacion | null {
  if (issue.pull_request) return null;
  const marca = leerMarca(issue.body);
  if (!marca) return null;
  return {
    id: String(issue.number),
    idLocal: marca.i,
    ruta: marca.r,
    version: marca.e,
    tipo: marca.t,
    texto: textoDeNota(issue),
    elemento: elementoDeNota(issue),
    selector: marca.s,
    fx: marca.fx,
    fy: marca.fy,
    dx: marca.dx,
    dy: marca.dy,
    remota: true,
    autor: issue.user?.login ?? undefined,
    url: issue.html_url,
    comentarios: issue.comments,
  };
}

/* ---------- Elemento señalado (solo navegador) ---------- */

const ATRIBUTO_UI = "data-anotaciones-ui";

export function esInterfazDeAnotaciones(el: Element | null): boolean {
  return !!el?.closest(`[${ATRIBUTO_UI}]`);
}

export { ATRIBUTO_UI };

/** Selector único del elemento, desde <body> (`body > main:nth-of-type(1) > ...`). null si no se puede fijar. */
export function selectorDe(el: Element): string | null {
  const partes: string[] = [];
  let actual: Element | null = el;
  while (actual && actual !== document.body) {
    const padre: Element | null = actual.parentElement;
    if (!padre) return null;
    const etiqueta = actual.tagName.toLowerCase();
    const actualFijo = actual;
    const indice = Array.from(padre.children).filter((c) => c.tagName === actualFijo.tagName).indexOf(actual) + 1;
    partes.unshift(`${etiqueta}:nth-of-type(${indice})`);
    actual = padre;
  }
  if (!actual) return null;
  const selector = `body > ${partes.join(" > ")}`;
  try {
    return document.querySelector(selector) === el ? selector : null;
  } catch {
    return null;
  }
}

const NOMBRE_ETIQUETA: Record<string, string> = {
  button: "botón",
  a: "enlace",
  input: "campo",
  select: "lista",
  textarea: "campo de texto",
  label: "etiqueta",
  h1: "título",
  h2: "título",
  h3: "subtítulo",
  p: "texto",
  img: "imagen",
  li: "ítem",
};

/** Descripción corta y legible del elemento para quien lea la nota («botón «Siguiente»»). */
export function describirElemento(el: Element): string {
  const tipo = NOMBRE_ETIQUETA[el.tagName.toLowerCase()] ?? "zona";
  const nombre =
    el.getAttribute("aria-label") ??
    el.getAttribute("placeholder") ??
    el.getAttribute("alt") ??
    (el.textContent ?? "").trim().replace(/\s+/g, " ");
  const corto = nombre.length > 50 ? `${nombre.slice(0, 47)}…` : nombre;
  return corto ? `${tipo} «${corto}»` : tipo;
}
