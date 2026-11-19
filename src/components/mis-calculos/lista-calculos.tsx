"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

import { Aviso } from "@/components/ui/aviso";
import { Boton, BotonLink } from "@/components/ui/boton";
import { DialogoConfirmar } from "@/components/ui/dialogo-confirmar";
import { Tarjeta } from "@/components/ui/tarjeta";
import {
  borrarCalculoGuardado,
  cambiarCompartido,
  listarMisCalculos,
  rutaCompartida,
  type ResumenCalculo,
} from "@/lib/api-calculos";
import { signOut, useSession } from "@/lib/auth-client";

const PASOS: Record<string, string> = {
  configuracion: "Tu producto",
  costos: "Costos",
  resumen: "Resumen",
  precio: "Precio",
  simulador: "Simulador",
};

type Orden = "recientes" | "antiguos" | "az" | "za";

const ORDENES: Array<{ valor: Orden; etiqueta: string }> = [
  { valor: "recientes", etiqueta: "Más recientes primero" },
  { valor: "antiguos", etiqueta: "Más antiguos primero" },
  { valor: "az", etiqueta: "Nombre (A → Z)" },
  { valor: "za", etiqueta: "Nombre (Z → A)" },
];

/** Compara por nombre sin distinguir mayúsculas ni tildes; los cálculos sin nombre van siempre al final. */
function porNombre(a: ResumenCalculo, b: ResumenCalculo, descendente = false): number {
  const sinA = !a.nombre.trim();
  const sinB = !b.nombre.trim();
  if (sinA !== sinB) return sinA ? 1 : -1;
  const orden = a.nombre.localeCompare(b.nombre, "es", { sensitivity: "base" });
  return descendente ? -orden : orden;
}

function ordenar(lista: ResumenCalculo[], orden: Orden): ResumenCalculo[] {
  const copia = [...lista];
  switch (orden) {
    case "recientes":
      return copia.sort((a, b) => b.actualizadoEn.localeCompare(a.actualizadoEn));
    case "antiguos":
      return copia.sort((a, b) => a.actualizadoEn.localeCompare(b.actualizadoEn));
    case "az":
      return copia.sort((a, b) => porNombre(a, b));
    case "za":
      return copia.sort((a, b) => porNombre(a, b, true));
  }
}

const fecha = (iso: string) =>
  new Date(iso).toLocaleDateString("es-AR", { day: "numeric", month: "long", year: "numeric" });

type Mensaje = { texto: string; error: boolean } | null;

