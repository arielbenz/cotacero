/* js/app/principal.js — el punto de entrada: arranque y eventos.
   Lo carga app/index.html con type="module"; el resto de los archivos de
   js/app/ cuelgan de acá.

   LA TABLA DE ACCIONES ES LA REGLA DE ORO. La CSP lleva script-src 'self' y
   no hay un solo onclick en el HTML: toda la interactividad pasa por el
   delegador de eventos de este archivo. Para agregar un botón se agrega una
   entrada en ACCIONES (clics, vía data-accion) o en ENTRADAS (campos, vía
   data-input). Un onclick no va a correr y el fallo es mudo. */

/* La marca de que la app arrancó de verdad.
   Está escrita arriba de los imports pero corre DESPUÉS de todos ellos: en un
   módulo ES las importaciones se evalúan primero. Eso es justo lo que la hace
   servir de prueba — si cualquiera de los 21 módulos revienta (sintaxis de
   2020 en un Android viejo, un 404 que corta el grafo), esta línea no llega a
   ejecutarse y la clase no aparece.
   js/sin-modulos.js mira esa clase para decidir si muestra el respaldo con los
   teléfonos y los puntos de encuentro. Si la sacás de acá, ese respaldo se
   activa siempre. */
document.documentElement.classList.add("con-modulos");

import { activarAvisos, desactivarAvisos } from "./avisos.js";
import { cerrarBienvenida, mostrarBienvenida } from "./bienvenida.js";
import { compartirImagen } from "./compartir.js";
import { REFRESCO_MS, ZONAS } from "./config.js";
import {
  calcular,
  estimarCota,
  fijarKmManual,
  marcarCotaManual,
  pintarOrigenCota,
} from "./cota.js";
import { estado, guardado, limpiarGuardadoViejo } from "./estado.js";
import { enCampo } from "./formato.js";
import { instalar, ofrecerInstalacion } from "./instalar.js";
import { cargarLluvia } from "./lluvia.js";
import {
  abrirBuscadorDireccion,
  buscarDireccion,
  mapa,
  ubicarPuntos,
  ubicarmeEnMapa,
} from "./mapa.js";
import { contarVisita } from "./metricas.js";
import {
  compartirPlan,
  exportarPlan,
  imprimirPlan,
  pintarListas,
  prepararImpresion,
} from "./plan.js";
import {
  alternarTodosLosPuntos,
  filtrarPuntos,
  pintarPuntos,
  verEnMapa,
} from "./puntos.js";
import {
  cargarHistoria,
  cargarRio,
  cargarTendencia,
  fijarRioManual,
  pintarPie,
  pintarRio,
  ultimoRefresco,
} from "./rio.js";
import {
  alternarTema,
  aplicarTema,
  aplicarTexto,
  fijarAvisarCerca,
  fijarTexto,
  pintarAjustes,
  pintarSegmentoTema,
} from "./tema.js";
import { irA, pintarConexion, ver } from "./vista.js";

