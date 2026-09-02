/* js/contacto.js — el formulario de /contacto.
   ---------------------------------------------------------------------------
   Lo único que hace este archivo es mandar el formulario y contar caracteres.
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

if (form) {
  form.addEventListener("submit", enviar);
  texto.addEventListener("input", contar);
  contar();
}
