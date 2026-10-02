import { createContext, useContext, useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import {
  CheckCircleFilled, CloseOutlined, DeleteOutlined, DoubleLeftOutlined, DoubleRightOutlined, DownOutlined, EditOutlined,
  EnvironmentFilled, FileImageOutlined, FilePdfOutlined, FilterOutlined, InboxOutlined,
  LeftOutlined, LoadingOutlined, MoreOutlined, PaperClipOutlined, PlusOutlined, RightOutlined,
  ReloadOutlined, SearchOutlined, SortAscendingOutlined, SortDescendingOutlined, UploadOutlined, WarningFilled,
} from "@ant-design/icons";
import type { Column, GenericRecord, StatusTone } from "./types";

const mapImageUrl = `${import.meta.env.BASE_URL}assets/macau-operations-map.png`;

export function Button({ children, variant = "default", icon, iconAfter, onClick, disabled, type = "button", className = "" }: {
  children: ReactNode; variant?: "primary" | "default" | "text" | "danger"; icon?: ReactNode; iconAfter?: ReactNode;
  onClick?: () => void; disabled?: boolean; type?: "button" | "submit"; className?: string;
}) {
  return <button className={`btn btn-${variant} ${className}`} onClick={onClick} disabled={disabled} type={type}>{icon}<span>{children}</span>{iconAfter}</button>;
}

export const toneMap: Record<string, StatusTone> = {
  "啟用": "success", "已完成": "success", "已關閉": "success", "已解決": "info", "正常": "success", "已發佈": "success",
  "進行中": "info", "跟進中": "info", "將逾時": "warning", "未開始": "neutral", "新建": "neutral", "無需跟進": "neutral",
  "已逾時": "danger", "特急": "danger", "緊急": "warning", "停用": "neutral", "已中止": "warning", "待人工分派": "danger",
  "未完成": "warning", "異常": "danger", "通過": "success",
};

export function StatusTag({ children, tone }: { children: ReactNode; tone?: StatusTone }) {
  const label = String(children);
  return <span className={`status-tag tone-${tone ?? toneMap[label] ?? "neutral"}`}>{children}</span>;
}

export function PageHeader({ title, description, actions, eyebrow }: { title: string; description?: string; actions?: ReactNode; eyebrow?: string }) {
  return <div className="page-header">
    <div>{eyebrow && <div className="eyebrow">{eyebrow}</div>}<h1>{title}</h1></div>
    {actions && <div className="page-actions">{actions}</div>}
  </div>;
}

export function FilterBar({ search, onSearch, children, onReset, onAdvanced }: {
  search: string; onSearch: (value: string) => void; children?: ReactNode; onReset?: () => void; onAdvanced?: () => void;
}) {
  return <div className="filter-bar">
    <div className="search-box"><SearchOutlined /><input value={search} onChange={(event) => onSearch(event.target.value)} placeholder="輸入關鍵字搜尋" /></div>
    {children}
    <div className="filter-spacer" />
    {onAdvanced && <Button icon={<FilterOutlined />} onClick={onAdvanced}>高級篩選</Button>}
    {onReset && <Button variant="text" icon={<ReloadOutlined />} onClick={onReset}>重設</Button>}
  </div>;
}

export function Select({ value, onChange, children, ariaLabel }: { value: string; onChange: (value: string) => void; children: ReactNode; ariaLabel?: string }) {
  return <div className="select-wrap"><select aria-label={ariaLabel} value={value} onChange={(event) => onChange(event.target.value)}>{children}</select><DownOutlined /></div>;
}

export function DenseTable<T extends { id: string }>({ rows, columns, selected, onSelected, onRowClick, emptyText = "暫無資料", actionTitle = "", renderActions, stickyActions = false, page = 1, pageSize, onSort }: {
  rows: T[]; columns: Column<T>[]; selected?: string[]; onSelected?: (ids: string[]) => void; onRowClick?: (row: T) => void; emptyText?: string; actionTitle?: string;
  renderActions?: (row: T) => ReactNode; stickyActions?: boolean;
  page?: number; pageSize?: number; onSort?: () => void;
}) {
  const [sortKey, setSortKey] = useState<string>("");
  const [ascending, setAscending] = useState(true);
  const sortedRows = useMemo(() => {
    if (!sortKey) return rows;
    const column = columns.find((item) => String(item.key) === sortKey);
    return [...rows].sort((a, b) => {
      const aValue = column?.sortValue ? column.sortValue(a) : (a as Record<string, unknown>)[sortKey] ?? "";
      const bValue = column?.sortValue ? column.sortValue(b) : (b as Record<string, unknown>)[sortKey] ?? "";
      const result = typeof aValue === "number" && typeof bValue === "number"
        ? aValue - bValue
        : String(aValue).localeCompare(String(bValue), "zh-Hant");
      return ascending ? result : -result;
    });
  }, [rows, columns, sortKey, ascending]);

  function toggleAll() {
    if (!onSelected) return;
    onSelected(selected?.length === rows.length ? [] : rows.map((row) => row.id));
  }

  return <div className="table-shell">
    <table className={`dense-table ${stickyActions ? "sticky-actions" : ""}`}>
      <thead><tr>
        {onSelected && <th className="check-cell"><input aria-label="全選" type="checkbox" checked={!!rows.length && selected?.length === rows.length} onChange={toggleAll} /></th>}
        {columns.map((column) => <th key={String(column.key)} style={{ width: column.width }} onClick={() => {
          if (!column.sortable) return;
          if (sortKey === column.key) setAscending(!ascending); else { setSortKey(String(column.key)); setAscending(true); }
          onSort?.();
        }} className={column.sortable ? "sortable" : ""}>{column.title}{sortKey === column.key && (ascending ? <SortAscendingOutlined /> : <SortDescendingOutlined />)}</th>)}
        <th className="more-cell">{actionTitle}</th>
      </tr></thead>
      <tbody>
        {(pageSize ? sortedRows.slice((page - 1) * pageSize, page * pageSize) : sortedRows).map((row) => <tr key={row.id} onClick={() => onRowClick?.(row)} className={onRowClick ? "clickable" : ""}>
          {onSelected && <td className="check-cell" onClick={(event) => event.stopPropagation()}><input aria-label={`選擇 ${row.id}`} type="checkbox" checked={selected?.includes(row.id)} onChange={() => onSelected?.(selected?.includes(row.id) ? selected.filter((id) => id !== row.id) : [...(selected ?? []), row.id])} /></td>}
          {columns.map((column) => <td key={String(column.key)}>{column.render ? column.render(row) : String((row as Record<string, unknown>)[String(column.key)] ?? "—")}</td>)}
          <td className="more-cell" onClick={(event) => event.stopPropagation()}>{renderActions ? renderActions(row) : <button aria-label="更多操作"><MoreOutlined /></button>}</td>
        </tr>)}
      </tbody>
    </table>
    {!rows.length && <div className="empty-state"><InboxOutlined /><strong>{emptyText}</strong><span>請調整篩選條件後再試</span></div>}
  </div>;
}

export function Pagination({ total, page = 1, pageSize = 15, onPageChange, onPageSizeChange }: { total: number; page?: number; pageSize?: number; onPageChange?: (page: number) => void; onPageSizeChange?: (size: number) => void }) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const [currentPage, setCurrentPage] = useState(Math.min(page, totalPages));
  const [pageInput, setPageInput] = useState(String(Math.min(page, totalPages)));
  useEffect(() => { const next = Math.min(Math.max(page, 1), totalPages); setCurrentPage(next); setPageInput(String(next)); }, [page, totalPages]);
  const changePage = (nextPage: number) => {
    const next = Math.min(Math.max(nextPage, 1), totalPages);
    setCurrentPage(next);
    setPageInput(String(next));
    onPageChange?.(next);
  };
  const submitPage = (event: FormEvent) => {
    event.preventDefault();
    const parsed = Number.parseInt(pageInput, 10);
    if (Number.isFinite(parsed)) changePage(parsed);
    else setPageInput(String(currentPage));
  };
  return <div className="pagination"><span>共 {total} 筆</span><div className="pagination-controls"><Button icon={<LeftOutlined />} disabled={currentPage === 1} onClick={() => changePage(currentPage - 1)}>上一頁</Button><span className="page-indicator">第 <strong>{currentPage}</strong> / {totalPages} 頁</span><Button iconAfter={<RightOutlined />} disabled={currentPage === totalPages} onClick={() => changePage(currentPage + 1)}>下一頁</Button><Select value={String(pageSize)} onChange={(value) => onPageSizeChange?.(Number(value))} ariaLabel="每頁筆數"><option>15</option><option>30</option><option>50</option><option>100</option></Select><form className="pagination-jump" onSubmit={submitPage}><span>跳至</span><input aria-label="輸入頁數" inputMode="numeric" pattern="[0-9]*" value={pageInput} onChange={(event) => setPageInput(event.target.value)} />頁</form></div></div>;
}

