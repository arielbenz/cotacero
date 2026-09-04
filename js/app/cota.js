/* js/app/cota.js — de la cota del terreno al umbral del hidrómetro.
   `cotaEnHidrometro()` es la ÚNICA función que hace esa traducción, y por
   defecto devuelve el escenario pesimista. No recalcular la cuenta en otro
   lado: cuando se hizo, la regla mostraba el optimista y el veredicto el
   pesimista, con hasta 3 m de diferencia para lo mismo en la misma pantalla. */

import {
  CERO_IGN,
  ERROR_DEM,
  KM_PUBLICADO,
  PENDIENTE,
  PRECISION_MAX,
  ZONAS,
} from "./config.js";
import { curvas, elevacionDe } from "./elevacion.js";
import { estado, guardado, kmDeZona } from "./estado.js";
import { aNumero, atr, enCampo, m, mCm, mU } from "./formato.js";
import { FUENTES_APP, selloFuente } from "./fuentes.js";
import { ALERTA, EVACUACION, RECORD, RECORD_ANIO } from "./oficiales.js";
import { pintarRio } from "./rio.js";
import { aLaVista, ocupar } from "./vista.js";

/* Traduce una cota IGN a lectura de hidrómetro.
   Por defecto devuelve el escenario PESIMISTA: si la cota vino del modelo
   interpolada le descuenta el margen de error, porque ése es el número con el
   que hay que decidir. Antes la regla usaba el crudo y el veredicto el
   pesimista, así que las dos pantallas mostraban a la vez valores con hasta
   3 m de diferencia para lo mismo — y la regla mostraba el optimista.
   `crudo: true` da la traducción sin margen, sólo para el desglose. */
export function cotaEnHidrometro({ crudo = false } = {}) {
  if (estado.cota == null || kmDeZona() === null) return null;
  const cota =
    !crudo && estado.cotaEsEstimada ? estado.cota - ERROR_DEM : estado.cota;
  return cota - CERO_IGN - PENDIENTE * kmDeZona();
}

/* Los km a mano se persisten. `iniciar()` los leía de cc_km pero nadie
   escribía nunca esa clave: se perdían en cada recarga y el cálculo volvía
   en silencio a 0 km. */
export function fijarKmManual(v) {
  estado.kmManual = aNumero(v) || 0;
  guardado.set("cc_km", String(estado.kmManual));
  calcular();
  pintarRio();
}

/* De dónde salió la cota que estamos usando. Lo consumen el renglón de
   estado, el desglose del cálculo y el plan exportado, así que la respuesta
   es siempre la misma en todos lados. */
export function origenCota() {
  if (estado.cota == null) return null;
  if (estado.cotaOrigen === "gps")
    return {
      corto: "tu ubicación de ese momento",
      largo:
        "Sale de <b>dónde estabas parado</b> cuando tocaste el botón" +
        (estado.cotaDetalle ? " (" + atr(estado.cotaDetalle) + ")" : "") +
        ". Si no era tu casa, este número no sirve.",
      ojo: true,
    };
  if (estado.cotaOrigen === "direccion")
    return {
      corto: "una dirección buscada",
      largo:
        "Sale de la dirección <b>" +
        atr(estado.cotaDetalle || "que buscaste") +
        "</b>. Verificá que sea la tuya.",
      ojo: false,
    };
  return { corto: "lo que cargaste a mano", largo: "", ojo: false };
}

/* Deja el renglón de estado diciendo SIEMPRE de dónde salió la cota, no sólo
   justo después de la acción. */
export function pintarOrigenCota() {
  const e = document.getElementById("estado-cota");
  const o = origenCota();
  if (!o) return (e.innerHTML = "");
  e.innerHTML =
    "Cota <b>" +
    m(estado.cota) +
    "</b>, tomada de " +
    (o.ojo
      ? '<b style="color:var(--alerta-texto)">' + o.corto + "</b>"
      : "<b>" + o.corto + "</b>") +
    "." +
    (o.largo ? " " + o.largo : "") +
    /* De dónde salió la altura, en el mismo renglón donde se la muestra. La
       cota que la persona carga a mano es suya, no nuestra: ahí no
       corresponde atribuir nada. */
    (estado.cotaEsEstimada ? selloFuente(FUENTES_APP.topografia) : "");
}

