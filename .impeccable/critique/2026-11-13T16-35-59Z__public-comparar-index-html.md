---
target: public/comparar/index.html
total_score: 25
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 2
target_identity: "file:/Users/ariel/dev/projects/misc/cotacero/public/comparar/index.html"
target_fingerprint: "sha256:b710943ea5efc02f5284a481bbce3072f0bfd09b3f4963c00887f663e5e24643"
target_path: /Users/ariel/dev/projects/misc/cotacero/public/comparar/index.html
timestamp: 2026-11-13T16-35-59Z
slug: public-comparar-index-html
---
Method: dual-agent (A: revisión de diseño · B: detector y navegador)

## Puntaje de diseño
| # | Heurística | Puntaje | Problema clave |
|---|---|---|---|
| 1 | Visibilidad del estado | 3 | Al tocar una ficha en el teléfono, el gráfico cambia fuera de pantalla; sin serie queda una caja vacía de 340 px |
| 2 | Coincidencia con el mundo real | 3 | «hidrómetro» sin explicar; el eje dice «5 m» sin decir de qué |
| 3 | Control y libertad | 3 | El cursor del dedo queda fijo y no hay «limpiar» visible |
| 4 | Consistencia | 2 | Año elegido del mismo color que los parecidos; el interruptor apretado parece un tercer botón; ↑↓ en un slider cambian de línea |
| 5 | Prevención de errores de lectura | 2 | En «Cerca de hoy» los parecidos siguen después de hoy con toda la fuerza, y los tres bajan |
| 6 | Reconocer antes que recordar | 2 | Leyenda de 6 ítems debajo del gráfico; la lista obliga a restar |
| 7 | Flexibilidad | 3 | URL, teclado, desplegable y fichas |
| 8 | Estética y minimalismo | 2 | 102 líneas más franja, umbrales, parecidos, elegido, cursor y rótulo a la vez |
| 9 | Recuperarse de errores | 2 | Sin serie: caja vacía, botones vivos que no hacen nada, remite a una tabla cerrada |
| 10 | Ayuda | 3 | Método explicado como una resta, con fuente |
| | Total | 25/40 | Aceptable |

## Problemas prioritarios
1. [P1] El dibujo pronostica aunque el texto lo niegue: parecidos enteros hasta diciembre, los tres bajan y ninguno llegó a 5,54; 1935 y 1998, más altos en esta fecha, quedan fuera de la escala de «Cerca de hoy». Arreglo: después de hoy, los parecidos y el elegido tenues y con la raya «hoy»; la escala incluye a los años más altos que hoy; la lista dice «no llegó a 5,54 m» y «hoy, 38 cm más bajo»; fichas «Más alto que hoy en esta fecha».
2. [P1] En el teléfono, elegir un año cambia el gráfico fuera de pantalla. Arreglo: desplazar al gráfico al elegir desde una ficha o el desplegable.
3. [P2] Sin serie o sin JS la sección queda rota. Arreglo: clase sin-serie que oculte gráfico, leyenda, ayuda, vista y fichas, y abrir la tabla; texto inicial que sirva sin JS.
4. [P2] El año elegido no se distingue de los parecidos. Arreglo: con un año elegido, parecidos a alfa 0,3 y el elegido con halo.
5. [P2] Teclado y lector: valuenow=1 sin valuetext al cargar, la primera → salta a un día sin lectura, cada paso se anuncia dos veces; a 200 % el canvas no escala (meses pisados).

## Detector
4 hallazgos: 3 descartados por ignore.md (rgb(0,0,0) de impresión, marcas de la regla y rayado del dato vencido); 1 falso positivo (cramped-padding en .h-tabla-caja, heredado de /historia). Ninguno propio de /comparar. El canvas no lo ve el detector. Overlay en navegador bloqueado por la CSP (script-src 'self').

## Personas
Casey: gráfico debajo de la primera pantalla, el dedo elige casi al azar entre 102 líneas, elegir año pasa fuera de vista. Sam: anuncio inicial «1», lectura doble, slider probablemente inerte con lector en el teléfono. Jordan: hidrómetro sin explicar. Vecino de la costa por WhatsApp: el gráfico le dice «los parecidos bajaron»; 1935 y 1998 no están a mano; nada dice que hoy está arriba de la alerta.

## Menores
Ayuda de teclado visible para el dedo; el desplegable ofrece 2026; fichas de parecidos duplicadas; rótulo de hoy a veces ausente; franja de 30 días casi invisible en oscuro; h2 que repite el h1; «a 16 cm» (promedio) junto a «estaba en 5,16 m».

## Preguntas
¿Por qué los destacados son los parecidos en forma y no los años que estaban más altos hoy? ¿Qué se pierde si cada línea se corta en hoy por defecto? ¿La página debería verse distinta con el río arriba de la alerta?
