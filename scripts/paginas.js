// scripts/paginas.js — genera las páginas de contenido estático.
//
//   node scripts/paginas.js
//
// Emite /puntos-de-encuentro y /datos. Existen por una razón concreta: la
// app esconde 3 de sus 4 secciones detrás de pestañas (`.vista { display:
// none }`), así que ~800 de sus ~975 palabras —los 30 puntos de encuentro
// incluidos— le llegan a un buscador como contenido oculto, que pondera menos
// y no usa en el fragmento. Acá el mismo material va visible y con una URL
// propia.
//
// Los 30 puntos NO se copian: se leen de app/index.html, que es la fuente de
// verdad (app.js hace lo mismo, justamente para que no haya dos listas que se
// desincronicen). Volver a correr esto cuando cambien los puntos o los textos.
//
// Sin dependencias, como el resto del proyecto.

import { readFile, writeFile, mkdir, readdir } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  ORGANISMOS,
  FUENTES,
  NORMATIVA,
  ESTACION,
  ENDPOINTS,
} from "../lib/fuentes.js";
import { PAGINAS, OG_IMAGEN, enSitemap } from "../lib/paginas.js";
import {
  CATEGORIAS,
  CATEGORIA_POR_DEFECTO,
  MAX_TEXTO,
  MAX_CONTACTO,
} from "../lib/sugerencias.js";

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SITIO = "https://cotacerosf.com";

/* La serie histórica del INA, para que las páginas puedan citar el récord y
   la cantidad de días medidos sin que nadie los escriba a mano. La genera
   `node scripts/historia.js`; si todavía no se corrió, las páginas salen
   igual y el bloque de historia queda afuera en vez de reventar el build. */
let historia = null;
try {
  historia = JSON.parse(
    await readFile(join(RAIZ, "datos-abiertos", "historia.json"), "utf8"),
  );
} catch {
  console.warn(
    "AVISO: falta datos/historia.json — corré `node scripts/historia.js`.",
  );
}

/* Una tarjeta de fuente, igual en todas las páginas: qué dato es, qué
   organismo lo publica, y el enlace para ir a mirarlo. `verificar` va aparte
   del enlace principal porque son dos cosas distintas: uno lleva a la página
   del organismo, el otro al dato crudo que usa la app. */
function tarjetaFuente(clave) {
  const f = FUENTES[clave];
  const o = ORGANISMOS[f.organismo];
  return `        <div class="fuente-ficha">
          <p class="fuente-que">${esc(f.titulo)}</p>
          <p class="fuente-quien">${esc(o.nombre)}</p>
          <p class="chico">${esc(f.detalle)}</p>
          <p class="fuente-enlaces">
            <a class="btn sec" href="${f.url}" target="_blank" rel="noopener">Ver fuente</a>
${
  f.verificar
    ? `            <a class="enlace-crudo" href="${esc(f.verificar)}" target="_blank" rel="noopener">Ver el dato crudo</a>\n`
    : ""
}          </p>
        </div>`;
}

/* El renglón chico que va debajo de un número en cualquier pantalla: quién lo
   publica y adónde ir a comprobarlo. Es el mismo patrón que usa la app. */
function selloFuente(clave, extra) {
  const f = FUENTES[clave];
  const o = ORGANISMOS[f.organismo];
  return `<p class="sello-fuente"><span class="k">Fuente</span> ${esc(o.sigla)}${
    extra ? " · " + esc(extra) : ""
  } <a href="${f.url}" target="_blank" rel="noopener">ver</a></p>`;
}

const app = await readFile(join(RAIZ, "app", "index.html"), "utf8");

/* Los puntos salen del HTML de la app, con sus coordenadas oficiales. */
const puntos = [
  ...app.matchAll(
    /<li[^>]*data-lon="([-0-9.]+)"\s+data-lat="([-0-9.]+)"[^>]*>([\s\S]*?)<\/li>/g,
  ),
].map((m) => {
  const trozo = m[3];
  /* El cierre va como `</span\\s*>`: prettier parte la etiqueta en dos líneas
     cuando el atributo es largo, y con `</span>` a secas la captura de un
     punto se pasaba de largo hasta el siguiente cierre. Resultado: el nombre
     de la Parada de ómnibus se llevaba puesta su propia dirección, en la
     página publicada y en datos/puntos.json, que es lo que dibuja el mapa de
     la portada. También se colapsan los saltos de línea del marcado. */
  const t = (cls) => {
    const x = trozo.match(
      new RegExp(`class="${cls}"[^>]*>([\\s\\S]*?)<\\/span\\s*>`),
    );
    return x ? x[1].replace(/<[^>]+>/g, "").replace(/\\s+/g, " ").trim() : "";
  };
  return { lon: +m[1], lat: +m[2], nombre: t("n"), direccion: t("d") };
});
if (puntos.length < 25)
  throw new Error("Se leyeron sólo " + puntos.length + " puntos");

