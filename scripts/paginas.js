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
    const x = trozo.match(new RegExp(`class="${cls}"[^>]*>([\\s\\S]*?)<\\/span>`));
    return x ? x[1].replace(/<[^>]+>/g, "").trim() : "";
  };
  return { lon: +m[1], lat: +m[2], nombre: t("n"), direccion: t("d") };
});
if (puntos.length < 25) throw new Error("Se leyeron sólo " + puntos.length + " puntos");

const esc = (t) =>
  String(t).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

/* Cabecera, pie y esqueleto compartidos, para que las páginas se vean parte
   del mismo sitio sin duplicar el diseño. */
function pagina({ ruta, titulo, descripcion, migaja, jsonld, cuerpo }) {
  const url = SITIO + ruta;
  const bloques = [
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Cota Cero", item: SITIO + "/" },
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
${bloques.map((b) => `    <script type="application/ld+json">\n${JSON.stringify(b, null, 2).replace(/^/gm, "      ")}\n    </script>`).join("\n")}
    <link rel="manifest" href="/manifest.webmanifest" />
    <link rel="icon" href="/favicon-32.png" sizes="32x32" />
    <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
    <link rel="preload" href="/vendor/fonts/jakarta-800.woff2" as="font" type="font/woff2" crossorigin />
    <link rel="preload" href="/vendor/fonts/jakarta-500.woff2" as="font" type="font/woff2" crossorigin />
    <link rel="stylesheet" href="/app.css" />
    <script defer src="/_vercel/insights/script.js"></script>
  </head>
  <body class="landing">
    <header class="top">
      <div class="marca-bloque">
        <a href="/" style="text-decoration: none; color: inherit">
          <span class="marca">Cota<span>Cero</span></span>
        </a>
        <p class="sub">Emergencia hídrica · Santa Fe</p>
      </div>
    </header>
    <main class="pagina">
${cuerpo}
      <p style="margin-top: 32px"><a class="btn" href="/app">Abrir Cota Cero</a></p>
    </main>
    <div class="pie">
      <p class="chico" style="margin-bottom: 12px">
        <a href="/">Qué es Cota Cero</a> ·
        <a href="/puntos-de-encuentro">Puntos de encuentro</a> ·
        <a href="/mi-cota">Cómo saber tu cota</a>
      </p>
      Herramienta ciudadana, sin vínculo con organismos oficiales.<br />
      No reemplaza una orden de evacuación: si Defensa Civil o el municipio te
      dicen que salgas, salí.
      <div class="firma">
        Hecho por <b>Ariel Benz</b>
        <span class="redes">
          <a href="https://x.com/arielbenz" target="_blank" rel="noopener noreferrer" aria-label="Ariel Benz en X">X</a>
          <a href="https://www.instagram.com/ariel.front/" target="_blank" rel="noopener noreferrer" aria-label="Ariel Benz en Instagram">Instagram</a>
        </span>
      </div>
    </div>
  </body>
</html>
`;
}

/* ---------- /puntos-de-encuentro ---------- */
const lista = puntos
  .map(
    (p) => `        <li class="punto">
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
    "Los " + puntos.length + " puntos de encuentro oficiales del Plan de Contingencia de la Municipalidad de Santa Fe, con dirección y cómo llegar a cada uno.",
  migaja: "Puntos de encuentro",
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
        address: { "@type": "PostalAddress", streetAddress: p.direccion, addressLocality: "Santa Fe", addressCountry: "AR" },
        geo: { "@type": "GeoCoordinates", latitude: p.lat, longitude: p.lon },
      },
    })),
  },
  cuerpo: `      <h1>Puntos de encuentro ante una inundación en Santa Fe</h1>
      <p>
        Son los ${puntos.length} lugares que la Municipalidad de Santa Fe definió en su Plan
        de Contingencia para recibir gente cuando hay que evacuar un barrio.
        Están distribuidos por toda la ciudad, dentro y fuera del anillo de
        defensas.
      </p>

      <h2>Cuándo ir</h2>
      <p>
        Cuando Defensa Civil o el municipio lo indiquen para tu zona. No hace
        falta esperar a tener agua en la puerta: si te avisan, salí. El punto
        de encuentro es el lugar donde te van a estar esperando y desde donde
        se organiza el traslado a un centro de evacuados si hiciera falta.
      </p>
      <p>
        Si tenés que moverte, <b>no cruces agua en movimiento</b>, ni a pie ni
        en auto. Treinta centímetros de corriente arrastran a una persona y
        sesenta arrastran un vehículo. Abajo no se ve el pozo, la cloaca
        abierta ni el cable caído.
      </p>

      <h2>Qué llevar</h2>
      <ul class="pasos">
        <li>Documentos en una bolsa de nylon cerrada.</li>
        <li>Medicación habitual y recetas.</li>
        <li>Agua, algo para comer y abrigo.</li>
        <li>Cargador y un teléfono con batería.</li>
        <li>Si tenés animales, correa o transportadora.</li>
      </ul>
      <p class="chico">
        Antes de salir, cortá la llave general de la luz y la del gas, y
        avisale a un vecino hacia dónde vas.
      </p>

      <h2>Los ${puntos.length} puntos</h2>
      <div class="tarjeta">
        <ul class="lista-plana">
${lista}
        </ul>
      </div>
      <p class="chico">
        Fuente: capa <code>puntos_de_encuentro</code> del GeoServer público de
        la Municipalidad de Santa Fe, la misma que dibuja el GeoPortal. En la
        app los ves en un mapa y te muestra cuál te queda más cerca.
      </p>`,
});