export function FormDrawer({ open, title, subtitle, children, onClose, onSubmit, submitLabel = "儲存", className = "" }: {
  open: boolean; title: string; subtitle?: string; children: ReactNode; onClose: () => void; onSubmit?: () => void; submitLabel?: string; className?: string;
}) {
  if (!open) return null;
  return <div className="overlay" role="presentation" onMouseDown={onClose}>
    <aside className={`drawer ${className}`} role="dialog" aria-modal="true" aria-label={title} onMouseDown={(event) => event.stopPropagation()}>
      <header><div><h2>{title}</h2>{subtitle && <p>{subtitle}</p>}</div><button aria-label="關閉" onClick={onClose}><CloseOutlined /></button></header>
      <div className="drawer-body">{children}</div>
      <footer><Button onClick={onClose}>取消</Button>{onSubmit && <Button variant="primary" onClick={onSubmit}>{submitLabel}</Button>}</footer>
    </aside>
  </div>;
}

export function ConfirmDialog({ open, title, message, confirmLabel = "確認", danger, onConfirm, onCancel }: {
  open: boolean; title: string; message: string; confirmLabel?: string; danger?: boolean; onConfirm: () => void; onCancel: () => void;
}) {
  if (!open) return null;
  return <div className="overlay centered" role="presentation"><div className="dialog" role="alertdialog" aria-modal="true">
    <div className={`dialog-icon ${danger ? "danger" : "warning"}`}>{danger ? <DeleteOutlined /> : <WarningFilled />}</div>
    <h2>{title}</h2><p>{message}</p>
    <div className="dialog-actions"><Button onClick={onCancel}>取消</Button><Button variant={danger ? "danger" : "primary"} onClick={onConfirm}>{confirmLabel}</Button></div>
  </div></div>;
}

export function TreePanel({ title, nodes, active, onChange }: { title: string; nodes: string[]; active: string; onChange: (value: string) => void }) {
  return <aside className="tree-panel"><div className="tree-title"><strong>{title}</strong></div>
    <div className="tree-search"><SearchOutlined /><input placeholder={`搜尋${title}`} /></div>
    <nav>{nodes.map((node, index) => <button key={node} className={node === active ? "active" : ""} onClick={() => onChange(node)}><span className="tree-dot" />{node}<span>{index + 2}</span></button>)}</nav>
  </aside>;
}

export function MapSplitView({ children, markers = true, toolbar = true, className = "" }: { children?: ReactNode; markers?: boolean; toolbar?: boolean; className?: string }) {
  return <div className={`map-split ${className}`}>
    <div className="map-canvas" aria-label="澳門營運地圖">
      <img src={mapImageUrl} alt="澳門營運地圖底圖" />
      {toolbar && <div className="map-tools"><button><PlusOutlined /></button><button>−</button><button><EnvironmentFilled /></button></div>}
      <div className="map-legend"><span><i className="legend-dot done" />已完成</span><span><i className="legend-dot active" />進行中</span><span><i className="legend-dot issue" />異常</span></div>
      {markers && <>
        <button className="map-marker marker-a" aria-label="黑沙環公園"><EnvironmentFilled /></button>
        <button className="map-marker marker-b warning" aria-label="塔石廣場"><EnvironmentFilled /></button>
        <button className="map-marker marker-c done" aria-label="嘉模公園"><EnvironmentFilled /></button>
        <div className="map-popup"><strong>黑沙環公園</strong><span>巡查完成 7／12</span><a href="#/plans/PL-20260929-0003">查看計劃</a></div>
      </>}
    </div>
    {children && <aside className="map-side">{children}</aside>}
  </div>;
}

