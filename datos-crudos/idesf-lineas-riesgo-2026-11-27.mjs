// node datos-crudos/idesf-lineas-riesgo-2026-11-27.mjs 2026-11-27
//
// ¿Qué línea de inundación pasa al lado de cada punto con cota?
//
// La IDESF publica dos capas de la Secretaría de Recursos Hídricos que no
// habíamos mirado: «Líneas de Riesgo Históricas» (MACurvasHistoricas: 1973,
// 1983, 1992, 1998, 2003) y «Líneas de Riesgo Teóricas» (MACurvasTeoricas:
// recurrencias de 2 a 100 años). Cada línea trae la altura del hidrómetro del
// Puerto de ese evento (h_puerto). Donde una pasa junto a un punto de MACotas
// se conoce, a la vez, la cota del terreno y la altura del Puerto con la que
// el agua llegó hasta ahí: es un contraste del cero y de la pendiente con
// datos de la Provincia.
//
// Cómo: el WFS del servidor está apagado y de una línea GetFeatureInfo no
// devuelve la geometría (ver idesf-macotas-2026-10-22.mjs). Pero SÍ responde
// por cercanía: devuelve las líneas a pocos píxeles del píxel consultado. Se
// pregunta entonces en cada punto con cota, dos veces:
//   - con un píxel de ~6,7 m («lejos»: la línea está a unos 20–30 m o menos);
//   - si hubo alguna, con un píxel de ~1,9 m («cerca»: a unos 6–8 m o menos).
// La tolerancia exacta en píxeles la fija el servidor y no está publicada:
// por eso se guarda el tamaño del píxel y no una distancia.
//
// El píxel de «cerca» no puede ser más chico: la capa tiene un zoom máximo
// (ScaleHint mín. 2,49 en las capacidades) y por debajo de ~1,8 m por píxel el
// servidor la apaga y devuelve vacío, sin error. La primera corrida usó 1,5 m
// y «cerca» salió vacío en los 3.391 puntos; comprobado con 10 puntos: con
// 1,5 m no contesta ninguno, con 1,9 m contestan 6.
//
// Puntos: todos los de la costa (lon > −60,59: Rincón y Arroyo Leyes) y uno
// de cada ocho del resto (la ciudad, Colastiné, La Guardia), como control:
// junto al Puerto la diferencia tendría que ser cero.
//
// Despacio a propósito: dos pedidos a la vez, contra un servidor provincial
// que tarda 2–3 s por pedido. Se puede cortar y retomar: el avance queda en
// un .parcial.jsonl y los puntos ya consultados no se repiten.
import {
  appendFileSync,
  existsSync,
  readFileSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";

const HOY = process.argv[2];
if (!HOY) throw new Error("falta la fecha: node … 2026-11-27");
const BASE = "https://aswe.santafe.gov.ar/idesf/publico-wms";
const CAPAS = ["MACurvasHistoricas", "MACurvasTeoricas"];
const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/126.0 Safari/537.36";
const A_LA_VEZ = 2;
const COSTA_DESDE = -60.59;
const UNO_DE_CADA = 8; // fuera de la costa
// Medio lado del recuadro, en grados; con 5 píxeles de ancho.
const LEJOS = 0.00015; // píxel de ~6,7 m
const CERCA = 0.0000428; // píxel de ~1,9 m: el más chico que la capa contesta
const M_POR_GRADO = 111000;

const PARCIAL = `datos-crudos/idesf-lineas-riesgo-${HOY}.parcial.jsonl`;
const SALIDA = `datos-crudos/idesf-lineas-riesgo-${HOY}.json`;

const todos = JSON.parse(
  readFileSync("datos-crudos/idesf-MACotas-2026-10-22.json", "utf8"),
)
  .map((p) => ({ lon: p.lon, lat: p.lat, z: +p.z }))
  .filter((p) => p.z > 1); // z ≤ 1 son vacíos del origen
let fuera = 0;
const puntos = todos.filter((p) =>
  p.lon > COSTA_DESDE ? true : fuera++ % UNO_DE_CADA === 0,
);

async function lineas(p, medio) {
  const q = new URLSearchParams({
    SERVICE: "WMS",
    VERSION: "1.1.1",
    REQUEST: "GetFeatureInfo",
    LAYERS: CAPAS.join(","),
    QUERY_LAYERS: CAPAS.join(","),
    STYLES: "",
    SRS: "EPSG:4326",
    BBOX: [p.lon - medio, p.lat - medio, p.lon + medio, p.lat + medio].join(","),
    WIDTH: "5",
    HEIGHT: "5",
    X: "2",
    Y: "2",
    FEATURE_COUNT: "60",
    INFO_FORMAT: "application/vnd.ogc.gml",
  });
  let ultimo;
  for (let intento = 0; intento < 3; intento++) {
    try {
      const r = await fetch(`${BASE}?${q}`, {
        headers: { "User-Agent": UA },
        signal: AbortSignal.timeout(60000),
      });
      if (!r.ok) throw new Error("HTTP " + r.status);
      const x = await r.text();
      if (!x.includes("msGMLOutput")) throw new Error("respuesta rara");
      const v = [];
      for (const capa of CAPAS) {
        const bloque = x.match(
          new RegExp(`<${capa}_layer>([\\s\\S]*?)</${capa}_layer>`),
        );
        if (!bloque) continue;
        for (const m of bloque[1].matchAll(
          /<layer>([^<]*)<\/layer>\s*<h_puerto>([^<]*)<\/h_puerto>/g,
        ))
          v.push({ capa, linea: m[1], h_puerto: +m[2] });
      }
      // La misma línea llega repetida si son varios tramos: una vez alcanza.
      const vistas = new Set();
      return v.filter((l) => {
        const k = l.capa + l.linea;
        if (vistas.has(k)) return false;
        vistas.add(k);
        return true;
      });
    } catch (e) {
      ultimo = e;
      await new Promise((ok) => setTimeout(ok, 5000 * (intento + 1)));
    }
  }
  throw ultimo;
}

const clave = (p) => p.lon + "," + p.lat;
const pixel = (medio) => +(((2 * medio) / 5) * M_POR_GRADO).toFixed(2);

// Lo ya consultado: de una salida anterior y del parcial. De la salida,
// «cerca» vale sólo si se bajó con el píxel de ahora.
const hechos = new Map();
const anotar = (o) => {
  const k = clave(o);
  hechos.set(k, { ...(hechos.get(k) || {}), ...o });
};
if (existsSync(SALIDA)) {
  const j = JSON.parse(readFileSync(SALIDA, "utf8"));
  const cercaVale = j.pixel_m.cerca === pixel(CERCA);
  for (const { lon, lat, z, lejos, cerca } of j.puntos)
    anotar(cercaVale ? { lon, lat, z, lejos, cerca } : { lon, lat, z, lejos });
}
if (existsSync(PARCIAL))
  for (const renglon of readFileSync(PARCIAL, "utf8").split("\n"))
    if (renglon) {
      const o = JSON.parse(renglon);
      if (!o.error) anotar(o);
    }

let errores = 0;
async function etapa(nombre, faltan, consultar) {
  console.log(`${nombre}: faltan ${faltan.length}`);
  const inicio = Date.now();
  for (let i = 0; i < faltan.length; i += A_LA_VEZ) {
    await Promise.all(
      faltan.slice(i, i + A_LA_VEZ).map(async (p) => {
        try {
          const o = await consultar(p);
          anotar(o);
          appendFileSync(PARCIAL, JSON.stringify(o) + "\n");
        } catch (e) {
          errores++;
          appendFileSync(
            PARCIAL,
            JSON.stringify({ ...p, error: String(e.message || e) }) + "\n",
          );
        }
      }),
    );
    if ((i / A_LA_VEZ) % 100 === 0)
      console.log(
        `  ${i}/${faltan.length}  errores ${errores}  ` +
          `${Math.round((Date.now() - inicio) / 60000)} min`,
      );
  }
}

console.log(
  `${puntos.length} puntos (${puntos.filter((p) => p.lon > COSTA_DESDE).length} de la costa)`,
);
await etapa(
  "lejos",
  puntos.filter((p) => !hechos.get(clave(p))?.lejos),
  async (p) => ({ ...p, lejos: await lineas(p, LEJOS) }),
);
await etapa(
  "cerca",
  puntos.filter((p) => {
    const h = hechos.get(clave(p));
    return h?.lejos?.length && !h.cerca;
  }),
  async (p) => ({ lon: p.lon, lat: p.lat, cerca: await lineas(p, CERCA) }),
);

if (errores) {
  console.log(
    `quedaron ${errores} puntos sin respuesta: volvé a correrlo para completarlos.`,
  );
  process.exit(1);
}
writeFileSync(
  SALIDA,
  JSON.stringify({
    fuente:
      "IDESF, capas MACurvasHistoricas y MACurvasTeoricas (Secretaría de " +
      "Recursos Hídricos), por GetFeatureInfo en cada punto de MACotas",
    servicio: BASE,
    bajado: HOY,
    puntos_de: "datos-crudos/idesf-MACotas-2026-10-22.json",
    muestra: `todos los de lon > ${COSTA_DESDE}; del resto, uno de cada ${UNO_DE_CADA}`,
    pixel_m: { lejos: pixel(LEJOS), cerca: pixel(CERCA) },
    nota:
      "lejos/cerca: líneas a pocos píxeles del punto, con ese tamaño de píxel. " +
      "La tolerancia en píxeles la fija el servidor y no está publicada.",
    puntos: puntos.map((p) => {
      const { lon, lat, z, lejos, cerca = [] } = hechos.get(clave(p));
      return { lon, lat, z, lejos, cerca };
    }),
  }),
);
if (existsSync(PARCIAL)) unlinkSync(PARCIAL);
const con = puntos.filter((p) => hechos.get(clave(p)).lejos.length).length;
const conCerca = puntos.filter((p) => hechos.get(clave(p)).cerca?.length).length;
console.log(
  `listo: ${puntos.length} puntos, ${con} con alguna línea lejos, ${conCerca} cerca → ${SALIDA}`,
);