/* ==========================================================================
   COTA CERO — Santa Fe
   --------------------------------------------------------------------------
   MODELO HIDROLÓGICO
   El cero del hidrómetro del Puerto de Santa Fe está a ~8,20 m IGN.
   Entonces:   cota del agua (IGN) = lectura del hidrómetro + 8,20
   El río tiene pendiente natural: aguas arriba el mismo evento da cota más alta.
   Pendiente ~0,045 m por km.
   Verificación con la crecida de junio 1992:
     puerto 7,43 m -> 15,62 IGN.  Arroyo Leyes, 24 km arriba:
     15,62 + (0,045 x 24) = 16,70 IGN  <- coincide con el valor publicado.
   Es UNA sola validación independiente. Coincide bien, pero coincidir con una
   única crecida histórica no convierte esto en un modelo predictivo: falta la
   revisión de especialistas y organismos competentes (Dirección de Gestión de
   Riesgos, INA, FICH-UNL). Hasta entonces, lo que la app calcula son niveles
   de referencia estimados.
   Niveles oficiales en el puerto: alerta 5,30 m / evacuación 5,70 m.

   TRES CONCEPTOS, TRES NOMBRES — nunca intercambiarlos en la interfaz:
     nivel del río     la lectura del hidrómetro del Puerto (dato oficial INA).
     cota del terreno  la elevación IGN del terreno, de las curvas del
                       municipio, con +-0,5 m de margen.
     umbral estimado   la lectura del hidrómetro a partir de la cual el nivel
                       de agua equivalente alcanzaría esa cota, según el modelo.
   Llamarle "tu cota" al umbral está prohibido: son cosas distintas y mezclarlas
   es exactamente lo que hacía sonar esto como una predicción de inundación.

   EN LA INTERFAZ los tres se dicen en llano y la palabra "umbral" NO aparece:
   "el río está en X", "la altura de tu terreno" y "tu nivel de aviso". Acá
   adentro sí, que es donde tiene sentido. Ver CLAUDE.md, "Tres conceptos,
   tres nombres".
   ========================================================================== */

/* ================= ARRANQUE ================= */
function iniciar() {
  limpiarGuardadoViejo();
  const sel = document.getElementById("sel-zona");
  sel.innerHTML =
    '<option value="" disabled selected>Elegí dónde vivís…</option>' +
    ZONAS.map((z) => `<option value="${z.id}">${z.n}</option>`).join("");

  // Sin default: cualquiera que eligiéramos sería una suposición sobre dónde
  // vive la persona, y la más cómoda —el centro— es la más optimista.
  estado.zona = guardado.get("cc_zona") || "";
  sel.value = estado.zona;
  sel.addEventListener("change", () => {
    guardado.set("cc_zona", sel.value);
    calcular();
  });

  const c = guardado.get("cc_cota");
  if (c) {
    estado.cota = parseFloat(c);
    document.getElementById("in-cota").value = enCampo(estado.cota);
    estado.cotaEsEstimada = guardado.get("cc_cota_est") === "1";
    // Antes acá se perdía el origen: al recargar, una cota del GPS y una de
    // una dirección buscada decían exactamente lo mismo.
    estado.cotaOrigen =
      guardado.get("cc_cota_origen") ||
      (estado.cotaEsEstimada ? "gps" : "mano");
    estado.cotaDetalle = guardado.get("cc_cota_detalle") || "";
    pintarOrigenCota();
  }

  const km = guardado.get("cc_km");
  if (km) estado.kmManual = parseFloat(km);

  pintarListas();
  pintarPuntos();
  pintarRio();
  calcular();
  cargarRio();
  cargarLluvia();
  cargarTendencia();
  // Tarde y sin bloquear: la app tiene que poder decir cuánto mide el río
  // aunque este archivo nunca llegue.
  cargarHistoria();
  // Sólo las coordenadas: el mapa se arma al abrir la pestaña.
  ubicarPuntos().catch(() => {
    document.getElementById("estado-mapa").textContent =
      "No se pudieron ubicar los puntos. La lista de acá abajo funciona igual.";
  });

  pintarPie();
}

/* ---- refresco ----
   Durante una emergencia la app se deja abierta, y hasta ahora el nivel
   quedaba congelado en el momento de la carga. Al volver a primer plano
   revalidamos, con un piso para no golpear al INA de más. */
function refrescarSiHaceFalta() {
  if (document.visibilityState !== "visible") return;
  if (Date.now() - ultimoRefresco < REFRESCO_MS) return;
  cargarRio();
  cargarLluvia();
  cargarTendencia();
}
document.addEventListener("visibilitychange", refrescarSiHaceFalta);
window.addEventListener("focus", refrescarSiHaceFalta);

/* ================= EVENTOS =================
   Un solo delegador en vez de atributos onclick/oninput. Dos motivos: habilita
   una CSP con `script-src` estricto —sin 'unsafe-inline' no corre ni un solo
   manejador inline— y el HTML que se genera después (el campo de km, la lista
   de puntos) queda conectado sin volver a cablear nada. */
