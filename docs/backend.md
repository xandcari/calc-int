# Documentación técnica — Backend (calc-int)

Persistencia, cuentas y enlaces para compartir de la Calculadora Inteligente de Costos, Precios y
Punto de Equilibrio. Reemplaza y amplía la versión anterior.

> **Alcance.** Según el plan del producto, el MVP puede funcionar 100 % en el navegador y las
> cuentas/persistencia están en *Future Scope*. Este backend implementa esa parte de forma anticipada:
> **no recalcula nada**, solo guarda y devuelve el objeto `Calculo` que produce el motor
> (`src/domain/motor`), que es la única fuente de verdad de las fórmulas.

## 1. Arquitectura

- **Next.js 16** (App Router, Route Handlers) + **TypeScript**.
- **Drizzle ORM** sobre **PostgreSQL (Neon)**, driver HTTP (`@neondatabase/serverless`).
- **Zod** para validar todo lo que entra.
- **Better Auth** para cuentas y sesiones (email/contraseña y, opcional, Google).
- Capas: `app/api/**` (handlers HTTP) → `server/calculos/**` (validación, mapeo, acceso a datos) →
  `db/**` (esquema Drizzle). El objeto de dominio vive en `src/domain`.

El driver HTTP de Neon **no admite transacciones interactivas**; las escrituras que tocan varias
tablas se mandan con `db.batch([...])`, que Neon ejecuta como una sola transacción.

## 2. Modelo de datos

Un `Calculo` se guarda **normalizado**: una fila en `calculo` con los campos escalares y una tabla
hija por cada lista. Los importes van en columnas `numeric` sin precisión fija (conservan los
decimales tal como se cargaron; vacío = `NULL`). Fuente de verdad: `src/db/schema/`; referencia
legible y migración en `docs/esquema.sql` y `docs/migracion-v2.sql`.

| Tabla | Contenido | Clave |
|---|---|---|
| `calculo` | campos escalares del cálculo; su `id` (UUID) es el del enlace para compartir | `id` |
| `costo_fijo`, `costo_indirecto` | un costo por fila (`monto`, `frecuencia`) | `(calculo_id, id)` |
| `costo_variable` | un insumo por fila (`monto_unitario`, `base`) | `(calculo_id, id)` |
| `escenario` | un escenario del simulador por fila (porcentajes de variación) | `(calculo_id, id)` |
| `user`, `session`, `account`, `verification` | tablas de Better Auth (ids `text`) | — |

Columnas destacadas de `calculo`: `usuario_id` (FK a `user`, dueño), `compartido` (bool),
`version_esquema` (int), `ruta` (`lotes`/`unidad`/`reventa`), `trabajo_sueldo_mensual`, `paso_actual`,
`creado_en`, `actualizado_en`. Todas las tablas hijas son `ON DELETE CASCADE`: borrar el cálculo (o el
usuario) borra lo suyo. `orden` en cada hija preserva el orden de las listas.

**Versión de esquema (`version_esquema`).** Hoy es **2**. La v2 agregó `ruta`, `trabajo_sueldo_mensual`
y `costo_variable.base`. Los cálculos guardados con v1 se leen con ruta `lotes`, sueldo `""` y los
insumos «por unidad», que es como funcionaban antes de existir esos campos. La migración es
`docs/migracion-v2.sql` (o `npm run db:push`).

## 3. Endpoints

Base: `/api/calculos`. Cuerpo y respuestas en JSON. Todo error tiene la forma
`{ error: { codigo, mensaje, detalles? } }`.

| Método | Ruta | Quién | Respuestas |
|---|---|---|---|
| `POST` | `/api/calculos` | con sesión | 201 `{id, compartido, creadoEn, actualizadoEn}` · 400 · 401 · 403 (límite) · 413 |
| `GET` | `/api/calculos` | con sesión | 200 `{calculos[], limite}` («Mis cálculos») · 401 |
| `GET` | `/api/calculos/:id` | público si `compartido`; si no, solo el dueño | 200 `{calculo, esDueno, compartido}` · 404 |
| `PUT` | `/api/calculos/:id` | dueño | 200 `{id, actualizadoEn}` · 400 · 401 · 403 · 404 · 413 |
| `PATCH` | `/api/calculos/:id` | dueño | 200 `{id, compartido}` — enciende/apaga el enlace |
| `DELETE` | `/api/calculos/:id` | dueño | 204 |
| `GET/POST` | `/api/auth/[...all]` | — | rutas de Better Auth (registro, login, sesión, Google) |

- **POST** valida el `Calculo` con Zod, chequea el límite de **50 cálculos por usuario** y lo guarda.
  El cálculo nace con `compartido: true`.
- **GET `/:id`** es la lectura pública del enlace. Si `compartido = false`, solo el dueño lo ve; para
  el resto es 404 (no revela que existe). Responde con `Cache-Control: private, no-store`.
- **PUT** reemplaza todo el contenido (borra e inserta las hijas, así los elementos eliminados en el
  front también desaparecen). Sube `version_esquema` a la actual.