export function ListaCalculos() {
  const router = useRouter();
  const { data: sesion, isPending } = useSession();
  // null = cargando (o falló); lista vacía = todavía no guardó ninguno.
  const [datos, setDatos] = useState<{ calculos: ResumenCalculo[]; limite: number } | null>(null);
  const [fallo, setFallo] = useState(false);
  const [orden, setOrden] = useState<Orden>("recientes");
  const [mensaje, setMensaje] = useState<Mensaje>(null);
  const [porBorrar, setPorBorrar] = useState<ResumenCalculo | null>(null);
  const hayUsuario = Boolean(sesion);

  const recargar = useCallback(async () => {
    const respuesta = await listarMisCalculos();
    setDatos(respuesta);
    setFallo(respuesta === null);
  }, []);

  useEffect(() => {
    if (!hayUsuario) return;
    let activo = true;
    listarMisCalculos().then((d) => {
      if (!activo) return;
      setDatos(d);
      setFallo(d === null);
    });
    return () => {
      activo = false;
    };
  }, [hayUsuario]);

  const lista = useMemo(() => (datos ? ordenar(datos.calculos, orden) : []), [datos, orden]);

  async function alternarLink(c: ResumenCalculo) {
    const ok = await cambiarCompartido(c.id, !c.compartido);
    setMensaje(
      ok
        ? { texto: c.compartido ? "Desactivaste el link: ya nadie puede verlo." : "Activaste el link para compartirlo.", error: false }
        : { texto: "No pudimos cambiar el link. Probá de nuevo.", error: true },
    );
    await recargar();
  }

  async function copiar(c: ResumenCalculo) {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}${rutaCompartida(c.id)}`);
      setMensaje({ texto: "Copiamos el link. Ya podés pegarlo donde quieras.", error: false });
    } catch {
      setMensaje({ texto: "No pudimos copiar el link. Abrí el cálculo y copialo desde la barra del navegador.", error: true });
    }
  }

  async function confirmarBorrado() {
    const c = porBorrar;
    setPorBorrar(null);
    if (!c) return;
    const ok = await borrarCalculoGuardado(c.id);
    setMensaje(
      ok
        ? { texto: `Borraste «${c.nombre || "cálculo sin nombre"}».`, error: false }
        : { texto: "No pudimos borrar el cálculo. Probá de nuevo.", error: true },
    );
    await recargar();
  }

  async function cerrarSesion() {
    await signOut();
    router.push("/");
    router.refresh();
  }

  if (isPending) return <p className="text-sm text-gray-700">Cargando tu cuenta…</p>;

  if (!sesion) {
    return (
      <Tarjeta className="flex flex-col items-start gap-4">
        <h1 className="text-2xl font-bold text-gray-900">Mis cálculos</h1>
        <p className="text-gray-700">Iniciá sesión para ver los cálculos que guardaste.</p>
        <BotonLink href="/cuenta?volver=/mis-calculos">Iniciar sesión</BotonLink>
      </Tarjeta>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Mis cálculos</h1>
          <p className="mt-1 text-sm text-gray-700">
            Sesión iniciada como <span className="font-semibold">{sesion.user.email}</span>
          </p>
        </div>
        <Boton variante="secundario" onClick={cerrarSesion}>
          Cerrar sesión
        </Boton>
      </div>

      <div role="status">
        {mensaje ? (
          <p
            className={`rounded-xl border px-4 py-3 text-sm ${
              mensaje.error ? "border-danger-100 bg-danger-50 text-danger-700" : "border-success-100 bg-success-100 text-primary-900"
            }`}
          >
            {mensaje.texto}
          </p>
        ) : null}
      </div>

      {fallo ? (
        <Aviso tono="advertencia" titulo="No pudimos cargar tus cálculos">
          <p>Revisá tu conexión y volvé a intentar.</p>
          <div className="mt-2">
            <Boton variante="secundario" onClick={recargar}>
              Reintentar
            </Boton>
          </div>
        </Aviso>
      ) : datos === null ? (
        <p className="text-sm text-gray-700">Cargando tus cálculos…</p>
      ) : datos.calculos.length === 0 ? (
        <Tarjeta className="flex flex-col items-start gap-4">
          <h2 className="text-lg font-bold text-gray-900">Todavía no guardaste ningún cálculo</h2>
          <p className="text-gray-700">Cuando guardes uno, vas a encontrarlo acá para retomarlo o compartirlo.</p>
          <BotonLink href="/calculadora/producto">Empezar mi cálculo</BotonLink>
        </Tarjeta>
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm font-semibold text-gray-900">
              {datos.calculos.length} de {datos.limite} cálculos guardados
            </p>
            <label className="flex items-center gap-2 text-sm text-gray-700">
              Ordenar por
              <select
                className="rounded-lg border border-gray-400 bg-white px-3 py-2 text-sm text-gray-900 focus-visible:outline-2 focus-visible:outline-primary-700"
                value={orden}
                onChange={(e) => setOrden(e.target.value as Orden)}
              >
                {ORDENES.map((o) => (
                  <option key={o.valor} value={o.valor}>
                    {o.etiqueta}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <ul className="flex flex-col gap-4">
            {lista.map((c) => (
              <li key={c.id}>
                <Tarjeta className="flex flex-col gap-4">
                  <div>
                    <h2 className="text-lg font-bold text-gray-900">{c.nombre || "Cálculo sin nombre"}</h2>
                    <p className="mt-1 text-sm text-gray-700">
                      {c.tipo === "servicio" ? "Servicio" : "Producto"} · Quedó en: {PASOS[c.pasoActual] ?? c.pasoActual}
                    </p>
                    <p className="text-sm text-gray-700">
                      Última modificación: {fecha(c.actualizadoEn)} · Link {c.compartido ? "activo" : "desactivado"}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <BotonLink href={rutaCompartida(c.id)}>Abrir y editar</BotonLink>
                    <Boton variante="secundario" onClick={() => copiar(c)} disabled={!c.compartido} title={c.compartido ? undefined : "Activá el link para poder copiarlo"}>
                      Copiar link
                    </Boton>
                    <Boton variante="secundario" onClick={() => alternarLink(c)}>
                      {c.compartido ? "Desactivar link" : "Activar link"}
                    </Boton>
                    <Boton variante="peligro" onClick={() => setPorBorrar(c)}>
                      Borrar
                    </Boton>
                  </div>
                </Tarjeta>
              </li>
            ))}
          </ul>
        </>
      )}

      <DialogoConfirmar
        abierto={porBorrar !== null}
        titulo="¿Borrar este cálculo?"
        descripcion={`Vas a borrar «${porBorrar?.nombre || "cálculo sin nombre"}». No se puede deshacer y el link dejará de funcionar.`}
        etiquetaConfirmar="Sí, borrar"
        onCancelar={() => setPorBorrar(null)}
        onConfirmar={confirmarBorrado}
      />
    </div>
  );
}
