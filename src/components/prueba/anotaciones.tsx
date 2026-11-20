"use client";

import { usePathname } from "next/navigation";
import { useCallback, useEffect, useReducer, useRef, useState, useSyncExternalStore } from "react";

import {
  ATRIBUTO_UI,
  NOMBRE_VERSION,
  TIPOS,
  claveVersion,
  describirElemento,
  esInterfazDeAnotaciones,
  etiquetaTipo,
  selectorDe,
  type Anotacion,
  type NuevaAnotacion,
  type TipoNota,
} from "@/lib/anotaciones";
import { guardarNombre, obtenerToken, useNombre } from "@/lib/identidad-prueba";
import { useEstilo } from "@/lib/opciones-amigables";

const API = "/api/prueba/observaciones";
/** Cada tanto se vuelven a leer las notas para ver las que escribieron los demás. */
const REFRESCO_MS = 30_000;

const sinSuscripcion = () => () => {};
const useMontado = () => useSyncExternalStore(sinSuscripcion, () => true, () => false);

const COLOR_PIN: Record<TipoNota, string> = {
  confusion: "bg-warning-500 text-primary-900",
  error: "bg-danger-600 text-white",
  idea: "bg-primary-600 text-white",
};

function descripcionDispositivo(): string {
  return `pantalla de ${window.innerWidth}×${window.innerHeight} px${"ontouchstart" in window ? " (táctil)" : ""}`;
}

type Punto = { x: number; y: number };

