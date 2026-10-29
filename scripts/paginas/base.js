// scripts/paginas/base.js — lo que comparten todas las páginas generadas:
// las rutas, los datos que se leen una vez, el <head>, el pie y los bloques.
// No importa de ninguna página, a propósito: las páginas importan de acá.

import { readFile } from "node:fs/promises";
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { ORGANISMOS, FUENTES } from "../../public/lib/fuentes.js";
import { PAGINAS, OG_IMAGEN } from "../../lib/paginas.js";
import { mCm, nm } from "../../public/lib/comun.js";
import { marca } from "../marca.js";
import { rutaMd } from "../markdown.js";


const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
/* Lo que se publica vive en public/ (es el `outputDirectory` de vercel.json):
   todo lo que este script lee o escribe del sitio va contra PUBLICO. RAIZ
   queda para git, que corre sobre el repo entero. */
const PUBLICO = join(RAIZ, "public");
const SITIO = "https://cotacerosf.com";

/* La medición del error de las curvas contra los puntos fijos municipales.
   Estaba escrita a mano —«330 puntos», «42 cm», «1,10 m», «98 de 100»— en
   cinco lugares de este archivo; la escribe el análisis
   (datos-crudos/analisis-puntos-fijos-<fecha>.mjs) en lib/mediciones.json y
   se lee de ahí. Sin el archivo no se genera: un número de seguridad no se
   reemplaza por uno de memoria. AUDITORIA.md §4. */
const MEDICION = (() => {
  const c = JSON.parse(
    readFileSync(join(RAIZ, "lib", "mediciones.json"), "utf8"),
  ).curvas;
  return {
    n: c.n,
    mitad: mCm(c.mediana_m),
    nueveDeDiez: nm(c.p90_m, 2) + " m",
    alcanza: Math.round(((c.n - c.optimistas) / c.n) * 100),
    optimistas: c.optimistas,
  };
})();

/* Cuántas curvas publica la Municipalidad: se cuentan, no se escriben. */
const N_CURVAS = JSON.parse(
  readFileSync(join(PUBLICO, "datos-abiertos", "curvas.json"), "utf8"),
).curvas.length;

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

/* Números con coma decimal: `nm` y `mCm` se importan de public/lib/comun.js,
   arriba. Acá había una copia de `nm`, idéntica, que se podía desincronizar
   del formato de la app como cualquier otra. */

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

/* La marca, de scripts/marca.js: el único lugar donde está el dibujo. Acá va
   decorativa —al lado del nombre, que ya se lee— y con los colores del tema.
   El id del clipPath cambia por documento para que dos copias en la misma
   página no compartan recorte. */
const marcaSvg = (id) =>
  marca({
    id,
    tam: 30,
    trazo: "currentColor",
    agua: "var(--agua)",
    etiqueta: "",
    sangria: "            ",
    cierre: "          ",
  });

/* El pie, escrito una sola vez. Lo usan las páginas generadas y también la
   portada: al final de este script se reemplaza el bloque entre los
   marcadores PIE de index.html. Sin esto eran dos copias que ya se habían
   desincronizado —a la de las páginas le faltaban una columna y el 103—.

   `frescura` agrega el renglón de "última lectura del INA" abajo del enlace a
   /datos, y va SÓLO en la portada: quien lo llena es js/landing.js, que es lo
   único que lee /api/nivel del lado del sitio. Emitirlo en las nueve páginas
   generadas sería dejar nueve renglones vacíos que no completa nadie.

   `md` es la versión en Markdown de ESA página (scripts/markdown.js), como el
   «View as AI agent» del pie de vercel.com. Sin `md` —la 404— no sale. */
const pie = ({ frescura = false, md = null } = {}) => `      <footer class="pie-sitio">
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
          <a href="/hidrometro">Qué mide el hidrómetro</a>
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
${md ? `          <a href="${md}" type="text/markdown">Ver como agente de IA</a>\n` : ""}        </div>
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
function bloque({ id, kicker, titulo, html, oscuro, borde }) {
  const clases = "bloque" + (oscuro ? " oscuro" : "") + (borde ? " borde" : "");
  return `      <section class="${clases}"${id ? ` id="${id}"` : ""}>
${kicker ? `        <p class="kicker">${esc(kicker)}</p>\n` : ""}${titulo ? `        <h2>${esc(titulo)}</h2>\n` : ""}${html}
      </section>`;
}

/* `clave` es la entrada de lib/paginas.js: de ahí salen la ruta, el título,
   la descripción y si la página se indexa. Antes cada llamada repetía esos
   cuatro datos y el sitemap se editaba aparte — tres lugares para el mismo
   dato es como se desincronizan. */
/* Cada página que arma pagina() queda anotada acá, con su clave de
   lib/paginas.js. emitir.js la escribe en la ruta del registro: no hay una
   lista de escritura aparte que se pueda olvidar. */
const GENERADAS = [];

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
  const html = `<!doctype html>
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
}${
  meta.indexable
    ? `    <link rel="alternate" type="text/markdown" href="${rutaMd(ruta)}" />\n`
    : ""
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
      /* La configuración va en /js/analitica.js (el <script> en línea del
         snippet oficial lo bloquea la CSP), y el cargador de Google lo
         inyecta ese mismo archivo después de `load`: escrito acá, el
         navegador lo bajaba apenas leía el <head>, 181 KB compitiendo con
         app.css. No va en /app ni en /widget — ver js/analitica.js. */ ""
    }<script src="/js/analitica.js" defer></script>
${css ? `    <link rel="stylesheet" href="${css}" />\n` : ""}${script ? `    <script defer src="${script}"></script>\n` : ""}  </head>
  <body class="landing">
    <a class="saltar" href="#contenido">Saltar al contenido</a>
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
${
  /* El <main> arranca en la cabecera: el h1 quedaba afuera, y el <header>
     de la página contaba como el banner del sitio en vez de la barra. */ ""
}      <main id="contenido">
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
${pie({ md: meta.indexable ? rutaMd(ruta) : null })}
    </div>
  </body>
</html>
`;
  GENERADAS.push({ clave, html });
  return html;
}

export {
  GENERADAS,
  FECHA_SITIO,
  MEDICION,
  N_CURVAS,
  PUBLICO,
  RAIZ,
  SITIO,
  app,
  bloque,
  esc,
  fechaDelSitio,
  historia,
  marcaSvg,
  pagina,
  pie,
  puntos,
  selloFuente,
  tarjetaFuente,
};
