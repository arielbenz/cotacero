// js/analitica.js — el arranque de Google Analytics, en archivo aparte.
//
// El snippet que da Google trae un <script> en línea, y la CSP de este sitio
// lleva `script-src 'self'` sin 'unsafe-inline': ahí adentro no corre nada.
// Es el mismo motivo por el que landing.js existe. Así que el cargador queda
// como <script src> —con googletagmanager habilitado en la CSP— y la
// configuración vive acá, que es mismo-origen y entra sin abrir la política.
//
// NO va en /app ni en /widget:
//   · la app promete por escrito que lo único que sale del dispositivo son las
//     sugerencias (ver /legal y CLAUDE.md);
//   · el widget lo embeben medios en sus propias notas, y /para-medios les
//     promete "sin cookies, sin rastreo de tus lectores". Rastrear a los
//     lectores de otro sitio es una promesa que no es nuestra para romper.

window.dataLayer = window.dataLayer || [];
function gtag() {
  dataLayer.push(arguments);
}
gtag("js", new Date());
gtag("config", "G-4ZWXFWZC9X");

/* El cargador (gtag.js, ~180 KB comprimidos) se pide recién DESPUÉS de que la
   página terminó de cargar, y si el navegador tiene un respiro, en ese
   respiro. Con un <script async> en el <head> competía por la conexión con
   app.css, que bloquea el renderizado: con señal mala, la página tardaba en
   aparecer para que arrancara antes el contador de visitas. Lo que se mide y
   lo que se manda no cambia —la cola de dataLayer de arriba guarda todo hasta
   que llegue—; cambia sólo cuándo se baja.

   Si la página todavía trae el <script async> del cargador escrito en el
   HTML, no se pide otra vez. requestIdleCallback no existe en Safari ni en
   algunos Android viejos: ahí, un setTimeout corto. */
(function () {
  const URL_GTAG = "https://www.googletagmanager.com/gtag/js?id=G-4ZWXFWZC9X";
  function cargar() {
    if (document.querySelector('script[src^="https://www.googletagmanager.com/gtag/js"]'))
      return;
    const s = document.createElement("script");
    s.async = true;
    s.src = URL_GTAG;
    document.head.appendChild(s);
  }
  function enUnRespiro() {
    if (typeof requestIdleCallback === "function")
      requestIdleCallback(cargar, { timeout: 5000 });
    else setTimeout(cargar, 1000);
  }
  if (document.readyState === "complete") enUnRespiro();
  else window.addEventListener("load", enUnRespiro, { once: true });
})();
