/* js/app/vista.js — navegación entre pestañas y los avisos de estado.
   El foco programático de cada sección es para que un lector de pantalla
   anuncie el cambio; por eso `.vista` puede enfocarse sólo por script. */

import { armarMapa } from "./mapa.js";

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
  // En modo standalone el botón atrás cerraba la app en vez de volver a la
  // pestaña anterior. Usamos el mismo ?ir= que ya leen los accesos directos
  // del manifest, así una vista se puede compartir por link.
  if (!desdeHistorial)
    history.pushState({ vista: id }, "", id === "rio" ? "./" : "?ir=" + id);
}

export function irA(id, desdeHistorial) {
  // Ajustes no tiene botón en la barra: se llega desde el engranaje de la
  // cabecera, así la barra de emergencia se queda en cuatro.
  if (id === "ajustes") {
    ver("ajustes", null, desdeHistorial);
    return true;
  }
  const i = { rio: 0, cota: 1, plan: 2, donde: 3 }[id];
  if (i === undefined) return false;
  const b = document.querySelectorAll(".barra-app button")[i];
  if (!b) return false;
  ver(id, b, desdeHistorial);
  return true;
}

window.addEventListener("popstate", (ev) => {
  irA((ev.state && ev.state.vista) || "rio", true);
});

/* ---------------- utilidades ---------------- */

/* La app funciona sin conexión, pero no lo decía en ningún lado: sólo
   avisaba que el dato del río estaba vencido. navigator.onLine miente cuando
   hay wifi sin internet, pero cuando dice que NO hay red, no se equivoca. */
export function pintarConexion() {
  const el = document.getElementById("sin-conexion");
  if (!el) return;
  const sinRed = navigator.onLine === false;
  el.hidden = !sinRed;
  if (sinRed)
    el.textContent =
      "SIN CONEXIÓN · estás viendo lo último que se guardó en el teléfono";
}

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
