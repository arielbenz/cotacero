/* js/app/ahora.js — la pestaña «Ahora», el modo emergencia.

   Con la ciudad en alerta o en evacuación, y SÓLO con un dato vigente del
   INA, la primera pestaña pasa a ser «Ahora»: lo que hay que hacer, el 103,
   el punto de encuentro del plan, una lista corta y un mensaje para la
   familia. Mi casa sale de la barra mientras dure —la barra se queda en
   cuatro, para no mover los caminos de una emergencia— y se llega desde un
   enlace al pie.

   Con el dato vencido, nunca: una emergencia de hace tres días con la cara
   de una de ahora es peor que ninguna (la misma regla que la franja). Con el
   nivel cargado a mano, tampoco: una simulación no abre el modo emergencia.

   Los textos del estado NO se escriben acá: salen de textoGrave() en rio.js,
   el mismo que usa la tarjeta de la pestaña Río. */

import { MOCHILA, SALIDA } from "./config.js";
import { PUNTOS, estado, guardado } from "./estado.js";
import { atr, m } from "./formato.js";
import { coordsPuntos, distanciaKm, miPos } from "./mapa.js";
import { ALERTA, EVACUACION } from "./oficiales.js";
import { destinoEnlace, enlaceMapa } from "./puntos.js";
import { esManual, textoGrave } from "./rio.js";
import { irA, tomarPedidoAhora } from "./vista.js";

let activa = false;
// La primera vez que se activa en la sesión, la app abre en «Ahora». Después
// no: quien se fue a otra pestaña lo hizo a propósito.
let yaAbrio = false;

export const ahoraActiva = () =>
  estado.rio != null &&
  !estado.rioVencido &&
  !esManual() &&
  estado.rio >= ALERTA;

const sinTildes = (s) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();

/* El punto de encuentro del plan es texto libre («Punto principal: ___»).
   Si coincide con uno de los 30 se puede dar la dirección y «Cómo llegar»;
   si no, se muestra tal cual lo escribió la persona: es su plan. */
function puntoDelPlan() {
  const txt = (guardado.get("cc_p-punto") || "").trim();
  if (!txt) return null;
  const t = sinTildes(txt);
  const hallado =
    t.length >= 4 &&
    PUNTOS.find(([n]) => {
      const nn = sinTildes(n);
      return nn.includes(t) || t.includes(nn);
    });
  if (!hallado) return { texto: txt };
  const [n, d] = hallado;
  const c = coordsPuntos[n];
  return {
    texto: n,
    nombre: n,
    dir: d,
    km: miPos && c ? distanciaKm(miPos, c) : null,
    href: enlaceMapa(n, d, true),
  };
}

const distancia = (km) =>
  km < 1 ? Math.round(km * 100) * 10 + " m" : String(km.toFixed(1)).replace(".", ",") + " km";

/* El mensaje para la familia. Sin número: el contacto del plan es texto
   libre, y adivinar un teléfono de ahí es la manera segura de mandarle
   «estoy bien» a otra persona. wa.me sin número deja elegir a quién en
   WhatsApp. */
function mensaje(evacua, punto) {
  const nivel = m(estado.rio);
  const ir = punto ? " Voy a " + punto.texto + "." : "";
  return evacua
    ? "Estoy bien. Hay evacuación en la ciudad (el río está en " + nivel + ")." + ir
    : "Hay alerta en la ciudad: el río está en " +
        nivel +
        ". Estoy armando la mochila." +
        (punto ? " Si hay que salir, voy a " + punto.texto + "." : "");
}

/* La lista corta: en alerta, lo que falta de la mochila (hasta cuatro); en
   evacuación, los cuatro de «Antes de salir». Las casillas son las mismas
   claves del plan: tildar acá tilda allá (marcarCasilla en plan.js). */
function lista(evacua) {
  const casilla = (k, t) =>
    `<label class="chk"><input type="checkbox" data-k="${k}" data-input="casilla-ahora"${
      guardado.get("cc_" + k) === "1" ? " checked" : ""
    }><span>${t}</span></label>`;
  if (evacua) {
    const hechos = SALIDA.filter((_, i) => guardado.get("cc_sa" + i) === "1").length;
    return (
      `<h3 class="ahora-lista-titu">Antes de salir <span>${hechos} de ${SALIDA.length}</span></h3>` +
      SALIDA.map(([t], i) => casilla("sa" + i, t)).join("")
    );
  }
  const faltan = MOCHILA.map((x, i) => [x[0], i]).filter(
    ([, i]) => guardado.get("cc_mo" + i) !== "1",
  );
  if (!faltan.length)
    return '<h3 class="ahora-lista-titu">Tu mochila está completa</h3>';
  return (
    `<h3 class="ahora-lista-titu">Lo que te falta de la mochila <span>Te faltan ${faltan.length} de ${MOCHILA.length}</span></h3>` +
    faltan
      .slice(0, 4)
      .map(([t, i]) => casilla("mo" + i, t))
      .join("") +
    '<button class="enlace-crudo" type="button" data-accion="ir" data-vista="plan">Ver todo el plan</button>'
  );
}

