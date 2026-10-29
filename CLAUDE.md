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
    node scripts/comprobar.js         # los casos del cálculo central; sale con error si uno cambia
    node scripts/paginas.js           # regenera las páginas de contenido y public/css/app.css
    node scripts/historia.js          # baja la serie del INA -> public/datos-abiertos/historia.json
    node scripts/curvas.js            # baja las curvas del municipio -> public/datos-abiertos/curvas.json
    node scripts/cotas-costa.js       # baja los puntos con cota de Rincón y Leyes -> public/datos-abiertos/cotas-costa.json
    node scripts/calles.js            # baja el callejero de Georef -> calles.json y calles-rincon.json
    node scripts/iconos.js            # rasteriza la marca a los PNG (Chrome headless)
    node scripts/guia-pdf.js          # imprime /guia a public/guia.pdf (Chrome headless)
    node scripts/charlas.js           # duración y miniatura de cada charla, de ted.com
    node scripts/vapid.js             # claves de push, se corre una sola vez
    node scripts/portada-del-dia.js   # la lectura del día en index.html; lo corre Vercel (a mano: restaurar después)

**No hay `package.json`, ni dependencias, ni build step, ni framework de
tests, ni linter.** Es deliberado. El único paso en el build de Vercel es
`portada-del-dia.js`, que no transforma el sitio: escribe el dato del día en
la portada (ver «SEO», más abajo). Agregar cualquiera de esas cosas es una
decisión de proyecto, no un detalle de implementación: preguntá antes.

Lo que sí hay, desde octubre de 2026 y con el OK del proyecto, es
`scripts/comprobar.js`: una lista de casos con valores ya verificados a mano
—el formato de los números, el gemelo clásico, la cuenta del modelo, de dónde
sale la altura, la consistencia de `ZONAS`— que sale con error si alguno
cambia. Sin framework y sin dependencias: importa los módulos de la app con
un hook que manda las rutas del navegador (`/lib/…`) a `public/`. **Un caso
nuevo se agrega con su valor comprobado en el navegador o contra la fuente**,
no con lo que la función devuelve hoy: si no, el script confirma el error.

`scripts/servir.js` es el único servidor que sirve: aplica las cabeceras de
`vercel.json` —**la CSP incluida**—, sirve el sitio desde `public/` y ejecuta
las funciones de `/api`. Un `python -m http.server` no prueba la política.

### Cómo se verifica un cambio

Sin framework de tests, la verificación es esta y en este orden:

1. `node --check <archivo>` en cada `.js` tocado.
2. `node scripts/comprobar.js` si tocaste algo del cálculo: `config.js`,
   `modelo.js`, `elevacion.js`, `public/lib/comun.js` o los datos de
   `datos-abiertos/`.
3. `node scripts/paginas.js` si tocaste `scripts/paginas.js` o algo de
   `scripts/paginas/`, `public/app/index.html`,
   `public/lib/fuentes.js`, **`public/lib/comun.js` o `estilos/app.css`** —de los
   dos últimos sale un archivo generado, ver abajo—.
4. Levantar el servidor y mirarlo en un navegador de verdad, con la consola
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

**Las miniaturas de `/charlas` se alojan acá, no se enlazan a TED.** Las baja
`node scripts/charlas.js` desde el `og:image` de cada charla y las guarda en
`img/charlas/` — 120 KB las ocho, en JPEG. Enlazar a `pi.tedcdn.com` chocaría
con tres cosas a la vez: la CSP es `img-src 'self'`, `/charlas` está
precacheada, y le mandaría a TED la IP de cada lector, que es justo lo que
`/legal` promete que no pasa. **No se precachean**: son decorativas y duplicar
la tanda crítica por ellas no vale; la rama de caché primero las guarda en
cuanto alguien abre la página.

Van en JPEG y no en WebP ni AVIF: `sips` —que viene con macOS y evita una
dependencia— no escribe WebP, y AVIF deja afuera a los Android viejos.

El mismo script trae la **duración** y **avisa si no coincide** con la escrita
en `lib/charlas.js`. No la escribe solo a propósito: un dato que se escribe
solo es un dato que nadie revisa. La lista vive en `lib/charlas.js` y no dentro
del generador porque la leen los dos scripts.

**`guia.pdf` es un artefacto, no una fuente.** Sale de imprimir `/guia` con
`node scripts/guia-pdf.js`, así que **cualquier cambio en el generador o en
`css/guia.css` obliga a volver a correrlo** —si no, el papel que la gente
descarga dice una cosa y la página otra. El script falla ruidoso si la hoja
se pasa de **una carilla**: fotocopiar cien de dos carillas es el doble de
plata, y esa hoja se reparte en centros vecinales.

Las dos listas de la guía —mochila y previa— salen de `public/lib/listas.js`, las
mismas que usa la app. No hay una segunda copia que se pueda desincronizar.

**`VERSION` en `sw.js` ya no se sube a mano** (octubre de 2026): la escribe
`node scripts/paginas.js` como resumen del contenido de todo lo que se
precachea y del propio `sw.js` (`scripts/version-sw.js`). Cambia sola cuando
cambia cualquiera de ellos. Lo que sí hay que hacer es **regenerar antes de
publicar**: si un ícono, una tipografía o un JSON precacheado cambian sin
regenerar, la versión queda vieja y eso queda congelado en los teléfonos.
`node scripts/comprobar.js` lo avisa.

## Arquitectura

### Dónde vive cada cosa

    public/             EL SITIO: lo único que se publica (outputDirectory)
      index.html          la portada, HTML a mano
      app/ widget/        HTML a mano
      datos/ historia/ …  las páginas que emite scripts/paginas.js
      js/app/             la app, en módulos ES (principal.js es la entrada;
                          config, modelo, zonas y elevacion son puros: no
                          tocan el DOM y se cargan desde Node)
      js/ css/ img/       lo que baja el navegador
      lib/                lo que usan Node Y el navegador: comun, comun-clasico,
                          fuentes, listas
      datos-abiertos/     los JSON que la app lee (y que cualquiera puede auditar)
      mapa/               el estilo del mapa en sus dos temas; lo emite
                          scripts/paginas.js desde lib/estilo-mapa.js
      sw.js               en la raíz del sitio a propósito: un service worker
                          sólo controla su directorio hacia abajo
    api/                las funciones de Vercel (se publican como funciones, no
                        como archivos)
    lib/                lo que corre sólo en Node: ina, push, metricas, paginas,
                        sugerencias, charlas, proveedores, estilo-mapa, y
                        mediciones.json
    scripts/            Node: el generador (paginas.js, que arranca
                        paginas/), comprobar.js y app-en-node.js,
                        version-sw.js, marca.js, el servidor local y las
                        descargas
    estilos/            app.css CON comentarios: la fuente de public/css/app.css
    datos-crudos/       análisis y datos de trabajo; no se publican

**Las rutas de este archivo que nombran algo del sitio —`js/app/rio.js`,
`css/app.css`, `app/index.html`, `datos-abiertos/…`, `sw.js`— están dentro
de `public/`.** Las de `api/`, `lib/` (la de Node), `scripts/` y
`datos-crudos/` están en la raíz. Los cuatro archivos compartidos se nombran
siempre con la ruta entera, `public/lib/…`, porque hay dos `lib/`.

