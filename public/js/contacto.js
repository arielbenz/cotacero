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
const errorTexto = $("sug-texto-error");
const errorContacto = $("sug-contacto-error");
const gracias = $("sug-gracias");

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

/* Cada error va debajo del campo que lo causó, con aria-invalid: antes
   salían todos en un renglón al pie del botón, lejos de lo que había que
   corregir, y el campo quedaba igual. */
function errorEn(campo, caja, html) {
  caja.innerHTML = html || "";
  caja.hidden = !html;
  if (html) campo.setAttribute("aria-invalid", "true");
  else campo.removeAttribute("aria-invalid");
}

/* Lo que contesta el servidor —o que no contestó— va en una caja arriba del
   botón. El título llega por textContent: puede venir de la red. */
function errorDeEnvio(titulo, resto) {
  estado.textContent = "";
  estado.hidden = !titulo;
  if (!titulo) return;
  const cuerpo = document.createElement("div");
  cuerpo.className = "est-cuerpo";
  const b = document.createElement("b");
  b.className = "est-titu";
  b.textContent = titulo;
  const t = document.createElement("span");
  t.className = "est-txt";
  t.textContent = resto;
  cuerpo.append(b, t);
  estado.appendChild(cuerpo);
}

const aLaVista = (el) => {
  // Con movimiento reducido pedido, el salto es directo.
  const quieto = matchMedia("(prefers-reduced-motion: reduce)").matches;
  el.scrollIntoView({ block: "nearest", behavior: quieto ? "auto" : "smooth" });
};

/* Enviado: el formulario se va y queda la confirmación en su lugar. Era un
   renglón verde chico debajo del botón, con el formulario vacío arriba: no
   se distinguía de no haber mandado nada. Dice qué pasa ahora y, según si
   dejó correo, si puede esperar respuesta. */
function mostrarGracias(correo) {
  const p = $("sug-gracias-txt");
  p.textContent =
    "Lo va a leer una persona. No hay respuesta automática y puede tardar. ";
  if (correo) {
    p.append("Si hace falta, te escribimos a ");
    const b = document.createElement("b");
    b.textContent = correo;
    p.append(b, ".");
  } else {
    p.append("No dejaste un correo, así que no vamos a poder responderte.");
  }
  form.hidden = true;
  gracias.hidden = false;
  gracias.focus({ preventScroll: true });
  aLaVista(gracias);
}

function otraVez() {
  gracias.hidden = true;
  form.hidden = false;
  texto.focus();
}

async function enviar(ev) {
  ev.preventDefault();
  errorDeEnvio("");
  const t = texto.value.trim();
  /* Sólo correo: se responde por escrito. La misma expresión que esCorreo en
     lib/sugerencias.js, que este script clásico no puede importar. */
  const c = contacto.value.trim();
  const faltaTexto = t.length < MIN_TEXTO;
  const correoMal = Boolean(c) && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(c);
  errorEn(
    texto,
    errorTexto,
    faltaTexto
      ? "<b>Contanos un poco más.</b> Con menos de " +
          MIN_TEXTO +
          " caracteres no se entiende qué pasó."
      : "",
  );
  errorEn(
    contacto,
    errorContacto,
    correoMal
      ? "<b>Ese correo no parece completo.</b> Revisalo, o dejalo vacío si " +
          "no querés respuesta."
      : "",
  );
  if (faltaTexto || correoMal) {
    (faltaTexto ? texto : contacto).focus();
    return;
  }

  const elegida = form.querySelector('input[name="categoria"]:checked');
  boton.disabled = true;
  const textoBoton = boton.textContent;
  boton.textContent = "Enviando…";

  try {
    const r = await fetch("/api/sugerencias", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        categoria: elegida ? elegida.value : "otro",
        texto: t,
        contacto: c,
      }),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.error || "No se pudo enviar.");
    texto.value = "";
    contacto.value = "";
    contar();
    mostrarGracias(c);
  } catch (e) {
    /* El mensaje del servidor se muestra tal cual porque es nuestro y ya viene
       redactado para leerse: "Esperá un rato antes de mandar otra", "El texto
       es demasiado largo". Sin red, fetch lanza un TypeError con un texto en
       inglés del navegador: ése no se muestra. */
    const sinRed = e instanceof TypeError;
    errorDeEnvio(
      sinRed ? "No hay conexión." : e.message,
      sinRed
        ? "Tu mensaje sigue escrito acá arriba: probá de nuevo cuando vuelva la señal."
        : "Tu mensaje sigue escrito acá arriba: podés intentar de nuevo más tarde.",
    );
    aLaVista(estado);
  } finally {
    boton.disabled = false;
    boton.textContent = textoBoton;
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

if (form) {
  form.addEventListener("change", (ev) => {
    if (ev.target.name === "categoria") pintarAyuda();
  });
  form.addEventListener("submit", enviar);
  texto.addEventListener("input", contar);
  // Al corregir, el error del campo se va: no hace falta volver a enviar.
  texto.addEventListener("input", () => errorEn(texto, errorTexto, ""));
  contacto.addEventListener("input", () => errorEn(contacto, errorContacto, ""));
  $("sug-otra").addEventListener("click", otraVez);
  contar();
  /* Una vez al arrancar: al recargar, el navegador puede restaurar otro tema
     marcado y la ayuda del HTML quedaría diciendo la del tema por defecto. */
  pintarAyuda();
}
