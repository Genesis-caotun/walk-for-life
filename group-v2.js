/*************************************************
 * Walk for Life 2026｜團體報名 V2 前端
 *
 * 不再上傳 Excel。
 * 團體聯絡人直接在網站逐筆新增成員。
 *************************************************/

(() => {
  const MAX_MEMBERS = 100;
  const PLAN_300 = '公益響應組300元';
  const PLAN_600 = '守護完賽組600元';

  function init() {
    const form = document.querySelector('#group-form');
    const container = document.querySelector('#group-members');
    const addButton = document.querySelector('#add-group-member');

    if (!form || !container || !addButton) return;

    const API_URL = document.querySelector('meta[name="wfl-api-url"]')?.content || '';

    const countEl = document.querySelector('#group-member-count');
    const count300El = document.querySelector('#group-plan300-count');
    const count600El = document.querySelector('#group-plan600-count');
    const totalEl = document.querySelector('#group-total-amount');

    function escapeHtml(value) {
      return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
    }

    function memberCard(index, values = {}) {
      const card = document.createElement('article');
      card.className = 'group-member-card';
      card.dataset.memberIndex = String(index);

      const currentYear = new Date().getFullYear();

      card.innerHTML = `
        <div class="group-member-card-header">
          <div>
            <span class="group-member-kicker">MEMBER</span>
            <h4>成員 ${index + 1}</h4>
          </div>
          <button type="button" class="group-member-remove" data-remove-member ${index === 0 ? 'hidden' : ''}>
            移除此成員
          </button>
        </div>

        <div class="group-member-fields">
          <label class="field">
            <span>姓名 *</span>
            <input data-member-field="name" required maxlength="50" autocomplete="off" value="${escapeHtml(values.name || '')}">
          </label>

          <label class="field">
            <span>電子郵件</span>
            <input data-member-field="email" type="email" maxlength="120" autocomplete="off" value="${escapeHtml(values.email || '')}">
            <small>選填；若未填，完賽證書將寄給團體聯絡人。</small>
          </label>

          <label class="field">
            <span>出生年份</span>
            <input data-member-field="birthYear" type="number" min="1900" max="${currentYear}" step="1" inputmode="numeric" placeholder="例如 1990" value="${escapeHtml(values.birthYear || '')}">
            <small>選填，僅供活動參與統計使用。</small>
          </label>

          <label class="field">
            <span>報名方案 *</span>
            <select data-member-field="plan" required>
              <option value="">請選擇</option>
              <option value="${PLAN_300}" ${values.plan === PLAN_300 ? 'selected' : ''}>公益響應組｜NT$ 300</option>
              <option value="${PLAN_600}" ${values.plan === PLAN_600 ? 'selected' : ''}>守護完賽組｜NT$ 600</option>
            </select>
          </label>
        </div>
      `;

      card.querySelector('[data-remove-member]')?.addEventListener('click', () => {
        card.remove();
        renumberMembers();
        updateSummary();
      });

      card.addEventListener('input', updateSummary);
      card.addEventListener('change', updateSummary);
      return card;
    }

    function addMember(values = {}) {
      const current = container.querySelectorAll('.group-member-card').length;
      if (current >= MAX_MEMBERS) {
        window.alert(`網站團體報名最多可輸入 ${MAX_MEMBERS} 位成員；如需更大量報名，請聯絡創世基金會草屯分院。`);
        return;
      }
      const card = memberCard(current, values);
      container.appendChild(card);
      renumberMembers();
      updateSummary();
      card.querySelector('[data-member-field="name"]')?.focus();
    }

    function renumberMembers() {
      [...container.querySelectorAll('.group-member-card')].forEach((card, index) => {
        card.dataset.memberIndex = String(index);
        const title = card.querySelector('h4');
        if (title) title.textContent = `成員 ${index + 1}`;
        const remove = card.querySelector('[data-remove-member]');
        if (remove) remove.hidden = index === 0;
      });
    }

    function collectMembers({validate = false} = {}) {
      const cards = [...container.querySelectorAll('.group-member-card')];
      const members = cards.map((card, index) => {
        const name = card.querySelector('[data-member-field="name"]')?.value.trim() || '';
        const email = card.querySelector('[data-member-field="email"]')?.value.trim() || '';
        const birthYear = card.querySelector('[data-member-field="birthYear"]')?.value.trim() || '';
        const plan = card.querySelector('[data-member-field="plan"]')?.value || '';

        if (validate) {
          if (!name) throw new Error(`請填寫成員 ${index + 1} 的姓名。`);
          if (!plan) throw new Error(`請選擇成員 ${index + 1} 的報名方案。`);

          const emailInput = card.querySelector('[data-member-field="email"]');
          if (email && emailInput && !emailInput.checkValidity()) {
            throw new Error(`成員 ${index + 1} 的電子郵件格式不正確。`);
          }

          if (birthYear) {
            const year = Number(birthYear);
            const currentYear = new Date().getFullYear();
            if (!Number.isInteger(year) || year < 1900 || year > currentYear) {
              throw new Error(`成員 ${index + 1} 的出生年份不正確。`);
            }
          }
        }

        return {name, email, birthYear, plan};
      });

      if (validate && members.length < 1) throw new Error('請至少新增一位團體成員。');
      return members;
    }

    function updateSummary() {
      const members = collectMembers();
      const count300 = members.filter(m => m.plan === PLAN_300).length;
      const count600 = members.filter(m => m.plan === PLAN_600).length;
      const total = count300 * 300 + count600 * 600;

      if (countEl) countEl.textContent = String(members.length);
      if (count300El) count300El.textContent = String(count300);
      if (count600El) count600El.textContent = String(count600);
      if (totalEl) totalEl.textContent = `NT$ ${total.toLocaleString('zh-TW')}`;
    }

    function showFormAlert(message) {
      const alertBox = document.querySelector('#form-alert');
      if (!alertBox) {
        window.alert(message);
        return;
      }
      alertBox.textContent = message;
      alertBox.hidden = !message;
      if (message) alertBox.scrollIntoView({behavior:'smooth', block:'nearest'});
    }

    function showGroupSuccess(result) {
      document.querySelectorAll('.native-form').forEach(item => {
        item.classList.remove('active');
        item.hidden = true;
      });

      const success = document.querySelector('#form-success');
      if (!success) return;
      success.hidden = false;

      const title = document.querySelector('#success-title');
      const message = document.querySelector('#success-message');
      const idWrap = document.querySelector('#success-id-wrap');
      const id = document.querySelector('#success-id');

      if (title) title.textContent = '團體報名資料已送出';
      if (message) message.textContent = result.message || '我們已收到您的團體報名資料。';

      if (result.registrationId && idWrap && id) {
        idWrap.hidden = false;
        id.textContent = result.registrationId;
      }
    }

    async function sendPayload(payload) {
      if (!API_URL || API_URL.includes('PASTE_YOUR')) {
        throw new Error('網站尚未設定 Apps Script Web App 網址。');
      }

      const response = await fetch(API_URL, {
        method: 'POST',
        headers: {'Content-Type':'text/plain;charset=UTF-8'},
        body: JSON.stringify(payload),
        redirect: 'follow',
        cache: 'no-store'
      });

      const text = await response.text();
      let result;
      try {
        result = JSON.parse(text);
      } catch (_) {
        console.error('團體報名 API 回傳：', text);
        throw new Error('後端回應格式不正確，請稍後再試。');
      }

      if (!result.ok) throw new Error(result.message || '團體報名送出失敗。');
      return result;
    }

    function resetMembers() {
      container.innerHTML = '';
      addMember();
      updateSummary();
    }

    addButton.addEventListener('click', () => addMember());

    // 使用 capture + stopImmediatePropagation，僅接管團體表單；
    // 個人報名及付款回報仍完全交給原本 script-v86.js。
    form.addEventListener('submit', async event => {
      event.preventDefault();
      event.stopImmediatePropagation();
      showFormAlert('');

      const submitButton = form.querySelector('.submit-button');
      const originalText = submitButton?.textContent || '送出團體報名';

      try {
        if (!form.reportValidity()) return;

        const members = collectMembers({validate:true});
        const formData = new FormData(form);

        if (formData.get('website')) throw new Error('資料驗證失敗，請重新整理頁面後再試。');

        const payload = {
          action: 'group-v2',
          groupName: String(formData.get('groupName') || '').trim(),
          groupType: String(formData.get('groupType') || '').trim(),
          contactName: String(formData.get('contactName') || '').trim(),
          phone: String(formData.get('phone') || '').trim(),
          email: String(formData.get('email') || '').trim(),
          address: String(formData.get('address') || '').trim(),
          receipt: String(formData.get('receipt') || '不需要').trim(),
          receiptTitle: String(formData.get('receiptTitle') || '').trim(),
          note: String(formData.get('note') || '').trim(),
          privacyConsent: String(formData.get('privacyConsent') || ''),
          website: String(formData.get('website') || ''),
          members
        };

        if (submitButton) {
          submitButton.disabled = true;
          submitButton.textContent = '團體資料傳送中…';
        }

        const result = await sendPayload(payload);
        showGroupSuccess(result);
        form.reset();
        resetMembers();
      } catch (error) {
        showFormAlert(error.message || String(error));
      } finally {
        if (submitButton) {
          submitButton.disabled = false;
          submitButton.textContent = originalText;
        }
      }
    }, true);

    resetMembers();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
