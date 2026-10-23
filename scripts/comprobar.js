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
const { elevacionDe } = await import("/js/app/elevacion.js");

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
  }
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

console.log("ZONAS");
{
  const ids = config.ZONAS.map((z) => z.id);
  caso("ids sin repetir", ids.length === new Set(ids).size, true);
  caso(
    "KM_PUBLICADO nombra zonas que existen",
    [...config.KM_PUBLICADO].every((id) => ids.includes(id)),
    true,
  );
  caso(
    "toda zona tiene km, salvo «otro»",
    config.ZONAS.filter((z) => z.id !== "otro").every((z) => typeof z.km === "number" && z.km >= 0),
    true,
  );
  const sinFuente = config.ZONAS.flatMap((z) =>
    (z.observado || []).filter((o) => !o.fuente || typeof o.nivel !== "number").map(() => z.id),
  );
  caso("cada «observado» tiene nivel y fuente (AUDITORIA §9)", sinFuente, []);
}

console.log(fallas ? `\n${fallas} caso(s) fallaron.` : "\nTodo en orden.");
process.exit(fallas ? 1 : 0);
