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

## Tarea 3 — la pendiente (paso 1: qué estaciones hay)

- `ina-catalogo-series-altura-<fecha>.json` — catálogo completo del INA,
  1.133 series de altura (`/a5/obs/puntual/series?var_id=2`).

**Sí hay otras estaciones en el tramo, y con un siglo de datos solapados.**
Seis sobre el Paraná (red PARANAINF), cinco de ellas con `cero_ign` declarado
por el propio INA:

    serie  estación        cero_ign  alerta  desde
       26  La Paz            16,46     5,8   1903
       27  Santa Elena         —       6,9   1912
       28  Hernandarias      13,46     5,5   1912
       30  Santa Fe           8,378    5,3   1925   <- la que usa la app
       29  Paraná             9,432    4,7   1902
       31  Diamante           6,747    5,3   1902

Y dentro de la ciudad, sobre el sistema Setúbal:

    30115  Santa Fe - La Guardia   8,28   —   2001-2026

**Ojo con el cero de Santa Fe.** El INA declara 8,378 y la app usa 8,20. Si se
convierten las alturas a cota IGN con el cero del INA, se está adoptando
implícitamente el número que el proyecto decidió NO usar. Sobre 30 km eso
mueve la pendiente 0,6 cm/km — el 13 % de los 4,5 cm/km.

**Y una dependencia que hay que decir:** la pendiente es Δcota / Δkm, y Δkm
entre estaciones se mide sobre el cauce. Eso es la Tarea 2, que no validó.
Lo que SÍ se puede calcular sin distancia es si el desnivel entre dos
estaciones cambia con el caudal: eso responde solo si un valor único alcanza.

### Paso 2: el desnivel entre estaciones sí cambia con el caudal

`ina-serie-{30,28,29}-1990-2026-<fecha>.json` — series diarias 1990-2026
(~15.400 registros cada una). `analisis-pendiente-<fecha>.mjs` las cruza.

Convertidas a cota IGN con el cero que declara cada estación:

    Hernandarias − Santa Fe   13.196 días   5,236 m  (desvío 0,255)
      aguas bajas (0-2 m)     5,271 m       en crecida (>5,7 m)  5,124 m
      r = −0,17 · −3,6 cm por cada metro que sube el Puerto

    Paraná − Santa Fe         13.357 días   0,717 m  (desvío 0,133)
      aguas bajas (0-2 m)     0,763 m       en crecida (>5,7 m)  0,530 m
      r = −0,39 · −4,2 cm por cada metro que sube el Puerto

**Un valor único de pendiente es una simplificación medible**, no una sospecha:
el desnivel se achata cuando el río crece.

**Y una anomalía que hay que explicar antes de usar nada de esto:** Paraná
ciudad está aguas ABAJO de Santa Fe y su superficie de agua da 0,72 m MÁS
ALTA. Eso no puede ser un gradiente. O los ceros declarados no están en el
mismo sistema, o —más probable— el hidrómetro del Puerto de Santa Fe no está
sobre el cauce principal del Paraná sino sobre el riacho, que es otra cosa
hidráulicamente.
