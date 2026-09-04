/* js/app/rio.js — el nivel del río: leerlo, dibujarlo y ubicarlo.
   Tres fuentes en orden: /api/nivel, el último valor guardado (con su fecha,
   y vencido pasadas 48 h) y lo que la persona cargue a mano. Nunca se inventa
   un número.
   Acá viven también la regla —el elemento firma de la app— y el contexto
   histórico, que sale de la serie del INA y no de una categoría inventada
   por nosotros. */

import { guardarUmbral, pintarAvisos } from "./avisos.js";
import { pintarBienvenida } from "./bienvenida.js";
import {
  CONFIG,
  ESCALA_MAX,
  ESCALA_MIN,
  MOCHILA,
  VENCE_HORAS,
} from "./config.js";
import { calcular, cotaEnHidrometro } from "./cota.js";
import { curvas } from "./elevacion.js";
import { estado, guardado } from "./estado.js";
import { aNumero, atr, fechaINA, horasDesde, m, mCm, mU } from "./formato.js";
import { FUENTE_RIO } from "./fuentes.js";
import {
  ALERTA,
  EVACUACION,
  RECORD,
  RECORD_ANIO,
  etiquetaRecord,
  fijarRecord,
  fijarUmbrales,
} from "./oficiales.js";

// Lo sella cargarRio() y lo lee refrescarSiHaceFalta(). Va acá y no al
// lado del listener para no asignarlo antes de su propia declaración.
export let ultimoRefresco = 0;

/* ---------------- navegación ---------------- */

/* Los umbrales que publica la estación reemplazan a los nuestros, con un
   filtro: sólo si son números plausibles y en el orden correcto. Un cambio
   silencioso de la API no puede dejar la regla con la evacuación por debajo
   de la alerta. */
function adoptarUmbrales(j) {
  const a = j.alerta,
    e = j.evacuacion;
  if (typeof a !== "number" || typeof e !== "number") return;
  if (!(a > 0 && e > a && e < 10)) return;
  if (a === ALERTA && e === EVACUACION) return;
  fijarUmbrales(a, e);
  REFERENCIAS[0][1] = a;
  REFERENCIAS[1][1] = e;
}

