import type { NextConfig } from "next";

/** Encabezados de seguridad para todas las rutas. */
const encabezadosDeSeguridad = [
  // El navegador no «adivina» el tipo de un archivo (evita que un texto se ejecute como script).
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Que nadie pueda meter la app dentro de un <iframe> para engañar con clics (clickjacking).
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  // Obliga a usar HTTPS durante 1 año (los navegadores lo ignoran en http://localhost).
  { key: "Strict-Transport-Security", value: "max-age=31536000" },
  // CSP mínima que no rompe nada: nadie puede enmarcar la app, cambiar la base de las URL ni cargar plugins.
  // (Una CSP estricta para scripts y estilos necesita un inventario previo: ver docs/seguridad.md.)
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'; base-uri 'self'; object-src 'none'" },
];

// En la app de prueba también se pide a los buscadores que no la indexen.
const sinIndexar = process.env.NEXT_PUBLIC_MODO_PRUEBA === "1" ? [{ key: "X-Robots-Tag", value: "noindex, nofollow" }] : [];

const nextConfig: NextConfig = {
  async headers() {
    return [{ source: "/:path*", headers: [...encabezadosDeSeguridad, ...sinIndexar] }];
  },
};

export default nextConfig;
