/**
 * Walk for Life Registration API v1.0
 *
 * 使用方式：
 * 1. 將本檔新增到「團體報名」Apps Script 專案中，保留原本完整團體腳本。
 * 2. 部署為 Web App：執行身分選「我」，存取權選「任何人」。
 * 3. 把部署網址貼到官網 index.html 的 wfl-api-url meta content。
 */
const WFL_API_CONFIG = {
  PERSONAL_SHEET_ID: '1MzJeCjPT0SRI18Iby8Ef3caUTcYoyTodfmPfAmBSuiA',
  GROUP_SHEET_ID: '12Mn2LaA5xuyFRmQ63Z2vz90HhE2L5F-y9QHGk9R2rf8',
  PAYMENT_SHEET_ID: '1H0KQ7yqXIw9cZZs2US7t-KEmO0AmdSbIV9yK2j-6POo',
  RESPONSE_SHEET: '表單回覆 1',
  EVENT_YEAR: '26',
  PERSONAL_PREFIX: 'WFL',
  PAYMENT_FORM_URL: 'https://docs.google.com/forms/d/1CRFukkB94ts6Eh_-Sh0KMppnV8pkFx6jRYonje7ix2c/viewform',
  CREDIT_CARD_URL: 'https://www.genesis.org.tw/',
  POSTAL_ACCOUNT: '22542803',
  BANK_NAME: '土地銀行',
  BANK_CODE: '005',
  BANK_ACCOUNT: '082-001-011-525',
  ACCOUNT_NAME: '財團法人創世社會福利基金會',
  PHONE: '049-2551119',
  LINE_ID: '@029orwgj'
};

