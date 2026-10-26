"use client";

import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";

import { ComparacionEscenarios, type EscenarioConResultado } from "@/components/calculadora/comparacion-escenarios";
import { Aviso } from "@/components/ui/aviso";
import { Boton, BotonLink } from "@/components/ui/boton";
import { DialogoConfirmar } from "@/components/ui/dialogo-confirmar";
import { Tarjeta } from "@/components/ui/tarjeta";
import type { CambiosEscenario } from "@/domain/calculo";
import {
  metaDeVentas,
  simularVariaciones,
  situacionBase,
  VARIACION_MAXIMA_PCT,
  VARIACION_MINIMA_PCT,
  type ResultadoEscenario,
} from "@/domain/motor/escenarios";
import { MAX_ESCENARIOS, type EscenarioUsuario } from "@/domain/types";
import { useAnalisisPrecio } from "@/hooks/use-analisis-precio";
import { useHidratado } from "@/hooks/use-hidratado";
import { formatearCantidad, formatearMonto, formatearPorcentaje, formatearVariacion } from "@/lib/formato";
import { useCalculoStore } from "@/store/calculo-store";

function Esqueleto() {
  return (
    <div aria-busy="true" aria-label="Cargando tu cálculo" className="flex animate-pulse flex-col gap-6">
      <div className="h-8 w-1/2 rounded-lg bg-gray-200" />
      <div className="h-28 rounded-2xl bg-gray-100" />
      <div className="h-80 rounded-2xl bg-gray-100" />
    </div>
  );
}

/** Paso 5 — «Simulador de escenarios» (Vista 5 del diseño). */
export function VistaSimulador() {
  const hidratado = useHidratado();
  return hidratado ? <Simulador /> : <Esqueleto />;
}

