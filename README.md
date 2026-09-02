# Cota Cero — Santa Fe

Herramienta ciudadana para la emergencia hídrica (Ley provincial 14.477).
Traduce la altura del hidrómetro del Puerto de Santa Fe a un **umbral personal
estimado**: la lectura del río que sirve de referencia para tu terreno.

## Modelo

    cota del agua (IGN) = lectura del hidrómetro + 8,20
    corrección aguas arriba = 0,045 m por km

Contrastado con la crecida de junio 1992: puerto 7,43 m -> 15,62 IGN;
Arroyo Leyes (24 km arriba) -> 16,70 IGN. El modelo da 15,63 y 16,71.

**Las dos constantes están en discusión y no se tocaron.** El INA publica hoy
`cero_ign = 8,378` para esta escala —relevamiento INA-IGN de diciembre de 2016,
contemporáneo del cambio de SRVN71 a SRVN16— y las curvas del municipio no
declaran su sistema de alturas, así que mover el cero metería un sesgo de 18 cm
sin que nadie lo note. La pendiente, además, se despejó del mismo caso de 1992
con el que después se la valida. Todo eso está desarrollado en **`AUDITORIA.md`**,
con las preguntas concretas para cada organismo, y explicado para cualquiera en
`/datos`. No cambiar ninguno de los dos sin leer ese archivo primero.

Un centímetro en cada punto, pero es **una sola validación independiente**.
Coincidir con una única crecida histórica no convierte esto en un modelo
predictivo de inundación: falta la revisión de especialistas y organismos
competentes (Gestión de Riesgos, INA, FICH-UNL). Hasta entonces lo que la app
calcula son niveles de referencia estimados, y así se nombran en la interfaz.

Niveles oficiales en el puerto: alerta 5,30 m / evacuación 5,70 m. **Ya no
están escritos a mano**: los publica la estación del INA en cada consulta y la
app los adopta (con un filtro de plausibilidad). Las constantes que quedan en
`js/app/oficiales.js`, `sw.js`, `landing.js` y el widget son el respaldo para cuando contesta
el reporte diario, que no los trae.

## Tres conceptos, tres nombres

La interfaz los mezclaba y eso era lo que hacía sonar la app como una
predicción de inundación. Nunca intercambiarlos:

1. **Nivel del río** — la lectura del hidrómetro del Puerto (dato oficial
   INA / Prefectura). «El río está en 4,86 m».
2. **Cota del terreno** — la elevación IGN del terreno, de las curvas
   municipales, ±0,5 m. «Cota del terreno: 17,18 m IGN».
3. **Umbral hidráulico estimado** («tu umbral estimado» / «mi umbral») — la
   lectura del hidrómetro a partir de la cual el nivel de agua equivalente
   alcanzaría esa cota según el modelo. «Tu umbral estimado: ≈ 5,1 m».

Llamarle «tu cota» al umbral está prohibido. La pestaña se llama **Mi umbral**.

**Falsa precisión.** La cota del terreno viene de curvas cada 0,5 m, así que el
umbral **nunca** se muestra con dos decimales: un decimal y tilde de
aproximación (`mU()` en `js/app/formato.js`, `unDec()` en `sw.js`). La única excepción es
el desglose del cálculo, que conserva la aritmética exacta y aclara al pie por
qué la pantalla muestra otra cosa.

## Configuración

No hace falta ninguna clave de API. En `js/app/config.js`, bloque `CONFIG`:

    NIVEL_ENDPOINT: '/api/nivel'  no tocar en Vercel

## Estructura

