# Design QA — BIP 風格巡查派工管理原型

## Evidence

- source visual truth path: `/Users/souben/Library/Mobile Documents/com~apple~CloudDocs/Meta/市政署/IS/prototype/qa/bip-user-management.png`
- implementation screenshot path: `/Users/souben/Library/Mobile Documents/com~apple~CloudDocs/Meta/市政署/IS/prototype/qa/is-works-final.png`
- responsive screenshot path: `/Users/souben/Library/Mobile Documents/com~apple~CloudDocs/Meta/市政署/IS/prototype/qa/is-work-detail-1280.png`
- workbench screenshot path: `/Users/souben/Library/Mobile Documents/com~apple~CloudDocs/Meta/市政署/IS/prototype/qa/is-workbench-final.png`
- side-by-side comparison path: `/Users/souben/Library/Mobile Documents/com~apple~CloudDocs/Meta/市政署/IS/prototype/qa/bip-visual-comparison.png`
- viewport: primary `1440 × 900` CSS px; responsive check `1280 × 800` CSS px
- source pixels: `1424 × 478`; implementation pixels: `1440 × 900` and `1280 × 800`
- density normalization: Chrome `deviceScaleFactor = 1`; full-width source and the implementation's top application region were displayed in equal `694 × 233` comparison frames using top-left alignment. Native-resolution captures were then inspected separately for typography, controls and table detail.
- state: BIP user-management list reference compared with the prototype work-management list; work-detail page checked at the minimum supported desktop width.

## Full-view Comparison Evidence

The combined comparison confirms the same desktop information architecture: compact global header, workspace/product context, tab strip, persistent left navigation, muted page canvas, dense white content surface, red primary action, thin borders, and low-radius controls. The prototype intentionally omits YonBIP branding and uses the system name, as required.

## Focused Region Comparison Evidence

Native-resolution inspection covered the header/search/account area, tab active indicator, left navigation states, filter controls, table headers and rows, semantic tags, pagination, work-detail actions, timeline, SLA panel, and local Macau map. Focused inspection was required because the normalized full-view comparison makes dense table text too small to assess reliably.

## Required Fidelity Surfaces

- Fonts and typography: Traditional Chinese system-font stack, compact 12–14 px operational copy, clear 18–22 px page hierarchy, restrained weights, and ellipsis treatment match the source's enterprise density. No broken wrapping or illegible labels were found.
- Spacing and layout rhythm: 48 px header, 36 px tabs, 224 px expanded navigation, 16 px page padding, 32 px controls, 38–42 px table rows, thin borders, and small radii reproduce the BIP rhythm. The 1280 px detail capture preserves all persistent controls without overlap.
- Colors and visual tokens: red `#E60012` primary hierarchy, cool gray canvas, white working surfaces, gray borders, dark body text, and restrained semantic blues/greens/oranges are consistently applied. No decorative gradients remain.
- Image quality and asset fidelity: the map is a locally stored, generated raster asset with crisp rendering, correct crop, domain-appropriate Macau geography, and no external dependency. Standard interface icons come from one consistent icon library; no emoji or text-glyph substitutes are used.
- Copy and content: Traditional Chinese operational language is coherent and traceable to the detailed design's plan, inspection, event, work, notification, reporting, device, log, and integration domains.

## Primary Interactions Tested

- Work list rendered and first work link opened the correct hash route.
- Work detail rendered the processing record and related operational panels.
- 「解決」 opened the correct action drawer; 「取消」 closed it.
- Notification icon opened the notification popover.
- Sidebar collapse control applied the compact navigation state.
- Hash navigation rendered the plan list without a 404.
- Browser runtime and console errors checked after interaction pass: none.

## Findings

- No actionable P0, P1, or P2 visual differences remain.
- Accepted intentional deviations: the YonBIP logo is not reproduced; the prototype exposes domain-specific navigation labels instead of the reference product's developer-console modules.

## Open Questions

- Formal BIP design tokens and private SDK were not available. The current component adapter and CSS tokens are ready to be replaced when the official package is supplied.

