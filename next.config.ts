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
];

const nextConfig: NextConfig = {
  async headers() {
    return [{ source: "/:path*", headers: encabezadosDeSeguridad }];
  },
};

export default nextConfig;