const ACCIONES = {
  "rio-manual": () => fijarRioManual(),
  "rio-auto": () => cargarRio(),
  "cota-gps": () => estimarCota(),
  "abrir-dir": () => abrirBuscadorDireccion(),
  "buscar-dir": () => buscarDireccion(),
  exportar: () => exportarPlan(),
  compartir: () => compartirPlan(),
  ubicarme: () => ubicarmeEnMapa(),
  imprimir: () => imprimirPlan(),
  tema: () => alternarTema(),
  "ver-todos": () => alternarTodosLosPuntos(),
  instalar: () => instalar(),
  ajustes: () => irA("ajustes"),
  "bv-calcular": () => cerrarBienvenida("cota"),
  "bv-despues": () => cerrarBienvenida(),
  "compartir-imagen": () => compartirImagen(),
  // El despachador ya pasa el elemento que se tocó: estas leen un data- suyo.
  "tema-set": (el) => {
    guardado.set("cc_tema", el.dataset.theme || "");
    aplicarTema(el.dataset.theme || "");
    pintarSegmentoTema();
  },
  "texto-set": (el) => fijarTexto(el.dataset.texto || ""),
  "avisar-cerca": (el) => fijarAvisarCerca(el.dataset.on === "1"),
  "avisos-on": () => activarAvisos(),
  "avisos-off": () => desactivarAvisos(),
  ver: (el) => ver(el.dataset.vista, el),
  // Desde un botón que no es el de la nav: irA() busca el botón correcto para
  // que el resaltado y el aria-current queden donde tienen que quedar.
  ir: (el) => irA(el.dataset.vista),
  // Sin preventDefault: el <a href="geo:..."> tiene que seguir abriendo la
  // app de mapas del teléfono.
  "ver-en-mapa": (el) => verEnMapa(el.dataset.nombre),
};

const ENTRADAS = {
  "cota-manual": () => marcarCotaManual(),
  "filtrar-puntos": () => filtrarPuntos(),
  "km-manual": (el) => fijarKmManual(el.value),
};

function conectarEventos() {
  document.addEventListener("click", (ev) => {
    const el = ev.target.closest("[data-accion]");
    const fn = el && ACCIONES[el.dataset.accion];
    if (fn) fn(el, ev);
  });
  document.addEventListener("input", (ev) => {
    const el = ev.target.closest("[data-input]");
    const fn = el && ENTRADAS[el.dataset.input];
    if (fn) fn(el, ev);
  });
  window
    .matchMedia("(prefers-color-scheme: light)")
    .addEventListener("change", () => {
      if (!guardado.get("cc_tema")) aplicarTema("");
    });
  window.addEventListener("online", pintarConexion);
  window.addEventListener("offline", pintarConexion);
  // Ctrl/Cmd+P también tiene que salir bien, no sólo el botón.
  window.addEventListener("beforeprint", prepararImpresion);
  pintarConexion();
  document.getElementById("in-dir").addEventListener("keydown", (ev) => {
    if (ev.key === "Enter") {
      ev.preventDefault();
      buscarDireccion();
    }
  });
}

/* Deep links: /?ir=cota abre directo esa pestana */
function abrirDesdeURL() {
  const ir = new URLSearchParams(location.search).get("ir");
  // La primera entrada también necesita estado: sin esto, el primer "atrás"
  // desde otra pestaña llega con state null y no sabe adónde volver.
  history.replaceState({ vista: ir || "rio" }, "");
  if (ir) irA(ir, true);
}

document.addEventListener("DOMContentLoaded", () => {
  aplicarTema(guardado.get("cc_tema") || "");
  aplicarTexto(guardado.get("cc_texto") || "");
  conectarEventos();
  iniciar();
  abrirDesdeURL();
  contarVisita();
  ofrecerInstalacion();
  pintarAjustes();
  mostrarBienvenida();
});
