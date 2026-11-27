// node datos-crudos/analisis-distancia-curvas-2026-11-27.mjs
//
// entreCurvas() (public/js/app/elevacion.js) no tiene tope de distancia: da
// una altura esté la curva a 20 m o a 3 km. ¿Cuánto se equivoca lejos de una
// curva, y alcanza un tope para arreglarlo?
//
// Contra dos referencias, con el módulo de producción importado:
//   - los 10.526 puntos con cota de la IDESF (idesf-MACotas-2026-10-22.json),
//     del mismo relevamiento de 2005 que las curvas;
//   - la Red de Puntos Fijos municipal (muni-puntos_fijos*-2026-10-22.json),
//     medida.
// «En la ciudad» es dentro de alguna de las 86 vecinales
// (muni-vecinales-2026-09-08.json): es lo más parecido que tenemos al área
// habitada del municipio.
import { readFileSync } from "node:fs";

await import(process.cwd() + "/scripts/app-en-node.js");
const { entreCurvas } = await import("/js/app/elevacion.js");
const leer = (f) => JSON.parse(readFileSync("datos-crudos/" + f, "utf8"));
const CURVAS = JSON.parse(readFileSync("public/datos-abiertos/curvas.json", "utf8"));
/* Las curvas solas, que es lo que se mide. Desde el 27/11/2026 elevacionDe()
   les pregunta a los puntos cuando la curva queda lejos —por lo que salió de
   acá—, así que ya no sirve para esto. */
const dentro = (lat, lon) =>
  lon >= CURVAS.area[0] && lon <= CURVAS.area[2] && lat >= CURVAS.area[1] && lat <= CURVAS.area[3];
const elevacionDe = async (lat, lon) =>
  dentro(lat, lon) ? { ...entreCurvas(CURVAS, lat, lon), fuente: "curvas" } : null;

const anillos = [];
for (const f of leer("muni-vecinales-2026-09-08.json").features)
  for (const p of f.geometry.coordinates)
    anillos.push({ nom: f.properties.vecinal, r: p[0] });
function enAnillo(r, x, y) {
  let d = false;
  for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
    const [xi, yi] = r[i],
      [xj, yj] = r[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) d = !d;
  }
  return d;
}
const vecinal = (lon, lat) => {
  for (const a of anillos) if (enAnillo(a.r, lon, lat)) return a.nom;
  return null;
};

const pct = (v, f) => ((v.filter(f).length / v.length) * 100).toFixed(1).padStart(5) + " %";
function renglon(nombre, v) {
  if (!v.length) return;
  const ab = v.map(Math.abs).sort((a, b) => a - b);
  const o = [...v].sort((a, b) => a - b);
  console.log(
    `  ${nombre.padEnd(44)} n=${String(v.length).padStart(5)}  mediana ${o[v.length >> 1].toFixed(2).padStart(6)}  ` +
      `mediana|e| ${ab[v.length >> 1].toFixed(2)}  p90 ${ab[Math.floor(v.length * 0.9)].toFixed(2)}  ` +
      `> +0,5: ${pct(v, (x) => x > 0.5)}  > +1: ${pct(v, (x) => x > 1)}`,
  );
}

// e = curvas − referencia: positivo es la curva más alta que el terreno, el
// lado que hace avisar tarde.
const M = [];
for (const p of leer("idesf-MACotas-2026-10-22.json")) {
  const z = +p.z;
  if (!(z > 1)) continue; // vacíos del origen
  const r = await elevacionDe(p.lat, p.lon);
  if (r && r.fuente === "curvas")
    M.push({ e: r.cota - z, d: r.distancia, z, v: vecinal(p.lon, p.lat), lat: p.lat, lon: p.lon });
}
const F = [];
for (const capa of ["puntos_fijos", "puntos_fijos_cn"])
  for (const f of leer(`muni-${capa}-2026-10-22.json`).features) {
    if (!f.geometry || !(f.properties.cota > 5)) continue;
    const [lon, lat] = f.geometry.coordinates;
    const r = await elevacionDe(lat, lon);
    if (r && r.fuente === "curvas") F.push({ e: r.cota - f.properties.cota, d: r.distancia });
  }

