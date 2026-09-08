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

## El GeoServer municipal volvió (8/9/2026)

Estuvo devolviendo 403 detrás de Cloudflare y volvió a responder el mismo día.

**`curvas.json` está al día**: se regeneró y da 169 curvas, las mismas cotas
(12,5 a 22,5 m IGN), la misma área y los mismos 7.280 vértices que la copia
commiteada del 30/8/2026. Lo único distinto era el campo `generado`, así que se
restauró la copia commiteada para no ensuciar el árbol con una fecha.

- `muni-vecinales-<fecha>.json` — capa `sitmax:ac_reclamosxvecinal`, 86
  polígonos de vecinal con su nombre. Es lo más parecido a un límite de barrio
  que publica el municipio.

Centroides que sirven como punto representativo de zona:

    Alto Verde        -60.68744  -31.67548   (2 vecinales)
    Guadalupe         -60.67339  -31.59948   (4 vecinales)
    La Guardia        -60.62866  -31.64795   (1 vecinal)
    Colastiné Sur     -60.61253  -31.66014   (1 vecinal)   <- la que faltaba
    Colastiné Norte   -60.60393  -31.62373   (1 vecinal)

**Sigue sin haber punto para La Vuelta del Paraguayo**: es un paraje ribereño
fuera del sistema de vecinales y tampoco está en BAHRA.

Ojo: esto NO arregla la Tarea 2. Mejores puntos no cambian que la distancia
medida dependa de la tolerancia de cosido.
