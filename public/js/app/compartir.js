/* js/app/compartir.js — la imagen para mandar por WhatsApp.
   Se dibuja en un canvas del propio teléfono y se pasa a la API de compartir
   del sistema: no se sube nada. Espera a document.fonts.ready o el canvas
   dibuja con la tipografía del sistema en vez de la de la app.

   Es la del rediseño («Compartir»): 1080 × 1350, que WhatsApp e Instagram
   muestran entera sin recortar, fondo oscuro, el número grande, el estado y
   la regla vertical con las mismas marcas que la de la app. */

import { cotaEnHidrometro } from "./cota.js";
import { estado } from "./estado.js";
import { m, mCm, mU } from "./formato.js";
import { ALERTA, EVACUACION, RECORD, RECORD_ANIO } from "./oficiales.js";
import { ATENCION_ANTES_M, ESTADOS, faltaCm, sobreRecord } from "/lib/comun.js";
import { ocupar } from "./vista.js";

const ANCHO = 1080;
const ALTO = 1350;
const MARGEN_X = 84;
const MARGEN_Y = 80;

/* Los colores del tema oscuro de la app, escritos acá porque la imagen sale
   oscura aunque la persona use el tema claro. Es una copia de la paleta, y
   scripts/comprobar.js (COPIAS) la compara con los tokens de app.css y mide
   cada texto sobre su fondo: un color nuevo acá va con su renglón allá.
   Hasta el 30/10/2026 no la medía nadie y se había corrido sola: el verde
   de «normal» era otro, la alerta llevaba un naranja que no existía en
   ninguna otra parte y la evacuación, el color de la línea de la regla.
   Los estados van como en la placa y el widget, las otras imágenes que
   viajan solas: atención y alerta en el ámbar, evacuación en el rojo. */
const C = {
  fondo: "#0e1619",
  claro: "#e9eef0",
  texto: "#d6dee1",
  suave: "#b5c3c8",
  tenue: "#93a6ad",
  linea: "rgba(233,238,240,0.14)",
  pista: "rgba(233,238,240,0.08)",
  agua: "#5fc8e8",
  ok: "#54ae90",
  alerta: "#e8a33d",
  evac: "#ef7e6b",
  vos: "#c9a227",
  viejo: "#5d6f76",
};

const SANS = (peso, px) =>
  `${peso} ${px}px "Plus Jakarta Sans", system-ui, sans-serif`;
const MONO = (peso, px) => `${peso} ${px}px "JetBrains Mono", ui-monospace, monospace`;

/* El estado, con los mismos nombres que la tarjeta de la pestaña Río. En los
   graves la frase arranca con el verbo, como en la app y en el aviso: una
   imagen que se reenvía diez veces tiene que decir qué hacer. Vencido no se
   dice ningún estado: con un número viejo no se decide nada. */
function estadoImagen(r, viejo) {
  const N = SANS(500, 34);
  const B = SANS(800, 34);
  if (viejo)
    return {
      nombre: "Último dato guardado",
      // Gris claro y no el de las marcas finas: con el texto oscuro encima,
      // el gris oscuro no se leía.
      color: C.tenue,
      frase: [
        [
          "Es la medición del " + (estado.rioFecha || "").slice(0, 5) + ". ",
          N,
        ],
        ["Puede haber cambiado.", B],
      ],
    };
  if (r >= EVACUACION)
    return {
      nombre: ESTADOS.evacuacion.titulo,
      color: C.evac,
      frase: [
        [ESTADOS.evacuacion.verbo, B],
        [" El río pasó los " + m(EVACUACION) + ".", N],
      ],
    };
  if (r >= ALERTA)
    return {
      nombre: ESTADOS.alerta.titulo,
      color: C.alerta,
      frase: [
        [ESTADOS.alerta.verbo, B],
        [" El río pasó los " + m(ALERTA) + ".", N],
      ],
    };
  if (r >= ALERTA - ATENCION_ANTES_M)
    return {
      nombre: ESTADOS.atencion.titulo,
      color: C.alerta,
      frase: [
        [ESTADOS.atencion.verbo, B],
        [" Faltan " + mCm(ALERTA - r) + " para la alerta de la ciudad.", N],
      ],
    };
  return {
    nombre: ESTADOS.normal.titulo,
    color: C.ok,
    frase: [
      ["Faltan ", N],
      [mCm(ALERTA - r), B],
      [" para la alerta de la ciudad.", N],
    ],
  };
}