- **PATCH** solo cambia `compartido`.
- Página del enlace: **`/c/[id]`** carga el cálculo y lo abre en el recorrido; el dueño vuelve al paso
  donde quedó y puede editar, el resto solo mira.

## 4. Validación (`src/server/calculos/esquema.ts`)

Zod controla la **forma** (las reglas de negocio están en `domain/`). Reglas:

- **Importes:** `""` o número con punto decimal, hasta 15 enteros y 10 decimales. Sin coma, miles ni
  notación científica. Los montos, cantidades, horas, sueldo y precio manual **no pueden ser negativos**.
- **`configuracion.ruta`:** `lotes | unidad | reventa` (default `lotes` si un cliente viejo no la manda).
- **`trabajoPropio.sueldoMensual`:** importe no negativo (default `""`).
- **`costo_variable.base`:** `unidad | lote`, opcional.
- **Margen:** 0 a 99. **Variaciones de escenario:** −50 a 100 (los mismos límites del motor).
- **Textos:** largos máximos (nombre 80, unidad 60, conceptos 200, nota 1000); se rechaza el carácter
  nulo (Postgres no lo guarda).
- **Listas:** sin ids repetidos, máx. 200 conceptos por lista, máx. 6 escenarios.
- **Tamaño del cuerpo:** máx. 256 KB (si no, 413).

El mapeo dominio↔BD (`mapeo.ts`) es de funciones puras con pruebas en `mapeo.test.ts`; un chequeo de
tipos en tiempo de compilación garantiza que lo que valida Zod es asignable al tipo del dominio.

## 5. Códigos de estado

| Código | Causa |
|---|---|
| 200 / 201 / 204 | OK / creado / borrado sin cuerpo |
| 400 | Falla de validación (JSON o Zod). Trae `detalles` con los campos. |
| 401 | Falta sesión y la operación la exige. |
| 403 | No es el dueño, se alcanzó el límite, u **origen no permitido** (`esOrigenPropio`, anti-CSRF). |
| 404 | El cálculo no existe o no está compartido para quien pide. |
| 413 | El cuerpo supera 256 KB. |
| 500 | Error no controlado. Mensaje genérico; el detalle va solo al log del servidor. |

## 6. Seguridad

- **Inyección SQL:** todo pasa por Drizzle con parámetros; no se arma SQL a mano.
- **Autorización:** PUT/PATCH/DELETE verifican dueño == sesión (`exigirDueno`); borrar y (des)compartir
  además filtran por `usuario_id` en la consulta. «Mis cálculos» solo lista los del usuario.
- **Enlaces:** id UUID v4 (no se puede enumerar); un enlace desactivado da 404 a los demás.
- **CSRF:** cookies `SameSite` de Better Auth + chequeo de `Origin` en toda escritura (`esOrigenPropio`).
- **Encabezados** (en `next.config.ts`): `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`,
  `Referrer-Policy`, `Permissions-Policy`, `Strict-Transport-Security`.
- **Datos financieros:** respuestas privadas con `Cache-Control: private, no-store`.
- **Páginas de prueba** (`/test_de_guardado`, `/test_de_usuario`): 404 en producción salvo
  `PERMITIR_PAGINAS_DE_PRUEBA=1`.

## 7. Variables de entorno

| Variable | Obligatoria | Para qué |
|---|---|---|
| `DATABASE_URL` | sí | conexión a Neon (la *pooled* para la app) |
| `BETTER_AUTH_SECRET` | sí | firma de sesiones (32+ caracteres aleatorios) |
| `BETTER_AUTH_URL` | sí | URL pública de la app (con `https`, sin barra final) |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | no | habilitan el login con Google |
| `PERMITIR_PAGINAS_DE_PRUEBA` | no | `1` muestra las páginas de prueba en producción |

Nunca subir `.env.local` (está en `.gitignore`). En Vercel, cargar las mismas variables en el panel.

## 8. Despliegue y mantenimiento

- **App:** Vercel (import del repo). **Base:** Neon. Crear/actualizar tablas con `npm run db:push`
  (o aplicar `docs/migracion-v2.sql` a mano en el editor SQL de Neon).
- **Backups:** tarea de GitHub Actions que copia la base a S3 y R2 (7 diarios, 4 semanales, 12 mensuales).
  Ver `docs/backups.md`. Probar una restauración cada tanto.
- **Pendiente antes de abrir al público:** verificación de email, rate limit en `/api/auth/*` y
  `/api/calculos*` (Firewall de Vercel), rol propio de solo-app en Neon y rotación de secretos. Ver
  `docs/seguridad.md`.

## 9. Pruebas y compilación

- **Unitarias (Vitest):** mapeo dominio↔BD (incluida retrocompatibilidad de v1→v2), validación Zod,
  anti-open-redirect y chequeo de origen.
- **Tipado estático:** `npm run build` (Next + TypeScript estricto).
- **Rutas:** dinámicas `/api/calculos`, `/api/calculos/[id]`, `/c/[id]` y `/api/auth/[...all]`.
