"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, type ReactNode } from "react";

import { Ayuda } from "@/components/ui/ayuda";
import { Aviso } from "@/components/ui/aviso";
import { Boton, BotonLink } from "@/components/ui/boton";
import { Campo, idDescripcionDe } from "@/components/ui/campo";
import { CampoMonto } from "@/components/ui/campo-monto";
import { Tarjeta } from "@/components/ui/tarjeta";
import { calcularResumenCostos, costoVariableUnitarioDe, insumoSeCargaPorLote } from "@/domain/motor/costos";
import type { CategoriaCosto } from "@/domain/types";
import { hayErrores, validarConfiguracion, validarCostos } from "@/domain/validaciones";
import { useHidratado } from "@/hooks/use-hidratado";
import { formatearCantidad, formatearMonto } from "@/lib/formato";
import { indiceDePestana } from "@/lib/navegacion-teclado";
import type { RutaProduccion } from "@/domain/types";
import { useCalculoStore } from "@/store/calculo-store";

/** Textos del trabajo propio según la ruta del paso 1 (en «unidad» y «reventa» las horas son por unidad / por venta). */
const TEXTOS_TRABAJO: Record<
  RutaProduccion,
  { pregunta: string; multiplicador: string; consejo: string; consejoFinal: string }
> = {
  lotes: {
    pregunta: "¿Cuántas horas le dedicás a cada lote?",
    multiplicador: "lotes",
    consejo: "por lote",
    consejoFinal: "por lote",
  },
  unidad: {
    pregunta: "¿Cuántas horas le dedicás a cada unidad?",
    multiplicador: "unidades",
    consejo: "por unidad",
    consejoFinal: "por unidad",
  },
  reventa: {
    pregunta: "¿Qué sueldo fijo querés ganar por mes?",
    multiplicador: "ventas",
    consejo: "por venta",
    consejoFinal: "por venta",
  },
};

import { ListaConceptos, type FilaConcepto } from "./lista-conceptos";

type Pestana = "fijos" | "variables";

function Esqueleto() {
  return (
    <div aria-busy="true" aria-label="Cargando tus costos" className="flex animate-pulse flex-col gap-6">
      <div className="h-8 w-2/3 rounded-lg bg-gray-200" />
      <div className="h-12 rounded-xl bg-gray-100" />
      <div className="h-96 rounded-2xl bg-gray-100" />
    </div>
  );
}

/** Íconos de las pestañas (Figma). Decorativos: la etiqueta ya dice lo mismo. */
const ICONO_FIJOS = (
  <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="size-4">
    <rect x="5" y="3" width="14" height="18" rx="2" />
    <path d="M9 8h6M9 12h6M9 16h4" />
  </svg>
);
const ICONO_VARIABLES = (
  <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="size-4">
    <rect x="3" y="6" width="18" height="12" rx="2" />
    <circle cx="12" cy="12" r="2.5" />
  </svg>
);

function Subtotal({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <div className="flex items-center justify-between rounded-xl bg-gray-100 px-4 py-3 text-sm">
      <span className="text-xs font-semibold uppercase tracking-wider text-gray-700">{etiqueta}</span>
      <strong className="text-base text-gray-900">{valor}</strong>
    </div>
  );
}

function Encabezado({ titulo, ayuda, children }: { titulo: string; ayuda?: ReactNode; children?: ReactNode }) {
  return (
    <div className="mb-4">
      <div className="flex items-center gap-2">
        <h2 className="text-lg font-semibold text-gray-900">{titulo}</h2>
        {ayuda}
      </div>
      {children ? <p className="mt-1 text-sm text-gray-500">{children}</p> : null}
    </div>
  );
}

/** Paso 2 — «Costos» (Vista 2 del diseño): pestañas Costos fijos y Costos variables. */
export function FormularioCostos() {
  const hidratado = useHidratado();
  return hidratado ? <Formulario /> : <Esqueleto />;
}