/* Texto con tramos de distinto peso, cortado en palabras a un ancho dado.
   Devuelve la `y` donde termina. Con `dibujar` en falso sólo mide: el bloque
   de la izquierda se centra en el alto, y para eso hay que saber cuánto mide
   antes de dibujarlo. */
function parrafo(g, tramos, x, y, ancho, alto, color, dibujar) {
  const palabras = [];
  for (const [txt, fuente] of tramos)
    for (const p of txt.split(/(?=\s)/)) palabras.push([p, fuente]);
  let cx = x;
  let base = y + alto * 0.8;
  for (const [p, fuente] of palabras) {
    g.font = fuente;
    const w = g.measureText(p).width;
    if (cx + w > x + ancho && cx > x) {
      cx = x;
      base += alto;
    }
    const txt = cx === x ? p.trimStart() : p;
    if (dibujar) {
      g.fillStyle = fuente.startsWith("800") ? C.claro : color;
      g.fillText(txt, cx, base);
    }
    cx += g.measureText(txt).width;
  }
  return base + alto * 0.2;
}

// roundRect no está en Safari antes de 16 ni en los Chrome viejos que el
// proyecto sostiene: ahí va recto, que se lee igual.
const redondo = (g, x, y, w, h, r) =>
  g.roundRect ? g.roundRect(x, y, w, h, r) : g.rect(x, y, w, h);

function marca(g, x, y) {
  const s = 64 / 60;
  const cx = x + 30 * s;
  const cy = y + 30 * s;
  g.save();
  g.beginPath();
  g.rect(x, y + 33 * s, 60 * s, 27 * s);
  g.clip();
  g.fillStyle = C.agua;
  g.beginPath();
  g.arc(cx, cy, 21 * s, 0, Math.PI * 2);
  g.fill();
  g.restore();
  g.strokeStyle = C.claro;
  g.lineWidth = 7 * s;
  g.beginPath();
  g.arc(cx, cy, 21 * s, 0, Math.PI * 2);
  g.stroke();
  g.lineWidth = 4.5 * s;
  g.lineCap = "round";
  g.beginPath();
  g.moveTo(x + 2 * s, y + 33 * s);
  g.lineTo(x + 58 * s, y + 33 * s);
  g.stroke();
  g.lineCap = "butt";
}

/* Las etiquetas de la regla no se pueden pisar: 5,30 y 5,70 están a 40 px,
   y «hoy» o «vos» pueden caer en el medio. Se corren lo mínimo, como
   separar() en rio.js; la línea queda donde va. */
function separar(etiquetas, gap) {
  etiquetas.sort((a, b) => b.y - a.y);
  for (let i = 1; i < etiquetas.length; i++)
    if (etiquetas[i - 1].y - etiquetas[i].y < gap)
      etiquetas[i].y = etiquetas[i - 1].y - gap;
}

/* La regla vertical, de 0 a 8 m como la de la app: marcas cada 10 cm, más
   largas cada 50 cm y cada metro. Vencido, el agua va rayada en gris. */
