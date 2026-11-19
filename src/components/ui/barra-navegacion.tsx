import type { ReactNode } from "react";

/**
 * Fila de botones «Atrás / Continuar» al pie de cada paso.
 * Queda pegada al borde inferior de la pantalla mientras se baja, para que el botón de avanzar
 * se vea siempre sin tener que hacer scroll (pedido de las pruebas con usuarios).
 */
export function BarraNavegacion({ children, soloDerecha = false }: { children: ReactNode; soloDerecha?: boolean }) {
  return (
    <div
      className={`sticky bottom-0 z-10 flex items-center gap-3 border-t border-gray-200 bg-white/95 py-3 backdrop-blur print:hidden ${
        soloDerecha ? "justify-end" : "justify-between"
      }`}
    >
      {children}
    </div>
  );
}
