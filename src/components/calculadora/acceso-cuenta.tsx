"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

import { BotonLink } from "@/components/ui/boton";
import { signOut, useSession } from "@/lib/auth-client";

const ENLACE =
  "rounded text-sm font-semibold text-primary-700 underline-offset-4 hover:underline " +
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-700";

/**
 * Acceso a la cuenta en el encabezado de la portada.
 *  - Sin sesión: «Iniciar sesión» y «Crear cuenta» (llevan a /cuenta).
 *  - Con sesión: «Mis cálculos» y «Cerrar sesión».
 * Mientras se consulta la sesión reserva el lugar para que el encabezado no se mueva.
 */
export function AccesoCuenta() {
  const router = useRouter();
  const { data: sesion, isPending } = useSession();

  if (isPending) return <div aria-hidden="true" className="h-11 w-24 sm:w-56" />;

  if (sesion) {
    return (
      <div className="flex items-center gap-4">
        <Link href="/mis-calculos" className={ENLACE}>
          Mis cálculos
        </Link>
        <button
          type="button"
          className={`${ENLACE} min-h-11`}
          onClick={async () => {
            await signOut();
            router.refresh();
          }}
        >
          Cerrar sesión
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-4">
      <Link href="/cuenta" className={`${ENLACE} inline-flex min-h-11 items-center`}>
        Iniciar sesión
      </Link>
      <BotonLink href="/cuenta?modo=crear" variante="secundario" className="hidden px-5 sm:inline-flex">
        Crear cuenta
      </BotonLink>
    </div>
  );
}
