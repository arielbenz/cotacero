/* js/app/cota.js — de la cota del terreno al umbral del hidrómetro.
   `cotaEnHidrometro()` es la ÚNICA puerta a esa traducción —la cuenta en sí
   está en modelo.js, pura, para poder comprobarla desde Node—, y por
   defecto devuelve el escenario pesimista. No recalcular la cuenta en otro
   lado: cuando se hizo, la regla mostraba el optimista y el veredicto el
   pesimista, con hasta 3 m de diferencia para lo mismo en la misma pantalla. */

import {
  CERO_IGN,
  ESCALA_MAX,
  ESCALA_MIN,
  PENDIENTE,
  PRECISION_MAX,
} from "./config.js";
import { COBERTURA, KM_PUBLICADO, ZONAS } from "./zonas.js";
import { elevacionDe, fuenteAltura } from "./elevacion.js";
import { estado, guardado, kmDeZona } from "./estado.js";
import { aNumero, atr, enCampo, m, mCm, mU, nm } from "./formato.js";
import { FUENTES_APP, selloFuente } from "./fuentes.js";
import { margenDe, umbralDe } from "./modelo.js";
import { ESTADOS, faltaCm } from "/lib/comun.js";
import { ALERTA, EVACUACION, RECORD, RECORD_ANIO } from "./oficiales.js";
import { aniosQueLlegaron, pintarRio } from "./rio.js";
import { aLaVista, ocupar } from "./vista.js";

/* Traduce una cota IGN a lectura de hidrómetro.
   Por defecto devuelve el escenario PESIMISTA: si la cota vino del modelo
   interpolada le descuenta el margen de error, porque ése es el número con el
   que hay que decidir. Antes la regla usaba el crudo y el veredicto el
   pesimista, así que las dos pantallas mostraban a la vez valores con hasta
   3 m de diferencia para lo mismo — y la regla mostraba el optimista.
   `crudo: true` da la traducción sin margen, sólo para el desglose. */
/* Guardar una altura estimada: lo hacían por su cuenta el GPS, la búsqueda por
   dirección y ahora el mapa, con el mismo bloque de siete líneas copiado. Tres
   copias del mismo guardado es una que se olvida de un campo.
   `distancia` sólo la trae el camino del GPS y el del mapa. `fuente` es la
   que devolvió elevacionDe(): el id de una de FUENTES_ALTURA. */
export function fijarCotaEstimada(alt, origen, detalle, distancia, fuente) {
  estado.cota = alt;
  estado.cotaEsEstimada = true;
  estado.cotaOrigen = origen;
  estado.cotaDetalle = detalle || "";
  estado.cotaFuente = fuente || "curvas";
  if (distancia != null) estado.cotaDistancia = distancia;
  const campo = document.getElementById("in-cota");
  if (campo) campo.value = enCampo(alt);
  guardado.set("cc_cota", String(alt));
  guardado.set("cc_cota_est", "1");
  guardado.set("cc_cota_origen", origen);
  guardado.set("cc_cota_detalle", estado.cotaDetalle);
  guardado.set("cc_cota_fuente", estado.cotaFuente);
  pintarOrigenCota();
  calcular();
  pintarRio();
}

/* La salida de emergencia de los callejones del cálculo: cuando no hay forma
   de conseguir la altura, lo que queda por hacer no es nada — es el 103, el
   punto de encuentro más cercano y no cruzar agua. Lleva a esa tarjeta. */
const SALIDA_SIN_DATO =
  ' <button class="enlace-crudo" type="button" data-accion="ayuda">' +
  "No sé la altura de mi casa</button>";

/* La cuarta forma de conseguir la altura, ofrecida justo donde las otras
   fallan: GPS impreciso o lento, dirección que ningún callejero tiene. */
export const BOTON_MARCAR =
  '<button class="enlace-crudo" type="button" data-accion="cota-mapa">' +
  "marcá tu casa en el mapa</button>";

/* Cuánto se le descuenta a la altura antes de traducirla. Cero si la cargó
   la persona; si salió de un plano, el margen de ESA fuente: las curvas de la
   ciudad y los puntos de la costa no se equivocan lo mismo (config.js). Una
   sola función para que la regla, el veredicto, el desglose y el plan
   impreso no puedan usar márgenes distintos. */
/* `function` y no `const` con flecha: cota.js y rio.js se importan entre sí,
   y una declaración se eleva; una constante, no. */
export function margenCota() {
  return margenDe({ estimada: estado.cotaEsEstimada, fuente: estado.cotaFuente });
}

