/* Tarea 3 paso 2 — ¿el desnivel entre estaciones cambia con el caudal?
   Esto NO necesita saber la distancia entre estaciones: si el desnivel varía
   con la altura en el Puerto, un valor único de pendiente ya no alcanza,
   independientemente de cuántos km haya. */
import { readFileSync } from "node:fs";
const HOY = process.argv[2];
const CERO = { 30: 8.378, 28: 13.46, 29: 9.432 };   // los que declara el INA
const NOM  = { 30: "Santa Fe", 28: "Hernandarias", 29: "Paraná (ciudad)" };

const leer = (id) => {
  const j = JSON.parse(readFileSync(`datos-crudos/ina-serie-${id}-1990-2026-${HOY}.json`, "utf8"));
  const a = Array.isArray(j) ? j : j.rows || [];
  const m = new Map();
  for (const o of a) if (typeof o.valor === "number")
    m.set(o.timestart.slice(0, 10), o.valor);
  return m;
};
const S = { 30: leer(30), 28: leer(28), 29: leer(29) };
const f = (x, d = 3) => (Math.round(x * 10 ** d) / 10 ** d).toFixed(d);

for (const otro of [28, 29]) {
  const pares = [];
  for (const [d, vSF] of S[30]) {
    const vO = S[otro].get(d);
    if (vO === undefined) continue;
    // altura de escala -> cota IGN con el cero declarado de CADA estación
    pares.push({ d, sf: vSF, cotaSF: vSF + CERO[30], cotaO: vO + CERO[otro],
                 dh: (vO + CERO[otro]) - (vSF + CERO[30]) });
  }
  const dh = pares.map(p => p.dh);
  const med = dh.reduce((a, b) => a + b, 0) / dh.length;
  const sd = Math.sqrt(dh.reduce((a, b) => a + (b - med) ** 2, 0) / (dh.length - 1));
  console.log("\n  ===== " + NOM[otro] + " menos " + NOM[30] + " =====");
  console.log("  días con dato en las dos: " + pares.length);
  console.log("  desnivel medio  " + f(med) + " m   (desvío " + f(sd) + " m)");

  // Cómo cambia el desnivel según la altura en el Puerto
  console.log("\n  altura en el Puerto      n     desnivel medio   mín      máx");
  const cortes = [[0,2],[2,3],[3,4],[4,5],[5,5.3],[5.3,5.7],[5.7,10]];
  for (const [a, b] of cortes) {
    const g = pares.filter(p => p.sf >= a && p.sf < b);
    if (g.length < 30) { console.log("   " + (f(a,1)+" a "+f(b,1)+" m").padEnd(22) + String(g.length).padStart(5) + "    (pocos datos)"); continue; }
    const v = g.map(p => p.dh);
    const m2 = v.reduce((x, y) => x + y, 0) / v.length;
    console.log("   " + (f(a,1) + " a " + f(b,1) + " m").padEnd(22) + String(g.length).padStart(5) +
      "     " + f(m2).padStart(7) + " m  " + f(Math.min(...v)).padStart(7) + "  " + f(Math.max(...v)).padStart(7));
  }
  // correlación desnivel vs altura
  const x = pares.map(p => p.sf), y = dh;
  const mx = x.reduce((a,b)=>a+b,0)/x.length, my = med;
  const num = x.map((v,i)=>(v-mx)*(y[i]-my)).reduce((a,b)=>a+b,0);
  const r = num / Math.sqrt(x.map(v=>(v-mx)**2).reduce((a,b)=>a+b,0) * y.map(v=>(v-my)**2).reduce((a,b)=>a+b,0));
  const pend = num / x.map(v=>(v-mx)**2).reduce((a,b)=>a+b,0);
  console.log("\n  correlación desnivel vs altura en el Puerto: r = " + f(r,2));
  console.log("  por cada metro que sube el Puerto, el desnivel cambia " + f(pend*100,1) + " cm");
}
