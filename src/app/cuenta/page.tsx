import type { Metadata } from "next";

import { Cabecera, Pie } from "@/components/calculadora/cabecera";
import { FormularioCuenta } from "@/components/cuenta/formulario-cuenta";
import { rutaSegura } from "@/lib/ruta-segura";

export const metadata: Metadata = {
  title: "Tu cuenta — Preciar",
  description: "Iniciá sesión o creá tu cuenta para guardar y compartir tus cálculos",
};

type Parametro = string | string[] | undefined;
const primero = (valor: Parametro) => (Array.isArray(valor) ? valor[0] : valor);

/**
 * Pantalla de cuenta: iniciar sesión o crear una.
 *  - `?volver=/ruta`: a dónde regresar al terminar (solo rutas internas, ver `rutaSegura`).
 *  - `?modo=crear`: abre directamente «Crear cuenta».
 * Es dinámica porque lee la configuración de Google del servidor en cada pedido.
 */
export const dynamic = "force-dynamic";

export default async function PaginaCuenta({ searchParams }: { searchParams: Promise<Record<string, Parametro>> }) {
  const parametros = await searchParams;
  const googleHabilitado = Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);

  return (
    <>
      <Cabecera />
      <main id="contenido" className="mx-auto w-full max-w-md flex-1 px-4 py-10 sm:px-6 lg:py-16">
        <FormularioCuenta
          destino={rutaSegura(primero(parametros.volver))}
          modoInicial={primero(parametros.modo) === "crear" ? "crear" : "entrar"}
          googleHabilitado={googleHabilitado}
        />
      </main>
      <Pie />
    </>
  );
}
