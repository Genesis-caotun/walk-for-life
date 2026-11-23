# 2026 年 12 月 1–28 日志工排班桌曆

預定 GitHub Pages 網址：
https://genesis-caotun.github.io/walk-for-life/schedule/

目前已上傳靜態網頁，預設為**示範模式**，不是真正 Google 登入，也不會保存資料。

## 開通 Google 登入與多人同步

1. 到 https://console.firebase.google.com/ 建立 Firebase 專案。
2. Authentication → Sign-in method → 啟用 Google 提供者。
3. Firestore Database → 建立資料庫，選擇 Production mode。
4. Firestore Database → Rules → 貼上本資料夾 `firestore.rules` 並發布。
5. Firebase 專案設定 → 新增 Web 應用程式，將 `firebaseConfig` 的 `apiKey`、`authDomain`、`projectId`、`appId` 填入 `firebase-config.js`。
6. Authentication → Settings → Authorized domains → 新增 `genesis-caotun.github.io`。
7. 用兩個不同的 Google 帳號確認新增、同步，以及只能修改自己建立的登記。

## 使用方式

登入 Google 帳號、選日期、輸入本人或代登記者的排班姓名。可幫多人登記；滑鼠移上姓名會顯示真正的登記及最後編輯者與時間；手機點姓名看詳情。登記者只能修改／刪除自己建立的紀錄。

**注意**：日曆登記者的 Google 姓名與 Email 可被其他已登入者看到。正式上線前應告知參與者，並考慮限制帳號白名單。若需完整歷次稽核，需另外增加無法由客戶端自行更改的操作日誌。

公開 Firebase Web 設定值可放在前端，但絕對不要上傳 Firebase 服務帳號私鑰、Token 或個人 Google 密碼。
