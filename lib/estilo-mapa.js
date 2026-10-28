// lib/estilo-mapa.js — el estilo del mapa, en sus dos temas. Lo escribe
// scripts/paginas/emitir.js en public/mapa/claro.json y oscuro.json, que leen
// la app (js/app/mapa.js) y la portada (js/landing.js).
//
// Los tiles son vectoriales, con el esquema de OpenMapTiles, y los sirve
// OpenFreeMap (tiles.openfreemap.org): sin clave y sin cuota, como pide
// CLAUDE.md para cualquier proveedor del mapa. Los dibuja el teléfono, así que
// los nombres de las calles salen al tamaño de la pantalla —en los PNG del
// argenmap del IGN quedaban en unos 8 px— y el tema oscuro es un oscuro de
// verdad, no el plano claro invertido con un filtro.
//
// La base es «Positron» de OpenFreeMap, recortada a lo que existe alrededor de
// Santa Fe (sin glaciares, escudos de rutas de EE.UU. ni nombres de países) y
// sin sprite: ninguna capa usa íconos, y es un pedido menos. Los colores salen
// de estilos/app.css: los textos son los del tema, y los rellenos se mezclan
// desde el fondo, así que un cambio de paleta llega solo al regenerar.
//
// Sólo Node. No va en public/lib/ porque el navegador no lo importa: lee el
// JSON que sale de acá, y así la portada —un script clásico— y la app —módulos—
// usan el mismo archivo sin copiarlo.

/* El color de una variable de estilos/app.css: la primera declaración con un
   hexadecimal. El tema oscuro es el de :root (--fondo, --texto…), y el claro
   vive una sola vez en las --c-* (--c-fondo, --c-texto…). Si no aparece, falla
   ruidoso: un mapa con un color inventado no avisa. */
function token(css, nombre) {
  const m = css.match(
    new RegExp("^\\s*--" + nombre + ":\\s*(#[0-9a-fA-F]{6})\\s*;", "m"),
  );
  if (!m) throw new Error("estilos/app.css: no encuentro --" + nombre);
  return m[1].toLowerCase();
}

// a mezclado sobre b, en proporción p (0 = b, 1 = a).
function mezcla(a, b, p) {
  const c = (h, i) => parseInt(h.slice(1 + i * 2, 3 + i * 2), 16);
  return (
    "#" +
    [0, 1, 2]
      .map((i) =>
        Math.round(c(a, i) * p + c(b, i) * (1 - p))
          .toString(16)
          .padStart(2, "0"),
      )
      .join("")
  );
}

/* Las proporciones se eligieron mirando el mapa a 390 px en los dos temas
   contra el argenmap. En claro el fondo de la página (#fafbfc) es casi blanco
   y las calles son blancas: las manzanas tienen que bajar un tono para que la
   cuadrícula se lea. */
export function paletaMapa(css, tema) {
  if (tema === "claro") {
    const fondo = token(css, "c-fondo");
    const texto = token(css, "c-texto");
    return {
      fondo: mezcla(texto, fondo, 0.05),
      urbano: mezcla(texto, fondo, 0.11),
      parque: mezcla(token(css, "c-ok"), fondo, 0.14),
      agua: mezcla(token(css, "c-agua"), fondo, 0.35),
      edificio: mezcla(texto, fondo, 0.15),
      calle: token(css, "c-panel"),
      borde: mezcla(texto, fondo, 0.2),
      tren: mezcla(texto, fondo, 0.22),
      texto,
      tenue: token(css, "c-tenue"),
      textoAgua: token(css, "c-acento"),
      halo: mezcla(texto, fondo, 0.05),
    };
  }
  const fondo = token(css, "fondo");
  const texto = token(css, "texto");
  return {
    fondo,
    urbano: mezcla(texto, fondo, 0.02),
    parque: mezcla(token(css, "ok"), fondo, 0.1),
    agua: mezcla(token(css, "agua"), fondo, 0.16),
    edificio: token(css, "panel"),
    calle: mezcla(texto, fondo, 0.1),
    borde: fondo,
    tren: mezcla(texto, fondo, 0.14),
    texto,
    tenue: token(css, "tenue"),
    textoAgua: token(css, "agua"),
    halo: fondo,
  };
}

const OMT = "openmaptiles";
// El nombre local, que en Santa Fe es el castellano. Positron pide primero
// `name_en`, que daría «Parana River».
const NOMBRE = ["coalesce", ["get", "name:es"], ["get", "name"]];
const POLIGONO = ["match", ["geometry-type"], ["MultiPolygon", "Polygon"], true, false];
const LINEA = ["match", ["geometry-type"], ["LineString", "MultiLineString"], true, false];
const clase = (...cs) => ["match", ["get", "class"], cs, true, false];
const MAYORES = clase("primary", "secondary", "tertiary", "trunk");
const MENORES = clase("minor", "service", "track");
const AUTOPISTA = ["==", ["get", "class"], "motorway"];
const ancho = (base, ...pares) => ["interpolate", ["exponential", base], ["zoom"], ...pares];