export async function cargarRio() {
  // Marcamos que estamos buscando: sin esto, entre el "Cargando" inicial y
  // el resultado no había diferencia visible con el estado de falla.
  const ver = document.getElementById("veredicto-rio");
  if (estado.rio == null) ver.classList.add("cargando");
  document.getElementById("origen-dato").textContent =
    "Buscando el nivel del río…";
  let valor = null,
    origen = "",
    extra = "";
  // El delta pertenece a la lectura fresca: si caemos a un valor
  // guardado no corresponde arrastrar el de la sesión anterior.
  estado.delta = null;
  estado.rioFecha = "";
  estado.rioVencido = false;
  ultimoRefresco = Date.now();

  // Fuente 1: nuestra función que lee el reporte diario del INA
  try {
    const r = await fetch(CONFIG.NIVEL_ENDPOINT, { cache: "no-store" });
    if (r.ok) {
      const j = await r.json();
      if (typeof j.altura === "number") {
        valor = j.altura;
        origen =
          j.origen === "api"
            ? "INA · Sistema de Alerta Hidrológico (SIyAH)"
            : "INA · reporte diario";
        estado.rioVia = j.origen || "";
        estado.rioVerificar = j.verificar || "";
        // El cero IGN que publica el INA para esta escala. No entra en el
        // cálculo —ver /datos, "Discusiones abiertas"—, se guarda para poder
        // mostrarlo al lado del que sí usamos.
        estado.ceroINA = typeof j.cero_ign === "number" ? j.cero_ign : null;
        adoptarUmbrales(j);
        if (j.fecha_dato) {
          extra = " Medición del " + j.fecha_dato + ".";
          estado.rioFecha = j.fecha_dato;
        }
        if (typeof j.delta === "number") estado.delta = j.delta;
        guardado.set("cc_rio_auto", String(j.altura));
        guardado.set("cc_rio_fecha", j.fecha_dato || "");
      }
    }
  } catch (e) {
    /* pasamos a la siguiente */
  }

  // Fuente 2: último valor automático conocido
  if (valor === null) {
    const a = guardado.get("cc_rio_auto");
    if (a) {
      valor = parseFloat(a);
      origen = "último dato del INA guardado";
      // cc_rio_fecha se guardaba y no se leía nunca. Decir de cuándo es
      // el número importa más que avisar en abstracto que puede ser
      // viejo, y pasadas VENCE_HORAS deja de presentarse como vigente:
      // durante una crecida, un nivel de hace cinco días con la misma
      // tipografía que el de hoy es peor que no tener ninguno.
      const f = guardado.get("cc_rio_fecha");
      const horas = horasDesde(fechaINA(f));
      estado.rioFecha = f || "";
      estado.rioVencido = horas === null || horas > VENCE_HORAS;
      extra = f
        ? " Es la medición del " + f + ", no el valor de ahora."
        : " Puede estar desactualizado.";
    }
  }

  // Fuente 3: último valor que cargó la persona
  if (valor === null) {
    const g = guardado.get("cc_rio");
    if (g) {
      valor = parseFloat(g);
      origen = "último valor cargado a mano";
      estado.rioVencido = true; // no sabemos de cuándo es ni de dónde salió
    }
  }

  if (valor === null) {
    estado.rio = null;
    estado.rioOrigen = "";
    document.getElementById("origen-dato").innerHTML =
      '<b style="color:var(--alerta-texto)">Sin dato automático.</b> Cargá la altura a mano acá abajo. ' +
      "La publican el INA, Prefectura y la FICH-UNL todos los días.";
    document.getElementById("det-manual").open = true;
  } else {
    estado.rio = valor;
    estado.rioOrigen = origen;
    /* La fuente deja de ser una frase y pasa a ser algo que se puede abrir.
       Es la diferencia entre "confiá en nosotros" y "andá a mirarlo": el
       enlace apunta al reporte del INA, y cuando contestó la API también al
       pedido exacto que devolvió este número. */
    document.getElementById("origen-dato").innerHTML =
      (estado.rioVencido
        ? '<b style="color:var(--alerta-texto)">Dato vencido.</b> '
        : "") +
      "Fuente: " +
      origen +
      "." +
      extra +
      ' <a href="' +
      atr(FUENTE_RIO) +
      '" target="_blank" rel="noopener">Ver el reporte del INA</a>' +
      (estado.rioVerificar
        ? ' · <a href="' +
          atr(estado.rioVerificar) +
          '" target="_blank" rel="noopener">ver el dato crudo</a>'
        : "");
    if (estado.rioVencido) document.getElementById("det-manual").open = true;
  }
  ver.classList.remove("cargando");
  pintarRio();
  calcular();
}

/* ---- Tendencia del caudal (GloFAS vía Open-Meteo) ----
   Esto SÍ funciona sin servidor ni clave. Ojo: es caudal en m³/s, no altura
   en metros. No sirve para decir "el río está en X", sí para ver si viene
   subiendo o bajando, y trae 7 días de pronóstico. */
