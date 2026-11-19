"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { useSession } from "@/lib/auth-client";

/**
 * Acceso a la cuenta en la parte superior derecha del recorrido.
 * Con sesión: muestra el nombre del usuario y lleva a «Mis cálculos». Sin sesión: invita a iniciar sesión.
 * «Iniciar sesión» lleva a /cuenta y, al terminar, vuelve a la pantalla donde estaba la persona.
 */
export function MenuUsuario() {
  const { data: sesion, isPending } = useSession();
  const ruta = usePathname();
  if (isPending) return null;

  const clases =
    "block max-w-full truncate text-sm font-semibold text-primary-700 underline-offset-2 hover:underline " +
    "focus-visible:outline-2 focus-visible:outline-primary-600";

  return sesion ? (
    <Link href="/mis-calculos" className={clases} title="Ver mis cálculos guardados">
      <span aria-hidden="true">👤 </span>
      {sesion.user.name || sesion.user.email}
    </Link>
  ) : (
    <Link href={`/cuenta?volver=${encodeURIComponent(ruta)}`} className={clases}>
      Iniciar sesión
    </Link>
  );
}
