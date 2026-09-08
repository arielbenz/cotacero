/* Qué pasaría si el margen saliera de la separación local entre las dos curvas
   que la app usa, en vez de ser 0,5 m fijo. NO cambia nada: sólo cuantifica.
   El margen se resta del lado pesimista, así que un margen mayor BAJA el nivel
   de aviso (avisa antes) y uno menor lo sube. */
import { readFileSync } from "node:fs";
const d = JSON.parse(readFileSync("datos-abiertos/curvas.json", "utf8"));
const M_LAT=110900, mLon=l=>111320*Math.cos((l*Math.PI)/180);
const xy=([lo,la])=>[lo*mLon(la),la*M_LAT];
function ds(px,py,ax,ay,bx,by){const dx=bx-ax,dy=by-ay,l2=dx*dx+dy*dy;
  let t=l2?((px-ax)*dx+(py-ay)*dy)/l2:0;t=t<0?0:t>1?1:t;
  return Math.hypot(px-(ax+t*dx),py-(ay+t*dy));}
function localSalto(lat,lon){
  if(lon<d.area[0]||lon>d.area[2]||lat<d.area[1]||lat>d.area[3])return null;
  const ml=mLon(lat),px=lon*ml,py=lat*M_LAT,c=new Map();
  for(const [z,p] of d.curvas){let m=Infinity;
    for(let i=0;i<p.length-2;i+=2){const q=ds(px,py,p[i]*ml,p[i+1]*M_LAT,p[i+2]*ml,p[i+3]*M_LAT);if(q<m)m=q;}
    if(!c.has(z)||m<c.get(z))c.set(z,m);}
  const o=[...c.entries()].sort((a,b)=>a[1]-b[1]);if(!o.length)return null;
  const [z1]=o[0];
  for(const [z2] of o.slice(1)) if(z2!==z1) return Math.abs(z2-z1);
  return null;}
const f=x=>(Math.round(x*100)/100).toFixed(2);

/* Convención: el margen es MEDIO intervalo local, que es de donde salió el 0,5
   original si se toma el intervalo nominal de 1 m... pero las curvas del
   municipio son cada 0,5 m, así que medio intervalo serían 0,25. La app usa
   0,50, o sea el intervalo ENTERO. Se reportan las dos lecturas. */
const N=45, muestra=[];
for(let i=0;i<N;i++)for(let j=0;j<N;j++){
  const lat=d.area[1]+(d.area[3]-d.area[1])*(i+0.5)/N, lon=d.area[0]+(d.area[2]-d.area[0])*(j+0.5)/N;
  const s=localSalto(lat,lon); if(s) muestra.push(s);}
const q=(a,p)=>a.slice().sort((x,y)=>x-y)[Math.min(a.length-1,Math.floor(p*a.length))];

for(const [nombre, factor] of [["intervalo ENTERO (como hoy: 0,50 fijo)",1],["MEDIO intervalo (0,25 en la malla nominal)",0.5]]){
  const m = muestra.map(s=>s*factor);
  const delta = m.map(x=>0.5-x);            // cuánto subiría el nivel de aviso
  console.log("\n  === margen = " + nombre + " ===");
  console.log("   margen local: mediana " + f(q(m,0.5)) + " · p90 " + f(q(m,0.9)) + " · máx " + f(Math.max(...m)) + " m");
  console.log("   cambio en el nivel de aviso respecto de hoy:");
  console.log("     mediana " + (q(delta,0.5)>=0?"+":"") + f(q(delta,0.5)) + " m   p10 " + f(q(delta,0.1)) + "   p90 " + (q(delta,0.9)>=0?"+":"") + f(q(delta,0.9)) + " m");
  console.log("     área donde el aviso llegaría ANTES que hoy (margen mayor): " + f(100*delta.filter(x=>x<-0.05).length/delta.length) + "%");
  console.log("     área donde llegaría DESPUÉS que hoy (margen menor):        " + f(100*delta.filter(x=>x>0.05).length/delta.length) + "%");
  console.log("     cambio mayor a 25 cm en valor absoluto:                    " + f(100*delta.filter(x=>Math.abs(x)>0.25).length/delta.length) + "%");
}