function regla(g, x, abajo, r, u, viejo) {
  const PX = 100; // px por metro: 8 m son 800 px
  const arriba = abajo - 8 * PX;
  const y = (v) => abajo - Math.max(0, Math.min(8, v)) * PX;

  for (let k = 0; k <= 80; k++) {
    const metro = k % 10 === 0;
    const medio = k % 5 === 0;
    const largo = metro ? 26 : medio ? 17 : 9;
    g.fillStyle = metro ? C.claro : medio ? C.tenue : C.viejo;
    g.fillRect(x + 26 - largo, abajo - k * 10 - (metro ? 1 : 0), largo, metro ? 2 : 1);
  }

  const tx = x + 36;
  // 96 y no los 110 de la maqueta: «último dato» no entraba en el margen.
  const ta = 96;
  g.save();
  g.beginPath();
  redondo(g, tx, arriba, ta, 8 * PX, 26);
  g.fillStyle = C.pista;
  g.fill();
  g.clip();
  const hAgua = abajo - y(r);
  if (viejo) {
    // Las rayas, recortadas al alto del agua: un recorte dentro del otro.
    g.beginPath();
    g.rect(tx, abajo - hAgua, ta, hAgua);
    g.clip();
    g.strokeStyle = "rgba(147,166,173,0.45)";
    g.lineWidth = 9;
    for (let d = -ta; d < hAgua + ta; d += 22) {
      g.beginPath();
      g.moveTo(tx, abajo - d);
      g.lineTo(tx + ta, abajo - d - ta);
      g.stroke();
    }
  } else {
    g.fillStyle = C.agua;
    g.fillRect(tx, abajo - hAgua, ta, hAgua);
  }
  g.restore();

  const lineas = [
    { v: EVACUACION, txt: m(EVACUACION).replace(" m", ""), color: C.evac, f: MONO(700, 24) },
    { v: ALERTA, txt: m(ALERTA).replace(" m", ""), color: C.alerta, f: MONO(700, 24) },
    {
      v: r,
      txt: viejo ? "último dato" : "hoy",
      color: viejo ? C.tenue : C.agua,
      f: viejo ? SANS(700, 22) : MONO(700, 24),
    },
  ];
  if (u != null && u <= 8)
    lineas.push({ v: u, txt: "vos", color: C.vos, f: SANS(800, 26), punteada: true });

  /* La línea cruza el tanque y termina en su borde; un conector la lleva a
     la etiqueta, como en la regla de la app. Con la línea a lo ancho, el
     punteado de «vos» pasaba por encima de «5,30». */
  const desde = x + 30;
  const borde = tx + ta + 6;
  const etiquetas = lineas.map((l) => ({ ...l, linea: y(l.v), y: y(l.v) }));
  separar(etiquetas, 32);
  for (const e of etiquetas) {
    g.strokeStyle = e.color;
    g.lineWidth = e.punteada ? 5 : 4;
    g.setLineDash(e.punteada ? [5, 9] : []);
    g.beginPath();
    g.moveTo(desde, e.linea);
    g.lineTo(borde, e.linea);
    g.stroke();
    g.setLineDash([]);
    g.lineWidth = 2;
    g.beginPath();
    g.moveTo(borde, e.linea);
    g.lineTo(borde + 12, e.y);
    g.stroke();
    g.font = e.f;
    g.fillStyle = e.color;
    g.fillText(e.txt, borde + 18, e.y + 8);
  }
}

