"use client";

import { useRef, useState, type KeyboardEvent, type ReactNode } from "react";

import { BotonGuardar } from "@/components/calculadora/boton-guardar";
import { ComparacionEscenarios, type EscenarioConResultado } from "@/components/calculadora/comparacion-escenarios";
import { ResumenFinal } from "@/components/calculadora/resumen-final";
import { Aviso } from "@/components/ui/aviso";
import { Boton, BotonLink } from "@/components/ui/boton";
import { IndicadorCambio } from "@/components/ui/indicador-cambio";
import { DialogoConfirmar } from "@/components/ui/dialogo-confirmar";
import { Tarjeta } from "@/components/ui/tarjeta";
import type { CambiosEscenario } from "@/domain/calculo";
import { compararConBase, type IndicadorId } from "@/domain/motor/comparacion";
import {
  metaDeVentas,
  simularVariaciones,
  situacionBase,
  VARIACION_MAXIMA_PCT,
  VARIACION_MINIMA_PCT,
  type ResultadoEscenario,
  type Situacion,
} from "@/domain/motor/escenarios";
import { MAX_ESCENARIOS, type EscenarioUsuario } from "@/domain/types";
import { useAnalisisPrecio } from "@/hooks/use-analisis-precio";
import { useHidratado } from "@/hooks/use-hidratado";
import { formatearCantidad, formatearMonto, formatearPorcentaje, formatearUnidades } from "@/lib/formato";
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

/** Un campo vacío cuenta como «sin cambio» al simular. */
const comoPct = (valor: string) => (valor.trim() === "" ? "0" : valor);

/** Deja el valor escrito dentro del rango permitido. Vacío o inválido pasa a «0». */
function limitarPct(valor: string): string {
  const n = Number(valor);
  if (valor.trim() === "" || Number.isNaN(n)) return "0";
  return String(Math.min(Math.max(n, VARIACION_MINIMA_PCT), VARIACION_MAXIMA_PCT));
}

/** Paso 5 — «Simulador de escenarios» (Vista 5 del diseño). */
export function VistaSimulador() {
  const hidratado = useHidratado();
  return hidratado ? <Simulador /> : <Esqueleto />;
}

