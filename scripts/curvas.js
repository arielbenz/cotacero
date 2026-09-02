// scripts/curvas.js — genera datos/curvas.json desde el GeoServer municipal.
//
//   node scripts/curvas.js
//
// De dónde sale el dato: capa `curvas_nivel` del GeoServer de la
// Municipalidad de Santa Fe, subida por la Secretaría de Recursos Hídricos.
// Son las curvas de nivel de la ciudad, en metros IGN.
//
// OJO CON UNA SUPOSICIÓN. Damos por hecho que estas curvas y el cero del
// hidrómetro que usa la app (8,20 m) están en el mismo sistema de alturas,
// porque de eso depende que restarlos signifique algo. Los metadatos de la
// capa NO lo declaran: sólo dicen que salió de
// Sec_Recursos_Hidricos\Dep_Relevamientos_Planialtimetricos, y el sistema
// horizontal es EPSG:22185 (Campo Inchauspe, 1969). Está anotado como
// pendiente de validación técnica en AUDITORIA.md, junto con la discrepancia
// entre 8,20 y el 8,378 que publica el INA.
//
// Y no son exactamente "cada 50 cm": 21 de los 169 tramos caen fuera de esa
// malla, y entre 20,7 y 22,5 m no hay ninguna curva. El margen fijo de 0,5 m
// que usa la app (ERROR_DEM) es una convención, no una medición.
//
// Reemplaza al modelo satelital de Open-Meteo, que medía techos y arbolado en
// vez del piso: comparado con estas curvas sobreestimaba 2,15 m de media, y
// contra los puntos de nivelación del IGN tenía un desvío de 7,5 m. Ver el
// README.
//
// DOS TRAMPAS del origen, las dos manejadas acá abajo:
//   1. 25 de las 169 curvas traen Z = 0 en la geometría. La cota verdadera
//      está en el atributo `layer`. El atributo manda.
//   2. `layer` mezcla separador decimal: hay "17,2" y hay "17.2".
//
// Sin dependencias, como el resto del proyecto.

import { writeFile, mkdir } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SALIDA = join(RAIZ, "datos-abiertos", "curvas.json");

const URL_WFS =
  "https://geoserver.santafeciudad.gov.ar/geoserver/sitmax/ows" +
  "?service=WFS&version=1.0.0&request=GetFeature" +
  "&typeName=sitmax:curvas_nivel&outputFormat=application/json" +
  "&srsName=EPSG:4326";

/* Cloudflare rechaza los clientes que no parecen navegador. */
const CABECERAS = {
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 " +
    "(KHTML, like Gecko) Chrome/126.0 Safari/537.36",
  Accept: "application/json,*/*",
};

const aNumero = (v) => {
  const n = parseFloat(String(v).replace(",", "."));
  return Number.isFinite(n) ? n : null;
};

/* Douglas-Peucker. Tolerancia en grados: 1e-4 son unos 10 m acá, muy por
   debajo de la separación entre curvas, así que no mueve la interpolación. */
function simplificar(pts, tol) {
  if (pts.length < 3) return pts;
  let iMax = 0,
    dMax = 0;
  const [ax, ay] = pts[0];
  const [bx, by] = pts[pts.length - 1];
  const dx = bx - ax,
    dy = by - ay;
  const len2 = dx * dx + dy * dy;
  for (let i = 1; i < pts.length - 1; i++) {
    const [px, py] = pts[i];
    let t = len2 ? ((px - ax) * dx + (py - ay) * dy) / len2 : 0;
    t = Math.max(0, Math.min(1, t));
    const qx = ax + t * dx,
      qy = ay + t * dy;
    const d = (px - qx) ** 2 + (py - qy) ** 2;
    if (d > dMax) {
      dMax = d;
      iMax = i;
    }
  }
  if (Math.sqrt(dMax) <= tol) return [pts[0], pts[pts.length - 1]];
  return [
    ...simplificar(pts.slice(0, iMax + 1), tol),
    ...simplificar(pts.slice(iMax), tol).slice(1),
  ];
}

const r5 = (v) => Math.round(v * 1e5) / 1e5;

const r = await fetch(URL_WFS, { headers: CABECERAS });
if (!r.ok) throw new Error("El GeoServer respondió " + r.status);
const geo = await r.json();

const curvas = [];
let sinCota = 0,
  zCero = 0;
for (const f of geo.features) {
  const g = f.geometry;
  if (!g) continue;
  const tramos =
    g.type === "LineString"
      ? [g.coordinates]
      : g.type === "MultiLineString"
        ? g.coordinates
        : [];

  // El atributo primero; la Z de la geometría sólo como respaldo.
  let z = aNumero(f.properties?.layer);
  const zGeom = tramos[0]?.[0]?.[2];
  if (z === null && zGeom) z = zGeom;
  else if (zGeom === 0) zCero++;
  if (z === null || z === 0) {
    sinCota++;
    continue;
  }

  for (const tramo of tramos) {
    const pts = simplificar(
      tramo.map((p) => [p[0], p[1]]),
      1e-4,
    );
    if (pts.length < 2) continue;
    curvas.push([z, pts.flatMap(([x, y]) => [r5(x), r5(y)])]);
  }
}

const cotas = curvas.map((c) => c[0]);
const lons = curvas.flatMap((c) => c[1].filter((_, i) => i % 2 === 0));
const lats = curvas.flatMap((c) => c[1].filter((_, i) => i % 2 === 1));

const salida = {
  fuente:
    "Curvas de nivel — Municipalidad de Santa Fe, Secretaría de Recursos Hídricos (capa sitmax:curvas_nivel)",
  // Sin declarar en el origen: ver la nota de arriba y AUDITORIA.md.
  sistema:
    "metros IGN — el sistema de alturas exacto (SRVN71 / SRVN16 / municipal) " +
    "no lo declara la capa de origen",
  generado: new Date().toISOString().slice(0, 10),
  // La app usa esto para saber si un punto cae fuera de la cobertura, en vez
  // de inventarle una cota.
  area: [
    r5(Math.min(...lons)),
    r5(Math.min(...lats)),
    r5(Math.max(...lons)),
    r5(Math.max(...lats)),
  ],
  curvas,
};

await mkdir(dirname(SALIDA), { recursive: true });
await writeFile(SALIDA, JSON.stringify(salida));

const bytes = JSON.stringify(salida).length;
console.log("curvas usables : " + curvas.length);
console.log("descartadas    : " + sinCota + " sin cota");
console.log("con Z=0 (rescatadas por el atributo): " + zCero);
console.log(
  "cotas          : " +
    Math.min(...cotas) +
    " a " +
    Math.max(...cotas) +
    " m IGN",
);
console.log("área           : " + salida.area.join(", "));
console.log("tamaño         : " + (bytes / 1024).toFixed(0) + " KB");
console.log("escrito en     : datos-abiertos/curvas.json");
