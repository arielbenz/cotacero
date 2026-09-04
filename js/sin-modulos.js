// js/sin-modulos.js — el respaldo para un teléfono que no puede correr la app.
//
// POR QUÉ EXISTE
// La app son módulos ES y usa sintaxis de 2020 (`??`). En un Android viejo
// —Chrome 61 a 79, Safari 10 a 13— pasan dos cosas distintas y las dos
// terminan igual de mal:
//
//   1. El navegador no entiende `type="module"` y lo saltea sin decir nada.
//   2. Lo entiende, baja los 21 módulos, y revienta con SyntaxError en el
//      primer `??`.
//
// En los dos casos la pantalla queda con el "Buscando el nivel del río de
// hoy…" congelado para siempre, y los 7 teléfonos y los 30 puntos —que están
// ahí, en el HTML— quedan invisibles porque viven adentro de `.vista`, que el
// CSS esconde. Una app muerta que dice que está cargando.
//
// `<script nomodule>` NO sirve: el caso 2 son navegadores que SÍ soportan
// módulos, así que se saltearían el respaldo. Por eso este archivo se carga
// siempre y decide mirando si la app dejó su marca.
//
// DÓNDE VIVE
// En js/ y no en js/app/: scripts/paginas.js obliga a precachear todo .js de
// js/app/, y esto no es un módulo de la app. Va envuelto en IIFE porque los
// <script> clásicos comparten el ámbito global —la lección de rio-barra.js—.
// ES5 a propósito: si usara la sintaxis que estamos esquivando, no correría
// justo en los teléfonos para los que se escribió.

(function () {
  "use strict";

  function respaldar() {
    // principal.js pone esta clase apenas evalúa. Si está, la app arrancó.
    if (document.documentElement.className.indexOf("con-modulos") !== -1) return;

    var ns = document.getElementsByTagName("noscript")[0];
    if (!ns) return;

    var caja = document.createElement("div");
    caja.id = "respaldo";
    /* Con el script habilitado el navegador no interpreta el <noscript>: se
       queda con su contenido como texto. Eso es justo lo que hace falta —el
       mismo bloque sirve para "sin JS" y para "navegador viejo", y no hay dos
       listas de teléfonos que se puedan desincronizar—. */
    caja.innerHTML = ns.textContent;

    /* Los 30 puntos se MUEVEN, no se copian: son <a href="geo:…"> que abren la
       app de mapas del teléfono sin una línea de JavaScript. */
    var puntos = document.getElementById("lista-puntos");
    if (puntos) {
      var titulo = document.createElement("h2");
      titulo.textContent = "Adónde ir";
      /* OJO con el destino: el <noscript> arranca con un <style>, así que
         `firstElementChild` es ese <style> y colgar los puntos ahí adentro los
         deja en el DOM pero invisibles —y `querySelectorAll` los sigue
         encontrando, así que el error no se ve testeando por conteo—. Va al
         <div> con el contenido, que es el último hijo. */
      var cont = caja.lastElementChild;
      if (!cont || cont.tagName === "STYLE") cont = caja;
      cont.appendChild(titulo);
      cont.appendChild(puntos);
    }

    /* Arriba de todo, no al final: si va después del pie, lo primero que ve
       alguien que necesita un teléfono es el descargo legal. */
    document.body.insertBefore(caja, document.body.firstChild);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", respaldar);
  } else {
    respaldar();
  }
})();