export function ActivityTimeline({ items }: { items: { title: string; time: string; text: string; tone?: StatusTone }[] }) {
  return <div className="timeline">{items.map((item, index) => <div className="timeline-item" key={`${item.title}-${index}`}>
    <span className={`timeline-node tone-${item.tone ?? "neutral"}`}>{index === 0 ? <CheckCircleFilled /> : null}</span>
    <div><div className="timeline-title"><strong>{item.title}</strong><time>{item.time}</time></div><p>{item.text}</p></div>
  </div>)}</div>;
}

export function Field({ label, required, hint, children }: { label: string; required?: boolean; hint?: string; children: ReactNode }) {
  return <label className="field"><span>{required && <b>*</b>}{label}</span>{children}{hint && <small>{hint}</small>}</label>;
}

export function RuleBuilder() {
  const [rules, setRules] = useState([{ field: "操作人群組類型", op: "等於", value: "執行群組" }]);
  return <div className="rule-builder"><div className="rule-head"><strong>符合以下所有條件</strong><Button variant="text" icon={<PlusOutlined />} onClick={() => setRules([...rules, { field: "記錄狀態", op: "等於", value: "跟進中" }])}>加入條件</Button></div>
    {rules.map((rule, index) => <div className="rule-row" key={index}><span>且</span><Select value={rule.field} onChange={() => undefined}><option>{rule.field}</option></Select><Select value={rule.op} onChange={() => undefined}><option>{rule.op}</option></Select><input value={rule.value} onChange={(event) => setRules(rules.map((item, itemIndex) => itemIndex === index ? { ...item, value: event.target.value } : item))} /><button onClick={() => setRules(rules.filter((_, itemIndex) => itemIndex !== index))}><CloseOutlined /></button></div>)}
  </div>;
}

export function AttachmentViewer() {
  return <div className="attachments"><button><FileImageOutlined /><span>現場照片_01.jpg<small>1.2 MB</small></span></button><button><FileImageOutlined /><span>處理完成_02.jpg<small>986 KB</small></span></button><button><FilePdfOutlined /><span>承辦商處理單.pdf<small>320 KB</small></span></button></div>;
}

export function ImportWizard() {
  const [stage, setStage] = useState<"upload" | "checking" | "result">("upload");
  const run = () => { setStage("checking"); window.setTimeout(() => setStage("result"), 700); };
  return <div className="import-wizard">
    <div className="steps"><span className="active">1 上傳檔案</span><span className={stage !== "upload" ? "active" : ""}>2 系統驗證</span><span className={stage === "result" ? "active" : ""}>3 確認匯入</span></div>
    {stage === "upload" && <div className="upload-zone"><UploadOutlined /><strong>拖放 Excel 檔案至此，或點擊選擇</strong><span>.xlsx，最多 5,000 行，檔案上限 10 MB</span><input type="file" accept=".xlsx" onChange={run} /><Button icon={<UploadOutlined />} onClick={run}>選擇示範檔案</Button></div>}
    {stage === "checking" && <div className="checking"><LoadingOutlined spin /><strong>正在檢查 248 筆資料</strong><span>格式、引用及唯一性驗證中</span></div>}
    {stage === "result" && <div className="validation-result"><div className="result-summary"><WarningFilled /><div><strong>發現 3 個問題</strong><span>修正後重新上傳，全部通過後才可確認匯入。</span></div><Button>下載錯誤明細</Button></div>
      <table><thead><tr><th>行號</th><th>欄位</th><th>錯誤原因</th></tr></thead><tbody><tr><td>18</td><td>巡查類型</td><td>找不到啟用中的「海岸巡查」</td></tr><tr><td>76</td><td>對象編號</td><td>編號 OBJ-042 已存在</td></tr><tr><td>203</td><td>經度</td><td>數值超出澳門範圍</td></tr></tbody></table>
    </div>}
  </div>;
}

interface ToastValue { showToast: (message: string, tone?: "success" | "error") => void }
const ToastContext = createContext<ToastValue>({ showToast: () => undefined });

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<{ message: string; tone: "success" | "error" } | null>(null);
  const showToast = (message: string, tone: "success" | "error" = "success") => {
    setToast({ message, tone }); window.setTimeout(() => setToast(null), 2600);
  };
  return <ToastContext.Provider value={{ showToast }}>{children}{toast && <div className={`toast toast-${toast.tone}`}>{toast.tone === "success" ? <CheckCircleFilled /> : <WarningFilled />}{toast.message}</div>}</ToastContext.Provider>;
}

export const useToast = () => useContext(ToastContext);

export function GenericEditor({ record, onSave }: { record?: GenericRecord; onSave: () => void }) {
  function submit(event: FormEvent) { event.preventDefault(); onSave(); }
  return <form className="form-grid" onSubmit={submit}>
    <Field label="名稱" required><input defaultValue={record?.name} placeholder="請輸入名稱" /></Field>
    <Field label="編號" required hint="英文字母及數字，儲存後不可修改"><input defaultValue={record?.code} placeholder="系統可自動產生" /></Field>
    <Field label="類別" required><Select value={record?.category ?? "公共設施"} onChange={() => undefined}><option>公共設施</option><option>環境衛生</option><option>綠化養護</option></Select></Field>
    <Field label="負責部門" required><Select value={record?.owner ?? "市政管理廳"} onChange={() => undefined}><option>市政管理廳</option><option>環境衛生處</option><option>園林綠化處</option></Select></Field>
    <Field label="說明"><textarea defaultValue={record?.note} placeholder="輸入配置說明" rows={4} /></Field>
    <Field label="狀態"><div className="switch-row"><label className="switch-control"><input type="checkbox" defaultChecked={record?.status !== "停用"} /><span className="switch" /></label></div></Field>
    <button type="submit" className="sr-only">儲存</button>
  </form>;
}

type RoleEditorTab = "basic" | "users" | "permissions";
const roleEditorUsers = [
  { id: "chan-kalong", name: "陳家朗", account: "chan.kalong" },
  { id: "lei-chicheng", name: "李芷晴", account: "lei.chicheng" },
  { id: "leong-kaman", name: "梁嘉敏", account: "leong.kaman" },
  { id: "wong-chifong", name: "黃志峰", account: "wong.chifong" },
];
const roleEditorPermissions = [
  { title: "巡查作業", items: ["查看巡查計劃", "新增巡查計劃", "提交巡查記錄"] },
  { title: "工作管理", items: ["查看工作", "分派工作", "關閉工作"] },
  { title: "報表與通知", items: ["查看營運報表", "匯出報表", "管理通知規則"] },
];

