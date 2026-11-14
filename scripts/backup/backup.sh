#!/usr/bin/env bash
# Backup de la base de datos (PostgreSQL) a DOS destinos: Amazon S3 y Cloudflare R2.
#
# Cada ejecución:
#   1. Hace un pg_dump comprimido (formato custom, nivel 9) y comprueba que sea legible.
#   2. Lo sube a diario/  (se conservan los últimos 7)
#   3. Si todavía no hay copia de esta semana (ISO), la copia a semanal/ (se conservan las últimas 4)
#   4. Si todavía no hay copia de este mes, la copia a mensual/ (se conservan los últimos 12)
#   5. Borra lo que sobre en cada carpeta (solo archivos con el nombre esperado).
# Si un destino falla, igual se intenta el otro, y el script termina con error para que se note.
#
# Variables (en GitHub: Settings → Secrets and variables → Actions):
#   BACKUP_DATABASE_URL                      conexión DIRECTA de Neon (sin "-pooler" en el host)
#   S3_BUCKET, S3_REGION, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY
#   R2_BUCKET, R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY
# Opcionales: BACKUP_PREFIJO (por defecto "calc-int"), PG_BIN (carpeta con pg_dump), FECHA_BACKUP (AAAA-MM-DD, para pruebas).

set -euo pipefail

: "${BACKUP_DATABASE_URL:?Falta BACKUP_DATABASE_URL}"
: "${S3_BUCKET:?Falta S3_BUCKET}" "${S3_REGION:?Falta S3_REGION}"
: "${S3_ACCESS_KEY_ID:?Falta S3_ACCESS_KEY_ID}" "${S3_SECRET_ACCESS_KEY:?Falta S3_SECRET_ACCESS_KEY}"
: "${R2_BUCKET:?Falta R2_BUCKET}" "${R2_ACCOUNT_ID:?Falta R2_ACCOUNT_ID}"
: "${R2_ACCESS_KEY_ID:?Falta R2_ACCESS_KEY_ID}" "${R2_SECRET_ACCESS_KEY:?Falta R2_SECRET_ACCESS_KEY}"

PREFIJO="${BACKUP_PREFIJO:-calc-int}"
# La fecha se toma en hora de Argentina: "el backup del día" es el del día local.
FECHA="${FECHA_BACKUP:-$(TZ=America/Argentina/Buenos_Aires date +%F)}"
SEMANA="$(date -d "$FECHA" +%G-W%V)"   # semana ISO, ej. 2026-W44
MES="$(date -d "$FECHA" +%Y-%m)"

CONSERVAR_DIARIOS=7
CONSERVAR_SEMANALES=4
CONSERVAR_MENSUALES=12

if [ -n "${PG_BIN:-}" ]; then PG_DUMP="$PG_BIN/pg_dump"; PG_RESTORE="$PG_BIN/pg_restore"; else PG_DUMP=pg_dump; PG_RESTORE=pg_restore; fi

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
ARCHIVO="$TMP/${PREFIJO}-${FECHA}.dump"

echo "== 1. Generando el backup ($FECHA)"
# --format=custom ya viene comprimido; se restaura con pg_restore (permite elegir tablas).
# --no-owner/--no-privileges: se puede restaurar en otra cuenta o rol sin errores de permisos.
"$PG_DUMP" --format=custom --compress=9 --no-owner --no-privileges --file="$ARCHIVO" "$BACKUP_DATABASE_URL"

# Un backup que no se puede leer no sirve: se comprueba antes de subirlo.
TAMANO="$(stat -c %s "$ARCHIVO")"
[ "$TAMANO" -gt 1024 ] || { echo "ERROR: el backup pesa solo $TAMANO bytes."; exit 1; }
"$PG_RESTORE" --list "$ARCHIVO" > /dev/null || { echo "ERROR: el backup no es legible por pg_restore."; exit 1; }
echo "   OK: $TAMANO bytes, legible."

