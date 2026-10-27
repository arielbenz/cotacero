// scripts/markdown.js — la versión en Markdown de cada página, para agentes.
//
// Sale del MISMO HTML que emite el generador (y de la portada, que es a mano):
// no hay un segundo texto que se pueda desincronizar. No es un conversor
// general de HTML: alcanza para el marcado de este sitio, que es semántico y
// sale de nuestras plantillas. Lo que no se puede leer como texto —el mockup
// del hero, los SVG, los formularios, los botones— se saltea.
//
// No vive en scripts/paginas/ porque emitir.js carga como página cada .js de
// esa carpeta.

import { SITIO } from "../lib/paginas.js";

/* La URL del gemelo: la misma de la página con «.md» al final, como propone
   llms.txt (https://llmstxt.org). Las que no tienen nombre de archivo —la
   portada— van como index.html.md. */
const rutaMd = (ruta) => (ruta === "/" ? "/index.html.md" : ruta + ".md");

const VACIOS = new Set(["br", "hr", "img", "input", "link", "meta", "wbr"]);
/* Lo que no se lee como texto. `label` sale con el formulario o con el
   mockup; suelto, sería el rótulo de un control que no está. */
const SALTEAR = new Set([
  "button",
  "form",
  "iframe",
  "img",
  "input",
  "label",
  "nav",
  "noscript",
  "script",
  "select",
  "style",
  "svg",
  "template",
  "textarea",
]);
/* Clases que no se leen como texto: el mockup del hero y la vista previa del
   widget son números que pinta el JavaScript —en el Markdown quedarían como
   «— m», un dato vacío con cara de dato—, y el numerito de «Cómo funciona»
   repetiría el de la lista ordenada. */
const CLASES_FUERA = ["mockup-envoltura", "widget-previa", "numerito"];
const BLOQUES = new Set([
  ...["p", "div", "section", "header", "footer", "main", "aside", "article"],
  ...["figure", "figcaption", "details", "summary", "fieldset", "legend"],
  ...["ul", "ol", "li", "dl", "dt", "dd", "table", "pre", "blockquote"],
  ...["h1", "h2", "h3", "h4", "h5", "h6"],
]);

const ENTIDADES = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  middot: "·",
  hellip: "…",
  mdash: "—",
  ndash: "–",
  laquo: "«",
  raquo: "»",
};
const desescapar = (t) =>
  t.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e) =>
    e[0] !== "#"
      ? (ENTIDADES[e.toLowerCase()] ?? m)
      : String.fromCodePoint(
          /x/i.test(e[1]) ? parseInt(e.slice(2), 16) : +e.slice(1),
        ),
  );

const ETIQUETA =
  /<!--[\s\S]*?-->|<(\/?)([a-zA-Z][a-zA-Z0-9-]*)((?:\s+[^\s=>\/]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+))?)*)\s*(\/?)\s*>|([^<]+)|</g;