export function marcarCotaManual() {
  const campo = document.getElementById("in-cota");
  const v = aNumero(campo.value);
  const est = document.getElementById("estado-cota");
  if (campo.value.trim() && isNaN(v)) {
    est.innerHTML =
      '<b style="color:var(--alerta-texto)">No entiendo ese número.</b> Escribilo así: 16,40.';
    return;
  }
  if (!isNaN(v) && (v < 0 || v > 40)) {
    est.innerHTML =
      '<b style="color:var(--alerta-texto)">Esa cota está fuera de rango</b> (0 a 40 m sobre el nivel del mar).';
    return;
  }
  estado.cota = isNaN(v) ? null : v;
  estado.cotaEsEstimada = false;
  estado.cotaOrigen = isNaN(v) ? "" : "mano";
  estado.cotaDetalle = "";
  guardado.set("cc_cota", isNaN(v) ? "" : String(v));
  guardado.set("cc_cota_est", "0");
  guardado.set("cc_cota_origen", estado.cotaOrigen);
  guardado.set("cc_cota_detalle", "");
  pintarOrigenCota();
  calcular();
  pintarRio();
}

export async function estimarCota() {
  const e = document.getElementById("estado-cota");
  if (!navigator.geolocation) {
    e.textContent = "Este navegador no da ubicación.";
    return;
  }
  // El GPS puede tardar hasta 12 s. Sin esto el botón queda igual todo ese
  // rato y parece que no hizo nada.
  const liberar = ocupar('[data-accion="cota-gps"]', "Ubicando…");
  e.textContent = "Pidiendo tu ubicación…";
  aLaVista(e);
  navigator.geolocation.getCurrentPosition(
    async (pos) => {
      try {
        const { latitude: la, longitude: lo, accuracy: prec } = pos.coords;
        // La app es explícita sobre el error del DEM y era muda sobre éste:
        // con un fix de ±800 m el modelo devuelve la elevación de otro
        // terreno, no del tuyo, y el número parece igual de firme.
        if (typeof prec === "number" && prec > PRECISION_MAX) {
          e.innerHTML =
            '<b style="color:var(--alerta-texto)">La ubicación llegó con ±' +
            Math.round(prec) +
            " m de error.</b> A esa distancia el modelo mide otro terreno. " +
            "Probá al aire libre, buscá la dirección, o cargá la cota a mano.";
          return;
        }
        e.textContent = "Buscando entre las curvas de nivel…";
        try {
          const r = await elevacionDe(la, lo);
          if (!r) throw new Error("fuera de cobertura");
          const alt = Math.round(r.cota * 100) / 100;
          estado.cota = alt;
          estado.cotaEsEstimada = true;
          estado.cotaDistancia = r.distancia;
          estado.cotaOrigen = "gps";
          estado.cotaDetalle =
            typeof prec === "number" ? "±" + Math.round(prec) + " m" : "";
          document.getElementById("in-cota").value = enCampo(alt);
          guardado.set("cc_cota", String(alt));
          guardado.set("cc_cota_est", "1");
          guardado.set("cc_cota_origen", "gps");
          guardado.set("cc_cota_detalle", estado.cotaDetalle);
          pintarOrigenCota();
          calcular();
          pintarRio();
        } catch (err) {
          e.innerHTML =
            "<b>No tenemos la cota de ese punto.</b> Las curvas de nivel del " +
            "municipio cubren la ciudad, no toda el área metropolitana. " +
            "Cargá la cota a mano si la conseguís.";
        }
      } finally {
        liberar();
        aLaVista(e);
      }
    },
    (err) => {
      liberar();
      e.textContent =
        err && err.code === 3
          ? "La ubicación tardó demasiado. Probá al aire libre, buscá la dirección, o cargá la cota a mano."
          : "No diste permiso de ubicación. Podés cargar la cota a mano.";
      aLaVista(e);
    },
    { timeout: 12000, enableHighAccuracy: true, maximumAge: 60000 },
  );
}

