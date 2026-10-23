// scripts/paginas/emitir.js — escribe todo lo que genera el script y, al
// final, verifica lo que no genera (portada, app, widget, precache).

import { readFile, writeFile, mkdir, readdir } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { join } from "node:path";
import { ORGANISMOS, FUENTES } from "../../public/lib/fuentes.js";
import { PAGINAS, enSitemap } from "../../lib/paginas.js";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { GENERADAS, PUBLICO, RAIZ, SITIO, pie, puntos } from "./base.js";
import { ENLACES, PROVEEDORES } from "../../lib/proveedores.js";
import { RENGLON_VERSION, versionDelSw } from "../version-sw.js";
import { GEOMETRIA, geometriaDe } from "../marca.js";

/* Las páginas se cargan solas: cada archivo de esta carpeta que no sea
   base.js ni emitir.js es una página, y al cargarse se anota en GENERADAS
   (base.js). Una página nueva es un archivo nuevo acá y su renglón en
   lib/paginas.js: no hay una lista de imports ni de escritura que tocar. */
const CARPETA = dirname(fileURLToPath(import.meta.url));
for (const f of (await readdir(CARPETA)).sort())
  if (f.endsWith(".js") && f !== "base.js" && f !== "emitir.js")
    await import("./" + f);

/* ---------- public/lib/comun-clasico.js ----------
   El gemelo clásico de public/lib/comun.js, para los dos contextos que no pueden
   importar: el service worker (que lo trae con importScripts) y los scripts
   clásicos del sitio (con un <script> común).

   Sale de sacarle los `export` al original y envolverlo en una IIFE que
   publica un solo nombre, `self.CC_COMUN` — el mismo motivo por el que
   `rio-barra.js` va envuelto: los scripts clásicos comparten el ámbito global
   y un `const` suelto arriba de todo se lleva puesto el archivo siguiente,
   entero y en silencio.

   Los nombres que expone se DERIVAN de los `export` del original: agregar uno
   allá lo publica acá solo, sin una segunda lista que se desincronice. */
const fuenteComun = await readFile(join(PUBLICO, "lib", "comun.js"), "utf8");
const nombresComun = [
  ...fuenteComun.matchAll(
    /^export (?:const|let|function)\s+([A-Za-z_$][\w$]*)/gm,
  ),
].map((x) => x[1]);
if (nombresComun.length < 5)
  throw new Error(
    "public/lib/comun.js: no se reconocieron sus exports. ¿Cambió la forma del archivo?",
  );
const comunClasico =
  "/* GENERADO por scripts/paginas.js desde public/lib/comun.js. NO EDITAR:\n" +
  "   el próximo `node scripts/paginas.js` lo pisa. El original es public/lib/comun.js. */\n" +
  '(function (raiz) {\n  "use strict";\n' +
  fuenteComun.replace(/^export /gm, "") +
  "\n  raiz.CC_COMUN = { " +
  nombresComun.join(", ") +
  ' };\n})(typeof self !== "undefined" ? self : globalThis);\n';
await writeFile(join(PUBLICO, "lib", "comun-clasico.js"), comunClasico);
console.log(
  "escrito: /lib/comun-clasico.js  (" +
    nombresComun.length +
    " nombres: " +
    nombresComun.join(", ") +
    ")",
);

/* ---------- public/css/app.css ----------
   La hoja de estilo se escribe en estilos/app.css, fuera de public/, y acá
   se publica SIN COMENTARIOS. Es la misma regla que los comentarios cortos
   del HTML, aplicada a donde más pesaba: el razonamiento era un tercio del
   archivo, y como es prosa se comprime mal —43 KB con gzip contra 18 sin
   él—. Y app.css bloquea el renderizado en todas las páginas.

   Sólo se sacan los comentarios: no se minifica. Ahorraría menos de 1,5 KB con gzip y dejaría
   ilegible lo que se ve en las herramientas del navegador.

   El recorrido salta las cadenas entre comillas, para que un "/*" adentro de
   un `content:` o de una URL no se tome por el comienzo de un comentario. */