function Simulador() {
  const router = useRouter();
  const reiniciar = useCalculoStore((s) => s.reiniciar);
  const agregarEscenario = useCalculoStore((s) => s.agregarEscenario);
  const duplicarEscenario = useCalculoStore((s) => s.duplicarEscenario);
  const actualizarEscenario = useCalculoStore((s) => s.actualizarEscenario);
  const eliminarEscenario = useCalculoStore((s) => s.eliminarEscenario);
  const { calculo, precio, analisis } = useAnalisisPrecio();
  const [confirmandoReinicio, setConfirmandoReinicio] = useState(false);
  const [idAEliminar, setIdAEliminar] = useState<string | null>(null);

  const base = precio ? situacionBase(calculo, precio) : null;

  if (!precio || !base) {
    return (
      <div className="flex flex-col items-start gap-6">
        <h1 className="text-3xl font-bold tracking-tight text-gray-900">Primero elegí tu precio</h1>
        <Aviso tono="advertencia">Para simular escenarios necesitamos tus costos y el precio al que vas a vender.</Aviso>
        <BotonLink href="/calculadora/precio">Ir al precio</BotonLink>
      </div>
    );
  }

  const meta = metaDeVentas(analisis?.puntoEquilibrioUnidades ?? null);
  const escenarios = calculo.escenarios;
  const resultados = new Map(
    escenarios.map((e) => [
      e.id,
      simularVariaciones(calculo, precio, { insumosPct: e.insumosPct, precioPct: e.precioPct, produccionPct: e.produccionPct }),
    ]),
  );
  const paraComparar: EscenarioConResultado[] = escenarios.flatMap((escenario) => {
    const resultado = resultados.get(escenario.id);
    return resultado ? [{ escenario, resultado }] : [];
  });
  const llegoAlMaximo = escenarios.length >= MAX_ESCENARIOS;
  const escenarioAEliminar = escenarios.find((e) => e.id === idAEliminar) ?? null;
  const pctInsumos = escenarios.find((e) => Number(e.insumosPct) > 0)?.insumosPct;

  return (
    <div className="flex flex-col gap-8">
      <div>
        <p className="mb-1 text-xs font-bold uppercase tracking-widest text-primary-600">Paso 5 de 5</p>
        <h1 className="text-3xl font-bold tracking-tight text-gray-900">¿Qué pasa si…?</h1>
        <p className="mt-2 text-lg text-gray-700">
          Movés los sliders y mirá cómo cambia tu negocio. No pasa nada real — solo jugamos con tus números.
        </p>
      </div>

      <section aria-labelledby="base" className="rounded-2xl bg-gray-900 p-6 text-white shadow-sm">
        <h2 id="base" className="text-sm text-gray-200">
          Situación actual (base)
        </h2>
        <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-4">
          <DatoBase etiqueta="Costo unitario" valor={formatearMonto(base.costoUnitario)} />
          <DatoBase etiqueta="Precio de venta" valor={formatearMonto(base.precio)} />
          <DatoBase
            etiqueta="Punto de equilibrio"
            valor={base.puntoEquilibrio ? `${formatearCantidad(base.puntoEquilibrio)} uds` : "—"}
          />
          <DatoBase etiqueta="Ganancia mensual" valor={formatearMonto(base.gananciaMensual)} />
        </dl>
      </section>

      {escenarios.length === 0 ? (
        <Aviso tono="consejo">No tenés escenarios. Agregá uno para empezar a comparar.</Aviso>
      ) : (
        <div className="grid gap-4 lg:grid-cols-3">
          {escenarios.map((escenario) => (
            <TarjetaEscenario
              key={escenario.id}
              escenario={escenario}
              resultado={resultados.get(escenario.id) ?? null}
              puedeDuplicar={!llegoAlMaximo}
              onCambiar={(cambios) => actualizarEscenario(escenario.id, cambios)}
              onDuplicar={() => duplicarEscenario(escenario.id)}
              onEliminar={() => setIdAEliminar(escenario.id)}
            />
          ))}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <Boton variante="secundario" onClick={() => agregarEscenario()} disabled={llegoAlMaximo}>
          + Agregar escenario
        </Boton>
        <span className="text-sm text-gray-500">
          {escenarios.length} de {MAX_ESCENARIOS} escenarios
        </span>
      </div>

      <ComparacionEscenarios base={base} escenarios={paraComparar} />

      <Aviso tono="consejo">
        El escenario de suba de insumos es el más importante. Los materiales siempre suben. ¿Tu negocio sigue siendo
        rentable{pctInsumos ? ` con un ${pctInsumos}% más de costo` : " si suben tus costos"}?
      </Aviso>

      <Tarjeta aria-labelledby="siguiente-paso" className="flex flex-col gap-4">
        <h2 id="siguiente-paso" className="text-base font-semibold text-gray-900">
          ¿Cuál es el siguiente paso?
        </h2>
        <ul className="grid gap-4 md:grid-cols-3">
          <SiguientePaso icono="🎯" titulo="Fijar mi precio con confianza">
            Ya tenés todos los datos para salir al mercado con un precio fundamentado.
          </SiguientePaso>
          <SiguientePaso icono="📅" titulo="Establecer una meta de ventas mensual">
            {meta
              ? `Vendé al menos ${formatearCantidad(meta)} unidades/mes para tener ganancia real.`
              : "Vendé por encima de tu punto de equilibrio para tener ganancia real."}
          </SiguientePaso>
          <SiguientePaso icono="🔄" titulo="Revisar costos cada 3 meses">
            Los precios cambian. Actualizá este cálculo cuando cambien tus insumos o tus tarifas.
          </SiguientePaso>
        </ul>
      </Tarjeta>

      <div className="flex items-center justify-between gap-3">
        <BotonLink href="/calculadora/precio" variante="secundario">
          ← Atrás
        </BotonLink>
        <Boton onClick={() => setConfirmandoReinicio(true)}>Calcular otro producto</Boton>
      </div>

      <DialogoConfirmar
        abierto={escenarioAEliminar !== null}
        titulo="¿Eliminar este escenario?"
        descripcion={
          escenarioAEliminar ? `Vas a eliminar «${escenarioAEliminar.nombre}». Esta acción no se puede deshacer.` : ""
        }
        etiquetaConfirmar="Sí, eliminar"
        onCancelar={() => setIdAEliminar(null)}
        onConfirmar={() => {
          if (idAEliminar) eliminarEscenario(idAEliminar);
          setIdAEliminar(null);
        }}
      />

      <DialogoConfirmar
        abierto={confirmandoReinicio}
        titulo="¿Calcular otro producto?"
        descripcion="Vas a borrar lo que cargaste (producto, costos y precio) y volver al paso 1. Esta acción no se puede deshacer."
        etiquetaConfirmar="Sí, empezar de nuevo"
        onCancelar={() => setConfirmandoReinicio(false)}
        onConfirmar={() => {
          reiniciar();
          router.push("/calculadora/producto");
        }}
      />
    </div>
  );
}

function DatoBase({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <div>
      <dt className="text-sm text-gray-200">{etiqueta}</dt>
      <dd className="mt-0.5 text-2xl font-extrabold">{valor}</dd>
    </div>
  );
}

function SiguientePaso({ icono, titulo, children }: { icono: string; titulo: string; children: ReactNode }) {
  return (
    <li className="rounded-xl bg-primary-50 p-4">
      <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-900">
        <span aria-hidden="true">{icono}</span>
        {titulo}
      </h3>
      <p className="mt-2 text-sm text-gray-700">{children}</p>
    </li>
  );
}

function TarjetaEscenario({
  escenario,
  resultado,
  puedeDuplicar,
  onCambiar,
  onDuplicar,
  onEliminar,
}: {
  escenario: EscenarioUsuario;
  resultado: ResultadoEscenario | null;
  puedeDuplicar: boolean;
  onCambiar: (cambios: CambiosEscenario) => void;
  onDuplicar: () => void;
  onEliminar: () => void;
}) {
  const idNombre = `nombre-${escenario.id}`;

  return (
    <Tarjeta aria-labelledby={idNombre} className="flex flex-col gap-4">
      <div>
        <label htmlFor={idNombre} className="sr-only">
          Nombre del escenario
        </label>
        <input
          id={idNombre}
          type="text"
          value={escenario.nombre}
          maxLength={40}
          onChange={(e) => onCambiar({ nombre: e.target.value })}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-base font-semibold text-gray-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-600"
        />
      </div>

      <div className="flex flex-col gap-3">
        <ControlVariacion
          id={`insumos-${escenario.id}`}
          etiqueta="Variación en costos variables"
          valor={escenario.insumosPct}
          onCambiar={(v) => onCambiar({ insumosPct: v })}
        />
        <ControlVariacion
          id={`precio-${escenario.id}`}
          etiqueta="Variación en precio de venta"
          valor={escenario.precioPct}
          onCambiar={(v) => onCambiar({ precioPct: v })}
        />
        <ControlVariacion
          id={`produccion-${escenario.id}`}
          etiqueta="Variación en volumen de producción"
          valor={escenario.produccionPct}
          onCambiar={(v) => onCambiar({ produccionPct: v })}
        />
      </div>

      {resultado ? <Resultado resultado={resultado} /> : null}

      <div className="flex flex-wrap gap-2">
        {puedeDuplicar ? (
          <Boton variante="secundario" onClick={onDuplicar}>
            Duplicar<span className="sr-only"> {escenario.nombre}</span>
          </Boton>
        ) : null}
        <Boton variante="secundario" onClick={onEliminar}>
          Eliminar<span className="sr-only"> {escenario.nombre}</span>
        </Boton>
      </div>
    </Tarjeta>
  );
}

function ControlVariacion({
  id,
  etiqueta,
  valor,
  onCambiar,
}: {
  id: string;
  etiqueta: string;
  valor: string;
  onCambiar: (valor: string) => void;
}) {
  const numero = Number(valor);
  const signo = numero > 0 ? "+" : "";

  return (
    <div>
      <div className="flex items-baseline justify-between gap-2 text-sm">
        <label htmlFor={id} className="text-gray-700">
          {etiqueta}
        </label>
        <output htmlFor={id} className="font-semibold text-primary-600">
          {signo}
          {numero}%
        </output>
      </div>
      <input
        id={id}
        type="range"
        min={VARIACION_MINIMA_PCT}
        max={VARIACION_MAXIMA_PCT}
        step={1}
        value={numero}
        aria-valuetext={`${signo}${numero} por ciento`}
        onChange={(e) => onCambiar(e.target.value)}
        className="mt-2 h-2 w-full cursor-pointer accent-primary-600"
      />
      <div className="mt-1 flex justify-between text-xs text-gray-500" aria-hidden="true">
        <span>{VARIACION_MINIMA_PCT}%</span>
        <span>+{VARIACION_MAXIMA_PCT}%</span>
      </div>
    </div>
  );
}

function Resultado({ resultado }: { resultado: ResultadoEscenario }) {
  const { variaciones } = resultado;
  return (
    <div aria-live="polite" className="flex flex-col gap-3">
      <dl className="grid grid-cols-2 gap-2">
        <Metrica etiqueta="Costo unitario" valor={formatearMonto(resultado.costoUnitario)} pct={variaciones.costoUnitarioPct} subirEsBueno={false} />
        <Metrica etiqueta="Precio de venta" valor={formatearMonto(resultado.precio)} pct={variaciones.precioPct} subirEsBueno />
        <Metrica
          etiqueta="BEP (uds)"
          valor={resultado.puntoEquilibrio ? `${formatearCantidad(resultado.puntoEquilibrio)} uds` : "—"}
          pct={variaciones.equilibrioPct}
          subirEsBueno={false}
        />
        <Metrica etiqueta="Ganancia mensual" valor={formatearMonto(resultado.gananciaMensual)} pct={variaciones.gananciaPct} subirEsBueno />
      </dl>
      <div className="flex items-center justify-between rounded-xl bg-primary-50 px-4 py-3">
        <span className="text-sm text-gray-700">Margen neto</span>
        <span className={`text-2xl font-extrabold ${Number(resultado.margenNetoPct) < 0 ? "text-danger-700" : "text-primary-600"}`}>
          {formatearPorcentaje(resultado.margenNetoPct)}
        </span>
      </div>
    </div>
  );
}

function Metrica({
  etiqueta,
  valor,
  pct,
  subirEsBueno,
}: {
  etiqueta: string;
  valor: string;
  pct: string | null;
  subirEsBueno: boolean;
}) {
  const cambio = pct === null ? 0 : Number(pct);
  const sinCambio = Math.abs(cambio) < 0.05;
  const bueno = subirEsBueno ? cambio > 0 : cambio < 0;
  const color = sinCambio ? "text-gray-500" : bueno ? "text-success-700" : "text-danger-700";
  const flecha = cambio < 0 ? "▼" : "▲";

  return (
    <div className="rounded-xl bg-gray-50 p-3">
      <dt className="text-xs text-gray-500">{etiqueta}</dt>
      <dd className="mt-1 text-sm font-semibold text-gray-900">{valor}</dd>
      {pct === null ? null : (
        <dd className={`mt-0.5 text-xs font-medium ${color}`}>
          <span aria-hidden="true">{flecha} </span>
          {formatearVariacion(pct)}
          <span className="sr-only">
            {sinCambio ? " sin cambios" : bueno ? " mejora" : " empeora"} respecto de la situación actual
          </span>
        </dd>
      )}
    </div>
  );
}