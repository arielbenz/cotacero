/* historia.js — "Cien años del Paraná", en /historia.
   ---------------------------------------------------------------------------
   Todo lo que dibuja esta página sale de datos/historia.json, que genera
   `node scripts/historia.js` desde la serie del INA. Ni un número está escrito
   acá adentro: si el archivo dice otra cosa, la página dice otra cosa.

   DOS DECISIONES QUE VALE ANOTAR

   1. Nada se mueve solo. Había un «Reproducir» que recorría los años y un
      tanque con dos modos; se fueron en el rediseño de 2026. Queda la franja:
      cada año es una barra del mínimo al máximo, y se elige con clic o con
      las flechas del teclado. El panel de al lado dice el detalle.
   2. La franja es un slider de verdad para el teclado y el lector de
      pantalla (role="slider", con aria-valuetext): se enfoca, y las flechas,
      Inicio y Fin mueven el año. El dibujo en sí va aria-hidden, y la tabla
      completa con los mismos números ya viene en el HTML.

   La tabla de los 102 años, las fichas de arriba y el bloque de la fuente
   YA VIENEN EN EL HTML: los emite scripts/paginas.js desde el mismo
   datos-abiertos/historia.json que lee este archivo. Antes los dibujaba acá,
   y la página no tenía un solo número para quien no ejecuta JavaScript. Este
   archivo es sólo para lo que de verdad necesita JS. No volver a mover
   contenido para acá. */

const $ = (s) => document.querySelector(s);

/* La coma decimal, de lib/comun-clasico.js: es la misma de toda la app. */
const { nm } = self.CC_COMUN;
const m2 = (v) => (v < 0 ? "−" : "") + nm(Math.abs(v), 2);
const MES = "enero febrero marzo abril mayo junio julio agosto septiembre octubre noviembre diciembre".split(" ");
/* Las fechas del archivo son AAAA-MM-DD. `new Date("1992-06-22")` las lee en
   UTC y en Argentina eso da el día anterior: el récord aparecía como 21 de
   junio. Se parten a mano. */
const enPalabras = (f) => {
  const p = /^(\d{4})-(\d{2})-(\d{2})$/.exec(f || "");
  return p ? `${+p[3]} de ${MES[+p[2] - 1]} de ${p[1]}` : "";
};
const dist = (d) =>
  Math.abs(d) < 1 ? Math.round(Math.abs(d) * 100) + " cm" : nm(Math.abs(d), 2) + " m";

/* Lo que la serie no puede decir sola. 2003 es el año de la inundación más
   grande de la ciudad y el Paraná no llegó a la alerta (5,29 m): sin esta
   nota, la barra de ese año contaría que no pasó nada. */
const NOTAS = {
  2003: "El Paraná no llegó a la alerta. La inundación de ese año la trajo el Salado.",
};

/* La escala del dibujo. El piso baja de cero porque las grandes bajantes son
   parte de la historia: con el eje arrancando en 0 no se vería que en 2022 el
   río estuvo 23 cm por debajo del cero del hidrómetro. */
const PISO = -0.6;
let TECHO = 8;

let H = null; // el JSON
let anios = []; // [{a, max, fmax, min, fmin, n, da, de}]
let idx = 0; // año seleccionado
let record = null;

async function arrancar() {
  try {
    const r = await fetch("/datos-abiertos/historia.json");
    if (!r.ok) throw new Error("no está el archivo");
    H = await r.json();
  } catch (e) {
    $("#h-cargando").textContent =
      "No se pudo cargar la serie histórica. La tabla de abajo tiene los mismos números.";
    return;
  }

  anios = H.anios.map((f) => ({
    a: f[0], max: f[1], fmax: f[2], min: f[3], fmin: f[4], n: f[5], da: f[6], de: f[7],
  }));
  // El techo del dibujo sale del propio dato, no de una constante: si alguna
  // vez hay una crecida mayor a la de 1992, la barra tiene que entrar.
  TECHO = Math.max(8, Math.ceil(Math.max(...anios.map((x) => x.max)) * 2) / 2 + 0.4);
  record = anios.reduce((p, c) => (c.max > p.max ? c : p));

  // Arranca en el récord: es el año que la gente viene a buscar.
  idx = anios.indexOf(record);
  $("#h-cargando").remove();
  $("#h-contenido").hidden = false;

  pintarFranja();
  armarControles();
  elegir(idx);
}

