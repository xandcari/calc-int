/**
 * Anotaciones de usabilidad sobre la pantalla (solo en la app de prueba, NEXT_PUBLIC_MODO_PRUEBA=1).
 *
 * Cada nota guarda dónde se hizo (pantalla, versión A/B/C/original, elemento y posición) y quién la escribió.
 * Se guardan en la base de la prueba (ver `server/prueba`) y todo el equipo las ve como pines sobre la pantalla.
 */

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

/** Una nota tal como la devuelve la API. */
export type Anotacion = {
  id: string;
  creadaEn: string;
  nombre: string;
  ruta: string;
  version: string;
  tipo: TipoNota;
  texto: string;
  /** Descripción legible del elemento señalado («botón «Siguiente»»). */
  elemento: string;
  /** Selector del elemento (relativo a <body>) o null si no se pudo fijar a uno. */
  selector: string | null;
  /** Nota de toda la pantalla, sin punto señalado: no se dibuja como pin. */
  general: boolean;
  /** Posición dentro del elemento (0 a 1). */
  fx: number;
  fy: number;
  /** Posición de respaldo en la página: fracción del ancho y píxeles desde arriba. */
  dx: number;
  dy: number;
  dispositivo: string;
  resuelta: boolean;
  /** true si la escribió este mismo navegador (puede borrarla). */
  mia: boolean;
};

/** Lo que se envía para crear una nota. */
export type NuevaAnotacion = Omit<Anotacion, "id" | "creadaEn" | "resuelta" | "mia">;

export function claveVersion(estilo: string): string {
  return estilo === "a" || estilo === "b" || estilo === "c" ? estilo : "original";
}

export const etiquetaTipo = (id: string) => TIPOS.find((t) => t.id === id)?.etiqueta ?? id;

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
