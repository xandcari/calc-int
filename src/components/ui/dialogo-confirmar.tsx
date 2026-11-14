"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";

import { Boton } from "./boton";

interface PropsDialogoConfirmar {
  abierto: boolean;
  titulo: string;
  descripcion: string;
  etiquetaConfirmar: string;
  etiquetaCancelar?: string;
  /** «peligro» (rojo, por defecto) para acciones que borran datos; «primario» (marino) para el resto. */
  tonoConfirmar?: "peligro" | "primario";
  /** Ícono decorativo arriba del título (Figma: cuadradito de color con el ícono). */
  icono?: ReactNode;
  /** Contenido extra entre la descripción y los botones (por ejemplo, un enlace). */
  children?: ReactNode;
  onConfirmar: () => void;
  onCancelar: () => void;
}

/**
 * Confirmación modal para acciones que borran datos. Usa <dialog> nativo: atrapa el foco,
 * se cierra con Esc y devuelve el foco al elemento que lo abrió. El foco inicial queda en «Cancelar».
 */
export function DialogoConfirmar({
  abierto,
  titulo,
  descripcion,
  etiquetaConfirmar,
  etiquetaCancelar = "Cancelar",
  tonoConfirmar = "peligro",
  icono,
  children,
  onConfirmar,
  onCancelar,
}: PropsDialogoConfirmar) {
  const ref = useRef<HTMLDialogElement>(null);
  // Ids únicos: en una misma pantalla puede haber más de un diálogo.
  const id = useId();

  useEffect(() => {
    const dialogo = ref.current;
    if (!dialogo) return;
    if (abierto && !dialogo.open) dialogo.showModal();
    if (!abierto && dialogo.open) dialogo.close();
  }, [abierto]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={`${id}-titulo`}
      aria-describedby={`${id}-descripcion`}
      onCancel={(e) => {
        e.preventDefault();
        onCancelar();
      }}
      onClick={(e) => {
        if (e.target === ref.current) onCancelar();
      }}
      className="m-auto w-[calc(100%-2rem)] max-w-md rounded-2xl border border-gray-200 bg-white p-6 text-gray-900 shadow-xl backdrop:bg-gray-900/40"
    >
      {icono ? (
        <span
          aria-hidden="true"
          className={`mb-4 flex size-10 items-center justify-center rounded-lg ${
            tonoConfirmar === "peligro" ? "bg-danger-100 text-danger-600" : "bg-primary-100 text-primary-900"
          }`}
        >
          {icono}
        </span>
      ) : null}
      <h2 id={`${id}-titulo`} className="text-lg font-bold">
        {titulo}
      </h2>
      <p id={`${id}-descripcion`} className="mt-2 text-sm text-gray-700">
        {descripcion}
      </p>
      {children ? <div className="mt-4">{children}</div> : null}
      <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <Boton variante="secundario" autoFocus onClick={onCancelar}>
          {etiquetaCancelar}
        </Boton>
        <Boton variante={tonoConfirmar} onClick={onConfirmar}>
          {etiquetaConfirmar}
        </Boton>
      </div>
    </dialog>
  );
}
