/* js/app/avisos.js — los avisos por push.
   El servidor manda un push SIN CONTENIDO: no sabe la cota de nadie ni a qué
   altura avisarle, sólo despierta al teléfono. La notificación la arma el
   service worker comparando contra el umbral que guardamos en IndexedDB de
   ese dispositivo. De cada persona el servidor guarda un solo dato: el
   endpoint opaco del navegador. */

import { CONFIG } from "./config.js";
import { cotaEnHidrometro } from "./cota.js";
import { guardado } from "./estado.js";
import { mU } from "./formato.js";
import { ALERTA } from "./oficiales.js";
import { aLaVista, ocupar } from "./vista.js";

/* ================= AVISOS =================
   El servidor manda un push VACÍO: no sabe la cota de nadie ni a qué altura
   avisarle. Guarda un solo dato, el endpoint opaco del navegador. El service
   worker consulta el nivel y lo compara contra el umbral que dejamos acá, en
   el propio teléfono. Por eso cambiar la cota NO requiere avisarle a nadie:
   sólo se reescribe este registro local. */

function baseAvisos() {
  return new Promise((ok, mal) => {
    const p = indexedDB.open("cotacero", 1);
    p.onupgradeneeded = () => p.result.createObjectStore("kv");
    p.onsuccess = () => ok(p.result);
    p.onerror = () => mal(p.error);
  });
}

let ultimoUmbralGuardado, ultimoCercaGuardado;

export async function guardarUmbral() {
  const u = cotaEnHidrometro();
  const cerca = guardado.get("cc_avisar_cerca") === "1";
  if (u === ultimoUmbralGuardado && cerca === ultimoCercaGuardado) return;
  ultimoUmbralGuardado = u;
  ultimoCercaGuardado = cerca;
  try {
    const db = await baseAvisos();
    const st = db.transaction("kv", "readwrite").objectStore("kv");
    if (u == null) st.delete("umbral");
    else st.put(u, "umbral");
    st.put(cerca, "avisarCerca");
    db.close();
  } catch (e) {
    /* sin IndexedDB los avisos salen en genérico, la app anda igual */
  }
}

export const esIOS = () =>
  /iPad|iPhone|iPod/.test(navigator.userAgent) ||
  (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

export const estaInstalada = () =>
  window.matchMedia("(display-mode: standalone)").matches ||
  navigator.standalone === true;

const avisosPosibles = () =>
  Boolean(CONFIG.VAPID_PUBLIC_KEY) &&
  "serviceWorker" in navigator &&
  "PushManager" in window &&
  "Notification" in window;

function claveServidor(b64) {
  const pad = "=".repeat((4 - (b64.length % 4)) % 4);
  const s = atob((b64 + pad).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from([...s].map((c) => c.charCodeAt(0)));
}

async function suscripcionActual() {
  if (!avisosPosibles()) return null;
  try {
    const reg = await navigator.serviceWorker.ready;
    return await reg.pushManager.getSubscription();
  } catch (e) {
    return null;
  }
}

export async function activarAvisos() {
  const caja = document.getElementById("avisos");
  const tarjeta = (dentro) => {
    caja.innerHTML =
      '<div class="tarjeta"><h3 style="margin-top:0">Avisos</h3>' +
      dentro +
      "</div>";
    aLaVista(caja);
  };
  const liberar = ocupar('[data-accion="avisos-on"]', "Activando…");
  try {
    const permiso = await Notification.requestPermission();
    if (permiso === "denied") {
      tarjeta(
        '<p class="chico" style="margin:0"><b style="color:var(--alerta-texto)">Bloqueaste los avisos.</b> ' +
          "Se vuelven a habilitar desde los ajustes del navegador para este sitio.</p>",
      );
      return;
    }
    if (permiso !== "granted") {
      // Descartar el cartel del navegador dejaba la tarjeta IDÉNTICA: cero
      // señal de que hubiera pasado algo.
      tarjeta(
        '<p class="chico" style="margin:0">No diste el permiso, así que no vamos ' +
          "a avisarte. Podés intentarlo cuando quieras.</p>" +
          '<button class="btn mini" style="margin-top:11px;display:block" ' +
          'data-accion="avisos-on">Probar de nuevo</button>',
      );
      return;
    }
    const reg = await navigator.serviceWorker.ready;
    const sub =
      (await reg.pushManager.getSubscription()) ||
      (await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: claveServidor(CONFIG.VAPID_PUBLIC_KEY),
      }));
    const r = await fetch("/api/suscribir", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ endpoint: sub.endpoint }),
    });
    if (!r.ok) throw new Error("el servidor rechazó la suscripción");
    await guardarUmbral();
    await pintarAvisos();
    aLaVista(caja);
  } catch (e) {
    tarjeta(
      '<p class="chico" style="margin:0"><b style="color:var(--alerta-texto)">No se pudieron ' +
        "activar los avisos.</b> Probá de nuevo más tarde.</p>" +
        '<button class="btn mini" style="margin-top:11px;display:block" ' +
        'data-accion="avisos-on">Reintentar</button>',
    );
  } finally {
    liberar();
  }
}

