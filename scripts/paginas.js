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
          <a href="/para-medios">Widget para medios</a>
          <a href="/charlas">Charlas para seguir pensando</a>
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
            está a <b>8,20 m IGN</b>. Restarlo pasa tu terreno a «metros de
            hidrómetro» — la misma escala del número que publica el INA todos
            los días.
          </p>
          <p class="chico">
            Cada puerto tiene su propio cero: el de Paraná está a 9,57 m y el de
            Rosario a 3,03 m. Las alturas de distintas ciudades no se comparan
            entre sí.
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
      titulo: "Dos constantes, contrastadas con 1992",
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
        <p style="margin-top:20px">Un centímetro de diferencia.</p>
        <p>
          La concordancia es muy buena, pero es <b>una sola validación
          independiente</b>. El modelo todavía requiere revisión de especialistas
          y organismos competentes (Dirección de Gestión de Riesgos, INA,
          FICH-UNL) antes de considerarse un modelo predictivo de inundación:
          hasta entonces, los umbrales personales son niveles de referencia
          estimados.
        </p>`,
    },
    {
      kicker: "3 · La cota de tu terreno",
      titulo: "Curvas municipales, no un satélite",
      html: `        <p>
          <b>Hoy la única fuente de elevación de la app son estas curvas
          municipales.</b>
          Sale de las <b>169 curvas de nivel de la Municipalidad de Santa Fe</b>,
          publicadas por la Secretaría de Recursos Hídricos, trazadas cada 50 cm
          y en metros IGN — el mismo sistema que el cero del hidrómetro. Por eso
          el margen informado es de <b>±0,5 m</b>: la mitad del intervalo entre
          curvas.
        </p>
        <p>
          Antes probamos un modelo satelital (Copernicus GLO-90, vía Open-Meteo)
          y lo descartamos midiendo, no por intuición. Queda acá sólo como
          historia de validación. Contra 36 puntos de nivelación de campo del
          IGN:
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
          <li>La validación con la Dirección de Gestión de Riesgos del municipio sigue pendiente, y es la limitación más importante del estado actual: una buena coincidencia con una sola crecida histórica no prueba un modelo. Hasta entonces: estimación, no predicción.</li>
        </ul>`,
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
  ["INA", 'Alturas hidrométricas diarias del Paraná, del <a href="https://alerta.ina.gob.ar/" target="_blank" rel="noopener">reporte público del Instituto Nacional del Agua</a>.'],
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
