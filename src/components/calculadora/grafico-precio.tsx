"use client";

import Decimal from "decimal.js";
import { useEffect, useRef, useState } from "react";

import { Tarjeta } from "@/components/ui/tarjeta";
import { useHidratado } from "@/hooks/use-hidratado";
import { useAnalisisPrecio } from "@/hooks/use-analisis-precio";
import { formatearCantidad, formatearMonto } from "@/lib/formato";

// Va a todo el ancho del paso «Precio» (diseño de Figma). El ancho se mide en pantalla para que
// la letra quede siempre del mismo tamaño, también en el celular.
const ANCHO_INICIAL = 600;
const LETRA = 13;

/** Paso «bonito» (1, 2, 5 × 10ⁿ) para que el eje tenga unas 6 marcas. */
function pasoLindo(maximo: number, marcas: number): number {
  const bruto = maximo / marcas;
  const potencia = 10 ** Math.floor(Math.log10(bruto));
  const f = bruto / potencia;
  return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * potencia;
}

function abreviar(importe: number): string {
  if (importe === 0) return "$0";
  return importe >= 1000 ? `$${Math.round(importe / 1000)}k` : `$${Math.round(importe)}`;
}

type Analisis = NonNullable<ReturnType<typeof useAnalisisPrecio>["analisis"]>;
type DatosGrafico = NonNullable<ReturnType<typeof useAnalisisPrecio>["grafico"]>;

/** «Ingresos vs. Costos Totales»: el cruce de las líneas es el punto de equilibrio. */
export function GraficoPrecio() {
  const hidratado = useHidratado();
  const { grafico, analisis, resumen } = useAnalisisPrecio();

  return (
    <Tarjeta aria-labelledby="titulo-grafico">
      <h2 id="titulo-grafico" className="text-lg font-semibold text-gray-900">
        Ingresos vs. costos totales
      </h2>
      <p className="mt-1 text-sm text-gray-500">
        Donde se cruzan las líneas está tu punto de equilibrio: a la izquierda perdés plata, a la derecha ganás.
      </p>

      {!hidratado || !grafico || !analisis ? (
        <p className="mt-6 rounded-xl bg-gray-50 p-4 text-sm text-gray-500">
          Elegí tu precio para ver cuándo se cruzan tus ingresos con tus costos.
        </p>
      ) : analisis.estado === "inalcanzable" ? (
        // Contribución ≤ 0: las líneas nunca se cruzan, así que el gráfico queda bloqueado.
        <p className="mt-6 rounded-xl border border-danger-100 bg-danger-50 p-4 text-sm font-medium text-danger-700">
          Con este precio no hay punto de equilibrio, por eso no mostramos el gráfico. Subí tu precio por encima del costo
          de tus materiales para verlo.
        </p>
      ) : (
        <Grafico
          grafico={grafico}
          analisis={analisis}
          costoFijo={resumen.costoFijoTotalMensual}
          costoVariable={resumen.costoVariableUnitario}
          volumen={resumen.volumenMensual}
        />
      )}
    </Tarjeta>
  );
}

