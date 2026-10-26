---
target: la app completa (public/app/index.html), 2ª corrida
total_score: 29
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 1
target_identity: "file:/Users/ariel/dev/projects/misc/cotacero/public/app/index.html"
target_fingerprint: "sha256:236f63abf5f9e6c8c0d09fe071e149cc51e0dc1b52f60ab8fa28fa7893ccd108"
target_path: /Users/ariel/dev/projects/misc/cotacero/public/app/index.html
timestamp: 2026-10-26T13-28-57Z
slug: public-app-index-html
---
Method: dual-agent (A: revisión de diseño aislada · B: detector y navegador aislado)

# Crítica de la app — public/app/index.html (2ª corrida, modo Operate)

## Design Health Score

| # | Heurística | Puntaje | Problema clave |
|---|---|---|---|
| 1 | Visibilidad del estado | 3 | El resultado viejo sigue pintado sin atenuar mientras busca; posible desplegable obsoleto (puede ser artefacto de la herramienta). |
| 2 | Coincidencia con el mundo real | 3 | «Caudal +111 % / −79 %», «napa», «AIRE», «cota IGN» sin glosar. |
| 3 | Control y libertad | 3 | «Marcarla en el mapa» saca a Dónde ir; el modo edición persiste con texto viejo. |
| 4 | Consistencia | 2 | Orden invertido entre el asistente (dirección primero) y el formulario de Cambiar (zona primero); dos sólidos en el resultado. |
| 5 | Prevención de errores | 3 | Aviso de zona equivocada asimétrico. |
| 6 | Reconocer antes que recordar | 3 | «≈ 7,0 vos» cae a una segunda fila. |
| 7 | Flexibilidad y eficiencia | 3 | 30 puntos alfabéticos hasta dar ubicación. |
| 8 | Estética y minimalismo | 3 | Río 7 secciones; Mi casa 7 bloques. |
| 9 | Recuperación de errores | 3 | Honesto, pero 89 px detrás de la barra inferior. |
| 10 | Ayuda y documentación | 3 | Glosa del nivel de aviso repetida tres veces. |
| **Total** | | **29/40** | **Bueno** (27/40 en la corrida anterior) |

## Design Specificity Verdict

Revisión: específico en el 40 % superior de Río y la bienvenida (regla con «vos», el ≈, la voz); intercambiable en pilas de tarjetas, barra de pestañas y mapa IGN. Detector: 1 hallazgo con la configuración (em-dash-overuse, advisory); 4 sin ella (suma tres ignorados puestos por Claude). Navegador: 0 textos bajo el umbral de contraste en las cuatro vistas, claro y oscuro. Inyección de detect.js bloqueada por la CSP.

## Priority Issues

- [P1] Aviso de zona equivocada asimétrico: zona vecina elegida + dirección de la ciudad da veredicto seguro sin botón (mapa.js, avisoDeZona). Fix: botón para elegir zona de la ciudad y atenuar el veredicto. Comandos: harden, clarify.
- [P2] El arreglo de objetivos táctiles no llega a 44 px: 103/911 inline quedan en 40,5 px de alto y 38/34 de ancho. Fix: inset -1.1rem -0.75rem. Comando: adapt.
- [P2] El error de dirección queda 89 px detrás de la barra inferior (aLaVista, block nearest). Fix: scroll-padding-bottom. Comando: harden.
- [P2] «Marcarla en el mapa»: ~170 px de mapa útil, caja flotante en Helvetica. Fix: hoja o pantalla completa. Comandos: layout, typeset.
- [P2] Estado «nivel de aviso bajo la alerta de la ciudad» sin verbo: decisión de voz documentada en cota.js; a confirmar con el usuario.

## Persona Red Flags

Casey: acción primaria bajo el mapa, marcadores de 15 px, error tapado por la nav. Jordan: dos órdenes para lo mismo, jerga sin glosar. Sam: AA en ambas paletas; checkboxes de 19 px dentro de label ≥48 px (no es problema). Riley: zona vecina con dirección de ciudad; modo edición persistente. Vecino mayor: mapa necesita red, lista alfabética. Link de WhatsApp: el 103 no está en la bienvenida (por código).

## Minor Observations

Contraste justo: franja de emergencias 4,62:1; oscuro «Defensa Civil» 4,5017:1. Atribución del mapa 24 y 14 px (tercero). Mi plan abre con 5 campos antes de las casillas; «0 de 26» repetido; insignia 26 permanente. summary del pie ruidoso. Coma de «4,07 m» toca el rótulo.

## Questions to Consider

¿El texto neutro del caso «bajo la alerta de la ciudad» protege al vecino o al proyecto? ¿Dónde ir podría arrancar con el punto más cercano a la casa cargada? ¿Qué se saca de Río y Mi casa, no qué se pliega? ¿Por qué naranja y «alerta» en un día normal?
