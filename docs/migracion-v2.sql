-- Migración v1 -> v2 (ruta de producción, sueldo mensual y base de los insumos).
-- Equivale a lo que hace `npm run db:push` con el esquema nuevo. Sirve si preferís aplicarla a mano
-- en el editor SQL de Neon. Es segura de correr sobre una base con datos: los cálculos ya guardados
-- quedan con ruta «lotes», sin sueldo mensual y con los insumos «por unidad» (como funcionaban antes).
-- Correla UNA sola vez. Si los tipos ya existen, la transacción se cancela sin cambiar nada.

BEGIN;
CREATE TYPE "ruta_produccion" AS ENUM ('lotes', 'unidad', 'reventa');
CREATE TYPE "base_insumo" AS ENUM ('unidad', 'lote');

ALTER TABLE "calculo" ADD COLUMN "ruta" "ruta_produccion" NOT NULL DEFAULT 'lotes';
ALTER TABLE "calculo" ADD COLUMN "trabajo_sueldo_mensual" numeric;
ALTER TABLE "calculo" ALTER COLUMN "version_esquema" SET DEFAULT 2;
ALTER TABLE "costo_variable" ADD COLUMN "base" "base_insumo";
COMMIT;
