// node datos-crudos/idesf-macotas-2026-10-22.mjs 2026-10-22
//
// Baja los «Puntos con cota de S.J. del Rincón, Colastiné y La Guardia»
// (capa MACotas de la IDESF, ficha 552 del catálogo) y la red de puntos fijos
// provincial (MAPuntosFijos, ficha 553). Son el relevamiento de 2005 del que
// salieron las curvas de nivel.
//
// Por qué así: el servidor (MapServer, aswe.santafe.gov.ar/idesf/wms) tiene el
// WFS apagado y las descargas piden usuario. Pero las dos capas son de
// PUNTOS, y en un punto el recuadro que devuelve GetFeatureInfo en GML es la
// coordenada misma, con seis decimales. Un GetFeatureInfo de 5×5 píxeles
// sobre un recuadro grande devuelve todos los puntos en un radio de ~16 km,
// sin otro tope que FEATURE_COUNT. Son tres pedidos, no un barrido.
//
// Esto NO sirve para MACurvaNivel: en una línea el recuadro es sólo el
// recuadro, y la geometría no viaja. Las curvas siguen sin poder bajarse.
import { writeFileSync } from "node:fs";
const HOY = process.argv[2];
const BASE = "https://aswe.santafe.gov.ar/idesf/wms";
const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/126.0 Safari/537.36";

async function puntos(capa, lon, lat, medio) {
  const q = new URLSearchParams({
    SERVICE: "WMS", VERSION: "1.1.1", REQUEST: "GetFeatureInfo",
    LAYERS: capa, QUERY_LAYERS: capa, STYLES: "", SRS: "EPSG:4326",
    BBOX: [lon - medio, lat - medio, lon + medio, lat + medio].join(","),
    WIDTH: "5", HEIGHT: "5", X: "2", Y: "2",
    INFO_FORMAT: "application/vnd.ogc.gml", FEATURE_COUNT: "200000",
  });
  const x = await (await fetch(`${BASE}?${q}`, { headers: { "User-Agent": UA } })).text();
  const re = new RegExp(`<${capa}_feature>([\\s\\S]*?)</${capa}_feature>`, "g");
  return [...x.matchAll(re)].map(([, f]) => {
    const [, lon, lat] = f.match(/<gml:coordinates>([-\d.]+),([-\d.]+) /);
    const attrs = Object.fromEntries(
      [...f.matchAll(/<(\w+)>([^<]*)<\/\1>/g)].map(([, k, v]) => [k, v]),
    );
    return { lon: +lon, lat: +lat, ...attrs };
  });
}

// Tres centros sobre la Ruta 1: Colastiné, Rincón, Arroyo Leyes.
const CENTROS = [[-60.62, -31.64], [-60.58, -31.61], [-60.54, -31.57]];
for (const capa of ["MACotas", "MAPuntosFijos"]) {
  const todos = new Map();
  for (const [lon, lat] of CENTROS) {
    for (const p of await puntos(capa, lon, lat, 0.04))
      todos.set(`${p.lon},${p.lat}`, p);
    await new Promise((r) => setTimeout(r, 2000));
  }
  const lista = [...todos.values()];
  writeFileSync(`datos-crudos/idesf-${capa}-${HOY}.json`, JSON.stringify(lista));
  console.log(capa, lista.length, "puntos");
}
