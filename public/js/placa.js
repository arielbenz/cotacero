/* js/placa.js — la placa para televisión y redes (/placa).
   Lee /api/nivel, /api/rio-arriba y la serie histórica, y dibuja UNA lámina en
   un SVG de 1920×1080. Ese mismo SVG se ve en pantalla (se escala a la
   ventana, y una fuente de navegador de OBS la toma 1:1) y se exporta a PNG.

   Con ?formato=vertical la lámina es de 1080×1920, para el teléfono: estados
   de WhatsApp, historias. Dice lo mismo, apilado y con la letra más grande
   —en un teléfono 1080 px de ancho se ven en unos 390—. Sin el parámetro, una
   ventana más alta que ancha recibe la vertical; con ?limpio=1 no se adivina
   nada, porque esa URL ya está puesta en transmisiones.

   Como el widget: sin cookies, sin analytics y sin ningún dato del lector, y
   SOLO el nivel oficial y los umbrales oficiales —nunca un nivel de aviso
   personal—. Una placa viaja sin contexto y se reenvía días después, así que
   la fecha de la lectura va DENTRO de la imagen, y con el dato vencido la
   placa lo dice en vez de mostrar un número con cara de actual.

   Va envuelto en una IIFE: es un script clásico y comparte el ámbito global
   con todo lo que se cargue en la página. */
