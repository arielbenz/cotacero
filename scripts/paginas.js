// scripts/paginas.js — genera las páginas de contenido estático.
//
//   node scripts/paginas.js
//
// Emite /puntos-de-encuentro y /datos. Existen por una razón concreta: la
// app esconde 3 de sus 4 secciones detrás de pestañas (`.vista { display:
// none }`), así que ~800 de sus ~975 palabras —los 30 puntos de encuentro
// incluidos— le llegan a un buscador como contenido oculto, que pondera menos
// y no usa en el fragmento. Acá el mismo material va visible y con una URL
// propia.
//
// Los 30 puntos NO se copian: se leen de app/index.html, que es la fuente de
// verdad (app.js hace lo mismo, justamente para que no haya dos listas que se
// desincronicen). Volver a correr esto cuando cambien los puntos o los textos.
//
// Sin dependencias, como el resto del proyecto.
//
// Está partido en scripts/paginas/: base.js (lo compartido), un archivo por
// página y emitir.js, que escribe todo y verifica al final. Este archivo sólo
// arranca: el orden lo dan los imports.

import "./paginas/emitir.js";
