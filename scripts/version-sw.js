// scripts/version-sw.js — la VERSION del service worker, calculada.
//
// Es un resumen (sha256, diez caracteres) de sw.js —sin el propio renglón de
// la versión— y del contenido de cada archivo que precachea. Cambia cuando
// cambia cualquiera de ellos, que es exactamente cuándo tiene que cambiar:
// con la versión vieja, lo que va por caché primero (íconos, tipografías,
// las curvas) queda congelado en el teléfono de la gente.
//
// Antes era un número que había que acordarse de subir en cada deploy.
// La escribe scripts/paginas/emitir.js y la verifica scripts/comprobar.js.

import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";

export const RENGLON_VERSION = /^const VERSION = "([^"]*)";$/m;

/* De una ruta del precache al archivo en public/: «/» es la portada, una ruta
   sin extensión es una carpeta con su index.html. */
const archivoDe = (ruta) =>
  ruta === "/"
    ? "index.html"
    : /\.[a-z0-9]+$/i.test(ruta)
      ? ruta.slice(1)
      : ruta.slice(1) + "/index.html";

export function versionDelSw(publico) {
  const sw = readFileSync(join(publico, "sw.js"), "utf8");
  const h = createHash("sha256");
  h.update(sw.replace(RENGLON_VERSION, ""));
  for (const [, ruta] of sw.matchAll(/^\s*"(\/[^"]*)",$/gm)) {
    h.update(ruta);
    h.update(readFileSync(join(publico, archivoDe(ruta))));
  }
  return "cota-cero-" + h.digest("hex").slice(0, 10);
}