(() => {
  const { UMBRALES_RESPALDO, umbralesDe, VENCE_HORAS, nm, mCm } = self.CC_COMUN;

  const params = new URLSearchParams(location.search);
  const TRANSPARENTE = params.get("fondo") === "transparente";
  // Sobre un video se lee con letra clara: la transparencia fuerza el oscuro.
  const CLARO = params.get("tema") === "claro" && !TRANSPARENTE;
  const root = document.documentElement;
  if (CLARO) root.dataset.tema = "claro";
  if (TRANSPARENTE) root.dataset.fondo = "transparente";
  if (params.has("limpio")) root.dataset.limpio = "";
  const FORMATO = params.get("formato");
  const VERTICAL = FORMATO
    ? FORMATO === "vertical"
    : !params.has("limpio") && innerHeight > innerWidth;
  const W = VERTICAL ? 1080 : 1920;
  const H = VERTICAL ? 1920 : 1080;
  if (VERTICAL) root.dataset.formato = "vertical";

  /* Los mismos valores que los tokens de estilos/app.css (y que el widget),
     porque esto no puede leer app.css. Es una COPIA: node scripts/comprobar.js
     la compara con los tokens y mide sus pares de texto. El lienzo es el
     --panel de la app, los paneles el --panel-2, y alerta/peligro/ok son los
     -texto: acá casi todo lo que se pinta con ellos es texto. Las líneas de
     alerta y evacuación van con los --linea-*, como en la app: con los -texto
     en claro el naranja y el rojo casi no se distinguían. */
  const PAL = CLARO
    ? {
        fondo: "#ffffff",
        panel: "rgba(27, 38, 44, 0.055)",
        texto: "#1b262c",
        tenue: "#5f6c72",
        linea: "rgba(27,38,44,0.16)",
        agua: "#5fc8e8",
        alerta: "#bf3d05",
        peligro: "#bc3e2a",
        ok: "#33765c",
        lineaAlerta: "#cf440d",
        lineaEvac: "#a5271a",
      }
    : {
        fondo: "#17232a",
        panel: TRANSPARENTE ? "rgba(15,24,29,0.78)" : "rgba(233, 238, 240, 0.07)",
        texto: "#e9eef0",
        tenue: "#93a6ad",
        linea: "rgba(233,238,240,0.16)",
        agua: "#5fc8e8",
        alerta: "#e8a33d",
        peligro: "#ef7e6b",
        ok: "#54ae90",
        lineaAlerta: "#e8a33d",
        lineaEvac: "#e57563",
      };

  const ESCALA_MAX = 8; // la misma regla de 0 a 8 m que usa la app

  const $ = (id) => document.getElementById(id);
  const esc = (t) =>
    String(t).replace(
      /[&<>"]/g,
      (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c],
    );
  const dos = (v) => nm(v, 2);

  /* "01/09/2026 00:00" → Date local. Mismo criterio que el widget. */
  function fechaINA(s) {
    const m = String(s || "").match(
      /^(\d{2})\/(\d{2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2}))?/,
    );
    return m ? new Date(+m[3], +m[2] - 1, +m[1], +(m[4] || 0), +(m[5] || 0)) : null;
  }
  const horasDesde = (d) => (d ? (Date.now() - d.getTime()) / 36e5 : null);

  /* Una línea de texto. Los números y los nombres pasan por esc(). */
  function t(x, y, txt, o = {}) {
    return (
      `<text x="${x}" y="${y}" font-size="${o.size || 30}" ` +
      `font-weight="${o.peso || 700}" fill="${o.color || PAL.texto}" ` +
      (o.ancla ? `text-anchor="${o.ancla}" ` : "") +
      (o.ls ? `letter-spacing="${o.ls}" ` : "") +
      `>${txt}</text>`
    );
  }
  const panel = (x, y, w, h, borde) =>
    `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="28" fill="${PAL.panel}"` +
    (borde ? ` stroke="${borde}" stroke-width="4"` : "") +
    " />";

  const MARCA = (x, y) =>
    `<g transform="translate(${x} ${y})"><defs><clipPath id="pm">` +
    `<rect x="0" y="33" width="60" height="27" /></clipPath></defs>` +
    `<circle cx="30" cy="30" r="21" fill="${PAL.agua}" clip-path="url(#pm)" />` +
    `<circle cx="30" cy="30" r="21" fill="none" stroke="${PAL.texto}" stroke-width="7" />` +
    `<line x1="2" y1="33" x2="58" y2="33" stroke="${PAL.texto}" stroke-width="4.5" stroke-linecap="round" />` +
    "</g>";

  /* ---------------- las piezas que comparten los dos formatos ---------------- */

  /* La regla de 0 a 8 m con las dos marcas oficiales y el récord. `y` es el
     borde de arriba de la barra; `f` agranda la letra en la vertical. */
  function regla(x0, ancho, y, f, { nivel, ALERTA, EVAC, record, viejo }) {
    const x = (v) => x0 + (Math.max(0, Math.min(ESCALA_MAX, v)) / ESCALA_MAX) * ancho;
    let s = "";
    s += `<rect x="${x0}" y="${y}" width="${ancho}" height="26" rx="13" fill="${PAL.linea}" />`;
    s += `<rect x="${x0}" y="${y}" width="${x(nivel) - x0}" height="26" rx="13" fill="${PAL.agua}"${viejo ? ' opacity="0.45"' : ""} />`;
    for (let i = 0; i <= ESCALA_MAX; i++)
      s +=
        `<line x1="${x(i)}" y1="${y + 30}" x2="${x(i)}" y2="${y + 42}" stroke="${PAL.tenue}" stroke-width="2" />` +
        t(x(i), y + 75, i, { size: 22 * f, color: PAL.tenue, ancla: "middle", peso: 500 });
    s += `<line x1="${x(ALERTA)}" y1="${y - 20}" x2="${x(ALERTA)}" y2="${y + 30}" stroke="${PAL.lineaAlerta}" stroke-width="4" />`;
    s += t(x(ALERTA) - 8, y - 25, `Alerta ${dos(ALERTA)}`, { size: 24 * f, color: PAL.alerta, ancla: "end" });
    s += `<line x1="${x(EVAC)}" y1="${y - 20}" x2="${x(EVAC)}" y2="${y + 30}" stroke="${PAL.lineaEvac}" stroke-width="4" />`;
    s += t(x(EVAC) + 8, y - 25, `Evacuación ${dos(EVAC)}`, { size: 24 * f, color: PAL.peligro });
    if (record) {
      s += `<line x1="${x(record.m)}" y1="${y + 26}" x2="${x(record.m)}" y2="${y + 90}" stroke="${PAL.tenue}" stroke-width="2" stroke-dasharray="5 4" />`;
      s += t(x(record.m), y + 120, `Récord ${record.anio}: ${dos(record.m)}`, {
        size: 24 * f,
        color: PAL.tenue,
        ancla: "end",
      });
    }
    return s;
  }

  /* Los últimos 30 días, dentro del rectángulo X0–X1 × Y0–Y1. Sin serie lo
     dice, centrado en (cx, cy). */
  function ultimos30(d, ALERTA, EVAC, f, { X0, X1, Y0, Y1, cx, cy }) {
    let s = "";
    const serie = (d.serie || []).filter((p) => Array.isArray(p) && isFinite(p[1]));
    if (serie.length < 2)
      return t(cx, cy, "Sin historial reciente", { size: 30 * f, color: PAL.tenue, ancla: "middle" });
    const vals = serie.map((p) => p[1]);
    const lo = Math.floor(Math.min(...vals) - 0.5);
    const hi = Math.ceil(Math.max(Math.max(...vals), EVAC) + 0.3);
    const px = (i) => X0 + (i / (serie.length - 1)) * (X1 - X0);
    const py = (v) => Y1 - ((v - lo) / (hi - lo)) * (Y1 - Y0);
    const paso = hi - lo > 8 ? 2 : 1;
    for (let v = lo; v <= hi; v += paso)
      s +=
        `<line x1="${X0}" y1="${py(v)}" x2="${X1}" y2="${py(v)}" stroke="${PAL.linea}" stroke-width="1.5" />` +
        t(X0 - 16, py(v) + 8, v, { size: 22 * f, color: PAL.tenue, ancla: "end", peso: 500 });
    /* Los rótulos de las dos marcas van del lado donde la línea del río
       queda más lejos: con el río subiendo hasta la alerta, a la derecha la
       línea los tachaba. Y si las dos marcas quedan más juntas que un
       renglón, el de la alerta va debajo de la suya. */
    const izq = vals[0] < vals[vals.length - 1];
    const juntas = py(ALERTA) - py(EVAC) < 22 * f + 16;
    for (const [val, col, linea, rot, abajo] of [
      [ALERTA, PAL.alerta, PAL.lineaAlerta, "Alerta de la ciudad", juntas],
      [EVAC, PAL.peligro, PAL.lineaEvac, "Evacuación de la ciudad", false],
    ]) {
      s += `<line x1="${X0}" y1="${py(val)}" x2="${X1}" y2="${py(val)}" stroke="${linea}" stroke-width="3" stroke-dasharray="14 10" />`;
      s += t(izq ? X0 + 8 : X1, py(val) + (abajo ? 22 * f + 4 : -10), `${rot} ${dos(val)}`, {
        size: 22 * f,
        color: col,
        ancla: izq ? "" : "end",
      });
    }
    const pts = serie.map((p, i) => `${px(i).toFixed(1)},${py(p[1]).toFixed(1)}`);
    s += `<polygon points="${X0},${Y1} ${pts.join(" ")} ${X1},${Y1}" fill="${PAL.agua}" opacity="0.18" />`;
    s += `<polyline points="${pts.join(" ")}" fill="none" stroke="${PAL.agua}" stroke-width="6" stroke-linejoin="round" stroke-linecap="round" />`;
    s += `<circle cx="${X1}" cy="${py(vals[vals.length - 1])}" r="11" fill="${PAL.agua}" stroke="${PAL.texto}" stroke-width="3" />`;
    const corta = (iso) => iso.slice(8, 10) + "/" + iso.slice(5, 7);
    s += t(X0, Y1 + 45, corta(serie[0][0]), { size: 22 * f, color: PAL.tenue, peso: 500 });
    s += t(X1, Y1 + 45, corta(serie[serie.length - 1][0]), { size: 22 * f, color: PAL.tenue, ancla: "end", peso: 500 });
    return s;
  }

  const CREDITO = "Datos: Prefectura Naval e INA · vía Cota Cero · cotacerosf.com";
  const DESCARGO = "Referencia, no pronóstico · Emergencias: 103";

  /* ---------------- la lámina ---------------- */
  function lamina({ nivel, d, arriba, record }) {
    const of = umbralesDe(d) || UMBRALES_RESPALDO;
    const ALERTA = of.alerta;
    const EVAC = of.evacuacion;

    const fecha = String(d.fecha_dato || d.fecha_reporte || "").trim();
    const h = horasDesde(fechaINA(fecha));
    const viejo = h !== null && h > VENCE_HORAS;

    // El estado, con la alerta y la evacuación «de la ciudad». Vencido no
    // dice ninguna de las dos: una alerta de hace tres días con la cara de una
    // de hoy es peor que ninguna.
    const [estadoTxt, estadoCol] = viejo
      ? ["Dato viejo", PAL.tenue]
      : nivel >= EVAC
        ? ["Evacuación de la ciudad", PAL.peligro]
        : nivel >= ALERTA
          ? ["Alerta de la ciudad", PAL.alerta]
          : ["Debajo de la alerta de la ciudad", PAL.ok];

    let faltan = "";
    if (!viejo) {
      faltan =
        nivel >= EVAC
          ? `Superó el nivel de evacuación de la ciudad (${dos(EVAC)} m)`
          : nivel >= ALERTA
            ? `Superó la alerta de la ciudad (${dos(ALERTA)} m)`
            : `Al río le faltan ${mCm(ALERTA - nivel)} para la alerta de la ciudad`;
    }

    const delta = Number(d.delta);
    let deltaTxt = "";
    if (!viejo && isFinite(delta) && Math.abs(delta) >= 0.01)
      deltaTxt =
        (delta > 0 ? "▲ +" : "▼ −") +
        Math.round(Math.abs(delta) * 100) +
        " cm desde la lectura diaria anterior";

    const cuando = !fecha
      ? "Sin fecha"
      : viejo
        ? `Última lectura: ${esc(fecha.slice(0, 10))} · puede estar vencida`
        : d.fuente_corta === "Prefectura"
          ? `Lectura de Prefectura: ${esc(fecha.slice(0, 16))}`
          : `Lectura del INA: ${esc(fecha.slice(0, 10))}`;
    const grave = !viejo && nivel >= ALERTA;
    const marcas = { nivel, ALERTA, EVAC, record, viejo };

    // Río arriba: sólo escalas con lectura vigente
    const est = (arriba || []).filter((e) => {
      const hh = horasDesde(fechaINA(e.fecha_dato));
      return typeof e.altura === "number" && hh !== null && hh <= VENCE_HORAS;
    });

    const resumen =
      `Río Paraná en el Puerto de Santa Fe: ${dos(nivel)} metros. ${estadoTxt}.` +
      (fecha ? ` Lectura del ${fecha.slice(0, 10)}.` : "");

    if (VERTICAL)
      return {
        svg: vertical({ nivel, d, est, marcas, cuando, grave, viejo, estadoTxt, estadoCol, deltaTxt, faltan }),
        resumen,
        fecha,
      };

    let s = "";

    if (!TRANSPARENTE)
      s += `<rect width="${W}" height="${H}" fill="${PAL.fondo}" />`;

    // Sobre un video no hay fondo que garantice el contraste: la cabecera y el
    // pie —donde va el crédito— llevan su propio panel.
    if (TRANSPARENTE) {
      s += panel(60, 48, 1800, 80);
      s += panel(60, 1014, 1800, 52);
    }

    // Cabecera
    s += MARCA(80, 62);
    s += t(162, 105, "RÍO PARANÁ · PUERTO DE SANTA FE", {
      size: 34,
      color: PAL.tenue,
      ls: 3,
    });
    s += t(1840, 105, cuando, { size: 34, ancla: "end", color: viejo ? PAL.alerta : PAL.tenue });

    // Panel izquierdo: el nivel y la regla
    s += panel(80, 150, 900, 720, grave ? estadoCol : null);
    s += t(130, 215, "NIVEL DEL RÍO", { size: 26, color: PAL.tenue, ls: 3 });
    s +=
      `<text x="130" y="438" font-weight="800" fill="${PAL.texto}" letter-spacing="-6">` +
      `<tspan font-size="240">${dos(nivel)}</tspan>` +
      `<tspan font-size="86" fill="${PAL.tenue}" dx="14">m</tspan></text>`;
    s += t(130, 540, esc(estadoTxt), { size: 40, peso: 800, color: estadoCol });
    if (deltaTxt) s += t(130, 595, esc(deltaTxt), { size: 32, color: PAL.tenue });
    if (faltan) s += t(130, 648, esc(faltan), { size: 32 });

    s += regla(130, 800, 715, 1, marcas);

    // Panel derecho: los últimos 30 días
    s += panel(1020, 150, 820, 720);
    s += t(1060, 215, "ÚLTIMOS 30 DÍAS", { size: 26, color: PAL.tenue, ls: 3 });
    s += ultimos30(d, ALERTA, EVAC, 1, { X0: 1130, X1: 1790, Y0: 260, Y1: 800, cx: 1430, cy: 520 });

    // Río arriba
    if (est.length) {
      s += panel(80, 890, 1760, 120);
      s += t(120, 940, "RÍO ARRIBA", { size: 26, color: PAL.tenue, ls: 3 });
      s += t(120, 980, "escalas del INA", { size: 22, color: PAL.tenue, peso: 500 });
      const ancho = 1400 / est.length;
      est.forEach((e, i) => {
        const cx = 440 + i * ancho;
        s += t(cx, 932, esc(e.nombre), { size: 26, color: PAL.tenue });
        s += t(cx, 983, `${dos(e.altura)} m`, { size: 46, peso: 800 });
        const c = e.cambio;
        if (c && Math.abs(c.m) >= 0.01)
          s += t(
            cx + 200,
            983,
            `${c.m > 0 ? "▲" : "▼"} ${mCm(c.m)}${c.dias !== 7 ? ` (${c.dias} d)` : ""}`,
            { size: 26, color: PAL.tenue },
          );
      });
    }

    // Pie: el crédito va entero (condición 1 de /para-medios)
    s += t(80, 1056, CREDITO, {
      size: 26,
      color: PAL.tenue,
      peso: 600,
    });
    s += t(1840, 1056, DESCARGO, {
      size: 26,
      color: PAL.tenue,
      peso: 600,
      ancla: "end",
    });

    return { svg: s, resumen, fecha };
  }

  /* ---------------- la vertical, 1080×1920 ---------------- */
  /* Lo mismo que la horizontal, apilado: cabecera, el nivel con su regla, los
     últimos 30 días, río arriba y el crédito. Ninguna letra baja de 26: en el
     teléfono eso son unos 9 px. Si no hay escalas río arriba, el gráfico
     ocupa ese lugar en vez de dejar un hueco. */
  function vertical({ nivel, d, est, marcas, cuando, grave, viejo, estadoTxt, estadoCol, deltaTxt, faltan }) {
    const { ALERTA, EVAC } = marcas;
    let s = "";
    if (!TRANSPARENTE) s += `<rect width="${W}" height="${H}" fill="${PAL.fondo}" />`;
    else {
      s += panel(40, 56, 1000, 146);
      s += panel(40, 1780, 1000, 104);
    }

    // Cabecera, en dos renglones
    s += MARCA(60, 80);
    s += t(142, 123, "RÍO PARANÁ · PUERTO DE SANTA FE", { size: 34, color: PAL.tenue, ls: 3 });
    s += t(64, 180, cuando, { size: 32, color: viejo ? PAL.alerta : PAL.tenue });

    // El nivel y la regla
    s += panel(60, 215, 960, 790, grave ? estadoCol : null);
    s += t(110, 283, "NIVEL DEL RÍO", { size: 28, color: PAL.tenue, ls: 3 });
    s +=
      `<text x="110" y="545" font-weight="800" fill="${PAL.texto}" letter-spacing="-7">` +
      `<tspan font-size="280">${dos(nivel)}</tspan>` +
      `<tspan font-size="100" fill="${PAL.tenue}" dx="16">m</tspan></text>`;
    s += t(110, 640, esc(estadoTxt), { size: 46, peso: 800, color: estadoCol });
    if (deltaTxt) s += t(110, 698, esc(deltaTxt), { size: 32, color: PAL.tenue });
    if (faltan) s += t(110, 750, esc(faltan), { size: 32 });
    s += regla(110, 860, 845, 1.25, marcas);

    // Los últimos 30 días
    const fin = est.length ? 1540 : 1765;
    s += panel(60, 1030, 960, fin - 1030);
    s += t(110, 1095, "ÚLTIMOS 30 DÍAS", { size: 28, color: PAL.tenue, ls: 3 });
    s += ultimos30(d, ALERTA, EVAC, 1.25, {
      X0: 170, X1: 950, Y0: 1140, Y1: fin - 80, cx: 540, cy: (1095 + fin) / 2,
    });

    // Río arriba: una columna por escala
    if (est.length) {
      s += panel(60, 1565, 960, 200);
      s += t(110, 1617, "RÍO ARRIBA", { size: 28, color: PAL.tenue, ls: 3 });
      s += t(970, 1617, "escalas del INA", { size: 26, color: PAL.tenue, peso: 500, ancla: "end" });
      const ancho = 860 / est.length;
      est.forEach((e, i) => {
        const cx = 110 + i * ancho;
        s += t(cx, 1664, esc(e.nombre), { size: 26, color: PAL.tenue });
        s += t(cx, 1712, `${dos(e.altura)} m`, { size: 42, peso: 800 });
        const c = e.cambio;
        if (c && Math.abs(c.m) >= 0.01)
          s += t(
            cx,
            1748,
            `${c.m > 0 ? "▲" : "▼"} ${mCm(c.m)}${c.dias !== 7 ? ` (${c.dias} d)` : ""}`,
            { size: 26, color: PAL.tenue },
          );
      });
    }

    // Pie: el crédito va entero (condición 1 de /para-medios)
    s += t(540, 1822, CREDITO, { size: 27, color: PAL.tenue, peso: 600, ancla: "middle" });
    s += t(540, 1864, DESCARGO, { size: 27, color: PAL.tenue, peso: 600, ancla: "middle" });
    return s;
  }

  /* ---------------- sin dato no se inventa ninguno ---------------- */
  function sinDato() {
    let s = TRANSPARENTE ? "" : `<rect width="${W}" height="${H}" fill="${PAL.fondo}" />`;
    // El mismo cartel, centrado en la lámina que toque.
    const cx = W / 2;
    const y = H / 2 - 180;
    s += panel(cx - 480, y, 960, 360);
    s += t(cx, y + 160, "Sin dato", { size: 90, peso: 800, ancla: "middle" });
    s += t(cx, y + 240, "No se pudo leer el INA. Probá en un rato.", { size: 34, color: PAL.tenue, ancla: "middle" });
    s += t(cx, y + 300, CREDITO, { size: 26, color: PAL.tenue, ancla: "middle", peso: 600 });
    return s;
  }

  /* ---------------- datos ---------------- */
  async function json(url) {
    const r = await fetch(url, { cache: "no-store" });
    if (!r.ok) throw new Error(String(r.status));
    return r.json();
  }

  /* El récord sale de la serie histórica, no de un número escrito acá. Si el
     archivo no llega, la placa sale sin esa marca: no se rellena. */
  async function leerRecord() {
    try {
      const j = await json("/datos-abiertos/historia.json");
      let mejor = null;
      for (const a of j.anios || [])
        if (!mejor || a[1] > mejor[1]) mejor = a;
      return mejor ? { m: mejor[1], anio: mejor[0] } : null;
    } catch (e) {
      return null;
    }
  }

  let ultima = null; // lo que quedó dibujado, para el nombre del PNG

  async function cargar() {
    const svg = $("lamina");
    try {
      const [d, arriba, record] = await Promise.all([
        json("/api/nivel"),
        json("/api/rio-arriba")
          .then((j) => j.estaciones)
          .catch(() => []),
        leerRecord(),
      ]);
      const nivel = Number(d.altura);
      if (!isFinite(nivel)) throw new Error("sin altura");
      const l = lamina({ nivel, d, arriba, record });
      svg.innerHTML = l.svg;
      svg.setAttribute("aria-label", l.resumen);
      ultima = l;
      $("bajar").disabled = false;
      $("compartir").disabled = false;
    } catch (e) {
      // Si ya había una lámina buena, se queda: borrarla por una falla
      // pasajera sería peor que mostrar la última, que ya lleva su fecha.
      if (!ultima) {
        svg.innerHTML = sinDato();
        svg.setAttribute("aria-label", "Sin dato del nivel del río");
      }
    }
  }

  /* ---------------- PNG ---------------- */
  /* El SVG exportado no ve la hoja de la página: la tipografía va adentro, en
     base64, o el PNG saldría con la del sistema. */
  let fuenteB64 = null;
  async function fuente() {
    if (fuenteB64) return fuenteB64;
    const buf = new Uint8Array(
      await (await fetch("/vendor/fonts/jakarta.woff2")).arrayBuffer(),
    );
    let bin = "";
    for (let i = 0; i < buf.length; i += 0x8000)
      bin += String.fromCharCode(...buf.subarray(i, i + 0x8000));
    fuenteB64 = btoa(bin);
    return fuenteB64;
  }

  /* La imagen de lo que está dibujado, con su nombre de archivo. */
  async function armar() {
    const b64 = await fuente();
    const dentro = $("lamina").innerHTML;
    const xml =
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" font-family="Plus Jakarta Sans, system-ui, sans-serif">` +
      `<defs><style>@font-face{font-family:"Plus Jakarta Sans";src:url(data:font/woff2;base64,${b64}) format("woff2");font-weight:500 800}</style></defs>` +
      dentro +
      "</svg>";
    const img = new Image();
    img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(xml);
    await img.decode();
    const c = document.createElement("canvas");
    c.width = W;
    c.height = H;
    c.getContext("2d").drawImage(img, 0, 0, W, H);
    const blob = await new Promise((ok) => c.toBlob(ok, "image/png"));
    if (!blob) throw new Error("sin blob");
    const f = ultima && fechaINA(ultima.fecha);
    const dia = f
      ? f.getFullYear() +
        "-" +
        String(f.getMonth() + 1).padStart(2, "0") +
        "-" +
        String(f.getDate()).padStart(2, "0")
      : "hoy";
    return { blob, nombre: `cota-cero-placa-${VERTICAL ? "vertical-" : ""}${dia}.png` };
  }

  const NO_SE_PUDO = "No se pudo armar la imagen en este navegador. Capturá la pantalla.";

  async function descargar() {
    const aviso = $("aviso-barra");
    const boton = $("bajar");
    boton.disabled = true;
    aviso.textContent = "Armando la imagen…";
    try {
      const { blob, nombre } = await armar();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = nombre;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 4000);
      aviso.textContent = "Lista. Dice «Datos: Prefectura Naval e INA · vía Cota Cero»: no la recortes.";
    } catch (e) {
      aviso.textContent = NO_SE_PUDO;
    } finally {
      boton.disabled = false;
    }
  }

  /* En el teléfono, bajar un PNG y después buscarlo en la galería son tres
     pasos de más: la hoja de compartir del sistema la manda directo. La
     imagen se arma en el teléfono y sale por donde la persona elija; acá no
     se envía nada a ningún servidor. */
  const puedeCompartir = (() => {
    try {
      return (
        !!navigator.canShare &&
        navigator.canShare({ files: [new File([""], "x.png", { type: "image/png" })] })
      );
    } catch (e) {
      return false;
    }
  })();

  async function compartir() {
    const aviso = $("aviso-barra");
    const boton = $("compartir");
    boton.disabled = true;
    aviso.textContent = "Armando la imagen…";
    try {
      const { blob, nombre } = await armar();
      aviso.textContent = "";
      await navigator.share({
        files: [new File([blob], nombre, { type: "image/png" })],
        text: ultima ? ultima.resumen + " cotacerosf.com" : "",
      });
    } catch (e) {
      // Cerrar la hoja sin elegir no es un error.
      if (!e || e.name !== "AbortError")
        aviso.textContent =
          e && e.name === "NotAllowedError"
            ? "Tocá «Compartir» otra vez: la imagen ya está lista."
            : NO_SE_PUDO;
    } finally {
      boton.disabled = false;
    }
  }

  $("bajar").addEventListener("click", descargar);
  if (puedeCompartir) {
    $("compartir").hidden = false;
    $("compartir").addEventListener("click", compartir);
    // Una sola acción sólida: donde se puede compartir, es ésa.
    $("bajar").classList.remove("fuerte");
  }

  // La barra marca la variante que se está viendo, y cambiar de tema no
  // cambia de formato (ni al revés).
  const enlace = (pares) => {
    const p = new URLSearchParams(pares);
    return "?" + p.toString();
  };
  const conFormato = FORMATO ? { formato: FORMATO } : {};
  $("t-oscuro").href = enlace(conFormato);
  $("t-claro").href = enlace({ tema: "claro", ...conFormato });
  $("t-transp").href = enlace({ fondo: "transparente", ...conFormato });
  const otro = $("t-formato");
  otro.textContent = VERTICAL ? "Horizontal" : "Vertical";
  otro.href = enlace({
    ...(TRANSPARENTE ? { fondo: "transparente" } : CLARO ? { tema: "claro" } : {}),
    formato: VERTICAL ? "horizontal" : "vertical",
  });
  const actual = TRANSPARENTE ? "t-transp" : CLARO ? "t-claro" : "t-oscuro";
  $(actual).setAttribute("aria-current", "page");
  $(actual).style.background = "rgba(233,238,240,0.18)";

  // El lienzo del SVG sigue al formato; el marcado trae el horizontal.
  $("lamina").setAttribute("viewBox", `0 0 ${W} ${H}`);

  cargar();
  // En una transmisión la página queda abierta horas: se vuelve a leer sola.
  // El CDN sirve el nivel con hasta una hora de caché, así que más seguido no
  // trae nada nuevo.
  setInterval(cargar, 10 * 60 * 1000);
})();
