/* La pendiente entre estaciones del INA, en cm/km, y la regla del Leyes.
   Uso: node datos-crudos/analisis-pendiente-cauce-2026-11-23.mjs

   Dos cosas, ninguna de las cuales sale de 1992:

   1. Santa Fe → Paraná y Santa Fe → Hernandarias sobre el cauce principal.
      Los desniveles son los de analisis-pendiente-2026-09-08.mjs; lo nuevo
      son los km de la vía navegable, que publica Vías Navegables en sus
      boletines de profundidades: Santa Fe km 584, Paraná km 601,
      Hernandarias km 689 (p. ej. argentina.gob.ar/sites/default/files/
      2018/05/2024-07-22_med.pdf). Paraná está AGUAS ARRIBA del empalme de
      Santa Fe: el agua más alta allá no es una anomalía.

   2. La regla del arroyo Leyes en la Ruta 1 (INA serie 6232, SSRH 3225),
      que el INA publica sin cero. La resta Leyes − Puerto no depende de
      ningún cero: si cambia con la altura del río, cambia la pendiente. */

import { readFileSync } from "node:fs";

const SERIES = "2026-09-08"; // las de la red PARANAINF, de la Tarea 3
const LEYES = "2026-11-23";

const leer = (archivo) => {
  const j = JSON.parse(readFileSync(`datos-crudos/${archivo}`, "utf8"));
  const a = Array.isArray(j) ? j : j.rows || [];
  const m = new Map();
  for (const o of a)
    if (typeof o.valor === "number") m.set(o.timestart.slice(0, 10), o.valor);
  return m;
};

const SF = leer(`ina-serie-30-1990-2026-${SERIES}.json`);
const OTRAS = [
  { nom: "Hernandarias", km: 689, cero: 13.46, s: leer(`ina-serie-28-1990-2026-${SERIES}.json`) },
  { nom: "Paraná", km: 601, cero: 9.432, s: leer(`ina-serie-29-1990-2026-${SERIES}.json`) },
];
const KM_SF = 584;
// El del INA y el de la app (AUDITORIA.md §1): la diferencia es de 4 cm.
const CEROS_SF = [8.378, 8.4214];

const CORTES = [[0, 3], [3, 5], [5, 5.7], [5.7, 10], [6.2, 10]];
const pct = (v, p) => v[Math.min(v.length - 1, Math.floor(v.length * p))];
const f = (x, d = 2) => x.toFixed(d).replace(".", ",");

console.log("\n=== 1. Pendiente sobre el cauce principal, cm/km ===");
for (const o of OTRAS) {
  const dk = o.km - KM_SF;
  for (const ceroSF of CEROS_SF) {
    console.log(`\n  Santa Fe → ${o.nom} (${dk} km), cero de Santa Fe ${f(ceroSF, 4)}`);
    console.log("  Puerto        n     mediana   p10    p90");
    for (const [a, b] of CORTES) {
      const v = [];
      for (const [d, x] of SF) {
        const y = o.s.get(d);
        if (y == null || x < a || x >= b) continue;
        v.push(((y + o.cero - (x + ceroSF)) / dk) * 100);
      }
      v.sort((p, q) => p - q);
      if (v.length < 30) { console.log(`  ${a}–${b} m   (pocos datos: ${v.length})`); continue; }
      console.log(`  ${(a + "–" + b + " m").padEnd(10)} ${String(v.length).padStart(5)}   ${f(pct(v, 0.5)).padStart(6)}  ${f(pct(v, 0.1)).padStart(5)}  ${f(pct(v, 0.9)).padStart(5)}`);
    }
  }
}

console.log("\n=== 2. Regla del Leyes (Ruta 1) menos regla del Puerto, m ===");
const L = leer(`ina-serie-6232-2001-2026-${LEYES}.json`);
console.log(`  ${L.size} días con lectura en el Leyes`);
console.log("  Puerto        n     mediana   p10    p90");
for (const [a, b] of [[0, 2], [2, 3], [3, 4], [4, 5], [5, 5.7], [5.7, 10]]) {
  const v = [];
  for (const [d, x] of SF) {
    const y = L.get(d);
    if (y == null || x < a || x >= b) continue;
    v.push(y - x);
  }
  v.sort((p, q) => p - q);
  if (!v.length) continue;
  console.log(`  ${(a + "–" + b + " m").padEnd(10)} ${String(v.length).padStart(5)}   ${f(pct(v, 0.5)).padStart(6)}  ${f(pct(v, 0.1)).padStart(5)}  ${f(pct(v, 0.9)).padStart(5)}`);
}

console.log("\n  Picos:");
for (const d of ["1992-06-22", "2016-01-04", "2016-01-05"])
  console.log(`  ${d}  Puerto ${SF.get(d) ?? "—"}  Leyes ${L.get(d) ?? "—"}  Paraná ${OTRAS[1].s.get(d) ?? "—"}  Hernandarias ${OTRAS[0].s.get(d) ?? "—"}`);