export async function cargarTendencia() {
  const caja = document.getElementById("tendencia");
  try {
    const u =
      "https://flood-api.open-meteo.com/v1/flood?latitude=-31.63&longitude=-60.70" +
      "&daily=river_discharge&past_days=30&forecast_days=7";
    const r = await fetch(u);
    const j = await r.json();
    const fechas = (j.daily && j.daily.time) || [];
    const bruta = (j.daily && j.daily.river_discharge) || [];
    if (fechas.length !== bruta.length || fechas.length < 10)
      throw new Error("serie corta");

    // El índice de hoy sale de las fechas, no de contar past_days.
    // GloFAS devuelve huecos (null); filtrarlos corría las posiciones y
    // "hoy" terminaba apuntando a otro día sin que fallara nada visible.
    const hoyISO = new Date().toLocaleDateString("en-CA", {
      timeZone: "America/Argentina/Buenos_Aires",
    });
    let hoyIdx = fechas.indexOf(hoyISO);
    if (hoyIdx === -1) hoyIdx = fechas.findIndex((f) => f >= hoyISO);
    if (hoyIdx === -1) hoyIdx = fechas.length - 1;

    // Los huecos se rellenan con el valor válido más cercano, sin mover
    // los índices.
    const cerca = (i) => {
      for (let d = 0; d < bruta.length; d++) {
        if (typeof bruta[i - d] === "number") return bruta[i - d];
        if (typeof bruta[i + d] === "number") return bruta[i + d];
      }
      return null;
    };
    const serie = bruta.map((_, i) => cerca(i));

    const hoy = cerca(hoyIdx);
    const haceUnaSemana = cerca(Math.max(0, hoyIdx - 7));
    const futuro = cerca(bruta.length - 1);
    if (hoy == null || haceUnaSemana == null || futuro == null)
      throw new Error("sin datos");

    // Sin este guard, un caudal de referencia en 0 daba "+Infinity%".
    const variacion = (a, b) => (b > 0 ? ((a - b) / b) * 100 : null);
    const camb = variacion(hoy, haceUnaSemana);
    const proy = variacion(futuro, hoy);
    if (camb === null) throw new Error("referencia en cero");

    let flecha, color, txt;
    if (camb > 8) {
      flecha = "↗";
      color = "var(--alerta)";
      txt = "Viene subiendo";
    } else if (camb < -8) {
      flecha = "↘";
      color = "var(--ok)";
      txt = "Viene bajando";
    } else {
      flecha = "→";
      color = "var(--tenue)";
      txt = "Estable";
    }

    caja.innerHTML = `<span class="eti">Caudal del Paraná · modelo GloFAS</span>
<div class="tend">
  <div class="flecha" style="color:${color}">${flecha}</div>
  <div>
    <div style="font-family:var(--sans);font-weight:700;font-size: var(--t-l);
      letter-spacing:.03em;text-transform:uppercase;color:${color}">${txt}</div>
    <div class="chico">${camb >= 0 ? "+" : ""}${camb.toFixed(0)}% en los últimos 7 días${
      proy === null
        ? ""
        : ` · proyección a 7 días: ${proy >= 0 ? "+" : ""}${proy.toFixed(0)}%`
    }</div>
  </div>
</div>
${sparkline(serie, hoyIdx)}
<p class="chico" style="margin:9px 0 0">Es caudal simulado en metros cúbicos por segundo,
  no la altura del hidrómetro. Sirve para ver la tendencia, no para decidir.</p>`;
  } catch (e) {
    caja.innerHTML =
      '<span class="eti">Tendencia</span>' +
      '<p class="chico" style="margin:0">No se pudo cargar el modelo de caudal.</p>';
  }
}

function sparkline(serie, corte) {
  const w = 300,
    h = 46,
    min = Math.min(...serie),
    max = Math.max(...serie),
    rango = max - min || 1;
  const px = (i) => (i / (serie.length - 1)) * w;
  const py = (v) => h - ((v - min) / rango) * (h - 6) - 3;
  const pasado = serie
    .slice(0, corte + 1)
    .map((v, i) => `${px(i)},${py(v)}`)
    .join(" ");
  const futuro = serie
    .slice(corte)
    .map((v, i) => `${px(i + corte)},${py(v)}`)
    .join(" ");
  return `<svg class="sparkline" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none"
    role="img" aria-label="Curva del caudal: ${corte + 1} días pasados y la proyección
    de los ${serie.length - corte - 1} siguientes. Los números están en el texto de arriba.">
    <polyline points="${pasado}" fill="none" stroke="var(--agua)" stroke-width="2"/>
    <polyline points="${futuro}" fill="none" stroke="var(--acento)"
stroke-width="2" stroke-dasharray="4 3"/>
    <line x1="${px(corte)}" y1="0" x2="${px(corte)}" y2="${h}"
stroke="var(--linea)" stroke-width="1"/></svg>`;
}

