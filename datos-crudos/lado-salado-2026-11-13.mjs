// datos-crudos/lado-salado-2026-11-13.mjs — de qué lado de la ciudad queda un
// punto: ¿el agua que tiene más cerca es el río Salado, o la laguna Setúbal y
// el río Santa Fe (el sistema del Paraná)?
//
//   node datos-crudos/lado-salado-2026-11-13.mjs
//
// Lee las capas del IGN ya bajadas (aguas continentales, 8/9/2026), recorta al
// área de las curvas con 3 km de margen, simplifica (Douglas-Peucker, 25 m) e
// imprime las tres líneas que van escritas en public/js/app/lado.js. Al final
// prueba el módulo de producción contra direcciones de control.
import "../scripts/app-en-node.js";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ACA = dirname(fileURLToPath(import.meta.url));
const lee = (f) => JSON.parse(readFileSync(join(ACA, f), "utf8"));
const area = lee("../public/datos-abiertos/curvas.json").area; // [O, S, E, N]
const M = 0.03; // ~3 km
const caja = [area[0] - M, area[1] - M, area[2] + M, area[3] + M];
const adentro = ([x, y]) => x >= caja[0] && x <= caja[2] && y >= caja[1] && y <= caja[3];

const K = Math.cos((-31.63 * Math.PI) / 180);
const aM = ([x, y]) => [x * 111320 * K, y * 111320];
function distSeg(p, a, b) {
  const [px, py] = aM(p), [ax, ay] = aM(a), [bx, by] = aM(b);
  const dx = bx - ax, dy = by - ay;
  const t = dx || dy ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy))) : 0;
  return Math.hypot(px - ax - t * dx, py - ay - t * dy);
}
function simplificar(l, tol) {
  if (l.length < 3) return l;
  let max = 0, k = 0;
  for (let i = 1; i < l.length - 1; i++) {
    const d = distSeg(l[i], l[0], l[l.length - 1]);
    if (d > max) (max = d), (k = i);
  }
  if (max <= tol) return [l[0], l[l.length - 1]];
  return [...simplificar(l.slice(0, k + 1), tol).slice(0, -1), ...simplificar(l.slice(k), tol)];
}
// Los tramos de cada línea que caen dentro de la caja, simplificados.
function tramos(lineas) {
  const out = [];
  for (const l of lineas) {
    let t = [];
    for (const p of l) {
      if (adentro(p)) t.push(p);
      else if (t.length) (out.push(t), (t = []));
    }
    if (t.length) out.push(t);
  }
  return out
    .filter((t) => t.length > 1)
    .map((t) => simplificar(t, 25).map(([x, y]) => [+x.toFixed(5), +y.toFixed(5)]));
}

const lin = lee("ign-lineas_de_aguas_continentales_perenne-w-2026-09-08.json").features;
const pol = lee("ign-areas_de_aguas_continentales_perenne-w-2026-09-08.json").features;
const lineasDe = (n) => lin.filter((f) => f.properties.fna === n).flatMap((f) => f.geometry.coordinates);
const salado = tramos(lineasDe("Río Salado"));
const santafe = tramos(lineasDe("Río Santa Fe"));
const setubal = tramos(
  pol.filter((f) => /Setubal/.test(f.properties.fna)).flatMap((f) => f.geometry.coordinates.flat()),
);
const cuenta = (t) => t.length + " tramos, " + t.flat().length + " puntos";
console.log("// Río Salado:", cuenta(salado));
console.log("const SALADO = " + JSON.stringify(salado) + ";");
console.log("// Laguna Setúbal:", cuenta(setubal), "· Río Santa Fe:", cuenta(santafe));
console.log("const PARANA = " + JSON.stringify([...setubal, ...santafe]) + ";");

// Control con el módulo de producción, si ya existe.
try {
  const { ladoDe } = await import("/js/app/lado.js");
  const casos = [
    ["Centenera 4100 (Barranquitas Sur)", -31.62988, -60.71979],
    ["Salta 2500 (centro)", -31.6494, -60.7052],
    ["Javier de la Rosa 500 (Guadalupe)", -31.6065, -60.6787],
    ["Iturraspe y Pte. Perón", -31.62554, -60.71887],
    ["Plaza 25 de Mayo", -31.6585, -60.7107],
    ["Bv. Pellegrini y Av. Freyre", -31.6375, -60.7146],
  ];
  console.log("\ncontrol:");
  for (const [n, la, lo] of casos) console.log(" ", n.padEnd(36), JSON.stringify(ladoDe(la, lo)));
  console.log("\ndónde cambia de lado, por latitud (longitud):");
  for (let la = -31.58; la >= -31.67; la -= 0.01) {
    let corte = null;
    for (let lo = -60.76; lo <= -60.66; lo += 0.0005) if (!ladoDe(la, lo).salado) { corte = lo; break; }
    console.log(" ", la.toFixed(2), corte?.toFixed(4));
  }
} catch (e) {
  console.log("\n(lado.js todavía no existe: " + e.code + ")");
}
