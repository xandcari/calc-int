"use client";

import { useRouter } from "next/navigation";
import { Fragment, useState, type ReactNode } from "react";

import { hayResumenParaDescargar, imprimirResumen } from "@/components/calculadora/descargar-resumen";
import { DialogoConfirmar } from "@/components/ui/dialogo-confirmar";

import { useHidratado } from "@/hooks/use-hidratado";
import { useCalculoStore } from "@/store/calculo-store";

import { Cabecera, Pie } from "./cabecera";
import { Hidratador } from "./hidratador";
import { MenuUsuario } from "./menu-usuario";
import { Pasos } from "./pasos";
import { ResumenEnVivo } from "./resumen-en-vivo";

/** Píldora con el nombre del producto (o «Sin nombre» mientras no se cargó). */
function NombreDelProducto() {
  const nombre = useCalculoStore((s) => s.calculo.configuracion.nombre).trim();
  return (
    <span className="max-w-40 truncate rounded-md bg-warning-100 px-2.5 py-1 text-xs font-semibold text-gray-900">
      {nombre || "Sin nombre"}
    </span>
  );
}

/** «Reiniciar»: borra el borrador y vuelve al paso 1, previa confirmación. */
function BotonReiniciar({ alReiniciar }: { alReiniciar: () => void }) {
  const router = useRouter();
  const [confirmando, setConfirmando] = useState(false);
  // El enlace «Descargar mi resumen» solo tiene sentido donde hay un resumen para guardar (el simulador).
  const [puedeGuardar, setPuedeGuardar] = useState(false);
  const reiniciar = useCalculoStore((s) => s.reiniciar);

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setPuedeGuardar(hayResumenParaDescargar());
          setConfirmando(true);
        }}
        className="inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-primary-700 hover:bg-gray-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-700"
      >
        <span aria-hidden="true">↻</span>
        Reiniciar
      </button>
      <DialogoConfirmar
        abierto={confirmando}
        titulo="¿Confirmar reinicio?"
        descripcion="Los datos cargados se van a borrar para iniciar un nuevo cálculo."
        etiquetaConfirmar="Confirmar"
        icono={<span className="text-lg leading-none">↻</span>}
        onCancelar={() => setConfirmando(false)}
        onConfirmar={() => {
          reiniciar();
          alReiniciar();
          router.push("/calculadora/producto");
        }}
      >
        {puedeGuardar ? (
          <button
            type="button"
            onClick={() => {
              setConfirmando(false);
              requestAnimationFrame(imprimirResumen);
            }}
            className="rounded text-sm font-medium text-gray-900 underline underline-offset-4 hover:text-primary-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-700"
          >
            Descargar mi resumen antes de reiniciar
          </button>
        ) : null}
      </DialogoConfirmar>
    </>
  );
}

/** Marco del recorrido: cabecera con pasos, contenido del paso y panel «Resumen en vivo». */
export function Recorrido({ children }: { children: ReactNode }) {
  const hidratado = useHidratado();
  // Al reiniciar se vuelve a montar el contenido, así los formularios toman los valores iniciales.
  const [version, setVersion] = useState(0);

  return (
    <>
      <Hidratador />
      <a
        href="#contenido"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-primary-900 focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-white"
      >
        Saltar al contenido
      </a>
      <Cabecera
        centro={<Pasos />}
        derecha={
          <div className="flex items-center gap-2">
            <MenuUsuario />
            {hidratado ? (
              <>
                <NombreDelProducto />
                <BotonReiniciar alReiniciar={() => setVersion((v) => v + 1)} />
              </>
            ) : null}
          </div>
        }
      />
      <div
        className="mx-auto grid w-full max-w-6xl flex-1 gap-8 px-4 py-8 sm:px-6 lg:grid-cols-[minmax(0,1fr)_20rem] lg:py-12"
      >
        <main id="contenido" tabIndex={-1} className="min-w-0 focus:outline-none">
          <Fragment key={version}>{children}</Fragment>
        </main>
        <div className="lg:sticky lg:top-6 lg:self-start">
          {/* En Figma el panel «Resumen en vivo» acompaña todos los pasos, también el simulador (Paso 5). */}
          {hidratado ? <ResumenEnVivo /> : null}
        </div>
      </div>
      <Pie />
    </>
  );
}
