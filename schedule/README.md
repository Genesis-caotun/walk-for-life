# 十二月服務排班｜莫蘭迪風格 + Google Sheets + Apps Script

## 已建好的資料庫

- 試算表：https://docs.google.com/spreadsheets/d/11ji7jopZiIEt9QjKI13gEIFIp4o62IhbH7vR8gTIbkY/edit
- 「排班資料」：最新紀錄，取消會標記為 deleted，避免誤刪稽核線索
- 「操作紀錄」：新增、修改、取消的歷史變更
- 資料僅由 Apps Script（使用擁有者的執行權限）讀寫；**不要**將試算表直接設定成「知道連結的任何人可編輯」

## 你要完成的 3 個授權步驟（目前尚未完成）

### 1. 建立 Google Cloud OAuth 網頁用戶端 ID

1. 前往 https://console.cloud.google.com/apis/credentials ，建立或選擇 Google Cloud 專案。
2. 若要求，設定 OAuth consent screen（同意畫面），外部使用者需依 Google 規定加入測試使用者或發布。
3. 建立 OAuth client ID，應用程式類型選「Web application」。
4. Authorized JavaScript origins 新增 `https://genesis-caotun.github.io`。
5. 複製形如 `123456789-xxxx.apps.googleusercontent.com` 的 Client ID（**不是 client secret**）。
6. 放進 GitHub `schedule/config.js` 的 `googleClientId`，同時放進 Apps Script `Code.gs` 的 `GOOGLE_CLIENT_ID`。

### 2. 建立 Google Apps Script 後端

1. 用上方試算表打開「擴充功能 → Apps Script」。
2. 在 `Code.gs` 貼入 `Code.gs` 檔案內容；將 `GOOGLE_CLIENT_ID` 改成剛建立的 Client ID。`SPREADSHEET_ID` 已填好。
3. 在 Apps Script 編輯器中建立「HTML」檔，名稱必須是 **Bridge**（編輯器會顯示 Bridge.html），貼入 `Bridge.html`。
4. 先在 Apps Script 執行 `checkSetup` 並同意授權（這個函式只確認試算表可存取）。
5. 點「部署 → 新增部署 → 網頁應用程式」。執行身分：**我**；存取權：**任何人**（因伺服端會對每個請求驗證 Google ID token，不能只相信顯示名稱）。
6. 複製部署的 `/exec` 網址，填入 GitHub `schedule/config.js` 的 `appsScriptUrl`。**不要使用 /dev 網址**。
7. 後續若改了 Apps Script 內容，記得「管理部署 → 編輯 → 新版本」，才會套用更動。

### 3. 測試正式同步

1. 使用 Chrome/Safari 打開 GitHub 排班頁，點 Google 登入。
2. A 帳號替 B 登記 12/03，確認 Google 試算表有新增一列，操作紀錄有新增事件。
3. 用 B 帳號重新開頁，確認可看到 B 姓名及真實登記者，但不可修改 A 建立的資料。
4. 用 A 帳號修改/取消，確認最後編輯者與操作紀錄更新。
5. 系統每 30 秒同步其他裝置的資料，也可重新整理頁面。

## 重要安全與技術限制

- **不能只靠 Apps Script `Session.getActiveUser().getEmail()`**：以擁有者身分部署時，訪客 Email 不保證可取得。此方案使用 Google Identity Services 取得 ID token，Apps Script 透過 Google tokeninfo 驗證 issuer、audience、有效期、Email 與 subject，再依 subject 限制修改自己建立的紀錄。
- 若 Google 網頁帳號採非 @gmail.com 的外部電子郵件，Google 身分驗證不一定持續保證該信箱擁有權；這個網站使用 `sub` 作為權限判斷，不使用 Email 作為唯一身分。
- 為避免 GitHub 與 Apps Script 間的跨來源 `fetch` 限制，網頁使用 Apps Script HTMLService 內嵌 Bridge + `postMessage` + `google.script.run`。若瀏覽器因 Google iframe 政策拒絕嵌入，會明確顯示錯誤；請用 Chrome/Safari 檢查，可能需要調整部署方式。
- 部署成「任何人」不代表資料對外公開：後端每次讀取/修改都驗證 Google token。對一般 Google 登入者可見所有排班名單與登記編輯者 Email；若只開放志工群，請在 `Code.gs` 設定 `ALLOWED_EMAILS`（逗號分隔）或管理許可清單。
- iframe bridge 的 `postMessage` 僅接受指定 GitHub 網域，且回傳時使用確認過的目標 origin；前端會檢查 iframe 的 source、origin、握手識別碼。
- 後端附有 `LockService` 同時寫入控管；每次變更追加至「操作紀錄」，但試算表擁有者仍可直接改動紀錄或刪除日誌，因此**不是不可竄改稽核系統**。
- Google ID token 具有短時效；到期須重新 Google 登入。不要把 ID token、Google 密碼或服務帳號私鑰貼給任何人。
- 目前提供 2026/12/01～12/28，可自行調整日期區間。

## 檔案結構

- `index.html`：網頁畫面
- `style.css`：莫蘭迪配色和電腦/手機排版
- `app.js`：月曆、Google 登入、代登記、浮動資訊、讀寫同步
- `config.js`：兩個需要填入的公開設定
- `Code.gs`：Apps Script API 和試算表操作
- `Bridge.html`：在 Apps Script 中接受與轉送安全請求
- `README_部署教學.md`：本說明
