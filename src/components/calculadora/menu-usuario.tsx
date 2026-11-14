"use client";

import Link from "next/link";

import { useSession } from "@/lib/auth-client";

/**
 * Acceso a la cuenta en la parte superior derecha del recorrido.
 * Con sesión: muestra el nombre del usuario y lleva a «Mis cálculos». Sin sesión: invita a iniciar sesión.
 * Provisorio: ambos enlaces apuntan a las páginas de prueba (/test_de_usuario y /test_de_guardado);
 * cuando exista la interfaz real de cuenta, cambiar solo los `href`.
 */
export function MenuUsuario() {
  const { data: sesion, isPending } = useSession();
  if (isPending) return null;

  const clases =
    "block max-w-full truncate text-sm font-semibold text-primary-700 underline-offset-2 hover:underline " +
    "focus-visible:outline-2 focus-visible:outline-primary-600";

  return sesion ? (
    <Link href="/test_de_usuario" className={clases} title="Ver mis cálculos guardados">
      <span aria-hidden="true">👤 </span>
      {sesion.user.name || sesion.user.email}
    </Link>
  ) : (
    <Link href="/test_de_guardado" className={clases}>
      Iniciar sesión
    </Link>
  );
}