function Simulador() {
  const agregarEscenario = useCalculoStore((s) => s.agregarEscenario);
  const duplicarEscenario = useCalculoStore((s) => s.duplicarEscenario);
  const actualizarEscenario = useCalculoStore((s) => s.actualizarEscenario);
  const eliminarEscenario = useCalculoStore((s) => s.eliminarEscenario);
  const { calculo, resumen, precio, analisis } = useAnalisisPrecio();
  const [idAEliminar, setIdAEliminar] = useState<string | null>(null);
  const [idActivo, setIdActivo] = useState<string | null>(null);

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
      simularVariaciones(calculo, precio, {
        insumosPct: comoPct(e.insumosPct),
        precioPct: comoPct(e.precioPct),
        produccionPct: comoPct(e.produccionPct),
      }),
    ]),
  );
  const paraComparar: EscenarioConResultado[] = escenarios.flatMap((escenario) => {
    const resultado = resultados.get(escenario.id);
    return resultado ? [{ escenario, resultado }] : [];
  });
  const llegoAlMaximo = escenarios.length >= MAX_ESCENARIOS;
  const escenarioAEliminar = escenarios.find((e) => e.id === idAEliminar) ?? null;
  // Se muestra un escenario a la vez: el elegido, o el primero si el elegido ya no existe (por ejemplo, se eliminó).
  const escenarioActivo = escenarios.find((e) => e.id === idActivo) ?? escenarios[0] ?? null;

  /** Ejecuta la acción (agregar o duplicar) y pasa a la pestaña del escenario que quedó nuevo. */
  function conNuevoActivo(accion: () => void) {
    const antes = new Set(useCalculoStore.getState().calculo.escenarios.map((e) => e.id));
    accion();
    const nuevo = useCalculoStore.getState().calculo.escenarios.find((e) => !antes.has(e.id));
    if (nuevo) setIdActivo(nuevo.id);
  }
  const producto = calculo.configuracion.nombre.trim();

  return (
    <div className="flex flex-col gap-8">
      <div>
        <p className="mb-1 text-xs font-bold uppercase tracking-widest text-primary-600">Paso 5 de 5</p>
        <h1 className="text-3xl font-bold tracking-tight text-gray-900">¿Qué pasa si…?</h1>
        <p className="mt-2 text-lg text-gray-700">
          Combiná cambios de costos, precio y producción para comparar distintos escenarios.
        </p>
      </div>

      <section aria-labelledby="base" className="rounded-2xl bg-primary-900 p-6 text-white shadow-sm">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="base" className="text-xs font-bold uppercase tracking-widest text-gray-300">
            Situación actual (base)
          </h2>
          {producto ? <p className="text-sm font-semibold">{producto}</p> : null}
        </div>
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

      {escenarioActivo === null ? (
        <>
          <Aviso tono="consejo">No tenés escenarios. Agregá uno para empezar a comparar.</Aviso>
          <BotonAgregar llegoAlMaximo={llegoAlMaximo} onAgregar={() => conNuevoActivo(agregarEscenario)} />
        </>
      ) : (
        <section aria-labelledby="escenarios" className="flex flex-col gap-4">
          <h2 id="escenarios" className="text-xs font-bold uppercase tracking-widest text-gray-900">
            Tus escenarios
          </h2>
          <PestanasEscenarios
            escenarios={escenarios}
            idActivo={escenarioActivo.id}
            onElegir={setIdActivo}
            onAgregar={() => conNuevoActivo(agregarEscenario)}
            llegoAlMaximo={llegoAlMaximo}
          />
          <div role="tabpanel" id={`panel-${escenarioActivo.id}`} aria-labelledby={`pestana-${escenarioActivo.id}`}>
            <TarjetaEscenario
              key={escenarioActivo.id}
              escenario={escenarioActivo}
              base={base}
              resultado={resultados.get(escenarioActivo.id) ?? null}
              puedeDuplicar={!llegoAlMaximo}
              onCambiar={(cambios) => actualizarEscenario(escenarioActivo.id, cambios)}
              onDuplicar={() => conNuevoActivo(() => duplicarEscenario(escenarioActivo.id))}
              onEliminar={() => setIdAEliminar(escenarioActivo.id)}
            />
          </div>
          {llegoAlMaximo ? (
            <p className="text-sm text-gray-700">Llegaste al máximo de {MAX_ESCENARIOS} escenarios.</p>
          ) : null}
        </section>
      )}

      {paraComparar.length > 1 ? (
        <details className="group rounded-2xl border border-gray-200 bg-white shadow-sm">
          <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-2 rounded-2xl px-6 py-4 text-base font-semibold text-gray-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-700 [&::-webkit-details-marker]:hidden">
            Comparar todos mis escenarios
            <span aria-hidden="true" className="text-gray-700 transition-transform group-open:rotate-180">
              ▾
            </span>
          </summary>
          <div className="border-t border-gray-200 p-4 sm:p-6">
            <ComparacionEscenarios base={base} escenarios={paraComparar} />
          </div>
        </details>
      ) : null}

      {/*
        Resumen final (lo armó xandcari): ya no se ve en la pantalla, porque en Figma se descarga desde el panel
        («Guardar resumen» / «Guardar como imagen»). Queda montado fuera de la vista para imprimirlo o capturarlo;
        al imprimir, `globals.css` lo muestra solo a él. `inert` evita que el teclado o el lector de pantalla lo recorran.
      */}
      {analisis ? (
        <div inert className="pointer-events-none fixed top-0 -left-[10000px] w-[56rem] print:static print:w-auto">
          <ResumenFinal calculo={calculo} resumen={resumen} analisis={analisis} />
        </div>
      ) : null}

      <Tarjeta aria-labelledby="siguiente-paso" className="flex flex-col gap-4">
        <h2 id="siguiente-paso" className="text-base font-semibold text-gray-900">
          ¿Cuál es el siguiente paso?
        </h2>
        <ul className="grid gap-4 md:grid-cols-3">
          <SiguientePaso icono={ICONOS_PASO.objetivo} titulo="Fijar mi precio con confianza">
            Ya tenés todos los datos para salir al mercado con un precio fundamentado.
          </SiguientePaso>
          <SiguientePaso icono={ICONOS_PASO.barras} titulo="Establecer una meta de ventas mensual">
            {meta
              ? `Apuntá a vender al menos ${formatearUnidades(meta)}/mes para tener ganancia real.`
              : "Apuntá a vender por encima de tu punto de equilibrio para tener ganancia real."}
          </SiguientePaso>
          <SiguientePaso icono={ICONOS_PASO.repetir} titulo="Revisar costos cada 3 meses">
            Los precios cambian. Actualizá este cálculo cuando cambien tus insumos o tu tarifa.
          </SiguientePaso>
        </ul>
      </Tarjeta>

      {/* En Figma solo queda «Atrás»: para empezar otro cálculo está «Reiniciar» arriba. */}
      <div>
        <BotonLink href="/calculadora/precio" variante="secundario">
          Atrás
        </BotonLink>
      </div>

      <BotonGuardar />

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
    </div>
  );
}

