/* Kresson satellite-target tools. Coordinates remain user supplied or legally mapped only. */
(()=>{
'use strict';
const $=id=>document.getElementById(id);
const box=document.createElement('section');box.className='card';box.id='rangefinderCard';
box.innerHTML='<strong>🎯 Satellite rangefinder</strong><p class="note">Tap any place on the course map to move your target. Distances use your live GPS location, when enabled, and the saved green marker. This does not import 18Birdies private coordinates.</p><div class="yardgrid"><div><label>GPS → TARGET</label><strong id="targetFromMe">—</strong></div><div><label>TARGET → GREEN</label><strong id="targetToGreen">—</strong></div><div><label>TEE → GREEN</label><strong id="targetTeeGreen">—</strong></div></div><div class="buttons"><button id="showKressonSat" type="button">🛰 Satellite view</button><button id="clearTarget" type="button" class="secondary">Clear target</button></div><p class="note" id="targetHelp">Select Kresson Golf Course. Tap the aerial map to measure a landing point.</p><a href="https://18birdies.com/golf-courses/club/9843baf0-86ac-11e4-8c28-020000005b00/kresson-golf-course" target="_blank" rel="noopener noreferrer" style="display:block;color:#d4fbaa;font-size:12px;margin-top:10px">View Kresson scorecard on 18Birdies ↗</a>';
const ref=$('referenceCard');if(ref)ref.after(box);else $('status').before(box);
let target=null,icon=null,line=null;
function isKresson(){return courseId==='way-30032040'||/kresson/i.test($('courseTitle')?.textContent||'')}
function centerCourse(){if(!isKresson())return;const p=courseCenter||{lat:39.84774,lon:-74.93165};map.setView([p.lat,p.lon],17);if(!sat)$('sat').click()}
$('showKressonSat').onclick=()=>{if(isKresson())centerCourse();else if(!sat)$('sat').click()};
$('clearTarget').onclick=()=>{target=null;redraw()};
function fmt(a,b){return a&&b?Math.round(meters(a,b)*1.093613).toLocaleString():'—'}
function redraw(){
 if(line){map.removeLayer(line);line=null}
 if(icon){map.removeLayer(icon);icon=null}
 const h=state.holes?.[hole]||{};
 const green=h.center,tee=h.tee;
 $('targetFromMe').textContent=fmt(pos,target);
 $('targetToGreen').textContent=fmt(target,green);
 $('targetTeeGreen').textContent=fmt(tee,green);
 $('targetHelp').textContent=target?'Target marked. '+(pos?'Distance from GPS available. ':'Enable GPS for distance from you. ')+(green?'Remaining distance to green shown.':'Add a green marker for remaining distance.'):'Tap the map to set a movable target. Green distances require a mapped green.';
 if(!target)return;
 icon=L.circleMarker([target.lat,target.lon],{radius:12,weight:3,color:'#fff',fillColor:'#eaff9a',fillOpacity:.3}).addTo(map).bindTooltip('Target',{permanent:false});
 if(green)line=L.polyline([[target.lat,target.lon],[green.lat,green.lon]],{color:'#fdfcec',weight:3,dashArray:'7 5'}).addTo(map);
 else if(pos)line=L.polyline([[pos.lat,pos.lon],[target.lat,target.lon]],{color:'#fdfcec',weight:3,dashArray:'7 5'}).addTo(map);
}
map.on('click',e=>{if(mode)return;target={lat:e.latlng.lat,lon:e.latlng.lng};redraw()});
const previousRender=window.renderCourseReference;
window.renderCourseReference=function(){previousRender?.();redraw()};
const previousCourse=window.featureCourseSelected;
window.featureCourseSelected=function(){previousCourse?.();target=null;redraw()};
window.focusKressonSatellite=centerCourse;
redraw();
})();