export function cotaEnHidrometro({ crudo = false } = {}) {
  return umbralDe({
    cota: estado.cota,
    estimada: estado.cotaEsEstimada,
    fuente: estado.cotaFuente,
    km: kmDeZona(),
    crudo,
  });
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
  if (estado.cotaOrigen === "mapa")
    return {
      // "tomada de " + esto: tiene que encajar sin quedar "de el".
      corto: "un punto que marcaste en el mapa",
      largo:
        "Sale de <b>dónde tocaste en el mapa</b>. Un dedo abarca media cuadra: " +
        "si ése no era tu terreno, marcalo de nuevo.",
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

/* El renglón de respuesta de «Mi casa». Cada cosa que pasa al cargar la
   altura —buscando, listo, no se encontró— sale por acá, y el tipo lo pinta:
   «busca» con ruedita, «ok» con tilde, «aviso» y «error» con su color. Antes
   eran textos sueltos en el mismo párrafo, y encontrar la casa se leía igual
   que no encontrarla. Sin html, se esconde. */
export function decir(tipo, html) {
  const e = document.getElementById("estado-cota");
  if (!e) return;
  e.dataset.tipo = html ? tipo : "";
  // Un solo hijo junto al ícono: sin él, cada botón o texto suelto del
  // mensaje caía en su propia fila de la grilla.
  e.innerHTML = html ? '<div class="est-cuerpo">' + html + "</div>" : "";
  e.hidden = !html;
}

/* Agrega una advertencia al «listo» que ya está puesto, y lo pasa a «aviso». */
export function avisarCota(html) {
  const e = document.getElementById("estado-cota");
  if (!e || e.hidden) return;
  e.dataset.tipo = "aviso";
  e.firstElementChild.insertAdjacentHTML(
    "beforeend",
    '<span class="est-aviso">' + html + "</span>",
  );
}

/* Las dos formas de cargar la altura sin escribir, como un selector: la
   marcada es la que dio la altura que se está usando, así se lee de un
   vistazo si salió del GPS o del mapa. La dirección tiene su campo y escrita
   a mano no marca ninguna. */
export function pintarMetodos() {
  document.querySelectorAll(".metodos [data-metodo]").forEach((b) => {
    const on = estado.cota != null && estado.cotaOrigen === b.dataset.metodo;
    b.setAttribute("aria-pressed", on ? "true" : "false");
  });
}

/* Deja el renglón de estado diciendo SIEMPRE de dónde salió la cota, no sólo
   justo después de la acción: lo primero es el número, y debajo de dónde sale
   y qué hacer si no es la casa. */
export function pintarOrigenCota() {
  const o = origenCota();
  pintarMetodos();
  if (!o) return decir("", "");
  const detalle = estado.cotaDetalle;
  const mano = document.getElementById("altura-mano");
  if (mano && estado.cotaOrigen === "mano") mano.open = true;
  decir(
    "ok",
    /* Un decimal y ≈, como el nivel de aviso: la altura sale de curvas cada
       ~0,5 m, o de puntos con ±1 m en la costa, y «15,51» prometía una
       exactitud que no hay. En el campo y en el desglose queda la exacta. */
    '<b class="est-titu">Tu terreno está a ' +
      mU(estado.cota) +
      " sobre el mar</b>" +
      '<span class="est-txt">' +
      (estado.cotaOrigen === "direccion"
        ? "Encontramos <b>" +
          atr(detalle || "esa dirección") +
          "</b>. Si no es tu casa, buscala de nuevo."
        : o.ojo
          ? o.largo
          : "Es la altura que escribiste.") +
      "</span>" +
      /* De dónde salió la altura, en el mismo renglón donde se la muestra. La
         cota que la persona carga a mano es suya, no nuestra: ahí no
         corresponde atribuir nada. */
      (estado.cotaEsEstimada
        ? selloFuente(FUENTES_APP[fuenteAltura(estado.cotaFuente).sello])
        : ""),
  );
}

export function marcarCotaManual() {
  const campo = document.getElementById("in-cota");
  const v = aNumero(campo.value);
  if (campo.value.trim() && isNaN(v)) {
    decir("error", "<b>No entiendo ese número.</b> Escribilo así: 16,40.");
    return;
  }
  if (!isNaN(v) && (v < 0 || v > 40)) {
    decir("error", "<b>Esa altura no puede ser:</b> va de 0 a 40 m sobre el mar.");
    return;
  }
  estado.cota = isNaN(v) ? null : v;
  estado.cotaEsEstimada = false;
  estado.cotaOrigen = isNaN(v) ? "" : "mano";
  estado.cotaDetalle = "";
  estado.cotaFuente = "";
  guardado.set("cc_cota", isNaN(v) ? "" : String(v));
  guardado.set("cc_cota_est", "0");
  guardado.set("cc_cota_origen", estado.cotaOrigen);
  guardado.set("cc_cota_detalle", "");
  guardado.set("cc_cota_fuente", "");
  pintarOrigenCota();
  calcular();
  pintarRio();
}

export async function estimarCota() {
  if (!navigator.geolocation) {
    decir("error", "<b>Este navegador no da ubicación.</b> Buscá la dirección.");
    return;
  }
  // El GPS puede tardar hasta 12 s. Sin esto el botón queda igual todo ese
  // rato y parece que no hizo nada.
  const liberar = ocupar('[data-accion="cota-gps"]', "Ubicando…");
  decir("busca", "Pidiendo tu ubicación…");
  aLaVista(document.getElementById("estado-cota"));
  navigator.geolocation.getCurrentPosition(
    async (pos) => {
      try {
        const { latitude: la, longitude: lo, accuracy: prec } = pos.coords;
        // La app es explícita sobre el error del DEM y era muda sobre éste:
        // con un fix de ±800 m el modelo devuelve la elevación de otro
        // terreno, no del tuyo, y el número parece igual de firme.
        if (typeof prec === "number" && prec > PRECISION_MAX) {
          decir(
            "error",
            "<b>La ubicación llegó con ±" +
              Math.round(prec) +
              " m de error</b>, y a esa distancia medimos otro terreno. " +
              "Probá al aire libre, buscá la dirección o " +
              BOTON_MARCAR +
              ".",
          );
          return;
        }
        decir("busca", "Buscando la altura de ese terreno…");
        try {
          const r = await elevacionDe(la, lo);
          if (!r) throw new Error("fuera de cobertura");
          const alt = Math.round(r.cota * 100) / 100;
          fijarCotaEstimada(
            alt,
            "gps",
            typeof prec === "number" ? "±" + Math.round(prec) + " m" : "",
            r.distancia,
            r.fuente,
          );
        } catch (err) {
          decir(
            "error",
            "<b>No tenemos la altura de ese punto.</b> Los planos cubren " +
              COBERTURA +
              ". Buscá la dirección, " +
              BOTON_MARCAR +
              " o escribí la altura." +
              SALIDA_SIN_DATO,
          );
        }
      } finally {
        liberar();
        aLaVista(document.getElementById("estado-cota"));
      }
    },
    (err) => {
      liberar();
      decir(
        "error",
        (err && err.code === 3
          ? "<b>La ubicación tardó demasiado.</b> Probá al aire libre, buscá la dirección o " +
            BOTON_MARCAR +
            "."
          : "<b>No diste permiso de ubicación.</b> Buscá la dirección o " +
            BOTON_MARCAR +
            ".") + SALIDA_SIN_DATO,
      );
      aLaVista(document.getElementById("estado-cota"));
    },
    { timeout: 12000, enableHighAccuracy: true, maximumAge: 60000 },
  );
}

/* Lo que hay entre el río y la casa. El nivel de aviso es la cuenta con el
   agua libre, y sin contexto se lee mal: en Colastiné Norte da ≈ 5,4 para un
   terreno que en 2016 vio el río en 6,61 y no se mojó, porque el Garello
   aguantó — y la persona leyó «a 5,4 me tengo que ir». La tarjeta dice si hay
   defensa y qué pasó otras veces en la zona, AL LADO del número, nunca en su
   lugar: la defensa no cambia la cuenta, cambia lo que la cuenta significa.
   Los datos viven en ZONAS; cada renglón de `observado` tiene fuente y
   AUDITORIA.md §9 dice de dónde salió. */
const DEFENSA_TXT = {
  anillo:
    "Tu zona está <b>dentro del anillo de defensas</b> de la ciudad. El agua " +
    "nunca pasó por arriba de una defensa de Santa Fe: el terraplén llega a " +
    "unos 17 m sobre el mar, que en la regla del puerto son más de 8,5 m, muy " +
    "por encima del récord de 7,43. Cuando entró, en 2003, fue por un tramo " +
    "que no estaba construido. Tu nivel de aviso es lo que pasaría si entre " +
    "el río y tu casa no hubiera nada: sirve para prepararte, no dice que el " +
    "agua vaya a entrar.",
  local:
    "Tu zona está <b>fuera del anillo de la ciudad, pero tiene defensa " +
    "propia</b>. Tu nivel de aviso es lo que pasaría si no estuviera. Ninguna " +
    "defensa de la costa falló por arriba en una crecida registrada: el agua " +
    "entra por abajo —filtraciones y napa— y por los desagües, y eso empieza " +
    "bastante antes de que el río llegue a la altura del terraplén. La app no " +
    "sabe en qué estado está hoy.",
  ninguna:
    "En tu zona <b>no hay defensa</b> entre el río y las casas: tu nivel de " +
    "aviso es la cuenta directa, sin nada en el medio.",
};

function tarjetaDefensa(z) {
  if (!z) return "";
  const txt = DEFENSA_TXT[z.defensa];
  const obs = z.observado || [];
  if (!txt && !obs.length && !z.nota) return "";
  let h =
    '<div class="tarjeta"><h3 style="margin-top:0">Lo que hay entre el río y tu casa</h3>';
  /* La nota de la zona vivía bajo la lista de zonas, donde nadie la leía; acá
     está al lado del cálculo que explica. */
  const aparte = [txt, z.nota].filter(Boolean);
  if (aparte.length)
    h += aparte
      .map(
        (t, i) =>
          `<p class="chico" style="margin:0 0 ${i < aparte.length - 1 || obs.length ? "10px" : "0"}">${t}</p>`,
      )
      .join("");
  if (obs.length)
    h +=
      '<span class="eti">En tu zona, otras veces</span><ul class="pasos">' +
      obs
        .map(
          (o) =>
            `<li><b>${m(o.nivel)}</b> — ${o.que} <span style="font-size:var(--t-xs)">${o.fuente}.</span></li>`,
        )
        .join("") +
      '</ul><p class="chico" style="margin:8px 0 0">No hay una tabla oficial ' +
      "por barrio: esto es lo que el municipio dijo en prensa y lo que pasó en " +
      "crecidas anteriores. Cada renglón tiene fuente. Si sabés de otro dato, " +
      '<a href="/contacto">contanos</a>.</p>';
  return h + "</div>";
}

/* En una zona que las curvas no cubren, las tres formas automáticas de
   cargar la altura fallan siempre. Antes la dirección mandaba al mapa y el
   mapa contestaba «fuera del plano»: un círculo sin salida para todo
   Rincón. Ahora se esconden y se dice de entrada cuál es la única salida. */
function pintarSinPlano(z) {
  const aviso = document.getElementById("sin-plano");
  const busca = document.getElementById("busca-casa");
  const mano = document.getElementById("altura-mano");
  if (!aviso || !busca || !mano) return;
  const sin = Boolean(z && z.sinPlano);
  aviso.hidden = !sin;
  busca.hidden = sin;
  // Sin plano, escribirla es la única forma: se muestra abierta y sin el
  // «ya sé» de quien tiene otras opciones.
  document.getElementById("resumen-mano").textContent = sin
    ? "Escribí la altura de tu terreno"
    : "Ya sé la altura de mi terreno";
  if (sin) mano.open = true;
  if (!sin) return;
  aviso.innerHTML =
    "<b>Para " +
    z.n +
    " no tenemos el plano de alturas.</b> Si la sabés, escribila abajo; " +
    "también te la puede dar tu municipio o comuna." +
    SALIDA_SIN_DATO;
}

export function calcular() {
  const sel = document.getElementById("sel-zona");
  if (sel) estado.zona = sel.value;

  const z = ZONAS.find((z) => z.id === estado.zona);
  pintarSinPlano(z);
  const nz = document.getElementById("nota-zona");
  if (!estado.zona) {
    nz.innerHTML =
      '<span style="color:var(--alerta-texto)">Elegí tu zona</span>: la distancia ' +
      "río arriba cambia el resultado hasta 1,80 m.";
    pintarCasa(false);
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
    /* Antes acá iba la nota de la zona, la distancia al hidrómetro y si era
       una estimación: cinco renglones bajo la lista que nadie leía. La nota
       pasó a la tarjeta de «Lo que hay entre el río y tu casa» y la distancia
       está en «Cómo sale ese número». */
    nz.innerHTML = "";
  }

  const cont = document.getElementById("resultado");
  if (estado.cota == null) {
    pintarCasa(false);
    cont.innerHTML =
      '<div class="veredicto v-neutro"><div class="titu">Falta la altura de tu terreno</div>' +
      '<p class="chico" style="margin:0">Cargala arriba y estimo el resto.</p></div>';
    pintarRio();
    return;
  }

  const km = kmDeZona();
  pintarCasa(true);

  // Con la cota interpolada razonamos siempre con el escenario
  // pesimista, y sale de cotaEnHidrometro() para que la regla, el
  // veredicto y el plan exportado no puedan volver a divergir.
  const margen = margenCota();
  const cotaPeor = estado.cota - margen;
  const fuente = fuenteAltura(estado.cotaFuente);
  const criticoPeor = cotaEnHidrometro();

  const r = estado.rio;
  let html = "";

  // veredicto
  let cls = "v-ok",
    titu = "",
    txt = "";
  const ref = criticoPeor;
  /* Ver README §"Los ocho estados y cómo se dicen". El grave empieza con el
     verbo y lleva el 103; "Margen ajustado/amplio" eran vocabulario contable.
     Ninguno arranca con «Tu nivel de aviso es ≈ X»: el número está en grande
     justo arriba, y repetirlo era lo primero que se leía. */
  if (r != null && faltaCm(r, ref) <= 0) {
    cls = "v-peligro";
    titu = ESTADOS.superado.titulo;
    txt =
      "<b>" +
      ESTADOS.superado.verbo +
      " Seguí a Defensa Civil (103).</b> Con el río en " +
      m(r) +
      ", el agua puede llegar a tu terreno aunque todavía no la veas.";
    /* Los dos números conviven, y cómo se dicen importa. La alerta de la
       ciudad es UN umbral operativo para toda Santa Fe —con él se activa el
       plan de contingencia— y tiene que ser uno solo. El nivel de aviso es
       otro, propio, porque cada terreno está a otra altura y a otra distancia
       del Puerto. El personal no corrige ni reemplaza al oficial: sirve para
       prepararse antes, no para decidir en lugar de Defensa Civil.

       Acá decía "para vos, eso es tarde", hablando de la alerta municipal. Se
       lee como que el aviso oficial llega tarde, y eso deja al proyecto
       enfrentado con el organismo que algún día tiene que revisarlo. */
  } else if (ref <= ALERTA) {
    cls = "v-peligro";
    titu = "Tu terreno tiene su propio número";
    txt =
      "Queda por debajo de la alerta de la ciudad, " +
      m(ALERTA) +
      ", que es una sola para toda Santa Fe y sirve para activar el plan de " +
      "contingencia. El tuyo es más bajo porque tu terreno está a otra altura " +
      "y a otra distancia del Puerto: <b>te sirve para prepararte antes</b>. " +
      "La orden de evacuación la sigue dando Defensa Civil.";
  } else if (ref <= EVACUACION) {
    cls = "v-alerta";
    titu = "Tu nivel de aviso cae entre la alerta y la evacuación";
    txt =
      "Entre los " +
      m(ALERTA) +
      " y los " +
      m(EVACUACION) +
      " de la ciudad. Cuando la ciudad entre en alerta, para vos es el " +
      "momento de <b>terminar de preparar la salida</b>.";
  } else if (ref <= 6.5) {
    cls = "v-alerta";
    titu = "Tenés poco margen";
    txt =
      "Más alto que la evacuación de la ciudad, pero dentro de lo que el " +
      "municipio dice estar planificando. <b>Con la ciudad en alerta, armá " +
      "la mochila.</b>";
  } else if (ref < RECORD) {
    /* Era «Tenés margen», en verde, para todo lo que pasara los 6,5 m. Con
       ≈ 7,0 m eso decía verde en el titular y «la de 1992 llegó a 7,43» en el
       renglón siguiente: el río pasó los 7 m tres veces en cuarenta años. Por
       debajo del récord el verde no corresponde. Los años salen de la serie
       del INA; si todavía no llegó, se compara con el récord. */
    cls = "v-neutro";
    titu = "Margen amplio, pero no fuera de alcance";
    const h = aniosQueLlegaron(ref);
    let cuando;
    if (h && h.anios.length && h.anios.length <= 4)
      cuando =
        "El río lo superó en " +
        h.anios.slice(0, -1).join(", ") +
        (h.anios.length > 1 ? " y " : "") +
        h.anios[h.anios.length - 1] +
        ".";
    else if (h && h.anios.length)
      cuando =
        "El río lo superó en " +
        h.anios.length +
        " de los " +
        h.medidos +
        " años medidos desde " +
        h.desde +
        "; la última vez, en " +
        h.anios[h.anios.length - 1] +
        ".";
    else
      cuando =
        "La crecida más grande, la de " +
        RECORD_ANIO +
        ", llegó a " +
        m(RECORD) +
        ".";
    txt =
      "Más alto que lo que el municipio dice estar planificando. " +
      cuando +
      " <b>Si la ciudad entra en evacuación, tené la mochila lista.</b>";
  } else {
    cls = "v-ok";
    titu = "Tenés margen";
    txt =
      "La crecida más grande, la de " +
      RECORD_ANIO +
      ", llegó a " +
      m(RECORD) +
      ".";
  }

  /* El nivel de aviso mira sólo el río. En los estados con margen, la
     lluvia es lo que más fácil se olvida: un barrio con margen amplio contra
     el Paraná puede anegarse igual por lluvia (ver /datos, riesgo pluvial). */
  if (cls === "v-ok" || cls === "v-neutro")
    txt +=
      " <b>Es margen contra el río:</b> con mucha lluvia en poco tiempo, tu " +
      "calle puede anegarse igual.";

  /* La glosa va la primera vez que aparece el número en la pantalla. Con los
     pasos abiertos ya la dice la introducción de arriba. */
  const glosa = casaAbierta
    ? ""
    : '<p class="chico glosa">El nivel del río a partir del cual el agua ' +
      "puede llegar a tu terreno. Es un cálculo aproximado.</p>";

  html += `<div class="veredicto ${cls}"><div class="titu">${titu}</div>
    <span class="eti">Tu nivel de aviso · en la regla del puerto</span>
    <div class="dato">${mU(ref)}</div>
    ${glosa}${barraCasa(ref, r)}
    <p class="veredicto-pie">${txt}</p></div>`;

  html += renglonCasa(z, km);

  // desglose
  html += `<details class="tarjeta plegable"><summary>Cómo sale ese número</summary>
    <table class="desglose">
    <tr><td>Altura de tu terreno<br>
        <span class="nota">según ${(origenCota() || {}).corto || "—"}</span></td>
  <td class="n"><b>${m(estado.cota)} sobre el mar</b></td></tr>
    ${
      estado.cotaEsEstimada
        ? `<tr class="ojo"><td>Margen de seguridad (${fuente.dice.porQueMargen})</td>
  <td class="n">− ${nm(margen, 2)} m</td></tr>
    <tr><td>Altura usada (la más baja, por seguridad)</td>
  <td class="n"><b>${m(cotaPeor)} IGN</b></td></tr>`
        : ""
    }
    <tr><td>Cero de la regla del puerto${
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
          `<br><span class="nota">el INA publica ${estado.ceroINA
            .toFixed(3)
            .replace(".", ",")} m — <a href="/datos#abiertas">por qué usamos ${m(CERO_IGN)}</a></span>`
        : ""
    }</td>
  <td class="n">− ${nm(CERO_IGN, 2)} m</td></tr>
    <tr><td>Caída del río hasta el puerto (${km} km × 4,5 cm)${
      KM_PUBLICADO.has(estado.zona)
        ? ""
        : '<br><span class="nota ojo">distancia estimada, no medida</span>'
    }</td>
  <td class="n">− ${nm(PENDIENTE * km, 2)} m</td></tr>
    <tr class="total">
  <td>Tu nivel de aviso</td>
  <td class="n">${m(ref)}</td></tr>
    </table>
    <p class="chico" style="margin:10px 0 0">La app lo muestra como ${mU(ref)}:
la cota del terreno viene de ${fuente.dice.deDonde}, y más decimales serían una
precisión que el dato no tiene.</p>`;

  /* Era una caja ámbar aparte, debajo del resultado. Es parte de cómo sale el
     número, así que va acá; la frase de «pasa cerca de tu casa, no por tu
     puerta» quedó fija en el paso 2, donde se carga la altura. */
  /* Cómo se explica la altura depende de la fuente: puntos sueltos de la
     Provincia en la costa, curvas del municipio en la ciudad. Cada una trae
     su párrafo en FUENTES_ALTURA (elevacion.js). */
  if (estado.cotaEsEstimada)
    html +=
      '<p class="chico" style="margin:10px 0 0">' +
      fuente.dice.explicacion(estado.cotaDistancia) +
      "</p>";

  if (r != null) {
    const falta = ref - r;
    html += `<p class="chico" style="margin:10px 0 0">Hoy el río está en ${m(r)}.
${
  falta > 0
    ? "Faltan unos <b>" + mCm(falta) + "</b> para tu nivel de aviso."
    : '<b style="color:var(--peligro-texto)">Ya lo superó.</b>'
}</p>`;
  }
  html += "</details>";

  html += tarjetaDefensa(z);

  /* UNA advertencia fuerte por pantalla. Eran tres cajas —el aviso grave, el
     de la altura estimada y el de «ni la mejor cota»— y el mismo descargo
     salía tres veces: la gente dejaba de leerlo, incluida la vez que
     importaba. El detalle vive en /datos#no-dice.
     «Aunque acá diga que tenés margen» sólo donde la pantalla dice eso: en
     los estados graves sería falso, y ahí el verbo y el 103 ya van arriba. */
  html +=
    '<div class="aviso grave"><b>Si Defensa Civil dice que ' +
    "salgas, salí.</b> " +
    (cls === "v-ok" || cls === "v-neutro"
      ? "Aunque acá diga que tenés margen. "
      : "") +
    "El cálculo no sabe de defensas, bombas ni lluvia. " +
    '<a href="/datos#no-dice">Qué no dice este número</a></div>';

  cont.innerHTML = html;
  pintarRio();
}

/* ---- la casa cargada ----
   La primera vez, los pasos van arriba y el resultado aparece debajo, como
   siempre. Para quien ya cargó su casa, lo que viene a buscar es el número:
   los pasos se pliegan detrás de un renglón con «Cambiar». Se decide al
   arrancar y con ese botón, nunca en medio de una carga: plegarlos al
   escribir el primer dígito movería la pantalla bajo el dedo. Y los pasos no
   se mueven de lugar en el DOM: sacar un nodo con el foco adentro cierra el
   teclado. */
let casaAbierta = null;

function pintarCasa(conCasa) {
  // La primera vez se decide una sola vez, al arrancar, como el plegado.
  if (casaAbierta === null && !conCasa) pasoPrimera = 1;
  if (casaAbierta === null || !conCasa) casaAbierta = !conCasa;
  const plegada = conCasa && !casaAbierta;
  document.getElementById("pasos-casa").hidden = plegada;
  document.getElementById("cota-intro").hidden = plegada;
  pintarPrimera();
}

/* ---- la primera vez, en tres pasos ----
   Dónde está tu casa → zona → resultado, con una barra de progreso. Antes
   la zona iba primero, con doce opciones a la vista, antes de poder escribir
   la dirección: la zona es la parte que más cuesta y la que la dirección ya
   dice. Con una dirección de Rincón o Arroyo Leyes la zona se toma de ahí
   (mapa.js) y el segundo paso se salta; con una de la ciudad hay que elegir
   entre sus ocho zonas, que dependen de los km río arriba y no de la calle.
   Antes eran dos tarjetas abiertas a la vez con el resultado diciendo «Falta
   tu zona» debajo: la pantalla arrancaba con un reporte de lo que faltaba. Los
   pasos usan los MISMOS campos que el formulario de siempre —el <select>, la
   dirección, el GPS, el mapa, la altura a mano— y sólo cambia qué se ve, con
   una clase en la sección. Así la búsqueda, las zonas sin plano y lo que se
   guarda siguen teniendo un solo camino. «Cambiar», con la casa ya cargada,
   abre el formulario de siempre, como en el diseño. */
let pasoPrimera = null; // 1, 2 o 3; null cuando no es la primera vez

function pintarPrimera() {
  const v = document.getElementById("v-cota");
  if (!v) return;
  // Con «Seguir» a la vista, el sólido es «Seguir»; si no, «Buscar mi casa».
  document
    .querySelector('#paso-altura [data-accion="buscar-dir"]')
    ?.classList.toggle("sec", pasoPrimera != null && estado.cota != null);
  v.classList.toggle("primera", pasoPrimera != null);
  for (const n of [1, 2, 3]) v.classList.toggle("paso-" + n, pasoPrimera === n);
  if (pasoPrimera == null) return;

  document.getElementById("primera-paso").textContent =
    "Paso " + pasoPrimera + " de 3";
  document
    .querySelectorAll(".progreso-pasos i")
    .forEach((i, k) => i.classList.toggle("hecho", k < pasoPrimera));

  const radios = document.getElementById("zonas-radio");
  /* Agrupadas, y no una lista plana de doce: «Rincón» y «Arroyo Leyes» son
     localidades y «Alto Verde» un barrio, y mezcladas nadie sabía dónde
     buscar la suya. El grupo sale de los datos de la zona: las que tienen
     `localidad` o `sinPlano` quedan fuera de la ciudad. */
  if (radios && !radios.querySelector("input")) {
    const grupoDe = (x) =>
      x.id === "otro"
        ? ""
        : x.localidad || x.sinPlano
          ? "Fuera de la ciudad"
          : "En la ciudad de Santa Fe";
    let ultimo = null;
    radios.insertAdjacentHTML(
      "beforeend",
      ZONAS.map((x) => {
        const g = grupoDe(x);
        const cab =
          g !== ultimo && g
            ? `<span class="zona-grupo" aria-hidden="true">${g}</span>`
            : "";
        ultimo = g;
        return (
          cab +
          `<label class="zona-opcion"><input type="radio" name="zona" value="${x.id}" data-input="zona-radio"><span>${x.n}</span></label>`
        );
      }).join(""),
    );
  }
  radios
    ?.querySelectorAll("input")
    .forEach((r) => (r.checked = r.value === estado.zona));

  /* «Seguir» aparece cuando ya hay altura, y entonces es la acción principal:
     «Buscar mi casa» pasa a secundario. Un solo sólido por pantalla. Sin zona
     no se ve el nivel de aviso. */
  const seguir = document.querySelector('[data-accion="primera-seguir"]');
  if (seguir) seguir.hidden = estado.cota == null;
  const ver = document.querySelector('[data-accion="primera-ver"]');
  if (ver) ver.disabled = estado.cota == null || !estado.zona;
}

/* La lista de zonas escribe en el <select> y dispara su «change»: es el que
   guarda la zona y recalcula. Una sola puerta. */
export function elegirZona(id) {
  const sel = document.getElementById("sel-zona");
  if (!sel || sel.value === id) return;
  sel.value = id;
  sel.dispatchEvent(new Event("change"));
}

/* Cada paso arranca arriba y con el foco en su título: si no, quien usa un
   lector de pantalla se queda en un botón que ya no está. */
function irAPaso(n) {
  pasoPrimera = n;
  if (n === 3) casaAbierta = false;
  calcular();
  // En el resultado el foco va al resultado: la cabecera de pasos ya no se ve.
  const destino =
    n === 3
      ? document.getElementById("resultado")
      : document.getElementById("titulo-paso-" + n);
  /* Arriba de todo, no «a la vista»: aLaVista() mueve lo mínimo, y un paso
     nuevo que arranca a la mitad se lee como la continuación del anterior. */
  window.scrollTo(0, 0);
  if (destino) {
    if (n === 3) destino.setAttribute("tabindex", "-1");
    destino.focus({ preventScroll: true });
  }
}

/* Con la zona ya dicha —la tomó mapa.js de la dirección, o la eligió antes—
   se va derecho al resultado; si no, se pregunta. */
export const primeraSeguir = () =>
  estado.cota != null && irAPaso(estado.zona ? 3 : 2);
export const primeraAtras = () => irAPaso(1);
export const primeraVer = () =>
  estado.cota != null && estado.zona && irAPaso(3);

export function alternarCasa() {
  // «Cambiar» abre el formulario de siempre, no los pasos de la primera vez.
  pasoPrimera = null;
  casaAbierta = !casaAbierta;
  calcular();
  if (casaAbierta) {
    const sel = document.getElementById("sel-zona");
    aLaVista(document.getElementById("pasos-casa"));
    sel.focus({ preventScroll: true });
  } else {
    const b = document.querySelector('[data-accion="cambiar-casa"]');
    aLaVista(document.getElementById("resultado"));
    if (b) b.focus({ preventScroll: true });
  }
}

function renglonCasa(z, km) {
  const o = origenCota() || {};
  const nombre = z
    ? z.n.replace(/^Santa Fe — /, "").replace(/ — .*/, "")
    : "";
  return `<div class="tarjeta casa-renglon">
    <span class="casa-icono" aria-hidden="true"><svg viewBox="0 0 24 24" focusable="false"><path d="M4 11l8-7 8 7v9H4z"/><path d="M10 20v-5h4v5"/></svg></span>
    <span class="casa-txt"><b>${atr(nombre)} · terreno a ${mU(estado.cota)}</b>
      <span>Según ${o.corto || "—"} · ${km} km del Puerto</span>
      ${o.ojo ? `<span class="ojo">${o.largo}</span>` : ""}</span>
    <button type="button" data-accion="cambiar-casa" aria-controls="pasos-casa"
      aria-expanded="${casaAbierta ? "true" : "false"}">${casaAbierta ? "Listo" : "Cambiar"}</button>
  </div>`;
}

/* La regla del veredicto: hoy, la alerta de la ciudad, el récord y vos en la
   misma escala que el hidrómetro de la pestaña Río. Es un dibujo: los
   números van como texto en el renglón de abajo. */
function barraCasa(ref, r) {
  const pct = (v) =>
    Math.max(
      0,
      Math.min(100, ((v - ESCALA_MIN) / (ESCALA_MAX - ESCALA_MIN)) * 100),
    );
  const n2 = (v) => nm(v, 2);
  /* La regla horizontal: las mismas marcas que la de la pestaña Río
     (.marcas-rio.h) y, con el dato vencido, el agua rayada y «último dato»:
     un número viejo no puede decir «hoy». */
  const viejo = estado.rioVencido;
  return `<div class="barra-casa" aria-hidden="true">
    <i class="bc-pista"></i>
    ${r != null ? `<i class="bc-agua${viejo ? " viejo" : ""}" style="width:${pct(r)}%"></i>` : ""}
    <i class="bc-marca bc-alerta" style="left:${pct(ALERTA)}%"></i>
    <i class="bc-marca bc-record" style="left:${pct(RECORD)}%"></i>
    <i class="bc-vos" style="left:${pct(ref)}%"></i>
    <i class="marcas-rio h bc-marcas"></i>
  </div>
  <div class="barra-casa-ley">
    ${r != null ? `<span><b class="c-hoy">${n2(r)}</b> ${viejo ? "último dato" : "hoy"}</span>` : ""}
    <span><b class="c-alerta">${n2(ALERTA)}</b> alerta de la ciudad</span>
    <span><b>${n2(RECORD)}</b> récord</span>
    <span><b class="c-vos">${mU(ref).replace(" m", "")}</b> vos</span>
  </div>`;
}