const esc = (t) =>
  String(t).replace(
    /[&<>"]/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c],
  );

/* Números con coma decimal, como se escriben acá. Las páginas los tenían
   escritos a mano —"5,30", "8,20"— y eso es justamente lo que se
   desincroniza cuando una constante cambia. */
const nm = (v, dec = 1) => Number(v).toFixed(dec).replace(".", ",");

/* La fecha de "última actualización del sitio" sale del último commit, no del
   día en que se corre este script. Es la misma razón por la que el sitemap no
   lleva `lastmod`: poner la fecha de hoy en cada corrida es afirmar que el
   sitio cambió cuando puede no haber cambiado nada, y una fecha inventada es
   peor que ninguna. Si no hay git —una copia sin historial—, el renglón no
   sale: preferimos no decir nada antes que decir cualquier cosa. */
function fechaDelSitio() {
  try {
    const iso = execFileSync("git", ["log", "-1", "--format=%cs"], {
      cwd: RAIZ,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
    const p = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
    return p ? `${+p[3]}/${+p[2]}/${p[1]}` : null;
  } catch (e) {
    return null;
  }
}
const FECHA_SITIO = fechaDelSitio();

/* La marca. El mismo dibujo que scripts/marca.js y que el HTML de la portada
   y la app; el id del clipPath cambia por documento para que dos copias en la
   misma página no compartan recorte. */
const marcaSvg = (
  id,
) => `<svg width="30" height="30" viewBox="0 0 60 60" aria-hidden="true">
            <defs><clipPath id="${id}"><rect x="0" y="33" width="60" height="27"/></clipPath></defs>
            <circle cx="30" cy="30" r="21" fill="var(--agua)" clip-path="url(#${id})"/>
            <circle cx="30" cy="30" r="21" fill="none" stroke="currentColor" stroke-width="7"/>
            <line x1="2" y1="33" x2="58" y2="33" stroke="currentColor" stroke-width="4.5" stroke-linecap="round"/>
          </svg>`;

/* El pie, escrito una sola vez. Lo usan las páginas generadas y también la
   portada: al final de este script se reemplaza el bloque entre los
   marcadores PIE de index.html. Sin esto eran dos copias que ya se habían
   desincronizado —a la de las páginas le faltaban una columna y el 103—.

   `frescura` agrega el renglón de "última lectura del INA" abajo del enlace a
   /datos, y va SÓLO en la portada: quien lo llena es js/landing.js, que es lo
   único que lee /api/nivel del lado del sitio. Emitirlo en las nueve páginas
   generadas sería dejar nueve renglones vacíos que no completa nadie. */
const pie = ({ frescura = false } = {}) => `      <footer class="pie-sitio">
        <div>
          <span class="lockup">
            ${marcaSvg("mpf")}
            <span class="lockup-nombre">Cota Cero</span>
          </span>
          <p class="chico">
            Hecha por vecinos de Santa Fe. Sin vínculo con el municipio: la
            orden de evacuación la da la Defensa Civil.
          </p>
          <p class="chip-tel">Emergencias <b>103</b></p>
        </div>
        <div>
          <span class="eti">La app</span>
          <a href="/datos">Cómo se calcula tu nivel de aviso</a>
          <a href="/puntos-de-encuentro">Puntos de encuentro</a>
          <a href="/historia">Cien años del Paraná</a>
          <a href="/preguntas">Preguntas frecuentes</a>
          <a href="/charlas">Charlas para seguir pensando</a>
        </div>
        <div>
          <span class="eti">Transparencia</span>
          <a href="/datos">De dónde salen los datos</a>
${
  frescura
    ? `          <p class="pie-frescura" id="pie-frescura" hidden>
            <span
              class="punto-estado"
              id="frescura-punto"
              aria-hidden="true"></span>
            <span id="frescura-texto"></span>
          </p>\n`
    : ""
}          <a href="/sobre">Quién hace Cota Cero</a>
          <a href="/legal">Legal y privacidad</a>
          <a href="/contacto">Contacto y sugerencias</a>
          <a href="/para-medios">Widget para medios</a>
        </div>
        <div>
          <span class="eti">Datos públicos de</span>
${["ina", "prefectura", "muni", "gestionRiesgos", "ign"]
  .map(
    (k) =>
      `          <a href="${ORGANISMOS[k].url}" target="_blank" rel="noopener">${ORGANISMOS[k].corto}</a>`,
  )
  .join("\n")}
        </div>
      </footer>
${
  FECHA_SITIO
    ? `      <p class="pie-cierre">
        Última actualización del sitio: ${FECHA_SITIO} · Hecho en Santa Fe
      </p>\n`
    : ""
}`;

/* Cabecera, pie y esqueleto compartidos, con la estructura del diseño: nav
   con vuelta a la portada, cabecera con chip y título grande, y el cuerpo en
   bloques de tarjeta. `bloques` es una lista de {kicker, titulo, html, oscuro};
   si un bloque no lleva kicker ni título, sale como texto suelto. */
function bloque({ id, kicker, kickerAlerta, titulo, html, oscuro, borde }) {
  const clases =
    "bloque" + (oscuro ? " oscuro" : "") + (borde ? " borde" : "");
  return `      <section class="${clases}"${id ? ` id="${id}"` : ""}>
${kicker ? `        <p class="kicker${kickerAlerta ? " kicker-alerta" : ""}">${esc(kicker)}</p>\n` : ""}${titulo ? `        <h2>${esc(titulo)}</h2>\n` : ""}${html}
      </section>`;
}


/* Un paso del cálculo: número al costado, y el valor del ejemplo en una
   pastilla al pie. El valor va aparte del texto a propósito — quien recorre la
   página buscando la cuenta tiene que poder saltar de pastilla en pastilla.

   El título va en <h3> y no en <h2>: los pasos cuelgan de «3 · Cómo se
   relacionan», no son secciones de la página. Eran <h2> cuando vivían en
   /mi-cota y ahí sí eran el primer nivel; al fusionarse en /datos dejaban la
   página con diez <h2> y tres de ellos compitiendo con sus propias secciones. */
function paso({ n, titulo, html, eti, valor }) {
  return `      <section class="bloque paso">
        <span class="numerito" aria-hidden="true">${n}</span>
        <div>
          <h3>${esc(titulo)}</h3>
${html}
          <p class="dato-ejemplo">${
            eti ? `<span class="k">${esc(eti)}</span>` : ""
          }<span class="v">${esc(valor)}</span></p>
        </div>
      </section>`;
}

/* `clave` es la entrada de lib/paginas.js: de ahí salen la ruta, el título,
   la descripción y si la página se indexa. Antes cada llamada repetía esos
   cuatro datos y el sitemap se editaba aparte — tres lugares para el mismo
   dato es como se desincronizan. */
function pagina({
  clave,
  migaja,
  antes,
  jsonld,
  chip,
  h1,
  lead,
  acciones,
  anclas,
  bloques,
  sueltos,
  bloquesFinales,
  script,
}) {
  const meta = PAGINAS[clave];
  if (!meta) throw new Error("pagina(): no existe la clave «" + clave + "» en lib/paginas.js");
  const { ruta, titulo, descripcion } = meta;
  const url = SITIO + ruta;
  const estructurados = [
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        {
          "@type": "ListItem",
          position: 1,
          name: "Cota Cero",
          item: SITIO + "/",
        },
        { "@type": "ListItem", position: 2, name: migaja, item: url },
      ],
    },
    ...(jsonld ? [jsonld] : []),
  ];
  return `<!doctype html>
<!--
  ARCHIVO GENERADO — no editar a mano.
  Lo emite scripts/paginas.js y la próxima corrida lo pisa entero.
  Para cambiar algo de esta página se edita el generador:
      node scripts/paginas.js
-->
<html lang="es-AR">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
    <title>${esc(titulo)}</title>
    <link rel="canonical" href="${url}" />
    <meta name="description" content="${esc(descripcion)}" />
    <!-- Dos, con media: pinta la barra del navegador en el teléfono. Un
         solo valor fijo dejaba la barra oscura sobre una página clara. -->
    <meta name="theme-color" content="#fafbfc" media="(prefers-color-scheme: light)" />
    <meta name="theme-color" content="#0e1619" media="(prefers-color-scheme: dark)" />
    <meta property="og:type" content="article" />
    <meta property="og:site_name" content="Cota Cero" />
    <meta property="og:title" content="${esc(titulo)}" />
    <meta property="og:description" content="${esc(descripcion)}" />
    <meta property="og:image" content="${OG_IMAGEN.url}" />
    <meta property="og:image:width" content="${OG_IMAGEN.ancho}" />
    <meta property="og:image:height" content="${OG_IMAGEN.alto}" />
    <meta property="og:locale" content="es_AR" />
    <meta property="og:url" content="${url}" />
    <meta name="twitter:card" content="summary_large_image" />
${meta.indexable ? "" : '    <meta name="robots" content="noindex, follow" />\n'}    <meta name="color-scheme" content="dark light" />
${estructurados.map((b) => `    <script type="application/ld+json">\n${JSON.stringify(b, null, 2).replace(/^/gm, "      ")}\n    </script>`).join("\n")}
    <link rel="manifest" href="/manifest.webmanifest" />
    <link rel="icon" href="/favicon.ico" sizes="32x32" />
    <!-- Google exige que el favicon del buscador sea cuadrado y múltiplo de
         48 px: con 32 lo descarta y muestra el que tenga cacheado. -->
    <link rel="icon" type="image/png" sizes="96x96" href="/img/favicon-96.png" />
    <link rel="apple-touch-icon" href="/img/apple-touch-icon.png" />
    <link rel="preload" href="/vendor/fonts/jakarta-800.woff2" as="font" type="font/woff2" crossorigin />
    <link rel="preload" href="/vendor/fonts/jakarta-500.woff2" as="font" type="font/woff2" crossorigin />
    <link rel="stylesheet" href="/css/app.css" />
    <script src="/js/rio-barra.js" defer></script>
    <script defer src="/_vercel/insights/script.js"></script>
    <!-- Google Analytics. El cargador es externo y la configuración vive en
         /js/analitica.js: el <script> en línea del snippet oficial lo bloquea
         la CSP. No va en /app ni en /widget — ver el comentario de ese
         archivo. -->
    <script
      async
      src="https://www.googletagmanager.com/gtag/js?id=G-4ZWXFWZC9X"></script>
    <script src="/js/analitica.js" defer></script>
${script ? `    <script defer src="${script}"></script>\n` : ""}  </head>
  <body class="landing">
    <!-- La barra es la MISMA que la de la portada: mismo ancho, mismo chip y
         los mismos cuatro destinos. Antes tenía dos enlaces propios —volver y
         contacto— y quedaba a la medida angosta del cuerpo, así que la marca
         se corría de lugar según de qué página vinieras.
         Lo único que no viaja es la píldora del nivel: la llena landing.js,
         que estas páginas no cargan, y un hueco que no completa nadie es peor
         que no tenerlo. -->
    <div class="franja-estado" id="franja-estado" role="status"></div>

    <div class="ancho">
      <nav class="nav-sitio" aria-label="Principal">
        <a class="lockup" href="/" aria-label="Cota Cero, inicio">
          ${marcaSvg("mp")}
          <span class="lockup-nombre">Cota Cero</span>
        </a>
        <span class="chip-borde">NO OFICIAL</span>
        <!-- El nivel en vivo, en la barra: es lo que hace que el dato siga a
             mano después de scrollear más allá del hero. Arranca en gris y sin
             número —no decimos "todo bien" antes de saberlo— y lo llena
             js/landing.js con la misma lectura que el mockup. El aria-label lo
             reescribe ahí también, porque "Río 4,86 m ▲ sube" leído en voz alta
             no es una frase. -->
        <a
          class="pildora-rio"
          id="pildora-rio"
          href="#abrir"
          aria-label="Nivel del río, todavía sin dato">
          <span
            class="punto-estado"
            id="pildora-punto"
            aria-hidden="true"></span>
          <span>
            <span class="pr-etiqueta">Río </span
            ><span id="pildora-nivel">—</span>
          </span>
          <span
            class="pr-tendencia"
            id="pildora-tendencia"
            aria-hidden="true"
            hidden></span>
        </a>
        <details class="nav-menu">
          <summary aria-label="Menú de secciones">
            <span class="nav-burger" aria-hidden="true"></span>
          </summary>
          <div class="nav-enlaces">
            <a href="/datos">Cómo se calcula</a>
            <a href="/puntos-de-encuentro">Dónde ir</a>
            <a href="/preguntas">Preguntas</a>
            <a href="/contacto">Contacto</a>
          </div>
        </details>
      </nav>
    </div>

    <div class="ancho">
${antes ? antes + "\n" : ""}      <header class="pg-cabecera">
${chip ? `        <p class="chip-tinte">${esc(chip)}</p>\n` : ""}        <h1>${esc(h1)}</h1>
${lead ? `        <p class="pg-lead">${lead}</p>\n` : ""}${acciones ? acciones + "\n" : ""}${
        anclas
          ? `        <nav class="chips-ancla" aria-label="En esta página">\n` +
            anclas.map((a) => `          <a href="#${a.id}">${esc(a.n)}</a>`).join("\n") +
            `\n        </nav>\n`
          : ""
      }      </header>

      <main>
${[
  ...bloques.map(bloque),
  ...(sueltos || []),
  ...(bloquesFinales || []).map(bloque),
].join("\n\n")}
      </main>

      <p class="pg-cta"><a class="btn" href="/app">Abrir Cota Cero</a></p>
    </div>

    <div class="pie-envoltura">
${pie()}
    </div>
  </body>
</html>
`;
}

/* ---------- /puntos-de-encuentro ---------- */
/* Los puntos agrupados por dónde caen en el mapa, para que se puedan recorrer
   buscando el propio barrio en vez de leer treinta renglones alfabéticos.

   OJO: los grupos los deducimos de las coordenadas oficiales, y son una ayuda
   de orientación — NO son los distritos del Plan de Contingencia municipal, que
   no publicamos porque no los tenemos. Lo que decide es el punto más cercano a
   tu casa, y el nombre y la dirección de cada tarjeta salen de la capa oficial
   sin tocar. */
const GRUPOS = [
  { n: "Norte de la ciudad", test: (p) => p.lat > -31.6 },
  { n: "Centro", test: (p) => p.lat > -31.645 },
  { n: "Sur", test: (p) => !/Alto Verde/i.test(p.nombre) },
  { n: "Alto Verde", test: () => true },
];

function grupoDe(p) {
  // La Costa es la única división que no depende de un umbral discutible: son
  // los puntos del otro lado de la laguna, a más de 4 km del resto.
  if (p.lon > -60.65) return "La Costa — Colastiné y La Guardia";
  return (GRUPOS.find((g) => g.test(p)) || GRUPOS[GRUPOS.length - 1]).n;
}

const ORDEN = [
  "Norte de la ciudad",
  "Centro",
  "Sur",
  "Alto Verde",
  "La Costa — Colastiné y La Guardia",
];

let numero = 0;
const agrupados = ORDEN.map((nombre) => ({
  nombre,
  items: puntos.filter((p) => grupoDe(p) === nombre),
})).filter((g) => g.items.length);

const lista = agrupados
  .map(
    (g) => `        <h2 class="grupo-puntos">${esc(g.nombre)}</h2>
        <ul class="rejilla-puntos">
${g.items
  .map(
    (p) => `          <li>
            <a class="punto" href="geo:${p.lat},${p.lon}?q=${p.lat},${p.lon}(${encodeURIComponent(p.nombre)})">
              <span class="np">${++numero}</span>
              <span class="txt">
                <span class="n">${esc(p.nombre)}</span>
                <span class="d">${esc(p.direccion)}</span>
              </span>
            </a>
          </li>`,
  )
  .join("\n")}
        </ul>`,
  )
  .join("\n\n");

/* Compartir sin una línea de JavaScript: wa.me abre WhatsApp con el texto ya
   puesto. navigator.share sería más lindo y obligaría a meter un script en una
   página que hoy no tiene ninguno — y que tiene que abrir sin conexión. */
const TEXTO_COMPARTIR = encodeURIComponent(
  "Los " +
    puntos.length +
    " puntos de encuentro oficiales de Santa Fe ante una evacuación, con dirección y cómo llegar: " +
    SITIO +
    "/puntos-de-encuentro",
);

const htmlPuntos = pagina({
  clave: "puntos",
  migaja: "Puntos de encuentro",
  chip: "Santa Fe · oficiales del municipio",
  h1: "Los " + puntos.length + " puntos de encuentro ante una inundación en Santa Fe",
  lead:
    "Ante una evacuación, acercate al más próximo a tu casa. Esta página " +
    "funciona sin conexión y se puede compartir por WhatsApp. En la app los ves " +
    "en el mapa, ordenados por cercanía.",
  acciones: `        <p class="pg-acciones">
          <a class="btn" href="/app?ir=donde">Ver en el mapa de la app</a>
          <a class="btn sec" href="https://wa.me/?text=${TEXTO_COMPARTIR}" target="_blank" rel="noopener">Compartir esta lista</a>
        </p>`,
  jsonld: {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "Puntos de encuentro ante inundación — Santa Fe",
    numberOfItems: puntos.length,
    itemListElement: puntos.map((p, i) => ({
      "@type": "ListItem",
      position: i + 1,
      item: {
        "@type": "Place",
        name: p.nombre,
        address: {
          "@type": "PostalAddress",
          streetAddress: p.direccion,
          addressLocality: "Santa Fe",
          addressCountry: "AR",
        },
        geo: { "@type": "GeoCoordinates", latitude: p.lat, longitude: p.lon },
      },
    })),
  },
  bloques: [],
  sueltos: [
    `      <div class="aviso grave">
        Los puntos abren cuando el municipio los activa, y esta página no lo
        sabe en tiempo real. <b>Antes de mover a alguien, llamá al 103
        (Defensa Civil).</b>
      </div>`,
    `      <section>
${lista}
        <p class="chico" style="margin-top:20px">
          Fuente: capa <code>puntos_de_encuentro</code> del GeoServer público de
          la Municipalidad de Santa Fe, la misma que dibuja el GeoPortal. Los
          grupos son nuestros, deducidos de las coordenadas para que puedas
          ubicarte: no son los distritos del Plan de Contingencia.
        </p>
        <div class="telefonos-emergencia">
          <div><b>103</b><span>Defensa Civil — activación de puntos y evacuación</span></div>
          <div><b>107</b><span>Emergencias médicas</span></div>
          <div><b>911</b><span>Policía</span></div>
        </div>
      </section>`,
  ],
  bloquesFinales: [
    {
      kicker: "Cuándo ir",
      titulo: "Cuando lo indiquen para tu zona",
      html: `        <p>
          No hace falta esperar a tener agua en la puerta: si Defensa Civil o el
          municipio avisan, salí. El punto de encuentro es donde te van a estar
          esperando y desde donde se organiza el traslado a un centro de
          evacuados si hiciera falta.
        </p>
        <p>
          Si tenés que moverte, <b>no cruces agua en movimiento</b>, ni a pie ni
          en auto. Treinta centímetros de corriente arrastran a una persona y
          sesenta arrastran un vehículo. Abajo no se ve el pozo, la cloaca
          abierta ni el cable caído.
        </p>`,
    },
    {
      kicker: "Qué llevar",
      titulo: "Lo mínimo, en una bolsa",
      html: `        <p class="chico">
          La <b>Mochila de Emergencia</b> del Plan de Contingencia municipal,
          textual:
        </p>
        <ul class="pasos">
          <li>Documentos importantes en bolsa de plástico (DNI y todo otro documento familiar de importancia).</li>
          <li>Botiquín de primeros auxilios y medicinas habituales.</li>
          <li>Manta ligera y ropa de abrigo.</li>
          <li>Linterna y baterías extra.</li>
          <li>Radio y pilas para mantenerse informados si se corta la luz.</li>
        </ul>
        <p class="chico">
          En la app la lista es más larga —agua, comida, cargador, cosas de los
          animales— y ahí está marcado cuáles son del plan municipal y cuáles
          agregamos nosotros.
        </p>
        <p class="chico">
          El plan también pide cortar la energía eléctrica y cerrar las llaves
          de gas antes de salir, y llamar al <b>103 (COBEM)</b> si en la
          familia hay alguien con discapacidad.
        </p>
${selloFuente("emergencias")}`,
    },
  ],
});

/* ---------- /datos ----------
   Esta página absorbió a `/mi-cota` (que ahora redirige acá con un 301, ver
   vercel.json). Eran dos páginas explicando la misma resta, la misma
   discusión del 8,20 y la misma comprobación de 1992, con el mismo H2
   «Honestidad también acá» escrito dos veces — y compitiendo entre sí por las
   mismas búsquedas.

   Contesta dos preguntas encadenadas: "¿cuál es la cota de mi terreno?" y
   "¿de dónde sale todo esto?". No es documentación para programadores: es el
   lugar donde una persona comprueba que no le estamos inventando el número.

   Va en este orden a propósito: los dos datos que la app lee (el río y el
   terreno), después la cuenta que los relaciona, después qué tan firme es
   todo eso, y al final las fuentes para ir a mirarlas. Quien lee las tres
   primeras secciones ya entendió lo que necesita.

   UN SOLO EJEMPLO EN TODA LA PÁGINA: Colastiné Norte, cota 15,80 m IGN, a
   11 km del puerto. Antes había dos juegos de números —uno acá con Arroyo
   Leyes a 24 km y otro en /mi-cota con Colastiné a 11— y quien leía las dos
   páginas no podía rehacer ninguna cuenta. Arroyo Leyes quedó reservado para
   lo único que le es propio: la comprobación de 1992. */

/* El corte del terreno. Es la explicación que más nos costó escribir en
   palabras y la que sale sola en un dibujo: el río sube, la superficie del
   agua es una sola, y tu terreno está a cierta altura sobre esa misma
   referencia. Va en SVG inline porque tiene que verse sin conexión, pesar
   nada y seguir el tema claro/oscuro por sí solo. */
const CORTE_SVG = `        <svg class="corte" viewBox="0 0 340 190" role="img"
          aria-label="Corte del terreno: a la derecha el río, a la izquierda una casa sobre terreno más alto. La superficie del agua se prolonga en línea punteada hasta debajo de la casa, y la diferencia entre esa línea y el piso de la casa es el margen.">
          <defs>
            <linearGradient id="grad-agua" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stop-color="var(--agua)" stop-opacity=".55"/>
              <stop offset="1" stop-color="var(--agua)" stop-opacity=".18"/>
            </linearGradient>
          </defs>
          <path d="M0 118 L96 118 L150 128 L214 141 L258 150 L340 150 L340 190 L0 190 Z"
            fill="var(--tierra)" opacity=".22"/>
          <path d="M214 141 L258 150 L340 150 L340 190 L214 190 Z" fill="url(#grad-agua)"/>
          <line x1="214" y1="141" x2="340" y2="141" stroke="var(--agua)" stroke-width="2"/>
          <line x1="12" y1="141" x2="214" y2="141" stroke="var(--agua)" stroke-width="1.5"
            stroke-dasharray="5 4" opacity=".8"/>
          <g transform="translate(52 86)">
            <path d="M0 14 L21 0 L42 14 L42 32 L0 32 Z" fill="none"
              stroke="var(--texto)" stroke-width="2" stroke-linejoin="round"/>
            <rect x="16" y="20" width="10" height="12" fill="var(--texto)" opacity=".45"/>
          </g>
          <line x1="26" y1="118" x2="26" y2="141" stroke="var(--acento)" stroke-width="2"/>
          <path d="M22 122 L26 118 L30 122" fill="none" stroke="var(--acento)" stroke-width="2"/>
          <path d="M22 137 L26 141 L30 137" fill="none" stroke="var(--acento)" stroke-width="2"/>
          <text x="36" y="134" fill="var(--acento)" font-size="12" font-family="var(--sans)">margen</text>
          <text x="10" y="78" fill="var(--texto)" font-size="12" font-family="var(--sans)">cota del terreno</text>
          <text x="228" y="134" fill="var(--agua)" font-size="12" font-family="var(--sans)">superficie del agua</text>
          <text x="292" y="176" fill="var(--tenue)" font-size="12" font-family="var(--sans)">Paraná</text>
        </svg>`;

/* La cuenta, en vertical y con un solo ejemplo. Tres sumandos y un total: si
   hubiera dos ejemplos o dos cuentas juntas se vuelve ilegible, que es
   exactamente lo que pasaba antes. */
const cuentaVertical = (filas) => `        <div class="cuenta-vertical">
${filas
  .map(([k, v, tipo]) =>
    tipo === "op"
      ? `          <div class="cv-op" aria-hidden="true">${k}</div>`
      : `          <div class="cv-fila${tipo ? " cv-" + tipo : ""}">
            <span class="cv-k">${esc(k)}</span><span class="cv-v">${esc(v)}</span>
          </div>`,
  )
  .join("\n")}
        </div>`;

/* El récord sale de datos-abiertos/historia.json y no escrito a mano: es la
   misma serie del INA de la que sale el número que muestra la app. */
const recordHist = historia
  ? [...historia.anios].sort((a, b) => b[1] - a[1])[0]
  : null;
const RECORD_M = recordHist ? nm(recordHist[1], 2) : "7,43";
const RECORD_ANIO = recordHist ? recordHist[0] : 1992;

const htmlDatos = pagina({
  clave: "datos",
  migaja: "La cota de tu terreno y los datos",
  chip: "El cálculo y sus fuentes",
  h1: "¿Cuál es la cota de tu terreno en Santa Fe, y de dónde sale?",
  lead:
    "Cuando informan que el río está a 5,30 m en el puerto, ese número no dice " +
    "nada sobre tu casa. Acá está lo que hace falta para que diga algo: la " +
    "cota de tu terreno, la cuenta completa con un ejemplo que podés rehacer a " +
    "mano, y <b>de dónde sale cada dato</b> — incluido lo que todavía no sabemos.",
  jsonld: {
    "@context": "https://schema.org",
    "@type": "Article",
    headline:
      "La cota de tu terreno en Santa Fe: el cálculo y de dónde salen los datos",
    inLanguage: "es-AR",
    author: { "@type": "Person", name: "Ariel Benz" },
    mainEntityOfPage: SITIO + "/datos",
  },
  anclas: [
    { id: "rio", n: "El río" },
    { id: "terreno", n: "Tu terreno" },
    { id: "cuenta", n: "La cuenta" },
    { id: "firme", n: "Qué tan firme es" },
    { id: "fuentes", n: "Las fuentes" },
  ],
  bloques: [
    {
      html: `        <p>
          Hacen falta tres datos: <b>la altura de tu terreno</b>, <b>dónde está
          el cero de la regla del puerto</b> y <b>a qué distancia del puerto
          estás</b>. De los tres sale <b>tu umbral estimado</b> —en la app,
          «tu nivel de aviso»—: la lectura del
          hidrómetro a partir de la cual el nivel de agua equivalente alcanzaría
          la cota de tu terreno. Es una referencia para prepararte, no el minuto
          en que entra el agua. Cota Cero <b>no genera información hidrológica
          propia</b>: toma datos públicos, los combina y los cita.
        </p>`,
    },
    {
      id: "rio",
      kicker: "1 · El nivel del río",
      titulo: "Lo mide el Estado, no nosotros",
      html: `        <p>
          El número grande de la app es la <b>lectura del hidrómetro del Puerto
          de Santa Fe</b>. La escala la lee la Prefectura Naval y la publica el
          Instituto Nacional del Agua. Cota Cero la muestra; no la mide, no la
          corrige y no la promedia.
        </p>
        <div class="ficha-estacion">
          <div><span class="k">Estación</span><span class="v">${esc(ESTACION.nombre)} · ${esc(ESTACION.abreviatura)}</span></div>
          <div><span class="k">Río</span><span class="v">${esc(ESTACION.rio)}</span></div>
          <div><span class="k">Serie del INA</span><span class="v">n.º ${ESTACION.serieId} — altura hidrométrica</span></div>
          <div><span class="k">Quién la lee</span><span class="v">${esc(ESTACION.propietario)}</span></div>
          <div><span class="k">Alerta</span><span class="v">${nm(ESTACION.alerta, 2)} m</span></div>
          <div><span class="k">Evacuación</span><span class="v">${nm(ESTACION.evacuacion, 2)} m</span></div>
        </div>
        <p class="chico">
          La app lee la <b>API oficial del sistema de alerta del INA</b>: el
          dato llega con su hora y los umbrales los publica la propia estación,
          no son constantes nuestras. Si la API falla, cae sola al reporte
          diario.
        </p>
        <div class="aviso">
          Si ninguna de las dos responde, la app muestra <b>la última lectura
          guardada con su fecha</b> y lo dice en pantalla. Pasadas 48 horas deja
          de presentarla como vigente. Nunca inventa un valor.
        </div>
        ${selloFuente("nivelRio", "serie 30, altura hidrométrica")}`,
    },
    {
      id: "terreno",
      kicker: "2 · La altura de tu terreno",
      titulo: "La cota sale de las curvas de nivel del municipio",
      html: `        <p>
          Todo terreno tiene una altura sobre el nivel del mar, medida en el
          sistema oficial argentino (IGN): esa es su <b>cota</b>. La
          Municipalidad publica las <b>169 curvas de nivel</b> de la ciudad,
          líneas que unen los puntos que están a la misma altura, trazadas cada
          50 cm. Dicho fácil: si caminás sobre una curva, no subís ni bajás.
        </p>
        <div class="curvas-dibujo" aria-hidden="true">
          <div class="cd-linea"><span>16,0 m</span><i></i></div>
          <div class="cd-casa">🏠 tu casa</div>
          <div class="cd-linea"><span>15,5 m</span><i></i></div>
        </div>
        <p class="chico">
          Si tu casa cae entre dos curvas, Cota Cero estima su altura a partir
          de las dos. Es una estimación, no una medición de tu terreno: la
          curva pasa cerca, no por tu puerta.
        </p>
        <p>
          Por eso el cálculo <b>descuenta medio metro</b> y trabaja siempre con
          el escenario pesimista. Y donde las curvas no llegan —cubren la
          ciudad, no toda el área metropolitana— la app te dice que no tiene el
          dato y te pide la cota a mano, en vez de caer a una fuente peor.
        </p>

        <h3>Por qué no un satélite</h3>
        <p>
          Los modelos de elevación globales miden <b>superficie</b>: techos y
          copas de árboles, no el piso. La app usaba uno y se lo midió contra
          <b>36 puntos de nivelación del IGN</b>, medidos en campo al milímetro:
          el sesgo era chico —0,89 m— pero el <b>desvío estándar era de
          7,46 m</b>, con casos de hasta 23 m, y dentro de la ciudad
          sobreestimaba 2,15 m de media. Entre la alerta
          (${nm(ESTACION.alerta, 2)} m) y el récord de ${RECORD_ANIO}
          (${RECORD_M} m) hay <b>2,13 metros</b>: el error de la fuente era más
          grande que toda la escala de la decisión.
        </p>
        <p class="chico">
          Ni la mejor curva reemplaza un relevamiento de tu terreno: no sabe si
          está elevado sobre la vereda ni si la casa tiene escalones. El número
          que vale es el de un relevamiento topográfico, el de la escritura o el
          plano de mensura, o el que te dé el municipio. Si lo conseguís,
          cargalo a mano en la app.
        </p>
        ${selloFuente("topografia", "curvas de nivel de la ciudad")}`,
    },
    {
      id: "cuenta",
      kicker: "3 · Cómo se relacionan",
      titulo: "Dos alturas, una resta",
      html: `        <p>
          El río tiene un número y tu terreno tiene otro. Lo único que hace Cota
          Cero es ponerlos en la misma escala para poder restarlos.
        </p>
        <p>
          La lectura del hidrómetro no es una altura sobre el nivel del mar: es
          cuánto sube el agua por encima del <b>cero de esa escala</b>, que está
          clavado a una altura conocida. Sumando las dos cosas —y la corrección
          por estar río arriba— se obtiene a qué altura está la superficie del
          agua, en el mismo sistema en el que están las curvas de nivel.
        </p>
${cuentaVertical([
  ["Lectura del hidrómetro", "5,00 m"],
  ["+", "", "op"],
  ["Cero del hidrómetro", "8,20 m IGN"],
  ["+", "", "op"],
  ["Corrección río arriba (11 km)", "0,50 m"],
  ["=", "", "op"],
  ["Superficie de agua equivalente", "13,70 m IGN", "total"],
])}
${CORTE_SVG}
        <p>
          Lo que a una persona le sirve, sin embargo, no es «cuánta agua hay
          hoy» sino <b>«¿qué tendría que marcar el hidrómetro para que el agua
          llegue a la altura de mi terreno?»</b>. Es la misma cuenta despejada,
          y son los tres pasos de acá abajo.
        </p>`,
    },
  ],
  sueltos: [
    paso({
      n: 1,
      titulo: "La altura de tu terreno, en metros IGN",
      html: `          <p>
            La app la saca de las curvas de nivel del municipio, o la escribís
            vos si la conocés. Cuando sale interpolada entre dos curvas, el
            cálculo usa el <b>escenario pesimista</b>: medio metro por debajo.
            Es el número con el que hay que decidir.
          </p>`,
      eti: "Ejemplo · Colastiné Norte",
      valor: "15,80 m → 15,30 m",
    }),
    paso({
      n: 2,
      titulo: "Restar el cero del hidrómetro: 8,20 m",
      html: `          <p>
            Restarlo pasa tu terreno a «metros de hidrómetro» — la misma escala
            del número que publica el INA todos los días.
          </p>
          <p class="chico">
            Cada escala tiene su propio cero, así que <b>las alturas de
            distintas ciudades no se comparan entre sí</b>. Y para Santa Fe el
            INA publica hoy 8,378, no 8,20: esa diferencia de 18 cm está sin
            resolver y no la escondemos. <a href="#abiertas">Por qué usamos
            8,20</a>.
          </p>`,
      valor: "15,30 − 8,20 = 7,10 m",
    }),
    paso({
      n: 3,
      titulo: "Restar el desnivel río arriba: 0,045 m por km",
      html: `          <p>
            El río no es una pileta: la superficie del agua tiene pendiente y
            río arriba está más alta que en el Puerto. Si tu zona está aguas
            arriba, tu umbral corresponde a una lectura <b>menor</b> en el
            hidrómetro. Colastiné Norte está a 11 km: 11 × 0,045 = 0,495, que
            redondeamos a 0,50.
          </p>`,
      eti: "Pendiente · 11 km",
      valor: "− 0,50 m",
    }),
    `      <section class="bloque oscuro resultado">
        <p class="kicker">Resultado del ejemplo</p>
        <p class="dato-grande">6,60 m</p>
        <p class="cuenta-chica">15,30 − 8,20 − 0,50</p>
        <p>
          Cuando el hidrómetro del Puerto se acerque a <b>6,60 m</b>, el nivel
          de agua equivalente alcanza la cota de ese terreno según el modelo.
          <b>No significa que el terreno se inunde exactamente a ese nivel</b>:
          es la referencia para prepararse.
        </p>
        <p>
          La app lo muestra redondeado, <b>≈ 6,6 m</b>, porque la cota viene de
          curvas cada 0,5 m y más decimales serían una precisión que el dato no
          tiene. Con el récord histórico en ${RECORD_M} m, en ${RECORD_ANIO} el
          río pasó ese umbral <b>83 centímetros antes</b> del pico.
        </p>
      </section>`,
    `      <section class="bloque">
        <div class="aviso">
          <b>Eso es una referencia hidráulica, no una predicción de
          inundación.</b> Dice a qué lectura del hidrómetro la superficie de
          agua equivalente alcanzaría la cota de tu terreno según este modelo.
          Lo que pase de verdad depende de las defensas, del bombeo, del viento
          y de la lluvia — nada de eso está en la cuenta.
        </div>
      </section>`,
    bloque({
      id: "firme",
      kicker: "4 · Qué tan firme es esto",
      titulo: "Lo que está en discusión, lo que se comprobó y lo que falta",
      html: `        <h3 id="abiertas">Dos números que todavía no están cerrados</h3>
        <p>
          Están acá, y no escondidos en un archivo interno, porque son
          exactamente las dos cosas que un especialista debería revisarnos.
        </p>
        <p>
          <b>El cero del hidrómetro: 8,20 o 8,38.</b> Usamos <b>8,20 m</b>,
          que es el de la normativa: el Reglamento de Edificaciones de San José
          del Rincón fija la cota de edificación en
          <span class="cita">16.00 I.G.M (7.80 m Hidrómetro Pto Santa Fe)</span>
          —la diferencia es exactamente 8,20— y coincide con el que da un
          ingeniero hidrólogo de la FICH-UNL. Pero el propio INA publica
          <b>8,378 m</b> para esta estación, de una campaña INA-IGN de diciembre
          de 2016.
        </p>
        <p>
          Los <b>18 cm</b> no son de redondeo: en enero de 2017 el país cambió de
          sistema de alturas —del SRVN71 al SRVN16— y antes convivían
          referencias del ex Ministerio de Obras Públicas, de Obras Sanitarias y
          de sistemas municipales. Pueden ser el mismo punto medido en dos
          sistemas distintos. <b>Por eso no la cambiamos:</b> lo que importa no
          es cuál número es más nuevo, sino que el cero y las curvas de nivel
          estén en el <b>mismo</b> sistema — y las curvas no declaran el suyo.
          Mover el cero a 8,378 metería un sesgo de 18 cm en todos los umbrales
          sin que nadie se entere.
        </p>
        <p>
          <b>La pendiente: 0,045 m por kilómetro.</b> Se contrastó con la crecida
          de ${RECORD_ANIO} y da bien ahí, pero es <b>una sola observación</b>.
          El reglamento de Rincón, 16 km río arriba, convierte cota a hidrómetro
          <b>sin ninguna corrección por distancia</b>; con la pendiente de la app
          serían 72 cm más. O el reglamento simplifica, o la pendiente real en
          ese tramo es otra. Depende del tramo, del caudal y de la condición
          hidráulica del momento, y nosotros usamos <b>un solo valor para todas
          las zonas</b>.
        </p>
        ${selloFuente("altimetria", "ceros de escala y sistema de alturas")}

        <h3 id="no-dice">Estar por debajo del agua no es estar inundado</h3>
        <p>
          «Si mi terreno está por debajo del nivel equivalente del río, ¿por qué
          no estoy con agua adentro?» Porque buena parte de la ciudad está
          protegida por obras: <b>defensas y terraplenes</b>, <b>compuertas</b>
          que impiden que el río entre por los desagües, <b>bombeo</b> y
          <b>reservorios</b>. El modelo asume terreno parejo y agua libre: no
          sabe si entre el río y tu casa hay un terraplén o no hay nada.
        </p>
        <p>
          Y mira <b>una sola</b> de las dos maneras de inundarse, la
          <b>fluvial</b>. Santa Fe también se inunda por lluvia —el riesgo
          <b>pluvial</b>—, sola o combinada con el Salado, y un barrio puede
          tener margen amplio contra el Paraná y entrar en emergencia igual. Los
          dos se cruzan: con el río alto las bombas no pueden desagotar contra el
          agua de afuera. El municipio planifica para río en 6 m <b>más</b>
          lluvia de 200 a 300 mm.
        </p>
        <div class="aviso">
          Al revés también vale: una defensa protege mientras funciona. En 2003
          el agua entró por un tramo abierto de una defensa existente. Que haya
          obra no es garantía, y la app no sabe en qué estado está.
        </div>
        ${selloFuente("emergencias", "Plan de Contingencia")}

        <h3>Coincidir con ${RECORD_ANIO} no es estar validado</h3>
        <table class="cuenta">
          <tr><td>Puerto de Santa Fe, junio de ${RECORD_ANIO}</td><td>${RECORD_M} m</td></tr>
          <tr><td>Arroyo Leyes, 24 km río arriba — registrado</td><td>16,70 IGN</td></tr>
          <tr class="total"><td>Lo que da este modelo</td><td>16,71 IGN</td></tr>
        </table>
        <p style="margin-top:20px">
          Un centímetro. Es el mejor dato independiente que tenemos, y es
          <b>un punto, de una crecida, de un año</b>. Una coincidencia histórica
          no demuestra que el modelo valga para todos los lugares y todas las
          condiciones.
        </p>
        <div class="rejilla-2" style="margin-top:18px">
          <div class="mini-tarjeta">
            <p class="kicker">Lo que sí hay</p>
            <p><b>Comprobación histórica.</b> El modelo se contrastó contra un
            caso independiente y coincidió muy bien.</p>
          </div>
          <div class="mini-tarjeta">
            <p class="kicker kicker-alerta">Lo que falta</p>
            <p><b>Validación científica.</b> Ningún organismo ni universidad
            revisó este modelo. Nadie lo aprobó.</p>
          </div>
        </div>
        <p class="chico" style="margin-top:18px">
          Hasta que lo revisen especialistas —Gestión de Riesgos, INA, FICH-UNL,
          Recursos Hídricos— lo que la app publica son <b>niveles de referencia
          estimados</b>, y así están nombrados en toda la interfaz. Cota Cero no
          tiene vínculo con esos organismos ni cuenta con su aval: usa sus datos
          públicos y los cita.
        </p>`,
    }),
    bloque({
      oscuro: true,
      kicker: "Lo que todavía no sabe",
      titulo: "Honestidad también acá",
      html: `        <ul class="pasos">
          <li><b>En qué sistema de alturas están las curvas municipales.</b> Los
            metadatos no lo declaran, y de eso depende si el cero correcto es
            8,20 o 8,378.</li>
          <li><b>Si la pendiente vale en todos los tramos.</b> Está contrastada
            en un punto de una crecida.</li>
          <li><b>Cuánto error tiene de verdad la cota interpolada.</b> El ±0,5 m
            que informa la app es la convención cartográfica, no una medición.
            Habría que contrastarla contra la red de puntos fijos del municipio,
            que no está publicada.</li>
          <li><b>Los kilómetros río arriba de cada zona.</b> Sólo Arroyo Leyes
            (24 km) está publicado; el resto son estimaciones propias. A 4,5 cm
            por km, equivocarse 5 km son 22 cm.</li>
          <li><b>Si hay defensas, bombeo o desagües entre el río y tu casa.</b>
            Cambia el resultado más que cualquiera de las constantes.</li>
          <li><b>Nada sobre la lluvia sobre tu barrio.</b> El agua puede llegar
            antes por el desagüe que por el río.</li>
        </ul>
        <p class="chico">
          Cuando no sabemos algo con precisión suficiente, preferimos decirlo
          antes que rellenar el hueco con un número que parezca firme.
        </p>`,
    }),
    bloque({
      id: "fuentes",
      kicker: "5 · Las fuentes",
      titulo: "Cada dato, con su enlace",
      html: `        <p>
          Todo lo que muestra la app sale de acá. Cada ficha lleva dos enlaces:
          la página del organismo y el dato crudo, tal como lo pide la app.
        </p>
        <div class="fuentes-rejilla">
${["nivelRio", "topografia", "emergencias", "altimetria", "historia", "cartografia"]
  .map(tarjetaFuente)
  .join("\n")}
        </div>
        <details class="h-detalle" style="margin-top:22px">
          <summary>Investigación, antecedentes y normativa</summary>
          <p class="chico">
            No aportan ningún número al cálculo: explican el contexto.
          </p>
          <ul class="pasos">
            <li><b>${esc(ORGANISMOS.fich.nombre)}</b> — ${esc(ORGANISMOS.fich.que)}
              Es la institución natural para revisar este modelo.
              <a href="${ORGANISMOS.fich.url}" target="_blank" rel="noopener">Ver</a></li>
${NORMATIVA.map(
  (n) =>
    `            <li><b>${esc(n.n)}</b> — ${esc(n.que)} <a href="${n.url}" target="_blank" rel="noopener">Ver</a></li>`,
).join("\n")}
          </ul>
          <p class="chico">
            La prensa se usa para contexto histórico o para llegar a una fuente
            primaria, nunca para un número del cálculo: si una nota cita a un
            especialista o a un documento, buscamos el original.
          </p>
        </details>`,
    }),
  ],
});

/* ---------- /preguntas ---------- */
const PREGUNTAS = [
  [
    "¿Por qué mi nivel de aviso no es el 5,30 de la alerta?",
    "La alerta oficial es una sola para toda la ciudad; tu terreno tiene su propia altura. Si tu terreno es bajo o está río arriba, el agua puede comprometerte antes de los 5,30 m — mostrar eso es exactamente el propósito de la app. Al revés también: hay terrenos altos donde el agua llega bastante después.",
  ],
  [
    "¿El agua entra justo cuando el río llega a mi nivel de aviso?",
    "No. Es un cálculo aproximado. No sabe del terraplén (el anillo de defensas), de las bombas ni de la lluvia. El agua puede llegar antes por los desagües, o no llegar. Sirve para saber cuándo prepararte, no para adivinar el minuto. Por eso el número va redondeado: la altura del terreno sale de un plano con líneas cada medio metro.",
  ],
  [
    "¿La app avisa sola cuando el río sube?",
    "Sí, si activás los avisos. Llega una notificación cuando el nivel sube 15 cm desde el último aviso o cuando pasa la alerta o la evacuación de la ciudad. El aviso se arma en tu teléfono: el servidor no conoce tu nivel de aviso ni tu zona, sólo despierta a la app, que compara contra el número guardado en tu dispositivo.",
  ],
  [
    "¿De dónde sale la altura de mi terreno?",
    "De las curvas de nivel de la Municipalidad de Santa Fe, trazadas cada 50 cm en metros IGN: por eso el margen de ±0,5 m. También podés escribirla vos, que figura en planos de mensura y escrituras. No se usa elevación satelital: se midió contra puntos de campo del IGN y su error superaba la escala entera de la decisión.",
  ],
  [
    "¿Qué hago si mi dirección queda fuera de la zona con curvas?",
    "La app te lo dice y te pide la cota a mano, en vez de usar una fuente peor. Las curvas municipales cubren la ciudad, no toda el área metropolitana.",
  ],
  [
    "¿Funciona sin conexión?",
    "Sí. Una vez cargada, la app guarda lo esencial: tu nivel de aviso, tu plan familiar, los 30 puntos de encuentro y la última lectura del río con su fecha. Sin conexión ves esa última lectura, nunca un número inventado.",
  ],
  [
    "¿Quién ve mi plan familiar y mis datos?",
    "Nadie. El plan, tu nivel de aviso y tu zona se guardan sólo en tu teléfono. Lo único que viaja a un servidor es el texto que mandes por el formulario de sugerencias, y el formulario lo dice. Aparte, la app cuenta cuánta gente la usa con un número al azar que no identifica a nadie.",
  ],
  [
    "¿Esto reemplaza a la alerta de Defensa Civil?",
    "No. Es un cálculo aproximado para prepararte antes, hecho por un vecino y sin vínculo con el municipio. La orden de evacuación la da Defensa Civil, al 103. Si el río llega a tu nivel de aviso, armá el plan y llamá al 103 si tenés dudas.",
  ],
  [
    "¿Cada cuánto se actualiza el nivel?",
    "El INA publica una lectura por día del hidrómetro del Puerto. La app la toma de ese reporte y muestra siempre la fecha del dato, así sabés qué tan fresco es.",
  ],
];

const htmlPreguntas = pagina({
  clave: "preguntas",
  migaja: "Preguntas frecuentes",
  h1: "Preguntas sobre el río, tu cota y las inundaciones",
  lead: "Las dudas que más aparecen, contestadas sin vueltas.",
  jsonld: {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: PREGUNTAS.map(([q, a]) => ({
      "@type": "Question",
      name: q,
      acceptedAnswer: { "@type": "Answer", text: a },
    })),
  },
  bloques: [
    {
      html: PREGUNTAS.map(
        ([q, a]) => `        <details class="faq">
          <summary>${esc(q)}</summary>
          <p>${esc(a)}</p>
        </details>`,
      ).join("\n"),
    },
    {
      oscuro: true,
      titulo: "¿Tu pregunta no está?",
      html: `        <p>
          Dentro de la app hay un formulario de sugerencias al pie. Ojo: no es
          una vía de auxilio — ante una emergencia llamá al <b>103</b>.
        </p>`,
    },
  ],
  sueltos: [
  ],
});

/* ---------- /charlas ----------
   Cada dato de acá —evento, año, duración— está verificado contra la ficha de
   ted.com, no copiado de un borrador. Dos salieron distintos de lo que decía
   el diseño: la de Vicki Arroyo es de TEDGlobal, no de TED a secas, y la de
   Kongjian Yu es de TEDxBoston 2022, no una charla TED sin fecha. La de Yu va
   sin duración a propósito: no la pude confirmar en la fuente y no se inventa
   un número para llenar un casillero. */
const CHARLAS = [
  {
    tono: "peligro",
    sello: "TEDx",
    duracion: "9 min",
    titulo: "Cómo dar un paso al frente ante un desastre",
    ficha: "Caitria y Morgan O'Neill · TEDxBoston, 2012",
    original: "How to step up in the face of disaster",
    url: "https://www.ted.com/talks/caitria_morgan_o_neill_how_to_step_up_in_the_face_of_disaster",
    texto:
      "Dos hermanas de 20 y 24 años organizaron la recuperación de su pueblo tras un tornado y convirtieron lo aprendido en un sistema para cualquier comunidad. Es la charla más cercana al espíritu de Cota Cero: los vecinos no reemplazan a las autoridades — se preparan para ayudarlas mejor.",
  },
  {
    tono: "peligro",
    sello: "TEDx",
    duracion: "Charla",
    titulo: "Sabemos cómo salvar vidas en un desastre: ¿por qué no lo hacemos?",
    ficha: "Sarah Tuneberg · TEDxMileHigh, 2019",
    original: "We know how to save lives in disasters - why don't we?",
    url: "https://www.ted.com/talks/sarah_tuneberg_why_we_need_to_invest_in_data_driven_disaster_mitigation",
    texto:
      "Llamar «naturales» a las inundaciones, los incendios y las olas de calor tapa la responsabilidad humana y nos deja a todos libres de culpa. Su punto es incómodo y es el correcto: lo que falta no es saber cómo evitar muertes, sino decidir invertir en evitarlas. De toda la lista, es la que queda más cerca de 2003.",
  },
  {
    tono: "alerta",
    sello: "TED",
    duracion: "15 min",
    titulo: "Preparémonos para nuestro nuevo clima",
    ficha: "Vicki Arroyo · TEDGlobal, 2012",
    original: "Let's prepare for our new climate",
    url: "https://www.ted.com/talks/vicki_arroyo_let_s_prepare_for_our_new_climate",
    texto:
      "Adaptación en serio: casas y ciudades preparadas para más inundaciones y más incertidumbre, con ejemplos concretos de todo el mundo — incluida Nueva Orleans, su ciudad. El argumento de fondo es el de esta app: prepararse antes cuesta mucho menos que reconstruir después.",
  },
  {
    tono: "agua",
    sello: "TEDx",
    duracion: "Charla",
    titulo: "Ciudades esponja, planeta esponja",
    ficha: "Kongjian Yu · TEDxBoston, 2022",
    original: "Sponge City and Sponge Planet",
    url: "https://www.ted.com/talks/kongjian_yu_sponge_city_and_sponge_planet",
    texto:
      "El paisajista que convenció a más de 200 ciudades de dejar de pelear contra el agua y absorberla con parques, humedales y suelo permeable. Ilumina justo lo que el modelo de Cota Cero declara no saber: el drenaje urbano y las defensas deciden tanto como el nivel del río.",
  },
  {
    tono: "agua",
    sello: "TED",
    duracion: "13 min",
    titulo: "Cómo convertir ciudades que se hunden en paisajes contra la inundación",
    ficha: "Kotchakorn Voraakhom · TEDWomen, 2018",
    original: "How to transform sinking cities into landscapes that fight floods",
    url: "https://www.ted.com/talks/kotchakorn_voraakhom_how_to_transform_sinking_cities_into_landscapes_that_fight_floods",
    texto:
      "Bangkok se hunde en su propio delta y esta paisajista construyó ahí un parque que retiene un millón de galones de lluvia. Misma idea que la de Yu, pero desde una ciudad de delta del sur global: terreno blando, río grande y presupuesto real.",
  },
  {
    tono: "ok",
    sello: "TED",
    duracion: "5 min",
    titulo: "El año en que los datos abiertos se hicieron globales",
    ficha: "Tim Berners-Lee · TED University, 2010",
    original: "The year open data went worldwide",
    url: "https://www.ted.com/talks/tim_berners_lee_the_year_open_data_went_worldwide",
    texto:
      "El inventor de la web muestra qué pasa cuando gobiernos e instituciones liberan sus datos crudos — incluido el mapeo voluntario de Haití en OpenStreetMap tras el terremoto. Cota Cero existe exactamente por eso: el INA, el IGN y el municipio publican; nosotros sólo conectamos.",
  },
];

/* Escrito con palabras y no con un número: "Seis charlas" en un lead y luego
   siete en la lista es el clásico literal que se desincroniza de los datos. */
const NUMERO_CHARLAS =
  ["Cero", "Una", "Dos", "Tres", "Cuatro", "Cinco", "Seis", "Siete", "Ocho"][
    CHARLAS.length
  ] || String(CHARLAS.length);

const htmlCharlas = pagina({
  clave: "charlas",
  migaja: "Charlas",
  chip: "Para seguir pensando",
  h1: "Charlas que explican por qué existe esta app",
  lead:
    NUMERO_CHARLAS +
    " charlas TED y TEDx, cortas y gratuitas, sobre las ideas detrás de " +
    "Cota Cero: prepararse antes, organizarse entre vecinos, convivir con el " +
    "agua y abrir los datos.",
  jsonld: {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "Charlas para seguir pensando — Cota Cero",
    numberOfItems: CHARLAS.length,
    itemListElement: CHARLAS.map((c, i) => ({
      "@type": "ListItem",
      position: i + 1,
      url: c.url,
      name: c.original,
    })),
  },
  bloques: [],
  sueltos: [
    `      <section class="charlas">
${CHARLAS.map(
  (c) => `        <a class="charla t-${c.tono}" href="${c.url}" target="_blank" rel="noopener">
          <span class="sello">
            <span class="s">${esc(c.sello)}</span>
            <span class="t">${esc(c.duracion)}</span>
          </span>
          <span class="cuerpo">
            <span class="tit">${esc(c.titulo)}</span>
            <span class="ficha">${esc(c.ficha)} · «${esc(c.original)}»</span>
            <span class="txt">${esc(c.texto)}</span>
          </span>
        </a>`,
).join("\n")}
      </section>`,
  ],
  bloquesFinales: [
    {
      borde: true,
      html: `        <p class="chico" style="margin:0">
          Están todas en inglés y son gratuitas: en ted.com el botón de
          subtítulos muestra los idiomas disponibles de cada una. Ninguna habla
          de Santa Fe — están acá porque explican mejor que nosotros por qué una
          herramienta como ésta tiene sentido. ¿Conocés una charla que debería
          estar en esta lista? Mandala por el formulario de sugerencias de la
          app.
        </p>`,
    },
  ],
});

/* Los datos históricos, servidos en HTML.
   ------------------------------------------------------------------
   Antes esta página no tenía UN SOLO número en el marcado: las crecidas, las
   bajantes y la tabla las inyectaba historia.js, y el contenedor salía con
   `hidden`. Un buscador —o un lector de pantalla, o alguien con el JS
   bloqueado— veía "Cargando un siglo de mediciones…" y nada más. Justo en la
   página que existe para contar la historia del río.

   Ahora los números se emiten acá, al generar, desde el mismo
   datos-abiertos/historia.json que usa el navegador. El JavaScript quedó para
   lo que de verdad lo necesita —la franja del siglo y el tanque que se
   recorre—, y ya no reescribe estas listas. */
const MESES = "enero febrero marzo abril mayo junio julio agosto septiembre octubre noviembre diciembre".split(" ");
const enPalabras = (f) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(f || "");
  return m ? `${+m[3]} de ${MESES[+m[2] - 1]} de ${m[1]}` : "";
};
const anioDe = (f) => (f || "").slice(0, 4);

