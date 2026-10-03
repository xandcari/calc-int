"use client";

import Decimal from "decimal.js";
import { useMemo, type ReactNode } from "react";

import { Aviso } from "@/components/ui/aviso";
import { Ayuda } from "@/components/ui/ayuda";
import { BotonLink } from "@/components/ui/boton";
import { Tarjeta } from "@/components/ui/tarjeta";
import { calcularResumenCostos } from "@/domain/motor/costos";
import {
  composicionCostoUnitario,
  contribucionUnitaria,
  costoTotalPorLote,
  detalleDeCostos,
  MARGEN_REFERENCIA,
  precioSugerido,
  type LineaDetalle,
  type PartidaComposicion,
} from "@/domain/motor/resumen";
import { useHidratado } from "@/hooks/use-hidratado";
import { formatearCantidad, formatearMonto, formatearPorcentaje } from "@/lib/formato";
import { useCalculoStore } from "@/store/calculo-store";

function Esqueleto() {
  return (
    <div aria-busy="true" aria-label="Cargando tu cálculo" className="flex animate-pulse flex-col gap-6">
      <div className="h-8 w-2/3 rounded-lg bg-gray-200" />
      <div className="h-32 rounded-2xl bg-gray-100" />
      <div className="h-64 rounded-2xl bg-gray-100" />
    </div>
  );
}

/** Paso 3 — «Resumen de costos» (Vista 3 del diseño). */
export function VistaResumen() {
  const hidratado = useHidratado();
  return hidratado ? <Resumen /> : <Esqueleto />;
}

function Resumen() {
  const calculo = useCalculoStore((s) => s.calculo);
  const resumen = useMemo(() => calcularResumenCostos(calculo), [calculo]);
  const composicion = useMemo(() => composicionCostoUnitario(calculo), [calculo]);
  const detalle = useMemo(() => detalleDeCostos(calculo), [calculo]);

  const { nombre, unidadesPorLote, lotes, unidadVenta } = calculo.configuracion;
  const producto = nombre.trim();
  const unidades = unidadVenta === "unidad" ? "unidades" : unidadVenta;
  const hayDatos = resumen.costoUnitario !== null && (resumen.tieneCostosFijos || resumen.tieneCostosVariables);

  if (!hayDatos) {
    const faltaVolumen = resumen.volumenMensual === null;
    return (
      <div className="flex flex-col items-start gap-6">
        <h1 className="text-3xl font-bold tracking-tight text-gray-900">Todavía no hay costos para resumir</h1>
        <Aviso tono="advertencia">
          {faltaVolumen
            ? "Primero contanos cuántas unidades producís por mes."
            : "Cargá al menos un costo fijo o variable para ver el costo real de tu producto."}
        </Aviso>
        <BotonLink href={faltaVolumen ? "/calculadora/producto" : "/calculadora/costos"}>
          {faltaVolumen ? "Ir a «Tu producto»" : "Ir a los costos"}
        </BotonLink>
      </div>
    );
  }

  const costoUnitario = resumen.costoUnitario!;
  const porLote = costoTotalPorLote(costoUnitario, unidadesPorLote);
  const precio = precioSugerido(costoUnitario, MARGEN_REFERENCIA);
  const contribucion = precio ? contribucionUnitaria(precio, resumen.costoVariableUnitario) : null;

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-gray-900">
          El costo real de producir {producto ? `tu ${producto.toLowerCase()}` : "tu producto"}
        </h1>
        <p className="mt-2 text-lg text-gray-700">Revisá que todo esté completo antes de fijar el precio.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl bg-primary-600 p-5 text-white shadow-sm">
          <p className="text-sm font-medium">Costo unitario real</p>
          <p className="mt-2 text-3xl font-extrabold tracking-tight">{formatearMonto(costoUnitario)}</p>
          <p className="mt-2 text-sm text-primary-100">lo que te cuesta hacer una sola unidad</p>
        </div>
        <TarjetaDato titulo="Costo total por lote" valor={formatearMonto(porLote)}>
          {formatearCantidad(unidadesPorLote)} uds × {formatearCantidad(lotes)} lotes
        </TarjetaDato>
        <TarjetaDato titulo="Costo total mensual" valor={formatearMonto(resumen.costoTotalMensual)}>
          {formatearCantidad(resumen.volumenMensual)} {unidades}/mes
        </TarjetaDato>
      </div>

      {contribucion && precio ? (
        <section aria-labelledby="contribucion" className="rounded-2xl border border-success-100 bg-success-50 p-5">
          <div className="flex items-center gap-2">
            <h2 id="contribucion" className="text-base font-medium text-gray-900">
              Contribución por unidad
            </h2>
            <Ayuda
              sobre="contribución por unidad"
              texto="Lo que te queda de cada venta después de pagar los insumos, antes de cubrir tus gastos fijos."
              ejemplo="si vendés a $500 y los materiales costaron $85, tu contribución es $415 por unidad."
            />
          </div>
          <p className="mt-1 text-3xl font-extrabold tracking-tight text-success-700">{formatearMonto(contribucion)}</p>
          <p className="mt-1 text-sm text-success-700">
            {formatearMonto(precio)} − {formatearMonto(resumen.costoVariableUnitario)} = {formatearMonto(contribucion)}
          </p>
          <p className="mt-1 text-sm text-gray-700">Lo que deja cada unidad para cubrir los gastos fijos.</p>
        </section>
      ) : null}

      {composicion ? (
        <Tarjeta aria-labelledby="composicion">
          <h2 id="composicion" className="text-lg font-semibold text-gray-900">
            Composición del costo unitario
          </h2>
          <ul className="mt-4 flex flex-col gap-4">
            <FilaComposicion etiqueta="Trabajo propio" partida={composicion.trabajoPropio} color="bg-primary-600" />
            <FilaComposicion etiqueta="Gastos fijos" partida={composicion.gastosFijos} color="bg-success-600" />
            <FilaComposicion etiqueta="Costos indirectos" partida={composicion.indirectos} color="bg-violet-500" />
            <FilaComposicion etiqueta="Materiales / insumos" partida={composicion.materiales} color="bg-warning-500" />
          </ul>
        </Tarjeta>
      ) : null}

      <details open className="group rounded-2xl border border-gray-200 bg-white shadow-sm">
        <summary className="flex cursor-pointer list-none items-center justify-between rounded-2xl px-6 py-4 font-semibold text-primary-600 focus-visible:outline-2 focus-visible:outline-primary-600 [&::-webkit-details-marker]:hidden">
          Ver detalle completo de costos
          <span aria-hidden="true" className="text-sm transition-transform group-open:rotate-0 group-[:not([open])]:rotate-180">
            ▲
          </span>
        </summary>
        <div className="flex flex-col gap-5 border-t border-gray-100 px-6 py-5">
          <BloqueDetalle titulo="Gastos fijos" lineas={detalle.gastosFijos} />
          <BloqueDetalle titulo="Costos indirectos" lineas={detalle.indirectos} />
          <BloqueDetalle titulo="Costos variables por unidad" lineas={detalle.variables} />
          {detalle.trabajoPropio ? (
            <div>
              <h3 className="text-sm font-medium text-gray-500">Trabajo propio mensual</h3>
              <div className="mt-2 flex items-baseline justify-between gap-3 text-sm text-gray-700">
                <span>
                  {detalle.trabajoPropio.modo === "sueldo" ? (
                    "Sueldo pretendido"
                  ) : (
                    <>
                      {formatearCantidad(detalle.trabajoPropio.horasPorLote)} hs × {formatearMonto(detalle.trabajoPropio.valorHora)}/h ×{" "}
                      {formatearCantidad(detalle.trabajoPropio.lotes)} lotes
                    </>
                  )}
                </span>
                <span className="font-medium text-gray-900">{formatearMonto(detalle.trabajoPropio.totalMensual)}</span>
              </div>
            </div>
          ) : null}
        </div>
      </details>

      <Aviso tono="consejo">
        Si el costo unitario te sorprendió, revisá si podés negociar precios con proveedores o aumentar el volumen de
        producción.
      </Aviso>

      <div className="flex items-center justify-between gap-3">
        <BotonLink href="/calculadora/costos" variante="secundario">
          ← Atrás
        </BotonLink>
        <BotonLink href="/calculadora/precio">Ver resumen de costos →</BotonLink>
      </div>
    </div>
  );
}

