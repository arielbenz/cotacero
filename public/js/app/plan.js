/* js/app/plan.js — el plan familiar: listas, progreso y exportación.
   Se guarda en el teléfono y no sale de ahí. Cada casilla persiste por su
   POSICIÓN en la lista (`cc_mo3`, `cc_pv5`…): reordenar un renglón le mueve
   el tilde a todo el que ya venía llenando el plan. */

import { MOCHILA, PREVIA, ZONAS } from "./config.js";
import { cotaEnHidrometro, margenCota, origenCota } from "./cota.js";
import { TELEFONOS, estado, guardado } from "./estado.js";
import { m, mU, nm } from "./formato.js";
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

/* Una casilla tildada desde otra pestaña («Ahora»): se guarda igual, se
   copia a la del plan para que las dos digan lo mismo, y se recalcula lo
   que depende de ella. `k` es la clave sin el «cc_»: mo3, pv5, sa0. */
export function marcarCasilla(k, valor) {
  guardado.set("cc_" + k, valor ? "1" : "0");
  const enPlan = document.querySelector(
    '#lista-mochila input[data-k="' + k + '"], #lista-previa input[data-k="' + k + '"]',
  );
  if (enPlan) enPlan.checked = valor;
  pintarProgreso();
  pintarRio();
}

/* 26 casillas sin ninguna señal de avance: nadie sabía si iba por la mitad.
   El resumen va arriba de la pestaña, en una tarjeta con la barra y el
   detalle por lista: los contadores de cada lista quedaban abajo, donde no
   se ven al entrar. */
function pintarProgreso() {
  const mo = MOCHILA.length - faltanMochila();
  const pv = PREVIA.filter((_, i) => guardado.get("cc_pv" + i) === "1").length;
  const total = MOCHILA.length + PREVIA.length;
  const hechos = mo + pv;
  /* Lo que falta, también en la barra de abajo: se ve desde cualquier
     pestaña sin entrar al plan. Completo, no dice nada: un 0 se lee como un
     aviso más. */
  const cuenta = document.querySelector(
    '.barra-app [data-vista="plan"] .cuenta-tab',
  );
  if (cuenta) {
    const faltan = total - hechos;
    cuenta.hidden = faltan === 0;
    cuenta.innerHTML =
      faltan + '<span class="solo-lectores"> cosas sin hacer</span>';
  }
  const res = document.getElementById("resumen-plan");
  if (res)
    res.innerHTML =
      '<div class="pp-cabeza"><span class="pp-num"><b>' +
      hechos +
      "</b> de " +
      total +
      " cosas listas</span>" +
      (hechos === total
        ? '<span class="pp-falta">Completo</span>'
        : '<span class="pp-falta">Te faltan <b>' + (total - hechos) + "</b></span>") +
      "</div>" +
      /* La barra repite el número de arriba: para un lector de pantalla
         alcanza con el texto. */
      '<div class="pp-pista" aria-hidden="true"><i style="width:' +
      Math.round((hechos / total) * 100) +
      '%"></i></div>' +
      '<div class="pp-detalle"><span>Mochila <b>' +
      mo +
      "/" +
      MOCHILA.length +
      "</b></span><span>Antes de que suba <b>" +
      pv +
      "/" +
      PREVIA.length +
      "</b></span></div>" +
      (hechos === total
        ? '<p class="chico" style="margin:0">Tu plan está completo. Revisalo cada tanto.</p>'
        : "");
  const poner = (id, hechos, total) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.textContent = hechos + " de " + total;
    el.classList.toggle("completa", hechos === total);
  };
  poner("prog-mochila", mo, MOCHILA.length);
  poner("prog-previa", pv, PREVIA.length);
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
    const zz = ZONAS.find((z) => z.id === estado.zona);
    t += "Zona: " + ((zz || {}).n || "sin elegir") + "\n";
    // Lo mismo que la tarjeta de «Mi casa», en corto: el plan se guarda y se
    // lee sin señal, y ahí es donde «5,4» sin contexto más daño hace.
    const DEFENSA_CORTA = {
      anillo: "el anillo de defensas de la ciudad",
      local: "una defensa propia, fuera del anillo (la app no sabe su estado)",
      ninguna: "nada: no hay defensa",
    };
    if (zz && DEFENSA_CORTA[zz.defensa])
      t += "Entre el río y tu casa: " + DEFENSA_CORTA[zz.defensa] + "\n";
    if (zz && zz.observado && zz.observado.length)
      t +=
        "En tu zona, otras veces:\n" +
        zz.observado
          .map((o) => "  " + m(o.nivel) + " — " + o.que + " (" + o.fuente + ")")
          .join("\n") +
        "\n";
    t +=
      "Tu nivel de aviso (en la regla del puerto): " +
      mU(cotaEnHidrometro()) +
      "\n" +
      "Si el río llega ahí, el agua puede llegar a tu terreno.\n" +
      (estado.cotaEsEstimada
        ? "La altura del terreno va " +
          nm(margenCota(), 2) +
          " m más abajo, por seguridad.\n"
        : "") +
      "Es un cálculo aproximado, no una orden: la evacuación la indica Defensa Civil (103).\n\n";
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
  t +=
    "\nNo cruzar agua que corre, ni a pie ni en auto:\n" +
    "  30 cm (menos que una rodilla) arrastran a una persona.\n" +
    "  60 cm (por la cintura de un chico) arrastran un auto.\n";
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