export function pintarAhora() {
  const antes = activa;
  activa = ahoraActiva();

  /* La barra: con «Ahora», Ahora · Río · Mi plan · Dónde ir; sin ella, la de
     siempre. Mi casa no desaparece de la app: el enlace del pie lleva. */
  const bAhora = document.querySelector('.barra-app [data-vista="ahora"]');
  const bCasa = document.querySelector('.barra-app [data-vista="cota"]');
  if (bAhora) bAhora.hidden = !activa;
  if (bCasa) bCasa.hidden = activa;

  const cont = document.getElementById("ahora");
  if (!activa) {
    if (cont) cont.innerHTML = "";
    // Si se apagó con la pestaña abierta (bajó el río, venció el dato), a Río.
    if (antes && document.getElementById("v-ahora")?.classList.contains("on"))
      irA("rio", true);
    tomarPedidoAhora(); // un ?ir=ahora sin emergencia se descarta
    return;
  }
  if (!cont) return;

  /* Tildar una casilla repinta todo (cambia la cuenta): sin esto el foco se
     perdía y quien usa teclado volvía al principio de la página. */
  const enFoco = document.activeElement;
  const focoK =
    enFoco && enFoco.closest && enFoco.closest("#ahora") ? enFoco.dataset.k : null;

  const g = textoGrave(estado.rio);
  const evacua = estado.rio >= EVACUACION;
  const p = puntoDelPlan();
  const wa = "https://wa.me/?text=" + encodeURIComponent(mensaje(evacua, p));

  cont.innerHTML =
    `<div class="veredicto v-peligro ahora-cabeza">` +
    `<span class="eti">${g.titu} · río ${m(estado.rio)}</span>` +
    `<h2 class="titu">${g.verbo}</h2>` +
    `<p class="chico">${g.resto}</p>` +
    `<a class="btn-emergencia fila-103" href="tel:103"><span>Llamar a Defensa Civil</span><b>103</b></a>` +
    `</div>` +
    `<div class="tarjeta ahora-punto">` +
    `<span class="eti">Tu punto de encuentro · de tu plan</span>` +
    (p
      ? `<b class="ap-nombre">${atr(p.texto)}</b>` +
        (p.dir
          ? `<span class="chico">${atr(p.dir)}${p.km != null ? " · " + distancia(p.km) + " en línea recta" : ""}</span>` +
            `<a class="btn" href="${atr(p.href)}"${destinoEnlace()}>Cómo llegar</a>`
          : `<span class="chico">Así lo anotaste en tu plan.</span>`)
      : `<b class="ap-nombre">Todavía no elegiste uno</b>` +
        `<span class="chico">Fijate cuál te queda más cerca y anotalo en Mi plan.</span>`) +
    `<button class="btn sec mini" type="button" data-accion="ahora-cerca">${p ? "Otro más cerca" : "Ver el más cercano"}</button>` +
    `</div>` +
    `<div class="tarjeta ahora-lista">${lista(evacua)}</div>` +
    `<div class="tarjeta ahora-avisar">` +
    `<a class="btn sec" href="${atr(wa)}" target="_blank" rel="noopener">${evacua ? "Avisar que estoy bien" : "Avisarle a mi familia"}</a>` +
    `<p class="chico">Abre WhatsApp con el mensaje ya escrito y elegís a quién. Lo mandás vos desde WhatsApp: no pasa por ningún servidor nuestro.</p>` +
    `</div>` +
    `<p class="chico ahora-pie"><button class="enlace-crudo" type="button" data-accion="ir" data-vista="cota">Mi casa y mi nivel de aviso</button></p>`;
  // En alerta, lo tildado deja de faltar y sale de la lista: ahí el foco va a
  // la primera casilla que queda, o al enlace al plan si no queda ninguna.
  if (focoK)
    (
      cont.querySelector(`input[data-k="${focoK}"]`) ||
      cont.querySelector(".ahora-lista input, .ahora-lista button")
    )?.focus();

  /* Se abre sola una vez, si la persona estaba en Río (la de arranque), o si
     llegó por un aviso con ?ir=ahora antes de que contestara el INA. */
  const pedido = tomarPedidoAhora();
  const enRio = document.getElementById("v-rio")?.classList.contains("on");
  if (pedido || (!antes && !yaAbrio && enRio)) {
    yaAbrio = true;
    irA("ahora", true);
  }
}
