// api/metricas.js — el tablero. Una URL privada con el estado de la app.
//
// Devuelve una página HTML para poder mirarla desde el teléfono sin
// herramientas, y JSON con ?formato=json para engancharle cualquier otra cosa.
//
// Dos vistas: el resumen de uso y la lista de sugerencias. Están separadas
// porque se miran en momentos distintos —los números de paso, las sugerencias
// cuando hay tiempo de leerlas— y porque mezcladas la lista larga tapaba todo
// lo demás.
//
// Esto NO puede vivir dentro de la app: las sugerencias traen el contacto que
// la gente deja para que le respondan. Es de las dos únicas cosas que salen
// de un teléfono en todo el proyecto, y no se muestran en público.
//
// Protegido con METRICAS_CLAVE. Sin esa variable configurada el endpoint no
// responde nada: es preferible que no funcione a que quede abierto por
// olvidarse de ponerla.

import { redis, hayAlmacen, CLAVE_SUBS } from "../lib/push.js";
import { CATEGORIAS } from "../lib/sugerencias.js";
import {
  diaAR,
  ultimosDias,
  claveDia,
  CLAVE_SUGERENCIAS,
  claveCorrecta,
} from "../lib/metricas.js";

const EN_RESUMEN = 5; // las últimas, como anticipo
const EN_LISTA = 200; // la vista completa

const escapar = (t) =>
  String(t).replace(
    /[&<>"]/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c],
  );

/* Las categorías, del módulo compartido: el tablero y el formulario tienen
   que llamarlas igual. */

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  // Que no se indexe ni aparezca en un buscador por accidente.
  res.setHeader("X-Robots-Tag", "noindex, nofollow");

  const q = req.query || {};
  const dada = q.clave || req.headers["x-clave"] || "";
  if (!claveCorrecta(dada)) return res.status(404).json({ error: "No existe" });

  if (!hayAlmacen())
    return res
      .status(503)
      .json({ error: "Falta conectar el almacén (KV_REST_API_URL / _TOKEN)." });

  const ver = q.ver === "sugerencias" ? "sugerencias" : "resumen";
  const cuantas = ver === "sugerencias" ? EN_LISTA : EN_RESUMEN;

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
        redis("LRANGE", CLAVE_SUGERENCIAS, 0, cuantas - 1),
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

    if (q.formato === "json") return res.status(200).json(datos);

    res.setHeader("Content-Type", "text/html; charset=utf-8");
    return res.status(200).send(pagina(datos, ver, String(dada)));
  } catch (e) {
    return res.status(502).json({ error: e.message });
  }
}

function unaSugerencia(s) {
  const cat = CATEGORIAS[s.categoria] || CATEGORIAS.otro;
  const fecha = String(s.fecha || "")
    .slice(0, 16)
    .replace("T", " ");
  return `<li><b class="c-${escapar(s.categoria || "otro")}">${escapar(cat)}</b>
    <time>${escapar(fecha)}</time>
    <p>${escapar(s.texto || "")}</p>
    ${s.contacto ? `<small>Contacto: ${escapar(s.contacto)}</small>` : ""}</li>`;
}

/* La página se arma acá, sin JavaScript: la CSP del sitio prohíbe los scripts
   en línea y además un tablero que depende de JS es un tablero que un día no
   carga. Las solapas son dos enlaces y las barras, divs con ancho en
   porcentaje. */
