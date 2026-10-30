# Cota Cero — Santa Fe

Herramienta ciudadana para la emergencia hídrica (Ley provincial 14.477).
Traduce la lectura del hidrómetro del Puerto de Santa Fe a **tu nivel de
aviso**: el nivel del río a partir del cual el agua puede llegar a tu terreno.
Es un cálculo aproximado, no una predicción, y no tiene vínculo oficial.

Tres documentos, tres trabajos:

- **este README** — cómo funciona cada pieza y por qué se decidió así;
- **`AUDITORIA.md`** — cada número, de dónde sale y qué falta validar;
- **`CLAUDE.md`** — lo operativo: comandos, reglas que no se rompen y qué
  archivos están conectados entre sí.

## El modelo

    cota del agua (IGN) = lectura del hidrómetro + 8,4214
    corrección río arriba = 0,045 m por km

Para un terreno dado se despeja al revés: qué lectura del hidrómetro pone el
agua a la altura de ese terreno. La cuenta vive en `js/app/modelo.js`
(`umbralDe`, `margenDe`), pura —sin estado ni DOM— para poder probarla desde
Node, y la app entra siempre por una sola puerta, `cotaEnHidrometro()`. Por
defecto descuenta el margen de la fuente para quedarse en el escenario
pesimista: `ERROR_DEM` (0,5 m) con las curvas de la ciudad, `ERROR_PUNTOS`
(1,0 m) con los puntos de Rincón y Arroyo Leyes.

**El cero cambió el 26/10/2026, de 8,20 a 8,4214.** Vías Navegables, que
mantiene la escala, informó por escrito su cero en el sistema del ex MOP
(+8,9524) y aclaró que el 8,19 que circulaba no lo brinda; el IGN publica
que H_IGN = H_MOP − 0,531 m. El INA midió 8,378 en 2016: las tres fuentes
oficiales quedan a 4 cm. Lo que sigue abierto es que las curvas del municipio
no declaran su sistema de alturas (AUDITORIA.md §1). **Las otras constantes
están en discusión y no se tocaron.** La pendiente se despejó del mismo caso de 1992 con el que
después se la «validaba»: el 16,70 de Arroyo Leyes en 1992 que circula en la
prensa se estimó con esa misma pendiente, así que coincidir con él no prueba
nada. Lo que sí se midió contra algo independiente es la altura del terreno:
contra 330 puntos fijos de la Municipalidad, el margen de medio metro alcanza
en 98 de cada 100. Todo está en `AUDITORIA.md` §1, §3 y §4, y explicado para
cualquiera en `/datos`.

Hasta que lo revisen organismos competentes (Gestión de Riesgos del municipio,
INA, FICH-UNL), lo que la app calcula son niveles de referencia estimados, y
así se nombran en la interfaz.

**Tres conceptos, tres nombres.** El **nivel** es la lectura del hidrómetro;
la **cota**, la altura del terreno sobre el mar; el **umbral**, la lectura a
partir de la cual el agua alcanzaría esa cota. En pantalla el umbral se llama
«tu nivel de aviso», siempre con ≈ y un decimal. El vocabulario completo, y lo
que está prohibido decir, está en CLAUDE.md.

## Las fuentes de los datos

