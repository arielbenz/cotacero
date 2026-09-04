/* scripts/guia-pdf.js — imprime /guia a guia.pdf con Chrome headless.
 *
 * El PDF no es la fuente: la fuente es la página, con su `@media print`. Esto
 * sólo la pasa a papel para dos usos que un enlace no cubre: mandarla adjunta
 * por WhatsApp, y que alguien imprima cien copias en un centro vecinal sin
 * pelearse con las opciones del navegador.
 *
 * Chrome ya es requisito de build —scripts/iconos.js lo usa para rasterizar la
 * marca—, así que esto no agrega ninguna dependencia.
 *
 *     node scripts/servir.js &        (en otra terminal)
 *     node scripts/guia-pdf.js
 */

import { writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const CHROME =
  process.env.CHROME ||
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const URL_GUIA = process.env.URL_GUIA || "http://localhost:3100/guia";
const PUERTO_CDP = 9333;

const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

const chrome = spawn(CHROME, [
  "--headless",
  "--disable-gpu",
  `--remote-debugging-port=${PUERTO_CDP}`,
  `--user-data-dir=${join(RAIZ, ".chrome-guia")}`,
  "about:blank",
]);
chrome.on("error", (e) => {
  console.error("No se pudo abrir Chrome:", e.message);
  process.exit(1);
});

const enviar = (ws, id, method, params = {}) =>
  new Promise((ok, mal) => {
    const f = (e) => {
      const m = JSON.parse(e.data);
      if (m.id === id) {
        ws.removeEventListener("message", f);
        m.error ? mal(new Error(m.error.message)) : ok(m.result);
      }
    };
    ws.addEventListener("message", f);
    ws.send(JSON.stringify({ id, method, params }));
  });

try {
  await esperar(2500);
  const destino = await (
    await fetch(
      `http://localhost:${PUERTO_CDP}/json/new?` + encodeURIComponent(URL_GUIA),
      { method: "PUT" },
    )
  ).json();
  const ws = new WebSocket(destino.webSocketDebuggerUrl);
  await new Promise((ok) => ws.addEventListener("open", ok));
  let id = 0;
  await enviar(ws, ++id, "Page.enable");
  // Las tipografías son nuestras y van self-hosteadas: sin esperarlas, el PDF
  // sale con la fuente del sistema y los renglones caen en otro lado.
  await esperar(3000);

  const { data, ...resto } = await enviar(ws, ++id, "Page.printToPDF", {
    printBackground: true, // si no, el recuadro rojo del 103 sale en blanco
    preferCSSPageSize: true, // manda el @page de guia.css, no el default
  });
  const pdf = Buffer.from(data, "base64");
  await writeFile(join(RAIZ, "guia.pdf"), pdf);

  /* Cuántas carillas salieron. Importa: la hoja está pensada para UNA, y
     fotocopiar cien de dos es el doble de plata. */
  const carillas = (pdf.toString("latin1").match(/\/Type\s*\/Page[^s]/g) || [])
    .length;
  console.log(
    `escrito: /guia.pdf  (${(pdf.length / 1024).toFixed(0)} KB, ${carillas} carilla${carillas === 1 ? "" : "s"})`,
  );
  if (carillas !== 1)
    console.warn(
      `  OJO: son ${carillas} carillas. La guía está pensada para una sola.`,
    );
} finally {
  chrome.kill();
}
