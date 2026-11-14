"use client";

import { createAuthClient } from "better-auth/react";

/** Cliente de Better Auth para el navegador (misma URL base que la app, no hace falta configurarla). */
export const authClient = createAuthClient();

export const { signIn, signUp, signOut, useSession } = authClient;