| Dato                | De dónde                                                    | Cómo llega                                    |
| ------------------- | ----------------------------------------------------------- | --------------------------------------------- |
| Nivel del río       | API del SIyAH del INA, estación 30 (SAFE, Prefectura Naval) | `lib/ina.js` → `/api/nivel`, en cada consulta |
| Alerta y evacuación | la misma estación del INA                                   | vienen junto con el nivel                     |
| Cota del terreno    | curvas de nivel del municipio (`sitmax:curvas_nivel`)       | `datos-abiertos/curvas.json`, se lee local    |
| Cota en la costa    | puntos con cota de la Provincia (IDESF, capa `MACotas`)     | `datos-abiertos/cotas-costa.json`, local      |
| Serie desde 1925    | INA, serie 30                                               | `datos-abiertos/historia.json`, resumida      |
| Puntos de encuentro | GeoServer municipal (`puntos_de_encuentro`)                 | escritos en `app/index.html`                  |
| Callejero           | Georef (API de direcciones del Estado nacional)             | `datos-abiertos/calles.json`, se lee local    |
| Mapa base           | OpenFreeMap (vectorial, esquema OpenMapTiles); foto del IGN | en vivo; MapLibre self-hosteado en `vendor/`  |
| Lluvia y caudal     | Open-Meteo (lluvia; caudal de GloFAS, Copernicus)           | en vivo, con las coordenadas fijas del centro |

Ninguna pide clave ni tiene cuota. Es deliberado: un proveedor con cuota se
cae justo cuando la app se comparte durante una crecida.

**Cada servicio de otro origen está en `lib/proveedores.js`**, con su host,
para qué se usa y qué le hace falta en la CSP. El generador falla si uno no
está en la CSP de `vercel.json`, si `/legal` no lo nombra o si en el código
aparece un host sin clasificar. Así salió que `/legal` nunca había nombrado a
Open-Meteo.

**El nivel tiene dos puertas.** Primero la API REST del SIyAH
(`alerta.ina.gob.ar/a5`), que trae además los umbrales oficiales y el
`cero_ign` de la estación. Si falla, se raspa el reporte diario en HTML, que
no trae umbrales: para ese caso quedan los de respaldo, 5,30 / 5,70, en
`public/lib/comun.js`. La respuesta de `/api/nivel` dice `origen` (`"api"` o
`"reporte"`) y, si hubo que usar el respaldo, `degradado` con el motivo:
**si aparece `degradado`, algo se rompió**. La ruta que documenta
argentina.gob.ar (`/pub/datos`) no anda; ver `AUDITORIA.md` §6.

**La cota sale de curvas, no de un modelo satelital.** Antes se usaba
Copernicus GLO-90 vía Open-Meteo, que mide techos y arbolado: contra 36 puntos
de nivelación del IGN tenía un desvío de 7,5 m, y dentro de la ciudad
sobreestimaba 2,15 m de media. Todo el rango de decisión —de 5,30 a 7,43, el
récord de 1992— son 2,13 m. Las curvas son 169, cada ~50 cm, en metros IGN,
trazadas a mano en 2005 sobre un relevamiento de 1992 (son el recorte de la
ciudad de una capa provincial, `AUDITORIA.md` §7). Dos trampas del origen que
resuelve `scripts/curvas.js`: 25 curvas traen `Z = 0` y la cota verdadera
está en el atributo `layer`, que además mezcla `17,2` y `17.2`. La distancia
se mide punto-a-segmento, no al vértice.

**Fuera de la ciudad, puntos.** Las curvas terminan en el límite del
municipio. Para San José del Rincón y Arroyo Leyes la app usa los puntos con
cota de la misma campaña de 2005, que la Provincia publica sólo como mapa: los
baja `node scripts/cotas-costa.js` con `GetFeatureInfo`, porque el WFS de la
IDESF está apagado. La altura sale de los cuatro puntos más cercanos, hasta
150 m. Ahí el terreno cambia más de un punto al otro, y con medio metro de
margen uno de cada ocho quedaba del lado optimista: por eso el margen es un
metro.

**Las fuentes de altura son una lista** (`FUENTES_ALTURA` en
`js/app/elevacion.js`): cada una con su archivo, su cuenta, su margen, su
sello y cómo se la nombra en pantalla. La primera cuya área contiene el punto
es la que contesta. Fuera de todas, la app dice que no tiene el dato y pide la
cota a mano.

