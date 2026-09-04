# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Todo el proyecto —código, comentarios, documentación e interfaz— está en
español rioplatense. Escribir en español acá también.

`README.md` explica **cómo funciona** cada pieza y por qué se decidió así.
`AUDITORIA.md` gobierna **los números**. Este archivo es lo operativo: qué
comandos correr, qué reglas no se pueden romper y qué cosas están conectadas
entre archivos de una forma que no se ve leyendo uno solo.

## Comandos

    node scripts/servir.js            # http://localhost:3000 (PORT=3100 para otro puerto)
    node scripts/paginas.js           # regenera las páginas de contenido
    node scripts/historia.js          # baja la serie del INA -> datos-abiertos/historia.json
    node scripts/curvas.js            # baja las curvas del municipio -> datos-abiertos/curvas.json
    node scripts/iconos.js            # rasteriza la marca a los PNG (Chrome headless)
    node scripts/guia-pdf.js          # imprime /guia a guia.pdf (Chrome headless)
    node scripts/vapid.js             # claves de push, se corre una sola vez

**No hay `package.json`, ni dependencias, ni build step, ni tests, ni linter.**
Es deliberado. Agregar cualquiera de esas cosas es una decisión de proyecto, no
un detalle de implementación: preguntá antes.

`scripts/servir.js` es el único servidor que sirve: aplica las cabeceras de
`vercel.json` —**la CSP incluida**— y ejecuta las funciones de `/api`. Un
`python -m http.server` no prueba la política.

### Cómo se verifica un cambio

Sin tests, la verificación es esta y en este orden:

1. `node --check <archivo>` en cada `.js` tocado.
2. `node scripts/paginas.js` si tocaste `scripts/paginas.js`, `app/index.html`
   o `lib/fuentes.js`.
3. Levantar el servidor y mirarlo en un navegador de verdad, con la consola
   abierta. Los módulos (`lib/`, `scripts/`) se pueden probar importándolos
   desde Node.

**El ancho de teléfono no se prueba con `--window-size=390`.** Chrome headless
no baja de unos 485 px de viewport. Hay que meter la página en un
`<iframe width="390">`, y como la CSP lleva `frame-ancestors 'none'` eso exige
un `python3 -m http.server` aparte que no aplique cabeceras. Con CDP
(`--remote-debugging-port` + `Emulation.setDeviceMetricsOverride`) también sale.

**`scripts/servir.js` es binario para `grep`.** Usa un byte NUL como centinela
al convertir los patrones de `vercel.json` a regex, así que `file` lo reporta
como `data`. Buscar ahí adentro requiere `grep -a`.

**`cache.addAll()` es todo o nada.** Si el precache nombra un archivo que ya
no existe, la instalación entera falla y la app se queda **sin modo sin
conexión, en silencio**. Pasó al borrar `js/app/sugerencias.js`.
`scripts/paginas.js` lo comprueba en los dos sentidos —que no falte ningún
módulo y que no sobre ninguna ruta muerta— y falla al generar.

**El service worker se registra mirando `document.readyState`, no esperando a
`load`.** Con la app en módulos son más de veinte pedidos y `load` puede haber
pasado antes de que el grafo termine de evaluarse: el listener se enganchaba a
un evento que ya no volvía, y como el registro va con `.catch()` el fallo era
mudo. Ver `js/app/instalar.js`.

**`guia.pdf` es un artefacto, no una fuente.** Sale de imprimir `/guia` con
`node scripts/guia-pdf.js`, así que **cualquier cambio en el generador o en
`css/guia.css` obliga a volver a correrlo** —si no, el papel que la gente
descarga dice una cosa y la página otra. El script falla ruidoso si la hoja
se pasa de **una carilla**: fotocopiar cien de dos carillas es el doble de
plata, y esa hoja se reparte en centros vecinales.

Las dos listas de la guía —mochila y previa— salen de `lib/listas.js`, las
mismas que usa la app. No hay una segunda copia que se pueda desincronizar.

**Subir `VERSION` en `sw.js` en cada deploy**, o todo lo que va por caché
primero (íconos, tipografías) queda congelado.

## Arquitectura

