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

## Tarea 2 — los km sobre el cauce (SIN TERMINAR: la validación no pasa)

- `ign-lineas_de_aguas_continentales_*-<fecha>.json` — red hidrográfica del IGN.
- `ign-localidad_bahra-*-<fecha>.json`, `ign-sublocalidad_entidad_bahra-*` —
  puntos oficiales de localidades (BAHRA).
- `analisis-km-cauce-<fecha>.mjs` — arma un grafo con los vértices de las
  líneas, cose confluencias a 60 m y corre Dijkstra desde el hidrómetro.
- `salida-tarea2-PARCIAL-<fecha>.txt` — la corrida que NO valida.

- `analisis-km-cauce-v2-<fecha>.mjs` — segundo intento, sumando los BORDES de
  los polígonos de agua: cerca de Santa Fe el Paraná está mapeado como
  polígono, no como línea.
- `analisis-km-sensibilidad-<fecha>.mjs` y su salida — barrido de la
  tolerancia de cosido.

**No usar estos km.** El método no produce un número defendible: la distancia
medida a Arroyo Leyes va de **20,6 a 31,8 km** según la tolerancia con que se
cosen las confluencias, que es un parámetro sin significado físico. Elegir la
que da 24 sería ajustar el método al resultado que se quiere validar — el mismo
vicio circular que ya tiene la pendiente. A 4,5 cm/km ese rango son 50 cm de
umbral: más que el error que se quería corregir.