**Los puntos de encuentro no se geocodifican.** Se probó y seis quedaban a más
de 90 km y diez en la calle homónima de otro municipio. Para actualizarlos:

    https://geoservicios.santafeciudad.gov.ar/geoserver/publico/ows
      ?service=WFS&version=1.0.0&request=GetFeature
      &typeName=publico:puntos_de_encuentro&outputFormat=application/json

Ese host está detrás de Cloudflare: hay que pedirlo con un `User-Agent` de
navegador. En septiembre de 2026 dio 403 un par de días; desde el 16/10
contesta. Ahí también está la Red de Puntos Fijos con la que se midió el error
de las curvas (`publico:puntos_fijos`). El listado de prensa tenía 29 puntos
de encuentro; el oficial tiene 30 (faltaba la Vecinal Pro Mejoras Alto
Verde).

**La búsqueda de dirección va en cascada:** Georef primero, porque normaliza lo
que escribe la gente e interpola el número; Nominatim detrás, filtrado por
municipio. Medido el 17/10/2026 con 30 direcciones: Nominatim solo ubicaba 15
(y mandaba 3 a Santo Tomé o Candioti); Georef, 25. Las sugerencias del campo
se filtran en el teléfono contra `calles.json`, sin mandar nada hasta que la
persona aprieta Buscar.

Con Rincón o Arroyo Leyes elegidos, se busca primero en esa localidad —Georef
tiene el callejero de Rincón— y, si no aparece, en la ciudad. Si la dirección
cae en otra zona que la elegida, la app lo dice y ofrece cambiarla: la zona
pone los km río arriba, y el resultado cambia. Cómo se reconoce cada
localidad está en `ZONAS` (`js/app/zonas.js`).

## Estructura

Lo que se publica vive en `public/`; la raíz guarda lo que no se sirve. Vercel
publica sólo esa carpeta (`"outputDirectory": "public"`) y toma las funciones
de `api/` de la raíz. `public/datos/index.html` se sirve en `/datos`.

    public/                    EL SITIO
      index.html               la portada, a mano
      app/index.html           la app, a mano — y la lista de los 30 puntos
      widget/                  el widget que embeben los medios, a mano
      datos/ historia/ …       diez páginas y la 404, que emite scripts/paginas.js
      sw.js                    service worker (en la raíz del sitio: su alcance es su ruta)
      js/app/                  la app, en módulos ES (principal.js es la entrada)
      js/                      los scripts clásicos del sitio: landing, rio-barra, historia,
                               contacto, medios, analitica, sin-modulos
      lib/                     lo que usan Node Y el navegador: comun, comun-clasico,
                               fuentes, listas
      css/ img/ vendor/        estilos, íconos, MapLibre
      mapa/                    el estilo del mapa en sus dos temas (lo emite el generador)
      datos-abiertos/          curvas, cotas-costa, historia, calles y puntos, en JSON
      guia.pdf                 la hoja para imprimir (artefacto, no fuente)

    api/                       funciones de Vercel: nivel, suscribir, desuscribir,
                               sugerencias, visita, metricas, probar-aviso, cron/avisar
    lib/                       sólo Node, no se publica: ina, push, metricas, paginas,
                               sugerencias, charlas, proveedores, mediciones.json
    scripts/                   el generador (paginas.js + paginas/), comprobar.js, el
                               servidor local, las descargas y la marca
    estilos/                   app.css con comentarios; el generador lo publica sin ellos
    datos-crudos/              análisis y datos de trabajo

**Por qué dos `lib/`.** Cuatro archivos los importan a la vez Node y el
navegador, así que tienen que estar en `public/`. Lo que corre sólo en Node se
queda afuera, o se publicaría. La alternativa era que el generador copiara los
cuatro en cada corrida, y una copia que se regenera sola un día se
desincroniza.

