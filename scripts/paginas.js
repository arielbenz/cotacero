// scripts/paginas.js — genera las páginas de contenido estático.
//
//   node scripts/paginas.js
//
// Emite /puntos-de-encuentro y /mi-cota. Existen por una razón concreta: la
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

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  ORGANISMOS,
  FUENTES,
  NORMATIVA,
  ESTACION,
  ENDPOINTS,
} from "../lib/fuentes.js";

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SITIO = "https://cotacerosf.com";

/* La serie histórica del INA, para que las páginas puedan citar el récord y
   la cantidad de días medidos sin que nadie los escriba a mano. La genera
   `node scripts/historia.js`; si todavía no se corrió, las páginas salen
   igual y el bloque de historia queda afuera en vez de reventar el build. */
let historia = null;
try {
  historia = JSON.parse(
    await readFile(join(RAIZ, "datos", "historia.json"), "utf8"),
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
   desincronizado —a la de las páginas le faltaban una columna y el 103—. */
const PIE = `      <footer class="pie-sitio">
        <div>
          <span class="lockup">
            ${marcaSvg("mpf")}
            <span class="lockup-nombre">Cota Cero</span>
          </span>
          <p class="chico">
            Herramienta ciudadana, sin vínculo con organismos oficiales. La
            orden de evacuación la da Defensa Civil.
          </p>
          <p class="firma">
            Hecho por <b>Ariel Benz</b>
            <span class="redes">
              <a href="https://x.com/arielbenz" target="_blank" rel="noopener noreferrer" aria-label="Ariel Benz en X">X</a>
              <a href="https://www.instagram.com/ariel.front/" target="_blank" rel="noopener noreferrer" aria-label="Ariel Benz en Instagram">Instagram</a>
            </span>
          </p>
          <p class="chip-tel">Emergencias <b>103</b></p>
        </div>
        <div>
          <span class="eti">La herramienta</span>
          <a href="/app">Abrir la app</a>
          <a href="/mi-cota">Cómo se calcula tu umbral</a>
          <a href="/puntos-de-encuentro">Puntos de encuentro</a>
          <a href="/preguntas">Preguntas frecuentes</a>
          <a href="/datos">De dónde salen los datos</a>
          <a href="/historia">Cien años del Paraná</a>
          <a href="/para-medios">Widget para medios</a>
          <a href="/charlas">Charlas para seguir pensando</a>
          <a href="/legal">Legal y privacidad</a>
        </div>
        <div>
          <span class="eti">Datos públicos de</span>
${["ina", "prefectura", "muni", "ign", "gestionRiesgos"]
  .map(
    (k) =>
      `          <a href="${ORGANISMOS[k].url}" target="_blank" rel="noopener">${ORGANISMOS[k].corto}</a>`,
  )
  .join("\n")}
        </div>
      </footer>`;

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
   página buscando la cuenta tiene que poder saltar de pastilla en pastilla. */
function paso({ n, titulo, html, eti, valor }) {
  return `      <section class="bloque paso">
        <span class="numerito" aria-hidden="true">${n}</span>
        <div>
          <h2>${esc(titulo)}</h2>
${html}
          <p class="dato-ejemplo">${
            eti ? `<span class="k">${esc(eti)}</span>` : ""
          }<span class="v">${esc(valor)}</span></p>
        </div>
      </section>`;
}

function pagina({
  ruta,
  titulo,
  descripcion,
  migaja,
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
<html lang="es-AR">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
    <title>${esc(titulo)}</title>
    <link rel="canonical" href="${url}" />
    <meta name="description" content="${esc(descripcion)}" />
    <meta name="theme-color" content="#0B1418" />
    <meta property="og:type" content="article" />
    <meta property="og:site_name" content="Cota Cero" />
    <meta property="og:title" content="${esc(titulo)}" />
    <meta property="og:description" content="${esc(descripcion)}" />
    <meta property="og:image" content="${SITIO}/og.png" />
    <meta property="og:locale" content="es_AR" />
    <meta property="og:url" content="${url}" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="color-scheme" content="dark light" />
${estructurados.map((b) => `    <script type="application/ld+json">\n${JSON.stringify(b, null, 2).replace(/^/gm, "      ")}\n    </script>`).join("\n")}
    <link rel="manifest" href="/manifest.webmanifest" />
    <link rel="icon" href="/favicon-32.png" sizes="32x32" />
    <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
    <link rel="preload" href="/vendor/fonts/jakarta-800.woff2" as="font" type="font/woff2" crossorigin />
    <link rel="preload" href="/vendor/fonts/jakarta-500.woff2" as="font" type="font/woff2" crossorigin />
    <link rel="stylesheet" href="/app.css" />
    <script defer src="/_vercel/insights/script.js"></script>
${script ? `    <script defer src="${script}"></script>\n` : ""}  </head>
  <body class="landing">
    <!-- La cabecera va al ancho de sitio, igual que en la portada: la marca
         arranca en la misma vertical se venga de donde se venga. El cuerpo, no:
         ése es para leer y se queda en la medida angosta. -->
    <div class="ancho alineado-lectura">
      <nav class="nav-sitio" aria-label="Principal">
        <a class="lockup" href="/" aria-label="Cota Cero, inicio">
          ${marcaSvg("mp")}
          <span class="lockup-nombre">Cota Cero</span>
        </a>
        <details class="nav-menu">
          <summary aria-label="Menú de secciones">
            <span class="nav-burger" aria-hidden="true"></span>
          </summary>
          <div class="nav-enlaces">
            <a href="/">← Volver a la portada</a>
          </div>
        </details>
        <a class="btn btn-oscuro" href="/app">Abrir la app</a>
      </nav>
    </div>

    <div class="ancho angosto">
      <header class="pg-cabecera">
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

      <p class="pg-cta"><a class="btn btn-oscuro" href="/app">Abrir Cota Cero</a></p>
    </div>

    <div class="pie-envoltura">
${PIE}
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
  ruta: "/puntos-de-encuentro",
  titulo: "Puntos de encuentro ante inundación — Santa Fe",
  descripcion:
    "Los " +
    puntos.length +
    " puntos de encuentro oficiales del Plan de Contingencia de la Municipalidad de Santa Fe, con dirección y cómo llegar a cada uno.",
  migaja: "Puntos de encuentro",
  chip: "Santa Fe · oficiales del municipio",
  h1: "Los " + puntos.length + " puntos de encuentro",
  lead:
    "Ante una evacuación, acercate al más próximo a tu casa. Esta página " +
    "funciona sin conexión y se puede compartir por WhatsApp. En la app los ves " +
    "en el mapa, ordenados por cercanía.",
  acciones: `        <p class="pg-acciones">
          <a class="btn btn-oscuro" href="/app?ir=donde">Ver en el mapa de la app</a>
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

/* ---------- /mi-cota ---------- */
const htmlCota = pagina({
  ruta: "/mi-cota",
  titulo: "Cómo se calcula tu umbral en Santa Fe",
  descripcion:
    "Qué es la cota de tu terreno, por qué el cero del hidrómetro está a 8,20 m IGN y cómo salen de ahí los umbrales estimados de Cota Cero.",
  migaja: "Cómo se calcula tu umbral",
  chip: "El cálculo, paso a paso",
  h1: "Cómo se calcula tu umbral",
  lead:
    "No es una caja negra: son tres números que se suman y restan. Acá está el " +
    "cálculo completo con un ejemplo real, para que lo puedas rehacer a mano y " +
    "discutir con tu vecino.",
  jsonld: {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: "Cómo se calcula tu umbral hidráulico estimado en Santa Fe",
    inLanguage: "es-AR",
    author: { "@type": "Person", name: "Ariel Benz" },
    mainEntityOfPage: SITIO + "/mi-cota",
  },
  bloques: [
    {
      html: `        <p>
          Cuando informan que el río Paraná está a 5,30 m en el puerto de Santa
          Fe, ese número no dice nada sobre tu casa. Para que diga algo hacen
          falta tres datos: <b>a qué altura está tu terreno</b>, <b>dónde está
          el cero de la regla</b> y <b>a qué distancia del puerto estás</b>.
        </p>
        <p>
          De los tres sale <b>tu umbral estimado</b>: la lectura del hidrómetro
          a partir de la cual el nivel de agua equivalente alcanzaría la cota de
          tu terreno, según este modelo. Es una referencia para prepararte, no
          el minuto en que entra el agua.
        </p>`,
    },
  ],
  sueltos: [
    paso({
      n: 1,
      titulo: "La altura de tu terreno, en metros IGN",
      html: `          <p>
            Todo terreno tiene una altura sobre el nivel del mar, medida en el
            sistema oficial argentino (IGN). La app la saca de las <b>169 curvas
            de nivel de la Municipalidad de Santa Fe</b>, trazadas cada 50 cm
            —de ahí el margen de ±0,5 m— o la escribís vos si la conocés: figura
            en planos de mensura y escrituras.
          </p>
          <p>
            Cuando la cota sale interpolada entre curvas, el cálculo usa el
            <b>escenario pesimista</b>: medio metro por debajo. Es el número con
            el que hay que decidir.
          </p>`,
      eti: "Ejemplo · Colastiné Norte",
      valor: "15,80 m → 15,30 m",
    }),
    paso({
      n: 2,
      titulo: "Restar el cero del hidrómetro: 8,20 m",
      html: `          <p>
            El hidrómetro del Puerto no mide desde el nivel del mar: su cero
            está clavado a una altura conocida, y la app usa <b>8,20 m IGN</b>.
            Restarlo pasa tu terreno a «metros de hidrómetro» — la misma escala
            del número que publica el INA todos los días.
          </p>
          <p class="chico">
            Cada escala tiene su propio cero, así que <b>las alturas de
            distintas ciudades no se comparan entre sí</b>. El INA publica hoy
            9,43 m para la escala de Paraná y 2,92 m para la de Rosario. Y para
            Santa Fe publica 8,378, no 8,20: esa diferencia de 18 cm está sin
            resolver y no la escondemos.
            <a href="/datos#abiertas">Por qué usamos 8,20</a>.
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
            hidrómetro.
          </p>
          <p>
            Colastiné Norte está a 11 km del puerto: 11 × 0,045 = 0,495 m, que
            redondeamos a 0,50.
          </p>`,
      eti: "Pendiente · 11 km",
      valor: "− 0,50 m",
    }),
    `      <section class="bloque oscuro resultado">
        <p class="kicker">Resultado del ejemplo</p>
        <p class="dato-grande">6,60 m</p>
        <p class="cuenta-chica">7,10 − 0,50</p>
        <p>
          Cuando el hidrómetro del Puerto se acerque a <b>6,60 m</b>, el nivel
          de agua equivalente alcanza la cota de ese terreno según el modelo.
          <b>No significa que el terreno se inunde exactamente a ese nivel</b>:
          es la referencia para prepararse.
        </p>
        <p>
          La app lo muestra redondeado, <b>≈ 6,6 m</b>, porque la cota del
          terreno viene de curvas cada 0,5 m y más decimales serían una
          precisión que el dato no tiene. Con el récord histórico en 7,43 m, en
          1992 el río pasó ese umbral <b>83 centímetros antes</b> del pico.
        </p>
      </section>`,
  ],
  bloquesFinales: [
    {
      kicker: "Con qué se contrastó",
      titulo: "Una crecida, dos puntos",
      html: `        <p>
          Un caso real: en 1992 el hidrómetro llegó a 7,43 m y en Arroyo Leyes
          —24 km río arriba— el agua alcanzó los 16,70 m IGN. La cuenta da
          8,20 + 7,43 + 24 × 0,045 = 16,71. Un centímetro de diferencia.
        </p>
        <p>
          La concordancia es muy buena, pero es <b>una sola validación
          independiente</b>, en dos puntos de una única crecida. El modelo
          todavía requiere revisión de especialistas y organismos competentes
          (Gestión de Riesgos, INA, FICH-UNL) antes de considerarse un modelo
          predictivo de inundación.
        </p>`,
    },
    {
      kicker: "Por qué no un satélite",
      titulo: "Se midió, y no alcanzaba",
      html: `        <p>
          Los modelos de elevación globales son modelos de <b>superficie</b>:
          miden techos y copas de árboles, no el piso.
        </p>
        <p>
          Contra 36 puntos de nivelación del IGN alrededor de Santa Fe —cotas
          medidas en campo, al milímetro— el modelo satelital tenía un sesgo
          chico, de 0,89 m, pero un <b>desvío estándar de 7,46 m</b>, con casos
          de hasta 23 m. Dentro de la ciudad, contra las curvas municipales,
          sobreestimaba 2,15 m de media.
        </p>
        <p>
          Entre el nivel de alerta (5,30 m) y el récord de 1992 (7,43 m) hay
          <b>2,13 metros</b>: el error de la fuente era más grande que toda la
          escala de la decisión. Por eso dejamos de usarla.
        </p>`,
    },
    {
      borde: true,
      kicker: "Lo que este número no sabe",
      kickerAlerta: true,
      titulo: "Honestidad también acá",
      html: `        <p>
          El umbral es una referencia hidráulica estimada, no una predicción. No
          sabe si hay defensas, terraplenes o bombeo entre el río y tu barrio,
          ni cuánto llueve encima: el agua puede llegar antes por desagüe, o no
          llegar si las defensas resisten.
        </p>
        <p>
          Ni la mejor cota reemplaza un relevamiento de tu terreno. Las curvas
          pasan cerca de tu casa, no por tu puerta, y entre una y otra hay medio
          metro de altura. Tampoco sabe si tu terreno está elevado sobre la
          vereda ni si la casa tiene escalones.
        </p>
        <p>
          El número que vale de verdad es el de un relevamiento topográfico, la
          escritura de tu terreno, o el que te dé el municipio. Si lo conseguís,
          cargalo a mano en la app.
        </p>`,
    },
  ],
});

/* ---------- /datos ---------- */
/* ---------- /datos ----------
   La página tiene que contestar una sola pregunta: "¿de dónde sale todo lo
   que me muestra esta app?". No es documentación para programadores — es el
   lugar donde una persona comprueba que no le estamos inventando el número.

   Va en este orden a propósito: primero los dos datos que la app lee (el río
   y el terreno), después cómo los relaciona, después lo que ese número NO
   dice, y recién al final las discusiones técnicas abiertas. Quien sólo lee
   los tres primeros bloques ya entendió lo que necesita. */

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

const recordHist = historia
  ? [...historia.anios].sort((a, b) => b[1] - a[1])[0]
  : null;

const htmlDatos = pagina({
  ruta: "/datos",
  titulo: "De dónde salen los datos — Cota Cero",
  descripcion:
    "Cota Cero no genera información hidrológica propia: combina datos públicos del INA, la Municipalidad de Santa Fe y el IGN. Acá está cada fuente, con el enlace para ir a comprobarla.",
  migaja: "De dónde salen los datos",
  chip: "Respaldo",
  h1: "De dónde salen los datos",
  lead:
    "Cota Cero <b>no genera información hidrológica propia</b>. Toma datos " +
    "públicos de distintos organismos y los combina para que sean más fáciles " +
    "de interpretar. Acá está cada uno, con el enlace para ir a mirarlo vos " +
    "mismo — incluido lo que todavía no sabemos.",
  jsonld: {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: "De dónde salen los datos de Cota Cero",
    inLanguage: "es-AR",
    author: { "@type": "Person", name: "Ariel Benz" },
    mainEntityOfPage: SITIO + "/datos",
  },
  anclas: [
    { id: "rio", n: "El río" },
    { id: "terreno", n: "Tu terreno" },
    { id: "cuenta", n: "La cuenta" },
    { id: "no-dice", n: "Lo que no dice" },
    { id: "abiertas", n: "Discusiones abiertas" },
    { id: "fuentes", n: "Las fuentes" },
  ],
  bloques: [
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
        <p>
          Desde esta versión la app lee la <b>API oficial del sistema de alerta
          del INA</b> en vez de raspar el HTML del reporte diario. Eso cambia
          tres cosas: el dato llega estructurado y con su hora exacta, los
          umbrales de alerta y evacuación los publica la propia estación —ya no
          son constantes nuestras— y si la API falla la app cae sola al reporte
          diario, que sigue siendo la fuente de respaldo.
        </p>
        <div class="aviso">
          Si ninguna de las dos responde, la app muestra <b>la última lectura
          guardada con su fecha</b> y lo dice en pantalla. Pasadas 48 horas deja
          de presentarla como vigente. Nunca inventa un valor.
        </div>
${tarjetaFuente("nivelRio")}`,
    },
    {
      id: "terreno",
      kicker: "2 · La altura de tu terreno",
      titulo: "Curvas de nivel de la Municipalidad",
      html: `        <p>
          La Municipalidad publica las <b>curvas de nivel</b> de la ciudad. Son
          líneas que unen los puntos que están a la misma altura sobre una
          referencia común, la misma que usa el cero del hidrómetro. Dicho
          fácil: si caminás sobre una curva, no subís ni bajás.
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
        <p>
          Que sea peor no es una intuición: antes la elevación salía de un
          modelo satelital y se lo midió contra 36 puntos de nivelación de campo
          del IGN. Tenía 7,46 m de desvío. Todo el rango de decisión de la app
          —de la alerta al récord de 1992— son 2,13 m: el error de la fuente era
          más grande que la escala entera.
        </p>
${tarjetaFuente("topografia")}`,
    },
    {
      id: "cuenta",
      kicker: "3 · Cómo los relacionamos",
      titulo: "Dos alturas, una resta",
      html: `        <p>
          El río tiene un número. Tu terreno tiene otro. Lo único que hace Cota
          Cero es ponerlos en la misma escala para poder restarlos.
        </p>
        <p>
          La lectura del hidrómetro no es una altura sobre el nivel del mar: es
          cuánto sube el agua por encima del <b>cero de esa escala</b>, que está
          clavado a una altura conocida. Sumando las dos cosas se obtiene a qué
          altura está la superficie del agua, en el mismo sistema en el que
          están las curvas de nivel.
        </p>
${cuentaVertical([
  ["Lectura del hidrómetro", "5,00 m"],
  ["+", "", "op"],
  ["Cero del hidrómetro", "8,20 m IGN"],
  ["+", "", "op"],
  ["Corrección río arriba (24 km)", "1,08 m"],
  ["=", "", "op"],
  ["Superficie de agua equivalente", "14,28 m IGN", "total"],
])}
        <p class="chico" style="margin-top:14px">
          Ejemplo, con números elegidos para que se entienda la cuenta. La
          corrección río arriba aparece porque el agua no está horizontal: en
          Arroyo Leyes, 24 km aguas arriba, la misma crecida llega más alta que
          en el puerto.
        </p>
        <p>Ahora sí se pueden comparar las dos alturas:</p>
${cuentaVertical([
  ["Cota de tu terreno", "15,80 m IGN"],
  ["−", "", "op"],
  ["Superficie de agua equivalente", "14,28 m IGN"],
  ["=", "", "op"],
  ["Margen", "1,52 m", "total"],
])}
${CORTE_SVG}
        <h3>Y la app resuelve la cuenta al revés</h3>
        <p>
          Lo que a una persona le sirve no es "cuánta agua hay hoy" sino
          <b>"¿qué tendría que marcar el hidrómetro para que el agua llegue a la
          altura de mi terreno?"</b>. Es la misma cuenta despejada:
        </p>
${cuentaVertical([
  ["Cota de tu terreno", "15,80 m IGN"],
  ["−", "", "op"],
  ["Cero del hidrómetro", "8,20 m"],
  ["−", "", "op"],
  ["Corrección río arriba (24 km)", "1,08 m"],
  ["=", "", "op"],
  ["Tu umbral hidráulico estimado", "≈ 6,5 m", "total"],
])}
        <div class="aviso">
          <b>Eso es una referencia hidráulica, no una predicción de
          inundación.</b> Dice a qué lectura del hidrómetro la superficie de
          agua equivalente alcanzaría la cota de tu terreno según este modelo.
          Lo que pase de verdad depende de las defensas, del bombeo, del viento
          y de la lluvia — nada de eso está en la cuenta.
        </div>`,
    },
    {
      id: "no-dice",
      kicker: "4 · Los límites",
      titulo: "Lo que este número no dice",
      html: `        <h3>Hay dos maneras de inundarse, y la app mira una</h3>
        <p>
          Cota Cero analiza <b>una parte</b> del riesgo hídrico: la relación
          entre el nivel del río y la altura del terreno. Eso es el riesgo
          <b>fluvial</b>. Santa Fe también se inunda por lluvia —el riesgo
          <b>pluvial</b>—: agua que cae adentro de la ciudad y no llega a
          desagotar, sola o combinada con el Salado. Un barrio puede tener un
          margen amplio contra el Paraná y entrar en emergencia igual.
        </p>
        <p class="chico">
          Los dos mecanismos se cruzan: con el río alto las bombas no pueden
          desagotar contra el agua de afuera. El municipio planifica para río
          en 6 m <b>más</b> lluvia de 200 a 300 mm — los dos juntos, no por
          separado.
        </p>
        <h3>Estar por debajo del agua no significa estar inundado</h3>
        <p>
          Es la pregunta que se hace cualquiera que mira su umbral: "si mi
          terreno está por debajo del nivel equivalente del río, ¿por qué no
          estoy con agua adentro?". Porque buena parte de la ciudad está
          protegida por obras: <b>defensas y terraplenes</b> que separan el
          agua del terreno, <b>compuertas</b> que impiden que el río entre por
          los desagües, <b>estaciones de bombeo</b> que sacan hacia afuera el
          agua de lluvia que queda adentro, y <b>reservorios</b> que la retienen
          mientras tanto.
        </p>
        <p>
          Por eso alcanzar la misma cota <b>no es inundación automática</b>, y
          por eso la app dice "umbral hidráulico estimado" y no "cuándo llega el
          agua". El modelo asume terreno parejo y agua libre: no sabe si entre
          el río y tu casa hay un terraplén de la Secretaría de Recursos
          Hídricos o no hay nada.
        </p>
        <div class="aviso">
          Al revés también vale: una defensa protege mientras funciona. En 2003
          el agua entró por un tramo abierto de una defensa existente. Que haya
          obra no es garantía, y la app no sabe en qué estado está.
        </div>
${tarjetaFuente("emergencias")}`,
    },
    {
      id: "abiertas",
      kicker: "5 · Discusiones abiertas",
      titulo: "Dos números que todavía no están cerrados",
      html: `        <p>
          Las dos constantes del modelo tienen discusión técnica encima. Esto
          está acá y no escondido en un archivo interno, porque son exactamente
          las dos cosas que un especialista debería revisarnos.
        </p>

        <h3>El cero del hidrómetro: 8,20 o 8,38</h3>
        <p>
          Cota Cero usa <b>8,20 m</b>. Es el número que da un ingeniero
          hidrólogo de la FICH-UNL en la prensa local y —más importante— es el
          que usa la normativa: el Reglamento de Edificaciones de San José del
          Rincón fija la cota de edificación en
          <span class="cita">16.00 I.G.M (7.80 m Hidrómetro Pto Santa Fe)</span>,
          y la diferencia entre esos dos números es exactamente 8,20.
        </p>
        <p>
          Pero el propio INA publica hoy, para esta estación,
          <b>cero IGN = 8,378 m</b>. Ese número viene de una campaña conjunta
          INA-IGN de diciembre de 2016 que volvió a medir los ceros de las
          escalas de los puertos del Paraná. Su tabla da, para Santa Fe,
          <b>8,38</b> en una escala y <b>8,37</b> en la otra, con la nota de que
          "las dos escalas están muy próximas una de la otra".
        </p>
        <p>
          La diferencia son <b>18 cm</b>, y no es de redondeo: en enero de 2017
          el país cambió de sistema de alturas —del SRVN71 al SRVN16— y el IGN
          dice explícitamente que antes convivían referencias del ex Ministerio
          de Obras Públicas, de Obras Sanitarias, del sistema de 1971 y de
          sistemas municipales. Los 8,20 y los 8,378 pueden ser el mismo punto
          medido en dos sistemas distintos.
        </p>
        <p>
          <b>Por eso no cambiamos la constante.</b> Lo que importa no es cuál
          número es más nuevo, sino que el cero del hidrómetro y las curvas de
          nivel del municipio estén en el <b>mismo</b> sistema de alturas. Las
          curvas no declaran el suyo. Mientras eso no esté confirmado, mover el
          cero a 8,378 metería un sesgo de 18 cm en todos los umbrales sin que
          nadie se entere. Queda anotado como pendiente de validación técnica.
        </p>
${tarjetaFuente("altimetria")}

        <h3>La pendiente: 0,045 m por kilómetro</h3>
        <p>
          El agua no está horizontal: río arriba, la misma crecida llega más
          alta. La app corrige 4,5 cm por kilómetro. El número se contrastó con
          la crecida de 1992 y da bien en ese caso, pero <b>es una sola
          observación</b> y hay señales de que no vale igual en todos lados.
        </p>
        <p>
          La más concreta: el reglamento de San José del Rincón, 16 km río
          arriba, convierte cota a hidrómetro con 8,20 <b>y sin ninguna
          corrección por distancia</b>. Con la pendiente de la app, a esos 16 km
          le corresponderían 72 cm más. O el reglamento usa una simplificación,
          o la pendiente real en ese tramo es otra. No lo sabemos.
        </p>
        <p>
          Lo honesto es decirlo así: la pendiente de la superficie del agua
          depende del tramo, del caudal y de la condición hidráulica del
          momento, y nosotros usamos <b>un solo valor para todas las zonas</b>.
          Es la limitación más importante del modelo después de la falta de
          validación institucional.
        </p>`,
    },
    {
      kicker: "6 · La comprobación",
      titulo: "Coincidir con 1992 no es estar validado",
      html: `        <p>
          Hay una comprobación histórica y hay que contarla por lo que es.
        </p>
        <table class="cuenta">
          <tr><td>Puerto de Santa Fe, junio de 1992</td><td>7,43 m</td></tr>
          <tr><td>Arroyo Leyes, 24 km río arriba — registrado</td><td>16,70 IGN</td></tr>
          <tr class="total"><td>Lo que da este modelo</td><td>16,71 IGN</td></tr>
        </table>
        <p style="margin-top:20px">
          Un centímetro. Es una buena señal y es el mejor dato independiente que
          tenemos. Pero es <b>un punto, de una crecida, de un año</b>.
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
        <p style="margin-top:18px">
          Una coincidencia histórica no demuestra que el modelo sea válido para
          todos los lugares y todas las condiciones. Hasta que lo revisen
          especialistas —Gestión de Riesgos del municipio, INA, FICH-UNL,
          Recursos Hídricos de la Provincia— lo que la app publica son
          <b>niveles de referencia estimados</b>, y así están nombrados en toda
          la interfaz.
        </p>
        <p class="chico">
          Cota Cero no tiene vínculo con ninguno de estos organismos, ni cuenta
          con su aval. Usa sus datos públicos y los cita.
        </p>`,
    },
    {
      kicker: "7 · Un siglo de mediciones",
      titulo: "La misma escala, desde 1925",
      html: historia
        ? `        <p>
          El INA publica la serie diaria de este mismo hidrómetro desde el 2 de
          enero de 1925: <b>${historia.dias.toLocaleString("es-AR")} días
          medidos</b>. Es la misma serie de la que sale el número que ves hoy en
          la app, así que la historia y el presente no pueden contradecirse.
        </p>
        <table class="cuenta">
          <tr><td>Mayor altura registrada — ${recordHist[2].slice(8)}/${recordHist[2].slice(5, 7)}/${recordHist[0]}</td><td>${nm(recordHist[1], 2)} m</td></tr>
          <tr><td>Mediana de la serie diaria</td><td>${nm(historia.cuantiles[50], 2)} m</td></tr>
          <tr class="total"><td>Años con registro</td><td>${historia.anios.length}</td></tr>
        </table>
        <p style="margin-top:20px">
          La crecida de 1905 que se cita seguido queda fuera de esta serie, que
          arranca en 1925. No la reconstruimos desde recortes de diario: si el
          INA no la publica, no está.
        </p>
        <p class="pg-cta" style="margin:22px 0 0;text-align:left">
          <a class="btn" href="/historia">Explorar cien años del Paraná</a>
        </p>
${tarjetaFuente("historia")}`
        : `        <p>La serie histórica todavía no está generada.</p>`,
    },
  ],
  sueltos: [
    `      <section class="bloque" id="fuentes">
        <p class="kicker">8 · Las fuentes</p>
        <h2>Datos que usamos</h2>
        <p>
          Todo lo que muestra la app sale de acá. Cada ficha lleva dos enlaces:
          uno a la página del organismo y otro al dato crudo, tal como lo pide
          la app.
        </p>
        <div class="fuentes-rejilla">
${["nivelRio", "topografia", "emergencias", "altimetria", "historia", "cartografia"]
  .map(tarjetaFuente)
  .join("\n")}
        </div>
      </section>`,
  ],
  bloquesFinales: [
    {
      titulo: "Investigación, antecedentes y normativa",
      kicker: "9 · El marco",
      html: `        <p class="chico">
          No están al mismo nivel que las fuentes de arriba y no aportan ningún
          número al cálculo. Explican el contexto.
        </p>
        <ul class="pasos">
          <li><b>${esc(ORGANISMOS.fich.nombre)}</b> — ${esc(ORGANISMOS.fich.que)}
            Es la institución natural para revisar este modelo.
            <a href="${ORGANISMOS.fich.url}" target="_blank" rel="noopener">Ver</a></li>
${NORMATIVA.map(
  (n) =>
    `          <li><b>${esc(n.n)}</b> — ${esc(n.que)} <a href="${n.url}" target="_blank" rel="noopener">Ver</a></li>`,
).join("\n")}
        </ul>
        <p class="chico">
          Sobre la prensa: se usa sólo para contexto histórico o para llegar a
          una fuente primaria, nunca para un número que entre en el cálculo. Si
          una nota cita a un especialista o a un documento, buscamos el original
          antes de citar la nota.
        </p>`,
    },
    {
      oscuro: true,
      kicker: "10 · Lo que todavía no sabe",
      titulo: "Honestidad también acá",
      html: `        <ul class="pasos">
          <li><b>En qué sistema de alturas están las curvas municipales.</b> Los
            metadatos de la capa no lo declaran. De eso depende si el cero del
            hidrómetro correcto es 8,20 o 8,378.</li>
          <li><b>Si la pendiente de 0,045 m/km vale en todos los tramos.</b> Está
            contrastada en un punto de una crecida. La normativa de Rincón
            sugiere que en ese tramo se usa otra cosa.</li>
          <li><b>Cuánto error tiene de verdad la cota interpolada.</b> La app
            informa ±0,5 m, que es la convención cartográfica, no una medición.
            Contra los puntos de nivelación del IGN cercanos la dispersión sale
            mayor, pero esos puntos están sobre pilares y no sobre el piso, así
            que la comparación no cierra. Hace falta contrastar contra la red de
            puntos fijos planialtimétricos del municipio, que no está publicada
            en el GeoServer.</li>
          <li><b>Los kilómetros río arriba de cada zona.</b> Sólo Arroyo Leyes
            (24 km) está publicado; el resto son estimaciones propias. A 4,5 cm
            por km, equivocarse 5 km son 22 cm.</li>
          <li><b>Si hay defensas, bombeo o desagües entre el río y tu casa.</b>
            La app no lo sabe, y cambia el resultado más que cualquiera de las
            constantes.</li>
          <li><b>Nada sobre la lluvia sobre tu barrio</b> más allá del pronóstico
            general. El agua puede llegar antes por el desagüe que por el río.</li>
        </ul>
        <p class="chico">
          Cuando no sabemos algo con precisión suficiente, preferimos decirlo
          antes que rellenar el hueco con un número que parezca firme.
        </p>`,
    },
  ],
});