/* [anio, max, fecha_max, min, fecha_min, dias, dias_alerta, dias_evac] */
const filaHist = (f) => ({
  anio: f[0], max: f[1], fmax: f[2], min: f[3], fmin: f[4],
  dias: f[5], da: f[6], de: f[7],
});
const HIST = historia ? historia.anios.map(filaHist) : [];
const CRECIDAS = [...HIST].sort((a, b) => b.max - a.max).slice(0, 8);
const BAJANTES = [...HIST].sort((a, b) => a.min - b.min).slice(0, 8);
const RECORD = CRECIDAS[0];

const listaCrecidas = CRECIDAS.map(
  (e, i) => `          <li>
            <span class="h-puesto">${i + 1}</span>
            <div>
              <b>${e.anio}</b> · ${nm(e.max, 2)} m<br>
              <span class="chico">Máximo el ${enPalabras(e.fmax)}. ${
                e.da
                  ? `${e.da} ${e.da === 1 ? "día" : "días"} en nivel de alerta` +
                    (e.de ? `, de los cuales ${e.de} en nivel de evacuación.` : ".")
                  : "No llegó al nivel de alerta."
              }</span>
            </div>
          </li>`,
).join("\n");

const listaBajantes = BAJANTES.map(
  (e, i) => `          <li>
            <span class="h-puesto">${i + 1}</span>
            <div>
              <b>${e.anio}</b> · ${nm(e.min, 2)} m<br>
              <span class="chico">Mínimo el ${enPalabras(e.fmin)}.</span>
            </div>
          </li>`,
).join("\n");

