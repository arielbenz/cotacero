// lib/paginas.js — el mapa del sitio, escrito UNA sola vez.
//
// Título, descripción, canónica, Open Graph, indexabilidad y sitemap salen
// todos de acá. Antes vivían repartidos entre `scripts/paginas.js`, el HTML
// escrito a mano de la portada y de la app, y un `sitemap.xml` que se editaba
// aparte — que es exactamente cómo terminan divergiendo.
//
// Quién lo consume:
//   scripts/paginas.js  arma el <head> de las páginas generadas, emite
//                       sitemap.xml y VERIFICA que la portada y la app
//                       (que son HTML a mano) digan lo mismo que este archivo
//
// `busqueda` no lo lee ningún programa: documenta a qué va cada página, para
// que nadie escriba dos que compitan por lo mismo. Es la regla que evita la
// canibalización.

export const SITIO = "https://cotacerosf.com";

/* La imagen de las vistas previas. Es la misma para todo el sitio y es
   deliberadamente EVERGREEN: no lleva el nivel del río. Una imagen con el
   dato de hoy se queda cacheada en WhatsApp y Facebook durante días, y
   compartir "el río está en 2,95" cuando está en 5,80 es peor que no poner
   ningún número. */
export const OG_IMAGEN = {
  url: SITIO + "/img/og.png",
  ancho: 1200,
  alto: 630,
};

