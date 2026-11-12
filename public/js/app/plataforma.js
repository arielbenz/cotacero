/* js/app/plataforma.js — en qué teléfono corre la app y si está instalada.
   Vivían en avisos.js; las necesitan también instalar.js y bienvenida.js, y
   importarlas de ahí arrastraba medio grafo (avisos → cota → rio). No importa
   nada. */

export const esIOS = () =>
  /iPad|iPhone|iPod/.test(navigator.userAgent) ||
  (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

export const estaInstalada = () =>
  window.matchMedia("(display-mode: standalone)").matches ||
  navigator.standalone === true;

/* En iPhone la app del ícono guarda sus datos aparte de los del navegador:
   la casa cargada en Safari NO aparece al abrirla instalada, y los avisos
   sólo existen instalada. Por eso ahí el orden es instalar primero y cargar
   la casa después (bienvenida.js, avisos.js, instalar.js). */
export const iosSinInstalar = () => esIOS() && !estaInstalada();