function Formulario() {
  const router = useRouter();
  const calculo = useCalculoStore((s) => s.calculo);
  const actualizarConcepto = useCalculoStore((s) => s.actualizarConcepto);
  const agregarConcepto = useCalculoStore((s) => s.agregarConcepto);
  const eliminarConcepto = useCalculoStore((s) => s.eliminarConcepto);
  const actualizarTrabajoPropio = useCalculoStore((s) => s.actualizarTrabajoPropio);
  const textosTrabajo = TEXTOS_TRABAJO[calculo.configuracion.ruta];
  const esReventa = calculo.configuracion.ruta === "reventa";
  const esLotes = calculo.configuracion.ruta === "lotes";
  const cambiarPaso = useCalculoStore((s) => s.cambiarPaso);

  const [pestana, setPestana] = useState<Pestana>("fijos");
  const [intento, setIntento] = useState(false);
  const [tocados, setTocados] = useState<ReadonlySet<string>>(new Set());
  const [comoCalculo, setComoCalculo] = useState(false);

  const resumen = useMemo(() => calcularResumenCostos(calculo), [calculo]);
  const errores = useMemo(() => [...validarConfiguracion(calculo.configuracion), ...validarCostos(calculo)], [calculo]);
  const errorConfiguracion = errores.some((e) => e.campo.startsWith("configuracion.") && e.severidad === "error");

  const tocar = (campo: string) => setTocados((previos) => new Set(previos).add(campo));
  const mensajeDe = (campo: string): string | undefined => {
    if (!intento && !tocados.has(campo)) return undefined;
    return errores.find((e) => e.campo === campo && e.severidad === "error")?.mensaje;
  };
  const advertenciaDe = (campo: string): string | undefined =>
    intento ? errores.find((e) => e.campo === campo && e.severidad === "advertencia")?.mensaje : undefined;

  // --- listas de conceptos ---
  const filasFijas: FilaConcepto[] = calculo.costosFijos.map((c) => ({ id: c.id, nombre: c.nombre, valor: c.monto }));
  const filasIndirectas: FilaConcepto[] = calculo.costosIndirectos.map((c) => ({ id: c.id, nombre: c.nombre, valor: c.monto }));
  const filasVariables: FilaConcepto[] = calculo.costosVariables.map((c) => {
    const fila: FilaConcepto = { id: c.id, nombre: c.nombre, valor: c.montoUnitario };
    if (!esLotes) return fila;
    fila.base = c.base ?? "unidad";
    if (insumoSeCargaPorLote(c, calculo.configuracion.ruta)) {
      const porUnidad = costoVariableUnitarioDe(c, calculo.configuracion);
      fila.equivalente = !c.montoUnitario.trim()
        ? undefined
        : porUnidad
          ? `= ${formatearMonto(porUnidad.toString())} por unidad (÷ ${formatearCantidad(calculo.configuracion.unidadesPorLote)})`
          : "Completá las unidades por lote en «Tu producto» para dividirlo.";
    }
    return fila;
  });

  const cambiar = (categoria: CategoriaCosto) => (id: string, cambios: { nombre?: string; valor?: string }) =>
    actualizarConcepto(categoria, id, {
      nombre: cambios.nombre,
      ...(categoria === "variable" ? { montoUnitario: cambios.valor } : { monto: cambios.valor }),
    });

  /** Si hay una fila en blanco, el sugerido la completa; si no, agrega una nueva. */
  const agregar = (categoria: CategoriaCosto, filas: FilaConcepto[]) => (nombre?: string) => {
    const enBlanco = filas.find((f) => f.nombre.trim() === "" && f.valor.trim() === "");
    if (nombre && enBlanco) actualizarConcepto(categoria, enBlanco.id, { nombre });
    else agregarConcepto(categoria, nombre);
  };

  const errorFila = (lista: string, campoValor: string) => (indice: number, campo: "nombre" | "valor") =>
    mensajeDe(`${lista}.${indice}.${campo === "nombre" ? "nombre" : campoValor}`);
  const tocarFila = (lista: string, campoValor: string) => (indice: number, campo: "nombre" | "valor") =>
    tocar(`${lista}.${indice}.${campo === "nombre" ? "nombre" : campoValor}`);

  // --- continuar ---
  const continuar = () => {
    setIntento(true);
    if (hayErrores(errores)) {
      const primero = errores.find((e) => e.severidad === "error" && !e.campo.startsWith("configuracion."));
      if (primero) setPestana(primero.campo.startsWith("costosVariables") ? "variables" : "fijos");
      requestAnimationFrame(() => document.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus());
      return;
    }
    cambiarPaso("resumen");
    router.push("/calculadora/resumen");
  };

  const atras = () => {
    if (pestana === "variables") setPestana("fijos");
    else router.push("/calculadora/producto");
  };

  const { trabajoPropio } = calculo;
  const tieneTrabajo = resumen.totalTrabajoPropioMensual !== "0";
  const erroresVisibles = intento && hayErrores(errores);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="mb-1 text-xs font-bold uppercase tracking-widest text-primary-600">Paso 2 de 5</p>
        <h1 className="text-3xl font-bold tracking-tight text-gray-900">
          {pestana === "fijos" ? "¿Cuánto te cuesta producir?" : "Cargá tus costos"}
        </h1>
        <p className="mt-2 text-lg text-gray-700">
          {pestana === "fijos"
            ? "Dividimos en dos grupos: lo que pagás siempre (fijos) y lo que gastás por cada unidad (variables)."
            : "Dos categorías: costos fijos (incluyendo tu tiempo) y costos variables por unidad."}
        </p>
      </div>

      {errorConfiguracion ? (
        <Aviso tono="advertencia" titulo="Primero completá «Tu producto»">
          Necesitamos el nombre y las unidades que producís por mes para calcular tus costos.{" "}
          <BotonLink href="/calculadora/producto" variante="secundario" className="mt-2 !px-3 !py-1.5">
            Ir a «Tu producto»
          </BotonLink>
        </Aviso>
      ) : null}

      <div role="tablist" aria-label="Tipo de costos" className="grid grid-cols-2 gap-1 rounded-xl bg-gray-100 p-1">
        {(
          [
            ["fijos", "Costos Fijos", ICONO_FIJOS],
            ["variables", "Costos Variables", ICONO_VARIABLES],
          ] as const
        ).map(([id, etiqueta, icono], indice, todas) => (
          <button
            key={id}
            type="button"
            role="tab"
            id={`pestana-${id}`}
            aria-selected={pestana === id}
            aria-controls={`panel-${id}`}
            tabIndex={pestana === id ? 0 : -1}
            onClick={() => setPestana(id)}
            onKeyDown={(e) => {
              const destino = indiceDePestana(e.key, indice, todas.length);
              if (destino === null) return;
              e.preventDefault();
              setPestana(todas[destino][0]);
              document.getElementById(`pestana-${todas[destino][0]}`)?.focus();
            }}
            className={`inline-flex items-center justify-center gap-2 rounded-lg px-4 py-3 text-base font-semibold focus-visible:outline-2 focus-visible:outline-primary-600 ${
              pestana === id ? "bg-white text-primary-700 shadow-sm" : "text-gray-700 hover:text-gray-900"
            }`}
          >
            {icono}
            {etiqueta}
          </button>
        ))}
      </div>

      {pestana === "fijos" ? (
        <div role="tabpanel" id="panel-fijos" aria-labelledby="pestana-fijos" className="flex flex-col gap-6">
          <Tarjeta>
            <Encabezado titulo="Gastos fijos mensuales">Los que existen aunque no produzcas nada ese mes.</Encabezado>
            <ListaConceptos
              idBase="fijos"
              filas={filasFijas}
              nombreFila="gasto fijo"
              placeholderNombre="Ej: Alquiler / Renta del local"
              placeholderValor="60000"
              etiquetaAgregar="Agregar gasto fijo"
              sugeridos={["Internet", "Seguros", "Cuota de monotributo"]}
              onCambiar={cambiar("fijo")}
              onEliminar={(id) => eliminarConcepto("fijo", id)}
              onAgregar={agregar("fijo", filasFijas)}
              errorDe={errorFila("costosFijos", "monto")}
              onTocar={tocarFila("costosFijos", "monto")}
            />
            <div className="mt-5">
              <Subtotal etiqueta="Subtotal gastos fijos" valor={formatearMonto(resumen.totalGastosFijosMensual)} />
            </div>
          </Tarjeta>

          <Tarjeta>
            <Encabezado
              titulo="Tu tiempo de trabajo"
              ayuda={
                <Ayuda
                  sobre="tu tiempo de trabajo"
                  texto="Tu trabajo también es un costo. Si no lo contás, cobrás menos de lo que valés."
                />
              }
            >
              Lo calculamos como costo fijo mensual.
            </Encabezado>
            <div className="flex flex-col gap-5">
              {esReventa ? (
                <>
                  <Campo
                    idControl="sueldo-mensual"
                    etiqueta={textosTrabajo.pregunta}
                    descripcion="Es lo que querés llevarte por tu trabajo, además de cubrir los costos del negocio."
                    error={mensajeDe("trabajoPropio.sueldoMensual")}
                    idError="sueldo-mensual-error"
                  >
                    <CampoMonto
                      id="sueldo-mensual"
                      idDescripcion={idDescripcionDe("sueldo-mensual")}
                      placeholder="Ej: 300000"
                      value={trabajoPropio.sueldoMensual}
                      invalido={Boolean(mensajeDe("trabajoPropio.sueldoMensual"))}
                      idError="sueldo-mensual-error"
                      onBlur={() => tocar("trabajoPropio.sueldoMensual")}
                      onChange={(valor) => actualizarTrabajoPropio({ sueldoMensual: valor })}
                    />
                  </Campo>
                  {tieneTrabajo ? (
                    <p className="rounded-xl bg-primary-50 px-4 py-3 text-sm text-primary-700" aria-live="polite">
                      Sueldo mensual esperado = <strong>{formatearMonto(resumen.totalTrabajoPropioMensual)} / mes</strong>
                    </p>
                  ) : null}
                </>
              ) : (
                <>
              <Campo
                idControl="horas-por-lote"
                etiqueta={textosTrabajo.pregunta}
                error={mensajeDe("trabajoPropio.horasPorLote")}
                idError="horas-por-lote-error"
              >
                <CampoMonto
                  id="horas-por-lote"
                  prefijo={null}
                  sufijo="hs"
                  placeholder="Ej: 5"
                  value={trabajoPropio.horasPorLote}
                  invalido={Boolean(mensajeDe("trabajoPropio.horasPorLote"))}
                  idError="horas-por-lote-error"
                  onBlur={() => tocar("trabajoPropio.horasPorLote")}
                  onChange={(valor) => actualizarTrabajoPropio({ horasPorLote: valor })}
                />
              </Campo>

              <Campo
                idControl="valor-hora"
                etiqueta="¿Cuánto querés ganar por hora de tu trabajo?"
                error={mensajeDe("trabajoPropio.valorHora")}
                idError="valor-hora-error"
              >
                <CampoMonto
                  id="valor-hora"
                  placeholder="Ej: 3000"
                  value={trabajoPropio.valorHora}
                  invalido={Boolean(mensajeDe("trabajoPropio.valorHora"))}
                  idError="valor-hora-error"
                  onBlur={() => tocar("trabajoPropio.valorHora")}
                  onChange={(valor) => actualizarTrabajoPropio({ valorHora: valor })}
                />
              </Campo>
              <div>
                <button
                  type="button"
                  aria-expanded={comoCalculo}
                  aria-controls="como-lo-calculo"
                  onClick={() => setComoCalculo((v) => !v)}
                  className="relative text-sm font-semibold text-primary-700 underline-offset-2 before:absolute before:inset-x-0 before:-inset-y-3 before:content-[''] hover:underline focus-visible:outline-2 focus-visible:outline-primary-600"
                >
                  {comoCalculo ? "▲" : "▼"} ¿Cómo lo calculo?
                </button>
                {comoCalculo ? (
                  <div id="como-lo-calculo" className="mt-2">
                    <Aviso tono="info">
                      Lo que necesitás ganar al mes ÷ horas que trabajás al mes.
                      <br />
                      <strong>Ej: $150.000 ÷ 100 hs = $1.500 por hora.</strong>
                    </Aviso>
                  </div>
                ) : null}
              </div>

              {tieneTrabajo ? (
                <p className="rounded-xl bg-primary-50 px-4 py-3 text-sm text-primary-700" aria-live="polite">
                  {formatearCantidad(trabajoPropio.horasPorLote)} hs × {formatearMonto(trabajoPropio.valorHora)}/h ×{" "}
                  {formatearCantidad(calculo.configuracion.lotes)} {textosTrabajo.multiplicador} ={" "}
                  <strong>{formatearMonto(resumen.totalTrabajoPropioMensual)} / mes</strong>
                </p>
              ) : null}
                </>
              )}
              <Subtotal etiqueta="Subtotal trabajo propio" valor={formatearMonto(resumen.totalTrabajoPropioMensual)} />
            </div>
          </Tarjeta>

          <Tarjeta>
            <Encabezado
              titulo="Otros costos indirectos"
              ayuda={
                <Ayuda
                  sobre="costos indirectos"
                  texto="Gastos que no son insumos de cada unidad pero pesan en el mes. Los tratamos como fijos."
                  ejemplo="comisiones de cobro, mantenimiento, depreciación."
                />
              }
            >
              Comisiones, mantenimiento, depreciación u otros gastos periódicos.
            </Encabezado>
            <ListaConceptos
              idBase="indirectos"
              filas={filasIndirectas}
              nombreFila="costo indirecto"
              placeholderNombre="Ej: Comisión de Mercado Pago"
              placeholderValor="2000"
              etiquetaAgregar="Agregar costo indirecto"
              sugeridos={["Mantenimiento de máquina"]}
              onCambiar={cambiar("indirecto")}
              onEliminar={(id) => eliminarConcepto("indirecto", id)}
              onAgregar={agregar("indirecto", filasIndirectas)}
              errorDe={errorFila("costosIndirectos", "monto")}
              onTocar={tocarFila("costosIndirectos", "monto")}
            />
            <div className="mt-5">
              <Subtotal etiqueta="Subtotal indirectos" valor={formatearMonto(resumen.totalIndirectosMensual)} />
            </div>
          </Tarjeta>

          <div className="flex items-center justify-between gap-4 rounded-2xl bg-primary-900 px-6 py-5 text-white">
            <div>
              <p className="flex items-center gap-2 text-lg font-semibold">Costo Fijo Total / mes</p>
              <p className="text-sm text-primary-100">Gastos + Trabajo + Indirectos</p>
            </div>
            <p className="text-3xl font-bold" aria-live="polite">
              {formatearMonto(resumen.costoFijoTotalMensual)}
            </p>
          </div>

          <Aviso tono="consejo">
            {esReventa
              ? "El error más frecuente es no incluir el trabajo propio. Si querés ganar $300.000 al mes, ese monto va como costo fijo y se reparte entre todas tus ventas."
              : `El error más frecuente es no incluir el trabajo propio. Si hacés 4 hs ${textosTrabajo.consejo} y querés ganar $1.500/hs, eso son $6.000 de costo fijo ${textosTrabajo.consejoFinal}.`}
          </Aviso>
          {advertenciaDe("costosFijos") ? <Aviso tono="advertencia">{advertenciaDe("costosFijos")}</Aviso> : null}
        </div>
      ) : (
        <div role="tabpanel" id="panel-variables" aria-labelledby="pestana-variables" className="flex flex-col gap-6">
          <Tarjeta>
            <Encabezado
              titulo="Costos variables por unidad"
              ayuda={
                <Ayuda
                  sobre="costos variables"
                  texto={
                    esReventa
                      ? "Son los gastos que cambian según cuánto vendas: lo que pagás por cada producto y su packaging."
                      : "Son los gastos que cambian según cuánto produzcas: materiales, insumos, envases."
                  }
                  ejemplo={
                    esReventa
                      ? "el precio de compra mayorista de cada termo y la bolsa o caja con la que lo entregás."
                      : "la harina, la caja, la etiqueta. Todo lo que se usa por cada unidad que fabricás."
                  }
                />
              }
            >
              {esReventa
                ? "El precio de compra mayorista y el packaging de cada unidad que revendés."
                : "La harina, la caja, la etiqueta — todo lo que se usa en cada unidad."}
            </Encabezado>
            <div className="mb-4">
              <Aviso tono="consejo">
                {esReventa
                  ? "Si comprás una caja de 12 termos a $96.000, el precio de compra por unidad es $8.000. Sumá el packaging de cada uno."
                  : esLotes
                    ? "Podés cargar cada insumo por unidad o por lote completo. Si para un lote de 20 velas gastás $20.000 en cera, elegí «por lote completo» y lo dividimos por las 20 unidades: $1.000 por vela."
                    : "Si una bolsa de harina alcanza para 4 tortas y cuesta $240, poné $60 por unidad."}
              </Aviso>
            </div>
            <ListaConceptos
              idBase="variables"
              filas={filasVariables}
              nombreFila={esReventa ? "costo de compra" : "insumo"}
              placeholderNombre={esReventa ? "Ej: Precio de compra mayorista" : "Ej: Materia prima"}
              placeholderValor={esReventa ? "8000" : "85"}
              etiquetaAgregar={esReventa ? "Agregar precio de compra o packaging" : "Agregar insumo o material"}
              onCambiar={cambiar("variable")}
              onCambiarBase={esLotes ? (id, base) => actualizarConcepto("variable", id, { base }) : undefined}
              onEliminar={(id) => eliminarConcepto("variable", id)}
              onAgregar={agregar("variable", filasVariables)}
              errorDe={errorFila("costosVariables", "montoUnitario")}
              onTocar={tocarFila("costosVariables", "montoUnitario")}
            />
            <div className="mt-5">
              <Subtotal etiqueta="Variables / unidad" valor={formatearMonto(resumen.costoVariableUnitario)} />
            </div>
          </Tarjeta>

          <Aviso tono="consejo">
            Recordá: los costos variables son los que cambian con el volumen. Tu tiempo y el alquiler van en la pestaña
            de Costos Fijos.
          </Aviso>
          {advertenciaDe("costosVariables") ? <Aviso tono="advertencia">{advertenciaDe("costosVariables")}</Aviso> : null}
        </div>
      )}

      {erroresVisibles ? (
        <p role="alert" className="flex items-start gap-2 text-sm font-medium text-danger-700">
          <span aria-hidden="true">✕</span>
          <span>
            {errorConfiguracion
              ? "Falta completar «Tu producto» antes de seguir."
              : "Revisá los campos marcados antes de seguir."}
          </span>
        </p>
      ) : null}

      <div className="flex items-center justify-between gap-4">
        <Boton variante="secundario" onClick={atras}>
          ← Atrás
        </Boton>
        <Boton onClick={continuar}>Ver resumen de costos →</Boton>
      </div>
    </div>
  );
}