function doGet() {
  return apiJson_({ok:true, service:'WFL Registration API', version:'1.0'});
}
function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const payload = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    let result;
    if (payload.action === 'personal') result = apiCreatePersonal_(payload);
    else if (payload.action === 'group') result = apiCreateGroup_(payload);
    else if (payload.action === 'payment') result = apiCreatePayment_(payload);
    else throw new Error('不支援的操作類型。');
    return apiJson_(Object.assign({ok:true}, result));
  } catch (error) {
    console.error(error);
    return apiJson_({ok:false, message:error.message || String(error)});
  } finally { lock.releaseLock(); }
}
function apiJson_(data) {
  return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON);
}
function apiSheet_(spreadsheetId) {
  const sheet = SpreadsheetApp.openById(spreadsheetId).getSheetByName(WFL_API_CONFIG.RESPONSE_SHEET);
  if (!sheet) throw new Error('找不到工作表：' + WFL_API_CONFIG.RESPONSE_SHEET);
  return sheet;
}
function apiHeaders_(sheet) {
  return sheet.getRange(1,1,1,sheet.getLastColumn()).getDisplayValues()[0].map(v => String(v).trim());
}
function apiAppendByHeaders_(sheet, values) {
  const headers = apiHeaders_(sheet);
  const row = headers.map(h => Object.prototype.hasOwnProperty.call(values,h) ? values[h] : '');
  sheet.appendRow(row);
  return {row:sheet.getLastRow(), headers:headers};
}
function apiSet_(sheet,row,headers,name,value) {
  const index=headers.indexOf(name); if(index<0) throw new Error('找不到欄位：'+name);
  sheet.getRange(row,index+1).setValue(value);
}
function apiNextPersonalId_(sheet,headers) {
  const col=headers.indexOf('報名編號')+1; if(!col) throw new Error('找不到報名編號欄位。');
  const last=sheet.getLastRow(); let high=0;
  if(last>=2) sheet.getRange(2,col,last-1,1).getDisplayValues().flat().forEach(id=>{
    const m=String(id).trim().match(/^WFL26(\d+)$/); if(m) high=Math.max(high,Number(m[1]));
  });
  return WFL_API_CONFIG.PERSONAL_PREFIX+WFL_API_CONFIG.EVENT_YEAR+String(high+1).padStart(4,'0');
}
function apiCreatePersonal_(p) {
  ['name','email','phone','plan','birthDate','address'].forEach(k=>{if(!String(p[k]||'').trim()) throw new Error('個人報名資料不完整：'+k);});
  const sheet=apiSheet_(WFL_API_CONFIG.PERSONAL_SHEET_ID), headers=apiHeaders_(sheet);
  const id=apiNextPersonalId_(sheet,headers), now=new Date();
  const appended=apiAppendByHeaders_(sheet,{
    '報名編號':id,'報名日期':now,'付款狀態':'待付款','報名狀態':'已收到報名資料','時間戳記':now,
    '電子郵件地址':p.email,'姓名':p.name,'性別':p.gender,'出生年月日':p.birthDate,'手機號碼/電話':p.phone,
    '收件地址':p.address,'報名方案':p.plan,'捐款收據':p.receipt,'收據抬頭':p.receiptTitle,'其他':p.note,
    '我願意收到創世基金會草屯院最新活動資訊':p.newsConsent||'否'
  });
  apiSendPersonalEmail_(p,id);
  apiSet_(sheet,appended.row,appended.headers,'Email已通知','已寄送');
  return {registrationId:id,message:'報名編號與付款資訊已寄到 '+p.email+'。'};
}
function apiCreateGroup_(p) {
  ['groupName','contactName','email','phone','address','groupPeople'].forEach(k=>{if(!String(p[k]||'').trim()) throw new Error('團體報名資料不完整：'+k);});
  const total=Number(p.groupPeople), p300=Number(p.plan300People||0), p600=Number(p.plan600People||0);
  if(total!==p300+p600) throw new Error('團體人數與方案人數合計不一致。');
  if(!p.rosterFile || !p.rosterFile.base64) throw new Error('沒有收到團體名冊。');
  const folder=apiGetRosterFolder_();
  const blob=Utilities.newBlob(Utilities.base64Decode(p.rosterFile.base64),p.rosterFile.mimeType||'application/octet-stream',p.rosterFile.name||'團體名冊.xlsx');
  const file=folder.createFile(blob);
  const sheet=apiSheet_(WFL_API_CONFIG.GROUP_SHEET_ID), now=new Date();
  const appended=apiAppendByHeaders_(sheet,{
    '時間戳記':now,'團體名稱':p.groupName,'團體類型':p.groupType,'團體聯絡人姓名':p.contactName,'聯絡電話':p.phone,
    '電子郵件':p.email,'統一收件地址':p.address,'團體人數':total,'公益響應組300元人數':p300,
    '守護完賽組600元人數':p600,'團體名冊上傳':file.getUrl(),'備註':p.note,'是否需要捐款收據':p.receipt,
    '收據抬頭':p.receiptTitle,'收據寄送地址是否同收件地址':'是',
    '我確認以上資料及上傳名冊內容正確，並同意創世基金會為本次活動報名、聯繫、寄送及行政作業使用相關資料。':'同意'
  });
  // 呼叫既有團體腳本：產生編號、驗證名冊、匯入成員、號碼布及寄信。
  if(typeof handleGroupFormSubmit!=='function') throw new Error('找不到既有 handleGroupFormSubmit，請把 API.gs 放在團體腳本同一專案。');
  handleGroupFormSubmit({range:sheet.getRange(appended.row,1)});
  const id=sheet.getRange(appended.row,appended.headers.indexOf('團體編號')+1).getDisplayValue();
  return {registrationId:id,message:'團體報名資料已送出，系統處理結果已寄到 '+p.email+'。'};
}
function apiCreatePayment_(p) {
  ['registrationId','payerName','paymentMethod','paymentDate','amount','phone'].forEach(k=>{if(!String(p[k]||'').trim()) throw new Error('付款回報資料不完整：'+k);});
  const sheet=apiSheet_(WFL_API_CONFIG.PAYMENT_SHEET_ID), now=new Date();
  apiAppendByHeaders_(sheet,{
    '時間戳記':now,'報名編號':String(p.registrationId).trim().toUpperCase(),'付款人姓名':p.payerName,
    '付款方式':p.paymentMethod,'付款日期':p.paymentDate,'付款金額':Number(p.amount),
    '轉帳帳號後五碼/信用卡訂單編號':p.referenceNumber,'聯絡電話':p.phone
  });
  return {message:'付款資料已送出，工作人員完成對帳後會再寄送正式確認通知。'};
}
function apiGetRosterFolder_() {
  const folders=DriveApp.getRootFolder().getFoldersByName('WFL');
  return folders.hasNext()?folders.next():DriveApp.getRootFolder().createFolder('WFL');
}
function apiPlanAmount_(plan) { return String(plan).includes('600')?600:300; }
function apiEscape_(v){return String(v||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');}
function apiSendPersonalEmail_(p,id) {
  const amount=apiPlanAmount_(p.plan), subject='【Walk for Life】已收到報名資料｜'+id;
  const body=p.name+' 您好：\n\n我們已收到您的 Walk for Life 報名資料。\n\n報名編號：'+id+'\n報名方案：'+p.plan+'\n應繳金額：NT$ '+amount+'\n\n郵政劃撥：'+WFL_API_CONFIG.POSTAL_ACCOUNT+'\n銀行：'+WFL_API_CONFIG.BANK_NAME+'（'+WFL_API_CONFIG.BANK_CODE+'）\n帳號：'+WFL_API_CONFIG.BANK_ACCOUNT+'\n戶名：'+WFL_API_CONFIG.ACCOUNT_NAME+'\n\n官網信用卡付款：'+WFL_API_CONFIG.CREDIT_CARD_URL+'\n付款回報：'+WFL_API_CONFIG.PAYMENT_FORM_URL+'\n\n電話：'+WFL_API_CONFIG.PHONE+'\nLINE：'+WFL_API_CONFIG.LINE_ID;
  const html='<div style="max-width:640px;margin:auto;font-family:Arial,Noto Sans TC,sans-serif;line-height:1.8;color:#333"><div style="background:#174c46;color:#fff;padding:25px"><h2>Walk for Life 2026</h2><p>為植物人而走</p></div><div style="padding:26px;border:1px solid #ddd"><p>'+apiEscape_(p.name)+' 您好：</p><p>我們已收到您的報名資料。</p><div style="padding:18px;background:#f4f0e9;border-left:5px solid #d98c3f"><div>報名編號</div><strong style="font-size:26px;color:#174c46">'+id+'</strong><div>報名方案：'+apiEscape_(p.plan)+'</div><div>應繳金額：NT$ '+amount+'</div></div><h3 style="color:#174c46">付款資訊</h3><p>郵政劃撥：'+WFL_API_CONFIG.POSTAL_ACCOUNT+'<br>銀行：'+WFL_API_CONFIG.BANK_NAME+'（'+WFL_API_CONFIG.BANK_CODE+'）<br>帳號：'+WFL_API_CONFIG.BANK_ACCOUNT+'<br>戶名：'+WFL_API_CONFIG.ACCOUNT_NAME+'</p><p><a href="'+WFL_API_CONFIG.CREDIT_CARD_URL+'" style="display:inline-block;padding:12px 20px;background:#174c46;color:#fff;text-decoration:none;border-radius:8px">前往官網信用卡付款</a></p><p><a href="'+WFL_API_CONFIG.PAYMENT_FORM_URL+'">完成付款後填寫付款回報</a></p></div></div>';
  MailApp.sendEmail({to:p.email,subject:subject,body:body,htmlBody:html,name:'Walk for Life｜創世草屯院'});
}
