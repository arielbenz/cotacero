/* js/app/elevacion.js — la cota del terreno, de las curvas del municipio y,
   fuera de la ciudad, de los puntos con cota de la costa.
   La distancia va medida punto-a-segmento y no al vértice más cercano: con
   vértices, simplificar la geometría movía el resultado 1,85 m.
   Fuera de las dos coberturas devuelve null y la app pide la cota a mano, en
   vez de caer a una fuente peor. */

/* ---------- elevación del terreno ----------
   Sale de las curvas de nivel de la Municipalidad de Santa Fe (Secretaría de
   Recursos Hídricos), cada 50 cm y en metros IGN: el mismo sistema que el
   cero del hidrómetro. Ver scripts/curvas.js.

   Antes esto consultaba un modelo satelital. Medido contra estas curvas
   sobreestimaba 2,15 m de media, porque mide techos y arbolado en vez del
   piso; y contra los puntos de nivelación del IGN tenía 7,5 m de desvío. Con
   un rango de decisión de 2 m entre la alerta y el récord de 1992, ese dato
   no informaba nada. */

let curvasCache = null;

export async function curvas() {
  if (curvasCache) return curvasCache;
  const r = await fetch("/datos-abiertos/curvas.json");
  if (!r.ok) throw new Error("no se pudieron cargar las curvas");
  curvasCache = await r.json();
  return curvasCache;
}

const M_POR_GRADO_LAT = 110900;

const mPorGradoLon = (lat) => 111320 * Math.cos((lat * Math.PI) / 180);

/* Distancia de un punto a un segmento, no a sus extremos. Con la distancia al
   vértice más cercano, simplificar la geometría movía el resultado casi dos
   metros; con esto, dos centímetros. */
function distanciaASegmento(px, py, ax, ay, bx, by) {
  const dx = bx - ax,
    dy = by - ay;
  const l2 = dx * dx + dy * dy;
  let t = l2 ? ((px - ax) * dx + (py - ay) * dy) / l2 : 0;
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

/* ---------- fuera de la ciudad: los puntos de la costa ----------
   Las curvas terminan en el límite del municipio. San José del Rincón y
   Arroyo Leyes tienen los puntos con cota de la misma campaña de 2005 (IDESF,
   capa MACotas; ver scripts/cotas-costa.js). Se baja sólo si hace falta: quien
   vive en la ciudad nunca lo pide. */
let costaCache = null;

async function costa() {
  if (costaCache) return costaCache;
  const r = await fetch("/datos-abiertos/cotas-costa.json");
  if (!r.ok) throw new Error("no se pudieron cargar las cotas de la costa");
  costaCache = await r.json();
  return costaCache;
}

/* Más lejos que esto del punto medido más cercano, no hay dato: es otro
   terreno. La mitad de los puntos tiene un vecino a menos de 36 m y nueve de
   cada diez a menos de 76 (AUDITORIA.md §7, pregunta 24). */
const PUNTOS_MAX_M = 150;

/* Cuatro vecinos, pesados por la inversa del cuadrado de la distancia. Es lo
   que se validó: estimando cada punto con sus cuatro vecinos, en Rincón y
   Arroyo Leyes la mediana del error es 0,21 m y el p90 0,93 m. Por eso el
   margen de esta fuente es ERROR_PUNTOS y no ERROR_DEM. */
async function elevacionCosta(lat, lon) {
  let d;
  try {
    d = await costa();
  } catch (e) {
    return null;
  }
  const [oe, os, on, ono] = d.area;
  if (lon < oe || lon > on || lat < os || lat > ono) return null;
  const ml = mPorGradoLon(lat);
  const p = d.puntos;
  const cerca = [];
  for (let i = 0; i < p.length; i += 3) {
    const dist = Math.hypot(
      (p[i] - lon) * ml,
      (p[i + 1] - lat) * M_POR_GRADO_LAT,
    );
    if (dist > PUNTOS_MAX_M) continue;
    cerca.push([dist, p[i + 2]]);
  }
  if (!cerca.length) return null;
  cerca.sort((a, b) => a[0] - b[0]);
  const cuatro = cerca.slice(0, 4);
  // Encima de un punto medido, ése es el dato: la inversa de cero no existe.
  if (cuatro[0][0] < 0.5)
    return { cota: cuatro[0][1], distancia: cuatro[0][0], fuente: "puntos" };
  let suma = 0,
    pesos = 0;
  for (const [dist, z] of cuatro) {
    suma += z / dist ** 2;
    pesos += 1 / dist ** 2;
  }
  return { cota: suma / pesos, distancia: cuatro[0][0], fuente: "puntos" };
}

/* Devuelve { cota, distancia, fuente } o null si el punto cae fuera de la
   zona cubierta. Preferimos no dar un número antes que dar uno inventado.
   `fuente` es "curvas" o "puntos", y decide el margen: ver margenCota() en
   cota.js. */
export async function elevacionDe(lat, lon) {
  let d;
  try {
    d = await curvas();
  } catch (e) {
    return null;
  }
  const [oe, os, on, ono] = [d.area[0], d.area[1], d.area[2], d.area[3]];
  if (lon < oe || lon > on || lat < os || lat > ono)
    return elevacionCosta(lat, lon);

  const ml = mPorGradoLon(lat);
  const px = lon * ml,
    py = lat * M_POR_GRADO_LAT;
  // Para cada cota distinta, a qué distancia está su curva más cercana.
  const cercania = new Map();
  for (const [z, p] of d.curvas) {
    let min = Infinity;
    for (let i = 0; i < p.length - 2; i += 2) {
      const q = distanciaASegmento(
        px,
        py,
        p[i] * ml,
        p[i + 1] * M_POR_GRADO_LAT,
        p[i + 2] * ml,
        p[i + 3] * M_POR_GRADO_LAT,
      );
      if (q < min) min = q;
    }
    if (!cercania.has(z) || min < cercania.get(z)) cercania.set(z, min);
  }
  const orden = [...cercania.entries()].sort((a, b) => a[1] - b[1]);
  if (!orden.length) return null;
  const [z1, d1] = orden[0];
  // Se interpola entre las dos curvas de cota DISTINTA más cercanas.
  for (const [z2, d2] of orden.slice(1)) {
    if (z2 !== z1) {
      const t = d1 + d2 === 0 ? 0 : d1 / (d1 + d2);
      return { cota: z1 + (z2 - z1) * t, distancia: d1, fuente: "curvas" };
    }
  }
  return { cota: z1, distancia: d1, fuente: "curvas" };
}