export function RoleEditor({ record, onSave }: { record?: GenericRecord; onSave: () => void }) {
  const [activeTab, setActiveTab] = useState<RoleEditorTab>("basic");
  const [selectedUsers, setSelectedUsers] = useState<string[]>(record ? roleEditorUsers.slice(0, 2).map((user) => user.id) : []);
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>(record ? ["查看巡查計劃", "查看工作", "查看營運報表"] : []);
  const [userSearch, setUserSearch] = useState("");
  const [userDrawerOpen, setUserDrawerOpen] = useState(false);
  const [userDrawerSearch, setUserDrawerSearch] = useState("");
  const [pendingUserIds, setPendingUserIds] = useState<string[]>([]);
  const submit = (event: FormEvent) => { event.preventDefault(); onSave(); };
  const togglePermission = (permission: string) => setSelectedPermissions((items) => items.includes(permission) ? items.filter((item) => item !== permission) : [...items, permission]);
  const linkedUsers = roleEditorUsers.filter((user) => selectedUsers.includes(user.id) && `${user.name}${user.account}`.toLowerCase().includes(userSearch.trim().toLowerCase()));
  const availableUsers = roleEditorUsers.filter((user) => !selectedUsers.includes(user.id));
  const drawerUsers = availableUsers.filter((user) => `${user.name}${user.account}`.toLowerCase().includes(userDrawerSearch.trim().toLowerCase()));
  const openUserDrawer = () => { setUserDrawerSearch(""); setPendingUserIds([]); setUserDrawerOpen(true); };
  const linkSelectedUsers = () => { if (!pendingUserIds.length) return; setSelectedUsers((items) => [...items, ...pendingUserIds.filter((id) => !items.includes(id))]); setPendingUserIds([]); setUserDrawerOpen(false); };
  return <div className="bip-role-editor">
    <nav className="bip-editor-tabs" aria-label="角色設定分頁">
      <button type="button" className={activeTab === "basic" ? "active" : ""} onClick={() => setActiveTab("basic")}>基礎數據</button>
      <button type="button" className={activeTab === "users" ? "active" : ""} onClick={() => setActiveTab("users")}>用戶<span>{selectedUsers.length}</span></button>
      <button type="button" className={activeTab === "permissions" ? "active" : ""} onClick={() => setActiveTab("permissions")}>操作權限<span>{selectedPermissions.length}</span></button>
    </nav>
    {activeTab === "basic" && <form className="role-editor-form" onSubmit={submit}>
      <section className="group-editor-section"><header><div><h3>角色資料</h3></div></header><div className="group-editor-grid role-basic-grid">
        <label className="bip-field"><span><b>*</b>編號</span><input required disabled={!!record} defaultValue={record?.code} placeholder="系統可自動產生" /></label>
        <label className="bip-field"><span><b>*</b>名稱</span><input required defaultValue={record?.name} placeholder="請輸入角色名稱" /></label>
        <label className="bip-field"><span><b>*</b>層級</span><input required type="number" min="1" step="1" inputMode="numeric" defaultValue={record?.level} placeholder="請輸入數字層級" /></label>
        <label className="bip-field"><span><b>*</b>角色類型</span><Select ariaLabel="角色類型" value={record?.roleType ?? "普通用戶"} onChange={() => undefined}><option>管理員</option><option>普通用戶</option></Select></label>
      </div></section>
      <section className="group-editor-section"><header><div><h3>角色狀態</h3></div></header><div className="group-editor-status"><div className="bip-field"><span>狀態</span><div className="switch-row"><label className="switch-control"><input type="checkbox" defaultChecked={record?.status !== "停用"} /><span className="switch" /></label></div></div><div className="group-editor-count"><span>目前關聯用戶數</span><strong>{selectedUsers.length}</strong></div></div></section>
      <p className="bip-form-hint"><b>*</b> 為必填欄位</p>
      <button type="submit" className="sr-only">儲存</button>
    </form>}
    {activeTab === "users" && <section className="bip-tab-panel group-user-section role-user-section">
      <header><div><h3>關聯用戶</h3><p>管理可使用此角色權限的用戶。</p></div><Button variant="primary" icon={<PlusOutlined />} onClick={openUserDrawer}>新增關聯</Button></header>
      <div className="group-user-toolbar"><div className="group-user-search"><SearchOutlined /><input value={userSearch} onChange={(event) => setUserSearch(event.target.value)} placeholder="搜尋已關聯用戶姓名或登入帳號" /></div></div>
      <div className="group-user-table"><div className="group-user-table-head"><div>用戶姓名</div><div>登入帳號</div><div>關聯狀態</div><div>操作</div></div>{linkedUsers.length ? linkedUsers.map((user) => <div className="group-user-table-row" key={user.id}><div><strong>{user.name}</strong></div><div>{user.account}</div><div><span className="group-user-role">已關聯</span></div><div className="group-user-actions"><button type="button" onClick={() => setSelectedUsers((items) => items.filter((id) => id !== user.id))}>移除</button></div></div>) : <div className="group-user-empty">暫無關聯用戶</div>}</div>
    </section>}
    {userDrawerOpen && <div className="group-user-drawer-mask" role="presentation" onMouseDown={() => setUserDrawerOpen(false)}><aside className="group-user-drawer" role="dialog" aria-modal="true" aria-label="新增關聯用戶" onMouseDown={(event) => event.stopPropagation()}><header><div><h3>新增關聯用戶</h3><p>搜尋並選擇要加入此角色的用戶。</p></div><button type="button" aria-label="關閉" onClick={() => setUserDrawerOpen(false)}><CloseOutlined /></button></header><div className="group-user-drawer-body"><div className="group-user-drawer-search"><SearchOutlined /><input autoFocus value={userDrawerSearch} onChange={(event) => setUserDrawerSearch(event.target.value)} placeholder="搜尋用戶姓名或登入帳號" /></div><div className="group-user-drawer-summary"><strong>可關聯用戶</strong><span>{drawerUsers.length} 個結果</span></div><ul className="group-user-drawer-list">{drawerUsers.length ? drawerUsers.map((user) => <li key={user.id}><label><input type="checkbox" checked={pendingUserIds.includes(user.id)} onChange={() => setPendingUserIds((ids) => ids.includes(user.id) ? ids.filter((id) => id !== user.id) : [...ids, user.id])} /><span><strong>{user.name}</strong><small>{user.account}</small></span></label></li>) : <li className="group-user-drawer-empty">沒有可關聯的用戶</li>}</ul></div><footer><span>已選 {pendingUserIds.length} 位</span><Button variant="primary" disabled={!pendingUserIds.length} onClick={linkSelectedUsers}>批量關聯</Button></footer></aside></div>}
    {activeTab === "permissions" && <section className="bip-tab-panel role-permissions-panel">
      <div className="bip-tab-toolbar"><div><strong>操作權限</strong><span>配置此角色可使用的功能及操作</span></div><span className="role-tab-count">已選 {selectedPermissions.length} 項</span></div>
      <div className="role-permission-groups">{roleEditorPermissions.map((group) => <section key={group.title}><header><strong>{group.title}</strong><span>{group.items.filter((item) => selectedPermissions.includes(item)).length}/{group.items.length}</span></header>{group.items.map((permission) => <label key={permission}><input type="checkbox" checked={selectedPermissions.includes(permission)} onChange={() => togglePermission(permission)} /><span>{permission}</span></label>)}</section>)}</div>
    </section>}
  </div>;
}

