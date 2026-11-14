import type { Calculo } from "@/domain/types";
import { marcarComoGuardado } from "@/store/cargar-calculo";

/**
 * Funciones del navegador para hablar con /api/calculos. Pensadas para el botón «Guardar y compartir»:
 * `guardarCalculo(calculo)` decide sola si crear (POST) o actualizar (PUT) y devuelve un resultado
 * simple para mostrar el mensaje o el link.
 */

const PATRON_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** `true` si el id es un UUID, es decir, si el cálculo ya está guardado en la base. */
export const esCalculoGuardado = (id: string): boolean => PATRON_UUID.test(id);

/** Ruta pública del link. Si el equipo prefiere otra, se cambia acá y en src/app/c/[id]. */
export const rutaCompartida = (id: string) => `/c/${id}`;

/** Link completo, para copiar y pegar (solo en el navegador). */
export const enlaceCompartido = (id: string) => `${window.location.origin}${rutaCompartida(id)}`;

export type MotivoError =
  | "sin_sesion" // hay que iniciar sesión (guardar el borrador, ir a login y volver)
  | "prohibido" // el cálculo cargado no es del usuario: solo puede verlo
  | "datos_invalidos"
  | "demasiado_grande"
  | "limite_alcanzado"
  | "red"
  | "error";

export type ResultadoGuardado =
  | { ok: true; id: string; creado: boolean }
  | { ok: false; motivo: MotivoError; mensaje: string; detalles?: Array<{ campo: string; mensaje: string }> };

const MOTIVOS: Record<string, MotivoError> = {
  sin_sesion: "sin_sesion",
  prohibido: "prohibido",
  datos_invalidos: "datos_invalidos",
  cuerpo_invalido: "datos_invalidos",
  cuerpo_demasiado_grande: "demasiado_grande",
  limite_alcanzado: "limite_alcanzado",
};

/**
 * Guarda el cálculo. Si `calculo.id` es un UUID (ya se guardó o se cargó desde un link) actualiza con PUT;
 * si no (el borrador local tiene id "borrador") crea uno nuevo con POST y le pone el UUID al borrador.
 * Si el usuario no es el dueño, el servidor responde 403 y acá sale `motivo: "prohibido"`.
 */
export async function guardarCalculo(
  calculo: Calculo,
  { comoNuevo = false }: { comoNuevo?: boolean } = {},
): Promise<ResultadoGuardado> {
  // `comoNuevo`: crea un cálculo aparte aunque este ya esté guardado (el borrador pasa a apuntar al nuevo).
  const existente = !comoNuevo && PATRON_UUID.test(calculo.id);
  try {
    const respuesta = await fetch(existente ? `/api/calculos/${calculo.id}` : "/api/calculos", {
      method: existente ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(calculo),
    });

    if (!respuesta.ok) {
      const cuerpo = (await respuesta.json().catch(() => null)) as {
        error?: { codigo?: string; mensaje?: string; detalles?: Array<{ campo: string; mensaje: string }> };
      } | null;
      return {
        ok: false,
        motivo: MOTIVOS[cuerpo?.error?.codigo ?? ""] ?? "error",
        mensaje: cuerpo?.error?.mensaje ?? "No pudimos guardar el cálculo.",
        detalles: cuerpo?.error?.detalles,
      };
    }

    const { id } = (await respuesta.json()) as { id: string };
    if (!existente) marcarComoGuardado(id);
    return { ok: true, id, creado: !existente };
  } catch {
    return { ok: false, motivo: "red", mensaje: "No hay conexión. Revisá tu internet y probá de nuevo." };
  }
}

/** Activa o desactiva el link para los demás (solo el dueño). */
export async function cambiarCompartido(id: string, compartido: boolean): Promise<boolean> {
  try {
    const respuesta = await fetch(`/api/calculos/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ compartido }),
    });
    return respuesta.ok;
  } catch {
    return false;
  }
}

/** Fila de la lista «Mis cálculos» (GET /api/calculos). */
export interface ResumenCalculo {
  id: string;
  nombre: string;
  tipo: "producto" | "servicio";
  pasoActual: string;
  compartido: boolean;
  creadoEn: string;
  actualizadoEn: string;
}

/** Cálculos del usuario logueado y el máximo permitido. `null` si no hay sesión o falló la consulta. */
export async function listarMisCalculos(): Promise<{ calculos: ResumenCalculo[]; limite: number } | null> {
  try {
    const respuesta = await fetch("/api/calculos", { cache: "no-store" });
    if (!respuesta.ok) return null;
    return (await respuesta.json()) as { calculos: ResumenCalculo[]; limite: number };
  } catch {
    return null;
  }
}

/** Borra un cálculo del usuario (solo el dueño). */
export async function borrarCalculoGuardado(id: string): Promise<boolean> {
  try {
    return (await fetch(`/api/calculos/${id}`, { method: "DELETE" })).ok;
  } catch {
    return false;
  }
}
