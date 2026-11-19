# Opciones amigables de la calculadora: entrega

Tres formas de mostrar la misma calculadora, para que el equipo las pruebe, las compare y elija. La versión original no cambia: sin `?estilo` todo se ve y funciona como antes.

## Cómo probarlas

1. Rama `feature/front-opciones-amigables` y `npm run dev`.
2. Abrir `/calculadora/producto?opciones=1`: aparece la barra **Versión: Original · A · B · C** para cambiar en vivo.
3. O forzar una: `?estilo=a`, `?estilo=b`, `?estilo=c`, `?estilo=original`.
4. La elección se recuerda en el navegador (`preciar-estilo`).

## Qué hace cada una

| | A · Paso a paso | B · Emprendedor | C · Con datos |
|---|---|---|---|
| Objetivo | Quien nunca usó una calculadora de costos | Que se entienda rápido y se sienta cercana | Ver cómo cada dato mueve el resultado |
| Qué agrega | Guía conversacional por paso (qué hacer, ejemplo, ánimo), glosario al pasar el cursor, letra más grande y más contraste, una sola columna, botón «Necesito ayuda» | Bienvenida con tarjetas, botones y campos más amables, aviso al avanzar, glosario al pasar el cursor, botón «¿Te ayudo?» | Barra fija con 6 indicadores en vivo y panel de sugerencias con botón que aplica un margen sugerido |
| Reglas de ayuda | Las ventanas flotantes aparecen con efecto al pasar el cursor y desaparecen al sacarlo o al elegir | Igual | No aplica |

Casos especiales (C): sin costos, sin costos fijos, precio sin elegir, precio que no cubre el costo variable, margen negativo o bajo, volumen debajo o por encima del equilibrio. Solo cambia cómo se comunican; no cómo se calculan.

## Archivos

Nuevos: `src/components/opciones/` (`opciones-amigables`, `selector-estilo`, `guia-conversacional`, `glosario-hover`, `bienvenida`, `carrusel`, `aviso-avance`, `ventana-ayuda`, `panel-datos`) y `src/lib/opciones-amigables.ts` (textos y glosario).
Modificados: `src/app/calculadora/layout.tsx` (monta la capa opcional) y `src/app/globals.css` (estilos aislados bajo `data-estilo`).

## Verificación (mismo escenario en las cuatro versiones)

Escenario: 5 lotes de 20 unidades, 100 unidades por mes, alquiler $50.000, insumo $300 por unidad, margen 40 %.

| Dato | Original | A | B | C |
|---|---|---|---|---|
| Precio sugerido | $1.333,33 | $1.333,33 | $1.333,33 | $1.333,33 |
| Contribución por unidad | $1.033,33 | $1.033,33 | $1.033,33 | $1.033,33 |
| Ingresos / Costos / Ganancia mensual | $133.333,33 / $80.000 / $53.333,33 | igual | igual | igual |
| Punto de equilibrio | 49 u. ($65.333,33) | igual | igual | igual |

Resultados idénticos. La capa nueva lee el motor existente y no tiene fórmulas propias.

## Matriz comparativa (evaluación preliminar, a confirmar con pruebas de uso)

Escala: ● alto · ◐ medio · ○ bajo. No hay ganadora declarada: la decisión es del equipo según las pruebas.

| Criterio | Original | A | B | C |
|---|---|---|---|---|
| Facilidad de comprensión sin conocimientos previos | ◐ | ● | ◐ | ○ |
| Esfuerzo mental | ◐ | ● | ◐ | ○ |
| Cantidad de pasos (igual en todas: 5) | ● | ● | ● | ● |
| Prevención de errores | ◐ | ● | ◐ | ◐ |
| Claridad del resultado | ◐ | ◐ | ◐ | ● |
| Entender cómo un cambio afecta el equilibrio | ◐ | ○ | ○ | ● |
| Accesibilidad (contraste, foco, teclado) | ◐ | ● | ◐ | ◐ |
| Uso en celular | ◐ | ● | ◐ | ◐ |
| Consistencia con la app existente | ● | ◐ | ● | ● |

## Limitaciones

- No se probó en un celular real ni con lector de pantalla; solo en Chrome de escritorio. Falta revisar a 390 px y con teclado/lector.
- B cambia la presentación, pero no reordena resultados ni gráfico; para eso habría que tocar más componentes del paso 4.
- C muestra indicadores y aplica un margen sugerido; no suma controles deslizantes porque el paso «Simulador» ya cubre los escenarios.
- El subrayado punteado del glosario usa la API de resaltado de CSS; en un navegador viejo se ve el globo igual, sin subrayado.
- No se pudieron correr los tests (`vitest`) ni el build en este entorno; sí lint y tipos, sin errores.

## Confirmaciones

- No se modificó backend, APIs, base de datos ni esquemas.
- No se modificaron fórmulas ni lógica de negocio (`src/domain`, `src/db` y `src/lib/calcular-solicitud.ts` sin cambios).
- No se alteró la arquitectura general: capa opcional activada por `?estilo`.
- Se preservó la identidad visual (mismos colores, tipografía y componentes).
- Las tres variantes funcionan y se comparan con la original desde el selector.