/* ---------- La franja del siglo ----------
   Una barra por año, del mínimo al máximo, con el color de lo más alto que
   llegó: no llegó a la alerta, llegó a la alerta, llegó a la evacuación.

   Los rótulos NO van dentro del SVG. El dibujo se estira con
   preserveAspectRatio="none" para que ocupe el ancho que haya —102 barras en
   un teléfono— y eso aplasta el texto horizontalmente. Así que el SVG dibuja
   sólo barras y líneas, y los números son HTML puesto encima por porcentaje.
   Es lo mismo que hace la regla de la app. */
function pintarFranja() {
  const W = 1000, HH = 260;
  const x = (i) => (i / (anios.length - 1)) * W;
  const y = (v) => (1 - (v - PISO) / (TECHO - PISO)) * HH;
  const pc = (v) => ((v - PISO) / (TECHO - PISO)) * 100;
  const ancho = Math.max(2, W / anios.length - 1.2);

  let g = "";
  for (const [v, color] of [
    [H.alerta, "var(--alerta)"],
    [H.evacuacion, "var(--peligro)"],
  ]) {
    g += `<line x1="0" y1="${y(v).toFixed(1)}" x2="${W}" y2="${y(v).toFixed(1)}"
      stroke="${color}" stroke-width="1" stroke-dasharray="5 4" opacity=".8"
      vector-effect="non-scaling-stroke"/>`;
  }
  g += `<line x1="0" y1="${y(0).toFixed(1)}" x2="${W}" y2="${y(0).toFixed(1)}"
    stroke="var(--linea)" stroke-width="1" vector-effect="non-scaling-stroke"/>`;

  for (let i = 0; i < anios.length; i++) {
    const e = anios[i];
    const yTop = y(e.max), yBot = y(e.min);
    const clase =
      e.max >= H.evacuacion ? "h-b-evac" : e.max >= H.alerta ? "h-b-alerta" : "h-b-normal";
    g += `<rect class="h-barra ${clase}" data-i="${i}" x="${(x(i) - ancho / 2).toFixed(1)}"
      y="${yTop.toFixed(1)}" width="${ancho.toFixed(1)}"
      height="${Math.max(2, yBot - yTop).toFixed(1)}" rx="1"/>`;
  }
  g += `<rect id="h-marca" x="0" y="0" width="${(ancho + 4).toFixed(1)}" height="${HH}"
    fill="none" stroke="var(--texto)" stroke-width="2" rx="2"
    vector-effect="non-scaling-stroke"/>`;

  // Décadas rotuladas, no los 102 años: en un teléfono no entran.
  const hitos = [];
  for (let i = 0; i < anios.length; i++) if (anios[i].a % 20 === 10) hitos.push(i);

  $("#h-franja").innerHTML =
    `<div class="h-franja-caja">
      <svg viewBox="0 0 ${W} ${HH}" preserveAspectRatio="none" aria-hidden="true"
        class="h-svg-franja">${g}</svg>
${[H.alerta, H.evacuacion]
  .map(
    (v, k) =>
      `      <span class="h-umbral ${k ? "h-peligro" : "h-alerta"}" style="bottom:${pc(v).toFixed(2)}%"
        aria-hidden="true">${k ? "Evacuación" : "Alerta"} ${nm(v, 2)}</span>`,
  )
  .join("\n")}
${[0, 2, 4, 6, 8]
  .map(
    (v) =>
      `      <span class="h-y" style="bottom:${pc(v).toFixed(2)}%" aria-hidden="true">${v}</span>`,
  )
  .join("\n")}
    </div>
    <div class="h-eje" aria-hidden="true">
${hitos
  .map(
    (i) =>
      `      <span style="left:${((i / (anios.length - 1)) * 100).toFixed(2)}%">${anios[i].a}</span>`,
  )
  .join("\n")}
    </div>`;
}

