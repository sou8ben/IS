# Prototype Instructions

Run the local server yourself and open the preview in the browser available to this environment. Do not give the user server-start instructions when you can run it.

Do not perform page-preview or visual page checks after changes unless the user explicitly requests them.

Do not automatically open, invoke, or switch to any Review, code-review, design-review, diff-review, or approval interface. Only use a review interface when the user explicitly requests it. Normal local preview and verification may continue without opening a review UI.

Before making substantial visual changes, use the Product Design plugin's `get-context` skill when the visual source is unclear or no longer matches the current goal. When the user gives durable prototype-specific design feedback, preferences, or decisions, record them in `AGENTS.md`.

Keep every custom select control and its dropdown arrow on the same horizontal line. The Ant Design icon wrapper (`.anticon`) must be positioned inside `.select-wrap` rather than flowing after the native `<select>`.

Switch rows should expose a narrow clickable switch control; adjacent status text and the rest of the row must not toggle the switch.

Headers inside `group-editor-section` should contain the section title only; do not render descriptive `<p>` text in those headers.

When implementing from a selected generated mock, treat that image as the source of truth for layout, component anatomy, density, spacing, color, typography, visible content, and hierarchy.

Build app UI in `src/`. Keep `.openai/hosting.json`, `worker/index.js`, `scripts/prepare-sites-build.mjs`, and `tests/sites-worker.test.mjs` intact so the same local prototype can be handed to Sites. Before a Sites handoff, run `npm run build` and `npm run test:sites`; the build must leave `dist/client/index.html`, `dist/server/index.js`, and `dist/.openai/hosting.json`.

