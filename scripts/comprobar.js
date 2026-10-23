// scripts/comprobar.js — los casos que el cálculo central no puede romper.
//
//   node scripts/comprobar.js
//
// No es un framework de tests ni lo quiere ser: una lista de casos con el
// valor que ya se verificó a mano —en el navegador, contra la fuente— y una
// salida distinta de cero si alguno cambia. Sin dependencias, como el resto.
//
// Qué cubre y por qué esas cosas:
//   - el formato de los números (public/lib/comun.js), que decide si un nivel
//     de aviso sale con un decimal o con dos;
//   - que el gemelo clásico (comun-clasico.js) diga lo mismo que el original:
//     tocar comun.js sin correr el generador es el único modo de romperlo;
//   - la cuenta del modelo (js/app/modelo.js), con casos de la app real;
//   - de dónde sale la altura (js/app/elevacion.js): curvas en la ciudad,
//     puntos en la costa, nada donde no hay dato;
//   - que ZONAS sea consistente consigo misma.
//
// Los módulos de la app importan con rutas del navegador («/lib/comun.js»).
// Un hook de resolución las manda a public/, que es lo que hace el servidor.

import { registerHooks } from "node:module";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import vm from "node:vm";

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const PUBLICO = join(RAIZ, "public");

registerHooks({
  resolve(especificador, contexto, siguiente) {
    if (especificador.startsWith("/"))
      return siguiente(pathToFileURL(join(PUBLICO, especificador)).href, contexto);
    return siguiente(especificador, contexto);
  },
});

// elevacion.js baja sus datos con fetch: se le presta uno que lee del disco.
globalThis.fetch = async (url) => {
  const ruta = join(PUBLICO, String(url));
  return { ok: true, json: async () => JSON.parse(readFileSync(ruta, "utf8")) };
};

const comun = await import("/lib/comun.js");
const config = await import("/js/app/config.js");
const modelo = await import("/js/app/modelo.js");
const { elevacionDe, FUENTES_ALTURA } = await import("/js/app/elevacion.js");
const zonas = await import("/js/app/zonas.js");
const { FUENTES_APP } = await import("/js/app/fuentes.js");

let fallas = 0;
function caso(nombre, obtenido, esperado, tolerancia = 0) {
  const ok =
    typeof esperado === "number" && typeof obtenido === "number"
      ? Math.abs(obtenido - esperado) <= tolerancia
      : JSON.stringify(obtenido) === JSON.stringify(esperado);
  if (!ok) fallas++;
  console.log(
    (ok ? "  ✓ " : "  ✗ ") +
      nombre +
      (ok ? "" : `\n      esperado ${JSON.stringify(esperado)}, dio ${JSON.stringify(obtenido)}`),
  );
}

console.log("Cómo se escriben los números");
caso("nivel del río, dos decimales", comun.m(4.857), "4,86 m");
caso("nivel de aviso, un decimal y tilde", comun.mU(5.6049), "≈ 5,6 m");
caso("nivel de aviso sin dato", comun.mU(null), "—");
caso("distancia chica en centímetros", comun.mCm(0.42), "42 cm");
caso("distancia grande en metros", comun.mCm(1.73), "1,7 m");
caso("umbrales plausibles", comun.umbralesDe({ alerta: 5.3, evacuacion: 5.7 }), {
  alerta: 5.3,
  evacuacion: 5.7,
});
caso(
  "evacuación por debajo de la alerta: se descarta",
  comun.umbralesDe({ alerta: 5.7, evacuacion: 5.3 }),
  null,
);

