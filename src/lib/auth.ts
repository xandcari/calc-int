import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";

import { getDb } from "@/db";
import { account, session, user, verification } from "@/db/schema";

/**
 * Cuentas y sesiones (Better Auth). Variables de entorno:
 *  - BETTER_AUTH_SECRET: obligatoria (mínimo 32 caracteres aleatorios).
 *  - BETTER_AUTH_URL: URL base de la app (http://localhost:3000 en desarrollo).
 *  - GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET: opcionales; si faltan, no se habilita el login con Google.
 *
 * Se crea la primera vez que se usa (ver `getAuth`), no al importar, para no exigir variables durante `next build`.
 */
function crearAuth() {
  const googleClientId = process.env.GOOGLE_CLIENT_ID;
  const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET;

  return betterAuth({
    database: drizzleAdapter(getDb(), {
      provider: "pg",
      // Esquema explícito: Better Auth busca estas claves (user, session, account, verification).
      schema: { user, session, account, verification },
    }),
    emailAndPassword: {
      enabled: true,
      minPasswordLength: 8,
    },
    socialProviders:
      googleClientId && googleClientSecret
        ? { google: { clientId: googleClientId, clientSecret: googleClientSecret } }
        : {},
    // Tiene que ser el ÚLTIMO plugin de la lista: escribe las cookies de sesión desde Server Actions.
    plugins: [nextCookies()],
  });
}

let instancia: ReturnType<typeof crearAuth> | undefined;

export function getAuth() {
  instancia ??= crearAuth();
  return instancia;
}
