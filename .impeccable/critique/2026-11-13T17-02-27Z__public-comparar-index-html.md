---
target: public/comparar/index.html
total_score: 24
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 3
target_identity: "file:/Users/ariel/dev/projects/misc/cotacero/public/comparar/index.html"
target_fingerprint: "sha256:0447b0fe41210b62fdafb07c36f74ea5ae71ec3ba3d23bcd671d90733f442763"
target_path: /Users/ariel/dev/projects/misc/cotacero/public/comparar/index.html
timestamp: 2026-11-13T17-02-27Z
slug: public-comparar-index-html
closed: true
---
Method: dual-agent (A: revisión de diseño · B: detector y navegador)

## Puntaje de diseño
| # | Heurística | Puntaje | Problema clave |
|---|---|---|---|
| 1 | Visibilidad del estado | 2 | Con /api/nivel caído, «hoy» y «ahora» siguen sobre una lectura de semanas, sin aviso de dato viejo |
| 2 | Mundo real | 3 | «hidrómetro» sin explicar ni enlazar; «a 16 cm del río de ahora» es un promedio contra la línea de este año |
| 3 | Control y libertad | 3 | El toque del dedo queda marcado sin un «soltar» visible |
| 4 | Consistencia | 2 | Ficha apretada como un tercer botón; leyenda rayada para un parecido sólido; ↑↓ cambian de línea en un slider |
| 5 | Prevención de errores | 2 | Tocar una ficha antes de que llegue la serie tira un TypeError mudo |
| 6 | Reconocer antes que recordar | 2 | Las fichas muestran sólo el año; trazos que hay que retener entre gráfico y lista |
| 7 | Flexibilidad | 3 | Teclado, URL, dos vistas, desplegable y tabla |
| 8 | Estética y minimalismo | 2 | Unas 100 líneas, leyenda de 6, 5 grupos de fichas, «no es pronóstico» cuatro veces |
| 9 | Recuperarse de errores | 2 | Sin serie: caja vacía, leyenda y ayuda; remite a una tabla cerrada |
| 10 | Ayuda | 3 | Faltan Inicio, Fin y las páginas en la ayuda del teclado |
| | Total | 24/40 | Aceptable |

## Problemas prioritarios
1. [P1] «Hoy» y «ahora» con un dato que puede tener semanas (raya, pintarDato, quieto) cuando /api/nivel no contesta.
2. [P1] Rótulos que pronostican o se leen mal: los años parecidos en el margen derecho a la altura de diciembre; «2026 · 5,54 m» lejos del punto y pegado a «evacuación de la ciudad».
3. [P1] En el celular la respuesta queda enterrada: el dato a ~900 px, el gráfico a 1.116 px; la instrucción va antes que la respuesta.
4. [P2] Carga y error: fijar() con la serie todavía nula tira TypeError; sin serie la sección queda rota.
5. [P2] Canvas con letra fija (12/11 px) que ignora la letra del usuario; aria-valuetext viejo tras Escape; doble anuncio.

## Detector
4 hallazgos: 3 descartados por ignore.md, 1 falso positivo heredado (cramped-padding en .h-tabla-caja). Ninguno propio de /comparar. Overlay bloqueado por la CSP.

## Personas
Casey: gráfico a 1,3 pantallas, serie sin precache, error mudo al tocar antes de cargar. Sam: valuetext viejo tras Escape, anuncio doble. Jordan: hidrómetro sin explicar, «5,54 m» leído como profundidad. Vecino por WhatsApp: dos primeras acciones distintas (franja y aviso); «2 de 101» puede leerse como «casi récord».

## Menores
Ficha apretada como botón principal; alerta y evacuación con el mismo trazo (indistinguibles con deuteranopía); leyenda sin «elegido», «hoy» ni los círculos; marcas de 1998/1935 pisan el punto de 2026 en «Todo el año»; tinte de alerta barroso en oscuro.
