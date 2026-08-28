# Cota Cero — Santa Fe

Herramienta ciudadana para la emergencia hídrica (Ley provincial 14.477).
Traduce la altura del hidrómetro del Puerto de Santa Fe a un umbral personal:
a qué lectura del río el agua llega a tu terreno.

## Modelo

    cota del agua (IGN) = lectura del hidrómetro + 8,20
    corrección aguas arriba = 0,045 m por km

Validado contra la crecida de junio 1992: puerto 7,43 m -> 15,62 IGN;
Arroyo Leyes (24 km arriba) -> 16,70 IGN. El modelo da 15,63 y 16,71.

Niveles oficiales en el puerto: alerta 5,30 m / evacuación 5,70 m.

## Configuración

No hace falta ninguna clave de API. En `app.js`, bloque `CONFIG`:

    NIVEL_ENDPOINT: '/api/nivel'  no tocar en Vercel

## Estructura

    index.html               marcado
    app.css                  estilos
    app.js                   lógica
    vendor/maplibre-gl.*     motor del mapa, self-hosteado (BSD-3)
    api/nivel.js             lee el reporte diario del INA (CORS proxy)
    api/suscribir.js         alta de un endpoint de push
    api/desuscribir.js       baja
    api/cron/avisar.js       lo dispara Vercel Cron
    lib/ina.js               parser del INA (módulo, NO endpoint)
    lib/push.js              VAPID y almacén (módulo, NO endpoint)
    scripts/vapid.js         genera las claves, se corre una vez
    sw.js                    service worker
    manifest.webmanifest     PWA
    vercel.json              cabeceras y CSP
    icon-*.png               íconos

## Caché

`index.html`, `app.css` y `app.js` van por **red primero** (revalidan en cada
carga, 304 si no cambiaron) y caen a la copia guardada si no hay conexión. No
llevan hash en el nombre a propósito: sin build step, nombres versionados
significan acordarse de editar dos archivos en cada deploy, y el modo de falla
—alguien con el HTML nuevo y el JS viejo— es silencioso. Revalidar cuesta un
304; el desfasaje no se paga con nada.

Lo demás (íconos, tipografías) va por caché primero. **Subir `VERSION` en
`sw.js` en cada deploy**, o esos archivos quedan congelados.

## CSP

La política está en `vercel.json`. `script-src` es estricta: no hay ni un
manejador `onclick` en el HTML, todo pasa por el delegador de eventos de
`app.js`, así que un script inyectado no corre.

Desde que MapLibre va self-hosteado, `script-src` es `'self'` a secas: sin
dominios externos.

`style-src` sí lleva `'unsafe-inline'`, y es deliberado: hay ~70 atributos
`style=` en el marcado generado y el `<style>` dentro del `<noscript>`.
Sacarlos sería un refactor grande a cambio de poco — el vector que importa es
la ejecución de scripts, no los estilos.

## Mapa

MapLibre GL (BSD-3), servido desde `vendor/`. Va self-hosteado a propósito:
no depende de ningún CDN, el service worker lo cachea —así el mapa abre sin
conexión, sin tiles pero con los 30 puntos— y deja la CSP con `script-src
'self'` sin una sola excepción.

El basemap son los tiles del **Instituto Geográfico Nacional**, los mismos que
usa el GeoPortal de la Municipalidad. Sin clave, sin cuota y de un organismo
nacional. Es un servicio TMS (la Y se cuenta desde abajo): de ahí
`scheme: "tms"` en el estilo. Como el basemap es claro y la app oscura, se
invierte por CSS sobre el canvas de los tiles.

Antes esto era Mapbox GL, que exigía token y facturaba por *map load* pasado
el tramo gratis — con el modo de falla de caerse justo cuando la app se
comparte durante una crecida. Ya no hay token en el repo.

La búsqueda de dirección usa Nominatim (OpenStreetMap), una consulta por
búsqueda que inicia la persona. Cuando resuelve la calle pero no la altura
exacta, la app lo dice en pantalla en vez de dar un número que parece firme.

## Puntos de encuentro

Los 30 puntos salen de la capa `puntos_de_encuentro` del GeoServer público de
la Municipalidad de Santa Fe, la misma que dibuja el GeoPortal. Van
hardcodeadas en `PUNTOS` dentro de `app.js`: el dato es fijo, así funcionan
sin conexión y no gastan cuota de geocodificación.