**Vercel publica sólo `public/`** (`"outputDirectory": "public"` en
`vercel.json`) y toma las funciones de `api/` de la raíz. Antes publicaba la
raíz entera: `/AUDITORIA.md`, `/scripts/paginas.js` y `/lib/ina.js`
respondían 200. Las URLs del sitio no cambiaron con la mudanza.
`scripts/servir.js` lee `outputDirectory` del mismo `vercel.json`, así que la
carpeta está escrita en un solo lugar.

**Los cuatro de `public/lib/` están ahí porque los importa el navegador**
(`/lib/comun.js`, `/lib/fuentes.js`, `/lib/listas.js`, `/lib/comun-clasico.js`)
y Node también. Por eso hay dos `lib/` y no una copia: una copia que se
regenere sola es una copia que un día se desincroniza. Lo que sólo corre en
Node no va en `public/`, o se publica.

Las ocho carpetas de páginas —`datos/`, `historia/`, `legal/`…— están en la
raíz del sitio porque **su ruta es su URL**, y por eso no se pueden agrupar.
Cada una arranca con un comentario que avisa que la emite
`scripts/paginas.js`. Si abrís un `index.html` y ves ese cartel, el archivo
que hay que editar es otro.

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

**«Río arriba» y la serie del último mes** (octubre de 2026). `/api/nivel` trae
ahora `serie` —los últimos 30 días, `[«AAAA-MM-DD», metros]`, sólo cuando
contesta la API— y `api/rio-arriba.js` devuelve la última lectura y el cambio
en ~7 días de cuatro escalas del INA aguas arriba (`RIO_ARRIBA` en
`public/lib/fuentes.js`: Corrientes, Goya, La Paz, Paraná). Es **observación,
no pronóstico**: el INA no publica por su API abierta un pronóstico vigente
para Santa Fe (la última corrida guardada de `tabprono_central` es de junio de
2024, comprobado el 26/10/2026), y la tarjeta de `/app` lo dice. Va en un
endpoint aparte para que los cinco consumidores de nivel no paguen cuatro
pedidos más. Una escala que no contesta, o cuyo id de estación ya no coincide,
se omite sin tumbar a las otras.

**`/placa` es la lámina 16:9 para televisión y redes**, y se escribe a mano
como el widget (`public/placa/index.html` + `public/js/placa.js`, script clásico
con `CC_COMUN`). Dibuja un SVG de 1920×1080: se ve tal cual en una fuente de
navegador de OBS o vMix (`?limpio=1`, `?fondo=transparente`, `?tema=claro`) y se
exporta a PNG con la tipografía embebida en base64. Reglas heredadas del
widget: **sin analytics** (`/para-medios` promete «sin rastreo»), **nunca el
nivel de aviso de nadie**, y como una placa viaja sin contexto **la fecha de la
lectura va dentro de la imagen** y con el dato vencido dice «Dato viejo» en vez
de mostrar un número con cara de actual. El récord sale de `historia.json`, no
de un número escrito acá. Su CSP y su revalidación están en `vercel.json`
aparte de la general, igual que el widget.

### `lib/` no es `api/`

Cada archivo dentro de `api/` se publica como una función de Vercel, y el plan
Hobby topea en **12**. Hoy hay 9. Todo lo compartido va en `lib/`, que no se
publica —salvo los cuatro de `public/lib/`, que el navegador necesita—.

### Cuatro mundos que no se importan entre sí

