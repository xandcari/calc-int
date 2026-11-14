import { toNextJsHandler } from "better-auth/next-js";

import { getAuth } from "@/lib/auth";

/** Todas las rutas de Better Auth (/api/auth/sign-in/email, /api/auth/sign-up/email, /api/auth/get-session, etc.). */
export const GET = (request: Request) => toNextJsHandler(getAuth()).GET(request);
export const POST = (request: Request) => toNextJsHandler(getAuth()).POST(request);
