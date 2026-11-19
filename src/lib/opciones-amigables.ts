import { useSyncExternalStore } from "react";

/**
 * Tres estilos opcionales («A», «B» y «C») que hacen lo mismo que el recorrido original pero con más ayuda
 * y menos información a la vez, pensados para quien no sabe de economía ni de tecnología.
 *
 * Por defecto NO hay ningún estilo activo: el recorrido se ve y funciona igual que siempre.
 * Se activan con `?estilo=a|b|c` (queda guardado en este navegador) y se desactivan con `?estilo=original`.
 */
export type Estilo = "a" | "b" | "c";
export type ValorEstilo = Estilo | "original" | "ninguno";

export const CLAVE_ESTILO = "preciar-estilo";
export const CLAVE_BIENVENIDA = "preciar-bienvenida-vista";

export const ESTILOS: { id: Estilo; nombre: string; para: string; descripcion: string }[] = [
  {
    id: "a",
    nombre: "A · Paso a paso",
    para: "Quien no se lleva bien con la tecnología",
    descripcion: "Letra y botones grandes, una guía que te va hablando y explica las palabras difíciles. Casi sin números a la vista.",
  },
  {
    id: "b",
    nombre: "B · Emprendedor",
    para: "Cliente promedio con un emprendimiento",
    descripcion: "Bienvenida con carrusel, botón «¿Te ayudo?» con palabras en tarjetas y avisos de avance.",
  },
  {
    id: "c",
    nombre: "C · Con datos",
    para: "Cliente exigente que quiere números",
    descripcion: "Barra de indicadores siempre visible y sugerencias para mejorar el precio, con un toque para aplicarlas.",
  },
];

export function analizarEstilo(valor: string | null | undefined): ValorEstilo | null {
  const v = valor?.toLowerCase();
  return v === "a" || v === "b" || v === "c" || v === "original" ? v : null;
}

/* ---------- Guardado del estilo elegido (se lee sin romper el render del servidor) ---------- */

const escuchas = new Set<() => void>();
const avisar = () => escuchas.forEach((f) => f());

function leerEstilo(): ValorEstilo {
  if (typeof window === "undefined") return "ninguno";
  const desdeUrl = analizarEstilo(new URLSearchParams(window.location.search).get("estilo"));
  if (desdeUrl) return desdeUrl;
  try {
    return analizarEstilo(window.localStorage.getItem(CLAVE_ESTILO)) ?? "ninguno";
  } catch {
    return "ninguno";
  }
}

function suscribir(f: () => void) {
  escuchas.add(f);
  window.addEventListener("storage", f);
  return () => {
    escuchas.delete(f);
    window.removeEventListener("storage", f);
  };
}

/** Estilo activo. En el servidor y en el primer render devuelve «ninguno» (no se muestra nada). */
export function useEstilo(): ValorEstilo {
  return useSyncExternalStore(suscribir, leerEstilo, () => "ninguno" as ValorEstilo);
}

/* ---------- Otros datos del navegador: bienvenida vista y modo «opciones» (selector visible) ---------- */

export function useBienvenidaVista(): boolean {
  return useSyncExternalStore(
    suscribir,
    () => {
      try {
        return window.localStorage.getItem(CLAVE_BIENVENIDA) === "1";
      } catch {
        return true;
      }
    },
    () => true,
  );
}

export function marcarBienvenidaVista() {
  try {
    window.localStorage.setItem(CLAVE_BIENVENIDA, "1");
  } catch {
    /* sin almacenamiento: no se vuelve a mostrar en esta pantalla */
  }
  avisar();
}

/** `?opciones` en la dirección muestra el selector para comparar los estilos. */
export function useModoOpciones(): boolean {
  return useSyncExternalStore(
    suscribir,
    () => new URLSearchParams(window.location.search).has("opciones"),
    () => false,
  );
}

/** Guarda el estilo elegido en este navegador y avisa a quien lo esté mostrando. */
export function guardarEstilo(valor: ValorEstilo) {
  try {
    if (valor === "ninguno") window.localStorage.removeItem(CLAVE_ESTILO);
    else window.localStorage.setItem(CLAVE_ESTILO, valor);
  } catch {
    /* sin almacenamiento: el estilo vale solo para esta pantalla */
  }
  // Si el estilo vino en la dirección, se quita para que mande lo que se eligió acá.
  const url = new URL(window.location.href);
  if (url.searchParams.has("estilo")) {
    url.searchParams.delete("estilo");
    window.history.replaceState(null, "", url);
  }
  avisar();
}

/* ---------- Texto de ayuda por paso (lenguaje simple, sin números ni fórmulas) ---------- */

export interface PalabraSimple {
  palabra: string;
  significa: string;
}

export interface GuiaPaso {
  ruta: string;
  numero: number;
  titulo: string;
  queHacer: string;
  ejemplo: string;
  animo: string;
  palabras: PalabraSimple[];
}

export const TOTAL_PASOS = 5;

