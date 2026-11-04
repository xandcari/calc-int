"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";

import { Ayuda } from "@/components/ui/ayuda";
import { Aviso } from "@/components/ui/aviso";
import { Boton } from "@/components/ui/boton";
import { Campo, clasesCampo, idDescripcionDe } from "@/components/ui/campo";
import { DialogoConfirmar } from "@/components/ui/dialogo-confirmar";
import { CampoMonto } from "@/components/ui/campo-monto";
import { Tarjeta } from "@/components/ui/tarjeta";
import { OPCIONES_RUTA, SelectorRuta } from "@/components/calculadora/selector-ruta";
import { datosQueSePierdenAlCambiarRuta } from "@/domain/calculo";
import type { RutaProduccion } from "@/domain/types";
import { crearConfiguracionSchema, type ConfiguracionFormulario } from "@/domain/validaciones";
import { useHidratado } from "@/hooks/use-hidratado";
import { formatearCantidad, unirEnLista } from "@/lib/formato";
import { useCalculoStore } from "@/store/calculo-store";

const UNIDADES_DE_VENTA = [
  { valor: "unidad", etiqueta: "unidades" },
  { valor: "kg", etiqueta: "kg" },
  { valor: "litro", etiqueta: "litros" },
  { valor: "docena", etiqueta: "docenas" },
  { valor: "par", etiqueta: "pares" },
  { valor: "metro", etiqueta: "metros" },
  { valor: "pack", etiqueta: "packs" },
];

const PERIODOS = [
  { valor: "semanal", etiqueta: "Semanal", disponible: false },
  { valor: "quincenal", etiqueta: "Quincenal", disponible: false },
  { valor: "mensual", etiqueta: "Mensual", disponible: true },
];

/** Textos del bloque de volumen para cada ruta (Figma, «Estado actual para front»). */
const TEXTOS_RUTA: Record<
  RutaProduccion,
  { titulo: string; ayudaSobre: string; ayuda: string; ejemplo: string; etiquetaVolumen: string; pistaVolumen?: string }
> = {
  lotes: {
    titulo: "Tu producción por período",
    ayudaSobre: "cuánto producís por mes",
    ayuda: "Usaremos este dato para repartir los costos fijos entre todas tus unidades.",
    ejemplo: "si hacés 2 tandas de 24 velas por mes, poné 24 unidades por lote y 2 lotes.",
    etiquetaVolumen: "Lotes por mes",
  },
  unidad: {
    titulo: "Tu volumen por período",
    ayudaSobre: "cuántas unidades producís por mes",
    ayuda: "Usaremos este dato para repartir los costos fijos entre todas tus unidades.",
    ejemplo: "si armás 80 piezas por mes, poné 80. Si no sabés, poné tu estimación más realista.",
    etiquetaVolumen: "¿Cuántas unidades producís por período?",
    pistaVolumen: "Contá cada pieza terminada como una unidad.",
  },
  reventa: {
    titulo: "Tus ventas estimadas por período",
    ayudaSobre: "cuántas unidades vendés por mes",
    ayuda: "Usaremos este dato para repartir los costos fijos y tu tiempo entre cada venta.",
    ejemplo: "si vendés 80 productos por mes, poné 80. Si no sabés, poné tu estimación más realista.",
    etiquetaVolumen: "¿Cuántas unidades vendés por período?",
    pistaVolumen: "Contá cada producto vendido como una unidad.",
  },
};

function Esqueleto() {
  return (
    <div aria-busy="true" aria-label="Cargando tu cálculo" className="flex animate-pulse flex-col gap-6">
      <div className="h-8 w-2/3 rounded-lg bg-gray-200" />
      <div className="h-96 rounded-2xl bg-gray-100" />
    </div>
  );
}

/** Paso 1 — «Tu producto» (Vista 1 del diseño). */
export function FormularioProducto() {
  const hidratado = useHidratado();
  return hidratado ? <Formulario /> : <Esqueleto />;
}

