/* js/app/elevacion.js — la cota del terreno, de las curvas del municipio.
   La distancia va medida punto-a-segmento y no al vértice más cercano: con
   vértices, simplificar la geometría movía el resultado 1,85 m.
   Fuera de la cobertura devuelve null y la app pide la cota a mano, en vez de
   caer a una fuente peor. */

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

/* Devuelve { cota, distancia } o null si el punto cae fuera de la zona
   cubierta. Preferimos no dar un número antes que dar uno inventado. */
export async function elevacionDe(lat, lon) {
  let d;
  try {
    d = await curvas();
  } catch (e) {
    return null;
  }
  const [oe, os, on, ono] = [d.area[0], d.area[1], d.area[2], d.area[3]];
  if (lon < oe || lon > on || lat < os || lat > ono) return null;

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
      return { cota: z1 + (z2 - z1) * t, distancia: d1 };
    }
  }
  return { cota: z1, distancia: d1 };
}
