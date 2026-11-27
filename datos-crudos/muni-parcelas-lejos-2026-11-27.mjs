// node datos-crudos/muni-parcelas-lejos-2026-11-27.mjs 2026-11-27 [carpeta]
//
// Las parcelas del catastro municipal que quedan a más de CURVAS_LEJOS_M de
// una curva de nivel, con lo que dice de cada una cada fuente de altura.
//
// Para qué: saber a cuánta gente le cambia el número una regla sobre «lejos
// de una curva» (AUDITORIA.md §4). Los puntos con cota miden el error, pero
// están sobre calles y caminos y no dicen dónde hay casas; las parcelas sí,
// con dos límites: el catastro no ve los asentamientos informales, y una
// parcela no es una casa.
//
// De dónde: `publico:parcela` del GeoServer municipal
// (geoservicios.santafeciudad.gov.ar, WFS 2.0), 122.949 parcelas, de a 20.000.
// Son ~60 MB: no se guardan. Se guarda sólo el resumen de las que están lejos
// de una curva, en muni-parcelas-lejos-<fecha>.json: el centro, la superficie,
// la vecinal, lo que dan las curvas y lo que dan los puntos.
// Con [carpeta] lee parcela-0.json … parcela-6.json de ahí en vez de bajarlas.
import { existsSync, readFileSync, writeFileSync } from "node:fs";

const HOY = process.argv[2];
if (!HOY) throw new Error("falta la fecha: node … 2026-11-27");
const CARPETA = process.argv[3];
const WFS = "https://geoservicios.santafeciudad.gov.ar/geoserver/publico/wfs";
const DE_A = 20000;
const red = globalThis.fetch; // app-en-node.js lo cambia por uno que lee del disco
await import(process.cwd() + "/scripts/app-en-node.js");
const { entreCurvas, FUENTES_ALTURA, CURVAS_LEJOS_M } = await import("/js/app/elevacion.js");
const conPuntos = FUENTES_ALTURA.find((f) => f.id === "puntos").calcular;

const CURVAS = JSON.parse(readFileSync("public/datos-abiertos/curvas.json", "utf8"));
const PUNTOS = JSON.parse(readFileSync("public/datos-abiertos/cotas-costa.json", "utf8"));
const [oeste, sur, este, norte] = CURVAS.area;

const anillos = [];
for (const f of JSON.parse(readFileSync("datos-crudos/muni-vecinales-2026-09-08.json", "utf8")).features)
  for (const p of f.geometry.coordinates) anillos.push({ nom: f.properties.vecinal, r: p[0] });
function enAnillo(r, x, y) {
  let d = false;
  for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
    const [xi, yi] = r[i],
      [xj, yj] = r[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) d = !d;
  }
  return d;
}
const vecinal = (lon, lat) => {
  for (const a of anillos) if (enAnillo(a.r, lon, lat)) return a.nom;
  return null;
};

// Centro y superficie (m²) del anillo exterior más grande.
function centroYArea(g) {
  const polis = g.type === "Polygon" ? [g.coordinates] : g.coordinates;
  const kx = 111320 * Math.cos((-31.63 * Math.PI) / 180),
    ky = 110900;
  let mejor = null;
  for (const p of polis) {
    const r = p[0];
    let a = 0,
      cx = 0,
      cy = 0;
    for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
      const x1 = r[j][0] * kx,
        y1 = r[j][1] * ky,
        x2 = r[i][0] * kx,
        y2 = r[i][1] * ky;
      const f = x1 * y2 - x2 * y1;
      a += f;
      cx += (x1 + x2) * f;
      cy += (y1 + y2) * f;
    }
    a /= 2;
    if (!a) continue;
    const c = { area: Math.abs(a), lon: cx / (6 * a) / kx, lat: cy / (6 * a) / ky };
    if (!mejor || c.area > mejor.area) mejor = c;
  }
  return mejor;
}

async function tanda(i) {
  if (CARPETA) {
    const f = `${CARPETA}/parcela-${i}.json`;
    return existsSync(f) ? JSON.parse(readFileSync(f, "utf8")).features : [];
  }
  const q = new URLSearchParams({
    service: "WFS",
    version: "2.0.0",
    request: "GetFeature",
    typeNames: "publico:parcela",
    outputFormat: "application/json",
    srsName: "EPSG:4326",
    count: String(DE_A),
    startIndex: String(i * DE_A),
    sortBy: "parcela_id",
  });
  const r = await red(`${WFS}?${q}`);
  if (!r.ok) throw new Error("el GeoServer respondió " + r.status);
  await new Promise((ok) => setTimeout(ok, 2000));
  return (await r.json()).features;
}

let total = 0,
  enElArea = 0;
const lejos = [];
for (let i = 0; ; i++) {
  const fs = await tanda(i);
  if (!fs.length) break;
  for (const f of fs) {
    total++;
    const c = f.geometry && centroYArea(f.geometry);
    if (!c || c.lon < oeste || c.lon > este || c.lat < sur || c.lat > norte) continue;
    enElArea++;
    const cv = entreCurvas(CURVAS, c.lat, c.lon);
    if (cv.distancia <= CURVAS_LEJOS_M) continue;
    const pt = conPuntos(PUNTOS, c.lat, c.lon);
    lejos.push({
      lon: +c.lon.toFixed(6),
      lat: +c.lat.toFixed(6),
      m2: Math.round(c.area),
      vecinal: vecinal(c.lon, c.lat),
      curvas: +cv.cota.toFixed(2),
      aCurva: Math.round(cv.distancia),
      puntos: pt ? +pt.cota.toFixed(2) : null,
      aPunto: pt ? Math.round(pt.distancia) : null,
    });
  }
  if (fs.length < DE_A) break;
}
writeFileSync(
  `datos-crudos/muni-parcelas-lejos-${HOY}.json`,
  JSON.stringify({
    fuente: "Municipalidad de Santa Fe, publico:parcela (WFS), centro de cada parcela",
    bajado: HOY,
    parcelas: total,
    enElAreaDeLasCurvas: enElArea,
    lejosDesde_m: CURVAS_LEJOS_M,
    nota:
      "curvas: lo que da entreCurvas() y a cuántos metros está la curva; " +
      "puntos: lo que da conPuntos() con cotas-costa.json y a cuántos metros está el punto, o null",
    lejos,
  }),
);
console.log(`parcelas ${total}; en el área de las curvas ${enElArea}; a más de ${CURVAS_LEJOS_M} m de una curva ${lejos.length}`);
