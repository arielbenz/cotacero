/* js/app/formato.js — cómo se escriben los números.
   No es cosmética: `mU()` existe para que el umbral NUNCA salga con dos
   decimales. La cota viene de curvas cada ~0,5 m y el segundo decimal sería
   precisión inventada — en un número que se usa para decidir si sacar a
   alguien de la casa, la precisión inventada se lee como certeza. */

/* Escapa texto para meterlo dentro de un atributo HTML. */
export const atr = (t) =>
  String(t)
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

/* m(), mU() y mCm() viven en lib/comun.js y se re-exportan acá para que el
   resto de la app siga importándolas de donde siempre. Estaban escritas acá,
   y otra vez en sw.js, en rio-barra.js, en landing.js, en historia.js, en
   widget.js y en paginas.js — siete copias de la misma coma decimal, con
   cinco nombres distintos. El service worker las lee del gemelo clásico que
   emite scripts/paginas.js. */
export { m, mU, mCm, nm } from "/lib/comun.js";
import { nm } from "/lib/comun.js";

/* Acepta coma o punto. La app muestra "16,40" en todos lados y los campos
   pedían "16.40": la persona escribía lo que veía, el navegador descartaba el
   valor y no pasaba nada, sin ningún aviso. */
export const aNumero = (v) =>
  parseFloat(
    String(v ?? "")
      .trim()
      .replace(",", "."),
  );

/* Y al revés, para precargar los campos con el mismo formato que se muestra. */
export const enCampo = (v) => (v == null || isNaN(v) ? "" : nm(v, 2));

/* El INA publica "DD/MM/AAAA HH:MM" y Date no parsea ese formato:
   lo desarmamos a mano. Devuelve null si no se entiende. */
export function fechaINA(txt) {
  const p = /^(\d{2})\/(\d{2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2}))?/.exec(
    txt || "",
  );
  if (!p) return null;
  const d = new Date(+p[3], +p[2] - 1, +p[1], +(p[4] || 0), +(p[5] || 0));
  return isNaN(d.getTime()) ? null : d;
}

export const horasDesde = (d) => (d ? (Date.now() - d.getTime()) / 36e5 : null);

/* ================= NIVEL DEL RÍO =================
   El INA publica el nivel de Santa Fe todos los días, pero sin CORS abierto:
   el navegador no puede pedirlo directo. Por eso la fuente 1 es una funcion
   serverless propia (api/nivel.js) que lo lee y lo reexpone.
   Si eso falla, quedan el último valor guardado y la carga manual. */
