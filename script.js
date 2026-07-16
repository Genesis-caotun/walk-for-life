const menuButton = document.querySelector('.menu-toggle');
const nav = document.querySelector('.nav');
menuButton?.addEventListener('click', () => {
  const open = nav.classList.toggle('open');
  menuButton.setAttribute('aria-expanded', open ? 'true' : 'false');
});
document.querySelectorAll('.nav a').forEach(link => {
  link.addEventListener('click', () => {
    nav.classList.remove('open');
    menuButton?.setAttribute('aria-expanded', 'false');
  });
});


const formModal = document.querySelector('#form-modal');
const formFrame = document.querySelector('#registration-frame');
const formLoading = document.querySelector('#form-loading');
const externalFormLink = document.querySelector('#external-form-link');
const formTabs = [...document.querySelectorAll('[data-form-tab]')];
let lastFocusedElement = null;

const formConfig = {
  personal: {
    title: 'Walk for Life 個人報名表',
    url: formFrame?.dataset.personalUrl || ''
  },
  group: {
    title: 'Walk for Life 團體報名表',
    url: formFrame?.dataset.groupUrl || ''
  },
  payment: {
    title: 'Walk for Life 付款回報表',
    url: formFrame?.dataset.paymentUrl || ''
  }
};

function externalUrl(url) {
  return url.replace('?embedded=true', '?usp=header').replace('&embedded=true', '');
}

function selectForm(type) {
  const selected = formConfig[type] || formConfig.personal;
  formTabs.forEach(tab => {
    const active = tab.dataset.formTab === type;
    tab.classList.toggle('active', active);
    tab.setAttribute('aria-selected', active ? 'true' : 'false');
  });

  if (!formFrame || formFrame.src === selected.url) return;
  formLoading?.classList.remove('hidden');
  formFrame.classList.remove('loaded');
  formFrame.title = selected.title;
  formFrame.src = selected.url;
  if (externalFormLink) externalFormLink.href = externalUrl(selected.url);
}

function openFormModal(type = 'personal') {
  if (!formModal) return;
  lastFocusedElement = document.activeElement;
  formModal.classList.add('open');
  formModal.setAttribute('aria-hidden', 'false');
  document.body.classList.add('modal-open');
  selectForm(type);
  formModal.querySelector('.form-close')?.focus();
}

function closeFormModal() {
  if (!formModal) return;
  formModal.classList.remove('open');
  formModal.setAttribute('aria-hidden', 'true');
  document.body.classList.remove('modal-open');
  lastFocusedElement?.focus?.();
}

document.querySelectorAll('[data-open-form]').forEach(button => {
  button.addEventListener('click', () => openFormModal(button.dataset.openForm));
});
formTabs.forEach(tab => tab.addEventListener('click', () => selectForm(tab.dataset.formTab)));
document.querySelectorAll('[data-close-form]').forEach(button => button.addEventListener('click', closeFormModal));
formFrame?.addEventListener('load', () => {
  formLoading?.classList.add('hidden');
  formFrame.classList.add('loaded');
});
document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && formModal?.classList.contains('open')) closeFormModal();
});