Lo que sirve el navegador está separado de lo que lo genera, y las páginas
generadas llevan un cartel de "no editar" en la primera línea.

    index.html               portada (landing) — la puerta de entrada
    sw.js                    service worker (va en la raíz: su alcance es su ruta)
    manifest.webmanifest     PWA
    vercel.json              cabeceras y CSP
    robots.txt · sitemap.xml

    js/     landing.js       nivel en vivo, mapa perezoso, salto a /app si está instalada
            historia.js      la serie de un siglo, interactiva
            medios.js        copiar el código del widget
    js/app/                  la app, en módulos ES
        principal.js      261L   arranque, tabla de acciones y eventos
        avisos.js         252L   push
        bienvenida.js      50L   la primera visita
        compartir.js      174L   la imagen para WhatsApp
        config.js         173L   constantes del cálculo y listas fijas
        cota.js           375L   de la cota al umbral del hidrómetro
        elevacion.js       88L   la cota, de las curvas del municipio
        estado.js         120L   estado de la sesión y lo que persiste
        formato.js         72L   cómo se escriben los números
        fuentes.js         50L   de dónde sale cada dato — importa lib/fuentes.js
        instalar.js       196L   instalar la PWA
        lluvia.js          65L   pronóstico de lluvia
        mapa.js           341L   MapLibre y los 30 puntos
        metricas.js        41L   cuántos la usan, sin saber quiénes
        oficiales.js       51L   alerta, evacuación y récord (lo único que cambia en caliente)
        plan.js           181L   el plan familiar
        puntos.js          79L   la lista de puntos y su filtro
        rio.js            668L   leer el nivel, la regla y el contexto histórico
        sugerencias.js     64L   el formulario
        tema.js            81L   tema, tamaño de texto y Ajustes
        vista.js           92L   navegación entre pestañas
    css/    app.css          estilos, compartidos por todo
    img/    icon-*.png og.png favicon-32.png apple-touch-icon.png screenshot-*.png

    app/index.html           la app — FUENTE, y la lista de los 30 puntos
    widget/                  el widget que embeben los medios — FUENTE

    datos-abiertos/          los JSON que la app lee y cualquiera puede auditar
            curvas.json      curvas de nivel del municipio
            historia.json    un renglón por año desde 1925 (INA), 6 KB
            puntos.json      coordenadas de los 30 puntos, para el mapa de la portada

    api/nivel.js             sirve el nivel al navegador (CORS proxy)
    api/suscribir.js         alta de un endpoint de push
    api/desuscribir.js       baja
    api/cron/avisar.js       lo dispara Vercel Cron
    api/sugerencias.js       recibe feedback de la gente
    api/visita.js            cuenta una apertura (sin caché, a propósito)
    api/metricas.js          tablero privado, protegido con clave

    lib/ina.js               lectura del INA: API primero, raspado de respaldo
    lib/fuentes.js           organismos, URLs y la estación, escritos UNA vez
    lib/push.js              VAPID y almacén (módulo, NO endpoint)
    lib/metricas.js          claves y días del contador (módulo, NO endpoint)

    scripts/paginas.js       genera las páginas de contenido
    scripts/curvas.js        baja las curvas de nivel del municipio
    scripts/historia.js      baja la serie histórica del INA
    scripts/marca.js         el logo, en un solo lugar
    scripts/iconos.js        rasteriza el logo a los PNG de img/
    scripts/servir.js        servidor de desarrollo
    scripts/vapid.js         genera las claves, se corre una vez

    vendor/maplibre-gl.*     motor del mapa, self-hosteado (BSD-3)

    AUDITORIA.md             cada número, su fuente y qué falta validar
    CLAUDE.md                lo operativo, para agentes

**Ocho carpetas más son páginas generadas** —`datos/`, `historia/`, `mi-cota/`,
`preguntas/`, `legal/`, `charlas/`, `para-medios/`, `puntos-de-encuentro/`—.
Están en la raíz porque su ruta *es* su URL. Cada una arranca con un comentario
que dice que la emite `scripts/paginas.js` y que editarla a mano no sirve.

`sw.js` se queda en la raíz a propósito: un service worker sólo controla su
propio directorio hacia abajo, así que moverlo a `js/` le sacaría el alcance
sobre todo el sitio.

## La app son módulos

`app/index.html` carga `/js/app/principal.js` con `type="module"` y de ahí
cuelga el resto. Antes era un solo `app.js` de 3.100 líneas.

**Qué cambió para quien lo toca.** Ya no hay globals: escribir `estado` en la
consola del navegador no devuelve nada. Para hurgar desde ahí:

    const rio = await import('/js/app/rio.js')

que devuelve la instancia que la página ya cargó, no una copia.

**El único lugar con estado mutable compartido es `oficiales.js`** —alerta,
evacuación y el récord—, y se mueve sólo con `fijarUmbrales()` y
`fijarRecord()`. No es ceremonia: un import de ESM es de sólo lectura, así que
ningún otro archivo puede asignarlos aunque quiera, y el resto los ve
actualizados por el enlace vivo del import.