**Las páginas de contenido se generan.** `/datos`, `/historia`, `/preguntas`,
`/legal`, `/charlas`, `/sobre`, `/contacto`, `/para-medios`,
`/puntos-de-encuentro` y `/guia` las emite `node scripts/paginas.js`. Existen
porque la app esconde tres de sus cuatro secciones detrás de pestañas, y un
buscador no pondera bien el contenido oculto.

El generador está partido en `scripts/paginas/`: `base.js` con lo compartido,
un archivo por página y `emitir.js`, que escribe todo. Cada página se anota
sola al armarse y se escribe en la ruta que le da `lib/paginas.js`. Además
escribe el pie de la portada, `sitemap.xml`, `llms.txt`, el catálogo de la
API, el gemelo clásico de `comun.js`, `public/css/app.css` sin comentarios, la
lista de módulos del precache y la `VERSION` del service worker —un resumen
del contenido precacheado, que cambia sola—. Los números de la medición del
error los lee de `lib/mediciones.json`, que escribe el análisis.

Y **falla** si algo no cierra: la portada, la app o el widget no dicen lo
mismo que `lib/paginas.js`; el precache nombra un archivo que no existe o le
falta una página; una página no tiene enlace en el pie o cabecera de
revalidación; un proveedor no está en la CSP o en `/legal`; o una de las 29
copias de la marca no tiene el dibujo de `scripts/marca.js`.

**`node scripts/comprobar.js` cuida el cálculo.** No es un framework de
tests: una lista de casos con valores ya verificados en el navegador —el
formato de los números, el gemelo clásico, la cuenta del modelo, de dónde sale
la altura, las reglas de los estados, que cada import de la app exista, que la
`VERSION` esté al día— que sale con error si alguno cambia. Carga el código de
la app desde Node con `scripts/app-en-node.js`, el mismo que usan los análisis
de `datos-crudos/`.

**Cuatro mundos que no se importan entre sí:** los módulos de la app, los
scripts clásicos del sitio, el service worker y Node. Lo que hace falta en más
de uno vive en `public/lib/comun.js` (umbrales de respaldo, filtro de
plausibilidad, vencimiento, formato de números, los textos de los estados y la
notificación); los clásicos y el service worker leen su gemelo
`comun-clasico.js`. Antes los umbrales estaban escritos a
mano en ocho archivos, y una copia vieja hace que ese consumidor avise tarde.

## Correr en local

    node scripts/servir.js        # http://localhost:3000

Sirve `public/`, ejecuta las funciones de `api/` y aplica las cabeceras de
`vercel.json`, **CSP incluida**: sin eso la política no se prueba hasta
producción. `/api/nivel` consulta al INA de verdad; las funciones que
necesitan Redis devuelven 503, igual que en producción sin configurar.

No hay `package.json`, ni build, ni framework de tests: la verificación de
cada cambio está en CLAUDE.md, y `node scripts/comprobar.js` corre los casos
del cálculo. Mientras desarrollás, tildá **«Update on reload»** en DevTools →
Application → Service Workers, o vas a mirar código viejo. La `VERSION` de
`sw.js` la escribe `node scripts/paginas.js`: regenerá antes de publicar.

## La portada

**Muestra el nivel del río en vivo**, arriba de todo: quien entra en plena
crecida tiene el dato sin abrir nada. Quien tiene la PWA instalada nunca la ve:
`landing.js` detecta `display-mode: standalone` y salta a `/app`.

**El estado en vivo tiene un solo dueño**, el objeto `rio` de `landing.js`. El
mockup del hero, la píldora de la barra, la franja de alerta y la frescura del
pie se suscriben a él: un solo `fetch`, un solo número. La franja de alerta
está siempre en el HTML —vacía mide cero— porque un `role="status"` que
aparece con el aviso adentro no lo anuncia ningún lector de pantalla. Y nunca
sale con un dato vencido (más de 48 h).

### La regla del hero se mueve

El agua arranca en el nivel real y sube con el scroll, o con el control «Mové
el río», hasta el récord del hidrómetro. Es la respuesta a que los umbrales,
escritos, no significan nada.

