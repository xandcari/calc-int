# Backups automáticos de la base de datos (S3 + R2)

Qué hace: todos los días a las 02:00 (hora de Argentina) GitHub Actions hace un `pg_dump` comprimido de Neon y lo sube a
**Amazon S3** y a **Cloudflare R2**. En cada uno se conservan:

| Carpeta | Qué es | Cuántos |
|---|---|---|
| `diario/` | uno por día | los últimos 7 |
| `semanal/` | el primer backup de cada semana ISO | las últimas 4 |
| `mensual/` | el primer backup de cada mes | los últimos 12 |

Archivos: `diario/calc-int-2026-10-31.dump`, `semanal/calc-int-2026-W44.dump`, `mensual/calc-int-2026-10.dump`.
Si un día falla la ejecución, la semana o el mes igual se cubren con el siguiente backup que salga bien.

Archivos del repo: `.github/workflows/backup-bd.yml` (programación) y `scripts/backup/backup.sh` (la lógica).

## Puesta en marcha (una sola vez)

1. **Buckets privados.** Creá uno en S3 y uno en R2. Dejá bloqueado el acceso público (S3: "Block all public access").
   Los backups contienen emails y hashes de contraseñas: nunca deben ser públicos.
2. **Credenciales con el mínimo permiso**, solo para ese bucket:
   - S3 (IAM, usuario nuevo): `s3:PutObject`, `s3:GetObject`, `s3:DeleteObject` sobre `arn:aws:s3:::TU-BUCKET/*` y `s3:ListBucket` sobre `arn:aws:s3:::TU-BUCKET`.
   - R2 (API Token): permiso "Object Read & Write" limitado a ese bucket.
3. **Conexión de la base.** En Neon copiá la cadena **directa** (la que NO tiene `-pooler` en el host). Mejor aún: creá un rol de solo lectura para backups.
4. **Secrets en GitHub** (Settings → Secrets and variables → Actions → New repository secret):
   `BACKUP_DATABASE_URL`, `S3_BUCKET`, `S3_REGION`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`,
   `R2_BUCKET`, `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`.
5. **Probalo ya**: pestaña Actions → "Backup de la base de datos" → Run workflow. Revisá que aparezcan los archivos en `diario/`, `semanal/` y `mensual/` de ambos buckets.

## Cómo restaurar

Bajá el `.dump` que quieras (consola de S3/R2 o `aws s3 cp`) y restauralo **primero en una base de prueba** (por ejemplo una rama nueva de Neon):

```bash
pg_restore --no-owner --clean --if-exists -d "postgresql://...base-de-prueba..." calc-int-2026-10-31.dump
```

Con `pg_restore --list archivo.dump` ves qué contiene. Restaurá en producción solo si estás seguro: `--clean` borra las tablas actuales.

## Cosas a tener en cuenta
- **Probá una restauración** cada tanto (una vez al mes alcanza). Un backup que nunca se restauró no es una garantía.
- **Avisos de fallo:** si el backup falla, GitHub manda un mail a quien editó por última vez el workflow. Revisá que ese mail esté activo.
- **Repos públicos:** GitHub desactiva los workflows programados tras 60 días sin actividad en el repo. Si pasa, reactivalo en Actions.
- **Horario:** GitHub puede demorar el disparo unos minutos u horas en momentos de mucha carga.
- **Neon ya trae restauración a un punto en el tiempo** (ventana corta según el plan). Estos backups son el seguro de largo plazo, no un reemplazo.
- **Cifrado:** S3 y R2 cifran en reposo por defecto. Si querés cifrar además antes de subir, se puede agregar (por ejemplo con `age`), pero entonces tenés que guardar la clave aparte: sin ella no se restaura.
- **Costo:** la base pesa poco (los backups son de KB a pocos MB); 23 archivos por destino cuestan centavos. R2 no cobra transferencia de salida.