type GroupLinkedUser = { id: string; name: string; account: string; role: "成員" | "管理員" };
const groupUserOptions: GroupLinkedUser[] = [
  { id: "chan-kalong", name: "陳家朗", account: "chan.kalong", role: "管理員" },
  { id: "lei-chicheng", name: "李芷晴", account: "lei.chicheng", role: "成員" },
  { id: "leong-kaman", name: "梁嘉敏", account: "leong.kaman", role: "成員" },
  { id: "wong-chifong", name: "黃志峰", account: "wong.chifong", role: "成員" },
];

export function GroupEditor({ record, onSave }: { record?: GenericRecord; onSave: () => void }) {
  const [activeTab, setActiveTab] = useState<"details" | "users">("details");
  const [linkedUsers, setLinkedUsers] = useState<GroupLinkedUser[]>(record ? groupUserOptions.slice(0, 2) : []);
  const [userSearch, setUserSearch] = useState("");
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [userDrawerOpen, setUserDrawerOpen] = useState(false);
  const [userDrawerSearch, setUserDrawerSearch] = useState("");
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const visibleUsers = useMemo(() => linkedUsers.filter((user) => `${user.name}${user.account}`.toLowerCase().includes(userSearch.trim().toLowerCase())), [linkedUsers, userSearch]);
  const availableUsers = groupUserOptions.filter((user) => !linkedUsers.some((linked) => linked.id === user.id));
  const drawerUsers = useMemo(() => availableUsers.filter((user) => `${user.name}${user.account}`.toLowerCase().includes(userDrawerSearch.trim().toLowerCase())), [availableUsers, userDrawerSearch]);
  function submit(event: FormEvent) { event.preventDefault(); onSave(); }
  function openUserDrawer() {
    setUserDrawerSearch("");
    setSelectedUserIds([]);
    setUserDrawerOpen(true);
  }
  function linkSelectedUsers() {
    const selected = groupUserOptions.filter((user) => selectedUserIds.includes(user.id));
    if (!selected.length) return;
    setLinkedUsers((users) => [...users, ...selected]);
    setSelectedUserIds([]);
    setUserDrawerOpen(false);
  }
  return <form className="group-editor-form" onSubmit={submit}>
    {record && <nav className="group-editor-tabs" aria-label="群組設定分頁"><button type="button" className={activeTab === "details" ? "active" : ""} onClick={() => setActiveTab("details")}>群組資料</button><button type="button" className={activeTab === "users" ? "active" : ""} onClick={() => setActiveTab("users")}>關聯用戶<span>{linkedUsers.length}</span></button></nav>}
    {activeTab === "details" && <><section className="group-editor-section"><header><div><h3>群組資料</h3></div></header><div className="group-editor-grid">
      <Field label="編號" required hint="儲存後不可修改"><input defaultValue={record?.code} placeholder="系統可自動產生" /></Field>
      <Field label="名稱" required><input defaultValue={record?.name} placeholder="請輸入群組名稱" /></Field>
      <Field label="附屬部門" required><Select value={record?.owner ?? "市政管理廳"} onChange={() => undefined}><option>市政管理廳</option><option>環境衛生處</option><option>園林綠化處</option><option>資訊處</option></Select></Field>
      <Field label="群組說明"><textarea defaultValue={record?.note} placeholder="請輸入群組說明" rows={4} /></Field>
    </div></section>
    <section className="group-editor-section"><header><div><h3>群組狀態</h3></div></header><div className="group-editor-status"><Field label="啟用狀態"><div className="switch-row"><label className="switch-control"><input type="checkbox" defaultChecked={record?.status !== "停用"} /><span className="switch" /></label></div></Field><div className="group-editor-count"><span>目前關聯用戶數</span><strong>{linkedUsers.length}</strong></div></div></section></>}
    {record && activeTab === "users" && <section className="group-editor-section group-user-section"><header><div><h3>關聯用戶</h3></div><Button variant="primary" icon={<PlusOutlined />} onClick={openUserDrawer}>新增關聯</Button></header><div className="group-user-toolbar"><div className="group-user-search"><SearchOutlined /><input value={userSearch} onChange={(event) => setUserSearch(event.target.value)} placeholder="搜尋已關聯用戶姓名或登入帳號" /></div></div><div className="group-user-table"><div className="group-user-table-head"><div>用戶姓名</div><div>登入帳號</div><div>群組角色</div><div>操作</div></div>{visibleUsers.length ? visibleUsers.map((user) => <div className="group-user-table-row" key={user.id}><div><strong>{user.name}</strong></div><div>{user.account}</div><div>{editingUserId === user.id ? <Select value={user.role} onChange={(value) => setLinkedUsers((users) => users.map((item) => item.id === user.id ? { ...item, role: value as GroupLinkedUser["role"] } : item))}><option>成員</option><option>管理員</option></Select> : <span className="group-user-role">{user.role}</span>}</div><div className="group-user-actions"><button type="button" onClick={() => setEditingUserId(editingUserId === user.id ? null : user.id)}>{editingUserId === user.id ? "完成" : "編輯"}</button><button type="button" onClick={() => setLinkedUsers((users) => users.filter((item) => item.id !== user.id))}>移除</button></div></div>) : <div className="group-user-empty">暫無關聯用戶</div>}</div></section>}
    {userDrawerOpen && <div className="group-user-drawer-mask" role="presentation" onMouseDown={() => setUserDrawerOpen(false)}><aside className="group-user-drawer" role="dialog" aria-modal="true" aria-label="新增關聯用戶" onMouseDown={(event) => event.stopPropagation()}><header><div><h3>新增關聯用戶</h3><p>搜尋並選擇要加入此群組的用戶。</p></div><button type="button" aria-label="關閉" onClick={() => setUserDrawerOpen(false)}><CloseOutlined /></button></header><div className="group-user-drawer-body"><div className="group-user-drawer-search"><SearchOutlined /><input autoFocus value={userDrawerSearch} onChange={(event) => setUserDrawerSearch(event.target.value)} placeholder="搜尋用戶姓名或登入帳號" /></div><div className="group-user-drawer-summary"><strong>可關聯用戶</strong><span>{drawerUsers.length} 個結果</span></div><ul className="group-user-drawer-list">{drawerUsers.length ? drawerUsers.map((user) => <li key={user.id}><label><input type="checkbox" checked={selectedUserIds.includes(user.id)} onChange={() => setSelectedUserIds((ids) => ids.includes(user.id) ? ids.filter((id) => id !== user.id) : [...ids, user.id])} /><span><strong>{user.name}</strong><small>{user.account}</small></span></label></li>) : <li className="group-user-drawer-empty">沒有可關聯的用戶</li>}</ul></div><footer><span>已選 {selectedUserIds.length} 位</span><Button variant="primary" disabled={!selectedUserIds.length} onClick={linkSelectedUsers}>批量關聯</Button></footer></aside></div>}
    <button type="submit" className="sr-only">儲存</button>
  </form>;
}