/* ---------- /preguntas ---------- */
const PREGUNTAS = [
  [
    "¿Por qué mi umbral es distinto de la alerta oficial de 5,30 m?",
    "La alerta oficial es una sola para toda la ciudad; tu terreno tiene su propia altura. Si tu terreno es bajo o está río arriba, el agua puede comprometerte antes de los 5,30 m — mostrar eso es exactamente el propósito de la app. Al revés también: hay terrenos altos donde el agua llega bastante después.",
  ],
  [
    "¿El agua llega exactamente cuando se cruza mi umbral?",
    "No. El umbral es una referencia hidráulica estimada: no sabe de defensas, terraplenes, bombeo, drenaje urbano ni lluvia local. El agua puede llegar antes (por los desagües) o no llegar (si las defensas resisten). Sirve para decidir cuándo prepararte, no para predecir el minuto de la inundación. Por eso la app lo muestra redondeado: la cota del terreno viene de curvas cada 0,5 m.",
  ],
  [
    "¿La app avisa sola cuando el río sube?",
    "Sí, si activás los avisos. Llega una notificación cuando el nivel sube 15 cm desde el último aviso o cruza los umbrales oficiales de 5,30 y 5,70 m. El aviso se arma en tu teléfono: el servidor no conoce tu umbral ni tu zona, sólo despierta a la app, que compara contra el umbral guardado en tu dispositivo.",
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
    "Sí. Una vez cargada, la app guarda lo esencial: tu umbral, tu plan familiar, los 30 puntos de encuentro y la última lectura del río con su fecha. Sin conexión ves esa última lectura, nunca un número inventado.",
  ],
  [
    "¿Quién ve mi plan familiar y mis datos?",
    "Nadie. El plan, tu umbral y tu zona se guardan sólo en tu teléfono. Lo único que viaja a un servidor es el texto que mandes por el formulario de sugerencias, y el formulario lo dice. Aparte, la app cuenta cuánta gente la usa con un número al azar que no identifica a nadie.",
  ],
  [
    "¿Esto reemplaza a la alerta de Defensa Civil?",
    "No. Es una estimación para prepararte antes, hecha por un vecino y sin vínculo con el municipio. La orden de evacuación la da Defensa Civil, al 103. Si tu umbral se cruza, prepará el plan y consultá los canales oficiales.",
  ],
  [
    "¿Cada cuánto se actualiza el nivel?",
    "El INA publica una lectura por día del hidrómetro del Puerto. La app la toma de ese reporte y muestra siempre la fecha del dato, así sabés qué tan fresco es.",
  ],
];

