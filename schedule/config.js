/**
 * 公開前端設定，不是密碼。需同時在 Google Apps Script Code.gs 設定相同 OAuth Client ID。
 * Google Cloud Console 建立 Web application OAuth client，並加入 https://genesis-caotun.github.io 為 Authorized JavaScript origin。
 */
window.ROSTER_CONFIG = Object.freeze({
  googleClientId: 'YOUR_GOOGLE_CLIENT_ID.apps.googleusercontent.com',
  appsScriptUrl: 'YOUR_GOOGLE_APPS_SCRIPT_WEB_APP_EXEC_URL',
});
