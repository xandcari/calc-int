-- REFERENCIA del esquema. La fuente de verdad es src/db/schema/*.ts (Drizzle).
-- Sirve para revisarlo o para probarlo a mano en el editor SQL de Neon.
-- Si querés partir de cero en una BD de pruebas, primero borrá lo viejo:
--   DROP TABLE IF EXISTS escenario, costo_variable, costo_indirecto, costo_fijo, calculo,
--     verification, account, session, "user" CASCADE;

-- ───────── Better Auth ─────────
CREATE TABLE "user" (
  "id" text PRIMARY KEY,
  "name" text NOT NULL,
  "email" text NOT NULL UNIQUE,
  "email_verified" boolean NOT NULL DEFAULT false,
  "image" text,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE "session" (
  "id" text PRIMARY KEY,
  "expires_at" timestamptz NOT NULL,
  "token" text NOT NULL UNIQUE,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  "ip_address" text,
  "user_agent" text,
  "user_id" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE
);

CREATE TABLE "account" (
  "id" text PRIMARY KEY,
  "account_id" text NOT NULL,
  "provider_id" text NOT NULL,
  "user_id" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "access_token" text,
  "refresh_token" text,
  "id_token" text,
  "access_token_expires_at" timestamptz,
  "refresh_token_expires_at" timestamptz,
  "scope" text,
  "password" text,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE "verification" (
  "id" text PRIMARY KEY,
  "identifier" text NOT NULL,
  "value" text NOT NULL,
  "expires_at" timestamptz NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

-- ───────── Cálculo ─────────
CREATE TYPE "tipo_oferta" AS ENUM ('producto', 'servicio');
CREATE TYPE "moneda" AS ENUM ('ARS');
CREATE TYPE "frecuencia" AS ENUM ('semanal', 'mensual', 'anual');
CREATE TYPE "modo_precio" AS ENUM ('margen', 'manual');
CREATE TYPE "paso_recorrido" AS ENUM ('configuracion', 'costos', 'resumen', 'precio', 'simulador');

CREATE TABLE "calculo" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "usuario_id" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "version_esquema" integer NOT NULL DEFAULT 1,
  "compartido" boolean NOT NULL DEFAULT true,
  "tipo" "tipo_oferta" NOT NULL,
  "nombre" text NOT NULL,
  "moneda" "moneda" NOT NULL DEFAULT 'ARS',
  "unidad_venta" text NOT NULL,
  "unidades_por_lote" numeric,
  "lotes" numeric,
  "volumen_mensual" numeric,
  "trabajo_incluir" boolean NOT NULL DEFAULT false,
  "trabajo_horas_por_lote" numeric,
  "trabajo_horas_mensuales" numeric,
  "trabajo_valor_hora" numeric,
  "precio_modo" "modo_precio" NOT NULL,
  "precio_margen_pct" numeric,
  "precio_manual" numeric,
  "paso_actual" "paso_recorrido" NOT NULL,
  "creado_en" timestamptz NOT NULL DEFAULT now(),
  "actualizado_en" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX "calculo_usuario_idx" ON "calculo" ("usuario_id");

CREATE TABLE "costo_fijo" (
  "calculo_id" uuid NOT NULL REFERENCES "calculo"("id") ON DELETE CASCADE,
  "id" text NOT NULL,
  "orden" integer NOT NULL,
  "nombre" text NOT NULL,
  "nota" text,
  "monto" numeric,
  "frecuencia" "frecuencia" NOT NULL,
  PRIMARY KEY ("calculo_id", "id")
);

CREATE TABLE "costo_indirecto" (
  "calculo_id" uuid NOT NULL REFERENCES "calculo"("id") ON DELETE CASCADE,
  "id" text NOT NULL,
  "orden" integer NOT NULL,
  "nombre" text NOT NULL,
  "nota" text,
  "monto" numeric,
  "frecuencia" "frecuencia" NOT NULL,
  PRIMARY KEY ("calculo_id", "id")
);

CREATE TABLE "costo_variable" (
  "calculo_id" uuid NOT NULL REFERENCES "calculo"("id") ON DELETE CASCADE,
  "id" text NOT NULL,
  "orden" integer NOT NULL,
  "nombre" text NOT NULL,
  "nota" text,
  "monto_unitario" numeric,
  PRIMARY KEY ("calculo_id", "id")
);

CREATE TABLE "escenario" (
  "calculo_id" uuid NOT NULL REFERENCES "calculo"("id") ON DELETE CASCADE,
  "id" text NOT NULL,
  "orden" integer NOT NULL,
  "nombre" text NOT NULL,
  "insumos_pct" numeric,
  "precio_pct" numeric,
  "produccion_pct" numeric,
  PRIMARY KEY ("calculo_id", "id")
);
