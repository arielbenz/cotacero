/* js/app/avisos.js — los avisos por push.
   El servidor manda un push SIN CONTENIDO: no sabe la cota de nadie ni a qué
   altura avisarle, sólo despierta al teléfono. La notificación la arma el
   service worker comparando contra el umbral que guardamos en IndexedDB de
   ese dispositivo. De cada persona el servidor guarda un solo dato: el
   endpoint opaco del navegador. */

import { CONFIG } from "./config.js";
import { cotaEnHidrometro } from "./cota.js";
import { estado, guardado } from "./estado.js";
import { m, mU } from "./formato.js";
import { ALERTA, EVACUACION, RECORD } from "./oficiales.js";
import { sobreRecord } from "/lib/comun.js";
import { iosSinInstalar } from "./plataforma.js";
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
    // La confirmación es el propio aviso: se ve cómo va a llegar.
    probarAviso();
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

/* Un aviso de prueba, armado en el teléfono. «Avisos activados» era la única
   señal, y no decía si el teléfono los iba a mostrar: con las notificaciones
   del navegador apagadas en los ajustes del sistema el permiso figura dado y
   no aparece nada. No pasa por el servidor —no sale nada del dispositivo—,
   así que prueba que el teléfono las muestra, no el camino del push. */
export async function probarAviso() {
  const decir = (t) =>
    document
      .querySelectorAll("[data-prueba-aviso]")
      .forEach((p) => (p.textContent = t));
  try {
    const reg = await navigator.serviceWorker.ready;
    await reg.showNotification("Aviso de prueba de Cota Cero", {
      body: "Así te va a llegar cuando el río suba. No hay que hacer nada.",
      icon: "/img/icon-192.png",
      badge: "/img/favicon-32.png",
      lang: "es-AR",
      tag: "cota-cero-prueba",
      data: { ir: "/app?ir=cota" },
    });
    decir(
      "Te mandamos uno de prueba. Si no lo viste, revisá en los ajustes del " +
        "teléfono que las notificaciones del navegador estén permitidas.",
    );
  } catch (e) {
    decir(
      "No se pudo mostrar el aviso de prueba. Revisá en los ajustes del " +
        "teléfono que las notificaciones del navegador estén permitidas.",
    );
  }
}

const LETRA_CHICA =
  '<p class="chico" style="margin:9px 0 0">El aviso lo arma tu teléfono: el ' +
  "servidor guarda sólo una dirección anónima de tu navegador, <b>no tu casa " +
  'ni tu nivel de aviso</b>. <a href="/legal">Qué se guarda</a></p>';

/* Los tres niveles a los que avisa, uno por renglón y con su número: es más
   fácil decidir activarlo viendo exactamente qué va a sonar. */
const listaNiveles = (umbral) =>
  '<ul class="lista-niveles">' +
  (sobreRecord(umbral, RECORD, estado.rio)
    ? '<li><b class="c-vos">↑</b>si llega a tu nivel de aviso, que está más alto que el récord</li>'
    : '<li><b class="c-vos">' +
      mU(umbral).replace(" m", "") +
      "</b>cuando el río llegue a tu nivel de aviso</li>") +
  '<li><b class="c-alerta">' +
  m(ALERTA).replace(" m", "") +
  "</b>si pasa la alerta de la ciudad</li>" +
  '<li><b class="c-evac">' +
  m(EVACUACION).replace(" m", "") +
  "</b>si pasa la evacuación de la ciudad</li></ul>";

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
    '<div class="tarjeta"><h3 style="margin-top:0">Que te avise el teléfono</h3>' +
    dentro +
    "</div>";

  if (!avisosPosibles()) {
    // En iOS los avisos web sólo funcionan con la app instalada en la
    // pantalla de inicio. Callarse dejaría a esa gente sin entender por qué.
    /* Con botón: decía «tocá Compartir y después Agregar a inicio» en texto
       corrido, cuando la hoja con los pasos ya existía (instalar.js). Y dice
       lo de la casa: en iPhone la app instalada no ve lo cargado acá. */
    caja.innerHTML = envoltura(
      iosSinInstalar()
        ? '<p class="chico" style="margin:0">En iPhone los avisos sólo ' +
            "funcionan con la app <b>agregada a la pantalla de inicio</b>. " +
            "Tu casa hay que cargarla de nuevo ahí: lo del navegador no pasa " +
            "a la app instalada.</p>" +
            '<button class="btn sec mini" type="button" style="margin-top:11px;display:block" ' +
            'data-accion="instalar">Ver cómo agregarla</button>'
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
        (sobreRecord(umbral, RECORD, estado.rio)
          ? "más alto que el récord"
          : mU(umbral)) +
        "</b>), y también si pasa la alerta o la evacuación de la ciudad.</p>" +
        conmutadorCerca() +
        '<p class="chico" style="margin:9px 0 0" role="status" data-prueba-aviso></p>' +
        '<div class="fila-botones" style="margin-top:11px">' +
        '<button class="btn sec mini" type="button" data-accion="avisos-probar">Mandarme uno de prueba</button>' +
        '<button class="enlace-crudo" type="button" data-accion="avisos-off">Desactivar avisos</button>' +
        "</div>",
    );
    return;
  }

  /* Con la zona sin confirmar el número es provisorio (estado.zonaAjena): el
     aviso sonaría por un nivel que la app misma dice que no es seguro. Sólo se
     bloquea ACTIVAR; quien ya los tiene sigue pudiendo desactivarlos. */
  if (estado.zonaAjena) {
    caja.innerHTML = envoltura(
      '<p class="chico" style="margin:0"><b>Elegí tu zona para activar el ' +
        "aviso.</b> La dirección que buscaste queda en otra zona que la " +
        "elegida, y el aviso sonaría por un nivel provisorio.</p>",
    );
    return;
  }

  /* Antes era una frase que comparaba tu nivel de aviso con la alerta de la
     ciudad («más bajo que…», «más alto que…»). Los dos números conviven y no
     se los pone a competir: la alerta de la ciudad es un umbral operativo,
     uno solo para toda Santa Fe, y el nivel de aviso depende de la altura del
     terreno y de la distancia al Puerto. La lista los pone uno debajo del
     otro y no dice cuál llega antes. */
  caja.innerHTML = envoltura(
    '<p class="chico" style="margin:0 0 8px">La app sólo sirve si la abrís. ' +
      "Podemos avisarte:</p>" +
      listaNiveles(umbral) +
      '<button class="btn" style="margin-top:12px" ' +
      'data-accion="avisos-on">Avisarme</button>' +
      LETRA_CHICA,
  );
}
