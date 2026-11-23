/* 2026 年 12 月志工排班，GitHub Pages + Firebase Auth + Firestore。
 * 當 firebase-config.js 尚未設定，網站會用本機假資料開啟明確標示的示範模式。
 */
const SETTING = { year: 2026, month: 12, firstDay: 1, lastDay: 28, collection: 'registrations' };
const SDK_VERSION = '13.4.0';
const firebaseConfig = window.FIREBASE_CONFIG || {};
const isConfigured = !!(firebaseConfig.apiKey && firebaseConfig.projectId && firebaseConfig.appId &&
  !Object.values(firebaseConfig).some(v => typeof v === 'string' && v.startsWith('YOUR_')));
const demo = !isConfigured;
const $ = id => document.getElementById(id);
const weekdays = ['日','一','二','三','四','五','六'];
const demoUser = { uid: 'preview-user', displayName: '示範操作員', email: 'preview@example.com' };
let user = demo ? demoUser : null;
let entries = demo ? [
  { id: 'sample-a', date: '2026-12-03', participantName: '林小安', ownerUid: 'someone-a', ownerName: '王志工', ownerEmail: 'sample-a@example.com', editorUid: 'someone-a', editorName: '王志工', editorEmail: 'sample-a@example.com', createdAt: new Date('2026-11-21T08:20:00+08:00'), updatedAt: new Date('2026-11-21T08:20:00+08:00') },
  { id: 'sample-b', date: '2026-12-03', participantName: '陳小琪', ownerUid: 'someone-b', ownerName: '張夥伴', ownerEmail: 'sample-b@example.com', editorUid: 'someone-b', editorName: '張夥伴', editorEmail: 'sample-b@example.com', createdAt: new Date('2026-11-22T09:30:00+08:00'), updatedAt: new Date('2026-11-22T09:30:00+08:00') },
  { id: 'sample-c', date: '2026-12-12', participantName: '黃小美', ownerUid: 'preview-user', ownerName: '示範操作員', ownerEmail: 'preview@example.com', editorUid: 'preview-user', editorName: '示範操作員', editorEmail: 'preview@example.com', createdAt: new Date('2026-11-23T10:30:00+08:00'), updatedAt: new Date('2026-11-23T10:30:00+08:00') },
] : [];
let auth = null, firestore = null, api = null, unsubscribe = null;
let loaded = demo, selectedDate = null, saving = false, toastHandle;
let lastFocus = null;
const dayString = day => `${SETTING.year}-${String(SETTING.month).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
const validDate = date => /^2026-12-(0[1-9]|1[0-9]|2[0-8])$/.test(date);
const dayLabel = date => `12 月 ${Number(date.slice(-2))} 日（星期${weekdays[new Date(2026, 11, Number(date.slice(-2)), 12).getDay()]}）`;
const plainName = value => String(value ?? '').replace(/\s+/g,' ').trim();
const fmtTimestamp = value => {
  if (!value) return '同步中';
  const date = typeof value.toDate === 'function' ? value.toDate() : value instanceof Date ? value : null;
  if (!date || Number.isNaN(date.getTime())) return '同步中';
  return new Intl.DateTimeFormat('zh-TW',{timeZone:'Asia/Taipei',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false}).format(date);
};
const mk = (tag, className, text) => { const el=document.createElement(tag); if(className)el.className=className; if(text!==undefined)el.textContent=text; return el; };
const safeText = v => String(v||'').replace(/\s+/g,' ').trim();
function toast(message, error=false){const el=$('toast');el.textContent=message;el.classList.toggle('error',error);el.classList.add('visible');clearTimeout(toastHandle);toastHandle=setTimeout(()=>el.classList.remove('visible'),3500);}
function error(message=''){$('errorBanner').hidden=!message;$('errorBanner').textContent=message;}
function myEntry(entry){return !!user && entry.ownerUid===user.uid;}
function actorInfo(item){return `排班姓名：${item.participantName}\n建立者：${item.ownerName||'Google 使用者'}（${item.ownerEmail||'未提供'}）\n建立時間：${fmtTimestamp(item.createdAt)}\n最後修改：${item.editorName||'Google 使用者'}（${item.editorEmail||'未提供'}）\n修改時間：${fmtTimestamp(item.updatedAt)}`;}
function positionedTip(event,item){
  if(window.matchMedia('(hover:none)').matches)return;
  const tip=$('hoverInfo');tip.textContent=actorInfo(item);tip.hidden=false;
  const x=event.clientX??(event.target.getBoundingClientRect().left+20);
  const y=event.clientY??(event.target.getBoundingClientRect().top);
  tip.style.left=`${Math.max(8,Math.min(x+15,window.innerWidth-318))}px`;
  tip.style.top=`${Math.max(8,Math.min(y+13,window.innerHeight-tip.offsetHeight-10))}px`;
}
function closeTip(){ $('hoverInfo').hidden=true; }
function renderStatus(){
  $('demoBanner').hidden=!demo;
  $('loginButton').hidden=demo||!!user;
  $('logoutButton').hidden=demo||!user;
  $('userBadge').hidden=!user;
  $('exportButton').hidden=!user||!loaded||demo;
  if(user){$('googleName').textContent=user.displayName||'Google 使用者';$('googleEmail').textContent=user.email||'';$('userIcon').textContent=(user.displayName||user.email||'我').slice(0,1);}
  $('statusText').textContent=demo?'示範模式・可立即試玩操作（無資料同步）':!user?'請先登入 Google 帳號，即可查看和安排日期':!loaded?'正在同步最新排班名單…':'即時同步已啟用・同一天可由同一帳號代登記多人';
  const rows=user&&loaded?entries.filter(x=>validDate(x.date)):[];
  $('daysCount').textContent=user&&loaded?String(new Set(rows.map(e=>e.date)).size):'—';
  $('peopleCount').textContent=user&&loaded?String(rows.length):'—';
  $('myCount').textContent=user&&loaded?String(rows.filter(myEntry).length):'—';
}
function renderCalendar(){
  const host=$('calendar');host.replaceChildren();
  const firstWeekday=new Date(SETTING.year,SETTING.month-1,SETTING.firstDay,12).getDay();
  if(window.innerWidth>750) for(let i=0;i<firstWeekday;i++)host.append(mk('div','day-blank'));
  const today=new Date();
  for(let d=SETTING.firstDay;d<=SETTING.lastDay;d++){
    const date=dayString(d);
    const rows=user&&loaded?entries.filter(e=>e.date===date).sort((a,b)=>myEntry(a)===myEntry(b)?(a.participantName||'').localeCompare(b.participantName||'','zh-Hant'):myEntry(a)?-1:1):[];
    const cell=mk('article','day-cell'+(rows.some(myEntry)?' has-own':'')+(today.getFullYear()===2026&&today.getMonth()===11&&today.getDate()===d?' today':''));
    const head=mk('div','day-head');const number=mk('div');number.append(mk('span','day-number',d),mk('span','mobile-day','週'+weekdays[new Date(2026,11,d,12).getDay()]));head.append(number,mk('span','day-count',!user?'—':rows.length+' 人'));cell.append(head);
    const roster=mk('div','day-roster');roster.setAttribute('aria-label',dayLabel(date)+'已登記人員');
    if(!user)roster.append(mk('div','empty-day','登入後查看名單'));
    else if(!loaded)roster.append(mk('div','empty-day','資料同步中…'));
    else if(!rows.length)roster.append(mk('div','empty-day','尚無人登記'));
    else rows.forEach(item=>{
      const chip=mk('button','person-chip'+(myEntry(item)?' own':''));chip.type='button';chip.append(document.createTextNode(item.participantName));
      if(myEntry(item))chip.append(mk('span','owner-mark','✧ 我登記的'));
      chip.setAttribute('aria-label',`${item.participantName}；點擊查看登記者及編輯紀錄`);
      chip.addEventListener('pointerenter',e=>positionedTip(e,item));chip.addEventListener('pointermove',e=>positionedTip(e,item));chip.addEventListener('pointerleave',closeTip);chip.addEventListener('blur',closeTip);chip.addEventListener('focus',e=>positionedTip(e,item));
      chip.addEventListener('click',()=>openDialog(date,item.id));roster.append(chip);
    });
    cell.append(roster);
    const action=mk('button','day-action',!user?'登入後新增':!loaded?'同步中…':'+ 登記／查看');action.type='button';action.disabled=!user||!loaded;action.setAttribute('aria-label',dayLabel(date)+'，登記或查看排班');action.addEventListener('click',()=>openDialog(date));cell.append(action);host.append(cell);
  }
  if(window.innerWidth>750){const used=firstWeekday+(SETTING.lastDay-SETTING.firstDay+1);for(let i=(7-used%7)%7;i>0;i--)host.append(mk('div','day-blank'));}
}
function render(){renderStatus();renderCalendar();if(selectedDate)renderDialogRoster();}
function openDialog(date,id=null){
  if(!user||!loaded||!validDate(date))return;
  closeTip();selectedDate=date;lastFocus=document.activeElement;
  $('dialogHeading').textContent=dayLabel(date);$('dialogSubtitle').textContent='2026 DECEMBER / SERVICE ROSTER';
  $('dialogBackdrop').hidden=false;document.body.classList.add('dialog-open');clearForm();renderDialogRoster();
  if(id){const item=entries.find(e=>e.id===id&&e.date===date);if(item){showEntryInfo(item);}}
  $('closeDialog').focus();
}
function closeDialog(){selectedDate=null;$('dialogBackdrop').hidden=true;document.body.classList.remove('dialog-open');closeTip();if(lastFocus?.isConnected)lastFocus.focus();}
function clearForm(){ $('editingId').value='';$('participantName').value='';$('formLabel').textContent='新增排班姓名';$('saveButton').textContent='＋ 新增登記';$('cancelEdit').hidden=true;$('formMessage').textContent=''; }
function startEdit(item){
  if(!myEntry(item)){toast('只能修改由自己 Google 帳號建立的排班',true);return;}
  $('editingId').value=item.id;$('participantName').value=item.participantName;$('formLabel').textContent='修改排班姓名';$('saveButton').textContent='儲存修改';$('cancelEdit').hidden=false;$('formMessage').textContent='修改後將記錄實際編輯者';$('participantName').focus();
}
function showEntryInfo(item){$('formMessage').textContent=`最後修改：${item.editorName||item.editorEmail||'Google 使用者'}／${fmtTimestamp(item.updatedAt)}`;}
function renderDialogRoster(){
  if(!selectedDate)return;const host=$('dialogRoster');host.replaceChildren();
  const rows=entries.filter(e=>e.date===selectedDate).sort((a,b)=>Number(myEntry(b))-Number(myEntry(a)));
  if(!rows.length){host.append(mk('div','no-entries','這一天還沒有人登記，歡迎新增第一位夥伴。'));return;}
  rows.forEach(item=>{
    const line=mk('div','dialog-row');const info=mk('div');info.style.minWidth='0';info.append(mk('div','dialog-name',item.participantName));
    info.append(mk('div','dialog-meta',`建立：${item.ownerName||'Google 使用者'}（${item.ownerEmail||'未提供'}）｜${fmtTimestamp(item.createdAt)}`));
    info.append(mk('div','dialog-meta',`最後編輯：${item.editorName||'Google 使用者'}（${item.editorEmail||'未提供'}）｜${fmtTimestamp(item.updatedAt)}`));line.append(info);
    if(myEntry(item)){
      const actions=mk('div','dialog-actions');const change=mk('button','tiny-button','修改');change.type='button';change.addEventListener('click',()=>startEdit(item));
      const remove=mk('button','tiny-button danger','刪除');remove.type='button';remove.addEventListener('click',()=>deleteEntry(item));actions.append(change,remove);line.append(actions);
    }
    host.append(line);
  });
}
async function saveEntry(event){
  event.preventDefault();if(saving||!user||!loaded||!selectedDate)return;
  const name=plainName($('participantName').value);
  if(!name||name.length>40){$('formMessage').textContent='姓名請填寫 1–40 字';$('participantName').focus();return;}
  if(/[\u0000-\u001f\u007f]/.test(name)){$('formMessage').textContent='請勿輸入控制字元';return;}
  const duplicate=entries.some(e=>e.date===selectedDate&&e.participantName===name&&e.id!==$('editingId').value);
  if(duplicate){$('formMessage').textContent='同一天已有相同姓名，請先確認是否重複登記';return;}
  const editId=$('editingId').value;const original=entries.find(e=>e.id===editId);
  if(editId&&(!original||!myEntry(original)||original.date!==selectedDate)){toast('找不到你有權修改的紀錄',true);return;}
  saving=true;$('saveButton').disabled=true;$('formMessage').textContent='儲存中…';
  try{
    const now=demo?new Date():api.serverTimestamp();const googleName=user.displayName||user.email||'Google 使用者';
    if(demo){
      if(editId){Object.assign(original,{participantName:name,editorUid:user.uid,editorName:googleName,editorEmail:user.email,updatedAt:now});}
      else{entries.push({id:`demo-${Date.now()}-${Math.random().toString(36).slice(2,7)}`,date:selectedDate,participantName:name,ownerUid:user.uid,ownerName:googleName,ownerEmail:user.email,editorUid:user.uid,editorName:googleName,editorEmail:user.email,createdAt:now,updatedAt:now});}
    }else if(editId){
      await api.updateDoc(api.doc(firestore,SETTING.collection,editId),{participantName:name,editorUid:user.uid,editorName:googleName,editorEmail:user.email,updatedAt:api.serverTimestamp()});
    }else{
      await api.addDoc(api.collection(firestore,SETTING.collection),{date:selectedDate,participantName:name,ownerUid:user.uid,ownerName:googleName,ownerEmail:user.email,editorUid:user.uid,editorName:googleName,editorEmail:user.email,createdAt:api.serverTimestamp(),updatedAt:api.serverTimestamp()});
    }
    clearForm();render();toast(editId?'已更新姓名與編輯紀錄':'登記成功：'+name+(demo?'（示範）':''));
  }catch(ex){console.error(ex);$('formMessage').textContent=ex?.code==='permission-denied'?'無權修改這筆紀錄；請確認安全規則已發布':'儲存失敗，請檢查網路或 Firebase 設定';toast('資料未儲存成功',true);}
  finally{saving=false;$('saveButton').disabled=false;}
}
async function deleteEntry(item){
  if(!myEntry(item)||saving)return;
  if(!window.confirm(`確定刪除 ${dayLabel(item.date)} 的「${item.participantName}」登記嗎？`))return;
  saving=true;try{
    if(demo)entries=entries.filter(e=>e.id!==item.id);
    else await api.deleteDoc(api.doc(firestore,SETTING.collection,item.id));
    if($('editingId').value===item.id)clearForm();render();toast('已刪除登記');
  }catch(ex){console.error(ex);toast('無法刪除這筆登記，請檢查權限或網路',true);}
  finally{saving=false;}
}
function csvValue(value){const v=String(value??'');const protectedValue=/^\s*[=+@\-\t\r]/.test(v)?'\''+v:v;return '"'+protectedValue.replace(/"/g,'""')+'"';}
function exportCsv(){
  if(!user||!loaded||demo)return;
  const rows=[['日期','星期','排班姓名','登記者姓名','登記者 Google Email','建立時間','最後編輯者姓名','最後編輯者 Google Email','修改時間'],...entries.filter(e=>validDate(e.date)).sort((a,b)=>a.date.localeCompare(b.date)||a.participantName.localeCompare(b.participantName,'zh-Hant')).map(e=>[e.date,'星期'+weekdays[new Date(2026,11,Number(e.date.slice(-2)),12).getDay()],e.participantName,e.ownerName,e.ownerEmail,fmtTimestamp(e.createdAt),e.editorName,e.editorEmail,fmtTimestamp(e.updatedAt)])];
  const text='\uFEFF'+rows.map(row=>row.map(csvValue).join(',')).join('\r\n');const blob=new Blob([text],{type:'text/csv;charset=utf-8'});const url=URL.createObjectURL(blob);const link=document.createElement('a');link.href=url;link.download='2026年12月服務排班與編輯紀錄.csv';document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),3500);toast('已下載排班 CSV');
}
async function login(){
  if(!auth||!api)return;const button=$('loginButton');button.disabled=true;error('');
  try{await api.signInWithPopup(auth,new api.GoogleAuthProvider());}
  catch(ex){console.error(ex);const code=ex?.code;if(code==='auth/unauthorized-domain')error('登入網域未授權：請到 Firebase Authentication → Settings → Authorized domains 加入你的帳號.github.io。');
    else if(code==='auth/popup-blocked'||code==='auth/operation-not-supported-in-this-environment')error('瀏覽器阻擋 Google 登入。請改用 Safari 或 Chrome 開啟網址，避免 LINE／Facebook 內建瀏覽器。');
    else if(code!=='auth/popup-closed-by-user'&&code!=='auth/cancelled-popup-request')error('Google 登入失敗：'+(ex?.message||'請檢查設定'));
  }finally{button.disabled=false;}
}
async function initFirebase(){
  try{
    const base=`https://www.gstatic.com/firebasejs/${SDK_VERSION}`;
    const [appModule,authModule,fireModule]=await Promise.all([import(`${base}/firebase-app.js`),import(`${base}/firebase-auth.js`),import(`${base}/firebase-firestore.js`)]);
    api={...authModule,...fireModule};const app=appModule.initializeApp(firebaseConfig);auth=authModule.getAuth(app);firestore=fireModule.getFirestore(app);
    authModule.onAuthStateChanged(auth,next=>{
      if(unsubscribe){unsubscribe();unsubscribe=null;}
      user=next;entries=[];loaded=false;error('');if(selectedDate)closeDialog();render();
      if(next){unsubscribe=fireModule.onSnapshot(fireModule.collection(firestore,SETTING.collection),snapshot=>{
        entries=snapshot.docs.map(record=>({id:record.id,...record.data()})).filter(e=>validDate(e.date));loaded=true;error('');render();
      },ex=>{console.error(ex);loaded=false;error('無法讀取排班資料：請確認 Firestore 已建立，且已發布隨附的 firestore.rules。');render();});}
    },ex=>{console.error(ex);error('登入狀態初始化失敗，請重新整理頁面。');});
  }catch(ex){console.error(ex);error('Firebase 初始化失敗：請確認 firebase-config.js 設定正確，並使用 HTTPS 網址開啟。');}
}
$('loginButton').addEventListener('click',login);
$('logoutButton').addEventListener('click',async()=>{if(auth&&api){try{await api.signOut(auth);}catch(ex){toast('登出失敗：'+ex.message,true);}}});
$('exportButton').addEventListener('click',exportCsv);
$('closeDialog').addEventListener('click',closeDialog);
$('dialogBackdrop').addEventListener('click',e=>{if(e.target===$('dialogBackdrop'))closeDialog();});
$('personForm').addEventListener('submit',saveEntry);
$('cancelEdit').addEventListener('click',clearForm);
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&selectedDate)closeDialog();if(e.key==='Tab'&&selectedDate){const nodes=[...$('dialogBackdrop').querySelectorAll('button:not([hidden]):not([disabled]),input:not([hidden]):not([disabled])')].filter(n=>n.getClientRects().length);if(!nodes.length)return;const first=nodes[0],last=nodes[nodes.length-1];if(e.shiftKey&&document.activeElement===first){last.focus();e.preventDefault();}else if(!e.shiftKey&&document.activeElement===last){first.focus();e.preventDefault();}}});
window.addEventListener('resize',()=>{closeTip();renderCalendar();});
window.addEventListener('scroll',closeTip,{passive:true});
render();if(!demo)initFirebase();