const tablaHist = HIST.map(
  (e) => `                  <tr><td>${e.anio}</td><td>${nm(e.max, 2)}</td><td>${nm(e.min, 2)}</td><td>${e.da}</td></tr>`,
).join("\n");

/* ---------- /historia ----------
   Cien años del Paraná. La página es un esqueleto: todos los números los pone
   historia.js leyendo datos/historia.json, que genera `node scripts/historia.js`
   desde la serie del INA. Si acá hubiera un número escrito a mano, el día que
   la serie se actualice quedaría mintiendo.

   Por qué existe: el hidrómetro es un número abstracto. "3,10 m" no le dice
   nada a nadie hasta que se lo ve al lado de los 7,43 de 1992 y de los −0,23
   de 2022. Esta página es la escala. */
const htmlHistoria = pagina({
  clave: "historia",
  migaja: "Cien años del Paraná",
  script: "/js/historia.js",
  chip: "La escala real",
  h1: "Más de un siglo del río Paraná en Santa Fe",
  lead:
    "El hidrómetro marca un número y el número solo no dice nada. Esta página " +
    "lo pone al lado de <b>un siglo de mediciones oficiales</b> del mismo " +
    "instrumento, para que se vea qué es mucho y qué es poco.",
  jsonld: {
    "@context": "https://schema.org",
    "@type": "Dataset",
    name: "Altura hidrométrica diaria del Puerto de Santa Fe, 1925-hoy",
    description:
      "Serie diaria de altura hidrométrica del Puerto de Santa Fe (río Paraná), publicada por el Instituto Nacional del Agua.",
    inLanguage: "es-AR",
    creator: {
      "@type": "GovernmentOrganization",
      name: ORGANISMOS.ina.nombre,
      url: ORGANISMOS.ina.url,
    },
    isAccessibleForFree: true,
    temporalCoverage: historia ? historia.desde + "/" + historia.hasta : undefined,
    variableMeasured: "Altura hidrométrica, en metros sobre el cero de escala",
    url: SITIO + "/historia",
  },
  bloques: [],
  sueltos: [
    `      <section class="bloque">
        <p class="kicker">1925 — hoy</p>
        <h2>El Paraná en más de cien años de registros</h2>
        <p>
          El Instituto Nacional del Agua publica la lectura diaria del
          hidrómetro del Puerto de Santa Fe desde el 2 de enero de 1925. Son
          <b>${historia.dias.toLocaleString("es-AR")} días medidos</b> del
          mismo instrumento, y es la misma serie de la que sale el número que
          la app muestra hoy.
        </p>
        <table class="cuenta">
          <tr><td>Mayor altura registrada — ${enPalabras(RECORD.fmax)}</td><td>${nm(RECORD.max, 2)} m</td></tr>
          <tr><td>Bajante más honda — ${enPalabras(BAJANTES[0].fmin)}</td><td>${nm(BAJANTES[0].min, 2)} m</td></tr>
          <tr><td>Mediana de la serie diaria</td><td>${nm(historia.cuantiles[50], 2)} m</td></tr>
          <tr class="total"><td>Años con registro</td><td>${HIST.length}</td></tr>
        </table>
        <p style="margin-top:20px" class="chico">
          Antes de 1925 el INA no publica esta serie. La crecida de 1905 que se
          cita seguido queda afuera: no la reconstruimos desde recortes de
          diario.
        </p>
      </section>

      <section class="bloque">
        <h2>Las mayores crecidas registradas</h2>
        <p>
          Ordenadas por la altura máxima de cada año. No es una lista escrita a
          mano: es la serie del INA ordenada de mayor a menor.
        </p>
        <ol class="h-ranking">
${listaCrecidas}
        </ol>
      </section>

      <section class="bloque">
        <h2>Las bajantes más hondas</h2>
        <p>
          El cero del hidrómetro no es el fondo del río: por debajo de cero
          sigue habiendo agua. Un número negativo significa que el río está más
          abajo que el cero de esa escala.
        </p>
        <ol class="h-ranking">
${listaBajantes}
        </ol>
      </section>

      <section class="bloque" id="umbrales">
        <h2>¿Qué significan estos números?</h2>
        <p>
          El <b>nivel de alerta</b> del hidrómetro del Puerto de Santa Fe es de
          <b>${nm(ESTACION.alerta, 2)} m</b> y el <b>nivel de evacuación</b> es
          de <b>${nm(ESTACION.evacuacion, 2)} m</b>. Los dos los publica la
          estación del INA, y son los mismos con los que se dibujan las líneas
          punteadas de esta página.
        </p>
        <p>
          Con eso, el récord de ${RECORD.anio} —${nm(RECORD.max, 2)} m— quedó
          <b>${nm(RECORD.max - ESTACION.evacuacion, 2)} m por encima</b> del
          nivel de evacuación. Y todo el rango en el que se decide algo, del
          alerta al récord, son
          <b>${nm(RECORD.max - ESTACION.alerta, 2)} m</b>: por eso un cambio de
          diez centímetros en el modelo no es un detalle.
        </p>
        <p class="chico">
          Alcanzar una altura no significa que el agua entre a una casa: buena
          parte de la ciudad está protegida por defensas, compuertas y bombeo.
          <a href="/datos#no-dice">Por qué el nivel del río no es una predicción de inundación</a>.
        </p>
      </section>

      <p id="h-cargando" class="chico" role="status">Cargando la línea de tiempo…</p>

      <!-- Lo interactivo, y SÓLO lo interactivo, espera al JavaScript. Los
           datos de arriba ya están en el HTML: si esto no carga, la página
           sigue contando la historia completa. -->
      <div id="h-contenido" hidden>
        <section class="bloque">
          <h2>Recorré la serie año por año</h2>
          <p>
            Cada barra es un año: va del nivel más bajo al más alto que marcó el
            hidrómetro. Las dos líneas punteadas son la alerta y la evacuación
            de la ciudad. Tocá una barra para ver ese año en detalle.
          </p>
          <div id="h-franja" class="h-franja"></div>
          <p class="chico">
            Las barras naranjas son años que llegaron a la alerta; las rojas,
            los que llegaron a nivel de evacuación.
          </p>

          <div class="h-modos" role="group" aria-label="Qué recorrer">
            <button type="button" class="btn sec" data-modo="anios" aria-pressed="true">Recorrer años</button>
            <button type="button" class="btn sec" data-modo="libre" aria-pressed="false">Mover el río</button>
          </div>

          <div class="h-panel">
            <div class="h-tanque">
              <div class="h-agua" id="h-agua"></div>
              <div class="h-marcas" id="h-marcas" aria-hidden="true"></div>
            </div>
            <div class="h-lectura" id="h-lectura" role="status"></div>
          </div>

          <div class="h-control">
            <input type="range" id="h-rango" min="0" max="1" step="1" value="0" />
            <div class="h-control-pie">
              <span id="h-pie-control" class="chico"></span>
              <button type="button" class="btn sec" id="h-play">Reproducir</button>
            </div>
          </div>
          <p class="chico">
            Nada se mueve solo: el recorrido arranca cuando lo pedís. Si tu
            sistema está configurado para reducir el movimiento, la línea del
            agua salta en vez de deslizarse.
          </p>
        </section>
      </div>

      <section class="bloque">
        <h2>La tabla completa</h2>
        <details class="h-detalle">
          <summary>Ver los ${HIST.length} años, uno por uno</summary>
          <div class="h-tabla-caja">
            <table class="h-tabla">
              <thead><tr><th scope="col">Año</th><th scope="col">Máximo</th><th scope="col">Mínimo</th><th scope="col">Días en alerta</th></tr></thead>
              <tbody>
${tablaHist}
              </tbody>
            </table>
          </div>
        </details>
      </section>

      <section class="bloque borde">
        <p class="kicker">La fuente</p>
        <p class="chico">
          Serie diaria del hidrómetro del Puerto de Santa Fe:
          <b>${historia.dias.toLocaleString("es-AR")} días medidos</b> entre el
          ${enPalabras(historia.desde)} y el ${enPalabras(historia.hasta)}.
          Fuente: ${esc(ORGANISMOS.ina.nombre)}, serie ${ESTACION.serieId}
          (altura hidrométrica, medición directa). Descargado el
          ${enPalabras(historia.generado)}.
        </p>
        <p class="fuente-enlaces">
          <a class="btn sec" href="${FUENTES.historia.url}" target="_blank" rel="noopener">Ver fuente</a>
          <a class="enlace-crudo" href="${esc(FUENTES.historia.verificar)}" target="_blank" rel="noopener">Ver la serie cruda</a>
        </p>
        <p class="chico">
          Los años con la libreta incompleta están marcados en la tabla por su
          cantidad de días medidos${historia.incompletos.length ? ": " + historia.incompletos.join(", ") : ""}.
        </p>
      </section>

      <section class="bloque">
        <h2>Comparar con el río de hoy</h2>
        <p>
          Esta página cuenta lo que pasó. Para ver cuánto marca el hidrómetro
          ahora —y qué significa para un terreno en particular— está el resto
          de Cota Cero.
        </p>
        <ul class="pasos">
          <li><a href="/">Ver el nivel del río Paraná hoy</a></li>
          <li><a href="/datos">Saber la cota de tu terreno en Santa Fe</a></li>
          <li><a href="/datos">Conocer de dónde salen estos datos</a></li>
        </ul>
      </section>

      <section class="bloque oscuro">
        <p class="kicker">Ojo con leer de más</p>
        <h2>Esto es historia, no pronóstico</h2>
        <p>
          Que una altura se haya alcanzado pocas veces en cien años no dice
          nada sobre lo que va a pasar este año. La serie tampoco es homogénea:
          en cien años cambiaron las presas aguas arriba, el uso del suelo de
          la cuenca y el propio régimen del río.
        </p>
        <p>
          Y una advertencia sobre las defensas: la ciudad de 1925 no es la de
          hoy. Un mismo número del hidrómetro no significaba lo mismo antes que
          ahora, porque cambió lo que hay entre el río y las casas.
        </p>
      </section>`,
  ],
});