function Formulario() {
  const router = useRouter();
  const configuracion = useCalculoStore((s) => s.calculo.configuracion);
  const actualizarConfiguracion = useCalculoStore((s) => s.actualizarConfiguracion);
  const cambiarRuta = useCalculoStore((s) => s.cambiarRuta);
  const cambiarPaso = useCalculoStore((s) => s.cambiarPaso);
  const ruta = configuracion.ruta;
  const [rutaPendiente, setRutaPendiente] = useState<RutaProduccion | null>(null);

  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ConfiguracionFormulario>({
    resolver: zodResolver(crearConfiguracionSchema(ruta)),
    mode: "onTouched",
    defaultValues: {
      nombre: configuracion.nombre,
      unidadVenta: configuracion.unidadVenta,
      unidadesPorLote: configuracion.unidadesPorLote,
      lotes: configuracion.lotes,
    },
  });

  const volumenListo = configuracion.volumenMensual !== "";
  const unidades = UNIDADES_DE_VENTA.find((u) => u.valor === configuracion.unidadVenta)?.etiqueta ?? configuracion.unidadVenta;

  /** Aplica el cambio: el store recalcula los campos que no aplican y el formulario se vuelve a sincronizar con ellos. */
  function aplicarRuta(nueva: RutaProduccion) {
    cambiarRuta(nueva);
    const { nombre, unidadVenta, unidadesPorLote, lotes } = useCalculoStore.getState().calculo.configuracion;
    reset({ nombre, unidadVenta, unidadesPorLote, lotes });
  }

  /** Si cambiar de ruta borra algo que el usuario ya cargó, se lo avisa antes y le deja volver atrás. */
  function elegirRuta(nueva: RutaProduccion) {
    if (nueva === ruta) return;
    const perdidos = datosQueSePierdenAlCambiarRuta(useCalculoStore.getState().calculo, nueva);
    if (perdidos.length > 0) setRutaPendiente(nueva);
    else aplicarRuta(nueva);
  }

  const datosAPerder = rutaPendiente ? datosQueSePierdenAlCambiarRuta(useCalculoStore.getState().calculo, rutaPendiente) : [];

  const continuar = handleSubmit(() => {
    cambiarPaso("costos");
    router.push("/calculadora/costos");
  });

  return (
    <form onSubmit={continuar} noValidate className="flex flex-col gap-8">
      <div>
        <p className="mb-1 text-xs font-bold uppercase tracking-widest text-primary-600">Paso 1 de 5</p>
        <h1 id="ruta-titulo" className="text-3xl font-bold tracking-tight text-gray-900">
          ¿Cómo comercializás tu producto?
        </h1>
        <p className="mt-2 text-lg text-gray-700">Elegí la ruta que mejor se parece a tu forma de trabajar.</p>
      </div>

      <SelectorRuta valor={ruta} onChange={elegirRuta} />

      <Tarjeta className="flex flex-col gap-6">
        <Campo
          idControl="nombre"
          etiqueta={
            <>
              Nombre del producto <span aria-hidden="true" className="text-danger-700">*</span>
              <span className="sr-only"> (obligatorio)</span>
            </>
          }
          error={errors.nombre?.message}
          idError="nombre-error"
        >
          <input
            id="nombre"
            type="text"
            autoComplete="off"
            placeholder="Ej: Torta de chocolate, Vela aromática, Remera estampada…"
            aria-invalid={errors.nombre ? true : undefined}
            aria-describedby={errors.nombre ? "nombre-error" : undefined}
            className={clasesCampo(Boolean(errors.nombre))}
            {...register("nombre", { onChange: (e) => actualizarConfiguracion({ nombre: e.target.value }) })}
          />
        </Campo>

        <Campo idControl="unidad-venta" etiqueta="Unidad de venta" error={errors.unidadVenta?.message} idError="unidad-venta-error">
          <select
            id="unidad-venta"
            aria-invalid={errors.unidadVenta ? true : undefined}
            aria-describedby={errors.unidadVenta ? "unidad-venta-error" : "unidad-venta-nota"}
            className={clasesCampo(Boolean(errors.unidadVenta))}
            {...register("unidadVenta", { onChange: (e) => actualizarConfiguracion({ unidadVenta: e.target.value }) })}
          >
            {UNIDADES_DE_VENTA.map((u) => (
              <option key={u.valor} value={u.valor}>
                {u.etiqueta}
              </option>
            ))}
          </select>
          <p id="unidad-venta-nota" className="text-sm text-gray-500">
            Todos los valores se calculan en pesos argentinos.
          </p>
        </Campo>

        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 text-base font-medium text-gray-900">Período de referencia</legend>
          <div role="radiogroup" aria-label="Período de referencia" className="grid grid-cols-3 gap-3">
            {PERIODOS.map((p) => (
              <div key={p.valor} className="flex flex-col items-center gap-1">
                <button
                  type="button"
                  role="radio"
                  aria-checked={p.disponible}
                  disabled={!p.disponible}
                  className={`w-full rounded-xl border px-4 py-3 text-base font-medium ${
                    p.disponible
                      ? "border-primary-900 bg-primary-900 text-white"
                      : "cursor-not-allowed border-gray-200 bg-gray-50 text-gray-500"
                  }`}
                >
                  {p.etiqueta}
                </button>
                {p.disponible ? null : <span className="text-xs text-gray-500">Próximamente</span>}
              </div>
            ))}
          </div>
          <p className="text-sm text-gray-500">Los costos se calculan por mes.</p>
        </fieldset>

        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <h2 className="text-base font-medium text-gray-900">{TEXTOS_RUTA[ruta].titulo}</h2>
            <Ayuda sobre={TEXTOS_RUTA[ruta].ayudaSobre} texto={TEXTOS_RUTA[ruta].ayuda} ejemplo={TEXTOS_RUTA[ruta].ejemplo} />
          </div>

          <div className="grid gap-6 sm:grid-cols-2">
            {ruta === "lotes" ? (
              <Campo
                idControl="unidades-por-lote"
                etiqueta="Unidades por lote"
                error={errors.unidadesPorLote?.message}
                idError="unidades-por-lote-error"
              >
                <Controller
                  control={control}
                  name="unidadesPorLote"
                  render={({ field }) => (
                    <CampoMonto
                      id="unidades-por-lote"
                      ref={field.ref}
                      prefijo={null}
                      placeholder="Ej: 24"
                      value={field.value}
                      invalido={Boolean(errors.unidadesPorLote)}
                      idError="unidades-por-lote-error"
                      onBlur={field.onBlur}
                      onChange={(valor) => {
                        field.onChange(valor);
                        actualizarConfiguracion({ unidadesPorLote: valor });
                      }}
                    />
                  )}
                />
              </Campo>
            ) : null}

            <Campo
              idControl="lotes"
              etiqueta={TEXTOS_RUTA[ruta].etiquetaVolumen}
              descripcion={TEXTOS_RUTA[ruta].pistaVolumen}
              error={errors.lotes?.message}
              idError="lotes-error"
            >
              <Controller
                control={control}
                name="lotes"
                render={({ field }) => (
                  <CampoMonto
                    id="lotes"
                    idDescripcion={TEXTOS_RUTA[ruta].pistaVolumen ? idDescripcionDe("lotes") : undefined}
                    ref={field.ref}
                    prefijo={null}
                    placeholder={ruta === "lotes" ? "Ej: 2" : "Ej: 80"}
                    value={field.value}
                    invalido={Boolean(errors.lotes)}
                    idError="lotes-error"
                    onBlur={field.onBlur}
                    onChange={(valor) => {
                      field.onChange(valor);
                      actualizarConfiguracion({ lotes: valor });
                    }}
                  />
                )}
              />
            </Campo>
          </div>

          <div aria-live="polite" className="min-h-12">
            {volumenListo ? (
              <p className="flex items-center gap-2 rounded-xl bg-success-50 px-4 py-3 text-sm text-success-700">
                <span aria-hidden="true">✓</span>
                <span>
                  {ruta === "lotes" ? (
                    <>
                      Producís <strong>{formatearCantidad(configuracion.volumenMensual)} {unidades}</strong> por mes (
                      {formatearCantidad(configuracion.unidadesPorLote)} × {formatearCantidad(configuracion.lotes)} lotes)
                    </>
                  ) : (
                    <>
                      {ruta === "reventa" ? "Vendés" : "Producís"}{" "}
                      <strong>{formatearCantidad(configuracion.volumenMensual)} {unidades}</strong> por mes
                    </>
                  )}
                </span>
              </p>
            ) : null}
          </div>
        </div>
      </Tarjeta>

      <Aviso tono="info" titulo="¿Por qué necesitamos esto?">
        Para saber cuánto le cuesta a tu negocio fabricar cada unidad, dividimos todos los costos fijos entre las
        unidades que producís al mes.
      </Aviso>

      <Aviso tono="consejo">
        El 70% de los emprendedores fijan precios sin calcular su costo real. Vos ya estás haciendo las cosas bien.
      </Aviso>

      <div className="flex justify-end">
        <Boton type="submit">Continuar →</Boton>
      </div>

      <DialogoConfirmar
        abierto={rutaPendiente !== null}
        titulo="¿Cambiar la forma de comercializar?"
        descripcion={
          rutaPendiente
            ? `Al pasar a «${OPCIONES_RUTA[rutaPendiente].titulo}» se borra lo que cargaste de ${unirEnLista(datosAPerder)}, porque significa otra cosa en esa ruta. El resto de tus costos se conserva.`
            : ""
        }
        etiquetaConfirmar="Sí, cambiar"
        onCancelar={() => setRutaPendiente(null)}
        onConfirmar={() => {
          if (rutaPendiente) aplicarRuta(rutaPendiente);
          setRutaPendiente(null);
        }}
      />
    </form>
  );
}
