"use client";

import { usePathname } from "next/navigation";
import { useMemo, useState, type ReactNode } from "react";

import { DescargarResumen } from "@/components/calculadora/descargar-resumen";
import { Ayuda } from "@/components/ui/ayuda";
import { calcularResumenCostos } from "@/domain/motor/costos";
import { useAnalisisPrecio } from "@/hooks/use-analisis-precio";
import { formatearCantidad, formatearMonto } from "@/lib/formato";
import { useCalculoStore } from "@/store/calculo-store";

/** Un dato del panel. Va dentro de un <dl>: el <div> que envuelve <dt> y <dd> es la forma válida de agruparlos. */
function Fila({ etiqueta, valor, ayuda }: { etiqueta: string; valor: string; ayuda?: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="flex items-center gap-1.5 text-sm text-gray-700">
        {etiqueta}
        {ayuda}
      </dt>
      <dd className="text-sm font-semibold text-gray-900">{valor}</dd>
    </div>
  );
}

function Nota({ children }: { children: string }) {
  return <p className="-mt-2 text-right text-xs text-gray-500">{children}</p>;
}

/** Panel lateral «Resumen en vivo»: se recalcula con cada dato que carga el usuario. */
export function ResumenEnVivo() {
  const calculo = useCalculoStore((s) => s.calculo);
  // En Figma el desglose aparece abierto (Paso 3 y Paso 5).
  const [desglose, setDesglose] = useState(true);
  const resumen = useMemo(() => calcularResumenCostos(calculo), [calculo]);
  // En Figma, desde el paso «Precio» el panel suma precio, equilibrio y ganancia (valores que ya calcula el motor).
  const { analisis } = useAnalisisPrecio();
  const ruta = usePathname();
  const mostrarPrecio = analisis !== null && (ruta === "/calculadora/precio" || ruta === "/calculadora/simulador");
  const ganancia = analisis ? Number(analisis.gananciaNetaMensual) : 0;

  const { nombre, unidadVenta } = calculo.configuracion;
  const unidades = unidadVenta === "unidad" ? "unidades" : unidadVenta;

  let notaCostoUnitario = "Completá tus costos para ver este dato.";
  if (resumen.tieneImportesInvalidos) notaCostoUnitario = "Hay un importe que no es válido: revisá los costos y tu tiempo.";
  else if (!resumen.volumenMensual) notaCostoUnitario = "Completá las unidades por mes en «Tu producto».";
  else if (!resumen.tieneCostosFijos && !resumen.tieneCostosVariables) notaCostoUnitario = "Completá tus costos para ver este dato.";
  else if (!resumen.tieneCostosVariables) notaCostoUnitario = "Falta el costo variable por unidad.";
  else if (!resumen.tieneCostosFijos) notaCostoUnitario = "Falta cargar costos fijos o tu tiempo.";

  const costoUnitarioListo =
    !resumen.tieneImportesInvalidos && resumen.costoUnitario !== null && resumen.tieneCostosFijos && resumen.tieneCostosVariables;

  return (
    <aside aria-label="Resumen en vivo" className="rounded-2xl border border-gray-300 bg-white p-5 shadow-sm">
      <h2 className="text-xs font-bold uppercase tracking-widest text-primary-900">Resumen en vivo</h2>

      <div className="mt-3">
        <p className="font-semibold text-gray-900">{nombre.trim() || "Tu producto"}</p>
        <p className="text-sm text-gray-700">
          {resumen.volumenMensual
            ? `Volumen total: ${formatearCantidad(resumen.volumenMensual)} ${unidades}/mes`
            : "Completá las unidades por mes"}
        </p>
      </div>

      <div className="mt-4 flex flex-col gap-3">
        <dl>
          <Fila
            etiqueta="Costo Fijo Total/mes"
            valor={resumen.tieneCostosFijos ? formatearMonto(resumen.costoFijoTotalMensual) : "—"}
            ayuda={
              <Ayuda
                sobre="costo fijo total por mes"
                texto="Lo que pagás todos los meses aunque no produzcas nada, más tu tiempo y los costos indirectos."
              />
            }
          />
        </dl>
        {resumen.tieneCostosFijos ? (
          <div>
            <button
              type="button"
              aria-expanded={desglose}
              onClick={() => setDesglose((v) => !v)}
              className="relative text-sm font-medium text-gray-900 underline-offset-2 before:absolute before:inset-x-0 before:-inset-y-3 before:content-[''] hover:underline focus-visible:outline-2 focus-visible:outline-primary-600"
            >
              {desglose ? "ocultar desglose ▲" : "ver desglose ▼"}
            </button>
            {desglose ? (
              <dl className="mt-2 flex flex-col gap-1.5 border-l-2 border-gray-300 pl-3">
                <Fila etiqueta="Gastos fijos" valor={formatearMonto(resumen.totalGastosFijosMensual)} />
                <Fila etiqueta="Tu tiempo" valor={formatearMonto(resumen.totalTrabajoPropioMensual)} />
                <Fila etiqueta="Indirectos" valor={formatearMonto(resumen.totalIndirectosMensual)} />
              </dl>
            ) : null}
          </div>
        ) : (
          <Nota>Completá tus costos fijos</Nota>
        )}
        <dl>
          <Fila etiqueta="Variables/unidad" valor={resumen.tieneCostosVariables ? formatearMonto(resumen.costoVariableUnitario) : "—"} />
        </dl>
        {resumen.tieneCostosVariables ? null : <Nota>Completá costos variables</Nota>}
      </div>

      <div className="mt-4 border-t border-gray-300 pt-4" aria-live="polite">
        <p className="text-sm text-gray-700">Costo unitario real</p>
        <p className={`mt-1 text-3xl font-bold ${costoUnitarioListo ? "text-gray-900" : "text-gray-500"}`}>
          {costoUnitarioListo ? formatearMonto(resumen.costoUnitario) : "$ —"}
        </p>
        {costoUnitarioListo ? null : <p className="mt-1 text-xs text-gray-500">{notaCostoUnitario}</p>}
      </div>

      {mostrarPrecio && analisis ? (
        <dl className="mt-4 flex flex-col gap-2 border-t border-gray-300 pt-4" aria-live="polite">
          <Fila etiqueta="Precio de venta" valor={formatearMonto(analisis.precio)} />
          <Fila
            etiqueta="Punto de equilibrio"
            valor={analisis.puntoEquilibrioUnidades ? `${formatearCantidad(analisis.puntoEquilibrioUnidades)} ${unidades}` : "—"}
          />
          <div className="flex items-baseline justify-between gap-3">
            <dt className="text-sm text-gray-700">Ganancia mensual</dt>
            <dd className={`text-sm font-bold ${ganancia < 0 ? "text-danger-700" : "text-success-700"}`}>
              {formatearMonto(analisis.gananciaNetaMensual)}
            </dd>
          </div>
        </dl>
      ) : null}

      {/* Solo en el simulador (Figma, Paso 5): descargar el resumen final que arma esa pantalla. */}
      {ruta === "/calculadora/simulador" && analisis ? <DescargarResumen producto={nombre.trim()} /> : null}
    </aside>
  );
}
