"use client";

import Decimal from "decimal.js";
import { useId } from "react";

import { Aviso } from "@/components/ui/aviso";
import { Ayuda } from "@/components/ui/ayuda";
import { BotonLink } from "@/components/ui/boton";
import { CampoMonto } from "@/components/ui/campo-monto";
import { ComoSeCalcula } from "@/components/ui/como-se-calcula";
import { GraficoPrecio } from "@/components/calculadora/grafico-precio";
import { Tarjeta } from "@/components/ui/tarjeta";
import { MARGEN_MAXIMO_PCT, nivelDeMargen, precioPorMargen, type NivelMargen } from "@/domain/motor/precio";
import { useAnalisisPrecio } from "@/hooks/use-analisis-precio";
import { useHidratado } from "@/hooks/use-hidratado";
import { formatearCantidad, formatearMonto, formatearPorcentaje } from "@/lib/formato";
import type { ModoPrecio } from "@/domain/types";
import { useCalculoStore } from "@/store/calculo-store";

const MARGEN_RECOMENDADO = 40;

// El margen «alto» (60 % o más) ya no sale en verde: se muestra aparte como advertencia (ver AvisoMargenAlto).
const MENSAJES_MARGEN: Record<Exclude<NivelMargen, "alto">, { texto: string; bueno: boolean }> = {
  "muy-bajo": { texto: "Margen muy bajo: cualquier imprevisto te puede hacer perder plata.", bueno: false },
  bajo: { texto: "Margen ajustado: alcanza, pero con poco colchón para imprevistos.", bueno: false },
  bueno: { texto: "Buen margen para sostener el negocio y tener colchón para imprevistos.", bueno: true },
};

/**
 * Cuántas veces el costo unitario queda el precio con este margen: 100 ÷ (100 − margen).
 * Solo para el texto del aviso: es la misma relación que usa el motor (costo ÷ (1 − margen)), no calcula ningún precio.
 * Ej.: 60 % → 2,5; 90 % → 10; 99 % → 100.
 */
function vecesElCosto(margen: number): string {
  return new Decimal(100).div(new Decimal(100).minus(margen)).toString();
}

function AvisoMargenAlto({ margen }: { margen: number }) {
  return (
    <Aviso tono="advertencia" titulo="Margen alto">
      Con un margen del {margen}%, tu precio de venta queda en <strong>{formatearCantidad(vecesElCosto(margen))} veces</strong>{" "}
      tu costo por unidad. Revisá que tus clientes estén dispuestos a pagarlo.
    </Aviso>
  );
}

const PESTAÑAS: { modo: ModoPrecio; etiqueta: string }[] = [
  { modo: "margen", etiqueta: "Precio por margen" },
  { modo: "manual", etiqueta: "Ingresá tu precio" },
];

function Esqueleto() {
  return (
    <div aria-busy="true" aria-label="Cargando tu cálculo" className="flex animate-pulse flex-col gap-6">
      <div className="h-8 w-2/3 rounded-lg bg-gray-200" />
      <div className="h-64 rounded-2xl bg-gray-100" />
    </div>
  );
}

/** Paso 4 — «Precio y punto de equilibrio» (Vista 4 del diseño). */
export function VistaPrecio() {
  const hidratado = useHidratado();
  return hidratado ? <Precio /> : <Esqueleto />;
}

