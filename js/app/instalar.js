/* js/app/instalar.js — instalar la PWA.
   `beforeinstallprompt` existe sólo en Chromium y aun ahí Chrome lo dispara
   cuando quiere; en iPhone no existe. Por eso hay dos caminos: el diálogo del
   navegador si llega, y si no una hoja con los pasos del navegador que
   corresponda. */

import { esIOS, estaInstalada } from "./avisos.js";
import { guardado } from "./estado.js";
import { m } from "./formato.js";

/* ================= INSTALAR =================
   El evento beforeinstallprompt existe sólo en Chromium. En iPhone no existe
   y no va a existir: Safari deja instalar únicamente desde su menú Compartir.
   Antes el botón dependía de ese evento, así que en iOS —donde está buena
   parte de la gente— no aparecía nunca. Ahora hay dos caminos: si el
   navegador ofrece el diálogo, se usa; si no, se explican los pasos. */
let promptInstalar = null;

window.addEventListener("beforeinstallprompt", (ev) => {
  ev.preventDefault();
  promptInstalar = ev;
  mostrarBotonInstalar();
});

window.addEventListener("appinstalled", () => {
  promptInstalar = null;
  guardado.set("cc_instalada", "1");
  quitarBarraInstalar();
  pintarEnlaceInstalar();
});

/* Ya la tiene instalada: no hay nada que ofrecerle. */
const yaLaTiene = () => estaInstalada() || guardado.get("cc_instalada") === "1";

const esMovil = () => esIOS() || window.matchMedia("(pointer: coarse)").matches;

/* Qué decirle a alguien cuando el navegador no ofrece el diálogo solo. */
function pasosInstalacion() {
  if (esIOS()) {
    // Chrome, Firefox y Edge en iPhone usan el motor de Safari y algunos
    // exponen «Agregar a inicio» en su propio menú Compartir, pero no todos.
    // Decirle "la barra de Safari" a alguien que está en Chrome es mandarlo a
    // buscar algo que no va a encontrar.
    const enSafari = !/CriOS|FxiOS|EdgiOS|OPT\//.test(navigator.userAgent);
    return {
      pasos: [
        enSafari
          ? "Tocá el botón Compartir, en la barra de abajo de Safari."
          : "Tocá el botón Compartir del navegador.",
        "Deslizá la lista y elegí «Agregar a inicio».",
        "Confirmá con «Agregar», arriba a la derecha.",
      ],
      nota: enSafari
        ? null
        : "Si no aparece esa opción, abrí cotacerosf.com en Safari: en iPhone es el único que siempre la tiene.",
    };
  }
  if (/Firefox/i.test(navigator.userAgent))
    return {
      pasos: [
        "Abrí el menú ⋮ del navegador.",
        "Elegí «Instalar» o «Agregar a la pantalla de inicio».",
      ],
    };
  return {
    pasos: [
      "Abrí el menú ⋮ del navegador, arriba a la derecha.",
      "Elegí «Instalar app» o «Agregar a la pantalla de inicio».",
    ],
  };
}

/* Un solo lugar decide qué hace el botón, lo dispare la barra o el pie. */
export async function instalar() {
  if (promptInstalar) {
    promptInstalar.prompt();
    const r = await promptInstalar.userChoice;
    promptInstalar = null;
    quitarBarraInstalar();
    // Si dijo que no, no se le insiste: el pie queda como única puerta.
    if (r && r.outcome === "accepted") guardado.set("cc_instalada", "1");
    pintarEnlaceInstalar();
    return;
  }
  mostrarComoInstalar();
}

function mostrarComoInstalar() {
  const previo = document.getElementById("como-instalar");
  if (previo) previo.remove();

  const { pasos, nota } = pasosInstalacion();
  const d = document.createElement("dialog");
  d.id = "como-instalar";
  d.className = "hoja";

  const h = document.createElement("h2");
  h.textContent = "Agregar a la pantalla de inicio";
  const p = document.createElement("p");
  p.className = "chico";
  p.textContent =
    "Queda como una app más, entra sin buscarla en el navegador y funciona sin señal.";

  const ol = document.createElement("ol");
  pasos.forEach((t) => {
    const li = document.createElement("li");
    li.textContent = t;
    ol.appendChild(li);
  });

  d.append(h, p, ol);
  if (nota) {
    const n = document.createElement("p");
    n.className = "aviso";
    n.textContent = nota;
    d.appendChild(n);
  }

  const cerrar = document.createElement("button");
  cerrar.className = "btn";
  cerrar.type = "button";
  cerrar.textContent = "Listo";
  // Botón suelto y no <form method="dialog">: la CSP del sitio lleva
  // form-action 'none' y no vale la pena depender de cómo lo interpreta cada
  // navegador.
  cerrar.addEventListener("click", () => d.close());
  d.appendChild(cerrar);

  document.body.appendChild(d);
  d.addEventListener("close", () => d.remove());
  if (typeof d.showModal === "function") d.showModal();
  else d.setAttribute("open", ""); // sin <dialog> modal, se muestra en línea
}