function Grafico({
  grafico,
  analisis,
  costoFijo,
  costoVariable,
  volumen,
}: {
  grafico: DatosGrafico;
  analisis: Analisis;
  costoFijo: string;
  costoVariable: string;
  volumen: string | null;
}) {
  const { puntos, maxUnidades, maxImporte, cruce } = grafico;
  const equilibrio = analisis.puntoEquilibrioUnidades;

  const contenedor = useRef<HTMLDivElement>(null);
  const [ANCHO, setAncho] = useState(ANCHO_INICIAL);
  useEffect(() => {
    const nodo = contenedor.current;
    if (!nodo) return;
    const observador = new ResizeObserver(([entrada]) => {
      const medido = Math.round(entrada.contentRect.width);
      if (medido > 0) setAncho(medido);
    });
    observador.observe(nodo);
    return () => observador.disconnect();
  }, []);

  const angosto = ANCHO < 480;
  const ALTO = Math.min(360, Math.max(260, Math.round(ANCHO * 0.58)));
  // A la derecha queda lugar para las etiquetas «Ingresos» y «Costos» al final de cada línea.
  const MARGEN = { arriba: 16, derecha: angosto ? 12 : 72, abajo: 48, izquierda: angosto ? 52 : 84 };

  const pasoX = pasoLindo(maxUnidades, 5);
  const topeX = Math.ceil(maxUnidades / pasoX) * pasoX;

  // Las rectas se prolongan hasta el final del eje (solo para dibujar; las cifras salen del motor).
  const [inicio, fin] = puntos;
  const valorEn = (campo: "ingresos" | "costos", u: number) =>
    inicio[campo] + ((fin[campo] - inicio[campo]) * u) / fin.unidades;
  const pasoY = pasoLindo(Math.max(maxImporte, valorEn("ingresos", topeX), valorEn("costos", topeX)), 4);
  const topeY = Math.ceil(Math.max(valorEn("ingresos", topeX), valorEn("costos", topeX)) / pasoY) * pasoY;

  const x = (u: number) => MARGEN.izquierda + (u / topeX) * (ANCHO - MARGEN.izquierda - MARGEN.derecha);
  const y = (v: number) => ALTO - MARGEN.abajo - (v / topeY) * (ALTO - MARGEN.arriba - MARGEN.abajo);

  const marcasX = Array.from({ length: Math.floor(topeX / pasoX) + 1 }, (_, i) => i * pasoX);
  const marcasY = Array.from({ length: Math.floor(topeY / pasoY) + 1 }, (_, i) => i * pasoY);
  const linea = (campo: "ingresos" | "costos") => `M${x(0)},${y(valorEn(campo, 0))} L${x(topeX)},${y(valorEn(campo, topeX))}`;

  const hayCruce = cruce !== null && cruce > 0 && cruce <= topeX;
  const xCruce = hayCruce ? x(cruce) : null;
  const yCruce = hayCruce ? y(valorEn("costos", cruce)) : null;
  const vol = volumen ? Number(volumen) : null;
  const xVolumen = vol !== null && vol > 0 && vol <= topeX ? x(vol) : null;
  const izquierda = MARGEN.izquierda;
  const derecha = ANCHO - MARGEN.derecha;
  const piso = ALTO - MARGEN.abajo;

  const descripcion = hayCruce
    ? `Gráfico de ingresos y costos totales según las unidades vendidas por mes. Las líneas se cruzan en ${formatearCantidad(equilibrio)} unidades.`
    : "Gráfico de ingresos y costos totales según las unidades vendidas por mes.";

  return (
    <div className="mt-4" ref={contenedor}>
      <ul className="mb-2 flex flex-wrap gap-5 text-sm text-gray-700">
        <li className="flex items-center gap-2">
          <span aria-hidden="true" className="flex items-center">
            <span className="h-0.5 w-3 bg-primary-600" />
            <span className="size-2 rounded-full bg-primary-600" />
            <span className="h-0.5 w-3 bg-primary-600" />
          </span>
          Ingresos
        </li>
        <li className="flex items-center gap-2">
          <span aria-hidden="true" className="flex items-center gap-0.5">
            <span className="h-0.5 w-2 bg-danger-600" />
            <span className="size-2 bg-danger-600" />
            <span className="h-0.5 w-2 bg-danger-600" />
          </span>
          Costos totales
        </li>
      </ul>

      <svg width={ANCHO} height={ALTO} viewBox={`0 0 ${ANCHO} ${ALTO}`} role="img" aria-label={descripcion} className="h-auto w-full">
        {/* Zonas de pérdida (antes del cruce) y de ganancia (después), como en Figma. */}
        {xCruce !== null ? (
          <g>
            <rect x={izquierda} y={MARGEN.arriba} width={xCruce - izquierda} height={piso - MARGEN.arriba} className="fill-danger-50" />
            <rect x={xCruce} y={MARGEN.arriba} width={derecha - xCruce} height={piso - MARGEN.arriba} className="fill-success-50" />
            <text x={izquierda + 6} y={MARGEN.arriba + 16} className="fill-danger-700" fontSize={LETRA - 1} fontWeight="600">
              {angosto ? "Pérdida" : "Zona de pérdida"}
            </text>
            <text x={derecha - 6} y={MARGEN.arriba + 16} textAnchor="end" className="fill-success-700" fontSize={LETRA - 1} fontWeight="600">
              {angosto ? "Ganancia" : "Zona de ganancia"}
            </text>
          </g>
        ) : null}

        {marcasY.map((v) => (
          <g key={`y${v}`}>
            <line x1={izquierda} x2={derecha} y1={y(v)} y2={y(v)} className="stroke-gray-200" strokeWidth="1" />
            <text x={izquierda - 8} y={y(v) + 4} textAnchor="end" className="fill-gray-500" fontSize={LETRA - 1}>
              {angosto ? abreviar(v) : formatearMonto(String(v))}
            </text>
          </g>
        ))}
        {marcasX
          .filter((_, i) => !angosto || i % 2 === 0)
          .map((u) => (
            <text key={`x${u}`} x={x(u)} y={piso + 18} textAnchor="middle" className="fill-gray-500" fontSize={LETRA - 1}>
              {formatearCantidad(String(u))}
            </text>
          ))}
        <text x={(izquierda + derecha) / 2} y={ALTO - 6} textAnchor="middle" className="fill-gray-500" fontSize={LETRA - 1}>
          Unidades por mes
        </text>

        {/* Tu volumen actual: línea vertical marina. */}
        {xVolumen !== null ? (
          <g>
            <line x1={xVolumen} x2={xVolumen} y1={MARGEN.arriba} y2={piso} className="stroke-primary-700" strokeWidth="1.5" />
            <text
              x={xVolumen - 6}
              y={MARGEN.arriba + 34}
              textAnchor="end"
              className="fill-primary-700"
              fontSize={LETRA - 1}
              fontWeight="600"
            >
              Tu volumen: {formatearCantidad(volumen)}
            </text>
          </g>
        ) : null}

        {/* Guías punteadas del equilibrio: vertical hasta el eje X y horizontal hasta el eje Y. */}
        {xCruce !== null && yCruce !== null ? (
          <g className="stroke-gray-500" strokeWidth="1" strokeDasharray="4 4">
            <line x1={xCruce} x2={xCruce} y1={MARGEN.arriba} y2={piso} />
            <line x1={izquierda} x2={derecha} y1={yCruce} y2={yCruce} />
          </g>
        ) : null}

        <path d={linea("costos")} fill="none" className="stroke-danger-600" strokeWidth="2.5" strokeDasharray="7 5" />
        <path d={linea("ingresos")} fill="none" className="stroke-primary-600" strokeWidth="2.5" />

        {/* Puntos sobre las líneas en cada marca del eje X. */}
        {marcasX.map((u) => (
          <g key={`p${u}`}>
            <rect x={x(u) - 3} y={y(valorEn("costos", u)) - 3} width="6" height="6" className="fill-danger-600" />
            <circle cx={x(u)} cy={y(valorEn("ingresos", u))} r="3.5" className="fill-primary-600" />
          </g>
        ))}

        {/* Nombre de cada línea al final (en pantallas chicas alcanza con la leyenda de arriba). */}
        {angosto ? null : (
          <g fontSize={LETRA - 1} fontWeight="600">
            <text x={derecha + 6} y={y(valorEn("ingresos", topeX)) + 4} className="fill-primary-600">
              Ingresos
            </text>
            <text x={derecha + 6} y={y(valorEn("costos", topeX)) + 4} className="fill-danger-600">
              Costos
            </text>
          </g>
        )}

        {xCruce !== null && yCruce !== null ? (
          <g>
            <circle cx={xCruce} cy={yCruce} r="6" className="fill-gray-900 stroke-white" strokeWidth="2" />
            <text
              x={xCruce + (xCruce > ANCHO * 0.6 ? -10 : 10)}
              // Debajo del punto: a la derecha del cruce esa zona queda libre (las dos líneas van por arriba).
              y={yCruce + 24}
              textAnchor={xCruce > ANCHO * 0.6 ? "end" : "start"}
              className="fill-gray-900 stroke-white"
              strokeWidth="4"
              paintOrder="stroke"
              fontSize={LETRA}
              fontWeight="700"
            >
              Equilibrio: {formatearCantidad(equilibrio)}
              {angosto ? "" : ` · ${formatearMonto(analisis.facturacionMinima)}`}
            </text>
          </g>
        ) : null}
      </svg>

      <dl className="mt-4 grid gap-3 sm:grid-cols-3">
        <Dato etiqueta="Equilibrio" valor={equilibrio ? `${formatearCantidad(equilibrio)} unidades` : "—"} />
        <Dato etiqueta="Facturación mínima" valor={formatearMonto(analisis.facturacionMinima)} />
        <Dato etiqueta="Tu volumen" valor={volumen ? `${formatearCantidad(volumen)} unidades` : "—"} />
      </dl>

      <TablaDatos
        unidades={marcasX}
        equilibrio={equilibrio}
        precio={analisis.precio}
        costoFijo={costoFijo}
        costoVariable={costoVariable}
      />
    </div>
  );
}