export function calcular() {
  const sel = document.getElementById("sel-zona");
  if (sel) estado.zona = sel.value;

  const z = ZONAS.find((z) => z.id === estado.zona);
  const nz = document.getElementById("nota-zona");
  if (!estado.zona) {
    nz.innerHTML =
      '<span style="color:var(--alerta-texto)">Elegí tu zona</span>: la distancia ' +
      "río arriba cambia el resultado hasta 1,80 m.";
    document.getElementById("resultado").innerHTML =
      '<div class="veredicto v-neutro"><div class="titu">Falta tu zona</div>' +
      '<p class="chico" style="margin:0">Elegila arriba. No la damos por ' +
      "supuesta a propósito: suponer el centro daría el resultado más " +
      "optimista de todos.</p></div>";
    pintarRio();
    return;
  }
  if (estado.zona === "otro") {
    // Sólo lo creamos si todavía no está: rehacer el innerHTML en cada
    // tecla le sacaba el foco al campo mientras la persona escribía.
    if (!document.getElementById("in-km")) {
      nz.innerHTML =
        '<label class="campo" style="margin-top:8px"><span>Km sobre el río, aguas arriba del puerto</span>' +
        '<input type="number" id="in-km" step="1" min="0" max="120" value="' +
        (estado.kmManual ?? 0) +
        '" data-input="km-manual"></label>';
    }
  } else {
    nz.innerHTML =
      (z ? z.nota : "") +
      " A " +
      kmDeZona() +
      " km del hidrómetro, aguas arriba." +
      (KM_PUBLICADO.has(estado.zona)
        ? ""
        : ' <span style="color:var(--alerta-texto)">Esa distancia es una estimación ' +
          "propia, no una medición sobre el cauce.</span>");
  }

  const cont = document.getElementById("resultado");
  if (estado.cota == null) {
    cont.innerHTML =
      '<div class="veredicto v-neutro"><div class="titu">Falta la cota de tu terreno</div>' +
      '<p class="chico" style="margin:0">Cargala arriba y estimo el resto.</p></div>';
    pintarRio();
    return;
  }

  const km = kmDeZona();

  // Con la cota interpolada razonamos siempre con el escenario
  // pesimista, y sale de cotaEnHidrometro() para que la regla, el
  // veredicto y el plan exportado no puedan volver a divergir.
  const cotaPeor = estado.cotaEsEstimada
    ? estado.cota - ERROR_DEM
    : estado.cota;
  const criticoPeor = cotaEnHidrometro();

  const r = estado.rio;
  let html = "";

  // veredicto
  let cls = "v-ok",
    titu = "",
    txt = "";
  const ref = criticoPeor;
  /* Ver README §"Los ocho estados y cómo se dicen". El grave empieza con el
     verbo y lleva el 103; "Margen ajustado/amplio" eran vocabulario contable. */
  if (r != null && r >= ref) {
    cls = "v-peligro";
    titu = "El río pasó tu nivel de aviso";
    txt =
      "<b>Mové a las personas, los remedios y los documentos. Seguí a " +
      "Defensa Civil (103).</b> Con el río en " +
      m(r) +
      ", el agua puede llegar a tu terreno aunque todavía no la veas.";
  } else if (ref <= ALERTA) {
    cls = "v-peligro";
    titu = "Tu nivel de aviso llega antes que la alerta de la ciudad";
    txt =
      "Tu nivel de aviso es " +
      mU(ref) +
      ". La alerta de la ciudad suena a los " +
      m(ALERTA) +
      ": para vos, eso es tarde. <b>Preparate antes de que suene.</b>";
  } else if (ref <= EVACUACION) {
    cls = "v-alerta";
    titu = "Tu nivel de aviso cae entre la alerta y la evacuación";
    txt =
      "Tu nivel de aviso es " +
      mU(ref) +
      ", entre los " +
      m(ALERTA) +
      " y los " +
      m(EVACUACION) +
      " de la ciudad. Cuando la ciudad esté en alerta, <b>vos ya tenés que " +
      "tener todo listo para salir.</b>";
  } else if (ref <= 6.5) {
    cls = "v-alerta";
    titu = "Tenés poco margen";
    txt =
      "Tu nivel de aviso es " +
      mU(ref) +
      ": más alto que la evacuación de la ciudad, pero dentro de lo que el " +
      "municipio dice estar planificando. <b>Con la ciudad en alerta, armá " +
      "la mochila.</b>";
  } else {
    cls = "v-ok";
    titu = "Tenés margen";
    txt =
      "Tu nivel de aviso es " +
      mU(ref) +
      ". Para comparar: la crecida más grande, la de " +
      RECORD_ANIO +
      ", llegó a " +
      m(RECORD) +
      ". Igual: si Defensa Civil dice que salgas, salí.";
  }

  html += `<div class="veredicto ${cls}"><div class="titu">${titu}</div>
    <p style="margin:0 0 12px;font-size: var(--t-base)">${txt}</p>
    <span class="eti">Tu nivel de aviso · en la regla del puerto</span>
    <div class="dato">${mU(ref)}</div></div>`;

  // desglose
  html += `<div class="tarjeta"><h3 style="margin-top:0">Cómo sale ese número</h3>
    <table style="width:100%;font-family:var(--mono);font-size: var(--t-s);border-collapse:collapse">
    <tr><td style="padding:6px 0;color:var(--tenue)">Cota de tu terreno<br>
        <span style="font-size: var(--t-xs)">según ${(origenCota() || {}).corto || "—"}</span></td>
  <td style="text-align:right;font-weight:700">${m(estado.cota)} IGN</td></tr>
    ${
      estado.cotaEsEstimada
        ? `<tr><td style="padding:6px 0;color:var(--alerta-texto)">Margen por interpolar entre curvas</td>
  <td style="text-align:right;color:var(--alerta-texto)">− ${ERROR_DEM.toFixed(2).replace(".", ",")} m</td></tr>
    <tr><td style="padding:6px 0;color:var(--tenue)">Cota usada (la pesimista)</td>
  <td style="text-align:right;font-weight:700">${m(cotaPeor)} IGN</td></tr>`
        : ""
    }
    <tr><td style="padding:6px 0;color:var(--tenue)">Cero del hidrómetro${
      /* El INA publica 8,378 para esta escala y el cálculo usa 8,20. La
         diferencia son 18 cm en el umbral de cada persona, y está sin
         resolver: puede ser el mismo punto medido en dos sistemas de alturas
         distintos. Esconderlo sería lo contrario de lo que hace esta app.
         Sólo aparece si la API lo trajo, para no afirmarlo de memoria. */
      estado.ceroINA != null && Math.abs(estado.ceroINA - CERO_IGN) > 0.005
        ? /* Tres decimales, no dos: el INA publica 8,378 y redondear a 8,38
             borraría justo el dígito que hace concreta la diferencia. Es la
             excepción a la regla de dos decimales, que existe para el nivel
             del río, no para el cero de la escala. */
          `<br><span style="font-size: var(--t-xs)">el INA publica ${estado.ceroINA
            .toFixed(3)
            .replace(".", ",")} m — <a href="/datos#abiertas">por qué usamos ${m(CERO_IGN)}</a></span>`
        : ""
    }</td>
  <td style="text-align:right">− ${CERO_IGN.toFixed(2).replace(".", ",")} m</td></tr>
    <tr><td style="padding:6px 0;color:var(--tenue)">Pendiente del río (${km} km × 4,5 cm)${
      KM_PUBLICADO.has(estado.zona)
        ? ""
        : '<br><span style="color:var(--alerta-texto);font-size: var(--t-xs)">distancia estimada, no medida</span>'
    }</td>
  <td style="text-align:right">− ${(PENDIENTE * km).toFixed(2).replace(".", ",")} m</td></tr>
    <tr style="border-top:1px solid var(--linea)">
  <td style="padding:9px 0;font-weight:700">Tu nivel de aviso</td>
  <td style="text-align:right;font-weight:700;color:var(--acento)">${m(ref)}</td></tr>
    </table>
    <p class="chico" style="margin:10px 0 0">La app lo muestra como ${mU(ref)}:
la cota del terreno viene de curvas cada 0,5 m, y más decimales serían una
precisión que el dato no tiene.</p>`;

  if (r != null) {
    const falta = ref - r;
    html += `<p class="chico" style="margin:12px 0 0">Hoy el río está en ${m(r)}.
${
  falta > 0
    ? "Faltan unos <b>" + mCm(falta) + "</b> para tu nivel de aviso."
    : '<b style="color:var(--peligro-texto)">Ya lo superó.</b>'
}</p>`;
  }
  html += "</div>";

  if (estado.cotaEsEstimada) {
    html +=
      '<div class="aviso"><b>Cota interpolada entre curvas de nivel.</b> ' +
      "Sale de las curvas de la Municipalidad de Santa Fe (Secretaría de " +
      "Recursos Hídricos), que vienen cada 50 cm y están en metros IGN, el " +
      "mismo sistema que el cero del hidrómetro." +
      (estado.cotaDistancia != null
        ? " La curva más cercana a ese punto está a " +
          Math.round(estado.cotaDistancia) +
          " m."
        : "") +
      " El cálculo usa el escenario pesimista, medio metro por debajo.<br><br>" +
      "Es un buen dato para orientarte, pero <b>no reemplaza un relevamiento " +
      "de tu terreno</b>: la curva pasa cerca, no por tu puerta.</div>";
  }

  /* Este aviso llegó a tener 124 palabras y aparecía justo debajo del
     resultado: el momento exacto en que la persona acaba de recibir su número
     es el peor para un párrafo con doble negación y una subordinada de 37
     palabras. Queda lo que hay que saber ahí; el resto —la validación de
     1992, la lluvia como otra fuente de inundación, el detalle del modelo—
     vive en /datos#no-dice, que es adonde va el enlace. */
  html +=
    '<div class="aviso grave"><b>Es un cálculo aproximado, no una orden.</b> ' +
    "No tiene en cuenta el terraplén (el anillo de defensas), las bombas, el " +
    "viento ni la lluvia. El agua puede llegar antes por los desagües, o no " +
    'llegar. <a href="/datos#no-dice">Qué no dice este número</a>. ' +
    "<b>Si Defensa Civil o el municipio dicen que salgas, salí, aunque acá " +
    "diga que tenés margen.</b></div>";

  cont.innerHTML = html;
  pintarRio();
}