Conviven dos variables que no se mezclan: `real`, el dato del INA, manda en el
número grande y en la marca «hoy»; `sim` es lo único que dibuja la regla. **El
número grande no sigue al deslizador**: un hero que cambia la altura mientras
alguien scrollea en una crecida le estaría mintiendo en el peor momento. Apenas
`sim` se despega, la etiqueta dice «Simulado» y el renglón de abajo pasa a
condicional («Faltarían…»), con cuántos de los 102 años medidos llegaron a ese
nivel: «pasó 4 veces en un siglo» es lo contrario de un pronóstico.

Nada se mueve solo: sin autoplay ni scroll-jacking, y con
`prefers-reduced-motion` no se engancha al scroll. Tocar el control apaga el
scroll.

## La app

Cuatro pestañas —Río, Mi casa, Mi plan, Dónde ir— y Ajustes desde el engranaje
de la cabecera, para que la barra de emergencia se quede en cuatro.

**En alerta o evacuación de la ciudad, con dato vigente, la primera pasa a ser
«Ahora»** (`js/app/ahora.js`) y Mi casa sale de la barra, con un enlace al pie.
Lleva el verbo y el 103, el punto de encuentro del plan (si coincide con uno de
los 30, con «Cómo llegar»), una lista corta —lo que falta de la mochila, o
`SALIDA` en evacuación— con las mismas casillas del plan, y un mensaje ya
escrito para WhatsApp, sin número: se elige a quién. Las notificaciones de
alerta y evacuación abren ahí. Con el dato vencido o el nivel cargado a mano,
nunca.

- **Río.** La lectura oficial en grande; debajo, tu nivel de aviso y el margen
  de hoy. La regla marca alerta, evacuación y el récord de 1992: sin él, 5,70
  parece el techo del mundo.
- **Mi casa.** Tres formas de cargar la altura del terreno: dirección, GPS o
  tocando el mapa (con confirmación). La altura guarda de qué fuente salió
  (`cc_cota_fuente`), porque de eso depende el margen. Al marcar, el fondo pasa a la foto
  aérea del IGN (vuelos de 2013 y 2014) con los nombres de las calles: el
  plano casi no tiene edificios de Santa Fe. La fecha se dice en pantalla, porque una casa
  más nueva sale como baldío. En Rincón y Arroyo Leyes las curvas no llegan
  y la altura sale de los puntos con cota de la Provincia
  (`datos-abiertos/cotas-costa.json`), con un metro de margen en vez de medio.
  En Calchines no hay ni una cosa ni la otra (`sinPlano` en `ZONAS`): ahí las
  tres se esconden y la app
  pide la altura a mano de entrada, en vez de mandar de un camino al otro.
  Para quien ya la cargó, el resultado va
  primero y los pasos se pliegan. Debajo, si la zona tiene defensa y a qué
  niveles **pasó algo** ahí, con fuente (`ZONAS` en `js/app/zonas.js`,
  rastreados en `AUDITORIA.md` §9). La defensa no cambia la cuenta: cambia lo
  que la cuenta significa.
- **Mi plan.** Mochila y checklist previo (`public/lib/listas.js`), que se
  imprimen como plan familiar. Lo marcado como del municipio está en su Plan
  de Contingencia; lo demás lo agregamos nosotros.
- **Dónde ir.** Los 30 puntos, el más cercano y el mapa. MapLibre no se
  precachea —son 275 KB por una pestaña que mucha gente no abre— y se pregunta
  por WebGL antes de bajarlo. El fondo son tiles vectoriales de OpenFreeMap
  con los colores de la app (`lib/estilo-mapa.js`): los nombres de las calles
  salen al tamaño de la pantalla y el tema oscuro es oscuro de verdad. El zoom
  se detiene en 18 por la foto aérea, que más cerca se ve borrosa, y si el
  fondo no carga el mapa lo dice: sin tiles quedaba gris liso, con los puntos
  encima y sin una palabra.
  `/app?ir=ayuda` abre la tarjeta «Si no sabés
  nada de esto»: el 103 y tres instrucciones, para afiches y mensajes.

