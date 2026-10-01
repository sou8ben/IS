import { createContext, useContext, useMemo, useState, type FormEvent, type ReactNode } from "react";
import {
  CheckCircleFilled, CloseOutlined, DeleteOutlined, DownOutlined, EditOutlined,
  EnvironmentFilled, FileImageOutlined, FilePdfOutlined, FilterOutlined, InboxOutlined,
  LeftOutlined, LoadingOutlined, MoreOutlined, PaperClipOutlined, PlusOutlined,
  ReloadOutlined, SearchOutlined, SortAscendingOutlined, UploadOutlined, WarningFilled,
} from "@ant-design/icons";
import type { Column, GenericRecord, StatusTone } from "./types";

const mapImageUrl = `${import.meta.env.BASE_URL}assets/macau-operations-map.png`;

export function Button({ children, variant = "default", icon, onClick, disabled, type = "button", className = "" }: {
  children: ReactNode; variant?: "primary" | "default" | "text" | "danger"; icon?: ReactNode;
  onClick?: () => void; disabled?: boolean; type?: "button" | "submit"; className?: string;
}) {
  return <button className={`btn btn-${variant} ${className}`} onClick={onClick} disabled={disabled} type={type}>{icon}<span>{children}</span></button>;
}

export const toneMap: Record<string, StatusTone> = {
  "啟用": "success", "已完成": "success", "已關閉": "success", "已解決": "info", "正常": "success", "已發佈": "success",
  "進行中": "info", "跟進中": "info", "將逾時": "warning", "未開始": "neutral", "新建": "neutral", "無需跟進": "neutral",
  "已逾時": "danger", "特急": "danger", "緊急": "warning", "停用": "neutral", "已中止": "warning", "待人工分派": "danger",
};

export function StatusTag({ children, tone }: { children: ReactNode; tone?: StatusTone }) {
  const label = String(children);
  return <span className={`status-tag tone-${tone ?? toneMap[label] ?? "neutral"}`}>{children}</span>;
}

export function PageHeader({ title, description, actions, eyebrow }: { title: string; description?: string; actions?: ReactNode; eyebrow?: string }) {
  return <div className="page-header">
    <div>{eyebrow && <div className="eyebrow">{eyebrow}</div>}<h1>{title}</h1>{description && <p>{description}</p>}</div>
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

export function DenseTable<T extends { id: string }>({ rows, columns, selected, onSelected, onRowClick, emptyText = "暫無資料" }: {
  rows: T[]; columns: Column<T>[]; selected?: string[]; onSelected?: (ids: string[]) => void; onRowClick?: (row: T) => void; emptyText?: string;
}) {
  const [sortKey, setSortKey] = useState<string>("");
  const [ascending, setAscending] = useState(true);
  const sortedRows = useMemo(() => {
    if (!sortKey) return rows;
    return [...rows].sort((a, b) => {
      const result = String((a as Record<string, unknown>)[sortKey] ?? "").localeCompare(String((b as Record<string, unknown>)[sortKey] ?? ""), "zh-Hant");
      return ascending ? result : -result;
    });
  }, [rows, sortKey, ascending]);

  function toggleAll() {
    if (!onSelected) return;
    onSelected(selected?.length === rows.length ? [] : rows.map((row) => row.id));
  }

  return <div className="table-shell">
    <table className="dense-table">
      <thead><tr>
        {onSelected && <th className="check-cell"><input aria-label="全選" type="checkbox" checked={!!rows.length && selected?.length === rows.length} onChange={toggleAll} /></th>}
        {columns.map((column) => <th key={String(column.key)} style={{ width: column.width }} onClick={() => {
          if (!column.sortable) return;
          if (sortKey === column.key) setAscending(!ascending); else { setSortKey(String(column.key)); setAscending(true); }
        }} className={column.sortable ? "sortable" : ""}>{column.title}{sortKey === column.key && <SortAscendingOutlined className={!ascending ? "sort-desc" : ""} />}</th>)}
        <th className="more-cell" />
      </tr></thead>
      <tbody>
        {sortedRows.map((row) => <tr key={row.id} onClick={() => onRowClick?.(row)} className={onRowClick ? "clickable" : ""}>
          {onSelected && <td className="check-cell" onClick={(event) => event.stopPropagation()}><input aria-label={`選擇 ${row.id}`} type="checkbox" checked={selected?.includes(row.id)} onChange={() => onSelected?.(selected?.includes(row.id) ? selected.filter((id) => id !== row.id) : [...(selected ?? []), row.id])} /></td>}
          {columns.map((column) => <td key={String(column.key)}>{column.render ? column.render(row) : String((row as Record<string, unknown>)[String(column.key)] ?? "—")}</td>)}
          <td className="more-cell"><button aria-label="更多操作" onClick={(event) => event.stopPropagation()}><MoreOutlined /></button></td>
        </tr>)}
      </tbody>
    </table>
    {!rows.length && <div className="empty-state"><InboxOutlined /><strong>{emptyText}</strong><span>請調整篩選條件後再試</span></div>}
  </div>;
}

export function Pagination({ total, page = 1 }: { total: number; page?: number }) {
  return <div className="pagination"><span>共 {total} 筆</span><Button icon={<LeftOutlined />} disabled={page === 1}>上一頁</Button><span className="page-current">{page}</span><Button>下一頁</Button><Select value="15" onChange={() => undefined} ariaLabel="每頁筆數"><option>15</option><option>30</option><option>50</option></Select></div>;
}

export function FormDrawer({ open, title, subtitle, children, onClose, onSubmit, submitLabel = "儲存" }: {
  open: boolean; title: string; subtitle?: string; children: ReactNode; onClose: () => void; onSubmit?: () => void; submitLabel?: string;
}) {
  if (!open) return null;
  return <div className="overlay" role="presentation" onMouseDown={onClose}>
    <aside className="drawer" role="dialog" aria-modal="true" aria-label={title} onMouseDown={(event) => event.stopPropagation()}>
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
  return <aside className="tree-panel"><div className="tree-title"><strong>{title}</strong><button aria-label="新增分類"><PlusOutlined /></button></div>
    <div className="tree-search"><SearchOutlined /><input placeholder="搜尋分類" /></div>
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
    <Field label="狀態"><label className="switch-row"><input type="checkbox" defaultChecked={record?.status !== "停用"} /><span className="switch" />啟用</label></Field>
    <button type="submit" className="sr-only">儲存</button>
  </form>;
}
