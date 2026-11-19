"use client";

import { useState } from "react";

import { CampoMonto } from "@/components/ui/campo-monto";
import { clasesCampo } from "@/components/ui/campo";
import { DialogoConfirmar } from "@/components/ui/dialogo-confirmar";

export interface FilaConcepto {
  id: string;
  nombre: string;
  /** Importe ya normalizado. */
  valor: string;
  /** Solo si la lista deja elegir la base del monto (insumos de la ruta «lotes»). */
  base?: "unidad" | "lote";
  /** Texto con lo que equivale por unidad cuando el monto es por lote. Ej.: «= $1.000 por unidad». */
  equivalente?: string;
}

interface PropsListaConceptos {
  /** Prefijo de los `id` de los campos (único por lista). Ej.: "fijos". */
  idBase: string;
  filas: FilaConcepto[];
  /** Cómo llamar a cada fila en los textos de accesibilidad. Ej.: "gasto fijo". */
  nombreFila: string;
  placeholderNombre: string;
  placeholderValor: string;
  etiquetaAgregar: string;
  /** Conceptos frecuentes que se agregan con un clic. */
  sugeridos?: string[];
  onCambiar: (id: string, cambios: { nombre?: string; valor?: string }) => void;
  /** Si se pasa, cada fila ofrece elegir si el monto es por unidad o por lote. */
  onCambiarBase?: (id: string, base: "unidad" | "lote") => void;
  onEliminar: (id: string) => void;
  onAgregar: (nombre?: string) => void;
  /** Mensaje de error de una fila (ya filtrado por «mostrar solo si tocó el campo o intentó continuar»). */
  errorDe: (indice: number, campo: "nombre" | "valor") => string | undefined;
  onTocar: (indice: number, campo: "nombre" | "valor") => void;
}

/** Filas de «nombre + importe» con alta, edición y baja. Las filas en blanco se ignoran al calcular. */
export function ListaConceptos({
  idBase,
  filas,
  nombreFila,
  placeholderNombre,
  placeholderValor,
  etiquetaAgregar,
  sugeridos = [],
  onCambiar,
  onCambiarBase,
  onEliminar,
  onAgregar,
  errorDe,
  onTocar,
}: PropsListaConceptos) {
  const [pendienteDeEliminar, setPendienteDeEliminar] = useState<string | null>(null);
  const filaPendiente = filas.find((f) => f.id === pendienteDeEliminar);
  const cargados = new Set(filas.map((f) => f.nombre.trim().toLowerCase()));
  const pendientes = sugeridos.filter((s) => !cargados.has(s.toLowerCase()));

  return (
    <div className="flex flex-col gap-4">
      {pendientes.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-gray-500">Sugeridos para vos:</span>
          {pendientes.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => onAgregar(s)}
              className="relative rounded-full border border-primary-100 bg-primary-50 px-3 py-1 text-sm before:absolute before:inset-x-0 before:-inset-y-2 before:content-[''] font-medium text-primary-700 hover:bg-primary-100 focus-visible:outline-2 focus-visible:outline-primary-600"
            >
              + {s}
            </button>
          ))}
        </div>
      ) : null}

      <ul className="flex flex-col gap-3">
        {filas.map((fila, i) => {
          const errorNombre = errorDe(i, "nombre");
          const errorValor = errorDe(i, "valor");
          const idNombre = `${idBase}-${fila.id}-nombre`;
          const idValor = `${idBase}-${fila.id}-valor`;
          const idErrores = `${idBase}-${fila.id}-errores`;
          const etiqueta = fila.nombre.trim() || `${nombreFila} ${i + 1}`;

          return (
            <li key={fila.id} className="flex flex-col gap-1.5">
              <div className="flex items-start gap-2">
                <input
                  id={idNombre}
                  type="text"
                  autoComplete="off"
                  maxLength={200}
                  aria-label={`Nombre del ${nombreFila} ${i + 1}`}
                  aria-invalid={errorNombre ? true : undefined}
                  aria-describedby={errorNombre ? idErrores : undefined}
                  placeholder={placeholderNombre}
                  value={fila.nombre}
                  onChange={(e) => onCambiar(fila.id, { nombre: e.target.value })}
                  onBlur={() => onTocar(i, "nombre")}
                  className={`${clasesCampo(Boolean(errorNombre))} min-w-0 flex-1`}
                />
                <CampoMonto
                  id={idValor}
                  ariaLabel={`Monto del ${nombreFila} ${i + 1}`}
                  placeholder={placeholderValor}
                  value={fila.valor}
                  invalido={Boolean(errorValor)}
                  idError={idErrores}
                  onChange={(valor) => onCambiar(fila.id, { valor })}
                  onBlur={() => onTocar(i, "valor")}
                  className="w-32 shrink-0 sm:w-40"
                />
                <button
                  type="button"
                  aria-label={`Eliminar ${etiqueta}`}
                  onClick={() => {
                    // Una fila en blanco se borra sin preguntar; si tiene datos, se confirma.
                    if (fila.nombre.trim() || fila.valor.trim()) setPendienteDeEliminar(fila.id);
                    else onEliminar(fila.id);
                  }}
                  className="flex size-12 shrink-0 items-center justify-center rounded-xl text-danger-700 hover:bg-danger-50 focus-visible:outline-2 focus-visible:outline-danger-700"
                >
                  <svg aria-hidden="true" viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 6h18M8 6V4h8v2m-9 0 1 14h8l1-14M10 10v6m4-6v6" />
                  </svg>
                </button>
              </div>
              {onCambiarBase ? (
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-gray-700">
                  <label htmlFor={`${idBase}-${fila.id}-base`}>El monto es</label>
                  <select
                    id={`${idBase}-${fila.id}-base`}
                    value={fila.base ?? "unidad"}
                    onChange={(e) => onCambiarBase(fila.id, e.target.value === "lote" ? "lote" : "unidad")}
                    className="min-h-10 rounded-lg border border-gray-400 bg-white px-2 text-sm text-gray-900 focus-visible:outline-2 focus-visible:outline-primary-600"
                  >
                    <option value="unidad">por unidad</option>
                    <option value="lote">por lote completo</option>
                  </select>
                  {fila.equivalente ? <span className="text-gray-600">{fila.equivalente}</span> : null}
                </div>
              ) : null}
              {errorNombre || errorValor ? (
                <p id={idErrores} role="alert" className="flex items-start gap-1.5 text-sm font-medium text-danger-700">
                  <span aria-hidden="true">✕</span>
                  <span>{[errorNombre, errorValor].filter(Boolean).join(" ")}</span>
                </p>
              ) : null}
            </li>
          );
        })}
      </ul>

      <div>
        <button
          type="button"
          onClick={() => onAgregar()}
          className="relative text-sm font-semibold text-primary-700 underline-offset-2 before:absolute before:inset-x-0 before:-inset-y-3 before:content-[''] hover:underline focus-visible:outline-2 focus-visible:outline-primary-600"
        >
          + {etiquetaAgregar}
        </button>
      </div>

      <DialogoConfirmar
        abierto={Boolean(filaPendiente)}
        titulo="¿Eliminar este costo?"
        descripcion={`Se va a quitar «${filaPendiente?.nombre.trim() || "sin nombre"}» del cálculo. Esta acción no se puede deshacer.`}
        etiquetaConfirmar="Sí, eliminar"
        onCancelar={() => setPendienteDeEliminar(null)}
        onConfirmar={() => {
          if (pendienteDeEliminar) onEliminar(pendienteDeEliminar);
          setPendienteDeEliminar(null);
        }}
      />
    </div>
  );
}