function TarjetaDato({ titulo, valor, children }: { titulo: string; valor: string; children: ReactNode }) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
      <p className="text-sm font-medium text-gray-700">{titulo}</p>
      <p className="mt-2 text-3xl font-extrabold tracking-tight text-gray-900">{valor}</p>
      <p className="mt-2 text-sm text-gray-500">{children}</p>
    </div>
  );
}

function FilaComposicion({ etiqueta, partida, color }: { etiqueta: string; partida: PartidaComposicion; color: string }) {
  const ancho = Math.min(100, Math.max(0, Number(partida.porcentaje)));
  return (
    <li>
      <div className="flex items-baseline justify-between gap-3 text-sm">
        <span className="text-gray-700">{etiqueta}</span>
        <span className="font-medium text-gray-900">
          {formatearMonto(partida.porUnidad)} ({formatearPorcentaje(partida.porcentaje)})
        </span>
      </div>
      {/* La barra es decorativa: el dato completo está en el texto de arriba. */}
      <div aria-hidden="true" className="mt-1.5 h-2.5 overflow-hidden rounded-full bg-gray-100">
        <div className={`h-full min-w-2.5 rounded-full ${color}`} style={{ width: `${ancho}%` }} />
      </div>
    </li>
  );
}

function BloqueDetalle({ titulo, lineas }: { titulo: string; lineas: LineaDetalle[] }) {
  if (lineas.length === 0) return null;
  const total = lineas.reduce((acc, l) => acc.plus(l.monto), new Decimal(0));
  return (
    <div>
      <h3 className="text-sm font-medium text-gray-500">{titulo}</h3>
      <ul className="mt-2 divide-y divide-gray-100 text-sm">
        {lineas.map((l) => (
          <li key={l.id} className="flex items-baseline justify-between gap-3 py-2 text-gray-700">
            <span>{l.nombre}</span>
            <span>{formatearMonto(l.monto)}</span>
          </li>
        ))}
        <li className="flex items-baseline justify-between gap-3 py-2 font-semibold text-gray-900">
          <span>Total</span>
          <span>{formatearMonto(total.toString())}</span>
        </li>
      </ul>
    </div>
  );
}
