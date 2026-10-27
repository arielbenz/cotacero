/* js/app/rio.js — el nivel del río: leerlo, dibujarlo y ubicarlo.
   Tres fuentes en orden: /api/nivel, el último valor guardado (con su fecha,
   y vencido pasadas 48 h) y lo que la persona cargue a mano. Nunca se inventa
   un número.
   Acá viven también la regla —el elemento firma de la app— y el contexto
   histórico, que sale de la serie del INA y no de una categoría inventada
   por nosotros. */

import { pintarAhora } from "./ahora.js";
import { guardarUmbral, pintarAvisos } from "./avisos.js";
import { pintarBienvenida } from "./bienvenida.js";
import {
  CONFIG,
  ESCALA_MAX,
  ESCALA_MIN,
  MOCHILA,
  VENCE_HORAS,
} from "./config.js";
import { pintarCompartir } from "./compartir.js";
import { calcular, cotaEnHidrometro } from "./cota.js";
import { estado, guardado } from "./estado.js";
import { aNumero, atr, fechaINA, horasDesde, m, mCm, mU, nm } from "./formato.js";
import { FUENTE_RIO } from "./fuentes.js";
import { ofrecerConResultado } from "./instalar.js";
import {
  ALERTA,
  EVACUACION,
  RECORD,
  RECORD_ANIO,
  fijarRecord,
  fijarUmbrales,
} from "./oficiales.js";
/* El filtro de plausibilidad, compartido con el sitio, el widget y el
   service worker: era el mismo `if` escrito en cinco archivos. */
import {
  ATENCION_ANTES_M,
  ESTADOS,
  faltaCm,
  sobreRecord,
  textoGrave as textoGraveComun,
  umbralesDe,
} from "/lib/comun.js";

// Lo sella cargarRio() y lo lee refrescarSiHaceFalta(). Va acá y no al
// lado del listener para no asignarlo antes de su propia declaración.
export let ultimoRefresco = 0;


/* ---------------- navegación ---------------- */

/* Los umbrales que publica la estación reemplazan a los nuestros, con un
   filtro: sólo si son números plausibles y en el orden correcto. Un cambio
   silencioso de la API no puede dejar la regla con la evacuación por debajo
   de la alerta. */
