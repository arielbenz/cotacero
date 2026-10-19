/* js/app/fuentes.js — de dónde sale cada dato, para poder decirlo en la
   pantalla donde se muestra y no sólo en /datos.

   Hasta acá esto era una COPIA a mano de lib/fuentes.js, porque app.js era un
   script clásico y no podía importar nada. Desde que la app son módulos ES,
   importa el original: los organismos y sus URLs quedan escritos en un solo
   lugar de verdad, y ya no hay dos listas que se puedan desincronizar.

   lib/fuentes.js es puro dato y exports —ni un require, ni un `node:`—, así
   que el navegador lo carga igual que cualquier módulo. Pesa 3 KB comprimido
   y el service worker lo precachea. */

import { ORGANISMOS, FUENTES } from "/lib/fuentes.js";
import { atr } from "./formato.js";

/* El reporte diario del INA. La app no lo lee desde el navegador —para eso
   está /api/nivel, que esquiva la falta de CORS—, pero sí lo enlaza en todas
   las pantallas donde muestra el nivel: quien quiera comprobar el número
   tiene que poder llegar al original en un toque. Sale del registro, no
   escrito a mano. */
export const FUENTE_RIO = FUENTES.nivelRio.url;

/* Los tres datos que la app muestra y de los que puede citar la fuente en
   pantalla. Sale del registro original; acá sólo se elige cuáles y con qué
   nombre corto se los presenta, que es una decisión de interfaz. */
export const FUENTES_APP = {
  rio: {
    quien: ORGANISMOS[FUENTES.nivelRio.organismo].sigla,
    url: FUENTES.nivelRio.url,
  },
  topografia: {
    quien: "Curvas de nivel · " + ORGANISMOS[FUENTES.topografia.organismo].nombre,
    url: FUENTES.topografia.url,
  },
  emergencias: {
    quien: ORGANISMOS[FUENTES.emergencias.organismo].corto,
    url: FUENTES.emergencias.url,
  },
};

/* El sello de fuente: quién publica el dato y adónde ir a mirarlo. Discreto a
   propósito — la trazabilidad tiene que estar siempre disponible sin competir
   con el número. */
export const selloFuente = (f) =>
  '<span class="sello-fuente"><span class="k">Fuente</span> ' +
  atr(f.quien) +
  ' <a href="' +
  atr(f.url) +
  '" target="_blank" rel="noopener">ver</a></span>';
