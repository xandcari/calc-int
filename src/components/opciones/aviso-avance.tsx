import { TOTAL_PASOS, type GuiaPaso } from "@/lib/opciones-amigables";

/**
 * Opción B: aviso corto que aparece al entrar a cada paso y se va solo (solo CSS, sin estado).
 * Se pide con `key={ruta}` para que la animación arranque de nuevo en cada paso.
 */
export function AvisoAvance({ guia }: { guia: GuiaPaso }) {
  return (
    <div
      role="status"
      className="anim-aviso pointer-events-none fixed bottom-20 left-1/2 z-40 w-[min(92vw,22rem)] -translate-x-1/2 rounded-2xl bg-primary-900 px-4 py-3 text-center text-sm font-semibold text-white shadow-lg print:hidden"
    >
      <span aria-hidden="true">✨ </span>
      Paso {guia.numero} de {TOTAL_PASOS}: {guia.titulo}
    </div>
  );
}