**El pie de la app es corto a propósito.** Quedan tres cosas: «Sin vínculo
oficial», «Si Defensa Civil dice que salgas, salí» y quién la hizo. Las dos
primeras sólo se dicen ahí; la tercera es el contrapeso de la primera. Todo lo
demás está en el sitio o en Ajustes.

**En un teléfono viejo.** Si el navegador no corre módulos ES o la sintaxis de
2020, la app se quedaría en «Buscando el nivel del río…» para siempre.
`js/sin-modulos.js` lo detecta y muestra lo que el HTML ya trae: los teléfonos
de emergencia y los 30 puntos. Es ES5 a propósito.

## Los ocho estados y cómo se dicen

La misma situación se cuenta en la notificación, en la pantalla del río, en
Mi casa, en la pestaña «Ahora» y en la imagen para compartir. Estaban copiadas
a mano en cinco archivos —y la pantalla ya decía «Terminá la mochila» a los
50 cm, cuando la notificación decía «Andá armando»—. Desde octubre de 2026
viven **una sola vez en `public/lib/comun.js`**: `ESTADOS` (título y verbo de
cada uno), `estadoDe()` (qué estado corresponde), `textoGrave()` (los dos
graves de la ciudad, como los dice la pantalla) y `avisoDe()` (la
notificación, que antes era `armarAviso` en `sw.js`). El service worker los
recibe por el gemelo `comun-clasico.js`. Esta tabla los describe; la fuente es
ese archivo.

En los estados graves el texto **empieza con el verbo** de lo que hay que
hacer y **lleva el 103**.

| #   | Cuándo                        | Título                                  | Con qué empieza                                                      |
| --- | ----------------------------- | --------------------------------------- | -------------------------------------------------------------------- |
| 1   | Sin dato del río              | Cambió el nivel del río                 | Abrí Cota Cero para ver cuánto mide hoy                              |
| 2   | El río pasó tu nivel de aviso | El río pasó tu nivel de aviso           | **Mové a las personas, los remedios y los documentos** … 103         |
| 3   | Río ≥ evacuación de la ciudad | Evacuación en la ciudad                 | **Si Defensa Civil dice que salgas, salí** … 30 cm te arrastra … 103 |
| 4   | Río ≥ alerta de la ciudad     | Alerta en la ciudad                     | **Armá la mochila y avisale a tu familia** … Dudas: 103              |
| 5   | Faltan ≤ 20 cm                | Faltan unos N cm para tu nivel de aviso | **Terminá la mochila y avisale a tu familia**                        |
| 6   | Faltan ≤ 50 cm                | Faltan unos N cm para tu nivel de aviso | **Andá armando la mochila**                                          |
| 7   | Subió, con nivel cargado      | El río subió a X m                      | Faltan unos N para tu nivel de aviso. Por ahora, seguí mirando       |
| 8   | Subió, sin nivel cargado      | El río subió a X m                      | Cargá tu casa en la app y te avisamos cuando el río importe para vos |

Los cuerpos de las notificaciones no pasan de **180 caracteres**: Android corta
ahí, y la línea que se cortaba era la del 103. `node scripts/comprobar.js`
verifica las tres reglas —el verbo primero, el 103 y los 180 caracteres— con
los números más largos posibles.

Las comparaciones contra tu nivel de aviso van en centímetros enteros
(`faltaCm`): en coma flotante, con el río justo en tu nivel de aviso la
pantalla decía «faltan unos 0 cm», y a 20 cm justos la notificación decía
«andá armando» en vez de «terminá».