type UserEditorTab = "basic" | "units" | "roles" | "api" | "copy";
type UnitDrawerState = { mode: "add" | "edit"; unitType: string; workGroup: string };
type UserRoleOption = { id: string; label: string };
type CopyUserOption = { id: string; name: string; account: string };

const userEditorTabs: { key: UserEditorTab; label: string }[] = [
  { key: "basic", label: "基礎數據" }, { key: "units", label: "單位" }, { key: "roles", label: "角色" },
  { key: "api", label: "API" }, { key: "copy", label: "複製" },
];

const copyUserOptions: CopyUserOption[] = [
  { id: "metaarchitgias01", name: "市政管理員", account: "metaarchitgias01" },
  { id: "ifao2", name: "巡查用戶", account: "ifao2" },
  { id: "report-viewer", name: "報表檢視員", account: "report.viewer" },
];

export function UserEditor({ record, onSave }: { record?: GenericRecord; onSave: () => void }) {
  const [activeTab, setActiveTab] = useState<UserEditorTab>("basic");
  const [unitDrawer, setUnitDrawer] = useState<UnitDrawerState | null>(null);
  const [workGroup, setWorkGroup] = useState("");
  const [availableRoles, setAvailableRoles] = useState<UserRoleOption[]>([
    { id: "asa", label: "asa" }, { id: "backoffice", label: "後臺用戶" }, { id: "frontoffice", label: "前台角色" },
  ]);
  const [assignedRoles, setAssignedRoles] = useState<UserRoleOption[]>([]);
  const [selectedAvailableRole, setSelectedAvailableRole] = useState<string | null>(null);
  const [selectedAssignedRole, setSelectedAssignedRole] = useState<string | null>(null);
  const [copyNameQuery, setCopyNameQuery] = useState("");
  const [copyAccountQuery, setCopyAccountQuery] = useState("");
  const [copySearchName, setCopySearchName] = useState("");
  const [copySearchAccount, setCopySearchAccount] = useState("");
  const [selectedCopyUser, setSelectedCopyUser] = useState<string | null>(null);
  const copyResults = useMemo(() => copyUserOptions.filter((user) => user.name.includes(copySearchName) && user.account.toLowerCase().includes(copySearchAccount.toLowerCase())), [copySearchName, copySearchAccount]);
  const moveRole = (direction: "toAssigned" | "toAvailable", all = false) => {
    if (direction === "toAssigned") {
      const moving = all ? availableRoles : availableRoles.filter((role) => role.id === selectedAvailableRole);
      if (!moving.length) return;
      setAvailableRoles((roles) => roles.filter((role) => !moving.some((item) => item.id === role.id)));
      setAssignedRoles((roles) => [...roles, ...moving]);
      setSelectedAvailableRole(null);
    } else {
      const moving = all ? assignedRoles : assignedRoles.filter((role) => role.id === selectedAssignedRole);
      if (!moving.length) return;
      setAssignedRoles((roles) => roles.filter((role) => !moving.some((item) => item.id === role.id)));
      setAvailableRoles((roles) => [...roles, ...moving]);
      setSelectedAssignedRole(null);
    }
  };
  const submit = (event: FormEvent) => { event.preventDefault(); onSave(); };
  return <div className="bip-user-editor">
    <nav className="bip-editor-tabs" aria-label="用戶設定分頁">{userEditorTabs.map((item) => <button key={item.key} type="button" className={activeTab === item.key ? "active" : ""} onClick={() => setActiveTab(item.key)}>{item.label}</button>)}</nav>
    {activeTab === "basic" && <form className="bip-user-form" onSubmit={submit}>
      <div className="bip-user-form-grid">
        <label className="bip-field"><span><b>*</b>用戶姓名</span><input required defaultValue={record?.name} placeholder="請輸入用戶姓名" /></label>
        <label className="bip-field"><span><b>*</b>登入帳號</span><input required disabled defaultValue={record?.code?.toLowerCase()} /></label>
        <label className="bip-field"><span>手機電話</span><input placeholder="請輸入手機電話" /><small>用於短訊接收</small></label>
        <label className="bip-field"><span>聯絡電話</span><input placeholder="請輸入聯絡電話" /><small>用於巡查詳情及工作詳情的顯示</small></label>
        <label className="bip-field"><span>EUID</span><input placeholder="請輸入 EUID" /></label>
        <label className="bip-field"><span>電郵地址</span><input type="email" placeholder="請輸入電郵地址" /></label>
        <fieldset className="bip-field bip-choice-field"><legend><b>*</b>市政署用戶</legend><div className="bip-radio-group"><label><input type="radio" name="iam-user" defaultChecked />是</label><label><input type="radio" name="iam-user" />否</label></div></fieldset>
        <fieldset className="bip-field bip-choice-field"><legend><b>*</b>語言</legend><div className="bip-radio-group bip-radio-wrap"><label><input type="radio" name="language" defaultChecked />繁體中文</label><label><input type="radio" name="language" />Português</label><label><input type="radio" name="language" />English</label></div></fieldset>
        <fieldset className="bip-field bip-choice-field"><legend><b>*</b>狀態</legend><div className="bip-radio-group"><label><input type="radio" name="user-status" defaultChecked={record?.status !== "停用"} />生效</label><label><input type="radio" name="user-status" defaultChecked={record?.status === "停用"} />失效</label></div></fieldset>
        <fieldset className="bip-field bip-choice-field"><legend><b>*</b>鎖定</legend><div className="bip-radio-group"><label><input type="radio" name="locked" />是</label><label><input type="radio" name="locked" defaultChecked />否</label></div></fieldset>
        <label className="bip-field bip-field-full"><span>獲取驗證碼次數</span><input disabled value="0" readOnly /></label>
      </div>
      <p className="bip-form-hint"><b>*</b> 為必填欄位</p>
      <button type="submit" className="sr-only">儲存</button>
    </form>}
    {activeTab === "units" && <section className="bip-tab-panel"><div className="bip-unit-groups">{["查看單位", "巡查單位", "執行單位", "報告單位"].map((label) => { const rowWorkGroup = label === "執行單位" ? "公共設施維護組" : "北區巡查一組"; return <section className="bip-unit-group" key={label}><header><strong>{label}</strong><Button variant="text" onClick={() => { setWorkGroup(""); setUnitDrawer({ mode: "add", unitType: label, workGroup: "" }); }}>新增</Button></header><div className="bip-unit-table"><div className="bip-unit-table-head"><div>工作組</div><div>短訊通知（是/否）</div><div>電郵通知（是/否）</div><div>推送通知（是/否）</div><div>操作</div></div><div className="bip-unit-table-row"><div>{rowWorkGroup}</div><div>否</div><div>否</div><div>否</div><div className="bip-unit-row-actions"><button type="button" onClick={() => { setWorkGroup(rowWorkGroup); setUnitDrawer({ mode: "edit", unitType: label, workGroup: rowWorkGroup }); }}>編輯</button><button type="button">刪除</button></div></div></div></section>; })}</div></section>}
    {activeTab === "roles" && <section className="bip-tab-panel bip-role-panel"><div className="bip-role-picklist" aria-label="角色分配"><div className="bip-role-list-panel"><div className="bip-role-list-title"><strong>可選角色</strong><span>{availableRoles.length} 個角色</span></div><ul className="bip-role-list" role="listbox" aria-label="可選角色">{availableRoles.map((role) => <li key={role.id}><button type="button" role="option" aria-selected={selectedAvailableRole === role.id} className={selectedAvailableRole === role.id ? "selected" : ""} onClick={() => setSelectedAvailableRole(role.id)}>{role.label}</button></li>)}</ul></div><div className="bip-role-actions" aria-label="角色移動操作"><button type="button" title="全部加入" aria-label="全部加入" disabled={!availableRoles.length} onClick={() => moveRole("toAssigned", true)}><DoubleRightOutlined /></button><button type="button" title="加入" aria-label="加入" disabled={!selectedAvailableRole} onClick={() => moveRole("toAssigned")}><RightOutlined /></button><button type="button" title="移除" aria-label="移除" disabled={!selectedAssignedRole} onClick={() => moveRole("toAvailable")}><LeftOutlined /></button><button type="button" title="全部移除" aria-label="全部移除" disabled={!assignedRoles.length} onClick={() => moveRole("toAvailable", true)}><DoubleLeftOutlined /></button></div><div className="bip-role-list-panel"><div className="bip-role-list-title"><strong>已選角色</strong><span>{assignedRoles.length} 個角色</span></div><ul className="bip-role-list" role="listbox" aria-label="已選角色">{assignedRoles.map((role) => <li key={role.id}><button type="button" role="option" aria-selected={selectedAssignedRole === role.id} className={selectedAssignedRole === role.id ? "selected" : ""} onClick={() => setSelectedAssignedRole(role.id)}>{role.label}</button></li>)}</ul></div></div></section>}
    {activeTab === "api" && <section className="bip-tab-panel"><div className="bip-tab-toolbar"><div><strong>API</strong><span>管理此用戶的 API 存取憑證</span></div><Button variant="primary">重新產生</Button></div><label className="bip-field bip-field-full"><span>API Token</span><textarea rows={5} readOnly value="••••••••••••••••••••••••••••••••" /></label><p className="bip-form-hint">Token 只會在產生後顯示一次，請妥善保存。</p></section>}
    {activeTab === "copy" && <section className="bip-tab-panel"><div className="bip-copy-panel"><header className="bip-copy-header"><div><strong>複製用戶設定</strong><p>搜尋並選擇目標用戶，複製目前用戶的單位及角色。</p></div></header><section className="bip-copy-section bip-copy-target"><div className="bip-copy-section-title"><strong>搜尋並選擇目標用戶</strong><span>搜尋結果會顯示於下方列表</span></div><div className="bip-copy-search-grid"><label className="bip-field"><span>用戶姓名</span><div className="bip-copy-search"><SearchOutlined /><input value={copyNameQuery} onChange={(event) => setCopyNameQuery(event.target.value)} placeholder="請輸入用戶姓名" /></div></label><label className="bip-field"><span>登入帳號</span><div className="bip-copy-search"><SearchOutlined /><input value={copyAccountQuery} onChange={(event) => setCopyAccountQuery(event.target.value)} placeholder="請輸入登入帳號" /></div></label><div className="bip-copy-search-action"><Button icon={<SearchOutlined />} onClick={() => { setCopySearchName(copyNameQuery.trim()); setCopySearchAccount(copyAccountQuery.trim()); setSelectedCopyUser(null); }}>搜尋</Button></div></div><div className="bip-copy-results"><div className="bip-copy-results-header"><strong>搜尋結果</strong><span>{copyResults.length} 個用戶</span></div>{copyResults.length ? <ul className="bip-copy-result-list" role="listbox" aria-label="搜尋結果">{copyResults.map((user) => <li key={user.id}><button type="button" role="option" aria-selected={selectedCopyUser === user.id} className={selectedCopyUser === user.id ? "selected" : ""} onClick={() => setSelectedCopyUser(user.id)}><span><strong>{user.name}</strong><small>{user.account}</small></span>{selectedCopyUser === user.id && <CheckCircleFilled />}</button></li>)}</ul> : <div className="bip-copy-empty">暫無符合條件的用戶</div>}</div><div className="bip-copy-actions"><span>{selectedCopyUser ? "已選擇目標用戶" : "請從搜尋結果選擇目標用戶"}</span><Button variant="primary" disabled={!selectedCopyUser}>確認複製</Button></div></section></div></section>}
    {unitDrawer && <div className="bip-unit-drawer-mask" role="presentation" onMouseDown={() => setUnitDrawer(null)}><section className="bip-unit-drawer" role="dialog" aria-modal="true" aria-label={`${unitDrawer.mode === "edit" ? "編輯" : "新增"}${unitDrawer.unitType}`} onMouseDown={(event) => event.stopPropagation()}><header><div><h3>{unitDrawer.mode === "edit" ? "編輯" : "新增"}{unitDrawer.unitType}</h3><p>指定工作組及通知方式</p></div><button type="button" aria-label="關閉" onClick={() => setUnitDrawer(null)}><CloseOutlined /></button></header><form onSubmit={(event) => { event.preventDefault(); setUnitDrawer(null); }}><label className="bip-field"><span><b>*</b>工作組</span><Select ariaLabel="工作組" value={workGroup} onChange={setWorkGroup}><option value="">請選擇工作組</option><option>北區巡查一組</option><option>中區巡查一組</option><option>公共設施維護組</option></Select></label><div className="bip-unit-notify-grid"><fieldset className="bip-field bip-choice-field"><legend><b>*</b>短訊通知</legend><div className="bip-radio-group"><label><input type="radio" name="unit-sms" />是</label><label><input type="radio" name="unit-sms" defaultChecked />否</label></div></fieldset><fieldset className="bip-field bip-choice-field"><legend><b>*</b>電郵通知</legend><div className="bip-radio-group"><label><input type="radio" name="unit-email" />是</label><label><input type="radio" name="unit-email" defaultChecked />否</label></div></fieldset><fieldset className="bip-field bip-choice-field"><legend><b>*</b>推送通知</legend><div className="bip-radio-group"><label><input type="radio" name="unit-push" />是</label><label><input type="radio" name="unit-push" defaultChecked />否</label></div></fieldset></div><footer><Button type="button" onClick={() => setUnitDrawer(null)}>取消</Button><Button type="submit" variant="primary">{unitDrawer.mode === "edit" ? "確認修改" : "確認新增"}</Button></footer></form></section></div>}
  </div>;
}

