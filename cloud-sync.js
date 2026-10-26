/* Private cloud backup for golf course markers and scorecards.
   Supabase publishable key is safe for client-side use; never use secret keys here. */
(()=>{
'use strict';
const url='https://fyzixumgclwohjllqefs.supabase.co';
const publishable='sb_publishable_iOzmMUp_JKoqmCv93_wlQw_raDs4Uje';
const $=id=>document.getElementById(id);
const status=msg=>{$('cloudStatus').textContent=msg};
const card=document.createElement('section');card.className='card';card.id='cloudPanel';
card.innerHTML='<strong>☁️ Cloud saving</strong><p class="note">Sign in to sync mapped tees, greens and hole scores between your devices. Local copies stay saved on this device.</p><div id="cloudAuth"><label class="small" for="cloudEmail">Email</label><input id="cloudEmail" type="email" autocomplete="email" placeholder="Email address" style="width:100%;padding:11px;background:#081e12;color:white;border:1px solid #567052;border-radius:9px;margin:6px 0 10px"><label class="small" for="cloudPassword">Password</label><input id="cloudPassword" type="password" autocomplete="current-password" placeholder="Password (minimum 6 characters)" style="width:100%;padding:11px;background:#081e12;color:white;border:1px solid #567052;border-radius:9px;margin:6px 0 10px"><div class="buttons"><button id="cloudLogin" type="button">Sign in</button><button id="cloudSignup" class="secondary" type="button">Create account</button></div></div><div id="cloudConnected" style="display:none"><p class="note" id="cloudAccount"></p><div class="buttons"><button id="cloudSync" type="button">Sync now</button><button class="secondary" id="cloudLogout" type="button">Sign out</button></div></div><p id="cloudStatus" class="status" role="status">Checking cloud connection…</p><p class="note">Cloud sync requires one-time Supabase table setup. No golf location data is sent until you sign in. Sign-in is separate from GitHub.</p>';
$('status').before(card);
let client=null,user=null,ready=false,queued=null,busy=false,repeat=false,booting=false;
const keys=()=>Object.keys(localStorage).filter(k=>k.startsWith('golfgps-v1-')&&k!=='golfgps-v1-manual');
const localData=k=>{try{return JSON.parse(localStorage.getItem(k))}catch{return null}};
const normalize=v=>{
 const holes={},scores={};
 for(const [n,h] of Object.entries(v?.holes||{})){if(!/^([1-9]|1[0-8])$/.test(n)||!h||typeof h!=='object')continue;
   const dest={};
   for(const prop of ['tee','front','center','back']){
    const p=h[prop];if(p&&Number.isFinite(+p.lat)&&Number.isFinite(+p.lon)&&Math.abs(+p.lat)<=90&&Math.abs(+p.lon)<=180)dest[prop]={lat:+p.lat,lon:+p.lon};
   }
   holes[n]=dest;
 }
 for(const [n,vv] of Object.entries(v?.scores||{}))if(/^([1-9]|1[0-8])$/.test(n)&&Number.isFinite(Number(vv)))scores[n]=Math.max(0,Math.min(30,Number(vv)));
 return {holes,scores};
};
function merge(remote,local){
 const a=normalize(local),b=normalize(remote),holes={...a.holes},scores={...a.scores};
 // Remote has precedence where the same marker/score exists; never erase local-only points.
 for(const [n,h] of Object.entries(b.holes))holes[n]={...(holes[n]||{}),...h};
 Object.assign(scores,b.scores);
 return {holes,scores};
}
function updateView(){if(!client)return;const signed=!!user;$('cloudAuth').style.display=signed?'none':'block';$('cloudConnected').style.display=signed?'block':'none';$('cloudAccount').textContent=signed?'Connected: '+(user.email||'signed-in user'):'';}
function messageError(e){const m=e?.message||String(e);if(/golf_cloud_courses|schema cache|relation .* does not exist|42P01|PGRST205/i.test(m))return 'Cloud table not configured yet. Run the SQL setup file in your Supabase SQL Editor.';if(/row-level security|permission denied|42501/i.test(m))return 'Cloud permission error. Check the row security policies in the SQL setup file.';return m}
async function sync(){
 if(!client||!user||!ready)return;
 if(busy){repeat=true;return}
 busy=true;status('Syncing courses…');
 try{
  const {data:records,error}=await client.from('golf_cloud_courses').select('course_key,data').eq('user_id',user.id);
  if(error)throw error;
  const remote=new Map((records||[]).map(r=>[r.course_key,r.data]));
  const paths=new Set([...remote.keys(),...keys().map(k=>k.slice('golfgps-v1-'.length))]);
  const rows=[];
  for(const course of paths){
    if(course==='manual'||!course||course.length>150)continue;
    const k='golfgps-v1-'+course;
    const local=localData(k);
    const data=merge(remote.get(course),local);
    localStorage.setItem(k,JSON.stringify(data));
    rows.push({user_id:user.id,course_key:course,data,updated_at:new Date().toISOString()});
  }
  if(rows.length){
    const {error:writeErr}=await client.from('golf_cloud_courses').upsert(rows,{onConflict:'user_id,course_key'});
    if(writeErr)throw writeErr;
  }
  if(typeof courseId!=='undefined'&&courseId){
    const current=localData('golfgps-v1-'+courseId);
    if(current){state=current;render();window.updateHoleStrip?.()}
  }
  status('Cloud connected · '+rows.length+' course'+(rows.length===1?'':'s')+' synced.');
 }catch(e){status('Sync failed: '+messageError(e))}
 finally{busy=false;if(repeat){repeat=false;setTimeout(sync,500)}}
}
window.queueCloudSync=()=>{if(!user||!ready)return;clearTimeout(queued);queued=setTimeout(sync,1200)};
async function loggedIn(next){
 user=next;ready=false;updateView();
 if(!user){status('Not connected · saved markers remain on this device.');return}
 ready=true;await sync();
}
async function init(){
 if(!window.supabase?.createClient){status('Cloud sign-in library did not load. Check internet and refresh.');return}
 client=window.supabase.createClient(url,publishable,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
 try{
  const {data,error}=await client.auth.getUser();if(error&&/invalid|expired|missing/i.test(error.message||'')){await client.auth.signOut()}
  await loggedIn(data?.user||null);
  client.auth.onAuthStateChange((event,session)=>{
   // Defer cloud queries so auth callback cannot deadlock client authentication.
   setTimeout(()=>{if(event==='SIGNED_IN'&&session?.user&&session.user.id!==user?.id)loggedIn(session.user);else if(event==='SIGNED_OUT')loggedIn(null)},0);
  });
 }catch(e){status('Cloud connection error: '+messageError(e))}
}
async function auth(action){
 const email=$('cloudEmail').value.trim(),password=$('cloudPassword').value;
 if(!email.includes('@')||password.length<6){status('Enter a valid email and password of at least 6 characters.');return}
 const button=$('cloud'+(action==='login'?'Login':'Signup'));button.disabled=true;
 status(action==='login'?'Signing in…':'Creating account…');
 try{
  const {data,error}=action==='login'?await client.auth.signInWithPassword({email,password}):await client.auth.signUp({email,password});
  if(error)throw error;
  $('cloudPassword').value='';
  if(data?.session&&data?.user)await loggedIn(data.user);
  else status('Account created. Check your email for a confirmation link, then return and sign in. Email delivery is subject to your Supabase limits.');
 }catch(e){status('Sign-in failed: '+messageError(e))}
 finally{button.disabled=false}
}
$('cloudLogin').onclick=()=>auth('login');
$('cloudSignup').onclick=()=>auth('signup');
$('cloudSync').onclick=()=>sync();
$('cloudLogout').onclick=async()=>{if(client){await client.auth.signOut();await loggedIn(null)}};
init();
})();
