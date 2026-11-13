---
target: public/comparar/index.html
total_score: 28
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 3
target_identity: "file:/Users/ariel/dev/projects/misc/cotacero/public/comparar/index.html"
target_fingerprint: "sha256:38641caf3a59d01faee532ad185f8e8610fbd31add4074b88c0b97b8243a1c3b"
target_path: /Users/ariel/dev/projects/misc/cotacero/public/comparar/index.html
timestamp: 2026-11-13T17-25-47Z
slug: public-comparar-index-html
---
Method: dual-agent (A: revisión de diseño · B: detector y navegador)

## Puntaje de diseño
| # | Heurística | Puntaje | Problema clave |
|---|---|---|---|
| 1 | Visibilidad del estado | 3 | Con el dato vencido el texto pone la fecha, pero la línea de 2026 sigue negra y gruesa; la leyenda dice «ahora» |
| 2 | Mundo real | 3 | «2 de 101 años anteriores con lectura» suena a planilla; en el teléfono se explican Re Pág y Av Pág |
| 3 | Control y libertad | 3 | Con un año elegido, el dedo sólo lee ese año |
| 4 | Consistencia | 3 | El año bajo el cursor igual que el primer parecido; h2 «de enero a diciembre» en «Cerca de hoy» |
| 5 | Prevención de errores | 3 | Rótulos del margen junto a la punta de diciembre de otra línea |
| 6 | Reconocer antes que recordar | 2 | Trazos que hay que memorizar; círculos de 1998 y 1935 que se pisan |
| 7 | Flexibilidad | 3 | ↑↓ recorre 101 líneas sin atajo a los parecidos |
| 8 | Estética y minimalismo | 2 | En el teléfono con alerta: franja, píldora y aviso dicen 5,54 m tres veces; leyenda de 8 y ayuda de 7 renglones |
| 9 | Recuperarse de errores | 3 | Sin serie, #parecidos queda entero; el aviso habla de «este gráfico» sin gráfico |
| 10 | Ayuda | 3 | La ayuda de teclado se ve siempre, también en el teléfono |
| | Total | 28/40 | Bueno |

## Problemas prioritarios
1. [P1] Con alerta, en el teléfono, la respuesta y el gráfico quedan abajo: aviso de 7 renglones que repite la franja y la píldora.
2. [P1] Rótulos del margen derecho con la altura de hoy pero en la punta de diciembre: se atribuyen a la línea equivocada.
3. [P1] Con la letra al 200 % a 390 px el gráfico queda en una tira (~167 × 680).
4. [P2] El estado vencido no se ve en el dibujo (línea de 2026 negra y gruesa).
5. [P2] Sin JS o sin serie quedan restos (marco vacío, leyenda, fichas; #parecidos entero).
6. [P2] El teléfono carga con la leyenda de 8 y la ayuda de teclado.

## Detector
4 hallazgos: 3 descartados por ignore.md, 1 falso positivo heredado (cramped-padding en .h-tabla-caja). Ninguno propio de /comparar. Overlay bloqueado por la CSP.

## Personas
Casey: fichas al 60 % mientras carga que parecen rotas; gráfico a 1068 px. Sam: aria-valuetext sin la diferencia con hoy; ↑↓ sin atajo; #cmp-lectura anuncia cada movimiento del mouse. Jordan: «m» sin decir que es la regla del puerto. Vecino por WhatsApp: «2 de 101» se lee como «excepcional»; nada cerca de la cifra dice el máximo medido en cualquier fecha.

## Preguntas
¿«Ninguno de 101» se va a leer como «nunca pasó»? ¿El aviso debería ir después de la cifra, en una línea? ¿En 390 px conviene arrancar en «Cerca de hoy»?