export const PAGINAS = {
  inicio: {
    ruta: "/",
    generada: false, // index.html está escrito a mano
    indexable: true,
    busqueda: "nivel del río Paraná en Santa Fe hoy",
    titulo: "Nivel del río Paraná en Santa Fe hoy | Cota Cero",
    descripcion:
      "Consultá el nivel actual del río Paraná en la ciudad de Santa Fe y " +
      "entendé qué significa para tu terreno. Datos públicos del INA y de la " +
      "Municipalidad.",
    prioridad: "1.0",
    frecuencia: "daily",
  },

  app: {
    ruta: "/app",
    generada: false, // app/index.html está escrito a mano
    /* NOINDEX, FOLLOW. Es una interfaz, no un documento, y las páginas de
       contenido existen justamente porque la app esconde tres de sus cuatro
       secciones detrás de pestañas. Indexar las dos es competir contra uno
       mismo: repite los 30 puntos de encuentro, y quien llega desde una
       búsqueda informativa cae en una herramienta vacía —sin cota cargada—
       en vez de en una página que le contesta.
       `follow` a propósito: se sigue rastreando y sigue pasando autoridad. */
    indexable: false,
    razonNoindex:
      "Interfaz de la herramienta, no contenido. Duplica los puntos de " +
      "encuentro y no responde una búsqueda informativa.",
    busqueda: "—",
    titulo: "Cota Cero — la app del nivel del río en Santa Fe",
    descripcion:
      "La herramienta: el nivel del río Paraná, tu referencia estimada, el " +
      "plan familiar y los puntos de encuentro. Funciona sin señal una vez " +
      "cargada.",
  },

  miCota: {
    ruta: "/mi-cota",
    generada: true,
    indexable: true,
    busqueda: "cota de terreno Santa Fe · cota IGN Santa Fe",
    titulo: "¿Cuál es la cota de mi terreno en Santa Fe? | Cota Cero",
    descripcion:
      "Qué es la cota de un terreno, de dónde sale la de tu casa y cómo se " +
      "relaciona con la altura del río Paraná en el Puerto de Santa Fe. Con " +
      "sus límites.",
    prioridad: "0.9",
    frecuencia: "monthly",
  },

  puntos: {
    ruta: "/puntos-de-encuentro",
    generada: true,
    indexable: true,
    busqueda: "puntos de encuentro inundación Santa Fe",
    titulo: "Puntos de encuentro por inundación en Santa Fe | Cota Cero",
    descripcion:
      "Los 30 puntos de encuentro del Plan de Contingencia de la " +
      "Municipalidad de Santa Fe, con su dirección y cómo llegar. Fuente: " +
      "Gestión de Riesgos.",
    prioridad: "0.9",
    frecuencia: "monthly",
  },

  datos: {
    ruta: "/datos",
    generada: true,
    indexable: true,
    busqueda: "datos del río Paraná en Santa Fe · fuentes y metodología",
    titulo: "Datos y fuentes del río Paraná en Santa Fe | Cota Cero",
    descripcion:
      "De dónde sale cada número: el nivel del río lo publica el INA y las " +
      "curvas de nivel la Municipalidad. Cómo se combinan, y qué no sabemos " +
      "todavía.",
    prioridad: "0.8",
    frecuencia: "monthly",
  },

  historia: {
    ruta: "/historia",
    generada: true,
    indexable: true,
    busqueda:
      "crecidas históricas del Paraná en Santa Fe · inundaciones históricas",
    titulo: "Crecidas históricas del río Paraná en Santa Fe | Cota Cero",
    descripcion:
      "Las mayores crecidas y las bajantes más hondas del Paraná en Santa Fe, " +
      "con la serie diaria del INA desde 1925. La de 1992 sigue siendo el " +
      "récord.",
    prioridad: "0.8",
    frecuencia: "monthly",
  },

  preguntas: {
    ruta: "/preguntas",
    generada: true,
    indexable: true,
    busqueda: "nivel de alerta del Paraná en Santa Fe · dudas frecuentes",
    titulo: "Preguntas sobre el río Paraná en Santa Fe | Cota Cero",
    descripcion:
      "Cuál es el nivel de alerta y el de evacuación, qué significa la altura " +
      "del río, cómo saber la cota de tu terreno y de dónde salen los datos.",
    prioridad: "0.7",
    frecuencia: "monthly",
  },

  sobre: {
    ruta: "/sobre",
    generada: true,
    indexable: true,
    busqueda: "qué es Cota Cero · quién lo hace",
    titulo: "Sobre Cota Cero: qué es y quién lo hace",
    descripcion:
      "Cota Cero es un proyecto ciudadano independiente sobre el riesgo " +
      "hídrico en Santa Fe. No pertenece a ningún organismo. Qué usa, cómo " +
      "y qué no sabe.",
    prioridad: "0.6",
    frecuencia: "yearly",
  },

  paraMedios: {
    ruta: "/para-medios",
    generada: true,
    indexable: true,
    busqueda: "widget del nivel del río para medios",
    titulo: "Widget del nivel del río para medios | Cota Cero",
    descripcion:
      "Widget gratuito con el nivel del hidrómetro del Puerto de Santa Fe y " +
      "los umbrales oficiales. Dos líneas de HTML, sin claves, sin cookies y " +
      "sin rastreo.",
    prioridad: "0.6",
    frecuencia: "yearly",
  },

  charlas: {
    ruta: "/charlas",
    generada: true,
    indexable: true,
    busqueda: "charlas sobre prepararse ante desastres y datos abiertos",
    titulo: "Charlas sobre inundaciones y datos abiertos | Cota Cero",
    descripcion:
      "Charlas TED y TEDx sobre prepararse antes de la emergencia, " +
      "organizarse entre vecinos, convivir con el agua y abrir los datos " +
      "públicos.",
    prioridad: "0.4",
    frecuencia: "yearly",
  },

  legal: {
    ruta: "/legal",
    generada: true,
    indexable: true,
    busqueda: "— (no es una página de búsqueda)",
    titulo: "Legal y privacidad | Cota Cero",
    descripcion:
      "Descargo de responsabilidad, qué datos quedan en tu teléfono y cuáles " +
      "no salen nunca de ahí, y las licencias de todo lo que usa Cota Cero.",
    prioridad: "0.3",
    frecuencia: "yearly",
  },

  noEncontrada: {
    ruta: "/404",
    generada: true,
    /* Se escribe como /404.html en la raíz, que es lo que Vercel sirve —con
       código 404— para cualquier ruta que no existe. No va al sitemap ni al
       índice: una página de error no es contenido. */
    archivo: "404.html",
    indexable: false,
    razonNoindex: "Página de error.",
    busqueda: "—",
    titulo: "Esa página no existe | Cota Cero",
    descripcion:
      "La página que buscabas no está. Acá tenés el nivel del río Paraná en " +
      "Santa Fe y los accesos a lo que sí existe.",
  },

  widget: {
    ruta: "/widget",
    generada: false, // widget/index.html está escrito a mano
    /* El widget es un iframe para que lo embeban los medios: no es una
       página para leer, y su contenido —el nivel de hoy— ya está en la
       portada. Indexarlo sería ofrecerle a alguien un recuadro suelto sin
       navegación ni contexto. */
    indexable: false,
    razonNoindex: "Fragmento para embeber en otros sitios, no una página.",
    busqueda: "—",
    titulo: "Nivel del río en el Puerto de Santa Fe — Cota Cero",
  },
};

/* Lo que va al sitemap: sólo lo indexable, y ordenado como se recorrería el
   sitio. Nada de /api, ni assets, ni el manifest, ni el service worker. */
export const enSitemap = () =>
  Object.values(PAGINAS).filter((p) => p.indexable);

export const porRuta = (ruta) =>
  Object.values(PAGINAS).find((p) => p.ruta === ruta);
