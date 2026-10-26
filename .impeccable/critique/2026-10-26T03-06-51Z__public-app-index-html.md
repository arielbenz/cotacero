---
target: la app completa (public/app/index.html)
total_score: 27
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 5
target_identity: "file:/Users/ariel/dev/projects/misc/cotacero/public/app/index.html"
target_fingerprint: "sha256:3ca564faf411b455251f81b4cd2299e7e70b07ca6e50bc1fbb22bdd1f3d2b27e"
target_path: /Users/ariel/dev/projects/misc/cotacero/public/app/index.html
timestamp: 2026-10-26T03-06-51Z
slug: public-app-index-html
---
Method: dual-agent (A: revisión de diseño aislada · B: detector y navegador aislado)

# Crítica de la app — public/app/index.html (modo Operate)

## Design Health Score

| # | Heurística | Puntaje | Problema clave |
|---|---|---|---|
| 1 | Visibilidad del estado | 3 | Tras una búsqueda fallida queda el veredicto viejo sin marcar como desactualizado; «Viene subiendo» (naranja) convive con «Río normal». |
| 2 | Coincidencia con el mundo real | 3 | «Napa», «cota IGN», «terraplén» y «proyección −84 %» sin explicar; «caudal» y «nivel» no se distinguen. |
| 3 | Control y libertad | 3 | «Cambiar» abre otro layout que el wizard; el banner de instalar reaparece en cada pestaña. |
| 4 | Consistencia | 2 | Dos UIs para la zona; botones de tema y Ajustes casi iguales; primario sólido apagado en el paso 2. |
| 5 | Prevención de errores | 3 | Autocompletado excelente, pero el hint «¿Es Cnl Manuel Dorrego?» queda junto al éxito. |
| 6 | Reconocer antes que recordar | 3 | Doce radios de zona exigen saber a cuál se pertenece. |
| 7 | Flexibilidad y eficiencia | 3 | Deep links y atajos; falta volver al veredicto desde un error. |
| 8 | Estética y minimalismo | 2 | Río ~3,3 pantallas con ~8 bloques; muro técnico de ~900 caracteres; naranja en estados que no son alerta. |
| 9 | Recuperación de errores | 2 | Dirección inexistente da dos mensajes; el primero nombra a OpenStreetMap. |
| 10 | Ayuda y documentación | 3 | «Si no sabés nada de esto» es lo mejor, pero vive detrás de un enlace chico. |
| **Total** | | **27/40** | **Aceptable** |

## Design Specificity Verdict

LLM: se siente de este producto en tres piezas (regla del hidrómetro con «vos», número hero con glosa, tarjeta oscura de ayuda con el 103); el resto es utilitario correcto. La mono en mayúsculas es decoración de plantilla en `PASO 1 DE 3` y `LISTO`.

Detector: 9 hallazgos. low-contrast ×4 (reales, 4,1–4,45 sobre fondos tintados; confirmado en la interfaz), overused-font, dark-glow (.pin.cerca, funcional), repeating-stripes-gradient y codex-grid-background (falsos positivos: .marcas-rio y rayado de dato vencido), em-dash-overuse (estilo del español). Overlay: la inyección falló por la CSP (script-src 'self').

## Overall Impression

El veredicto de «Mi casa» es el mejor momento y es honesto. Alrededor hay demasiada app, el flujo de primera vez parece un wizard común y el naranja de alerta se usa como color por defecto. Mayor oportunidad: que el color y el espacio signifiquen lo que importa.

## Priority Issues

- [P1] La búsqueda fallida deja el veredicto viejo bajo el error y el hint viejo bajo el éxito. Fix: rotular o atenuar el veredicto, borrar el hint, un solo mensaje sin nombrar OpenStreetMap. Comando: harden.
- [P1] El banner negro «Instalar en el teléfono» tapa contenido en las cuatro pestañas y rompe «una acción sólida por pantalla». Fix: solo en Río tras el primer resultado, recordar el rechazo, estilo de enlace, reservar su alto. Comando: quieter.
- [P1] «Viene subiendo» en naranja contradice «Río normal» y su proyección −84 %; el naranja pierde significado. Fix: un veredicto con verbo, en neutro cuando el nivel está lejos; aviso municipal a «Contexto» neutro. Comando: clarify, colorize.
- [P1] Los enlaces «103» y «911» inline miden 17 px de alto y 4,13:1 de contraste; el texto tenue sobre tintes y los controles del mapa también fallan. Fix: objetivos de 44 px, medir y corregir los tintes para AA. Comando: adapt, audit.
- [P1] El primario del paso 2 está apagado y tres estilos de botón compiten. Fix: «Buscar mi casa» primario, «Atrás» como enlace, el resto secundarias de contorno. Comando: polish.

## Persona Red Flags

Casey: banner que tapa el 103, etiquetas de 11–12 px, objetivos de 17–34 px, botones pegados a la nav. Jordan: doce radios sin ayuda, jerga sin explicar, tres números parecidos en una tarjeta. Sam: botones sin texto, `×` solo con aria-label, estados que dependen del color, placeholders de bajo contraste. Riley: dos mensajes y veredicto viejo ante una dirección inexistente. Don Raúl: banner en el paso de carga, mapa sin estado sin señal. Marta: «No sé nada de esto» es un enlace chico; el 103 no está en Río.

## Minor Observations

Doce radios de zona (P2); Dónde ir con lo vital al final (P2); botones de cabecera iguales (P2); cota con dos decimales con fuente de ±1,0 m (P2); píldora de onboarding que sigue pegada (P3); desktop a 1280 con cabecera pegada al borde; paso 4 de ayuda que promete un aviso activo; falsos positivos del detector deliberados.

## Questions to Consider

¿Y si la primera pantalla fuera solo el campo de dirección con la zona inferida? ¿Qué debería ver alguien que abre la app con el río ya en alerta? ¿Cuándo el naranja sea alerta de verdad, va a significar algo? ¿Cuántas piezas de Río responden «qué hago ahora»?
