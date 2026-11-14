"use client";

import Link from "next/link";
import { useState } from "react";

import { Aviso } from "@/components/ui/aviso";
import { Boton } from "@/components/ui/boton";
import { enlaceCompartido, esCalculoGuardado, guardarCalculo, type ResultadoGuardado } from "@/lib/api-calculos";
import { useCalculoStore } from "@/store/calculo-store";

/**
 * Botón básico «Guardar y compartir» (versión provisoria del backend, sin diseño final).
 * Guarda el cálculo actual en la base de datos y muestra el link. Si no hay sesión, lo avisa.
 * Si el cálculo cargado es de otra persona, el servidor responde 403 y se muestra el mensaje.
 */
export function BotonGuardar() {
  const [guardando, setGuardando] = useState(false);
  const [resultado, setResultado] = useState<ResultadoGuardado | null>(null);
  // Si el cálculo ya está en la base, «Guardar» lo actualiza; esta bandera habilita además «guardar como nuevo».
  const yaGuardado = useCalculoStore((s) => esCalculoGuardado(s.calculo.id));

  async function guardar(comoNuevo = false) {
    setGuardando(true);
    setResultado(await guardarCalculo(useCalculoStore.getState().calculo, { comoNuevo }));
    setGuardando(false);
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-3">
        <Boton onClick={() => guardar()} disabled={guardando}>
          {guardando ? "Guardando…" : yaGuardado ? "Guardar cambios" : "Guardar y compartir"}
        </Boton>
        {yaGuardado ? (
          <Boton variante="secundario" onClick={() => guardar(true)} disabled={guardando}>
            Guardar como cálculo nuevo
          </Boton>
        ) : null}
      </div>

      {resultado?.ok ? (
        <Aviso tono="info" titulo={resultado.creado ? "¡Guardado!" : "Cambios guardados"}>
          Cualquiera con este link puede ver tu cálculo:{" "}
          <span className="break-all font-semibold">{enlaceCompartido(resultado.id)}</span>
        </Aviso>
      ) : resultado?.motivo === "sin_sesion" ? (
        <Aviso tono="advertencia" titulo="Necesitás iniciar sesión">
          Para guardar hace falta una cuenta.{" "}
          {/* Provisorio: la única pantalla de login por ahora es la de prueba. Reemplazar por el login real. */}
          <Link className="underline" href="/test_de_guardado">
            Iniciar sesión o crear cuenta
          </Link>
          , y después volvé acá a guardar.
        </Aviso>
      ) : resultado ? (
        <Aviso tono="advertencia" titulo="No se pudo guardar">
          {resultado.mensaje}
          {/* Qué campo tiene el problema (ej.: "precio.precioManual"): ayuda a corregirlo antes de reintentar. */}
          {resultado.detalles?.length ? (
            <ul className="mt-1 list-disc pl-5">
              {resultado.detalles.slice(0, 5).map((d) => (
                <li key={`${d.campo}-${d.mensaje}`}>
                  <code>{d.campo}</code>: {d.mensaje}
                </li>
              ))}
            </ul>
          ) : null}
        </Aviso>
      ) : null}
    </div>
  );
}
