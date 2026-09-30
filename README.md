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

## 驗證與建置

```bash
npm run typecheck
npm run build
npm run test:sites
npm run preview
```

正式建置輸出至 `dist/`。原型包含工作台、權限及基礎配置、計劃／巡查／事件／工作、軌跡、通知、報表、系統與第三方整合等 40+ 個可導覽路由。

頁首用戶選單提供「重設示範資料」，可清除操作產生的本地狀態並恢復初始資料。設計比對及瀏覽器驗收結果見 `design-qa.md`。
