# 2026 年 12 月 1～28 日・免登入排班桌曆

網站網址（已將此版本上傳 GitHub 後）：
https://genesis-caotun.github.io/walk-for-life/schedule/

資料庫（已建立）：
https://docs.google.com/spreadsheets/d/11ji7jopZiIEt9QjKI13gEIFIp4o62IhbH7vR8gTIbkY/edit

## 已經簡化的功能

- 任何人不用 Google 帳號就可開啟網站。
- 點日期 → 輸入「誰來填寫」及「排班姓名」 → 儲存。
- 同一天可多人登記；可代登記、修改、取消；滑鼠移到姓名可看填寫人與最後修改人（**姓名由訪客自行輸入，不能驗證真實身分**）。
- 30 秒同步、CSV 匯出、手機友善、莫蘭迪配色。
- 取消或修改的紀錄保存在 Google 試算表「操作紀錄」分頁。

## 多人共用僅需一次 Apps Script 部署（免 Google Cloud、免 OAuth）

1. 開啟上面的 Google 試算表 →「擴充功能」→「Apps Script」。
2. 將 `Code.gs` 全文貼到編輯器的 `Code.gs`（取代原始內容）。**不需要再新增 HTML 檔案。**
3. 點「部署」→「新增部署作業」→類型選 **網頁應用程式**，執行身分選「我」，存取權選「所有人／任何人」。首次授權時使用試算表擁有者的 Google 帳號核准存取。
4. 複製部署完成的 **`https://script.google.com/macros/s/.../exec` 網址**給我，我便可更新 GitHub `schedule/index.html` 內的 `window.ROSTER_CONFIG.appsScriptUrl`。使用者完全不必登入。

注意：在第 4 步完成前，GitHub 網站會清楚顯示「本機示範」，測試登記只存在當前瀏覽器，不會進入共用試算表。不要當成正式排班。

## 免登入安全提醒

任何知道網站網址的人都有可能查看、修改與取消其他人的登記。填寫人姓名只是自行輸入，不能當作身分稽核證據。請不要輸入私人電話、住址、Email 等敏感資訊；若日後需要防止他人亂改，建議加入共用管理碼或恢復登入驗證。Google 試算表請維持私人存取，無須公開分享給參與者。