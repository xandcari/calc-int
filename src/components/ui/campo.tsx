import type { ReactNode } from "react";

/** Clases comunes de los campos de texto, número y select. */
export const CLASES_CAMPO =
  "w-full rounded-xl border bg-white px-4 py-3 text-base text-gray-900 placeholder:text-gray-500 " +
  "focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary-600";

export function clasesCampo(invalido: boolean): string {
  return `${CLASES_CAMPO} ${invalido ? "border-danger-600 bg-danger-50" : "border-gray-400"}`;
}

/** Id del texto de ayuda de un campo; el control lo usa en `aria-describedby` para que el lector lo anuncie. */
export function idDescripcionDe(idControl: string): string {
  return `${idControl}-descripcion`;
}

interface PropsCampo {
  /** `id` del control, para asociar la etiqueta. */
  idControl: string;
  etiqueta: ReactNode;
  /** Texto de ayuda debajo de la etiqueta. */
  descripcion?: ReactNode;
  /** Mensaje de error. Se muestra con el ícono ✕ (no depende solo del color). */
  error?: string;
  /** Id del elemento de error, para `aria-describedby`. */
  idError?: string;
  children: ReactNode;
}

/** Etiqueta + control + error, con la asociación accesible hecha. */
export function Campo({ idControl, etiqueta, descripcion, error, idError, children }: PropsCampo) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={idControl} className="text-base font-medium text-gray-900">
        {etiqueta}
      </label>
      {descripcion ? (
        <p id={idDescripcionDe(idControl)} className="text-sm text-gray-500">
          {descripcion}
        </p>
      ) : null}
      {children}
      {error ? (
        <p id={idError} role="alert" className="flex items-start gap-1.5 text-sm font-medium text-danger-700">
          <span aria-hidden="true">✕</span>
          <span>{error}</span>
        </p>
      ) : null}
    </div>
  );
}