El proyecto corre en cuatro contextos y **ninguno puede importar del otro**:

    módulos ES      js/app/*                  import ✅
    clásicos        landing, rio-barra,       nada
                    historia, widget
    service worker  sw.js                     importScripts
    Node            scripts/, api/, lib/      import ✅

Cada cosa que hacía falta en dos de esos cuatro terminaba copiada, y así los
umbrales oficiales llegaron a estar escritos a mano en **ocho** archivos. Son
un número de seguridad: una copia vieja hace que ese consumidor avise tarde.

**`public/lib/comun.js` es la única fuente** de los umbrales de respaldo, el filtro de
plausibilidad (`umbralesDe`), `VENCE_HORAS`, el formato de los números
(`nm`, `m`, `mU`, `mCm`) y los textos de los estados (`ESTADOS`, `estadoDe`,
`faltaCm`, `textoGrave`, `avisoDe`). Los módulos y Node lo importan. Los otros dos leen
**`public/lib/comun-clasico.js`**, que **lo emite `scripts/paginas.js`** sacándole los
`export` y envolviéndolo en una IIFE que publica un solo nombre, `CC_COMUN`.

Tres cosas de ahí:

- **`public/lib/comun.js` no puede tener `import`.** El gemelo sale de una
  transformación de texto y eso sólo funciona si el archivo no depende de
  nadie. Nada de DOM, nada de fetch, nada de estado.
- **Tocar `public/lib/comun.js` sin correr `node scripts/paginas.js` deja el gemelo
  viejo**, y entonces la app dice un número y el sitio otro. Es el único modo
  de romperlo.
- **`comun-clasico.js` se carga ANTES que `rio-barra.js`** en las once páginas
  y antes que `widget.js`. Van con `defer`, que conserva el orden.

`sw.js` lo trae con `importScripts`. Registrarlo como módulo habría sido más
prolijo y dejaba afuera justo a los Android viejos que este proyecto sostiene
a mano; `importScripts` funciona en un worker clásico y el navegador guarda lo
importado junto al service worker, así que sigue andando sin señal.

### La hoja de estilo se escribe en `estilos/`, no en `public/css/`

**`public/css/app.css` lo emite `scripts/paginas.js`** desde `estilos/app.css`,
sacándole los comentarios y nada más (no minifica). El razonamiento era un
tercio del archivo y, como es prosa, se comprime mal: 43 KB con gzip contra 18
sin él, en la hoja que bloquea el renderizado de todas las páginas. Editar
`public/css/app.css` se pisa en la próxima corrida, y tocar `estilos/app.css`
sin correr el generador no cambia nada en el sitio. `guia.css` sigue a mano en
`public/css/`: son 8 KB y sólo los pide `/guia`.

**Las tipografías son variables: un archivo por familia**
(`vendor/fonts/jakarta.woff2` y `jetbrains.woff2`), con un rango en
`font-weight`. Antes había seis `@font-face`, uno por peso, apuntando a seis
copias del mismo par de archivos con nombres distintos, y el navegador bajaba
cada copia: 175 KB donde alcanzan 59. Si se cambia una tipografía, se mira
primero si el archivo es variable. Si lo es, alcanza con uno.

### Fuentes únicas de verdad

Estas cosas viven en **un solo lugar** y se leen desde los demás. Duplicarlas
es el error que este proyecto ya cometió y corrigió más de una vez:

| Qué                                                                                       | Dónde vive                                                                          | Quién lo lee                                                                                                                                                           |
| ----------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Los 30 puntos de encuentro                                                                | `app/index.html` (atributos `data-lon`/`data-lat`)                                  | `js/app/estado.js` y `scripts/paginas.js`                                                                                                                              |
| Organismos, URLs, la estación del INA                                                     | `public/lib/fuentes.js`                                                             | `lib/ina.js`, `scripts/paginas.js`                                                                                                                                     |
| El pie del sitio                                                                          | función `pie()` en `scripts/paginas/base.js`                                        | las páginas generadas **y** `index.html` (con `frescura: true`)                                                                                                        |
| Las categorías del formulario                                                             | `lib/sugerencias.js`                                                                | `api/sugerencias.js`, `api/metricas.js`, `/contacto` y la app                                                                                                          |
| Título, descripción, canónica e indexabilidad                                             | `lib/paginas.js`                                                                    | el `<head>` de las generadas, `sitemap.xml`, y se **verifica** contra la portada y la app                                                                              |
| Umbrales de respaldo (5,30 / 5,70)                                                        | `public/lib/comun.js`                                                               | `public/lib/fuentes.js`, `oficiales.js`, `rio-barra.js`, `landing.js`, `widget.js`, `sw.js`, el cron                                                                   |
| El filtro de plausibilidad de umbrales                                                    | `public/lib/comun.js` (`umbralesDe`)                                                | `rio.js`, `rio-barra.js`, `widget.js`, `sw.js`                                                                                                                         |
| Cómo se escribe un número (la coma, `mU`)                                                 | `public/lib/comun.js`                                                               | `js/app/formato.js` (re-export), los clásicos y `sw.js` por el gemelo                                                                                                  |
| Cuándo vence un dato (48 h)                                                               | `public/lib/comun.js` (`VENCE_HORAS`)                                               | `js/app/config.js` (re-export), `rio-barra.js`, `widget.js`                                                                                                            |
| Mochila y checklist previo                                                                | `public/lib/listas.js`                                                              | `js/app/config.js` (re-export) y la guía de `scripts/paginas/guia.js`                                                                                                  |
| Las fuentes de altura, su margen y cómo se dicen                                          | `FUENTES_ALTURA` en `js/app/elevacion.js`                                           | `elevacionDe()`, `margenDe()` en `modelo.js`, el desglose y el sello de `cota.js`; `scripts/comprobar.js` verifica que cada una traiga margen, sello, archivo y textos |
| Las localidades vecinas y la frase de cobertura                                           | `VECINAS` y `COBERTURA` en `js/app/zonas.js` (de `ZONAS[].localidad`)               | la búsqueda de `mapa.js` (Georef y Nominatim) y los mensajes de «no tenemos la altura de ese punto»                                                                    |
| Defensa y niveles observados por zona                                                     | `ZONAS` en `js/app/zonas.js`                                                        | `js/app/cota.js` (tarjeta de «Mi casa») y `js/app/plan.js` (plan impreso); la fuente de cada renglón está en `AUDITORIA.md` §9                                         |
| La medición del error de las curvas (330 puntos, mediana, p90, cuántos alcanza el margen) | `lib/mediciones.json`, que escribe `datos-crudos/analisis-puntos-fijos-<fecha>.mjs` | `scripts/paginas.js` para `/datos` y `/preguntas`; repetir la medición y regenerar actualiza el sitio                                                                  |
| Cargar la app desde Node (rutas del navegador y `fetch` de archivos del sitio)            | `scripts/app-en-node.js`                                                            | `scripts/comprobar.js` y los análisis de `datos-crudos/`, que importan el código de producción en vez de copiarlo                                                      |
| Los servicios de otro origen (host, uso, CSP)                                             | `lib/proveedores.js`                                                                | `scripts/paginas/emitir.js`, que verifica la CSP de `vercel.json`, que `/legal` los nombre y que el código no use otros                                                |
| Los colores y las capas del mapa                                                          | `lib/estilo-mapa.js` (colores de `estilos/app.css`)                                 | `public/mapa/claro.json` y `oscuro.json`, que emite `emitir.js` y leen `js/app/mapa.js` y `js/landing.js`                                                              |
| La versión del service worker                                                             | se calcula: `scripts/version-sw.js`                                                 | `emitir.js` la escribe en `sw.js`; `comprobar.js` avisa si quedó vieja                                                                                                 |
| Récord histórico y serie                                                                  | `datos-abiertos/historia.json`                                                      | `js/app/rio.js`, `js/historia.js`, `scripts/paginas.js`                                                                                                                |
| El nivel del río en la portada                                                            | objeto `rio` en `js/landing.js`                                                     | el mockup del hero, la píldora de la barra, la franja de alerta y la frescura del pie                                                                                  |
| Los textos de los ocho estados                                                            | `public/lib/comun.js` (`ESTADOS`, `estadoDe`, `textoGrave`, `avisoDe`)              | `sw.js` (por el gemelo), `rio.js`, `cota.js`, `ahora.js`, `compartir.js`; `scripts/comprobar.js` verifica el verbo, el 103 y los 180 caracteres                        |

**La marca vive en `scripts/marca.js`.** De ahí la arman los íconos PNG
(`iconos.js`) y las páginas generadas (`marcaSvg()` en `base.js`). El HTML a
mano —dos en la portada, dos en la app, una en el widget— lleva sus copias con
su tamaño y su color, y `node scripts/paginas.js` **compara la geometría de las
29** contra `marca.js` y falla si alguna difiere o si un `id` de clipPath se
repite en una página. Si se cambia el dibujo: se cambia en `marca.js`, se
regenera, y el generador dice qué copias a mano quedaron viejas.

`js/app/fuentes.js` **importa `public/lib/fuentes.js` de verdad** (`/lib/fuentes.js`,
que el navegador carga como cualquier módulo porque es puro dato). Antes era
una copia a mano; ya no hay dos listas que se puedan desincronizar.

### Páginas generadas: no editarlas

`/puntos-de-encuentro`, `/datos`, `/historia`, `/preguntas`, `/legal`,
`/charlas`, `/sobre`, `/contacto`, `/para-medios` y `/hidrometro` los emite
`scripts/paginas.js`. Editar el
HTML resultante se pisa en la próxima corrida. **Se edita el generador.**
Ese script también escribe `datos-abiertos/puntos.json` y reemplaza el pie de
`index.html` entre los marcadores `<!-- PIE:inicio -->` / `<!-- PIE:fin -->`.

**El generador está partido en `scripts/paginas/`** (octubre de 2026; eran
2.776 líneas en un archivo): `base.js` tiene lo que comparten todas —rutas,
datos que se leen una vez, `pagina()`, `bloque()`, `pie()`, `marcaSvg()`—,
hay un archivo por página (`datos.js`, `legal.js`, `guia.js`…) y `emitir.js`
escribe todo y al final verifica la portada, la app y el precache.
`scripts/paginas.js` sólo lo arranca. Las páginas importan de `base.js` y
nunca entre sí ni de `emitir.js`: así no hay ciclos. La partición se verificó
con el sitio generado idéntico, byte por byte.

Una ruta nueva es **su archivo en `scripts/paginas/` y su renglón en
`lib/paginas.js`**: `emitir.js` carga sola cada página de la carpeta, cada una
se anota al llamar a `pagina()` y se escribe en la ruta del registro; el
sitemap y el precache verificado salen solos. Quedan dos cosas a mano que el
generador **comprueba y falla si faltan**: el enlace en `pie()` de `base.js`
y la cabecera de revalidación en `vercel.json`. Y una tercera que no puede
comprobar: agregarla a `ESENCIALES` en `sw.js` si tiene que andar sin señal
—esa sí avisa, porque verifica que todas las generadas estén—.

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
la portada **y** en las diez generadas. Se separó de `landing.js` por peso:
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
- **Un módulo nuevo entra solo al precache de `sw.js`.** `node
scripts/paginas.js` reescribe la lista entre los marcadores `MODULOS:inicio`
  y `MODULOS:fin`, uno por archivo de `js/app/`. Antes se agregaba a mano, y
  un olvido dejaba a `/app` sin modo sin conexión en silencio. Lo que sigue
  siendo a mano es correr el generador.
- **El mismo generador escribe la precarga** (`<link rel="modulepreload">`)
  entre los marcadores `PRECARGA` del `<head>` de `app/index.html`, siguiendo
  los import desde `principal.js`. Sin ella el grafo bajaba en cascada, cuatro
  niveles, y `/api/nivel` salía recién a los 5,7 s con Slow 4G. Falla si faltan
  los marcadores o si un import apunta a un archivo que no existe.

### SEO: los metadatos salen de `lib/paginas.js`

Título, descripción, canónica, Open Graph, prioridad en el sitemap y **si la
página se indexa** viven ahí. `scripts/paginas.js` los usa para el `<head>` de
las páginas generadas, emite `sitemap.xml` con las indexables, y **verifica**
que la portada, la app y el widget —que son HTML a mano— digan lo mismo. Si no
coinciden, falla al generar.

Agregar una página: ver «Páginas generadas: no editarlas», más arriba.

**La portada trae el nivel del día en el HTML, pero no en el repo** (octubre
de 2026). En «altura del río en santa fe hoy» Prefectura, la UNL y El Litoral
ponen el número en el resultado y la portada no ponía ninguno: posición 6–9 y
0 clics. Vercel corre `scripts/portada-del-dia.js` como `buildCommand`: escribe
la meta description de `descripcionDelDia()` (`lib/paginas.js`) y el número del
mockup con su fecha, que `landing.js` pisa al llegar el dato en vivo. Un deploy
hook lo dispara a las 6:20 y 12:20 (`.github/workflows/portada-del-dia.yml`,
secreto `VERCEL_DEPLOY_HOOK`). No es una función a propósito: una caída tiraba
la portada; así, si el INA no contesta o el dato pasa de `VENCE_HORAS`, el
build sigue y la portada sale sin número, como siempre. Si cambia el marcado
del hero o la descripción, el script falla en el build en vez de escribir en
cualquier lado. Corrido a mano deja `index.html` modificado, y
`node scripts/paginas.js` falla hasta que se restaura: es la guarda contra
commitear el número de un día.

**Para agentes hay tres cosas, y las tres nombran sólo lo que existe.**
`llms.txt` (ya estaba), `/.well-known/api-catalog` —un linkset RFC 9727 que
emite `scripts/paginas.js`— y cabeceras `Link` en `vercel.json`. El catálogo
lista `/api/nivel` y los cuatro JSON abiertos —historia, puntos, curvas y
cotas de la costa—, nada más: el resto de `api/` son
POST de la app y publicarlos sería invitar a que alguien los llame sin motivo.
No hay `service-desc` porque eso pide un OpenAPI, y un OpenAPI sería una **sexta
copia** de la forma de la respuesta de `/api/nivel`.

**Y una cuarta: cada página indexable tiene su versión en Markdown** (octubre
de 2026, como el «View as AI agent» del pie de vercel.com). Está en la misma
URL con `.md` —`/datos.md`; la portada, `/index.html.md`, como propone
llms.txt—, la anuncia un `<link rel="alternate" type="text/markdown">` y el
pie la abre con «Ver como agente de IA». **No se escribe**: la emite
`emitir.js` convirtiendo el HTML recién generado con `scripts/markdown.js`
(no va en `scripts/paginas/`, que carga como página cada `.js`). Cada una
arranca avisando que no somos oficiales y que **el nivel de hoy no está ahí**
—es una copia estática—, sino en `/api/nivel`. Lo que pinta el JavaScript
(el mockup del hero, la vista previa del widget, los `role="status"`) se
saltea a propósito: quedaba como «— m». Si una página nueva sale rara en
Markdown, se arregla con una regla general en el conversor, no con un caso
por página. `vercel.json` las sirve como `text/markdown; charset=utf-8` y con
`noindex` —el HTML es el canónico—, y `sw.js` las manda siempre a la red,
igual que `llms.txt`. No hay negociación por `Accept: text/markdown` (que
`/datos` responda Markdown según quién pide): no está comprobado que un
`rewrite` con `has` gane sobre un archivo estático en Vercel, `servir.js` no
lo traduce, y suma un `Vary: Accept` a todo el HTML.

Lo que **no** se publica, y no por olvido: `openid-configuration`,
`oauth-protected-resource`, `auth.md`, un MCP Server Card y un índice de skills.
Acá no hay autenticación, ni servidor MCP, ni skills. Publicar esos documentos
sería declarar capacidades falsas, que para un sitio de emergencia es peor que
no aparecer en un chequeo automático.

**El `Content-Type` de `/.well-known/api-catalog` se fija en `vercel.json`,** no
por extensión: el archivo no tiene, así que la tabla MIME lo daría por
`application/octet-stream` y con `nosniff` nadie lo leería como JSON.
`scripts/servir.js` respeta el `Content-Type` configurado por encima de su
tabla, para que el local se parezca a producción.

**El favicon del buscador va en `/favicon.ico` y mide 96 px.** Google lo pide
cuadrado y múltiplo de 48: con los 32 px que había lo descartaba y mostraba el
que tuviera cacheado. Los emite `node scripts/iconos.js`.

**Y el atributo `sizes` tiene que decir 96, no 32.** Cuando el archivo pasó de
32 a 96 px, el `<link rel="icon" href="/favicon.ico" sizes="32x32">` quedó igual
en las trece páginas: el archivo estaba bien y el marcado seguía anunciando el
tamaño por el que Google lo descartaba. Si volvés a cambiar el tamaño del
`.ico`, ese atributo se cambia en `index.html`, `app/index.html` y
`scripts/paginas/base.js` (`pagina()`) — las páginas generadas salen del
último.

**El `.ico` se sirve como `image/x-icon`, fijado en `vercel.json`.** Por
extensión Vercel lo daría como `image/vnd.microsoft.icon`, que es el tipo
registrado en IANA pero el que menos herramientas manejan; con `nosniff`, una
que sólo acepte `image/x-icon` no lo lee. `x-icon` es el de facto y lo entienden
todas.

**`/app` va con `noindex, follow`, y `/widget` y la 404 también.** El motivo de
cada una está escrito en `lib/paginas.js`, en `razonNoindex`. La app es una
interfaz, no un documento: las páginas de contenido existen justamente porque
la app esconde tres de sus cuatro secciones detrás de pestañas, y quien llega
desde una búsqueda informativa cae en una herramienta vacía. `follow` a
propósito: se sigue rastreando y sigue pasando autoridad.

**Los datos históricos van en el HTML, no sólo en el JS.** `/historia` los
emite `scripts/paginas.js` desde `datos-abiertos/historia.json`; `js/historia.js`
sólo agrega la franja que se recorre. Antes esa página no tenía un
solo número en el marcado y el contenedor salía con `hidden`. **No volver a
mover contenido al JavaScript.**

**Reservar el alto de lo que llega por red.** Las tarjetas de la pantalla del
río que se llenan cuando contesta el servidor tienen `min-height` en
`estilos/app.css`. Sin eso el CLS de `/app` era 0,264 (el límite es 0,1): la pantalla
saltaba bajo el dedo de quien estaba leyendo el nivel del río.

**La pestaña Río muestra lo de hoy; el resto espera plegado** (octubre de 2026).
Eran 479 palabras y más de cuatro pantallas, y un ingeniero que la probó la
llamó «abrumadora». Debajo del nivel, la regla y «Cargar el nivel a mano» va
«Más sobre el río» (`#mas-rio`), con lluvia, tendencia, río arriba, contexto y
compartir. Un bloque sube a `#rio-destacado` cuando tiene algo que decir: la
lluvia con 40 mm o más en un día, la tendencia y río arriba con el río a 1 m o
menos de la alerta de la ciudad o de tu nivel de aviso. Los criterios están en
`js/app/destacar.js`, puros y probados en `comprobar.js`. Un bloque nuevo en
esa pestaña va en `BLOQUES` de ese archivo, envuelto en su `.bloque-rio`, y
decide si sube o queda siempre plegado. **Plegado no es borrado**: no se sacó
ningún texto.

### CSP: nada de manejadores inline

`script-src` es `'self'` a secas y **no hay un solo `onclick` en el HTML**.
Toda la interactividad pasa por el delegador de `js/app/principal.js`: se agrega
una entrada en `ACCIONES` (clics, vía `data-accion`) o en `ENTRADAS`
(campos, vía `data-input`). Un `onclick` no va a correr y el fallo es mudo.

`style-src` sí lleva `'unsafe-inline'`, a propósito.

### Los proveedores de otro origen están en `lib/proveedores.js`

Cada servicio al que el navegador le pide algo —Georef, Nominatim,
OpenFreeMap, el IGN, los dos de Open-Meteo, Google Analytics— está ahí con su host,
para qué se usa y qué directivas de la CSP necesita. `node scripts/paginas.js`
**falla** si uno falta en la CSP de `vercel.json`, si `/legal` no lo nombra, o
si en `public/js` aparece un host que no está ni ahí ni en `ENLACES` (los que
sólo se abren como enlace). Así salió que `/legal` nunca había nombrado a
Open-Meteo. La CSP no se genera —`vercel.json` no admite comentarios y
conviene leerlo entero—: se comprueba.

### La búsqueda de dirección son dos proveedores

`js/app/mapa.js` consulta primero a Georef (`apis.datos.gob.ar`) y detrás a
Nominatim (`nominatim.openstreetmap.org`), los dos sin clave. Cada host está
en el `connect-src` de `vercel.json` —si falta, el navegador bloquea el pedido
y la app dice «no se encontró» como si fuera culpa de la dirección—, en el
párrafo de `/legal` que dice adónde va lo que escribís y en `LICENCIAS` de
`scripts/paginas/legal.js`. Nominatim se filtra por municipio con `addressdetails`
porque el `viewbox` deja adentro Santo Tomé, Rincón y Candioti, que tienen
las mismas calles con las mismas alturas; sacar ese filtro vuelve a mandar
«Rivadavia 2800» a Santo Tomé. Además de la ciudad se aceptan las `VECINAS`
de `zonas.js` —Rincón y Arroyo Leyes, que la app calcula con los puntos de la
costa—: con una de ellas elegida, la búsqueda va primero a esa localidad (en
Georef, a su `localidad.georef`) y después a la ciudad, y si la dirección cae
en otra zona que la elegida, la app lo dice y ofrece cambiarla. Santo Tomé y
Candioti siguen afuera.

**La localidad escrita manda sobre la zona elegida, y las esquinas se
buscan.** «Dorrego 2414, San José del Rincón» busca en Rincón aunque la zona
sea la ciudad (`localidadEscrita()` en `mapa.js`, con `localidad.en` de
`zonas.js`): antes le pasaba «san jose del rincon» a Georef como parte de la
calle. La localidad cuenta sólo al principio o al final —«Combate de Rincón
100» es una calle—. «Mitre y Salta» va a Georef, que sí resuelve esquinas
(Nominatim no, y por eso no se le pregunta). Georef es difuso con los nombres
(«Dorrego y Constituyentes» devolvió «Cmte Orrego»): lo encontrado se
muestra entero. Cuando no aparece, `noEncontrada()` ofrece buscar en las
vecinas y el mapa, que arranca sobre la localidad elegida (`centro`). Arroyo
Leyes es distinto: Georef y OpenStreetMap lo tienen como «Calle 1»…«Calle 98»
—así lo rotula también el mapa de la app—, no con los nombres que usa el barrio
(«Curupíes»), que ningún callejero abierto tiene. `calles-leyes.json` sugiere
esas calles numeradas; escribir otro nombre da un mensaje que explica la
numeración y manda al mapa.

**Pero los nombres sí existen, y están publicados.** La Ordenanza 47/2021 de la
Comuna (18/11/2021) renombró toda la localidad —árboles para las calles
perpendiculares a la Ruta 1, aves para las paralelas, próceres en el casco— y
numeró las casas; los números de antes siguen siendo los de Georef,
OpenStreetMap y el mapa. De sus Anexos I y II sale
`calles-leyes-alias.json`: para cada nombre nuevo, los números anteriores y el
rango de numeración de casas de cada uno (`datos-crudos/arroyo-leyes-alias-2026-10-26.mjs`
lo arma desde los textos del PDF, que están en
`datos-crudos/arroyo-leyes-ordenanza-47-2021/`). `js/app/alias.js` —puro, lo
prueba `comprobar.js`— traduce «Curupíes 3006» a «Calle 18» eligiendo el tramo
por la altura, y la búsqueda abre el mapa sobre esa calle. Los nombres también
entran en las sugerencias («Los Curupíes · antes Calle 18, 16 y 26»). **Un
número anterior puede repetirse en tramos sin conexión** (la 75 son cuatro
calles distintas): la tabla va del nombre nuevo al viejo, nunca al revés. Y no
ubica ninguna casa: la ordenanza dice que la numeración crece hacia el oeste y el
norte desde un cero, pero ningún dato abierto dice dónde cae cada altura. Si la búsqueda encuentra la calle numerada
(`!r.exacta`), no se intenta la altura —el punto que da OpenStreetMap puede
quedar a más de 150 m del punto de altura más cercano— sino que se abre la
hoja de «Marcarla en el mapa» ya centrada en esa calle
(`marcarCasaEnMapa({ centro, calle })`).

**Las sugerencias del buscador no consultan a nadie.** `js/app/calles.js`
filtra en el teléfono contra `datos-abiertos/calles.json` —o
`calles-rincon.json` si la zona elegida es Rincón—, el callejero de Georef que
baja `node scripts/calles.js`. Pedirle sugerencias a una API por
cada tecla mandaría la dirección de la persona antes de que apriete Buscar,
y eso vuelve falsa la frase de `/legal`; además la política de Nominatim
prohíbe autocompletar contra su API. El archivo no se precachea: buscar una
dirección necesita señal de todos modos. Se regenera a mano, como las curvas,
cuando Georef suma calles.

**El mapa son dos hosts, y cambiarlos toca los mismos lugares.** El fondo
son tiles vectoriales de OpenFreeMap (`tiles.openfreemap.org`, esquema
OpenMapTiles; desde octubre de 2026, antes el argenmap del IGN) y la foto
aérea de «Marcar mi casa» es del IGN (`imagenes.ign.gob.ar`, vuelos de 2013 y
2014). Van en `connect-src` —MapLibre baja todo con `fetch`, así que además
exigen CORS; la foto, que es raster, también en `img-src`—, en la fila «Ver el
mapa» de `/legal` y en `LICENCIAS`. Un proveedor con clave o cuota no entra:
se evaluaron Esri, Mapbox, Stadia y MapTiler, y todos cortan o cobran justo en
el pico de una crecida. OpenFreeMap no pide clave ni pone cuota, pero lo
sostiene una sola persona con donaciones: si un día se cae, el mapa lo dice y
la lista de puntos sigue andando.

**El estilo del mapa se escribe en `lib/estilo-mapa.js`, no en
`public/mapa/`.** `node scripts/paginas.js` emite `public/mapa/claro.json` y
`oscuro.json` con los colores de `estilos/app.css` —un cambio de paleta llega
al mapa al regenerar— y los leen la app y la portada, que no pueden importar
lo mismo pero sí pedir el mismo JSON. Van precacheados: sin el estilo MapLibre
no dibuja nada sin señal, ni el fondo liso. Las capas se agrupan por prefijo:
`base-` es el plano y `foto-` la foto con los nombres de las calles encima;
`fondoDeMarcar()` en `mapa.js` prende un grupo y apaga el otro, y un cambio de
tema (`seguirAlTema()`) cambia el estilo sin perder el modo. El generador
verifica que cada host que nombra el estilo esté en `lib/proveedores.js`.

En la interfaz, el de la casa es **«número»**, nunca «altura»: «altura» es la
del terreno sobre el mar, y las dos aparecen en la misma tarjeta.

## Reglas que no se rompen

### Tres conceptos, tres nombres

Son tres cosas distintas y nunca se intercambian. En el código y en `/datos`
se llaman **nivel**, **cota** y **umbral**; en la interfaz se dicen en llano, y
cada una tiene UNA sola forma de decirse:

1. **nivel del río** — la lectura del hidrómetro (dato del INA).
   En pantalla: «el río está en 4,86 m», «la regla del río (hidrómetro)».
2. **cota del terreno** — la elevación IGN (curvas del municipio; en Rincón
   y Arroyo Leyes, puntos con cota de la Provincia).
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
definiciones que había eran circulares —definían _umbral_ con _hidrómetro_, que
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

`CERO_IGN` (8,4214), `PENDIENTE` (0,045), `ERROR_DEM` (0,5) y `ERROR_PUNTOS` (1,0)
están **en discusión técnica abierta**. `AUDITORIA.md` explica de dónde salió cada uno, qué evidencia
hay en contra y por qué no se tocaron. **No cambiarlos sin leer ese archivo.**
Cambiar una constante para que el resultado parezca más seguro es precisamente
lo que el proyecto no hace.

Cuando falta un dato, la app dice que no lo tiene. No se rellena el hueco con
un número que parezca firme, y no se reconstruye nada desde notas de prensa si
existe una fuente oficial.

Los `observado` de `ZONAS` son la excepción acotada: niveles del hidrómetro a
los que **pasó algo** en una zona —se cortó un camino, filtró un terraplén, se
evacuó—, con fuente y fecha, porque no existe una tabla oficial por barrio y la
app lo dice en pantalla. Son hechos, no umbrales: van al lado del cálculo y
nunca en su lugar. Un renglón sin fuente rastreable en `AUDITORIA.md` §9 no
entra, y **la cota de coronamiento de una defensa no se usa como umbral**: el
agua entra por abajo mucho antes de pasar por arriba.

### Falsa precisión

El umbral **nunca** se muestra con dos decimales: la cota sale de curvas cada
~0,5 m. Un decimal y tilde de aproximación (`mU()` en `public/lib/comun.js`, que
usan la app, el sitio y `sw.js`). La única excepción es el desglose del cálculo, que conserva la
aritmética exacta y aclara al pie por qué la pantalla muestra otra cosa.

**Por encima del récord, sin número** (octubre de 2026). Un nivel de aviso más
alto que la crecida más grande medida —Mitre y Chacabuco daba «≈ 10,4 m»— es
aritmética correcta y un dato inútil: mucho antes de que el río llegue ahí la
ciudad entera estaría en emergencia. `sobreRecord()` en `public/lib/comun.js`
decide, y el veredicto, las fichas y la regla de Río, los avisos, el plan y la
imagen para compartir dicen «más alto que el récord» y mandan a la alerta de
la ciudad. Con el río a 50 cm o menos el número vuelve, y el desglose lo
conserva siempre. Un lugar nuevo que muestre el nivel de aviso pasa por ahí.

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

### Mi casa, la primera vez: dirección → zona → resultado

El flujo arranca por **dónde está tu casa** y no por la zona (octubre de
2026): la zona era la parte que más costaba y la dirección ya la dice. Con
una dirección de Rincón o Arroyo Leyes, `mapa.js` toma la zona de ahí
(`elegirZona(r.vecina)`, sólo si no había ninguna elegida) y el paso de zona
se salta; con una de la ciudad hay que elegir entre sus ocho zonas, que
dependen de los km río arriba y **no se deducen de la calle**. Las zonas van
agrupadas («En la ciudad», «Fuera de la ciudad»; el grupo sale de `localidad`
y `sinPlano` en `zonas.js`). «Seguir» aparece cuando ya hay altura y es el
único sólido de la pantalla; «Buscar mi casa» pasa a `.sec` (`pintarPrimera`
en `cota.js`). `#paso-zona` y `#paso-altura` conservan sus ids y el formulario
de «Cambiar» no se tocó.

**Dirección y zona que no coinciden: el veredicto es provisorio.** Si la
dirección cae en otro lado que la zona elegida —Risso 1745 con Rincón elegida,
o al revés— `estado.zonaAjena` guarda dónde cayó (`«ciudad»` o el id de una
vecina; `fijarZonaAjena()` en `estado.js`, que lo persiste en `cc_zona_ajena`
para que no desaparezca al recargar). Mientras haya algo ahí, `calcular()` pone
un aviso arriba del veredicto, lo muestra sin su color de estado (`grayscale`,
no opacidad: bajarle la opacidad lo dejaba en 3,7:1) y la tarjeta de la casa
dice «Zona sin confirmar» y no los km. Con una vecina el botón pasa a ella; con
la ciudad **no puede haber un «pasar a»** —son ocho zonas— y el botón vacía la
zona y lleva a elegirla (`elegirZonaDeLaCiudad()`). Se limpia al elegir zona o
al cargar otra altura. Mientras esté provisorio, además: la tarjeta de defensa se
reemplaza por «Se muestra cuando elijas tu zona» (era el terraplén de Rincón
sobre una dirección de Guadalupe) y **«Avisarme» no se puede activar**: la
tarjeta dice «Elegí tu zona para activar el aviso» (`pintarAvisos` en
`avisos.js`; quien ya los tenía puede seguir desactivándolos).

**Una búsqueda que falla no deja un número ajeno a la vista:** si ya había
una casa cargada, el error dice que el nivel de aviso de más abajo sigue
siendo el de ésa (`deLaCasaAnterior()`), y la pista del campo vuelve a la
inicial (`restaurarPista()`, que lee `data-inicial`) para que no queden dos
mensajes sobre la misma dirección.

### Objetivos táctiles, contraste y la barra de instalar

**Mínimo 44 px, y cómo se llega.** Los enlaces dentro de una frase —el «103» de
un renglón— no se pueden agrandar sin romper el renglón: se extiende la zona de
toque con un `::after` invisible (`.app :where(p, li, …) a`, al final de
`estilos/app.css`). Los que van en lista crecen de verdad (`.pasos.grave li a`):
dos zonas de toque superpuestas harían marcar el 911 al querer el 103. Los
botones del mapa miden 44 en `#mapa .maplibregl-ctrl-group button`. El
`::after` es de `-1.1rem -1rem`: con `-0.75rem -0.5rem` un renglón de 16,5 px
llegaba a 40 y el «911» a 42, y lo dijo el barrido de objetivos, no el ojo. Un
enlace en un contenedor nuevo (`.nota`, `.sello-fuente`…) hay que sumarlo al
selector. `html` lleva `scroll-padding-bottom` del alto de la barra: sin eso
`aLaVista()` dejaba un error 89 px detrás de ella.

**En el sitio el `::after` va sólo en párrafos y avisos del `<main>`**
(`.landing main :where(p, .aviso) a:not([class])`, octubre de 2026): estaba
sólo en `.app`, y el «103» de una frase de la portada medía 22×17. No va en
listas ni en el pie, donde los enlaces van uno debajo del otro y las zonas se
pisarían. Los pines de los mapas tienen el suyo (`.pin::after`), sin
`position`: MapLibre ya les pone `absolute` y pisarlo los desarma. La «X» del
popup mide 44.

**A menos de 560 px la barra del sitio va en dos renglones fijos:** marca y
menú arriba, la píldora abajo (un `::after` con `flex-basis: 100%` hace de
salto). Sin el corte, a 390 px caía el menú solo al segundo renglón —marca,
píldora y menú suman 363 de 350—, y con la alerta la píldora es más ancha.

**El resultado de Mi casa va en este orden:** veredicto —con «Al río le faltan
unos X», el dato que antes vivía sólo en la pestaña Río; no se dice con el dato
vencido—, la tarjeta de la casa, **«Armar mi plan»** (que estaba 2.000 px abajo), el
desglose, la defensa (dos líneas y «Más sobre tu zona» plegado: es el mismo
texto partido por la mitad, no se reescribió) y el aviso por push. Tras marcar
la casa en el mapa con el formulario de «Cambiar» abierto, `irAlResultadoDeLaCasa()`
lo pliega y va al número; antes se caía arriba del formulario, que todavía
decía lo anterior.

**Las sugerencias de calles no pueden pisar un resultado.** `restaurarPista()`
(que arranca cada búsqueda) cuenta `busquedas`, y `sugerirCalle()` lo compara
tras el `await cargarCalles()`: con poca señal el callejero tarda, y pintar la
lista después de Buscar dejaba «¿Es Cnl Manuel Dorrego?» junto al tilde verde.
El mapa de «Dónde ir» se reencuadra a los 30 puntos la próxima vez que se abre
después de marcar (`encuadrarPuntos()`): es una sola instancia y heredaba el
zoom de una manzana.

**«Marcarla en el mapa» es una hoja a pantalla completa.** El mismo `#mapa`
pasa a `position: fixed` con la clase `marcando` (y `body.marcando-mapa` frena
el scroll); `mapa.js` llama a `resize()` al entrar y al salir. El pedido va
arriba, la confirmación abajo (`.mapa-aviso.confirmar`), Escape cancela, y la
caja usa la tipografía del producto y no la de MapLibre (Helvetica 13 px).
Antes quedaban ~170 px de foto para tocar.

**El placeholder es el tenue** (`::placeholder` en `estilos/app.css`). Sin esa
regla el navegador pone #757575: 4,14:1 en claro y 2,87 en oscuro, en el campo
principal y en los de Mi plan. Ningún barrido de nodos de texto lo ve; por eso
`comprobar.js` verifica que la regla exista y use el tenue, que ya está medido.

**Los colores de texto se miden contra todos los fondos donde caen**, no sólo
contra el papel: el tenue daba 4,12 y el acento 4,13 sobre el tinte de peligro.
`node scripts/comprobar.js` lo verifica en los dos temas leyendo
`estilos/app.css` (sección CONTRASTE): un color nuevo se mide solo. Los
rellenos sólidos con texto blanco (`peligro-solido`, `alerta-solido`,
`evac-solido`) también se miden ahí: el rojo del 103 en oscuro aprobaba por
0,002. Los valores del tema claro viven una sola vez en las `--c-*`.

**El widget, la placa (`PAL` en `js/placa.js`) y el CSS embebido de
`api/metricas.js` llevan su propia copia de la paleta**, y `comprobar.js`
(`COPIAS`) la compara con los tokens y mide sus pares: un color nuevo en una
copia va con su renglón en el mapa. Antes no lo medía nadie y las tres habían
quedado con la paleta vieja —el agua del logo del widget en #1f7a9e, el
«Dato viejo» a 4,23:1—. Lo mismo vale para un color escrito en JS: el gris del
popup del mapa estaba como `#7E959D` en `mapa.js` y daba 3,15:1, y ningún
control lo veía.

**La barra de «Instalar en el teléfono» sólo sale en Río.** `vista.js` pone
`body[data-vista]` y el CSS la oculta en las otras tres pestañas, donde tapaba
el resultado, el plan y el 103. Es un `.btn.sec`, no el sólido.

**La tendencia del río no lleva color de estado.** Es caudal, no la regla del
puerto: un naranja o un verde ahí le quita su significado al de la alerta. El
titular dice las dos mitades en palabras («Subió esta semana y se espera que
baje») en vez de «Viene subiendo» junto a «−84 %». Lo mismo con «▲ 0,07 m».

### Dos trampas del marcado de la app

**`#plan-impreso` es hijo directo de `<body>`, no del `<main>`.** El
`@media print` esconde `body.app > *:not(#plan-impreso)`: metido adentro del
`<main>` se lo lleva puesto la regla del padre y **imprimir el plan da una hoja
en blanco**, sin ningún error.

**Los comentarios HTML son cortos a propósito.** Viajan al navegador en cada
visita: llegaron a ser 32 KB en todo el sitio. El razonamiento largo va en
`README.md`, en `CLAUDE.md`, o —en las páginas generadas— como comentario de
JavaScript en su archivo de `scripts/paginas/`, que no se emite. En el HTML queda
una marca de dos o tres palabras que dice adónde ir a buscarlo.

### `irA("donde")` arma el mapa por su cuenta

Cualquier flujo que después haga `await armarMapa()` —hoy, «Marcar mi casa
en el mapa»— recibe **la promesa en curso**. Si alguien vuelve a cortar con un
flag, el segundo llamador encuentra `mapa` nulo y la función se rompe en el
primer uso, sin error en consola. Ya pasó, y nadie lo vio hasta que alguien
sin dirección en OpenStreetMap lo necesitó.

### Una clase, un componente

`.cita` llegó a nombrar dos cosas distintas —las tarjetas de avisos de la
portada y la cita textual de `/datos`—, con la misma especificidad y mil líneas
de distancia. Ganaba la de más abajo, así que la portada salía en monoespaciada
sobre fondo gris y `/datos` arrastraba un borde ámbar que nadie pidió. **Las dos
estaban rotas y ninguna fallaba de forma visible.** Hoy son `.aviso-app` y
`.cita`. Antes de estrenar un nombre de clase, `grep` en `estilos/app.css`.

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

`cotaEnHidrometro()` es la **única** puerta a la traducción de cota a umbral,
y por defecto descuenta el margen de la fuente: `margenCota()`, que da
`ERROR_DEM` para las curvas y `ERROR_PUNTOS` para los puntos de la costa,
según `estado.cotaFuente`. La cuenta en sí está en `js/app/modelo.js`
(`umbralDe`, `margenDe`), pura —sin estado ni DOM— para que
`scripts/comprobar.js` la pueda probar desde Node; las dos de `cota.js` sólo
le pasan los datos de la sesión. **`config.js` y `modelo.js` no importan nada
que toque el DOM**: el día que lo hagan, el script deja de poder cargarlos. No recalcular esa cuenta en otro lado: cuando se
hizo, la regla mostraba el escenario optimista y el veredicto el pesimista, con
hasta 3 m de diferencia para lo mismo en la misma pantalla.

### Las listas del plan se guardan por índice

Cada casilla de `MOCHILA` y `PREVIA` (`public/lib/listas.js`, que `js/app/config.js`
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
`'self'`. **El cargador de googletagmanager también lo inyecta ese archivo,
después de `load`** (octubre de 2026): escrito como `<script async>` en el
`<head>`, el navegador bajaba sus 181 KB apenas lo leía, compitiendo con
`app.css`, que bloquea el render. No lo vuelvas a poner en el HTML. Está
habilitado en la CSP general de `vercel.json`; las dos CSP del widget **no se
tocaron**.

Lo **único** que sale del dispositivo son las sugerencias, y el formulario lo
dice. El push va **sin contenido**: el servidor no sabe la cota ni el umbral de
nadie, sólo despierta al teléfono y el service worker arma la notificación
comparando contra IndexedDB. De cada persona el servidor guarda un solo dato:
el endpoint opaco del navegador. Cualquier cambio que agregue un envío rompe la
promesa que la app hace por escrito.

### Sin conexión

**El service worker lo registran las dos mitades.** `js/app/instalar.js` para
`/app` y `js/rio-barra.js` para las once páginas del sitio. Antes lo registraba
sólo la app, y eso dejaba una promesa escrita sin cumplir: la bajada de
`/puntos-de-encuentro` dice «esta página funciona sin conexión», pero quien
llegaba ahí desde un buscador y nunca abría la app no tenía service worker.
Era la página de evacuación afirmando algo que no hacía. Agregar las páginas al
precache no alcanzaba: eso arregla _qué_ se cachea, no _si el worker llega a
instalarse_.

**Por eso el precache va en dos tandas** (`CRITICOS` y `DEL_APP` en `sw.js`):

| Tanda      | Qué                                                                    | Cuánto | Quién la paga              |
| ---------- | ---------------------------------------------------------------------- | ------ | -------------------------- |
| `CRITICOS` | los 12 HTML, `app.css`, `guia.css`, `comun-clasico.js`, `rio-barra.js` | 99 KB  | todo el que entra al sitio |
| `DEL_APP`  | `/app`, los 27 módulos, `lib/comun.js`, `curvas.json`, `cotas-costa.json`, tipografías, íconos | 256 KB | sólo quien abre `/app`     |

Medido con gzip el 29/10/2026, con `/hidrometro` en la primera y
`/lib/comun.js` pasado a la segunda (sólo lo piden los módulos de la app;
estaba en la del sitio y lo pagaba cualquiera que leyera `/legal`). Las
anteriores —94 y 229 KB el 23/10, 87 y 224 antes— quedaron viejas sin que
nadie lo notara: si se agrega algo a una tanda, se vuelve a medir.

**Las dos tandas se piden con `cache: "no-cache"`**, no `"reload"`: `reload`
saltea la caché HTTP sin pedido condicional y en la primera visita a `/app`
volvía a bajar enteros los módulos que la página acababa de bajar (unos
165 KB). `no-cache` revalida y lo que no cambió vuelve como 304.

**Red primero, pero no para siempre.** Las ramas de red primero del worker
(JS, CSS y navegaciones) esperan 4 s (`ESPERA_RED_MS`): si la red no
contestó y hay copia, sirven la copia y la red sigue de fondo actualizando
la caché. Sin ese tope, con señal mala —hay conexión pero no pasa nada—
cada módulo esperaba el timeout del navegador aunque tuviera copia. En la
app, `rio.js` pinta de entrada el último nivel guardado, rotulado como
guardado y con su fecha, y corta el pedido a los 8 s (`ESPERA_NIVEL_MS`).

La segunda **no se pide en `install`**. La pide la app con un
`postMessage({tipo:"calentar-app"})` desde `instalar.js`; si se pidiera en la
instalación, quien entró a leer dos párrafos de `/legal` se bajaría igual los
módulos de la app y las tipografías, y partirla no habría servido de nada.

Las dos van con `addAll`, que es todo o nada. Que la segunda sea aparte no la
afloja: media app cacheada abre y se rompe callada, que es lo peor de los dos
mundos. Si esa tanda falla, la instalación **no** se cae —el sitio igual anda
sin señal— y los módulos se cachean igual por la rama de red primero.

**Un deploy no puede dejar a `/app` sin copia** (octubre de 2026). El worker
nuevo se activa sólo con `CRITICOS`, y antes borraba toda caché ajena:
quien había abierto la app una vez la perdía sin señal después de cada
deploy, que con la portada del día son dos por día. Ahora `podarViejas()`
conserva la última caché vieja con `/app` hasta que la nueva tenga `DEL_APP`
entera, `buscar()` mira primero la caché de esta versión —`caches.match()`
recorre en orden de creación y la vieja ganaría— e `instalar.js` vuelve a
pedir la tanda en `controllerchange`, porque el pedido del arranque le llega
al worker viejo. Probado con un deploy simulado desde `/legal` y con `/app`
abierta.

**El service worker no toca NADA de otro origen.** Era una lista de hosts
—IGN, OpenStreetMap, Open-Meteo— y se quedó corta el día que el worker empezó a
correr también en las páginas del sitio, que son las que llevan analytics: el
tag de Google entraba por la rama de caché primero, el worker lo volvía a pedir
con `fetch()` y ahí **dejaba de ser un `<script>` para chequearse contra
`connect-src`**, que no lo lista —`script-src` sí—. El navegador lo bloqueaba y
en su lugar quedaba nuestro 504. Ahora es una sola regla,
`url.origin !== location.origin`, porque interceptar otro origen no aporta nada:
la rama de caché primero sólo guarda lo del propio origen. Una regla no se queda
corta; una lista sí.

**Las tipografías no van en la tanda del sitio**, sólo en la de `/app`. El
sitio las baja para pintar la página, así que meterlas en `CRITICOS` con
`cache: "reload"` era bajarlas dos veces. La rama de caché primero las guarda en la segunda página
que alguien mira, y sin señal el sitio sale con Plus Jakarta Sans — verificado.
Lo único que queda afuera: quien mira UNA sola página y se queda sin señal ve
la tipografía del sistema. Es legible, y no vale bajar dos veces 59 KB.

`/api/` **nunca** se cachea: es preferible fallar y mostrar el último valor
guardado avisando que puede estar viejo, antes que servir el de ayer como si
fuera de hoy. `datos-abiertos/curvas.json` va precacheado porque es el cálculo central,
y `cotas-costa.json` por lo mismo en Rincón y Arroyo Leyes.
El HTML, los módulos y `app.css` van por red primero; el resto por caché primero.