Debajo de la alerta, la pantalla tiene dos estados más que no son
notificaciones: «Atención», desde un metro antes de la alerta de la ciudad
(`ATENCION_ANTES_M`, criterio propio), y «Río normal».

## Cien años del Paraná

`node scripts/historia.js` baja las ~39.000 observaciones de la serie 30 desde
el 2 de enero de 1925 (unos 10 MB) y las resume a un renglón por año: máximo,
mínimo, sus fechas y los días sobre cada umbral oficial. Quedan 6 KB, más 101
cuantiles para una sola frase: «el río estuvo por debajo del nivel de hoy en
el X % de los días medidos». La app **no** dice «normal», «alto» ni «bajo»:
para eso haría falta una metodología oficial que no tenemos.

`/historia` lleva todos los números en el HTML; `js/historia.js` sólo agrega
la franja que se recorre, que es un slider de verdad para el teclado. 2003
lleva la única nota a mano: el Paraná quedó un centímetro debajo de la alerta
y la inundación la trajo el Salado. Nada anterior a 1925 se reconstruye desde
recortes de diario.

## La hoja para imprimir

`/guia` sale **en blanco**, para llenar con birome y pegar en la heladera. Es
para quien la app no alcanza, y el camino previsto es que alguien la imprima en
un centro vecinal y la reparta. `guia.pdf` es la misma hoja ya impresa.

Entra en **una carilla**, porque fotocopiar cien de dos cuesta el doble:
`node scripts/guia-pdf.js` no escribe nada si salieron dos, o si lo que cargó
no es la guía. No trae el nivel del día: en papel, un número de hace tres
semanas se lee como si fuera de hoy.

## Avisos (Web Push)

El servidor manda un push **sin contenido**: no sabe la cota ni el nivel de
aviso de nadie. Sólo despierta al teléfono; el service worker consulta
`/api/nivel`, lo compara contra lo que la app guardó en IndexedDB y arma ahí la
notificación. De cada persona el servidor guarda un solo dato, el endpoint
opaco del navegador. Como no hay contenido no hay cifrado, y alcanza con firmar
un JWT ES256: ninguna dependencia.

Avisa cuando el nivel sube 15 cm desde el último aviso, cuando cruza alerta o
evacuación hacia arriba (con urgencia alta), y a 50 y 20 cm de tu nivel de
aviso si lo pediste en Ajustes. En iPhone sólo funciona con la app instalada,
y la app lo explica.

**Puesta en marcha**

1. `node scripts/vapid.js` — imprime el par de claves y un `CRON_SECRET`.
2. En Vercel: `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`
   (mailto:), `CRON_SECRET`, `METRICAS_CLAVE` y las del almacén.
3. Pegar la pública en `js/app/config.js`, `CONFIG.VAPID_PUBLIC_KEY`. Vacía,
   la app funciona igual y no ofrece avisos.
4. Almacén: Upstash Redis desde el marketplace de Vercel, por su API REST
   (`KV_REST_API_URL` / `KV_REST_API_TOKEN`), sin librería.

El cron corre tres veces por día (9, 15 y 21): en el plan Hobby cada expresión
corre una vez por día, pero se admiten varias. El INA publica una vez por día.
`POST /api/probar-aviso` manda uno de prueba y devuelve lo que contestaron
Apple o Google.

## Sugerencias y métricas

El formulario es lo **único** que manda texto de la persona a un servidor, y
lo dice. Abre aclarando que **no es una vía para pedir ayuda**, con los
teléfonos de emergencia. La IP no se guarda: se usa hasheada sólo para limitar
a 3 envíos por hora. Se guardan en Redis (`cc:sugerencias`, tope 500).

**Cuántos la usan, sin saber quiénes.** `POST /api/visita` una vez por sesión,
con un número al azar que entra a un HyperLogLog por día (hora argentina):
cuenta distintos sin guardar ninguno. Va aparte de `/api/nivel` porque ése está
cacheado una hora en el CDN y contaría de menos.