console.log("El gemelo clásico dice lo mismo");
{
  const ctx = { self: {}, window: {} };
  vm.createContext(ctx);
  vm.runInContext(readFileSync(join(PUBLICO, "lib", "comun-clasico.js"), "utf8"), ctx);
  const cc = ctx.self.CC_COMUN || ctx.window.CC_COMUN || ctx.CC_COMUN;
  if (!cc) {
    fallas++;
    console.log("  ✗ comun-clasico.js no publica CC_COMUN");
  } else {
    caso("umbrales de respaldo", { ...cc.UMBRALES_RESPALDO }, { ...comun.UMBRALES_RESPALDO });
    caso("VENCE_HORAS", cc.VENCE_HORAS, comun.VENCE_HORAS);
    for (const v of [5.6049, 7.43, 0.42])
      caso(`mU(${v})`, cc.mU(v), comun.mU(v));
    // El service worker arma la notificación con el gemelo, no con el original.
    for (const args of [[7.43, 7.04, true, null], [5.1, 5.25, true, null], [3.12, null, false, null]])
      caso(`avisoDe(${args.join(", ")})`, { ...cc.avisoDe(...args) }, comun.avisoDe(...args));
  }
}

console.log("Los estados y cómo se dicen (README, «Los ocho estados»)");
{
  const R = comun.UMBRALES_RESPALDO;
  const e = (nivel, umbral) => comun.estadoDe(nivel, umbral, R.alerta, R.evacuacion);
  caso("sin dato del río", e(null, 5), "sinDato");
  caso("tu nivel de aviso manda sobre la ciudad", e(6.0, 5.8), "superado");
  // 13,9 − 0,5 − 8,2 da 5,200000000000001: con el río en 5,20, ya lo alcanzó.
  caso("río justo en tu nivel de aviso, con coma flotante", e(5.2, 13.9 - 0.5 - 8.2), "superado");
  caso("evacuación sobre alerta", e(5.8, 7), "evacuacion");
  caso("alerta", e(5.4, 7), "alerta");
  caso("a 20 cm: cerca", e(4.5, 4.7), "cerca");
  caso("a 50 cm: acercándose", e(4.3, 4.8), "acercandose");
  caso("lejos: subió", e(3, 6), "subio");
  caso("sin casa cargada", e(3, null), "subioSinCasa");
  caso("«Atención» sigue a un metro de la alerta", R.alerta - comun.ATENCION_ANTES_M, 4.3, 1e-9);

  /* Las notificaciones, con los números más largos posibles: el cuerpo no
     pasa de 180 caracteres, y los graves empiezan con el verbo y llevan el 103. */
  const avisos = [
    ["superado", comun.avisoDe(7.43, 7.04, true, null), comun.ESTADOS.superado.verbo],
    ["evacuación", comun.avisoDe(7.43, null, false, null), comun.ESTADOS.evacuacion.verbo],
    ["alerta", comun.avisoDe(5.69, null, false, null), comun.ESTADOS.alerta.verbo],
    ["cerca", comun.avisoDe(5.1, 5.25, true, null), null],
    ["acercándose", comun.avisoDe(4.8, 5.25, true, null), null],
    ["subió", comun.avisoDe(3.12, 5.25, false, null), null],
    ["sin casa", comun.avisoDe(3.12, null, false, null), null],
    ["sin dato", comun.avisoDe(null, 5.25, true, null), null],
  ];
  for (const [n, a, verbo] of avisos) {
    caso(`aviso «${n}»: ≤ 180 caracteres (${a.cuerpo.length})`, a.cuerpo.length <= 180, true);
    if (verbo) {
      caso(`aviso «${n}»: empieza con el verbo`, a.cuerpo.startsWith(verbo), true);
      caso(`aviso «${n}»: lleva el 103`, a.cuerpo.includes("103"), true);
    }
  }
  caso("sin aviso anticipado pedido, a 20 cm es «subió»", comun.avisoDe(5.1, 5.25, false, null).urgente, false);
  const g = comun.textoGrave(5.8, R.alerta, R.evacuacion);
  caso("pantalla, evacuación: el verbo y el 103", g.verbo === comun.ESTADOS.evacuacion.verbo && g.resto.includes("103"), true);
  caso("pantalla, debajo de la alerta: nada grave", comun.textoGrave(5.2, R.alerta, R.evacuacion), null);
}

