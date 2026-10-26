/* 18 Birdies 2.0 enhancements — local-first, no paid API keys */
(()=>{
'use strict';
const by=id=>document.getElementById(id);
const store=(k,v)=>{try{localStorage.setItem(k,JSON.stringify(v));return true}catch{return false}};
const read=(k,def)=>{try{return JSON.parse(localStorage.getItem(k))??def}catch{return def}};
const courseKey=()=>courseId||'manual';
let hazardItems=[],hazardLayer=L.layerGroup().addTo(map),shotStart=null,shotLayer=L.layerGroup().addTo(map),lastHoleChange=0,nearCount=0,lastAccuracy=Infinity;
let shotLog=read('birdies-shots-v1',[]),rounds=read('birdies-rounds-v1',[]),extras=read('birdies-stats-v1',{});
const shotClubs=['Driver','3 Wood','5 Wood','Hybrid','3 Iron','4 Iron','5 Iron','6 Iron','7 Iron','8 Iron','9 Iron','Pitching Wedge','Gap Wedge','Sand Wedge','Lob Wedge','Putter'];
function node(tag,attrs={},txt){const n=document.createElement(tag);for(const [k,v] of Object.entries(attrs)){if(k==='className')n.className=v;else if(k==='type'||k==='id'||k==='title')n.setAttribute(k,v)}if(txt!==undefined)n.textContent=txt;return n}
function card(name){const s=node('section',{className:'card'});s.append(node('strong',{},name));by('status').before(s);return s}
function button(parent,id,label,func){const b=node('button',{id,className:'secondary'},label);b.style.margin='7px 5px 0 0';b.addEventListener('click',func);parent.append(b);return b}
function info(parent,id,txt){let p=node('p',{id,className:'note'},txt);parent.append(p);return p}
function field(parent,id,label,min,max){let row=node('label',{className:'note'},label+' ');const n=node('input',{id,type:'number'});n.min=min;n.max=max;n.style.cssText='width:72px;background:#091d12;color:white;border:1px solid #42664a;border-radius:7px;padding:7px;margin:5px';row.append(n);parent.append(row);return n}
const nav=card('🧭 Automatic hole detection & GPS quality');
const auto=node('input',{id:'autoHole',type:'checkbox'});auto.checked=read('birdies-auto-v1',false);auto.addEventListener('change',()=>store('birdies-auto-v1',auto.checked));
const autoLabel=node('label',{className:'note'},' Suggest next hole when near its mapped tee ');autoLabel.prepend(auto);nav.append(autoLabel);
info(nav,'quality','GPS accuracy: not available. Automatic changes require repeated nearby readings and good accuracy.');
const autoTip=info(nav,'autoTip','Automatic hole switching only happens when the next tee is mapped, you are within 45 meters, and GPS accuracy is 35 meters or better.');
const flyer=card('🛰️ Course flyover & hazards');
button(flyer,'flyover','Fly over this hole',()=>{
const h=state.holes[hole]||{},a=h.tee,b=h.center;
if(!a||!b){say('A mapped tee and green center are needed for flyover. Set both points on the map.');return}
map.flyTo([a.lat,a.lon],18,{duration:1.5});
setTimeout(()=>map.flyTo([b.lat,b.lon],18,{duration:3}),1700);
say('Animated map flyover. Satellite imagery can be selected using the Satellite button.');
});
button(flyer,'showHazards','Show mapped hazards',()=>{if(!hazardItems.length){say('No mapped hazards loaded. Select a course online first.');return}if(!hazardLayer.hasLayer(hazardItems[0].layer)){hazardItems.forEach(x=>hazardLayer.addLayer(x.layer));by('showHazards').textContent='Hide mapped hazards'}else{hazardLayer.clearLayers();by('showHazards').textContent='Show mapped hazards'}});
info(flyer,'hazardText','Hazard distances appear here when OpenStreetMap has water or bunker features near the selected course. Distances are approximate straight lines.');
const shots=card('🏌️ Shot distance & club tracking');
const club=node('select',{id:'club'});shotClubs.forEach(c=>club.add(new Option(c,c)));club.style.marginTop='10px';shots.append(club);
button(shots,'startShot','Mark shot start',()=>{if(!pos)return say('Start GPS before tracking shots.');if(lastAccuracy>50)return say('GPS accuracy is too low to mark a reliable shot.');shotStart={...pos,time:Date.now(),course:courseKey(),hole,club:club.value};shotLayer.clearLayers();L.circleMarker([pos.lat,pos.lon],{radius:7,color:'#f7df72'}).addTo(shotLayer);say('Shot start marked. Walk to the ball and tap Finish shot.')});
button(shots,'finishShot','Finish shot',()=>{if(!shotStart)return say('Mark shot start first.');if(!pos)return say('GPS unavailable.');if(lastAccuracy>50)return say('Wait for better GPS accuracy before finishing shot.');const yd=Math.round(meters(shotStart,pos)*1.093613);if(yd<1)return say('Move to the ball before finishing the shot.');const rec={...shotStart,end:{...pos},yards:yd,finished:new Date().toISOString()};shotLog.push(rec);store('birdies-shots-v1',shotLog);L.polyline([[shotStart.lat,shotStart.lon],[pos.lat,pos.lon]],{color:'#ffe278',weight:4}).addTo(shotLayer);shotStart=null;updateClubStats();say('Saved '+yd+' yard shot with '+rec.club+'. GPS estimates can differ from actual carry distance.')});
info(shots,'shotText','No shot in progress. Measure GPS start-to-finish distance; this is not ball carry distance.');
info(shots,'clubStats','No tracked club distances yet.');
function updateClubStats(){const group={};shotLog.filter(x=>x.course===courseKey()).forEach(x=>(group[x.club]??=[]).push(x.yards));const entries=Object.entries(group).map(([c,v])=>c+': '+Math.round(v.reduce((a,b)=>a+b,0)/v.length)+' yd avg ('+v.length+')');by('clubStats').textContent=entries.length?entries.join(' · '):'No tracked club distances for this course.'}
const scoreCard=card('📝 Detailed digital scorecard');
const par=field(scoreCard,'parValue','Par',3,6);
const putts=field(scoreCard,'puttsValue','Putts',0,10);
const fair=node('select',{id:'fairway'});['Not recorded','Hit','Missed','Not applicable'].forEach(x=>fair.add(new Option('Fairway: '+x,x)));scoreCard.append(fair);
const gir=node('select',{id:'gir'});['Not recorded','Yes','No'].forEach(x=>gir.add(new Option('Green in regulation: '+x,x)));scoreCard.append(gir);
button(scoreCard,'saveHoleStats','Save hole stats',()=>{const p=Number(par.value),pt=Number(putts.value);if(!Number.isInteger(p)||p<3||p>6||!Number.isInteger(pt)||pt<0||pt>10)return say('Enter valid par (3–6) and putts (0–10).');const k=courseKey();extras[k]??={};extras[k][hole]={par:p,putts:pt,fairway:fair.value,gir:gir.value};store('birdies-stats-v1',extras);say('Saved detailed scorecard stats for hole '+hole)});
info(scoreCard,'scoreSummary','Detailed scorecard data stays on this device.');
const roundCard=card('📊 Round history & exports');
button(roundCard,'finishRound','Save completed round',()=>{if(!courseId)return say('Choose a course before saving a round.');const count=Object.keys(state.scores).filter(k=>Number(state.scores[k])>0).length;if(!count)return say('Record a score before saving a round.');const total=Object.values(state.scores).reduce((a,b)=>a+Number(b||0),0);rounds.unshift({id:Date.now(),date:new Date().toISOString(),course:by('courseTitle').textContent,courseId,total,holes:count,scores:{...state.scores},stats:structuredClone(extras[courseKey()]||{})});store('birdies-rounds-v1',rounds);updateRounds();say('Round saved to this browser. Your current scorecard remains available.')});
button(roundCard,'exportRounds','Export my rounds (JSON)',()=>{const blob=new Blob([JSON.stringify({rounds,shots:shotLog,courseStats:extras},null,2)],{type:'application/json'});const link=document.createElement('a');link.href=URL.createObjectURL(blob);link.download='18-birdies-2-0-backup.json';link.click();setTimeout(()=>URL.revokeObjectURL(link.href),1000)});
const hist=info(roundCard,'rounds','No saved rounds yet.');
function updateRounds(){hist.replaceChildren();if(!rounds.length){hist.textContent='No saved rounds yet.';return}rounds.slice(0,12).forEach(x=>hist.append(node('div',{},new Date(x.date).toLocaleDateString()+' · '+x.course+' · '+x.total+' strokes over '+x.holes+' scored holes')))}
const offline=card('📥 Offline course information');
button(offline,'saveOffline','Save course details offline',()=>{if(!courseId)return say('Select a course before saving.');const data={id:courseId,name:by('courseTitle').textContent,center:courseCenter,holes:state.holes,hazards:hazardItems.map(x=>({type:x.type,position:x.position}))};const list=read('birdies-offline-v1',{});list[courseId]=data;store('birdies-offline-v1',list);refreshOffline();say('Saved hole points and mapped hazards for offline use. Satellite imagery and GPS course search still need internet.')});
const offlineSelect=node('select',{id:'offlineCourses'});offline.append(offlineSelect);
button(offline,'loadOffline','Load saved course',()=>{const d=read('birdies-offline-v1',{})[offlineSelect.value];if(!d)return say('No saved course selected.');courseId=d.id;courseCenter=d.center;state=storage();state.holes={...d.holes,...state.holes};save();by('courseTitle').textContent=d.name;hole=1;hazardItems=[];hazardLayer.clearLayers();(d.hazards||[]).forEach(x=>addHazard(x.type,x.position));render();fitHole();updateClubStats();say('Loaded saved course coordinates. Background map tiles may not be available offline.')});
info(offline,'offlineInfo','Offline mode retains saved coordinates and score data. Full offline satellite imagery is not provided.');
function refreshOffline(){offlineSelect.replaceChildren();const saved=read('birdies-offline-v1',{});Object.values(saved).forEach(x=>offlineSelect.add(new Option(x.name,x.id)));if(!offlineSelect.options.length)offlineSelect.add(new Option('No offline courses saved',''))}
if('serviceWorker' in navigator)navigator.serviceWorker.register('./sw.js',{scope:'./'}).catch(()=>{});
function addHazard(type,where){if(!where||!Number.isFinite(where.lat)||!Number.isFinite(where.lon))return;const layer=L.circleMarker([where.lat,where.lon],{radius:7,weight:2,color:type==='bunker'?'#e9c56c':'#68ccff',fillOpacity:.7}).bindPopup(type);hazardItems.push({type,position:where,layer});hazardLayer.addLayer(layer)}
window.featureCourseLoaded=elements=>{
hazardItems=[];hazardLayer.clearLayers();
(elements||[]).filter(x=>['bunker','water_hazard','lateral_water_hazard'].includes(x.tags?.golf)||x.tags?.natural==='water').slice(0,100).forEach(x=>addHazard(x.tags?.golf||'water',coord(x)));
featureRender();refreshOffline();
};
window.featureRender=()=>{
const d=extras[courseKey()]?.[hole]||{};par.value=d.par??'';putts.value=d.putts??'';fair.value=d.fairway||'Not recorded';gir.value=d.gir||'Not recorded';
const closest=hazardItems.filter(x=>pos&&meters(pos,x.position)<900).map(x=>({name:x.type,d:Math.round(meters(pos,x.position)*1.093613)})).sort((a,b)=>a.d-b.d).slice(0,4);
by('hazardText').textContent=closest.length?'Nearest mapped hazards (approx): '+closest.map(x=>x.name+' '+x.d+' yd').join(' · '):'No nearby mapped hazards or GPS unavailable. Mapped points are approximate.';
by('shotText').textContent=shotStart?'Tracking '+shotStart.club+' shot from hole '+shotStart.hole+'. Finish at the ball.':'No shot in progress.';
};
window.featureGps=p=>{
lastAccuracy=p.coords.accuracy;
by('quality').textContent='GPS accuracy: ±'+Math.round(lastAccuracy)+' meters — '+(lastAccuracy<=10?'excellent':lastAccuracy<=25?'good':lastAccuracy<=50?'fair':'poor')+'. '+(lastAccuracy>35?'Automatic hole switching paused.':'');
if(!auto.checked||lastAccuracy>35||hole>=18){nearCount=0;return}
const next=state.holes[hole+1]?.tee;
if(!next){nearCount=0;return}
if(meters(pos,next)<=45){nearCount++;if(nearCount>=3&&Date.now()-lastHoleChange>25000){lastHoleChange=Date.now();nearCount=0;setHole(hole+1);say('Detected next tee nearby — switched to hole '+hole+'. Verify the hole shown.')}}else nearCount=0;
};
window.featureHoleChanged=()=>{nearCount=0;featureRender()};
window.featureCourseSelected=()=>{shotStart=null;shotLayer.clearLayers();hazardItems=[];hazardLayer.clearLayers();updateClubStats();featureRender()};
updateClubStats();updateRounds();refreshOffline();featureRender();
})();