### Dónde vive cada cosa

    js/app/             la app, en módulos ES (principal.js es la entrada)
    js/ css/ img/       lo que baja el navegador
    datos-abiertos/     los JSON que la app lee (y que cualquiera puede auditar)
    app/ widget/        HTML escrito a mano
    lib/ api/ scripts/  Node
    sw.js               en la raíz a propósito: un service worker sólo controla
                        su directorio hacia abajo

Las ocho carpetas de páginas —`datos/`, `historia/`, `legal/`…— están en la
raíz porque **su ruta es su URL**, y por eso no se pueden agrupar. Cada una
arranca con un comentario que avisa que la emite `scripts/paginas.js`. Si
abrís un `index.html` y ves ese cartel, el archivo que hay que editar es otro.

### El nivel del río, y quién depende de su forma

    lib/ina.js  ──►  api/nivel.js  ──►  js/app/rio.js · landing.js · widget · sw.js
       │                                api/cron/avisar.js (importa lib/ina.js directo)
       ├─ 1º: API REST del SIyAH (alerta.ina.gob.ar/a5), JSON estructurado
       └─ 2º: raspado del reporte diario en HTML, sólo si la API falla

Cuatro archivos leen `/api/nivel` y un quinto —el cron— importa `lib/ina.js`
directo: **cambiar la forma de la respuesta toca los cinco**. Los
campos `origen` (`"api"` / `"reporte"`) y `degradado` existen para que una
falla se vea en el JSON en vez de descubrirse meses después.

Los umbrales oficiales (`alerta`, `evacuacion`) **los publica la estación del
INA** y los cinco consumidores los adoptan con un filtro de plausibilidad. Las
constantes 5,3 / 5,7 que quedan escritas son sólo el respaldo para cuando
contesta el reporte diario, que no las trae.

### `lib/` no es `api/`

Cada archivo dentro de `api/` se publica como una función de Vercel, y el plan
Hobby topea en **12**. Hoy hay 8. Todo lo compartido va en `lib/`, que no se
publica.

### Fuentes únicas de verdad

Estas cosas viven en **un solo lugar** y se leen desde los demás. Duplicarlas
es el error que este proyecto ya cometió y corrigió más de una vez:

| Qué                                           | Dónde vive                                         | Quién lo lee                                                                              |
| --------------------------------------------- | -------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| Los 30 puntos de encuentro                    | `app/index.html` (atributos `data-lon`/`data-lat`) | `js/app/estado.js` y `scripts/paginas.js`                                                 |
| Organismos, URLs, la estación del INA         | `lib/fuentes.js`                                   | `lib/ina.js`, `scripts/paginas.js`                                                        |
| El pie del sitio                              | función `pie()` en `scripts/paginas.js`            | las páginas generadas **y** `index.html` (con `frescura: true`)                           |
| Las categorías del formulario                 | `lib/sugerencias.js`                               | `api/sugerencias.js`, `api/metricas.js`, `/contacto` y la app                             |
| Título, descripción, canónica e indexabilidad | `lib/paginas.js`                                   | el `<head>` de las generadas, `sitemap.xml`, y se **verifica** contra la portada y la app |
| Mochila y checklist previo                    | `lib/listas.js`                                    | `js/app/config.js` (re-export) y la guía de `scripts/paginas.js`                           |
| Récord histórico y serie                      | `datos-abiertos/historia.json`                     | `js/app/rio.js`, `js/historia.js`, `scripts/paginas.js`                                   |
| El nivel del río en la portada                | objeto `rio` en `js/landing.js`                    | el mockup del hero, la píldora de la barra, la franja de alerta y la frescura del pie     |
| Los textos de los ocho estados                | README, «Los ocho estados y cómo se dicen»         | `sw.js armarAviso`, `rio.js pintarVeredictoRio`, `cota.js calcular` — copiados a mano: al tocar uno, revisar los tres |

La marca es la excepción consciente: el SVG está escrito a mano en
`scripts/marca.js`, en `scripts/paginas.js` (`marcaSvg()`) y en el HTML de la
portada y la app. Si se cambia el dibujo, se cambia en los cuatro.

`js/app/fuentes.js` **importa `lib/fuentes.js` de verdad** (`/lib/fuentes.js`,
que el navegador carga como cualquier módulo porque es puro dato). Antes era
una copia a mano; ya no hay dos listas que se puedan desincronizar.

