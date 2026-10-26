import type { CambioIndicador, Valoracion } from "@/domain/motor/comparacion";
import {
  formatearDiferenciaMonto,
  formatearDiferenciaPuntos,
  formatearDiferenciaUnidades,
  formatearVariacion,
} from "@/lib/formato";

type Unidad = "monto" | "unidades" | "puntos";

interface Props {
  cambio: CambioIndicador;
  /** Cómo se escribe la diferencia: importe ($), unidades o puntos porcentuales. */
  unidad: Unidad;
  /** Nombre del indicador, para el texto que leen los lectores de pantalla. Ej.: «Punto de equilibrio». */
  nombre: string;
}

const FORMATO_DIFERENCIA: Record<Unidad, (valor: string | null) => string> = {
  monto: formatearDiferenciaMonto,
  unidades: formatearDiferenciaUnidades,
  puntos: formatearDiferenciaPuntos,
};

const FLECHA = { sube: "▲", baja: "▼", igual: "–" } as const;

/**
 * Cómo se ve cada valoración. El cambio nunca se comunica solo con color:
 * cada etiqueta lleva un símbolo propio (✓, ⚠, –) y un texto.
 */
const ETIQUETA: Record<Valoracion, { simbolo: string; clases: string }> = {
  mejora: { simbolo: "✓", clases: "bg-success-100 text-success-700" },
  empeora: { simbolo: "⚠", clases: "bg-danger-100 text-danger-700" },
  neutro: { simbolo: "–", clases: "bg-gray-100 text-gray-700" },
  "sin-cambios": { simbolo: "–", clases: "bg-gray-100 text-gray-700" },
};

function textoEtiqueta(valoracion: Valoracion, direccion: CambioIndicador["direccion"]): string {
  if (valoracion === "mejora") return "Mejora";
  if (valoracion === "empeora") return "Empeora";
  if (valoracion === "sin-cambios") return "Sin cambios";
  // Neutro (precio): se describe el movimiento, sin juzgarlo.
  return direccion === "sube" ? "Más alto" : "Más bajo";
}

const TEXTO_EQUILIBRIO = {
  "pasa-a-no-viable": "Sin punto de equilibrio",
  "pasa-a-viable": "Ahora hay punto de equilibrio",
  "sigue-no-viable": "Sin punto de equilibrio",
} as const;

/** Frase completa para lectores de pantalla. Ej.: «Punto de equilibrio baja 31,4%: mejora». */
function frase(cambio: CambioIndicador, nombre: string, etiqueta: string): string {
  if (cambio.situacionEquilibrio) {
    return `${nombre}: ${TEXTO_EQUILIBRIO[cambio.situacionEquilibrio].toLowerCase()}, ${etiqueta.toLowerCase()}`;
  }
  if (cambio.direccion === "igual") return `${nombre}: sin cambios`;
  const verbo = cambio.direccion === "sube" ? "sube" : "baja";
  const pct = cambio.porcentaje ? ` ${formatearVariacion(cambio.porcentaje).replace(/^[+-]/, "")}` : "";
  return `${nombre} ${verbo}${pct}: ${etiqueta.toLowerCase()}`;
}

/**
 * Indicador de cambio de un valor respecto de la situación base (issue #17):
 * flecha + diferencia + porcentaje, y una etiqueta de texto con símbolo.
 */
export function IndicadorCambio({ cambio, unidad, nombre }: Props) {
  const etiqueta = textoEtiqueta(cambio.valoracion, cambio.direccion);
  const { simbolo, clases } = ETIQUETA[cambio.valoracion];
  const equilibrio = cambio.situacionEquilibrio;

  return (
    <div className="mt-1 flex flex-col items-start gap-1.5">
      <span className="sr-only">{frase(cambio, nombre, etiqueta)}</span>
      <div aria-hidden="true" className="flex flex-col items-start gap-1.5">
        {equilibrio ? (
          <span className="text-xs font-medium text-gray-700">{TEXTO_EQUILIBRIO[equilibrio]}</span>
        ) : cambio.direccion !== "igual" && cambio.diferencia !== null ? (
          <span className="text-xs font-medium text-gray-700">
            {FLECHA[cambio.direccion]} {FORMATO_DIFERENCIA[unidad](cambio.diferencia)}
            {cambio.porcentaje !== null ? ` · ${formatearVariacion(cambio.porcentaje)}` : ""}
          </span>
        ) : null}
        <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${clases}`}>
          <span>{simbolo}</span>
          {etiqueta}
        </span>
      </div>
    </div>
  );
}