export interface PickerRow { id: string; title: string; meta: string; group: string }
const unique = (values: string[]) => [...new Set(values)];
const contains = (value: string, query: string) => !query.trim() || value.toLowerCase().includes(query.trim().toLowerCase());

/** Right-side batch picker with keyword search, a group filter, select-all-results and optional group headings. */
export function BatchPickerDrawer({ title, noun, rows, filterLabel, description, grouped = false, confirmLabel = "批量加入", footer, onClose, onConfirm }: { title: string; noun: string; rows: PickerRow[]; filterLabel: string; description?: string; grouped?: boolean; confirmLabel?: string; footer?: ReactNode; onClose: () => void; onConfirm: (ids: string[]) => void }) {
  const [search, setSearch] = useState(""); const [filter, setFilter] = useState(""); const [picked, setPicked] = useState<string[]>([]);
  const visible = rows.filter((row) => (!filter || row.group === filter) && (contains(row.title, search) || contains(row.meta, search)));
  const allPicked = visible.length > 0 && visible.every((row) => picked.includes(row.id));
  const togglePick = (id: string) => setPicked((ids) => ids.includes(id) ? ids.filter((item) => item !== id) : [...ids, id]);
  const toggleRows = (targets: PickerRow[], all: boolean) => setPicked((ids) => all ? ids.filter((id) => !targets.some((row) => row.id === id)) : unique([...ids, ...targets.map((row) => row.id)]));
  const sections = grouped ? unique(visible.map((row) => row.group)).map((group) => ({ group, rows: visible.filter((row) => row.group === group) })) : [{ group: "", rows: visible }];
  const rowItem = (row: PickerRow) => <li key={row.id}><label><input type="checkbox" checked={picked.includes(row.id)} onChange={() => togglePick(row.id)} /><span><strong>{row.title}</strong><small>{row.meta}</small></span></label></li>;
  return <div className="group-user-drawer-mask" role="presentation" onMouseDown={onClose}><aside className="group-user-drawer tpl-side-drawer" role="dialog" aria-modal="true" aria-label={title} onMouseDown={(event) => event.stopPropagation()}>
    <header><div><h3>{title}</h3><p>{description ?? `搜尋及複選${noun}，一次加入。`}</p></div><button type="button" aria-label="關閉" onClick={onClose}><CloseOutlined /></button></header>
    <div className="group-user-drawer-body">
      <div className="tpl-picker-filters"><div className="group-user-drawer-search"><SearchOutlined /><input autoFocus value={search} onChange={(event) => setSearch(event.target.value)} placeholder={`搜尋${noun}名稱或編號`} /></div><Select ariaLabel={filterLabel} value={filter} onChange={setFilter}><option value="">全部{filterLabel}</option>{unique(rows.map((row) => row.group)).map((group) => <option key={group}>{group}</option>)}</Select></div>
      <div className="group-user-drawer-summary"><label className="tpl-pick-all"><input type="checkbox" checked={allPicked} disabled={!visible.length} onChange={() => toggleRows(visible, allPicked)} /><strong>全選目前結果</strong></label><span>{visible.length} 個結果</span></div>
      <ul className="group-user-drawer-list">{visible.length ? sections.flatMap((section) => {
        if (!grouped) return section.rows.map(rowItem);
        const sectionAll = section.rows.every((row) => picked.includes(row.id));
        return [<li key={`group-${section.group}`} className="tpl-picker-group"><label><input type="checkbox" aria-label={`全選${section.group}`} checked={sectionAll} onChange={() => toggleRows(section.rows, sectionAll)} /><strong>{section.group}</strong><span>{section.rows.length} 項</span></label></li>, ...section.rows.map(rowItem)];
      }) : <li className="group-user-drawer-empty">沒有可加入的{noun}</li>}</ul>
    </div>
    {footer && <div className="picker-drawer-extra">{footer}</div>}
    <footer><span>已選 {picked.length} 個</span><Button variant="primary" disabled={!picked.length} onClick={() => onConfirm(picked)}>{confirmLabel}</Button></footer>
  </aside></div>;
}