function Dato({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <div className="rounded-xl bg-gray-50 px-4 py-3">
      <dt className="text-xs text-gray-500">{etiqueta}</dt>
      <dd className="mt-0.5 font-semibold text-gray-900">{valor}</dd>
    </div>
  );
}

/**
 * Tabla «Ver datos» (Figma): ingresos, costos y diferencia para algunas cantidades.
 * Usa los valores exactos del motor (precio, costo fijo total y costo variable por unidad) con
 * Decimal, igual que el resto de la pantalla, para que las cifras coincidan al centavo.
 */
function TablaDatos({
  unidades,
  equilibrio,
  precio,
  costoFijo,
  costoVariable,
}: {
  unidades: number[];
  equilibrio: string | null;
  precio: string;
  costoFijo: string;
  costoVariable: string;
}) {
  const p = new Decimal(precio);
  const cf = new Decimal(costoFijo);
  const cv = new Decimal(costoVariable);
  const cantidades = [...new Set([...unidades, ...(equilibrio ? [Number(equilibrio)] : [])])].sort((a, b) => a - b);

  return (
    <details className="group mt-4">
      <summary className="inline-flex min-h-6 cursor-pointer list-none items-center rounded text-sm font-semibold text-primary-700 underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-700 [&::-webkit-details-marker]:hidden">
        <span className="group-open:hidden">Ver datos</span>
        <span className="hidden group-open:inline">Ocultar datos</span>
      </summary>
      <div
        className="relative mt-3 overflow-x-auto rounded-xl border border-gray-200"
        role="region"
        tabIndex={0}
        aria-label="Tabla de datos del gráfico, desplazable"
      >
        <table className="w-full text-left text-sm">
          <caption className="sr-only">Ingresos, costos y diferencia según las unidades vendidas por mes</caption>
          <thead className="bg-gray-50 text-gray-700">
            <tr>
              <th scope="col" className="px-4 py-2.5 font-semibold">Unidades</th>
              <th scope="col" className="px-4 py-2.5 font-semibold">Ingresos</th>
              <th scope="col" className="px-4 py-2.5 font-semibold">Costos</th>
              <th scope="col" className="px-4 py-2.5 font-semibold">Diferencia</th>
            </tr>
          </thead>
          <tbody>
            {cantidades.map((u) => {
              const ingresos = p.times(u);
              const costos = cf.plus(cv.times(u));
              const diferencia = ingresos.minus(costos);
              const esEquilibrio = equilibrio !== null && u === Number(equilibrio);
              return (
                <tr key={u} className={`border-t border-gray-200 ${esEquilibrio ? "bg-primary-50 font-semibold" : ""}`}>
                  <th scope="row" className="px-4 py-2.5 font-medium text-gray-900">
                    {formatearCantidad(String(u))}
                    {esEquilibrio ? <span className="ml-1 text-xs font-normal text-primary-700">(equilibrio)</span> : null}
                  </th>
                  <td className="px-4 py-2.5 text-gray-900">{formatearMonto(ingresos.toString())}</td>
                  <td className="px-4 py-2.5 text-gray-900">{formatearMonto(costos.toString())}</td>
                  <td className={`px-4 py-2.5 ${diferencia.isNegative() ? "text-danger-700" : "text-success-700"}`}>
                    {formatearMonto(diferencia.toString())}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </details>
  );
}
