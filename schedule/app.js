/* 十二月服務排班｜Google Identity Services + Google Sheets / Apps Script 安全橋接版 */
'use strict';
const SETTING={year:2026,month:12,firstDay:1,lastDay:28};
const CONFIG=window.ROSTER_CONFIG||{};
const demo=!(typeof CONFIG.googleClientId==='string' && CONFIG.googleClientId.endsWith('.apps.googleusercontent.com') &&
  !CONFIG.googleClientId.startsWith('YOUR_') && /^https:\/\/script\.google\.com\/macros\/s\/[a-zA-Z0-9_-]+\/exec$/.test(CONFIG.appsScriptUrl||''));
const $=id=>document.getElementById(id);
const weekdays=['日','一','二','三','四','五','六'];
const demoUser={uid:'demo-operator',displayName:'示範使用者',email:'preview@example.test'};
let user=demo?demoUser:null;
let idToken=null;
let entries=demo?[
 {id:'sample-1',date:'2026-12-03',participantName:'林小安',ownerUid:'other-1',ownerName:'王志工',ownerEmail:'sample@example.test',editorUid:'other-1',editorName:'王志工',editorEmail:'sample@example.test',createdAt:'2026-11-22T08:20:00Z',updatedAt:'2026-11-22T08:20:00Z'},
 {id:'sample-2',date:'2026-12-03',participantName:'陳小琪',ownerUid:'demo-operator',ownerName:'示範使用者',ownerEmail:'preview@example.test',editorUid:'demo-operator',editorName:'示範使用者',editorEmail:'preview@example.test',createdAt:'2026-11-22T10:00:00Z',updatedAt:'2026-11-22T10:00:00Z'},
 {id:'sample-3',date:'2026-12-12',participantName:'黃小美',ownerUid:'other-2',ownerName:'李夥伴',ownerEmail:'another@example.test',editorUid:'other-2',editorName:'李夥伴',editorEmail:'another@example.test',createdAt:'2026-11-23T01:30:00Z',updatedAt:'2026-11-23T01:30:00Z'}
]:[];
let loaded=demo,selectedDate=null,saving=false,lastFocus=null,toastHandle=null,loginBusy=false;
let bridgeReady=false,bridgeOrigin=null,bridgeWindow=null,bridgeSession=null,expectedBridgeNonce=null,bridgeSeq=0,bridgeResolve=null,bridgeReject=null;
const pending=new Map();
let lastSync='';
const dayString=d=>`${SETTING.year}-${String(SETTING.month).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
const validDate=s=>/^2026-12-(0[1-9]|1\d|2[0-8])$/.test(s);
const dayLabel=s=>`12 月 ${Number(s.slice(-2))} 日（星期${weekdays[new Date(2026,11,Number(s.slice(-2)),12).getDay()]}）`;
const plainName=s=>String(s??'').replace(/\s+/g,' ').trim();
function fmtTimestamp(v){if(!v)return '—';const d=v instanceof Date?v:new Date(v);if(Number.isNaN(d.getTime()))return String(v);return new Intl.DateTimeFormat('zh-TW',{timeZone:'Asia/Taipei',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false}).format(d);}
function mk(tag,css,text){const e=document.createElement(tag);if(css)e.className=css;if(text!==undefined)e.textContent=text;return e;}
function toast(text,isError=false){const el=$('toast');el.textContent=text;el.classList.toggle('error',isError);el.classList.add('visible');clearTimeout(toastHandle);toastHandle=setTimeout(()=>el.classList.remove('visible'),3500);}
function showError(msg=''){$('errorBanner').hidden=!msg;$('errorBanner').textContent=msg;}
function myEntry(item){return !!user && item.ownerUid===user.uid;}
function actorInfo(item){return `排班姓名：${item.participantName}\n建立者：${item.ownerName||'Google 使用者'}（${item.ownerEmail||'—'}）\n建立時間：${fmtTimestamp(item.createdAt)}\n最後編輯：${item.editorName||'Google 使用者'}（${item.editorEmail||'—'}）\n修改時間：${fmtTimestamp(item.updatedAt)}`;}
function positionTip(ev,item){if(matchMedia('(hover:none)').matches)return;const tip=$('hoverInfo');tip.textContent=actorInfo(item);tip.hidden=false;const rect=ev.currentTarget.getBoundingClientRect(),x=ev.clientX||rect.left,y=ev.clientY||rect.top;tip.style.left=`${Math.max(8,Math.min(x+12,innerWidth-tip.offsetWidth-10))}px`;tip.style.top=`${Math.max(8,Math.min(y+14,innerHeight-tip.offsetHeight-12))}px`;}
function closeTip(){$('hoverInfo').hidden=true;}
function renderStatus(){
 $('demoBanner').hidden=!demo;
 $('loginButton').hidden=true;
 $('googleButton').hidden=demo||!!user;
 $('logoutButton').hidden=demo||!user;
 $('userBadge').hidden=!user;
 $('exportButton').hidden=demo||!user||!loaded;
 if(user){$('googleName').textContent=user.displayName||'Google 使用者';$('googleEmail').textContent=user.email||'';$('userIcon').textContent=(user.displayName||'我').slice(0,1);}
 $('statusText').textContent=demo?'示範預覽・尚未連線 Google 試算表':!user?'請使用 Google 帳號登入後開始登記':!loaded?'正在安全讀取排班資料…':`名單已同步${lastSync?'・'+lastSync:''}・每 30 秒更新`;
 const active=user&&loaded?entries.filter(x=>validDate(x.date)):[];
 $('daysCount').textContent=user&&loaded?String(new Set(active.map(x=>x.date)).size):'—';
 $('peopleCount').textContent=user&&loaded?String(active.length):'—';
 $('myCount').textContent=user&&loaded?String(active.filter(myEntry).length):'—';
}
function renderCalendar(){
 const host=$('calendar');host.replaceChildren();
 const firstWeekday=new Date(2026,11,1,12).getDay();
 if(innerWidth>780)for(let i=0;i<firstWeekday;i++)host.append(mk('div','day-blank'));
 const today=new Date();
 for(let d=1;d<=28;d++){
   const date=dayString(d);
   const rows=user&&loaded?entries.filter(x=>x.date===date).sort((a,b)=>myEntry(a)===myEntry(b)?a.participantName.localeCompare(b.participantName,'zh-Hant'):myEntry(a)?-1:1):[];
   const cell=mk('article','day-cell'+(rows.some(myEntry)?' has-own':'')+(today.getFullYear()===2026&&today.getMonth()===11&&today.getDate()===d?' today':''));
   const heading=mk('div','day-head'),lhs=mk('div');lhs.append(mk('span','day-number',String(d)),mk('span','mobile-day','週'+weekdays[new Date(2026,11,d,12).getDay()]));heading.append(lhs,mk('span','day-count',user&&loaded?rows.length+' 人':'—'));cell.append(heading);
   const roster=mk('div','day-roster');roster.setAttribute('aria-label',dayLabel(date)+'已登記人員');
   if(!user)roster.append(mk('span','empty-day','登入後顯示名單'));
   else if(!loaded)roster.append(mk('span','empty-day','同步中…'));
   else if(!rows.length)roster.append(mk('span','empty-day','等待第一位夥伴'));
   else for(const item of rows){
     const chip=mk('button','person-chip'+(myEntry(item)?' own':''),item.participantName);chip.type='button';
     if(myEntry(item))chip.append(mk('span','owner-mark','✧ 我登記'));
     chip.setAttribute('aria-label',item.participantName+'，點擊查看實際登記與編輯資訊');
     chip.addEventListener('pointerenter',e=>positionTip(e,item));chip.addEventListener('pointermove',e=>positionTip(e,item));chip.addEventListener('pointerleave',closeTip);chip.addEventListener('blur',closeTip);chip.addEventListener('focus',e=>positionTip(e,item));chip.addEventListener('click',()=>openDialog(date,item.id));roster.append(chip);
   }
   cell.append(roster);
   const action=mk('button','day-action',!user?'請先登入':!loaded?'同步中…':'+ 新增／查看');action.type='button';action.disabled=!user||!loaded;action.setAttribute('aria-label',dayLabel(date)+'，新增或查看排班');action.addEventListener('click',()=>openDialog(date));cell.append(action);host.append(cell);
 }
 if(innerWidth>780){const used=firstWeekday+28;for(let i=(7-used%7)%7;i>0;i--)host.append(mk('div','day-blank'));}
}
function render(){renderStatus();renderCalendar();if(selectedDate)renderDialogRoster();}
function openDialog(date,id){if(!user||!loaded||!validDate(date))return;closeTip();selectedDate=date;lastFocus=document.activeElement;$('dialogHeading').textContent=dayLabel(date);$('dialogBackdrop').hidden=false;document.body.classList.add('dialog-open');clearForm();renderDialogRoster();if(id){const item=entries.find(x=>x.id===id&&x.date===date);if(item)showEntryInfo(item);}$('closeDialog').focus();}
function closeDialog(){selectedDate=null;$('dialogBackdrop').hidden=true;document.body.classList.remove('dialog-open');closeTip();if(lastFocus?.isConnected)lastFocus.focus();}
function clearForm(){$('editingId').value='';$('participantName').value='';$('formLabel').textContent='新增排班姓名';$('saveButton').textContent='＋ 確認登記';$('cancelEdit').hidden=true;$('formMessage').textContent='';}
function startEdit(item){if(!myEntry(item)){toast('只能修改自己 Google 帳號建立的紀錄',true);return;}$('editingId').value=item.id;$('participantName').value=item.participantName;$('formLabel').textContent='修改排班姓名';$('saveButton').textContent='儲存修改';$('cancelEdit').hidden=false;$('formMessage').textContent='修改將記錄實際編輯者與時間';$('participantName').focus();}
function showEntryInfo(item){$('formMessage').textContent='最後編輯：'+(item.editorName||item.editorEmail||'—')+'／'+fmtTimestamp(item.updatedAt);}
function renderDialogRoster(){
 if(!selectedDate)return;const host=$('dialogRoster');host.replaceChildren();
 const rows=entries.filter(x=>x.date===selectedDate).sort((a,b)=>Number(myEntry(b))-Number(myEntry(a)));
 if(!rows.length){host.append(mk('div','no-entries','這一天尚未有人登記，歡迎成為第一位夥伴。'));return;}
 for(const item of rows){const line=mk('div','dialog-row'),info=mk('div');info.style.minWidth='0';info.append(mk('div','dialog-name',item.participantName));info.append(mk('div','dialog-meta',`建立：${item.ownerName||'Google 使用者'}（${item.ownerEmail||'—'}）・${fmtTimestamp(item.createdAt)}`));info.append(mk('div','dialog-meta',`最後編輯：${item.editorName||'Google 使用者'}（${item.editorEmail||'—'}）・${fmtTimestamp(item.updatedAt)}`));line.append(info);
 if(myEntry(item)){const actions=mk('div','dialog-actions'),change=mk('button','tiny-button','修改'),remove=mk('button','tiny-button danger','取消');change.type=remove.type='button';change.addEventListener('click',()=>startEdit(item));remove.addEventListener('click',()=>deleteEntry(item));actions.append(change,remove);line.append(actions);}host.append(line);}
}
async function saveEntry(e){
 e.preventDefault();if(saving||!user||!loaded||!selectedDate)return;
 const name=plainName($('participantName').value);
 if(!name||[...name].length>40||/^[=+\-@]/.test(name)){$('formMessage').textContent='請輸入 1–40 字的有效姓名';return;}
 if(entries.some(x=>x.date===selectedDate&&x.participantName===name&&x.id!==$('editingId').value)){$('formMessage').textContent='同一天已有相同姓名，請先確認是否重複';return;}
 const editId=$('editingId').value,original=entries.find(x=>x.id===editId);
 if(editId&&(!original||!myEntry(original)||original.date!==selectedDate)){toast('無權修改此紀錄',true);return;}
 saving=true;$('saveButton').disabled=true;$('formMessage').textContent='正在儲存…';
 try{
   if(demo){const now=new Date().toISOString();if(editId){Object.assign(original,{participantName:name,editorUid:user.uid,editorName:user.displayName,editorEmail:user.email,updatedAt:now});}else{entries.push({id:'preview-'+Date.now(),date:selectedDate,participantName:name,ownerUid:user.uid,ownerName:user.displayName,ownerEmail:user.email,createdAt:now,editorUid:user.uid,editorName:user.displayName,editorEmail:user.email,updatedAt:now});}}
   else {const response=await requestBackend(editId?'update':'add',editId?{id:editId,participantName:name}:{date:selectedDate,participantName:name});entries=response.entries||[];lastSync='剛剛';}
   clearForm();render();toast(editId?'已更新排班姓名與編輯資訊':'登記成功：'+name+(demo?'（示範）':''));
 }catch(ex){showError('儲存未完成：'+String(ex.message||ex));$('formMessage').textContent=String(ex.message||'儲存失敗');toast('儲存失敗，請檢查設定',true);}finally{saving=false;$('saveButton').disabled=false;}
}
async function deleteEntry(item){
 if(saving||!myEntry(item)||!confirm(`確定取消 ${dayLabel(item.date)} 的「${item.participantName}」登記嗎？`))return;
 saving=true;try{if(demo)entries=entries.filter(x=>x.id!==item.id);else{const response=await requestBackend('delete',{id:item.id});entries=response.entries||[];lastSync='剛剛';}if($('editingId').value===item.id)clearForm();render();toast('已取消登記');}
 catch(ex){showError('取消失敗：'+String(ex.message||ex));toast('取消失敗',true);}finally{saving=false;}
}
function csvValue(value){const v=String(value??'');const protectedValue=/^\s*[=+@\-\t\r]/.test(v)?"'"+v:v;return '"'+protectedValue.replace(/"/g,'""')+'"';}
function exportCsv(){if(!user||!loaded||demo)return;const headers=['日期','星期','排班姓名','建立者姓名','建立者Email','建立時間','最後編輯者姓名','最後編輯者Email','修改時間'];const rows=[headers,...entries.filter(x=>validDate(x.date)).sort((a,b)=>a.date.localeCompare(b.date)).map(x=>[x.date,'星期'+weekdays[new Date(2026,11,Number(x.date.slice(-2)),12).getDay()],x.participantName,x.ownerName,x.ownerEmail,fmtTimestamp(x.createdAt),x.editorName,x.editorEmail,fmtTimestamp(x.updatedAt)])];const blob=new Blob(['\uFEFF'+rows.map(row=>row.map(csvValue).join(',')).join('\r\n')],{type:'text/csv;charset=utf-8'}),url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download='2026年12月_服務排班.csv';document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),2000);toast('CSV 排班名單已匯出');}

// 安全 iframe 橋接：所有資料請求先交由 Apps Script 驗證 ID token，避免把 Email 當成認證。
function allowedBridgeOrigin(origin){try{const u=new URL(origin);return u.protocol==='https:' && (u.hostname==='script.google.com'||u.hostname==='script.googleusercontent.com'||(u.hostname.endsWith('.googleusercontent.com')&&u.hostname.includes('script')));}catch{return false;}}
function receiveBridgeMessage(e){
 if(demo||!allowedBridgeOrigin(e.origin)||!e.data||typeof e.data!=='object')return;
 const d=e.data;
 if(d.type==='roster:ready'){
   if(!expectedBridgeNonce||d.nonce!==expectedBridgeNonce)return;
   bridgeOrigin=e.origin;bridgeWindow=e.source;bridgeSession=crypto.randomUUID()+crypto.randomUUID();
   bridgeWindow.postMessage({type:'roster:hello',session:bridgeSession},bridgeOrigin);
 }else if(d.type==='roster:ack'&&e.source===bridgeWindow&&d.session===bridgeSession&&e.origin===bridgeOrigin){bridgeReady=true;if(bridgeResolve)bridgeResolve(true);bridgeResolve=null;bridgeReject=null;
 }else if(d.type==='roster:response'&&e.source===bridgeWindow&&d.session===bridgeSession&&e.origin===bridgeOrigin){const job=pending.get(d.requestId);if(!job)return;pending.delete(d.requestId);clearTimeout(job.timer);if(d.error)job.reject(new Error(d.error));else if(!d.result?.ok)job.reject(new Error('後端未回傳成功結果'));else job.resolve(d.result);}
}
window.addEventListener('message',receiveBridgeMessage);
function connectBridge(){
 if(demo)return Promise.resolve(false);
 return new Promise((resolve,reject)=>{
   bridgeResolve=resolve;bridgeReject=reject;
   expectedBridgeNonce=crypto.randomUUID()+crypto.randomUUID();
   $('gasBridge').src=CONFIG.appsScriptUrl+'?bridge_nonce='+encodeURIComponent(expectedBridgeNonce);
   setTimeout(()=>{if(!bridgeReady){bridgeResolve=bridgeReject=null;reject(new Error('Apps Script 連線逾時。請確認已發布網頁應用程式，並允許 iframe 嵌入。'));}},16000);
 });
}
function requestBackend(action,params={}){
 if(!bridgeReady||!idToken)return Promise.reject(new Error('尚未建立安全連線或 Google 登入已失效。'));
 return new Promise((resolve,reject)=>{
   const requestId=String(++bridgeSeq)+'-'+crypto.randomUUID();
   const timer=setTimeout(()=>{pending.delete(requestId);reject(new Error('伺服器回應逾時，請稍後重新整理。'));},25000);
   pending.set(requestId,{resolve,reject,timer});
   bridgeWindow.postMessage({type:'roster:request',session:bridgeSession,requestId,payload:{action,idToken,...params}},bridgeOrigin);
 });
}
function clearUser(){idToken=null;user=null;entries=[];loaded=false;lastSync='';if(selectedDate)closeDialog();render();}
async function onGoogleCredential(response){
 if(!response?.credential||loginBusy)return;loginBusy=true;showError('');idToken=response.credential;loaded=false;render();
 try{if(!bridgeReady)throw new Error('Apps Script 安全連線尚未就緒。');const result=await requestBackend('list');user={uid:result.profile.uid,displayName:result.profile.name,email:result.profile.email};entries=result.entries||[];loaded=true;lastSync='剛剛';render();toast('Google 登入成功，排班名單已同步');}
 catch(ex){clearUser();showError('登入或同步失敗：'+String(ex.message||ex));}
 finally{loginBusy=false;}
}
function startGoogleIdentity(){
 if(!window.google?.accounts?.id){showError('無法載入 Google 登入元件。請使用 Chrome 或 Safari，並關閉阻擋第三方腳本的設定。');return;}
 window.google.accounts.id.initialize({client_id:CONFIG.googleClientId,callback:onGoogleCredential,auto_select:false,ux_mode:'popup'});
 $('googleButton').replaceChildren();
 window.google.accounts.id.renderButton($('googleButton'),{type:'standard',theme:'outline',size:'large',text:'signin_with',shape:'pill',width:195,locale:'zh_TW'});
 render();
}
async function initOnline(){
 try{await connectBridge();
   // Google script 是 async，可能比本網站晚載入。
   for(let i=0;i<40&&!window.google?.accounts?.id;i++)await new Promise(r=>setTimeout(r,125));
   startGoogleIdentity();
 }catch(ex){showError('Google 試算表連線尚未啟用：'+String(ex.message||ex)+'。如已設定部署，請參考 README 檢查瀏覽器 iframe 限制。');}
}
function logout(){if(window.google?.accounts?.id)window.google.accounts.id.disableAutoSelect();clearUser();toast('已登出 Google 排班網站');}
$('loginButton').addEventListener('click',()=>toast('目前為示範模式，正式啟用須完成 Apps Script 設定。'));
$('logoutButton').addEventListener('click',logout);
$('exportButton').addEventListener('click',exportCsv);
$('closeDialog').addEventListener('click',closeDialog);
$('dialogBackdrop').addEventListener('click',e=>{if(e.target===$('dialogBackdrop'))closeDialog();});
$('personForm').addEventListener('submit',saveEntry);
$('cancelEdit').addEventListener('click',clearForm);
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&selectedDate)closeDialog();if(e.key==='Tab'&&selectedDate){const nodes=[...$('dialogBackdrop').querySelectorAll('button:not([hidden]):not([disabled]),input:not([hidden]):not([disabled])')].filter(n=>n.getClientRects().length);if(!nodes.length)return;const first=nodes[0],last=nodes[nodes.length-1];if(e.shiftKey&&document.activeElement===first){last.focus();e.preventDefault();}else if(!e.shiftKey&&document.activeElement===last){first.focus();e.preventDefault();}}});
window.addEventListener('resize',()=>{closeTip();renderCalendar();});
window.addEventListener('scroll',closeTip,{passive:true});
setInterval(async()=>{if(demo||!user||!idToken||!bridgeReady||saving)return;try{const result=await requestBackend('list');entries=result.entries||[];lastSync='剛剛';render();}catch(ex){console.warn('同步失敗',ex);if(/失效|到期|未通過/.test(String(ex.message||''))){clearUser();showError('Google 登入已到期，請重新登入。');}else{showError('目前無法同步其他人的最新排班，請檢查網路連線。');}}},30000);
render();if(!demo)initOnline();