/* ---------- /contacto ----------
   El formulario de sugerencias tenía un solo lugar: plegado al pie de la app.
   Quien entra desde un buscador —un periodista, alguien de un organismo, un
   vecino que vio un dato mal— no lo encuentra nunca. Esta página lo saca a
   una URL propia.

   DOS COSAS QUE NO SE NEGOCIAN

   1. El aviso de emergencia va ARRIBA DE TODO, antes del título. En una app
      de riesgo hídrico cualquier caja de texto se puede leer como una vía
      para pedir auxilio, y alguien con agua en la puerta no lee hasta el
      final. Por eso está antes del H1 y el 103 es un enlace que llama.
   2. Las opciones son <input type="radio"> de verdad, dibujados como
      pastillas. Se ven como botones pero llegan con teclado y con lector de
      pantalla sin una línea de JavaScript: elegir una categoría funciona
      aunque el script no cargue. El JS sólo manda el formulario.

   Las categorías salen de lib/sugerencias.js, el mismo módulo que valida el
   endpoint: no se pueden desincronizar. */
const AVISO_EMERGENCIA = `      <div class="aviso-emergencia">
        <p>
          <b>Esto no es una vía de auxilio.</b> Nadie lee esto en el momento.
          Ante una emergencia, llamá ya a Defensa Civil.
        </p>
        <a class="btn-emergencia" href="tel:103">
          <span>Emergencias</span><b>103</b>
        </a>
      </div>`;

