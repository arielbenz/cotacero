/* widget/widget.js — el widget que embeben los medios.
   Lee /api/nivel y pinta la tarjeta. Nada más: sin cookies, sin analytics y
   sin ningún dato del lector. Si esto creciera, que crezca para otro lado —
   el argumento de venta del widget es justamente que no rastrea a nadie.

   Muestra SIEMPRE el nivel oficial y los umbrales oficiales. Nunca el umbral
   personal de nadie: eso se calcula con la cota de un terreno, no existe fuera
   de la app, y publicado en un medio se leería como pronóstico de inundación.
   Ver la página /para-medios, condición 2. */

/* Los umbrales de respaldo, el filtro de plausibilidad, el vencimiento y la
   coma decimal salen de lib/comun-clasico.js, el mismo archivo que leen el
   sitio y el service worker. Es un pedido más desde el iframe, del propio
   origen —la CSP del widget no se toca—, y a cambio el widget deja de tener
   su propia copia del 5,30 y del filtro. */
const { UMBRALES_RESPALDO, umbralesDe, VENCE_HORAS, nm } = self.CC_COMUN;

/* Con `let` para poder adoptar los que publica la estación, y con las marcas
   de la regla redibujadas cuando eso pasa. */
let ALERTA = UMBRALES_RESPALDO.alerta;
let EVACUACION = UMBRALES_RESPALDO.evacuacion;
const ESCALA_MAX = 8; // la misma regla de 0 a 8 m que usa la app

const $ = (id) => document.getElementById(id);
const dosDec = (v) => nm(v, 2);

/* El tema llega por querystring porque el widget vive en un iframe: adentro no
   se sabe si el sitio que lo embebe es claro u oscuro, y prefers-color-scheme
   respondería al sistema del lector, que es otra cosa. Lo elige quien embebe. */
const params = new URLSearchParams(location.search);
if (params.get("theme") === "dark")
  document.documentElement.dataset.theme = "dark";

const pct = (v) => Math.max(0, Math.min(100, (v / ESCALA_MAX) * 100)) + "%";
function marcarUmbrales() {
  $("m-alerta").style.left = pct(ALERTA);
  $("m-evac").style.left = pct(EVACUACION);
  // Los rótulos también: si el INA corrigiera un umbral, la marca y el número
  // que la nombra no pueden decir cosas distintas.
  $("rot-alerta").textContent = "Alerta " + dosDec(ALERTA);
  $("rot-evac").textContent = "Evac. " + dosDec(EVACUACION);
}
marcarUmbrales();

/* El INA publica una lectura por día, pero puede saltearse una: el delta que
   viene es "contra la medición anterior", no "por día". Se dice así. */
function pintar(d) {
  const nivel = Number(d.altura);
  if (!isFinite(nivel)) return fallar();

  // Mismo filtro de plausibilidad que la app: la evacuación tiene que estar
  // por encima de la alerta o no se adopta nada. Ahora literalmente el mismo.
  const of = umbralesDe(d);
  if (of) {
    ALERTA = of.alerta;
    EVACUACION = of.evacuacion;
    marcarUmbrales();
  }

  $("nivel").textContent = dosDec(nivel);
  $("agua").style.width = pct(nivel);

  const fecha = String(d.fecha_dato || d.fecha_reporte || "").trim();
  $("fecha").textContent = fecha || "sin fecha";

  // ¿El dato es de ahora? Si el reporte trae fecha y hora, se compara.
  const t = fechaINA(fecha);
  const viejo = t && (Date.now() - t) / 36e5 > VENCE_HORAS;
  if (viejo) $("pulso").classList.add("viejo");

  const delta = Number(d.delta);
  if (isFinite(delta) && Math.abs(delta) >= 0.01) {
    const cm = Math.round(Math.abs(delta) * 100);
    /* La píldora va corta —"▲ +2 cm"— y el "desde cuándo" en el title. Poner
       "cm/día" sería más lindo y sería una afirmación: el INA publica una
       lectura por día, pero puede saltearse una, y ahí el delta abarca dos. */
    $("delta").textContent = (delta > 0 ? "▲ +" : "▼ −") + cm + " cm";
    $("delta").title = "Desde la medición anterior del INA";
    $("delta").hidden = false;
  }

  const falta = ALERTA - nivel;
  $("falta").innerHTML =
    falta > 0
      ? "Faltan <b>" +
        Math.round(falta * 100) +
        " cm</b> para la alerta oficial de 5,30 m."
      : nivel >= EVACUACION
        ? "El río <b>superó el nivel de evacuación</b> de 5,70 m."
        : "El río <b>superó la alerta oficial</b> de 5,30 m.";

  if (viejo)
    $("falta").innerHTML +=
      " <b>Esta lectura no es de hoy</b>: es la del " + fecha + ".";
}

/* El reporte del INA viene como "01/09/2026 00:00" o "01/09/2026". */
function fechaINA(s) {
  const m = String(s).match(
    /^(\d{2})\/(\d{2})\/(\d{4})(?:\s+(\d{2}):(\d{2}))?$/,
  );
  if (!m) return null;
  return new Date(
    +m[3],
    +m[2] - 1,
    +m[1],
    +(m[4] || 0),
    +(m[5] || 0),
  ).getTime();
}

/* Sin dato no se inventa ninguno: se dice que no se pudo leer y se deja el
   enlace, que es lo único que sigue sirviendo. */
function fallar() {
  $("nivel").textContent = "—";
  $("pulso").classList.add("viejo");
  $("fecha").textContent = "sin dato";
  $("falta").innerHTML =
    "No se pudo leer el nivel del INA. <b>Probá de nuevo en un rato.</b>";
}

fetch("/api/nivel")
  .then((r) => (r.ok ? r.json() : Promise.reject(new Error(r.status))))
  .then(pintar)
  .catch(fallar);