/* ---------- Elegir un año ---------- */
function armarControles() {
  const franja = $("#h-franja");
  franja.setAttribute("aria-valuemin", String(anios[0].a));
  franja.setAttribute("aria-valuemax", String(anios[anios.length - 1].a));

  franja.addEventListener("click", (ev) => {
    const b = ev.target.closest(".h-barra");
    if (b) elegir(+b.dataset.i);
  });
  franja.addEventListener("keydown", (ev) => {
    const salto = { ArrowLeft: -1, ArrowDown: -1, ArrowRight: 1, ArrowUp: 1, PageDown: -10, PageUp: 10 }[ev.key];
    if (salto) elegir(idx + salto);
    else if (ev.key === "Home") elegir(0);
    else if (ev.key === "End") elegir(anios.length - 1);
    else return;
    ev.preventDefault();
  });
  $("#h-anterior").addEventListener("click", () => elegir(idx - 1));
  $("#h-siguiente").addEventListener("click", () => elegir(idx + 1));
}

function elegir(i) {
  idx = Math.max(0, Math.min(anios.length - 1, i));
  const e = anios[idx];

  const marca = $("#h-marca");
  if (marca) {
    const W = 1000;
    const ancho = Math.max(2, W / anios.length - 1.2);
    const x = (idx / (anios.length - 1)) * W;
    marca.setAttribute("x", Math.max(0, Math.min(W - ancho - 4, x - ancho / 2 - 2)).toFixed(1));
  }

  const franja = $("#h-franja");
  franja.setAttribute("aria-valuenow", String(e.a));
  franja.setAttribute("aria-valuetext", `${e.a}: máximo ${m2(e.max)} metros`);
  $("#h-anterior").disabled = idx === 0;
  $("#h-siguiente").disabled = idx === anios.length - 1;

  pintarDetalle(e);
}

/* El texto del año: qué tan alto llegó contra la alerta y la evacuación de
   la ciudad, que es lo que hace que el número signifique algo. */
function textoDelAnio(e) {
  let t;
  if (NOTAS[e.a]) t = NOTAS[e.a];
  else if (e === record)
    t = `El récord: ${dist(e.max - H.evacuacion)} por encima de la evacuación de la ciudad.`;
  else if (e.max >= H.evacuacion)
    t = `Pasó la evacuación de la ciudad por ${dist(e.max - H.evacuacion)}.`;
  else if (e.max >= H.alerta) t = "Llegó a la alerta de la ciudad, sin pasar la evacuación.";
  else t = `No llegó a la alerta de la ciudad: le faltaron ${dist(H.alerta - e.max)}.`;
  if ((H.incompletos || []).includes(e.a))
    t += ` Año incompleto: ${e.n} días medidos, no se compara de igual a igual con un año entero.`;
  return t;
}

function pintarDetalle(e) {
  const tono = e.max >= H.evacuacion ? "h-t-evac" : e.max >= H.alerta ? "h-t-alerta" : "";
  $("#h-anio").textContent = e.a;
  $("#h-detalle-datos").innerHTML = `
    <div><span class="eti">Máximo</span><b class="${tono}">${m2(e.max)} m</b><span class="chico">${enPalabras(e.fmax)}</span></div>
    <div><span class="eti">Mínimo</span><b>${m2(e.min)} m</b><span class="chico">${enPalabras(e.fmin)}</span></div>
    <div><span class="eti">Días en alerta</span><b>${e.da}</b><span class="chico">${
      e.de ? `${e.de} en evacuación` : e.da ? "ninguno en evacuación" : "&nbsp;"
    }</span></div>`;
  $("#h-detalle-texto").textContent = textoDelAnio(e);
}

arrancar();