export const GUIA: GuiaPaso[] = [
  {
    ruta: "/calculadora/producto",
    numero: 1,
    titulo: "Tu producto",
    queHacer: "Contanos qué vendés y cómo lo conseguís: lo hacés vos o lo comprás hecho.",
    ejemplo: "Velas de soja que hacés vos, o termos que comprás y revendés.",
    animo: "¡Empecemos! Son solo 5 pasos y podés volver atrás cuando quieras.",
    palabras: [
      { palabra: "Lote", significa: "Una tanda de producción: lo que hacés de una sola vez. Por ejemplo, 20 velas." },
      { palabra: "Reventa", significa: "Comprás el producto ya hecho y lo vendés a un precio mayor." },
    ],
  },
  {
    ruta: "/calculadora/costos",
    numero: 2,
    titulo: "Costos",
    queHacer: "Anotá lo que gastás para poder vender. No hace falta que sea exacto: lo podés ajustar después.",
    ejemplo: "Alquiler del local por mes, o la cera que usás en cada vela.",
    animo: "¡Muy bien! Cada gasto que sumás hace que tu precio sea más real.",
    palabras: [
      { palabra: "Costo fijo", significa: "Lo que pagás todos los meses, vendas o no vendas. Por ejemplo, el alquiler o internet." },
      { palabra: "Costo variable", significa: "Lo que gastás por cada cosa que vendés. Por ejemplo, los materiales o la bolsita." },
      { palabra: "Tu trabajo", significa: "Tu tiempo también cuesta: poné cuánto querés ganar por cada hora que trabajás." },
    ],
  },
  {
    ruta: "/calculadora/resumen",
    numero: 3,
    titulo: "Resumen",
    queHacer: "Mirá cuánto te cuesta tener cada unidad lista. Si algo no te cierra, volvé a Costos.",
    ejemplo: "Si cada vela te cuesta $1.200, vender por menos de eso te hace perder plata.",
    animo: "Ya tenés tus costos claros. ¡Esa es la parte más difícil!",
    palabras: [
      { palabra: "Costo por unidad", significa: "Todo lo que te cuesta tener una unidad lista para vender." },
      { palabra: "Costos del mes", significa: "Lo que gastás en un mes entre lo que pagás siempre y lo que gastás al producir." },
    ],
  },
  {
    ruta: "/calculadora/precio",
    numero: 4,
    titulo: "Precio",
    queHacer: "Elegí cuánto querés ganar y te sugerimos un precio, o probá con el tuyo.",
    ejemplo: "Si querés que te quede el 40% de cada venta, mirá qué precio te da.",
    animo: "¡Casi listo! Ahora elegís tu precio con datos, no a ojo.",
    palabras: [
      { palabra: "Margen", significa: "El porcentaje del precio que te queda como ganancia." },
      { palabra: "Punto de equilibrio", significa: "Cuántas ventas necesitás para no perder plata." },
      { palabra: "Ganancia", significa: "Lo que te queda después de pagar todos los costos." },
    ],
  },
  {
    ruta: "/calculadora/simulador",
    numero: 5,
    titulo: "Simulador",
    queHacer: "Probá cambios y mirá cómo cambia tu ganancia. Es para animarte a explorar.",
    ejemplo: "¿Y si vendés 10 más por mes? ¿Y si subís el precio un 5%?",
    animo: "¡Llegaste al final! Probá lo que quieras y guardá tu resumen.",
    palabras: [
      { palabra: "Escenario", significa: "Una prueba de «¿qué pasa si…?» con otros números." },
      { palabra: "Resumen", significa: "La hoja final con tu precio, tus costos y tu ganancia, lista para guardar." },
    ],
  },
];

export function guiaDe(ruta: string | null): GuiaPaso | null {
  return GUIA.find((g) => ruta === g.ruta || ruta?.startsWith(`${g.ruta}/`)) ?? null;
}

/** Tres tarjetas de bienvenida (estilo B). */
export const BIENVENIDA: { icono: string; titulo: string; texto: string }[] = [
  { icono: "👋", titulo: "Vamos a ponerle precio a lo que vendés", texto: "Sin fórmulas ni palabras raras. Te vamos preguntando de a una cosa." },
  { icono: "📝", titulo: "Anotás lo que gastás", texto: "Materiales, alquiler, tu tiempo. No hace falta que sea exacto: después lo ajustás." },
  { icono: "💡", titulo: "Te mostramos tu precio", texto: "Ves cuánto ganás y qué pasa si cambiás algo, y te guardás el resumen." },
];

/* ---------- Glosario para el cursor (versiones A y B) ---------- */

/** Palabras difíciles con su explicación en simple. Salen de la guía y se suman algunas que aparecen en las pantallas. */
export const GLOSARIO: PalabraSimple[] = [
  ...GUIA.flatMap((g) => g.palabras),
  { palabra: "Costo unitario", significa: "Todo lo que te cuesta tener una unidad lista para vender." },
  { palabra: "Gastos fijos", significa: "Lo que pagás todos los meses, vendas o no vendas. Por ejemplo, el alquiler o internet." },
  { palabra: "Variables", significa: "Lo que gastás por cada cosa que vendés. Por ejemplo, los materiales o la bolsita." },
  { palabra: "Tu tiempo", significa: "Tu tiempo también cuesta: poné cuánto querés ganar por cada hora que trabajás." },
  { palabra: "Indirectos", significa: "Gastos que sirven para todo tu negocio y no a un producto en particular, como la luz o el contador." },
  { palabra: "Volumen", significa: "Cuántas unidades hacés o vendés en un mes." },
  { palabra: "Desglose", significa: "El detalle de a qué se va cada parte del costo." },
];
