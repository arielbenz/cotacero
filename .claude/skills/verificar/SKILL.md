---
name: verificar
description: Verifica un cambio en Cota Cero en el orden que pide CLAUDE.md — sintaxis, generador de páginas, guía en PDF, servidor local y navegador a 390 px y en escritorio, en claro y en oscuro. Usala después de tocar cualquier .js, .css o HTML del proyecto, antes de dar un cambio por terminado.
---

# Verificar un cambio

El proyecto no tiene tests ni linter a propósito (ver CLAUDE.md, «Comandos»).
Esta es la verificación, en este orden. No saltear pasos: cada uno agarra
algo que el anterior no ve.

## 1. Sintaxis

`node --check` en cada `.js` tocado. Para no olvidarse de ninguno:

```bash
for f in $(git diff --name-only -- '*.js'); do node --check "$f" || echo "FALLA $f"; done
```

## 2. El cálculo

Si se tocó `public/js/app/config.js`, `modelo.js`, `elevacion.js`,
`public/lib/comun.js` o algo de `public/datos-abiertos/`:

```bash
node scripts/comprobar.js
```

Tiene que terminar en `Todo en orden.` Si un caso falla, el número cambió:
ver si era a propósito (y entonces el caso se actualiza con el valor nuevo
**comprobado en el navegador**) o si se rompió algo.

## 2b. El generador

Correr `node scripts/paginas.js` si se tocó `scripts/paginas.js` o algo de
`scripts/paginas/`,
`public/app/index.html`, `public/index.html`, `public/lib/fuentes.js`, `public/lib/comun.js`,
`lib/paginas.js`, `public/lib/listas.js`, `lib/charlas.js`, `lib/sugerencias.js`
o `estilos/app.css` (de ahí sale `public/css/app.css`).
Ante la duda, correrlo: es barato.

Las últimas líneas tienen que decir:

```
portada, app y widget: coinciden con lib/paginas.js
service worker: precachea los N módulos de la app
service worker: precachea las 11 páginas generadas
proveedores: 9 en la CSP y en /legal; M hosts del código clasificados
la marca: 31 copias, todas con el dibujo de scripts/marca.js
service worker: VERSION … 
```

N y M los cuenta el generador: no hace falta saberlos de memoria. La última
dice «VERSION al día» si nada precacheado cambió, o la versión nueva si
cambió algo: en ese caso `sw.js` queda modificado, y va en el commit.

Si falla, falla ruidoso y dice por qué. Un módulo nuevo en `js/app/` entra
solo al precache de `sw.js` (lo escribe el generador entre los marcadores
`MODULOS`); una página nueva tiene que tener enlace en el pie y cabecera de
revalidación en `vercel.json`; un host nuevo en el código tiene que estar en
`lib/proveedores.js`, y si es proveedor, en la CSP y en `/legal`.

## 3. La guía en PDF

Si se tocó algo de `scripts/paginas/` (sobre todo `guia.js` o `base.js`),
`public/lib/listas.js` o `public/css/guia.css`:

```bash
node scripts/guia-pdf.js
```

Tiene que decir `1 carilla`. Si dice dos, la hoja se pasó: se fotocopia por
cientos y dos carillas son el doble de plata. Para mirarla sin poppler:

```bash
sips -s format png public/guia.pdf --out "$SCRATCHPAD/guia.png"
```

## 4. Servidor y navegador

```bash
PORT=3100 node scripts/servir.js   # en segundo plano
```

Es el único servidor que aplica la CSP de `vercel.json`. Un
`python -m http.server` no prueba la política.

Mirar con las herramientas de Chrome DevTools, en un contexto aislado (sin
datos guardados de otra sesión):

- **Ancho de teléfono: 390 px con `emulate`** (`390x844x2,mobile,touch`). Por
  CDP sí baja a 390; con `--window-size` no baja de ~485.
- **Escritorio: 1280 px.**
- **Claro y oscuro** (`colorScheme`). Las cuatro pestañas de la app tienen
  versión oscura en el diseño.
- **Consola limpia.** Cualquier error es real.
- **Sin scroll de costado:** `document.documentElement.scrollWidth` tiene que
  dar el ancho de la ventana (390 o 1265 con barra de scroll).

### La app con datos

Para ver los estados con la casa cargada, sembrar `localStorage` antes de
recargar:

```js
localStorage.setItem("cc_zona", "centro");
localStorage.setItem("cc_cota", "13.7");      // ≈ 5,5 de nivel de aviso
localStorage.setItem("cc_cota_origen", "mano");
localStorage.setItem("cc_no_instalar", "1");  // que la barra no tape
```

Los estados graves se prueban cargando el río a mano: `#in-rio` +
`[data-accion="rio-manual"]`. Probar al menos normal, atención (4,5), alerta
(5,4), evacuación (5,8) y nivel de aviso superado.

## Trampas conocidas

- **Las rutas son relativas a `public/`.** Vercel publica esa carpeta
  (`outputDirectory`) y `servir.js` también: `/lib/ina.js` o `/scripts/…`
  dan 404 a propósito. Una ruta que no existe devuelve `404.html` con
  código 404, igual que en producción.
- **No se pueden abrir páginas en un `<iframe>`** para recorrerlas de una:
  la CSP lleva `frame-ancestors 'none'`. Navegar de a una. El widget sí se
  deja embeber (es el único).
- **`scripts/servir.js` es binario para `grep`:** usar `grep -a`.
- **La regla general de enlaces de las páginas mide (0,8,1)**
  (`.landing a:not(.btn):not(.lockup)…`). Un enlace que sale azul sin
  querer casi siempre es eso: o lleva una clase excluida (`.punto`), o se
  repite la cadena entera con el prefijo del contenedor.
- **Antes de estrenar una clase, `grep` en `estilos/app.css`.** `.cuenta` y
  `.cita` ya nombraron dos cosas a la vez y las dos salían rotas sin fallar.
- **Al tocar el marcado a mano, contar los `<div>`.** Un cierre de más o de
  menos no da error, sólo rompe el layout lejos de donde está:

  ```bash
  python3 -c "
  from html.parser import HTMLParser
  class P(HTMLParser):
      d=0
      def handle_starttag(s,t,a): s.d+= t=='div'
      def handle_endtag(s,t): s.d-= t=='div'
  p=P(); p.feed(open('public/index.html').read()); print('saldo', p.d)"
  ```

  Tiene que dar `saldo 0`.

## Antes de publicar (no en cada cambio)

- Correr `node scripts/paginas.js`: escribe la `VERSION` de `sw.js` como
  resumen de lo precacheado. Ya no se sube a mano; `comprobar.js` avisa si
  quedó vieja.
- `rediseno/` está en `.gitignore`: no se publica.

## Qué reportar

Lo que se corrió y lo que dio, tal cual. Si algo no se pudo verificar —sin
Chrome, sin red para el INA— decirlo, no darlo por bueno.
