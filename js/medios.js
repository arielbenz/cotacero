/* medios.js — sólo el botón "Copiar" de /para-medios.
   Es mejora progresiva: sin JavaScript el <pre> se selecciona igual y el botón
   ni aparece, así que la página sirve para lo mismo. Va en un archivo aparte y
   no inline porque la CSP es script-src 'self' sin excepciones. */
const pre = document.getElementById("codigo-widget");
const btn = document.getElementById("copiar-widget");
if (pre && btn && navigator.clipboard) {
  btn.hidden = false;
  btn.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(pre.textContent.trim());
      btn.textContent = "¡Copiado!";
    } catch (e) {
      // Sin permiso de portapapeles no se finge que anduvo.
      btn.textContent = "Copialo a mano";
    }
    setTimeout(() => (btn.textContent = "Copiar"), 2400);
  });
}
