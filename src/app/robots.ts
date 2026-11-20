import type { MetadataRoute } from "next";

import { URL_SITIO } from "@/lib/sitio";

/** Se indexa la portada y el recorrido; las pantallas de cuenta, los links compartidos y la API quedan afuera. */
export default function robots(): MetadataRoute.Robots {
  // La app de prueba no se indexa en buscadores.
  if (process.env.NEXT_PUBLIC_MODO_PRUEBA === "1") return { rules: [{ userAgent: "*", disallow: "/" }] };
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/api/", "/c/", "/cuenta", "/mis-calculos", "/test_de_guardado", "/test_de_usuario"] }],
    sitemap: `${URL_SITIO}/sitemap.xml`,
  };
}