const opcionesCategoria = Object.entries(CATEGORIAS)
  .map(
    ([clave, etiqueta]) => `            <input type="radio" name="categoria" id="cat-${clave}"
              value="${clave}" class="cat-radio"${clave === CATEGORIA_POR_DEFECTO ? " checked" : ""} />
            <label class="cat-chip" for="cat-${clave}">${esc(etiqueta)}</label>`,
  )
  .join("\n");

const htmlContacto = pagina({
  clave: "contacto",
  migaja: "Contacto",
  script: "/js/contacto.js",
  antes: AVISO_EMERGENCIA,
  h1: "Contacto",
  lead:
    "Cota Cero la hacemos vecinos: cada corrección de un dato, cada zona que " +
    "falta y cada texto que no se entiende mejora la app para toda la ciudad.",
  jsonld: {
    "@context": "https://schema.org",
    "@type": "ContactPage",
    name: "Contacto — Cota Cero",
    inLanguage: "es-AR",
  },
  bloques: [],
  sueltos: [
    `      <section class="bloque">
        <p class="kicker">Sugerencias</p>
        <h2>Escribinos</h2>

        <form id="form-contacto" novalidate>
          <fieldset class="campo-cat">
            <legend>¿Sobre qué es?</legend>
            <div class="cat-chips">
${opcionesCategoria}
            </div>
          </fieldset>

          <label class="campo" for="sug-texto"><span>Tu mensaje</span></label>
          <textarea id="sug-texto" name="texto" required maxlength="${MAX_TEXTO}"
            rows="6" placeholder="Contanos con el mayor detalle posible…"></textarea>
          <p class="chico cuenta-texto" id="sug-cuenta" aria-live="polite"></p>

          <label class="campo" for="sug-contacto">
            <span>Un contacto para responderte <i>(opcional)</i></span>
          </label>
          <input type="text" id="sug-contacto" name="contacto" maxlength="${MAX_CONTACTO}"
            autocomplete="off" placeholder="Correo o teléfono — solo si querés respuesta" />

          <button class="btn" type="submit" id="sug-enviar">Enviar sugerencia</button>
          <p class="chico" id="sug-estado" role="status" aria-live="polite"></p>
        </form>

        <p class="chico letra-chica">
          Es lo único de Cota Cero que envía texto tuyo a un servidor. <b>Tu IP
          no se guarda</b>: se usa sólo para limitar envíos, y transformada de
          modo irreversible. Si dejás un contacto, se usa únicamente para
          responderte. <b>No pongas tu dirección.</b>
          <a href="/legal">Ver qué se guarda y qué no</a>.
        </p>
      </section>

      <div class="rejilla-2 tarjetas-contacto">
        <div class="mini-tarjeta">
          <p class="kicker kicker-alerta">¿Encontraste un dato mal?</p>
          <p>
            Una cota que no cierra, un punto de encuentro que ya no existe, los
            kilómetros de una zona que no dan: eso es lo más valioso que nos
            podés mandar. Decinos la dirección o el lugar exacto — con eso se
            puede comprobar contra la fuente y corregirlo.
          </p>
        </div>
        <div class="mini-tarjeta">
          <p class="kicker">¿Sos de un organismo o de prensa?</p>
          <p>
            El modelo busca revisión técnica: Gestión de Riesgos, INA, FICH-UNL,
            Recursos Hídricos. Si podés ayudar a validarlo, o querés el detalle
            del método, escribinos y te lo pasamos.
            <a href="/datos">Ver la metodología y sus límites</a>.
          </p>
        </div>
      </div>`,
  ],
});

