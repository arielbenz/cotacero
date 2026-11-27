/* js/app/elevacion.js — la cota del terreno, de las fuentes de altura.
   Hoy son dos: las curvas del municipio en la ciudad y los puntos con cota de
   la Provincia en la costa —y en la ciudad, donde la curva queda lejos y un
   punto medido al lado dice que el terreno es más bajo—. Fuera de todas
   devuelve null y la app pide la cota a mano, en vez de caer a una fuente
   peor.

   Puro: sólo fetch, ni estado ni DOM. scripts/comprobar.js lo carga desde
   Node con un fetch que lee del disco. */

import { ERROR_DEM, ERROR_PUNTOS } from "./config.js";

/* ---------- por qué no un satélite ----------
   Antes esto consultaba un modelo satelital. Medido contra las curvas
   sobreestimaba 2,15 m de media, porque mide techos y arbolado en vez del
   piso; y contra los puntos de nivelación del IGN tenía 7,5 m de desvío. Con
   un rango de decisión de 2 m entre la alerta y el récord de 1992, ese dato
   no informaba nada. */

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

/* ---------- las curvas del municipio ----------
   Secretaría de Recursos Hídricos, cada 50 cm y en metros IGN: el mismo
   sistema que el cero del hidrómetro (ver scripts/curvas.js). Se interpola
   entre las dos curvas de cota DISTINTA más cercanas.

   No tiene tope de distancia, a propósito: en la ciudad alta y llana hay
   curvas a más de un kilómetro y el dato es bueno, porque el terreno no
   cambia. Un tope de 400 m dejaba sin altura al 13 % de la ciudad
   (AUDITORIA.md §4). Lo que sí falla lejos de una curva es el terreno bajo
   —la más baja es la de 12,5 m, y por debajo no hay con qué interpolar—: para
   eso está CURVAS_LEJOS_M, más abajo. Exportada para scripts/cotas-costa.js. */
export function entreCurvas(d, lat, lon) {
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
  for (const [z2, d2] of orden.slice(1)) {
    if (z2 !== z1) {
      const t = d1 + d2 === 0 ? 0 : d1 / (d1 + d2);
      return { cota: z1 + (z2 - z1) * t, distancia: d1 };
    }
  }
  return { cota: z1, distancia: d1 };
}

/* ---------- los puntos de la costa ----------
   Las curvas terminan en el límite del municipio. San José del Rincón y
   Arroyo Leyes tienen los puntos con cota de la misma campaña de 2005 (IDESF,
   capa MACotas; ver scripts/cotas-costa.js).

   Más lejos que PUNTOS_MAX_M del punto medido más cercano no hay dato: es
   otro terreno. La mitad de los puntos tiene un vecino a menos de 36 m y
   nueve de cada diez a menos de 76 (AUDITORIA.md §7, pregunta 24). */
export const PUNTOS_MAX_M = 150;

/* Desde qué distancia a la curva más cercana se le pregunta también a los
   puntos. Medido contra los 5.607 puntos con cota que caen en el rectángulo
   de las curvas: hasta 400 m las curvas dan el terreno más de 1 m arriba del
   real en el 2 a 7,5 % de los casos; de 400 a 700 m, en el 24,7 %, y más
   lejos en el 44,5 % —el lado que hace avisar tarde, y casi todo en terreno
   bajo: La Guardia, Colastiné, el borde norte—.

   A esa distancia, si hay un punto medido a menos de PUNTOS_MAX_M y da el
   terreno MÁS BAJO que las curvas por más del margen de las curvas
   (ERROR_DEM), la altura sale de los puntos, con su margen. Si no, quedan las
   curvas, como antes. La condición del margen se agregó después de cruzarlo
   con las parcelas del catastro: sin ella cambiaban de fuente 2.292 lotes de
   la ciudad alta, donde los puntos y las curvas coinciden y lo único que
   cambiaba era el margen (0,5 → 1,0 m), y 538 dejaban de verse como «más
   alto que el récord». Con ella no cambia ningún lote, y las 26 parcelas
   donde las curvas daban más de 1 m de más siguen corregidas.
   datos-crudos/analisis-distancia-curvas-2026-11-27.mjs,
   analisis-curvas-lejos-afinado-2026-11-27.mjs y AUDITORIA.md §4.
   No se toca sin leer eso. */
export const CURVAS_LEJOS_M = 400;

/* Cuatro vecinos, pesados por la inversa del cuadrado de la distancia. Es lo
   que se validó: estimando cada punto con sus cuatro vecinos, en Rincón y
   Arroyo Leyes la mediana del error es 0,21 m y el p90 0,93 m. Por eso el
   margen de esta fuente es ERROR_PUNTOS y no ERROR_DEM. */
function conPuntos(d, lat, lon) {
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
  if (cuatro[0][0] < 0.5) return { cota: cuatro[0][1], distancia: cuatro[0][0] };
  let suma = 0,
    pesos = 0;
  for (const [dist, z] of cuatro) {
    suma += z / dist ** 2;
    pesos += 1 / dist ** 2;
  }
  return { cota: suma / pesos, distancia: cuatro[0][0] };
}