export function fijarRioManual() {
  const campo = document.getElementById("in-rio");
  const est = document.getElementById("origen-dato");
  const v = aNumero(campo.value);
  // Un alert() interrumpe, no queda en pantalla y un lector lo anuncia
  // fuera de contexto. #origen-dato ya es una región viva.
  if (isNaN(v)) {
    est.innerHTML =
      '<b style="color:var(--alerta-texto)">Escribí un número</b>, por ejemplo 3,40.';
    campo.focus();
    return;
  }
  if (v < -1 || v > 10) {
    est.innerHTML =
      '<b style="color:var(--alerta-texto)">Ese valor está fuera de la escala del hidrómetro</b> ' +
      "(−1 a 10 m). El récord de " + RECORD_ANIO + " fue " + m(RECORD) + ".";
    campo.focus();
    return;
  }
  estado.rio = v;
  estado.rioOrigen = "cargado a mano";
  estado.delta = null;
  estado.rioVencido = false;
  estado.rioFecha = "";
  guardado.set("cc_rio", String(v));
  document.getElementById("origen-dato").textContent =
    "Fuente: cargado a mano.";
  document.getElementById("det-manual").open = false;
  pintarRio();
  calcular();
}

/* ---------------- la regla (elemento firma) ---------------- */
export function pintarRio() {
  const regla = document.getElementById("regla");
  const pct = (v) => ((v - ESCALA_MIN) / (ESCALA_MAX - ESCALA_MIN)) * 100;

  // La escala vive en su propia columna, al lado de la pista y no encima.
  let escala = "";
  for (let t = ESCALA_MIN; t <= ESCALA_MAX; t += 0.5) {
    const mayor = Number.isInteger(t);
    escala += `<div class="tic ${mayor ? "mayor" : ""}" style="bottom:${pct(t)}%"></div>`;
    if (mayor)
      escala += `<div class="tic-num" style="bottom:${pct(t)}%">${t}</div>`;
  }
  document.getElementById("escala").innerHTML = escala;

  let html = "";
  const r = estado.rio;
  html += `<div class="agua" style="height:${r == null ? 0 : Math.max(0, Math.min(100, pct(r)))}%"></div>`;
  // "debajo": la etiqueta de alerta va del otro lado de su línea porque si no
  // se monta con la de evacuación, que está a 40 cm — 15px en esta escala.
  // Los números salen de las constantes, no escritos a mano: desde que los
  // publica la estación podrían no ser 5,30 y 5,70 para siempre.
  html += `<div class="marca-linea debajo" style="bottom:${pct(ALERTA)}%;color:var(--alerta-texto)"><b style="color:var(--alerta-texto)">${m(ALERTA).replace(" m", "")}</b></div>`;
  html += `<div class="marca-linea" style="bottom:${pct(EVACUACION)}%;color:var(--peligro-texto)"><b style="color:var(--peligro-texto)">${m(EVACUACION).replace(" m", "")}</b></div>`;
  // El récord de 1992 en tono tenue: no es un umbral que haya que cruzar, es
  // la escala. Sin él, 5,70 parece el techo del mundo.
  html += `<div class="marca-linea" style="bottom:${pct(RECORD)}%;color:var(--tenue)"><b>${m(RECORD).replace(" m", "")}</b></div>`;

  // tu umbral estimado, en la escala del hidrómetro
  const critico = cotaEnHidrometro();
  if (critico !== null && critico >= ESCALA_MIN && critico <= ESCALA_MAX) {
    html += `<div class="marca-linea propia" style="bottom:${pct(critico)}%;color:var(--tierra)">
       <b>vos</b></div>`;
  }
  regla.innerHTML = html;

  /* La leyenda, con los mismos números que las marcas de la regla. Sale de
     acá y no del HTML porque los umbrales los publica la estación del INA y
     el récord la serie histórica: si alguno cambia, tienen que cambiar los
     dos a la vez o la regla se contradice a sí misma. */
  const poner = (id, txt) => {
    const e = document.getElementById(id);
    if (e) e.textContent = txt;
  };
  poner("lg-alerta", m(ALERTA));
  poner("lg-evac", m(EVACUACION));
  poner("lg-record", m(RECORD));
  poner("lg-record-k", "Récord de " + RECORD_ANIO + ", la mayor crecida registrada");

  document.getElementById("lg-actual").textContent =
    r == null ? "sin dato" : m(r);
  const wrap = document.getElementById("lg-cota-wrap");
  if (critico !== null) {
    wrap.style.display = "block";
    document.getElementById("lg-cota").textContent = mU(critico);
    document.getElementById("lg-cota-k").textContent = estado.cotaEsEstimada
      ? "Tu nivel de aviso: si el río llega acá, el agua puede llegar a tu terreno. Es aproximado, con medio metro de margen ya descontado"
      : "Tu nivel de aviso: si el río llega acá, el agua puede llegar a tu terreno. Es aproximado";
  } else wrap.style.display = "none";

  pintarVeredictoRio();
  pintarPie();
  pintarCtaCota();
  guardarUmbral();
  pintarAvisos();

  // Las dos leen estado.rio, así que se repintan con el mismo dato.
  pintarContexto();
  pintarBienvenida();
}