console.log("La cuenta del modelo");
// Risso 1745, zona Centro: 16,44 de las curvas → 16,44 − 0,5 − 8,20.
caso(
  "Risso 1745, centro, curvas",
  modelo.umbralDe({ cota: 16.44, estimada: true, fuente: "curvas", km: 0 }),
  7.74,
  1e-9,
);
// Dorrego 2414, San José del Rincón: 15,52 de los puntos, 16 km.
caso(
  "Dorrego 2414, Rincón, puntos",
  modelo.umbralDe({ cota: 15.52, estimada: true, fuente: "puntos", km: 16 }),
  5.6,
  1e-9,
);
caso(
  "altura cargada a mano: sin margen",
  modelo.umbralDe({ cota: 13.7, estimada: false, fuente: "", km: 11 }),
  13.7 - 8.2 - 0.045 * 11,
  1e-9,
);
caso(
  "crudo: sin margen aunque sea estimada",
  modelo.umbralDe({ cota: 16.44, estimada: true, fuente: "curvas", km: 0, crudo: true }),
  8.24,
  1e-9,
);
caso("sin zona: no hay número", modelo.umbralDe({ cota: 16, estimada: true, km: null }), null);
caso("margen de las curvas", modelo.margenDe({ estimada: true, fuente: "curvas" }), config.ERROR_DEM);
caso("margen de los puntos", modelo.margenDe({ estimada: true, fuente: "puntos" }), config.ERROR_PUNTOS);
caso(
  "lo guardado antes de los puntos, sin fuente: margen de las curvas",
  modelo.margenDe({ estimada: true, fuente: undefined }),
  config.ERROR_DEM,
);

console.log("De dónde sale la altura");
// Valores verificados en el navegador el 22/10/2026 (PR #26).
const alturas = [
  ["Risso 1745, ciudad", -31.639, -60.704, 16.47, "curvas"],
  ["Dorrego 2414, San José del Rincón", -31.6055, -60.5741, 15.52, "puntos"],
  ["plaza de Rincón", -31.606, -60.568, 16.47, "puntos"],
  ["Arroyo Leyes", -31.56, -60.53, 15.17, "puntos"],
];
for (const [n, lat, lon, cota, fuente] of alturas) {
  const r = await elevacionDe(lat, lon);
  caso(`${n}: ${cota} de ${fuente}`, r && { c: Math.round(r.cota * 100) / 100, f: r.fuente }, {
    c: cota,
    f: fuente,
  });
}
caso("isla frente a Rincón: sin dato", await elevacionDe(-31.62, -60.53), null);
caso("Santa Rosa de Calchines: sin dato", await elevacionDe(-31.43, -60.33), null);

console.log("Cada fuente de altura trae todo lo suyo");
for (const f of FUENTES_ALTURA) {
  const { existsSync } = await import("node:fs");
  caso(`«${f.id}»: margen propio`, typeof f.margen === "number" && f.margen > 0, true);
  caso(`«${f.id}»: su sello existe en FUENTES_APP`, Boolean(FUENTES_APP[f.sello]), true);
  caso(`«${f.id}»: su archivo está en public/`, existsSync(join(PUBLICO, f.archivo)), true);
  caso(
    `«${f.id}»: cómo se dice en pantalla`,
    typeof f.dice?.porQueMargen === "string" &&
      typeof f.dice?.deDonde === "string" &&
      typeof f.dice?.explicacion(42) === "string",
    true,
  );
}
caso("curvas con ERROR_DEM", FUENTES_ALTURA.find((f) => f.id === "curvas").margen, config.ERROR_DEM);
caso("puntos con ERROR_PUNTOS", FUENTES_ALTURA.find((f) => f.id === "puntos").margen, config.ERROR_PUNTOS);

