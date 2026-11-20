import { useSyncExternalStore } from "react";

/**
 * Quién anota en la app de prueba: un nombre que la persona escribe una vez (queda en este navegador, sin cuenta)
 * y un identificador al azar que sirve para que cada quien pueda borrar solo sus notas.
 */
const CLAVE_NOMBRE = "preciar-prueba-nombre";
const CLAVE_TOKEN = "preciar-prueba-token";

const escuchas = new Set<() => void>();
let nombreEnMemoria = "";
let tokenEnMemoria = "";

function suscribir(f: () => void) {
  escuchas.add(f);
  window.addEventListener("storage", f);
  return () => {
    escuchas.delete(f);
    window.removeEventListener("storage", f);
  };
}

function leerNombre(): string {
  try {
    return window.localStorage.getItem(CLAVE_NOMBRE) ?? nombreEnMemoria;
  } catch {
    return nombreEnMemoria;
  }
}

export function useNombre(): string {
  return useSyncExternalStore(suscribir, leerNombre, () => "");
}

export function guardarNombre(nombre: string) {
  nombreEnMemoria = nombre.trim().slice(0, 40);
  try {
    window.localStorage.setItem(CLAVE_NOMBRE, nombreEnMemoria);
  } catch {
    /* sin almacenamiento: el nombre dura mientras la pestaña siga abierta */
  }
  escuchas.forEach((f) => f());
}

/** Identificador de este navegador (se crea la primera vez que hace falta). */
export function obtenerToken(): string {
  try {
    const guardado = window.localStorage.getItem(CLAVE_TOKEN);
    if (guardado) return guardado;
  } catch {
    /* se usa uno en memoria */
  }
  if (!tokenEnMemoria) tokenEnMemoria = crypto.randomUUID().replace(/-/g, "");
  try {
    window.localStorage.setItem(CLAVE_TOKEN, tokenEnMemoria);
  } catch {
    /* sin almacenamiento */
  }
  return tokenEnMemoria;
}
