/* js/contacto.js — el formulario de /contacto.
   ---------------------------------------------------------------------------
   Lo que hace este archivo es mandar el formulario, contar caracteres y
   cambiar la ayuda según el tema.
   Elegir una categoría NO necesita JavaScript: las pastillas son
   <input type="radio"> de verdad con su <label>, así que funcionan con
   teclado, con lector de pantalla y aunque este script no cargue nunca.

   Sin manejadores inline: la CSP lleva `script-src 'self'` y un onclick en el
   HTML no correría — y el fallo sería mudo.

   Es un <form> real con un botón submit, no un botón suelto: así responde al
   Enter, el navegador lo trata como formulario y si el JS falla al menos
   intenta un envío normal (que no llega a ningún lado, pero no deja al botón
   muerto sin decir nada). */

const $ = (id) => document.getElementById(id);

const form = $("form-contacto");
const texto = $("sug-texto");
const contacto = $("sug-contacto");
const estado = $("sug-estado");
const cuenta = $("sug-cuenta");
const boton = $("sug-enviar");

const MIN_TEXTO = 10;

/* El contador aparece recién cuando falta poco: mostrar "0 / 600" desde el
   principio es ruido, y avisar a los 550 sí sirve. */
function contar() {
  const n = texto.value.length;
  const max = +texto.getAttribute("maxlength") || 600;
  if (n < max - 80) {
    cuenta.textContent = "";
    return;
  }
  cuenta.textContent = `Te quedan ${max - n} caracteres.`;
}

function aviso(html, tono) {
  estado.className = "chico" + (tono ? " estado-" + tono : "");
  estado.innerHTML = html;
}

async function enviar(ev) {
  ev.preventDefault();
  const t = texto.value.trim();
  if (t.length < MIN_TEXTO) {
    aviso(
      "<b>Contanos un poco más.</b> Con menos de " +
        MIN_TEXTO +
        " caracteres no se entiende qué pasó.",
      "mal",
    );
    texto.focus();
    return;
  }

  const elegida = form.querySelector('input[name="categoria"]:checked');
  boton.disabled = true;
  const textoBoton = boton.textContent;
  boton.textContent = "Enviando…";
  aviso("Enviando…");

  try {
    const r = await fetch("/api/sugerencias", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        categoria: elegida ? elegida.value : "otro",
        texto: t,
        contacto: contacto.value.trim(),
      }),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.error || "No se pudo enviar.");
    texto.value = "";
    contacto.value = "";
    contar();
    aviso(
      "<b>Gracias, llegó.</b> Lo va a leer una persona — no hay respuesta " +
        "automática y puede tardar. Si dejaste un contacto y hace falta, te " +
        "escribimos.",
      "bien",
    );
  } catch (e) {
    /* El mensaje del servidor se muestra tal cual porque es nuestro y ya viene
       redactado para leerse: "Esperá un rato antes de mandar otra", "El texto
       es demasiado largo". Va por textContent dentro de un <b> para no
       inyectar marcado que venga de la red. */
    const b = document.createElement("b");
    b.textContent = e.message;
    aviso("", "mal");
    estado.append(b, " Podés intentar de nuevo más tarde.");
  } finally {
    boton.disabled = false;
    boton.textContent = textoBoton;
    estado.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }
}

/* La ayuda y el ejemplo del campo cambian con el tema. Los textos vienen en
   el HTML, en data-ayuda y data-ejemplo de cada opción, y los escribe
   scripts/paginas.js desde lib/sugerencias.js: este archivo no tiene ninguno
   escrito a mano. Sin JS queda la ayuda del tema por defecto. */
function pintarAyuda() {
  const elegida = form.querySelector('input[name="categoria"]:checked');
  const ayuda = $("sug-ayuda");
  if (!elegida || !ayuda) return;
  ayuda.textContent = elegida.dataset.ayuda || "";
  ayuda.hidden = !elegida.dataset.ayuda;
  texto.placeholder = elegida.dataset.ejemplo || "";
}

/* ---------- dictar con la voz ----------
   Escribe en el mismo cuadro de texto: lo que se manda sigue siendo texto, y
   la persona lo revisa antes. Sin reconocimiento de voz en el navegador
   (Firefox, por ejemplo) el botón no aparece y el formulario es el de
   siempre. Lo del audio —que en Chrome lo procesa Google— está dicho junto al
   botón y en /legal.
   Se arma el texto entero a partir de todos los resultados, no sólo del
   último: en algunos Android el evento repite lo ya dicho, y sumar de a
   pedazos lo duplicaba. */
const Reconocimiento = window.SpeechRecognition || window.webkitSpeechRecognition;

const ERRORES_VOZ = {
  "not-allowed": "No diste permiso para usar el micrófono. Escribí el mensaje.",
  "service-not-allowed": "Este navegador no deja dictar. Escribí el mensaje.",
  "audio-capture": "No encontramos un micrófono. Escribí el mensaje.",
  "no-speech": "No te escuchamos. Probá de nuevo, cerca del micrófono.",
  network: "No hay conexión con el servicio de voz. Escribí el mensaje.",
  "language-not-supported": "Este navegador no entiende español dictado. Escribí el mensaje.",
};

function iniciarDictado() {
  const caja = $("dictado");
  const voz = $("sug-voz");
  const msg = $("voz-estado");
  const etiqueta = voz.querySelector("span");
  const ayuda = msg.innerHTML;
  let rec = null;

  const decir = (html) => (msg.innerHTML = html);
  const reposo = () => {
    rec = null;
    voz.setAttribute("aria-pressed", "false");
    etiqueta.textContent = "Dictar con la voz";
  };

  function empezar() {
    const base = texto.value.trim();
    const max = +texto.getAttribute("maxlength") || 600;
    let fallo = "";
    rec = new Reconocimiento();
    rec.lang = "es-AR";
    rec.continuous = true;
    rec.interimResults = true;
    rec.onresult = (ev) => {
      let dicho = "";
      for (let i = 0; i < ev.results.length; i++)
        dicho += ev.results[i][0].transcript;
      texto.value = (base ? base + " " : "") + dicho.trim();
      if (texto.value.length > max) texto.value = texto.value.slice(0, max);
      contar();
    };
    rec.onerror = (ev) => {
      fallo = ERRORES_VOZ[ev.error] || "";
    };
    rec.onend = () => {
      reposo();
      if (fallo) decir("<b>" + fallo + "</b>");
      else if (texto.value.trim() && texto.value.trim() !== base)
        decir("<b>Listo.</b> Revisá el texto antes de enviarlo: puede haber palabras mal entendidas.");
      else decir(ayuda);
    };
    try {
      rec.start();
    } catch (e) {
      reposo();
      return;
    }
    voz.setAttribute("aria-pressed", "true");
    etiqueta.textContent = "Dejar de grabar";
    decir("<b>Escuchando…</b> Hablá cerca del micrófono.");
  }

  voz.addEventListener("click", () => {
    if (rec) rec.stop();
    else empezar();
  });
  // Mandar con el micrófono abierto cortaría el último pedazo a mitad.
  form.addEventListener("submit", () => rec && rec.stop(), true);
  caja.hidden = false;
}

if (form) {
  form.addEventListener("change", (ev) => {
    if (ev.target.name === "categoria") pintarAyuda();
  });
  form.addEventListener("submit", enviar);
  texto.addEventListener("input", contar);
  contar();
  if (Reconocimiento) iniciarDictado();
  /* Una vez al arrancar: al recargar, el navegador puede restaurar otro tema
     marcado y la ayuda del HTML quedaría diciendo la del tema por defecto. */
  pintarAyuda();
}
