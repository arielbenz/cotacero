// node datos-crudos/analisis-puntos-fijos-2026-10-22.mjs 2026-10-22
//
// El error de la cota interpolada, medido contra la Red de Puntos Fijos de la
// Municipalidad (publico:puntos_fijos y publico:puntos_fijos_cn, WFS de
// geoservicios.santafeciudad.gov.ar). Es la comparación que la Tarea 1 pedía y
// no tenía: del orden de 300 puntos y en su mayoría al nivel de la calle.
import { readFileSync } from "node:fs";
const HOY = process.argv[2];

/* Se importa el MÓDULO DE LA APP, no una reimplementación: app-en-node.js
   le resuelve las rutas del navegador y le presta un fetch que lee del disco.
   ERROR_DEM también sale de la app, no de una copia. */
await import(process.cwd() + "/scripts/app-en-node.js");
const { elevacionDe } = await import("/js/app/elevacion.js");
const { ERROR_DEM } = await import("/js/app/config.js");

/* Fuera: marcas que no están en el piso. Una chapa en una estación de bombeo,
   un puente o un distribuidor tienen la cota de la estructura, y las curvas
   la del terreno: compararlas mide otra cosa. Son 20 de los 267. */
const ESTRUCTURA =
  /bombeo|puente|distribuidor|chapa|viaducto|tanque|torre|terrapl|defensa|compuerta/i;

const puntos = [];
for (const capa of ["puntos_fijos", "puntos_fijos_cn"]) {
  const j = JSON.parse(
    readFileSync(`datos-crudos/muni-${capa}-${HOY}.json`, "utf8"),
  );
  for (const f of j.features) {
    const p = f.properties;
    if (!f.geometry || !(p.cota > 5)) continue;
    const [lon, lat] = f.geometry.coordinates;
    puntos.push({ capa, n: p.numero, u: String(p.ubicacion), cota: p.cota, lat, lon });
  }
}
const estructuras = puntos.filter((p) => ESTRUCTURA.test(p.u));
console.log("puntos con cota:", puntos.length, "· estructuras afuera:", estructuras.length);

const res = [];
for (const p of puntos) {
  if (ESTRUCTURA.test(p.u)) continue;
  const e = await elevacionDe(p.lat, p.lon);
  // Mide las CURVAS. Desde que la app suma los puntos de la costa, dos marcas
  // de Colastiné Norte fuera del área de las curvas salían de esa otra fuente
  // y entraban en esta cuenta sin que nadie lo decidiera.
  if (!e || e.fuente !== "curvas") continue;
  res.push({ ...p, interp: e.cota, dist: e.distancia, dif: e.cota - p.cota });
}

// dif = interpolada − medida. Negativo: la curva da el terreno MÁS BAJO que lo
// medido, y la app avisa antes (lado pesimista).
function resumen(nombre, r) {
  const v = r.map((x) => x.dif), n = v.length;
  const media = v.reduce((a, b) => a + b, 0) / n;
  const sd = Math.sqrt(v.reduce((a, b) => a + (b - media) ** 2, 0) / (n - 1));
  const abs = v.map(Math.abs).sort((a, b) => a - b);
  const q = (p) => abs[Math.min(n - 1, Math.floor(p * n))];
  console.log(
    `${nombre.padEnd(22)} n=${String(n).padStart(3)}  sesgo ${media.toFixed(2)} ` +
      `(EEM ${(sd / Math.sqrt(n)).toFixed(3)}, desvío ${sd.toFixed(2)})  ` +
      `|dif| mediana ${q(0.5).toFixed(2)} p90 ${q(0.9).toFixed(2)} máx ${abs[n - 1].toFixed(2)}`,
  );
}
console.log();
resumen("todos", res);
resumen("red general", res.filter((x) => x.capa === "puntos_fijos"));
resumen("Colastiné Norte (CN)", res.filter((x) => x.capa === "puntos_fijos_cn"));

const opt = res.filter((x) => x.dif > ERROR_DEM).sort((a, b) => b.dif - a.dif);
console.log(`\noptimistas aun descontando ERROR_DEM (dif > +${ERROR_DEM}): ${opt.length} de ${res.length}`);
for (const x of opt)
  console.log(`  ${String(x.n).padEnd(6)} ${x.u.slice(0, 40).padEnd(40)} medida ${x.cota.toFixed(2)}  curvas ${x.interp.toFixed(2)}  +${x.dif.toFixed(2)}`);

/* El resumen que publica el sitio. /datos, /preguntas y la tarjeta «Se
   comprobó» leen lib/mediciones.json en vez de llevar los números escritos a
   mano: si esta medición se repite, el sitio se actualiza al regenerar. */
{
  const { writeFileSync, existsSync } = await import("node:fs");
  const RUTA = "lib/mediciones.json";
  const previo = existsSync(RUTA) ? JSON.parse(readFileSync(RUTA, "utf8")) : {};
  const abs = res.map((x) => Math.abs(x.dif)).sort((a, b) => a - b);
  const q = (p) => abs[Math.min(abs.length - 1, Math.floor(p * abs.length))];
  const r2 = (v) => Math.round(v * 100) / 100;
  previo.curvas = {
    medido: HOY,
    contra: "puntos fijos de la red municipal, sin las marcas sobre estructuras",
    script: "datos-crudos/analisis-puntos-fijos-" + HOY + ".mjs",
    auditoria: "AUDITORIA.md §4",
    n: res.length,
    mediana_m: r2(q(0.5)),
    p90_m: r2(q(0.9)),
    max_m: r2(abs[abs.length - 1]),
    sesgo_m: r2(res.reduce((a, x) => a + x.dif, 0) / res.length),
    margen_m: ERROR_DEM,
    optimistas: opt.length,
  };
  writeFileSync(RUTA, JSON.stringify(previo, null, 2) + "\n");
  console.log("\nescrito: " + RUTA);
}

/* En qué sistema está la red municipal: se la cruza con la Red de Nivelación
   del IGN donde las dos tienen una marca a menos de 50 m. */
console.log("\nred municipal contra IGN, marcas a menos de 50 m:");
const M = 110900, ml = (lat) => 111320 * Math.cos((lat * Math.PI) / 180);
for (const c of ["nivelacion_alta_precision", "nivelacion_precision"]) {
  const j = JSON.parse(readFileSync(`datos-crudos/ign-${c}-costa-${HOY}.json`, "utf8"));
  for (const f of j.features) {
    const [lon, lat] = f.geometry.coordinates;
    for (const p of puntos) {
      const d = Math.hypot((p.lat - lat) * M, (p.lon - lon) * ml(lat));
      if (d < 50)
        console.log(`  ${f.properties.nomenclatura.padEnd(12)} ${f.properties.cota.toFixed(3)}  ↔  ${String(p.n).padEnd(4)} ${p.u.slice(0, 28).padEnd(28)} ${p.cota.toFixed(3)}  a ${d.toFixed(0)} m  dif ${(p.cota - f.properties.cota).toFixed(3)}`);
    }
  }
}
