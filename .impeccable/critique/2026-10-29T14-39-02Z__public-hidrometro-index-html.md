---
target: /hidrometro
total_score: 23
max_score: 32
na_heuristics: 7,9
p0_count: 0
p1_count: 2
target_identity: "file:/Users/ariel/dev/projects/misc/cotacero/public/hidrometro/index.html"
target_fingerprint: "sha256:994e8aac65f1ee44890c42d700b7e67f238394588b0965f6d10cbccdd4f3f6fe"
target_path: /Users/ariel/dev/projects/misc/cotacero/public/hidrometro/index.html
timestamp: 2026-10-29T14-39-02Z
slug: public-hidrometro-index-html
---
# Crítica de /hidrometro, 2ª corrida — public/hidrometro/index.html (modo Read)

Method: dual-agent (A: revisión de diseño · B: detector y navegador)

## Design Health Score

| # | Heurística | Puntaje | Problema clave |
|---|---|---|---|
| 1 | Visibilidad del estado | 3 | La píldora pierde «Río» a menos de 900 px |
| 2 | Lenguaje del mundo real | 3 | «serie 30» y «Dique 2» sin explicar |
| 3 | Control y libertad | 3 | Miga de pan sólo en JSON-LD |
| 4 | Consistencia | 3 | Texto del SVG en px fijos |
| 5 | Prevención de errores de interpretación | 2 | «Es la columna de la derecha, y es la que se compara con la de un terreno» invita a la cuenta a mano |
| 6 | Reconocer antes que recordar | 3 | El ejemplo de horarios pide sostener tres lecturas |
| 7 | Flexibilidad y eficiencia | n/a | Página de lectura sin tareas repetidas |
| 8 | Estética y minimalismo | 3 | Tarjetas medio vacías en escritorio; .bloque.oscuro indistinto en oscuro |
| 9 | Recuperación de errores | n/a | Sin acciones que fallen |
| 10 | Ayuda y documentación | 3 | Falta qué son el Dique 2 y la serie 30 |
| **Total** | | **23/32 (72 %)** | **Bueno** |

## Design Specificity Verdict

El dibujo de la regla (dos escalas, corte «8,42 m más abajo, fuera de escala», récord y bajante del INA) es inconfundiblemente del producto; el resto es la plantilla de pagina(). Oportunidad: jerarquía, el dibujo aparece en la segunda pantalla y media del teléfono.

Detector: 3 avisos, los tres en ignore.md (print, .marcas-rio, dato vencido); nada nuevo. Overlay bloqueado por la CSP. Mediciones: sin scroll lateral; SVG sin superposiciones; contraste AA en todo el texto del dibujo y la franja (4,68 y 7,23); trazos con información ≥ 3:1; tabla con scope col/row y abrible con Enter; párrafos de ~70-77 caracteres a 1280 px.

## Priority Issues

- [P1] La frase «Es la columna de la derecha, y es la que se compara con la de un terreno» invita a calcular el nivel de aviso a mano sin margen ni pendiente (umbralDe resta margen y 0,045 m/km). Arroyo Leyes, cota 14,2: a mano 5,78 en la regla, la app ≈ 3,7. Fix: decir que la comparación directa no alcanza y mandar a la app ahí mismo. Comando: clarify.
- [P1] La búsqueda «cota del río paraná» probablemente quiere el número de hoy; H1 y bajada no dicen «cota» y la página remite a la barra recién al final. Fix: «cota» en la bajada y un renglón «¿Buscás el nivel de hoy?» con enlace. Comando: clarify.
- [P2] El dibujo está enterrado (tarjeta 1 y dos párrafos antes) y su texto en 12.5px fijos queda a 11,7 px a 390. Fix: subirlo, dos columnas en escritorio, piso de 13 px. Comando: layout, typeset.
- [P2] «Cota» sigue en dos lugares (diarios en la tarjeta 1, sentido estricto en la 2). Fix: juntarlas. Comando: clarify.
- [P2] El ejemplo de horarios es una cuenta de cabeza. Fix: tabla .cuenta de hora · Prefectura · INA. Comando: layout.

## Persona Red Flags

- Primera vez: «serie 30», «Dique 2»; sin «NO OFICIAL» en el teléfono.
- Celular: summary de 23 px, «ver» de 18×15; menú en segundo renglón a 390; enlaces de la franja sobresalen 4 px a 1280.
- Lector de pantalla: «ver» ambiguo; target="_blank" sin aviso; sin enlace de salto.
- Vecino de la costa con el río en 5,45: compara su escritura con la columna sobre el mar y concluye mal (P1).

## Minor Observations

- El sello «serie 30» enlaza al reporte diario, no a la serie.
- Coordenadas del SVG con flotantes sin redondear.
- «Evacuación de la ciudad · 5,70» al lado del «6» de la escala.
- La bajada en --tenue.
- El ejemplo del 29/10/2026 va a envejecer.

## Questions to Consider

- ¿El dibujo debería mostrar por qué la comparación directa no alcanza (agua inclinada hacia Rincón)?
- ¿Un marcador «hoy» sobre el dibujo, pintado por rio-barra.js y que vence como la franja?
