import { NextResponse } from "next/server";

import { obtenerUsuario } from "@/lib/sesion";
import { esquemaCalculo } from "@/server/calculos/esquema";
import { contarCalculos, crearCalculo, listarCalculos, MAX_CALCULOS_POR_USUARIO } from "@/server/calculos/repositorio";
import { detallesDeZod, errorJson, leerJsonLimitado } from "@/server/http";
import { esOrigenPropio } from "@/server/origen";

/**
 * POST /api/calculos — guarda un cálculo nuevo del usuario logueado.
 * Cuerpo: el objeto `Calculo` tal cual lo arma el frontend (se ignoran id y fechas).
 * Respuestas: 201 { id, compartido, creadoEn, actualizadoEn } · 400 · 401 · 403 (límite) · 413
 */
export async function POST(request: Request) {
  if (!esOrigenPropio(request)) return errorJson(403, "prohibido", "Origen no permitido.");
  try {
    const usuario = await obtenerUsuario(request.headers);
    if (!usuario) return errorJson(401, "sin_sesion", "Iniciá sesión para guardar tu cálculo.");

    const cuerpo = await leerJsonLimitado(request);
    if (!cuerpo.ok) return cuerpo.respuesta;

    // Aseguramos que la configuración tenga un valor por defecto para 'ruta' si no viene en el body
    const cuerpoDatos = cuerpo.datos as any;
    const datosConRuta = {
      ...cuerpoDatos,
      configuracion: {
        ruta: "estandar",
        ...cuerpoDatos?.configuracion,
      },
    };

    const resultado = esquemaCalculo.safeParse(datosConRuta);
    if (!resultado.success) {
      return errorJson(400, "datos_invalidos", "Los datos del cálculo no son válidos.", detallesDeZod(resultado.error));
    }

    if ((await contarCalculos(usuario.id)) >= MAX_CALCULOS_POR_USUARIO) {
      return errorJson(
        403,
        "limite_alcanzado",
        `Llegaste al máximo de ${MAX_CALCULOS_POR_USUARIO} cálculos guardados. Borrá alguno para guardar otro.`,
      );
    }

    const creado = await crearCalculo(usuario.id, {
      ...resultado.data,
      configuracion: {
        ...resultado.data.configuracion,
        ruta: (resultado.data.configuracion as any).ruta ?? "estandar",
      },
    } as any);

    return NextResponse.json({ ...creado, compartido: true }, { status: 201 });
    } catch (error) {
    console.error("POST /api/calculos", error);
    return errorJson(500, "error_interno", "No pudimos guardar el cálculo. Probá de nuevo en un rato.");
  }
}

/**
 * GET /api/calculos — lista los cálculos del usuario logueado («Mis cálculos»).
 * Respuesta: 200 { calculos: [{ id, nombre, tipo, pasoActual, compartido, creadoEn, actualizadoEn }], limite } · 401
 */
export async function GET(request: Request) {
  try {
    const usuario = await obtenerUsuario(request.headers);
    if (!usuario) return errorJson(401, "sin_sesion", "Iniciá sesión para ver tus cálculos.");

    const filas = await listarCalculos(usuario.id);
    const calculos = filas.map((f) => ({
      ...f,
      creadoEn: f.creadoEn.toISOString(),
      actualizadoEn: f.actualizadoEn.toISOString(),
    }));
    // Es una lista privada: que ninguna caché la guarde.
    return NextResponse.json({ calculos, limite: MAX_CALCULOS_POR_USUARIO }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    console.error("GET /api/calculos", error);
    return errorJson(500, "error_interno", "No pudimos leer tus cálculos. Probá de nuevo en un rato.");
  }
}
