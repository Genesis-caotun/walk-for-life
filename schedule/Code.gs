/**
 * 十二月志工排班 Apps Script API
 * 綁定 Google 試算表，執行身分：部署者本人；存取：任何人。
 * 重要：每個 API 請求都核實 Google ID token，不依賴 Session.getActiveUser().getEmail()。
 */
const SPREADSHEET_ID = '11ji7jopZiIEt9QjKI13gEIFIp4o62IhbH7vR8gTIbkY';
const GOOGLE_CLIENT_ID = 'YOUR_GOOGLE_CLIENT_ID.apps.googleusercontent.com';
const ALLOWED_ORIGIN = 'https://genesis-caotun.github.io';
const ALLOWED_EMAILS = ''; // 若只允許特定人：'abc@gmail.com,def@gmail.com'；空白代表任何已驗證 Google 帳號
const DATA_TAB = '排班資料';
const AUDIT_TAB = '操作紀錄';
const FIRST_DAY = '2026-12-01';
const LAST_DAY = '2026-12-28';

function doGet(e) {
  const page = HtmlService.createTemplateFromFile('Bridge');
  page.allowedOrigin = ALLOWED_ORIGIN;
  page.bridgeNonce = e && e.parameter && /^[A-Za-z0-9-]{36,100}$/.test(String(e.parameter.bridge_nonce || '')) ? String(e.parameter.bridge_nonce) : '';
  return page.evaluate()
    .setTitle('十二月排班・資料安全連線')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function checkSetup() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  if (!ss.getSheetByName(DATA_TAB) || !ss.getSheetByName(AUDIT_TAB)) {
    throw new Error('缺少「排班資料」或「操作紀錄」工作表。');
  }
  return '試算表連接正常。接下來請部署 Apps Script 網頁應用程式。';
}

