"use client";

import { useEffect, useRef, useState } from "react";

import { GLOSARIO } from "@/lib/opciones-amigables";

/** Pasa a minúsculas y sin tildes, letra por letra, para que el largo del texto no cambie. */
function normalizar(texto: string): string {
  let salida = "";
  for (const letra of texto) salida += letra.normalize("NFD").charAt(0).toLowerCase();
  return salida;
}

const TERMINOS = [...GLOSARIO]
  .map((p) => ({ ...p, clave: normalizar(p.palabra) }))
  .sort((a, b) => b.clave.length - a.clave.length);

const IGNORAR =
  'script, style, noscript, textarea, input, select, option, dialog, [role="dialog"], [role="tooltip"], [role="status"], .fab-ayuda, aside[aria-label="Guía del paso"], [role="group"][aria-label="Comparar versiones de la calculadora"]';

const esLetra = (c: string | undefined) => c !== undefined && /[a-z0-9]/.test(c);

interface Coincidencia {
  desde: number;
  hasta: number;
  palabra: string;
  significa: string;
}

/** Busca las palabras del glosario dentro de un texto (la más larga primero, sin solaparse). */
function buscar(texto: string): Coincidencia[] {
  const limpio = normalizar(texto);
  const halladas: Coincidencia[] = [];
  for (const t of TERMINOS) {
    let desde = limpio.indexOf(t.clave);
    while (desde !== -1) {
      const hasta = desde + t.clave.length;
      const suelta = !esLetra(limpio[desde - 1]) && !esLetra(limpio[hasta]);
      const libre = halladas.every((h) => hasta <= h.desde || desde >= h.hasta);
      if (suelta && libre) halladas.push({ desde, hasta, palabra: t.palabra, significa: t.significa });
      desde = limpio.indexOf(t.clave, desde + 1);
    }
  }
  return halladas.sort((a, b) => a.desde - b.desde);
}

function textoBajoElCursor(x: number, y: number): { nodo: Text; indice: number } | null {
  const doc = document as Document & {
    caretPositionFromPoint?: (x: number, y: number) => { offsetNode: Node; offset: number } | null;
  };
  if (doc.caretPositionFromPoint) {
    const pos = doc.caretPositionFromPoint(x, y);
    if (pos && pos.offsetNode.nodeType === Node.TEXT_NODE) return { nodo: pos.offsetNode as Text, indice: pos.offset };
    return null;
  }
  const rango = document.caretRangeFromPoint?.(x, y);
  if (rango && rango.startContainer.nodeType === Node.TEXT_NODE) return { nodo: rango.startContainer as Text, indice: rango.startOffset };
  return null;
}

interface Globo {
  palabra: string;
  significa: string;
  x: number;
  y: number;
}

/**
 * Versiones A y B: al pasar el cursor por una palabra difícil de la calculadora aparece qué significa, sin tocar nada.
 * Las palabras se marcan con un subrayado punteado. No modifica el contenido de la página, solo lo lee.
 * En pantallas táctiles (sin cursor) quedan las palabras de la guía, que se tocan.
 */
export function GlosarioHover() {
  const [globo, setGlobo] = useState<Globo | null>(null);
  const caja = useRef<HTMLDivElement>(null);

  // Subraya las palabras del glosario (resaltado del navegador: no toca el DOM de React).
  useEffect(() => {
    const api = (window as unknown as { Highlight?: new (...rangos: Range[]) => unknown }).Highlight;
    const registro = (CSS as unknown as { highlights?: Map<string, unknown> }).highlights;
    if (!api || !registro) return;

    let temporizador: number | undefined;
    const marcar = () => {
      const rangos: Range[] = [];
      const recorrido = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
        acceptNode: (n) => (n.parentElement?.closest(IGNORAR) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT),
      });
      for (let n = recorrido.nextNode(); n; n = recorrido.nextNode()) {
        const texto = n.nodeValue ?? "";
        if (texto.trim().length < 3) continue;
        for (const c of buscar(texto)) {
          const r = new Range();
          r.setStart(n, c.desde);
          r.setEnd(n, c.hasta);
          rangos.push(r);
        }
      }
      registro.set("glosario", new api(...rangos));
    };
    const programar = () => {
      window.clearTimeout(temporizador);
      temporizador = window.setTimeout(marcar, 250);
    };

    programar();
    const observador = new MutationObserver((cambios) => {
      if (cambios.every((c) => caja.current?.contains(c.target))) return;
      programar();
    });
    observador.observe(document.body, { childList: true, characterData: true, subtree: true });
    return () => {
      window.clearTimeout(temporizador);
      observador.disconnect();
      registro.delete("glosario");
    };
  }, []);

  // Muestra el significado al pasar el cursor por encima de una palabra.
  useEffect(() => {
    let pendiente = false;
    let ultimo: MouseEvent | null = null;

    const revisar = () => {
      pendiente = false;
      const e = ultimo;
      if (!e) return;
      const bajo = e.target instanceof Element ? e.target : null;
      if (!bajo || bajo.closest(IGNORAR)) return setGlobo(null);
      const pos = textoBajoElCursor(e.clientX, e.clientY);
      if (!pos) return setGlobo(null);
      const texto = pos.nodo.nodeValue ?? "";
      const dentro = buscar(texto).find((c) => pos.indice >= c.desde && pos.indice <= c.hasta);
      if (!dentro) return setGlobo(null);
      const rango = new Range();
      rango.setStart(pos.nodo, dentro.desde);
      rango.setEnd(pos.nodo, dentro.hasta);
      const sobre = Array.from(rango.getClientRects()).find(
        (r) => e.clientX >= r.left - 2 && e.clientX <= r.right + 2 && e.clientY >= r.top - 2 && e.clientY <= r.bottom + 2,
      );
      if (!sobre) return setGlobo(null);
      setGlobo({ palabra: dentro.palabra, significa: dentro.significa, x: sobre.left + sobre.width / 2, y: sobre.bottom });
    };

    const alMover = (e: MouseEvent) => {
      ultimo = e;
      if (!pendiente) {
        pendiente = true;
        requestAnimationFrame(revisar);
      }
    };
    const ocultar = () => setGlobo(null);

    document.addEventListener("mousemove", alMover, { passive: true });
    document.addEventListener("scroll", ocultar, { passive: true, capture: true });
    document.addEventListener("mouseleave", ocultar);
    return () => {
      document.removeEventListener("mousemove", alMover);
      document.removeEventListener("scroll", ocultar, { capture: true });
      document.removeEventListener("mouseleave", ocultar);
    };
  }, []);

  if (!globo) return <div ref={caja} />;

  // Que no se salga de la pantalla: centrado sobre la palabra, con márgenes a los costados.
  const ancho = Math.min(320, window.innerWidth - 16);
  const izquierda = Math.max(8, Math.min(globo.x - ancho / 2, window.innerWidth - ancho - 8));
  const abajoLibre = window.innerHeight - globo.y;
  const estilo: React.CSSProperties =
    abajoLibre > 150 ? { top: globo.y + 8, left: izquierda, width: ancho } : { bottom: window.innerHeight - globo.y + 28, left: izquierda, width: ancho };

  return (
    <div ref={caja}>
      <div
        role="tooltip"
        style={estilo}
        className="anim-globo pointer-events-none fixed z-[60] rounded-2xl border border-primary-700 bg-white p-3 text-sm leading-snug text-primary-900 shadow-xl print:hidden"
      >
        <strong>{globo.palabra}:</strong> {globo.significa}
      </div>
    </div>
  );
}
