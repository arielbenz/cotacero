/* js/placa.js — la placa 16:9 para televisión y redes (/placa).
   Lee /api/nivel, /api/rio-arriba y la serie histórica, y dibuja UNA lámina en
   un SVG de 1920×1080. Ese mismo SVG se ve en pantalla (se escala a la
   ventana, y una fuente de navegador de OBS la toma 1:1) y se exporta a PNG.

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

  /* Los mismos valores que el widget, que no puede leer app.css. */
  const PAL = CLARO
    ? {
        fondo: "#ffffff",
        panel: "rgba(27,38,44,0.05)",
        texto: "#1b262c",
        tenue: "#66747a",
        linea: "rgba(27,38,44,0.16)",
        agua: "#1f7a9e",
        alerta: "#c4410e",
        peligro: "#a5271a",
        ok: "#35785e",
      }
    : {
        fondo: "#17232a",
        panel: TRANSPARENTE ? "rgba(15,24,29,0.78)" : "rgba(255,255,255,0.06)",
        texto: "#e9eef0",
        tenue: "#93a6ad",
        linea: "rgba(233,238,240,0.16)",
        agua: "#2e9bc4",
        alerta: "#e8a33d",
        peligro: "#e57563",
        ok: "#51ab8e",
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
        " cm desde la lectura anterior";

    const x = (v) => 130 + (Math.max(0, Math.min(ESCALA_MAX, v)) / ESCALA_MAX) * 800;
    let s = "";

    if (!TRANSPARENTE)
      s += `<rect width="1920" height="1080" fill="${PAL.fondo}" />`;

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
    s += t(
      1840,
      105,
      !fecha
        ? "Sin fecha"
        : viejo
          ? `Última lectura: ${esc(fecha.slice(0, 10))} · puede estar vencida`
          : `Lectura del INA: ${esc(fecha.slice(0, 10))}`,
      { size: 34, ancla: "end", color: viejo ? PAL.alerta : PAL.tenue },
    );

    // Panel izquierdo: el nivel y la regla
    const grave = !viejo && nivel >= ALERTA;
    s += panel(80, 150, 900, 720, grave ? estadoCol : null);
    s += t(130, 215, "NIVEL DEL RÍO", { size: 26, color: PAL.tenue, ls: 3 });
    s +=
      `<text x="130" y="438" font-weight="800" fill="${PAL.texto}" letter-spacing="-6">` +
      `<tspan font-size="240">${dos(nivel)}</tspan>` +
      `<tspan font-size="86" fill="${PAL.tenue}" dx="14">m</tspan></text>`;
    s += t(130, 540, esc(estadoTxt), { size: 40, peso: 800, color: estadoCol });
    if (deltaTxt) s += t(130, 595, esc(deltaTxt), { size: 32, color: PAL.tenue });
    if (faltan) s += t(130, 648, esc(faltan), { size: 32 });

    // La regla de 0 a 8 m con las dos marcas oficiales y el récord
    s += `<rect x="130" y="715" width="800" height="26" rx="13" fill="${PAL.linea}" />`;
    s += `<rect x="130" y="715" width="${x(nivel) - 130}" height="26" rx="13" fill="${PAL.agua}"${viejo ? ' opacity="0.45"' : ""} />`;
    for (let i = 0; i <= ESCALA_MAX; i++)
      s +=
        `<line x1="${x(i)}" y1="745" x2="${x(i)}" y2="757" stroke="${PAL.tenue}" stroke-width="2" />` +
        t(x(i), 790, i, { size: 22, color: PAL.tenue, ancla: "middle", peso: 500 });
    s += `<line x1="${x(ALERTA)}" y1="695" x2="${x(ALERTA)}" y2="745" stroke="${PAL.alerta}" stroke-width="4" />`;
    s += t(x(ALERTA) - 8, 690, `Alerta ${dos(ALERTA)}`, { size: 24, color: PAL.alerta, ancla: "end" });
    s += `<line x1="${x(EVAC)}" y1="695" x2="${x(EVAC)}" y2="745" stroke="${PAL.peligro}" stroke-width="4" />`;
    s += t(x(EVAC) + 8, 690, `Evacuación ${dos(EVAC)}`, { size: 24, color: PAL.peligro });
    if (record) {
      s += `<line x1="${x(record.m)}" y1="741" x2="${x(record.m)}" y2="805" stroke="${PAL.tenue}" stroke-width="2" stroke-dasharray="5 4" />`;
      s += t(x(record.m), 835, `Récord ${record.anio}: ${dos(record.m)}`, {
        size: 24,
        color: PAL.tenue,
        ancla: "end",
      });
    }

    // Panel derecho: los últimos 30 días
    s += panel(1020, 150, 820, 720);
    s += t(1060, 215, "ÚLTIMOS 30 DÍAS", { size: 26, color: PAL.tenue, ls: 3 });
    const serie = (d.serie || []).filter((p) => Array.isArray(p) && isFinite(p[1]));
    if (serie.length >= 2) {
      const vals = serie.map((p) => p[1]);
      const lo = Math.floor(Math.min(...vals) - 0.5);
      const hi = Math.ceil(Math.max(Math.max(...vals), EVAC) + 0.3);
      const X0 = 1130, X1 = 1790, Y0 = 260, Y1 = 800;
      const px = (i) => X0 + (i / (serie.length - 1)) * (X1 - X0);
      const py = (v) => Y1 - ((v - lo) / (hi - lo)) * (Y1 - Y0);
      const paso = hi - lo > 8 ? 2 : 1;
      for (let v = lo; v <= hi; v += paso)
        s +=
          `<line x1="${X0}" y1="${py(v)}" x2="${X1}" y2="${py(v)}" stroke="${PAL.linea}" stroke-width="1.5" />` +
          t(X0 - 16, py(v) + 8, v, { size: 22, color: PAL.tenue, ancla: "end", peso: 500 });
      for (const [val, col, rot] of [
        [ALERTA, PAL.alerta, "Alerta de la ciudad"],
        [EVAC, PAL.peligro, "Evacuación de la ciudad"],
      ]) {
        s += `<line x1="${X0}" y1="${py(val)}" x2="${X1}" y2="${py(val)}" stroke="${col}" stroke-width="3" stroke-dasharray="14 10" />`;
        s += t(X1, py(val) - 10, `${rot} ${dos(val)}`, { size: 22, color: col, ancla: "end" });
      }
      const pts = serie.map((p, i) => `${px(i).toFixed(1)},${py(p[1]).toFixed(1)}`);
      s += `<polygon points="${X0},${Y1} ${pts.join(" ")} ${X1},${Y1}" fill="${PAL.agua}" opacity="0.18" />`;
      s += `<polyline points="${pts.join(" ")}" fill="none" stroke="${PAL.agua}" stroke-width="6" stroke-linejoin="round" stroke-linecap="round" />`;
      s += `<circle cx="${X1}" cy="${py(vals[vals.length - 1])}" r="11" fill="${PAL.agua}" stroke="${PAL.texto}" stroke-width="3" />`;
      const corta = (iso) => iso.slice(8, 10) + "/" + iso.slice(5, 7);
      s += t(X0, 845, corta(serie[0][0]), { size: 22, color: PAL.tenue, peso: 500 });
      s += t(X1, 845, corta(serie[serie.length - 1][0]), { size: 22, color: PAL.tenue, ancla: "end", peso: 500 });
    } else {
      s += t(1430, 520, "Sin historial reciente", { size: 30, color: PAL.tenue, ancla: "middle" });
    }

    // Río arriba: sólo escalas con lectura vigente
    const est = (arriba || []).filter((e) => {
      const hh = horasDesde(fechaINA(e.fecha_dato));
      return typeof e.altura === "number" && hh !== null && hh <= VENCE_HORAS;
    });
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
    s += t(80, 1056, "Datos: INA (SIyAH) · vía Cota Cero · cotacerosf.com", {
      size: 26,
      color: PAL.tenue,
      peso: 600,
    });
    s += t(1840, 1056, "Referencia, no pronóstico · Emergencias: 103", {
      size: 26,
      color: PAL.tenue,
      peso: 600,
      ancla: "end",
    });

    return {
      svg: s,
      resumen:
        `Río Paraná en el Puerto de Santa Fe: ${dos(nivel)} metros. ${estadoTxt}.` +
        (fecha ? ` Lectura del ${fecha.slice(0, 10)}.` : ""),
      fecha,
    };
  }

  /* ---------------- sin dato no se inventa ninguno ---------------- */
  function sinDato() {
    let s = TRANSPARENTE ? "" : `<rect width="1920" height="1080" fill="${PAL.fondo}" />`;
    s += panel(480, 360, 960, 360);
    s += t(960, 520, "Sin dato", { size: 90, peso: 800, ancla: "middle" });
    s += t(960, 600, "No se pudo leer el INA. Probá en un rato.", { size: 34, color: PAL.tenue, ancla: "middle" });
    s += t(960, 660, "Datos: INA (SIyAH) · vía Cota Cero · cotacerosf.com", { size: 26, color: PAL.tenue, ancla: "middle", peso: 600 });
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

  async function descargar() {
    const aviso = $("aviso-barra");
    const boton = $("bajar");
    boton.disabled = true;
    aviso.textContent = "Armando la imagen…";
    try {
      const b64 = await fuente();
      const dentro = $("lamina").innerHTML;
      const xml =
        `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1920 1080" width="1920" height="1080" font-family="Plus Jakarta Sans, system-ui, sans-serif">` +
        `<defs><style>@font-face{font-family:"Plus Jakarta Sans";src:url(data:font/woff2;base64,${b64}) format("woff2");font-weight:500 800}</style></defs>` +
        dentro +
        "</svg>";
      const img = new Image();
      img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(xml);
      await img.decode();
      const c = document.createElement("canvas");
      c.width = 1920;
      c.height = 1080;
      c.getContext("2d").drawImage(img, 0, 0, 1920, 1080);
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
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `cota-cero-placa-${dia}.png`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 4000);
      aviso.textContent = "Lista. Dice «Datos: INA · vía Cota Cero»: no la recortes.";
    } catch (e) {
      aviso.textContent =
        "No se pudo armar la imagen en este navegador. Capturá la pantalla.";
    } finally {
      boton.disabled = false;
    }
  }

  $("bajar").addEventListener("click", descargar);
  // La barra marca la variante que se está viendo.
  const actual = TRANSPARENTE ? "t-transp" : CLARO ? "t-claro" : "t-oscuro";
  $(actual).setAttribute("aria-current", "page");
  $(actual).style.background = "rgba(233,238,240,0.18)";

  cargar();
  // En una transmisión la página queda abierta horas: se vuelve a leer sola.
  // El CDN sirve el nivel con hasta una hora de caché, así que más seguido no
  // trae nada nuevo.
  setInterval(cargar, 10 * 60 * 1000);
})();