const fuenteCss = await readFile(join(RAIZ, "estilos", "app.css"), "utf8");
let cssSinComentarios = "";
for (let i = 0; i < fuenteCss.length; ) {
  const c = fuenteCss[i];
  if (c === '"' || c === "'") {
    let j = i + 1;
    while (j < fuenteCss.length && fuenteCss[j] !== c)
      j += fuenteCss[j] === "\\" ? 2 : 1;
    cssSinComentarios += fuenteCss.slice(i, j + 1);
    i = j + 1;
  } else if (c === "/" && fuenteCss[i + 1] === "*") {
    const fin = fuenteCss.indexOf("*/", i + 2);
    if (fin < 0)
      throw new Error("estilos/app.css: un comentario que no cierra");
    i = fin + 2;
  } else {
    cssSinComentarios += c;
    i++;
  }
}
cssSinComentarios = cssSinComentarios
  .split("\n")
  .map((l) => l.trimEnd())
  .join("\n")
  .replace(/\n{3,}/g, "\n\n")
  .trim();
await writeFile(
  join(PUBLICO, "css", "app.css"),
  "/* GENERADO por scripts/paginas.js desde estilos/app.css, sin los\n" +
    "   comentarios. NO EDITAR: el próximo `node scripts/paginas.js` lo pisa. */\n" +
    cssSinComentarios +
    "\n",
);
console.log(
  "escrito: /css/app.css  (" +
    Math.round(fuenteCss.length / 1024) +
    " KB -> " +
    Math.round(cssSinComentarios.length / 1024) +
    " KB, sin comentarios)",
);

/* La landing dibuja los 30 puntos en un mapa y necesita las coordenadas.
   Se emiten desde acá, que ya las leyó de app/index.html, para que no exista
   una tercera copia de la lista. */
await mkdir(join(PUBLICO, "datos-abiertos"), { recursive: true });
await writeFile(
  join(PUBLICO, "datos-abiertos", "puntos.json"),
  JSON.stringify(puntos.map((p) => [p.nombre, p.direccion, p.lon, p.lat])),
);
console.log(
  "escrito: /datos-abiertos/puntos.json  (" + puntos.length + " puntos)",
);

/* La portada es HTML escrito a mano, pero su pie sale de la misma constante:
   se reemplaza el bloque entre los marcadores. Si alguien lo edita a mano,
   la próxima corrida lo pisa — que es exactamente lo que queremos. */
const portada = join(PUBLICO, "index.html");
const antes = await readFile(portada, "utf8");
const MARCA_INI = "      <!-- PIE:inicio";
const MARCA_FIN = "      <!-- PIE:fin -->";
const i = antes.indexOf(MARCA_INI);
const f = antes.indexOf(MARCA_FIN);
if (i === -1 || f === -1)
  throw new Error("index.html no tiene los marcadores PIE");
const cabecera = antes.slice(i, antes.indexOf("-->", i) + 4);
const despues =
  antes.slice(0, i) +
  cabecera +
  "\n" +
  pie({ frescura: true }) +
  "\n" +
  antes.slice(f);
if (despues !== antes) {
  await writeFile(portada, despues);
  console.log("actualizado: el pie de index.html");
} else {
  console.log("index.html: el pie ya estaba al día");
}

/* Cada página en la ruta que le da lib/paginas.js. La 404 va a la raíz como
   404.html, que es donde la busca Vercel. */
const claves = new Set(GENERADAS.map((g) => g.clave));
const sinArchivo = Object.entries(PAGINAS)
  .filter(([k, p]) => p.generada && !claves.has(k))
  .map(([k]) => k);
if (sinArchivo.length)
  throw new Error(
    "lib/paginas.js marca como generadas páginas que ninguna arma: " +
      sinArchivo.join(", ") +
      "\nFalta su archivo en scripts/paginas/, o sobra el renglón.",
  );
