/* js/app/vista.js — navegación entre pestañas y los avisos de estado.
   El foco programático de cada sección es para que un lector de pantalla
   anuncie el cambio; por eso `.vista` puede enfocarse sólo por script. */

import { armarMapa, cancelarMarca } from "./mapa.js";

/* `desdeHistorial` evita empujar una entrada nueva cuando el cambio de vista
   ya vino del historial (popstate) — si no, atrás y adelante se pelean. */
export function ver(id, btn, desdeHistorial) {
  document.querySelectorAll(".vista").forEach((v) => v.classList.remove("on"));
  const panel = document.getElementById("v-" + id);
  panel.classList.add("on");
  document.querySelectorAll(".barra-app button").forEach((b) => {
    b.classList.remove("on");
    b.removeAttribute("aria-current");
  });
  // Ajustes no tiene botón: ninguna pestaña queda marcada, que es lo
  // correcto — no estás en ninguna de las cuatro.
  if (btn) {
    btn.classList.add("on");
    btn.setAttribute("aria-current", "true");
  }
  window.scrollTo(0, 0);
  // Sin esto el foco se queda en el botón de abajo y quien navega con
  // lector de pantalla no se entera de que cambió todo el contenido.
  panel.focus({ preventScroll: true });
  // El mapa se arma la primera vez que se abre la pestaña, no al inicio.
  if (id === "donde") armarMapa();
  // Irse de «Dónde ir» con un toque armado dejaría la próxima tocada del
  // mapa marcando una casa que nadie pidió.
  else cancelarMarca(false);
  // En modo standalone el botón atrás cerraba la app en vez de volver a la
  // pestaña anterior. Usamos el mismo ?ir= que ya leen los accesos directos
  // del manifest, así una vista se puede compartir por link.
  // La pestaña Río vuelve a la ruta pelada. Era "./", que desde /app (sin
  // barra final) resuelve a "/": recargar o compartir caía en la portada.
  if (!desdeHistorial)
    history.pushState(
      { vista: id },
      "",
      id === "rio" ? location.pathname : "?ir=" + id,
    );
}

export function irA(id, desdeHistorial) {
  /* "ayuda" no es una vista: es "Dónde ir" con la tarjeta para quien no sabe
     nada desplegada. Existe como destino para que /app?ir=ayuda funcione desde
     un afiche, un enlace o un mensaje de WhatsApp. */
  if (id === "ayuda") {
    const t = document.getElementById("ayuda-simple");
    if (t) t.hidden = false;
    id = "donde";
  }
  // Ajustes no tiene botón en la barra: se llega desde el engranaje de la
  // cabecera, así la barra de emergencia se queda en cuatro.
  if (id === "ajustes") {
    ver("ajustes", null, desdeHistorial);
    return true;
  }
  /* «Ahora» existe sólo en una emergencia de la ciudad con dato vigente
     (ahora.js). Un aviso abre /app?ir=ahora, y la app lee la URL antes de
     que conteste el INA: el pedido se anota, se muestra Río, y pintarAhora()
     lo cumple cuando llega el dato, si sigue la emergencia. */
  if (id === "ahora" && !document.getElementById("ahora")?.firstChild) {
    pedidoAhora = true;
    id = "rio";
  }
  if (!["rio", "cota", "plan", "donde", "ahora"].includes(id)) return false;
  /* Por su data-vista y no por su posición: con «Ahora» la barra cambia, y
     Mi casa puede no estar. Sin botón visible se abre igual, sin marcar
     ninguna pestaña, como Ajustes. */
  const b = document.querySelector(`.barra-app [data-vista="${id}"]`);
  ver(id, b && !b.hidden ? b : null, desdeHistorial);
  return true;
}

let pedidoAhora = false;
export function tomarPedidoAhora() {
  const p = pedidoAhora;
  pedidoAhora = false;
  return p;
}

window.addEventListener("popstate", (ev) => {
  irA((ev.state && ev.state.vista) || "rio", true);
});

/* ---------------- utilidades ---------------- */

/* Un botón que dispara algo lento tiene que decirlo él mismo. Antes quedaba
   idéntico y la única señal era un renglón gris más abajo que, con el teclado
   abierto en el teléfono, ni se ve. Devuelve la función que lo libera. */
export function ocupar(selector, texto) {
  const b = document.querySelector(selector);
  if (!b) return () => {};
  const original = b.textContent;
  b.disabled = true;
  b.textContent = texto;
  return () => {
    b.disabled = false;
    b.textContent = original;
  };
}

/* El renglón de estado vive debajo de los botones: en el teléfono queda tapado
   por el teclado. Lo traemos a la vista. */
export function aLaVista(el) {
  try {
    el.scrollIntoView({ block: "nearest", behavior: "smooth" });
  } catch (e) {}
}