function mostrarBotonInstalar() {
  if (document.getElementById("barra-instalar")) return;
  if (yaLaTiene()) return;
  // Antes se borraba sola a los 20 segundos y no volvía en toda la sesión: si
  // estabas leyendo, la perdías. Ahora se queda hasta que la cierren, y si la
  // cierran no vuelve a molestar: para eso queda el enlace del pie.
  if (guardado.get("cc_no_instalar") === "1") return;

  const caja = document.createElement("div");
  caja.id = "barra-instalar";
  caja.className = "instalar";
  const b = document.createElement("button");
  b.className = "btn";
  b.type = "button";
  b.textContent = esMovil() ? "Instalar en el teléfono" : "Instalar la app";
  b.addEventListener("click", instalar);
  const x = document.createElement("button");
  x.className = "cerrar";
  x.type = "button";
  x.setAttribute("aria-label", "No instalar");
  x.textContent = "×";
  x.addEventListener("click", () => {
    guardado.set("cc_no_instalar", "1");
    quitarBarraInstalar();
  });
  caja.append(b, x);
  document.body.appendChild(caja);
  document.body.classList.add("con-instalar");
}

/* Saca la barra y devuelve al body su padding normal. */
function quitarBarraInstalar() {
  const caja = document.getElementById("barra-instalar");
  if (caja) caja.remove();
  document.body.classList.remove("con-instalar");
}

/* El pie tiene un enlace permanente. Es la red de contención de todo lo que
   puede salir mal con la barra: que la hayan cerrado, que Chrome no dispare
   el evento, que sea un navegador que no lo implementa. */
function pintarEnlaceInstalar() {
  const caja = document.getElementById("instalar-pie");
  if (!caja) return;
  caja.hidden = yaLaTiene();
}

/* Chrome dispara beforeinstallprompt cuando quiere, y a veces no lo dispara.
   Si no llegó, igual se ofrece: el botón explica los pasos en vez de abrir un
   diálogo que no existe. */
export function ofrecerInstalacion() {
  pintarEnlaceInstalar();
  if (yaLaTiene() || !esMovil()) return;
  setTimeout(() => {
    if (!promptInstalar) mostrarBotonInstalar();
  }, 2500);
}
/* El registro del service worker.
   ---------------------------------------------------------------------------
   Esperaba al evento `load` para no competir con la carga inicial. Con la app
   partida en módulos eso dejó de funcionar: son más de veinte pedidos, y para
   cuando el grafo termina de evaluarse `load` YA PASÓ — el listener se
   enganchaba a un evento que no iba a volver a dispararse, así que el service
   worker no se registraba nunca y la app se quedaba sin modo sin conexión.

   Como el registro se hacía con .catch() vacío, el fallo era mudo: no había
   error en la consola, simplemente no había caché.

   Ahora se comprueba si la página ya terminó de cargar y, si es así, se
   registra en el acto. */
if ("serviceWorker" in navigator) {
  const registrar = () =>
    navigator.serviceWorker.register("/sw.js").catch((e) => {
      // Que al menos quede dicho: sin esto, la app no abre sin señal.
      console.error("No se pudo registrar el service worker:", e.message);
    });
  /* Y le pedimos la tanda de /app. El service worker precachea de arranque
     sólo lo que necesita el SITIO —lo registran también las páginas, para que
     /puntos-de-encuentro cumpla lo que promete—; los módulos de la app, las
     curvas y las tipografías son 275 KB más que no tiene por qué bajarse
     alguien que entró a leer /legal. Los pide quien los usa. */
  const calentar = () =>
    navigator.serviceWorker.ready
      .then((r) => r.active && r.active.postMessage({ tipo: "calentar-app" }))
      .catch(() => {});

  if (document.readyState === "complete") registrar().then(calentar);
  else
    window.addEventListener("load", () => registrar().then(calentar), {
      once: true,
    });
}
