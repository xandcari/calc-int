import { NextResponse } from "next/server";

import { detallesDeZod, errorJson, leerJsonLimitado } from "@/server/http";
import { esOrigenPropio } from "@/server/origen";
import {
  MAX_NOTAS_POR_AUTOR,
  MAX_NOTAS_POR_MINUTO,
  aCsv,
  esTokenValido,
  esquemaObservacion,
  modoPruebaActivo,
} from "@/server/prueba/esquema";
import { contarDelAutor, crearObservacion, listarObservaciones, paraCliente } from "@/server/prueba/repositorio";

const SIN_CACHE = { "Cache-Control": "private, no-store" };

/**
 * GET /api/prueba/observaciones — todas las notas de la prueba (las ve cualquiera que tenga el link).
 *  - Encabezado `x-token-autor`: marca con `mia: true` las notas de ese navegador.
 *  - `?formato=csv`: descarga para Excel / Google Sheets.
 */
export async function GET(request: Request) {
  if (!modoPruebaActivo()) return errorJson(404, "no_encontrado", "No encontrado.");
  try {
    const filas = await listarObservaciones();

    if (new URL(request.url).searchParams.get("formato") === "csv") {
      return new NextResponse(aCsv(filas), {
        headers: {
          ...SIN_CACHE,
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": 'attachment; filename="observaciones-preciar.csv"',
        },
      });
    }

    const token = request.headers.get("x-token-autor");
    return NextResponse.json({ observaciones: filas.map((f) => paraCliente(f, token)) }, { headers: SIN_CACHE });
  } catch (error) {
    console.error("GET /api/prueba/observaciones", error);
    return errorJson(500, "error_interno", "No pudimos leer las notas. ¿Está conectada la base de datos?");
  }
}

/**
 * POST /api/prueba/observaciones — guarda una nota. Encabezado `x-token-autor` obligatorio (lo genera el navegador).
 * Respuestas: 201 { observacion } · 400 · 403 (límite) · 413
 */
export async function POST(request: Request) {
  if (!modoPruebaActivo()) return errorJson(404, "no_encontrado", "No encontrado.");
  if (!esOrigenPropio(request)) return errorJson(403, "prohibido", "Origen no permitido.");
  try {
    const token = request.headers.get("x-token-autor");
    if (!esTokenValido(token)) return errorJson(400, "datos_invalidos", "Falta el identificador del navegador.");

    const cuerpo = await leerJsonLimitado(request);
    if (!cuerpo.ok) return cuerpo.respuesta;

    const resultado = esquemaObservacion.safeParse(cuerpo.datos);
    if (!resultado.success) {
      return errorJson(400, "datos_invalidos", "La nota no es válida.", detallesDeZod(resultado.error));
    }

    const previas = await contarDelAutor(token);
    if (previas.total >= MAX_NOTAS_POR_AUTOR) {
      return errorJson(403, "limite_alcanzado", "Llegaste al máximo de notas para este navegador.");
    }
    if (previas.ultimoMinuto >= MAX_NOTAS_POR_MINUTO) {
      return errorJson(403, "limite_alcanzado", "Estás enviando muchas notas juntas. Esperá un minuto.");
    }

    const creada = await crearObservacion(token, resultado.data);
    return NextResponse.json({ observacion: paraCliente(creada, token) }, { status: 201, headers: SIN_CACHE });
  } catch (error) {
    console.error("POST /api/prueba/observaciones", error);
    return errorJson(500, "error_interno", "No pudimos guardar la nota. ¿Está conectada la base de datos?");
  }
}