function Precio() {
  const { calculo, resumen, analisis } = useAnalisisPrecio();
  const actualizarPrecio = useCalculoStore((s) => s.actualizarPrecio);
  const cambiarPaso = useCalculoStore((s) => s.cambiarPaso);
  const idPanel = useId();

  const { modo, margenPct, precioManual } = calculo.precio;
  const hayCostos = resumen.costoUnitario !== null && (resumen.tieneCostosFijos || resumen.tieneCostosVariables);

  if (!hayCostos) {
    const faltaVolumen = resumen.volumenMensual === null;
    return (
      <div className="flex flex-col items-start gap-6">
        <h1 className="text-3xl font-bold tracking-tight text-gray-900">Primero necesitamos tus costos</h1>
        <Aviso tono="advertencia">
          {faltaVolumen
            ? "Contanos cuántas unidades producís por mes para poder calcular tu precio."
            : "Cargá al menos un costo fijo o variable para poder sugerirte un precio."}
        </Aviso>
        <BotonLink href={faltaVolumen ? "/calculadora/producto" : "/calculadora/costos"}>
          {faltaVolumen ? "Ir a «Tu producto»" : "Ir a los costos"}
        </BotonLink>
      </div>
    );
  }

  const margen = Number(margenPct) || 0;
  const nivel = nivelDeMargen(margenPct);
  const precioSugerido = precioPorMargen(calculo, margenPct);

  return (
    <div className="flex flex-col gap-8">
      <div>
        <p className="mb-1 text-xs font-bold uppercase tracking-widest text-primary-600">Paso 4 de 5</p>
        <h1 className="text-3xl font-bold tracking-tight text-gray-900">¿A qué precio lo vas a vender?</h1>
        <p className="mt-2 text-lg text-gray-700">
          Podés dejar que te sugiramos un precio según tu margen esperado, o ingresar el tuyo directamente.
        </p>
      </div>

      <div role="tablist" aria-label="Cómo definir el precio" className="grid grid-cols-2 gap-1 rounded-xl bg-gray-100 p-1">
        {PESTAÑAS.map((p) => {
          const activa = modo === p.modo;
          return (
            <button
              key={p.modo}
              type="button"
              role="tab"
              id={`${idPanel}-${p.modo}`}
              aria-selected={activa}
              aria-controls={`${idPanel}-panel`}
              onClick={() => actualizarPrecio({ modo: p.modo })}
              className={`rounded-lg px-4 py-3 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-primary-600 ${
                activa ? "bg-white text-primary-600 shadow-sm" : "text-gray-500 hover:text-gray-900"
              }`}
            >
              {p.etiqueta}
            </button>
          );
        })}
      </div>

      <div id={`${idPanel}-panel`} role="tabpanel" aria-labelledby={`${idPanel}-${modo}`}>
        {modo === "margen" ? (
          <Tarjeta className="flex flex-col gap-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <label htmlFor="margen" className="text-base font-medium text-gray-900">
                  Margen esperado
                </label>
                <Ayuda
                  sobre="margen esperado"
                  texto="Es la parte del precio de venta que te queda como ganancia sobre el costo de cada unidad."
                  ejemplo="con un margen del 40 %, de cada $100 que cobrás, $40 son ganancia y $60 cubren el costo."
                />
              </div>
              <output htmlFor="margen" className="text-2xl font-extrabold text-primary-600">
                {margen}%
              </output>
            </div>

            <div>
              <input
                id="margen"
                type="range"
                min={0}
                max={MARGEN_MAXIMO_PCT}
                step={1}
                value={margen}
                aria-valuetext={`${margen} por ciento`}
                onChange={(e) => actualizarPrecio({ margenPct: e.target.value })}
                className="h-6 w-full cursor-pointer accent-primary-600"
              />
              <div className="relative mt-1 h-5 text-xs text-gray-500">
                <span className="absolute left-0">0%</span>
                <span
                  className="absolute -translate-x-1/2 font-medium text-primary-600"
                  style={{ left: `${(MARGEN_RECOMENDADO / MARGEN_MAXIMO_PCT) * 100}%` }}
                >
                  {MARGEN_RECOMENDADO}% recomendado
                </span>
                <span className="absolute right-0">{MARGEN_MAXIMO_PCT}%</span>
              </div>
              {/* Explicación del margen (Figma). Solo texto con el % elegido: no calcula nada. */}
              <ComoSeCalcula
                etiqueta="¿Cómo lo calculo?"
                formula="De cada $100 que cobrás, ¿cuántos querés que te queden?"
                cuenta={`Ej.: margen ${margen}% → de cada $100 cobrados, $${margen} son ganancia.`}
              />
            </div>

            {nivel === "alto" ? (
              <AvisoMargenAlto margen={margen} />
            ) : nivel ? (
              <p className={`flex items-start gap-1.5 text-sm font-medium ${MENSAJES_MARGEN[nivel].bueno ? "text-success-700" : "text-warning-700"}`}>
                <span aria-hidden="true">{MENSAJES_MARGEN[nivel].bueno ? "✓" : "⚠"}</span>
                <span>{MENSAJES_MARGEN[nivel].texto}</span>
              </p>
            ) : null}

            <div className="rounded-xl bg-primary-50 p-4">
              <div className="flex items-center gap-2 text-sm text-gray-700">
                Precio sugerido por unidad
                <Ayuda
                  sobre="precio sugerido"
                  texto="Es el costo unitario dividido por (1 − margen): el precio que necesitás para ganar ese margen."
                />
              </div>
              <p className="mt-1 text-2xl font-extrabold text-primary-600" aria-live="polite">
                {formatearMonto(precioSugerido)}
              </p>
              {precioSugerido ? (
                <ComoSeCalcula
                  formula="Costo unitario ÷ (1 − margen)"
                  cuenta={`${formatearMonto(resumen.costoUnitario)} ÷ (1 − ${formatearPorcentaje(margenPct)}) = ${formatearMonto(precioSugerido)}`}
                />
              ) : null}
            </div>
          </Tarjeta>
        ) : (
          <Tarjeta className="flex flex-col gap-4">
            <label htmlFor="precio-manual" className="text-base font-medium text-gray-900">
              Tu precio de venta al público
            </label>
            <CampoMonto
              id="precio-manual"
              placeholder="Ej: 7000"
              value={precioManual}
              onChange={(valor) => actualizarPrecio({ precioManual: valor })}
            />
            <div className="rounded-xl bg-primary-50 p-4" aria-live="polite">
              <p className="text-sm text-gray-700">Margen resultante</p>
              <p className={`mt-1 text-2xl font-extrabold ${analisis && Number(analisis.margenResultantePct) < 0 ? "text-danger-700" : "text-primary-600"}`}>
                {analisis ? formatearPorcentaje(analisis.margenResultantePct) : "—"}
              </p>
            </div>
          </Tarjeta>
        )}
      </div>

      {analisis ? (
        <Resultados
          analisis={analisis}
          volumen={resumen.volumenMensual}
          costoVariable={resumen.costoVariableUnitario}
          costoFijo={resumen.costoFijoTotalMensual}
        />
      ) : (
        <Aviso tono="info">Ingresá tu precio de venta para ver tu contribución, tu ganancia y tu punto de equilibrio.</Aviso>
      )}

      <div className="flex items-center justify-between gap-3">
        <BotonLink href="/calculadora/resumen" variante="secundario">
          ← Atrás
        </BotonLink>
        <BotonLink href="/calculadora/simulador" onClick={() => cambiarPaso("simulador")}>
          Ver simulador →
        </BotonLink>
      </div>
    </div>
  );
}

