// scripts/paginas/puntos.js — /puntos-de-encuentro. La escribe emitir.js.

import { SITIO, esc, pagina, puntos, selloFuente } from "./base.js";

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

export {
  GRUPOS,
  ORDEN,
  TEXTO_COMPARTIR,
  agrupados,
  atajos,
  grupoDe,
  htmlPuntos,
  lista,
  numero,
};