**`js/app/fuentes.js` importa `lib/fuentes.js` de verdad**, con
`import { ORGANISMOS, FUENTES } from "/lib/fuentes.js"`. Ese archivo es puro
dato y exports, así que el navegador lo carga como cualquier módulo. Era la
única duplicación consciente que quedaba —`FUENTES_APP` era una copia a mano—
y se murió.

**Un módulo nuevo hay que agregarlo al precache de `sw.js`**, o `/app` deja de
abrir sin conexión. `scripts/paginas.js` compara la lista de `js/app/` contra
la de `sw.js` y **falla** si no coinciden: el olvido se ve al regenerar, no el
día que alguien se queda sin señal.

**Qué NO se partió.** `app.css` sigue en un solo archivo: es render-crítico y
partirlo agrega pedidos en la carga que más importa. Y `sw.js` sigue siendo un
script clásico, porque un service worker con módulos todavía no está en todos
lados.

## De dónde sale el nivel

Dos fuentes, en este orden, en `lib/ina.js`:

    API del SIyAH (alerta.ina.gob.ar/a5)  ->  si falla  ->  reporte diario (raspado)

La **API es la preferida**. Es pública, sin clave y sin cuota: es la misma que
consume el visor del propio INA. Devuelve JSON estructurado con la fecha exacta
del dato y —esto es lo que más cambia— con `nivel_alerta`, `nivel_evacuacion`,
`nivel_aguas_bajas` y `cero_ign` de la propia estación, así que esos umbrales
dejaron de ser constantes nuestras.

    estación 30 · SAFE · id externo 240 · propietario Prefectura Naval
    serie 30 · altura hidrométrica · medición directa · metros
    https://alerta.ina.gob.ar/a5/obs/puntual/series/30

El **raspado del reporte diario sigue existiendo como red**, no se borró: ya se
rompió una vez en silencio y no hay motivo para quedarse con una sola puerta. La
respuesta de `/api/nivel` trae `origen` (`"api"` o `"reporte"`) y, cuando hubo
que usar el respaldo, `degradado` con el motivo. **Si aparece `degradado`, algo
se rompió**: se ve en el JSON en lugar de descubrirse meses después.

**Por qué no se usa `/pub/datos`**, que es la ruta que documenta
argentina.gob.ar y sería la primera opción: no anda. Rechaza sus propios
nombres de parámetro, devuelve errores de Perl y se cae con timeouts de 30 s.
El detalle está en `AUDITORIA.md` §6. Conviene reintentar cada tanto.

`ESTACION` y `ENDPOINTS` viven en `lib/fuentes.js`, que es donde están escritos
**una sola vez** los organismos, sus URLs y los identificadores de la estación.
Antes eso estaba repartido entre la app, `scripts/paginas.js`, `lib/ina.js` y
el HTML, y ya se había desincronizado. Si cambia un enlace, cambia ahí.

Ya no hay excepción: desde que la app son módulos, `js/app/fuentes.js`
importa `/lib/fuentes.js` directo. La copia a mano en `FUENTES_APP` se murió.

## Cien años del Paraná

`/historia` es la escala. El hidrómetro marca un número y el número solo no
dice nada hasta que se lo ve al lado de los 7,43 m de 1992 y de los −0,23 m de
2022.

    node scripts/historia.js     # baja la serie y escribe datos-abiertos/historia.json

Baja las **39.115 observaciones de la serie 30 desde el 2 de enero de 1925**
(unos 10 MB) y las resume a un renglón por año: máximo, mínimo, sus fechas,
cuántos días hubo lectura y cuántos estuvo sobre cada umbral oficial. Quedan
**6 KB**. El resumen se hace en el script y no en el navegador a propósito:
procesar 37.000 registros en un teléfono el día de una crecida no es aceptable.

El archivo lleva además **101 cuantiles** de la serie diaria. Sirven para una
sola frase, en la app y en la página: *"el río estuvo por debajo del nivel de
hoy en el X % de los días medidos desde 1925"*. Es un hecho sobre la serie del
INA, no una categoría inventada: la app **no** dice "normal", "alto" ni "bajo",
porque para eso haría falta una metodología oficial que no tenemos.

El récord también sale de ahí. `RECORD` y `RECORD_ANIO` en `js/app/oficiales.js` son sólo el
arranque, para que la regla se dibuje bien antes de que llegue el archivo: si
alguna crecida rompe el récord, se actualiza volviendo a correr el script.

