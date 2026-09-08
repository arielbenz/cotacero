/* Tarea 2 — distancia SOBRE EL CAUCE desde el hidrómetro hasta cada zona.
   Red hidrográfica: ign:lineas_de_aguas_continentales_perenne (WFS del IGN).
   Método: se arma un grafo con todos los vértices de las líneas, se unen los
   que están a menos de TOL metros (las líneas del IGN no siempre comparten
   vértice exacto en las confluencias) y se corre Dijkstra. Eso resuelve solo
   el problema de los brazos: toma el camino de agua más corto, sin que nadie
   elija a mano por cuál ir. */
import { readFileSync } from "node:fs";
const HOY = process.argv[2];
const TOL = 60; // m para unir extremos de líneas distintas

const red = JSON.parse(readFileSync(`datos-crudos/ign-lineas_de_aguas_continentales_perenne-${HOY}.json`, "utf8"));
const M_LAT = 110900, mLon = (l) => 111320 * Math.cos((l * Math.PI) / 180);
const xy = ([lon, lat]) => [lon * mLon(lat), lat * M_LAT];
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);

// --- nodos y aristas
const nodos = [], idx = new Map();
const key = (p) => Math.round(p[0] / TOL) + "|" + Math.round(p[1] / TOL);
function nodo(p) {
  const k = key(p);
  if (idx.has(k)) return idx.get(k);
  const i = nodos.length; nodos.push(p); idx.set(k, i); return i;
}
const ady = new Map();
const arista = (a, b, d) => {
  if (a === b) return;
  if (!ady.has(a)) ady.set(a, []); if (!ady.has(b)) ady.set(b, []);
  ady.get(a).push([b, d]); ady.get(b).push([a, d]);
};
let segmentos = 0;
for (const f of red.features) {
  const partes = f.geometry.type === "MultiLineString" ? f.geometry.coordinates : [f.geometry.coordinates];
  for (const linea of partes) {
    let prev = null;
    for (const c of linea) {
      const p = xy(c), n = nodo(p);
      if (prev !== null) { arista(prev, n, dist(nodos[prev], p)); segmentos++; }
      prev = n;
    }
  }
}
console.log("  red: " + red.features.length + " líneas · " + nodos.length + " nodos · " + segmentos + " segmentos");

// --- unir extremos cercanos que quedaron sueltos (confluencias sin vértice común)
let cosidos = 0;
for (let i = 0; i < nodos.length; i++)
  for (let j = i + 1; j < nodos.length; j++) {
    const d = dist(nodos[i], nodos[j]);
    if (d > 0 && d <= TOL) { arista(i, j, d); cosidos++; }
  }
console.log("  confluencias cosidas a menos de " + TOL + " m: " + cosidos);

const cercano = (lat, lon) => {
  const p = xy([lon, lat]);
  let mi = -1, md = Infinity;
  for (let i = 0; i < nodos.length; i++) { const d = dist(nodos[i], p); if (d < md) { md = d; mi = i; } }
  return [mi, md];
};

function dijkstra(src) {
  const D = new Float64Array(nodos.length).fill(Infinity); D[src] = 0;
  const visto = new Uint8Array(nodos.length);
  const cola = [[0, src]];
  while (cola.length) {
    cola.sort((a, b) => a[0] - b[0]);
    const [d, u] = cola.shift();
    if (visto[u]) continue; visto[u] = 1;
    for (const [v, w] of ady.get(u) || []) if (d + w < D[v]) { D[v] = d + w; cola.push([D[v], v]); }
  }
  return D;
}

// --- el hidrómetro: coordenadas de la estación del INA (lib/fuentes.js)
const HID = { lat: -31.6514772196376, lon: -60.7002319185745 };
const [src, dSrc] = cercano(HID.lat, HID.lon);
console.log("  hidrómetro: nodo a " + Math.round(dSrc) + " m de la traza\n");
const D = dijkstra(src);

const ZONAS = [
  ["centro",    "Santa Fe — centro / puerto",  0, HID.lat, HID.lon,           "el hidrómetro mismo (km 0 por definición)"],
  ["altoverde", "Alto Verde",                  2, -31.66521436, -60.70076676, "Vecinal Pro Mejoras Alto Verde (municipal)"],
  ["guadalupe", "Guadalupe / Costanera Este",  4, -31.60310257, -60.68367933, "Vecinal Guadalupe Oeste (municipal)"],
  ["laguardia", "La Guardia",                  7, -31.64234205, -60.63433982, "Capilla Ntra. Sra. de la Guardia (municipal)"],
  ["colnorte",  "Colastiné Norte",            11, -31.62364809, -60.60814703, "Estación Colastiné Norte (municipal)"],
  ["rincon",    "San José del Rincón",        16, -31.60651,    -60.56744,    "BAHRA / IGN"],
  ["leyes",     "Arroyo Leyes",               24, -31.55873,    -60.51751,    "BAHRA / IGN"],
  ["calchines", "Santa Rosa de Calchines",    40, -31.42039,    -60.33268,    "BAHRA / IGN"],
];

console.log("  zona                        app   medido   dif    impacto   punto usado");
const filas = [];
for (const [id, n, km, lat, lon, fuente] of ZONAS) {
  const [nd, dn] = cercano(lat, lon);
  const m = D[nd];
  const kmM = isFinite(m) ? m / 1000 : null;
  const dif = kmM === null ? null : kmM - km;
  const cm = dif === null ? null : dif * 0.045 * 100;
  filas.push({ id, n, km, kmM, dif, cm, dn, fuente });
  console.log("  " + n.padEnd(28) +
    String(km).padStart(3) + "  " +
    (kmM === null ? "  s/red" : kmM.toFixed(1).padStart(6)) + "  " +
    (dif === null ? "     " : (dif > 0 ? "+" : "") + dif.toFixed(1)).padStart(6) + "  " +
    (cm === null ? "      " : (cm > 0 ? "+" : "") + cm.toFixed(0) + " cm").padStart(8) + "   " +
    fuente + "  [a " + Math.round(dn) + " m del cauce]");
}
console.log("\n  VALIDACIÓN — Arroyo Leyes tiene que dar cerca de 24 km:");
const l = filas.find((f) => f.id === "leyes");
console.log("   medido " + (l.kmM === null ? "sin red" : l.kmM.toFixed(1) + " km") + " contra 24 publicados → " +
  (l.kmM !== null && Math.abs(l.kmM - 24) <= 3 ? "PASA" : "NO PASA, el método hay que revisarlo"));
