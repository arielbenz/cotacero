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

**Subir `VERSION` en `sw.js` en cada deploy**, o todo lo que va por caché
primero (íconos, tipografías) queda congelado.

## Arquitectura

### Dónde vive cada cosa

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

    lib/ina.js  ──►  api/nivel.js  ──►  app.js · landing.js · widget/widget.js · sw.js
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

| Qué | Dónde vive | Quién lo lee |
|---|---|---|
| Los 30 puntos de encuentro | `app/index.html` (atributos `data-lon`/`data-lat`) | `app.js` y `scripts/paginas.js` |
| Organismos, URLs, la estación del INA | `lib/fuentes.js` | `lib/ina.js`, `scripts/paginas.js` |
| El pie del sitio | constante `PIE` en `scripts/paginas.js` | las páginas generadas **y** `index.html` |
| Récord histórico y serie | `datos-abiertos/historia.json` | `app.js`, `historia.js`, `scripts/paginas.js` |

La marca es la excepción consciente: el SVG está escrito a mano en
`scripts/marca.js`, en `scripts/paginas.js` (`marcaSvg()`) y en el HTML de la
portada y la app. Si se cambia el dibujo, se cambia en los cuatro.

`app.js` es un script clásico y **no puede importar módulos**: lleva una copia
mínima de `lib/fuentes.js` en `FUENTES_APP`, con un comentario que apunta al
original. Si cambia una URL, cambia en `lib/fuentes.js` y se replica a mano.

### Páginas generadas: no editarlas

`/puntos-de-encuentro`, `/mi-cota`, `/datos`, `/historia`, `/preguntas`,
`/legal`, `/charlas` y `/para-medios` los emite `scripts/paginas.js`. Editar el
HTML resultante se pisa en la próxima corrida. **Se edita el generador.**
Ese script también escribe `datos-abiertos/puntos.json` y reemplaza el pie de
`index.html` entre los marcadores `<!-- PIE:inicio -->` / `<!-- PIE:fin -->`.

Una ruta nueva toca cinco lugares: `scripts/paginas.js`, la lista de escritura
al final del mismo archivo, `vercel.json` (cabecera de revalidación),
`sitemap.xml` y el `PIE`.

### CSP: nada de manejadores inline

`script-src` es `'self'` a secas y **no hay un solo `onclick` en el HTML**.
Toda la interactividad pasa por el delegador de eventos de `app.js`: se agrega
una entrada en `ACCIONES` (clics, vía `data-accion`) o en `ENTRADAS`
(campos, vía `data-input`). Un `onclick` no va a correr y el fallo es mudo.

`style-src` sí lleva `'unsafe-inline'`, a propósito.

## Reglas que no se rompen

### Tres conceptos, tres nombres

Nunca intercambiarlos, ni en el código ni en la interfaz:

1. **nivel del río** — la lectura del hidrómetro (dato del INA).
2. **cota del terreno** — la elevación IGN del terreno (curvas del municipio).
3. **umbral hidráulico estimado** — la lectura del hidrómetro a partir de la
   cual la superficie de agua equivalente alcanzaría esa cota.

Llamarle «tu cota» al umbral está prohibido: mezclarlos es exactamente lo que
hacía sonar la app como una predicción de inundación. La app dice **«referencia
hidráulica estimada»**, nunca «cuándo llega el agua» ni «tu casa se inunda».

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
~0,5 m. Un decimal y tilde de aproximación (`mU()` en `app.js`, `unDec()` en
`sw.js`). La única excepción es el desglose del cálculo, que conserva la
aritmética exacta y aclara al pie por qué la pantalla muestra otra cosa.

### Escenario pesimista, en un solo lugar

`cotaEnHidrometro()` es la **única** función que traduce cota a umbral, y por
defecto descuenta `ERROR_DEM`. No recalcular esa cuenta en otro lado: cuando se
hizo, la regla mostraba el escenario optimista y el veredicto el pesimista, con
hasta 3 m de diferencia para lo mismo en la misma pantalla.

### Las listas del plan se guardan por índice

Cada casilla de `MOCHILA` y `PREVIA` (`app.js`) persiste como `cc_mo3`,
`cc_pv5`… **por su posición**. Reordenar un renglón le mueve el tilde a todo el
que ya venía llenando el plan. Se agrega al final; si hay que reordenar, hace
falta una migración como `limpiarGuardadoViejo()`.

Cada renglón lleva un booleano: `true` = está en el Plan de Contingencia
municipal (y la interfaz lo sella), `false` = lo agregamos nosotros. No
atribuirle al municipio recomendaciones que no son suyas.

### Privacidad

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
El HTML, `app.js` y `app.css` van por red primero; el resto por caché primero.
