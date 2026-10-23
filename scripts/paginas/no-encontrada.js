// scripts/paginas/no-encontrada.js — la página 404. La escribe emitir.js.

import { pagina } from "./base.js";

/* ---------- 404 ----------
   Vercel sirve /404.html —con código 404 de verdad— para cualquier ruta que
   no exista. Alguien que se equivoca de dirección durante una crecida no
   tiene que quedarse mirando un error: el nivel del río va arriba de todo.

   El nivel sale del widget por iframe, que ya existe, se actualiza solo y no
   agrega ni una línea de JavaScript a esta página. */
const htmlNoEncontrada = pagina({
  clave: "noEncontrada",
  migaja: "Página no encontrada",
  chip: "Error 404",
  h1: "Esa página no existe",
  lead:
    "Puede que el enlace esté viejo o que haya un error de tipeo. Mientras " +
    "tanto, el río:",
  bloques: [
    {
      html: `        <iframe src="/widget" title="Nivel del río Paraná en el Puerto de Santa Fe"
          loading="lazy" style="width:100%;height:225px;border:0;border-radius:16px"></iframe>
        <p class="aviso grave" style="margin:var(--e-4) 0 0">
          Si es una emergencia, Defensa Civil: <a href="tel:103"><b>103</b></a>.
        </p>`,
    },
    {
      titulo: "Lo que sí existe",
      html: `        <ul class="accesos">
          <li><a href="/">El nivel del Paraná hoy</a></li>
          <li><a href="/datos">La altura de tu terreno</a></li>
          <li><a href="/puntos-de-encuentro">Los 30 puntos de encuentro</a></li>
          <li><a href="/historia">Las crecidas históricas</a></li>
          <li><a href="/datos#fuentes">De dónde salen los datos</a></li>
        </ul>`,
    },
  ],
});

export {
  htmlNoEncontrada,
};