**Nada anterior a 1925.** La crecida de 1905 que se cita seguido no está en
esta serie y no se reconstruye desde recortes de diario.

**La visualización.** Una franja con una barra por año —del mínimo al máximo, y
teñida según si llegó a alerta o a evacuación—, más un tanque con la línea del
agua que se recorre con un `<input type=range>`. Dos modos con el mismo dibujo:
"recorrer años" y "mover el río". Tres cosas que no son negociables:

- **Sin autoplay.** La animación arranca sólo si alguien toca Reproducir.
- **`prefers-reduced-motion` no apaga el botón**, quita la transición: quien
  pidió menos movimiento igual puede recorrer los años.
- **El control es un `range` nativo.** Teclado, lector de pantalla y el gesto
  de arrastre del sistema vienen gratis y funcionan mejor que cualquier cosa
  que pudiéramos escribir.

**Los rótulos de la franja son HTML, no `<text>` del SVG.** El dibujo se estira
con `preserveAspectRatio="none"` para que 102 barras entren en un teléfono, y
eso aplasta las letras horizontalmente hasta volverlas ilegibles. Las barras
aguantan la deformación; las letras no. Es el mismo criterio que la regla de la
app, que también lleva la numeración fuera de la pista.

## Correr en local

    node scripts/servir.js        # http://localhost:3000

Sirve los estáticos, **ejecuta las funciones de `/api`** y —lo que ningún
servidor estático hace— **aplica las cabeceras de `vercel.json`, CSP incluida**.
Sin eso la política no se prueba hasta producción.

`/api/nivel` anda de verdad contra el INA. Las que necesitan Redis devuelven
503, igual que en producción sin configurar.

`scripts/servir.js` usa un byte NUL como centinela al convertir los patrones de
`vercel.json` a expresiones regulares. Efecto colateral: `file` lo reporta como
`data` y **`grep` lo trata como binario** — hay que pasarle `-a` para buscar ahí
adentro.

**El service worker cachea fuerte.** Mientras desarrollás, en DevTools →
Application → Service Workers tildá **"Update on reload"**, o vas a estar
mirando código viejo y creyendo que los cambios no se aplicaron. Y subí
`VERSION` en `sw.js` en cada deploy.

`vercel dev` (con `npx vercel dev`) es la otra opción: más fiel para las
funciones, pero pide login y no corre los cron jobs.

## Caché