## Comparison History

- Pass 1: source and rendered implementation compared side by side after viewport normalization. No P0/P1/P2 finding was identified, so no visual correction iteration was required.

## Implementation Checklist

- [x] BIP-style shell, navigation proportions, tabs, filters, tables, status tags and action hierarchy
- [x] 1440 × 900 primary viewport
- [x] 1280 × 800 responsive desktop viewport
- [x] Local map asset and consistent icon system
- [x] Primary route and drawer interactions
- [x] Browser runtime error check
- [x] TypeScript, production build and site tests

## Follow-up Polish

- P3: once official BIP tokens are available, replace inferred neutral grays and exact font fallbacks with platform-provided values.

final result: passed

---

# Design QA — 前線 App 原型（BIP 移動端風格）

## Evidence

- source visual truth: 暫無用友 BIP 移動端（友空間 App／移動單據）截圖；目前按 BIP 移動端慣例推斷，token 集中於 `src/app/app.css`
- implementation screenshots: `qa/app-host-1440.png`、`qa/app-home.png`、`qa/app-plan-work.png`、`qa/app-inspection-errors.png`、`qa/app-work-duplicate.png`、`qa/app-work-detail.png`、`qa/app-sync-conflict.png`、`qa/app-camera-watermark.png`
- viewport: 手機 `390 × 844` CSS px（deviceScaleFactor 2）；桌面示範頁 `1440 × 900`（手機框按視窗高度縮放）
- tooling: Chrome（puppeteer-core 驅動）逐步點擊示範腳本，並檢查 console 錯誤

## Primary Interactions Tested

- 登入 → 定位權限引導（三項授權）→ 主頁。
- 主頁「繼續作業」→ 計劃作業頁（地圖路線、按巡查狀態著色、本人軌跡、清單）→ 巡查表：選「否」後出現異常提示 → 建立工作（按工作摘要預填類型及描述）→ 30 米內疑似重複提示 →「仍然新增」→ 返回巡查表並顯示已建立工作。
- 故意漏填後提交：定位、必填、附件數量的錯誤一次列出（共 6 項），並捲到第一個錯誤。
- 已有進行中計劃時開始另一計劃被拒；中止後開始 PL-0004 出現「區詠珊正在執行此計劃」；長按多選合併 PL-0005 及 PL-0006 並開始作業。
- 身份切換：陳家朗只可留言（顯示權限說明）；黃志峰可跟進 WK-0011，解決 WK-0012 時因附件不足被攔截；梁嘉敏可關閉 WK-0096，後台資料同步顯示已關閉。
- 離線：跟進工作 → 恢復在線時出現同步衝突 →「重做」後以伺服器狀態重做。
- 離線新增事件（級聯類型、繼承欄位必填檢查）→ 建立工作（「無需跟進」改為「跟進中」提示）→ 恢復在線後由本機編號 L-0001／L-0002 轉為 EV-20260929-0007／WK-20260929-0013，雙向關聯同步更新。
- 推送（一般／緊急／特急）、遠程鎖定、推薦更新、同行人加入、字體大小「特大」、相機拍照加水印及塗鴉、地圖選點地址組件、留言模板參數替換。
- `npm run build` 後以 `vite preview` 檢查兩個入口；在 App 跟進的工作於後台工作列表顯示為「跟進中」。
- 各流程 console 錯誤：無。

## Findings

- 沒有未處理的 P0／P1 問題。
- P2（待確認）：BIP 移動端實際的按鈕圓角、表單行高、標籤樣式及字體大小檔位，需以官方截圖校正。

## Open Questions

- 友空間 App 與「舊 App 接 BIP 接口」兩條路線的登入方式及裝置管控差異（公務通登入、遠程擦除）暫以提示文字表達。
- 字體大小選項、其他介面語言、同行關係結束時點等設計文件標為「待確認」的項目，原型按建議值實現。

final result: passed（視覺依據待補官方截圖）