function Resultados({
  analisis,
  volumen,
  costoVariable,
  costoFijo,
}: {
  analisis: NonNullable<ReturnType<typeof useAnalisisPrecio>["analisis"]>;
  volumen: string | null;
  /** Solo para mostrar las cuentas en «Ver cómo se calcula». */
  costoVariable: string;
  costoFijo: string;
}) {
  const pierdePorUnidad = Number(analisis.contribucion) <= 0;
  const ganancia = Number(analisis.gananciaNetaMensual);
  // Costos fijos = 0: el equilibrio da 0 unidades y $0, y no es un error (ganás desde la primera venta).
  const sinCostosFijos = analisis.estado !== "inalcanzable" && Number(analisis.puntoEquilibrioUnidades) === 0;

  return (
    <>
      <section
        aria-labelledby="contribucion"
        className={`rounded-2xl border p-5 ${pierdePorUnidad ? "border-danger-100 bg-danger-50" : "border-success-100 bg-success-50"}`}
      >
        <div className="flex items-center gap-2">
          <h2 id="contribucion" className="text-base font-medium text-gray-900">
            Margen de Contribución
          </h2>
          <Ayuda
            sobre="margen de contribución"
            texto="Lo que te queda de cada venta después de pagar los insumos, antes de cubrir tus gastos fijos."
            ejemplo="si vendés a $500 y los materiales costaron $85, tu contribución es $415 por unidad."
          />
        </div>
        <p className={`mt-1 flex items-baseline gap-2 ${pierdePorUnidad ? "text-danger-700" : "text-success-700"}`}>
          <span className="text-3xl font-extrabold tracking-tight">{formatearMonto(analisis.contribucion)}</span>
          <span className="text-sm font-semibold">por unidad</span>
        </p>
        {pierdePorUnidad ? (
          <p className="mt-1 text-sm text-danger-700">
            Con este precio no cubrís ni los insumos de cada unidad: cada venta suma pérdida.
          </p>
        ) : (
          <>
            <p className="mt-1 text-sm text-success-700">{formatearPorcentaje(analisis.contribucionPct)} del precio de venta</p>
            <p className="text-sm text-success-700">
              Cada venta contribuye con {formatearMonto(analisis.contribucion)} para cubrir los costos fijos.
            </p>
          </>
        )}
        {pierdePorUnidad ? null : (
          <ComoSeCalcula
            formula="Precio de venta − costo variable por unidad"
            cuenta={`${formatearMonto(analisis.precio)} − ${formatearMonto(costoVariable)} = ${formatearMonto(analisis.contribucion)}`}
          />
        )}
      </section>

      <Tarjeta aria-labelledby="proyeccion">
        <h2 id="proyeccion" className="text-sm font-medium text-gray-500">
          Proyección mensual
        </h2>
        <dl className="mt-3 flex flex-col gap-2 text-sm">
          <div className="flex items-baseline justify-between gap-3">
            <dt className="text-gray-700">Ingresos totales</dt>
            <dd className="font-medium text-gray-900">{formatearMonto(analisis.ingresosTotalesMensual)}</dd>
          </div>
          <div className="flex items-baseline justify-between gap-3">
            <dt className="text-gray-700">Costos totales</dt>
            <dd className="font-medium text-gray-900">{formatearMonto(analisis.costosTotalesMensual)}</dd>
          </div>
          <div className="flex items-baseline justify-between gap-3">
            <dt className="text-gray-700">Ganancia neta</dt>
            <dd className={`font-semibold ${ganancia < 0 ? "text-danger-700" : "text-success-700"}`}>
              {formatearMonto(analisis.gananciaNetaMensual)}
            </dd>
          </div>
        </dl>
      </Tarjeta>

      <section aria-labelledby="equilibrio" className="rounded-2xl bg-gray-900 p-6 text-white shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 text-sm text-gray-200">
              <h2 id="equilibrio" className="font-normal">
                Punto de equilibrio
              </h2>
              <Ayuda
                sobre="punto de equilibrio"
                texto="Es la cantidad mínima que tenés que vender en el mes para cubrir todos tus costos. Por debajo perdés plata, por encima ganás."
              />
            </div>
            {analisis.puntoEquilibrioUnidades ? (
              <>
                <p className="mt-1 text-3xl font-extrabold">{formatearCantidad(analisis.puntoEquilibrioUnidades)} unidades</p>
                <p className="mt-1 text-sm text-gray-200">Facturación mínima: {formatearMonto(analisis.facturacionMinima)}</p>
                {sinCostosFijos ? null : (
                  <ComoSeCalcula
                    tono="oscuro"
                    formula="Costo fijo total ÷ contribución por unidad, redondeado hacia arriba (no se puede vender media unidad)"
                    cuenta={`${formatearMonto(costoFijo)} ÷ ${formatearMonto(analisis.contribucion)} → ${formatearCantidad(analisis.puntoEquilibrioUnidades)} unidades`}
                  />
                )}
              </>
            ) : (
              <>
                {/* Sin equilibrio posible (contribución ≤ 0): guion en lugar de cifras. */}
                <p className="mt-1 text-3xl font-extrabold">-</p>
                <p className="mt-1 text-sm text-gray-200">Facturación mínima: -</p>
              </>
            )}
          </div>
          <EstadoEquilibrio estado={analisis.estado} />
        </div>
        {analisis.estado === "inalcanzable" ? (
          <p
            role="alert"
            className="mt-4 rounded-xl border border-danger-100 bg-danger-50 p-3 text-sm font-semibold text-danger-700"
          >
            ¡Atención! Tu precio no llega a cubrir el costo de tus materiales. Estás perdiendo dinero con cada venta y es
            imposible alcanzar el equilibrio. Subí tu precio urgente.
          </p>
        ) : (
          <p className={`mt-4 text-sm font-medium ${analisis.estado === "supera" ? "text-success-100" : "text-warning-500"}`}>
            {sinCostosFijos
              ? "Al no tener costos fijos, no tenés un punto de equilibrio mínimo. ¡Empezás a generar ganancia desde tu primera venta!"
              : analisis.estado === "supera"
                ? "¡Estás vendiendo bien por encima de tu piso! Cada unidad extra ya es ganancia pura."
                : "Necesitás aumentar el volumen o el precio para cubrir tus costos fijos."}
          </p>
        )}
        {volumen ? <p className="sr-only">Producís {formatearCantidad(volumen)} unidades por mes.</p> : null}
      </section>

      {/* En Figma el gráfico va a todo el ancho, debajo del punto de equilibrio. */}
      <GraficoPrecio />

      <Aviso tono="consejo">
        El punto de equilibrio no es tu meta — es tu piso. Apuntá a vender al menos 30% más para tener una ganancia real.
      </Aviso>
    </>
  );
}

function EstadoEquilibrio({ estado }: { estado: "supera" | "bajo" | "inalcanzable" }) {
  if (estado === "supera") {
    return <span className="rounded-full bg-success-600 px-3 py-1 text-sm font-semibold text-white">✓ Superás el equilibrio</span>;
  }
  return (
    <span className="rounded-full bg-warning-500 px-3 py-1 text-sm font-semibold text-gray-900">
      ⚠ {estado === "bajo" ? "Bajo el equilibrio" : "Sin equilibrio"}
    </span>
  );
}
