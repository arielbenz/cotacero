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

### 22/10/2026: la medición limpia, contra la red municipal

- `muni-puntos_fijos-<fecha>.json`, `muni-puntos_fijos_cn-<fecha>.json` —
  Red de Puntos Fijos de la Municipalidad (`geoservicios.santafeciudad.gov.ar`,
  workspace `publico`, WFS). 267 + 157 marcas con cota.
- `ign-nivelacion_*-costa-<fecha>.json` — la Red de Nivelación del IGN en un
  recuadro que llega a Rincón y Arroyo Leyes, para cruzarla con la municipal y
  para controlar curvas de la costa si algún día llegan.
- `analisis-puntos-fijos-<fecha>.mjs` — importa `public/js/app/elevacion.js`
  y compara contra las 330 marcas que están en el piso; salida en
  `salida-puntos-fijos-<fecha>.txt`.
- `idesf-MACurvaNivel-metadatos-<fecha>.xml` — la ficha ISO de la capa
  provincial de la que salen las curvas: año, origen y cobertura.

- `idesf-macotas-<fecha>.mjs` — baja `MACotas` (10.526 puntos con cota, la
  costa entera hasta Arroyo Leyes) y `MAPuntosFijos` de la IDESF con
  `GetFeatureInfo` en GML: el WFS de ese servidor está apagado. Escribe
  `idesf-MACotas-<fecha>.json` e `idesf-MAPuntosFijos-<fecha>.json`.
- `analisis-macotas-<fecha>.mjs` — si esos puntos sirven donde no llegan las
  curvas; salida en `salida-macotas-<fecha>.txt`.

### 10/11/2026: diez mojones medidos en Arroyo Leyes

- `leyes-mojones-<fecha>.json` — cotas medidas con estación satelital por un
  ingeniero en recursos hídricos (planilla y captura de Google Earth). La
  planilla no trae coordenadas: salen de georreferenciar la captura contra
  imagen satelital, con 30 a 50 m de error, y el archivo guarda los puntos de
  control, la transformación y el píxel de cada chinche. La captura no está
  acá porque trae un teléfono personal.
- `analisis-mojones-leyes-<fecha>.mjs` — compara esas cotas con lo que
  calcula `elevacion.js` y pone lado a lado la conversión a hidrómetro de la
  planilla y la de la app; salida en `salida-mojones-leyes-<fecha>.txt`.

### 13/11/2026: de qué lado queda una casa

- `lado-salado-<fecha>.mjs` — recorta y simplifica el río Salado, la laguna
  Setúbal y el río Santa Fe de las capas `ign-*aguas_continentales*`, imprime
  las líneas que van escritas en `public/js/app/lado.js` y controla el módulo
  contra direcciones conocidas. Esto sí lo consume el sitio: es la única
  excepción de esta carpeta, y el dato va copiado en el módulo, no leído de acá.

Los análisis importan el código de la app con `scripts/app-en-node.js`, que
resuelve las rutas del navegador contra `public/` y presta un `fetch` que lee
del disco. Los que miden las curvas filtran por `fuente === "curvas"`: desde el
22/10/2026 la app también calcula con los puntos de la costa, y una marca fuera
del área de las curvas no tiene que entrar en esa cuenta.

`analisis-puntos-fijos-<fecha>.mjs` escribe además `lib/mediciones.json`, que
es de donde el sitio saca los números de la medición: correrlo de nuevo y
regenerar las páginas actualiza `/datos` y `/preguntas`.

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

_23/11/2026: no era una anomalía._ En la vía navegable Santa Fe está en el
km 584 y Paraná en el 601: Paraná está aguas ARRIBA del empalme. Ver abajo.

### Paso 3 (23/11/2026): los km de la vía navegable y la regla del Leyes

- `analisis-pendiente-cauce-<fecha>.mjs` — pasa los desniveles del paso 2 a
  cm/km con los km de los boletines de Vías Navegables (Santa Fe 584, Paraná
  601, Hernandarias 689), y resta la regla del Leyes a la del Puerto.
- `ina-serie-6232-2001-2026-<fecha>.json` — la regla del arroyo Leyes en la
  Ruta 1 (SSRH 3225), lecturas desde 2001. Sin cero publicado.
- `ina-estacion-6232-<fecha>.json` — su ficha en el catálogo del INA.
- `salida-pendiente-cauce-<fecha>.txt` — la salida.

    Santa Fe → Hernandarias (105 km)   5,0 cm/km aguas bajas · 4,8–4,9 en crecida
    Santa Fe → Paraná (17 km)          4,2–4,5 aguas bajas  · 2,8–3,0 en crecida
    Leyes − Puerto                     2,96 m aguas bajas  · 2,48 m en crecida

Lectura, y sus límites, en `AUDITORIA.md` §2.

## La serie diaria y /comparar (13/11/2026)

