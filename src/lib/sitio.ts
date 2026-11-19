/** Dirección pública de la app. En Vercel se puede cambiar con NEXT_PUBLIC_SITE_URL (por ejemplo, un dominio propio). */
export const URL_SITIO = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://calc-int.vercel.app").replace(/\/+$/, "");

export const NOMBRE_SITIO = "Preciar";
export const DESCRIPCION_SITIO =
  "Calculá el costo real de lo que vendés, tu precio, tu punto de equilibrio y qué pasa si cambian tus costos. Gratis y sin registro.";
