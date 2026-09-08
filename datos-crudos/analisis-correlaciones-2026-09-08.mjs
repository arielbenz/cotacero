import { readFileSync } from "node:fs";
const d = JSON.parse(readFileSync("datos-abiertos/curvas.json","utf8"));
const HOY = process.argv[2];
const M_LAT=110900, mLon=l=>111320*Math.cos((l*Math.PI)/180);
function distSeg(px,py,ax,ay,bx,by){const dx=bx-ax,dy=by-ay,l2=dx*dx+dy*dy;
  let t=l2?((px-ax)*dx+(py-ay)*dy)/l2:0;t=t<0?0:t>1?1:t;
  return Math.hypot(px-(ax+t*dx),py-(ay+t*dy));}
function local(lat,lon){
  if(lon<d.area[0]||lon>d.area[2]||lat<d.area[1]||lat>d.area[3])return null;
  const ml=mLon(lat),px=lon*ml,py=lat*M_LAT,c=new Map();
  for(const [z,p] of d.curvas){let m=Infinity;
    for(let i=0;i<p.length-2;i+=2){const q=distSeg(px,py,p[i]*ml,p[i+1]*M_LAT,p[i+2]*ml,p[i+3]*M_LAT);if(q<m)m=q;}
    if(!c.has(z)||m<c.get(z))c.set(z,m);}
  const o=[...c.entries()].sort((a,b)=>a[1]-b[1]);if(!o.length)return null;
  const [z1]=o[0];
  for(const [z2] of o.slice(1)) if(z2!==z1) return Math.abs(z2-z1);
  return null;}
const f=x=>(Math.round(x*100)/100).toFixed(2);

// 1. intervalo local en malla, comparado contra el 0,5 fijo de la app
const N=45,out=[];
for(let i=0;i<N;i++)for(let j=0;j<N;j++){
  const lat=d.area[1]+(d.area[3]-d.area[1])*(i+0.5)/N, lon=d.area[0]+(d.area[2]-d.area[0])*(j+0.5)/N;
  const r=local(lat,lon); if(r)out.push(r);}
console.log("  === intervalo local vs. el margen fijo de 0,50 m ===");
console.log("  intervalo local > 1,00 m (el doble del nominal): " + f(100*out.filter(x=>x>1).length/out.length) + "% del área");
console.log("  intervalo local > 2,00 m:                        " + f(100*out.filter(x=>x>2).length/out.length) + "% del área");
console.log("  intervalo local < 0,50 m:                        " + f(100*out.filter(x=>x<0.5).length/out.length) + "% del área");

// 2. los 16 puntos: intervalo local y correlación del residuo
const curvasJson=readFileSync("datos-abiertos/curvas.json","utf8");
globalThis.fetch=async u=>String(u).includes("curvas.json")?{ok:true,json:async()=>JSON.parse(curvasJson)}:{ok:false};
const {elevacionDe}=await import(process.cwd()+"/js/app/elevacion.js");
const pts=[];
for(const c of ["nivelacion_alta_precision","nivelacion_precision"]){
  const j=JSON.parse(readFileSync(`datos-crudos/ign-${c}-${HOY}.json`,"utf8"));
  for(const ft of j.features){const [lon,lat]=ft.geometry.coordinates;pts.push({...ft.properties,lat,lon});}}
const R=[];
for(const p of pts){const e=await elevacionDe(p.lat,p.lon);if(!e)continue;
  R.push({res:e.cota-p.cota, ign:p.cota, interp:e.cota, dist:e.distancia, int:local(p.lat,p.lon)});}
const cor=(a,b)=>{const n=a.length,ma=a.reduce((x,y)=>x+y)/n,mb=b.reduce((x,y)=>x+y)/n;
  const num=a.map((x,i)=>(x-ma)*(b[i]-mb)).reduce((x,y)=>x+y);
  return num/Math.sqrt(a.map(x=>(x-ma)**2).reduce((x,y)=>x+y)*b.map(x=>(x-mb)**2).reduce((x,y)=>x+y));};
console.log("\n  === los 16 puntos ===");
console.log("  intervalo local en esos 16: mediana " + f(R.map(r=>r.int).sort((a,b)=>a-b)[8]) + " m · máx " + f(Math.max(...R.map(r=>r.int))) + " m");
console.log("  distancia a la curva más cercana: mediana " + f(R.map(r=>r.dist).sort((a,b)=>a-b)[8]) + " m · máx " + f(Math.max(...R.map(r=>r.dist))) + " m");
console.log("  correlación residuo vs. cota IGN:      r = " + f(cor(R.map(r=>r.res),R.map(r=>r.ign))));
console.log("  correlación |residuo| vs. intervalo:   r = " + f(cor(R.map(r=>Math.abs(r.res)),R.map(r=>r.int))));
console.log("  correlación |residuo| vs. distancia:   r = " + f(cor(R.map(r=>Math.abs(r.res)),R.map(r=>r.dist))));
