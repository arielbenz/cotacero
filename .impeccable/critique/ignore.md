# Hallazgos que la crítica descarta

Revisados el 29/10/2026. Salen de `public/css/app.css`, que comparten todas las
páginas, y no son defectos:

- **`design-system-color`, texto `rgb(0, 0, 0)`**: son las reglas de
  `@media print` (la guía y el plan se imprimen en negro). En pantalla el texto
  usa `--texto` en los dos temas.
- **`repeating-stripes-gradient`** y **`codex-grid-background`**: son las
  marcas de la regla del hidrómetro (`.marcas-rio`, cada 10 cm, 50 cm y 1 m) y
  el rayado del dato vencido (`.agua.viejo`, `.pr-agua.viejo`). Las dos son
  información, no adorno.