/* Sin cota, la app no puede responder su propia pregunta — y en la pestaña
   Río eso no se decía en ningún lado: el renglón del umbral simplemente no
   aparecía. */
function pintarCtaCota() {
  const cta = document.getElementById("cta-cota");
  if (!cta) return;
  if (estado.cota != null && estado.zona) {
    /* Con el umbral ya cargado, este hueco no queda vacío: lleva LA línea de
       contexto de la pantalla. Una sola, no un bloque legal — el descargo
       completo vive en la pestaña Mi umbral y en /legal. */
    cta.innerHTML =
      '<div class="aviso" style="margin-bottom:14px">Tu nivel de aviso sale de la ' +
      "altura de tu terreno (con medio metro de margen) y de la caída del río. " +
      "Sirve para prepararte antes. <b>No dice cuándo entra el agua.</b></div>";
    return;
  }
  cta.innerHTML =
    '<div class="aviso" style="margin-bottom:14px"><b>Todavía no sé dónde vivís.</b> ' +
    "Cargá tu casa y te digo a qué nivel del río el agua puede llegar a tu " +
    "terreno. Es un cálculo aproximado." +
    '<button class="btn mini" style="margin-top:11px;display:block" data-accion="ir" data-vista="cota">' +
    "Cargar mi casa</button></div>";
}

/* El pie decía "Actualizado <hoy>": la fecha del render, no la del dato. Abajo
   de todo la app afirmaba estar al día aunque el nivel fuera de hace cinco
   días, justo lo contrario de lo que dice el cartel de vencido. */
export function pintarPie() {
  const el = document.getElementById("version");
  if (!el) return;
  el.textContent = estado.rioFecha
    ? "Nivel del río: medición del " + estado.rioFecha
    : estado.rio == null
      ? ""
      : "Nivel del río: " + estado.rioOrigen;
}

/* Cuántas cosas faltan en la mochila. Lo usan el veredicto y el contador. */
export const faltanMochila = () =>
  MOCHILA.filter((_, i) => guardado.get("cc_mo" + i) !== "1").length;