/* ---------- las fuentes, en orden ----------
   La primera cuya área contiene el punto es la que contesta, aunque conteste
   null: donde hay curvas mandan las curvas. La excepción es `lejos`: si la
   primera contesta desde más lejos que eso, se le pregunta a la siguiente, y
   la siguiente vale sólo si da el terreno más bajo por más del margen de la
   primera (ver CURVAS_LEJOS_M). Cada archivo se
   baja recién cuando hace falta —quien vive en la ciudad, cerca de una curva,
   nunca pide el de la costa—.

   Cada fuente trae todo lo suyo, en un solo renglón: el archivo, la cuenta,
   el MARGEN —la constante de config.js, que sigue teniendo dueño en
   AUDITORIA.md—, el sello que la atribuye (una clave de FUENTES_APP) y cómo
   se la nombra en pantalla. Antes el margen se elegía comparando el texto
   "puntos" en un lado y los textos con un if en otro. Agregar una fuente es
   agregar un renglón acá; scripts/comprobar.js verifica que traiga todo. */
export const FUENTES_ALTURA = [
  {
    id: "curvas",
    archivo: "/datos-abiertos/curvas.json",
    calcular: entreCurvas,
    lejos: CURVAS_LEJOS_M,
    margen: ERROR_DEM,
    sello: "topografia",
    dice: {
      // «Margen de seguridad (…)», en el desglose.
      porQueMargen: "el plano tiene líneas cada 50 cm",
      // «la cota del terreno viene de …», al pie del desglose.
      deDonde: "curvas cada 0,5 m",
      // El párrafo que explica la altura estimada.
      explicacion: (distancia) =>
        "<b>Altura calculada entre dos líneas del plano</b>, que tiene una " +
        "cada 50 cm." +
        (distancia != null
          ? " La más cercana a ese punto está a " + Math.round(distancia) + " m."
          : "") +
        " Por eso la cuenta usa medio metro menos.",
    },
  },
  {
    id: "puntos",
    archivo: "/datos-abiertos/cotas-costa.json",
    calcular: conPuntos,
    margen: ERROR_PUNTOS,
    sello: "topografiaCosta",
    dice: {
      porQueMargen: "puntos medidos cada unos 40 m, en un terreno que cambia mucho",
      deDonde: "puntos medidos cada unos 40 m",
      explicacion: (distancia) =>
        "<b>Altura calculada con los puntos medidos más cercanos</b>, de un " +
        "relevamiento de la Provincia de 2005." +
        (distancia != null
          ? " El más cercano a ese lugar está a " + Math.round(distancia) + " m."
          : "") +
        " Ahí el terreno cambia mucho de un lugar a otro —terraplenes, " +
        "cunetas, rellenos—, así que la cuenta usa un metro menos.",
    },
  },
];

/* La fuente por su id. Lo guardado antes del 22/10/2026 no tiene fuente, y
   entonces salió de las curvas: eran la única. */
export const fuenteAltura = (id) =>
  FUENTES_ALTURA.find((f) => f.id === id) || FUENTES_ALTURA[0];

const cargadas = new Map();

function cargar(f) {
  if (!cargadas.has(f.id))
    cargadas.set(
      f.id,
      fetch(f.archivo).then((r) => {
        if (!r.ok) throw new Error("no se pudo cargar " + f.archivo);
        return r.json();
      }),
    );
  // Si falló, se olvida: el próximo intento vuelve a pedirlo.
  return cargadas.get(f.id).catch((e) => {
    cargadas.delete(f.id);
    throw e;
  });
}

const dentro = ([oe, os, on, ono], lat, lon) =>
  lon >= oe && lon <= on && lat >= os && lat <= ono;

/* Devuelve { cota, distancia, fuente } o null si el punto cae fuera de las
   zonas cubiertas. Preferimos no dar un número antes que dar uno inventado.
   `fuente` es el id de FUENTES_ALTURA y decide el margen: ver margenDe() en
   modelo.js. */
export async function elevacionDe(lat, lon) {
  // Lo que contestó una fuente desde más lejos que su `lejos`, y su margen:
  // vale salvo que la siguiente diga que el terreno es más bajo que eso por
  // más de ese margen.
  let deLejos = null;
  let margenDeLejos = 0;
  for (const f of FUENTES_ALTURA) {
    let d;
    try {
      d = await cargar(f);
    } catch (e) {
      continue;
    }
    if (!dentro(d.area, lat, lon)) continue;
    const c = f.calcular(d, lat, lon);
    const r = c && { ...c, fuente: f.id };
    if (deLejos) return r && deLejos.cota - r.cota > margenDeLejos ? r : deLejos;
    if (r && f.lejos != null && r.distancia > f.lejos) {
      deLejos = r;
      margenDeLejos = f.margen;
      continue;
    }
    return r;
  }
  return deLejos;
}
