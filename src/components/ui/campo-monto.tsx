"use client";

import { useState, type FocusEventHandler, type Ref } from "react";

import { normalizarNumero } from "@/domain/motor/numeros";

import { clasesCampo } from "./campo";

interface PropsCampoMonto {
  id: string;
  /** Valor ya normalizado (punto decimal, sin miles): es lo que se guarda en el estado. */
  value: string;
  /** Recibe el valor normalizado. La normalización se hace acá, una sola vez. */
  onChange: (valorNormalizado: string) => void;
  onBlur?: FocusEventHandler<HTMLInputElement>;
  /** Etiqueta accesible cuando no hay un <label> visible. */
  ariaLabel?: string;
  placeholder?: string;
  invalido?: boolean;
  idError?: string;
  /** Id del texto de ayuda del campo (ver `idDescripcionDe`): se suma a `aria-describedby`. */
  idDescripcion?: string;
  /** Texto fijo antes del número. Por defecto "$". Pasar `null` para no mostrar nada. */
  prefijo?: string | null;
  /** Texto fijo después del número. Ej.: "hs". */
  sufijo?: string;
  className?: string;
  /** Ref del <input> (en React 19 se pasa como prop). Sirve para que React Hook Form enfoque el primer error. */
  ref?: Ref<HTMLInputElement>;
}

/** El estado guarda "12.5"; se muestra como lo escribe el usuario ("12,5"). */
function aTexto(valor: string): string {
  return valor.replace(".", ",");
}

/**
 * Campo para importes y cantidades. Acepta coma o punto decimal y punto de miles (es-AR).
 * Mientras el usuario escribe conserva su texto tal cual; el estado recibe el valor normalizado.
 */
export function CampoMonto({
  id,
  value,
  onChange,
  onBlur,
  ariaLabel,
  placeholder,
  invalido = false,
  idError,
  idDescripcion,
  prefijo = "$",
  sufijo,
  className = "",
  ref,
}: PropsCampoMonto) {
  const [local, setLocal] = useState<string | null>(null);
  // Si el valor cambió desde afuera (ej.: se recuperó el borrador), se muestra ese; si no, lo que tipeó el usuario.
  const mostrado = local !== null && normalizarNumero(local) === value ? local : aTexto(value);

  return (
    <div className={`relative ${className}`}>
      {prefijo ? (
        <span aria-hidden="true" className="pointer-events-none absolute inset-y-0 left-4 flex items-center text-gray-500">
          {prefijo}
        </span>
      ) : null}
      <input
        ref={ref}
        id={id}
        type="text"
        inputMode="decimal"
        autoComplete="off"
        aria-label={ariaLabel}
        aria-invalid={invalido || undefined}
        aria-describedby={[idDescripcion, invalido ? idError : undefined].filter(Boolean).join(" ") || undefined}
        placeholder={placeholder}
        value={mostrado}
        onChange={(e) => {
          setLocal(e.target.value);
          onChange(normalizarNumero(e.target.value));
        }}
        onBlur={onBlur}
        className={`${clasesCampo(invalido)} ${prefijo ? "pl-9" : ""} ${sufijo ? "pr-12" : ""}`}
      />
      {sufijo ? (
        <span aria-hidden="true" className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-gray-500">
          {sufijo}
        </span>
      ) : null}
    </div>
  );
}
