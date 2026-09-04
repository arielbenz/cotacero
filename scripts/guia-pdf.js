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
 *     node scripts/guia-pdf.js
 *
 * Levanta su propio servidor y lo baja al terminar. Antes esperaba uno puesto
 * a mano "en otra terminal" y apuntaba al puerto 3100, que no es el que usa
 * scripts/servir.js: imprimió el "This site can't be reached" de Chrome, contó
 * una carilla, dijo que todo bien, y ese PDF se publicó. De ahí las dos
 * comprobaciones de abajo.
 */

import { writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const CHROME =
  process.env.CHROME ||
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
/* Un puerto propio, para no chocar con el servidor de desarrollo que alguien
   pueda tener abierto en 3000. */
const PUERTO = Number(process.env.PORT_GUIA || 3177);
const PUERTO_CDP = 9333;
const URL_GUIA = process.env.URL_GUIA || `http://localhost:${PUERTO}/guia`;

const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

const morir = (msg) => {
  console.error("guia-pdf: " + msg);
  process.exitCode = 1;
  throw new Error(msg);
};

/* Espera a que algo conteste, en vez de dormir un rato y cruzar los dedos. */
async function esperarA(url, intentos = 40) {
  for (let i = 0; i < intentos; i++) {
    try {
      const r = await fetch(url);
      if (r.ok) return r;
    } catch (e) {
      /* todavía no levantó */
    }
    await esperar(250);
  }
  return null;
}

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

let servidor = null;
let chrome = null;

try {
  // 1. El servidor. Es el único que aplica las cabeceras de vercel.json.
  servidor = spawn("node", [join(RAIZ, "scripts", "servir.js")], {
    env: { ...process.env, PORT: String(PUERTO) },
    stdio: "ignore",
  });
  servidor.on("error", (e) => morir("no se pudo levantar el servidor: " + e.message));
  if (!(await esperarA(URL_GUIA)))
    morir(`el servidor no contestó en ${URL_GUIA}`);

  // 2. Chrome.
  chrome = spawn(CHROME, [
    "--headless",
    "--disable-gpu",
    `--remote-debugging-port=${PUERTO_CDP}`,
    `--user-data-dir=${join(RAIZ, ".chrome-guia")}`,
    "about:blank",
  ]);
  chrome.on("error", (e) => morir("no se pudo abrir Chrome: " + e.message));
  if (!(await esperarA(`http://localhost:${PUERTO_CDP}/json/version`)))
    morir("Chrome no abrió su puerto de depuración");

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
  await enviar(ws, ++id, "Runtime.enable");

  /* Las tipografías son nuestras y van self-hosteadas: sin esperarlas, el PDF
     sale con la fuente del sistema y los renglones caen en otro lado. Se
     espera al evento, no a un cronómetro. */
  const listo = await enviar(ws, ++id, "Runtime.evaluate", {
    expression: "document.fonts.ready.then(() => true)",
    awaitPromise: true,
    returnByValue: true,
  });
  if (listo.result?.value !== true) morir("las tipografías no terminaron de cargar");

  /* Que lo que hay en pantalla SEA la guía. Ésta es la comprobación que
     faltaba: una página de error de Chrome también ocupa una carilla. */
  const quees = await enviar(ws, ++id, "Runtime.evaluate", {
    expression: `(() => ({
      hoja: !!document.querySelector(".guia-hoja"),
      casillas: document.querySelectorAll(".g-caja").length,
      tel103: !!document.querySelector(".g-103"),
      titulo: document.title,
    }))()`,
    returnByValue: true,
  });
  const p = quees.result?.value || {};
  if (!p.hoja || !p.tel103 || p.casillas < 20)
    morir(
      `la página cargada no es la guía (título: ${JSON.stringify(p.titulo)}, ` +
        `hoja: ${!!p.hoja}, casillas: ${p.casillas || 0}). ` +
        "No se escribió nada.",
    );

  // 3. A papel.
  const { data } = await enviar(ws, ++id, "Page.printToPDF", {
    printBackground: true, // si no, el recuadro rojo del 103 sale en blanco
    preferCSSPageSize: true, // manda el @page de guia.css, no el default
  });
  const pdf = Buffer.from(data, "base64");

  /* Cuántas carillas salieron. Importa: la hoja está pensada para UNA, y
     fotocopiar cien de dos es el doble de plata. */
  const carillas = (pdf.toString("latin1").match(/\/Type\s*\/Page[^s]/g) || [])
    .length;
  if (carillas !== 1)
    morir(
      `son ${carillas} carillas y la guía está pensada para una sola. ` +
        "Achicá aire en css/guia.css —márgenes, interlineado— antes que letra. " +
        "No se escribió nada.",
    );

  await writeFile(join(RAIZ, "guia.pdf"), pdf);
  console.log(
    `escrito: /guia.pdf  (${(pdf.length / 1024).toFixed(0)} KB, 1 carilla, ` +
      `${p.casillas} casillas)`,
  );
} catch (e) {
  if (!process.exitCode) {
    console.error("guia-pdf:", e.message);
    process.exitCode = 1;
  }
} finally {
  if (chrome) chrome.kill();
  if (servidor) servidor.kill();
}
