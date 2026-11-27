// node datos-crudos/analisis-lineas-riesgo-2026-11-27.mjs 2026-11-27
//
// ¿Cuánto más alta está el agua en la costa que en el Puerto, según las
// líneas de riesgo de la Provincia?
//
// idesf-lineas-riesgo-<fecha>.json dice, para cada punto con cota, qué líneas
// de inundación pasan al lado y con qué altura del Puerto (h_puerto) se
// calculó cada una. Una línea de inundación es donde el agua toca el terreno:
// la cota del terreno junto a la línea es la cota del agua ahí. Entonces
//
//     desnivel = cota del terreno − (cero del Puerto + h_puerto)
//
// es lo que el agua está más alta en ese lugar que en el Puerto. La app lo
// calcula como PENDIENTE × km (0,045 m/km: 0,72 m en Rincón, 1,08 en Leyes).
//
// Tres cuidados, que son los límites de esta medición:
//   - Las líneas son MODELADAS (INA-CFI, 2005, modelo ISIS FLOW), también las
//     «históricas»: es un modelo contra otro, no agua medida.
//   - Salen de la misma planialtimetría de 2005 que los puntos con cota.
//   - No sabemos qué distingue a las variantes «HIS» y «POT» de una misma
//     crecida: la ficha del catálogo no lo dice. Van por separado.
// Y uno del método: los puntos con cota están sobre calles y rutas. Si la
// línea corre al pie de un terraplén, el punto más cercano es el coronamiento
// y la cota sale más alta que el agua. Por eso se informan la mediana y los
// cuartiles, no la media, y el control: junto al Puerto el desnivel tiene que
// dar cero.
import { readFileSync } from "node:fs";

const HOY = process.argv[2];
if (!HOY) throw new Error("falta la fecha: node … 2026-11-27");
await import(process.cwd() + "/scripts/app-en-node.js");
const { CERO_IGN, PENDIENTE } = await import("/js/app/config.js");
const { ESTACION } = await import("/lib/fuentes.js").catch(() => ({}));

const J = JSON.parse(
  readFileSync(`datos-crudos/idesf-lineas-riesgo-${HOY}.json`, "utf8"),
);
// El hidrómetro del Puerto (public/lib/fuentes.js).
const PUERTO = { lat: -31.6514772196376, lon: -60.7002319185745 };
if (ESTACION && ESTACION.lat && Math.abs(ESTACION.lat - PUERTO.lat) > 1e-6)
  throw new Error("el Puerto de fuentes.js ya no es el de este análisis");
const kmRecto = (p) =>
  Math.hypot(
    (p.lat - PUERTO.lat) * 110.9,
    (p.lon - PUERTO.lon) * 111.32 * Math.cos((p.lat * Math.PI) / 180),
  );

const FRANJAS = [
  ["0–4 km (control: la ciudad)", 0, 4],
  ["4–9 km", 4, 9],
  ["9–13 km (Colastiné)", 9, 13],
  ["13–17 km (Rincón)", 13, 17],
  ["17–21 km", 17, 21],
  ["21 km o más (Arroyo Leyes)", 21, 99],
];
const franjaDe = (km) => FRANJAS.findIndex(([, a, b]) => km >= a && km < b);

const cuantil = (v, q) => v[Math.min(v.length - 1, Math.floor(v.length * q))];
const f = (x) => (x >= 0 ? "+" : "−") + Math.abs(x).toFixed(2).replace(".", ",");

console.log(
  `${J.puntos.length} puntos; píxel «lejos» ${J.pixel_m.lejos} m, «cerca» ${J.pixel_m.cerca} m`,
);
for (const [k, n] of [["lejos"], ["cerca"]].map(([k]) => [
  k,
  J.puntos.filter((p) => p[k].length).length,
]))
  console.log(`  con alguna línea ${k}: ${n}`);
console.log("  por franja (todos / con línea cerca):");
FRANJAS.forEach(([nom], i) => {
  const v = J.puntos.filter((p) => franjaDe(kmRecto(p)) === i);
  console.log(
    `    ${nom.padEnd(30)} ${String(v.length).padStart(5)} / ${v.filter((p) => p.cerca.length).length}`,
  );
});

// Las crecidas del Paraná, de menor a mayor. 1973 y 2003 son del Salado
// (h_ruta_70 alto, Puerto en 4,90 y 5,30): van aparte, al final.
const esSalado = (linea) => /^(73|2003)|SAL/.test(linea);

function tabla(campo) {
  const grupos = new Map();
  for (const p of J.puntos)
    for (const l of p[campo]) {
      if (!(l.h_puerto > 0)) continue; // TEXT-CT: rótulos, no líneas
      const k = l.capa.replace("MACurvas", "") + " " + l.linea;
      if (!grupos.has(k)) grupos.set(k, { ...l, k, pts: [] });
      grupos.get(k).pts.push(p);
    }
  const orden = [...grupos.values()].sort(
    (a, b) =>
      esSalado(a.linea) - esSalado(b.linea) ||
      a.h_puerto - b.h_puerto ||
      a.k.localeCompare(b.k),
  );
  console.log(
    `\n=== líneas ${campo.toUpperCase()} del punto (píxel de ${J.pixel_m[campo]} m) ===`,
  );
  console.log(
    "desnivel = cota del terreno − (" +
      String(CERO_IGN).replace(".", ",") +
      " + h_puerto); mediana [cuartil bajo … cuartil alto], n",
  );
  for (const g of orden) {
    console.log(
      `\n${g.k}  ·  Puerto ${g.h_puerto.toFixed(2).replace(".", ",")} m` +
        (esSalado(g.linea) ? "  (crecida del Salado)" : ""),
    );
    FRANJAS.forEach(([nom], i) => {
      const v = g.pts.filter((p) => franjaDe(kmRecto(p)) === i);
      if (v.length < 5) return;
      const d = v.map((p) => p.z - CERO_IGN - g.h_puerto).sort((a, b) => a - b);
      const km = v.map(kmRecto).sort((a, b) => a - b);
      const kmMed = cuantil(km, 0.5);
      console.log(
        `  ${nom.padEnd(30)} ${f(cuantil(d, 0.5))}  [${f(cuantil(d, 0.25))} … ${f(cuantil(d, 0.75))}]  n=${String(v.length).padStart(3)}` +
          `   recta de la app a ${kmMed.toFixed(0)} km en línea recta: ${f(PENDIENTE * kmMed)}`,
      );
    });
  }
  return orden;
}

tabla("cerca");
tabla("lejos");

console.log(
  "\nLa app no usa km en línea recta sino los de cada zona (zonas.js): " +
    "Colastiné Norte 11, Rincón 16, Arroyo Leyes 24 → " +
    [11, 16, 24].map((k) => f(PENDIENTE * k)).join(", ") +
    " m.",
);
