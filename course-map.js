/* Course-map engine: draws every available mapped hole, never fabricates a green coordinate. */
(function(){
'use strict';
const track=L.layerGroup().addTo(map);
const pinLayer=L.layerGroup().addTo(map);
let mapped={};
const $=id=>document.getElementById(id);
const valid=n=>Number.isInteger(n)&&n>=1&&n<=18;
function hnum(tags={}){let s=String(tags.ref||tags.hole||tags['golf:hole']||'');let n=Number(s.split(/[;,]/)[0]);return valid(n)?n:null}
function pt(p){return p?{lat:+p.lat,lon:+(p.lon??p.lng)}:null}
function distance(a,b){return a&&b?meters(a,b):Infinity}
function getcenter(e){return coord(e)}
function allPoints(e){return Array.isArray(e.geometry)?e.geometry.map(pt).filter(Boolean):[]}
function nearest(array,p,max){
 let win=null,best=max;
 for(const e of array){const c=getcenter(e);const d=distance(c,p);if(d<best){best=d;win=e}}
 return win
}
function color(n){return mapped[n]?.confirmed?'#c7ff65':mapped[n]?.route?'#f4d27b':'#e9f1eb'}
window.drawCurrentHoleRoute=function(){
 track.eachLayer(layer=>{
   if(layer.setStyle && layer.options?.className==='current-hole-track')layer.setStyle({color:'#e9fb9b',weight:7,opacity:.95});
 });
 updateHoleStrip();
};
function updateHoleStrip(){
 const strip=$('holeStrip'),grid=$('allHoles');
 if(!strip||!grid)return;
 for(const el of [strip,grid])el.replaceChildren();
 for(let n=1;n<=18;n++){
   const details=mapped[n]||{};
   const saved=state.holes[n]||{};
   const complete=!!saved.tee&&!!saved.center;
   const active=n===hole;
   const make=(compact)=>{
     let b=document.createElement('button');b.type='button';b.className='hole-chip'+(active?' chosen':'')+(complete?' mapped':details.route?' partial':'');
     b.innerHTML='<span class="hole-chip-num">'+n+'</span><small>'+(complete?'● mapped':details.route?'◐ route':'○ add')+'</small>';
     b.title='Hole '+n+(complete?' · tee and green loaded':details.route?' · hole route only':' · unmapped');
     b.onclick=()=>setHole(n);
     if(active)b.setAttribute('aria-current','true');
     return b;
   };
   strip.append(make(true));grid.append(make(false));
 }
 const count=Array.from({length:18},(_,i)=>state.holes[i+1]||{}).filter(h=>h.tee&&h.center).length;
 $('coverage').textContent=count+'/18 tee + green mapped';
 $('coverage').title='Counts holes with both tee and green coordinate. Not official survey data.';
 const current=mapped[hole], saved=state.holes[hole]||{};
 $('holeData').textContent=saved.tee&&saved.center?'Tee and green available · verify on satellite':current?.route?'Mapped fairway route · green location needed':'No verified hole geometry · tap Set tee / green';
}
window.updateHoleStrip=updateHoleStrip;
window.loadMappedCourse=function(elements){
 track.clearLayers();pinLayer.clearLayers();mapped={};
 const routes=(elements||[]).filter(e=>e.tags?.golf==='hole');
 const greens=(elements||[]).filter(e=>e.tags?.golf==='green');
 const tees=(elements||[]).filter(e=>e.tags?.golf==='tee');
 // First accept numbered green or tee only where the number explicitly exists.
 for(const e of [...greens,...tees]){
   const n=hnum(e.tags),p=getcenter(e);
   if(!n||!p)continue;
   const obj=state.holes[n]||(state.holes[n]={});
   const key=e.tags.golf==='green'?'center':'tee';
   if(!obj[key])obj[key]=p;
 }
 for(const e of routes){
   const n=hnum(e.tags), points=allPoints(e);
   if(!n||points.length<2)continue;
   const first=points[0],last=points[points.length-1];
   const obj=state.holes[n]||(state.holes[n]={});
   // Hole geometry connects tee toward green, but endpoints aren't assumed surveyed markers.
   let tee=nearest(tees,first,65),green=nearest(greens,last,75);
   if(tee&&!obj.tee)obj.tee=getcenter(tee);
   if(green&&!obj.center)obj.center=getcenter(green);
   // Unmapped tees and greens deliberately remain blank.
   const shape=L.polyline(points.map(p=>[p.lat,p.lon]),{color:'#d1f87c',weight:5,opacity:.8});
   shape.addTo(track);
   shape.bindTooltip('Hole '+n,{sticky:true});
   shape.on('click',()=>setHole(n));
   mapped[n]={route:true,confirmed:!!obj.tee&&!!obj.center};
 }
 for(let n=1;n<=18;n++){
   const obj=state.holes[n];
   if(!obj)continue;
   if(obj.tee){
     const icon=L.divIcon({className:'course-tee-icon',html:'<span>T'+n+'</span>',iconSize:[32,32],iconAnchor:[16,16]});
     L.marker([obj.tee.lat,obj.tee.lon],{icon}).addTo(pinLayer).bindPopup('Hole '+n+' tee').on('click',()=>setHole(n));
   }
   if(obj.center){
     const icon=L.divIcon({className:'course-green-icon',html:'<span>⚑'+n+'</span>',iconSize:[36,36],iconAnchor:[18,18]});
     L.marker([obj.center.lat,obj.center.lon],{icon}).addTo(pinLayer).bindPopup('Hole '+n+' green').on('click',()=>setHole(n));
   }
 }
 save();render();updateHoleStrip();mappingInstruction();
 return Array.from({length:18},(_,i)=>state.holes[i+1]||{}).filter(h=>h.tee&&h.center).length;
};

let mappingWizard=false;
function nextIncomplete(){
 for(let n=1;n<=18;n++){const d=state.holes[n]||{};if(!d.tee||!d.center)return {n,key:!d.tee?'tee':'center'}}
 return null;
}
function mappingInstruction(){
 const g=$('mappingGuide');if(!g)return;
 const missing=nextIncomplete();
 if(!missing){mappingWizard=false;mode='';g.textContent='All 18 holes have tee and green coordinates saved. Review their locations against the actual course before playing.';return}
 if(!mappingWizard){g.textContent='Select Map missing holes to add tee boxes and green centers one at a time.';return}
 hole=missing.n;mode=missing.key;render();fitHole();
 g.textContent='Hole '+hole+': tap the real '+(mode==='tee'?'TEE BOX':'GREEN CENTER')+' on the satellite map. Next missing location will be selected automatically.';
 say('Mapping hole '+hole+' '+mode+'. Tap its exact position on the map.');
}
window.advanceMappingWizard=function(savedMode){if(!mappingWizard)return;mappingInstruction()};
$('mapAllHoles').addEventListener('click',()=>{
 if(!courseId){say('Select a real golf course first.');return}
 mappingWizard=true;
 if(!sat)$('sat').click();
 mappingInstruction();
});
$('overview18').addEventListener('click',()=>{
 const pts=[];
 for(let n=1;n<=18;n++){const h=state.holes[n]||{};for(const k of ['tee','center'])if(h[k])pts.push([h[k].lat,h[k].lon])}
 if(pts.length>1)map.fitBounds(L.latLngBounds(pts).pad(.12),{maxZoom:17});
 else if(courseCenter)map.setView([courseCenter.lat,courseCenter.lon],15);
 else say('Select a course first.');
});
window.resetHoleLayers=function(){mappingWizard=false;track.clearLayers();pinLayer.clearLayers();mapped={};updateHoleStrip();mappingInstruction()};
window.addEventListener('load',()=>{updateHoleStrip()});
})();