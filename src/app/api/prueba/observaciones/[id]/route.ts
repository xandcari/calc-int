import { NextResponse } from "next/server";

import { detallesDeZod, errorJson, esUuid, leerJsonLimitado } from "@/server/http";
import { esOrigenPropio } from "@/server/origen";
import { esTokenValido, esquemaResuelta, modoPruebaActivo } from "@/server/prueba/esquema";
import { borrarPropia, cambiarResuelta } from "@/server/prueba/repositorio";

/** Next 16: `params` es una Promise. */
type Contexto = { params: Promise<{ id: string }> };

const NO_ENCONTRADA = () => errorJson(404, "no_encontrado", "No encontramos esa nota.");

/** PATCH /api/prueba/observaciones/:id — marca la nota como resuelta o la reabre (cualquiera del equipo puede). */
export async function PATCH(request: Request, { params }: Contexto) {
  if (!modoPruebaActivo()) return errorJson(404, "no_encontrado", "No encontrado.");
  if (!esOrigenPropio(request)) return errorJson(403, "prohibido", "Origen no permitido.");
  try {
    const { id } = await params;
    if (!esUuid(id)) return NO_ENCONTRADA();

    const cuerpo = await leerJsonLimitado(request);
    if (!cuerpo.ok) return cuerpo.respuesta;
    const resultado = esquemaResuelta.safeParse(cuerpo.datos);
    if (!resultado.success) {
      return errorJson(400, "datos_invalidos", "Dato inválido.", detallesDeZod(resultado.error));
    }

    return (await cambiarResuelta(id, resultado.data.resuelta)) ? NextResponse.json({ ok: true }) : NO_ENCONTRADA();
  } catch (error) {
    console.error("PATCH /api/prueba/observaciones/:id", error);
    return errorJson(500, "error_interno", "No pudimos actualizar la nota.");
  }
}

/** DELETE /api/prueba/observaciones/:id — borra una nota propia (mismo navegador que la escribió). */
export async function DELETE(request: Request, { params }: Contexto) {
  if (!modoPruebaActivo()) return errorJson(404, "no_encontrado", "No encontrado.");
  if (!esOrigenPropio(request)) return errorJson(403, "prohibido", "Origen no permitido.");
  try {
    const { id } = await params;
    const token = request.headers.get("x-token-autor");
    if (!esUuid(id) || !esTokenValido(token)) return NO_ENCONTRADA();
    return (await borrarPropia(id, token)) ? NextResponse.json({ ok: true }) : NO_ENCONTRADA();
  } catch (error) {
    console.error("DELETE /api/prueba/observaciones/:id", error);
    return errorJson(500, "error_interno", "No pudimos borrar la nota.");
  }
}