Para actualizarlas:

    https://geoservicios.santafeciudad.gov.ar/geoserver/publico/ows
      ?service=WFS&version=1.0.0&request=GetFeature
      &typeName=publico:puntos_de_encuentro&outputFormat=application/json

Antes esto se geocodificaba en runtime con Mapbox y salía mal: seis puntos
quedaban a más de 90 km, y diez en la calle homónima de otro municipio
(Santo Tomé, Recreo, Sauce Viejo). El listado publicado en prensa además
tenía 29 puntos; el oficial tiene 30. Faltaba **Vecinal Pro Mejoras Alto
Verde**, en un barrio que está fuera del anillo de defensas.

Los módulos compartidos van en `lib/`, no en `api/`: cada archivo dentro de
`api/` se publica como una función de Vercel, y en Hobby hay un tope de 12.

## Avisos (Web Push)

Apagados hasta que se configuren las variables de entorno. Con
`VAPID_PUBLIC_KEY` vacía en `app.js`, la app funciona igual y no muestra nada.

**Cómo funciona.** El servidor manda un push **sin contenido**: no sabe la
cota de nadie ni a qué altura hay que avisarle. Sólo despierta al teléfono.
El service worker consulta `/api/nivel`, lo compara contra el umbral que la
app guardó en IndexedDB de ese dispositivo, y arma ahí la notificación.

De cada persona, el servidor guarda **un solo dato: el endpoint opaco del
navegador**. Ni la cota, ni la zona, ni el umbral, ni el plan. Las claves
`p256dh`/`auth` de la suscripción sólo sirven para cifrar contenido: como no
mandamos contenido, no se piden ni se guardan.

Efecto colateral: un push sin contenido no se cifra (RFC 8291 aplica al
payload), así que alcanza con firmar un JWT ES256. Por eso esto no agrega
ninguna dependencia y el proyecto sigue sin `package.json`.

**Puesta en marcha**

1. `node scripts/vapid.js` — imprime el par de claves y un CRON_SECRET.
2. En Vercel, variables de entorno:
   `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` (mailto:),
   `CRON_SECRET`, y las del almacén.
3. Pegar la pública también en `app.js`, en `CONFIG.VAPID_PUBLIC_KEY`.
4. Almacén: Upstash Redis desde el marketplace de Vercel. Se usa por su API
   REST (`KV_REST_API_URL` / `KV_REST_API_TOKEN`), sin librería.

**Cron.** En el plan Hobby cada expresión puede correr una vez por día, con
±59 min de imprecisión, pero se admiten muchas expresiones: por eso hay tres
entradas diarias a las 9, 15 y 21. El INA publica una vez por día.

**Cuándo avisa.** Cuando el nivel sube 15 cm desde el último aviso, o cuando
cruza 5,30 / 5,70 hacia arriba (esos van con urgencia alta). La referencia
baja con el río, así una crecida nueva vuelve a disparar. Las suscripciones
que devuelven 404/410 se borran solas.

**iOS.** Safari sólo permite avisos si la PWA está instalada en la pantalla
de inicio. La app lo detecta y lo explica en vez de quedarse muda.

## Pendientes

- Los km río arriba de cada zona son estimaciones propias, salvo
  Arroyo Leyes (24 km, publicado). Medirlos sobre el cauce.
  La app ya lo aclara en pantalla, pero el número sigue sin medirse.
- Verificar el datum vertical. El DEM que consulta la app (Copernicus
  GLO-90, vía Open-Meteo) está referido al geoide EGM2008; el modelo
  razona en cota IGN. Puede haber un desfasaje sistemático de decenas
  de centímetros, que en márgenes de centímetros no es despreciable.
- Validar el modelo con la Dirección de Gestión de Riesgos del municipio.
- El nivel se saca raspando el HTML del reporte diario del INA. Ya se
  rompió una vez (cambiaron <strong> por <b> y fecha_reporte quedó en
  null sin que nada avisara). Averiguar si dan acceso a la API REST de
  alerta5, y mientras tanto poner un chequeo que avise si deja de parsear.