const ATRIBUTO = /([^\s=>\/]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g;

/* HTML → árbol. Cierra lo que haya quedado abierto si una etiqueta de cierre
   salta niveles, que es lo que hace el navegador con un `</p>` de más. */
function arbol(html) {
  const raiz = { tag: "#raiz", attrs: {}, hijos: [] };
  const pila = [raiz];
  for (const m of html.matchAll(ETIQUETA)) {
    const arriba = pila[pila.length - 1];
    if (m[5] !== undefined || m[0] === "<") {
      arriba.hijos.push({ texto: desescapar(m[5] ?? "<") });
      continue;
    }
    if (!m[2]) continue; // un comentario
    const tag = m[2].toLowerCase();
    if (m[1]) {
      const i = pila.map((n) => n.tag).lastIndexOf(tag);
      if (i > 0) pila.length = i;
      continue;
    }
    const attrs = {};
    for (const a of m[3].matchAll(ATRIBUTO))
      attrs[a[1].toLowerCase()] = desescapar(a[2] ?? a[3] ?? a[4] ?? "");
    const nodo = { tag, attrs, hijos: [] };
    arriba.hijos.push(nodo);
    if (!VACIOS.has(tag) && !m[4]) pila.push(nodo);
  }
  return raiz;
}

/* `geo:` también: en /puntos-de-encuentro lleva las coordenadas oficiales de
   cada punto, que es justo lo que le sirve a un agente. */
const absoluta = (href, url) =>
  /^(https?:|tel:|mailto:|geo:)/.test(href)
    ? href
    : href.startsWith("#")
      ? url + href
      : href.startsWith("/")
        ? SITIO + href
        : null;

const escapar = (t) => t.replace(/([\\`*_[\]])/g, "\\$1");

/* Un renglón: espacios de más afuera, y cada salto de <br> como un salto. */
const renglon = (t) =>
  t
    .split("\n")
    .map((l) => l.replace(/[ \t]+/g, " ").trim())
    .join("\n")
    .trim();

function md(html, { url }) {
  const clases = (n) => (n.attrs.class || "").split(/\s+/);
  /* `role="status"` es lo que llena el JavaScript al llegar el dato
     («Cargando la línea de tiempo…»): en una copia estática nunca llega. */
  const fuera = (n) =>
    SALTEAR.has(n.tag) ||
    "hidden" in n.attrs ||
    n.attrs["aria-hidden"] === "true" ||
    n.attrs.role === "status" ||
    clases(n).some((c) => CLASES_FUERA.includes(c));
  /* La clave de un par clave–valor se llama `k` o termina en `-k` en todo el
     sitio (.k, .be-k, .cv-k). */
  const esClave = (n) => clases(n).some((c) => /(^|-)k$/.test(c));

  /* Partes de una ficha: dos <span> con clase uno al lado del otro, o dos
     elementos sin nada en el medio («<b>107</b><span>Emergencias…»), son dos
     datos que el CSS separa y el texto pegaba. Van con « · ». Con un espacio
     en el medio es prosa y no se toca; después de una clave, tampoco: ya
     lleva «: ». */
  function juntar(hijos) {
    let salida = "";
    let previo = null;
    let contiguo = false;
    for (const h of hijos) {
      const t = enLinea(h);
      if (h.texto !== undefined) {
        if (t.trim()) previo = null;
        contiguo = false;
      } else if (t.trim()) {
        const fichas =
          previo?.tag === "span" &&
          h.tag === "span" &&
          previo.attrs.class &&
          h.attrs.class;
        if (previo && !esClave(previo) && (fichas || contiguo))
          salida = salida.trimEnd() + " · ";
        previo = h;
        contiguo = true;
      }
      salida += t;
    }
    return salida;
  }

  /* Un renglón suelto (título, celda, resumen): sin saltos adentro. */
  const plano = (n) => renglon(juntar(n.hijos)).replace(/\n/g, " ");

  /* Un enlace con dos o más partes con texto es una tarjeta —una charla, un
     punto de encuentro— y va en su propio párrafo: en línea, las ocho
     charlas salían como un solo renglón. */
  const esTarjeta = (n) =>
    n.tag === "a" &&
    n.hijos.filter((h) => h.texto === undefined && enLinea(h).trim()).length >=
      2;

  /* Lo de adentro de un renglón: texto con negritas, enlaces y código. */
  function enLinea(n) {
    if (n.texto !== undefined) return escapar(n.texto.replace(/\s+/g, " "));
    if (fuera(n)) return "";
    if (n.tag === "br") return "\n";
    /* El renglón para llenar a mano de la guía. */
    if (clases(n).includes("g-linea")) return " \\_\\_\\_\\_\\_\\_ ";
    /* Pegada al valor, «Estación» «Santa Fe» se leía «EstaciónSanta Fe». */
    if (esClave(n)) {
      const k = plano(n);
      return k ? k + ": " : "";
    }
    const adentro = juntar(n.hijos);
    const pegado = adentro.trim();
    if (!pegado) return adentro.includes(" ") ? " " : "";
    /* Los espacios van afuera de las marcas: «** hola**» no es negrita. */
    const antes = /^\s/.test(adentro) ? " " : "";
    const despues = /\s$/.test(adentro) ? " " : "";
    const envolver = (a, b = a) => antes + a + pegado + b + despues;
    switch (n.tag) {
      case "b":
      case "strong":
        return envolver("**");
      case "i":
      case "em":
        return envolver("_");
      case "code":
        return envolver("`");
      case "a": {
        const href = absoluta(n.attrs.href || "", url);
        return href ? envolver("[", `](${href})`) : adentro;
      }
      default:
        return adentro;
    }
  }

  function tabla(n) {
    const filas = [];
    const recorrer = (x) => {
      for (const h of x.hijos || []) {
        if (h.texto !== undefined || fuera(h)) continue;
        if (h.tag !== "tr") recorrer(h);
        else
          filas.push(
            h.hijos
              .filter((c) => c.tag === "th" || c.tag === "td")
              .map((c) => plano(c).replace(/\|/g, "\\|")),
          );
      }
    };
    recorrer(n);
    if (!filas.length) return [];
    const ancho = Math.max(...filas.map((f) => f.length));
    const fila = (f) =>
      "| " + Array.from({ length: ancho }, (_, i) => f[i] ?? "").join(" | ") +
      " |";
    return [
      [fila(filas[0]), fila(Array(ancho).fill("---")), ...filas.slice(1).map(fila)]
        .join("\n"),
    ];
  }

  /* Si un renglón tiene más de un párrafo, la lista va separada por líneas
     en blanco: mezclar las dos formas la vuelve ambigua. */
  function lista(n, ordenada) {
    let i = 0;
    let suelta = false;
    const items = n.hijos
      .filter((h) => h.tag === "li" && !fuera(h))
      .map((li) => {
        const marca = ordenada ? `${++i}. ` : "- ";
        const partes = bloques(li.hijos);
        if (!partes.length) return null;
        if (partes.length > 1) suelta = true;
        const sangria = " ".repeat(marca.length);
        return (
          marca +
          partes
            .join("\n\n")
            .split("\n")
            .map((l, k) => (k && l ? sangria + l : l))
            .join("\n")
        );
      })
      .filter(Boolean);
    return items.length ? [items.join(suelta ? "\n\n" : "\n")] : [];
  }

  /* Los hijos de un bloque: lo que está en línea se junta en párrafos y cada
     bloque sale aparte. Devuelve una lista de trozos de Markdown. */
  function bloques(hijos) {
    const salida = [];
    let suelto = "";
    const cerrar = () => {
      const t = renglon(suelto);
      if (t) salida.push(t);
      suelto = "";
    };
    for (const h of hijos) {
      /* El formulario no se puede usar desde acá: se dice dónde está, en vez
         de que la página parezca no tenerlo. */
      if (h.tag === "form") {
        cerrar();
        salida.push(`_El formulario se completa en [la página](${url})._`);
        continue;
      }
      const tarjeta = h.texto === undefined && !fuera(h) && esTarjeta(h);
      if (h.texto !== undefined || (!BLOQUES.has(h.tag) && !tarjeta)) {
        suelto += enLinea(h);
        continue;
      }
      cerrar();
      if (tarjeta) salida.push(renglon(enLinea(h)));
      else if (!fuera(h)) salida.push(...bloque(h));
    }
    cerrar();
    return salida;
  }

  function bloque(n) {
    const t = n.tag;
    if (/^h[1-6]$/.test(t)) {
      const titulo = plano(n);
      return titulo ? ["#".repeat(+t[1]) + " " + titulo] : [];
    }
    if (t === "ul") return lista(n, false);
    if (t === "ol") return lista(n, true);
    if (t === "table") return tabla(n);
    if (t === "summary") {
      const s = plano(n).replace(/^\*\*(.*)\*\*$/, "$1");
      return s ? ["**" + s + "**"] : [];
    }
    /* Los pares pueden ir envueltos en un <div> cada uno, que es HTML válido
       (/legal, /historia): se buscan a cualquier profundidad. */
    if (t === "dl") {
      const salida = [];
      const recorrer = (x) => {
        for (const h of x.hijos || []) {
          if (h.texto !== undefined || fuera(h)) continue;
          if (h.tag === "dt") salida.push("**" + plano(h) + "**");
          else if (h.tag === "dd") salida.push(...bloques(h.hijos));
          else recorrer(h);
        }
      };
      recorrer(n);
      return salida;
    }
    if (t === "pre") {
      const crudo = (x) =>
        x.texto !== undefined ? x.texto : x.hijos.map(crudo).join("");
      return ["```\n" + crudo(n).replace(/^\n|\s+$/g, "") + "\n```"];
    }
    if (t === "blockquote")
      return bloques(n.hijos).map((b) => b.replace(/^/gm, "> "));
    return bloques(n.hijos);
  }

  return bloques(arbol(html).hijos).join("\n\n") + "\n";
}

/* La página entera: un encabezado que dice qué es este archivo y las dos
   cosas que un agente no puede perderse —que no somos oficiales y que el
   nivel del río de hoy no está acá: esta copia es estática y la barra de la
   página lo pinta con JavaScript—, y después el contenido. */
function paginaMd(html, { ruta }) {
  const url = SITIO + (ruta === "/" ? "/" : ruta);
  const ini = html.search(/<header class="(pg-cabecera|hero)"/);
  const fin = html.search(/<div class="pie-envoltura"|<!-- PIE:inicio/);
  if (ini === -1 || fin === -1 || fin < ini)
    throw new Error("markdown: no encuentro el cuerpo de " + ruta);
  return (
    `> Versión en Markdown de ${url}, para agentes de IA.\n` +
    `> Cota Cero no es un sitio oficial: la orden de evacuación la da ` +
    `Defensa Civil (103).\n` +
    `> El nivel del río de hoy no está en este archivo: se lee en ` +
    `${SITIO}/api/nivel.\n\n` +
    md(html.slice(ini, fin), { url })
  );
}

export { paginaMd, rutaMd };
