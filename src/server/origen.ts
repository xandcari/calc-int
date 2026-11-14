/**
 * Defensa extra contra CSRF (que otra web haga pedir cosas «como vos» usando tu sesión).
 * Si la petición trae el encabezado `Origin` (los navegadores lo mandan en POST/PUT/PATCH/DELETE),
 * tiene que ser el mismo sitio que la app. Si no lo trae (herramientas como curl), se deja pasar:
 * esas no usan las cookies de un navegador ajeno.
 */
export function esOrigenPropio(request: Request): boolean {
  const origen = request.headers.get("origin");
  if (!origen) return true;

  // Detrás del proxy de Vercel el host real llega en x-forwarded-host.
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  try {
    return new URL(origen).host === host;
  } catch {
    return false; // Origin: "null" u otro valor que no es una URL
  }
}
