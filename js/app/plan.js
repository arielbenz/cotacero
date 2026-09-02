/* js/app/plan.js — el plan familiar: listas, progreso y exportación.
   Se guarda en el teléfono y no sale de ahí. Cada casilla persiste por su
   POSICIÓN en la lista (`cc_mo3`, `cc_pv5`…): reordenar un renglón le mueve
   el tilde a todo el que ya venía llenando el plan. */

import { ERROR_DEM, MOCHILA, PREVIA, ZONAS } from "./config.js";
import { cotaEnHidrometro, origenCota } from "./cota.js";
import { TELEFONOS, estado, guardado } from "./estado.js";
import { m, mU } from "./formato.js";
import { faltanMochila, pintarRio } from "./rio.js";

/* ================= PLAN ================= */
export function pintarListas() {
  /* El sello va sólo en los renglones que están en el plan municipal. Marcar
     los propios en vez de los oficiales daría la lectura contraria: parecería
     que lo normal es lo nuestro y la excepción lo del municipio. */
  const fila = (pre) => ([t, oficial], i) =>
    `<label class="chk"><input type="checkbox" data-k="${pre}${i}"><span>${t}` +
    (oficial ? '<b class="sello-oficial">plan municipal</b>' : "") +
    "</span></label>";
  document.getElementById("lista-mochila").innerHTML =
    MOCHILA.map(fila("mo")).join("");
  document.getElementById("lista-previa").innerHTML =
    PREVIA.map(fila("pv")).join("");

  document.querySelectorAll(".chk input").forEach((cb) => {
    cb.checked = guardado.get("cc_" + cb.dataset.k) === "1";
    cb.addEventListener("change", () => {
      guardado.set("cc_" + cb.dataset.k, cb.checked ? "1" : "0");
      pintarProgreso();
      pintarRio(); // el veredicto muestra cuánto falta de la mochila
      avisarGuardado();
    });
  });
  pintarProgreso();

  ["p-punto", "p-contacto", "p-roles", "p-ayuda", "p-animales"].forEach(
    (id) => {
      const el = document.getElementById(id);
      el.value = guardado.get("cc_" + id) || "";
      el.addEventListener("input", () => {
        guardado.set("cc_" + id, el.value);
        avisarGuardado();
      });
    },
  );

  if (!guardado.ok) {
    document.getElementById("estado-guardado").innerHTML =
      '<b style="color:var(--alerta-texto)">Este navegador no deja guardar.</b> ' +
      "Descargá el plan antes de cerrar la página.";
  }
}

/* 26 casillas sin ninguna señal de avance: nadie sabía si iba por la mitad. */
function pintarProgreso() {
  // El resumen va arriba de la pestaña: los contadores por lista quedaban
  // abajo, donde no se ven al entrar.
  const res = document.getElementById("resumen-plan");
  if (res) {
    const hechos =
      MOCHILA.length -
      faltanMochila() +
      PREVIA.filter((_, i) => guardado.get("cc_pv" + i) === "1").length;
    const total = MOCHILA.length + PREVIA.length;
    res.innerHTML =
      hechos === total
        ? '<b style="color:var(--ok-texto)">Tu plan está completo.</b> Revisalo cada tanto.'
        : "Llevás <b>" +
          hechos +
          " de " +
          total +
          "</b> cosas listas. Te faltan <b>" +
          (total - hechos) +
          "</b>.";
  }
  const poner = (id, hechos, total) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.textContent = hechos + " de " + total;
    el.classList.toggle("completa", hechos === total);
  };
  poner("prog-mochila", MOCHILA.length - faltanMochila(), MOCHILA.length);
  poner(
    "prog-previa",
    PREVIA.filter((_, i) => guardado.get("cc_pv" + i) === "1").length,
    PREVIA.length,
  );
}

let tGuardado;

function avisarGuardado() {
  if (!guardado.ok) return;
  const e = document.getElementById("estado-guardado");
  e.textContent = "Guardado en este teléfono.";
  clearTimeout(tGuardado);
  tGuardado = setTimeout(() => (e.textContent = ""), 2200);
}

function textoPlan() {
  const g = (id) => document.getElementById(id).value.trim();
  let t = "PLAN FAMILIAR ANTE CRECIDA — COTA CERO\n";
  t += "Santa Fe · " + new Date().toLocaleDateString("es-AR") + "\n";
  t += "====================================\n\n";
  if (estado.cota != null) {
    t +=
      "Cota del terreno: " +
      m(estado.cota) +
      " IGN, según " +
      ((origenCota() || {}).corto || "—") +
      (estado.cotaDetalle ? " (" + estado.cotaDetalle + ")" : "") +
      "\n";
    t +=
      "Zona: " +
      ((ZONAS.find((z) => z.id === estado.zona) || {}).n || "sin elegir") +
      "\n";
    t +=
      "Umbral estimado (lectura de referencia en el puerto): " +
      mU(cotaEnHidrometro()) +
      (estado.cotaEsEstimada
        ? " (escenario pesimista: la cota interpolada menos " +
          ERROR_DEM.toFixed(2).replace(".", ",") +
          " m)"
        : "") +
      "\n" +
      "Es una estimación, no una orden: la evacuación la indica Defensa Civil (103).\n\n";
  }
  t += "Punto de encuentro: " + (g("p-punto") || "—") + "\n";
  t += "Contacto fuera de la zona: " + (g("p-contacto") || "—") + "\n";
  t += "Animales: " + (g("p-animales") || "—") + "\n\n";
  if (g("p-roles")) t += "QUIÉN HACE QUÉ\n" + g("p-roles") + "\n\n";
  if (g("p-ayuda")) t += "NECESITAN AYUDA PARA SALIR\n" + g("p-ayuda") + "\n\n";
  t += "MOCHILA — falta:\n";
  const faltan = MOCHILA.filter((_, i) => guardado.get("cc_mo" + i) !== "1");
  t += faltan.length
    ? faltan
        .map(([x, oficial]) => "  [ ] " + x + (oficial ? "  (plan municipal)" : ""))
        .join("\n")
    : "  Completa.";
  t += "\n\nTELÉFONOS\n";
  TELEFONOS.forEach(([q, n]) => {
    t += "  " + n + "  " + q + "\n";
  });
  t += "\nNo cruzar agua en movimiento, ni a pie ni en auto.\n";
  return t;
}

export function exportarPlan() {
  const b = new Blob([textoPlan()], { type: "text/plain;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(b);
  a.download = "plan-familiar-crecida.txt";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

export function compartirPlan() {
  const t = textoPlan();
  if (navigator.share) {
    navigator
      .share({ title: "Plan familiar ante crecida", text: t })
      .catch(() => {});
  } else window.open("https://wa.me/?text=" + encodeURIComponent(t), "_blank");
}

/* La app recomienda tener los teléfonos anotados en papel y no se podía
   imprimir nada. Imprimimos el mismo texto que exporta y comparte, que ya
   está pensado para leerse de un vistazo. */
export function prepararImpresion() {
  const el = document.getElementById("plan-impreso");
  if (el) el.textContent = textoPlan();
}

export function imprimirPlan() {
  prepararImpresion();
  window.print();
}
