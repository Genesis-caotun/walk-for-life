/**
 * 12/1～12/28 志工排班：免登入 Google 試算表後端。
 * 請在此試算表的「擴充功能 → Apps Script」貼上本檔，直接貼上即可，不需新增其他檔案。
 * 部署成：網頁應用程式 → 執行身分「我」→ 存取權「所有人」。
 * 警告：公開免登入，操作人姓名由訪客自行填寫，不能驗證真實身分。
 */
const SPREADSHEET_ID = '11ji7jopZiIEt9QjKI13gEIFIp4o62IhbH7vR8gTIbkY';
const ALLOWED_ORIGIN = 'https://genesis-caotun.github.io';
const DATA_TAB = '排班資料';
const AUDIT_TAB = '操作紀錄';

function doGet(e) {
  const nonce=e && e.parameter && /^[a-zA-Z0-9-]{36,100}$/.test(String(e.parameter.bridge_nonce || '')) ? String(e.parameter.bridge_nonce) : '';
  const html=`<!doctype html>
<html lang="zh-Hant"><head><base target="_top"><meta charset="utf-8"></head>
<body style="margin:0;background:transparent">
<script>
(function(){
  'use strict';
  const approvedOrigin = ${JSON.stringify(ALLOWED_ORIGIN)};
  const bridgeNonce = ${JSON.stringify(nonce)};
  let session = null;
  let lastOrigin = null;
  function send(message, origin) {
    window.top.postMessage(message, origin || approvedOrigin);
  }
  window.addEventListener('message', function(event){
    if (event.source !== window.top || event.origin !== approvedOrigin) return;
    const data = event.data;
    if (!data || typeof data !== 'object') return;
    if (data.type === 'roster:hello' && typeof data.session === 'string' && data.session.length >= 18) {
      session = data.session;
      lastOrigin = event.origin;
      send({type:'roster:ack',session:session},lastOrigin);
      return;
    }
    if (data.type !== 'roster:request' || !session || data.session !== session ||
        typeof data.requestId !== 'string' || !data.payload) return;
    const requestId = data.requestId, sid=session;
    google.script.run
      .withSuccessHandler(function(result){send({type:'roster:response',session:sid,requestId:requestId,result:result},lastOrigin);})
      .withFailureHandler(function(err){send({type:'roster:response',session:sid,requestId:requestId,error:String(err&&err.message||err||'後端錯誤')},lastOrigin);})
      .apiRequest(data.payload);
  });
  if (bridgeNonce) send({type:'roster:ready',nonce:bridgeNonce},approvedOrigin);
})();
</script>
</body></html>`;
  return HtmlService.createHtmlOutput(html).setTitle('志工排班・資料連線')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function checkSetup() {
  const ss=SpreadsheetApp.openById(SPREADSHEET_ID);
  if(!ss.getSheetByName(DATA_TAB)||!ss.getSheetByName(AUDIT_TAB))throw new Error('找不到「排班資料」或「操作紀錄」工作表');
  return '已連上排班試算表';
}
function normName_(input) {
  if(typeof input!=='string')throw new Error('請填寫姓名');
  const name=input.replace(/\s+/g,' ').trim();
  if(!name||[...name].length>40||/[\x00-\x1f\x7f]/.test(name)||/^[=+\-@]/.test(name))throw new Error('姓名必須為 1–40 字，且不能以 = + - @ 開頭');
  return name;
}
function normDate_(input) {
  const date=String(input||'').trim();
  if(!/^2026-12-(0[1-9]|1[0-9]|2[0-8])$/.test(date))throw new Error('只能選擇 2026/12/01～12/28');
  return date;
}
function dateString_(v) {
  if(v instanceof Date)return Utilities.formatDate(v,'Asia/Taipei','yyyy-MM-dd');
  const s=String(v||'').replace(/\//g,'-');
  const m=s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  return m?m[1]+'-'+('0'+m[2]).slice(-2)+'-'+('0'+m[3]).slice(-2):s;
}
function sheets_(){const ss=SpreadsheetApp.openById(SPREADSHEET_ID);const sheet=ss.getSheetByName(DATA_TAB),audit=ss.getSheetByName(AUDIT_TAB);if(!sheet||!audit)throw new Error('排班工作表不存在');return {sheet,audit};}
function list_(sheet) {
  const last=sheet.getLastRow();if(last<=1)return [];
  return sheet.getRange(2,1,last-1,12).getValues().map((v,i)=>({
    row:i+2,id:String(v[0]||''),date:dateString_(v[1]),participantName:String(v[2]||''),
    ownerName:String(v[4]||''),createdAt:v[6] instanceof Date?v[6].toISOString():String(v[6]||''),
    editorName:String(v[8]||''),updatedAt:v[10] instanceof Date?v[10].toISOString():String(v[10]||''),
    status:String(v[11]||'')
  })).filter(x=>x.id&&x.status==='active');
}
function visible_(rows){return rows.map(x=>({id:x.id,date:x.date,participantName:x.participantName,ownerName:x.ownerName,createdAt:x.createdAt,editorName:x.editorName,updatedAt:x.updatedAt}));}
function audit_(sheet,type,item,operator,before,after){sheet.appendRow([new Date().toISOString(),type,item.id,item.date,before||'',after||'','',operator,'','免登入操作；姓名為自行填寫']);}
function apiRequest(request){
  if(!request||typeof request!=='object')throw new Error('格式錯誤');
  const action=String(request.action||'');
  if(!['list','add','update','delete'].includes(action))throw new Error('不支援的操作');
  if(action==='list')return {ok:true,entries:visible_(list_(sheets_().sheet))};
  const actor=normName_(request.actorName);
  const lock=LockService.getScriptLock();lock.waitLock(20000);
  try{
    const {sheet,audit}=sheets_(),rows=list_(sheet);
    if(action==='add'){
      const date=normDate_(request.date),name=normName_(request.participantName);
      if(rows.length>=2000)throw new Error('資料筆數已達上限，請聯絡管理員');
      if(rows.filter(x=>x.date===date).length>=200)throw new Error('這一天登記人數已滿，請聯絡管理員');
      if(rows.some(x=>x.date===date&&x.participantName.toLocaleLowerCase()===name.toLocaleLowerCase()))throw new Error('同一天已有相同姓名');
      const stamp=new Date().toISOString(),id=Utilities.getUuid(),item={id,date,participantName:name};
      sheet.appendRow([id,date,name,'',actor,'',stamp,'',actor,'',stamp,'active']);
      audit_(audit,'新增',item,actor,'',name);
    }else{
      const id=String(request.id||'');
      if(id.length>120)throw new Error('紀錄編號錯誤');
      const item=rows.find(x=>x.id===id);
      if(!item)throw new Error('找不到紀錄，可能已被其他人修改或取消');
      if(action==='update'){
        const name=normName_(request.participantName);
        if(rows.some(x=>x.id!==id&&x.date===item.date&&x.participantName.toLocaleLowerCase()===name.toLocaleLowerCase()))throw new Error('同一天已有相同姓名');
        const stamp=new Date().toISOString();
        sheet.getRange(item.row,3).setValue(name);
        sheet.getRange(item.row,8,1,4).setValues([['',actor,'',stamp]]);
        audit_(audit,'修改',item,actor,item.participantName,name);
      }else{
        sheet.getRange(item.row,8,1,5).setValues([['',actor,'',new Date().toISOString(),'deleted']]);
        audit_(audit,'取消',item,actor,item.participantName,'');
      }
    }
    SpreadsheetApp.flush();
    return {ok:true,entries:visible_(list_(sheet))};
  } finally {lock.releaseLock();}
}