### Páginas generadas: no editarlas

`/puntos-de-encuentro`, `/datos`, `/historia`, `/preguntas`, `/legal`,
`/charlas`, `/sobre`, `/contacto` y `/para-medios` los emite
`scripts/paginas.js`. Editar el
HTML resultante se pisa en la próxima corrida. **Se edita el generador.**
Ese script también escribe `datos-abiertos/puntos.json` y reemplaza el pie de
`index.html` entre los marcadores `<!-- PIE:inicio -->` / `<!-- PIE:fin -->`.

Una ruta nueva toca cinco lugares: `scripts/paginas.js`, la lista de escritura
al final del mismo archivo, `vercel.json` (cabecera de revalidación),
`sitemap.xml` y el `PIE`.

**Una ruta que se retira toca los mismos, más dos: un `redirects` en
`vercel.json` hacia la que la reemplaza** —si no, una URL indexada pasa a
devolver 404— **y sacarla de `ESENCIALES` en `sw.js`**, o `cache.addAll()`
falla entero y la app se queda sin modo sin conexión, en silencio.
`scripts/servir.js` aplica esos `redirects` igual que las cabeceras, así que
el 301 se prueba en local. Pasó al fusionar `/mi-cota` dentro de `/datos`.

**`vercel.json` no admite comentarios, ni siquiera con el truco de la clave
`"//"`.** El validador de Vercel rechaza cualquier propiedad de más y el deploy
falla entero con `should NOT have additional property "//"`. El porqué de cada
regla va acá, no en el JSON. Los dos que estaban escritos ahí:

- `/index.html` y `/(.*)/index.html` redirigen a la URL limpia porque cada
  página existía en dos URLs con 200. La canónica las consolidaba, pero era
  rastreo gastado en leer dos veces lo mismo.
- Se escriben con `(.*)` y no con `:ruta` porque `scripts/servir.js` traduce
  grupos, no parámetros con nombre, y así el 308 se prueba en local igual que
  en Vercel.

**La barra es la misma en todas las páginas, con el dato incluido.** La
píldora del nivel y la franja de alerta las pinta `js/rio-barra.js`, que va en
la portada **y** en las nueve generadas. Se separó de `landing.js` por peso:
ése son 30 KB con el mockup y MapLibre, y mandarlos a `/legal` para pintar una
píldora era pagar 30 KB por 7. **`rio-barra.js` va envuelto en una IIFE y expone
un solo nombre, `window.CC`.** No es estilo: los `<script>` clásicos comparten
el ámbito global, y como ese archivo va en TODAS las páginas, un `const` suelto
ahí arriba choca con `contacto.js`, `historia.js` o `medios.js`. Un nombre
repetido —`$` alcanza— hace que el OTRO archivo no se ejecute **entero**, con un
SyntaxError en consola y nada más. Ya pasó: se llevó puestos el formulario de
`/contacto` y toda la página `/historia`, y ninguna de las dos daba señales de
estar rota. Cualquier archivo nuevo que vaya en todas las páginas va envuelto
igual.

**El estado en vivo de la portada tiene un solo dueño.** El mockup del hero, la
píldora de la barra, la franja de alerta y el renglón de frescura del pie se
suscriben al objeto `rio` de `js/landing.js`. Una pieza nueva **se suscribe**,
no hace su propio `fetch`: con un fetch por pieza la portada puede mostrar dos
números distintos al mismo tiempo si uno falla.

Tres cosas de ahí que parecen detalles y no lo son: la franja **nunca** sale
con un dato vencido —una alerta de hace tres días con la cara de una de ahora
es peor que ninguna—; el umbral personal **se lee de IndexedDB**, donde la app
lo espeja, y no se recalcula (`cotaEnHidrometro()` sigue siendo la única que
traduce cota a umbral); y la frescura vence a las **48 h**, el mismo criterio
que `VENCE_HORAS` en la app, porque el INA publica una sola lectura por día
sellada a las 00:00.

### La app son módulos ES

`app/index.html` carga **`/js/app/principal.js` con `type="module"`** y de ahí
cuelga todo lo demás. Consecuencias que conviene tener presentes:

- **No hay globals.** Antes se podía escribir `estado` o `pintarRio()` en la
  consola; ahora no. Para hurgar desde el navegador:
  `const m = await import('/js/app/rio.js')` — devuelve la instancia que la
  página ya cargó, no una copia.
