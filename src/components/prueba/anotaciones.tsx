"use client";

import { usePathname } from "next/navigation";
import { useCallback, useEffect, useReducer, useRef, useState, useSyncExternalStore } from "react";

import { useEstilo } from "@/lib/opciones-amigables";
import {
  ATRIBUTO_UI,
  NOMBRE_VERSION,
  TIPOS,
  claveVersion,
  desdeIssue,
  describirElemento,
  esInterfazDeAnotaciones,
  selectorDe,
  urlListaIssues,
  urlNotaGeneral,
  urlNuevoIssue,
  type Anotacion,
  type IssueGitHub,
  type TipoNota,
} from "@/lib/anotaciones";

/* ---------- Borradores guardados en este navegador ---------- */

const CLAVE_LOCALES = "preciar-anotaciones-locales";
const CLAVE_CACHE = "preciar-anotaciones-equipo";
const VIGENCIA_CACHE_MS = 60_000;

const escuchas = new Set<() => void>();
let copiaLocales = "[]";

function leerLocalesCrudo(): string {
  if (typeof window === "undefined") return "[]";
  try {
    return window.localStorage.getItem(CLAVE_LOCALES) ?? "[]";
  } catch {
    return copiaLocales;
  }
}

function guardarLocales(lista: Anotacion[]) {
  copiaLocales = JSON.stringify(lista);
  try {
    window.localStorage.setItem(CLAVE_LOCALES, copiaLocales);
  } catch {
    /* sin almacenamiento: los borradores viven solo mientras la pestaña siga abierta */
  }
  escuchas.forEach((f) => f());
}

function suscribirLocales(f: () => void) {
  escuchas.add(f);
  window.addEventListener("storage", f);
  return () => {
    escuchas.delete(f);
    window.removeEventListener("storage", f);
  };
}

function useLocalesCrudo(): string {
  return useSyncExternalStore(suscribirLocales, leerLocalesCrudo, () => "[]");
}

function parsearLocales(crudo: string): Anotacion[] {
  try {
    const lista = JSON.parse(crudo) as Anotacion[];
    return Array.isArray(lista) ? lista : [];
  } catch {
    return [];
  }
}

const sinSuscripcion = () => () => {};
const useMontado = () => useSyncExternalStore(sinSuscripcion, () => true, () => false);

/* ---------- Utilidades ---------- */

const COLOR_PIN: Record<TipoNota, string> = {
  confusion: "bg-warning-500 text-primary-900",
  error: "bg-danger-600 text-white",
  idea: "bg-primary-600 text-white",
};

function descripcionDispositivo(): string {
  return `pantalla de ${window.innerWidth}×${window.innerHeight} px${"ontouchstart" in window ? " (táctil)" : ""}`;
}

