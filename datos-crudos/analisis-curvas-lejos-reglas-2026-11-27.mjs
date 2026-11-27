// node datos-crudos/analisis-curvas-lejos-reglas-2026-11-27.mjs
//
// Qué regla arregla el error de las curvas lejos de una curva y en terreno
// bajo (AUDITORIA.md §4). Dos partes:
//
//   A. Reglas que sólo miran las curvas: un tope de distancia, y detectar si
//      el punto queda ENTRE las dos curvas más cercanas o del mismo lado de
//      las dos («afuera»), y de cuál. Para cada una: cuántos puntos saca,
//      cuántos de los malos (curvas más de 1 m arriba del punto) y cuánta
//      superficie de las vecinales deja sin altura.
//   B. Usar los puntos con cota donde la curva queda lejos. Cada punto se
//      estima con sus cuatro vecinos SIN usarlo a él (la cuenta de
//      conPuntos(): inversa del cuadrado, hasta 150 m). «Optimista pasado el
//      margen» es más de 0,5 m arriba si contestan las curvas y más de 1,0 si
//      contestan los puntos.
//
// Ojo con B: la referencia son los mismos puntos, así que favorece a los
// puntos. Sirve para comparar reglas, no para decir que los puntos son
// mejores que las curvas en general.
//
// La geometría de entreCurvas() está copiada acá porque hace falta el punto
// más cercano de cada curva, que la de producción no devuelve.
import { readFileSync } from "node:fs";
const C = JSON.parse(readFileSync("public/datos-abiertos/curvas.json","utf8"));
const [o,s,e,n]=C.area;
const ML=110900, ml=(lat)=>111320*Math.cos(lat*Math.PI/180);
function cerca(px,py,ax,ay,bx,by){const dx=bx-ax,dy=by-ay,l2=dx*dx+dy*dy;let t=l2?((px-ax)*dx+(py-ay)*dy)/l2:0;t=t<0?0:t>1?1:t;const qx=ax+t*dx,qy=ay+t*dy;return [Math.hypot(px-qx,py-qy),qx,qy];}
function clasificar(lat,lon){const m=ml(lat),px=lon*m,py=lat*ML;const best=new Map();
 for(const [z,p] of C.curvas){for(let i=0;i<p.length-2;i+=2){const r=cerca(px,py,p[i]*m,p[i+1]*ML,p[i+2]*m,p[i+3]*ML);const b=best.get(z);if(!b||r[0]<b[0])best.set(z,r);}}
 const o=[...best.entries()].sort((a,b)=>a[1][0]-b[1][0]);const [z1,[d1,x1,y1]]=o[0];const [z2,[d2,x2,y2]]=o[1];
 const cos=d1<0.01||d2<0.01?-1:((x1-px)*(x2-px)+(y1-py)*(y2-py))/(d1*d2);
 const t=d1/(d1+d2);return {cota:z1+(z2-z1)*t,d1,d2,z1,z2,cos};}
const V = JSON.parse(readFileSync("datos-crudos/muni-vecinales-2026-09-08.json","utf8"));const anillos=[];for(const f of V.features)for(const p of f.geometry.coordinates)anillos.push(p[0]);
const enA=(r,x,y)=>{let d=false;for(let i=0,j=r.length-1;i<r.length;j=i++){const [xi,yi]=r[i],[xj,yj]=r[j];if((yi>y)!==(yj>y)&&x<(xj-xi)*(y-yi)/(yj-yi)+xi)d=!d;}return d;};
const enCiudad=(lon,lat)=>anillos.some(r=>enA(r,lon,lat));