/* ---------- /mi-cota ---------- */
const htmlCota = pagina({
  ruta: "/mi-cota",
  titulo: "Cómo saber la cota de tu terreno en Santa Fe",
  descripcion:
    "Qué es la cota, por qué el cero del hidrómetro está a 8,20 m IGN y cómo traducir la altura del río al nivel en que el agua llega a tu casa.",
  migaja: "Cómo saber tu cota",
  jsonld: {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: "Cómo saber la cota de tu terreno en Santa Fe",
    inLanguage: "es-AR",
    author: { "@type": "Person", name: "Ariel Benz" },
    publisher: { "@type": "Person", name: "Ariel Benz" },
    mainEntityOfPage: SITIO + "/mi-cota",
  },
  cuerpo: `      <h1>Cómo saber la cota de tu terreno en Santa Fe</h1>
      <p>
        Cuando informan que el río Paraná está a 5,30 m en el puerto de Santa
        Fe, ese número no dice nada sobre tu casa. Para que diga algo hay que
        traducirlo, y para traducirlo hacen falta dos datos: <b>a qué altura
        está tu terreno</b> y <b>dónde está el cero de la regla</b>.
      </p>

      <h2>El cero del hidrómetro está a 8,20 metros</h2>
      <p>
        El hidrómetro del Puerto de Santa Fe no mide desde el nivel del mar:
        mide desde un cero convencional que está <b>8,20 m por encima</b> del
        cero del Instituto Geográfico Nacional, que a su vez está referido al
        mareógrafo de Mar del Plata.
      </p>
      <p>
        Entonces, cuando la regla marca 5,30 m, la superficie del agua está en
        realidad a 13,50 m IGN. Y si tu terreno está a 15 m IGN, todavía te
        sobran metro y medio.
      </p>
      <p class="chico">
        Cada puerto tiene su propio cero. El de Paraná está a 9,57 m y el de
        Rosario a 3,03 m, así que las alturas de distintas ciudades no se
        comparan entre sí.
      </p>

      <h2>El río no está horizontal</h2>
      <p>
        La superficie del agua tiene pendiente: baja unos 4,5 cm por kilómetro
        aguas abajo. Por eso, con la misma lectura en el puerto, un barrio río
        arriba tiene el agua más alta que uno río abajo.
      </p>
      <p>
        Un ejemplo real: en la crecida de 1992 el hidrómetro del puerto llegó a
        7,43 m, y en Arroyo Leyes —24 km río arriba— el agua alcanzó los 16,70
        m IGN. La cuenta da 8,20 + 7,43 + 24 × 0,045 = 16,71. Un centímetro de
        diferencia.
      </p>

      <h2>De dónde sacamos la altura de tu terreno</h2>
      <p>
        De las <b>curvas de nivel de la Municipalidad de Santa Fe</b>,
        publicadas por la Secretaría de Recursos Hídricos. Son 169 curvas cada
        50 centímetros, de 12,5 a 22,5 m, en metros IGN — el mismo sistema que
        el cero del hidrómetro. Tu cota se calcula interpolando entre las dos
        curvas más cercanas a tu casa.
      </p>

      <h2>Por qué no alcanza un modelo satelital</h2>
      <p>
        Es la forma fácil de resolverlo y no sirve. Los modelos de elevación
        globales son modelos de <b>superficie</b>: miden techos y copas de
        árboles, no el piso.
      </p>
      <p>
        Lo medimos. Comparado con 36 puntos de nivelación oficiales del IGN
        alrededor de Santa Fe —cotas medidas en campo, al milímetro— el modelo
        satelital tenía un sesgo chico, de 0,89 m, pero un
        <b>desvío estándar de 7,46 m</b>, con casos de hasta 23 m de error. Y
        dentro de la ciudad, contra las curvas municipales, sobreestimaba 2,15
        m de media.
      </p>
      <p>
        Para dimensionarlo: entre el nivel de alerta (5,30 m) y el récord
        histórico de 1992 (7,43 m) hay <b>2,13 metros</b>. El error de la
        fuente era más grande que toda la escala de decisión. Por eso dejamos
        de usarla.
      </p>

      <h2>Qué sigue sin saber</h2>
      <p>
        Ni la mejor cota reemplaza un relevamiento de tu terreno. Las curvas
        pasan cerca de tu casa, no por tu puerta, y entre una y otra hay medio
        metro de altura. Tampoco sabe si tu terreno está elevado sobre la
        vereda, si la casa tiene escalones o si el fondo es más bajo. Por eso
        el cálculo va siempre medio metro por debajo, del lado seguro.
      </p>
      <p>
        El número que vale de verdad es el de un relevamiento topográfico, la
        escritura de tu terreno, o el que te dé el municipio. Si lo conseguís,
        podés cargarlo a mano en la app.
      </p>`,
});

for (const [ruta, html] of [
  ["puntos-de-encuentro", htmlPuntos],
  ["mi-cota", htmlCota],
]) {
  await mkdir(join(RAIZ, ruta), { recursive: true });
  await writeFile(join(RAIZ, ruta, "index.html"), html);
  console.log("escrito: /" + ruta + "  (" + (html.length / 1024).toFixed(0) + " KB)");
}
console.log("puntos leídos de app/index.html: " + puntos.length);
