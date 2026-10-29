---
target: /hidrometro
total_score: 18
max_score: 28
na_heuristics: 3,5,9
p0_count: 0
p1_count: 2
target_identity: "file:/Users/ariel/dev/projects/misc/cotacero/public/hidrometro/index.html"
target_fingerprint: "sha256:1a0015544076d6afa9168c83d9f14eca2aff2d801750321c4cd6a85741f3c9dd"
target_path: /Users/ariel/dev/projects/misc/cotacero/public/hidrometro/index.html
timestamp: 2026-10-29T13-54-18Z
slug: public-hidrometro-index-html
---
# Crítica de /hidrometro — public/hidrometro/index.html (modo Read)

Method: dual-agent (A: revisión de diseño · B: detector y navegador)

## Design Health Score

| # | Heurística | Puntaje | Problema clave |
|---|---|---|---|
| 1 | Visibilidad del estado | 3 | La píldora trae el nivel en vivo; en el celular pierde la tendencia y no dice de cuándo es el dato |
| 2 | Lenguaje del mundo real | 2 | Define «cota» de dos maneras; «INA» nunca se desarrolla |
| 3 | Control y libertad | n/a | Lectura estática |
| 4 | Consistencia | 2 | El cierre dice «la altura del río hoy» con voz propia; la franja de alerta dice «oficial» y no «de la ciudad» |
| 5 | Prevención de errores | n/a | Sin campos |
| 6 | Reconocer antes que recordar | 3 | Dos definiciones de cota separadas por un bloque |
| 7 | Flexibilidad y eficiencia | 2 | La respuesta afirmativa no está arriba |
| 8 | Estética y minimalismo | 3 | La ficha repite el párrafo; renglones de ~130 caracteres en escritorio |
| 9 | Recuperación de errores | n/a | Página estática |
| 10 | Ayuda y documentación | 3 | Enlaza a /datos#abiertas y /historia donde corresponde |
| **Total** | | **18/28 (64 %)** | **Aceptable** |

## Design Specificity Verdict

Revisión de diseño: el texto es específico de Cota Cero; la composición es la plantilla de las páginas hermanas. La firma visual del producto (la regla del río) no aparece en la página que explica la regla: la bajada dice «esta regla» y no hay ninguna.

Detector: 3 avisos menores, los tres falsos positivos de public/css/app.css compartida: color negro del h1 (reglas de @media print), repeating-stripes-gradient y codex-grid-background (las marcas de .marcas-rio y el rayado del dato vencido, con significado). Overlay: no inyectado; la CSP script-src 'self' bloqueó el script inline y el detect.js del live-server. Mediciones: sin scroll lateral a 390 ni 1280; todo el texto pasa AA en los dos temas; encabezados en orden; consola limpia.

## Priority Issues

- [P1] La franja de alerta (rio-barra.js:323-330, todas las páginas) dice «Alerta oficial activa…» sin verbo, sin 103 y con «oficial» en vez de «de la ciudad»; «Evacuación oficial en curso» tampoco empieza con verbo. Fix: usar ESTADOS.alerta.verbo / ESTADOS.evacuacion.verbo de CC_COMUN, «de la ciudad» y el 103. Comando: clarify.
- [P1] «Cota» se define dos veces: bloque #regla («tres nombres para el mismo número») contra #cero («esa suma es la cota del agua»). Es la búsqueda con más impresiones. Fix: decir la diferencia en un solo lugar y rotular la columna «Sobre el mar (cota)». Comando: clarify.
- [P2] .bloque p/ul/ol y .pg-lead con max-width: 100% (estilos/app.css:2512-2519) contra su comentario «50ch … unos 72 por renglón»: ~130 caracteres por renglón a 1280 px en todo el sitio. Fix: volver a 50ch y revisar las 11 páginas. Comando: typeset.
- [P2] La página sobre la regla no muestra la regla. Fix: SVG estático del generador con la regla de −1 a 8 m, la escala sobre el mar, alerta, evacuación, récord y mínimo; la tabla queda como versión accesible. Comando: bolder.
- [P2] La bajada sólo responde en negativo; el cierre manda a la portada por «la altura del río hoy» y el botón compartido dice «Abrir Cota Cero». Fix: bajada afirmativa de ~40 palabras; texto de botón por página en pagina(). Comando: clarify.

## Persona Red Flags

- Primera vez: «esta regla» sin regla; INA e IGN sin desarrollar; dos definiciones de cota.
- Celular: la píldora empuja el menú a un segundo renglón (barra de 115 px); el primer bloque a los 375 px; enlaces dentro del texto de 17 px de alto (el ::after de 44 px está sólo en .app).
- Lector de pantalla: la ficha se lee como texto corrido; filas de la tabla sin th scope="row"; «-0,23» con guion en vez de signo menos.
- Vecino de la costa con el río en 5,4 m: franja sin verbo ni 103; el 103 sólo en el pie.

## Minor Observations

- Ficha en letra monoespaciada con nombres propios, repite el párrafo; alcanza con selloFuente("nivelRio").
- «cuántos kilómetros río arriba» sin «del Puerto».
- El ejemplo del 29/10 no enlaza a la tabla de Prefectura.
- Sólo se llega desde el pie: /datos#rio y /preguntas no la enlazan.
- En oscuro, .bloque.oscuro casi no se distingue.

## Questions to Consider

- ¿Y si la página fuera la regla?
- El producto se llama Cota Cero y la página explica «el cero de la regla»: ¿no es acá donde el nombre se explica solo?
