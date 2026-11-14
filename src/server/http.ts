import { NextResponse } from "next/server";
import type { ZodError } from "zod";

import { MAX_BYTES_CUERPO } from "@/server/calculos/esquema";

/** Códigos de error estables: el frontend puede decidir qué mostrar según `codigo`. */
export type CodigoError =
  | "sin_sesion"
  | "prohibido"
  | "no_encontrado"
  | "cuerpo_invalido"
  | "datos_invalidos"
  | "cuerpo_demasiado_grande"
  | "limite_alcanzado"
  | "error_interno";

export interface DetalleError {
  campo: string;
  mensaje: string;
}

export function errorJson(status: number, codigo: CodigoError, mensaje: string, detalles?: DetalleError[]) {
  return NextResponse.json({ error: { codigo, mensaje, ...(detalles ? { detalles } : {}) } }, { status });
}

/** Convierte los problemas de Zod en una lista corta y legible (máximo 20). */
export function detallesDeZod(error: ZodError): DetalleError[] {
  return error.issues.slice(0, 20).map((i) => ({ campo: i.path.join("."), mensaje: i.message }));
}

/** Los UUID de Postgres: evita consultar la BD con ids que no pueden existir (y el error de sintaxis que daría). */
const PATRON_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const esUuid = (valor: string): boolean => PATRON_UUID.test(valor);

type ResultadoCuerpo = { ok: true; datos: unknown } | { ok: false; respuesta: NextResponse };

/**
 * Lee el cuerpo JSON de la petición con tope de tamaño.
 * 413 si supera `MAX_BYTES_CUERPO` (se corta la lectura apenas se pasa, no se carga todo en memoria);
 * 400 si no es JSON válido.
 */
export async function leerJsonLimitado(request: Request): Promise<ResultadoCuerpo> {
  const demasiadoGrande = () =>
    ({
      ok: false,
      respuesta: errorJson(
        413,
        "cuerpo_demasiado_grande",
        `El cálculo es demasiado grande (máximo ${MAX_BYTES_CUERPO / 1024} KB).`,
      ),
    }) as const;

  // Descarte rápido por el encabezado, si el cliente lo manda.
  const declarado = Number(request.headers.get("content-length"));
  if (Number.isFinite(declarado) && declarado > MAX_BYTES_CUERPO) return demasiadoGrande();

  // El encabezado puede faltar o mentir: se cuentan los bytes realmente recibidos.
  const lector = request.body?.getReader();
  if (!lector) {
    return { ok: false, respuesta: errorJson(400, "cuerpo_invalido", "Falta el cuerpo de la petición.") };
  }
  const partes: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await lector.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_BYTES_CUERPO) {
      await lector.cancel();
      return demasiadoGrande();
    }
    partes.push(value);
  }

  try {
    const texto = new TextDecoder().decode(Buffer.concat(partes));
    return { ok: true, datos: JSON.parse(texto) };
  } catch {
    return { ok: false, respuesta: errorJson(400, "cuerpo_invalido", "El cuerpo no es un JSON válido.") };
  }
}