const htmlPreguntas = pagina({
  ruta: "/preguntas",
  titulo: "Preguntas frecuentes — Cota Cero, Santa Fe",
  descripcion:
    "Cómo se calcula tu umbral, cómo funcionan los avisos, qué pasa sin conexión y quién ve tus datos. Las dudas más comunes sobre Cota Cero.",
  migaja: "Preguntas frecuentes",
  h1: "Preguntas frecuentes",
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
  ruta: "/charlas",
  titulo: "Charlas para seguir pensando — Cota Cero",
  descripcion:
    "Charlas TED y TEDx sobre las ideas detrás de Cota Cero: prepararse antes de la emergencia, organizarse entre vecinos, convivir con el agua y abrir los datos públicos.",
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

/* ---------- /historia ----------
   Cien años del Paraná. La página es un esqueleto: todos los números los pone
   historia.js leyendo datos/historia.json, que genera `node scripts/historia.js`
   desde la serie del INA. Si acá hubiera un número escrito a mano, el día que
   la serie se actualice quedaría mintiendo.

   Por qué existe: el hidrómetro es un número abstracto. "3,10 m" no le dice
   nada a nadie hasta que se lo ve al lado de los 7,43 de 1992 y de los −0,23
   de 2022. Esta página es la escala. */
const htmlHistoria = pagina({
  ruta: "/historia",
  titulo: "Cien años del Paraná en Santa Fe — Cota Cero",
  descripcion:
    "La serie completa del hidrómetro del Puerto de Santa Fe desde 1925, con datos oficiales del INA: las mayores crecidas, las bajantes más hondas y qué tan alto está el río hoy comparado con un siglo de mediciones.",
  migaja: "Cien años del Paraná",
  script: "/historia.js",
  chip: "La escala real",
  h1: "Cien años del Paraná",
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
    `      <p id="h-cargando" class="chico" role="status">Cargando un siglo de mediciones…</p>

      <div id="h-contenido" hidden>
        <section class="bloque">
          <p class="kicker">1925 — hoy</p>
          <h2>Un siglo, de una mirada</h2>
          <p>
            Cada barra es un año: va del nivel más bajo al más alto que marcó el
            hidrómetro. Las dos líneas punteadas son los umbrales oficiales de
            alerta y evacuación. Tocá una barra para ver ese año en detalle.
          </p>
          <div id="h-franja" class="h-franja"></div>
          <p class="chico">
            Las barras naranjas son años que llegaron a la alerta; las rojas,
            los que llegaron a nivel de evacuación.
          </p>
        </section>

        <section class="bloque">
          <h2>Recorré la serie</h2>
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

        <section class="bloque">
          <h2>Las mayores crecidas registradas</h2>
          <p class="chico">
            Ordenadas por la altura máxima del año. No es una lista escrita a
            mano: es la serie del INA ordenada de mayor a menor.
          </p>
          <ol class="h-ranking" id="h-crecidas"></ol>
        </section>

        <section class="bloque">
          <h2>Las bajantes más hondas</h2>
          <p class="chico">
            El cero del hidrómetro no es el fondo del río: por debajo de cero
            sigue habiendo agua. Un número negativo significa que el río está
            más abajo que el cero de esa escala.
          </p>
          <ol class="h-ranking" id="h-bajantes"></ol>
        </section>

        <section class="bloque">
          <h2>La tabla completa</h2>
          <details class="h-detalle">
            <summary>Ver los ${historia ? historia.anios.length : ""} años, uno por uno</summary>
            <div class="h-tabla-caja">
              <table class="h-tabla">
                <thead><tr><th scope="col">Año</th><th scope="col">Máximo</th><th scope="col">Mínimo</th><th scope="col">Días en alerta</th></tr></thead>
                <tbody id="h-tabla-cuerpo"></tbody>
              </table>
            </div>
          </details>
        </section>

        <section class="bloque borde">
          <p class="kicker">La fuente</p>
          <p id="h-fuente" class="chico"></p>
          <p class="fuente-enlaces">
            <a class="btn sec" href="${FUENTES.historia.url}" target="_blank" rel="noopener">Ver fuente</a>
            <a class="enlace-crudo" id="h-verificar" href="${esc(FUENTES.historia.verificar)}" target="_blank" rel="noopener">Ver la serie cruda</a>
          </p>
          <p class="chico">
            Antes de 1925 el INA no publica esta serie. La crecida de 1905 que
            se cita seguido queda afuera: no la reconstruimos desde recortes de
            diario. Los años con la libreta incompleta están marcados como
            tales.
          </p>
        </section>

        <section class="bloque oscuro">
          <p class="kicker">Ojo con leer de más</p>
          <h2>Esto es historia, no pronóstico</h2>
          <p>
            Que una altura se haya alcanzado pocas veces en cien años no dice
            nada sobre lo que va a pasar este año. La serie tampoco es
            homogénea: en cien años cambiaron las presas aguas arriba, el uso
            del suelo de la cuenca y el propio régimen del río.
          </p>
          <p>
            Y una advertencia sobre las defensas: la ciudad de 1925 no es la de
            hoy. Un mismo número del hidrómetro no significaba lo mismo antes
            que ahora, porque cambió lo que hay entre el río y las casas.
          </p>
        </section>
      </div>`,
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
  "El widget muestra el nivel oficial y los umbrales oficiales — no umbrales personales ni pronósticos. No lo presentes como una predicción de inundación, porque no lo es.",
  "En emergencia mandan las autoridades: si Defensa Civil comunica algo distinto de lo que dice el widget, vale lo de Defensa Civil.",
];

const htmlMedios = pagina({
  ruta: "/para-medios",
  titulo: "Widget del nivel del río para medios — Cota Cero",
  descripcion:
    "Widget gratuito con el nivel del hidrómetro del Puerto de Santa Fe, la tendencia y los umbrales oficiales. Dos líneas de HTML, sin claves de API, sin cookies y sin rastreo de tus lectores.",
  migaja: "Widget para medios",
  script: "/medios.js",
  chip: "Para medios y sitios",
  h1: "El río, embebido en tu nota",
  lead:
    "Un widget gratuito con el nivel del hidrómetro del Puerto, la tendencia y " +
    "los umbrales oficiales, siempre actualizado. Pegás dos líneas de HTML y tu " +
    "nota sobre el río queda viva. Sin claves de API, sin cookies, sin rastreo " +
    "de tus lectores.",
  jsonld: null,
  bloques: [
    {
      kicker: "Así se ve",
      titulo: "Claro y noche, del ancho que quieras",
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
            <iframe src="/widget?tema=noche" title="Widget de Cota Cero, tema noche" loading="lazy"></iframe>
            <p class="chico">Tema noche — agregale <code>?tema=noche</code></p>
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
          Escribinos por el <a href="/app?ir=ajustes">formulario de sugerencias</a>
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
  ["Tu umbral, tu zona y tu plan familiar", "Se guardan únicamente en tu dispositivo. Nunca se envían a ningún servidor. Si borrás la app, se borran."],
  ["Avisos", "El servidor guarda un solo dato: la dirección técnica opaca que asigna tu navegador. No sabe la cota de tu terreno ni tu umbral — el aviso se arma en tu teléfono. Al desuscribirte, se borra."],
  ["Sugerencias", "Es lo único que envía texto tuyo a un servidor, y el formulario lo dice. Tu IP no se almacena: se usa sólo para limitar envíos, transformada de modo irreversible."],
  ["Cuántas personas la usan", "El teléfono genera un número al azar y lo guarda; se manda para contar cuánta gente distinta usa la app por día. Del lado del servidor entra a una estructura que sabe cuántos distintos vio pero no guarda ninguno."],
];

const htmlLegal = pagina({
  ruta: "/legal",
  titulo: "Legal y privacidad — Cota Cero",
  descripcion:
    "Descargo de responsabilidad, qué datos quedan en tu teléfono y cuáles no, y las licencias de todo lo que usa Cota Cero.",
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
          <b>Los umbrales personales son estimaciones.</b> Se calculan con un
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
          venta de datos. Las estadísticas del sitio son sin cookies y
          agregadas, y la búsqueda de direcciones consulta a Nominatim
          (OpenStreetMap) sólo cuando vos la iniciás.
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
});

/* La landing dibuja los 30 puntos en un mapa y necesita las coordenadas.
   Se emiten desde acá, que ya las leyó de app/index.html, para que no exista
   una tercera copia de la lista. */
await mkdir(join(RAIZ, "datos"), { recursive: true });
await writeFile(
  join(RAIZ, "datos", "puntos.json"),
  JSON.stringify(puntos.map((p) => [p.nombre, p.direccion, p.lon, p.lat])),
);
console.log("escrito: /datos/puntos.json  (" + puntos.length + " puntos)");

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
  antes.slice(0, i) + cabecera + "\n" + PIE + "\n" + antes.slice(f);
if (despues !== antes) {
  await writeFile(portada, despues);
  console.log("actualizado: el pie de index.html");
} else {
  console.log("index.html: el pie ya estaba al día");
}

for (const [ruta, html] of [
  ["puntos-de-encuentro", htmlPuntos],
  ["mi-cota", htmlCota],
  ["datos", htmlDatos],
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
