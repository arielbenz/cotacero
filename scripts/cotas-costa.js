// scripts/cotas-costa.js — genera datos-abiertos/cotas-costa.json desde la IDESF.
//
//   node scripts/cotas-costa.js
//
// De dónde sale el dato: capa `MACotas` del WMS de la IDESF (Provincia de
// Santa Fe), ficha 552 del catálogo: «Puntos con cota de S.J. del Rincón,
// Colastiné y La Guardia», relevados en 2005 por convenio CFI-INA y atados al
// punto fijo del IGM PF 5-N(133). Es la misma campaña de la que salieron las
// curvas de curvas.json: donde las dos fuentes existen coinciden con una
// diferencia típica de 18 cm (AUDITORIA.md §7, pregunta 24).
//
// Para qué: las curvas del municipio terminan en el límite de la ciudad, y
// San José del Rincón y Arroyo Leyes quedaban sin altura. Estos puntos sí
// llegan. La app los usa SÓLO fuera del área de las curvas, y con un margen
// propio, ERROR_PUNTOS = 1,0 m (js/app/config.js): en la costa el terreno
// cambia más de un punto al otro, y con 0,5 m uno de cada ocho quedaba del
// lado optimista.
//
// CÓMO SE BAJA, porque no es lo normal. El servidor tiene el WFS apagado y las
// descargas piden usuario. Pero son PUNTOS, y en un punto el recuadro que
// devuelve GetFeatureInfo en GML es la coordenada misma, con seis decimales.
// Un GetFeatureInfo de 5×5 píxeles sobre un recuadro grande devuelve todos
// los puntos en un radio de unos 16 km: tres pedidos, no un barrido. Con las
// curvas no funciona —en una línea el recuadro es sólo el recuadro—, por eso
// esto son puntos y no curvas.
//
// Sin dependencias, como el resto del proyecto.

import { readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SALIDA = join(RAIZ, "public", "datos-abiertos", "cotas-costa.json");
const CURVAS = join(RAIZ, "public", "datos-abiertos", "curvas.json");

const WMS = "https://aswe.santafe.gov.ar/idesf/wms";
const CABECERAS = {
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 " +
    "(KHTML, like Gecko) Chrome/126.0 Safari/537.36",
};

// Tres centros sobre la Ruta 1: Colastiné, Rincón, Arroyo Leyes.
const CENTROS = [
  [-60.62, -31.64],
  [-60.58, -31.61],
  [-60.54, -31.57],
];

/* Qué puntos se guardan: los que caen fuera del área de las curvas, más una
   franja de unos 400 m hacia adentro para que una casa recién pasado el borde
   tenga vecinos de los dos lados. Y sólo la costa: al oeste de −60,66 están
   Recreo y Monte Vera, que la app no tiene como zona. */
const FRANJA = 0.004;
const OESTE = -60.66;

async function puntos(lon, lat, medio) {
  const q = new URLSearchParams({
    SERVICE: "WMS",
    VERSION: "1.1.1",
    REQUEST: "GetFeatureInfo",
    LAYERS: "MACotas",
    QUERY_LAYERS: "MACotas",
    STYLES: "",
    SRS: "EPSG:4326",
    BBOX: [lon - medio, lat - medio, lon + medio, lat + medio].join(","),
    WIDTH: "5",
    HEIGHT: "5",
    X: "2",
    Y: "2",
    INFO_FORMAT: "application/vnd.ogc.gml",
    FEATURE_COUNT: "200000",
  });
  const r = await fetch(`${WMS}?${q}`, { headers: CABECERAS });
  if (!r.ok) throw new Error("La IDESF respondió " + r.status);
  const x = await r.text();
  return [...x.matchAll(/<MACotas_feature>([\s\S]*?)<\/MACotas_feature>/g)].map(
    ([, f]) => {
      const c = f.match(/<gml:coordinates>([-\d.]+),([-\d.]+) /);
      const z = f.match(/<z>([^<]*)<\/z>/);
      return [+c[1], +c[2], z ? parseFloat(z[1]) : NaN];
    },
  );
}

const area = JSON.parse(await readFile(CURVAS, "utf8")).area;
const fuera = ([lon, lat]) =>
  lon > OESTE &&
  (lon > area[2] - FRANJA ||
    lat > area[3] - FRANJA ||
    lon < area[0] + FRANJA ||
    lat < area[1] + FRANJA);

const todos = new Map();
for (const [lon, lat] of CENTROS) {
  for (const p of await puntos(lon, lat, 0.04)) todos.set(p[0] + "," + p[1], p);
  await new Promise((r) => setTimeout(r, 2000));
}
// z ≤ 1 son vacíos del origen, no cotas: 5 de 10.526 el 22/10/2026.
const validos = [...todos.values()].filter(([, , z]) => z > 1);
const elegidos = validos.filter(fuera);
if (elegidos.length < 1000)
  throw new Error(
    "Sólo " + elegidos.length + " puntos: la IDESF contestó de menos, no se pisa nada",
  );

const r6 = (v) => Math.round(v * 1e6) / 1e6;
const lons = elegidos.map((p) => p[0]);
const lats = elegidos.map((p) => p[1]);
const salida = {
  fuente:
    "Puntos con cota de S.J. del Rincón, Colastiné y La Guardia — " +
    "Provincia de Santa Fe, IDESF (capa MACotas), relevamiento de 2005",
  sistema:
    "metros IGN, atado al PF 5-N(133) del IGM — el sistema de alturas " +
    "exacto no lo declara la capa, igual que las curvas",
  generado: new Date().toISOString().slice(0, 10),
  area: [
    r6(Math.min(...lons)),
    r6(Math.min(...lats)),
    r6(Math.max(...lons)),
    r6(Math.max(...lats)),
  ],
  // Plano, de a tres: lon, lat, cota. Así pesa la mitad que un objeto por punto.
  puntos: elegidos.flatMap(([lon, lat, z]) => [r6(lon), r6(lat), z]),
};
await writeFile(SALIDA, JSON.stringify(salida));

console.log("puntos bajados : " + todos.size + " (" + validos.length + " con cota)");
console.log("guardados      : " + elegidos.length + " (fuera del área de las curvas)");
console.log("área           : " + salida.area.join(", "));
console.log("tamaño         : " + (JSON.stringify(salida).length / 1024).toFixed(0) + " KB");
console.log("escrito en     : datos-abiertos/cotas-costa.json");
