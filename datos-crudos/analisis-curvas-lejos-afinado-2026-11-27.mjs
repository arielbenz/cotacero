// node datos-crudos/analisis-curvas-lejos-afinado-2026-11-27.mjs
//
// Desde el PR 81, a más de CURVAS_LEJOS_M de una curva la app usa los puntos
// con cota si hay uno cerca. El cruce con las parcelas mostró que eso cambia
// casi sólo lotes de la ciudad alta, donde la altura no mejora y lo único que
// cambia es el margen (0,5 → 1,0 m). La regla que se mide acá:
//
//   lejos de una curva y con un punto cerca, mandan los puntos SÓLO si dan el
//   terreno más bajo que las curvas por más de X; si no, siguen las curvas.
//
// Para cada X, dos cosas:
//   A. contra los puntos con cota de la IDESF, estimando cada uno con sus
//      vecinos sin usarlo a él: cuántos quedan optimistas pasado el margen
//      (más de 0,5 m si contestan las curvas, más de 1,0 si los puntos);
//   B. contra las parcelas del catastro que están lejos de una curva
//      (muni-parcelas-lejos-2026-11-27.json): a cuántos lotes les cambia la
//      fuente, cuántos dejan de verse como «más alto que el récord», y si
//      siguen corregidas las parcelas donde las curvas daban más de 1 m de más.
//
// A favorece a los puntos (la referencia son ellos mismos): sirve para
// comparar valores de X entre sí, no para comparar puntos contra curvas.
import { readFileSync } from "node:fs";

await import(process.cwd() + "/scripts/app-en-node.js");
const { entreCurvas, CURVAS_LEJOS_M, PUNTOS_MAX_M } = await import("/js/app/elevacion.js");
const { CERO_IGN, ERROR_DEM, ERROR_PUNTOS } = await import("/js/app/config.js");
const leer = (f) => JSON.parse(readFileSync("datos-crudos/" + f, "utf8"));
const CURVAS = JSON.parse(readFileSync("public/datos-abiertos/curvas.json", "utf8"));
const RECORD = JSON.parse(readFileSync("public/datos-abiertos/historia.json", "utf8")).record?.altura ?? 7.43;
const [oeste, sur, este, norte] = CURVAS.area;

const anillos = [];
for (const f of leer("muni-vecinales-2026-09-08.json").features)
  for (const p of f.geometry.coordinates) anillos.push(p[0]);
function enAnillo(r, x, y) {
  let d = false;
  for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
    const [xi, yi] = r[i],
      [xj, yj] = r[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) d = !d;
  }
  return d;
}
const enCiudad = (lon, lat) => anillos.some((r) => enAnillo(r, lon, lat));

// Los umbrales a probar. −∞ es lo que hay hoy (los puntos mandan siempre que
// haya uno) y +∞ lo de antes del PR 81 (nunca).
const XS = [-Infinity, 0, 0.25, 0.5, 0.75, 1, Infinity];
const nombre = (x) =>
  x === -Infinity ? "hoy: siempre los puntos" : x === Infinity ? "antes: siempre las curvas" : `puntos si dan ${String(x).replace(".", ",")} m menos`;
const eligePuntos = (cv, pt, x) => pt != null && cv - pt > x;

// ---------- A. contra los puntos con cota ----------
const T = leer("idesf-MACotas-2026-10-22.json")
  .map((p) => ({ lon: p.lon, lat: p.lat, z: +p.z }))
  .filter((p) => p.z > 1);
// La cuenta de conPuntos(), dejando afuera el propio punto.
function vecinos(p) {
  const ml = 111320 * Math.cos((p.lat * Math.PI) / 180);
  const c = [];
  for (const q of T) {
    if (q === p) continue;
    const d = Math.hypot((q.lon - p.lon) * ml, (q.lat - p.lat) * 110900);
    if (d <= PUNTOS_MAX_M) c.push([d, q.z]);
  }
  if (!c.length) return null;
  c.sort((a, b) => a[0] - b[0]);
  const k = c.slice(0, 4);
  if (k[0][0] < 0.5) return k[0][1];
  let a = 0,
    b = 0;
  for (const [d, z] of k) {
    a += z / d ** 2;
    b += 1 / d ** 2;
  }
  return a / b;
}
const A = T.filter((p) => p.lon >= oeste && p.lon <= este && p.lat >= sur && p.lat <= norte).map((p) => {
  const cv = entreCurvas(CURVAS, p.lat, p.lon);
  return { z: p.z, cv: cv.cota, d: cv.distancia, pt: cv.distancia > CURVAS_LEJOS_M ? vecinos(p) : null, ciu: enCiudad(p.lon, p.lat) };
});
const optimista = (r, x) =>
  r.d > CURVAS_LEJOS_M && eligePuntos(r.cv, r.pt, x) ? r.pt - r.z > ERROR_PUNTOS : r.cv - r.z > ERROR_DEM;
