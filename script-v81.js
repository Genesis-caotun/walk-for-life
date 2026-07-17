const menuButton = document.querySelector('.menu-toggle');
const nav = document.querySelector('.nav');
menuButton?.addEventListener('click', () => {
  const open = nav.classList.toggle('open');
  menuButton.setAttribute('aria-expanded', open ? 'true' : 'false');
});
document.querySelectorAll('.nav a').forEach(link => link.addEventListener('click', () => {
  nav.classList.remove('open'); menuButton?.setAttribute('aria-expanded', 'false');
}));

const API_URL = document.querySelector('meta[name="wfl-api-url"]')?.content || '';
const modal = document.querySelector('#form-modal');
const tabs = [...document.querySelectorAll('[data-form-tab]')];
const forms = [...document.querySelectorAll('.native-form')];
const success = document.querySelector('#form-success');
const alertBox = document.querySelector('#form-alert');
let lastFocusedElement = null;
let activeType = 'personal';

function showAlert(message) {
  if (!alertBox) return;
  alertBox.textContent = message;
  alertBox.hidden = !message;
  alertBox.scrollIntoView({behavior:'smooth', block:'nearest'});
}
function selectForm(type) {
  activeType = type;
  showAlert('');
  success.hidden = true;
  forms.forEach(form => {
    const isActive = form.dataset.formType === type;
    form.classList.toggle('active', isActive);
    form.hidden = !isActive;
  });
  tabs.forEach(tab => {
    const isActive = tab.dataset.formTab === type;
    tab.classList.toggle('active', isActive);
    tab.setAttribute('aria-selected', isActive ? 'true' : 'false');
  });
}
function openFormModal(type='personal') {
  lastFocusedElement = document.activeElement;
  modal?.classList.add('open');
  modal?.setAttribute('aria-hidden','false');
  document.body.classList.add('modal-open');
  selectForm(type);
  modal?.querySelector('.form-close')?.focus();
}
function closeFormModal() {
  modal?.classList.remove('open');
  modal?.setAttribute('aria-hidden','true');
  document.body.classList.remove('modal-open');
  lastFocusedElement?.focus?.();
}
document.querySelectorAll('[data-open-form]').forEach(button => button.addEventListener('click', () => openFormModal(button.dataset.openForm)));
tabs.forEach(tab => tab.addEventListener('click', () => selectForm(tab.dataset.formTab)));
document.querySelectorAll('[data-close-form]').forEach(button => button.addEventListener('click', closeFormModal));
document.addEventListener('keydown', e => { if (e.key === 'Escape' && modal?.classList.contains('open')) closeFormModal(); });
document.querySelector('#success-payment-button')?.addEventListener('click', () => selectForm('payment'));

function formObject(form) {
  return Object.fromEntries(new FormData(form).entries());
}
function fileAsBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('名冊讀取失敗，請重新選擇檔案。'));
    reader.onload = () => resolve(String(reader.result).split(',')[1]);
    reader.readAsDataURL(file);
  });
}
async function buildPayload(form) {
  const data = formObject(form);
  data.action = form.dataset.formType;
  if (data.action === 'group') {
    const file = form.querySelector('input[type="file"]')?.files?.[0];
    if (!file) throw new Error('請上傳團體名冊。');
    if (file.size > 5 * 1024 * 1024) throw new Error('名冊檔案請控制在 5MB 以內。');
    data.rosterFile = {name:file.name, mimeType:file.type || 'application/octet-stream', base64:await fileAsBase64(file)};
  }
  return data;
}
function checkGroupCounts(payload) {
  if (payload.action !== 'group') return;
  const total = Number(payload.groupPeople || 0);
  const plans = Number(payload.plan300People || 0) + Number(payload.plan600People || 0);
  if (total !== plans) throw new Error(`團體人數為 ${total} 人，但兩種方案合計為 ${plans} 人，請確認。`);
}
async function sendPayload(payload) {
  if (!API_URL || API_URL.includes('PASTE_YOUR')) throw new Error('網站尚未設定 Apps Script Web App 網址。請先完成後端部署。');
  const response = await fetch(API_URL, {method:'POST', headers:{'Content-Type':'text/plain;charset=utf-8'}, body:JSON.stringify(payload), redirect:'follow'});
  const text = await response.text();
  let result;
  try { result = JSON.parse(text); } catch { throw new Error('後端回應格式不正確，請檢查 Web App 部署權限與網址。'); }
  if (!result.ok) throw new Error(result.message || '送出失敗，請稍後再試。');
  return result;
}
function showSuccess(result, type) {
  forms.forEach(form => {
    form.classList.remove('active');
    form.hidden = true;
  });
  success.hidden = false;
  document.querySelector('#success-title').textContent = type === 'payment' ? '付款資料已送出' : '報名資料已送出';
  document.querySelector('#success-message').textContent = result.message || '我們已收到您的資料。';
  const idWrap = document.querySelector('#success-id-wrap');
  if (result.registrationId) {
    idWrap.hidden = false; document.querySelector('#success-id').textContent = result.registrationId;
  } else idWrap.hidden = true;
}
forms.forEach(form => form.addEventListener('submit', async event => {
  event.preventDefault(); showAlert('');
  const button = form.querySelector('.submit-button');
  button.disabled = true; const original = button.textContent; button.textContent = '資料傳送中…';
  try {
    const payload = await buildPayload(form); checkGroupCounts(payload);
    const result = await sendPayload(payload);
    showSuccess(result, payload.action); form.reset();
  } catch (error) { showAlert(error.message || String(error)); }
  finally { button.disabled = false; button.textContent = original; }
}));


// Ensure only the default form is visible on first load.
selectForm('personal');
