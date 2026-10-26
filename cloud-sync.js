/* Private cloud backup for golf course markers and scorecards.
   Supabase publishable key is safe for client-side use; never use secret keys here. */
(()=>{
'use strict';
const url='https://fyzixumgclwohjllqefs.supabase.co';
const publishable='sb_publishable_iOzmMUp_JKoqmCv93_wlQw_raDs4Uje';
const $=id=>document.getElementById(id);
const status=msg=>{$('cloudStatus').textContent=msg};
const card=document.createElement('section');card.className='card';card.id='cloudPanel';
card.innerHTML='<strong>☁️ Cloud saving</strong><p class="note">Sign in to sync mapped tees, greens and hole scores between your devices. Local copies stay saved on this device.</p><div id="cloudAuth"><label class="small" for="cloudEmail">Email</label><input id="cloudEmail" type="email" autocomplete="email" placeholder="Email address" style="width:100%;padding:11px;background:#081e12;color:white;border:1px solid #567052;border-radius:9px;margin:6px 0 10px"><label class="small" for="cloudPassword">Password</label><input id="cloudPassword" type="password" autocomplete="current-password" placeholder="Password (minimum 6 characters)" style="width:100%;padding:11px;background:#081e12;color:white;border:1px solid #567052;border-radius:9px;margin:6px 0 10px"><div class="buttons"><button id="cloudLogin" type="button">Sign in</button><button id="cloudSignup" class="secondary" type="button">Create account</button></div><div class="buttons"><button id="cloudShowPassword" class="secondary" type="button">Show password</button><button id="cloudForgot" class="secondary" type="button">Forgot password?</button></div><div id="cloudRecovery" style="display:none;margin-top:12px"><label class="small" for="cloudNewPassword">New password after opening your recovery email link</label><input id="cloudNewPassword" type="password" autocomplete="new-password" placeholder="New password" style="width:100%;padding:11px;background:#081e12;color:white;border:1px solid #567052;border-radius:9px;margin:7px 0"><button id="cloudSavePassword" type="button">Save new password</button></div></div><div id="cloudConnected" style="display:none"><p class="note" id="cloudAccount"></p><div class="buttons"><button id="cloudSync" type="button">Sync now</button><button class="secondary" id="cloudLogout" type="button">Sign out</button></div></div><p id="cloudStatus" class="status" role="status">Checking cloud connection…</p><p class="note">Cloud sync requires one-time Supabase table setup. No golf location data is sent until you sign in. Sign-in is separate from GitHub.</p>';
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
function messageError(e){
 const m=e?.message||String(e),code=String(e?.code||'').toLowerCase(),statusCode=Number(e?.status||0);
 if(code==='over_email_send_rate_limit'||/email rate limit exceeded|email rate limit/i.test(m))return 'Supabase has reached its confirmation-email limit. Do not keep retrying. Check Authentication → Logs and Email settings in Supabase; sending more confirmation emails requires an approved SMTP setup.';
 if(code==='email_address_not_authorized')return 'Supabase default email service cannot send to this address. Configure an approved custom SMTP sender in Supabase Authentication → SMTP settings.';
 if(code==='email_provider_disabled'||/signups? (are |is )?disabled|email signups disabled/i.test(m))return 'Email/password signup is disabled in Supabase. Enable the Email provider and Allow new users to sign up.';
 if(code==='email_exists'||/user already registered/i.test(m))return 'An account may already exist for this email. Try Sign in or use password recovery in Supabase.';
 if(code==='invalid_credentials'||/invalid login credentials/i.test(m))return 'Email or password is incorrect, or this account is not yet confirmed. Check the email used at signup or tap Forgot password?.';
 if(code==='email_not_confirmed'||/email not confirmed/i.test(m))return 'Your email is not confirmed yet. Check your inbox and spam folder for the confirmation link.';
 if(code==='weak_password'||/password should be at least|weak password/i.test(m))return 'Use a stronger password that meets the project password rules.';
 if(code==='over_request_rate_limit'||statusCode===429)return 'Too many signup requests. Check Supabase Authentication → Logs for the rate-limit details before retrying.';
 if(/failed to fetch|networkerror|network request failed/i.test(m))return 'Could not reach Supabase. Check your connection and Safari content blockers.';
 if(/golf_cloud_courses|schema cache|relation .* does not exist|42P01|PGRST205/i.test(m))return 'Cloud storage table is not set up yet. Run setup-golf-cloud.sql in your Supabase SQL Editor. Your account is still valid.';
 if(/row-level security|permission denied|42501/i.test(m))return 'Cloud storage permission error. Verify the SQL table security policies; your account is still valid.';
 return 'Supabase: '+m+(code?' ('+code+')':'');
}
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
  status('Signed in · cloud sync complete for '+rows.length+' course'+(rows.length===1?'':'s')+'.');
 }catch(e){status('Signed in successfully, but cloud saving is unavailable: '+messageError(e))}
 finally{busy=false;if(repeat){repeat=false;setTimeout(sync,500)}}
}
window.queueCloudSync=()=>{if(!user||!ready)return;clearTimeout(queued);queued=setTimeout(sync,1200)};
async function loggedIn(next){
 user=next;ready=false;updateView();
 if(!user){status('Not connected · saved markers remain on this device.');return}
 ready=true;await sync();
}
async function init(){
 if(!window.supabase?.createClient){status('Cloud sign-in library did not load. Check internet and refresh.');$('cloudLogin').disabled=true;$('cloudSignup').disabled=true;return}
 client=window.supabase.createClient(url,publishable,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
 try{
  const {data,error}=await client.auth.getUser();if(error&&/invalid|expired|missing/i.test(error.message||'')){await client.auth.signOut()}
  await loggedIn(data?.user||null);
  client.auth.onAuthStateChange((event,session)=>{
   // Defer cloud queries so auth callback cannot deadlock client authentication.
   setTimeout(()=>{if(event==='PASSWORD_RECOVERY'){$('cloudAuth').style.display='block';$('cloudConnected').style.display='none';$('cloudRecovery').style.display='block';status('Recovery verified. Enter a new password and tap Save new password.')}else if(event==='SIGNED_IN'&&session?.user&&session.user.id!==user?.id)loggedIn(session.user);else if(event==='SIGNED_OUT')loggedIn(null)},0);
  });
 }catch(e){status('Cloud connection error: '+messageError(e))}
}
async function auth(action){
 if(!client){status('Sign-in service has not loaded. Check your connection, then refresh the page.');return}
 const email=$('cloudEmail').value.trim(),password=$('cloudPassword').value;
 if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||password.length<6){status('Enter a valid email and a password of at least 6 characters.');return}
 const login=$('cloudLogin'),signup=$('cloudSignup');login.disabled=true;signup.disabled=true;
 status(action==='login'?'Signing in…':'Creating account…');
 try{
  const opts={email,password};
  if(action==='signup')opts.options={emailRedirectTo:'https://colel0910.github.io/18-birdies-2.0/'};
  const {data,error}=action==='login'?await client.auth.signInWithPassword(opts):await client.auth.signUp(opts);
  if(error)throw error;
  $('cloudPassword').value='';
  if(data?.session&&data?.user){
   await loggedIn(data.user);
  }else if(action==='signup'){
   status('Signup submitted. If your address is eligible, check your inbox and spam folder for the confirmation link. Return here to sign in afterward.');
  }else{
   status('No session returned. Check whether your email requires confirmation.');
  }
 }catch(e){status((action==='login'?'Sign in':'Create account')+' failed: '+messageError(e))}
 finally{login.disabled=false;signup.disabled=false}
}
$('cloudShowPassword').onclick=()=>{
 const x=$('cloudPassword');x.type=x.type==='password'?'text':'password';
 $('cloudShowPassword').textContent=x.type==='password'?'Show password':'Hide password';
};
$('cloudForgot').onclick=async()=>{
 if(!client){status('Sign-in service is not ready. Refresh the page.');return}
 const email=$('cloudEmail').value.trim();
 if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)){status('Enter your account email first, then tap Forgot password?.');return}
 $('cloudForgot').disabled=true;status('Requesting password recovery email…');
 try{
  const {error}=await client.auth.resetPasswordForEmail(email,{redirectTo:'https://colel0910.github.io/18-birdies-2.0/'});
  if(error)throw error;
  status('If an account exists for this email, a password recovery link will be sent. Check inbox and spam. Email delivery may be rate-limited.');
 }catch(e){status('Password recovery: '+messageError(e))}
 finally{$('cloudForgot').disabled=false}
};
$('cloudSavePassword').onclick=async()=>{
 if(!client)return;
 const pwd=$('cloudNewPassword').value;
 if(pwd.length<6){status('New password must contain at least 6 characters.');return}
 $('cloudSavePassword').disabled=true;
 try{
  const {error}=await client.auth.updateUser({password:pwd});if(error)throw error;
  $('cloudNewPassword').value='';$('cloudRecovery').style.display='none';status('Password changed successfully. You can now use it to sign in.');
 }catch(e){status('Could not update password: '+messageError(e))}
 finally{$('cloudSavePassword').disabled=false}
};
$('cloudLogin').onclick=()=>auth('login');
$('cloudSignup').onclick=()=>auth('signup');
$('cloudSync').onclick=()=>sync();
$('cloudLogout').onclick=async()=>{if(client){await client.auth.signOut();await loggedIn(null)}};
init();
})();