# Un wrapper de `aws` por destino. Las credenciales se pasan solo a ese comando.
aws_s3() {
  AWS_ACCESS_KEY_ID="$S3_ACCESS_KEY_ID" AWS_SECRET_ACCESS_KEY="$S3_SECRET_ACCESS_KEY" \
    AWS_DEFAULT_REGION="$S3_REGION" aws "$@"
}
aws_r2() {
  # R2 no acepta los checksums extra que agregan las versiones nuevas de la CLI de AWS.
  AWS_ACCESS_KEY_ID="$R2_ACCESS_KEY_ID" AWS_SECRET_ACCESS_KEY="$R2_SECRET_ACCESS_KEY" \
    AWS_DEFAULT_REGION=auto AWS_REQUEST_CHECKSUM_CALCULATION=when_required \
    AWS_RESPONSE_CHECKSUM_VALIDATION=when_required \
    aws --endpoint-url "https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com" "$@"
}

existe() { # existe <wrapper> <bucket> <clave>
  "$1" s3api head-object --bucket "$2" --key "$3" > /dev/null 2>&1
}

# Deja solo las últimas N copias de una carpeta. Los nombres llevan la fecha, así que ordenar = ordenar por antigüedad.
# Solo toca archivos con el patrón esperado: nunca borra algo que no haya creado este script.
podar() { # podar <wrapper> <bucket> <carpeta> <cuantas>
  local claves total
  claves="$("$1" s3api list-objects-v2 --bucket "$2" --prefix "$3/" --query 'Contents[].Key' --output text \
    | tr '\t' '\n' | grep -E "^$3/${PREFIJO}-[0-9]{4}-[0-9W-]+\.dump$" | sort || true)"
  total="$(printf '%s\n' "$claves" | grep -c . || true)"
  if [ "$total" -gt "$4" ]; then
    printf '%s\n' "$claves" | head -n "$((total - $4))" | while read -r clave; do
      echo "   borrando $3: $clave"
      "$1" s3 rm "s3://$2/$clave" > /dev/null || return 1
    done
  fi
}

# Sube y rota en un destino. Cada comando que puede fallar lleva "|| return 1": dentro de un
# `if`/`||` bash ignora `set -e`, así que el control de errores es explícito.
procesar_destino() { # procesar_destino <nombre> <wrapper> <bucket>
  local nombre="$1" aws_="$2" bucket="$3"
  local diario="diario/${PREFIJO}-${FECHA}.dump"
  local semanal="semanal/${PREFIJO}-${SEMANA}.dump"
  local mensual="mensual/${PREFIJO}-${MES}.dump"

  echo "== 2. [$nombre] subiendo $diario"
  "$aws_" s3 cp "$ARCHIVO" "s3://$bucket/$diario" --only-show-errors || return 1

  # Se comprueba que lo guardado tenga el mismo tamaño que el archivo local.
  local remoto
  remoto="$("$aws_" s3api head-object --bucket "$bucket" --key "$diario" --query ContentLength --output text)" || return 1
  [ "$remoto" = "$TAMANO" ] || { echo "ERROR [$nombre]: se subieron $remoto bytes y el archivo pesa $TAMANO."; return 1; }

  # La primera copia de cada semana/mes se promueve a semanal/mensual (copia dentro del mismo bucket).
  if ! existe "$aws_" "$bucket" "$semanal"; then
    echo "   [$nombre] primera copia de la semana $SEMANA -> $semanal"
    "$aws_" s3 cp "s3://$bucket/$diario" "s3://$bucket/$semanal" --only-show-errors || return 1
  fi
  if ! existe "$aws_" "$bucket" "$mensual"; then
    echo "   [$nombre] primera copia del mes $MES -> $mensual"
    "$aws_" s3 cp "s3://$bucket/$diario" "s3://$bucket/$mensual" --only-show-errors || return 1
  fi

  echo "== 3. [$nombre] limpiando copias viejas"
  podar "$aws_" "$bucket" diario "$CONSERVAR_DIARIOS" || return 1
  podar "$aws_" "$bucket" semanal "$CONSERVAR_SEMANALES" || return 1
  podar "$aws_" "$bucket" mensual "$CONSERVAR_MENSUALES" || return 1
  echo "   [$nombre] listo."
}

FALLOS=0
procesar_destino "S3" aws_s3 "$S3_BUCKET" || { echo "FALLÓ el destino S3"; FALLOS=$((FALLOS + 1)); }
procesar_destino "R2" aws_r2 "$R2_BUCKET" || { echo "FALLÓ el destino R2"; FALLOS=$((FALLOS + 1)); }

if [ "$FALLOS" -gt 0 ]; then
  echo "Backup incompleto: falló $FALLOS de 2 destinos."
  exit 1
fi
echo "Backup completo en S3 y R2."