function adoptarUmbrales(j) {
  const of = umbralesDe(j);
  if (!of) return;
  const { alerta: a, evacuacion: e } = of;
  if (a === ALERTA && e === EVACUACION) return;
  fijarUmbrales(a, e);
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
        /* La API puede contestar bien con una lectura vieja: pasa si el INA
           deja de publicar. Vence igual que la guardada, o la tarjeta
           mostraría la cara de hoy con un número de la semana pasada. */
        const horas = horasDesde(fechaINA(j.fecha_dato));
        estado.rioVencido = horas !== null && horas > VENCE_HORAS;
        /* El INA sube UNA lectura por día, hacia media tarde y también los
           domingos. Antes de eso la última es la de ayer, y quien la ve piensa
           que el río no se mueve o que faltan datos. */
        const fd = fechaINA(j.fecha_dato);
        const hoy = new Date().setHours(0, 0, 0, 0);
        if (fd && !estado.rioVencido && fd.getTime() < hoy)
          extra +=
            " El INA publica una lectura por día, hacia media tarde: la de hoy todavía no salió.";
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

/* ---- Río arriba (escalas del INA aguas arriba del Puerto) ----
   Lo que midió el INA, hoy, en cada escala. Es observación: no dice cuándo
   llegaría a Santa Fe ni se presenta como pronóstico. Sin color de estado,
   como la tendencia. Si no contesta, se dice y listo. */
export async function cargarRioArriba() {
  const caja = document.getElementById("rio-arriba");
  try {
    const r = await fetch("/api/rio-arriba", { cache: "no-store" });
    if (!r.ok) throw new Error(String(r.status));
    const j = await r.json();
    const filas = (j.estaciones || []).filter(
      (e) => typeof e.altura === "number",
    );
    if (!filas.length) throw new Error("sin escalas");
    caja.innerHTML =
      '<span class="eti">Escalas del INA</span>' +
      '<ul class="arriba">' +
      filas
        .map((e) => {
          const c = e.cambio;
          const cambio = !c
            ? ""
            : Math.abs(c.m) < 0.01
              ? "sin cambios en " + c.dias + " días"
              : (c.m > 0 ? "▲ subió " : "▼ bajó ") +
                mCm(c.m) +
                " en " +
                c.dias +
                " días";
          const sobre =
            typeof e.alerta === "number" && e.altura >= e.alerta
              ? " · sobre el nivel de alerta de su escala (" + m(e.alerta) + ")"
              : "";
          return (
            '<li><span class="a-nombre">' +
            atr(e.nombre) +
            '</span><span class="a-nivel">' +
            m(e.altura) +
            "</span>" +
            (cambio || sobre
              ? '<span class="a-cambio">' + cambio + sobre + "</span>"
              : "") +
            "</li>"
          );
        })
        .join("") +
      "</ul>" +
      '<p class="chico arriba-nota">Es lo que midió el INA en cada escala, ' +
      "con su propia regla y su propia alerta. No es un pronóstico ni dice " +
      "cuándo llegaría a Santa Fe.</p>";
  } catch (e) {
    caja.innerHTML =
      '<span class="eti">Escalas del INA</span>' +
      '<p class="chico" style="margin:0">No pudimos leer las escalas ' +
      "de río arriba. El nivel del río en el Puerto no depende de esto.</p>";
  }
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

    /* Un solo veredicto, con las dos mitades dichas en palabras. Antes el
       titular decía «Viene subiendo» (la semana pasada) y el renglón de abajo
       «proyección −84 %» (la que viene): quien lo lee no sabe cuál creer. Y
       sin color de estado: esto es caudal, no la regla del puerto, y un
       naranja o un verde acá le quita su significado al de la alerta. */
    const subio = camb > 8,
      bajo = camb < -8,
      seEsperaSuba = proy !== null && proy > 8,
      seEsperaBaje = proy !== null && proy < -8;
    let flecha = "→",
      txt = "Estable";
    if (subio) flecha = "↗";
    else if (bajo) flecha = "↘";
    if (subio && seEsperaBaje) txt = "Subió esta semana y se espera que baje";
    else if (subio && seEsperaSuba) txt = "Sigue subiendo";
    else if (subio) txt = "Subió esta semana";
    else if (bajo && seEsperaSuba) txt = "Bajó esta semana y se espera que suba";
    else if (bajo && seEsperaBaje) txt = "Sigue bajando";
    else if (bajo) txt = "Bajó esta semana";
    else if (seEsperaSuba) txt = "Estable, y se espera que suba";
    else if (seEsperaBaje) txt = "Estable, y se espera que baje";

    caja.innerHTML = `<span class="eti">Cuánta agua trae el río · pronóstico a 7 días</span>
<div class="tend">
  <div class="flecha" aria-hidden="true">${flecha}</div>
  <div>
    <div class="tend-titu">${txt}</div>
    <div class="chico">Caudal: ${camb >= 0 ? "+" : ""}${camb.toFixed(0)} % contra hace una semana${
      proy === null
        ? ""
        : ` · pronóstico a 7 días: ${proy >= 0 ? "+" : ""}${proy.toFixed(0)} %`
    }</div>
  </div>
</div>
${sparkline(serie, hoyIdx)}
<p class="chico" style="margin:9px 0 0">Mide cuánta agua trae el río, no la regla
  del puerto: sirve para ver si sube o baja, no para decidir.</p>`;
  } catch (e) {
    caja.innerHTML =
      '<span class="eti">Tendencia</span>' +
      '<p class="chico" style="margin:0">No se pudo cargar el pronóstico.</p>';
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

/* Cada etiqueta va pegada a su línea, sobre la regla. Antes había una lista
   aparte a la derecha que repetía los mismos cinco números, y el ojo tenía
   que ir y volver para saber qué línea era cuál.
   Las etiquetas se pueden encimar: 5,30 y 5,70 están a 40 cm, y el río o el
   nivel de aviso pueden caer justo en el medio. `separar()` las corre lo
   mínimo para que no se monten, y la línea se queda en su altura. Las
   posiciones van en % del alto de la regla, que está en rem, así que la
   cuenta sigue valiendo con el texto agrandado. */
const ALTO_ETIQUETA = 6.5; // % del alto de la regla (1,3rem sobre 20rem)

function separar(items) {
  const h = ALTO_ETIQUETA;
  const o = [...items].sort((a, b) => a.pos - b.pos);
  o.forEach((it, i) => {
    it.y = Math.max(it.pos, h / 2, i ? o[i - 1].y + h : -Infinity);
  });
  for (let i = o.length - 1; i >= 0; i--) {
    const tope = i === o.length - 1 ? 100 - h / 2 : o[i + 1].y - h;
    if (o[i].y > tope) o[i].y = tope;
  }
  return items;
}

export function pintarRio() {
  const regla = document.getElementById("regla");
  const pct = (v) => ((v - ESCALA_MIN) / (ESCALA_MAX - ESCALA_MIN)) * 100;
  const acotar = (p) => Math.max(0, Math.min(100, p));
  const n2 = (v) => nm(v, 2);

  /* La escala vive en su propia columna, al lado de la pista y no encima.
     Las marcas de 10 cm, 50 cm y 1 m son el componente compartido
     (.marcas-rio en app.css); los números van cada 2 m, como en la portada:
     con las marcas al lado, uno por metro era ruido. */
  let escala = '<div class="marcas-rio"></div>';
  for (let t = ESCALA_MIN; t <= ESCALA_MAX; t += 2)
    escala += `<div class="tic-num" style="bottom:${pct(t)}%">${t}</div>`;
  document.getElementById("escala").innerHTML = escala;

  const r = estado.rio;
  const critico = cotaEnHidrometro();

  /* Las cinco líneas. Los números salen de las constantes, no escritos a
     mano: desde que los publica la estación podrían no ser 5,30 y 5,70 para
     siempre. El récord va en tono tenue: no es un umbral que haya que
     cruzar, es la escala — sin él, 5,70 parece el techo del mundo. */
  const lineas = [
    {
      pos: pct(ALERTA),
      cls: "l-alerta",
      txt: `<b>${n2(ALERTA)}</b> alerta de la ciudad`,
    },
    {
      pos: pct(EVACUACION),
      cls: "l-evac",
      txt: `<b>${n2(EVACUACION)}</b> evacuación de la ciudad`,
    },
    {
      pos: pct(RECORD),
      cls: "l-record",
      txt: `<b>${n2(RECORD)}</b> récord de ${RECORD_ANIO}`,
    },
  ];
  // Vencido, el número no es «de hoy»: la etiqueta no puede decirlo.
  if (r != null)
    lineas.push({
      pos: acotar(pct(r)),
      cls: "l-hoy" + (estado.rioVencido ? " viejo" : ""),
      txt: `<b>${n2(r)}</b> ${estado.rioVencido ? "último dato" : "hoy"}`,
    });
  /* Tu nivel de aviso, en la escala del hidrómetro. Si cae afuera de la
     regla no tiene línea, pero la etiqueta se queda en el borde: callarlo
     haría creer que no hay número. */
  const alto = critico !== null && sobreRecord(critico, RECORD, r);
  if (critico !== null) {
    const fuera = critico > ESCALA_MAX || critico < ESCALA_MIN;
    lineas.push({
      pos: acotar(pct(critico)),
      cls: "l-vos" + (fuera ? " fuera" : ""),
      // Afuera de la regla, una flecha y no una frase: «más arriba de la
      // regla» no entraba al lado del tanque. La frase va en el aria-label.
      // Sobre el récord, sin número (sobreRecord en lib/comun.js).
      txt: alto
        ? `<span class="chip-vos">vos</span><b>↑</b> sobre el récord`
        : `<span class="chip-vos">vos</span><b>${mU(critico).replace(" m", "")}</b> ` +
          (fuera ? (critico > ESCALA_MAX ? "↑ " : "↓ ") : "") +
          "tu nivel de aviso",
    });
  }
  separar(lineas);

  /* La línea cruza el tanque y un conector la lleva hasta su etiqueta. Si la
     etiqueta no se corrió, el conector sale horizontal y se lee como una sola
     línea; si se corrió, sigue diciendo de qué altura es. Con las líneas a lo
     ancho, «5,40 hoy» corrido quedaba apoyado sobre la de evacuación. */
  /* Con el dato vencido el agua va rayada en gris: un número viejo nunca
     tiene la cara de uno de hoy, tampoco en el dibujo. */
  let html = `<div class="tanque"><div class="agua${estado.rioVencido ? " viejo" : ""}" style="height:${r == null ? 0 : acotar(pct(r))}%"></div></div>`;
  let conectores = "";
  for (const l of lineas) {
    html +=
      `<div class="marca-linea ${l.cls}" style="bottom:${l.pos}%"></div>` +
      `<div class="marca-txt ${l.cls}" style="bottom:${l.y}%">${l.txt}</div>`;
    if (!l.cls.includes("fuera"))
      conectores += `<line class="${l.cls}" x1="0" y1="${100 - l.pos}" x2="14" y2="${100 - l.y}"/>`;
  }
  html += `<svg class="conectores" viewBox="0 0 14 100" preserveAspectRatio="none" aria-hidden="true">${conectores}</svg>`;
  regla.innerHTML = html;

  /* La regla es un dibujo: para un lector de pantalla, los mismos números en
     una sola frase y en el orden en que se leen de arriba hacia abajo. */
  document
    .getElementById("hidrometro")
    .setAttribute(
      "aria-label",
      "Regla del río, de " +
        ESCALA_MIN +
        " a " +
        ESCALA_MAX +
        " metros. " +
        (r == null
          ? "Sin dato de hoy. "
          : (estado.rioVencido ? "Último dato guardado, " : "Hoy ") +
            m(r) +
            ". ") +
        "Alerta de la ciudad " +
        m(ALERTA) +
        ". Evacuación de la ciudad " +
        m(EVACUACION) +
        ". Récord de " +
        RECORD_ANIO +
        ", " +
        m(RECORD) +
        "." +
        (critico === null
          ? ""
          : alto
            ? " Tu nivel de aviso está más arriba del récord."
            : " Tu nivel de aviso " +
              mU(critico) +
              (critico > ESCALA_MAX ? ", más arriba de la regla." : ".")),
    );

  pintarVeredictoRio();
  pintarConexion();
  pintarCtaCota();
  pintarCompartir();
  guardarUmbral();
  ofrecerConResultado();
  pintarAvisos();

  // Las dos leen estado.rio, así que se repintan con el mismo dato.
  pintarContexto();
  pintarBienvenida();
}

/* Sin cota, la app no puede responder su propia pregunta — y en la pestaña
   Río eso no se decía en ningún lado: el renglón del umbral simplemente no
   aparecía. Con el umbral cargado el hueco queda vacío: la caja ámbar que
   iba acá repetía la glosa que ya está en el veredicto, dos tarjetas más
   arriba. El ámbar queda para cuando se juntan río y lluvia. */
function pintarCtaCota() {
  const cta = document.getElementById("cta-cota");
  if (!cta) return;
  const conCasa = estado.cota != null && !!estado.zona;
  // Para la reserva de alto del veredicto: con casa, mide más.
  document.getElementById("v-rio").classList.toggle("con-casa", conCasa);
  if (conCasa) return (cta.innerHTML = "");
  cta.innerHTML =
    '<div class="tarjeta"><b>Todavía no sé dónde vivís.</b> ' +
    '<p class="chico" style="margin:4px 0 0">Cargá tu casa y te digo tu ' +
    "nivel de aviso: el nivel del río a partir del cual el agua puede llegar " +
    "a tu terreno. Es un cálculo aproximado.</p>" +
    '<button class="btn mini" style="margin-top:11px;display:block" data-accion="ir" data-vista="cota">' +
    "Cargar mi casa</button></div>";
}

/* Cuántas cosas faltan en la mochila. Lo usan el veredicto y el contador. */
export const faltanMochila = () =>
  MOCHILA.filter((_, i) => guardado.get("cc_mo" + i) !== "1").length;

function pintarVeredictoRio() {
  const c = document.getElementById("veredicto-rio");
  const r = estado.rio;
  /* Mientras viaja el dato, la tarjeta se queda con los bloques de carga. El
     arranque pinta la pantalla antes de que conteste el INA, y sin esta
     guarda reemplazaba los bloques por «no pudimos leer el nivel del INA»:
     un error que todavía no había pasado. La clase la ponen el HTML y
     cargarRio(), y la saca cargarRio() cuando termina. */
  if (r == null && c.classList.contains("cargando")) {
    pintarPuntoRio("v-cargando");
    return;
  }
  if (r == null) {
    // Lo primero que veía alguien que abre la app por primera vez era
    // "FALTA EL NIVEL DEL RÍO" en tipografía gigante: un reporte de lo que
    // no anda, antes de explicar para qué sirve. Ahora la pantalla vacía
    // dice qué hace la app, y el problema va en segundo plano.
    c.className = "veredicto v-neutro";
    c.innerHTML =
      '<div class="titu">El río tiene un número. Tu casa tiene otro.</div>' +
      '<p class="chico" style="margin:0 0 10px">La app calcula <b>tu nivel de ' +
      "aviso</b>: el nivel del río a partir del cual el agua puede llegar a tu " +
      "terreno. Es un cálculo aproximado. En muchas zonas queda por debajo de " +
      "la alerta de la ciudad, " +
      m(ALERTA) +
      ".</p>" +
      '<p class="chico" style="margin:0"><b style="color:var(--alerta-texto)">Ahora mismo ' +
      "no pudimos leer el nivel del INA.</b> Cargalo a mano acá abajo, o probá de " +
      "nuevo en un rato.</p>";
    pintarFranjaCiudad(null);
    pintarPuntoRio("v-neutro");
    pintarAhora();
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
  const grave = textoGrave(r);
  if (grave) {
    cls = "v-peligro";
    titu = grave.titu;
    txt = "<b>" + grave.verbo + "</b> " + grave.resto;
  } else if (r >= ALERTA - ATENCION_ANTES_M) {
    cls = "v-alerta";
    titu = ESTADOS.atencion.titulo;
    txt =
      "<b>" +
      ESTADOS.atencion.verbo +
      "</b> Faltan " +
      mCm(ALERTA - r) +
      " para la alerta de la ciudad.";
  } else {
    cls = "v-ok";
    titu = ESTADOS.normal.titulo;
    txt =
      "Faltan " +
      mCm(ALERTA - r) +
      " para la alerta de la ciudad. Es el momento de prepararse, no de esperar.";
  }
  /* Vencido, no sabemos en qué estado está la ciudad: el título dejaba
     «Río normal» con un número de hace tres días, que es justo la cara que
     un dato viejo no puede tener. Sin instrucción, sin margen y sin ritmo:
     con este número no se decide nada. */
  const viejo = estado.rioVencido;
  if (viejo) {
    cls = "v-viejo";
    titu = "Último dato guardado";
    txt = "Con este número no se decide nada: puede haber cambiado.";
  }
  // El INA publica la diferencia contra el registro anterior y hasta
  // ahora se guardaba sin mostrarse nunca.
  const d = estado.delta;
  const mov =
    !viejo && typeof d === "number" && Math.abs(d) >= 0.01
      ? `<div class="chico mov-rio"><b class="${d > 0 ? "sube" : "baja"}">${d > 0 ? "▲" : "▼"} ${nm(
          Math.abs(d),
          2,
        )} m</b> desde la medición anterior</div>`
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
  ${
    /* Si contestó la API, hay conexión: lo que falta es una medición nueva.
       Decir «no hay conexión» mandaría a revisar el wifi. */
    (estado.rioOrigen || "").startsWith("INA")
      ? "El INA no publicó una medición nueva desde entonces."
      : "No hay conexión con el INA."
  }
  Cargá la altura a mano acá abajo antes de decidir nada con este número.</div>`
    : "";
  /* La fila del umbral. Es lo que convierte esta tarjeta de "cómo está el río"
     en "qué significa para mí": la lectura oficial grande arriba, y debajo el
     umbral propio con el margen de hoy, en dos celdas que se leen de un golpe.
     Sin umbral cargado no se dibuja: la CTA de más abajo se encarga. */
  const u = cotaEnHidrometro();
  /* Sobre el récord y con el río lejos, las fichas no dan el número ni cuánto
     falta: «le falta al río ≈ 5,4 m» es tan inútil como el número. En su
     lugar, el récord, que es la escala real (sobreRecord en lib/comun.js). */
  const alto = sobreRecord(u, RECORD, r);
  const celdaAlto =
    '<div class="celdas-umbral">' +
    '<div class="celda t-vos"><span class="k">Tu nivel de aviso</span>' +
    '<span class="v v-texto">Sobre el récord</span></div>' +
    '<div class="celda"><span class="k">Récord, ' +
    RECORD_ANIO +
    '</span><span class="v">' +
    m(RECORD) +
    "</span></div></div>";
  let celdas = "",
    glosa = "";
  /* El texto de la ciudad ya trae una instrucción en tres de los cuatro
     estados, y en los dos graves empieza con el verbo y lleva el 103. Con el
     umbral cargado se reemplazaba siempre por la frase del margen: con la
     ciudad en evacuación y un terreno alto, el veredicto decía «el río está a
     1,2 m de tu nivel de aviso» y perdía el «salí» y el 103. */
  const graveCiudad = r >= ALERTA;
  const instruccionCiudad = cls !== "v-ok";
  /* La glosa va la primera vez que el número aparece en la pantalla, y
     ésta es la primera. */
  const GLOSA =
    '<p class="chico glosa"><b>Tu nivel de aviso</b> es el nivel del río a ' +
    "partir del cual el agua puede llegar a tu terreno. Es un cálculo " +
    "aproximado: <b>no dice cuándo entra el agua</b>.</p>";
  if (u != null && alto && !viejo) {
    celdas = celdaAlto;
    glosa = GLOSA;
  } else if (u != null && viejo) {
    // Tu nivel de aviso no vence: lo que vence es cuánto le falta al río.
    celdas = alto
      ? celdaAlto
      :
      '<div class="celdas-umbral">' +
      '<div class="celda t-vos"><span class="k">Tu nivel de aviso</span>' +
      '<span class="v">' +
      mU(u) +
      "</span></div>" +
      '<div class="celda t-viejo"><span class="k">Le falta al río</span>' +
      '<span class="v">—</span></div></div>';
    glosa = GLOSA;
  } else if (u != null) {
    const margen = u - r;
    const superado = faltaCm(r, u) <= 0;
    // El estado del margen manda sobre el color de la tarjeta: si el río pasó
    // tu umbral, que la ciudad esté en "nivel normal" es un detalle.
    if (superado) cls = "v-peligro";
    else if (margen <= 0.5 && cls === "v-ok") cls = "v-alerta";
    const tono = superado ? "peligro" : cls === "v-ok" ? "ok" : "alerta";
    celdas =
      '<div class="celdas-umbral">' +
      '<div class="celda t-vos"><span class="k">Tu nivel de aviso</span>' +
      '<span class="v">' +
      mU(u) +
      "</span></div>" +
      '<div class="celda t-' +
      tono +
      '"><span class="k">Le falta al río</span><span class="v">' +
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
        ? " Al ritmo de la última medición, el río tardaría " +
          /* El artículo va adentro de cada rama: con "unos" afuera salía
             "unos 16 horas". */
          (dias < 1.5
            ? "unas " + Math.round(dias * 24) + " horas"
            : "unos " + Math.round(dias) + " días") +
          " en llegar a tu nivel de aviso."
        : "";
    /* Con el margen en las fichas, la frase «El río está a unos 3,8 m de tu
       nivel de aviso» decía lo mismo una tercera vez. Queda sólo cuando
       agrega algo: la instrucción de los estados cercanos, o el ritmo. */
    if (superado)
      txt =
        "<b>" +
        ESTADOS.superado.verbo +
        " Seguí a Defensa Civil (103).</b> El río está en " +
        m(r) +
        " y tu nivel de aviso es " +
        mU(u) +
        ": el agua puede llegar a tu terreno aunque todavía no la veas. " +
        "No cruces agua que corre: con 30 cm —menos que una rodilla— te arrastra.";
    else if (graveCiudad) txt += ritmo;
    else if (margen <= 0.5)
      /* Los mismos dos escalones que la notificación: a 20 cm, terminá; a
         50, andá armando. La pantalla decía «terminá» desde los 50. */
      txt =
        "<b>" +
        (faltaCm(r, u) <= 20 ? ESTADOS.cerca.verbo : ESTADOS.acercandose.verbo) +
        "</b> Faltan unos " +
        mCm(margen) +
        " para tu nivel de aviso." +
        ritmo;
    else if (instruccionCiudad) txt += ritmo;
    else txt = ritmo.trim();
    glosa = GLOSA;
    if (superado) titu = ESTADOS.superado.titulo;
    else if (margen <= 0.5) titu = "Cerca de tu nivel de aviso";
  }
  // Con el río en alerta la app tenía todo para decir "te faltan 7 cosas de
  // la mochila" y no lo decía: las dos pestañas no se hablaban.
  const falta = faltanMochila();
  const plan =
    cls === "v-ok" || viejo
      ? ""
      : `<p class="chico" style="margin:10px 0 0;padding-top:9px;border-top:1px solid var(--linea)">${
          falta
            ? "Te faltan <b>" + falta + "</b> cosas de la mochila."
            : "Tu mochila está completa."
        }<button class="btn mini" style="margin-top:9px;display:block" data-accion="ir" data-vista="plan">Abrir mi plan</button></p>`;
  c.className = "veredicto " + cls;
  c.innerHTML = `${vencido}<div class="titu">${titu}</div>
    <div class="dato dato-rio">${nm(r, 2)}<span class="u">m</span><span class="eti">en el puerto</span></div>
    ${mov}
    ${celdas}
    ${txt ? `<p class="chico" style="margin:0 0 10px">${txt}</p>` : ""}${glosa}${plan}`;
  pintarFranjaCiudad(viejo || esManual() ? null : r);
  pintarPuntoRio(cls);
  pintarAhora();
}

/* El nivel lo cargó la persona: para probar un escenario o porque el INA no
   contestó. Sirve para la cuenta, no para anunciar el estado de la ciudad. */
export const esManual = () => (estado.rioOrigen || "").includes("a mano");

/* Los dos estados graves de la ciudad, en un solo lugar: los usan la tarjeta
   de esta pestaña y la de «Ahora» (ahora.js). Empiezan con el verbo de lo
   que hay que hacer y llevan el 103. Son dos de los ocho estados del README
   («Los ocho estados y cómo se dicen»): sw.js y cota.js tienen su copia. */
/* Los textos viven en lib/comun.js, compartidos con la notificación; acá
   sólo se le pasan los umbrales de la estación. */
export function textoGrave(r) {
  return textoGraveComun(r, ALERTA, EVACUACION);
}

/* ---------------- la franja de la ciudad ----------------
   Alerta y evacuación de la ciudad, en una franja sólida arriba de todo y en
   las cuatro pestañas: en una crecida importa más en «Dónde ir» que en
   ningún otro lado. Es el mismo componente que pinta js/rio-barra.js en el
   sitio, con la misma regla: NUNCA con un dato vencido, y tampoco con uno
   cargado a mano —una simulación no puede salir con la cara del aviso
   oficial—. El 103 se repite a propósito: la tarjeta también lo lleva.
   El contenedor está siempre en el HTML y vacío no ocupa nada, porque un
   role="status" que aparece con el texto adentro no lo anuncia nadie. */
function pintarFranjaCiudad(r) {
  const caja = document.getElementById("franja-estado");
  if (!caja) return;
  if (r == null || r < ALERTA) {
    if (caja.firstChild) caja.textContent = "";
    delete caja.dataset.texto;
    return;
  }
  const evacua = r >= EVACUACION;
  const texto = evacua
    ? "Evacuación en la ciudad · llamá al"
    : "Alerta en la ciudad · dudas:";
  // Sólo si cambió: repintar en cada vuelta cortaría la animación del punto.
  if (caja.dataset.texto === texto) return;
  caja.dataset.texto = texto;
  /* La franja entera es el enlace, no sólo el «103»: tres cifras sueltas
     son un blanco chico para un dedo apurado. */
  caja.innerHTML =
    '<div class="franja' +
    (evacua ? " evacuacion" : "") +
    '"><a class="ancho franja-103" href="tel:103"><span>' +
    '<span class="punto-estado" aria-hidden="true"></span>' +
    texto +
    '<span class="solo-lectores"> Defensa Civil,</span></span><b>103</b></a>' +
    "</div>";
}

/* ---------------- el punto de la pestaña Río ----------------
   Sigue a la tarjeta, no sólo a la ciudad: si el río pasó tu nivel de aviso
   la tarjeta se pone roja aunque la ciudad esté normal, y el punto no puede
   decir otra cosa. Vencido o sin dato, gris. Es un adorno de la barra: el
   estado se lee en la tarjeta, así que va aria-hidden. */
function pintarPuntoRio(cls) {
  const p = document.querySelector('.barra-app [data-vista="rio"] .punto-tab');
  if (p) p.dataset.tono = cls.replace("v-", "");
}

/* ---------------- sin conexión ----------------
   navigator.onLine miente cuando hay wifi sin internet, pero cuando dice que
   NO hay red, no se equivoca. La banda va sólo con un dato de menos de 48 h:
   vencido, el cartel de la tarjeta ya dice que no hay conexión con el INA,
   y dos avisos de lo mismo hacen que no se lea ninguno. La hora es la de la
   medición, no la de cuándo se guardó: es la que dice cuánto puede haber
   cambiado el río. */
export function pintarConexion() {
  const el = document.getElementById("sin-conexion");
  if (!el) return;
  const mostrar =
    navigator.onLine === false && estado.rio != null && !estado.rioVencido;
  el.hidden = !mostrar;
  if (!mostrar) return;
  const hora = (estado.rioFecha || "").replace(/^(\d{2}\/\d{2})\/\d{4}/, "$1");
  el.innerHTML =
    "<span>Sin conexión · mostrando lo guardado</span>" +
    (hora ? "<b>" + hora + "</b>" : "");
}

/* ================= EN CONTEXTO =================
   Dónde está el río hoy contra las referencias que SÍ tienen fuente: los dos
   umbrales oficiales y el récord de 1992. Los máximos de otras crecidas no se
   pudieron verificar y por eso no están: un gráfico de una app de evacuación
   no es lugar para números de memoria.
   Las barras de antes repetían lo que ya muestra la regla, dos tarjetas más
   arriba. Quedan las distancias, que la regla no dice, y el percentil. */

function pintarContexto() {
  const txt = document.getElementById("contexto-texto");
  if (!txt) return;
  if (estado.rio == null) return (txt.innerHTML = "");
  /* Antes esto era una sola frase con la alerta y el récord. Faltaba la
     evacuación, que es el número con el que se decide salir de la casa, y
     faltaba la escala: "3,10 m" no le dice nada a nadie hasta que se lo pone
     al lado de un siglo de mediciones. */
  /* `nombre` llega con la preposición ya puesta: "de la alerta", "del
     récord". Armarla acá daba "por debajo de el récord". */
  const contra = (ref, nombre) => {
    const d = ref - estado.rio;
    return (
      '<div class="contra-fila"><dt' +
      (d > 0 ? "" : ' class="encima"') +
      ">" +
      mCm(d) +
      "</dt><dd>" +
      (d > 0 ? "por debajo " : "por encima ") +
      nombre +
      "</dd></div>"
    );
  };
  let h =
    '<dl class="lista-contra">' +
    contra(
      ALERTA,
      'de la <b class="c-alerta">alerta de la ciudad</b> (' + m(ALERTA) + ")",
    ) +
    contra(
      EVACUACION,
      'de la <b class="c-evac">evacuación de la ciudad</b> (' +
        m(EVACUACION) +
        ")",
    ) +
    contra(RECORD, "del récord de " + RECORD_ANIO + " (" + m(RECORD) + ")") +
    "</dl>";

  /* La posición histórica. Es un hecho sobre la serie del INA —cuántos de los
     días medidos estuvieron por debajo de hoy—, no una categoría inventada
     por nosotros: la app no dice "normal", "alto" ni "bajo", porque para eso
     haría falta una metodología oficial que no tenemos. */
  const p = percentilHistorico(estado.rio);
  if (p !== null) {
    const desde = historia.desde.slice(0, 4);
    h +=
      '<div class="percentil">' +
      '<span class="eti">Hoy entre los días medidos desde ' +
      desde +
      "</span>" +
      '<div class="percentil-pista" aria-hidden="true"><i style="width:' +
      p +
      '%"></i><u style="left:' +
      p +
      '%"></u></div>' +
      /* En cada 100 días y no en porcentaje: "el 83 % de los 37.412 días
         medidos" pide alfabetización estadística que no todo el mundo tiene. */
      '<p class="chico" style="margin:0">De cada 100 días medidos desde ' +
      desde +
      ", en <b>" +
      p +
      "</b> el río estuvo más bajo que hoy. " +
      '<a href="/historia">Ver cien años del Paraná</a></p></div>';
  }
  txt.innerHTML = h;
}

/* ---- la serie histórica del INA ----
   6 KB con un renglón por año desde 1925, que genera `node scripts/historia.js`.
   Se pide una sola vez y tarde: la app tiene que poder contestar "cuánto mide
   el río" sin esperarla. Si no llega, las frases que dependen de ella
   simplemente no aparecen — ninguna pantalla queda rota por su ausencia. */
let historia = null;

/* Los años en que el máximo del río llegó a `nivel`, según la serie del INA.
   null si la serie todavía no llegó: quien la usa tiene que poder decir algo
   igual sin ella. */
export function aniosQueLlegaron(nivel) {
  if (!historia) return null;
  return {
    anios: historia.anios.filter((f) => f[1] >= nivel).map((f) => f[0]),
    medidos: historia.anios.length,
    desde: historia.desde.slice(0, 4),
  };
}

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
    if (typeof top[1] === "number" && top[1] > 5 && top[1] < 12)
      fijarRecord(top[1], top[0]);
    // calcular() y no sólo pintarRio(): el veredicto de «Mi casa» nombra los
    // años en que el río llegó a tu nivel de aviso, y esos salen de acá.
    // calcular() termina siempre en pintarRio().
    calcular();
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