function pintarVeredictoRio() {
  const c = document.getElementById("veredicto-rio");
  const r = estado.rio;
  if (r == null) {
    // Lo primero que veía alguien que abre la app por primera vez era
    // "FALTA EL NIVEL DEL RÍO" en tipografía gigante: un reporte de lo que
    // no anda, antes de explicar para qué sirve. Ahora la pantalla vacía
    // dice qué hace la app, y el problema va en segundo plano.
    c.className = "veredicto v-neutro";
    c.innerHTML =
      '<div class="titu">¿Hasta dónde llega el agua?</div>' +
      '<p class="chico" style="margin:0 0 10px">Te dice <b>a qué altura del río ' +
      "el agua llega a tu terreno</b>. En muchas zonas eso pasa antes que la " +
      "alerta general de 5,30 m.</p>" +
      '<p class="chico" style="margin:0"><b style="color:var(--alerta-texto)">Ahora mismo ' +
      "no pudimos leer el nivel del INA.</b> Cargalo a mano acá abajo, o probá de " +
      "nuevo en un rato.</p>";
    return;
  }
  let cls, titu, txt;
  /* Los dos estados graves EMPIEZAN con el verbo de lo que hay que hacer, no
     con lo que está pasando, y llevan el 103. Antes el de alerta sólo
     describía —"arrancan las evacuaciones en los sectores fuera del anillo de
     defensas"— y el de evacuación delegaba sin decir qué hacer mientras tanto:
     los dos estados más graves de la escala eran los que menos instrucción
     daban. Los 5,30 y 5,70 salen de las constantes, no escritos a mano.
     Ver README §"Los ocho estados y cómo se dicen". */
  if (r >= EVACUACION) {
    cls = "v-peligro";
    titu = "Evacuación en la ciudad";
    txt =
      "<b>Si Defensa Civil dice que salgas, salí.</b> El río pasó los " +
      m(EVACUACION) +
      ". Si necesitás ayuda para salir, llamá al 103. No cruces agua que " +
      "corre: con 30 cm —menos que una rodilla— te arrastra.";
  } else if (r >= ALERTA) {
    cls = "v-peligro";
    titu = "Alerta en la ciudad";
    txt =
      "<b>Armá la mochila y avisale a tu familia.</b> El río pasó los " +
      m(ALERTA) +
      ". En los barrios de afuera del terraplén (el anillo de defensas) ya " +
      "empiezan a sacar gente. Si te dicen que salgas, salí. Dudas: 103.";
  } else if (r >= 4.3) {
    cls = "v-alerta";
    titu = "Atención";
    txt =
      "<b>Armá la mochila hoy.</b> Faltan " +
      mCm(ALERTA - r) +
      " para la alerta de la ciudad.";
  } else {
    cls = "v-ok";
    titu = "Río normal";
    txt =
      "Faltan " +
      mCm(ALERTA - r) +
      " para la alerta de la ciudad. Es el momento de prepararse, no de esperar.";
  }
  // El INA publica la diferencia contra el registro anterior y hasta
  // ahora se guardaba sin mostrarse nunca.
  const d = estado.delta;
  const mov =
    typeof d === "number" && Math.abs(d) >= 0.01
      ? `<div class="chico" style="margin:-3px 0 8px">${d > 0 ? "▲ subió" : "▼ bajó"} ${Math.abs(
          d,
        )
          .toFixed(2)
          .replace(".", ",")} m desde la medición anterior</div>`
      : "";
  // Un dato vencido se sigue mostrando, pero nunca con la cara de un
  // dato de hoy: el cartel va arriba de todo, antes que el número.
  const vencido = estado.rioVencido
    ? `<div class="aviso grave" style="margin:0 0 12px"><b>Este dato no es de ahora.</b>
  ${
    estado.rioFecha
      ? "Es la medición del " + estado.rioFecha + "."
      : "No sabemos de cuándo es."
  }
  No hay conexión con el INA. Cargá la altura a mano acá abajo antes de decidir nada con este número.</div>`
    : "";
  /* La fila del umbral. Es lo que convierte esta tarjeta de "cómo está el río"
     en "qué significa para mí": la lectura oficial grande arriba, y debajo el
     umbral propio con el margen de hoy, en dos celdas que se leen de un golpe.
     Sin umbral cargado no se dibuja: la CTA de más abajo se encarga. */
  const u = cotaEnHidrometro();
  let celdas = "";
  if (u != null) {
    const margen = u - r;
    const superado = margen <= 0;
    // El estado del margen manda sobre el color de la tarjeta: si el río pasó
    // tu umbral, que la ciudad esté en "nivel normal" es un detalle.
    if (superado) cls = "v-peligro";
    else if (margen <= 0.5 && cls === "v-ok") cls = "v-alerta";
    const tono = superado ? "peligro" : cls === "v-ok" ? "ok" : "alerta";
    celdas =
      '<div class="celdas-umbral">' +
      '<div class="celda"><span class="k">Tu nivel de aviso</span>' +
      '<span class="v">' +
      mU(u) +
      "</span></div>" +
      '<div class="celda t-' +
      tono +
      '"><span class="k">Le falta</span><span class="v">' +
      (superado ? "ya lo pasó" : "≈ " + mCm(margen)) +
      "</span></div></div>";
    /* Y una oración en prosa, que es como esto se cuenta en la vereda.
       El ritmo sale del delta que publica el INA, no de una proyección propia:
       sin delta no se promete ningún plazo. */
    const dias = typeof d === "number" && d >= 0.02 ? margen / d : null;
    // Más de diez días de proyección no es información, es ruido: el río no se
    // mueve en línea recta y prometer un plazo así sería inventar un futuro.
    const ritmo =
      !superado && dias != null && dias <= 10
        ? " Al ritmo de la última medición, " +
          /* El artículo va adentro de cada rama: con "unos" afuera salía
             "unos 16 horas". */
          (dias < 1.5
            ? "unas " + Math.round(dias * 24) + " horas"
            : "unos " + Math.round(dias) + " días") +
          "."
        : "";
    txt = superado
      ? "<b>Mové a las personas, los remedios y los documentos. Seguí a " +
        "Defensa Civil (103).</b> El río está en " +
        m(r) +
        " y tu nivel de aviso es " +
        mU(u) +
        ": el agua puede llegar a tu terreno aunque todavía no la veas. " +
        "No cruces agua que corre: con 30 cm —menos que una rodilla— te arrastra."
      : (margen <= 0.5
          ? "<b>Terminá la mochila y avisale a tu familia.</b> Faltan unos " +
            mCm(margen) +
            " para tu nivel de aviso (" +
            mU(u) +
            ")."
          : "El río está a unos " +
            mCm(margen) +
            " de tu nivel de aviso (" +
            mU(u) +
            ").") + ritmo;
    if (superado) titu = "El río pasó tu nivel de aviso";
    else if (margen <= 0.5) titu = "Cerca de tu nivel de aviso";
  }
  // Con el río en alerta la app tenía todo para decir "te faltan 7 cosas de
  // la mochila" y no lo decía: las dos pestañas no se hablaban.
  const falta = faltanMochila();
  const plan =
    cls === "v-ok"
      ? ""
      : `<p class="chico" style="margin:10px 0 0;padding-top:9px;border-top:1px solid var(--linea)">${
          falta
            ? "Te faltan <b>" + falta + "</b> cosas de la mochila."
            : "Tu mochila está completa."
        }<button class="btn mini" style="margin-top:9px;display:block" data-accion="ir" data-vista="plan">Abrir mi plan</button></p>`;
  c.className = "veredicto " + cls;
  c.innerHTML = `${vencido}<div class="titu">${titu}</div>
    <div class="dato" style="margin-bottom:6px">${m(r)}<span class="unidad"> en el puerto</span></div>
    ${mov}
    ${celdas}
    <p class="chico" style="margin:0">${txt}</p>${plan}`;
}