function verifiedUser_(idToken) {
  if (typeof idToken !== 'string' || idToken.length < 100 || idToken.length > 9000) {
    throw new Error('未取得有效的 Google 登入憑證，請重新登入。');
  }
  if (GOOGLE_CLIENT_ID.indexOf('YOUR_') === 0) throw new Error('尚未設定 Google OAuth Client ID。');
  const endpoint = 'https://oauth2.googleapis.com/tokeninfo?id_token=' + encodeURIComponent(idToken);
  const response = UrlFetchApp.fetch(endpoint, {muteHttpExceptions:true,followRedirects:true});
  if (response.getResponseCode() !== 200) throw new Error('Google 登入已失效，請重新登入。');
  const claim = JSON.parse(response.getContentText());
  if (claim.aud !== GOOGLE_CLIENT_ID ||
      ['accounts.google.com','https://accounts.google.com'].indexOf(claim.iss) === -1 ||
      Number(claim.exp) <= Math.floor(Date.now()/1000) ||
      String(claim.email_verified).toLowerCase() !== 'true' ||
      typeof claim.sub !== 'string' || !claim.sub) {
    throw new Error('Google 登入驗證未通過。');
  }
  const email = String(claim.email || '').trim().toLowerCase();
  if (!email) throw new Error('此 Google 帳號未提供可確認的 Email。');
  const allowed = ALLOWED_EMAILS.split(',').map(x=>x.trim().toLowerCase()).filter(Boolean);
  if (allowed.length && allowed.indexOf(email) === -1) throw new Error('目前未開放此 Google 帳號登記，請聯繫主辦單位。');
  return {uid:claim.sub, name:String(claim.name||email).slice(0,120), email:email};
}
function sanitizeName_(name) {
  if (typeof name !== 'string') throw new Error('請輸入姓名。');
  const v = name.replace(/\s+/g,' ').trim();
  if (!v || [...v].length > 40 || /[\x00-\x1F\x7F]/.test(v) || /^[=+\-@]/.test(v)) {
    throw new Error('姓名須為 1–40 字，且不可包含控制字元或試算表公式起始符號。');
  }
  return v;
}
function dateCheck_(date) {
  if (typeof date !== 'string' || date < FIRST_DAY || date > LAST_DAY || !/^2026-12-(0[1-9]|1\d|2[0-8])$/.test(date)) {
    throw new Error('只能選擇 2026 年 12 月 1 日至 28 日。');
  }
  return date;
}
function data_() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName(DATA_TAB), audit = ss.getSheetByName(AUDIT_TAB);
  if (!sheet || !audit) throw new Error('排班試算表缺少工作表。');
  return {sheet,audit};
}
function list_(sheet) {
  const last = sheet.getLastRow();
  if (last < 2) return [];
  const rows = sheet.getRange(2,1,last-1,12).getDisplayValues();
  return rows.map((row,i)=>({
    row:i+2,id:row[0],date:row[1],participantName:row[2],
    ownerUid:row[3],ownerName:row[4],ownerEmail:row[5],createdAt:row[6],
    editorUid:row[7],editorName:row[8],editorEmail:row[9],updatedAt:row[10],status:row[11]
  })).filter(x=>x.id && x.status === 'active');
}
function rowsForUI_(rows) {
  return rows.map(x=>({id:x.id,date:x.date,participantName:x.participantName,
    ownerUid:x.ownerUid,ownerName:x.ownerName,ownerEmail:x.ownerEmail,createdAt:x.createdAt,
    editorUid:x.editorUid,editorName:x.editorName,editorEmail:x.editorEmail,updatedAt:x.updatedAt}));
}
function log_(sheet, action, item, actor, before, after) {
  sheet.appendRow([new Date().toISOString(),action,item.id,item.date,before||'',after||'',actor.uid,actor.name,actor.email,'網頁操作']);
}
function apiRequest(request) {
  if (!request || typeof request !== 'object') throw new Error('資料格式錯誤。');
  const actor = verifiedUser_(request.idToken);
  const action = String(request.action || '');
  if (['list','add','update','delete'].indexOf(action) < 0) throw new Error('不支援的操作。');
  if (action === 'list') {
    const sheets=data_();
    return {ok:true,profile:actor,entries:rowsForUI_(list_(sheets.sheet))};
  }

  const lock=LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const {sheet,audit}=data_();
    const rows=list_(sheet);
    if (action === 'add') {
      const date=dateCheck_(request.date), name=sanitizeName_(request.participantName);
      if (rows.some(x=>x.date===date && x.participantName.toLocaleLowerCase()===name.toLocaleLowerCase())) {
        throw new Error('這一天已有相同姓名，請先確認是否重複登記。');
      }
      const time=new Date().toISOString();
      const item={id:Utilities.getUuid(),date,participantName:name,ownerUid:actor.uid,
        ownerName:actor.name,ownerEmail:actor.email,createdAt:time,
        editorUid:actor.uid,editorName:actor.name,editorEmail:actor.email,updatedAt:time};
      sheet.appendRow([item.id,date,name,actor.uid,actor.name,actor.email,time,actor.uid,actor.name,actor.email,time,'active']);
      log_(audit,'新增',item,actor,'',name);
    } else {
      const id=String(request.id||'');
      const item=rows.find(x=>x.id===id);
      if (!item) throw new Error('找不到此筆登記，可能已被刪除。');
      if (item.ownerUid!==actor.uid) throw new Error('只能修改或取消自己 Google 帳號建立的登記。');
      if (action === 'update') {
        const name=sanitizeName_(request.participantName);
        if (rows.some(x=>x.id!==id&&x.date===item.date&&x.participantName.toLocaleLowerCase()===name.toLocaleLowerCase())) {
          throw new Error('這一天已有相同姓名，請先確認是否重複登記。');
        }
        const time=new Date().toISOString();
        sheet.getRange(item.row,3,1,1).setValue(name);
        sheet.getRange(item.row,8,1,4).setValues([[actor.uid,actor.name,actor.email,time]]);
        log_(audit,'修改',item,actor,item.participantName,name);
      } else {
        sheet.getRange(item.row,8,1,5).setValues([[actor.uid,actor.name,actor.email,new Date().toISOString(),'deleted']]);
        log_(audit,'取消',item,actor,item.participantName,'');
      }
    }
    SpreadsheetApp.flush();
    return {ok:true,profile:actor,entries:rowsForUI_(list_(sheet))};
  } finally {lock.releaseLock();}
}