function nuevoId(): string {
  return `l${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

type Punto = { x: number; y: number };

/** Dónde dibujar el pin (en pantalla). null si el elemento ya no está o queda fuera de la vista. */
function posicionDe(a: Anotacion): Punto | null {
  let x: number;
  let y: number;
  const el = a.selector ? document.querySelector(a.selector) : null;
  if (el) {
    const r = el.getBoundingClientRect();
    x = r.left + a.fx * r.width;
    y = r.top + a.fy * r.height;
  } else {
    x = a.dx * document.documentElement.scrollWidth - window.scrollX;
    y = a.dy - window.scrollY;
  }
  if (x < 0 || y < 0 || x > window.innerWidth || y > window.innerHeight) return null;
  return { x, y };
}

const botonBase =
  "inline-flex min-h-11 items-center gap-2 rounded-full px-4 text-sm font-semibold shadow-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-700";

/**
 * Solo en la app de prueba (NEXT_PUBLIC_MODO_PRUEBA=1). Permite anotar sobre la pantalla como en Figma:
 * se toca un punto, se escribe la nota y se publica como Issue del repositorio. Las notas del equipo
 * aparecen como pines numerados sobre la misma pantalla y versión (A, B, C u original).
 */
export function Anotaciones() {
  const montado = useMontado();
  const ruta = usePathname();
  const estilo = useEstilo();
  const version = claveVersion(estilo);

  const locales = parsearLocales(useLocalesCrudo());
  const [remotas, setRemotas] = useState<Anotacion[]>([]);
  const [errorLectura, setErrorLectura] = useState(false);
  const [anotando, setAnotando] = useState(false);
  const [verPines, setVerPines] = useState(true);
  const [borrador, setBorrador] = useState<Omit<Anotacion, "id" | "idLocal" | "texto" | "tipo" | "remota"> | null>(null);
  const [texto, setTexto] = useState("");
  const [tipo, setTipo] = useState<TipoNota>("confusion");
  const [abierta, setAbierta] = useState<string | null>(null);
  const [resaltado, setResaltado] = useState<DOMRect | null>(null);
  const [, redibujar] = useReducer((n: number) => n + 1, 0);
  const capa = useRef<HTMLDivElement>(null);
  const cuadro = useRef<number | null>(null);

  /* Notas del equipo: Issues abiertos con la etiqueta (con una pequeña caché para no pasar el límite de GitHub). */
  const cargarRemotas = useCallback(async (forzar: boolean) => {
    try {
      if (!forzar) {
        const guardado = window.sessionStorage.getItem(CLAVE_CACHE);
        if (guardado) {
          const { t, lista } = JSON.parse(guardado) as { t: number; lista: Anotacion[] };
          if (Date.now() - t < VIGENCIA_CACHE_MS) {
            setRemotas(lista);
            return;
          }
        }
      }
    } catch {
      /* sin caché: se consulta igual */
    }
    try {
      const resp = await fetch(urlListaIssues(), { headers: { Accept: "application/vnd.github+json" } });
      if (!resp.ok) throw new Error(String(resp.status));
      const issues = (await resp.json()) as IssueGitHub[];
      const lista = issues.map(desdeIssue).filter((a): a is Anotacion => a !== null);
      setRemotas(lista);
      setErrorLectura(false);
      try {
        window.sessionStorage.setItem(CLAVE_CACHE, JSON.stringify({ t: Date.now(), lista }));
      } catch {
        /* sin caché */
      }
    } catch {
      setErrorLectura(true);
    }
  }, []);

  useEffect(() => {
    if (!montado) return;
    // La lectura es asíncrona: el estado se actualiza recién cuando responde la red.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void cargarRemotas(false);
  }, [montado, cargarRemotas]);

  /* Los pines siguen a sus elementos al scrollear, cambiar el tamaño o cambiar el contenido. */
  useEffect(() => {
    if (!montado) return;
    const pedir = () => {
      if (cuadro.current !== null) return;
      cuadro.current = window.requestAnimationFrame(() => {
        cuadro.current = null;
        redibujar();
      });
    };
    window.addEventListener("scroll", pedir, true);
    window.addEventListener("resize", pedir);
    const obs = new MutationObserver(pedir);
    obs.observe(document.body, { childList: true, subtree: true });
    return () => {
      window.removeEventListener("scroll", pedir, true);
      window.removeEventListener("resize", pedir);
      obs.disconnect();
      if (cuadro.current !== null) window.cancelAnimationFrame(cuadro.current);
    };
  }, [montado]);

  const salir = useCallback(() => {
    setAnotando(false);
    setBorrador(null);
    setResaltado(null);
    setAbierta(null);
  }, [setAnotando, setBorrador, setResaltado, setAbierta]);

  useEffect(() => {
    if (!anotando && !borrador && !abierta) return;
    const alTeclear = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (borrador) setBorrador(null);
      else if (abierta) setAbierta(null);
      else salir();
    };
    window.addEventListener("keydown", alTeclear);
    return () => window.removeEventListener("keydown", alTeclear);
  }, [anotando, borrador, abierta, salir]);

  if (!montado) return null;

  const idsPublicados = new Set(remotas.map((r) => r.idLocal));
  const borradores = locales.filter((l) => !idsPublicados.has(l.idLocal));
  const visibles = [...remotas, ...borradores].filter((a) => a.ruta === ruta && a.version === version);
  const pines = verPines && !anotando ? visibles : [];
  const seleccionada = abierta ? (visibles.find((a) => a.id === abierta) ?? null) : null;

  /* ---------- Modo anotar ---------- */

  function elementoBajo(x: number, y: number): Element | null {
    const c = capa.current;
    if (!c) return null;
    c.style.pointerEvents = "none";
    const el = document.elementFromPoint(x, y);
    c.style.pointerEvents = "";
    return el && !esInterfazDeAnotaciones(el) ? el : null;
  }

  function alMover(e: React.PointerEvent) {
    const el = elementoBajo(e.clientX, e.clientY);
    setResaltado(el ? el.getBoundingClientRect() : null);
  }

  function alTocar(e: React.MouseEvent) {
    const el = elementoBajo(e.clientX, e.clientY) ?? document.body;
    const r = el.getBoundingClientRect();
    const fx = r.width > 0 ? Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)) : 0;
    const fy = r.height > 0 ? Math.min(1, Math.max(0, (e.clientY - r.top) / r.height)) : 0;
    setBorrador({
      ruta,
      version,
      elemento: describirElemento(el),
      selector: el === document.body ? null : selectorDe(el),
      fx: Math.round(fx * 1000) / 1000,
      fy: Math.round(fy * 1000) / 1000,
      dx: Math.round((window.scrollX + e.clientX) / document.documentElement.scrollWidth * 1000) / 1000,
      dy: Math.round(window.scrollY + e.clientY),
    });
    setTexto("");
    setTipo("confusion");
    setResaltado(null);
  }

  function armar(id: string): Anotacion | null {
    if (!borrador) return null;
    return { ...borrador, id, idLocal: id, texto: texto.trim(), tipo, remota: false };
  }

  function guardarBorrador() {
    const nota = armar(nuevoId());
    if (!nota || !nota.texto) return;
    guardarLocales([...locales, nota]);
    setBorrador(null);
    setAnotando(false);
    setAbierta(nota.id);
  }

  function publicar(nota: Anotacion) {
    window.open(urlNuevoIssue(nota, descripcionDispositivo()), "_blank", "noopener,noreferrer");
    // Se vuelve a leer en unos segundos para que el pin pase a ser una nota del equipo.
    window.setTimeout(() => void cargarRemotas(true), 20_000);
  }

  function publicarBorrador() {
    const nota = armar(nuevoId());
    if (!nota || !nota.texto) return;
    guardarLocales([...locales, nota]);
    publicar(nota);
    setBorrador(null);
    setAnotando(false);
    setAbierta(nota.id);
  }

  function borrar(id: string) {
    guardarLocales(locales.filter((l) => l.id !== id));
    setAbierta(null);
  }

  const posBorrador = borrador ? posicionDe({ ...(borrador as Anotacion) }) : null;

  return (
    <div {...{ [ATRIBUTO_UI]: "" }} className="print:hidden">
      {/* Barra de herramientas */}
      <div className="fixed bottom-24 left-3 z-[80] flex flex-col items-start gap-2" {...{ [ATRIBUTO_UI]: "" }}>
        <button
          type="button"
          aria-pressed={anotando}
          onClick={() => (anotando ? salir() : (setAnotando(true), setAbierta(null)))}
          className={`${botonBase} ${anotando ? "bg-warning-500 text-primary-900" : "bg-primary-900 text-white hover:bg-primary-700"}`}
        >
          <span aria-hidden="true">✎</span>
          {anotando ? "Salir de anotar" : "Anotar"}
        </button>
        <button
          type="button"
          aria-pressed={verPines}
          onClick={() => setVerPines((v) => !v)}
          className={`${botonBase} border border-gray-300 bg-white text-primary-900 hover:bg-gray-100`}
        >
          {verPines ? "Ocultar notas" : "Ver notas"} ({visibles.length})
        </button>
        <a
          href={urlNotaGeneral(ruta, version, descripcionDispositivo())}
          target="_blank"
          rel="noopener noreferrer"
          className={`${botonBase} border border-gray-300 bg-white text-primary-900 hover:bg-gray-100`}
        >
          Nota general
          <span className="sr-only"> (se abre en una pestaña nueva)</span>
        </a>
        {errorLectura ? (
          <button
            type="button"
            onClick={() => void cargarRemotas(true)}
            className="rounded-lg bg-danger-50 px-3 py-2 text-left text-xs text-danger-700 shadow focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-700"
          >
            No pude leer las notas del equipo. Tocá para reintentar.
          </button>
        ) : null}
      </div>

      {/* Aviso mientras se anota */}
      {anotando && !borrador ? (
        <div
          role="status"
          className="pointer-events-none fixed inset-x-0 top-10 z-[80] mx-auto w-fit max-w-[92vw] rounded-full bg-warning-500 px-4 py-2 text-center text-sm font-semibold text-primary-900 shadow-lg"
        >
          Tocá donde quieras dejar una nota · Esc para salir
        </div>
      ) : null}

      {/* Capa que recibe el toque */}
      {anotando && !borrador ? (
        <div ref={capa} onPointerMove={alMover} onClick={alTocar} className="fixed inset-0 z-[70] cursor-crosshair" aria-hidden="true" />
      ) : null}
      {anotando && resaltado ? (
        <div
          aria-hidden="true"
          className="pointer-events-none fixed z-[71] rounded border-2 border-warning-500 bg-warning-500/10"
          style={{ left: resaltado.left, top: resaltado.top, width: resaltado.width, height: resaltado.height }}
        />
      ) : null}

      {/* Pines */}
      <div className="pointer-events-none fixed inset-0 z-[75]" {...{ [ATRIBUTO_UI]: "" }}>
        {pines.map((a, i) => {
          const p = posicionDe(a);
          if (!p) return null;
          return (
            <button
              key={a.id}
              type="button"
              onClick={() => setAbierta(abierta === a.id ? null : a.id)}
              aria-label={`Nota ${i + 1}: ${a.texto}`}
              aria-expanded={abierta === a.id}
              style={{ left: p.x, top: p.y }}
              className={`pointer-events-auto absolute flex h-8 w-8 -translate-x-1/2 -translate-y-full items-center justify-center rounded-full rounded-bl-none border-2 border-white text-xs font-bold shadow-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-700 ${COLOR_PIN[a.tipo]} ${a.remota ? "" : "opacity-80 [border-style:dashed]"}`}
            >
              {i + 1}
            </button>
          );
        })}
        {borrador && posBorrador ? (
          <span
            aria-hidden="true"
            style={{ left: posBorrador.x, top: posBorrador.y }}
            className="absolute flex h-8 w-8 -translate-x-1/2 -translate-y-full items-center justify-center rounded-full rounded-bl-none border-2 border-white bg-primary-900 text-xs font-bold text-white shadow-lg"
          >
            +
          </span>
        ) : null}
      </div>

      {/* Formulario de la nota nueva */}
      {borrador ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            publicarBorrador();
          }}
          aria-label="Nueva nota"
          className="fixed inset-x-3 bottom-3 z-[85] mx-auto max-w-md rounded-2xl border border-gray-300 bg-white p-4 shadow-2xl sm:inset-x-auto sm:right-4 sm:mx-0 sm:w-96"
        >
          <p className="text-sm font-semibold text-primary-900">Nueva nota · {NOMBRE_VERSION[version]}</p>
          <p className="mt-1 text-xs text-gray-700">
            Sobre: {borrador.elemento} · {ruta}
          </p>
          <fieldset className="mt-3">
            <legend className="sr-only">Tipo de nota</legend>
            <div className="flex flex-wrap gap-2">
              {TIPOS.map((t) => (
                <label
                  key={t.id}
                  className={`inline-flex min-h-11 cursor-pointer items-center rounded-full border px-3 text-sm has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-primary-700 ${tipo === t.id ? "border-primary-900 bg-primary-900 text-white" : "border-gray-300 bg-white text-primary-900"}`}
                >
                  <input type="radio" name="tipo-nota" value={t.id} checked={tipo === t.id} onChange={() => setTipo(t.id)} className="sr-only" />
                  {t.etiqueta}
                </label>
              ))}
            </div>
          </fieldset>
          <label className="mt-3 block text-sm font-medium text-primary-900" htmlFor="texto-nota">
            ¿Qué te costó entender o qué cambiarías?
          </label>
          <textarea
            id="texto-nota"
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            maxLength={500}
            rows={3}
            autoFocus
            className="mt-1 w-full rounded-lg border border-gray-300 p-2 text-sm text-gray-900"
          />
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="submit"
              disabled={!texto.trim()}
              className="inline-flex min-h-11 items-center rounded-full bg-primary-900 px-4 text-sm font-semibold text-white hover:bg-primary-700 disabled:cursor-not-allowed disabled:bg-gray-400 disabled:text-gray-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-700"
            >
              Publicar en GitHub
            </button>
            <button
              type="button"
              disabled={!texto.trim()}
              onClick={guardarBorrador}
              className="inline-flex min-h-11 items-center rounded-full border border-gray-300 bg-white px-4 text-sm font-semibold text-primary-900 hover:bg-gray-100 disabled:cursor-not-allowed disabled:text-gray-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-700"
            >
              Guardar borrador
            </button>
            <button
              type="button"
              onClick={() => setBorrador(null)}
              className="inline-flex min-h-11 items-center rounded-full px-3 text-sm font-semibold text-primary-900 underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-700"
            >
              Cancelar
            </button>
          </div>
          <p className="mt-2 text-xs text-gray-700">Se abre GitHub con la nota ya escrita; ahí tocás «Submit new issue». Hace falta tener cuenta de GitHub.</p>
        </form>
      ) : null}

      {/* Detalle de una nota */}
      {seleccionada && !borrador ? (
        <section
          aria-label="Detalle de la nota"
          className="fixed inset-x-3 bottom-3 z-[85] mx-auto max-w-md rounded-2xl border border-gray-300 bg-white p-4 shadow-2xl sm:inset-x-auto sm:right-4 sm:mx-0 sm:w-96"
        >
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-700">
            {TIPOS.find((t) => t.id === seleccionada.tipo)?.etiqueta} · {NOMBRE_VERSION[seleccionada.version]}
          </p>
          <p className="mt-2 whitespace-pre-wrap text-sm text-gray-900">{seleccionada.texto}</p>
          <p className="mt-2 text-xs text-gray-700">
            Sobre: {seleccionada.elemento}
            {seleccionada.autor ? ` · de ${seleccionada.autor}` : ""}
            {seleccionada.remota ? ` · ${seleccionada.comentarios ?? 0} respuestas` : " · borrador, solo en este navegador"}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {seleccionada.remota && seleccionada.url ? (
              <a
                href={seleccionada.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-11 items-center rounded-full bg-primary-900 px-4 text-sm font-semibold text-white hover:bg-primary-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-700"
              >
                Responder en GitHub
                <span className="sr-only"> (se abre en una pestaña nueva)</span>
              </a>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => publicar(seleccionada)}
                  className="inline-flex min-h-11 items-center rounded-full bg-primary-900 px-4 text-sm font-semibold text-white hover:bg-primary-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-700"
                >
                  Publicar en GitHub
                </button>
                <button
                  type="button"
                  onClick={() => borrar(seleccionada.id)}
                  className="inline-flex min-h-11 items-center rounded-full border border-gray-300 bg-white px-4 text-sm font-semibold text-danger-700 hover:bg-danger-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-700"
                >
                  Borrar
                </button>
              </>
            )}
            <button
              type="button"
              onClick={() => setAbierta(null)}
              className="inline-flex min-h-11 items-center rounded-full px-3 text-sm font-semibold text-primary-900 underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-700"
            >
              Cerrar
            </button>
          </div>
        </section>
      ) : null}
    </div>
  );
}
