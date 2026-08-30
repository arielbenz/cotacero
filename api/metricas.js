// api/metricas.js — el tablero. Una URL privada con el estado de la app.
//
// Devuelve una página HTML para poder mirarla desde el teléfono sin
// herramientas, y JSON con ?formato=json para engancharle cualquier otra cosa.
//
// Protegido con METRICAS_CLAVE. Sin esa variable configurada el endpoint no
// responde nada: es preferible que no funcione a que quede abierto por
// olvidarse de ponerla.

import crypto from "node:crypto";
import { redis, hayAlmacen, CLAVE_SUBS } from "../lib/push.js";
import {
  diaAR,
  ultimosDias,
  claveDia,
  CLAVE_SUGERENCIAS,
} from "../lib/metricas.js";

const CUANTAS_SUGERENCIAS = 25;

/* Comparación de tiempo constante: un === corta en el primer carácter
   distinto y con eso se puede adivinar la clave de a una letra. */
function claveCorrecta(dada) {
  const real = process.env.METRICAS_CLAVE || "";
  if (!real || typeof dada !== "string") return false;
  const a = Buffer.from(dada);
  const b = Buffer.from(real);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

const escapar = (t) =>
  String(t).replace(
    /[&<>"]/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c],
  );

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  // Que no se indexe ni aparezca en un buscador por accidente.
  res.setHeader("X-Robots-Tag", "noindex, nofollow");

  const dada = (req.query && req.query.clave) || req.headers["x-clave"] || "";
  if (!claveCorrecta(dada)) return res.status(404).json({ error: "No existe" });

  if (!hayAlmacen())
    return res
      .status(503)
      .json({ error: "Falta conectar el almacén (KV_REST_API_URL / _TOKEN)." });

  try {
    const dias30 = ultimosDias(30);
    const claves30 = dias30.map(claveDia);

    // PFCOUNT con varias claves devuelve la unión, no la suma: alguien que
    // entró lunes y martes cuenta una sola vez en la ventana de 7 días.
    const [hoy, siete, treinta, suscriptos, cuantasSug, sugerencias] =
      await Promise.all([
        redis("PFCOUNT", claves30[0]),
        redis("PFCOUNT", ...claves30.slice(0, 7)),
        redis("PFCOUNT", ...claves30),
        redis("SCARD", CLAVE_SUBS),
        redis("LLEN", CLAVE_SUGERENCIAS),
        redis("LRANGE", CLAVE_SUGERENCIAS, 0, CUANTAS_SUGERENCIAS - 1),
      ]);

    // Serie diaria de los últimos 14, del más viejo al más nuevo, para ver la
    // forma de la curva y no sólo el total.
    const catorce = dias30.slice(0, 14).reverse();
    const serie = await Promise.all(
      catorce.map(async (d) => ({
        dia: d,
        activos: Number(await redis("PFCOUNT", claveDia(d))),
      })),
    );

    const lista = (Array.isArray(sugerencias) ? sugerencias : [])
      .map((s) => {
        try {
          return JSON.parse(s);
        } catch {
          return null;
        }
      })
      .filter(Boolean);

    const datos = {
      generado: new Date().toISOString(),
      dia: diaAR(),
      activos: {
        hoy: Number(hoy),
        siete_dias: Number(siete),
        treinta_dias: Number(treinta),
      },
      serie,
      suscriptos_push: Number(suscriptos),
      sugerencias: { total: Number(cuantasSug), ultimas: lista },
    };

    if (req.query && req.query.formato === "json")
      return res.status(200).json(datos);

    res.setHeader("Content-Type", "text/html; charset=utf-8");
    return res.status(200).send(pagina(datos));
  } catch (e) {
    return res.status(502).json({ error: e.message });
  }
}

/* La página se arma acá, sin JavaScript: la CSP del sitio prohíbe los scripts
   en línea y además un tablero que depende de JS es un tablero que un día no
   carga. Las barras son divs con un ancho en porcentaje. */
function pagina(d) {
  const tope = Math.max(1, ...d.serie.map((x) => x.activos));
  const barras = d.serie
    .map(
      (x) => `<tr><th>${escapar(x.dia.slice(5))}</th>
      <td><i style="width:${(x.activos / tope) * 100}%"></i></td>
      <td class="n">${x.activos}</td></tr>`,
    )
    .join("");

  const sug = d.sugerencias.ultimas.length
    ? d.sugerencias.ultimas
        .map(
          (s) => `<li><b>${escapar(s.categoria || "otro")}</b>
        <time>${escapar(
          String(s.fecha || "")
            .slice(0, 16)
            .replace("T", " "),
        )}</time>
        <p>${escapar(s.texto || "")}</p>
        ${s.contacto ? `<small>${escapar(s.contacto)}</small>` : ""}</li>`,
        )
        .join("")
    : "<li><p>Todavía no mandó nadie.</p></li>";

  return `<!doctype html><html lang="es-AR"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow">
<title>Cota Cero · métricas</title>
<style>
:root{color-scheme:dark light}
body{font:15px/1.55 system-ui,sans-serif;margin:0;padding:24px 18px 64px;
  max-width:640px;margin:0 auto;background:#0e1619;color:#e9eef0}
@media(prefers-color-scheme:light){body{background:#f7f8f9;color:#1b262c}}
h1{font-size:22px;margin:0 0 4px}
h2{font-size:15px;text-transform:uppercase;letter-spacing:.08em;opacity:.6;
  margin:32px 0 10px;font-weight:600}
.fecha{opacity:.6;margin:0 0 24px;font-size:13px}
.tarjetas{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}
.c{background:rgba(127,127,127,.12);border-radius:16px;padding:14px}
.c b{display:block;font-size:30px;line-height:1.1;font-variant-numeric:tabular-nums}
.c span{font-size:12px;opacity:.65}
table{width:100%;border-collapse:collapse;font-variant-numeric:tabular-nums}
th{text-align:left;font-weight:400;opacity:.6;font-size:12px;width:44px}
td i{display:block;height:12px;border-radius:99px;background:#2e9bc4;min-width:2px}
td.n{width:40px;text-align:right;font-size:13px}
tr>*{padding:3px 0}
ul{list-style:none;padding:0;margin:0}
li{background:rgba(127,127,127,.12);border-radius:16px;padding:12px 14px;margin-bottom:10px}
li b{font-size:12px;text-transform:uppercase;letter-spacing:.06em;opacity:.7}
li time{font-size:12px;opacity:.5;float:right}
li p{margin:6px 0 0}
li small{opacity:.6}
</style></head><body>
<h1>Cota Cero</h1>
<p class="fecha">Día ${escapar(d.dia)} · generado ${escapar(d.generado.slice(0, 16).replace("T", " "))} UTC</p>

<div class="tarjetas">
  <div class="c"><b>${d.activos.hoy}</b><span>hoy</span></div>
  <div class="c"><b>${d.activos.siete_dias}</b><span>7 días</span></div>
  <div class="c"><b>${d.activos.treinta_dias}</b><span>30 días</span></div>
</div>

<h2>Últimos 14 días</h2>
<table>${barras}</table>

<h2>Avisos</h2>
<div class="c"><b>${d.suscriptos_push}</b><span>teléfonos suscriptos a las notificaciones</span></div>

<h2>Sugerencias · ${d.sugerencias.total} en total</h2>
<ul>${sug}</ul>
</body></html>`;
}
