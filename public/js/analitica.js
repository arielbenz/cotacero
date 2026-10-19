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