console.log("A. Reglas que sólo miran las curvas");
{
const zmin=Math.min(...C.curvas.map(c=>c[0]));
const P = JSON.parse(readFileSync("datos-crudos/idesf-MACotas-2026-10-22.json","utf8")).map(p=>({lon:p.lon,lat:p.lat,z:+p.z})).filter(p=>p.z>1&&p.lon>=o&&p.lon<=e&&p.lat>=s&&p.lat<=n);
const R=P.map(p=>{const c=clasificar(p.lat,p.lon);return {...c,e:c.cota-p.z,ciu:enCiudad(p.lon,p.lat)}});
const G=[];for(let la=s;la<=n;la+=150/110900)for(let lo=o;lo<=e;lo+=150/94700){if(!enCiudad(lo,la))continue;G.push(clasificar(la,lo));}
const reglas={
 "sin regla":()=>false,
 "tope 400 m":x=>x.d1>400,
 "lado bajo y >150 m":x=>x.cos>0&&x.z1<x.z2&&x.d1>150,
 "lado bajo y >400 m":x=>x.cos>0&&x.z1<x.z2&&x.d1>400,
 "lado bajo, z1≤13,5":x=>x.cos>0&&x.z1<x.z2&&x.z1<=13.5,
 "lado bajo, z1≤13,5 y >50 m":x=>x.cos>0&&x.z1<x.z2&&x.z1<=13.5&&x.d1>50,
 "lado bajo, z1≤13 ":x=>x.cos>0&&x.z1<x.z2&&x.z1<=13,
 "z1 es 12,5 y afuera":x=>x.cos>0&&x.z1===zmin,
 "afuera (cualquier lado) y >400":x=>x.cos>0&&x.d1>400,
 "afuera (cualquier lado) y >150":x=>x.cos>0&&x.d1>150,
};
console.log("regla".padEnd(34),"quita".padStart(6),"malos quitados".padStart(15),"buenos quitados".padStart(16),"malos que quedan".padStart(17),"ciudad: malos quedan".padStart(21),"% ciudad sin altura".padStart(20));
const malo=x=>x.e>1;
for(const [k,f] of Object.entries(reglas)){const q=R.filter(f);const queda=R.filter(x=>!f(x));console.log(k.padEnd(34),String(q.length).padStart(6),String(q.filter(malo).length).padStart(15),String(q.filter(x=>x.e<=0.5).length).padStart(16),String(queda.filter(malo).length).padStart(17),String(queda.filter(x=>malo(x)&&x.ciu).length).padStart(21),(G.filter(f).length/G.length*100).toFixed(1).padStart(19)+" %");}
console.log("puntos",R.length,"en ciudad",R.filter(x=>x.ciu).length,"malos en ciudad",R.filter(x=>malo(x)&&x.ciu).length,"celdas ciudad",G.length);
// los malos de la ciudad: perfil
const mc=R.filter(x=>malo(x)&&x.ciu);const h=(f)=>mc.filter(f).length;
console.log("malos en ciudad: entre curvas",h(x=>x.cos<=0),"| lado bajo",h(x=>x.cos>0&&x.z1<x.z2),"| lado alto",h(x=>x.cos>0&&x.z1>x.z2),"| d1>400:",h(x=>x.d1>400),"| d1<50:",h(x=>x.d1<50));

}
console.log("\nB. Usar los puntos con cota donde la curva queda lejos");
{
const T = JSON.parse(readFileSync("datos-crudos/idesf-MACotas-2026-10-22.json","utf8")).map(p=>({lon:p.lon,lat:p.lat,z:+p.z})).filter(p=>p.z>1);
const P = T.filter(p=>p.lon>=o&&p.lon<=e&&p.lat>=s&&p.lat<=n);
// IDW4 dejando afuera el propio punto, tope 150 m (como conPuntos)
function idw(p){const ml=111320*Math.cos(p.lat*Math.PI/180);const c=[];for(const q of T){if(q===p)continue;const d=Math.hypot((q.lon-p.lon)*ml,(q.lat-p.lat)*110900);if(d<=150)c.push([d,q.z]);}if(!c.length)return null;c.sort((a,b)=>a[0]-b[0]);const k=c.slice(0,4);if(k[0][0]<0.5)return k[0][1];let a=0,b=0;for(const [d,z] of k){a+=z/d**2;b+=1/d**2;}return a/b;}
const R=P.map(p=>{const c=clasificar(p.lat,p.lon);const pt=idw(p);return {d1:c.d1,ec:c.cota-p.z,ep:pt==null?null:pt-p.z,ciu:enCiudad(p.lon,p.lat),z:p.z}});
// "optimista después del margen": curvas: e>0,5 ; puntos: e>1,0
const fila=(nom,v,f)=>{const m=v.map(f).filter(x=>x!=null);const sinDato=v.length-m.length;const tarde=m.filter(x=>x.tarde).length, tarde1=m.filter(x=>x.tarde1).length;console.log(`  ${nom.padEnd(40)} n=${String(v.length).padStart(5)}  sin altura ${String(sinDato).padStart(4)}  optimista pasado el margen ${String(tarde).padStart(4)} (${(tarde/m.length*100).toFixed(1)} %)  por más de 1 m pasado el margen ${String(tarde1).padStart(4)}`);};
const curvas=x=>({tarde:x.ec>0.5,tarde1:x.ec>1.5});
const puntos=x=>x.ep==null?null:({tarde:x.ep>1.0,tarde1:x.ep>2.0});
for(const [nom,sub] of [["TODOS",R],["en la ciudad",R.filter(x=>x.ciu)],["fuera de las vecinales",R.filter(x=>!x.ciu)],["terreno real < 13 m",R.filter(x=>x.z<13)]]){console.log(nom);
 fila("hoy: siempre curvas",sub,curvas);
 for(const D of [150,250,400]) fila(`(a) curva a más de ${D} m → puntos`,sub,x=>x.d1>D?(puntos(x)??curvas(x)):curvas(x));
 fila("(a) con 400 m, y sin puntos: sin altura",sub,x=>x.d1>400?puntos(x):curvas(x));
 fila("siempre puntos si hay",sub,x=>puntos(x)??curvas(x));
 fila("el más bajo de los dos (su margen)",sub,x=>x.ep==null?curvas(x):((x.ep-1.0)<(x.ec-0.5)?puntos(x):curvas(x)));
}
const lej=R.filter(x=>x.d1>400);console.log("a >400 m:",lej.length,"con vecinos a <150 m:",lej.filter(x=>x.ep!=null).length);

}