/* ================= EN CONTEXTO =================
   Dónde está el río hoy contra las referencias que SÍ tienen fuente: los dos
   umbrales oficiales y el récord de 1992. Los máximos de otras crecidas no se
   pudieron verificar y por eso no están: un gráfico de una app de evacuación
   no es lugar para números de memoria. */

const REFERENCIAS = [
  ["Alerta", ALERTA, "alerta"],
  ["Evacuación", EVACUACION, "peligro"],
  [etiquetaRecord(), RECORD, "record"],
];

function pintarContexto() {
  const caja = document.getElementById("contexto");
  const txt = document.getElementById("contexto-texto");
  if (!caja) return;
  if (estado.rio == null) {
    caja.innerHTML = "";
    if (txt) txt.textContent = "";
    return;
  }
  const filas = [["Hoy", estado.rio, "hoy"], ...REFERENCIAS];
  const tope = Math.max(...filas.map((f) => f[1]));
  caja.innerHTML = filas
    .map(
      ([n, v, cls]) => `<div class="barra-fila">
      <span class="barra-nom">${atr(n)}</span>
      <span class="barra-pista"><i class="b-${cls}" style="width:${(v / tope) * 100}%"></i></span>
      <span class="barra-val">${m(v)}</span>
    </div>`,
    )
    .join("");

  if (!txt) return;
  /* Antes esto era una sola frase con la alerta y el récord. Faltaba la
     evacuación, que es el número con el que se decide salir de la casa, y
     faltaba la escala: "3,10 m" no le dice nada a nadie hasta que se lo pone
     al lado de un siglo de mediciones. */
  /* `nombre` llega con la preposición ya puesta: "de la alerta", "del
     récord". Armarla acá daba "por debajo de el récord". */
  const contra = (ref, nombre) => {
    const d = ref - estado.rio;
    return d > 0
      ? "<li><b>" + mCm(d) + "</b> por debajo " + nombre + "</li>"
      : '<li><b style="color:var(--peligro-texto)">' +
          mCm(d) +
          "</b> por encima " +
          nombre +
          "</li>";
  };
  let h =
    '<ul class="lista-contra">' +
    contra(ALERTA, "de la alerta (" + m(ALERTA) + ")") +
    contra(EVACUACION, "de la evacuación (" + m(EVACUACION) + ")") +
    contra(RECORD, "del récord de " + RECORD_ANIO + " (" + m(RECORD) + ")") +
    "</ul>";

  /* La posición histórica. Es un hecho sobre la serie del INA —cuántos de los
     días medidos estuvieron por debajo de hoy—, no una categoría inventada
     por nosotros: la app no dice "normal", "alto" ni "bajo", porque para eso
     haría falta una metodología oficial que no tenemos. */
  const p = percentilHistorico(estado.rio);
  if (p !== null)
    h +=
      '<p class="chico" style="margin:12px 0 0">Desde ' +
      historia.desde.slice(0, 4) +
      ", el río estuvo por debajo del nivel de hoy en el <b>" +
      p +
      " %</b> de los " +
      historia.dias.toLocaleString("es-AR") +
      ' días medidos. <a href="/historia">Ver cien años del Paraná</a></p>';
  txt.innerHTML = h;
}