- **Los umbrales y el récord se mueven sólo con `fijarUmbrales()` y
  `fijarRecord()`** (`js/app/oficiales.js`). Un import de ESM es de sólo
  lectura: nadie más puede asignarlos, y el resto los ve actualizados por el
  enlace vivo del import.
- **Un módulo nuevo hay que agregarlo al precache de `sw.js`.** Si no, `/app`
  deja de abrir sin conexión y el fallo es mudo. `scripts/paginas.js` compara
  las dos listas y revienta si no coinciden, así que el olvido se ve en el
  acto.

### SEO: los metadatos salen de `lib/paginas.js`

Título, descripción, canónica, Open Graph, prioridad en el sitemap y **si la
página se indexa** viven ahí. `scripts/paginas.js` los usa para el `<head>` de
las páginas generadas, emite `sitemap.xml` con las indexables, y **verifica**
que la portada, la app y el widget —que son HTML a mano— digan lo mismo. Si no
coinciden, falla al generar.

Agregar una página son cinco lugares: `lib/paginas.js`, `scripts/paginas.js`,
la lista de escritura al final de ese archivo, `vercel.json` y el `PIE`. El
sitemap ya no: sale solo.

**El favicon del buscador va en `/favicon.ico` y mide 96 px.** Google lo pide
cuadrado y múltiplo de 48: con los 32 px que había lo descartaba y mostraba el
que tuviera cacheado. Los emite `node scripts/iconos.js`.

**`/app` va con `noindex, follow`, y `/widget` y la 404 también.** El motivo de
cada una está escrito en `lib/paginas.js`, en `razonNoindex`. La app es una
interfaz, no un documento: las páginas de contenido existen justamente porque
la app esconde tres de sus cuatro secciones detrás de pestañas, y quien llega
desde una búsqueda informativa cae en una herramienta vacía. `follow` a
propósito: se sigue rastreando y sigue pasando autoridad.

**Los datos históricos van en el HTML, no sólo en el JS.** `/historia` los
emite `scripts/paginas.js` desde `datos-abiertos/historia.json`; `js/historia.js`
sólo agrega la franja y el tanque que se recorre. Antes esa página no tenía un
solo número en el marcado y el contenedor salía con `hidden`. **No volver a
mover contenido al JavaScript.**

**Reservar el alto de lo que llega por red.** Las tarjetas de la pantalla del
río que se llenan cuando contesta el servidor tienen `min-height` en
`app.css`. Sin eso el CLS de `/app` era 0,264 (el límite es 0,1): la pantalla
saltaba bajo el dedo de quien estaba leyendo el nivel del río.

### CSP: nada de manejadores inline

`script-src` es `'self'` a secas y **no hay un solo `onclick` en el HTML**.
Toda la interactividad pasa por el delegador de `js/app/principal.js`: se agrega
una entrada en `ACCIONES` (clics, vía `data-accion`) o en `ENTRADAS`
(campos, vía `data-input`). Un `onclick` no va a correr y el fallo es mudo.

`style-src` sí lleva `'unsafe-inline'`, a propósito.

## Reglas que no se rompen

### Tres conceptos, tres nombres

Son tres cosas distintas y nunca se intercambian. En el código y en `/datos`
se llaman **nivel**, **cota** y **umbral**; en la interfaz se dicen en llano, y
cada una tiene UNA sola forma de decirse:

1. **nivel del río** — la lectura del hidrómetro (dato del INA).
   En pantalla: «el río está en 4,86 m», «la regla del río (hidrómetro)».
2. **cota del terreno** — la elevación IGN (curvas del municipio).
   En pantalla: «la altura de tu terreno», «16,4 m sobre el mar». «Cota IGN»
   sólo entre paréntesis, porque así figura en la escritura y en los planos.
3. **umbral hidráulico estimado** — la lectura del hidrómetro a partir de la
   cual la superficie de agua equivalente alcanzaría esa cota.
   En pantalla: **«tu nivel de aviso»**, siempre con `mU()` (≈ y un decimal), y
   con la glosa «el nivel del río a partir del cual el agua puede llegar a tu
   terreno. Es un cálculo aproximado» la primera vez que aparece en cada
   pantalla. La pestaña se llama **Mi casa**.