/* ---------- /sobre ----------
   Para un sitio sobre riesgo hídrico, decir quién está detrás no es un
   trámite: es lo que separa una herramienta ciudadana de una página anónima
   que da números sobre inundaciones. Esto estaba disperso entre el pie y
   /legal, y en ningún lado se contestaba de frente "¿quiénes son ustedes?".

   Cada afirmación de acá tiene que ser cierta y verificable. Nada de
   credenciales, ni de respaldos, ni de "avalado por". */
const htmlSobre = pagina({
  clave: "sobre",
  migaja: "Sobre Cota Cero",
  chip: "Quiénes somos",
  h1: "Sobre Cota Cero",
  lead:
    "Cota Cero es un <b>proyecto ciudadano independiente</b>. No pertenece a " +
    "la Municipalidad de Santa Fe, ni al INA, ni a la Provincia, ni a ningún " +
    "organismo — y ninguno lo revisó.",
  jsonld: {
    "@context": "https://schema.org",
    "@type": "AboutPage",
    name: "Sobre Cota Cero",
    inLanguage: "es-AR",
    mainEntity: {
      "@type": "WebSite",
      name: "Cota Cero",
      url: SITIO,
      description:
        "Herramienta ciudadana que relaciona el nivel del río Paraná en Santa Fe con la cota del terreno.",
      creator: { "@type": "Person", name: "Ariel Benz" },
    },
  },
  bloques: [
    {
      kicker: "Qué es",
      titulo: "Una herramienta para leer un número que ya es público",
      html: `        <p>
          El Instituto Nacional del Agua publica todos los días la altura del
          río Paraná en el hidrómetro del Puerto de Santa Fe. La Municipalidad
          publica las curvas de nivel de la ciudad. Los dos datos son públicos
          y los dos son difíciles de usar por separado.
        </p>
        <p>
          Cota Cero hace una sola cosa: <b>los pone en la misma escala</b> para
          que se puedan comparar, y explica qué significa esa comparación —
          incluido todo lo que no significa.
        </p>
        <p>
          Es gratis, no pide registro, no tiene publicidad y funciona sin
          señal una vez cargada.
          <a href="/datos">Ver de dónde sale cada dato</a>.
        </p>`,
    },
    {
      kicker: "Quién",
      titulo: "Lo hace una persona, no una institución",
      html: `        <p>
          Lo desarrolla <b>Ariel Benz</b>, por cuenta propia. No hay detrás una
          empresa, una ONG ni un organismo, y no recibe financiamiento de
          ninguno.
        </p>
        <div class="aviso grave">
          <b>Cota Cero no es oficial y no lo pretende.</b> No está avalado ni
          revisado por la Municipalidad de Santa Fe, el INA, la Provincia ni la
          FICH-UNL. Usa los datos públicos que esos organismos producen y los
          cita para que cualquiera pueda ir a comprobarlos.
          <b>La orden de evacuación la da Defensa Civil, al 103.</b>
        </div>`,
    },
    {
      kicker: "Con qué",
      titulo: "Todo lo que muestra tiene fuente y enlace",
      html: `        <ul class="pasos">
          <li><b>El nivel del río</b> — Instituto Nacional del Agua, serie del
            hidrómetro del Puerto de Santa Fe.</li>
          <li><b>La altura del terreno</b> — curvas de nivel de la
            Municipalidad de Santa Fe, Secretaría de Recursos Hídricos.</li>
          <li><b>Los puntos de encuentro</b> — Plan de Contingencia de la
            Dirección de Gestión de Riesgos.</li>
          <li><b>La serie histórica</b> — INA, lecturas diarias desde 1925.</li>
        </ul>
        <p>
          Cada una está enlazada, con el dato crudo al lado, en
          <a href="/datos">la página de datos y fuentes</a>.
        </p>`,
    },
    {
      oscuro: true,
      kicker: "Qué no es",
      titulo: "No predice inundaciones",
      html: `        <p>
          Cota Cero relaciona dos alturas. No es un modelo de inundación: no
          sabe si entre el río y tu casa hay un terraplén, una compuerta o una
          estación de bombeo, y no ve la lluvia que cae adentro de la ciudad.
        </p>
        <p>
          Las constantes del cálculo están en discusión técnica abierta y así
          se dice en pantalla, con los números de las dos posturas.
          <a href="/datos#abiertas">Ver las discusiones abiertas</a>.
        </p>
        <p class="chico">
          Cuando falta un dato, la app dice que no lo tiene. No se rellena el
          hueco con un número que parezca firme.
        </p>`,
    },
    {
      borde: true,
      kicker: "Contacto",
      titulo: "Si algo está mal, avisá",
      html: `        <p>
          Un error en una herramienta sobre riesgo hídrico no es un detalle.
          Si encontrás un dato equivocado, una fuente rota o algo que no se
          entiende, escribí por el
          <a href="/contacto">formulario de sugerencias</a> de la app.
        </p>
        <p class="chico">
          Es lo único de Cota Cero que manda texto a un servidor, y el
          formulario lo aclara. No se guarda tu IP.
        </p>`,
    },
  ],
});

/* ---------- 404 ----------
   Vercel sirve /404.html —con código 404 de verdad— para cualquier ruta que
   no exista. Alguien que se equivoca de dirección durante una crecida no
   tiene que quedarse mirando un error: el nivel del río va arriba de todo.

   El nivel sale del widget por iframe, que ya existe, se actualiza solo y no
   agrega ni una línea de JavaScript a esta página. */
const htmlNoEncontrada = pagina({
  clave: "noEncontrada",
  migaja: "Página no encontrada",
  chip: "Error 404",
  h1: "Esa página no existe",
  lead:
    "Puede que el enlace esté viejo o que haya un error de tipeo. Mientras " +
    "tanto, el río:",
  bloques: [
    {
      html: `        <iframe src="/widget" title="Nivel del río Paraná en el Puerto de Santa Fe"
          loading="lazy" style="width:100%;height:200px;border:0;border-radius:16px"></iframe>`,
    },
    {
      titulo: "Lo que sí existe",
      html: `        <ul class="pasos">
          <li><a href="/">Ver el nivel del río Paraná en Santa Fe hoy</a></li>
          <li><a href="/datos">Saber la cota de tu terreno</a></li>
          <li><a href="/puntos-de-encuentro">Los 30 puntos de encuentro ante una inundación</a></li>
          <li><a href="/historia">Las crecidas históricas del Paraná</a></li>
          <li><a href="/datos">De dónde salen los datos</a></li>
        </ul>
        <div class="aviso grave">
          Si es una emergencia, <b>Defensa Civil: 103</b>.
        </div>`,
    },
  ],
});

/* ---------- /para-medios ----------
   La página que explica el widget. El widget en sí vive en /widget y es lo
   único del sitio que se deja embeber: su CSP lleva frame-ancestors *, y esa
   regla va después del comodín en vercel.json porque gana la última. */
const CODIGO_WIDGET = `<iframe src="${SITIO}/widget"
  width="100%" height="220" loading="lazy"
  style="border:0;border-radius:16px"
  title="Nivel del río en el Puerto de Santa Fe — Cota Cero"></iframe>`;

const CONDICIONES = [
  "No recortes el crédito: «Datos: INA · vía Cota Cero» es la trazabilidad del número que estás publicando. Sin eso, tu lector no puede ir a la fuente.",
  "El widget muestra el nivel oficial y la alerta y la evacuación de la ciudad — no niveles de aviso personales ni pronósticos. No lo presentes como una predicción de inundación, porque no lo es.",
  "En emergencia mandan las autoridades: si Defensa Civil comunica algo distinto de lo que dice el widget, vale lo de Defensa Civil.",
];

const htmlMedios = pagina({
  clave: "paraMedios",
  migaja: "Widget para medios",
  script: "/js/medios.js",
  chip: "Para medios y sitios",
  h1: "El río, embebido en tu nota",
  lead:
    "Un widget gratuito con el nivel del hidrómetro del Puerto, la tendencia y " +
    "los niveles de alerta y evacuación de la ciudad, siempre actualizado. " +
    "Pegás dos líneas de HTML y tu " +
    "nota sobre el río queda viva. Sin claves de API, sin cookies, sin rastreo " +
    "de tus lectores.",
  jsonld: null,
  bloques: [
    {
      kicker: "Así se ve",
      titulo: "Claro y oscuro, del ancho que quieras",
      html: `        <p>
          No son capturas: los dos son el widget de verdad, leyendo el reporte
          del INA ahora mismo.
        </p>
        <div class="muestras-widget">
          <div>
            <iframe src="/widget" title="Widget de Cota Cero, tema claro" loading="lazy"></iframe>
            <p class="chico">Tema claro — así viene por defecto</p>
          </div>
          <div>
            <iframe src="/widget?theme=dark" title="Widget de Cota Cero, tema oscuro" loading="lazy"></iframe>
            <p class="chico">Tema oscuro — agregale <code>?theme=dark</code></p>
          </div>
        </div>`,
    },
    {
      kicker: "El código",
      titulo: "Copiá, pegá, listo",
      html: `        <div class="caja-codigo">
          <button type="button" class="btn sec" id="copiar-widget" hidden>Copiar</button>
          <pre id="codigo-widget">${esc(CODIGO_WIDGET)}</pre>
        </div>
        <div class="rejilla-2" style="margin-top:16px">
          <div class="mini-tarjeta">
            <b>Alto recomendado: 220 px</b>
            <p>El ancho es fluido: ocupa el de tu columna. Abajo de 380 px el pie se reacomoda solo.</p>
          </div>
          <div class="mini-tarjeta">
            <b>Se actualiza solo</b>
            <p>Con la lectura diaria del INA. Si el dato envejece, el widget muestra su fecha y lo dice — nunca inventa un número.</p>
          </div>
        </div>`,
    },
    {
      oscuro: true,
      kicker: "Tres condiciones",
      titulo: "Gratis, con reglas simples",
      html: `        <ol class="condiciones">
${CONDICIONES.map((c) => `          <li>${c}</li>`).join("\n")}
        </ol>
        <p class="chico" style="margin-top:20px">
          ¿Necesitás otro formato, la metodología, o hablar con quien lo hizo?
          Escribinos por el <a href="/contacto">formulario de sugerencias</a>
          de la app: a prensa contestamos rápido.
        </p>`,
    },
  ],
});

