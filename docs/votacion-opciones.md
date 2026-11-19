# Votación: versión de la calculadora

Probamos tres formas de mostrar la misma calculadora según quién la use. Miralas, votá y dejá tu comentario en el **PR #56**.

La versión original no cambia: sin `?estilo` se ve igual que antes.

## Cómo verlas

1. Bajá la rama `feature/front-opciones-amigables` y levantá la app (`npm run dev`).
2. Abrí `/calculadora/producto?opciones=1`: arriba aparece la barra **Versión: Original · A · B · C** para cambiar en vivo.
3. O forzá una directo: `?estilo=a`, `?estilo=b`, `?estilo=c` o `?estilo=original`.
4. Probalas también en el celular: las tres son responsivas.

## Las tres versiones

| | A · Paso a paso | B · Emprendedor | C · Con datos |
|---|---|---|---|
| Para quién | Quien no se lleva bien con la tecnología | Cliente promedio con un emprendimiento | Cliente exigente que quiere números |
| Qué cambia | Guía conversacional abajo (qué hacer, ejemplo, ánimo), letra más grande, más contraste, una sola columna, botón «Necesito ayuda» | Bienvenida con tarjetas que se deslizan, botones y campos redondeados, aviso al avanzar, botón «¿Te ayudo?» | Tablero fijo con 6 indicadores en vivo, panel de sugerencias con botón que aplica un margen sugerido, más denso |
| Ver | `/calculadora/producto?estilo=a` | `/calculadora/producto?estilo=b` | `/calculadora/producto?estilo=c` |

## Cómo votar

Comentá en el PR #56 con este formato (una línea por versión):

```
A: me gusta | con cambios | no  — comentario
B: me gusta | con cambios | no  — comentario
C: me gusta | con cambios | no  — comentario
```

Podés agregar ideas generales, mezclas entre versiones o cosas que falten. Sirve un voto por persona; si cambiás de opinión, editá tu comentario.

## Después de elegir

El equipo define cuál queda y si se activa por defecto, y se hace un único PR con esa versión.