**Por qué «umbral» salió de la interfaz.** Es la palabra correcta y no tiene
reemplazo técnico: por eso vive en `/datos`, en el código (`cotaEnHidrometro`,
`guardarUmbral`, la clave `umbral` de IndexedDB) y en `AUDITORIA.md`. Pero en
pantalla no la entendía nadie que no la supiera de antes: las cinco
definiciones que había eran circulares —definían *umbral* con *hidrómetro*, que
la app nunca explicaba— y la única frase llana aparecía sólo en el estado de
error.

**Prohibido en la interfaz:** la palabra «umbral»; llamarle «tu cota» o «la
altura de tu casa» al nivel de aviso; «cuándo llega el agua», «te llega», «se
inunda»; «tu alerta» o «tu evacuación», que suenan a oficial. La alerta y la
evacuación de verdad se dicen siempre con **«de la ciudad»** pegado, para que
no se confundan con las de uno.

**Y en los estados graves** —alerta, evacuación, nivel de aviso superado— el
texto **empieza con el verbo de lo que hay que hacer**, no con lo que está
pasando, y lleva el 103. El nivel de aviso NO es una predicción, y la app lo
dice cada vez.

### Los números tienen dueño

`CERO_IGN` (8,20), `PENDIENTE` (0,045) y `ERROR_DEM` (0,5) están **en discusión
técnica abierta**. `AUDITORIA.md` explica de dónde salió cada uno, qué evidencia
hay en contra y por qué no se tocaron. **No cambiarlos sin leer ese archivo.**
Cambiar una constante para que el resultado parezca más seguro es precisamente
lo que el proyecto no hace.

Cuando falta un dato, la app dice que no lo tiene. No se rellena el hueco con
un número que parezca firme, y no se reconstruye nada desde notas de prensa si
existe una fuente oficial.

### Falsa precisión

El umbral **nunca** se muestra con dos decimales: la cota sale de curvas cada
~0,5 m. Un decimal y tilde de aproximación (`mU()` en `js/app/formato.js`, `unDec()`
en `sw.js`). La única excepción es el desglose del cálculo, que conserva la
aritmética exacta y aclara al pie por qué la pantalla muestra otra cosa.

### El mono en mayúsculas etiqueta una cosa

`.eti` —mono, versalitas, `letter-spacing`— es la voz del **instrumento**: la
cara del hidrómetro, el rótulo de un control, el encabezado de una columna de
enlaces, un descargo. Etiqueta algo que existe.

**No es un renglón decorativo arriba de un titular.** La portada tenía cinco
de ésos y era el patrón que más la delataba como plantilla generada: un
segundo título en chiquito y en mayúsculas encima del `<h2>` que ya decía lo
mismo. Un rótulo que se puede borrar sin perder información no era un rótulo.
Los que quedan etiquetan algo; si agregás uno, tiene que poder contestar «¿qué
cosa nombro?».

Por lo mismo se fueron la píldora `● SANTA FE · EMERGENCIA HÍDRICA` del hero
—el punto que late es el gesto de un dato en vivo y ahí no había ningún dato,
y encima tapaba la Ley provincial 14.477, que sí es un dato— y la banda de
cuatro métricas, donde el número más grande contaba nuestras propias solapas.

Los `1 · 2 · 3` de «Cómo funciona» y los años de la franja oscura **se quedan**:
son secuencias de verdad. Numerar algo que está ordenado informa; numerar tres
tarjetas cualesquiera, no.

### Nada de bloques «Seguí por acá»

Las páginas generadas terminaban con un bloque de enlaces a otras páginas.
**Se sacaron y no se vuelven a agregar.** Si una página necesita mandar a otra,
el enlace va donde el texto lo pide, no en una lista de relleno al pie.

### Dos trampas del marcado de la app

**`#plan-impreso` es hijo directo de `<body>`, no del `<main>`.** El
`@media print` esconde `body.app > *:not(#plan-impreso)`: metido adentro del
`<main>` se lo lleva puesto la regla del padre y **imprimir el plan da una hoja
en blanco**, sin ningún error.

