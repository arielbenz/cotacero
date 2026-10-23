// scripts/app-en-node.js — para cargar los módulos de la app desde Node.
//
//   import "./app-en-node.js";                  // desde scripts/
//   import "../scripts/app-en-node.js";         // desde datos-crudos/
//   const { elevacionDe } = await import("/js/app/elevacion.js");
//
// Dos cosas que en el navegador hace el servidor y acá no hace nadie:
//   - las rutas del navegador («/lib/comun.js», «/js/app/…») se resuelven
//     contra public/, con un hook de resolución;
//   - fetch() de un archivo del sitio («/datos-abiertos/curvas.json») lee del
//     disco. Cualquier otra cosa falla, como fallaría sin red.
//
// Lo usan scripts/comprobar.js y los análisis de datos-crudos/, que importan
// el código de producción en vez de copiarlo. Sin dependencias.

import { registerHooks } from "node:module";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

export const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), "..");
export const PUBLICO = join(RAIZ, "public");

registerHooks({
  resolve(especificador, contexto, siguiente) {
    if (especificador.startsWith("/") && !especificador.startsWith(RAIZ))
      return siguiente(pathToFileURL(join(PUBLICO, especificador)).href, contexto);
    return siguiente(especificador, contexto);
  },
});

globalThis.fetch = async (url) => {
  const ruta = join(PUBLICO, String(url));
  if (!String(url).startsWith("/") || !existsSync(ruta)) return { ok: false };
  return { ok: true, json: async () => JSON.parse(readFileSync(ruta, "utf8")) };
};
