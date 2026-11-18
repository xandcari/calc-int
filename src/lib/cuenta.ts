/** Reglas y mensajes de la pantalla de cuenta (iniciar sesión / crear cuenta). Sin dependencias de React. */

/** Mismo mínimo que exige el servidor (`minPasswordLength` en `src/lib/auth.ts`). */
export const LARGO_MINIMO_CONTRASENA = 8;

export type ModoCuenta = "entrar" | "crear";

export interface DatosCuenta {
  modo: ModoCuenta;
  email: string;
  password: string;
}

export type ErroresCuenta = Partial<Record<"email" | "password", string>>;

const FORMATO_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Validación previa al envío, para avisar en el momento y sin ir al servidor. Devuelve {} si todo está bien. */
export function validarCuenta({ modo, email, password }: DatosCuenta): ErroresCuenta {
  const errores: ErroresCuenta = {};
  const correo = email.trim();

  if (!correo) errores.email = "Escribí tu email.";
  else if (!FORMATO_EMAIL.test(correo)) errores.email = "Revisá el email: falta el @ o el dominio (por ejemplo, nombre@correo.com).";

  if (!password) errores.password = "Escribí tu contraseña.";
  else if (modo === "crear" && password.length < LARGO_MINIMO_CONTRASENA) {
    errores.password = `La contraseña tiene que tener al menos ${LARGO_MINIMO_CONTRASENA} caracteres.`;
  }

  return errores;
}

/** Nombre a mostrar cuando la persona no lo carga: la parte del email antes de la @. */
export function nombreDesdeEmail(email: string): string {
  return email.trim().split("@")[0] || "Usuario";
}

const MENSAJE_GENERICO = "No pudimos completar la operación. Probá de nuevo en unos minutos.";

const MENSAJES_POR_CODIGO: Record<string, string> = {
  INVALID_EMAIL_OR_PASSWORD: "El email o la contraseña no coinciden. Revisalos e intentá de nuevo.",
  INVALID_PASSWORD: "El email o la contraseña no coinciden. Revisalos e intentá de nuevo.",
  USER_NOT_FOUND: "El email o la contraseña no coinciden. Revisalos e intentá de nuevo.",
  USER_ALREADY_EXISTS: "Ya hay una cuenta con ese email. Probá iniciar sesión.",
  USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL: "Ya hay una cuenta con ese email. Probá iniciar sesión.",
  INVALID_EMAIL: "El email no parece válido. Revisalo e intentá de nuevo.",
  PASSWORD_TOO_SHORT: `La contraseña tiene que tener al menos ${LARGO_MINIMO_CONTRASENA} caracteres.`,
  PASSWORD_TOO_LONG: "La contraseña es demasiado larga.",
  EMAIL_NOT_VERIFIED: "Todavía no verificaste tu email.",
};

/**
 * Traduce el error que devuelve Better Auth a un mensaje claro en español.
 * Nunca muestra el texto original (viene en inglés) ni dice cuál de los dos datos falló al iniciar sesión.
 */
export function mensajeDeErrorDeCuenta(error: { code?: string; status?: number } | null | undefined): string {
  if (error?.code && MENSAJES_POR_CODIGO[error.code]) return MENSAJES_POR_CODIGO[error.code];
  if (error?.status === 429) return "Hiciste demasiados intentos seguidos. Esperá un momento y probá de nuevo.";
  return MENSAJE_GENERICO;
}
