/* js/app/tema.js — tema claro/oscuro, tamaño de texto y la pantalla de
   Ajustes. El atributo del <html> es `data-theme`; la clave guardada sigue
   siendo `cc_tema` para no borrarle la preferencia a quien ya la tenía. */

import { guardarUmbral, pintarAvisos } from "./avisos.js";
import { guardado } from "./estado.js";

/* ================= TEMA =================
   El claro existe por legibilidad a pleno sol, no por gusto. El CSS ya sigue
   al sistema por su cuenta; acá sólo aplicamos la elección manual, que gana
   sobre el sistema. */
function temaDelSistema() {
  return window.matchMedia("(prefers-color-scheme: light)").matches
    ? "light"
    : "dark";
}

function temaActual() {
  return document.documentElement.dataset.theme || temaDelSistema();
}

export function aplicarTema(t) {
  const raiz = document.documentElement;
  if (t) raiz.dataset.theme = t;
  else delete raiz.dataset.theme;
  const claro = temaActual() === "light";
  const b = document.getElementById("btn-tema");
  if (b) {
    b.textContent = claro ? "☾" : "☀";
    b.title = claro ? "Pasar a tema dark" : "Pasar a tema light";
  }
  // La barra del sistema en el teléfono también tiene que acompañar.
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta)
    meta.setAttribute(
      "content",
      getComputedStyle(raiz).getPropertyValue("--fondo").trim() ||
        /* Respaldo por si --fondo todavía no resolvió. Tienen que ser los
           mismos valores que el CSS: estaban viejos y no coincidían con
           ninguno de los dos temas. */
        (claro ? "#fafbfc" : "#0e1619"),
    );
}

export function alternarTema() {
  const nuevo = temaActual() === "light" ? "dark" : "light";
  guardado.set("cc_tema", nuevo);
  aplicarTema(nuevo);
}

/* El tamaño de texto es una clase en <html>: así escala todo junto, incluidos
   los números de la regla, sin tocar cada regla del CSS. */
export function aplicarTexto(t) {
  document.documentElement.classList.toggle("texto-grande", t === "grande");
  document.querySelectorAll("#seg-texto button").forEach((b) => {
    b.classList.toggle("on", (b.dataset.texto || "") === (t || ""));
  });
}

export function fijarTexto(t) {
  guardado.set("cc_texto", t || "");
  aplicarTexto(t);
}

export function pintarSegmentoTema() {
  const t = guardado.get("cc_tema") || "";
  document.querySelectorAll("#seg-tema button").forEach((b) => {
    b.classList.toggle("on", (b.dataset.theme || "") === t);
  });
}

/* "Avisame cuando falte poco" necesita que lo sepa el service worker, que no
   puede leer localStorage: se espeja a IndexedDB junto al umbral. */
export async function fijarAvisarCerca(on) {
  guardado.set("cc_avisar_cerca", on ? "1" : "0");
  await guardarUmbral();
  pintarAvisos();
}

export function pintarAjustes() {
  pintarSegmentoTema();
  aplicarTexto(guardado.get("cc_texto") || "");
}
