# Seguridad y validaciones del backend — revisión del 31/oct

## Ya cubierto en el código
| Riesgo | Cómo se cubre |
|---|---|
| Inyección SQL | Todo pasa por Drizzle con parámetros. No hay SQL armado a mano. |
| Ver/modificar cálculos ajenos | PUT/PATCH/DELETE comprueban que el dueño sea quien tiene la sesión; borrar y (des)compartir además filtran por `usuario_id` en la propia consulta. «Mis cálculos» solo lista los del usuario. |
| Adivinar links | El id es un UUID v4 (122 bits aleatorios): no se puede enumerar. Un cálculo con link desactivado da 404 a los demás. |
| Datos de más en la respuesta pública | El GET público devuelve solo el cálculo: nunca el id ni el email del dueño. |
| Campos inventados (mass assignment) | Zod descarta todo lo que no está declarado (id, fechas, dueño). |
| Cuerpos gigantes | Máximo 256 KB (413), se corta la lectura apenas se pasa. Máximo 200 filas por lista y 50 cálculos por usuario. |
| Números/textos inválidos | Ver tabla de validaciones abajo (400 con el campo que falló). |
| CSRF | Cookies `SameSite=Lax` de Better Auth + chequeo de `Origin` en toda escritura (`src/server/origen.ts`). |
| Clickjacking, sniffing, HTTPS | Encabezados en `next.config.ts` (X-Frame-Options, nosniff, HSTS, Referrer-Policy, Permissions-Policy). |
| XSS | React escapa todo el texto; no hay `dangerouslySetInnerHTML` en el proyecto. |
| Errores que filtran datos | Los 500 devuelven un mensaje genérico; el detalle va solo al log del servidor. |
| Páginas de prueba en internet | `/test_de_guardado` y `/test_de_usuario` dan 404 en producción (salvo `PERMITIR_PAGINAS_DE_PRUEBA=1`). |
| Secretos | `.env*` está en `.gitignore` (salvo `.env.example`). |

## Validaciones (servidor)
- Importe: `""` o número con punto decimal, hasta 15 enteros y 10 decimales. Sin coma, letras, notación científica ni espacios.
- No negativos: montos, costos unitarios, unidades, lotes, volumen, horas, valor hora y precio manual.
- Margen: 0 a 99. Variaciones de escenario: −50 a 100 (los mismos límites del motor).
- Textos: nombre del producto 80, unidad 60, conceptos y escenarios 200, nota 1000; sin carácter nulo (Postgres no lo guarda).
- Listas: sin ids repetidos, máx. 200 por lista, máx. 6 escenarios.
- La BD usa `numeric` sin tope y `text` sin tope: los límites reales los pone esta validación, que es la única barrera (el frontend se puede saltear).

## Pendiente antes de publicar (en orden de importancia)
1. **Actualizar Next** (aviso crítico de `npm audit`): `npm install next@16.4.3 eslint-config-next@16.4.3`.
2. **Variables en Vercel**: `DATABASE_URL`, `BETTER_AUTH_SECRET` (32+ caracteres, distinto del de tu PC) y `BETTER_AUTH_URL` = la URL pública. Nunca subir `.env.local`.
3. **Límite de pedidos (rate limit)**: hoy cualquiera puede crear cuentas o pedir links sin tope. En Vercel: Firewall → regla de rate limit para `/api/auth/*` y `/api/calculos*`. El limitador interno de Better Auth guarda en memoria y en Vercel no se comparte entre instancias.
4. **Verificación de email**: sin ella cualquiera crea una cuenta con un email ajeno (y, si después se activa Google, esa cuenta falsa puede interferir con la real). Requiere un servicio de envío de mails (futuro).
5. **Neon**: usar un rol/usuario propio de la app, no el dueño de la cuenta, y guardar la cadena de conexión solo en Vercel.
6. **CSP** (Content-Security-Policy): no se agregó porque Next necesita configuración con nonces; es una mejora posterior.

## Para el equipo de frontend (no es mi área; sugerencias)
- `CampoMonto` no tiene tope de caracteres: conviene `maxLength` (~18) para que nadie escriba 30 dígitos que el servidor rechazaría al guardar.
- Los nombres de conceptos no tienen `maxLength` (el servidor acepta hasta 200).
- El precio manual no muestra error si se escribe texto o un valor negativo: el servidor lo rechaza al guardar (con el nombre del campo).