const FRANJAS = [0, 25, 50, 100, 150, 250, 400, 700, Infinity];
for (const [titulo, datos] of [
  ["1. Puntos con cota de la IDESF, por distancia a la curva más cercana", M],
  ["2. Puntos fijos municipales (medidos), ídem", F],
]) {
  console.log("\n" + titulo + "  (e = curvas − referencia)");
  for (let i = 0; i < FRANJAS.length - 1; i++)
    renglon(
      FRANJAS[i + 1] === Infinity ? `más de ${FRANJAS[i]} m` : `${FRANJAS[i]}–${FRANJAS[i + 1]} m`,
      datos.filter((x) => x.d >= FRANJAS[i] && x.d < FRANJAS[i + 1]).map((x) => x.e),
    );
}

console.log("\n3. A más de 400 m de una curva: dónde, y a qué altura está el terreno");
const lejos = M.filter((x) => x.d > 400);
const grupos = new Map();
for (const x of lejos) {
  const k =
    x.v ||
    (x.lat > -31.575 ? "(fuera de las vecinales, al norte)" : x.lon < -60.74 ? "(fuera, al oeste)" : "(fuera, otro)");
  if (!grupos.has(k)) grupos.set(k, []);
  grupos.get(k).push(x);
}
for (const [k, v] of [...grupos.entries()].sort((a, b) => b[1].length - a[1].length)) {
  const z = v.map((x) => x.z);
  renglon(`${k.slice(0, 30)} · terreno ${Math.min(...z).toFixed(1)}–${Math.max(...z).toFixed(1)}`, v.map((x) => x.e));
}

console.log("\n4. Lo mismo, por la altura real del terreno en vez de por barrio");
for (const [nom, f] of [
  ["terreno por debajo de 13 m", (x) => x.z < 13],
  ["terreno de 13 a 15 m", (x) => x.z >= 13 && x.z < 15],
  ["terreno de 15 m o más", (x) => x.z >= 15],
]) {
  renglon(nom + ", a más de 400 m", lejos.filter(f).map((x) => x.e));
  renglon(nom + ", a 400 m o menos", M.filter((x) => x.d <= 400 && f(x)).map((x) => x.e));
}

console.log("\n5. Qué dejaría sin altura un tope, en una malla de 150 m");
const C = CURVAS;
const [o, s, e, n] = C.area;
const cuenta = { todo: 0, ciudad: 0 };
const cortes = [250, 400, 700];
const fuera = { todo: [0, 0, 0], ciudad: [0, 0, 0] };
for (let la = s; la <= n; la += 150 / 110900)
  for (let lo = o; lo <= e; lo += 150 / 94700) {
    const r = await elevacionDe(la, lo);
    const enCiudad = vecinal(lo, la) != null;
    cuenta.todo++;
    if (enCiudad) cuenta.ciudad++;
    cortes.forEach((c, i) => {
      if (r.distancia > c) {
        fuera.todo[i]++;
        if (enCiudad) fuera.ciudad[i]++;
      }
    });
  }
for (const [k, nom] of [["todo", "todo el rectángulo de las curvas"], ["ciudad", "dentro de las vecinales"]])
  console.log(
    `  ${nom.padEnd(34)} ${String(cuenta[k]).padStart(6)} celdas; a más de ` +
      cortes.map((c, i) => `${c} m: ${((fuera[k][i] / cuenta[k]) * 100).toFixed(1)} %`).join(" · "),
  );
console.log(
  `\nLa curva más baja es la de ${Math.min(...C.curvas.map((c) => c[0]))} m y la más alta la de ${Math.max(...C.curvas.map((c) => c[0]))} m.`,
);
