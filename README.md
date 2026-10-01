# 巡查派工管理系統 HTML 原型

BIP 風格桌面端互動原型，依據 `詳細設計.md` 建立。專案使用 React、TypeScript、Vite 與 Hash Router，資料與流程均由本地 Mock 服務及 `localStorage` 驅動，不依賴正式後端或 CDN。

## 啟動

```bash
npm install
npm run dev
```

瀏覽器開啟 `http://127.0.0.1:5173/#/workbench`。如使用指定埠：

```bash
npm run dev -- --host 127.0.0.1 --port 4173
```

## 前線 App 原型

`app.html` 是前線 Android App 的 HTML5 可點擊原型（程式在 `src/app/`），依據《詳細設計》第 12 節及 14.10 節製作，組件採用 antd-mobile，並套用 BIP 移動端主題。

- 桌面瀏覽器開啟 `http://127.0.0.1:5173/app.html`：左邊是 Android 手機框（App 在 iframe 內運行），右邊是示範控制台，可切換身份、網絡離線、模擬推送、遠程鎖定、版本更新，並提供畫面索引及示範腳本。
- 手機或窄視窗會全屏顯示 App；示範控制台在「我的 › 關於本原型」。
- 示範帳號：`chan.kl`（巡查）、`wong.cf`（執行）、`leung.km`（管理），密碼均為 `123456`。
- App 與後台共用 `localStorage` 示範資料：在 App 建立或處理的工作及事件，同步後會出現在後台。後台用戶選單有「開啟 App 原型」。

## 驗證與建置

```bash
npm run typecheck
npm run build
npm run test:sites
npm run preview
```

正式建置輸出至 `dist/`（`dist/client/index.html` 為後台，`dist/client/app.html` 為 App）。原型包含工作台、權限及基礎配置、計劃／巡查／事件／工作、軌跡、通知、報表、系統與第三方整合等 40+ 個可導覽路由。

頁首用戶選單提供「重設示範資料」，可清除操作產生的本地狀態並恢復初始資料。設計比對及瀏覽器驗收結果見 `design-qa.md`。
