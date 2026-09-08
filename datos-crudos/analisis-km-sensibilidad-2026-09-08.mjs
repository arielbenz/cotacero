import { readFileSync } from "node:fs";
const HOY=process.argv[2], TOL=+process.argv[3], POLIG=process.argv[4]==="si";
const M_LAT=110900, mLon=l=>111320*Math.cos((l*Math.PI)/180);
const xy=([lo,la])=>[lo*mLon(la),la*M_LAT], dd=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]);
const nodos=[],celda=new Map(); const ck=p=>(p[0]/TOL|0)+"|"+(p[1]/TOL|0);
function nodo(p){for(let i=-1;i<=1;i++)for(let j=-1;j<=1;j++){const l=celda.get(((p[0]/TOL|0)+i)+"|"+((p[1]/TOL|0)+j));
  if(l)for(const n of l)if(dd(nodos[n],p)<=TOL)return n;}
  const n=nodos.length;nodos.push(p);const k=ck(p);if(!celda.has(k))celda.set(k,[]);celda.get(k).push(n);return n;}
const ady=new Map(); const ar=(a,b,d)=>{if(a===b)return;if(!ady.has(a))ady.set(a,[]);if(!ady.has(b))ady.set(b,[]);ady.get(a).push([b,d]);ady.get(b).push([a,d]);};
const traer=(f,an)=>{let j;try{j=JSON.parse(readFileSync(f,"utf8"))}catch{return}
  for(const ft of j.features){const g=ft.geometry;if(!g)continue;let t=[];
   if(g.type==="LineString")t=[g.coordinates];else if(g.type==="MultiLineString")t=g.coordinates;
   else if(an&&g.type==="Polygon")t=g.coordinates;else if(an&&g.type==="MultiPolygon")t=g.coordinates.flat();
   for(const tr of t){let pr=null;for(const c of tr){const p=xy(c),n=nodo(p);if(pr!==null&&pr!==n)ar(pr,n,dd(nodos[pr],p));pr=n;}}}};
for(const c of ["lineas_de_aguas_continentales_perenne","lineas_de_aguas_continentales_intermitentes","lineas_de_aguas_continentales_BH020"])
  traer(`datos-crudos/ign-${c}-w-${HOY}.json`,false);
if(POLIG) traer(`datos-crudos/ign-areas_de_aguas_continentales_perenne-w-${HOY}.json`,true);
const cerc=(la,lo)=>{const p=xy([lo,la]);let mi=-1,md=Infinity;for(let i=0;i<nodos.length;i++){const d=dd(nodos[i],p);if(d<md){md=d;mi=i}}return mi;};
function dij(s){const D=new Float64Array(nodos.length).fill(Infinity);D[s]=0;const h=[[0,s]];
 const pu=x=>{h.push(x);let i=h.length-1;while(i>0){const p=(i-1)>>1;if(h[p][0]<=h[i][0])break;[h[p],h[i]]=[h[i],h[p]];i=p}};
 const po=()=>{const t=h[0],u=h.pop();if(h.length){h[0]=u;let i=0;for(;;){const l=2*i+1,r=l+1;let m=i;
  if(l<h.length&&h[l][0]<h[m][0])m=l;if(r<h.length&&h[r][0]<h[m][0])m=r;if(m===i)break;[h[m],h[i]]=[h[i],h[m]];i=m}}return t};
 const v=new Uint8Array(nodos.length);while(h.length){const[d,u]=po();if(v[u])continue;v[u]=1;
  for(const[b,w] of ady.get(u)||[])if(d+w<D[b]){D[b]=d+w;pu([D[b],b])}}return D;}
const D=dij(cerc(-31.6514772196376,-60.7002319185745));
const Z=[["Alto Verde",2,-31.66521436,-60.70076676],["Guadalupe",4,-31.60310257,-60.68367933],
 ["La Guardia",7,-31.64234205,-60.63433982],["Colastiné N",11,-31.62364809,-60.60814703],
 ["Rincón",16,-31.60651,-60.56744],["Arroyo Leyes",24,-31.55873,-60.51751],["Calchines",40,-31.42039,-60.33268]];
const r=Z.map(([n,km,la,lo])=>{const d=D[cerc(la,lo)];return isFinite(d)?(d/1000).toFixed(1):"—"});
const leyes=D[cerc(-31.55873,-60.51751)];
console.log("  TOL="+String(TOL).padStart(4)+"  polígonos="+(POLIG?"sí":"no ")+"  nodos="+String(nodos.length).padStart(6)+
  "  conectadas="+r.filter(x=>x!=="—").length+"/7  Leyes="+(isFinite(leyes)?(leyes/1000).toFixed(1)+" km":"s/red")+
  "   ["+r.join(" ")+"]");
