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

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SITIO = "https://cotacerosf.com";

const app = await readFile(join(RAIZ, "app", "index.html"), "utf8");

/* Los puntos salen del HTML de la app, con sus coordenadas oficiales. */
const puntos = [
  ...app.matchAll(
    /<li[^>]*data-lon="([-0-9.]+)"\s+data-lat="([-0-9.]+)"[^>]*>([\s\S]*?)<\/li>/g,
  ),
].map((m) => {
  const trozo = m[3];
  const t = (cls) => {
    const x = trozo.match(
      new RegExp(`class="${cls}"[^>]*>([\\s\\S]*?)<\\/span>`),
    );
    return x ? x[1].replace(/<[^>]+>/g, "").trim() : "";
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
          <a href="/mi-cota">Cómo se calcula tu cota</a>
          <a href="/puntos-de-encuentro">Puntos de encuentro</a>
          <a href="/preguntas">Preguntas frecuentes</a>
          <a href="/datos">De dónde salen los datos</a>
          <a href="/legal">Legal y privacidad</a>
        </div>
        <div>
          <span class="eti">Datos públicos de</span>
          <a href="https://alerta.ina.gob.ar/" target="_blank" rel="noopener">INA — reporte diario</a>
          <a href="https://www.argentina.gob.ar/prefectura-naval-argentina" target="_blank" rel="noopener">Prefectura Naval</a>
          <a href="https://geoportal.santafeciudad.gov.ar/" target="_blank" rel="noopener">Municipalidad de Santa Fe</a>
          <a href="https://www.ign.gob.ar/" target="_blank" rel="noopener">IGN</a>
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

function pagina({
  ruta,
  titulo,
  descripcion,
  migaja,
  jsonld,
  chip,
  h1,
  lead,
  anclas,
  bloques,
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
  </head>
  <body class="landing">
    <div class="ancho angosto">
      <nav class="nav-sitio" aria-label="Principal">
        <a class="lockup" href="/" aria-label="Cota Cero, inicio">
          ${marcaSvg("mp")}
          <span class="lockup-nombre">Cota Cero</span>
        </a>
        <div class="nav-enlaces">
          <a href="/">← Volver a la portada</a>
          <a class="btn btn-oscuro" href="/app">Abrir la app</a>
        </div>
      </nav>

      <header class="pg-cabecera">
${chip ? `        <p class="chip-tinte">${esc(chip)}</p>\n` : ""}        <h1>${esc(h1)}</h1>
${lead ? `        <p class="pg-lead">${lead}</p>\n` : ""}${
        anclas
          ? `        <nav class="chips-ancla" aria-label="En esta página">\n` +
            anclas.map((a) => `          <a href="#${a.id}">${esc(a.n)}</a>`).join("\n") +
            `\n        </nav>\n`
          : ""
      }      </header>

      <main>
${bloques.map(bloque).join("\n\n")}
      </main>

      <p class="pg-cta"><a class="btn btn-oscuro" href="/app">Abrir Cota Cero</a></p>

${PIE}
    </div>
  </body>
</html>
`;
}

/* ---------- /puntos-de-encuentro ---------- */
const lista = puntos
  .map(
    (p) => `          <li class="punto">
            <span class="n">${esc(p.nombre)}</span>
            <span class="d">${esc(p.direccion)}</span>
            <a class="ir" href="geo:${p.lat},${p.lon}?q=${p.lat},${p.lon}(${encodeURIComponent(p.nombre)})">Cómo llegar</a>
          </li>`,
  )
  .join("\n");

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
    "funciona sin conexión y se puede compartir. En la app los ves en el mapa, " +
    "ordenados por cercanía.",
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
  bloques: [
    {
      html: `        <div class="aviso grave">
          Los puntos abren cuando el municipio los activa, y esta página no lo
          sabe en tiempo real. <b>Antes de mover a alguien, llamá al 103.</b>
        </div>`,
    },
    {
      kicker: "1 · Cuándo ir",
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
      kicker: "2 · Qué llevar",
      titulo: "Lo mínimo, en una bolsa",
      html: `        <ul class="pasos">
          <li>Documentos en una bolsa de nylon cerrada.</li>
          <li>Medicación habitual y recetas.</li>
          <li>Agua, algo para comer y abrigo.</li>
          <li>Cargador y un teléfono con batería.</li>
          <li>Si tenés animales, correa o transportadora.</li>
        </ul>
        <p class="chico">
          Antes de salir, cortá la llave general de la luz y la del gas, y
          avisale a un vecino hacia dónde vas.
        </p>`,
    },
    {
      kicker: "3 · La lista",
      titulo: "Los " + puntos.length + " puntos",
      html: `        <ul class="lista-plana">
${lista}
        </ul>
        <p class="chico" style="margin-top:16px">
          Fuente: capa <code>puntos_de_encuentro</code> del GeoServer público de
          la Municipalidad de Santa Fe, la misma que dibuja el GeoPortal.
        </p>`,
    },
  ],
});

/* ---------- /mi-cota ---------- */
const htmlCota = pagina({
  ruta: "/mi-cota",
  titulo: "Cómo saber la cota de tu terreno en Santa Fe",
  descripcion:
    "Qué es la cota, por qué el cero del hidrómetro está a 8,20 m IGN y cómo traducir la altura del río al nivel en que el agua llega a tu casa.",
  migaja: "Cómo saber tu cota",
  chip: "El cálculo, paso a paso",
  h1: "Cómo se calcula tu cota",
  lead:
    "No es una caja negra: son tres números que se suman y se restan. Acá está " +
    "la cuenta completa, con un ejemplo, para que la puedas rehacer a mano.",
  jsonld: {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: "Cómo se calcula la cota de tu terreno en Santa Fe",
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
        </p>`,
    },
    {
      kicker: "1 · El cero de la regla",
      titulo: "Está a 8,20 metros",
      html: `        <p>
          El hidrómetro del Puerto de Santa Fe no mide desde el nivel del mar:
          mide desde un cero convencional que está <b>8,20 m por encima</b> del
          cero del Instituto Geográfico Nacional, referido al mareógrafo de Mar
          del Plata.
        </p>
        <p>
          Cuando la regla marca 5,30 m, la superficie del agua está en realidad
          a 13,50 m IGN. Si tu terreno está a 15 m, todavía te sobra metro y
          medio.
        </p>
        <p class="chico">
          Cada puerto tiene su propio cero: el de Paraná está a 9,57 m y el de
          Rosario a 3,03 m. Las alturas de distintas ciudades no se comparan
          entre sí.
        </p>`,
    },
    {
      kicker: "2 · La pendiente",
      titulo: "El río no está horizontal",
      html: `        <p>
          La superficie del agua baja unos <b>4,5 cm por kilómetro</b> aguas
          abajo. Con la misma lectura en el puerto, un barrio río arriba tiene
          el agua más alta que uno río abajo.
        </p>
        <p>
          Un caso real: en 1992 el hidrómetro llegó a 7,43 m y en Arroyo Leyes
          —24 km río arriba— el agua alcanzó los 16,70 m IGN. La cuenta da
          8,20 + 7,43 + 24 × 0,045 = 16,71. Un centímetro de diferencia.
        </p>`,
    },
    {
      kicker: "3 · Tu terreno",
      titulo: "Y cuánto margen tiene",
      html: `        <p>
          La altura sale de las <b>curvas de nivel de la Municipalidad de Santa
          Fe</b>, publicadas por la Secretaría de Recursos Hídricos: 169 curvas
          cada 50 centímetros, en metros IGN. Tu cota se calcula interpolando
          entre las dos más cercanas, y por eso el margen declarado es de
          <b>0,5 m</b>: la mitad del intervalo entre curvas.
        </p>`,
    },
    {
      kicker: "La cuenta completa",
      titulo: "Un terreno en Colastiné Norte",
      html: `        <p>
          A 15,80 m IGN, y a 11 km del puerto:
        </p>
        <table class="cuenta">
          <tr><td>Cota del terreno</td><td>15,80 m</td></tr>
          <tr><td>Margen de las curvas</td><td>− 0,50 m</td></tr>
          <tr><td>Cero del hidrómetro</td><td>− 8,20 m</td></tr>
          <tr><td>Pendiente: 11 km × 0,045</td><td>− 0,50 m</td></tr>
          <tr class="total"><td>El agua llega cuando el hidrómetro marque</td><td>6,61 m</td></tr>
        </table>
        <p style="margin-top:20px">
          Con el récord histórico en 7,43 m, ese terreno se mojó en 1992 —
          <b>82 centímetros antes</b> del pico. Y está bastante por encima de la
          alerta oficial de 5,30 m, así que cuando la ciudad entra en alerta a
          esa casa todavía le queda margen. Ese es el punto: el número que te
          toca no es el que sale en las noticias.
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
      oscuro: true,
      kicker: "Lo que este número no sabe",
      titulo: "Honestidad también acá",
      html: `        <p>
          Ni la mejor cota reemplaza un relevamiento de tu terreno. Las curvas
          pasan cerca de tu casa, no por tu puerta, y entre una y otra hay medio
          metro de altura. Tampoco sabe si tu terreno está elevado sobre la
          vereda, si la casa tiene escalones, ni si hay defensas, terraplenes o
          bombeo entre el río y tu barrio: el agua puede llegar antes por
          desagüe.
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
const htmlDatos = pagina({
  ruta: "/datos",
  titulo: "De dónde salen los datos — Cota Cero",
  descripcion:
    "Cada número de Cota Cero tiene una fuente pública y un método verificable: el INA, las curvas del municipio y los puntos de nivelación del IGN.",
  migaja: "De dónde salen los datos",
  chip: "Respaldo",
  h1: "De dónde salen los datos",
  lead:
    "Cada número que muestra Cota Cero tiene una fuente pública y un método que " +
    "se puede repetir. Esta página los recorre uno por uno, incluido lo que la " +
    "app <b>no</b> sabe.",
  jsonld: {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: "De dónde salen los datos de Cota Cero",
    inLanguage: "es-AR",
    author: { "@type": "Person", name: "Ariel Benz" },
    mainEntityOfPage: SITIO + "/datos",
  },
  bloques: [
    {
      kicker: "1 · El nivel del río",
      titulo: "La lectura es oficial, no nuestra",
      html: `        <p>
          Viene del <b>reporte diario del INA</b> (Instituto Nacional del Agua)
          para el hidrómetro del Puerto de Santa Fe, que publica un valor por
          día. Los umbrales de alerta (5,30 m) y evacuación (5,70 m) son los
          oficiales de ese hidrómetro. La app no mide nada: lee, muestra y
          compara.
        </p>
        <div class="aviso">
          Si el INA no publica o cambia el formato del reporte, la app muestra
          la última lectura con su fecha. Nunca inventa un valor.
        </div>`,
    },
    {
      kicker: "2 · El modelo",
      titulo: "Dos constantes, validadas contra 1992",
      html: `        <p>
          <b>El cero del hidrómetro está a 8,20 m IGN.</b> Sumarlo a la lectura
          convierte el número del puerto en cota de agua, en el mismo sistema de
          alturas que tu terreno.
        </p>
        <p>
          <b>La pendiente es de 0,045 m por kilómetro.</b> Río arriba el agua
          está más alta: la pendiente corrige el nivel según la distancia de tu
          zona al puerto.
        </p>
        <p>
          La segunda se contrastó con un dato independiente publicado en prensa
          sobre la crecida de 1992, la mayor registrada:
        </p>
        <table class="cuenta">
          <tr><td>Puerto de Santa Fe, 1992</td><td>7,43 m</td></tr>
          <tr><td>Arroyo Leyes, 24 km río arriba — registrado</td><td>16,70 IGN</td></tr>
          <tr class="total"><td>Lo que da este modelo</td><td>16,71 IGN</td></tr>
        </table>
        <p style="margin-top:20px">Un centímetro de diferencia.</p>`,
    },
    {
      kicker: "3 · La cota de tu terreno",
      titulo: "Curvas municipales, no un satélite",
      html: `        <p>
          Sale de las <b>169 curvas de nivel de la Municipalidad de Santa Fe</b>,
          publicadas por la Secretaría de Recursos Hídricos, trazadas cada 50 cm
          y en metros IGN — el mismo sistema que el cero del hidrómetro. Por eso
          el margen informado es de <b>±0,5 m</b>: la mitad del intervalo entre
          curvas.
        </p>
        <p>
          Antes se usaba un modelo satelital y se descartó midiendo, no por
          intuición. Contra 36 puntos de nivelación de campo del IGN:
        </p>
        <table class="cuenta">
          <tr><td>Desvío estándar del satélite</td><td>±7,46 m</td></tr>
          <tr><td>Su peor error medido</td><td>−22,9 m</td></tr>
          <tr class="total"><td>Todo el rango de decisión, de alerta al récord de 1992</td><td>2,13 m</td></tr>
        </table>
        <p style="margin-top:20px">
          El error de la fuente era más grande que la escala entera de la
          decisión. Por eso la app no la usa — y donde las curvas municipales no
          llegan, te pide la cota a mano en vez de caer a algo peor.
        </p>`,
    },
    {
      kicker: "4 · Puntos de encuentro",
      titulo: "Los 30 oficiales, del GeoServer municipal",
      html: `        <p>
          Salen de la capa pública <code>puntos_de_encuentro</code> del
          GeoServer de la Municipalidad, la misma que dibuja su GeoPortal. Van
          guardados dentro de la app con sus coordenadas, así el mapa funciona
          sin conexión. Son 30, no 29: el listado que circuló en prensa omitía
          la Vecinal Pro Mejoras Alto Verde.
        </p>
        <div class="aviso">
          La app no sabe en tiempo real cuáles están activos. Eso lo confirma
          Defensa Civil, al <b>103</b>.
        </div>`,
    },
    {
      kicker: "5 · Las fuentes",
      titulo: "No nos creas: mirá el original",
      html: `        <ul class="pasos">
          <li><a href="https://alerta.ina.gob.ar/" target="_blank" rel="noopener">Reporte diario del INA</a> — alturas hidrométricas del Paraná, Puerto de Santa Fe incluido.</li>
          <li><a href="https://www.argentina.gob.ar/prefectura-naval-argentina" target="_blank" rel="noopener">Prefectura Naval Argentina</a> — lecturas de los hidrómetros en los puertos.</li>
          <li><a href="https://geoportal.santafeciudad.gov.ar/" target="_blank" rel="noopener">GeoPortal de la Municipalidad de Santa Fe</a> — curvas de nivel y capa oficial de puntos de encuentro.</li>
          <li><a href="https://www.ign.gob.ar/" target="_blank" rel="noopener">Instituto Geográfico Nacional</a> — sistema de referencia de las cotas, red de nivelación y mapa base.</li>
        </ul>
        <p class="chico">
          Cota Cero no tiene vínculo con ninguno de estos organismos: usa sus
          datos públicos y los cita para que cualquiera pueda repetir la cuenta.
        </p>`,
    },
    {
      oscuro: true,
      kicker: "6 · Lo que todavía no sabe",
      titulo: "Honestidad también acá",
      html: `        <ul class="pasos">
          <li>Los kilómetros río arriba de cada zona son estimaciones propias, salvo Arroyo Leyes, que está publicado.</li>
          <li>No sabe si hay defensas, terraplenes o bombeo entre el río y tu casa, ni cuánto llueve sobre tu barrio. El agua puede llegar antes por desagüe.</li>
          <li>Nadie validó este modelo institucionalmente. Es una estimación hecha con datos públicos, no una herramienta oficial.</li>
        </ul>`,
    },
  ],
});

/* ---------- /preguntas ---------- */
const PREGUNTAS = [
  [
    "¿Por qué mi umbral es distinto de la alerta oficial de 5,30 m?",
    "La alerta oficial es una sola para toda la ciudad; tu terreno tiene su propia altura. Si tu cota es baja o vivís río arriba, el agua puede llegarte antes de los 5,30 m — mostrar eso es exactamente el propósito de la app. Al revés también: hay terrenos altos donde el agua llega bastante después.",
  ],
  [
    "¿La app avisa sola cuando el río sube?",
    "Sí, si activás los avisos. Llega una notificación cuando el nivel sube 15 cm desde el último aviso o cruza los umbrales oficiales de 5,30 y 5,70 m. El aviso se arma en tu teléfono: el servidor no conoce tu cota ni tu zona, sólo despierta a la app, que compara contra el umbral guardado en tu dispositivo.",
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
    "Sí. Una vez cargada, la app guarda lo esencial: tu cota, tu plan familiar, los 30 puntos de encuentro y la última lectura del río con su fecha. Sin conexión ves esa última lectura, nunca un número inventado.",
  ],
  [
    "¿Quién ve mi plan familiar y mis datos?",
    "Nadie. El plan, tu cota y tu zona se guardan sólo en tu teléfono. Lo único que viaja a un servidor es el texto que mandes por el formulario de sugerencias, y el formulario lo dice. Aparte, la app cuenta cuánta gente la usa con un número al azar que no identifica a nadie.",
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

/* ---------- /legal ---------- */
const LICENCIAS = [
  ["MapLibre GL JS", "Motor del mapa. Licencia BSD de 3 cláusulas — © contribuidores de MapLibre. El texto completo acompaña a la copia distribuida con la app."],
  ["OpenStreetMap / Nominatim", 'Búsqueda de direcciones. Datos © colaboradores de <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>, bajo licencia ODbL.'],
  ["Instituto Geográfico Nacional", 'Mapa base (capa argenmap) y red de nivelación usada para validar las fuentes de elevación. <a href="https://www.ign.gob.ar/" target="_blank" rel="noopener">ign.gob.ar</a>.'],
  ["Municipalidad de Santa Fe", 'Curvas de nivel (Secretaría de Recursos Hídricos) y capa de puntos de encuentro, de sus geoservicios públicos vía el <a href="https://geoportal.santafeciudad.gov.ar/" target="_blank" rel="noopener">GeoPortal</a>.'],
  ["INA", 'Alturas hidrométricas diarias del Paraná, del <a href="https://alerta.ina.gob.ar/" target="_blank" rel="noopener">reporte público del Instituto Nacional del Agua</a>.'],
  ["Plus Jakarta Sans y JetBrains Mono", "Tipografías, bajo SIL Open Font License. Van self-hosteadas: no se consulta ningún servicio de fuentes."],
];

const PRIVACIDAD = [
  ["Tu cota, tu zona y tu plan familiar", "Se guardan únicamente en tu dispositivo. Nunca se envían a ningún servidor. Si borrás la app, se borran."],
  ["Avisos", "El servidor guarda un solo dato: la dirección técnica opaca que asigna tu navegador. No sabe tu cota ni tu umbral — el aviso se arma en tu teléfono. Al desuscribirte, se borra."],
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
          <b>Cota Cero es una herramienta ciudadana de preparación, no un
          sistema oficial de alerta.</b> No tiene vínculo con la Municipalidad
          de Santa Fe, la Provincia, Defensa Civil, el INA ni ningún otro
          organismo. Usa datos públicos de esas fuentes y las cita.
        </p>
        <p>
          <b>Los umbrales personales son estimaciones.</b> Se calculan con un
          modelo simplificado y con datos que traen margen de error (±0,5 m en
          la cota del terreno). El modelo no conoce defensas, terraplenes,
          bombeo ni desagües: el agua puede llegar antes o después de lo
          estimado.
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
  ["preguntas", htmlPreguntas],
  ["legal", htmlLegal],
]) {
  await mkdir(join(RAIZ, ruta), { recursive: true });
  await writeFile(join(RAIZ, ruta, "index.html"), html);
  console.log(
    "escrito: /" + ruta + "  (" + (html.length / 1024).toFixed(0) + " KB)",
  );
}
console.log("puntos leídos de app/index.html: " + puntos.length);