`index.html`, `app.css` y los módulos de la app van por **red primero** (revalidan en cada
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
`js/app/principal.js`, así que un script inyectado no corre.

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

El motor del mapa va self-hosteado en `vendor/`. **No usar un proveedor con
clave y cuota**: el modo de falla es caerse justo cuando la app se comparte
durante una crecida, que es cuando importa. No hay ningún token en el repo ni
hace falta.

La búsqueda de dirección usa Nominatim (OpenStreetMap), una consulta por
búsqueda que inicia la persona. Cuando resuelve la calle pero no la altura
exacta, la app lo dice en pantalla en vez de dar un número que parece firme.

## Puntos de encuentro

Los 30 puntos salen de la capa `puntos_de_encuentro` del GeoServer público de
la Municipalidad de Santa Fe, la misma que dibuja el GeoPortal. Van
hardcodeadas en `PUNTOS` dentro de `js/app/estado.js`: el dato es fijo, así funcionan
sin conexión y no gastan cuota de geocodificación.

Para actualizarlas:

    https://geoservicios.santafeciudad.gov.ar/geoserver/publico/ows
      ?service=WFS&version=1.0.0&request=GetFeature
      &typeName=publico:puntos_de_encuentro&outputFormat=application/json

**No volver a geocodificar estas direcciones en runtime.** Se probó y salía
mal: seis puntos quedaban a más de 90 km, y diez en la calle homónima de otro
municipio (Santo Tomé, Recreo, Sauce Viejo) — "Santa Fe" es ciudad y provincia
a la vez y los geocodificadores se van a Rosario. El listado publicado en
prensa además tenía 29 puntos; el oficial tiene 30. Faltaba **Vecinal Pro
Mejoras Alto Verde**, en un barrio fuera del anillo de defensas.

Los módulos compartidos van en `lib/`, no en `api/`: cada archivo dentro de
`api/` se publica como una función de Vercel, y en Hobby hay un tope de 12.

## Avisos (Web Push)

Apagados hasta que se configuren las variables de entorno. Con
`VAPID_PUBLIC_KEY` vacía en `js/app/config.js`, la app funciona igual y no muestra nada.

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
   `CRON_SECRET`, `METRICAS_CLAVE`, y las del almacén.
3. Pegar la pública también en `js/app/config.js`, en `CONFIG.VAPID_PUBLIC_KEY`.
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

## Instalar

`beforeinstallprompt` existe sólo en Chromium, y aun ahí Chrome lo dispara
cuando quiere. En iPhone no existe: Safari deja instalar únicamente desde su
menú Compartir. Antes el botón dependía de ese evento, así que en iOS no
aparecía nunca.

Ahora hay dos caminos. Si el navegador ofrece el diálogo, se usa. Si no, el
botón abre una hoja con los pasos del navegador que corresponda —Safari,
Chrome/Edge en iPhone, Firefox, Chromium— y en iPhone fuera de Safari avisa
que puede no estar la opción.

Tres puertas de entrada: la barra flotante cuando llega el evento, la misma
barra a los 2,5 s si no llegó y estamos en un móvil, y un enlace permanente en
el pie que sobrevive a que la cierren. Todo se oculta si `display-mode:
standalone` dice que ya está instalada.

La hoja va en `<dialog>` por lo que trae gratis: foco atrapado, Escape y el
resto de la página inerte para un lector de pantalla.

## Sugerencias

Formulario plegado al pie, accesible desde cualquier pestaña. Abre con la
negación —**no es una vía para pedir ayuda**— y los teléfonos de emergencia,
porque en una app así cualquier caja de texto se puede leer como un pedido de
auxilio.

Es lo **único** de la app que manda texto de la persona a un servidor, y el
formulario lo dice. No se guarda la IP: se usa sólo para limitar envíos (3 por
hora) y hasheada con `CRON_SECRET` de sal.

Se guardan en Redis, lista `cc:sugerencias`, con tope de 500. Se leen en el
tablero (abajo), o a mano desde la consola de Upstash:

    LRANGE cc:sugerencias 0 49

Sin almacén configurado el endpoint devuelve 503 y el formulario lo explica.

## Estructura del sitio

Cuatro URLs, no una:

| URL | Qué es |
|---|---|
| `/` | Portada. Muestra el nivel del río en vivo y explica la herramienta |
| `/app` | La app |
| `/mi-cota` | Cómo se calcula la cota, con la cuenta completa |
| `/puntos-de-encuentro` | Los 30 puntos oficiales |
| `/datos` | De dónde sale cada número y cómo verificarlo |
| `/historia` | Cien años del Paraná, con la serie del INA desde 1925 |
| `/preguntas` | Ocho preguntas, con datos estructurados `FAQPage` |
| `/legal` | Descargo, privacidad y licencias |

Las cinco últimas las genera `node scripts/paginas.js`.

**Por qué.** La app esconde 3 de sus 4 secciones detrás de pestañas
(`.vista { display: none }`), así que ~800 de sus ~975 palabras —los 30 puntos
de encuentro y los teléfonos incluidos— le llegan a un buscador como contenido
oculto: lo indexa, pero lo pondera menos y no lo usa en el fragmento. Una app
con pestañas nunca va a presentar bien su material a un buscador; estas
páginas sí.

**La portada no es folletería**: lee `/api/nivel` y muestra la altura del río
arriba de todo. Alguien que entra en plena crecida tiene el dato ahí, sin abrir
nada. Y quien tiene la PWA instalada nunca la ve: `landing.js` detecta
`display-mode: standalone` y salta a `/app`, lo que además cubre a las
instalaciones viejas cuyo `start_url` todavía apunta a `/`.

**Las dos páginas de contenido se generan** con `node scripts/paginas.js`. Los
30 puntos se leen de `app/index.html`, que es la fuente de verdad
—`js/app/estado.js` hace lo mismo— para que no existan dos listas que se puedan desincronizar.
Volver a correrlo cuando cambien los puntos o los textos.

**El pie está escrito una sola vez.** Vive en `scripts/paginas.js` como la
constante `PIE`: las páginas generadas lo insertan, y en `index.html` el script
reemplaza el bloque entre los marcadores `<!-- PIE:inicio -->` y
`<!-- PIE:fin -->`. Antes eran dos copias y ya se habían desincronizado: a la
de las páginas le faltaban una columna entera y el teléfono de emergencias.

**Cómo se prueba el ancho de teléfono.** Chrome headless no baja de unos
485 px de viewport, así que `--window-size=390` no prueba nada: hay que meter
la página en un `<iframe width="390">` y medir ahí adentro. Y como la CSP lleva
`frame-ancestors 'none'`, ni siquiera se deja enmarcar a sí misma desde el
servidor de desarrollo — para eso se levanta un `python3 -m http.server`
aparte, que no aplica cabeceras.

**El bug que esto destapó.** El service worker guardaba TODA respuesta de
navegación bajo la clave `/index.html`. Con un solo documento no se notaba;
con dos, visitar la portada dejaba su HTML como copia offline de la app. Ahora
cada navegación se guarda bajo su propia URL, y el respaldo sin conexión usa
`ignoreSearch` (por los deep links `/app?ir=cota`) antes de caer a `/app` o `/`
según la ruta.

**Cuidado al mover la app.** Cinco lugares apuntaban a `/` y fallan en
silencio si se olvida uno: `start_url` y los `shortcuts` del manifest, el
precache del service worker, los destinos `ir` de las notificaciones push (un
aviso de evacuación abriría la portada), `scripts/servir.js` —que no servía
`index.html` para directorios— y las cabeceras de `vercel.json`.

## La marca

Un cero partido por la línea del agua: el círculo es el cero del hidrómetro,
la mitad de abajo es el agua, la línea que lo cruza es el nivel. El SVG vive
en `scripts/marca.js` y en el HTML de la portada y la app, escrito a mano.

`node scripts/iconos.js` lo rasteriza a PNG con Chrome headless —sin
dependencias, el navegador dibuja SVG mejor que cualquier librería que
pudiéramos instalar— y genera el favicon, los íconos de app, el maskable, el
de iOS y el `og.png` de las vistas previas.

**Dos cosas que costaron.** El agua llevaba relleno *y* trazo del mismo color,
así que por debajo de la línea tapaba el anillo y a 512 px la marca se leía
como una canasta: ahora el agua rellena sólo el interior y el anillo se dibuja
encima. Y cada corrida de Chrome necesita su propio `--user-data-dir`, o la
segunda se queda esperando el lock de la primera y el script no termina nunca.

## Las pantallas de la app

Cuatro pestañas —Río, Mi umbral, Mi plan, Dónde ir— más:

**La tarjeta de Río.** Arriba la lectura oficial en grande, y debajo una fila
de dos celdas —`.celdas-umbral` en `app.css`— con **tu umbral estimado** y el
**margen de hoy**, más una oración en prosa. Es lo que convierte «cómo está el
río» en «qué significa para mí» sin un gráfico nuevo. El color del estado va en
el valor del margen, no en el fondo de la celda: la tarjeta ya está tintada y
tinte sobre tinte no se distingue. Si el río pasó tu umbral, el margen manda
sobre el color de la tarjeta aunque la ciudad esté en nivel normal.

**La regla.** Además de alerta (5,30) y evacuación (5,70) lleva la marca del
**récord de 1992 (7,43)** en tono tenue. Sin ella, 5,70 parece el techo del
mundo; con ella se ve que todo el rango de decisión son 2,13 m.

**Bienvenida.** Primera visita: muestra el río antes de pedir nada. Es un
overlay y no una vista, para no meter una quinta entrada en el sistema de
pestañas.

**Ajustes.** Se llega desde el engranaje de la cabecera, **no** desde una
quinta pestaña: la barra de abajo se deja en cuatro para no tocar los caminos
que se usan en una emergencia. Trae los avisos —incluido el aviso anticipado a
50 y 20 cm de tu umbral, que el service worker resuelve leyendo `avisarCerca` de
IndexedDB—, el tema y el tamaño de texto.

**En contexto.** Barras con el nivel de hoy contra los dos umbrales oficiales
y el récord de 1992. Sólo entran valores con fuente: los máximos de otras
crecidas no se pudieron verificar y por eso no están.

**Compartir como imagen.** Dibuja una imagen 1080×1920 en un canvas del propio
teléfono y la pasa a la API de compartir del sistema; donde no existe, la
descarga. Espera a `document.fonts.ready` o el canvas dibuja con la
tipografía del sistema en vez de la de la app.

**Un bug que vale recordar.** `[hidden]` del navegador es `display: none`,
pero pierde contra cualquier regla de autor que fije `display`. El overlay de
bienvenida tenía `display: flex` y no se ocultaba nunca. Hay una regla
explícita en `app.css` para eso.

## La cota del terreno

El cálculo tiene dos mitades. Las dos están medidas contra una fuente externa,
que no es lo mismo que estar validadas por un organismo.

**La hidráulica.** El cero del hidrómetro del Puerto de Santa Fe es 8,20 m
IGN. La pendiente de la superficie del agua, 0,045 m/km, se contrastó con un
caso independiente: en 1992, con el puerto en 7,43 m, Arroyo Leyes —24 km río
arriba— llegó a 16,70 IGN según un ingeniero civil citado en prensa. El modelo
da 16,71. Un centímetro — en **un** punto de **una** crecida. Es el mejor dato
independiente que hay, y sigue siendo una sola observación: por eso la interfaz
dice «umbral estimado» y no «cuándo llega el agua».

**La cota del terreno.** Sale de las curvas de nivel de la Municipalidad de
Santa Fe, capa `sitmax:curvas_nivel` del GeoServer municipal, subida por la
Secretaría de Recursos Hídricos. 169 curvas cada 50 cm, de 12,5 a 22,5 m, en
metros IGN — el mismo sistema que el cero del hidrómetro. Se descargan una vez
con `node scripts/curvas.js` y quedan en `datos-abiertos/curvas.json` (72 KB), que la
app lee localmente: sin API de terceros y sin conexión.

`ERROR_DEM` es 0,5 m, la mitad del intervalo entre curvas, que es la
convención para interpolar entre ellas.

**Dos trampas del origen**, las dos manejadas en `scripts/curvas.js`:

1. 25 de las 169 curvas traen `Z = 0` en la geometría; la cota verdadera está
   en el atributo `layer`. Leer la Z daba puntos de encuentro bajo el agua.
2. `layer` mezcla separador decimal: hay `17,2` y hay `17.2`.

**Y una del cálculo**: la distancia va medida punto-a-segmento, no al vértice
más cercano. Con vértices, simplificar la geometría movía el resultado 1,85 m;
con segmentos, 2 cm de media y 42 cm en el peor de los 30 puntos de encuentro.

**Por qué no un modelo satelital.** Hasta acá la elevación salía de Open-Meteo
(Copernicus GLO-90), un modelo de *superficie*: mide techos y arbolado, no el
piso. Medido contra 36 puntos de nivelación del IGN alrededor de Santa Fe
(`ign:nivelacion_topografica`, cotas de campo al milímetro):

    sesgo medio      +0,89 m
    desvío estándar   7,46 m
    peor caso       −22,9 / +14,8 m

Y contra las curvas municipales, dentro de la ciudad, sobreestimaba 2,15 m de
media. Todo el rango de decisión de la app —de 5,30 (alerta) a 7,43 (récord de
1992)— son 2,13 m: el error era más grande que la escala entera.

**Fuera de cobertura.** Las curvas abarcan la ciudad, no toda el área
metropolitana (1 de los 30 puntos de encuentro queda afuera). Ahí la app dice
que no tiene el dato y pide la cota a mano, en vez de caer a una fuente peor.

**Nota sobre los servicios municipales.** `geoservicios.santafeciudad.gov.ar`
—el endpoint documentado para refrescar los puntos de encuentro— está detrás
de Cloudflare y devuelve 403 a cualquier cliente que no sea un navegador con
JS. El que sí responde es `geoserver.santafeciudad.gov.ar/geoserver/sitmax`,
que es el que usa el GeoVisualizador.

## Cuántos la usan

Dos fuentes, por si una falla:

**Vercel Web Analytics.** El script ya está en `index.html` y el service worker
deja pasar `/_vercel/` sin cachear. Hay que activarlo en el panel del proyecto;
hasta entonces devuelve 404 y no registra nada. No mide a quien abre la app sin
conexión, que es justo el día que más importa.

**Contador propio.** `POST /api/visita` una vez por sesión, con un número al
azar que el teléfono guarda en `cc_id`. Del lado del servidor entra a un
HyperLogLog (`cc:activos:AAAA-MM-DD`, 40 días de vida): responde _cuántos
distintos_ sin guardar ninguno. No viaja la cota, ni la zona, ni el plan.

Va en su propia función y **no** dentro de `/api/nivel`: ese está cacheado una
hora en el CDN, así que la mayoría de las llamadas nunca ejecutan la función.
Contar ahí subestimaría, y más los días de tráfico alto.

El día se corta en hora argentina (UTC-3 fijo, sin horario de verano): con el
corte en UTC, todo lo que pasa entre las 21 y la medianoche caería en el día
siguiente.

**El tablero.** `GET /api/metricas?clave=...` con `METRICAS_CLAVE`. Dos
solapas: *Resumen* (activos de hoy / 7 / 30 días, los últimos 14 en barras,
suscriptos a los avisos y las últimas 5 sugerencias) y *Sugerencias*
(`&ver=sugerencias`, hasta 200, con el desglose por categoría). Con
`&formato=json` sale todo en JSON.

Sin clave configurada no responde: es preferible que no funcione a que quede
abierto. Compara en tiempo constante y responde 404, no 401, para no confirmar
que existe.

Las sugerencias **no** se muestran dentro de la app: traen el contacto que la
gente deja para que le respondan.

Ojo: los totales de 7 y 30 días son la **unión**, no la suma. Quien entró
lunes y martes cuenta una vez.

## Analítica

Vercel Web Analytics, sólo el `<script defer src="/_vercel/insights/script.js">`.
El snippet oficial trae además un `<script>` inline que la CSP bloquea; ese
inline sólo encola _custom events_, que son de plan Pro. Al ser mismo-origen
entra en `script-src 'self'` y `connect-src 'self'` sin abrir la política.

Hay que **habilitarlo en el panel de Vercel** (Analytics → Enable) o la ruta no
existe. En local da 404, es normal.

Es sin cookies y agregada: no identifica personas. La promesa del plan familiar
—"se guarda en este teléfono"— sigue siendo cierta; lo único que sale del
dispositivo son las sugerencias, y ahí el formulario lo dice.

El service worker no toca `/_vercel/`: cachear ese script serviría una versión
vieja para siempre.

## Pendientes

- Los km río arriba de cada zona son estimaciones propias, salvo
  Arroyo Leyes (24 km, publicado). Medirlos sobre el cauce.
  La app ya lo aclara en pantalla, pero el número sigue sin medirse.
- ~~Verificar el datum vertical del DEM satelital (Copernicus GLO-90, vía
  Open-Meteo, referido al geoide EGM2008).~~ **Resuelto por la migración a las
  curvas municipales**: las curvas ya vienen en metros IGN, el mismo sistema
  que el cero del hidrómetro, así que no hay conversión de datum en el camino.
  La app no consulta ningún DEM satelital; Copernicus queda sólo como historia
  de validación en `/datos`.
- **Validar el modelo con la Dirección de Gestión de Riesgos del municipio.**
  Es la limitación más importante del estado actual, no un pendiente más de la
  lista. Lo que hay es una coincidencia de un centímetro con la crecida de
  1992, en dos puntos: buena señal, pero una sola validación independiente no
  prueba un modelo. Hasta que lo revisen especialistas y organismos competentes
  (Gestión de Riesgos, INA, FICH-UNL), lo que la app publica son niveles de
  referencia estimados y así están nombrados en toda la interfaz.
- ~~El nivel se saca raspando el HTML del reporte diario del INA.~~
  **Resuelto.** La API REST del SIyAH (`alerta.ina.gob.ar/a5`) es pública, sin
  clave y sin cuota: `lib/ina.js` la usa primero y cae al raspado sólo si
  falla. El campo `origen` de `/api/nivel` dice cuál contestó y `degradado`
  aparece cuando hubo que usar el respaldo, así que la próxima vez que el
  raspado se rompa se va a ver en el JSON en lugar de descubrirse meses
  después. La ruta documentada (`/pub/datos`) no se pudo usar: ver
  `AUDITORIA.md` §6.
- **La cota de Arroyo Leyes en 1992 (16,70 IGN) sigue sin fuente primaria.**
  Es el único dato independiente del modelo y viene de una nota de prensa.
  Conseguir el registro original es lo de mayor rendimiento pendiente.
- **El margen de la cota (±0,5 m) no debería ser una constante.** 21 de las 169
  curvas están fuera de la malla de 50 cm, y entre 20,7 y 22,5 m no hay
  ninguna. El margen tendría que salir de la separación local entre las dos
  curvas usadas para interpolar.
