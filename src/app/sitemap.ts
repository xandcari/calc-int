import type { MetadataRoute } from "next";

import { URL_SITIO } from "@/lib/sitio";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: `${URL_SITIO}/`, changeFrequency: "monthly", priority: 1 },
    { url: `${URL_SITIO}/calculadora/producto`, changeFrequency: "monthly", priority: 0.8 },
  ];
}