async function armarImagen(conVos) {
  // Sin esperar a las fuentes, el canvas dibuja con la de sistema y la imagen
  // sale con otra tipografía que la app.
  if (document.fonts && document.fonts.ready) await document.fonts.ready;

  const c = document.createElement("canvas");
  c.width = ANCHO;
  c.height = ALTO;
  const g = c.getContext("2d");
  const r = estado.rio ?? 0;
  const viejo = estado.rioVencido;
  const u = conVos ? cotaEnHidrometro() : null;

  g.fillStyle = C.fondo;
  g.fillRect(0, 0, ANCHO, ALTO);

  // Cabecera: la marca y la fecha del dato, no la de hoy.
  marca(g, MARGEN_X, MARGEN_Y);
  g.fillStyle = C.claro;
  g.font = SANS(800, 40);
  g.fillText("Cota Cero", MARGEN_X + 82, MARGEN_Y + 46);
  const fecha =
    (estado.rioFecha || "").slice(0, 10) ||
    new Date().toLocaleDateString("es-AR");
  g.font = MONO(500, 26);
  g.fillStyle = C.tenue;
  g.textAlign = "right";
  g.fillText(fecha, ANCHO - MARGEN_X, MARGEN_Y + 42);
  g.textAlign = "left";

  // El pie, de abajo hacia arriba: arriba de él termina el cuerpo.
  const pie = ALTO - MARGEN_Y - 112;
  const cuerpoArriba = MARGEN_Y + 64 + 48;
  const cuerpoAbajo = pie - 48;

  // La regla, a la derecha y apoyada abajo.
  regla(g, ANCHO - MARGEN_X - 260, cuerpoAbajo, r, u, viejo);

  // El bloque de la izquierda, centrado en el alto.
  const ancho = ANCHO - MARGEN_X * 2 - 260 - 56;
  const est = estadoImagen(r, viejo);
  const bloque = (dibujar, y0) => {
    let y = y0;
    y = parrafo(
      g,
      [["El río Paraná en el Puerto de Santa Fe", SANS(700, 38)]],
      MARGEN_X,
      y,
      ancho - 120,
      46,
      C.suave,
      dibujar,
    );
    y += 28;
    if (dibujar) {
      g.font = SANS(800, 220);
      g.fillStyle = viejo ? C.tenue : C.claro;
      const num = m(r).replace(" m", "");
      g.fillText(num, MARGEN_X - 8, y + 178);
      const w = g.measureText(num).width;
      g.font = SANS(700, 72);
      g.fillStyle = C.tenue;
      g.fillText("m", MARGEN_X + w + 8, y + 178);
    }
    y += 198 + 28;
    if (dibujar) {
      g.font = SANS(800, 34);
      const w = g.measureText(est.nombre).width + 56;
      g.fillStyle = est.color;
      g.beginPath();
      redondo(g, MARGEN_X, y, w, 64, 32);
      g.fill();
      g.fillStyle = C.fondo;
      g.fillText(est.nombre, MARGEN_X + 28, y + 44);
    }
    y += 64 + 28;
    y = parrafo(g, est.frase, MARGEN_X, y, ancho, 46, C.texto, dibujar);
    // Tu nivel de aviso es un dato tuyo: sólo si la persona lo eligió.
    if (u != null) {
      y += 28;
      if (dibujar) {
        g.fillStyle = C.linea;
        g.fillRect(MARGEN_X, y, ancho, 2);
      }
      y += 2 + 28;
      if (dibujar) {
        g.font = SANS(500, 30);
        g.fillStyle = C.suave;
        g.fillText("Mi nivel de aviso", MARGEN_X, y + 26);
        /* Sobre el récord, palabras y no número (sobreRecord en lib/comun.js).
           A 52 px entra en el ancho de la columna; a 64 se salía. */
        const alto = sobreRecord(u, RECORD, viejo ? null : r);
        g.font = SANS(800, alto ? 52 : 64);
        g.fillStyle = C.vos;
        g.fillText(alto ? "Sobre el récord" : mU(u), MARGEN_X, y + 26 + 72);
        g.font = SANS(500, 26);
        g.fillStyle = C.tenue;
        g.fillText(
          alto
            ? "Más alto que la crecida de " + RECORD_ANIO + " (" + m(RECORD) + ")."
            : !viejo && faltaCm(r, u) <= 0
              ? "El río ya lo pasó. Es un cálculo aproximado."
              : "Es un cálculo aproximado, no una predicción.",
          MARGEN_X,
          y + 26 + 72 + 44,
        );
      }
      y += 26 + 72 + 44;
    }
    return y;
  };
  const alto = bloque(false, 0);
  bloque(true, cuerpoArriba + Math.max(0, (cuerpoAbajo - cuerpoArriba - alto) / 2));

  // Pie: para que la imagen se defienda sola cuando la reenvían sin contexto.
  g.fillStyle = C.linea;
  g.fillRect(MARGEN_X, pie, ANCHO - MARGEN_X * 2, 2);
  g.font = SANS(800, 30);
  g.fillStyle = C.claro;
  g.fillText("¿Y tu casa?", MARGEN_X, pie + 66);
  const w = g.measureText("¿Y tu casa? ").width;
  g.font = SANS(500, 30);
  g.fillStyle = C.texto;
  g.fillText("Conocé tu número en", MARGEN_X + w, pie + 66);
  g.font = SANS(800, 30);
  g.fillStyle = C.agua;
  g.fillText("cotacerosf.com", MARGEN_X, pie + 105);
  g.font = SANS(500, 22);
  g.fillStyle = C.tenue;
  g.textAlign = "right";
  g.fillText("Datos: INA", ANCHO - MARGEN_X, pie + 74);
  g.fillText("No oficial · Emergencias 103", ANCHO - MARGEN_X, pie + 104);
  g.textAlign = "left";

  return new Promise((ok) => c.toBlob(ok, "image/png"));
}

/* La casilla de «Mi nivel de aviso» sólo existe con la casa cargada, y
   arranca apagada: es un dato de la persona y lo manda ella, si quiere. */
export function pintarCompartir() {
  const fila = document.getElementById("compartir-vos-fila");
  if (fila) fila.hidden = cotaEnHidrometro() == null;
}

export async function compartirImagen() {
  const e = document.getElementById("compartir-estado");
  const liberar = ocupar('[data-accion="compartir-imagen"]', "Armando…");
  try {
    if (estado.rio == null) throw new Error("todavía no hay nivel del río");
    const casilla = document.getElementById("compartir-vos");
    const blob = await armarImagen(Boolean(casilla && casilla.checked));
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

/* Para mirarla sin compartir, desde la consola:
   `(await import('/js/app/compartir.js')).verImagen(true)` devuelve un
   data: que se pega en la barra de direcciones. */
export async function verImagen(conVos = false) {
  const blob = await armarImagen(conVos);
  return new Promise((ok) => {
    const fr = new FileReader();
    fr.onload = () => ok(fr.result);
    fr.readAsDataURL(blob);
  });
}