function BotonAgregar({ llegoAlMaximo, onAgregar }: { llegoAlMaximo: boolean; onAgregar: () => void }) {
  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={onAgregar}
        disabled={llegoAlMaximo}
        className="min-h-11 w-full rounded-xl border border-dashed border-gray-400 bg-transparent px-5 py-3 text-sm font-medium text-gray-900 hover:bg-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-700 disabled:cursor-not-allowed disabled:opacity-50"
      >
        + Agregar escenario
      </button>
      {llegoAlMaximo ? <p className="text-sm text-gray-700">Llegaste al máximo de {MAX_ESCENARIOS} escenarios.</p> : null}
    </div>
  );
}

/** Pestañas (una por escenario). Flechas ← → mueven entre ellas, como en un tablist estándar. */
function PestanasEscenarios({
  escenarios,
  idActivo,
  onElegir,
  onAgregar,
  llegoAlMaximo,
}: {
  escenarios: EscenarioUsuario[];
  idActivo: string;
  onElegir: (id: string) => void;
  onAgregar: () => void;
  llegoAlMaximo: boolean;
}) {
  const lista = useRef<HTMLDivElement>(null);

  function alTeclear(e: KeyboardEvent<HTMLDivElement>) {
    const indice = escenarios.findIndex((x) => x.id === idActivo);
    let destino = indice;
    if (e.key === "ArrowRight") destino = (indice + 1) % escenarios.length;
    else if (e.key === "ArrowLeft") destino = (indice - 1 + escenarios.length) % escenarios.length;
    else if (e.key === "Home") destino = 0;
    else if (e.key === "End") destino = escenarios.length - 1;
    else return;
    e.preventDefault();
    onElegir(escenarios[destino].id);
    lista.current?.querySelector<HTMLElement>(`[id="pestana-${escenarios[destino].id}"]`)?.focus();
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div ref={lista} role="tablist" aria-label="Escenarios" onKeyDown={alTeclear} className="flex flex-wrap gap-2">
        {escenarios.map((e) => {
          const activa = e.id === idActivo;
          return (
            <button
              key={e.id}
              id={`pestana-${e.id}`}
              type="button"
              role="tab"
              aria-selected={activa}
              aria-controls={`panel-${e.id}`}
              tabIndex={activa ? 0 : -1}
              onClick={() => onElegir(e.id)}
              className={`min-h-11 max-w-48 truncate rounded-xl border px-4 py-2 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-700 ${
                activa
                  ? "border-primary-900 bg-primary-900 text-white"
                  : "border-gray-400 bg-white text-gray-900 hover:bg-gray-50"
              }`}
            >
              {e.nombre.trim() || "Sin nombre"}
            </button>
          );
        })}
      </div>
      <button
        type="button"
        onClick={onAgregar}
        disabled={llegoAlMaximo}
        className="min-h-11 rounded-xl border border-dashed border-gray-400 bg-transparent px-4 py-2 text-sm font-medium text-gray-900 hover:bg-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-700 disabled:cursor-not-allowed disabled:opacity-50"
      >
        + Agregar escenario
      </button>
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

const trazo = {
  width: 20,
  height: 20,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
};

/** Íconos de línea del Figma para «¿Cuál es el siguiente paso?». */
const ICONOS_PASO = {
  objetivo: (
    <svg {...trazo}>
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="5" />
      <path d="m12 12 7-7M16 5h3v3" />
    </svg>
  ),
  barras: (
    <svg {...trazo}>
      <path d="M4 20h16M7 16v-4M11 16V8M15 16v-6M19 16V6" />
    </svg>
  ),
  repetir: (
    <svg {...trazo}>
      <path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
      <path d="M3 3v5h5" />
    </svg>
  ),
};

function SiguientePaso({ icono, titulo, children }: { icono: ReactNode; titulo: string; children: ReactNode }) {
  return (
    <li className="rounded-xl bg-primary-100 p-4">
      <span className="text-gray-900">{icono}</span>
      <h3 className="mt-2 text-base font-semibold text-gray-900">{titulo}</h3>
      <p className="mt-2 text-sm text-gray-700">{children}</p>
    </li>
  );
}

function TarjetaEscenario({
  escenario,
  base,
  resultado,
  puedeDuplicar,
  onCambiar,
  onDuplicar,
  onEliminar,
}: {
  escenario: EscenarioUsuario;
  base: Situacion;
  resultado: ResultadoEscenario | null;
  puedeDuplicar: boolean;
  onCambiar: (cambios: CambiosEscenario) => void;
  onDuplicar: () => void;
  onEliminar: () => void;
}) {
  const idNombre = `nombre-${escenario.id}`;

  return (
    <Tarjeta aria-labelledby={idNombre} className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <span className="text-gray-900">
          <svg {...trazo}>
            <path d="m3 17 6-6 4 4 8-8" />
            <path d="M15 7h6v6" />
          </svg>
        </span>
        <label htmlFor={idNombre} className="sr-only">
          Nombre del escenario
        </label>
        <input
          id={idNombre}
          type="text"
          value={escenario.nombre}
          maxLength={40}
          onChange={(e) => onCambiar({ nombre: e.target.value })}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-base text-gray-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-600"
        />
      </div>

      <div className="flex flex-col gap-3">
        <ControlVariacion
          id={`insumos-${escenario.id}`}
          etiqueta="¿Cuánto cambian tus costos por unidad? (insumos, envases)"
          valor={escenario.insumosPct}
          onCambiar={(v) => onCambiar({ insumosPct: v })}
        />
        <ControlVariacion
          id={`precio-${escenario.id}`}
          etiqueta="¿Cuánto cambia tu precio de venta?"
          valor={escenario.precioPct}
          onCambiar={(v) => onCambiar({ precioPct: v })}
        />
        <ControlVariacion
          id={`produccion-${escenario.id}`}
          etiqueta="¿Cuánto cambia la cantidad que producís?"
          valor={escenario.produccionPct}
          onCambiar={(v) => onCambiar({ produccionPct: v })}
        />
      </div>

      {resultado ? <Resultado base={base} resultado={resultado} /> : null}

      <div className="grid grid-cols-2 gap-2">
        <Boton variante="secundario" onClick={onDuplicar} disabled={!puedeDuplicar} className="text-gray-900">
          Duplicar<span className="sr-only"> {escenario.nombre}</span>
        </Boton>
        <Boton variante="secundario" onClick={onEliminar} className="text-gray-900">
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
  const numero = Number(valor) || 0;
  const signo = numero > 0 ? "+" : "";

  return (
    <div>
      <div className="flex items-center justify-between gap-2 text-sm">
        <label htmlFor={id} className="text-gray-700">
          {etiqueta}
        </label>
        {/* Se puede escribir el porcentaje exacto o mover la barra; al salir del campo se ajusta al rango permitido. */}
        <div className="flex items-center gap-1">
          <input
            type="number"
            inputMode="decimal"
            aria-label={`${etiqueta}, valor exacto en porcentaje`}
            min={VARIACION_MINIMA_PCT}
            max={VARIACION_MAXIMA_PCT}
            step={1}
            value={valor}
            onChange={(e) => onCambiar(e.target.value)}
            onBlur={() => {
              const limpio = limitarPct(valor);
              if (limpio !== valor) onCambiar(limpio);
            }}
            className="w-20 rounded-lg border border-gray-500 px-2 py-1 text-right font-semibold text-gray-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-600"
          />
          <span aria-hidden="true" className="font-semibold text-gray-900">
            %
          </span>
        </div>
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
        className="mt-1 h-6 w-full cursor-pointer accent-primary-600"
      />
      <div className="mt-1 flex justify-between text-xs text-gray-500" aria-hidden="true">
        <span>{VARIACION_MINIMA_PCT}%</span>
        <span>0%</span>
        <span>+{VARIACION_MAXIMA_PCT}%</span>
      </div>
    </div>
  );
}

/** Las cinco métricas de cada escenario, en el orden del Figma. */
const METRICAS: { id: IndicadorId; etiqueta: string; unidad: "monto" | "unidades" | "puntos"; valor: (r: ResultadoEscenario) => string }[] = [
  { id: "costoUnitario", etiqueta: "Costo unitario", unidad: "monto", valor: (r) => formatearMonto(r.costoUnitario) },
  { id: "precio", etiqueta: "Precio de venta", unidad: "monto", valor: (r) => formatearMonto(r.precio) },
  { id: "margenNeto", etiqueta: "Margen neto", unidad: "puntos", valor: (r) => formatearPorcentaje(r.margenNetoPct) },
  {
    id: "puntoEquilibrio",
    etiqueta: "Punto de equilibrio",
    unidad: "unidades",
    valor: (r) => (r.puntoEquilibrio ? `${formatearCantidad(r.puntoEquilibrio)} uds` : "—"),
  },
  { id: "gananciaMensual", etiqueta: "Ganancia mensual", unidad: "monto", valor: (r) => formatearMonto(r.gananciaMensual) },
];

/** Indicadores que se ven siempre; el resto queda bajo «Ver todos los indicadores». */
const METRICAS_PRINCIPALES: IndicadorId[] = ["gananciaMensual", "puntoEquilibrio", "costoUnitario"];

function Resultado({ base, resultado }: { base: Situacion; resultado: ResultadoEscenario }) {
  // La misma comparación que usa la tabla (motor): la tarjeta y la tabla nunca dicen cosas distintas.
  const comparacion = compararConBase(base, resultado);
  const principales = METRICAS_PRINCIPALES.flatMap((id) => METRICAS.filter((m) => m.id === id));
  const otras = METRICAS.filter((m) => !METRICAS_PRINCIPALES.includes(m.id));
  const tarjeta = (m: (typeof METRICAS)[number]) => (
    <div key={m.id} className="rounded-xl bg-gray-100 p-3">
      <dt className="text-xs text-gray-700">{m.etiqueta}</dt>
      <dd className="mt-1 text-base font-bold text-gray-900">{m.valor(resultado)}</dd>
      <dd>
        <IndicadorCambio cambio={comparacion[m.id]} unidad={m.unidad} nombre={m.etiqueta} />
      </dd>
    </div>
  );
  return (
    <div aria-live="polite" className="flex flex-col gap-2">
      <dl className="grid grid-cols-1 gap-2 sm:grid-cols-3">{principales.map(tarjeta)}</dl>
      <details>
        <summary className="min-h-11 cursor-pointer py-2 text-sm font-semibold text-primary-700 underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-primary-700">
          Ver todos los indicadores
        </summary>
        <dl className="mt-2 grid grid-cols-2 gap-2">{otras.map(tarjeta)}</dl>
      </details>
    </div>
  );
}