/* Las capas van en dos grupos, por el prefijo del id, y fondoDeMarcar() en
   mapa.js prende uno y apaga el otro:
     base-  el plano, lo que se ve siempre;
     foto-  la foto aérea de «Marcar mi casa» y los nombres de las calles
            encima, en blanco con halo oscuro, que se leen sobre cualquier
            techo. Antes esos nombres eran otra capa del IGN, en PNG.
   «fondo» no tiene prefijo: queda prendido en los dos modos, y es lo que se ve
   sin señal, con los 30 puntos encima. */
export function estiloMapa(css, tema) {
  const c = paletaMapa(css, tema);
  const nombreCalle = (id, filtro, minzoom, color, halo, visibility = "visible") => ({
    id,
    type: "symbol",
    source: OMT,
    "source-layer": "transportation_name",
    minzoom,
    filter: filtro,
    layout: {
      visibility,
      "symbol-placement": "line",
      "text-field": NOMBRE,
      "text-font": ["Noto Sans Regular"],
      "text-rotation-alignment": "map",
      "text-size": ["interpolate", ["linear"], ["zoom"], 13, 11, 15, 13, 18, 15],
    },
    paint: { "text-color": color, "text-halo-color": halo, "text-halo-width": 1.5 },
  });
  return {
    version: 8,
    name: "Cota Cero " + tema,
    sources: {
      [OMT]: {
        type: "vector",
        // El TileJSON: dice qué versión del planeta está publicada. Escribir
        // la URL de los tiles con la versión adentro se rompería el día que
        // OpenFreeMap borre la vieja.
        url: "https://tiles.openfreemap.org/planet",
        attribution:
          '<a href="https://openfreemap.org/" target="_blank" rel="noopener">OpenFreeMap</a> · ' +
          '<a href="https://www.openmaptiles.org/" target="_blank" rel="noopener">© OpenMapTiles</a> · ' +
          'datos de <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>',
      },
      /* La foto aérea, sólo para «Marcar mi casa»: el plano no dibuja casi
         ningún edificio de Santa Fe ni la numeración, y a la altura de una
         cuadra se ve una manzana lisa. Son los vuelos fotogramétricos del IGN
         de 2013 (40 cm) y del 9/7/2014 (30 cm), según su capa de áreas de
         vuelo; la app dice la fecha en pantalla porque una casa más nueva sale
         como baldío. Va por WMS en JPEG y no por su TMS en PNG: 15 KB contra
         190 KB por tile, y en una crecida se mira con datos móviles. Sin clave
         ni cuota. */
      vuelos: {
        type: "raster",
        tiles: [
          "https://imagenes.ign.gob.ar/geoserver/mosaicos_vuelos/wms?service=WMS" +
            "&version=1.1.1&request=GetMap&layers=mosaicos_vuelos&styles=" +
            "&srs=EPSG:3857&bbox={bbox-epsg-3857}&width=256&height=256" +
            "&format=image/jpeg",
        ],
        tileSize: 256,
        attribution:
          'Foto aérea: <a href="https://www.ign.gob.ar/" target="_blank" rel="noopener">IGN</a>, vuelos de 2013 y 2014',
      },
    },
    glyphs: "https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf",
    layers: [
      { id: "fondo", type: "background", paint: { "background-color": c.fondo } },
      {
        id: "base-urbano",
        type: "fill",
        source: OMT,
        "source-layer": "landuse",
        maxzoom: 16,
        filter: ["all", POLIGONO, clase("residential")],
        paint: { "fill-color": c.urbano },
      },
      {
        id: "base-bosque",
        type: "fill",
        source: OMT,
        "source-layer": "landcover",
        minzoom: 10,
        filter: ["all", POLIGONO, clase("wood", "grass")],
        paint: { "fill-color": c.parque, "fill-opacity": 0.6 },
      },
      {
        id: "base-parque",
        type: "fill",
        source: OMT,
        "source-layer": "park",
        filter: POLIGONO,
        paint: { "fill-color": c.parque },
      },
      {
        id: "base-agua",
        type: "fill",
        source: OMT,
        "source-layer": "water",
        filter: ["all", POLIGONO, ["!=", ["get", "brunnel"], "tunnel"]],
        paint: { "fill-color": c.agua },
      },
      {
        id: "base-arroyos",
        type: "line",
        source: OMT,
        "source-layer": "waterway",
        filter: LINEA,
        paint: { "line-color": c.agua, "line-width": ancho(1.3, 10, 1, 18, 4) },
      },
      {
        id: "base-edificios",
        type: "fill",
        source: OMT,
        "source-layer": "building",
        minzoom: 13,
        paint: { "fill-color": c.edificio, "fill-outline-color": c.borde },
      },
      {
        id: "base-pistas",
        type: "line",
        source: OMT,
        "source-layer": "aeroway",
        minzoom: 11,
        filter: ["all", LINEA, clase("runway")],
        paint: { "line-color": c.borde, "line-width": ancho(1.5, 11, 3, 17, 40) },
      },
      {
        id: "base-senderos",
        type: "line",
        source: OMT,
        "source-layer": "transportation",
        minzoom: 14,
        filter: ["all", LINEA, clase("path")],
        layout: { "line-cap": "round", "line-join": "round" },
        paint: {
          "line-color": c.calle,
          "line-width": ancho(1.2, 14, 0.75, 20, 6),
          "line-dasharray": [2, 2],
        },
      },
      {
        id: "base-calles",
        type: "line",
        source: OMT,
        "source-layer": "transportation",
        minzoom: 11,
        filter: ["all", LINEA, MENORES],
        layout: { "line-cap": "round", "line-join": "round" },
        paint: { "line-color": c.calle, "line-width": ancho(1.55, 11, 0.5, 13, 1.8, 20, 20) },
      },
      {
        id: "base-avenidas-borde",
        type: "line",
        source: OMT,
        "source-layer": "transportation",
        minzoom: 11,
        filter: ["all", LINEA, ["any", MAYORES, AUTOPISTA]],
        layout: { "line-join": "round" },
        paint: { "line-color": c.borde, "line-width": ancho(1.3, 10, 3, 20, 25) },
      },
      {
        id: "base-avenidas",
        type: "line",
        source: OMT,
        "source-layer": "transportation",
        minzoom: 9,
        filter: ["all", LINEA, ["any", MAYORES, AUTOPISTA]],
        layout: { "line-cap": "round", "line-join": "round" },
        paint: { "line-color": c.calle, "line-width": ancho(1.3, 9, 1, 10, 2, 20, 22) },
      },
      {
        id: "base-tren",
        type: "line",
        source: OMT,
        "source-layer": "transportation",
        minzoom: 12,
        filter: ["all", LINEA, ["!", ["has", "service"]], clase("rail")],
        paint: {
          "line-color": c.tren,
          "line-width": ancho(1.3, 12, 1, 20, 4),
          "line-dasharray": [3, 2],
        },
      },
      {
        id: "base-nombres-agua",
        type: "symbol",
        source: OMT,
        "source-layer": "water_name",
        layout: {
          "symbol-placement": ["step", ["zoom"], "point", 11, "line"],
          "text-field": NOMBRE,
          "text-font": ["Noto Sans Italic"],
          "text-letter-spacing": 0.1,
          "text-max-width": 6,
          "text-size": 13,
        },
        paint: { "text-color": c.textoAgua, "text-halo-color": c.halo, "text-halo-width": 1.5 },
      },
      {
        id: "base-nombres-arroyos",
        type: "symbol",
        source: OMT,
        "source-layer": "waterway",
        minzoom: 12,
        filter: LINEA,
        layout: {
          "symbol-placement": "line",
          "text-field": NOMBRE,
          "text-font": ["Noto Sans Italic"],
          "text-size": 12,
        },
        paint: { "text-color": c.textoAgua, "text-halo-color": c.halo, "text-halo-width": 1.5 },
      },
      /* Las calles chicas llevan nombre desde el 14 y no desde el 15, como en
         Positron: a esa escala el argenmap nombraba casi todas, y ubicar un
         punto de encuentro es ubicar una esquina. */
      nombreCalle("base-nombres-calles", MENORES, 14, c.tenue, c.halo),
      nombreCalle("base-nombres-avenidas", ["any", MAYORES, AUTOPISTA], 12, c.tenue, c.halo),
      /* Los barrios: así se ubica la gente en Santa Fe, y así se habla de las
         zonas. Van en versalitas y tenues para no competir con los pines. */
      {
        id: "base-barrios",
        type: "symbol",
        source: OMT,
        "source-layer": "place",
        minzoom: 11,
        maxzoom: 16,
        filter: clase("suburb", "neighbourhood", "quarter", "hamlet", "isolated_dwelling"),
        layout: {
          "text-field": NOMBRE,
          "text-font": ["Noto Sans Regular"],
          "text-transform": "uppercase",
          "text-letter-spacing": 0.08,
          "text-max-width": 8,
          "text-size": ["interpolate", ["linear"], ["zoom"], 11, 10, 15, 12],
        },
        paint: { "text-color": c.tenue, "text-halo-color": c.halo, "text-halo-width": 1.5 },
      },
      {
        id: "base-localidades",
        type: "symbol",
        source: OMT,
        "source-layer": "place",
        maxzoom: 14,
        filter: clase("city", "town", "village"),
        layout: {
          "text-field": NOMBRE,
          "text-font": ["Noto Sans Bold"],
          "text-max-width": 8,
          "text-size": ["interpolate", ["linear"], ["zoom"], 8, 12, 12, 16],
        },
        paint: { "text-color": c.texto, "text-halo-color": c.halo, "text-halo-width": 1.5 },
      },
      { id: "foto-vuelos", type: "raster", source: "vuelos", layout: { visibility: "none" } },
      nombreCalle(
        "foto-nombres",
        ["any", MENORES, MAYORES, AUTOPISTA],
        14,
        "#ffffff",
        "rgba(0, 0, 0, 0.8)",
        "none",
      ),
    ],
  };
}