**Los comentarios HTML son cortos a propósito.** Viajan al navegador en cada
visita: llegaron a ser 32 KB en todo el sitio. El razonamiento largo va en
`README.md`, en `CLAUDE.md`, o —en las páginas generadas— como comentario de
JavaScript dentro de `scripts/paginas.js`, que no se emite. En el HTML queda
una marca de dos o tres palabras que dice adónde ir a buscarlo.

### Una clase, un componente

`.cita` llegó a nombrar dos cosas distintas —las tarjetas de avisos de la
portada y la cita textual de `/datos`—, con la misma especificidad y mil líneas
de distancia. Ganaba la de más abajo, así que la portada salía en monoespaciada
sobre fondo gris y `/datos` arrastraba un borde ámbar que nadie pidió. **Las dos
estaban rotas y ninguna fallaba de forma visible.** Hoy son `.aviso-app` y
`.cita`. Antes de estrenar un nombre de clase, `grep` en `css/app.css`.

### Dos botones, no tres

`.btn` es el sólido —la acción principal, **una por pantalla**: negro sobre
fondo claro, claro sobre fondo oscuro— y `.btn.sec` es el azul del agua. **No
hay un tercero.** Antes había cuatro rellenos, dos de ellos el mismo
secundario escrito dos veces, y el negro y el azul haciendo de principal cada
uno en su mitad del producto.

Un botón que necesita otro color casi siempre está pidiendo otra cosa: menos
peso (que sea un enlace), o una superficie distinta. Sobre las superficies
invertidas —`.bloque.oscuro`, `.caja-codigo`, `.franja-oscura`, `.cta`— el
sólido ya se invierte solo: esos contenedores redefinen `--btn-fuerte`, no
hace falta una clase. La única excepción es `.btn-emergencia`, el 103: es un
teléfono de emergencia, no una acción de la interfaz.

### Escenario pesimista, en un solo lugar

`cotaEnHidrometro()` es la **única** función que traduce cota a umbral, y por
defecto descuenta `ERROR_DEM`. No recalcular esa cuenta en otro lado: cuando se
hizo, la regla mostraba el escenario optimista y el veredicto el pesimista, con
hasta 3 m de diferencia para lo mismo en la misma pantalla.

### Las listas del plan se guardan por índice

Cada casilla de `MOCHILA` y `PREVIA` (`lib/listas.js`, que `js/app/config.js`
re-exporta) persiste como `cc_mo3`,
`cc_pv5`… **por su posición**. Reordenar un renglón le mueve el tilde a todo el
que ya venía llenando el plan. Se agrega al final; si hay que reordenar, hace
falta una migración como `limpiarGuardadoViejo()`.

Cada renglón lleva un booleano: `true` = está en el Plan de Contingencia
municipal (y la interfaz lo sella), `false` = lo agregamos nosotros. No
atribuirle al municipio recomendaciones que no son suyas.

### Privacidad

**Google Analytics va SÓLO en las páginas del sitio.** No en `/app` y no en
`/widget`, y eso no es un detalle de implementación: `/legal` dice que lo único
que sale del dispositivo son las sugerencias, y `/para-medios` le promete a
cada medio que embebe el widget «sin cookies, sin rastreo de tus lectores».
Meter el tag en cualquiera de los dos vuelve falsas esas dos frases —la segunda
es una promesa sobre lectores que no son nuestros—.

El arranque vive en `js/analitica.js` y no en línea, porque `script-src` es
`'self'`. El cargador de googletagmanager está habilitado en la CSP general de
`vercel.json`; las dos CSP del widget **no se tocaron**.


Lo **único** que sale del dispositivo son las sugerencias, y el formulario lo
dice. El push va **sin contenido**: el servidor no sabe la cota ni el umbral de
nadie, sólo despierta al teléfono y el service worker arma la notificación
comparando contra IndexedDB. De cada persona el servidor guarda un solo dato:
el endpoint opaco del navegador. Cualquier cambio que agregue un envío rompe la
promesa que la app hace por escrito.

### Sin conexión

`/api/` **nunca** se cachea: es preferible fallar y mostrar el último valor
guardado avisando que puede estar viejo, antes que servir el de ayer como si
fuera de hoy. `datos-abiertos/curvas.json` va precacheado porque es el cálculo central.
El HTML, los módulos y `app.css` van por red primero; el resto por caché primero.
