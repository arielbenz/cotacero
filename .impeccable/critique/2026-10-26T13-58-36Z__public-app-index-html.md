---
target: la app completa (public/app/index.html), 3ª corrida
total_score: 28
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 3
target_identity: "file:/Users/ariel/dev/projects/misc/cotacero/public/app/index.html"
target_fingerprint: "sha256:236f63abf5f9e6c8c0d09fe071e149cc51e0dc1b52f60ab8fa28fa7893ccd108"
target_path: /Users/ariel/dev/projects/misc/cotacero/public/app/index.html
timestamp: 2026-10-26T13-58-36Z
slug: public-app-index-html
---
Method: dual-agent (A: revisión de diseño aislada · B: detector y navegador aislado)

# Crítica de la app — public/app/index.html (3ª corrida, modo Operate)

## Design Health Score

| # | Heurística | Puntaje | Problema clave |
|---|---|---|---|
| 1 | Visibilidad del estado | 3 | La lista de sugerencias puede reaparecer abierta junto a un resultado encontrado. |
| 2 | Coincidencia con el mundo real | 3 | «Terraplén», «napa», «AIRE», «cota IGN» sin glosar. |
| 3 | Control y libertad | 3 | Tras confirmar el mapa en modo Cambiar se aterriza arriba del formulario viejo. |
| 4 | Consistencia | 2 | Dos numeraciones, dos tipos de desplegable, «Buscar mi casa» cambia de color. |
| 5 | Prevención de errores | 3 | El provisorio deja activos el push y la defensa de otra zona. |
| 6 | Reconocer antes que recordar | 3 | La zona se elige por «km río arriba». |
| 7 | Flexibilidad y eficiencia | 3 | Pocos atajos. |
| 8 | Estética y minimalismo | 2 | «Tu nivel de aviso» cuatro veces; prosa de 12 líneas. |
| 9 | Recuperación de errores | 3 | Ejemplar, mantiene el resultado anterior. |
| 10 | Ayuda y documentación | 3 | «Cómo sale ese número», «No sé nada de esto». |
| **Total** | | **28/40** | **Bueno** (27 → 29 → 28) |

## Design Specificity Verdict

Revisión: específico (regla del hidrómetro, etiquetas mono que nombran, voz); chasis genérico; Mi casa con resultado desentona. Detector: con configuración 1 hallazgo (em-dash-overuse, advisory); sin configuración 4 (suma tres ignorados puestos por Claude). Navegador: sin fallas de contraste salvo placeholders (4,14 claro, 2,87 oscuro, #757575 por defecto, sin regla ::placeholder); sin objetivos táctiles chicos fuera de checkboxes (label de 48 px o más) y créditos de MapLibre; B no detectó los ::after pero se verificó a mano que el «103» inline tiene −17,6/−16 px (zona 54×52). Inyección bloqueada por la CSP.

## Priority Issues

- [P1] Los placeholders fallan contraste en las dos paletas, en todos los campos. Fix: regla ::placeholder con el tenue y opacity 1, y un caso en comprobar.js. Comandos: audit, polish.
- [P1] El resultado provisorio deja activos el aviso por push y la defensa de la otra zona. Fix: plegarlos y reemplazar «Avisarme» por «Elegí tu zona para activar el aviso». Comando: harden.
- [P1] El veredicto de Mi casa no dice cuánto falta y su color no depende de la distancia (toca la decisión mantenida del titular sin verbo, que no se cambia; lo nuevo es la línea de distancia y el tinte). Comandos: clarify, colorize.
- [P2] Higiene de estado: tras confirmar el mapa en modo Cambiar se cae arriba del formulario viejo; la lista de sugerencias puede reaparecer por una carrera en sugerirCalle. Comando: harden.
- [P2] Muro de texto en el resultado de Mi casa; «Armar mi plan» a ~2.000 px; banner de instalar sobre la regla en Río. Comandos: distill, quieter.

## Persona Red Flags

Casey: 4 scrolls hasta «Armar mi plan»; enlaces de texto chico en el mapa. Jordan: 12 radios por km río arriba. Sam: placeholder bajo AA. Riley: provisorio con push activo. Vecino mayor: calles.json sin precache. Link de WhatsApp: 12 radios antes del primer resultado en la ciudad.

## Minor Observations

Mapa hereda el zoom de marcar (fitBounds al entrar); escritorio con cabecera y nav sin alinear; pin oliva sobre foto verde; contrastes justos (4,62 a 4,9); falsos positivos del detector deliberados.

## Questions to Consider

¿Qué color le queda al veredicto con el río en 5,5 m? ¿Número o distancia primero? ¿La dirección puede proponer la zona? ¿Es honesto ofrecer «Avisarme» sobre un número provisorio?
