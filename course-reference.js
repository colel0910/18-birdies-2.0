/* Kresson Golf Course scorecard. User-provided reference screenshots.
   This is scorecard data, not GPS coordinates or Google imagery. */
(()=>{
'use strict';
const holes=[
[4,253,13],[4,300,1],[5,480,5],[3,105,17],[3,122,15],[3,210,11],
[5,500,9],[4,250,3],[5,485,7],[3,120,18],[4,260,2],[4,360,6],
[3,175,14],[3,160,16],[4,220,4],[4,340,8],[3,160,12],[4,300,10]
].map(([par,white,handicap],i)=>({hole:i+1,par,white,handicap}));
const isKresson=()=>courseId==='way-30032040'||/kresson/i.test(document.getElementById('courseTitle')?.textContent||'');
const get=id=>document.getElementById(id);
window.renderCourseReference=function(){
 const section=get('referenceCard'),title=get('referenceHeading'),detail=get('referenceDetail'),body=get('referenceRows');
 if(!section)return;
 if(!isKresson()){section.hidden=true;return}
 section.hidden=false;
 title.textContent='Kresson Golf Course · White tees';
 const entry=holes[hole-1];
 detail.textContent='Hole '+hole+'  •  Par '+entry.par+'  •  '+entry.white+' yd (scorecard)  •  HCP '+entry.handicap;
 body.replaceChildren();
 for(const h of holes){
  const b=document.createElement('button');b.type='button';b.className='reference-hole'+(h.hole===hole?' ref-active':'');
  b.textContent=h.hole+' · '+h.white+'y · P'+h.par;
  b.title='Hole '+h.hole+', Par '+h.par+', Handicap '+h.handicap;
  b.onclick=()=>setHole(h.hole);body.append(b)
 }
 // Prefill par only when the user hasn't already saved a value.
 if(window.courseReferencePrefill && typeof courseId==='string')window.courseReferencePrefill(holes);
};
window.kressonScorecard=holes;
window.renderCourseReference();
})();