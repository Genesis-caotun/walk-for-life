/* WFL payment ID required 2026-10-30. No public registration lookup. */
(() => {
  const form = document.getElementById('payment-form');
  if (!form) return;
  const field = name => form.elements.namedItem(name);
  const identity = field('registrationId');
  const date = field('paymentDate');
  const method = field('paymentMethod');
  const reference = field('referenceNumber');
  const referenceWrap = document.getElementById('payment-reference-field');
  const referenceLabel = document.getElementById('payment-reference-label');
  const today = () => new Intl.DateTimeFormat('sv-SE', {timeZone:'Asia/Taipei',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
  function dateDefault() {
    date.max = today();
    if (!date.value) date.value = date.max;
    date.setCustomValidity(date.value > date.max ? '付款日期不可晚於今天。' : '');
  }
  function methodChanged() {
    const bank = method.value === '銀行轉帳';
    const card = method.value === '信用卡';
    referenceWrap.hidden = !(bank || card);
    reference.disabled = !(bank || card);
    reference.required = bank;
    reference.maxLength = bank ? 5 : 50;
    referenceLabel.textContent = bank ? '轉出帳號末五碼 *' : '官網訂單編號（選填）';
    reference.placeholder = bank ? '例如 01234' : '有訂單編號可填寫，方便核對';
    if (bank) {reference.pattern = '[0-9]{5}';reference.inputMode = 'numeric';}
    else {reference.removeAttribute('pattern');reference.inputMode = 'text';}
    reference.setCustomValidity('');
  }
  method.addEventListener('change', () => {reference.value='';methodChanged();});
  date.addEventListener('change', dateDefault);
  form.addEventListener('reset', () => setTimeout(() => {dateDefault();methodChanged();},0));
  const oldBuild = window.buildPayload;
  window.buildPayload = async function(f) {
    if (f !== form) return oldBuild(f);
    const data = Object.fromEntries(new FormData(f).entries());
    const value = String(data.registrationId || '').trim();
    if (!value) throw new Error('請填寫報名編號。');
    const isId = /^(?:WFL26\d{4,6}|WFLG\d{3})$/i.test(value);
    if (!isId) throw new Error('請填寫正確的個人報名編號（例如 WFL260001）或團體編號（例如 WFLG001）。');
    data.action = 'payment';
    data.registrationId = value.toUpperCase();
    delete data.registrationName;
    delete data.registrationIdentity;
    return data;
  };
  const idParam = new URLSearchParams(location.search).get('registrationId') || '';
  if (/^(?:WFL26\d{4,6}|WFLG\d{3})$/i.test(idParam)) identity.value=idParam.toUpperCase();
  // Existing success panel handles both personal and group registration.
  // Only use values already present on this browser page, never query records by ID.
  let lastAmount = '';
  document.addEventListener('submit', event => {
    const f=event.target;
    if (f.id === 'personal-form') {
      const plan=f.querySelector('[name="plan"]:checked')?.value;
      lastAmount=plan==='守護完賽組600元'?'600':plan==='公益響應組300元'?'300':'';
    }
    if (f.id === 'group-form') {
      const plans=[...f.querySelectorAll('select')].map(el=>el.value).filter(v=>['公益響應組300元','守護完賽組600元'].includes(v));
      lastAmount=plans.length?String(plans.reduce((n,v)=>n+(v==='守護完賽組600元'?600:300),0)):'';
    }
  },true);
  document.getElementById('success-payment-button')?.addEventListener('click', () => {
    const id=document.getElementById('success-id')?.textContent.trim() || '';
    if (/^(?:WFL26\d{4,6}|WFLG\d{3})$/.test(id)) {
      identity.value=id;
      if (lastAmount) field('amount').value=lastAmount;
    }
    dateDefault();
  });
  function init(){dateDefault();methodChanged();}
  if (document.readyState==='loading') document.addEventListener('DOMContentLoaded',init);else init();
})();