**El tablero:** `GET /api/metricas?clave=…` con `METRICAS_CLAVE`. Activos de
hoy, 7 y 30 días (unión, no suma), suscriptos y sugerencias; `&ver=sugerencias`
las lista y `&formato=json` da todo en JSON. Sin clave configurada no responde,
y ante una clave mala da 404, no 401.

**Analítica:** Google Analytics va **sólo en las páginas del sitio**, nunca
en `/app` ni en `/widget`, porque `/legal` y `/para-medios` prometen por
escrito que ahí no hay rastreo. Vercel Web Analytics estuvo también y salió
en octubre de 2026: duplicaba lo que ya mide Google y sumaba dos pedidos de
CDN por página vista (el script y el evento).

## A quién no le llegamos todavía

Para usar Cota Cero hace falta un teléfono con navegador de los últimos seis
años, datos al menos una vez y poder leer. En los barrios que más se inundan
eso deja gente afuera. La hoja para imprimir es lo único hecho; hoy no hay
forma de saber el nivel del río sin un teléfono así.

| Canal                          | A quién alcanza                          | Qué haría falta                                         | Qué rompe                      |
| ------------------------------ | ---------------------------------------- | ------------------------------------------------------- | ------------------------------ |
| Audio en la app («Escuchar»)   | quien no lee bien pero tiene teléfono    | `speechSynthesis`, un día de trabajo                    | nada                           |
| Lectura fácil / pictogramas    | ídem                                     | reescribir los ocho estados y validarlos con quien sepa | nada                           |
| Qom, mocoví, guaraní           | comunidades del Gran Santa Fe            | traductores humanos de esas comunidades                 | nada                           |
| RSS del nivel, y radio barrial | radios, otras webs, quien no tiene datos | que el cron escriba un feed estático                    | nada                           |
| Línea de voz                   | quien no tiene datos o no lee            | un número con IVR leyendo `/api/nivel`                  | nada, si no se guardan números |
| SMS o bot de WhatsApp          | casi todos                               | un proveedor y **guardar números de teléfono**          | **la promesa de privacidad**   |

Orden sugerido: audio → RSS y radio → línea de voz, que no tocan la privacidad
ni cuestan plata. Cualquier canal que guarde un número de teléfono cambia lo
que la app promete en `/legal` y `/para-medios`, y eso se decide antes de
escribir código.

## Pendientes

- **Validar el modelo con la Dirección de Gestión de Riesgos del municipio.**
  Es la limitación más importante, no un pendiente más.
- **Una cota de agua medida** de 1992 o 2016 en cualquier punto río arriba del
  puerto. Con una sola, la pendiente deja de ser un número sin respaldo.
- **Medir los km río arriba de cada zona sobre el cauce.** Salvo Arroyo Leyes
  (24 km, publicado) son estimaciones propias, y a 4,5 cm por km equivocarse
  5 km son 22 cm. La app ya lo aclara en pantalla.
- **El margen de la cota (±0,5 m) no debería ser fijo.** Medido contra 330
  puntos fijos alcanza en 98 de cada 100, pero 21 de las 169 curvas caen fuera
  de la malla de 50 cm, y entre 20,7 y 22,5 m no hay ninguna: el margen
  tendría que salir de la separación local entre las curvas usadas.
- **Las curvas de Rincón y Arroyo Leyes.** Existen en la IDESF (capa
  `MACurvaNivel`, el mismo relevamiento que las de la ciudad) pero no se
  pueden bajar como vector: hay que pedirlas. Con ellas, la costa dejaría de
  depender de puntos sueltos y de su metro de margen.
- **Una marca de nivelación al ras del suelo en Rincón**, para contrastar los
  puntos de la costa. Las del IGN sobre la Ruta 1 son chapas sobre pilares, y
  junto a la PF5N(55) el cálculo queda justo en el borde del margen.
