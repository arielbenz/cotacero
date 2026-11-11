// node datos-crudos/analisis-mojones-leyes-2026-11-10.mjs 2026-11-10
//
// Diez cotas medidas con estación satelital en Arroyo Leyes (planilla de un
// ingeniero en recursos hídricos, ver leyes-mojones-<fecha>.json) contra lo
// que la app calcula ahí. Dos preguntas:
//   1. ¿Los puntos de la costa (cotas-costa.json, MACotas 2005) y su margen
//      de 1,0 m aguantan contra una medición independiente? Hasta ahora
//      ERROR_PUNTOS salía de estimar cada punto con sus vecinos: consistencia
//      interna, no una medición.
//   2. ¿Cuánto difiere la conversión a hidrómetro de la planilla (cero 8,37,
//      sin pendiente) de la de la app (8,4214 + 0,045 m/km × 24 km)?
//
// Las coordenadas no son del autor: salen de georreferenciar su captura de
// Google Earth, con 30 a 50 m de error. Por eso cada punto se mira también
// en una grilla de ±30 m.
import { readFileSync } from "node:fs";
const HOY = process.argv[2];

await import(process.cwd() + "/scripts/app-en-node.js");
const { elevacionDe } = await import("/js/app/elevacion.js");
const { umbralDe } = await import("/js/app/modelo.js");
const { ZONAS } = await import("/js/app/zonas.js");

const datos = JSON.parse(readFileSync(`datos-crudos/leyes-mojones-${HOY}.json`, "utf8"));
const KM = ZONAS.find((z) => z.id === "leyes").km;
const n2 = (x) => (x == null || !isFinite(x) ? "  —  " : (x >= 0 ? " " : "") + x.toFixed(2).replace(".", ","));

console.log("1. Cota medida contra la que calcula la app\n");
console.log("   punto  medida    app   fuente  a (m)   app−medida   app a ±30 m");
const difs = [];
for (const p of datos.puntos) {
  if (p.lat == null) {
    console.log(`   ${p.id.padEnd(5)} ${n2(p.cota)}   sin ubicación (${p.nota})`);
    continue;
  }
  const r = await elevacionDe(p.lat, p.lon);
  const alrededor = [];
  const cl = Math.cos((p.lat * Math.PI) / 180);
  for (let i = -2; i <= 2; i++)
    for (let j = -2; j <= 2; j++) {
      const q = await elevacionDe(p.lat + (i * 15) / 110574, p.lon + (j * 15) / (111320 * cl));
      if (q) alrededor.push(q.cota);
    }
  const dif = r ? r.cota - p.cota : null;
  if (dif != null) difs.push(dif);
  const rango = alrededor.length ? `${n2(Math.min(...alrededor))} … ${n2(Math.max(...alrededor))}` : "  sin dato";
  console.log(
    `   ${p.id.padEnd(5)} ${n2(p.cota)}  ${n2(r?.cota)}  ${(r?.fuente ?? "—").padEnd(6)} ${String(r ? Math.round(r.distancia) : "—").padStart(5)}   ${n2(dif)}     ${rango}`,
  );
}
const ord = [...difs].sort((a, b) => a - b);
const k = ord.length;
const mediana = k % 2 ? ord[(k - 1) / 2] : (ord[k / 2 - 1] + ord[k / 2]) / 2;
console.log(`\n   n = ${k}   mediana ${n2(mediana)}   media ${n2(difs.reduce((a, b) => a + b, 0) / k)}`);
console.log(`   la app más de 0,5 m ARRIBA de lo medido (avisaría tarde): ${difs.filter((d) => d > 0.5).length}`);
console.log(`   la app más de 1,0 m ARRIBA de lo medido (fuera del margen): ${difs.filter((d) => d > 1.0).length}`);

console.log(`\n2. Nivel del Puerto al que el agua alcanza cada cota medida (Arroyo Leyes, ${KM} km)\n`);
console.log("   punto  cota   planilla   app sin margen   app con margen");
const { cero_hidrometro: CERO_P } = datos.planilla;
for (const p of datos.puntos) {
  const plan = p.cota - CERO_P;
  const crudo = umbralDe({ cota: p.cota, estimada: true, fuente: "puntos", km: KM, crudo: true });
  const pes = umbralDe({ cota: p.cota, estimada: true, fuente: "puntos", km: KM });
  console.log(`   ${p.id.padEnd(5)} ${n2(p.cota)}  ${n2(plan)}      ${n2(crudo)}          ${n2(pes)}`);
}
const ej = datos.puntos[0];
console.log(
  `\n   diferencia planilla − app sin margen: ${n2(ej.cota - CERO_P - umbralDe({ cota: ej.cota, estimada: true, fuente: "puntos", km: KM, crudo: true }))} m en todos los puntos`,
);