export async function desactivarAvisos() {
  const sub = await suscripcionActual();
  if (sub) {
    try {
      await fetch("/api/desuscribir", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endpoint: sub.endpoint }),
      });
    } catch (e) {}
    await sub.unsubscribe();
  }
  pintarAvisos();
}

const LETRA_CHICA =
  '<p class="chico" style="margin:9px 0 0">Para avisarte, el servidor guarda ' +
  "sólo una dirección anónima de tu navegador. <b>No guarda tu nivel de aviso, " +
  "la altura de tu terreno, tu dirección ni tu plan</b>: el aviso lo arma tu " +
  "teléfono.</p>";

/* Aviso anticipado: además del cruce del umbral, avisar cuando falten 50 y
   20 cm. Lo decide el service worker con lo que se espeja a IndexedDB. */
function conmutadorCerca() {
  const on = guardado.get("cc_avisar_cerca") === "1";
  return (
    '<label class="chk" style="border-bottom:none;padding-bottom:0">' +
    '<input type="checkbox" data-accion="avisar-cerca" data-on="' +
    (on ? "0" : "1") +
    '"' +
    (on ? " checked" : "") +
    ">" +
    "<span>Avisarme también cuando falte poco (50 y 20 cm)</span></label>"
  );
}

export async function pintarAvisos() {
  // La tarjeta vive en dos lugares: al pie de "Mi casa", que es donde acabás
  // de fijar tu umbral y es el momento natural para activarlos, y en Ajustes,
  // que es donde alguien los va a buscar después.
  const cajas = [
    document.getElementById("avisos"),
    document.getElementById("ajustes-avisos"),
  ].filter(Boolean);
  if (!cajas.length) return;
  const caja = {
    set innerHTML(v) {
      cajas.forEach((c) => (c.innerHTML = v));
    },
  };
  const umbral = cotaEnHidrometro();
  if (umbral == null) return (caja.innerHTML = "");
  // Sin clave VAPID los avisos no están desplegados todavía. No es culpa del
  // navegador y no tiene sentido ofrecer ni explicar nada: no mostramos nada.
  if (!CONFIG.VAPID_PUBLIC_KEY) return (caja.innerHTML = "");

  const envoltura = (dentro) =>
    '<div class="tarjeta"><h3 style="margin-top:0">Avisos</h3>' +
    dentro +
    "</div>";

  if (!avisosPosibles()) {
    // En iOS los avisos web sólo funcionan con la app instalada en la
    // pantalla de inicio. Callarse dejaría a esa gente sin entender por qué.
    caja.innerHTML = envoltura(
      esIOS() && !estaInstalada()
        ? '<p class="chico" style="margin:0">Para recibir avisos en iPhone, ' +
            "primero <b>agregá la app a tu pantalla de inicio</b>: tocá Compartir " +
            "y después “Agregar a inicio”. Safari sólo permite avisos así.</p>"
        : '<p class="chico" style="margin:0">Este navegador no permite avisos.</p>',
    );
    return;
  }

  if (Notification.permission === "denied") {
    caja.innerHTML = envoltura(
      '<p class="chico" style="margin:0">Bloqueaste los avisos para este sitio. ' +
        "Se vuelven a habilitar desde los ajustes del navegador.</p>",
    );
    return;
  }

  const sub = await suscripcionActual();
  if (sub) {
    caja.innerHTML = envoltura(
      '<p class="chico" style="margin:0"><b style="color:var(--ok-texto)">Avisos activados.</b> ' +
        "Te avisamos cuando el río llegue a tu nivel de aviso (<b>" +
        mU(umbral) +
        "</b>), y también si pasa la alerta o la evacuación de la ciudad.</p>" +
        conmutadorCerca() +
        '<button class="btn sec mini" style="margin-top:11px;display:block" ' +
        'data-accion="avisos-off">Desactivar avisos</button>',
    );
    return;
  }

  // Ojo con dar por sentado que tu umbral es más bajo que la alerta oficial:
  // en terreno alto es al revés, y la frase quedaba diciendo un disparate.
  const antesQueLaAlerta =
    umbral < ALERTA
      ? " — tu nivel de aviso, que llega <b>antes</b> que la alerta de la ciudad"
      : " — tu nivel de aviso. También te avisamos si pasa la alerta o la evacuación de la ciudad";
  caja.innerHTML = envoltura(
    '<p class="chico" style="margin:0">La app sólo sirve si la abrís. Podemos ' +
      "avisarte cuando el río llegue a <b>" +
      mU(umbral) +
      "</b>" +
      antesQueLaAlerta +
      ".</p>" +
      '<button class="btn mini" style="margin-top:11px;display:block" ' +
      'data-accion="avisos-on">Avisarme</button>' +
      LETRA_CHICA,
  );
}