- `analisis-serie-diaria-<fecha>.mjs` — el prototipo de dos gráficos (años
  superpuestos y grilla año × día) con `ina-serie-30-1990-2026-<fecha>.json`;
  escribe `prototipo-graficos-serie-<fecha>.html`. De ahí salió `/comparar`.
- `serie-diaria-provisoria-<fecha>.mjs` — escribe
  `public/datos-abiertos/serie-diaria.json` sin ir al INA, desde 1990 y con un
  hueco en 2026, para mirar `/comparar` en una máquina sin red. **No es la que
  se publica:** la de verdad, desde 1925, la escribe `node scripts/historia.js`.

## Las líneas de riesgo de la Provincia (27/11/2026)

- `idesf-lineas-riesgo-<fecha>.mjs` — para 3.391 puntos de `MACotas` (todos
  los de Rincón y Arroyo Leyes y uno de cada ocho del resto), pregunta a la
  IDESF qué «Líneas de Riesgo» pasan al lado (`MACurvasHistoricas` y
  `MACurvasTeoricas`, por `GetFeatureInfo`: el WFS sigue apagado). Cada línea
  trae la altura del Puerto de su crecida (`h_puerto`). Escribe
  `idesf-lineas-riesgo-<fecha>.json`. Son unos 5.000 pedidos de a dos: cerca
  de una hora. Por debajo de ~1,8 m por píxel la capa no contesta.
- `analisis-lineas-riesgo-<fecha>.mjs` — cota del terreno junto a la línea
  menos (cero + `h_puerto`), por línea y por distancia al Puerto, contra la
  recta de la app; salida en `salida-lineas-riesgo-<fecha>.txt`.

Qué son: líneas de afectación **modeladas** (convenio CFI-INA, 2005, modelo
ISIS FLOW), también las «históricas» de 1973, 1983, 1992, 1998 y 2003; fichas
2f0b4860-… y 61e41910-… del catálogo de la IDESF. No es agua medida, y usan
la misma planialtimetría que los puntos con cota.

Lectura, con la consulta de píxel de 1,9 m (854 puntos con alguna línea):

- Las líneas sin sufijo y las «HIS» **no sirven** para esto: en Colastiné
  todas las crecidas grandes caen sobre terreno de ~13,5 m y en Arroyo Leyes
  sobre ~17,04 m, la misma cota para 1983, 1992, 1998 y la de 50 años. Ahí la
  línea sigue un borde —una ruta, un terraplén, el fin del área— y no el
  lugar donde el agua toca el terreno.
- Las «POT» sí suben con la altura del Puerto. Su desnivel sobre el Puerto:
  +0,0 a +0,6 m en Colastiné, +0,5 a +1,0 en Rincón, +0,65 a +1,3 entre
  Rincón y Leyes y +0,8 a +1,2 en Leyes, con 6 a 53 puntos por línea y
  franja. La recta de la app da +0,50, +0,72 y +1,08 (11, 16 y 24 km).
- El control junto al Puerto quedó casi vacío (19 puntos; una sola línea
  con 7, +0,21 m): no alcanza para validar el método.
- No sabemos qué significan «HIS» y «POT»: las fichas no lo dicen. Está en
  el informe del convenio, que hay que pedir.

No cambió ninguna constante. En `AUDITORIA.md` §2.

## Lejos de una curva (27/11/2026)

- `analisis-distancia-curvas-<fecha>.mjs` — el error de `entreCurvas()` según
  la distancia a la curva más cercana y según la altura real del terreno,
  contra los puntos con cota de la IDESF y la red municipal, con las
  vecinales como área habitada; y cuánta superficie dejaría sin altura un
  tope. Salida en `salida-distancia-curvas-<fecha>.txt`. Lectura en
  `AUDITORIA.md` §4: el problema no es la distancia sino el terreno por
  debajo de la curva más baja (12,5 m). De ahí salió `CURVAS_LEJOS_M`: a más
  de 400 m de una curva la app le pregunta a los puntos con cota. Mide las
  curvas solas (`entreCurvas()`), no lo que contesta la app.

- `analisis-curvas-lejos-reglas-<fecha>.mjs` — las reglas que se probaron
  para arreglarlo: las que sólo miran las curvas (un tope, el lado de afuera
  de la curva más baja), que no separan nada, y usar los puntos con cota
  donde la curva queda lejos, que es la que entró. Salida en
  `salida-curvas-lejos-reglas-<fecha>.txt`.

`analisis-puntos-fijos-2026-10-22.mjs` filtra por lo que la app contesta
con curvas: corrido hoy da 322 marcas y no 330, porque 8 pasaron a salir de
los puntos. No se volvió a correr; `lib/mediciones.json` sigue con 330.

## Pedidos de información

- `pedidos-de-informacion-<fecha>.md` — borradores de los pedidos de las
  preguntas 30 a 32 de `AUDITORIA.md` §7. Sin enviar.
