# datos-crudos

Datos bajados de las APIs públicas y los scripts que los analizan. Todo con la
fecha de descarga en el nombre, para que cualquiera pueda repetir la corrida y
llegar al mismo número.

**Nada de acá lo consume el sitio.** Es material de auditoría: alimenta
`AUDITORIA.md` y las decisiones sobre las constantes del modelo, que se toman
a mano y por separado.

## Tarea 1 — el error real de la cota interpolada, y los 18 cm del cero

- `ign-nivelacion_*-<fecha>.json` — puntos de la Red de Nivelación del IGN
  (`wms.ign.gob.ar`, WFS 1.0.0), acotados al bounding box de las curvas
  municipales. El `-amplio-` cubre ~60 km alrededor de Santa Fe.
- `analisis-residuos-<fecha>.mjs` — interpola la cota en cada punto del IGN
  **importando `js/app/elevacion.js`**, el mismo código que corre en
  producción, y saca media, IC, desvío e histograma del residuo.
- `analisis-margen-local-<fecha>.mjs` — mide el salto de cota entre las dos
  curvas que la app usa, en una malla sobre toda la cobertura.
- `analisis-correlaciones-<fecha>.mjs` — cierra con las correlaciones.
- `salida-tarea1-<fecha>.txt` — la salida completa de los tres.
