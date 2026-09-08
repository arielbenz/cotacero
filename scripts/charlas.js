/* scripts/charlas.js — baja de ted.com la duración y la miniatura de cada charla.
 *
 *     node scripts/charlas.js
 *
 * Dos cosas, y las dos por el mismo motivo: son datos de un tercero y no
 * queremos enterarnos de que cambiaron por un lector.
 *
 * DURACIÓN. TED la publica en el HTML de cada charla, en segundos. El script no
 * la escribe solo en `lib/charlas.js`: la compara con la que está escrita y
 * avisa si difieren. Un dato que se escribe solo es un dato que nadie revisa.
 *
 * MINIATURA. Se baja el `og:image` de cada charla y se guarda en
 * `img/charlas/`. NO se enlaza a `pi.tedcdn.com`: la CSP del sitio es
 * `img-src 'self'`, abrirla le mandaría a TED la IP de cada lector —y /legal
 * dice que lo único que sale del dispositivo son las sugerencias— y además
 * /charlas está precacheada, así que sin señal una imagen remota no aparece.
 * Alojarlas resuelve las tres cosas de una.
 *
 * Se guardan en JPEG y no en WebP ni AVIF: `sips` —que viene con macOS y evita
 * una dependencia— no escribe WebP, y AVIF deja afuera a los Android viejos que
 * este proyecto sostiene a mano. Un JPEG de 320 px lo abre cualquier cosa.
 */

import { writeFile, mkdir, readFile, stat } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { CHARLAS } from "../lib/charlas.js";

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const DESTINO = join(RAIZ, "img", "charlas");
const ANCHO = 320; // 160 px de columna a 2x
const CALIDAD = 62;

/* ted.com contesta 403 a un cliente sin User-Agent de navegador. */
const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/140.0 Safari/537.36";

const slug = (url) => url.replace(/.*\/talks\//, "").replace(/\/$/, "");
const enMinutos = (s) => Math.round(s / 60);

await mkdir(DESTINO, { recursive: true });

let difieren = 0;
const filas = [];

for (const c of CHARLAS) {
  const nombre = slug(c.url);
  let html;
  try {
    const r = await fetch(c.url, { headers: { "User-Agent": UA } });
    if (!r.ok) throw new Error("HTTP " + r.status);
    html = await r.text();
  } catch (e) {
    console.error(`  ${nombre}: no se pudo leer la página — ${e.message}`);
    process.exitCode = 1;
    continue;
  }

  // El primer "duration" del HTML es una plantilla vacía: hay que pedir dígitos.
  const d = html.match(/"duration":(\d+)/);
  const img = html.match(/property="og:image" content="([^"]+)"/);
  if (!d || !img) {
    console.error(`  ${nombre}: TED cambió el marcado, no encuentro duración o imagen`);
    process.exitCode = 1;
    continue;
  }
  const segundos = Number(d[1]);
  const url = img[1].replace(/&amp;/g, "&");

  if (c.duracion !== segundos) {
    console.warn(
      `  OJO ${nombre}: lib/charlas.js dice ${c.duracion} s y TED dice ${segundos} s`,
    );
    difieren++;
  }

  const archivo = join(DESTINO, nombre + ".jpg");
  let ya = null;
  try {
    ya = (await stat(archivo)).size;
  } catch {
    /* no está todavía */
  }
  if (ya === null) {
    const bin = Buffer.from(await (await fetch(url, { headers: { "User-Agent": UA } })).arrayBuffer());
    await writeFile(archivo, bin);
    // `sips` viene con macOS: recorta al ancho y recomprime. Sin dependencias.
    execFileSync("sips", [
      "--resampleWidth", String(ANCHO),
      "-s", "format", "jpeg",
      "-s", "formatOptions", String(CALIDAD),
      archivo, "--out", archivo,
    ], { stdio: "ignore" });
  }
  const peso = Math.round((await stat(archivo)).size / 1024);
  filas.push([nombre, segundos, enMinutos(segundos), peso, ya === null ? "bajada" : "ya estaba"]);
}

console.log("  charla                                          seg   min   KB");
for (const [n, s, m, kb, estado] of filas)
  console.log(
    "  " + n.slice(0, 44).padEnd(46) + String(s).padStart(4) +
    String(m).padStart(6) + String(kb).padStart(5) + "   " + estado,
  );
const total = filas.reduce((a, f) => a + f[3], 0);
console.log(`\n  ${filas.length} miniaturas · ${total} KB en total`);
if (difieren)
  console.log(`  ${difieren} duración(es) no coinciden con lib/charlas.js — corregilas a mano`);
