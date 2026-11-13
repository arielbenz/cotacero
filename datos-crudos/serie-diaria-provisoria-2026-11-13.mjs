// datos-crudos/serie-diaria-provisoria-2026-11-13.mjs
//
//   node datos-crudos/serie-diaria-provisoria-2026-11-13.mjs
//
// Escribe public/datos-abiertos/serie-diaria.json SIN ir al INA, para poder
// mirar /comparar en una máquina sin red. Es PROVISORIA: arranca en 1990
// porque usa ina-serie-30-1990-2026-2026-09-08.json, y le falta del 8/9 al
// 13/10 de 2026. La de verdad, desde 1925, la escribe `node scripts/historia.js`
// con la misma función (scripts/serie-diaria.js): corré eso antes de publicar.
//
// El criterio del día es el de scripts/historia.js: hora argentina y el
// máximo del día. Los últimos 30 días son la `serie` de /api/nivel leída el
// 13/11/2026.

import { readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { armarSerieDiaria } from "../scripts/serie-diaria.js";

const ACA = dirname(fileURLToPath(import.meta.url));
const SALIDA = join(ACA, "..", "public", "datos-abiertos", "serie-diaria.json");

const API_13_11 = [
  ["2026-10-14", 3.57], ["2026-10-15", 3.62], ["2026-10-16", 3.65], ["2026-10-17", 3.68],
  ["2026-10-18", 3.7], ["2026-10-19", 3.74], ["2026-10-20", 3.79], ["2026-10-21", 3.85],
  ["2026-10-22", 3.88], ["2026-10-23", 3.92], ["2026-10-24", 4], ["2026-10-25", 4.07],
  ["2026-10-26", 4.1], ["2026-10-27", 4.16], ["2026-10-28", 4.23], ["2026-10-29", 4.25],
  ["2026-10-30", 4.3], ["2026-10-31", 4.32], ["2026-11-01", 4.38], ["2026-11-02", 4.42],
  ["2026-11-03", 4.45], ["2026-11-04", 4.5], ["2026-11-05", 4.58], ["2026-11-06", 4.61],
  ["2026-11-07", 4.68], ["2026-11-08", 4.76], ["2026-11-09", 4.87], ["2026-11-10", 5.02],
  ["2026-11-11", 5.18], ["2026-11-12", 5.39], ["2026-11-13", 5.54],
];

const ARG_MS = 3 * 60 * 60 * 1000;
const diaLocal = (t) => new Date(new Date(t).getTime() - ARG_MS).toISOString().slice(0, 10);

const obs = JSON.parse(
  await readFile(join(ACA, "ina-serie-30-1990-2026-2026-09-08.json"), "utf8"),
);
const porDia = new Map();
for (const o of obs) {
  if (typeof o.valor !== "number" || !isFinite(o.valor)) continue;
  const d = diaLocal(o.timestart);
  if (!porDia.has(d) || o.valor > porDia.get(d)) porDia.set(d, o.valor);
}
for (const [d, v] of API_13_11) if (!porDia.has(d) || v > porDia.get(d)) porDia.set(d, v);

const diaria = armarSerieDiaria(porDia, {
  fuente:
    "Instituto Nacional del Agua — SIyAH, serie 30 (altura hidrométrica, medición directa), Hidrómetro del Puerto de Santa Fe",
  url: "https://alerta.ina.gob.ar/a5/obs/puntual/series/30/observaciones?timestart=1900-01-01&timeend=2100-01-01",
  generado: "2026-11-13",
  provisoria:
    "Armada sin red desde datos-crudos: arranca en 1990 y le faltan días de 2026. Regenerar con node scripts/historia.js.",
});
await writeFile(SALIDA, JSON.stringify(diaria));
console.log("rango  :", diaria.desde, "→", diaria.hasta, "|", diaria.dias, "días");
console.log("tamaño :", (JSON.stringify(diaria).length / 1024).toFixed(0), "KB");