for (const { clave, html } of GENERADAS) {
  const p = PAGINAS[clave];
  if (!p || !p.generada)
    throw new Error(
      `scripts/paginas/: una página arma «${clave}», que no está en lib/paginas.js como generada.`,
    );
  if (p.ruta === "/404") {
    await writeFile(join(PUBLICO, "404.html"), html);
    console.log("escrito: /404.html");
    continue;
  }
  const ruta = p.ruta.replace(/^\//, "");
  await mkdir(join(PUBLICO, ruta), { recursive: true });
  await writeFile(join(PUBLICO, ruta, "index.html"), html);
  console.log(
    "escrito: /" + ruta + "  (" + (html.length / 1024).toFixed(0) + " KB)",
  );
}
console.log("puntos leídos de app/index.html: " + puntos.length);

/* ---------- sitemap.xml ----------
   Sale del registro, no de un archivo que se edita aparte: así no puede
   listar una página que ya no existe ni olvidarse de una nueva. Sólo entra
   lo indexable — nada de /api, assets, manifest ni service worker.

   El `lastmod` sale de git, no del reloj. Poner la fecha de hoy en cada corrida
   sería decirle a Google que todas las páginas cambiaron cuando no cambió
   ninguna, y una fecha inventada es peor que ninguna — por eso durante un
   tiempo no hubo `lastmod` en absoluto. Pero la fecha real existe: es la del
   último commit que tocó el HTML de esa página. Si el archivo en disco todavía
   no está commiteado, entonces está cambiando ahora y va con la fecha de hoy.

   Importa porque de los tres campos del sitemap, `lastmod` es el único que
   Google dice usar: `changefreq` y `priority` los ignora. Se dejan igual
   porque otros rastreadores sí los miran y no cuestan nada. */
function ultimoCambio(ruta) {
  // La ruta dentro del repo: el sitio vive en public/.
  const archivo =
    "public/" +
    (ruta === "/" ? "index.html" : ruta.replace(/^\//, "") + "/index.html");
  const git = (args) =>
    execFileSync("git", args, { cwd: RAIZ, encoding: "utf8" }).trim();

  /* La trampa: el pie de TODAS las páginas lleva "Última actualización del
     sitio", que sale del último commit del repo. Sin este filtro, cualquier
     commit reescribe las once páginas y el lastmod colapsa a "fecha del
     último deploy" para todas — cierto, pero sin ninguna información. Un
     cambio que sólo mueve ese renglón no cuenta como cambio de la página.

     Y la segunda trampa, del mismo tipo: un renombre. Cuando el sitio se
     mudó a public/, cada página apareció en git como un archivo nuevo en el
     commit de la mudanza; sin seguirle el rastro al nombre viejo, las once
     quedaban con esa fecha. Un renombre sin cambios de contenido tampoco es
     un cambio de la página.

     Y la tercera: lo que el lector no ve. Un archivo de tipografía nombrado en
     el <head> —precargado en una línea o en varias—, un comentario HTML o un
     renglón vacío —el que deja cada comentario `${""}`
     de este archivo— cambian el
     HTML en las once páginas a la vez. Pasó al unificar las tipografías: las
     once salían modificadas hoy sin una letra distinta, y un lastmod que se
     mueve sin motivo es uno que Google aprende a no creer. */
  const cambiaAlgoQueSeLee = (diff) =>
    diff
      .split("\n")
      .filter((l) => /^[+-]/.test(l) && !/^(\+\+\+|---)/.test(l))
      .map((l) => l.slice(1).trim())
      .some(
        (l) =>
          l &&
          !l.includes("Última actualización del sitio") &&
          !l.includes("/vendor/fonts/") &&
          !/^<!--.*-->$/.test(l),
      );

  try {
    // Sin commitear: si lo que cambió no es sólo el pie, está cambiando hoy.
    // Contra HEAD y con -M, para que un renombre en curso se compare con su
    // nombre de antes y no como un archivo entero nuevo.
    const estado = git(["status", "--porcelain", "--", archivo]);
    if (estado) {
      const renombre = /^R. (.+) -> /.exec(estado);
      const rutas = renombre ? [renombre[1], archivo] : [archivo];
      if (cambiaAlgoQueSeLee(git(["diff", "HEAD", "-M", "-U0", "--", ...rutas])))
        return new Date().toISOString().slice(0, 10);
    }
    // Y hacia atrás, siguiendo los renombres, hasta el commit que tocó algo
    // más que ese renglón.
    const MARCA = "\u0001";
    const historia = git([
      "log",
      "--follow",
      "-p",
      "-U0",
      `--format=${MARCA}%cs`,
      "--",
      archivo,
    ]);
    for (const bloque of historia.split(MARCA).slice(1)) {
      const salto = bloque.indexOf("\n");
      const fecha = bloque.slice(0, salto === -1 ? undefined : salto);
      if (cambiaAlgoQueSeLee(salto === -1 ? "" : bloque.slice(salto)))
        return fecha;
    }
    return null;
  } catch {
    return null; // sin git (o el archivo nunca se commiteó): mejor sin fecha
  }
}

const urls = enSitemap()
  .map((p) => {
    const cambio = ultimoCambio(p.ruta);
    return (
      `  <url><loc>${SITIO}${p.ruta === "/" ? "/" : p.ruta}</loc>` +
      (cambio ? `<lastmod>${cambio}</lastmod>` : "") +
      `<changefreq>${p.frecuencia}</changefreq>` +
      `<priority>${p.prioridad}</priority></url>`
    );
  })
  .join("\n");
await writeFile(
  join(PUBLICO, "sitemap.xml"),
  `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`,
);
console.log(
  "escrito: /sitemap.xml  (" + enSitemap().length + " URLs indexables)",
);

/* ---------- llms.txt ----------
   El equivalente del sitemap para los modelos de lenguaje: en vez de una lista
   de URLs para rastrear, un índice en texto plano que dice qué hay en cada una
   y de dónde salen los datos.

   Existe por el mismo motivo que las páginas de contenido: cuando alguien le
   pregunta a un modelo "¿a qué altura se inunda mi casa en Santa Fe?", la
   respuesta que dé va a salir de algún lado. Que salga de acá —con la fuente,
   el margen y el descargo— es mejor que de una nota de 2003 mal recordada.

   Sale del MISMO registro que el sitemap: `lib/paginas.js`. Si se agrega una
   página, aparece sola. Nunca se escribe una URL a mano acá. */
const llms =
  `# Cota Cero\n\n` +
  `> ${PAGINAS.inicio.descripcion}\n\n` +
  `Herramienta ciudadana para la emergencia hídrica de Santa Fe, Argentina.\n` +
  `Sin vínculo con el municipio ni con ningún organismo: la orden de\n` +
  `evacuación la da Defensa Civil (103).\n\n` +
  `Lo que la app calcula es **el nivel de aviso**: el nivel del río a partir\n` +
  `del cual el agua puede llegar a un terreno, cruzando la lectura del\n` +
  `hidrómetro del Puerto con la altura del terreno. Es un cálculo aproximado\n` +
  `y no una predicción de inundación. Si citás el proyecto, esa distinción es\n` +
  `lo más importante que hay que conservar.\n\n` +
  `## Páginas\n\n` +
  enSitemap()
    .map(
      (p) =>
        `- [${p.titulo.split(" | ")[0].split(" — ")[0]}](${SITIO}${p.ruta === "/" ? "/" : p.ruta}): ${p.descripcion}`,
    )
    .join("\n") +
  `\n\n## Datos abiertos\n\n` +
  `- [Nivel del río, JSON](${SITIO}/api/nivel): la lectura del día del\n` +
  `  hidrómetro del Puerto de Santa Fe, con su fecha, los umbrales oficiales\n` +
  `  que publica la estación y de cuál de las dos fuentes del INA salió.\n` +
  `- [Serie histórica desde 1925](${SITIO}/datos-abiertos/historia.json)\n` +
  `- [Los 30 puntos de encuentro](${SITIO}/datos-abiertos/puntos.json): los\n` +
  `  oficiales del Plan de Contingencia municipal, con coordenadas.\n` +
  `- [Curvas de nivel](${SITIO}/datos-abiertos/curvas.json): las del\n` +
  `  municipio, que es de donde sale la altura de cada terreno.\n` +
  `- [Puntos con cota de la costa](${SITIO}/datos-abiertos/cotas-costa.json):\n` +
  `  los de la Provincia para San José del Rincón y Arroyo Leyes, donde las\n` +
  `  curvas no llegan.\n\n` +
  `## Fuentes\n\n` +
  Object.values(FUENTES)
    .map((f) => `- ${f.titulo}: ${ORGANISMOS[f.organismo].nombre} — ${f.url}`)
    .join("\n") +
  `\n\n## Qué NO dice este proyecto\n\n` +
  `- No dice cuándo llega el agua, ni que una casa se va a inundar.\n` +
  `- No contempla el terraplén, las bombas, el viento ni la lluvia local.\n` +
  `- No reemplaza una orden de evacuación.\n` +
  `- Las tres constantes del modelo están en discusión técnica abierta:\n` +
  `  ver ${SITIO}/datos y el AUDITORIA.md del repositorio.\n`;
await writeFile(join(PUBLICO, "llms.txt"), llms);
console.log("escrito: /llms.txt  (" + enSitemap().length + " páginas)");

/* ---------- /.well-known/api-catalog ----------
   Un catálogo de API en `application/linkset+json` (RFC 9727, formato del
   RFC 9264). Es para que un agente encuentre solo los datos en vez de raspar
   el HTML: menos tráfico para nosotros y un dato mejor para quien pregunta.

   Sólo se lista lo que EXISTE y es público de verdad. `/api/nivel` es de
   lectura, sin clave y cacheado una hora en el CDN, así que un agente
   consultándolo no nos cuesta invocaciones. Los otros endpoints de `api/` no
   van: suscribir, desuscribir y sugerencias son POST de la app, y publicarlos
   sería invitar a que alguien los llame sin motivo.

   No hay `service-desc`: eso pide un OpenAPI, y un OpenAPI sería una SEXTA
   copia de la forma de la respuesta de /api/nivel —hoy la conocen cuatro
   consumidores y el cron—. La documentación en prosa de /datos es la que ya
   mantenemos. */
const catalogo = {
  linkset: [
    {
      anchor: `${SITIO}/api/nivel`,
      "service-doc": [
        {
          href: `${SITIO}/datos`,
          type: "text/html",
          title: "De dónde sale cada dato y cómo se calcula",
        },
      ],
      describedby: [
        {
          href: `${SITIO}/llms.txt`,
          type: "text/markdown",
          title: "Qué es Cota Cero, en texto plano",
        },
      ],
      author: [{ href: `${SITIO}/sobre`, type: "text/html" }],
      license: [
        {
          href: `${SITIO}/legal`,
          type: "text/html",
          title: "Licencias y atribuciones",
        },
      ],
    },
    ...[
      [
        "/datos-abiertos/historia.json",
        "Serie diaria del río en Santa Fe desde 1925 (INA)",
      ],
      [
        "/datos-abiertos/puntos.json",
        "Los 30 puntos de encuentro del Plan de Contingencia municipal",
      ],
      [
        "/datos-abiertos/curvas.json",
        "Curvas de nivel de la Municipalidad, cada 50 cm en metros IGN",
      ],
      [
        "/datos-abiertos/cotas-costa.json",
        "Puntos con cota de Rincón y Arroyo Leyes (Provincia, 2005), en metros IGN",
      ],
    ].map(([ruta, titulo]) => ({
      anchor: SITIO + ruta,
      title: titulo,
      type: "application/json",
      "service-doc": [{ href: `${SITIO}/datos`, type: "text/html" }],
      license: [{ href: `${SITIO}/legal`, type: "text/html" }],
    })),
  ],
};
await mkdir(join(PUBLICO, ".well-known"), { recursive: true });
await writeFile(
  join(PUBLICO, ".well-known", "api-catalog"),
  JSON.stringify(catalogo, null, 2) + "\n",
);
console.log(
  "escrito: /.well-known/api-catalog  (" +
    catalogo.linkset.length +
    " recursos)",
);

/* ---------- la portada y la app son HTML a mano ----------
   No las genera este script, pero su título, su descripción y su canónica
   tienen que decir lo mismo que lib/paginas.js o el registro deja de ser la
   fuente de verdad. En vez de reescribirles el <head> —que es frágil— se
   comprueba y se falla fuerte. */
const enHtml = (h, re) =>
  (h.match(re) || [, ""])[1].replace(/\s+/g, " ").trim();
for (const clave of ["inicio", "app", "widget"]) {
  const meta = PAGINAS[clave];
  const archivo =
    clave === "inicio"
      ? "index.html"
      : clave === "app"
        ? join("app", "index.html")
        : join("widget", "index.html");
  const h = await readFile(join(PUBLICO, archivo), "utf8");
  const problemas = [];
  const titulo = enHtml(h, /<title>([\s\S]*?)<\/title>/);
  if (titulo !== meta.titulo)
    problemas.push(
      `  <title> dice   «${titulo}»\n  y debería decir «${meta.titulo}»`,
    );
  if (meta.descripcion) {
    const desc = enHtml(h, /<meta\s+name="description"\s+content="([^"]*)"/);
    if (desc !== meta.descripcion)
      problemas.push(`  la description no coincide con el registro`);
  }
  const noindex = /<meta name="robots" content="noindex/.test(h);
  if (noindex === meta.indexable)
    problemas.push(
      meta.indexable
        ? "  tiene noindex y el registro la marca indexable"
        : '  le falta <meta name="robots" content="noindex, follow">',
    );
  if (problemas.length)
    throw new Error(
      `${archivo} no coincide con lib/paginas.js:\n` + problemas.join("\n"),
    );
}
console.log("portada, app y widget: coinciden con lib/paginas.js");

/* ---------- la lista de módulos de sw.js ----------
   La escribe este script entre los marcadores MODULOS:inicio / MODULOS:fin:
   uno por archivo de public/js/app/, principal.js primero. Antes se agregaban
   a mano y el chequeo de abajo avisaba del olvido; ahora no hay olvido. */
{
  const rutaSw = join(PUBLICO, "sw.js");
  const texto = await readFile(rutaSw, "utf8");
  const ini = texto.indexOf("  // MODULOS:inicio");
  const fin = texto.indexOf("  // MODULOS:fin");
  if (ini < 0 || fin < ini)
    throw new Error("sw.js: faltan los marcadores MODULOS:inicio / MODULOS:fin.");
  const archivos = (await readdir(join(PUBLICO, "js", "app")))
    .filter((f) => f.endsWith(".js"))
    .sort((x, y) =>
      x === "principal.js" ? -1 : y === "principal.js" ? 1 : x < y ? -1 : 1,
    );
  const desde = texto.indexOf("\n", ini) + 1;
  const nuevo =
    texto.slice(0, desde) +
    archivos.map((f) => `  "/js/app/${f}",\n`).join("") +
    texto.slice(fin);
  if (nuevo !== texto) {
    await writeFile(rutaSw, nuevo);
    console.log("actualizado: la lista de módulos de sw.js");
  }
}

/* La app son módulos ES y el service worker los precachea uno por uno: si
   alguien agrega un módulo y se olvida de la lista de sw.js, /app deja de
   abrir sin conexión — y el modo de falla es mudo, aparece recién el día que
   alguien se queda sin señal. Por eso esto revienta acá y no allá. */
const modulos = [
  ...(await readdir(join(PUBLICO, "js", "app")))
    .filter((f) => f.endsWith(".js"))
    .map((f) => "/js/app/" + f),
  // los módulos compartidos que la app importa desde /lib/
  "/lib/fuentes.js",
];
const sw = await readFile(join(PUBLICO, "sw.js"), "utf8");
const faltan = modulos.filter((m) => !sw.includes(`"${m}"`));
if (faltan.length)
  throw new Error(
    "sw.js no precachea estos módulos de la app: " +
      faltan.join(", ") +
      "\nAgregalos a ESENCIALES o /app no va a abrir sin conexión.",
  );

/* Y al revés. `cache.addAll()` es todo-o-nada: si el precache nombra un
   archivo que ya no existe, la instalación entera falla y la app se queda SIN
   modo sin conexión — en silencio, porque el registro se hace con .catch().
   Pasó de verdad al borrar js/app/sugerencias.js: el chequeo de arriba miraba
   sólo que no faltara ninguno, no que no sobrara. */
const enPrecache = [...sw.matchAll(/^\s*"(\/[^"]+)",$/gm)].map((m) => m[1]);
const sobran = [];
for (const ruta of enPrecache) {
  if (ruta.startsWith("/vendor/") || ruta === "/" || !/\.[a-z]+$/.test(ruta))
    continue;
  try {
    await readFile(join(PUBLICO, ruta.replace(/^\//, "")));
  } catch {
    sobran.push(ruta);
  }
}
if (sobran.length)
  throw new Error(
    "sw.js precachea archivos que no existen: " +
      sobran.join(", ") +
      "\ncache.addAll() es todo-o-nada: con uno solo que falte, la app se " +
      "queda sin modo sin conexión.",
  );
/* Lo mismo con las páginas generadas. Seis de las nueve no estaban en el
   precache y NO fallaban sin señal: el respaldo de navegación les servía la
   portada, así que pedir /legal devolvía el home en silencio. Una de ellas,
   /puntos-de-encuentro, decía en su propia bajada que funcionaba sin conexión.
   Un modo de falla que se ve como un éxito no se descubre nunca: se verifica
   acá, donde revienta. */
const rutasGeneradas = Object.values(PAGINAS)
  .filter((p) => p.generada)
  .map((p) => p.ruta)
  /* /404 queda afuera: no es una ruta que alguien navegue, es lo que sirve
     Vercel cuando no encuentra otra cosa. Precachearla sería pedirle a la
     caché una URL que no existe, y con eso `cache.addAll()` falla entero. */
  .filter((r) => r !== "/404");
const sinCachear = rutasGeneradas.filter((r) => !sw.includes(`"${r}"`));
if (sinCachear.length)
  throw new Error(
    "sw.js no precachea estas páginas: " +
      sinCachear.join(", ") +
      "\nSin señal el service worker les sirve la portada en su lugar, sin " +
      "avisar. Agregalas a ESENCIALES.",
  );

console.log(
  "service worker: precachea los " + modulos.length + " módulos de la app",
);
console.log(
  "service worker: precachea las " +
    rutasGeneradas.length +
    " páginas generadas",
);

/* ---------- lo que una página nueva necesita además de su archivo ----------
   Una ruta nueva tocaba cinco lugares y nada avisaba si faltaba uno. Ahora el
   archivo de la página y su renglón en lib/paginas.js alcanzan para que se
   escriba, entre al sitemap y al precache verificado; lo que sigue a mano —un
   enlace en el pie, la cabecera de revalidación— se comprueba acá. */
{
  const rutas = GENERADAS.map((g) => PAGINAS[g.clave].ruta).filter((r) => r !== "/404");
  const enPie = pie();
  const sinPie = rutas.filter((r) => !enPie.includes(`href="${r}"`));
  if (sinPie.length)
    throw new Error(
      "El pie no enlaza estas páginas: " + sinPie.join(", ") +
        "\nUna página que no se enlaza desde ningún lado no la encuentra nadie. Ver pie() en base.js.",
    );
  const vercel = JSON.parse(await readFile(join(RAIZ, "vercel.json"), "utf8"));
  const conRevalidacion = new Set(
    vercel.headers
      .filter((h) => h.headers.some((x) => x.key === "Cache-Control"))
      .map((h) => h.source),
  );
  const sinRevalidar = rutas.filter((r) => !conRevalidacion.has(r));
  if (sinRevalidar.length)
    throw new Error(
      "vercel.json no fija Cache-Control para: " + sinRevalidar.join(", ") +
        "\nSin eso la CDN puede servir la versión vieja de la página.",
    );

  /* Los proveedores de otro origen (lib/proveedores.js): cada uno en su CSP
     y nombrado en /legal, y ningún host nuevo en el código sin clasificar. */
  // La CSP general: hay más de una regla para "/(.*)", y la del widget aparte.
  const csp = vercel.headers
    .filter((h) => h.source === "/(.*)")
    .flatMap((h) => h.headers)
    .find((x) => x.key === "Content-Security-Policy").value;
  const directivas = Object.fromEntries(
    csp.split(";").map((d) => d.trim().split(/\s+/)).map(([k, ...v]) => [k, v]),
  );
  const legal = GENERADAS.find((g) => g.clave === "legal").html;
  const problemas = [];
  for (const p of PROVEEDORES) {
    for (const d of p.csp)
      if (!(directivas[d] || []).includes("https://" + p.host))
        problemas.push(`${p.host}: falta en ${d} de la CSP (vercel.json)`);
    if (!legal.includes(p.quien))
      problemas.push(`${p.host}: /legal no nombra a «${p.quien}» (${p.para})`);
  }
  const cubre = (patron, host) =>
    patron.startsWith("*.") ? host.endsWith(patron.slice(1)) : patron === host;
  const conocidos = [...PROVEEDORES.map((p) => p.host), ...ENLACES, "cotacerosf.com"];
  const enCodigo = new Set();
  const recorrer = async (dir) => {
    for (const e of await readdir(dir, { withFileTypes: true })) {
      const ruta = join(dir, e.name);
      if (e.isDirectory()) await recorrer(ruta);
      else if (e.name.endsWith(".js")) {
        const sinComentarios = (await readFile(ruta, "utf8"))
          .replace(/\/\*[\s\S]*?\*\//g, "")
          .replace(/^\s*\/\/.*$/gm, "");
        for (const [, host] of sinComentarios.matchAll(/https:\/\/([a-z0-9.-]+\.[a-z]{2,})/gi))
          enCodigo.add(host.toLowerCase());
      }
    }
  };
  await recorrer(join(PUBLICO, "js"));
  for (const host of enCodigo)
    if (!conocidos.some((k) => cubre(k, host)))
      problemas.push(
        `${host}: aparece en public/js y no está en lib/proveedores.js. ` +
          "Si el navegador le pide algo, es un proveedor (CSP y /legal); si sólo se enlaza, va en ENLACES.",
      );
  if (problemas.length)
    throw new Error("Proveedores de otro origen:\n  " + problemas.join("\n  "));
  console.log(
    "proveedores: " + PROVEEDORES.length + " en la CSP y en /legal; " +
      enCodigo.size + " hosts del código clasificados",
  );
}

/* ---------- la marca ----------
   El dibujo vive en scripts/marca.js. El HTML a mano —portada, app, widget—
   lleva sus copias con su tamaño y su color; acá se compara la geometría de
   cada una (y de las generadas) contra ese dibujo. También que ningún id de
   clipPath se repita en una página: con dos iguales el navegador recorta las
   dos con el primero, y la marca de abajo sale mal sin ningún error. */
{
  const problemas = [];
  let copias = 0;
  const recorrer = async (dir) => {
    for (const e of await readdir(dir, { withFileTypes: true })) {
      const ruta = join(dir, e.name);
      if (e.isDirectory()) {
        if (e.name !== "vendor") await recorrer(ruta);
      } else if (e.name.endsWith(".html")) {
        const html = await readFile(ruta, "utf8");
        const archivo = ruta.slice(PUBLICO.length + 1);
        const ids = [];
        for (const [svg] of html.matchAll(/<svg\b[^>]*viewBox="0 0 60 60"[\s\S]*?<\/svg>/g)) {
          copias++;
          const id = (svg.match(/<clipPath id="([^"]+)"/) || [])[1];
          ids.push(id);
          if (geometriaDe(svg) !== GEOMETRIA)
            problemas.push(`${archivo}, la marca con clipPath «${id}»: el dibujo no es el de scripts/marca.js`);
          if (!svg.includes(`url(#${id})`))
            problemas.push(`${archivo}, «${id}»: el agua no usa su propio clipPath`);
        }
        const repetidos = ids.filter((x, i) => ids.indexOf(x) !== i);
        if (repetidos.length)
          problemas.push(`${archivo}: clipPath repetido en la misma página: ${[...new Set(repetidos)].join(", ")}`);
      }
    }
  };
  await recorrer(PUBLICO);
  if (problemas.length)
    throw new Error("La marca:\n  " + problemas.join("\n  "));
  console.log("la marca: " + copias + " copias, todas con el dibujo de scripts/marca.js");
}

/* ---------- la VERSION del service worker ----------
   Al final, cuando ya está escrito todo lo que precachea: es un resumen de
   ese contenido (scripts/version-sw.js). */
{
  const rutaSw = join(PUBLICO, "sw.js");
  const texto = await readFile(rutaSw, "utf8");
  const version = versionDelSw(PUBLICO);
  const nuevo = texto.replace(RENGLON_VERSION, `const VERSION = "${version}";`);
  if (nuevo !== texto) {
    await writeFile(rutaSw, nuevo);
    console.log("service worker: VERSION " + version);
  } else console.log("service worker: VERSION al día (" + version + ")");
}