console.log("ZONAS");
{
  for (const v of zonas.VECINAS) {
    caso(`vecina «${v.id}»: cómo se la reconoce`, v.localidad.re instanceof RegExp && v.localidad.re.test(v.n), true);
    caso(`vecina «${v.id}»: está en la frase de cobertura`, zonas.COBERTURA.includes(v.n), true);
    caso(`vecina «${v.id}»: no es «sin plano»`, !v.sinPlano, true);
  }
  const ids = zonas.ZONAS.map((z) => z.id);
  caso("ids sin repetir", ids.length === new Set(ids).size, true);
  caso(
    "KM_PUBLICADO nombra zonas que existen",
    [...zonas.KM_PUBLICADO].every((id) => ids.includes(id)),
    true,
  );
  caso(
    "toda zona tiene km, salvo «otro»",
    zonas.ZONAS.filter((z) => z.id !== "otro").every((z) => typeof z.km === "number" && z.km >= 0),
    true,
  );
  const sinFuente = zonas.ZONAS.flatMap((z) =>
    (z.observado || []).filter((o) => !o.fuente || typeof o.nivel !== "number").map(() => z.id),
  );
  caso("cada «observado» tiene nivel y fuente (AUDITORIA §9)", sinFuente, []);
}

console.log("Cada import de la app existe en su módulo");
{
  /* node --check no lo ve y el navegador sí: un import de un nombre que el
     módulo ya no exporta tira el grafo entero de /app, con un SyntaxError en
     consola y la pantalla en blanco. Pasó al sacar curvas() de elevacion.js. */
  const { readdirSync } = await import("node:fs");
  const exportsDe = new Map();
  const leerExports = (archivo) => {
    if (exportsDe.has(archivo)) return exportsDe.get(archivo);
    const fuente = readFileSync(archivo, "utf8");
    const nombres = new Set();
    for (const [, n] of fuente.matchAll(/^export\s+(?:async\s+)?(?:function\*?|class)\s+([\w$]+)/gm))
      nombres.add(n);
    // `export let a = 1, b = {}, c;` declara tres: se vacía lo que va entre
    // llaves, corchetes y paréntesis, y quedan los nombres antes de cada = o ,.
    for (const [, decl] of fuente.matchAll(/^export\s+(?:const|let|var)\s+([^;]+);/gm)) {
      let plano = decl;
      for (let i = 0; i < 5; i++) plano = plano.replace(/\{[^{}]*\}|\[[^[\]]*\]|\([^()]*\)/g, "");
      for (const [, n] of plano.matchAll(/(?:^|,)\s*([\w$]+)\s*(?==|,|$)/g)) nombres.add(n);
    }
    for (const [, lista] of fuente.matchAll(/^export\s*\{([^}]*)\}/gm))
      for (const parte of lista.split(","))
        if (parte.trim()) nombres.add(parte.trim().split(/\s+as\s+/).pop());
    exportsDe.set(archivo, nombres);
    return nombres;
  };
  const dirApp = join(PUBLICO, "js", "app");
  const rotos = [];
  for (const f of readdirSync(dirApp).filter((x) => x.endsWith(".js"))) {
    const fuente = readFileSync(join(dirApp, f), "utf8");
    for (const [, lista, desde] of fuente.matchAll(/import\s*\{([^}]*)\}\s*from\s*"([^"]+)"/g)) {
      const destino = desde.startsWith("/") ? join(PUBLICO, desde) : join(dirApp, desde);
      const hay = leerExports(destino);
      for (const parte of lista.split(",")) {
        const nombre = parte.trim().split(/\s+as\s+/)[0];
        if (nombre && !hay.has(nombre)) rotos.push(`${f}: «${nombre}» no está en ${desde}`);
      }
    }
  }
  caso("ningún import apunta a un nombre que no existe", rotos, []);
}

console.log(fallas ? `\n${fallas} caso(s) fallaron.` : "\nTodo en orden.");
process.exit(fallas ? 1 : 0);
