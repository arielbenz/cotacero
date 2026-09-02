// scripts/iconos.js — genera los PNG de la marca.
//
//   node scripts/iconos.js
//
// Rasteriza el SVG de scripts/marca.js con Chrome headless. No hace falta
// ninguna dependencia: el navegador ya está en la máquina y sabe dibujar SVG
// mucho mejor que cualquier librería que podríamos instalar.
//
// Genera favicon-32, icon-192, icon-512, icon-maskable-512, apple-touch-icon
// y og.png. Los tamaños salen del manifest y de las etiquetas de index.html:
// si cambian allá, cambian acá.

import { writeFile, mkdtemp, rm } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { tmpdir } from "node:os";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { marca } from "./marca.js";

const correr = promisify(execFile);
const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const CHROME =
  process.env.CHROME ||
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

/* Los colores de la marca en cada contexto, tomados de app.css. */
const OSCURO = "#0e1619";
const CLARO = "#f7f8f9";
const TINTA = "#16242c";
const AGUA = "#1779a3";
const AGUA_CLARA = "#5fc8e8";
const TINTA_CLARA = "#e9eef0";

/* Un HTML mínimo con la marca centrada sobre un fondo. `escala` deja aire
   alrededor: los íconos maskable necesitan que el dibujo entre en el 80%
   central, porque Android los recorta en círculo. */
function pagina({ ancho, alto, fondo, trazo, agua, escala = 0.62, radio = 0 }) {
  const lado = Math.min(ancho, alto) * escala;
  return `<!doctype html><meta charset="utf-8"><style>
  html,body{margin:0;padding:0}
  body{width:${ancho}px;height:${alto}px;background:${fondo};
       display:flex;align-items:center;justify-content:center;
       ${radio ? `border-radius:${radio}px;` : ""}}
  svg{display:block}
</style>${marca({ id: "i", tam: Math.round(lado), trazo, agua })}`;
}

/* Chrome recorta la captura al tamaño de la ventana, así que se pide una
   ventana exactamente del tamaño buscado. --force-device-scale-factor=1 evita
   que en una pantalla retina salga al doble.

   Cada corrida necesita SU PROPIO --user-data-dir: reutilizando uno, la
   segunda invocación se queda esperando el lock de la primera y nunca sale. */
let corrida = 0;
async function png(html, ancho, alto, salida, perfil) {
  const n = corrida++;
  const archivo = join(perfil, "m" + n + ".html");
  await writeFile(archivo, html);
  await correr(
    CHROME,
    [
      "--headless=new",
      "--disable-gpu",
      "--hide-scrollbars",
      "--no-first-run",
      "--no-default-browser-check",
      "--force-device-scale-factor=1",
      `--window-size=${ancho},${alto}`,
      `--user-data-dir=${join(perfil, "u" + n)}`,
      "--virtual-time-budget=2000",
      `--screenshot=${salida}`,
      "file://" + archivo,
    ],
    { timeout: 45000 },
  );
}

const perfil = await mkdtemp(join(tmpdir(), "cc-iconos-"));
try {
  const trabajos = [
    // El favicon y los íconos de app van sobre el fondo oscuro de la marca,
    // que es como se ven en la pantalla de inicio y en la pestaña.
    ["favicon-32.png", 32, 32, OSCURO, TINTA_CLARA, AGUA_CLARA, 0.78],
    ["icon-192.png", 192, 192, OSCURO, TINTA_CLARA, AGUA_CLARA, 0.66],
    ["icon-512.png", 512, 512, OSCURO, TINTA_CLARA, AGUA_CLARA, 0.66],
    // Maskable: Android recorta hasta un círculo inscripto. El dibujo entra
    // en el 80% central o se come los bordes.
    ["icon-maskable-512.png", 512, 512, OSCURO, TINTA_CLARA, AGUA_CLARA, 0.5],
    // iOS no aplica máscara ni respeta transparencia: fondo sólido y aire.
    ["apple-touch-icon.png", 180, 180, OSCURO, TINTA_CLARA, AGUA_CLARA, 0.62],
  ];

  for (const [nombre, an, al, fondo, trazo, agua, escala] of trabajos) {
    const salida = join(RAIZ, "img", nombre);
    await png(
      pagina({ ancho: an, alto: al, fondo, trazo, agua, escala }),
      an,
      al,
      salida,
      perfil,
    );
    console.log("  " + nombre.padEnd(24) + an + "×" + al);
  }

  // og.png es otra cosa: es la vista previa de WhatsApp, con marca y texto.
  const og = `<!doctype html><meta charset="utf-8"><style>
  @font-face{font-family:"Plus Jakarta Sans";src:url("file://${join(RAIZ, "vendor/fonts/jakarta-800.woff2")}") format("woff2");font-weight:800}
  @font-face{font-family:"Plus Jakarta Sans";src:url("file://${join(RAIZ, "vendor/fonts/jakarta-500.woff2")}") format("woff2");font-weight:500}
  html,body{margin:0}
  body{width:1200px;height:630px;background:${OSCURO};color:${TINTA_CLARA};
       font-family:"Plus Jakarta Sans",system-ui,sans-serif;
       display:flex;flex-direction:column;justify-content:center;padding:0 88px;box-sizing:border-box}
  h1{font-size:76px;font-weight:800;letter-spacing:-.03em;line-height:1.05;margin:34px 0 0}
  p{font-size:30px;font-weight:500;color:#93a6ad;margin:22px 0 0;max-width:860px;line-height:1.4}
  .m{display:flex;align-items:center;gap:20px}
  .m span{font-size:34px;font-weight:800;letter-spacing:-.02em}
</style>
<div class="m">${marca({ id: "og", tam: 64, trazo: TINTA_CLARA, agua: AGUA_CLARA })}<span>Cota Cero</span></div>
<h1>¿Hasta dónde llega<br>el agua en tu casa?</h1>
<p>El nivel del río Paraná, traducido al número exacto que le toca a tu terreno. Santa Fe.</p>`;
  await png(og, 1200, 630, join(RAIZ, "img", "og.png"), perfil);
  console.log("  og.png".padEnd(26) + "1200×630");
} finally {
  await rm(perfil, { recursive: true, force: true });
}
console.log(
  "\nlisto. Acordate de subir VERSION en sw.js: los íconos van por caché primero.",
);
