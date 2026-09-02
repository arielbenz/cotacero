/* historia.js — "Cien años del Paraná", en /historia.
   ---------------------------------------------------------------------------
   Todo lo que dibuja esta página sale de datos/historia.json, que genera
   `node scripts/historia.js` desde la serie del INA. Ni un número está escrito
   acá adentro: si el archivo dice otra cosa, la página dice otra cosa.

   TRES DECISIONES QUE VALE ANOTAR

   1. Sin autoplay. La animación existe, pero arranca sólo si alguien toca
      "Reproducir". Una página que se mueve sola mientras se lee es molesta
      siempre, y en una app que se abre durante una crecida, peor.
   2. `prefers-reduced-motion` no desactiva el botón: quita las transiciones.
      Quien pidió menos movimiento igual puede recorrer los años, sólo que la
      línea del agua salta en vez de deslizarse.
   3. El control es un <input type=range>. Nativo: llega con teclado, con
      lector de pantalla y con el gesto de arrastre del sistema. Un slider
      propio hubiera necesitado las tres cosas a mano y peor.

   La franja del siglo va aria-hidden y al lado hay una tabla de verdad con
   los mismos números: un dibujo de 102 barras no se puede leer en voz alta. */

const $ = (s) => document.querySelector(s);

const m1 = (v) => (Math.round(v * 10) / 10).toFixed(1).replace(".", ",");
const m2 = (v) => v.toFixed(2).replace(".", ",");
const MES = "enero febrero marzo abril mayo junio julio agosto septiembre octubre noviembre diciembre".split(" ");
/* Las fechas del archivo son AAAA-MM-DD. `new Date("1992-06-22")` las lee en
   UTC y en Argentina eso da el día anterior: el récord aparecía como 21 de
   junio. Se parten a mano. */
const enPalabras = (f) => {
  const p = /^(\d{4})-(\d{2})-(\d{2})$/.exec(f || "");
  return p ? `${+p[3]} de ${MES[+p[2] - 1]} de ${p[1]}` : "";
};

/* La escala del dibujo. El piso baja de cero porque las grandes bajantes son
   parte de la historia: con el eje arrancando en 0 no se vería que en 2022 el
   río estuvo 23 cm por debajo del cero del hidrómetro. */
const PISO = -0.6;
let TECHO = 8;

let H = null; // el JSON
let anios = []; // [{a, max, fmax, min, fmin, n, da, de}]
let modo = "anios";
let idx = 0; // año seleccionado
let nivelLibre = 5.3; // metros, en el modo "mover el río"
let reproduciendo = null;

const menosMovimiento = () =>
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

async function arrancar() {
  try {
    const r = await fetch("/datos-abiertos/historia.json");
    if (!r.ok) throw new Error("no está el archivo");
    H = await r.json();
  } catch (e) {
    $("#h-cargando").textContent =
      "No se pudo cargar la serie histórica. Probá recargar la página.";
    return;
  }

  anios = H.anios.map((f) => ({
    a: f[0], max: f[1], fmax: f[2], min: f[3], fmin: f[4], n: f[5], da: f[6], de: f[7],
  }));
  // El techo del dibujo sale del propio dato, no de una constante: si alguna
  // vez hay una crecida mayor a la de 1992, la barra tiene que entrar.
  TECHO = Math.max(8, Math.ceil(Math.max(...anios.map((x) => x.max)) * 2) / 2 + 0.4);

  idx = anios.length - 1;
  $("#h-cargando").remove();
  $("#h-contenido").hidden = false;

  pintarFranja();
  armarControles();
  sincronizar();
}