const GRUPOS = [
  ["todos", () => true],
  ["en vecinales", (r) => r.ciu],
  ["fuera", (r) => !r.ciu],
  ["terreno < 13 m", (r) => r.z < 13],
  ["lejos de curva", (r) => r.d > CURVAS_LEJOS_M],
];
console.log("A. Puntos con cota que quedan optimistas pasado el margen");
console.log("   " + "regla".padEnd(30) + GRUPOS.map(([n, f]) => `${n} (${A.filter(f).length})`.padStart(22)).join(""));
for (const x of XS)
  console.log(
    "   " +
      nombre(x).padEnd(30) +
      GRUPOS.map(([, f]) => {
        const v = A.filter(f);
        const n = v.filter((r) => optimista(r, x)).length;
        return `${n} · ${((n / v.length) * 100).toFixed(1)} %`.padStart(22);
      }).join(""),
  );

// ---------- B. contra las parcelas ----------
const P = leer("muni-parcelas-lejos-2026-11-27.json");
const L = P.lejos;
const lote = (p) => p.m2 <= 2000;
// El nivel de aviso sin la caída del río (0 km): alcanza para comparar reglas.
const aviso = (p, x) => (eligePuntos(p.curvas, p.puntos, x) ? p.puntos - ERROR_PUNTOS : p.curvas - ERROR_DEM) - CERO_IGN;
const antes = (p) => p.curvas - ERROR_DEM - CERO_IGN;
const malas = L.filter((p) => p.puntos != null && p.curvas - p.puntos > 1);
console.log(`\nB. Parcelas a más de ${CURVAS_LEJOS_M} m de una curva: ${L.length} de ${P.enElAreaDeLasCurvas} (${L.filter(lote).length} lotes de hasta 2.000 m²)`);
console.log(`   con un punto a menos de ${PUNTOS_MAX_M} m: ${L.filter((p) => p.puntos != null).length} · donde las curvas dan más de 1 m de más que los puntos: ${malas.length} (${malas.filter(lote).length} lotes)`);
console.log(
  "   " +
    "regla".padEnd(30) +
    ["pasan a los puntos", "de ésos, lotes", "lotes: aviso baja >0,3", "lotes que pierden «récord»", "corregidas de las " + malas.length].map((t) => t.padStart(28)).join(""),
);
for (const x of XS) {
  const cambian = L.filter((p) => eligePuntos(p.curvas, p.puntos, x));
  const lotes = cambian.filter(lote);
  console.log(
    "   " +
      nombre(x).padEnd(30) +
      [
        cambian.length,
        lotes.length,
        lotes.filter((p) => aviso(p, x) - antes(p) < -0.3).length,
        lotes.filter((p) => antes(p) >= RECORD && aviso(p, x) < RECORD).length,
        malas.filter((p) => eligePuntos(p.curvas, p.puntos, x)).length,
      ]
        .map((n) => String(n).padStart(28))
        .join(""),
  );
}
// Con la regla elegida (el margen de las curvas): qué lotes pasan a los puntos.
const X = ERROR_DEM;
const g = new Map();
for (const p of L.filter((p) => eligePuntos(p.curvas, p.puntos, X))) {
  const k = p.vecinal || "(fuera de las vecinales)";
  if (!g.has(k)) g.set(k, []);
  g.get(k).push(p);
}
console.log(`\n   Con X = ${String(X).replace(".", ",")} (el margen de las curvas), las parcelas que pasan a los puntos:`);
const med = (v) => [...v].sort((a, b) => a - b)[v.length >> 1];
for (const [k, v] of [...g.entries()].sort((a, b) => b[1].length - a[1].length))
  console.log(
    `     ${k.slice(0, 44).padEnd(44)} ${String(v.length).padStart(4)} (${v.filter(lote).length} lotes) · curvas ${med(v.map((p) => p.curvas)).toFixed(2)} → puntos ${med(v.map((p) => p.puntos)).toFixed(2)}`,
  );
