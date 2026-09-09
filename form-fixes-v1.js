/**
 * Walk for Life｜表單安全補強 v1
 * 1. 個人出生年月日不得晚於今天
 * 2. 付款日期不得晚於今天
 *
 * 後端 WFL_FINISH.gs 也會再次驗證，
 * 因此前端限制被繞過時仍不會接受未來日期。
 */
(() => {
  function localToday() {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  function applyDateLimits() {
    const today = localToday();

    const birthDate = document.querySelector('#personal-form input[name="birthDate"]');
    if (birthDate) {
      birthDate.max = today;
      birthDate.addEventListener('change', () => {
        birthDate.setCustomValidity(
          birthDate.value && birthDate.value > today
            ? '出生年月日不可晚於今天。'
            : ''
        );
      });
    }

    const paymentDate = document.querySelector('#payment-form input[name="paymentDate"]');
    if (paymentDate) {
      paymentDate.max = today;
      paymentDate.addEventListener('change', () => {
        paymentDate.setCustomValidity(
          paymentDate.value && paymentDate.value > today
            ? '付款日期不可晚於今天。'
            : ''
        );
      });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', applyDateLimits);
  } else {
    applyDateLimits();
  }
})();
