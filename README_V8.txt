Walk for Life 官網 v8｜安裝步驟

1. 將 WFL_API.gs 新增到「團體報名」Apps Script 專案（不要刪除原本團體腳本）。
2. Apps Script：部署 → 新增部署作業 → 網頁應用程式。
   執行身分：我
   存取權：任何人
3. 複製 /exec 結尾的 Web App 網址。
4. 開啟 index.html，找到：
   <meta name="wfl-api-url" content="PASTE_YOUR_APPS_SCRIPT_WEB_APP_URL_HERE">
   把 content 改成 Web App 網址。
5. 將整個網站資料夾上傳到 GitHub Pages。
6. 測試個人、團體、付款回報各一筆。

注意：
- 團體名冊建議小於 5MB。
- 若 Apps Script 更新程式碼，需「管理部署作業 → 編輯 → 新版本」才會生效。
- 正式信用卡網址完成後，同時修改網站與 WFL_API.gs 的 CREDIT_CARD_URL。
