import { readFileSync } from "node:fs";
const HOY = process.argv[2];

/* Se importa el MÓDULO DE LA APP, no una reimplementación. Sólo se le presta
   un fetch que lee el archivo del disco en vez de la red. */
const curvasJson = readFileSync("datos-abiertos/curvas.json", "utf8");
globalThis.fetch = async (u) =>
  String(u).includes("curvas.json")
    ? { ok: true, json: async () => JSON.parse(curvasJson) }
    : { ok: false };
const { elevacionDe } = await import(process.cwd() + "/js/app/elevacion.js");

const capas = ["nivelacion_alta_precision", "nivelacion_precision"];
const puntos = [];
for (const c of capas) {
  const j = JSON.parse(readFileSync(`datos-crudos/ign-${c}-${HOY}.json`, "utf8"));
  for (const f of j.features) {
    const [lon, lat] = f.geometry.coordinates;
    puntos.push({ capa: c, ...f.properties, lat, lon });
  }
}
console.log("  puntos descargados dentro del bbox de curvas:", puntos.length);
console.log("  tipos de marca:", [...new Set(puntos.map(p => p.marca))].join(" · "));
console.log("  redes:", [...new Set(puntos.map(p => p.red))].join(" · "));

const res = [];
for (const p of puntos) {
  const e = await elevacionDe(p.lat, p.lon);
  if (e == null) { p.fuera = true; continue; }
  p.interp = e.cota; p.dist = e.distancia;
  p.residuo = e.cota - p.cota;
  res.push(p);
}
const fuera = puntos.length - res.length;
console.log("  con cota interpolable:", res.length, "· sin cobertura útil:", fuera);

const v = res.map(p => p.residuo).sort((a,b)=>a-b);
const n = v.length;
const media = v.reduce((a,b)=>a+b,0)/n;
const sd = Math.sqrt(v.reduce((a,b)=>a+(b-media)**2,0)/(n-1));
const eem = sd/Math.sqrt(n);
const mediana = n%2 ? v[(n-1)/2] : (v[n/2-1]+v[n/2])/2;
// t de Student, 95%, dos colas
const T = {10:2.228,11:2.201,12:2.179,13:2.160,14:2.145,15:2.131,16:2.120,17:2.110,18:2.101,19:2.093,20:2.086};
const t = T[n-1] || 2.13;
const f = x => (Math.round(x*1000)/1000).toFixed(3);
console.log("\n  ===== RESIDUO  (cota interpolada − cota IGN) =====");
console.log("  n                            " + n);
console.log("  media                        " + f(media) + " m");
console.log("  IC 95% de la media           [" + f(media - t*eem) + " , " + f(media + t*eem) + "] m");
console.log("  error estándar de la media   " + f(eem) + " m");
console.log("  mediana                      " + f(mediana) + " m");
console.log("  desvío estándar              " + f(sd) + " m");
console.log("  mínimo / máximo              " + f(v[0]) + " / " + f(v[n-1]) + " m");
console.log("\n  histograma (bins de 0,5 m)");
const lo = Math.floor(v[0]*2)/2, hi = Math.ceil(v[n-1]*2)/2;
for (let b = lo; b < hi; b += 0.5) {
  const c = v.filter(x => x >= b && x < b + 0.5).length;
  if (c || (b > lo && b < hi)) console.log("   " + String(f(b)).padStart(7) + " a " + String(f(b+0.5)).padStart(7) + "  " + "█".repeat(c) + (c?" "+c:""));
}
console.log("\n  detalle");
for (const p of res.sort((a,b)=>a.residuo-b.residuo))
  console.log("   " + String(f(p.residuo)).padStart(7) + " m  IGN " + String(p.cota).padStart(6) + "  interp " + f(p.interp).padStart(6) + "  " + p.nomenclatura + "  " + p.marca);