/** Dónde dibujar el pin (en pantalla). null si el elemento ya no está o queda fuera de la vista. */
function posicionDe(a: Pick<Anotacion, "selector" | "fx" | "fy" | "dx" | "dy">): Punto | null {
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

type Borrador = Omit<NuevaAnotacion, "nombre" | "texto" | "tipo" | "dispositivo">;
type Accion = "anotar" | "general" | "cambiar";

async function llamar<T>(url: string, init?: RequestInit): Promise<{ ok: true; datos: T } | { ok: false; mensaje: string }> {
  try {
    const resp = await fetch(url, {
      ...init,
      headers: { "x-token-autor": obtenerToken(), ...(init?.body ? { "Content-Type": "application/json" } : {}), ...init?.headers },
    });
    const json = (await resp.json().catch(() => null)) as { error?: { mensaje?: string; detalles?: { mensaje: string }[] } } | null;
    if (!resp.ok) {
      const detalle = json?.error?.detalles?.[0]?.mensaje;
      return { ok: false, mensaje: detalle ?? json?.error?.mensaje ?? "No pudimos conectar. Probá de nuevo." };
    }
    return { ok: true, datos: json as T };
  } catch {
    return { ok: false, mensaje: "No hay conexión. Probá de nuevo en un momento." };
  }
}

const botonBase =
  "inline-flex min-h-11 items-center gap-2 rounded-full px-4 text-sm font-semibold shadow-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-700";
const botonClaro = `${botonBase} border border-gray-300 bg-white text-primary-900 hover:bg-gray-100`;
const botonOscuro = `${botonBase} bg-primary-900 text-white hover:bg-primary-700`;
const botonTexto =
  "inline-flex min-h-11 items-center rounded-full px-3 text-sm font-semibold text-primary-900 underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-700";
const hoja =
  "fixed inset-x-3 bottom-3 z-[85] mx-auto max-w-md rounded-2xl border border-gray-300 bg-white p-4 shadow-2xl sm:inset-x-auto sm:right-4 sm:mx-0 sm:w-96";

/**
 * Solo en la app de prueba (NEXT_PUBLIC_MODO_PRUEBA=1). Permite anotar sobre la pantalla como en Figma:
 * se toca un punto, se escribe la nota y queda guardada en la base de la prueba con el nombre de quien la escribió.
 * Las notas de todo el equipo aparecen como pines numerados sobre la misma pantalla y versión (A, B, C u original).
 */
export function Anotaciones() {
  const montado = useMontado();
  const ruta = usePathname();
  const estilo = useEstilo();
  const version = claveVersion(estilo);
  const nombre = useNombre();

  const [notas, setNotas] = useState<Anotacion[]>([]);
  const [errorLectura, setErrorLectura] = useState<string | null>(null);
  const [anotando, setAnotando] = useState(false);
  const [verPines, setVerPines] = useState(true);
  const [masAbierto, setMasAbierto] = useState(false);
  const [borrador, setBorrador] = useState<Borrador | null>(null);
  const [texto, setTexto] = useState("");
  const [tipo, setTipo] = useState<TipoNota>("confusion");
  const [enviando, setEnviando] = useState(false);
  const [errorEnvio, setErrorEnvio] = useState<string | null>(null);
  const [abierta, setAbierta] = useState<string | null>(null);
  const [pidiendoNombre, setPidiendoNombre] = useState<Accion | null>(null);
  const [nombreEscrito, setNombreEscrito] = useState("");
  const [resaltado, setResaltado] = useState<DOMRect | null>(null);
  const [, redibujar] = useReducer((n: number) => n + 1, 0);
  const capa = useRef<HTMLDivElement>(null);
  const cuadro = useRef<number | null>(null);

  /* Notas de todo el equipo, desde la base. */
  const cargar = useCallback(async () => {
    const r = await llamar<{ observaciones: Anotacion[] }>(API, { cache: "no-store" });
    if (r.ok) {
      setNotas(r.datos.observaciones);
      setErrorLectura(null);
    } else {
      setErrorLectura(r.mensaje);
    }
  }, []);

  useEffect(() => {
    if (!montado) return;
    // La lectura es asíncrona: el estado se actualiza recién cuando responde la red.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void cargar();
    const alVolver = () => {
      if (document.visibilityState === "visible") void cargar();
    };
    const reloj = window.setInterval(alVolver, REFRESCO_MS);
    document.addEventListener("visibilitychange", alVolver);
    return () => {
      window.clearInterval(reloj);
      document.removeEventListener("visibilitychange", alVolver);
    };
  }, [montado, cargar]);

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
    setPidiendoNombre(null);
  }, [setAnotando, setBorrador, setResaltado, setAbierta, setPidiendoNombre]);

  useEffect(() => {
    if (!anotando && !borrador && !abierta && !pidiendoNombre) return;
    const alTeclear = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (pidiendoNombre) setPidiendoNombre(null);
      else if (borrador) setBorrador(null);
      else if (abierta) setAbierta(null);
      else salir();
    };
    window.addEventListener("keydown", alTeclear);
    return () => window.removeEventListener("keydown", alTeclear);
  }, [anotando, borrador, abierta, pidiendoNombre, salir]);

  if (!montado) return null;

  const visibles = notas.filter((n) => !n.general && !n.resuelta && n.ruta === ruta && n.version === version);
  const pines = verPines && !anotando ? visibles : [];
  const seleccionada = abierta ? (notas.find((n) => n.id === abierta) ?? null) : null;

  /* ---------- Nombre ---------- */

  function empezar(accion: Accion) {
    if (accion === "cambiar" || !nombre) {
      setNombreEscrito(nombre);
      setPidiendoNombre(accion);
      return;
    }
    continuar(accion);
  }

  function continuar(accion: Accion) {
    setAbierta(null);
    setErrorEnvio(null);
    if (accion === "anotar") {
      setAnotando(true);
    } else if (accion === "general") {
      setAnotando(false);
      setBorrador({ ruta, version, elemento: "Pantalla completa", selector: null, general: true, fx: 0, fy: 0, dx: 0, dy: 0 });
      setTexto("");
      setTipo("confusion");
    }
  }

  function guardarElNombre() {
    const limpio = nombreEscrito.trim();
    if (!limpio || !pidiendoNombre) return;
    guardarNombre(limpio);
    const accion = pidiendoNombre;
    setPidiendoNombre(null);
    continuar(accion);
  }

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
      general: false,
      fx: Math.round(fx * 1000) / 1000,
      fy: Math.round(fy * 1000) / 1000,
      dx: Math.min(2, Math.round(((window.scrollX + e.clientX) / document.documentElement.scrollWidth) * 1000) / 1000),
      dy: Math.round(window.scrollY + e.clientY),
    });
    setTexto("");
    setTipo("confusion");
    setErrorEnvio(null);
    setResaltado(null);
  }

  /* ---------- Guardar, resolver y borrar ---------- */

  async function enviar() {
    if (!borrador || !texto.trim() || enviando) return;
    setEnviando(true);
    setErrorEnvio(null);
    const cuerpo: NuevaAnotacion = { ...borrador, nombre, texto: texto.trim(), tipo, dispositivo: descripcionDispositivo() };
    const r = await llamar<{ observacion: Anotacion }>(API, { method: "POST", body: JSON.stringify(cuerpo) });
    setEnviando(false);
    if (!r.ok) {
      setErrorEnvio(r.mensaje);
      return;
    }
    setNotas((previas) => [r.datos.observacion, ...previas]);
    setBorrador(null);
    setAnotando(false);
    setAbierta(borrador.general ? null : r.datos.observacion.id);
  }

  async function cambiarResuelta(n: Anotacion, resuelta: boolean) {
    const r = await llamar<{ ok: true }>(`${API}/${n.id}`, { method: "PATCH", body: JSON.stringify({ resuelta }) });
    if (r.ok) {
      setNotas((previas) => previas.map((x) => (x.id === n.id ? { ...x, resuelta } : x)));
      if (resuelta) setAbierta(null);
    } else {
      setErrorLectura(r.mensaje);
    }
  }

  async function borrar(n: Anotacion) {
    const r = await llamar<{ ok: true }>(`${API}/${n.id}`, { method: "DELETE" });
    if (r.ok) {
      setNotas((previas) => previas.filter((x) => x.id !== n.id));
      setAbierta(null);
    } else {
      setErrorLectura(r.mensaje);
    }
  }

  const posBorrador = borrador && !borrador.general ? posicionDe(borrador) : null;
  const numeroDe = (id: string) => pines.findIndex((p) => p.id === id) + 1;

  return (
    <div {...{ [ATRIBUTO_UI]: "" }} className="print:hidden">
      {/* Barra de herramientas */}
      <div className="fixed bottom-24 left-3 z-[80] flex flex-col items-start gap-2" {...{ [ATRIBUTO_UI]: "" }}>
        {masAbierto ? (
          <div className="flex flex-col items-start gap-2">
            <button type="button" onClick={() => empezar("general")} className={botonClaro}>
              Nota general
            </button>
            <a href="/prueba/observaciones" target="_blank" rel="noopener noreferrer" className={botonClaro}>
              Todas las notas
              <span className="sr-only"> (se abre en una pestaña nueva)</span>
            </a>
            <button type="button" onClick={() => empezar("cambiar")} className={botonClaro}>
              {nombre ? `Anotás como ${nombre} · cambiar` : "Escribir mi nombre"}
            </button>
          </div>
        ) : null}
        <button
          type="button"
          aria-pressed={anotando}
          onClick={() => (anotando ? salir() : empezar("anotar"))}
          className={`${botonBase} ${anotando ? "bg-warning-500 text-primary-900" : "bg-primary-900 text-white hover:bg-primary-700"}`}
        >
          <span aria-hidden="true">✎</span>
          {anotando ? "Salir de anotar" : "Anotar"}
        </button>
        <div className="flex items-center gap-2">
          <button type="button" aria-pressed={verPines} onClick={() => setVerPines((v) => !v)} className={botonClaro}>
            {verPines ? "Ocultar notas" : "Ver notas"} ({visibles.length})
          </button>
          <button type="button" aria-expanded={masAbierto} onClick={() => setMasAbierto((m) => !m)} className={botonClaro}>
            Más
          </button>
        </div>
        {errorLectura ? (
          <button
            type="button"
            onClick={() => void cargar()}
            className="max-w-56 rounded-lg bg-danger-50 px-3 py-2 text-left text-xs text-danger-700 shadow focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-700"
          >
            {errorLectura} Tocá para reintentar.
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
        {pines.map((n) => {
          const p = posicionDe(n);
          if (!p) return null;
          return (
            <button
              key={n.id}
              type="button"
              onClick={() => setAbierta(abierta === n.id ? null : n.id)}
              aria-label={`Nota ${numeroDe(n.id)} de ${n.nombre}: ${n.texto}`}
              aria-expanded={abierta === n.id}
              style={{ left: p.x, top: p.y }}
              className={`pointer-events-auto absolute flex h-8 w-8 -translate-x-1/2 -translate-y-full items-center justify-center rounded-full rounded-bl-none border-2 border-white text-xs font-bold shadow-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-700 ${COLOR_PIN[n.tipo]}`}
            >
              {numeroDe(n.id)}
            </button>
          );
        })}
        {posBorrador ? (
          <span
            aria-hidden="true"
            style={{ left: posBorrador.x, top: posBorrador.y }}
            className="absolute flex h-8 w-8 -translate-x-1/2 -translate-y-full items-center justify-center rounded-full rounded-bl-none border-2 border-white bg-primary-900 text-xs font-bold text-white shadow-lg"
          >
            +
          </span>
        ) : null}
      </div>

      {/* Nombre */}
      {pidiendoNombre ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            guardarElNombre();
          }}
          aria-label="Tu nombre"
          className={hoja}
        >
          <label className="block text-sm font-semibold text-primary-900" htmlFor="nombre-prueba">
            ¿Cómo te llamás?
          </label>
          <p className="mt-1 text-xs text-gray-700">Va a figurar en tus notas para que el equipo sepa quién opinó. No hace falta cuenta.</p>
          <input
            id="nombre-prueba"
            value={nombreEscrito}
            onChange={(e) => setNombreEscrito(e.target.value)}
            maxLength={40}
            autoFocus
            autoComplete="given-name"
            className="mt-2 min-h-11 w-full rounded-lg border border-gray-300 px-3 text-sm text-gray-900"
          />
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="submit"
              disabled={!nombreEscrito.trim()}
              className={`${botonOscuro} shadow-none disabled:cursor-not-allowed disabled:bg-gray-400 disabled:text-gray-900`}
            >
              Guardar mi nombre
            </button>
            <button type="button" onClick={() => setPidiendoNombre(null)} className={botonTexto}>
              Cancelar
            </button>
          </div>
        </form>
      ) : null}

      {/* Formulario de la nota nueva */}
      {borrador && !pidiendoNombre ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void enviar();
          }}
          aria-label="Nueva nota"
          className={hoja}
        >
          <p className="text-sm font-semibold text-primary-900">
            {borrador.general ? "Nota general" : "Nueva nota"} · {NOMBRE_VERSION[version]}
          </p>
          <p className="mt-1 text-xs text-gray-700">
            {borrador.general ? "Sobre toda la pantalla" : `Sobre: ${borrador.elemento}`} · {ruta} · de {nombre}
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
          {errorEnvio ? (
            <p role="alert" className="mt-2 rounded-lg bg-danger-50 px-3 py-2 text-xs text-danger-700">
              {errorEnvio}
            </p>
          ) : null}
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="submit"
              disabled={!texto.trim() || enviando}
              className={`${botonOscuro} shadow-none disabled:cursor-not-allowed disabled:bg-gray-400 disabled:text-gray-900`}
            >
              {enviando ? "Guardando…" : "Guardar nota"}
            </button>
            <button type="button" onClick={() => setBorrador(null)} className={botonTexto}>
              Cancelar
            </button>
          </div>
        </form>
      ) : null}

      {/* Detalle de una nota */}
      {seleccionada && !borrador && !pidiendoNombre ? (
        <section aria-label="Detalle de la nota" className={hoja}>
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-700">
            {etiquetaTipo(seleccionada.tipo)} · {NOMBRE_VERSION[seleccionada.version]}
          </p>
          <p className="mt-2 whitespace-pre-wrap text-sm text-gray-900">{seleccionada.texto}</p>
          <p className="mt-2 text-xs text-gray-700">
            Sobre: {seleccionada.elemento} · de {seleccionada.nombre} ·{" "}
            {new Date(seleccionada.creadaEn).toLocaleString("es-AR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" onClick={() => void cambiarResuelta(seleccionada, true)} className={`${botonOscuro} shadow-none`}>
              Marcar resuelta
            </button>
            {seleccionada.mia ? (
              <button
                type="button"
                onClick={() => void borrar(seleccionada)}
                className="inline-flex min-h-11 items-center rounded-full border border-gray-300 bg-white px-4 text-sm font-semibold text-danger-700 hover:bg-danger-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-700"
              >
                Borrar
              </button>
            ) : null}
            <button type="button" onClick={() => setAbierta(null)} className={botonTexto}>
              Cerrar
            </button>
          </div>
        </section>
      ) : null}
    </div>
  );
}
