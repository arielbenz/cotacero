// datos-crudos/analisis-serie-diaria-2026-11-13.mjs — PROTOTIPO, no lo consume el sitio.
//
//   node datos-crudos/analisis-serie-diaria-2026-11-13.mjs
//
// Arma dos gráficos de prueba con la serie diaria del hidrómetro del Puerto
// (serie 30 del INA) y los escribe en un solo HTML para abrir en el navegador:
//
//   1. Todos los años superpuestos, de enero a diciembre, con 2026 resaltado.
//   2. La grilla: una fila por año, una columna por día.
//
// De dónde sale: ina-serie-30-1990-2026-2026-09-08.json, que ya está acá. Por
// eso arranca en 1990 y no en 1925: la serie entera la baja scripts/historia.js.
// El criterio del día es el mismo que ahí: hora argentina y el MÁXIMO del día.
//
// Lo que falta de 2026 se pide a /api/nivel (los últimos 30 días). Si no hay
// red, se usa la copia del 13/11/2026 que está más abajo. Entre el 8/9 y el
// 13/10 no hay dato en ninguna de las dos: el gráfico deja el hueco.

import { readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ACA = dirname(fileURLToPath(import.meta.url));
const ENTRADA = join(ACA, "ina-serie-30-1990-2026-2026-09-08.json");
const SALIDA = join(ACA, "prototipo-graficos-serie-2026-11-13.html");

const ALERTA = 5.3;
const EVACUACION = 5.7;

/* Copia de `serie` de https://cotacerosf.com/api/nivel leída el 13/11/2026. */
const COPIA_API = [
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

const obs = JSON.parse(await readFile(ENTRADA, "utf8"));
const porDia = new Map();
for (const o of obs) {
  if (typeof o.valor !== "number" || !isFinite(o.valor)) continue;
  const d = diaLocal(o.timestart);
  if (!porDia.has(d) || o.valor > porDia.get(d)) porDia.set(d, o.valor);
}

let origenReciente = "copia del 13/11/2026";
let reciente = COPIA_API;
try {
  const r = await fetch("https://cotacerosf.com/api/nivel", { signal: AbortSignal.timeout(6000) });
  const j = await r.json();
  if (Array.isArray(j.serie) && j.serie.length) {
    reciente = j.serie;
    origenReciente = "/api/nivel, leído al generar";
  }
} catch {
  /* sin red: queda la copia */
}
for (const [d, v] of reciente) if (!porDia.has(d) || v > porDia.get(d)) porDia.set(d, v);

/* Cada año en 366 casilleros (calendario bisiesto), para que el 1 de marzo
   caiga en la misma columna todos los años. */
const INICIO_MES = [0, 31, 60, 91, 121, 152, 182, 213, 244, 274, 305, 335];
const casillero = (d) => INICIO_MES[+d.slice(5, 7) - 1] + +d.slice(8, 10) - 1;

const anios = {};
for (const [d, v] of porDia) {
  const a = d.slice(0, 4);
  (anios[a] ||= new Array(366).fill(null))[casillero(d)] = Math.round(v * 100) / 100;
}
const ultimoDia = [...porDia.keys()].sort().at(-1);
const lista = Object.keys(anios).sort();

console.log("días con dato        :", porDia.size);
console.log("años                 :", lista[0], "a", lista.at(-1));
console.log("última lectura       :", ultimoDia, porDia.get(ultimoDia), "m ·", origenReciente);

const DATOS = { anios, alerta: ALERTA, evacuacion: EVACUACION, ultimoDia, origenReciente };

const html = `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Prototipo: la serie diaria del Paraná en Santa Fe</title>
<style>
  :root { --fondo:#fafbfc; --panel:#fff; --texto:#1b262c; --tenue:#5f6c72; --linea:rgba(27,38,44,.09); --acento:#127296; }
  * { box-sizing: border-box; }
  body { margin:0; background:var(--fondo); color:var(--texto); font:16px/1.55 "Plus Jakarta Sans", system-ui, -apple-system, "Segoe UI", sans-serif; overflow-wrap:break-word; }
  main { max-width: 980px; margin: 0 auto; padding: 28px 20px 56px; }
  h1 { font-size: 26px; line-height:1.2; margin: 0 0 6px; }
  h2 { font-size: 20px; margin: 44px 0 4px; }
  p { margin: 6px 0 12px; max-width: 68ch; }
  .tenue { color: var(--tenue); font-size: 14px; }
  .lectura { min-height: 26px; font-size: 15px; margin: 10px 0 6px; font-variant-numeric: tabular-nums; }
  .caja { background: var(--panel); border: 1px solid var(--linea); border-radius: 12px; padding: 14px; }
  canvas { display:block; width:100%; touch-action: pan-y; }
  .fichas { display:flex; flex-wrap:wrap; gap:8px; margin: 10px 0 2px; }
  .fichas button { font: inherit; font-size:14px; min-height:44px; padding: 0 14px; border-radius: 999px; border:1px solid #7c868b; background: var(--panel); color: var(--texto); cursor:pointer; }
  .fichas button[aria-pressed="true"] { background: var(--acento); border-color: var(--acento); color:#fff; }
  .leyenda { display:flex; flex-wrap:wrap; align-items:center; gap:8px 18px; font-size:13px; color:var(--tenue); margin-top:10px; }
  .leyenda i { display:inline-block; vertical-align:middle; margin-right:6px; }
  .aviso { border-left: 3px solid var(--acento); padding: 2px 0 2px 12px; margin: 14px 0; font-size: 14px; color: var(--tenue); }
</style>
</head>
<body>
<main>
  <h1>La serie diaria del Paraná en Santa Fe</h1>
  <p class="tenue">Prototipo. Hidrómetro del Puerto, serie 30 del INA, de ${lista[0]} a ${lista.at(-1)}. Última lectura: ${ultimoDia.split("-").reverse().join("/")} (${origenReciente}). Esto es historia, no pronóstico: la línea de este año termina en la última lectura.</p>

  <h2>1 · Todos los años, uno arriba del otro</h2>
  <p>Cada línea gris es un año, de enero a diciembre. La oscura es 2026.</p>
  <div class="fichas" id="fichas" aria-label="Resaltar un año"></div>
  <div class="lectura" id="lec1" role="status">Pasá el cursor o el dedo por el gráfico.</div>
  <div class="caja"><canvas id="c1" height="440" role="img" aria-label="Nivel diario del río por año, de enero a diciembre, con 2026 resaltado"></canvas></div>
  <div class="leyenda">
    <span><i style="width:22px;height:3px;background:#1b262c"></i>2026</span>
    <span><i style="width:22px;height:2px;background:rgba(27,38,44,.3)"></i>cada año anterior</span>
    <span><i style="width:22px;border-top:2px dashed #cf440d"></i>alerta de la ciudad (5,30 m)</span>
    <span><i style="width:22px;border-top:2px dashed #a5271a"></i>evacuación de la ciudad (5,70 m)</span>
  </div>
  <p class="aviso">En 2026 no hay dato entre el 8/9 y el 13/10 en los archivos de esta carpeta: la línea se corta ahí.</p>

  <h2>2 · La grilla: un renglón por año, un casillero por día</h2>
  <p>Más oscuro es más alto. Las crecidas largas se ven como manchas anchas; las cortas, como una raya.</p>
  <div class="lectura" id="lec2" role="status">Pasá el cursor o el dedo por la grilla.</div>
  <div class="caja"><canvas id="c2" role="img" aria-label="Grilla del nivel diario: una fila por año y una columna por día"></canvas></div>
  <div class="leyenda">
    <span>0 m</span><canvas id="rampa" width="200" height="12" style="width:200px;height:12px;border-radius:3px"></canvas><span>7,4 m</span>
    <span><i style="width:12px;height:12px;border:1px solid #7c868b;background:#fafbfc"></i>sin dato</span>
    <span><i style="width:12px;height:4px;background:#1b262c"></i>día sobre la alerta de la ciudad</span>
  </div>
</main>
<script>
const D = ${JSON.stringify(DATOS)};
const MESES = ["ene","feb","mar","abr","may","jun","jul","ago","sep","oct","nov","dic"];
const MES_LARGO = ["enero","febrero","marzo","abril","mayo","junio","julio","agosto","septiembre","octubre","noviembre","diciembre"];
const INI = [0,31,60,91,121,152,182,213,244,274,305,335,366];
const ANIOS = Object.keys(D.anios).sort();
const ULTIMO = ANIOS[ANIOS.length - 1];
const m2 = (v) => v.toFixed(2).replace(".", ",") + " m";
const fecha = (i) => { let m = 0; while (INI[m + 1] <= i) m++; return (i - INI[m] + 1) + " de " + MES_LARGO[m]; };
const lienzo = (c, alto) => {
  const dpr = window.devicePixelRatio || 1, w = c.clientWidth;
  c.width = Math.round(w * dpr); c.height = Math.round(alto * dpr); c.style.height = alto + "px";
  const x = c.getContext("2d"); x.setTransform(dpr, 0, 0, dpr, 0, 0); return [x, w];
};

/* ---------- 1: años superpuestos ---------- */
const c1 = document.getElementById("c1"), lec1 = document.getElementById("lec1");
const M = { l: 40, r: 14, t: 14, b: 26 }, ALTO1 = 440, YMAX = 8;
let fijo = null, sobre = null;
const pinta1 = () => {
  const [x, w] = lienzo(c1, ALTO1);
  const X = (i) => M.l + (i / 365) * (w - M.l - M.r), Y = (v) => ALTO1 - M.b - (v / YMAX) * (ALTO1 - M.t - M.b);
  x.clearRect(0, 0, w, ALTO1); x.font = "12px system-ui, sans-serif"; x.textBaseline = "middle";
  for (let v = 0; v <= YMAX; v++) {
    x.strokeStyle = "rgba(27,38,44,.09)"; x.lineWidth = 1; x.beginPath(); x.moveTo(M.l, Y(v)); x.lineTo(w - M.r, Y(v)); x.stroke();
    x.fillStyle = "#5f6c72"; x.textAlign = "right"; x.fillText(v + " m", M.l - 6, Y(v));
  }
  x.textAlign = "center";
  for (let m = 0; m < 12; m++) x.fillText(MESES[m], X((INI[m] + INI[m + 1]) / 2), ALTO1 - 10);
  const raya = (v, color, texto, dy) => {
    x.setLineDash([6, 5]); x.strokeStyle = color; x.lineWidth = 1.5; x.beginPath(); x.moveTo(M.l, Y(v)); x.lineTo(w - M.r, Y(v)); x.stroke(); x.setLineDash([]);
    x.fillStyle = color; x.textAlign = "left"; x.lineWidth = 4; x.strokeStyle = "#fff"; x.strokeText(texto, M.l + 6, Y(v) + dy); x.fillText(texto, M.l + 6, Y(v) + dy);
  };
  const linea = (a, color, ancho) => {
    const s = D.anios[a]; x.strokeStyle = color; x.lineWidth = ancho; x.lineJoin = "round"; x.beginPath();
    let abierta = false;
    for (let i = 0; i < 366; i++) {
      if (s[i] == null) { if (i !== 59) abierta = false; continue; } // el 29/2 de un año no bisiesto no corta la línea
      if (abierta) x.lineTo(X(i), Y(s[i])); else { x.moveTo(X(i), Y(s[i])); abierta = true; }
    }
    x.stroke();
  };
  for (const a of ANIOS) if (a !== ULTIMO) linea(a, "rgba(27,38,44,.17)", 1);
  const marcado = sobre || fijo;
  if (marcado && marcado !== ULTIMO) linea(marcado, "#127296", 2.2);
  raya(D.alerta, "#bf3d05", "alerta de la ciudad", 11); raya(D.evacuacion, "#a5271a", "evacuación de la ciudad", -10);
  linea(ULTIMO, "#1b262c", 2.8);
  const s = D.anios[ULTIMO]; let u = 365; while (u > 0 && s[u] == null) u--;
  x.fillStyle = "#1b262c"; x.beginPath(); x.arc(X(u), Y(s[u]), 5, 0, 7); x.fill();
  x.strokeStyle = "#fff"; x.lineWidth = 2; x.stroke();
  x.textAlign = "right"; x.font = "600 13px system-ui, sans-serif"; x.lineWidth = 4; x.strokeStyle = "#fff";
  x.strokeText(ULTIMO + " · " + m2(s[u]), X(u) - 10, Y(s[u]) - 14); x.fillStyle = "#1b262c"; x.fillText(ULTIMO + " · " + m2(s[u]), X(u) - 10, Y(s[u]) - 14);
  c1._X = X; c1._Y = Y; c1._w = w;
};
const mueve1 = (e) => {
  const r = c1.getBoundingClientRect(), px = e.clientX - r.left, py = e.clientY - r.top;
  const i = Math.max(0, Math.min(365, Math.round(((px - M.l) / (c1._w - M.l - M.r)) * 365)));
  let mejor = null, dist = 1e9;
  for (const a of ANIOS) { const v = D.anios[a][i]; if (v == null) continue; const d = Math.abs(c1._Y(v) - py); if (d < dist) { dist = d; mejor = a; } }
  const a = fijo || mejor; sobre = fijo ? null : mejor;
  const v = a && D.anios[a][i];
  lec1.textContent = a && v != null ? a + " · " + fecha(i) + " · " + m2(v) : (a ? a + " · " + fecha(i) + " · sin dato" : "");
  pinta1();
};
c1.addEventListener("pointermove", mueve1);
c1.addEventListener("pointerleave", () => { sobre = null; pinta1(); });
const fichas = document.getElementById("fichas");
for (const a of ["1992", "1998", "2007", "2010", "2016", "2023"]) {
  const b = document.createElement("button"); b.type = "button"; b.textContent = a; b.setAttribute("aria-pressed", "false");
  b.addEventListener("click", () => {
    fijo = fijo === a ? null : a;
    for (const o of fichas.children) o.setAttribute("aria-pressed", String(o.textContent === fijo));
    const s = D.anios[a], mx = Math.max(...s.filter((v) => v != null));
    lec1.textContent = fijo ? a + " · máximo " + m2(mx) + " el " + fecha(s.indexOf(mx)) : "Pasá el cursor o el dedo por el gráfico.";
    pinta1();
  });
  fichas.appendChild(b);
}

/* ---------- 2: la grilla ---------- */
const c2 = document.getElementById("c2"), lec2 = document.getElementById("lec2");
const FILA = 15, G = { l: 40, t: 20 };
const P = [[232,243,248],[95,200,232],[18,114,150],[14,22,25]];
const color = (v) => {
  const t = Math.max(0, Math.min(1, v / 7.43)) * (P.length - 1), k = Math.min(P.length - 2, Math.floor(t)), f = t - k;
  return "rgb(" + P[k].map((c, j) => Math.round(c + (P[k + 1][j] - c) * f)).join(",") + ")";
};
const pinta2 = () => {
  const alto = G.t + ANIOS.length * FILA + 4, [x, w] = lienzo(c2, alto), ancho = (w - G.l) / 366;
  x.clearRect(0, 0, w, alto); x.font = "11px system-ui, sans-serif"; x.textBaseline = "middle"; x.fillStyle = "#5f6c72"; x.textAlign = "center";
  for (let m = 0; m < 12; m++) x.fillText(MESES[m], G.l + ((INI[m] + INI[m + 1]) / 2) * ancho, 9);
  ANIOS.forEach((a, f) => {
    const y = G.t + f * FILA, s = D.anios[a];
    x.fillStyle = "#5f6c72"; x.textAlign = "right"; x.fillText(a, G.l - 6, y + FILA / 2);
    for (let i = 0; i < 366; i++) {
      const v = s[i] == null && i === 59 ? s[58] : s[i]; // el 29/2 de un año no bisiesto se pinta como el 28
      if (v == null) continue;
      x.fillStyle = color(v); x.fillRect(G.l + i * ancho, y, ancho + 0.6, FILA - 2);
      if (v >= D.alerta) { x.fillStyle = "#1b262c"; x.fillRect(G.l + i * ancho, y + FILA - 4, ancho + 0.6, 2); }
    }
  });
  c2._ancho = ancho;
};
c2.addEventListener("pointermove", (e) => {
  const r = c2.getBoundingClientRect(), i = Math.floor((e.clientX - r.left - G.l) / c2._ancho), f = Math.floor((e.clientY - r.top - G.t) / FILA);
  if (i < 0 || i > 365 || f < 0 || f >= ANIOS.length) return;
  const v = D.anios[ANIOS[f]][i];
  lec2.textContent = fecha(i) + " de " + ANIOS[f] + " · " + (v == null ? "sin dato" : m2(v));
});
const rx = document.getElementById("rampa").getContext("2d");
for (let i = 0; i < 200; i++) { rx.fillStyle = color((i / 199) * 7.43); rx.fillRect(i, 0, 1, 12); }

const todo = () => { pinta1(); pinta2(); };
todo(); addEventListener("resize", todo);
</script>
</body>
</html>
`;

await writeFile(SALIDA, html);
console.log("escrito              :", SALIDA, Math.round(html.length / 1024) + " KB");
