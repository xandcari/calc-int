# Backend: guardar y compartir cálculos

El frontend sigue igual: el tipo `Calculo` y el store NO se modificaron. El backend se adapta a ese objeto.

## Para conectar la interfaz de «Guardar y compartir»

```ts
import { guardarCalculo, enlaceCompartido, cambiarCompartido } from "@/lib/api-calculos";
import { useCalculoStore } from "@/store/calculo-store";

const r = await guardarCalculo(useCalculoStore.getState().calculo);
if (r.ok) mostrar(enlaceCompartido(r.id));
else if (r.motivo === "sin_sesion") /* guardar borrador, ir a login y volver */;
else if (r.motivo === "prohibido") /* es un cálculo ajeno: solo lectura */;
else mostrar(r.mensaje);
```

- `guardarCalculo` crea (POST) o actualiza (PUT) según el `id` del borrador: `"borrador"` = nuevo, UUID = ya guardado.
  Tras crear, le pone el UUID al borrador (`marcarComoGuardado`), así el siguiente guardado actualiza el mismo.
- «Reiniciar» vuelve el id a `"borrador"`, y el próximo guardado crea otro cálculo.
- Para ocultar el botón «Guardar» a los visitantes: el GET devuelve `esDueno`; la página `/c/[id]` ya lo recibe.
  (El servidor igual rechaza con 403 si un no dueño intenta guardar.)

## Endpoints

| Método | Ruta | Quién | Respuestas |
|---|---|---|---|
| POST | `/api/calculos` | sesión | 201 `{id,...}` · 400 · 401 · 403 (límite 50) · 413 |
| GET | `/api/calculos/:id` | público si `compartido`; si no, solo el dueño | 200 `{calculo, esDueno, compartido}` · 404 |
| PUT | `/api/calculos/:id` | dueño | 200 · 400 · 401 · 403 · 404 · 413 |
| PATCH | `/api/calculos/:id` | dueño | `{compartido:boolean}` → 200 (apaga o enciende el link) |
| DELETE | `/api/calculos/:id` | dueño | 204 |

Errores: `{ error: { codigo, mensaje, detalles? } }`. Cuerpo máximo: 256 KB.

## Autocompletado (link → pantallas)

`/c/[id]` carga el cálculo con `cargarCalculo()` (`src/store/cargar-calculo.ts`) y redirige:
el dueño vuelve al paso donde quedó; otra persona va al resumen.
`cargarCalculo` reemplaza el borrador de localStorage de ese navegador (si hay uno tocado, la página pregunta antes).

## Tablas

`calculo` (una fila, con todos los campos escalares en columnas propias) + `costo_fijo`, `costo_indirecto`,
`costo_variable` y `escenario` (una fila por elemento, ligadas por `calculo_id`). Sin jsonb.
Importes en `numeric` sin precisión fija (conservan los decimales tal como se cargaron; vacío = NULL).
Ver `docs/esquema.sql` (referencia) y `src/db/schema/` (fuente de verdad).

## Sugerencias a futuro (cuando el equipo quiera, no hacen falta ahora)

1. `Calculo.id = "borrador"` y `creadoEn = 1970…` son marcas de «todavía no guardado». Más limpio: `id?: string` y fechas opcionales,
   o un tipo `CalculoGuardado` aparte. Así no hay valores centinela.
2. Mover el esquema Zod de importes (`importe`) a `domain/` y reutilizarlo en formularios y servidor: una sola regla.
3. `volumenMensual` y `horasMensuales` son derivados de `unidadesPorLote × lotes`; hoy se guardan igual que vienen.
   Si algún día se calculan al leer, se pueden quitar de las columnas.
