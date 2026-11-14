/**
 * Evita el open redirect: al volver de iniciar sesión solo se acepta una ruta INTERNA.
 * Rechaza "https://sitio.com", "//sitio.com", "/\sitio.com" y cualquier cosa que no empiece con "/".
 * Si el destino no es seguro (o falta), devuelve `porDefecto`.
 */
export function rutaSegura(destino: string | null | undefined, porDefecto = "/calculadora/producto"): string {
  if (!destino) return porDefecto;
  if (!destino.startsWith("/") || destino.startsWith("//") || destino.includes("\\")) return porDefecto;
  // Caracteres de control (saltos de línea, tabs) que algunos navegadores ignoran al interpretar la URL.
  for (let i = 0; i < destino.length; i++) {
    if (destino.charCodeAt(i) < 32) return porDefecto;
  }
  return destino;
}
