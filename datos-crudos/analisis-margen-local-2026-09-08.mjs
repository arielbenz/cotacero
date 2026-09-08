import { readFileSync } from "node:fs";
const d = JSON.parse(readFileSync("datos-abiertos/curvas.json", "utf8"));

const M_LAT = 110900, mLon = (lat) => 111320 * Math.cos((lat*Math.PI)/180);
function distSeg(px,py,ax,ay,bx,by){const dx=bx-ax,dy=by-ay,l2=dx*dx+dy*dy;
  let t=l2?((px-ax)*dx+(py-ay)*dy)/l2:0; t=t<0?0:t>1?1:t;
  return Math.hypot(px-(ax+t*dx),py-(ay+t*dy));}

/* Misma selección que js/app/elevacion.js: las dos curvas de cota DISTINTA
   más cercanas. Lo que agrega esto es devolver también cuánto salta la cota
   entre esas dos, que es el intervalo local. */
function local(lat, lon) {
  if (lon<d.area[0]||lon>d.area[2]||lat<d.area[1]||lat>d.area[3]) return null;
  const ml=mLon(lat), px=lon*ml, py=lat*M_LAT;
  const cerc=new Map();
  for (const [z,p] of d.curvas){ let min=Infinity;
    for(let i=0;i<p.length-2;i+=2){const q=distSeg(px,py,p[i]*ml,p[i+1]*M_LAT,p[i+2]*ml,p[i+3]*M_LAT); if(q<min)min=q;}
    if(!cerc.has(z)||min<cerc.get(z))cerc.set(z,min);}
  const o=[...cerc.entries()].sort((a,b)=>a[1]-b[1]);
  if(!o.length) return null;
  const [z1,d1]=o[0];
  for(const [z2,d2] of o.slice(1)) if(z2!==z1) return {z1,z2,d1,d2,salto:Math.abs(z2-z1)};
  return null;
}

// Malla sobre la cobertura
const N=45, out=[];
for(let i=0;i<N;i++) for(let j=0;j<N;j++){
  const lat=d.area[1]+(d.area[3]-d.area[1])*(i+0.5)/N;
  const lon=d.area[0]+(d.area[2]-d.area[0])*(j+0.5)/N;
  const r=local(lat,lon); if(r) out.push(r.salto);
}
out.sort((a,b)=>a-b);
const q=(p)=>out[Math.min(out.length-1,Math.floor(p*out.length))];
const f=x=>(Math.round(x*100)/100).toFixed(2);
console.log("  ===== INTERVALO LOCAL entre las dos curvas usadas =====");
console.log("  puntos de malla con cobertura:", out.length, "de", N*N);
console.log("  mínimo   " + f(out[0]) + " m");
console.log("  p25      " + f(q(0.25)) + " m");
console.log("  mediana  " + f(q(0.50)) + " m");
console.log("  p75      " + f(q(0.75)) + " m");
console.log("  p90      " + f(q(0.90)) + " m");
console.log("  máximo   " + f(out[out.length-1]) + " m");
console.log("");
console.log("  El margen que informa la app es 0,50 m fijo (medio intervalo de 1,0 m).");
const medio = out.map(x=>x/2);
const peor = medio.filter(x=>x>0.5).length, sobra = medio.filter(x=>x<0.25).length;
console.log("  medio intervalo local > 0,50 m (la app informa DE MENOS): " + peor + " puntos (" + f(100*peor/out.length) + "%)");
console.log("  medio intervalo local < 0,25 m (la app informa DE MÁS):   " + sobra + " puntos (" + f(100*sobra/out.length) + "%)");
console.log("");
const bins={};
for(const s of out){const k=f(s); bins[k]=(bins[k]||0)+1;}
console.log("  saltos presentes:");
for(const [k,v] of Object.entries(bins).sort((a,b)=>+a[0]-+b[0]))
  console.log("   " + k.padStart(6) + " m  " + "█".repeat(Math.max(1,Math.round(v/out.length*60))) + " " + v);
