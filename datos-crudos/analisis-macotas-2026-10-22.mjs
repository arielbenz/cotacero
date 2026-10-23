// node datos-crudos/analisis-macotas-2026-10-22.mjs 2026-10-22
//
// ¿Sirven los puntos de MACotas para calcular la altura donde no llegan las
// curvas (Rincón, Arroyo Leyes)? Tres pruebas:
//   1. contra la red de puntos fijos municipal, que está en el sistema del IGN;
//   2. contra curvas.json donde las dos fuentes existen;
//   3. validación cruzada: estimar cada punto con sus cuatro vecinos (IDW),
//      en la ciudad y en la costa, para ver cuánto se equivocaría una casa.
import { readFileSync } from "node:fs";
const HOY = process.argv[2];

// El módulo de la app, con las rutas y el fetch de scripts/app-en-node.js.
await import(process.cwd() + "/scripts/app-en-node.js");
const { elevacionDe } = await import("/js/app/elevacion.js");

// z ≤ 1 son vacíos del origen, no cotas: son 5 de 10.526.
const P = JSON.parse(readFileSync(`datos-crudos/idesf-MACotas-${HOY}.json`, "utf8"))
  .map((p) => ({ lon: p.lon, lat: p.lat, z: +p.z }))
  .filter((p) => p.z > 1);
const dist = (a, b) =>
  Math.hypot((a.lat - b.lat) * 110900, (a.lon - b.lon) * 111320 * Math.cos((a.lat * Math.PI) / 180));
function resumen(nombre, v) {
  const n = v.length, m = v.reduce((a, b) => a + b, 0) / n;
  const sd = Math.sqrt(v.reduce((a, b) => a + (b - m) ** 2, 0) / (n - 1));
  const ab = v.map(Math.abs).sort((a, b) => a - b);
  const opt = (v.filter((x) => x > 0.5).length / n) * 100;
  console.log(
    `  ${nombre.padEnd(34)} n=${String(n).padStart(4)}  media ${m >= 0 ? "+" : ""}${m.toFixed(2)} (EEM ${(sd / Math.sqrt(n)).toFixed(3)})  ` +
      `mediana|e| ${ab[n >> 1].toFixed(2)}  p90 ${ab[Math.floor(n * 0.9)].toFixed(2)}  > +0,5: ${opt.toFixed(1)} %`,
  );
}
console.log("puntos válidos:", P.length);

console.log("\n1. MACotas − punto fijo municipal (el punto de MACotas más cercano, a < 20 m)");
for (const capa of ["puntos_fijos", "puntos_fijos_cn"]) {
  const j = JSON.parse(readFileSync(`datos-crudos/muni-${capa}-${HOY}.json`, "utf8"));
  const v = [];
  for (const f of j.features) {
    if (!f.geometry || !(f.properties.cota > 5)) continue;
    const [lon, lat] = f.geometry.coordinates;
    let best = null;
    for (const p of P) { const d = dist({ lon, lat }, p); if (!best || d < best.d) best = { d, z: p.z }; }
    if (best.d < 20) v.push(best.z - f.properties.cota);
  }
  resumen(capa, v);
}

console.log("\n2. curvas.json − MACotas, donde hay una curva a < 60 m");
const v2 = [];
for (const p of P) { const e = await elevacionDe(p.lat, p.lon); if (e && e.fuente === "curvas" && e.distancia < 60) v2.push(e.cota - p.z); }
resumen("curvas − MACotas", v2);

console.log("\n3. Validación cruzada: cada punto estimado con sus 4 vecinos (IDW), estimado − real");
for (const [nombre, f] of [
  ["ciudad y Colastiné (lon ≤ −60,59)", (p) => p.lon <= -60.59],
  ["Rincón y Arroyo Leyes (lon > −60,59)", (p) => p.lon > -60.59],
]) {
  const zona = P.filter(f), paso = Math.max(1, Math.floor(zona.length / 500)), v = [];
  for (let i = 0; i < zona.length; i += paso) {
    const p = zona[i];
    const w = zona.map((q) => ({ d: dist(p, q), z: q.z })).filter((x) => x.d > 0.5)
      .sort((a, b) => a.d - b.d).slice(0, 4);
    const s = w.reduce((a, x) => a + 1 / x.d ** 2, 0);
    v.push(w.reduce((a, x) => a + x.z / x.d ** 2, 0) / s - p.z);
  }
  resumen(nombre, v);
}
