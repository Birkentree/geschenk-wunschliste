/* Wunschfunken – gemeinsame Wunschliste über Supabase */
(() => {
'use strict';
const $ = id => document.getElementById(id);
const cfg = window.WISHLIST_CONFIG || {};
const configured = /^https:\/\/[^/]+\.supabase\.co$/i.test(cfg.supabaseUrl || '') && typeof cfg.supabasePublishableKey === 'string' && cfg.supabasePublishableKey.length > 20 && !/DEIN-|HIER-/.test(cfg.supabasePublishableKey);
let db = null;
try { if (configured && window.supabase?.createClient) db = window.supabase.createClient(cfg.supabaseUrl, cfg.supabasePublishableKey); } catch (e) { console.error(e); }
const demo = !db;
const storageKey = 'wunschfunken-reservierungen:' + (cfg.supabaseUrl || 'demo');
let gifts = [], onlyFree = false, admin = false, selectedGift = null, toastTimeout;
const examples = [
 {id:'demo1',title:'Eine schöne Kaffeetasse',note:'Am liebsten in Creme oder Altrosa.',url:'',image_url:null,status:'frei'},
 {id:'demo2',title:'Ein gemütliches Buch',note:'Für entspannte Abende auf dem Sofa.',url:'',image_url:null,status:'frei'},
 {id:'demo3',title:'Eine Duftkerze',note:'Mit einem sanften Duft.',url:'',image_url:null,status:'reserviert'}
];
const create = (tag, klass, value) => { const e = document.createElement(tag); if (klass) e.className = klass; if (value != null) e.textContent = value; return e; };
const button = (title,klass,fn,disabled=false) => {const b=create('button',klass,title);b.type='button';b.disabled=disabled;if(fn)b.addEventListener('click',fn);return b;};
function alertMessage(message){ const t=$('toast'); t.textContent=message;t.classList.add('visible');clearTimeout(toastTimeout);toastTimeout=setTimeout(()=>t.classList.remove('visible'),4500); }
function connection(ok,message){$('syncStatus').classList.toggle('offline',!ok);$('syncText').textContent=message;}
function secrets(){try {return JSON.parse(localStorage.getItem(storageKey)||'{}')||{};}catch{return {};}}
function storeSecrets(value){try{localStorage.setItem(storageKey,JSON.stringify(value));return true;}catch{return false;}}
function ownSecret(id){return secrets()[id]||null;}
function forgetSecret(id){const s=secrets();delete s[id];storeSecrets(s);}
function https(url){try{return new URL(url).protocol==='https:';}catch{return false;}}
function renderCard(gift,index){
 const card=create('article','gift-card'), photo=create('div','gift-photo');
 const validImage=gift.image_url&&https(gift.image_url);
 if(validImage){const img=create('img');img.src=gift.image_url;img.alt='Abbildung: '+gift.title;img.loading='lazy';img.referrerPolicy='no-referrer';img.onerror=()=>{img.remove();photo.classList.add('placeholder');photo.append(create('span','placeholder-icon','🎁'));};photo.append(img);}
 else{photo.classList.add('placeholder','v'+(index%3+1));photo.append(create('span','placeholder-icon',['🎁','📖','✨'][index%3]));}
 photo.prepend(create('span','gift-badge'+(gift.status!=='frei'?' taken':''),gift.status==='frei'?'● Noch verfügbar':gift.status==='bestellt'?'✓ Bestellt':'♡ Reserviert'));
 card.append(photo);
 const content=create('div','gift-content');content.append(create('h3','gift-title',gift.title));content.append(create('p','gift-note',gift.note||'Ein schöner Wunsch, der Freude macht.'));
 const actions=create('div','gift-actions');const own=!demo&&gift.status==='reserviert'&&!!ownSecret(gift.id);
 if(demo)actions.append(button('Vorschau – noch nicht reservierbar','button button-outline',null,true));
 else if(gift.status==='frei')actions.append(button('♡ Dieses Geschenk reservieren','button button-primary',()=>{selectedGift=gift;$('reserveGiftTitle').textContent=gift.title;$('reserveDialog').showModal();}));
 else if(own){actions.append(create('p','gift-reserved-note mine-note','✓ Von dir reserviert'));actions.append(button('✓ Ich habe es bestellt','button button-primary',()=>markOrdered(gift)));actions.append(button('Reservierung freigeben','button button-outline',()=>releaseGift(gift)));}
 else actions.append(create('p','gift-reserved-note',gift.status==='bestellt'?'Dieses Geschenk wurde schon bestellt.':'Dieses Geschenk ist bereits vergeben.'));
 if(!demo&&https(gift.url)&&(gift.status==='frei'||own)){const link=create('a','gift-link','Im Shop ansehen ↗');link.href=gift.url;link.target='_blank';link.rel='noopener noreferrer nofollow';actions.append(link);}
 content.append(actions);
 if(admin){const controls=create('div','admin-gift-actions');if(gift.status!=='frei')controls.append(button('↺ Wieder freigeben','',()=>resetGift(gift)));controls.append(button('✕ Entfernen','',()=>deleteGift(gift)));content.append(controls);}
 card.append(content);return card;
}
function render(){
 const free=gifts.filter(g=>g.status==='frei').length, visible=onlyFree?gifts.filter(g=>g.status==='frei'):gifts;
 $('availableCount').textContent=free;$('resultsText').textContent=visible.length+' von '+gifts.length+' Geschenk'+(gifts.length===1?'':'en');
 $('showAllButton').classList.toggle('active',!onlyFree);$('showAllButton').setAttribute('aria-pressed',String(!onlyFree));
 $('showFreeButton').classList.toggle('active',onlyFree);$('showFreeButton').setAttribute('aria-pressed',String(onlyFree));
 $('giftGrid').replaceChildren(...visible.map(renderCard));$('emptyState').hidden=visible.length!==0;
 $('emptyMessage').textContent=gifts.length?'Im Moment sind alle Wünsche vergeben. Danke fürs Mitmachen!':'Noch keine Geschenke angelegt. Über „Verwalten“ kannst du die ersten hinzufügen.';
}
async function refresh(){
 if(demo)return;
 const {data,error}=await db.from('gifts').select('id,title,url,image_url,note,status,created_at').order('created_at',{ascending:false});
 if(error){console.error(error);$('loadError').hidden=false;$('loadError').textContent='Die Liste konnte nicht geladen werden. Bitte prüfe die Datenbank und lade die Seite neu.';connection(false,'Verbindung prüfen');return;}
 $('loadError').hidden=true;gifts=data||[];render();connection(true,'Liste ist aktuell');
}
async function reserve(){
 const gift=selectedGift;if(!gift||demo)return;
 const btn=$('confirmReserveButton');btn.disabled=true;
 try{
  if(!crypto?.randomUUID)throw Error('Sichere HTTPS-Verbindung erforderlich.');
  const secret=crypto.randomUUID()+'-'+crypto.randomUUID();
  const {data,error}=await db.rpc('reserve_gift',{p_gift_id:gift.id,p_secret:secret});if(error)throw error;
  if(!data){alertMessage('Dieses Geschenk wurde gerade von jemand anderem reserviert.');$('reserveDialog').close();await refresh();return;}
  const s=secrets();s[gift.id]=secret;
  if(storeSecrets(s))alertMessage('Reserviert! Du kannst es jetzt bestellen.');
  else alertMessage('Reserviert! Dein Browser speichert die Reservierung nicht – bei Bedarf die Verwaltung kontaktieren.');
  $('reserveDialog').close();await refresh();
 }catch(e){console.error(e);alertMessage('Reservierung fehlgeschlagen. Bitte erneut versuchen.');}
 finally{btn.disabled=false;selectedGift=null;}
}
async function markOrdered(gift){
 const secret=ownSecret(gift.id);if(!secret||!confirm('Hast du „'+gift.title+'“ tatsächlich bestellt?'))return;
 try{const {data,error}=await db.rpc('mark_gift_ordered',{p_gift_id:gift.id,p_secret:secret});if(error)throw error;if(!data){alertMessage('Bestellung konnte nicht markiert werden.');await refresh();return;}forgetSecret(gift.id);alertMessage('Danke! Geschenk wurde als bestellt markiert.');await refresh();}
 catch(e){console.error(e);alertMessage('Änderung fehlgeschlagen.');}
}
async function releaseGift(gift){
 const secret=ownSecret(gift.id);if(!secret||!confirm('Reservierung für „'+gift.title+'“ aufheben?'))return;
 try{const {data,error}=await db.rpc('release_gift',{p_gift_id:gift.id,p_secret:secret});if(error)throw error;if(!data){alertMessage('Freigeben war nicht möglich.');await refresh();return;}forgetSecret(gift.id);alertMessage('Geschenk ist wieder verfügbar.');await refresh();}
 catch(e){console.error(e);alertMessage('Freigeben fehlgeschlagen.');}
}
async function syncAdmin(user){
 let allowed=false;
 if(user&&db){const {data,error}=await db.from('admins').select('id').eq('id',user.id).maybeSingle();allowed=!error&&!!data;}
 admin=allowed;$('adminPanel').hidden=!admin;$('adminButton').textContent=admin?'Verwaltung öffnen':'Verwalten';render();return allowed;
}
async function login(event){
 event.preventDefault();const submit=$('loginSubmitButton');submit.disabled=true;$('loginError').textContent='';
 try{
  const {data,error}=await db.auth.signInWithPassword({email:$('adminEmail').value.trim(),password:$('adminPassword').value});
  if(error)throw error;
  if(!(await syncAdmin(data.user))){await db.auth.signOut();$('loginError').textContent='Dieses Konto ist nicht als Verwaltung freigeschaltet.';return;}
  $('loginDialog').close();$('loginForm').reset();$('adminPanel').scrollIntoView({behavior:'smooth'});alertMessage('Erfolgreich angemeldet.');
 }catch(e){console.error(e);$('loginError').textContent='Anmeldung fehlgeschlagen. Prüfe E-Mail und Passwort.';}
 finally{submit.disabled=false;}
}
async function addGift(event){
 event.preventDefault();if(!db||!admin)return;
 const values={title:$('giftTitle').value.trim(),url:$('giftUrl').value.trim(),image_url:$('giftImage').value.trim()||null,note:$('giftNote').value.trim()||null};
 if(!values.title||!https(values.url)||(values.image_url&&!https(values.image_url))){$('adminFormMessage').textContent='Bitte Namen und gültige https://-Links eintragen.';return;}
 $('addGiftButton').disabled=true;
 try{const {error}=await db.from('gifts').insert(values);if(error)throw error;$('giftForm').reset();$('adminFormMessage').textContent='Geschenk hinzugefügt.';alertMessage('Geschenk hinzugefügt.');await refresh();}
 catch(e){console.error(e);$('adminFormMessage').textContent='Hinzufügen fehlgeschlagen. Bitte Rechte prüfen.';}
 finally{$('addGiftButton').disabled=false;}
}
async function resetGift(gift){
 if(!admin||!confirm('„'+gift.title+'“ wieder freigeben?'))return;
 try{const {data,error}=await db.rpc('admin_reset_gift',{p_gift_id:gift.id});if(error||!data)throw error||Error('Nicht gefunden');forgetSecret(gift.id);alertMessage('Geschenk freigegeben.');await refresh();}
 catch(e){console.error(e);alertMessage('Zurücksetzen fehlgeschlagen.');}
}
async function deleteGift(gift){
 if(!admin||!confirm('„'+gift.title+'“ endgültig entfernen?'))return;
 try{const {error}=await db.from('gifts').delete().eq('id',gift.id);if(error)throw error;forgetSecret(gift.id);alertMessage('Geschenk entfernt.');await refresh();}
 catch(e){console.error(e);alertMessage('Löschen fehlgeschlagen.');}
}
async function main(){
 document.title=(cfg.listName||'Wunschfunken')+' – Wunschfunken';if(cfg.intro)$('introText').textContent=cfg.intro;
 $('showAllButton').addEventListener('click',()=>{onlyFree=false;render();});
 $('showFreeButton').addEventListener('click',()=>{onlyFree=true;render();});
 $('adminButton').addEventListener('click',()=>{if(admin)$('adminPanel').scrollIntoView({behavior:'smooth'});else if(demo)alertMessage('Bitte erst Supabase und config.js einrichten.');else $('loginDialog').showModal();});
 $('closeLoginButton').addEventListener('click',()=>$('loginDialog').close());
 $('confirmReserveButton').addEventListener('click',reserve);
 $('loginForm').addEventListener('submit',login);
 $('giftForm').addEventListener('submit',addGift);
 $('logoutButton').addEventListener('click',async()=>{await db.auth.signOut();await syncAdmin(null);alertMessage('Abgemeldet.');});
 if(demo){$('setupNotice').hidden=false;connection(false,'Vorschaumodus');gifts=examples;render();return;}
 await refresh();
 db.channel('wunschfunken-live').on('postgres_changes',{event:'*',schema:'public',table:'gifts'},()=>{void refresh();}).subscribe();
 window.setInterval(()=>{if(!document.hidden)void refresh();},20000);
 document.addEventListener('visibilitychange',()=>{if(!document.hidden)void refresh();});
 const {data:{session}}=await db.auth.getSession();await syncAdmin(session?.user||null);
 db.auth.onAuthStateChange((_event,session)=>setTimeout(()=>{void syncAdmin(session?.user||null);},0));
}
void main();
})();