The frontline App prototype lives in `app.html` and `src/app/`. Its components and visuals should stay as close as possible to the Yonyou BIP mobile platform: use antd-mobile (the base of BIP's TinperM / yonui-mobile) themed with BIP tokens, primary red `#E60012`, grey canvas, white cards, label-left / value-right form rows and a red primary bottom action bar. Keep every BIP mobile token in `src/app/app.css`. No official BIP mobile screenshots exist yet, so the current tokens are inferred; when screenshots arrive, compare screen by screen and replace the tokens there.

In the App permission check screen, keep each `.m-permission-list` item in a two-level card layout: icon, title, step and status in the header; explanatory copy and the full-width action below. Completed items should use a restrained green state instead of retaining the pending action layout.

On desktop, `app.html` frames the App in a same-origin iframe (`app.html?embed=1`) so antd-mobile popups, toasts and fixed bars stay inside the phone. The demo control panel talks to the App through `postMessage`. The App shares the back-office demo data in `localStorage` (`iam-demo-state-v1`) and keeps App-only state in `is-app-demo-v1`.

The back-office User Management filter bar must provide dedicated filters for user name, login account, mobile phone, contact phone, email address, EUID, IAM user (Yes/No), and status (Active/Inactive).

The back-office User Management table columns must be, in order: user name, login account, mobile phone, contact phone, email address, EUID, IAM user, status, locked, verification-code request count, updated by, updated at, and actions.

In the back-office User Management table, user names are plain text rather than edit links. Editing is available only from the fixed right-side Actions column, and every data-column header must support sorting.

The back-office Role & Permissions page uses dedicated filters for role code, name, and Active/Inactive status. Its table columns are role code, name, numeric level, role type, status, and a fixed right-side Edit action. Editing opens a right-side drawer with Basic Data, Users, and Operation Permissions tabs; Basic Data includes required code, name, manually entered numeric level, role type (Administrator/Regular User), and Active/Inactive status. Role status in the Basic Data drawer uses the same standalone `group-editor-section` status layout as Group editing, with a status switch and linked-user count summary. The Users tab follows the Group linked-users pattern with search, a linked-user table, remove actions, and a right-side batch association drawer.

The back-office Permission Validation Rules page uses code, name, module, operation, Allow/Deny effect, and Active/Inactive filters. Its sortable table includes an automatically generated condition summary, update metadata, and fixed right-side Edit, Copy, and Simulate actions; the panel fills the content area with pagination at the bottom. The right drawer has Basic Data, Conditions, and Simulation tabs, with the standalone Group-style status section. Conditions use typed dropdowns/values and nested All/Any groups, never scripts or a priority that overrides a denial.

Permission decisions check functional permission first, then deny rules, complete allow rules, and responsibility scope. Deny takes precedence for every identity, including administrators and users in both execution and management groups. Group membership and type/grid/request scope must share the same group witness; never combine responsibilities from different groups. Missing context, invalid policy, no matching allow, or logging failure denies submission. Simulation evaluates actual conditions without performing business mutations. The current back-office prototype uses explicit demonstration identities/scopes and local versioned rules/audit logs; do not present it as production security or as synchronized IAM/mobile responsibility data. Production requires trusted, fresh server-side context and submission-time validation.

The back-office NFC Tags page (`src/nfc-page.tsx`, data and validation in `src/nfc-tags.ts`) is a dedicated list page with the same table-shell anatomy as User Management and Permission Validation Rules. That means dedicated `filter-field` filters, no row checkboxes or row-click editing, every column sortable, a fixed right-side Edit action, and pagination at the bottom of a panel that fills the content area.
- Filters: code, name, chip UID, address, management group, department, and Active/Inactive status.
- Table columns, in order: code, name, chip UID, department, facility name, address, latitude, longitude, management group, linked object, site-photo count, status, updated by, and updated at.
- The edit drawer has four `group-editor-section`s: Tag Data, Location, Site Photos (at most 3), and the standalone Group-style status section with a scan-count summary.
- Code and UID are unique, and code is locked after creation.
- Each tag must bind exactly one management group (only `kind: "管理"` groups are listed); that group manages the tag. The linked object is optional and an NFC scan stays an assist, never a mandatory check-in.
- Latitude and longitude are entered as numbers or picked on the static Macau map. That map is a simulated linear projection over the demonstration Macau bounds, not GIS data.

The back-office Inspection Templates page (`src/inspection-template-page.tsx`, with data and validation in `src/inspection-templates.ts`) uses the same table-shell anatomy as the NFC Tags page: dedicated `filter-field` filters, all columns sortable, a fixed right-side Edit action, and pagination at the bottom.
- Filters: code, name, inspection type, location check (On/Off), and Active/Inactive status.
- Table columns: code, name, inspection type, location check, effective distance, check points, item count, applicable objects (blank shows "all objects"), applicable inspection groups (blank shows "all groups"), status, updated by, and updated at.

The editor drawer has four tabs: Basic Data, Items, Applicable Objects, and Applicable Groups.
- Basic Data:
  - Code and inspection type are locked after creation. Changing the type of a new template that already has items or objects asks for confirmation, then clears them.
  - The location-check section has a switch, the default effective distance (10–1000 m), and the check points (start filling and/or submit).
  - The standalone status section counts referencing plan templates. Deactivating a referenced template asks for confirmation.
- Items:
  - Add them through a right-side batch picker that only offers items of the template's inspection type, with search, a category filter, and select-all-results.
  - Each row sets required or optional and the minimum attachments (0–10).
  - Rows support multi-select, batch edit, and batch remove.
  - Items are always grouped by item type (項目類型) into separated sections. Each section has a header row with a select-all checkbox, the item count, and the required count. Items of one type stay adjacent, and newly added items join the end of their type's section.
  - Order is set by drag and drop on a handle; the handle also accepts the up and down arrow keys. Dragging a type header moves the whole section; items can only be dragged within their own type. Sequence numbers run continuously across sections. Dragging is paused while searching.
  - The batch picker also lists candidate items under item-type section headers.
- Applicable Objects:
  - Batch-add objects of the same type, filtered by grid and keyword.
  - Each object may override the template's default effective distance; blank uses the default. Overrides can be batch-edited, and objects can be batch-removed.
- Applicable Groups: only inspection groups are offered.

An empty object or group scope means the template applies to all of them.

The App inspection form groups template items by item type the same way: a section header per type in order of first appearance, with item numbers running continuously across sections. Submit-time validation errors follow that displayed order.

The back-office Inspection Plans pages (`src/plan-pages.tsx`; pure logic in `src/plan-rules.ts`; plan templates and the App bridge in `src/plan-data.ts`; map in `src/plan-map.tsx`):
- **List:** same table-shell anatomy as the other list pages. Filters: plan code, name, plan template, inspection group, status, and start-date range. Columns (all sortable): plan code, name, plan template, inspection group, default inspector, start, end, status, inspection count, and progress. A fixed right-side View action.
- **Create:** choose a plan template (its route, objects and inspection templates come from the App's seed plan data), a time window, an inspection group and an optional default inspector. The right side previews the template route on the map and lists the generated object × inspection-template inspections.
- **Snapshot:** creating a plan stores a template snapshot (`plan.snapshot`) and the planned inspections (`plan.inspections`). Later template versions never change an existing plan; the detail page shows a notice when the template has moved on and can overlay the current template route.
- **Permissions:** create, edit and add-inspection run the real `create-plan` check through `authorize(operation, data, user)` with an explicit 提交身份（示範） selector. It defaults to 區詠珊, because 陳家朗 is denied by PERM-003. A template without a demonstration permission scope denies on missing data.
- **Detail:** an interactive SVG map with layer chips, zoom, fit, drag-pan and marker popups. Layers: route, inspections toned by status and result, events, works, and demonstration member tracks. Below it are tabs for inspections, events, works, member tracks, and the work log (App plan operations plus back-office changes); a row click focuses its map marker.
- **Status-limited edits:**
  - Not started: edit name, group, time, default inspector and note, and add extra inspections (source 額外加入).
  - In progress: only force stop (sets 已中止).
  - Completed or stopped: supplementary inspections (source 補入, with reason, inspector, time and result), supplementary events and works, and linking existing unlinked events and works.
  - Every change appends a `plan.changes` entry.
- **App sync:** the App reads back-office plan progress live from `is-app-demo-v1` (read-only). The App materialises every non-補入 planned inspection as an 未完成 inspection with the same id, uses the snapshot route when it has no seed route, and counts back-office 補入 inspections in plan progress. Extra and supplementary inspections may only use App-known inspection templates.