/* ---------- La franja del siglo ----------
   Una barra por año, del mínimo al máximo. Es la vista que contesta "¿qué tan
   extraordinario fue cada evento?" sin que haya que tocar nada.

   Los rótulos NO van dentro del SVG. El dibujo se estira con
   preserveAspectRatio="none" para que ocupe el ancho que haya —102 barras en
   un teléfono— y eso aplasta el texto horizontalmente: los años quedaban
   ilegibles. Las barras aguantan la deformación, las letras no. Así que el
   SVG dibuja sólo barras y líneas, y los números son HTML de verdad puesto
   encima por porcentaje. Es lo mismo que hace la regla de la app. */
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
    const yTop = y(e.max), yBot = y(Math.min(e.min, 0));
    const color =
      e.max >= H.evacuacion ? "var(--peligro)"
      : e.max >= H.alerta ? "var(--alerta)"
      : "var(--agua)";
    g += `<rect class="h-barra" data-i="${i}" x="${(x(i) - ancho / 2).toFixed(1)}"
      y="${yTop.toFixed(1)}" width="${ancho.toFixed(1)}"
      height="${Math.max(1.5, yBot - yTop).toFixed(1)}" fill="${color}" opacity=".85"/>`;
  }
  g += `<rect id="h-marca" x="0" y="0" width="${(ancho + 4).toFixed(1)}" height="${HH}"
    fill="none" stroke="var(--texto)" stroke-width="1.5" rx="2"
    vector-effect="non-scaling-stroke"/>`;

  // Décadas rotuladas, no los 102 años: en un teléfono no entran. La primera
  // y la última se anclan a los bordes para que no se salgan de la caja.
  const hitos = [];
  for (let i = 0; i < anios.length; i++)
    if (anios[i].a % 25 === 0) hitos.push(i);
  if (hitos[0] > 2) hitos.unshift(0);
  else hitos[0] = 0;
  // El último año se ancla al borde derecho, pero sólo si no queda encima del
  // hito anterior: con 2025 y 2026 pegados los dos rótulos se leían "202625".
  const ult = anios.length - 1;
  if (ult - hitos[hitos.length - 1] > 4) hitos.push(ult);
  else hitos[hitos.length - 1] = ult;

  $("#h-franja").innerHTML =
    `<div class="h-franja-caja">
      <svg viewBox="0 0 ${W} ${HH}" preserveAspectRatio="none" aria-hidden="true"
        class="h-svg-franja">${g}</svg>
${[H.alerta, H.evacuacion]
  .map(
    (v, k) =>
      `      <span class="h-umbral ${k ? "h-peligro" : "h-alerta"}" style="bottom:${pc(v).toFixed(2)}%"
        aria-hidden="true">${k ? "evacuación" : "alerta"} ${m1(v)}</span>`,
  )
  .join("\n")}
${[0, 2, 4, 6]
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

  $("#h-franja").addEventListener("click", (ev) => {
    const b = ev.target.closest(".h-barra");
    if (!b) return;
    modo = "anios";
    idx = +b.dataset.i;
    sincronizar();
  });
  moverMarca();
}

function moverMarca() {
  const marca = $("#h-marca");
  if (!marca) return;
  const W = 1000;
  const ancho = Math.max(2, W / anios.length - 1.2);
  const x = (idx / (anios.length - 1)) * W;
  marca.setAttribute("x", Math.max(0, Math.min(W - ancho - 4, x - ancho / 2 - 2)).toFixed(1));
  marca.setAttribute("opacity", modo === "anios" ? "1" : "0");
}

/* ---------- El tanque ----------
   La misma pieza sirve para los dos modos: en "años" la línea del agua se
   pone en el máximo de ese año, en "mover el río" en lo que diga el control.
   Un solo dibujo, dos preguntas. */
function pintarTanque() {
  const v = modo === "anios" ? anios[idx].max : nivelLibre;
  const alto = ((v - PISO) / (TECHO - PISO)) * 100;
  const agua = $("#h-agua");
  agua.style.height = Math.max(0, Math.min(100, alto)) + "%";
  agua.classList.toggle("h-sin-transicion", menosMovimiento());

  const marcas = [
    [H.alerta, "Alerta", "alerta"],
    [H.evacuacion, "Evacuación", "peligro"],
  ];
  const rec = anios.reduce((p, c) => (c.max > p.max ? c : p));
  marcas.push([rec.max, "Récord " + rec.a, "record"]);
  if (H.cuantiles) marcas.push([H.cuantiles[50], "Mediana del siglo", "tenue"]);

  $("#h-marcas").innerHTML = marcas
    .map(([mv, txt, cls]) => {
      const b = ((mv - PISO) / (TECHO - PISO)) * 100;
      return `<div class="h-marca h-${cls}" style="bottom:${b.toFixed(2)}%">
        <span>${txt} · ${m1(mv)} m</span></div>`;
    })
    .join("");

  pintarLectura();
}

function pintarLectura() {
  const caja = $("#h-lectura");
  if (modo === "libre") {
    const v = nivelLibre;
    const arribaDe = porcentajeDebajo(v);
    const anosAsi = anios.filter((e) => e.max >= v).length;
    caja.innerHTML = `
      <span class="eti">Si el hidrómetro marcara</span>
      <div class="h-num">${m2(v)} m</div>
      <ul class="h-lista">
        <li>${relativo(v, H.alerta, "la alerta")}</li>
        <li>${relativo(v, H.evacuacion, "la evacuación")}</li>
        <li>El río estuvo por debajo de este nivel el <b>${arribaDe}&nbsp;%</b> de los
          ${H.dias.toLocaleString("es-AR")} días medidos desde ${H.desde.slice(0, 4)}.</li>
        <li><b>${anosAsi}</b> de los ${anios.length} años registrados llegaron al menos hasta acá.</li>
      </ul>`;
    return;
  }
  const e = anios[idx];
  const incompleto = (H.incompletos || []).includes(e.a);
  caja.innerHTML = `
    <span class="eti">Máximo del año</span>
    <div class="h-anio">${e.a}</div>
    <div class="h-num">${m2(e.max)} m</div>
    <p class="chico" style="margin:2px 0 12px">El ${enPalabras(e.fmax)}.</p>
    <ul class="h-lista">
      <li>${
        e.da === 0
          ? "No llegó a la alerta de " + m1(H.alerta) + " m en todo el año."
          : `<b>${e.da}</b> ${e.da === 1 ? "día" : "días"} en alerta (≥ ${m1(H.alerta)} m)` +
            (e.de ? `, de los cuales <b>${e.de}</b> en nivel de evacuación (≥ ${m1(H.evacuacion)} m).` : ".")
      }</li>
      <li>Mínimo del año: <b>${m2(e.min)} m</b>, el ${enPalabras(e.fmin)}.</li>
      ${
        incompleto
          ? `<li class="h-ojo">Año incompleto: ${e.n} días medidos. No se puede comparar de igual a igual con un año entero.</li>`
          : ""
      }
    </ul>`;
}

const relativo = (v, ref, nombre) => {
  const d = v - ref;
  if (Math.abs(d) < 0.005) return `Justo en ${nombre} (${m1(ref)} m).`;
  const cm = Math.abs(d) < 1 ? Math.round(Math.abs(d) * 100) + " cm" : m1(Math.abs(d)) + " m";
  return d > 0
    ? `<b>${cm}</b> por encima de ${nombre} (${m1(ref)} m).`
    : `${cm} por debajo de ${nombre} (${m1(ref)} m).`;
};

/* Qué porción de los días medidos quedó por debajo de este nivel. Sale de los
   101 escalones que dejó el script, o sea de la serie del INA y no de una
   categoría inventada por nosotros. */
function porcentajeDebajo(v) {
  const q = H.cuantiles;
  if (!q) return "—";
  let p = 0;
  while (p < 100 && q[p + 1] <= v) p++;
  return p;
}

/* ---------- Controles ---------- */
function armarControles() {
  const rango = $("#h-rango");
  rango.max = String(anios.length - 1);
  rango.value = String(idx);

  rango.addEventListener("input", () => {
    if (modo === "anios") idx = +rango.value;
    else nivelLibre = PISO + (+rango.value / 1000) * (TECHO - PISO);
    sincronizar(true);
  });

  for (const btn of document.querySelectorAll("[data-modo]")) {
    btn.addEventListener("click", () => {
      modo = btn.dataset.modo;
      parar();
      sincronizar();
    });
  }

  $("#h-play").addEventListener("click", () => (reproduciendo ? parar() : tocar()));
}

function sincronizar(desdeElControl) {
  const rango = $("#h-rango");
  for (const b of document.querySelectorAll("[data-modo]"))
    b.setAttribute("aria-pressed", String(b.dataset.modo === modo));

  if (modo === "anios") {
    rango.max = String(anios.length - 1);
    rango.step = "1";
    rango.setAttribute("aria-label", "Año");
    if (!desdeElControl) rango.value = String(idx);
    rango.setAttribute("aria-valuetext", `${anios[idx].a}: máximo ${m2(anios[idx].max)} metros`);
    $("#h-play").hidden = false;
    $("#h-pie-control").textContent = `${anios[0].a} — ${anios[anios.length - 1].a}`;
  } else {
    rango.max = "1000";
    rango.step = "1";
    rango.setAttribute("aria-label", "Altura del hidrómetro, en metros");
    if (!desdeElControl)
      rango.value = String(Math.round(((nivelLibre - PISO) / (TECHO - PISO)) * 1000));
    rango.setAttribute("aria-valuetext", `${m2(nivelLibre)} metros`);
    $("#h-play").hidden = true;
    parar();
    $("#h-pie-control").textContent = `${m1(PISO)} m — ${m1(TECHO)} m`;
  }
  moverMarca();
  pintarTanque();
}

function tocar() {
  if (idx >= anios.length - 1) idx = 0;
  $("#h-play").textContent = "Pausar";
  $("#h-play").setAttribute("aria-label", "Pausar el recorrido");
  const paso = menosMovimiento() ? 420 : 190;
  reproduciendo = setInterval(() => {
    if (idx >= anios.length - 1) return parar();
    idx++;
    $("#h-rango").value = String(idx);
    sincronizar();
  }, paso);
}

function parar() {
  if (reproduciendo) clearInterval(reproduciendo);
  reproduciendo = null;
  const b = $("#h-play");
  if (b) {
    b.textContent = "Reproducir";
    b.setAttribute("aria-label", "Recorrer los años uno por uno");
  }
}

/* Las listas de crecidas y bajantes, la tabla de los 102 años y el bloque de
   la fuente YA VIENEN EN EL HTML: los emite scripts/paginas.js desde el mismo
   datos-abiertos/historia.json que lee este archivo. Antes los dibujaba acá, y
   el resultado era que la página no tenía un solo número para quien no
   ejecuta JavaScript — un buscador, un lector de pantalla, alguien con mala
   conexión. Este archivo quedó para lo único que de verdad necesita JS: la
   franja del siglo y el tanque que se recorre. No volver a mover contenido
   para acá. */

arrancar();
