/* js/app/compartir.js — la imagen para mandar por WhatsApp.
   Se dibuja en un canvas del propio teléfono y se pasa a la API de compartir
   del sistema: no se sube nada. Espera a document.fonts.ready o el canvas
   dibuja con la tipografía del sistema en vez de la de la app. */

import { cotaEnHidrometro } from "./cota.js";
import { estado } from "./estado.js";
import { m, mU } from "./formato.js";
import { ALERTA, EVACUACION, RECORD, etiquetaRecord } from "./oficiales.js";
import { ocupar } from "./vista.js";

/* ================= COMPARTIR COMO IMAGEN =================
   Se dibuja en un canvas del propio teléfono y se comparte con la API del
   sistema. Nada se sube a ningún lado, que es lo que la app promete en todas
   las demás pantallas. */

const IMG_ANCHO = 1080;

const IMG_ALTO = 1920;

function colorDe(nombre) {
  return getComputedStyle(document.documentElement)
    .getPropertyValue(nombre)
    .trim();
}

async function armarImagen() {
  // Sin esperar a las fuentes, el canvas dibuja con la de sistema y la imagen
  // sale con otra tipografía que la app.
  if (document.fonts && document.fonts.ready) await document.fonts.ready;

  const c = document.createElement("canvas");
  c.width = IMG_ANCHO;
  c.height = IMG_ALTO;
  const g = c.getContext("2d");
  const F = (p, t) => `${p} ${t}px "Plus Jakarta Sans", system-ui, sans-serif`;

  const fondo = "#0e1619";
  const claro = "#e9eef0";
  const tenue = "#93a6ad";
  const agua = "#2e9bc4";

  g.fillStyle = fondo;
  g.fillRect(0, 0, IMG_ANCHO, IMG_ALTO);

  // Marca
  g.strokeStyle = claro;
  g.lineWidth = 11;
  g.beginPath();
  g.arc(120, 150, 33, 0, Math.PI * 2);
  g.stroke();
  g.save();
  g.beginPath();
  g.rect(80, 155, 80, 45);
  g.clip();
  g.fillStyle = "#5fc8e8";
  g.beginPath();
  g.arc(120, 150, 33, 0, Math.PI * 2);
  g.fill();
  g.restore();
  g.lineWidth = 7;
  g.lineCap = "round";
  g.beginPath();
  g.moveTo(76, 155);
  g.lineTo(164, 155);
  g.stroke();
  g.fillStyle = claro;
  g.font = F(800, 44);
  g.fillText("Cota Cero", 180, 166);

  // El dato
  g.fillStyle = tenue;
  g.font = F(700, 30);
  g.fillText("RÍO EN EL PUERTO DE SANTA FE", 76, 300);
  g.fillStyle = claro;
  g.font = F(800, 190);
  g.fillText(m(estado.rio ?? 0), 76, 470);

  const u = cotaEnHidrometro();
  g.font = F(600, 40);
  g.fillStyle = tenue;
  const linea2 =
    u == null
      ? "Cargá tu umbral en la app para saber qué significa"
      : estado.rio != null && estado.rio >= u
        ? "El río superó mi umbral estimado (" + mU(u) + ")"
        : "Unos " +
          Math.round(((u ?? 0) - (estado.rio ?? 0)) * 100) +
          " cm hasta mi umbral estimado (" +
          mU(u) +
          ")";
  g.fillText(linea2, 76, 540);

  // La regla, de 0 al récord de 1992
  const x = 76,
    y = 640,
    an = IMG_ANCHO - 152,
    al = 900;
  const TOPE = 7.6;
  g.fillStyle = "rgba(233,238,240,.07)";
  g.fillRect(x, y, an, al);
  const hAgua = Math.max(0, Math.min(1, (estado.rio ?? 0) / TOPE)) * al;
  g.fillStyle = agua;
  g.fillRect(x, y + al - hAgua, an, hAgua);
  g.fillStyle = "#5fc8e8";
  g.fillRect(x, y + al - hAgua - 6, an, 6);

  const marca = (v, texto, color) => {
    const yy = y + al - (v / TOPE) * al;
    g.strokeStyle = color;
    g.lineWidth = 4;
    g.beginPath();
    g.moveTo(x, yy);
    g.lineTo(x + an, yy);
    g.stroke();
    g.fillStyle = color;
    g.font = F(700, 30);
    g.fillText(texto, x + 18, yy - 16);
  };
  marca(ALERTA, "Alerta " + m(ALERTA).replace(" m", ""), "#e8a33d");
  marca(EVACUACION, "Evacuación " + m(EVACUACION).replace(" m", ""), "#e15f49");
  marca(RECORD, etiquetaRecord() + "   " + m(RECORD).replace(" m", ""), tenue);
  if (u != null && u <= TOPE) marca(u, "MI UMBRAL   " + mU(u), claro);

  // Pie: fuente y dominio, para que la imagen se defienda sola cuando la
  // reenvían diez veces sin contexto.
  g.fillStyle = tenue;
  g.font = F(500, 27);
  const fecha = estado.rioFecha ? " · dato del " + estado.rioFecha : "";
  g.fillText(
    "Umbral estimado, no una orden de evacuación" + fecha,
    x,
    y + al + 60,
  );
  g.fillText(
    "Lectura oficial: INA. La orden la da Defensa Civil (103). cotacerosf.com",
    x,
    y + al + 104,
  );

  return new Promise((ok) => c.toBlob(ok, "image/png"));
}

export async function compartirImagen() {
  const e = document.getElementById("compartir-estado");
  const liberar = ocupar('[data-accion="compartir-imagen"]', "Armando…");
  try {
    if (estado.rio == null) throw new Error("todavía no hay nivel del río");
    const blob = await armarImagen();
    if (!blob) throw new Error("no se pudo dibujar");
    const archivo = new File([blob], "cota-cero.png", { type: "image/png" });
    if (navigator.canShare && navigator.canShare({ files: [archivo] })) {
      await navigator.share({ files: [archivo] });
      if (e) e.textContent = "";
    } else {
      // Sin Web Share con archivos —escritorio, Firefox— se descarga.
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "cota-cero.png";
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 4000);
      if (e) e.textContent = "Se descargó la imagen.";
    }
  } catch (err) {
    // Cancelar el diálogo de compartir tira AbortError: no es un error.
    if (e)
      e.textContent =
        err && err.name === "AbortError" ? "" : "No se pudo crear la imagen.";
  } finally {
    liberar();
  }
}
