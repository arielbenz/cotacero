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
} from "../public/lib/fuentes.js";
import { PAGINAS, OG_IMAGEN, enSitemap } from "../lib/paginas.js";
import { MOCHILA, PREVIA } from "../public/lib/listas.js";
import { CHARLAS } from "../lib/charlas.js";
import {
  AYUDAS,
  CATEGORIAS,
  CATEGORIA_POR_DEFECTO,
  MAX_TEXTO,
  MAX_CONTACTO,
} from "../lib/sugerencias.js";

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), "..");
/* Lo que se publica vive en public/ (es el `outputDirectory` de vercel.json):
   todo lo que este script lee o escribe del sitio va contra PUBLICO. RAIZ
   queda para git, que corre sobre el repo entero. */
const PUBLICO = join(RAIZ, "public");
const SITIO = "https://cotacerosf.com";

/* La serie histórica del INA, para que las páginas puedan citar el récord y
   la cantidad de días medidos sin que nadie los escriba a mano. La genera
   `node scripts/historia.js`; si todavía no se corrió, las páginas salen
   igual y el bloque de historia queda afuera en vez de reventar el build. */
let historia = null;
try {
  historia = JSON.parse(
    await readFile(join(PUBLICO, "datos-abiertos", "historia.json"), "utf8"),
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

const app = await readFile(join(PUBLICO, "app", "index.html"), "utf8");

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
    return x
      ? x[1]
          .replace(/<[^>]+>/g, "")
          .replace(/\\s+/g, " ")
          .trim()
      : "";
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
            Hecha por un vecino de Santa Fe. Sin vínculo con el municipio: la
            orden de evacuación la da la Defensa Civil.
          </p>
          ${/* Un enlace tel:, no un <p>: tenía cara de botón y no llamaba. */ ""}<a class="chip-tel" href="tel:103">Emergencias <b>103</b></a>
        </div>
        <div>
          <span class="eti">La app</span>
          <a href="/datos">Cómo se calcula tu nivel de aviso</a>
          <a href="/puntos-de-encuentro">Puntos de encuentro</a>
          <a href="/guia">Guía para imprimir</a>
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
  const clases = "bloque" + (oscuro ? " oscuro" : "") + (borde ? " borde" : "");
  return `      <section class="${clases}"${id ? ` id="${id}"` : ""}>
${kicker ? `        <p class="kicker${kickerAlerta ? " kicker-alerta" : ""}">${esc(kicker)}</p>\n` : ""}${titulo ? `        <h2>${esc(titulo)}</h2>\n` : ""}${html}
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
  css,
}) {
  const meta = PAGINAS[clave];
  if (!meta)
    throw new Error(
      "pagina(): no existe la clave «" + clave + "» en lib/paginas.js",
    );
  /* Sin migaja, JSON.stringify borra `name: undefined` en silencio y la
     BreadcrumbList sale inválida: Search Console la marcó en /guia. */
  if (!migaja)
    throw new Error("pagina(): falta la migaja de «" + clave + "»");
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
<!-- Generado por scripts/paginas.js — no editar a mano -->
<html lang="es-AR">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
    <title>${esc(titulo)}</title>
${
  /* La 404 NO lleva canónica: se sirve para cualquier ruta que no existe,
         así que apuntaría a "/404", una URL que no es contenido de nada.
         Declarar una canónica ahí es afirmar que esa página es la versión
         buena de lo que el visitante pidió, y no lo es. */
  ruta === "/404" ? "" : `    <link rel="canonical" href="${url}" />\n`
}
    <meta name="description" content="${esc(descripcion)}" />
    ${
      /* Dos con `media`: un solo valor fijo dejaba la barra del navegador
         oscura sobre una página clara. */ ""
    }<meta name="theme-color" content="#fafbfc" media="(prefers-color-scheme: light)" />
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
    <link rel="icon" href="/favicon.ico" sizes="96x96" />
    ${
      /* 96 px porque Google exige cuadrado y múltiplo de 48: con 32 lo
         descarta y muestra el que tenga cacheado. */ ""
    }
    <link rel="icon" type="image/png" sizes="96x96" href="/img/favicon-96.png" />
    <link rel="apple-touch-icon" href="/img/apple-touch-icon.png" />
    ${
      /* Sólo la sans. La mono no aparece en el primer pantallazo de estas
         páginas, y precargarla le disputaría la conexión a app.css, que es
         lo que bloquea. La portada y la app sí la precargan: el hidrómetro
         está arriba de todo. */ ""
    }
    <link rel="preload" href="/vendor/fonts/jakarta.woff2" as="font" type="font/woff2" crossorigin />
    <link rel="stylesheet" href="/css/app.css" />
    <script src="/lib/comun-clasico.js" defer></script>
    <script src="/js/rio-barra.js" defer></script>
    <script defer src="/_vercel/insights/script.js"></script>
    ${
      /* El cargador va externo y la configuración en /js/analitica.js: el
         <script> en línea del snippet oficial lo bloquea la CSP. No va en
         /app ni en /widget — ver el encabezado de js/analitica.js. */ ""
    }<script
      async
      src="https://www.googletagmanager.com/gtag/js?id=G-4ZWXFWZC9X"></script>
    <script src="/js/analitica.js" defer></script>
${css ? `    <link rel="stylesheet" href="${css}" />\n` : ""}${script ? `    <script defer src="${script}"></script>\n` : ""}  </head>
  <body class="landing">
    ${
      /* La barra es la MISMA que la de la portada: mismo ancho, mismo chip y
         los mismos cuatro destinos. Antes tenía dos enlaces propios y quedaba
         a la medida angosta del cuerpo, así que la marca se corría de lugar
         según de qué página vinieras. */ ""
    }<div class="franja-estado" id="franja-estado" role="status"></div>

    <div class="nav-envoltura">
    <div class="ancho">
      <nav class="nav-sitio" aria-label="Principal">
        <a class="lockup" href="/" aria-label="Cota Cero, inicio">
          ${marcaSvg("mp")}
          <span class="lockup-nombre">Cota Cero</span>
        </a>
        <span class="chip-borde">NO OFICIAL</span>
        ${
          /* Arranca en gris y sin número: no decimos "todo bien" antes de
             saberlo. La llena js/rio-barra.js, que también reescribe el
             aria-label —"Río 4,86 m ▲ sube" leído en voz alta no es una
             frase—. */ ""
        }<a
          class="pildora-rio"
          id="pildora-rio"
          href="/#abrir"
          aria-label="Nivel del río, todavía sin dato">
          <span class="pr-regla" aria-hidden="true"
            ><span class="pr-agua" id="pildora-agua"></span
            ><span class="pr-alerta" id="pildora-alerta"></span
          ></span>
          <span>
            <span class="pr-etiqueta">Río </span
            ><span id="pildora-nivel">—</span
            ><span class="pr-estado" id="pildora-estado" hidden></span>
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
    </div>

    <div class="ancho">
${antes ? antes + "\n" : ""}      <header class="pg-cabecera">
${chip ? `        <p class="chip-tinte">${esc(chip)}</p>\n` : ""}        <h1>${esc(h1)}</h1>
${lead ? `        <p class="pg-lead">${lead}</p>\n` : ""}${acciones ? acciones + "\n" : ""}${
    anclas
      ? `        <nav class="chips-ancla" aria-label="En esta página">\n` +
        anclas
          .map((a) => `          <a href="#${a.id}">${esc(a.n)}</a>`)
          .join("\n") +
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

      ${
        /* Secundario: cada página ya tiene su acción principal arriba, y hay
           un solo sólido por pantalla. */ ""
      }<p class="pg-cta"><a class="btn sec" href="/app">Abrir Cota Cero</a></p>
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
  // El ancla sale del nombre: «La Costa — Colastiné…» → «la-costa».
  id: nombre
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ —.*/, "")
    .replace(/[^a-z]+/g, "-")
    .replace(/^-|-$/g, ""),
  items: puntos.filter((p) => grupoDe(p) === nombre),
})).filter((g) => g.items.length);

/* Atajos por zona arriba, y cada zona en UN panel con filas. Eran treinta
   tarjetas sueltas: cinco pantallas de scroll en el teléfono para llegar a
   La Costa, y el nombre de la zona perdido entre dos filas de tarjetas. */
const atajos = `      <nav class="chips-ancla atajos-zona" aria-label="Zonas">
${agrupados
  .map(
    (g) =>
      `        <a href="#${g.id}">${esc(g.nombre)} <span class="cuenta-zona">${g.items.length}</span></a>`,
  )
  .join("\n")}
      </nav>`;

const lista = agrupados
  .map(
    (g) => `        <section class="zona-puntos" id="${g.id}">
          <div class="zp-cabeza">
            <h2>${esc(g.nombre)}</h2>
            <span class="eti">${g.items.length} ${g.items.length === 1 ? "punto" : "puntos"}</span>
          </div>
          <ul class="lista-zona">
${g.items
  .map(
    (p) => `            <li>
              <a class="punto fila-punto" href="geo:${p.lat},${p.lon}?q=${p.lat},${p.lon}(${encodeURIComponent(p.nombre)})">
                <span class="np">${++numero}</span>
                <span class="txt">
                  <span class="n">${esc(p.nombre)}</span>
                  <span class="d">${esc(p.direccion)}</span>
                </span>
                <span class="ir">Mapa →</span>
              </a>
            </li>`,
  )
  .join("\n")}
          </ul>
        </section>`,
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
  // Sin chip: «Santa Fe · oficiales del municipio» era un rótulo decorativo
  // encima de un h1 que ya dice las dos cosas.
  h1:
    "Los " +
    puntos.length +
    " puntos de encuentro ante una inundación en Santa Fe",
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
        sabe en tiempo real. <b>Antes de mover a alguien, llamá al
        <a href="tel:103">103</a> (Defensa Civil).</b>
      </div>`,
    atajos,
    `      <div class="zonas">
${lista}
      </div>`,
    `      <section class="puntos-pie">
        <p class="chico">
          Fuente: capa <code>puntos_de_encuentro</code> del GeoServer público de
          la Municipalidad de Santa Fe, la misma que dibuja el GeoPortal. Los
          grupos son nuestros, deducidos de las coordenadas para que puedas
          ubicarte: no son los distritos del Plan de Contingencia.
        </p>
        <p class="chico">
          Para tenerlo en papel: la
          <a href="/guia">guía de emergencia</a> entra en una carilla e incluye
          un renglón para escribir tu punto de encuentro y el de repuesto. Se
          imprime, se pega en la heladera y no necesita batería.
        </p>
        ${
          /* Enlaces tel: y no texto: en el teléfono, que es donde se mira
             esta página, el número se toca. */ ""
        }<div class="telefonos-emergencia">
          <a href="tel:103"><b>103</b><span>Defensa Civil — activación de puntos y evacuación</span></a>
          <a href="tel:107"><b>107</b><span>Emergencias médicas</span></a>
          <a href="tel:911"><b>911</b><span>Policía</span></a>
        </div>
      </section>`,
    /* «Cuándo ir» y «Qué llevar» eran un rótulo mono encima de un h2 que
       decía otra cosa. Ahora el título es uno solo y dice las dos. */
    `      <div class="rejilla-2 cuando-que">
        <section class="bloque">
          <h2>Cuándo ir: cuando lo indiquen para tu zona</h2>
          <p>
            No hace falta esperar a tener agua en la puerta: si Defensa Civil o
            el municipio avisan, salí. El punto de encuentro es donde te van a
            estar esperando y desde donde se organiza el traslado a un centro de
            evacuados si hiciera falta.
          </p>
          <div class="aviso">
            Si tenés que moverte, <b>no cruces agua en movimiento</b>, ni a pie
            ni en auto. Treinta centímetros de corriente arrastran a una persona
            y sesenta arrastran un vehículo. Abajo no se ve el pozo, la cloaca
            abierta ni el cable caído.
          </div>
        </section>
        <section class="bloque">
          <h2>Qué llevar: lo mínimo, en una bolsa</h2>
          <p class="chico">
            La <b>Mochila de Emergencia</b> del Plan de Contingencia municipal,
            textual:
          </p>
          <ul class="tildes">
            <li>Documentos importantes en bolsa de plástico (DNI y todo otro documento familiar de importancia).</li>
            <li>Botiquín de primeros auxilios y medicinas habituales.</li>
            <li>Manta ligera y ropa de abrigo.</li>
            <li>Linterna y baterías extra.</li>
            <li>Radio y pilas para mantenerse informados si se corta la luz.</li>
          </ul>
          <p class="chico">
            En la app la lista es más larga —agua, comida, cargador, cosas de los
            animales— y ahí está marcado cuáles son del plan municipal y cuáles
            agregamos nosotros. El plan también pide cortar la energía eléctrica
            y cerrar las llaves de gas antes de salir, y llamar al
            <b>103 (COBEM)</b> si en la familia hay alguien con discapacidad.
          </p>
${selloFuente("emergencias")}
        </section>
      </div>`,
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

/* Lo que va entre la alerta de la ciudad y el récord: el ancho entero de la
   escala con la que se decide. Sale de las constantes, no escrito a mano. */
const ESCALA_DECISION = nm(
  (recordHist ? recordHist[1] : 7.43) - ESTACION.alerta,
  2,
);

/* Una fila del ejemplo: número, qué se hace y el valor que queda. Reemplaza
   a los tres `paso()` sueltos, que eran tres tarjetas con su pastilla: la
   cuenta se leía repartida en media pantalla de cajas. */
const filaEjemplo = ({ n, titulo, html, valor }) => `          <li class="ej-fila">
            <span class="numerito" aria-hidden="true">${n}</span>
            <div>
              <h3>${esc(titulo)}</h3>
${html}
            </div>
            <span class="ej-valor">${esc(valor)}</span>
          </li>`;

const htmlDatos = pagina({
  clave: "datos",
  migaja: "La cota de tu terreno y los datos",
  /* El h1 se queda en la pregunta de la cota: es lo que se busca y lo que
     declara lib/paginas.js. El diseño de 2026 proponía «Cómo se calcula tu
     nivel de aviso», que es la pregunta de la app, no la del buscador. Sin
     chip encima: era un segundo título en chiquito. */
  h1: "¿Cuál es la cota de tu terreno en Santa Fe, y de dónde sale?",
  lead:
    "Tres datos —<b>la altura de tu terreno</b>, <b>el cero de la regla del " +
    "puerto</b> y <b>tu distancia al puerto</b>— dan tu umbral estimado: la " +
    "lectura del hidrómetro a la que el agua alcanzaría la cota de tu terreno. " +
    "En la app se llama «tu nivel de aviso».",
  jsonld: {
    "@context": "https://schema.org",
    "@type": "Article",
    headline:
      "La cota de tu terreno en Santa Fe: el cálculo y de dónde salen los datos",
    inLanguage: "es-AR",
    author: { "@type": "Person", name: "Ariel Benz" },
    mainEntityOfPage: SITIO + "/datos",
  },
  bloques: [
    {
      /* La cuenta entera arriba, para quien vino a buscar sólo eso, y los
         atajos a las cinco secciones. Los números son los del cálculo: si
         cambian en js/app/config.js, cambian acá (ver AUDITORIA.md). */
      oscuro: true,
      id: "cuenta-entera",
      titulo: "La cuenta, entera",
      html: `        <p class="formula">
          <span>cota del terreno <b>− 0,50</b></span>
          <span><b>−</b> cero del hidrómetro <b>(8,20)</b></span>
          <span><b>−</b> km río arriba <b>× 0,045</b></span>
          <span class="f-total"><b>=</b> tu nivel de aviso</span>
        </p>
        <p class="chico">Una referencia para prepararte, no el minuto en que entra el agua. Cota Cero <b>no genera información hidrológica propia</b>: toma datos públicos, los combina y los cita.</p>
        <nav class="atajos-num" aria-label="En esta página">
          <a href="#rio"><b>1</b> El nivel del río</a>
          <a href="#terreno"><b>2</b> La altura de tu terreno</a>
          <a href="#cuenta"><b>3</b> Cómo se relacionan</a>
          <a href="#firme"><b>4</b> Qué tan firme es esto</a>
          <a href="#fuentes"><b>5</b> Las fuentes</a>
        </nav>`,
    },
    {
      id: "rio",
      kicker: "1 · El nivel del río",
      titulo: "Lo mide el Estado, no nosotros",
      html: `        <p>
          El número grande de la app es la lectura del <b>hidrómetro del
          Puerto</b>: la lee Prefectura y la publica el INA. Cota Cero la
          muestra; no la mide, no la corrige y no la promedia.
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
          Los umbrales los publica la propia estación en la API del sistema de
          alerta del INA; si la API falla, la app cae sola al reporte diario.
          Si tampoco contesta, muestra la última lectura con su fecha, y a las
          48 horas deja de darla por vigente. <b>Nunca inventa un valor.</b>
        </p>
        ${selloFuente("nivelRio", "serie 30, altura hidrométrica")}`,
    },
    {
      id: "terreno",
      kicker: "2 · La altura de tu terreno",
      titulo: "La cota sale de las curvas de nivel del municipio",
      html: `        <p>
          La <b>cota</b> es la altura de un terreno sobre el mar, en el sistema
          oficial argentino (IGN). La Municipalidad publica <b>169 curvas de
          nivel</b>, cada 50 cm: si caminás sobre una, no subís ni bajás.
        </p>
        <div class="curvas-dibujo" aria-hidden="true">
          <div class="cd-linea"><span>16,0 m</span><i></i></div>
          <div class="cd-casa">🏠 tu casa</div>
          <div class="cd-linea"><span>15,5 m</span><i></i></div>
        </div>
        <p>
          Si tu casa cae entre dos, la app estima su altura y <b>descuenta
          medio metro</b>, por las dudas.
        </p>
        <p>
          Las curvas terminan en el límite de la ciudad. En <b>San José del
          Rincón y Arroyo Leyes</b> la altura sale de los <b>puntos con cota</b>
          que midió la Provincia en 2005, en la misma campaña de la que salieron
          las curvas: la app toma los cuatro más cercanos a tu casa. Ahí el
          terreno cambia mucho de un lugar a otro —terraplenes, cunetas,
          rellenos—, así que descuenta <b>un metro</b> en vez de medio. Donde no
          hay ni curvas ni puntos te pide la cota a mano, en vez de caer a una
          fuente peor.
        </p>
        <p class="chico">
          Es una estimación, no una medición de tu terreno: la curva pasa cerca,
          no por tu puerta.
        </p>

        <h3>Cuánto se equivocan las curvas</h3>
        ${
          /* AUDITORIA.md §4: 330 puntos fijos de la red municipal, sin las
             marcas sobre estructuras, contra elevacionDe(). Si se repite la
             corrida, los cuatro números de acá salen de esa salida. */ ""
        }<p>
          Las comparamos con <b>330 puntos que la Municipalidad midió en la
          calle</b>. La mitad cae a menos de 42 cm de lo medido, y 9 de cada 10
          a menos de 1,10 m. Casi siempre del lado seguro: las curvas dan el
          terreno <b>más bajo</b> de lo que es, y entonces la app avisa antes.
        </p>
        <p class="chico">
          Para el otro lado fallan en puntos sueltos —una bajada, el ingreso a
          un barrio, un anfiteatro—: en 6 de los 330 el terreno quedó más bajo
          que lo que dicen las curvas, aun descontando el medio metro. Las
          curvas son de 2005 y se trazaron a mano sobre un relevamiento de 1992.
        </p>

        <h3>Por qué no un satélite</h3>
        <p>
          Los modelos satelitales miden <b>techos y copas de árboles</b>, no el
          piso. Contra <b>36 puntos medidos en campo por el IGN</b>, el que usaba
          la app tenía un <b>desvío estándar de 7,46 m</b>, con casos de hasta
          23 m.
        </p>
        ${
          /* Desvío estándar, NO error promedio: el sesgo medio era chico
             (0,89 m). Lo que descalifica a la fuente es la dispersión. Las
             barras van a la misma escala y el ancho sale de los números. */ ""
        }<div class="barras-error" role="img" aria-label="Desvío estándar del satélite, 7,46 metros, contra ${ESCALA_DECISION} metros entre la alerta de la ciudad y el récord.">
          <div class="be-fila">
            <span class="be-k">Error del satélite (desvío estándar)</span>
            <span class="be-pista"><i class="be-mal" style="width:100%"></i></span>
            <span class="be-v">7,46 m</span>
          </div>
          <div class="be-fila">
            <span class="be-k">De la alerta (${nm(ESTACION.alerta, 2)}) al récord (${RECORD_M})</span>
            <span class="be-pista"><i style="width:${((parseFloat(ESCALA_DECISION.replace(",", ".")) / 7.46) * 100).toFixed(1)}%"></i></span>
            <span class="be-v">${ESCALA_DECISION} m</span>
          </div>
        </div>
        <p><b>El error de la fuente era más grande que toda la escala de la decisión.</b></p>
        <p class="chico">
          Ni la mejor curva reemplaza un relevamiento de tu terreno: no sabe si
          está elevado sobre la vereda ni si la casa tiene escalones. <b>El
          número que vale es el de un relevamiento, la escritura o el plano de
          mensura.</b> Si lo conseguís, cargalo a mano en la app.
        </p>
        ${selloFuente("topografia", "curvas de nivel de la ciudad")}`,
    },
    {
      id: "cuenta",
      kicker: "3 · Cómo se relacionan",
      titulo: "Dos alturas, una resta",
      html: `        <p>
          El hidrómetro no mide altura sobre el mar: mide cuánto sube el agua
          sobre el <b>cero de su escala</b>, que está a una altura conocida.
          Sumando las dos se obtiene la superficie del agua en la misma escala
          que tu terreno.
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
          Lo que a una persona le sirve no es «cuánta agua hay hoy» sino
          <b>«¿qué tendría que marcar el hidrómetro para que el agua llegue a
          la altura de mi terreno?»</b>. Es la misma cuenta despejada.
        </p>`,
    },
  ],
  sueltos: [
    `      <section class="bloque ejemplo">
        <div class="ej-cabeza">
          <span class="eti">Ejemplo · Colastiné Norte</span>
          <span class="eti">11 km río arriba</span>
        </div>
        <ol class="ej-filas">
${[
  filaEjemplo({
    n: 1,
    titulo: "La altura de tu terreno, en metros IGN",
    html: `              <p>Entre dos curvas, medio metro por debajo, por las dudas: es el <b>escenario pesimista</b>, el número con el que hay que decidir.</p>`,
    valor: "15,80 → 15,30",
  }),
  filaEjemplo({
    n: 2,
    titulo: "Restar el cero del hidrómetro: 8,20 m",
    html: `              <p>Pasa tu terreno a la escala del hidrómetro. El INA publica 8,378: esos 18 cm están sin resolver. <a href="#abiertas">Por qué usamos 8,20</a>.</p>`,
    valor: "− 8,20 = 7,10",
  }),
  filaEjemplo({
    n: 3,
    titulo: "Restar el desnivel río arriba: 0,045 m por km",
    html: `              <p>El río no es una pileta: río arriba el agua está más alta. 11 × 0,045 = 0,495, que redondeamos a 0,50.</p>`,
    valor: "− 0,50 = 6,60",
  }),
].join("\n")}
        </ol>
      </section>`,
    /* El resultado en la banda oscura. El número grande va con la convención
       de la app (≈ y un decimal) y la cuenta exacta debajo: es la excepción
       de CLAUDE.md, «el desglose conserva la aritmética exacta». */
    `      <section class="bloque oscuro resultado">
        <p class="kicker">Resultado del ejemplo</p>
        <p class="dato-grande">≈ 6,6 m</p>
        <p class="cuenta-chica">15,30 − 8,20 − 0,50 = 6,60</p>
        <p>
          Cuando el hidrómetro del Puerto se acerque a <b>6,60 m</b>, el nivel
          de agua equivalente alcanza la cota de ese terreno según el modelo.
          <b>No significa que el terreno se inunde exactamente a ese nivel</b>:
          lo que pase depende de las defensas, del bombeo, del viento y de la
          lluvia, y nada de eso está en la cuenta.
        </p>
      </section>`,
    bloque({
      id: "firme",
      kicker: "4 · Qué tan firme es esto",
      titulo: "Lo que se comprobó, lo que está en discusión y lo que falta",
      /* El orden es deliberado: antes los subtítulos abrían en negativo y
         quien leía en diagonal se llevaba sólo eso. Primero lo comprobado,
         después lo que falta, con el MISMO peso: tres tarjetas iguales. No se
         sacó ni se suavizó una sola admisión. El razonamiento largo del 8,20
         va plegado y no borrado: la app enlaza acá («por qué usamos 8,20») y
         tiene que encontrar la respuesta entera. */
      html: `        <p>Preferimos publicar nuestros supuestos antes de que los encuentre otro.</p>
        <div class="firme-tres">
          <div class="firme-caja f-ok">
            <span class="eti">Se comprobó</span>
            <h3>La crecida de ${RECORD_ANIO}</h3>
            <table class="cuenta">
              <tr><td>Puerto, junio de ${RECORD_ANIO}</td><td>${RECORD_M} m</td></tr>
              <tr><td>Arroyo Leyes, registrado</td><td>16,70 IGN</td></tr>
              <tr class="total"><td>Lo que da este modelo</td><td>16,71 IGN</td></tr>
            </table>
            <p class="chico">Un centímetro. Pero es <b>un punto, de una crecida, de un año</b>: no demuestra que el modelo valga en todos lados.</p>
          </div>
          <div class="firme-caja f-discusion" id="abiertas">
            <span class="eti">En discusión</span>
            <h3>Dos números sin cerrar</h3>
            <p><b>El cero: 8,20 o 8,378.</b> 8,20 es el de la normativa de Rincón; el INA publica 8,378 desde 2016. Pueden ser el mismo punto en dos sistemas de alturas.</p>
            <p><b>La pendiente: 0,045 m/km.</b> Da bien en ${RECORD_ANIO}, pero es una sola observación y usamos un solo valor para todas las zonas.</p>
            <details class="h-detalle">
              <summary>Por qué no cambiamos ninguno</summary>
              <p class="chico">
                <b>El cero.</b> El Reglamento de Edificaciones de San José del
                Rincón fija la cota de edificación en
                <span class="cita">16.00 I.G.M (7.80 m Hidrómetro Pto Santa Fe)</span>
                —la diferencia es exactamente 8,20— y coincide con el que da un
                ingeniero hidrólogo de la FICH-UNL. El INA publica 8,378 de una
                campaña INA-IGN de diciembre de 2016. Los 18 cm no son de
                redondeo: en enero de 2017 el país cambió de sistema de alturas
                —del SRVN71 al SRVN16— y antes convivían referencias del ex
                Ministerio de Obras Públicas, de Obras Sanitarias y de sistemas
                municipales. Lo que importa no es cuál número es más nuevo,
                sino que el cero y las curvas estén en el <b>mismo</b> sistema,
                y las curvas no declaran el suyo. Mover el cero a 8,378 metería
                un sesgo de 18 cm en todos los umbrales sin que nadie se entere.
              </p>
              <p class="chico">
                <b>La pendiente.</b> El reglamento de Rincón, 16 km río arriba,
                convierte cota a hidrómetro sin ninguna corrección por
                distancia; con la pendiente de la app serían 72 cm más. O el
                reglamento simplifica, o la pendiente real en ese tramo es otra:
                depende del tramo, del caudal y de la condición hidráulica del
                momento.
              </p>
            </details>
          </div>
          <div class="firme-caja f-falta">
            <span class="eti">Falta</span>
            <h3>Que lo revisen especialistas</h3>
            <p>Ningún organismo ni universidad revisó este modelo. Nadie lo aprobó.</p>
            <p class="chico">Hasta que lo revisen —Gestión de Riesgos, INA, FICH-UNL, Recursos Hídricos— lo que la app publica son <b>niveles de referencia estimados</b>, y así están nombrados en toda la interfaz. Cota Cero no tiene vínculo con esos organismos ni cuenta con su aval.</p>
          </div>
        </div>
        ${selloFuente("altimetria", "ceros de escala y sistema de alturas")}`,
    }),
    /* La app enlaza acá desde Mi casa («Qué no dice este número»): el ancla
       #no-dice no se puede mover. */
    bloque({
      id: "no-dice",
      titulo: "Hay dos maneras de inundarse. Cota Cero mira una sola.",
      html: `        <p>
          Un barrio puede tener margen amplio contra el Paraná y entrar en
          emergencia igual, por lluvia. El modelo tampoco sabe si entre el río y
          tu casa hay un terraplén, ni en qué estado está.
        </p>
        <div class="dos-maneras">
          <div class="dm-caja dm-fluvial">
            <span class="eti">Fluvial · lo que mira</span>
            <h3>Crece el río</h3>
            <p>El Paraná sube durante semanas y se ve venir en el hidrómetro. Es lo que traduce tu nivel de aviso.</p>
          </div>
          <div class="dm-caja dm-pluvial">
            <span class="eti">Pluvial · lo que no</span>
            <h3>Llueve sobre la ciudad</h3>
            <p>Mucha lluvia en pocas horas, o varios días seguidos, anegan calles y casas por los desagües, sola o combinada con el Salado. Puede pasar con el río bajo.</p>
          </div>
          <div class="dm-caja dm-juntan">
            <span class="eti">Cuando se juntan</span>
            <h3>Río alto + lluvia</h3>
            <p>Con el río alto las bombas no pueden desagotar contra el agua de afuera. El municipio planifica para <b>río en 6 m más lluvia de 200 a 300 mm</b>.</p>
          </div>
        </div>
        <p class="chico">
          Y una defensa protege mientras funciona: en 2003 el agua entró por un
          tramo abierto de una defensa existente. Que haya obra no es garantía.
          Más dudas de este tipo, contestadas cortas, en
          <a href="/preguntas">preguntas frecuentes</a>.
        </p>
        ${selloFuente("emergencias", "Plan de Contingencia")}`,
    }),
    bloque({
      oscuro: true,
      titulo: "Lo que todavía no sabe",
      html: `        <ul class="no-sabe">
          <li><b>En qué sistema de alturas están las curvas.</b> Los metadatos no lo declaran, y de eso depende si el cero correcto es 8,20 o 8,378.</li>
          <li><b>Si la pendiente vale en todos los tramos.</b> Está contrastada en un punto de una crecida.</li>
          <li><b>Cuánto se equivoca la cota en tu cuadra.</b> Medido contra 330 puntos del municipio, el medio metro alcanza en 98 de cada 100. En un pozo o una bajada que la curva no dibuja puede no alcanzar.</li>
          <li><b>Los km río arriba de cada zona.</b> Sólo Arroyo Leyes (24 km) está publicado. Equivocarse 5 km son 22 cm.</li>
          <li><b>En qué estado está la defensa de tu zona.</b> Cambia el resultado más que cualquiera de las constantes.</li>
          <li><b>Nada sobre la lluvia sobre tu barrio.</b> El agua puede llegar antes por el desagüe que por el río.</li>
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
          Todo lo que muestra la app sale de acá. Cada ficha lleva la página del
          organismo y el dato crudo, tal como lo pide la app.
        </p>
        <div class="fuentes-rejilla">
${[
  "nivelRio",
  "topografia",
  "topografiaCosta",
  "emergencias",
  "altimetria",
  "historia",
  "cartografia",
]
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

/* ---------- /preguntas ----------
   Cada respuesta arranca con una línea corta en negrita: la que contesta.
   Después va la explicación. Quien abre la pregunta en la vereda lee la
   primera línea y ya sabe; el resto es para quien quiere el porqué.
   [pregunta, respuesta corta, explicación] */
const PREGUNTAS = [
  [
    "¿Por qué mi nivel de aviso no es el 5,30 de la alerta?",
    "Porque tu terreno está a otra altura que el resto de la ciudad.",
    "La alerta de la ciudad es un solo número para toda Santa Fe: con ella se activa el plan de contingencia. Si tu terreno es bajo o está río arriba, tu número es más chico que los 5,30 m; si es alto, más grande. Los dos conviven: el tuyo sirve para prepararte antes, no para decidir en lugar de Defensa Civil.",
  ],
  /* Segunda a propósito: es la duda que más se cruza con la primera, y la
     app no la contestaba en ningún lado (feedback de un vecino). Usa sólo
     números que ya publica el municipio. */
  [
    "¿Y si llueve mucho?",
    "Tu nivel de aviso no lo mira: sólo mide el río.",
    "Mucha lluvia en poco tiempo, o varios días seguidos, puede anegar calles y casas aunque el Paraná esté bajo. Y con el río alto es peor: las bombas no alcanzan a sacar el agua de la ciudad. El municipio planifica para río en 6 m más lluvia de 200 a 300 mm.",
  ],
  [
    "¿El agua entra justo cuando el río llega a mi nivel de aviso?",
    "No: es un cálculo aproximado.",
    "No sabe del terraplén (el anillo de defensas), de las bombas ni de la lluvia. El agua puede llegar antes por los desagües, o no llegar. Sirve para saber cuándo prepararte, no para adivinar el minuto. Por eso el número va redondeado: la altura del terreno sale de un plano con líneas cada medio metro.",
  ],
  [
    "¿La app avisa sola cuando el río sube?",
    "Sí, si activás los avisos.",
    "Llega una notificación cuando el nivel sube 15 cm desde el último aviso o cuando pasa la alerta o la evacuación de la ciudad. El aviso se arma en tu teléfono: el servidor no conoce tu nivel de aviso ni tu zona, sólo despierta a la app, que compara contra el número guardado en tu dispositivo.",
  ],
  [
    "¿De dónde sale la altura de mi terreno?",
    "De las curvas de nivel de la Municipalidad de Santa Fe.",
    "Están trazadas cada 50 cm, en metros IGN: por eso el margen de ±0,5 m, que medido contra 330 puntos del municipio alcanza en 98 de cada 100. También podés escribirla vos, que figura en planos de mensura y escrituras. No se usa elevación satelital: se midió contra puntos de campo del IGN y su error superaba la escala entera de la decisión.",
  ],
  [
    "¿Qué hago si mi dirección queda fuera de la zona con curvas?",
    "Escribí la altura a mano.",
    "La app te lo dice y te la pide, en vez de usar una fuente peor. Las curvas municipales cubren la ciudad, y los puntos medidos por la Provincia, San José del Rincón y Arroyo Leyes; más allá no tenemos con qué calcularla.",
  ],
  [
    "¿Funciona sin conexión?",
    "Sí, una vez cargada.",
    "La app guarda lo esencial: tu nivel de aviso, tu plan familiar, los 30 puntos de encuentro y la última lectura del río con su fecha. Sin conexión ves esa última lectura, nunca un número inventado.",
  ],
  [
    "¿Quién ve mi plan familiar y mis datos?",
    "Nadie: se guardan sólo en tu teléfono.",
    "El plan, tu nivel de aviso y tu zona no salen de ahí. Lo único que viaja a un servidor es el texto que mandes por el formulario de sugerencias, y el formulario lo dice. Aparte, la app cuenta cuánta gente la usa con un número al azar que no identifica a nadie.",
  ],
  [
    "¿Esto reemplaza a la alerta de Defensa Civil?",
    "No. La orden de evacuación la da Defensa Civil.",
    "Es un cálculo aproximado para prepararte antes, hecho por un vecino y sin vínculo con el municipio. Si el río llega a tu nivel de aviso, armá el plan y llamá al 103 si tenés dudas.",
  ],
  [
    "¿Cada cuánto se actualiza el nivel?",
    "Una vez por día.",
    "El INA publica una lectura por día del hidrómetro del Puerto. La app la toma de ese reporte y muestra siempre la fecha del dato, así sabés qué tan fresco es.",
  ],
  /* Se busca así —«cota del río paraná», «hidrómetro río paraná»— y Google
     mandaba esas búsquedas a la portada, que no lo explica. La respuesta
     separa la cota del nivel, que es justo la confusión. */
  [
    "¿Qué es la cota del río?",
    "Así se le suele decir al nivel del río: lo que marca el hidrómetro del Puerto.",
    "El hidrómetro es la regla graduada del Puerto de Santa Fe, y el INA publica su lectura una vez por día. Sus metros no se cuentan desde el mar sino desde el cero de esa regla: «el río está en 5 m» no quiere decir que el agua esté a 5 m de altura. La cota, en cambio, es la altura de un terreno sobre el mar (la cota IGN de planos y escrituras). Para saber si el río puede llegar a tu terreno hay que pasar los dos números a la misma escala, y eso es tu nivel de aviso.",
  ],
];

const htmlPreguntas = pagina({
  clave: "preguntas",
  migaja: "Preguntas frecuentes",
  h1: "Preguntas sobre el río, tu terreno y las inundaciones",
  lead: "Las dudas que más aparecen, contestadas sin vueltas. Primero la respuesta corta.",
  jsonld: {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: PREGUNTAS.map(([q, corta, a]) => ({
      "@type": "Question",
      name: q,
      acceptedAnswer: { "@type": "Answer", text: corta + " " + a },
    })),
  },
  bloques: [],
  sueltos: [
    `      <div class="faq-y-corto">
        <section class="bloque faq-lista">
${PREGUNTAS.map(
  ([q, corta, a]) => `          <details class="faq">
            <summary>${esc(q)}</summary>
            <p><b class="corta">${esc(corta)}</b> ${esc(a)}</p>
          </details>`,
).join("\n")}
        </section>
        ${
          /* Las cuatro ideas que hay que llevarse aunque no se abra ninguna
             pregunta. Al costado en pantalla ancha, debajo en el teléfono. */ ""
        }<aside class="bloque en-corto" aria-labelledby="en-corto-t">
          <h2 id="en-corto-t">En corto</h2>
          <ul class="flechas">
            <li>Mide el río, no la lluvia.</li>
            <li>Es aproximado: sirve para prepararte, no para adivinar el minuto.</li>
            <li>Tus datos no salen de tu teléfono.</li>
            <li>La orden de salir la da Defensa Civil.</li>
          </ul>
          <a class="btn-emergencia fila-103" href="tel:103"><span>Defensa Civil</span><b>103</b></a>
        </aside>
      </div>`,
    bloque({
      oscuro: true,
      titulo: "¿Tu pregunta no está?",
      html: `        <p>
          Mandala por el formulario. No es una vía de auxilio: ante una
          emergencia, llamá al <b>103</b>.
        </p>
        <p><a href="/contacto">Escribinos →</a></p>`,
    }),
  ],
});

/* ---------- /charlas ----------
   Cada dato de acá —evento, año, duración— está verificado contra la ficha de
   ted.com, no copiado de un borrador. Dos salieron distintos de lo que decía
   el diseño: la de Vicki Arroyo es de TEDGlobal, no de TED a secas, y la de
   Kongjian Yu es de TEDxBoston 2022, no una charla TED sin fecha. La de Yu va
   sin duración a propósito: no la pude confirmar en la fuente y no se inventa
   un número para llenar un casillero. */

/* Escrito con palabras y no con un número: "Seis charlas" en un lead y luego
   siete en la lista es el clásico literal que se desincroniza de los datos. */
const NUMERO_CHARLAS =
  ["Cero", "Una", "Dos", "Tres", "Cuatro", "Cinco", "Seis", "Siete", "Ocho"][
    CHARLAS.length
  ] || String(CHARLAS.length);

/* ---------- /guia: la hoja para imprimir ----------
   Es lo contrario del plan que imprime la app: ésta sale EN BLANCO, con
   renglones y casillas, para llenar con birome. El público es el que la app no
   alcanza —quien no tiene teléfono, o lo tiene y nunca cargó nada—, y el
   camino es que alguien la imprima en el centro vecinal y la reparta.

   Las dos listas salen de public/lib/listas.js, las MISMAS que usa la app: si mañana
   se agrega algo a la mochila, aparece acá solo. Los teléfonos también son los
   verificados del proyecto, no una lista nueva.

   Entra en UNA carilla A4 y eso no es estética: fotocopiar cien de dos
   carillas es el doble de plata. `node scripts/guia-pdf.js` lo verifica y
   avisa si se pasó. */
const renglones = (n) =>
  Array.from({ length: n }, () => '<span class="g-linea"></span>').join("");

const casillas = (lista) =>
  lista
    .map(
      ([texto, municipal]) =>
        `<li><span class="g-caja"></span><span${municipal ? ' class="g-muni"' : ""}>${esc(texto)}</span></li>`,
    )
    .join("\n          ");

/* Los cinco que entran y sirven en una crecida. Los siete completos están en
   la app y en /puntos-de-encuentro. */
const TELEFONOS_GUIA = [
  ["Defensa Civil", "103"],
  ["Emergencias", "911"],
  ["Bomberos", "100"],
  ["Prefectura (emergencias náuticas)", "106"],
  ["Municipalidad", "0800-777-5000"],
];

const htmlGuia = pagina({
  clave: "guia",
  migaja: "Guía de emergencia",
  css: "/css/guia.css",
  h1: "Guía de emergencia por crecida",
  lead:
    "Una hoja para llenar a mano y pegar en la heladera. Imprimila, completala " +
    "con la familia y dejala donde todos la vean. No necesita señal ni batería.",
  acciones: `        <p class="pg-acciones">
          <a class="btn" href="/guia.pdf" download>Descargar el PDF</a>
        </p>`,
  bloques: [
    {
      html: `        <div class="guia-hoja">
        <header class="g-cab">
          <div class="g-marca">
            ${marcaSvg("mg")}
            <div>
              <b>Guía de emergencia por crecida</b>
              <span class="g-familia">Familia <span class="g-linea g-larga"></span></span>
            </div>
          </div>
          <a class="g-103" href="tel:103"><span>Defensa Civil</span><b>103</b></a>
        </header>

        <section class="g-umbral">
          <span class="g-eti">Nuestro nivel de aviso <em>(lo dice la app, en «Mi casa»)</em></span>
          <p class="g-frase">
            Nos preparamos y salimos cuando el río llegue a
            <span class="g-linea g-media"></span> m, o cuando lo indique
            Defensa Civil — lo que pase primero.
          </p>
          <p class="g-chico">
            Alerta de la ciudad ${nm(ESTACION.alerta, 2)} m · evacuación
            ${nm(ESTACION.evacuacion, 2)} m. Es un cálculo aproximado y mide
            sólo el río: con mucha lluvia, la calle puede anegarse antes.
          </p>
        </section>

        <div class="g-cols">
          <div>
            <h2 class="g-h">Nos encontramos en</h2>
            <p class="g-campo">Punto principal: <span class="g-linea"></span></p>
            <p class="g-campo">Si no se puede: <span class="g-linea"></span></p>
            <p class="g-chico">
              Los puntos oficiales abren cuando el municipio los activa:
              confirmá al 103 antes de salir.
            </p>

            <h2 class="g-h">Teléfonos</h2>
            ${
              /* Dos renglones en blanco arriba de la lista fija: el teléfono
                 que importa en una crecida suele ser el de un familiar de otro
                 barrio, no el de un organismo. Sin la bajada nadie sabe qué
                 escribir ahí y quedan vacíos. */ ""
            }
            <p class="g-campo g-sub">Un familiar o vecino fuera de la zona:</p>
            <p class="g-campo">${renglones(2)}</p>
            <table class="g-tel">
${TELEFONOS_GUIA.map(([q, n]) => `              <tr><td>${esc(q)}</td><td>${esc(n)}</td></tr>`).join("\n")}
            </table>

            <h2 class="g-h">Quién hace qué</h2>
            <p class="g-campo">${renglones(3)}</p>

            <h2 class="g-h">Si tenemos que salir</h2>
            <ul class="g-reglas">
              <li><b>No cruzar agua que corre</b>, ni a pie ni en auto.</li>
              <li>30 cm —menos que una rodilla— arrastran a una persona.</li>
              <li>60 cm —por la cintura de un chico— arrastran un auto.</li>
              <li>Cortar la luz y el gas. Llevar esta hoja.</li>
            </ul>
          </div>

          <div>
            <h2 class="g-h">Mochila de emergencia</h2>
            <ul class="g-lista">
          ${casillas(MOCHILA)}
            </ul>

            <h2 class="g-h">En la casa, antes</h2>
            <ul class="g-lista">
          ${casillas(PREVIA)}
            </ul>
            <p class="g-chico g-sello">
              ● Los renglones marcados están en el Plan de Contingencia de la
              Municipalidad de Santa Fe. El resto lo agregamos nosotros.
            </p>
          </div>
        </div>

        <footer class="g-pie">
          <span>Cota Cero es una herramienta ciudadana que ayuda a interpretar
          información pública. El nivel de aviso es un cálculo aproximado; la
          orden de evacuación la da Defensa Civil. Nivel diario del río: reporte
          del INA.</span>
          <b>cotacerosf.com</b>
        </footer>
      </div>`,
    },
  ],
});

const htmlCharlas = pagina({
  clave: "charlas",
  migaja: "Charlas",
  h1: "Charlas que explican por qué existe esta app",
  lead:
    NUMERO_CHARLAS +
    " charlas TED y TEDx, cortas y gratuitas: prepararse antes, organizarse entre " +
    "vecinos, convivir con el agua y abrir los datos.",
  acciones: `        <p class="chico">En inglés, con subtítulos en ted.com · Ninguna habla de Santa Fe.</p>`,
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
  (
    c,
  ) => `        <a class="charla t-${c.tono}" href="${c.url}" target="_blank" rel="noopener">
          ${
            /* La miniatura es el fotograma que TED publica como og:image,
               alojado acá y no enlazado a pi.tedcdn.com: la CSP es
               img-src 'self', /charlas está precacheada, y enlazarla le
               mandaría a TED la IP de cada lector. Las baja
               scripts/charlas.js. `alt` vacío y aria-hidden porque el título
               que sigue dice lo mismo: para un lector de pantalla la imagen
               es ruido, no información. */ ""
          }
          <span class="mini">
            <img src="/img/charlas/${c.url.replace(/.*\/talks\//, "")}.jpg"
                 width="320" height="180" loading="lazy" decoding="async"
                 alt="" aria-hidden="true" />
            <span class="dur">${Math.round(c.duracion / 60)} min</span>
          </span>
          <span class="cuerpo">
            <span class="tit">${esc(c.titulo)}</span>
            <span class="ficha">${esc(c.ficha)} · «${esc(c.original)}»</span>
            <span class="txt">${esc(c.porque)}</span>
          </span>
        </a>`,
).join("\n")}
      </section>`,
  ],
  bloquesFinales: [
    {
      borde: true,
      html: `        <p class="chico" style="margin:0">
          ¿Conocés una charla que debería estar acá?
          <a href="/contacto">Mandala →</a>
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
const MESES =
  "enero febrero marzo abril mayo junio julio agosto septiembre octubre noviembre diciembre".split(
    " ",
  );
const enPalabras = (f) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(f || "");
  return m ? `${+m[3]} de ${MESES[+m[2] - 1]} de ${m[1]}` : "";
};
const anioDe = (f) => (f || "").slice(0, 4);

/* [anio, max, fecha_max, min, fecha_min, dias, dias_alerta, dias_evac] */
const filaHist = (f) => ({
  anio: f[0],
  max: f[1],
  fmax: f[2],
  min: f[3],
  fmin: f[4],
  dias: f[5],
  da: f[6],
  de: f[7],
});
const HIST = historia ? historia.anios.map(filaHist) : [];
const CRECIDAS = [...HIST].sort((a, b) => b.max - a.max).slice(0, 8);
const BAJANTES = [...HIST].sort((a, b) => a.min - b.min).slice(0, 8);
const RECORD = CRECIDAS[0];

/* Los rankings de crecidas y bajantes salieron de la página: quedaban dos
   listas de ocho puestos arriba de la tabla completa, que ya trae los mismos
   años con los mismos números. CRECIDAS y BAJANTES siguen calculándose porque
   los usa el resumen de arriba (el récord y la bajante más honda). */

const tablaHist = HIST.map(
  (e) =>
    `                  <tr><td>${e.anio}</td><td>${nm(e.max, 2)}</td><td>${nm(e.min, 2)}</td><td>${e.da}</td></tr>`,
).join("\n");

/* ---------- /historia ----------
   Cien años del Paraná. Los números salen de datos-abiertos/historia.json,
   que genera `node scripts/historia.js` desde la serie del INA, y van en el
   HTML: las fichas y la tabla los emite este script. historia.js sólo agrega
   la franja que se recorre. Si acá hubiera un número escrito a mano, el día
   que la serie se actualice quedaría mintiendo.

   Por qué existe: el hidrómetro es un número abstracto. "3,10 m" no le dice
   nada a nadie hasta que se lo ve al lado de los 7,43 de 1992 y de los −0,23
   de 2022. Esta página es la escala. */
const htmlHistoria = pagina({
  clave: "historia",
  migaja: "Cien años del Paraná",
  script: "/js/historia.js",
  // Sin chip ni kickers encima de los títulos: ver CLAUDE.md, «el mono en
  // mayúsculas etiqueta una cosa».
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
    /* Organization y no GovernmentOrganization: Google sólo acepta Person u
       Organization en `creator` y no reconoce los subtipos. Sin `license`
       a propósito: el INA no publica una para esta serie, y declarar una
       sería inventar un dato. Search Console lo marca como leve. */
    creator: {
      "@type": "Organization",
      name: ORGANISMOS.ina.nombre,
      url: ORGANISMOS.ina.url,
    },
    isAccessibleForFree: true,
    temporalCoverage: historia
      ? historia.desde + "/" + historia.hasta
      : undefined,
    variableMeasured: "Altura hidrométrica, en metros sobre el cero de escala",
    url: SITIO + "/historia",
  },
  bloques: [],
  sueltos: [
    `      <section class="bloque">
        <h2>El Paraná en más de cien años de registros</h2>
        <p>
          El Instituto Nacional del Agua publica la lectura diaria del
          hidrómetro del Puerto de Santa Fe desde el ${enPalabras(historia.desde)}. Son
          <b>${historia.dias.toLocaleString("es-AR")} días medidos</b> del
          mismo instrumento, y es la misma serie de la que sale el número que
          la app muestra hoy.
        </p>
        ${
          /* Las cuatro fichas son los datos en el HTML, no en el JS: ver
             CLAUDE.md, «No volver a mover contenido al JavaScript». */ ""
        }<dl class="fichas-hist">
          <div><dt>Mayor altura · ${enPalabras(RECORD.fmax)}</dt><dd>${nm(RECORD.max, 2)} m</dd></div>
          <div><dt>Bajante más honda · ${enPalabras(BAJANTES[0].fmin)}</dt><dd>${BAJANTES[0].min < 0 ? "−" : ""}${nm(Math.abs(BAJANTES[0].min), 2)} m</dd></div>
          <div><dt>Mediana de la serie diaria</dt><dd>${nm(historia.cuantiles[50], 2)} m</dd></div>
          <div><dt>Años con registro</dt><dd>${HIST.length}</dd></div>
        </dl>
        <p class="chico">
          Antes de 1925 el INA no publica esta serie. La crecida de 1905 que se
          cita seguido queda afuera: no la reconstruimos desde recortes de
          diario.
        </p>
      </section>

      <p id="h-cargando" class="chico" role="status">Cargando la línea de tiempo…</p>

      ${
        /* Lo interactivo, y SÓLO lo interactivo, espera al JavaScript: los
           datos de arriba y la tabla de abajo ya están en el HTML. */ ""
      }<div id="h-contenido" hidden>
        <section class="bloque">
          <h2>Recorré la serie año por año</h2>
          <p>
            Cada barra es un año: va del nivel más bajo al más alto que marcó el
            hidrómetro. Tocá una barra, o usá las flechas, para ver ese año.
          </p>
          <ul class="h-leyenda" aria-hidden="true">
            <li><i class="h-b-normal"></i>No llegó a la alerta de la ciudad</li>
            <li><i class="h-b-alerta"></i>Llegó a la alerta de la ciudad</li>
            <li><i class="h-b-evac"></i>Llegó a la evacuación de la ciudad</li>
          </ul>
          <div id="h-franja" class="h-franja" role="slider" tabindex="0"
            aria-label="Año de la serie"></div>
          <div class="h-detalle-anio">
            <div class="h-sel">
              <button type="button" class="h-flecha" id="h-anterior" aria-label="Año anterior">‹</button>
              <b id="h-anio" class="h-anio"></b>
              <button type="button" class="h-flecha" id="h-siguiente" aria-label="Año siguiente">›</button>
            </div>
            <div id="h-detalle-datos" class="h-detalle-datos"></div>
            <p id="h-detalle-texto" class="h-detalle-texto" role="status"></p>
          </div>
        </section>
      </div>

      <section class="bloque">
        <details class="h-detalle">
          <summary>La tabla completa: los ${HIST.length} años, uno por uno</summary>
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

      <section class="bloque" id="umbrales">
        <h2>¿Qué significan estos números?</h2>
        <p>
          La <b>alerta de la ciudad</b> es de <b>${nm(ESTACION.alerta, 2)} m</b>
          en el hidrómetro del Puerto y la <b>evacuación</b>, de
          <b>${nm(ESTACION.evacuacion, 2)} m</b>. Las dos las publica la
          estación del INA. El récord de ${RECORD.anio} quedó
          <b>${nm(RECORD.max - ESTACION.evacuacion, 2)} m por encima</b> de la
          evacuación. Y todo el rango en el que se decide algo, de la alerta al
          récord, son <b>${nm(RECORD.max - ESTACION.alerta, 2)} m</b>: por eso
          diez centímetros en el modelo no son un detalle.
        </p>
        <p class="chico">
          Alcanzar una altura no significa que el agua entre a una casa: buena
          parte de la ciudad está protegida por defensas, compuertas y bombeo.
          <a href="/datos#no-dice">Por qué el nivel del río no es una predicción de inundación</a>.
        </p>
      </section>

      <section class="bloque oscuro">
        <h2>Esto es historia, no pronóstico</h2>
        <p>
          Que una altura se haya alcanzado pocas veces en cien años no dice
          nada sobre lo que va a pasar este año. En cien años cambiaron las
          presas aguas arriba, el uso del suelo de la cuenca y el propio
          régimen del río.
        </p>
        <p>
          Y la ciudad de 1925 no es la de hoy: un mismo número del hidrómetro
          no significaba lo mismo antes que ahora, porque cambió lo que hay
          entre el río y las casas. Y la serie mide sólo el Paraná: en 2003 no
          llegó a la alerta, y la ciudad se inundó igual por el Salado.
        </p>
        ${
          /* Era un bloque aparte, «Comparar con el río de hoy», con tres
             enlaces al pie: el patrón «Seguí por acá» que CLAUDE.md prohíbe.
             El enlace va donde el texto lo pide. */ ""
        }<p>
          Lo que marca el hidrómetro hoy está en la <a href="/">portada</a>, y
          qué significa para un terreno en particular, en la
          <a href="/app?ir=cota">app</a>.
        </p>
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
          ${historia.incompletos.length ? "Con la libreta incompleta: " + historia.incompletos.join(", ") + "." : ""}
        </p>
        <p class="fuente-enlaces">
          <a class="btn sec" href="${FUENTES.historia.url}" target="_blank" rel="noopener">Ver fuente</a>
          <a class="enlace-crudo" href="${esc(FUENTES.historia.verificar)}" target="_blank" rel="noopener">Ver la serie cruda</a>
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
          <b>¿Es una emergencia?</b> Esto no es una vía de auxilio: nadie lo
          lee en el momento.
        </p>
        <a class="btn-emergencia" href="tel:103">
          <span>Llamá al</span><b>103</b>
        </a>
      </div>`;

const opcionesCategoria = Object.entries(CATEGORIAS)
  .map(
    ([
      clave,
      etiqueta,
    ]) => `            <input type="radio" name="categoria" id="cat-${clave}"
              value="${clave}" class="cat-radio"${clave === CATEGORIA_POR_DEFECTO ? " checked" : ""}
              data-ayuda="${esc(AYUDAS[clave][0] || "")}" data-ejemplo="${esc(AYUDAS[clave][1])}" />
            <label class="cat-chip" for="cat-${clave}">${esc(etiqueta)}</label>`,
  )
  .join("\n");

const htmlContacto = pagina({
  clave: "contacto",
  migaja: "Contacto",
  script: "/js/contacto.js",
  antes: AVISO_EMERGENCIA,
  h1: "Escribinos",
  lead:
    "Cada dato corregido, cada zona que falta y cada texto que no se entiende " +
    "mejora la app para toda la ciudad.",
  jsonld: {
    "@context": "https://schema.org",
    "@type": "ContactPage",
    name: "Contacto — Cota Cero",
    inLanguage: "es-AR",
  },
  bloques: [],
  sueltos: [
    `      <section class="bloque">
        <form id="form-contacto" novalidate>
          <fieldset class="campo-cat">
            <legend>¿Sobre qué es?</legend>
            <div class="cat-chips">
${opcionesCategoria}
            </div>
          </fieldset>
          ${
            /* La ayuda del tema elegido. Sale con la del tema por defecto en
               el HTML; js/contacto.js la cambia al elegir otro, y sin JS se
               queda en ésa, que sigue siendo cierta. */ ""
          }<p class="chico sug-ayuda" id="sug-ayuda">${esc(AYUDAS[CATEGORIA_POR_DEFECTO][0] || "")}</p>

          <label class="campo" for="sug-texto"><span>Tu mensaje</span></label>
          <textarea id="sug-texto" name="texto" required maxlength="${MAX_TEXTO}"
            rows="6" aria-describedby="sug-ayuda" placeholder="${esc(AYUDAS[CATEGORIA_POR_DEFECTO][1])}"></textarea>
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
          Es lo único que manda texto tuyo a un servidor. <b>No se guarda tu
          IP</b>: se usa sólo para limitar envíos, transformada de modo
          irreversible. Si dejás un contacto, se usa únicamente para
          responderte. <b>No pongas tu dirección.</b>
          <a href="/legal#privacidad">Qué se guarda</a>.
        </p>
      </section>

      <div class="rejilla-2 tarjetas-contacto">
        <section class="mini-tarjeta">
          <h2>¿Encontraste un dato mal?</h2>
          <p>
            Es lo más valioso que nos podés mandar. Decinos la dirección o el
            lugar exacto: con eso se comprueba contra la fuente.
          </p>
        </section>
        <section class="mini-tarjeta">
          <h2>¿Sos de un organismo o de prensa?</h2>
          <p>
            El modelo busca revisión técnica. Si podés ayudar a validarlo,
            escribinos. <a href="/datos">La metodología</a>.
          </p>
        </section>
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
  h1: "Sobre Cota Cero",
  lead:
    "Un <b>proyecto ciudadano independiente</b>. No pertenece a la " +
    "Municipalidad, ni al INA, ni a la Provincia, y ninguno lo revisó.",
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
      /* La pregunta de la que salió todo, como frase grande. Ojo con el tiempo
         verbal de lo del Niño: en pasado cuenta el origen y sigue siendo
         cierto dentro de diez años; en presente sería una afirmación sobre
         hoy que nada refresca. Y «unas charlas», no un número: decía «seis»
         y la lista ya tenía ocho. */
      oscuro: true,
      html: `        <p class="pregunta-grande">
          El nivel del río se publica todos los días. La altura de un terreno
          también. ¿Por qué nadie los pone en la misma escala?
        </p>
        <p>
          Cota Cero es esa pregunta, contestada. Hace una sola cosa: pone los
          dos datos públicos en la misma escala y explica qué significa
          compararlos, incluido todo lo que no significa.
        </p>
        <p class="chico">
          Empezó con un Niño declarado, el patrón de las crecidas de 1983, 1992
          y 2016, y con <a href="/charlas">unas charlas</a> que dicen lo mismo:
          prepararse antes cuesta mucho menos que reconstruir después.
        </p>`,
    },
  ],
  sueltos: [
    `      <div class="tarjetas-tres sobre-tres">
        <section>
          <h2>Una persona, no una institución</h2>
          <p>La hace <b>Ariel Benz</b>, por cuenta propia. Sin empresa, ONG ni organismo detrás, y sin financiamiento.</p>
        </section>
        <section>
          <h2>No predice inundaciones</h2>
          <p>Relaciona dos alturas. No sabe si entre el río y tu casa hay un terraplén o una bomba, y no ve la lluvia que cae sobre la ciudad. <a href="/datos#abiertas">Lo que está en discusión</a>.</p>
        </section>
        <section>
          <h2>Todo tiene fuente y enlace</h2>
          <ul class="fuentes-cortas">
            <li><b>El río</b> · INA</li>
            <li><b>El terreno</b> · Municipalidad, curvas de nivel</li>
            <li><b>Los puntos</b> · Gestión de Riesgos</li>
            <li><b>La historia</b> · INA, <a href="/historia">desde 1925</a></li>
          </ul>
          <p><a href="/datos">Cada una, con el dato crudo</a>.</p>
        </section>
      </div>`,
    bloque({
      borde: true,
      titulo: "Si algo está mal, avisá",
      html: `        <p>
          En una herramienta sobre riesgo hídrico, un error no es un detalle.
          Un dato equivocado, una fuente rota, algo que no se entiende.
        </p>
        <p><a class="btn" href="/contacto">Escribinos</a></p>`,
    }),
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
          loading="lazy" style="width:100%;height:225px;border:0;border-radius:16px"></iframe>
        <p class="aviso grave" style="margin:var(--e-4) 0 0">
          Si es una emergencia, Defensa Civil: <a href="tel:103"><b>103</b></a>.
        </p>`,
    },
    {
      titulo: "Lo que sí existe",
      html: `        <ul class="accesos">
          <li><a href="/">El nivel del Paraná hoy</a></li>
          <li><a href="/datos">La altura de tu terreno</a></li>
          <li><a href="/puntos-de-encuentro">Los 30 puntos de encuentro</a></li>
          <li><a href="/historia">Las crecidas históricas</a></li>
          <li><a href="/datos#fuentes">De dónde salen los datos</a></li>
        </ul>`,
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

/* [título, texto]. Tres y numeradas: son las reglas del préstamo, en orden
   de lo que más se rompe. */
const CONDICIONES = [
  [
    "No recortes el crédito",
    "«Datos: INA · vía Cota Cero» es lo que le permite a tu lector ir a la fuente del número que estás publicando.",
  ],
  [
    "No es un pronóstico",
    "Muestra el nivel oficial y la alerta y la evacuación de la ciudad, no niveles de aviso personales. No lo presentes como predicción de inundación.",
  ],
  [
    "Mandan las autoridades",
    "Si Defensa Civil dice algo distinto que el widget, vale Defensa Civil.",
  ],
];

const htmlMedios = pagina({
  clave: "paraMedios",
  migaja: "Widget para medios",
  script: "/js/medios.js",
  h1: "El río, embebido en tu nota",
  lead:
    "El nivel del Paraná en el Puerto, con la alerta y la evacuación de la " +
    "ciudad, siempre actualizado. Pegás dos líneas de HTML y listo.",
  acciones: `        <ul class="hero-tildes medios-tildes">
          <li>Gratis</li>
          <li>Sin claves de API</li>
          <li>Sin cookies ni rastreo de tus lectores</li>
        </ul>
        <p class="pg-acciones"><a class="btn" href="#codigo">Copiar el código</a></p>`,
  jsonld: null,
  bloques: [
    {
      /* No son capturas: los dos son el widget de verdad, leyendo el reporte
         del INA ahora mismo. */
      html: `        <div class="muestras-widget">
          <figure>
            <iframe src="/widget" title="Widget de Cota Cero, tema claro" loading="lazy"></iframe>
            <figcaption class="chico">Tema claro, por defecto</figcaption>
          </figure>
          <figure>
            <iframe src="/widget?theme=dark" title="Widget de Cota Cero, tema oscuro" loading="lazy"></iframe>
            <figcaption class="chico">Tema oscuro: agregale <code>?theme=dark</code></figcaption>
          </figure>
        </div>`,
    },
    {
      id: "codigo",
      titulo: "Copiá, pegá, listo",
      html: `        <div class="caja-codigo">
          <button type="button" class="btn sec" id="copiar-widget" hidden>Copiar</button>
          <pre id="codigo-widget">${esc(CODIGO_WIDGET)}</pre>
        </div>
        <ul class="medida-widget">
          <li><b>Alto:</b> 220 px</li>
          <li><b>Ancho:</b> el de tu columna; abajo de 380 px el pie se reacomoda solo</li>
          <li><b>Se actualiza solo</b> con la lectura del INA. Si el dato envejece, muestra su fecha y lo dice: nunca inventa un número.</li>
        </ul>`,
    },
    {
      titulo: "Tres condiciones",
      html: `        <ol class="condiciones-tres">
${CONDICIONES.map(([t, c]) => `          <li><b>${esc(t)}</b><span>${esc(c)}</span></li>`).join("\n")}
        </ol>
        ${
          /* Preguntar es la única manera que tenemos, y el motivo es el mismo
             que la promesa de arriba: el widget no carga analytics ni deja
             cookies, así que del lado del servidor no queda rastro de quién lo
             embebe. Se podría contar el dominio del medio sin tocar al lector
             —document.referrer adentro del iframe—, pero eso volvería falsa la
             frase de /legal que dice que lo único que sale del dispositivo son
             las sugerencias. Se eligió preguntar. */ ""
        }<p class="chico">
          ¿Lo publicaste? <a href="/contacto">Contanos</a>: como no medimos a
          tus lectores, preguntar es la única forma de saberlo. Y si necesitás
          otro formato o la metodología, por el mismo lado: a prensa
          contestamos rápido.
        </p>`,
    },
  ],
});

/* ---------- /legal ---------- */
const LICENCIAS = [
  [
    "MapLibre GL JS",
    "Motor del mapa. Licencia BSD de 3 cláusulas — © contribuidores de MapLibre. El texto completo acompaña a la copia distribuida con la app.",
  ],
  [
    "Georef",
    'Búsqueda de direcciones con altura y la lista de calles que sugiere el buscador: la API de direcciones del Estado nacional, sobre el callejero del INDEC. Datos abiertos de <a href="https://datos.gob.ar/" target="_blank" rel="noopener">datos.gob.ar</a>; la API está documentada en <a href="https://datosgobar.github.io/georef-ar-api/" target="_blank" rel="noopener">georef-ar-api</a>.',
  ],
  [
    "OpenStreetMap / Nominatim",
    'Búsqueda de direcciones cuando Georef no la encuentra, y de barrios y parajes. Datos © colaboradores de <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>, bajo licencia ODbL.',
  ],
  [
    "Instituto Geográfico Nacional",
    'Mapa base (capa argenmap), la foto aérea con la que marcás tu casa (vuelos fotogramétricos de 2013 y 2014) y red de nivelación usada para validar las fuentes de elevación. <a href="https://www.ign.gob.ar/" target="_blank" rel="noopener">ign.gob.ar</a>.',
  ],
  [
    "Municipalidad de Santa Fe",
    'Curvas de nivel (Secretaría de Recursos Hídricos) y capa de puntos de encuentro, de sus geoservicios públicos vía el <a href="https://geoportal.santafeciudad.gov.ar/" target="_blank" rel="noopener">GeoPortal</a>.',
  ],
  /* La capa no declara licencia. Se atribuye y se enlaza la ficha, igual que
     con la serie del INA: declarar una sería inventar un dato. */
  [
    "Provincia de Santa Fe — IDESF",
    'Puntos con cota de San José del Rincón, Colastiné y La Guardia (Secretaría de Aguas, relevamiento de 2005), con los que la app calcula la altura en Rincón y Arroyo Leyes. Del servicio de mapas público de la <a href="https://www.santafe.gov.ar/idesf/" target="_blank" rel="noopener">IDESF</a>; la ficha no declara licencia.',
  ],
  [
    "INA",
    'Alturas hidrométricas diarias del Paraná, del <a href="' +
      FUENTES.nivelRio.url +
      '" target="_blank" rel="noopener">reporte público del Instituto Nacional del Agua</a>.',
  ],
  [
    "Plus Jakarta Sans y JetBrains Mono",
    "Tipografías, bajo SIL Open Font License. Van self-hosteadas: no se consulta ningún servicio de fuentes.",
  ],
];

/* Qué sale del teléfono, como tabla: qué, si sale, y el detalle. Era una
   grilla de tarjetas y había que leerlas todas para contestar «¿qué se
   manda?». Las dos promesas que más importan van acá y en ningún otro lado:
   adónde va lo que escribís en el buscador (CLAUDE.md, «tocar un proveedor
   toca cuatro archivos») y que la analítica no corre ni en la app ni en el
   widget (CLAUDE.md, «Privacidad»). */
const PRIVACIDAD = [
  [
    "Tu casa, tu nivel de aviso, tu plan",
    "Nunca",
    "Se guardan sólo en el dispositivo. Si borrás la app, se borran.",
  ],
  [
    "Avisos",
    "Un dato opaco",
    "La dirección técnica que asigna tu navegador. El servidor no sabe la altura de tu terreno ni tu nivel de aviso: el aviso se arma en tu teléfono. Al desuscribirte, se borra.",
  ],
  [
    "Sugerencias",
    "Tu texto",
    "Lo único que manda texto tuyo, y el formulario lo dice. La IP no se guarda: se transforma de modo irreversible para limitar envíos.",
  ],
  [
    "Cuánta gente la usa",
    "Un número al azar",
    "Lo genera el teléfono, para contar personas distintas por día. El servidor sabe cuántos distintos vio, pero no guarda ninguno.",
  ],
  [
    "Buscar una dirección",
    "Al tocar Buscar",
    "Va a Georef (la API de direcciones del Estado nacional) y, si no la encuentra, a Nominatim (OpenStreetMap). Las calles que te sugiere mientras escribís salen de una lista guardada en la app: escribir no manda nada.",
  ],
  /* Faltaba: el mapa siempre le pidió el fondo al IGN, y la foto aérea de
     «Marcar mi casa» sale del mismo organismo. Como pide la zona que se
     mira, el IGN puede saber más o menos dónde buscaste tu casa; dónde
     tocaste, no. */
  [
    "Ver el mapa",
    "Al abrirlo",
    "El fondo del mapa y la foto aérea con la que marcás tu casa los pide tu teléfono al Instituto Geográfico Nacional, que recibe tu IP y la zona que mirás. Dónde tocaste y la altura que salió no se mandan: se calculan en el teléfono.",
  ],
  [
    "Estadísticas del sitio",
    "Sólo en el sitio",
    "Vercel Analytics, agregado y sin cookies, y Google Analytics, que sí deja cookies y manda los datos de tu visita a Google. Ninguno corre dentro de la app ni dentro del widget: a los lectores de un medio que lo embebe no los mide nadie.",
  ],
];

const DESCARGO = [
  [
    "Ayuda a interpretar información pública",
    "No es un sistema oficial de alerta ni tiene vínculo con la Municipalidad de Santa Fe, la Provincia, Defensa Civil, el INA ni ningún otro organismo. Usa sus datos públicos y los cita.",
  ],
  [
    "Los niveles de aviso son aproximados",
    "Salen de un modelo simple, con ±0,5 m de error en la altura del terreno. No conoce defensas, bombeo, desagües ni lluvia: el agua puede llegar antes o después de lo estimado. Se contrastó con un solo caso, la crecida de 1992, y no lo validaron especialistas ni organismos competentes.",
  ],
  [
    "Nada de esto es una orden",
    "Las decisiones de evacuación corresponden a Defensa Civil (103). Nada de lo que muestra la app es una orden, una recomendación oficial ni un sustituto de las comunicaciones de las autoridades. Ante cualquier contradicción, vale la indicación oficial.",
  ],
  [
    "Los datos pueden quedar viejos",
    "El nivel se publica una vez por día. Los puntos de encuentro reflejan la capa municipal de la última actualización de la app; su activación la confirma sólo Defensa Civil.",
  ],
  [
    "Sin garantías",
    "La app depende de que el INA publique y de servicios de terceros que pueden fallar, cambiar o discontinuarse. Se ofrece tal cual, gratis y sin garantía de ningún tipo.",
  ],
];

const htmlLegal = pagina({
  clave: "legal",
  migaja: "Legal y privacidad",
  h1: "Legal y privacidad",
  lead:
    "Escrito para leerse, no para esconderse. Si algo no se entiende, es un " +
    'defecto: <a href="/contacto">avisanos</a>.',
  acciones: `        <p class="chico">Última actualización: agosto de 2026.</p>
        <div class="tarjetas-tres">
          <div><b>No es oficial</b><p>Interpreta datos públicos. La orden de evacuación la da Defensa Civil, al 103.</p></div>
          <div><b>Tus datos, en tu teléfono</b><p>Tu casa, tu nivel de aviso y tu plan no salen de ahí. Sin registro, sin publicidad.</p></div>
          <div><b>Sin garantías</b><p>Gratis y tal cual. Depende de que el INA publique y de servicios que pueden fallar.</p></div>
        </div>`,
  jsonld: null,
  bloques: [
    {
      id: "descargo",
      titulo: "Qué es esta herramienta, y qué no",
      html: `        <dl class="filas-descargo">
${DESCARGO.map(
  ([t, d]) => `          <div>
            <dt>${esc(t)}</dt>
            <dd>${esc(d)}</dd>
          </div>`,
).join("\n")}
        </dl>`,
    },
    {
      id: "privacidad",
      titulo: "Qué sale de tu teléfono",
      html: `        ${
        /* En el teléfono cada renglón se vuelve una ficha —qué y si sale
           arriba, el detalle abajo— en vez de scrollear de costado: con
           scroll, la columna que importa quedaba afuera de la pantalla. Los
           roles van explícitos porque al cambiarle el display a una tabla
           algunos navegadores le sacan la semántica. */ ""
      }<table class="tabla-privacidad" role="table">
          <thead role="rowgroup"><tr role="row"><th scope="col" role="columnheader">Qué</th><th scope="col" role="columnheader">Sale</th><th scope="col" role="columnheader">Detalle</th></tr></thead>
          <tbody role="rowgroup">
${PRIVACIDAD.map(
  ([q, sale, d]) =>
    `            <tr role="row"><th scope="row" role="rowheader">${esc(q)}</th><td role="cell" class="tp-sale${sale === "Nunca" ? " tp-nunca" : ""}">${esc(sale)}</td><td role="cell">${esc(d)}</td></tr>`,
).join("\n")}
          </tbody>
        </table>
        <p class="chico">
          No pedimos nombre, correo, teléfono ni registro. No hay publicidad ni
          venta de datos. Lo que dice esta tabla sobre el widget es la promesa
          que le hacemos a cada <a href="/para-medios">medio que lo embebe</a>.
        </p>`,
    },
    {
      id: "licencias",
      titulo: "Sobre hombros de otros",
      html: `        <p>${LICENCIAS.map(([n]) => esc(n)).join(" · ")}.</p>
        <details class="h-detalle">
          <summary>Licencias y atribuciones completas</summary>
          <div class="filas-licencia">
${LICENCIAS.map(
  ([n, d]) => `            <div>
              <b>${esc(n)}</b>
              <p>${d}</p>
            </div>`,
).join("\n")}
          </div>
        </details>`,
    },
    {
      borde: true,
      html: `        <p class="chico" style="margin:0">
          Este texto lo redactó quien hizo la app, con la intención de ser claro
          y honesto. No es asesoramiento legal ni lo revisó un profesional del
          derecho. Si encontrás un error, o algo que debería decir y no dice,
          <a href="/contacto">escribinos</a>.
        </p>`,
    },
  ],
  sueltos: [],
});

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

/* La 404 va a la raíz como 404.html: es donde la busca Vercel. */
await writeFile(join(PUBLICO, "404.html"), htmlNoEncontrada);
console.log("escrito: /404.html");

for (const [ruta, html] of [
  ["puntos-de-encuentro", htmlPuntos],
  ["datos", htmlDatos],
  ["sobre", htmlSobre],
  ["contacto", htmlContacto],
  ["historia", htmlHistoria],
  ["preguntas", htmlPreguntas],
  ["legal", htmlLegal],
  ["guia", htmlGuia],
  ["charlas", htmlCharlas],
  ["para-medios", htmlMedios],
]) {
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