function pagina(d, ver, clave) {
  const url = (v) =>
    `/api/metricas?clave=${encodeURIComponent(clave)}${v ? "&ver=" + v : ""}`;
  const solapas = `<nav class="solapas">
    <a href="${escapar(url(""))}"${ver === "resumen" ? ' class="on" aria-current="page"' : ""}>Resumen</a>
    <a href="${escapar(url("sugerencias"))}"${ver === "sugerencias" ? ' class="on" aria-current="page"' : ""}>Sugerencias${d.sugerencias.total ? " · " + d.sugerencias.total : ""}</a>
  </nav>`;

  const cuerpo =
    ver === "sugerencias" ? vistaSugerencias(d) : vistaResumen(d, url);

  return `<!doctype html><html lang="es-AR"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow">
<title>Cota Cero · ${ver === "sugerencias" ? "sugerencias" : "métricas"}</title>
<style>
:root{color-scheme:dark light;--f:#0e1619;--p:#17232a;--t:#e9eef0;--a:#2e9bc4}
@media(prefers-color-scheme:light){:root{--f:#f7f8f9;--p:#fff;--t:#1b262c;--a:#1f7a9e}}
*{box-sizing:border-box}
body{font:15px/1.55 system-ui,sans-serif;margin:0 auto;padding:24px 18px 64px;
  max-width:640px;background:var(--f);color:var(--t)}
h1{font-size:22px;margin:0 0 4px}
h2{font-size:15px;text-transform:uppercase;letter-spacing:.08em;opacity:.6;
  margin:32px 0 10px;font-weight:600}
.fecha{opacity:.6;margin:0 0 18px;font-size:13px}
.solapas{display:flex;gap:8px;margin:0 0 24px}
.solapas a{flex:1;text-align:center;padding:10px;border-radius:99px;
  text-decoration:none;color:var(--t);background:rgba(127,127,127,.12);font-weight:600;font-size:14px}
.solapas a.on{background:var(--a);color:#fff}
.tarjetas{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}
.c{background:rgba(127,127,127,.12);border-radius:16px;padding:14px}
.c b{display:block;font-size:30px;line-height:1.1;font-variant-numeric:tabular-nums}
.c span{font-size:12px;opacity:.65}
table{width:100%;border-collapse:collapse;font-variant-numeric:tabular-nums}
th{text-align:left;font-weight:400;opacity:.6;font-size:12px;width:44px}
td i{display:block;height:12px;border-radius:99px;background:var(--a);min-width:2px}
td.n{width:40px;text-align:right;font-size:13px}
tr>*{padding:3px 0}
ul{list-style:none;padding:0;margin:0}
li{background:rgba(127,127,127,.12);border-radius:16px;padding:12px 14px;margin-bottom:10px}
li b{font-size:11px;text-transform:uppercase;letter-spacing:.06em;opacity:.75}
li time{font-size:12px;opacity:.5;float:right}
li p{margin:6px 0 0;white-space:pre-wrap;overflow-wrap:anywhere}
li small{display:block;margin-top:8px;opacity:.6}
.c-dato{color:#e8a33d}.c-falta{color:#4fa88b}.c-confuso{color:#e15f49}
.mas{display:block;text-align:center;padding:12px;color:var(--a);font-weight:600;text-decoration:none}
.vacio{opacity:.6}
</style></head><body>
<h1>Cota Cero</h1>
<p class="fecha">Día ${escapar(d.dia)} · generado ${escapar(d.generado.slice(0, 16).replace("T", " "))} UTC</p>
${solapas}
${cuerpo}
</body></html>`;
}

function vistaResumen(d, url) {
  const tope = Math.max(1, ...d.serie.map((x) => x.activos));
  const barras = d.serie
    .map(
      (x) => `<tr><th>${escapar(x.dia.slice(5))}</th>
      <td><i style="width:${(x.activos / tope) * 100}%"></i></td>
      <td class="n">${x.activos}</td></tr>`,
    )
    .join("");

  const ultimas = d.sugerencias.ultimas.length
    ? `<ul>${d.sugerencias.ultimas.map(unaSugerencia).join("")}</ul>
       ${
         d.sugerencias.total > d.sugerencias.ultimas.length
           ? `<a class="mas" href="${escapar(url("sugerencias"))}">Ver las ${d.sugerencias.total} →</a>`
           : ""
       }`
    : `<p class="vacio">Todavía no mandó nadie.</p>`;

  return `<div class="tarjetas">
  <div class="c"><b>${d.activos.hoy}</b><span>hoy</span></div>
  <div class="c"><b>${d.activos.siete_dias}</b><span>7 días</span></div>
  <div class="c"><b>${d.activos.treinta_dias}</b><span>30 días</span></div>
</div>

<h2>Últimos 14 días</h2>
<table>${barras}</table>

<h2>Avisos</h2>
<div class="c"><b>${d.suscriptos_push}</b><span>teléfonos suscriptos a las notificaciones</span></div>

<h2>Últimas sugerencias</h2>
${ultimas}`;
}

function vistaSugerencias(d) {
  if (!d.sugerencias.total)
    return `<p class="vacio">Todavía no mandó nadie. Cuando alguien use el
      formulario del pie de la app, aparece acá.</p>`;

  const porCategoria = {};
  for (const s of d.sugerencias.ultimas) {
    const c = CATEGORIAS[s.categoria] ? s.categoria : "otro";
    porCategoria[c] = (porCategoria[c] || 0) + 1;
  }
  const resumen = Object.entries(porCategoria)
    .map(([c, n]) => `${escapar(CATEGORIAS[c])}: ${n}`)
    .join(" · ");

  return `<p class="fecha">${d.sugerencias.total} en total${
    d.sugerencias.ultimas.length < d.sugerencias.total
      ? `, se muestran las ${d.sugerencias.ultimas.length} más recientes`
      : ""
  }.<br>${resumen}</p>
<ul>${d.sugerencias.ultimas.map(unaSugerencia).join("")}</ul>`;
}
