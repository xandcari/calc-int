import { getAuth } from "@/lib/auth";

/**
 * Usuario de la sesión actual, o null si no inició sesión.
 * Se llama con los encabezados de la petición: `obtenerUsuario(request.headers)` en un route handler,
 * o `obtenerUsuario(await headers())` en un Server Component.
 */
export async function obtenerUsuario(headers: Headers) {
  const sesion = await getAuth().api.getSession({ headers });
  return sesion?.user ?? null;
}
