/* WFL: preselect plan and enforce announced submission deadlines (Taiwan time). */
document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('[data-plan-value]').forEach(button => {
    button.addEventListener('click', () => {
      const radios = document.querySelectorAll('#personal-form input[name="plan"]');
      radios.forEach(radio => {
        radio.checked = radio.value === button.dataset.planValue;
        if (radio.checked) radio.dispatchEvent(new Event('change', { bubbles: true }));
      });
    });
  });
  const deadlines = {
    personal: ['2026-11-24T00:00:00+08:00', '報名已於 11/23 截止。'],
    group: ['2026-11-24T00:00:00+08:00', '報名已於 11/23 截止。'],
    payment: ['2026-11-26T00:00:00+08:00', '付款回報已於 11/25 截止。'],
    finish: ['2026-12-01T00:00:00+08:00', '完賽上傳已於 11/30 截止。']
  };
  document.addEventListener('submit', event => {
    const type = event.target.id === 'finish-form' ? 'finish' : event.target.dataset.formType;
    const rule = deadlines[type];
    if (rule && Date.now() >= Date.parse(rule[0])) {
      event.preventDefault(); event.stopImmediatePropagation();
      window.alert(rule[1] + ' 如需補件或協助，請撥 049-2551119 分機 12，許先生。');
    }
  }, true);
  const input = document.querySelector('[name="finishImage"]');
  const status = document.getElementById('finish-file-status');
  if (input && status) input.addEventListener('change', () => {
    status.textContent = input.files.length ? `已選擇 ${input.files.length} 張截圖：${Array.from(input.files, f => f.name).join('、')}` : '尚未選擇截圖';
  });
});
