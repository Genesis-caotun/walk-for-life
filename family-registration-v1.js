/* Personal registration: shared contact confirmation and stable retry identifier. */
(() => {
  const originalSend = sendPayload;
  const pending = new Map();
  let busy = false;
  sendPayload = async function(payload) {
    if (payload.action !== 'personal') return originalSend(payload);
    if (busy) throw new Error('資料傳送中，請稍候。');
    busy = true;
    try {
      const bytes = new TextEncoder().encode(JSON.stringify(payload));
      const digest = await crypto.subtle.digest('SHA-256', bytes);
      const key = 'wfl-personal-request-' + Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2,'0')).join('');
      let requestId = pending.get(key);
      try { requestId = requestId || sessionStorage.getItem(key); } catch (_) {}
      if (!requestId) {
        requestId = Array.from(crypto.getRandomValues(new Uint8Array(24)), b => b.toString(16).padStart(2,'0')).join('');
        pending.set(key, requestId);
        try { sessionStorage.setItem(key, requestId); } catch (_) {}
      }
      const data = Object.assign({}, payload, {requestId});
      let result = await originalSend(data);
      if (result.confirmationRequired) {
        if (!window.confirm(result.message)) throw new Error('尚未送出報名。請確認姓名及出生日期後再送出。');
        result = await originalSend(Object.assign({}, data, {sharedContactConfirmed:true}));
        if (result.confirmationRequired) throw new Error('確認未完成，請稍後再試。');
      }
      return result;
    } finally { busy = false; }
  };
})();
