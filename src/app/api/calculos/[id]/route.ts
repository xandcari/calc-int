import { NextResponse } from "next/server";

import { obtenerUsuario } from "@/lib/sesion";
import { esquemaCalculo, esquemaCompartir } from "@/server/calculos/esquema";
import {
  borrarCalculo,
  buscarDueno,
  cambiarCompartido,
  leerCalculo,
  reemplazarCalculo,
} from "@/server/calculos/repositorio";
import { detallesDeZod, errorJson, esUuid, leerJsonLimitado } from "@/server/http";
import { esOrigenPropio } from "@/server/origen";

/** Next 16: `params` es una Promise. */
type Contexto = { params: Promise<{ id: string }> };

type Usuario = NonNullable<Awaited<ReturnType<typeof obtenerUsuario>>>;
/** Resultado de `exigirDueno`: o la respuesta de error que hay que devolver, o el usuario dueño. */
type ResultadoDueno = { error: NextResponse; usuario?: undefined } | { error?: undefined; usuario: Usuario };

const NO_ENCONTRADO = () => errorJson(404, "no_encontrado", "No encontramos ese cálculo.");

/**
 * Comprueba que el usuario logueado es el dueño. Devuelve la respuesta de error si no lo es.
 * Si el cálculo no está compartido y no es tuyo, responde 404 (no revela que existe).
 */
async function exigirDueno(request: Request, id: string): Promise<ResultadoDueno> {
  // Solo se usa en PUT/PATCH/DELETE (escrituras): se exige que la petición venga de este mismo sitio.
  if (!esOrigenPropio(request)) return { error: errorJson(403, "prohibido", "Origen no permitido.") };
  if (!esUuid(id)) return { error: NO_ENCONTRADO() };

  const usuario = await obtenerUsuario(request.headers);
  if (!usuario) return { error: errorJson(401, "sin_sesion", "Iniciá sesión para modificar este cálculo.") };

  const fila = await buscarDueno(id);
  if (!fila) return { error: NO_ENCONTRADO() };
  if (fila.usuarioId !== usuario.id) {
    return {
      error: fila.compartido
        ? errorJson(403, "prohibido", "Solo el dueño puede modificar este cálculo.")
        : NO_ENCONTRADO(),
    };
  }
  return { usuario };
}

/**
 * GET /api/calculos/:id — lectura PÚBLICA (no pide sesión) si el cálculo está compartido.
 * Si no está compartido, solo lo ve su dueño; para el resto es un 404.
 * Respuesta: { calculo, esDueno, compartido }
 */
export async function GET(request: Request, { params }: Contexto) {
  try {
    const { id } = await params;
    if (!esUuid(id)) return NO_ENCONTRADO();

    const encontrado = await leerCalculo(id);
    if (!encontrado) return NO_ENCONTRADO();

    // La sesión es opcional acá: sirve solo para saber si quien mira es el dueño.
    const usuario = await obtenerUsuario(request.headers);
    const esDueno = usuario?.id === encontrado.usuarioId;
    if (!encontrado.compartido && !esDueno) return NO_ENCONTRADO();

    return NextResponse.json(
      { calculo: encontrado.calculo, esDueno, compartido: encontrado.compartido },
      // La respuesta depende de quién pregunta (esDueno): que ninguna caché la comparta entre usuarios.
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    console.error("GET /api/calculos/[id]", error);
    return errorJson(500, "error_interno", "No pudimos leer el cálculo. Probá de nuevo en un rato.");
  }
}

/**
 * PUT /api/calculos/:id — guarda cambios. Solo el dueño.
 * Cuerpo: el `Calculo` completo. Respuestas: 200 { id, actualizadoEn } · 400 · 401 · 403 · 404 · 413
 */
export async function PUT(request: Request, { params }: Contexto) {
  try {
    const { id } = await params;
    const dueno = await exigirDueno(request, id);
    if (dueno.error) return dueno.error;

    const cuerpo = await leerJsonLimitado(request);
    if (!cuerpo.ok) return cuerpo.respuesta;

    const resultado = esquemaCalculo.safeParse(cuerpo.datos);
    if (!resultado.success) {
      return errorJson(400, "datos_invalidos", "Los datos del cálculo no son válidos.", detallesDeZod(resultado.error));
    }

    return NextResponse.json(await reemplazarCalculo(id, resultado.data));
  } catch (error) {
    console.error("PUT /api/calculos/[id]", error);
    return errorJson(500, "error_interno", "No pudimos guardar los cambios. Probá de nuevo en un rato.");
  }
}

/**
 * PATCH /api/calculos/:id — activa o desactiva el link para los demás. Solo el dueño.
 * Cuerpo: { compartido: boolean }. Respuesta: 200 { id, compartido }
 */
export async function PATCH(request: Request, { params }: Contexto) {
  try {
    const { id } = await params;
    const dueno = await exigirDueno(request, id);
    if (dueno.error) return dueno.error;

    const cuerpo = await leerJsonLimitado(request);
    if (!cuerpo.ok) return cuerpo.respuesta;

    const resultado = esquemaCompartir.safeParse(cuerpo.datos);
    if (!resultado.success) {
      return errorJson(400, "datos_invalidos", "Se esperaba { compartido: true | false }.", detallesDeZod(resultado.error));
    }

    await cambiarCompartido(id, dueno.usuario.id, resultado.data.compartido);
    return NextResponse.json({ id, compartido: resultado.data.compartido });
  } catch (error) {
    console.error("PATCH /api/calculos/[id]", error);
    return errorJson(500, "error_interno", "No pudimos actualizar el link. Probá de nuevo en un rato.");
  }
}

/** DELETE /api/calculos/:id — borra el cálculo. Solo el dueño. Respuesta: 204 */
export async function DELETE(request: Request, { params }: Contexto) {
  try {
    const { id } = await params;
    const dueno = await exigirDueno(request, id);
    if (dueno.error) return dueno.error;

    await borrarCalculo(id, dueno.usuario.id);
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error("DELETE /api/calculos/[id]", error);
    return errorJson(500, "error_interno", "No pudimos borrar el cálculo. Probá de nuevo en un rato.");
  }
}
