/* Tarea 2 (segundo intento) — distancia SOBRE EL AGUA desde el hidrómetro.
   El primer intento falló porque usaba sólo las líneas: cerca de Santa Fe el
   Paraná está mapeado como POLÍGONO, así que la red de líneas tenía un hueco
   justo en el tramo que importa. Acá entran las tres capas de líneas y los
   BORDES de los polígonos de agua. Un camino por la orilla es un camino sobre
   el agua y sigue la forma del cauce; el control contra Arroyo Leyes dice si
   la aproximación sirve. */
import { readFileSync } from "node:fs";
const HOY = process.argv[2];
const TOL = 80;

const M_LAT = 110900, mLon = (l) => 111320 * Math.cos((l * Math.PI) / 180);
const xy = ([lon, lat]) => [lon * mLon(lat), lat * M_LAT];
const dd = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);

const nodos = [], celda = new Map();
const ck = (p) => (p[0] / TOL | 0) + "|" + (p[1] / TOL | 0);
function nodo(p) {
  for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) {
    const l = celda.get(((p[0] / TOL | 0) + i) + "|" + ((p[1] / TOL | 0) + j));
    if (l) for (const n of l) if (dd(nodos[n], p) <= TOL) return n;
  }
  const n = nodos.length; nodos.push(p);
  const k = ck(p); if (!celda.has(k)) celda.set(k, []); celda.get(k).push(n);
  return n;
}
const ady = new Map();
const arista = (a, b, d) => { if (a === b) return;
  if (!ady.has(a)) ady.set(a, []); if (!ady.has(b)) ady.set(b, []);
  ady.get(a).push([b, d]); ady.get(b).push([a, d]); };

let lineas = 0, segs = 0;
const traer = (archivo, anillos) => {
  let j; try { j = JSON.parse(readFileSync(archivo, "utf8")); } catch { return; }
  for (const f of j.features) {
    const g = f.geometry; if (!g) continue;
    let tramos = [];
    if (g.type === "LineString") tramos = [g.coordinates];
    else if (g.type === "MultiLineString") tramos = g.coordinates;
    else if (anillos && g.type === "Polygon") tramos = g.coordinates;
    else if (anillos && g.type === "MultiPolygon") tramos = g.coordinates.flat();
    for (const t of tramos) {
      lineas++;
      let prev = null;
      for (const c of t) { const p = xy(c), n = nodo(p);
        if (prev !== null && prev !== n) { arista(prev, n, dd(nodos[prev], p)); segs++; }
        prev = n; }
    }
  }
};
for (const c of ["lineas_de_aguas_continentales_perenne","lineas_de_aguas_continentales_intermitentes","lineas_de_aguas_continentales_BH020"])
  traer(`datos-crudos/ign-${c}-w-${HOY}.json`, false);
traer(`datos-crudos/ign-areas_de_aguas_continentales_perenne-w-${HOY}.json`, true);
console.log("  red: " + lineas + " tramos · " + nodos.length + " nodos · " + segs + " aristas (tolerancia " + TOL + " m)");

const cercano = (lat, lon) => { const p = xy([lon, lat]);
  let mi = -1, md = Infinity;
  for (let i = 0; i < nodos.length; i++) { const d = dd(nodos[i], p); if (d < md) { md = d; mi = i; } }
  return [mi, md]; };

function dijkstra(src) {
  const D = new Float64Array(nodos.length).fill(Infinity); D[src] = 0;
  const h = [[0, src]];
  const push = (x) => { h.push(x); let i = h.length - 1;
    while (i > 0) { const p = (i - 1) >> 1; if (h[p][0] <= h[i][0]) break; [h[p], h[i]] = [h[i], h[p]]; i = p; } };
  const pop = () => { const t = h[0], u = h.pop();
    if (h.length) { h[0] = u; let i = 0;
      for (;;) { const l = 2*i+1, r = l+1; let m = i;
        if (l < h.length && h[l][0] < h[m][0]) m = l;
        if (r < h.length && h[r][0] < h[m][0]) m = r;
        if (m === i) break; [h[m], h[i]] = [h[i], h[m]]; i = m; } }
    return t; };
  const visto = new Uint8Array(nodos.length);
  while (h.length) { const [d, u] = pop(); if (visto[u]) continue; visto[u] = 1;
    for (const [v, w] of ady.get(u) || []) if (d + w < D[v]) { D[v] = d + w; push([D[v], v]); } }
  return D;
}

const HID = { lat: -31.6514772196376, lon: -60.7002319185745 };
const [src, dSrc] = cercano(HID.lat, HID.lon);
console.log("  hidrómetro a " + Math.round(dSrc) + " m del agua más cercana\n");
const D = dijkstra(src);

const ZONAS = [
  ["centro","Santa Fe — centro / puerto",0,HID.lat,HID.lon,"el hidrómetro (km 0)"],
  ["altoverde","Alto Verde",2,-31.66521436,-60.70076676,"Vecinal Alto Verde (municipal)"],
  ["guadalupe","Guadalupe / Costanera Este",4,-31.60310257,-60.68367933,"Vecinal Guadalupe Oeste (municipal)"],
  ["laguardia","La Guardia",7,-31.64234205,-60.63433982,"Capilla de la Guardia (municipal)"],
  ["colnorte","Colastiné Norte",11,-31.62364809,-60.60814703,"Estación Colastiné Norte (municipal)"],
  ["rincon","San José del Rincón",16,-31.60651,-60.56744,"BAHRA / IGN"],
  ["leyes","Arroyo Leyes",24,-31.55873,-60.51751,"BAHRA / IGN"],
  ["calchines","Santa Rosa de Calchines",40,-31.42039,-60.33268,"BAHRA / IGN"],
];
console.log("  zona                          app  medido    dif   impacto  al agua");
const filas = [];
for (const [id,n,km,lat,lon,fuente] of ZONAS) {
  const [nd,dn] = cercano(lat,lon); const m = D[nd];
  const kmM = isFinite(m) ? m/1000 : null;
  const dif = kmM===null?null:kmM-km, cm = dif===null?null:dif*0.045*100;
  filas.push({id,n,km,kmM,dif,cm,dn,fuente});
  console.log("  " + n.padEnd(30) + String(km).padStart(3) + "  " +
    (kmM===null?" s/red":kmM.toFixed(1).padStart(6)) + "  " +
    (dif===null?"     ":((dif>0?"+":"")+dif.toFixed(1))).padStart(6) + "  " +
    (cm===null?"     ":((cm>0?"+":"")+cm.toFixed(0)+" cm")).padStart(8) + "  " +
    (Math.round(dn)+" m").padStart(7) + "  " + fuente);
}
const l = filas.find(f=>f.id==="leyes");
console.log("\n  VALIDACIÓN — Arroyo Leyes, 24 km publicados:");
console.log("   medido " + (l.kmM===null?"sin red":l.kmM.toFixed(1)+" km") +
  " → " + (l.kmM!==null && Math.abs(l.kmM-24)<=3 ? "PASA (dentro de ±3 km)" : "NO PASA"));