/* ---- la serie histórica del INA ----
   6 KB con un renglón por año desde 1925, que genera `node scripts/historia.js`.
   Se pide una sola vez y tarde: la app tiene que poder contestar "cuánto mide
   el río" sin esperarla. Si no llega, las frases que dependen de ella
   simplemente no aparecen — ninguna pantalla queda rota por su ausencia. */
let historia = null;

export async function cargarHistoria() {
  if (historia) return;
  try {
    const r = await fetch("/datos-abiertos/historia.json");
    if (!r.ok) return;
    const j = await r.json();
    if (!j || !Array.isArray(j.anios) || !j.anios.length) return;
    historia = j;
    // El récord deja de estar escrito a mano y pasa a salir de la serie.
    const top = j.anios.reduce((p, c) => (c[1] > p[1] ? c : p));
    if (typeof top[1] === "number" && top[1] > 5 && top[1] < 12) {
      fijarRecord(top[1], top[0]);
      REFERENCIAS[2][0] = etiquetaRecord();
      REFERENCIAS[2][1] = RECORD;
    }
    pintarRio();
    pintarContexto();
  } catch (e) {
    /* sin historia, la app funciona igual */
  }
}

/* En qué porcentaje de los días medidos el río estuvo por debajo de este
   nivel. Sale de los 101 escalones que dejó el script, o sea de la serie del
   INA. Devuelve null si todavía no llegó el archivo. */
function percentilHistorico(v) {
  const q = historia && historia.cuantiles;
  if (!q || v == null) return null;
  let p = 0;
  while (p < 100 && q[p + 1] <= v) p++;
  return p;
}

/* ================= AJUSTES ================= */