/* ---------- /legal ---------- */
const LICENCIAS = [
  ["MapLibre GL JS", "Motor del mapa. Licencia BSD de 3 cláusulas — © contribuidores de MapLibre. El texto completo acompaña a la copia distribuida con la app."],
  ["OpenStreetMap / Nominatim", 'Búsqueda de direcciones. Datos © colaboradores de <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>, bajo licencia ODbL.'],
  ["Instituto Geográfico Nacional", 'Mapa base (capa argenmap) y red de nivelación usada para validar las fuentes de elevación. <a href="https://www.ign.gob.ar/" target="_blank" rel="noopener">ign.gob.ar</a>.'],
  ["Municipalidad de Santa Fe", 'Curvas de nivel (Secretaría de Recursos Hídricos) y capa de puntos de encuentro, de sus geoservicios públicos vía el <a href="https://geoportal.santafeciudad.gov.ar/" target="_blank" rel="noopener">GeoPortal</a>.'],
  ["INA", 'Alturas hidrométricas diarias del Paraná, del <a href="' + FUENTES.nivelRio.url + '" target="_blank" rel="noopener">reporte público del Instituto Nacional del Agua</a>.'],
  ["Plus Jakarta Sans y JetBrains Mono", "Tipografías, bajo SIL Open Font License. Van self-hosteadas: no se consulta ningún servicio de fuentes."],
];

const PRIVACIDAD = [
  ["Tu nivel de aviso, tu zona y tu plan familiar", "Se guardan únicamente en tu dispositivo. Nunca se envían a ningún servidor. Si borrás la app, se borran."],
  ["Avisos", "El servidor guarda un solo dato: la dirección técnica opaca que asigna tu navegador. No sabe la altura de tu terreno ni tu nivel de aviso — el aviso se arma en tu teléfono. Al desuscribirte, se borra."],
  ["Sugerencias", "Es lo único que envía texto tuyo a un servidor, y el formulario lo dice. Tu IP no se almacena: se usa sólo para limitar envíos, transformada de modo irreversible."],
  ["Cuántas personas la usan", "El teléfono genera un número al azar y lo guarda; se manda para contar cuánta gente distinta usa la app por día. Del lado del servidor entra a una estructura que sabe cuántos distintos vio pero no guarda ninguno."],
];

const htmlLegal = pagina({
  clave: "legal",
  migaja: "Legal y privacidad",
  h1: "Legal",
  lead:
    "Última actualización: agosto de 2026. Escrito para leerse, no para " +
    "esconderse: si algo no se entiende, es un defecto — avisanos por el " +
    "formulario de sugerencias.",
  anclas: [
    { id: "descargo", n: "Descargo de responsabilidad" },
    { id: "privacidad", n: "Privacidad" },
    { id: "licencias", n: "Licencias y atribuciones" },
  ],
  jsonld: null,
  bloques: [
    {
      id: "descargo",
      kicker: "Descargo de responsabilidad",
      kickerAlerta: true,
      titulo: "Qué es esta herramienta — y qué no",
      html: `        <p>
          <b>Cota Cero es una herramienta ciudadana que ayuda a interpretar
          información pública, no un sistema oficial de alerta.</b> No tiene
          vínculo con la Municipalidad
          de Santa Fe, la Provincia, Defensa Civil, el INA ni ningún otro
          organismo. Usa datos públicos de esas fuentes y las cita.
        </p>
        <p>
          <b>Los niveles de aviso son cálculos aproximados.</b> Se calculan con un
          modelo simplificado y con datos que traen margen de error (±0,5 m en
          la cota del terreno). El modelo no conoce defensas, terraplenes,
          bombeo ni desagües: el agua puede llegar antes o después de lo
          estimado. Además, fue contrastado con <b>un solo caso histórico</b>
          —la crecida de 1992— y todavía no fue validado por especialistas ni
          organismos competentes.
        </p>
        <p>
          <b>Las decisiones de evacuación corresponden a Defensa Civil (103).</b>
          Nada de lo que muestra esta app constituye una orden, recomendación
          oficial ni sustituto de las comunicaciones de las autoridades. Ante
          cualquier contradicción, vale la indicación oficial.
        </p>
        <p>
          <b>Sin garantías de disponibilidad ni exactitud.</b> La app depende de
          que el INA publique su reporte diario y de servicios de terceros que
          pueden fallar, cambiar o discontinuarse. Se ofrece tal cual, de forma
          gratuita y sin garantía de ningún tipo.
        </p>
        <p>
          <b>Los datos pueden quedar desactualizados.</b> El nivel se publica
          una vez por día; los puntos de encuentro reflejan la capa municipal al
          momento de la última actualización de la app, y su activación en una
          emergencia la confirma sólo Defensa Civil.
        </p>`,
    },
    {
      id: "privacidad",
      kicker: "Privacidad",
      titulo: "Tus datos quedan en tu teléfono",
      html: `        <div class="rejilla-2">
${PRIVACIDAD.map(
  ([t, d]) => `          <div class="mini-tarjeta">
            <b>${esc(t)}</b>
            <p>${esc(d)}</p>
          </div>`,
).join("\n")}
        </div>
        <p class="chico" style="margin-top:20px">
          No pedimos nombre, correo, teléfono ni registro. No hay publicidad ni
          venta de datos. La búsqueda de direcciones consulta a Nominatim
          (OpenStreetMap) sólo cuando vos la iniciás.</p>
        <p class="chico">
          <b>Las estadísticas del sitio.</b> Las miden dos servicios: Vercel
          Analytics, que es agregado y sin cookies, y Google Analytics, que
          <b>sí deja cookies en tu navegador</b> y manda los datos de tu visita
          a Google. Los dos corren en las páginas del sitio y
          <b>ninguno corre dentro de la app ni dentro del widget</b>: tu cota,
          tu nivel de aviso y tu plan no salen de tu teléfono, y a los lectores de un
          medio que embebe el widget no los mide nadie.
        </p>`,
    },
    {
      id: "licencias",
      kicker: "Licencias y atribuciones",
      titulo: "Sobre hombros de otros",
      html: `        <div class="filas-licencia">
${LICENCIAS.map(
  ([n, d]) => `          <div>
            <b>${esc(n)}</b>
            <p>${d}</p>
          </div>`,
).join("\n")}
        </div>`,
    },
    {
      borde: true,
      html: `        <p class="chico" style="margin:0">
          Este texto lo redactó quien hizo la app, con la intención de ser claro
          y honesto. No constituye asesoramiento legal ni fue revisado por un
          profesional del derecho. Si encontrás un error, o algo que debería
          decir y no dice, escribinos.
        </p>`,
    },
  ],
  sueltos: [
  ],
});

/* La landing dibuja los 30 puntos en un mapa y necesita las coordenadas.
   Se emiten desde acá, que ya las leyó de app/index.html, para que no exista
   una tercera copia de la lista. */
await mkdir(join(RAIZ, "datos-abiertos"), { recursive: true });
await writeFile(
  join(RAIZ, "datos-abiertos", "puntos.json"),
  JSON.stringify(puntos.map((p) => [p.nombre, p.direccion, p.lon, p.lat])),
);
console.log("escrito: /datos-abiertos/puntos.json  (" + puntos.length + " puntos)");

/* La portada es HTML escrito a mano, pero su pie sale de la misma constante:
   se reemplaza el bloque entre los marcadores. Si alguien lo edita a mano,
   la próxima corrida lo pisa — que es exactamente lo que queremos. */
const portada = join(RAIZ, "index.html");
const antes = await readFile(portada, "utf8");
const MARCA_INI = "      <!-- PIE:inicio";
const MARCA_FIN = "      <!-- PIE:fin -->";
const i = antes.indexOf(MARCA_INI);
const f = antes.indexOf(MARCA_FIN);
if (i === -1 || f === -1)
  throw new Error("index.html no tiene los marcadores PIE");
const cabecera = antes.slice(i, antes.indexOf("-->", i) + 4);
const despues =
  antes.slice(0, i) + cabecera + "\n" + pie({ frescura: true }) + "\n" + antes.slice(f);
if (despues !== antes) {
  await writeFile(portada, despues);
  console.log("actualizado: el pie de index.html");
} else {
  console.log("index.html: el pie ya estaba al día");
}

/* La 404 va a la raíz como 404.html: es donde la busca Vercel. */
await writeFile(join(RAIZ, "404.html"), htmlNoEncontrada);
console.log("escrito: /404.html");

for (const [ruta, html] of [
  ["puntos-de-encuentro", htmlPuntos],
  ["datos", htmlDatos],
  ["sobre", htmlSobre],
  ["contacto", htmlContacto],
  ["historia", htmlHistoria],
  ["preguntas", htmlPreguntas],
  ["legal", htmlLegal],
  ["charlas", htmlCharlas],
  ["para-medios", htmlMedios],
]) {
  await mkdir(join(RAIZ, ruta), { recursive: true });
  await writeFile(join(RAIZ, ruta, "index.html"), html);
  console.log(
    "escrito: /" + ruta + "  (" + (html.length / 1024).toFixed(0) + " KB)",
  );
}
console.log("puntos leídos de app/index.html: " + puntos.length);

/* ---------- sitemap.xml ----------
   Sale del registro, no de un archivo que se edita aparte: así no puede
   listar una página que ya no existe ni olvidarse de una nueva. Sólo entra
   lo indexable — nada de /api, assets, manifest ni service worker.

   Sin `lastmod`: poner la fecha de hoy en cada corrida sería decirle a Google
   que todas las páginas cambiaron cuando no cambió ninguna, y una fecha
   inventada es peor que ninguna. */
const urls = enSitemap()
  .map(
    (p) =>
      `  <url><loc>${SITIO}${p.ruta === "/" ? "/" : p.ruta}</loc>` +
      `<changefreq>${p.frecuencia}</changefreq>` +
      `<priority>${p.prioridad}</priority></url>`,
  )
  .join("\n");
await writeFile(
  join(RAIZ, "sitemap.xml"),
  `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`,
);
console.log("escrito: /sitemap.xml  (" + enSitemap().length + " URLs indexables)");

/* ---------- la portada y la app son HTML a mano ----------
   No las genera este script, pero su título, su descripción y su canónica
   tienen que decir lo mismo que lib/paginas.js o el registro deja de ser la
   fuente de verdad. En vez de reescribirles el <head> —que es frágil— se
   comprueba y se falla fuerte. */
const enHtml = (h, re) => (h.match(re) || [, ""])[1].replace(/\s+/g, " ").trim();
for (const clave of ["inicio", "app", "widget"]) {
  const meta = PAGINAS[clave];
  const archivo =
    clave === "inicio"
      ? "index.html"
      : clave === "app"
        ? join("app", "index.html")
        : join("widget", "index.html");
  const h = await readFile(join(RAIZ, archivo), "utf8");
  const problemas = [];
  const titulo = enHtml(h, /<title>([\s\S]*?)<\/title>/);
  if (titulo !== meta.titulo)
    problemas.push(`  <title> dice   «${titulo}»\n  y debería decir «${meta.titulo}»`);
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
        : "  le falta <meta name=\"robots\" content=\"noindex, follow\">",
    );
  if (problemas.length)
    throw new Error(
      `${archivo} no coincide con lib/paginas.js:\n` + problemas.join("\n"),
    );
}
console.log("portada, app y widget: coinciden con lib/paginas.js");

/* La app son módulos ES y el service worker los precachea uno por uno: si
   alguien agrega un módulo y se olvida de la lista de sw.js, /app deja de
   abrir sin conexión — y el modo de falla es mudo, aparece recién el día que
   alguien se queda sin señal. Por eso esto revienta acá y no allá. */
const modulos = [
  ...(await readdir(join(RAIZ, "js", "app")))
    .filter((f) => f.endsWith(".js"))
    .map((f) => "/js/app/" + f),
  // los módulos compartidos que la app importa desde /lib/
  "/lib/fuentes.js",
];
const sw = await readFile(join(RAIZ, "sw.js"), "utf8");
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
  if (ruta.startsWith("/vendor/") || ruta === "/" || !/\.[a-z]+$/.test(ruta)) continue;
  try {
    await readFile(join(RAIZ, ruta.replace(/^\//, "")));
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

console.log("service worker: precachea los " + modulos.length + " módulos de la app");
console.log(
  "service worker: precachea las " + rutasGeneradas.length + " páginas generadas",
);
