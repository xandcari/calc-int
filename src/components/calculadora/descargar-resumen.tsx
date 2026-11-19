"use client";

import { useEffect, useState } from "react";

import { DialogoConfirmar } from "@/components/ui/dialogo-confirmar";
import { useSession } from "@/lib/auth-client";
import { descargarPdfDelServidor } from "@/lib/exportar-pdf";
import { useCalculoStore } from "@/store/calculo-store";

/** Clase que, mientras se imprime, deja visible solo el resumen final (ver `globals.css` y `resumen-final.tsx`). */
const CLASE_IMPRIMIENDO = "imprimiendo-resumen";
/** Id del resumen final que se imprime o se guarda como imagen. Lo pone `ResumenFinal`. */
const ID_RESUMEN = "resumen-final";

const MENSAJE_LISTO = "Listo, tu resumen se descargó. Guardalo para comparar cuando cambien tus costos.";
// El navegador no avisa si el PDF se guardó o se canceló: tras cerrar la impresión el aviso no asegura que se descargó.
const MENSAJE_IMPRESION = "Cerraste la ventana de impresión. Si elegiste «Guardar como PDF», tu resumen ya quedó guardado.";
// Solo es true cuando la impresión la pidió este panel (afterprint también salta al cancelar o al imprimir otra cosa).
let impresionPropia = false;

/** ¿Hay un resumen para descargar en esta pantalla? (solo existe en el simulador, cuando hay precio). */
export function hayResumenParaDescargar(): boolean {
  return typeof document !== "undefined" && document.getElementById(ID_RESUMEN) !== null;
}

/** Abre la ventana de impresión del navegador mostrando solo el resumen final (desde ahí se guarda como PDF). */
export function imprimirResumen(): void {
  document.body.classList.add(CLASE_IMPRIMIENDO);
  impresionPropia = true;
  window.print();
}

/** Nombre de archivo seguro a partir del nombre del producto. Ej.: «Remeras» → «preciar-resumen-remeras.png». */
function nombreDeArchivo(producto: string): string {
  const limpio = producto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `preciar-resumen${limpio ? `-${limpio}` : ""}.png`;
}

/** Guarda el resumen final como imagen PNG. Devuelve `false` si no se pudo. */
async function guardarComoImagen(producto: string): Promise<boolean> {
  const nodo = document.getElementById(ID_RESUMEN);
  if (!nodo) return false;
  try {
    // Se carga solo cuando hace falta: no suma peso a la página hasta que alguien guarda la imagen.
    const { toPng } = await import("html-to-image");
    const url = await toPng(nodo, {
      backgroundColor: "#ffffff",
      pixelRatio: 2,
      // El botón «Descargar PDF» del propio resumen no va en la imagen (tampoco sale al imprimir).
      filter: (n) => !(n instanceof HTMLElement && n.classList.contains("print:hidden")),
    });
    const enlace = document.createElement("a");
    enlace.href = url;
    enlace.download = nombreDeArchivo(producto);
    enlace.click();
    return true;
  } catch {
    return false;
  }
}

const iconoDescarga = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M12 4v11M7 10l5 5 5-5M5 20h14" />
  </svg>
);

const iconoImagen = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="3" y="4" width="18" height="16" rx="2" />
    <circle cx="9" cy="10" r="1.5" />
    <path d="m21 16-5-5-9 9" />
  </svg>
);

const iconoHoja = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
    <path d="M14 3v5h5M9 13h6M9 17h6" />
  </svg>
);

const CLASES_BOTON =
  "inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold " +
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-700";

/**
 * Bloque «Descargar resumen» del panel lateral en el simulador (Figma, Paso 5):
 * guardar como PDF (con un aviso previo), guardar como imagen y Excel (próximamente).
 */
export function DescargarResumen({ producto }: { producto: string }) {
  const [confirmando, setConfirmando] = useState(false);
  const [mensaje, setMensaje] = useState<{ texto: string; error: boolean } | null>(null);
  const { data: sesion } = useSession();
  const logueado = Boolean(sesion?.user);

  // Al cerrar la ventana de impresión se avisa, sin asegurar que se guardó (el navegador no lo informa).
  useEffect(() => {
    function alTerminar() {
      if (!impresionPropia) return;
      impresionPropia = false;
      setMensaje({ texto: MENSAJE_IMPRESION, error: false });
    }
    window.addEventListener("afterprint", alTerminar);
    return () => window.removeEventListener("afterprint", alTerminar);
  }, []);

  async function alGuardarImagen() {
    setMensaje(null);
    const ok = await guardarComoImagen(producto);
    setMensaje(
      ok
        ? { texto: MENSAJE_LISTO, error: false }
        : { texto: "No pudimos guardar la imagen. Probá con «Descargar PDF».", error: true },
    );
  }

  /**
   * Con sesión iniciada se pide al servidor el informe detallado (gráficos, escenarios y todos los valores).
   * Sin sesión, o si el servidor no lo puede generar, se usa la impresión del navegador: nadie se queda sin resumen.
   */
  async function alConfirmarPdf() {
    setConfirmando(false);
    if (logueado) {
      const resultado = await descargarPdfDelServidor(useCalculoStore.getState().calculo);
      if (resultado === "descargado") {
        setMensaje({ texto: MENSAJE_LISTO, error: false });
        return;
      }
    }
    // Se espera un cuadro para que el diálogo termine de cerrarse antes de abrir la impresión.
    requestAnimationFrame(imprimirResumen);
  }

  return (
    <>
      <div className="mt-4 border-t border-gray-300 pt-4">
        <h3 className="text-xs font-bold uppercase tracking-widest text-gray-900">Descargar resumen</h3>
        <div className="mt-3 flex flex-col gap-2">
          <button
            type="button"
            onClick={() => {
              setMensaje(null);
              setConfirmando(true);
            }}
            className={`${CLASES_BOTON} bg-primary-900 text-white hover:bg-primary-700`}
          >
            {iconoDescarga}
            Descargar PDF
          </button>
          <button
            type="button"
            onClick={alGuardarImagen}
            className={`${CLASES_BOTON} border border-gray-400 bg-white text-gray-900 hover:bg-gray-50`}
          >
            {iconoImagen}
            Descargar imagen
          </button>
          <button
            type="button"
            disabled
            className={`${CLASES_BOTON} cursor-not-allowed border border-gray-200 bg-gray-100 font-medium text-gray-500`}
          >
            {iconoHoja}
            Excel
            <span className="rounded-full bg-gray-200 px-2 py-0.5 text-xs">Próximamente</span>
          </button>
        </div>
      </div>

      <DialogoConfirmar
        abierto={confirmando}
        titulo="Guardá el resumen de tu cálculo"
        descripcion="Se genera el PDF de tu resumen. Si se abre la ventana de impresión, elegí «Guardar como PDF»."
        etiquetaConfirmar="Descargar"
        tonoConfirmar="primario"
        icono={iconoDescarga}
        onCancelar={() => setConfirmando(false)}
        onConfirmar={alConfirmarPdf}
      />

      {/* Fuera del panel en el diseño: un aviso verde debajo. role="status" lo anuncia sin robar el foco. */}
      <div role="status">
        {mensaje ? (
          <p
            className={`mt-4 rounded-xl border px-4 py-3 text-sm ${
              mensaje.error ? "border-danger-100 bg-danger-50 text-danger-700" : "border-success-100 bg-success-100 text-primary-900"
            }`}
          >
            {mensaje.texto}
          </p>
        ) : null}
      </div>
    </>
  );
}
