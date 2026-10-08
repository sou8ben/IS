import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { ArrowDownOutlined, ArrowUpOutlined, DeleteOutlined, EditOutlined, ExportOutlined, PlusOutlined, ReloadOutlined, SearchOutlined } from "@ant-design/icons";
import { Button, DenseTable, Field, FormDrawer, PageHeader, Pagination, Select, StatusTag, useToast } from "./components";
import { workTypeOptions } from "./event-data";
import { groupCatalog, groupCategories } from "./group-catalog";
import { itemTypeName } from "./item-data";
import {
  AUX_COUNT_MAX, auxSources, BOOL_OPTIONS, deactivationBlock, objectAttributes, evaluateNotifications, hasOptions, HOURS_MAX, inputKinds, isLocked, itemUsage, MESSAGE_MAX, nextTypeId, noticeLevels, notifyPlaceholders, notifyStates, OPTIONS_MAX, sortItems, TEXT_LIMIT_MAX, validateItem, validateItemType,
  type AuxDef, type AuxSource, type ItemInputKind, type ItemIssue, type ItemSummary, type ItemTab, type ItemTypeRecord, type ManagedItem, type NotifyRule, type RecordStatus, type SlaHours,
} from "./item-rules";
import { useDemo } from "./store";
import type { Column } from "./types";
import { demoNow, itemOfWork, resolveWork, useInspectionRefs, useWorkLogs } from "./work-data";

const contains = (value: string, query: string) => !query.trim() || value.toLowerCase().includes(query.trim().toLowerCase());
const nowText = () => { const d = new Date(); const pad = (n: number) => String(n).padStart(2, "0"); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`; };
const signedIn = "陳家朗";
const localId = (prefix: string) => `${prefix}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;
const groupNames = groupCatalog.map((group) => group.name);
const kindHints: Record<ItemInputKind, string> = { "是非": "以「是／否」作答", "單選": "從選項中選擇一項", "多選": "可選擇多個選項", "輸入框": "自由輸入文字", "簽名": "以觸控在手機螢幕上簽名" };

function download(name: string, data: unknown) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }));
  const link = document.createElement("a"); link.href = url; link.download = name; link.click(); URL.revokeObjectURL(url);
}
function StatusSection({ title, label, value, count, onChange }: { title: string; label: string; value: RecordStatus; count: { label: string; value: string }; onChange: (active: boolean) => void }) {
  return <section className="group-editor-section"><header><h3>{title}</h3></header><div className="group-editor-status">
    <div className="bip-field"><span>狀態</span><div className="switch-row"><label className="switch-control"><input type="checkbox" aria-label={label} checked={value === "生效"} onChange={(event) => onChange(event.target.checked)} /><span className="switch" /></label><span className="switch-label">{value}</span></div></div>
    <div className="group-editor-count"><span>{count.label}</span><strong>{count.value}</strong></div></div></section>;
}

// ---- 頁面：左側項目類型，右側巡查項目 ----
export function ItemListPage() {
  const [params, setParams] = useSearchParams();
  const { items, itemTypes, saveItemTypes } = useDemo(); const { showToast } = useToast();
  const [activeType, setActiveType] = useState(params.get("type") ?? ""); // "" = all items
  const [creating, setCreating] = useState(0); const [editingType, setEditingType] = useState<ItemTypeRecord | null>(null);
  const selectType = (id: string) => { setActiveType(id); setParams(id ? { type: id } : {}, { replace: true }); };
  const newType = () => setEditingType({ id: "", name: "", order: Math.max(0, ...itemTypes.map((type) => type.order)) + 1, status: "生效", updatedBy: "", updatedAt: "" });
  return <div className="page-content item-page">
    <PageHeader title="巡查項目" actions={<><Button icon={<ExportOutlined />} onClick={() => download("inspection-items.json", { itemTypes, items })}>匯出</Button><Button variant="primary" icon={<PlusOutlined />} onClick={() => setCreating((value) => value + 1)}>新增巡查項目</Button></>} />
    <div className="tree-layout tree-page-layout item-tree-layout">
      <ItemTypeTree active={activeType} onSelect={selectType} onAdd={newType} onEdit={setEditingType} />
      <ItemsPanel activeType={activeType} creating={creating} openId={params.get("item")} />
    </div>
    {editingType && <TypeDrawer type={editingType} activeItems={items.filter((item) => item.itemTypeId === editingType.id && item.status === "生效").length} onClose={() => setEditingType(null)} onSaved={(record) => {
      saveItemTypes(itemTypes.some((type) => type.id === record.id) ? itemTypes.map((type) => type.id === record.id ? record : type) : [...itemTypes, record]);
      if (!editingType.id) selectType(record.id);
      setEditingType(null); showToast(editingType.id ? "項目類型已更新" : "項目類型已建立");
    }} />}
  </div>;
}

/** 巡查項目類型 as a tree in their order: 全部項目 first, each type with its item count and an edit button; selecting one filters the items. */
function ItemTypeTree({ active, onSelect, onAdd, onEdit }: { active: string; onSelect: (id: string) => void; onAdd: () => void; onEdit: (type: ItemTypeRecord) => void }) {
  const { items, itemTypes } = useDemo(); const [search, setSearch] = useState("");
  const types = [...itemTypes].sort((a, b) => a.order - b.order).filter((type) => contains(type.name, search));
  const count = (id: string) => items.filter((item) => item.itemTypeId === id).length;
  return <aside className="tree-panel item-type-tree" aria-label="項目類型">
    <div className="tree-title"><strong>項目類型</strong><button type="button" onClick={onAdd}><PlusOutlined /> 新增</button></div>
    <div className="tree-search"><SearchOutlined /><input aria-label="搜尋項目類型" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="搜尋項目類型" /></div>
    <nav>
      <div className={`item-tree-node ${active ? "" : "active"}`}><button type="button" className="item-tree-main" aria-pressed={!active} onClick={() => onSelect("")}><span className="tree-dot" /><span className="item-tree-name">全部項目</span><span>{items.length}</span></button></div>
      {types.map((type) => <div key={type.id} className={`item-tree-node ${active === type.id ? "active" : ""} ${type.status === "失效" ? "inactive" : ""}`}>
        <button type="button" className="item-tree-main" aria-pressed={active === type.id} title={`順序 ${type.order}`} onClick={() => onSelect(type.id)}><span className="tree-dot" /><span className="item-tree-name">{type.name}{type.status === "失效" && <em>失效</em>}</span><span>{count(type.id)}</span></button>
        <button type="button" className="item-tree-edit" aria-label={`編輯項目類型 ${type.name}`} title="編輯類型" onClick={() => onEdit(type)}><EditOutlined /></button>
      </div>)}
      {!types.length && <p className="item-tree-empty">沒有符合的項目類型</p>}
    </nav>
    <p className="item-tree-hint">按順序排列，點選類型篩選右側項目；在類型下新增項目會預設帶入該類型。</p>
  </aside>;
}

function TypeDrawer({ type, activeItems, onClose, onSaved }: { type: ItemTypeRecord; activeItems: number; onClose: () => void; onSaved: (type: ItemTypeRecord) => void }) {
  const { itemTypes } = useDemo();
  const [name, setName] = useState(type.name); const [order, setOrder] = useState(String(type.order)); const [status, setStatus] = useState<RecordStatus>(type.status); const [errors, setErrors] = useState<string[]>([]);
  const toggle = (active: boolean) => { if (!active && activeItems) { setErrors([`此類型仍有 ${activeItems} 個生效中的巡查項目，請先將它們設為失效。`]); return; } setStatus(active ? "生效" : "失效"); setErrors([]); };
  const save = () => {
    const draft = { name, order: Number(order), status };
    const found = validateItemType(draft, itemTypes, activeItems, type.id || undefined);
    if (found.length) { setErrors(found); return; }
    onSaved({ ...type, id: type.id || nextTypeId(itemTypes.map((item) => item.id)), name: name.trim(), order: Number(order), status, updatedBy: signedIn, updatedAt: nowText() });
  };
  return <FormDrawer open title={type.id ? "編輯項目類型" : "新增項目類型"} subtitle={type.id ? type.name : undefined} onClose={onClose} onSubmit={save} className="evt-drawer item-type-drawer">
    <div className="evt-drawer-body">
      {errors.length > 0 && <div className="evt-error" role="alert"><strong>請修正以下 {errors.length} 項</strong><ol>{errors.map((message, index) => <li key={index}>{message}</li>)}</ol></div>}
      <div className="evt-form">
        <section className="group-editor-section"><header><h3>類型資料</h3></header><div className="group-editor-grid">
          <Field label="類型名稱" required hint="1–30 字，不可重複，例如 一般設施、供水設施"><input value={name} maxLength={30} onChange={(event) => { setName(event.target.value); setErrors([]); }} placeholder="請輸入類型名稱" /></Field>
          <Field label="順序" required hint="數字越小越前；巡查項目及巡查計劃模板挑選按此排列"><input type="number" min={1} step={1} value={order} onChange={(event) => { setOrder(event.target.value); setErrors([]); }} /></Field>
        </div></section>
        <StatusSection title="類型狀態" label="類型生效" value={status} onChange={toggle} count={{ label: "生效中的巡查項目", value: `${activeItems} 個` }} />
      </div>
    </div>
  </FormDrawer>;
}

// ---- 巡查項目 ----
const emptyFilters = { code: "", name: "", type: "", kind: "", status: "" };
function ItemsPanel({ activeType, creating, openId }: { activeType: string; creating: number; openId: string | null }) {
  const { items, itemTypes, inspectionTypes, inspectionTemplates, saveItems } = useDemo(); const { showToast } = useToast();
  const [filters, setFilters] = useState(emptyFilters); const [page, setPage] = useState(1); const [pageSize, setPageSize] = useState(15);
  const [editing, setEditing] = useState<ManagedItem | null>(() => (openId ? items.find((item) => item.id === openId) : undefined) ?? null);
  const first = useRef(creating);
  const typeNames = inspectionTypes.map((type) => type.name);
  useEffect(() => { setPage(1); }, [activeType]);
  useEffect(() => {
    if (creating === first.current) return;
    // a new item starts in the selected type (when it is 生效), else the first 生效 type
    const selected = itemTypes.find((type) => type.id === activeType && type.status === "生效");
    const itemTypeId = selected?.id ?? [...itemTypes].sort((a, b) => a.order - b.order).find((type) => type.status === "生效")?.id ?? "";
    setEditing({ id: "", code: "", name: "", inspectionType: "", itemTypeId, inputKind: "單選", options: ["", ""], abnormal: [], order: 1, summaries: [], notifications: [], auxiliary: [], status: "生效", updatedBy: "", updatedAt: "" });
  }, [creating]); // eslint-disable-line react-hooks/exhaustive-deps
  const all = useMemo(() => sortItems(items, typeNames, itemTypes).map((item) => {
    const usage = itemUsage(item.id, inspectionTemplates, []); // the App inspection forms are the 巡查計劃模板 themselves
    return { ...item, typeName: itemTypeName(item.itemTypeId), usage, refs: usage.templates + usage.appTemplates };
  }), [items, itemTypes, inspectionTypes, inspectionTemplates]); // eslint-disable-line react-hooks/exhaustive-deps
  const rows = all.filter((item) => contains(item.code, filters.code) && contains(item.name, filters.name) && (!filters.type || item.inspectionType === filters.type) && (!activeType || item.itemTypeId === activeType) && (!filters.kind || item.inputKind === filters.kind) && (!filters.status || item.status === filters.status));
  type Row = (typeof rows)[number];
  const optionText = (item: Row) => hasOptions(item.inputKind) ? item.options.map((option) => item.abnormal.includes(option) ? `${option}（異常）` : option).join("、") : item.inputKind === "輸入框" ? `上限 ${item.maxLength ?? "—"} 字` : "—";
  const columns: Column<Row>[] = ([
    { key: "code", title: "項目編號", width: 110 }, { key: "name", title: "項目名稱", width: 170 }, { key: "inspectionType", title: "巡查類型", width: 130, sortValue: (item) => typeNames.indexOf(item.inspectionType) },
    { key: "typeName", title: "項目類型", width: 110, sortValue: (item) => itemTypes.find((type) => type.id === item.itemTypeId)?.order ?? 0 },
    { key: "inputKind", title: "輸入方式", width: 90, render: (item) => <StatusTag tone="info">{item.inputKind}</StatusTag> },
    { key: "options", title: "選項（異常值）", width: 250, render: (item) => <span className="item-options">{hasOptions(item.inputKind) ? item.options.map((option) => <i key={option} className={item.abnormal.includes(option) ? "bad" : ""}>{option}</i>) : optionText(item)}</span>, sortValue: optionText },
    { key: "order", title: "順序", width: 70 },
    { key: "summaries", title: "工作摘要", width: 110, render: (item) => item.summaries.length ? `${item.summaries.length} 個${item.summaries.some((entry) => entry.sla) ? `（${item.summaries.filter((entry) => entry.sla).length} 個自訂時限）` : ""}` : "—", sortValue: (item) => item.summaries.length },
    { key: "notifications", title: "工作通知", width: 90, render: (item) => item.notifications.length ? `${item.notifications.filter((rule) => rule.active).length} / ${item.notifications.length} 啟用` : "—", sortValue: (item) => item.notifications.length },
    { key: "auxiliary", title: "輔助資料", width: 90, render: (item) => item.auxiliary?.length ? `${item.auxiliary.length} 項` : "—", sortValue: (item) => item.auxiliary?.length ?? 0 },
    { key: "refs", title: "引用巡查計劃模板", width: 150, render: (item) => item.refs ? `${item.usage.templates} 個${item.usage.activeTemplates !== item.usage.templates ? `（${item.usage.activeTemplates} 個生效）` : ""}` : "—" },
    { key: "status", title: "狀態", width: 80, render: (item) => <StatusTag tone={item.status === "生效" ? "success" : "neutral"}>{item.status}</StatusTag> },
    { key: "updatedBy", title: "更新人", width: 90 }, { key: "updatedAt", title: "更新時間", width: 150 },
  ] satisfies Column<Row>[]).map((column) => ({ ...column, sortable: true }));
  const filter = (key: keyof typeof emptyFilters, value: string) => { setFilters((current) => ({ ...current, [key]: value })); setPage(1); };
  return <section className="panel list-panel item-list-panel">
    <div className="filter-bar item-filter-bar">
      <label className="filter-field"><span>項目編號</span><input aria-label="項目編號" value={filters.code} onChange={(event) => filter("code", event.target.value)} placeholder="請輸入項目編號" /></label>
      <label className="filter-field"><span>項目名稱</span><input aria-label="項目名稱" value={filters.name} onChange={(event) => filter("name", event.target.value)} placeholder="請輸入項目名稱" /></label>
      <label className="filter-field"><span>巡查類型</span><Select ariaLabel="巡查類型" value={filters.type} onChange={(value) => filter("type", value)}><option value="">全部巡查類型</option>{typeNames.map((name) => <option key={name}>{name}</option>)}</Select></label>
      <label className="filter-field"><span>輸入方式</span><Select ariaLabel="輸入方式" value={filters.kind} onChange={(value) => filter("kind", value)}><option value="">全部輸入方式</option>{inputKinds.map((kind) => <option key={kind}>{kind}</option>)}</Select></label>
      <label className="filter-field"><span>狀態</span><Select ariaLabel="狀態" value={filters.status} onChange={(value) => filter("status", value)}><option value="">全部狀態</option><option>生效</option><option>失效</option></Select></label>
      <div className="user-filter-actions"><Button variant="text" icon={<ReloadOutlined />} onClick={() => { setFilters(emptyFilters); setPage(1); }}>重設</Button></div>
    </div>
    <DenseTable rows={rows} columns={columns} stickyActions actionTitle="操作" page={Math.min(page, Math.max(1, Math.ceil(rows.length / pageSize)))} pageSize={pageSize} onSort={() => setPage(1)} emptyText="沒有符合條件的巡查項目" renderActions={(item) => <button className="table-action-button" aria-label={`編輯 ${item.name}`} onClick={() => setEditing(items.find((entry) => entry.id === item.id) ?? null)}><EditOutlined />編輯</button>} />
    <Pagination total={rows.length} page={page} pageSize={pageSize} onPageChange={setPage} onPageSizeChange={(size) => { setPageSize(size); setPage(1); }} />
    {editing && <ItemDrawer key={editing.id || "new"} item={editing} onClose={() => setEditing(null)} onSaved={(record) => {
      saveItems(items.some((item) => item.id === record.id) ? items.map((item) => item.id === record.id ? record : item) : [...items, record]);
      setEditing(null); showToast(editing.id ? "巡查項目已更新；App 巡查表及工作摘要即時套用（已提交的巡查保留原有快照）" : "巡查項目已建立");
    }} />}
  </section>;
}

const itemTabs: { key: ItemTab; label: string }[] = [{ key: "basic", label: "基本資料" }, { key: "input", label: "輸入方式" }, { key: "auxiliary", label: "輔助資料" }, { key: "summaries", label: "工作摘要" }, { key: "notifications", label: "工作通知" }];
type Patch = Partial<ManagedItem>;

function ItemDrawer({ item, onClose, onSaved }: { item: ManagedItem; onClose: () => void; onSaved: (item: ManagedItem) => void }) {
  const { items, itemTypes, inspectionTypes, inspectionTemplates } = useDemo();
  const [draft, setDraft] = useState<ManagedItem>(() => structuredClone(item)); const [tab, setTab] = useState<ItemTab>("basic"); const [issues, setIssues] = useState<ItemIssue[]>([]);
  const isNew = !item.id;
  const usage = itemUsage(item.id, inspectionTemplates, []); const locked = !isNew && isLocked(usage);
  const errorRef = useRef<HTMLDivElement>(null);
  useEffect(() => { if (issues.length) errorRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" }); }, [issues]);
  const change = (patch: Patch) => { setDraft((current) => ({ ...current, ...patch })); setIssues([]); };
  const save = () => {
    const result = validateItem({ ...draft, id: draft.id || localId("ITM") }, { all: items, inspectionTypes: inspectionTypes.filter((type) => type.status === "生效" || type.name === item.inspectionType).map((type) => type.name), itemTypeIds: itemTypes.filter((type) => type.status === "生效" || type.id === item.itemTypeId).map((type) => type.id), workTypes: workTypeOptions, groups: groupNames, usage, original: isNew ? undefined : item });
    if (!result.record) { setIssues(result.issues); if (!result.issues.some((issue) => issue.tab === tab)) setTab(result.issues[0].tab); return; }
    onSaved({ ...result.record, updatedBy: signedIn, updatedAt: nowText() });
  };
  const counts: Partial<Record<ItemTab, number>> = { auxiliary: (draft.auxiliary ?? []).length, summaries: draft.summaries.length, notifications: draft.notifications.length };
  return <FormDrawer open title={isNew ? "新增巡查項目" : "編輯巡查項目"} subtitle={isNew ? undefined : `${item.code} ${item.name}`} onClose={onClose} onSubmit={save} className="tpl-editor-drawer item-editor-drawer">
    <div className="tpl-editor">
      <nav className="bip-editor-tabs" role="tablist" aria-label="巡查項目設定">{itemTabs.map((entry) => <button type="button" role="tab" key={entry.key} aria-selected={tab === entry.key} className={`${tab === entry.key ? "active" : ""} ${issues.some((issue) => issue.tab === entry.key) ? "has-error" : ""}`} onClick={() => setTab(entry.key)}>{entry.label}{counts[entry.key] !== undefined && <span>{counts[entry.key]}</span>}</button>)}</nav>
      <div className="tpl-tab-content" role="tabpanel">
        {issues.length > 0 && <div ref={errorRef} className="evt-error" role="alert"><strong>請修正以下 {issues.length} 項</strong><ol>{issues.map((issue, index) => <li key={index}><button type="button" onClick={() => setTab(issue.tab)}>［{itemTabs.find((entry) => entry.key === issue.tab)?.label}］{issue.message}</button></li>)}</ol></div>}
        {tab === "basic" && <BasicTab draft={draft} item={item} isNew={isNew} locked={locked} usage={usage} onChange={change} onBlocked={(message) => setIssues([{ tab: "basic", message }])} />}
        {tab === "input" && <InputTab draft={draft} locked={locked} onChange={change} />}
        {tab === "auxiliary" && <AuxTab draft={draft} onChange={change} />}
        {tab === "summaries" && <SummariesTab draft={draft} onChange={change} />}
        {tab === "notifications" && <NotificationsTab draft={draft} onChange={change} />}
      </div>
    </div>
  </FormDrawer>;
}

function BasicTab({ draft, item, isNew, locked, usage, onChange, onBlocked }: { draft: ManagedItem; item: ManagedItem; isNew: boolean; locked: boolean; usage: ReturnType<typeof itemUsage>; onChange: (patch: Patch) => void; onBlocked: (message: string) => void }) {
  const { items, itemTypes, inspectionTypes } = useDemo();
  const typeOptions = inspectionTypes.filter((type) => type.status === "生效" || type.name === item.inspectionType);
  const itemTypeOptions = [...itemTypes].sort((a, b) => a.order - b.order).filter((type) => type.status === "生效" || type.id === item.itemTypeId);
  const nextOrder = (inspectionType: string) => Math.max(0, ...items.filter((entry) => entry.inspectionType === inspectionType && entry.id !== draft.id).map((entry) => entry.order)) + 1;
  const toggle = (active: boolean) => { const blocked = !active ? deactivationBlock(usage) : null; if (blocked && item.status === "生效") { onBlocked(blocked); return; } onChange({ status: active ? "生效" : "失效" }); };
  return <>
    <section className="group-editor-section"><header><h3>項目資料</h3></header><div className="group-editor-grid">
      <Field label="項目編號" hint={isNew ? "可留空，系統自動生成；唯一，儲存後不可修改" : "唯一，不可修改"}><input value={draft.code} maxLength={32} disabled={!isNew} onChange={(event) => onChange({ code: event.target.value })} placeholder="例如 ITEM-034" /></Field>
      <Field label="項目名稱" required hint="1–50 字，同一巡查類型內不可重複，例如 椅子、水管"><input value={draft.name} maxLength={50} onChange={(event) => onChange({ name: event.target.value })} placeholder="請輸入項目名稱" /></Field>
      <Field label="巡查類型" required hint={locked ? "已被巡查計劃模板使用，不可修改" : "項目只會出現在同類型的巡查計劃模板"}>{locked ? <input value={draft.inspectionType} disabled /> : <Select ariaLabel="巡查類型" value={draft.inspectionType} onChange={(inspectionType) => onChange({ inspectionType, ...(isNew ? { order: nextOrder(inspectionType) } : {}) })}><option value="">請選擇巡查類型</option>{typeOptions.map((type) => <option key={type.id}>{type.name}</option>)}</Select>}</Field>
      <Field label="項目類型" required hint="巡查表按項目類型分組顯示"><Select ariaLabel="項目類型" value={draft.itemTypeId} onChange={(itemTypeId) => onChange({ itemTypeId })}><option value="">請選擇項目類型</option>{itemTypeOptions.map((type) => <option key={type.id} value={type.id}>{type.name}{type.status === "失效" ? "（失效）" : ""}</option>)}</Select></Field>
      <Field label="順序" required hint="同一巡查類型內的排列次序，新增巡查計劃模板項目時按此排列"><input type="number" min={1} step={1} value={Number.isFinite(draft.order) ? draft.order : ""} onChange={(event) => onChange({ order: event.target.value === "" ? NaN : Number(event.target.value) })} /></Field>
    </div></section>
    <StatusSection title="項目狀態" label="項目生效" value={draft.status} onChange={toggle} count={{ label: `引用中的巡查計劃模板（${usage.activeTemplates} 個生效）`, value: `${usage.templates} 個` }} />
  </>;
}

function InputTab({ draft, locked, onChange }: { draft: ManagedItem; locked: boolean; onChange: (patch: Patch) => void }) {
  const setKind = (inputKind: ItemInputKind) => {
    if (inputKind === draft.inputKind) return;
    if (inputKind === "是非") onChange({ inputKind, options: [...BOOL_OPTIONS], abnormal: [], maxLength: undefined });
    else if (inputKind === "單選" || inputKind === "多選") onChange({ inputKind, options: hasOptions(draft.inputKind) && draft.inputKind !== "是非" ? draft.options : ["", ""], abnormal: draft.inputKind === "是非" ? [] : draft.abnormal, maxLength: undefined });
    else onChange({ inputKind, options: [], abnormal: [], maxLength: inputKind === "輸入框" ? 500 : undefined });
  };
  const options = draft.inputKind === "是非" ? BOOL_OPTIONS : draft.options;
  const setOption = (index: number, value: string) => { const before = draft.options[index]; onChange({ options: draft.options.map((option, i) => i === index ? value : option), abnormal: draft.abnormal.map((entry) => entry === before ? value : entry) }); };
  const toggleAbnormal = (option: string) => onChange({ abnormal: draft.abnormal.includes(option) ? draft.abnormal.filter((entry) => entry !== option) : [...draft.abnormal, option] });
  const move = (index: number, delta: number) => { const next = [...draft.options]; const [moved] = next.splice(index, 1); next.splice(index + delta, 0, moved); onChange({ options: next }); };
  return <>
    <section className="group-editor-section"><header><h3>輸入方式</h3></header><div className="item-kind-grid" role="radiogroup" aria-label="輸入方式">
      {inputKinds.map((kind) => <button type="button" role="radio" key={kind} aria-checked={draft.inputKind === kind} disabled={locked && draft.inputKind !== kind} className={draft.inputKind === kind ? "on" : ""} onClick={() => setKind(kind)}><strong>{kind}</strong><span>{kindHints[kind]}</span></button>)}
      {locked && <p className="tpl-hint">此項目已被巡查計劃模板使用，輸入方式不可修改；選項及異常值仍可調整，已提交的巡查保留提交時的設定。</p>}
    </div></section>
    {hasOptions(draft.inputKind) && <section className="group-editor-section"><header><h3>選項及異常值</h3></header><div className="item-options-editor">
      <p className="tpl-hint">{draft.inputKind === "是非" ? "是非題固定為「是／否」，請標示哪個答案代表異常。" : `${draft.inputKind}需 2–${OPTIONS_MAX} 個選項；標示為異常的選項被選取時，巡查員可即時為該項目建立工作。`}</p>
      <ul>{options.map((option, index) => <li key={draft.inputKind === "是非" ? option : index}>
        <span className="item-option-no">{index + 1}</span>
        {draft.inputKind === "是非" ? <input value={option} disabled aria-label={`選項 ${index + 1}`} /> : <input value={option} maxLength={30} aria-label={`選項 ${index + 1}`} onChange={(event) => setOption(index, event.target.value)} placeholder="選項內容" />}
        <label className="item-abnormal"><input type="checkbox" checked={draft.abnormal.includes(option) && !!option} disabled={!option.trim()} onChange={() => toggleAbnormal(option)} />異常</label>
        {draft.inputKind !== "是非" && <span className="obj-def-actions"><button type="button" aria-label="上移" disabled={index === 0} onClick={() => move(index, -1)}><ArrowUpOutlined /></button><button type="button" aria-label="下移" disabled={index === options.length - 1} onClick={() => move(index, 1)}><ArrowDownOutlined /></button><button type="button" aria-label="刪除選項" disabled={options.length <= 2} onClick={() => onChange({ options: draft.options.filter((_, i) => i !== index), abnormal: draft.abnormal.filter((entry) => entry !== option) })}><DeleteOutlined /></button></span>}
      </li>)}</ul>
      {draft.inputKind !== "是非" && <Button icon={<PlusOutlined />} disabled={draft.options.length >= OPTIONS_MAX} onClick={() => onChange({ options: [...draft.options, ""] })}>新增選項</Button>}
    </div></section>}
    {draft.inputKind === "輸入框" && <section className="group-editor-section"><header><h3>輸入框設定</h3></header><div className="group-editor-grid">
      <Field label="字數上限" required hint={`1–${TEXT_LIMIT_MAX} 字`}><input type="number" min={1} max={TEXT_LIMIT_MAX} step={1} value={draft.maxLength ?? ""} onChange={(event) => onChange({ maxLength: event.target.value === "" ? undefined : Number(event.target.value) })} /></Field>
    </div></section>}
    {draft.inputKind === "簽名" && <section className="group-editor-section"><header><h3>簽名框</h3></header><div className="group-editor-grid"><p className="tpl-hint">巡查員或管理處人員以觸控方式在手機螢幕上簽名，簽名圖像隨巡查記錄保存；無需設定選項。</p></div></section>}
  </>;
}

function AuxTab({ draft, onChange }: { draft: ManagedItem; onChange: (patch: Patch) => void }) {
  const list = draft.auxiliary ?? [];
  const update = (index: number, patch: Partial<AuxDef>) => onChange({ auxiliary: list.map((def, i) => i === index ? { ...def, ...patch } : def) });
  const nextOrder = Math.max(0, ...list.map((def) => Number.isFinite(def.order) ? def.order : 0)) + 1;
  return <section className="group-editor-section"><header><h3>輔助資料</h3></header><div className="item-cards">
    <p className="tpl-hint">巡查員在 App 填寫此項目時按順序顯示以下輔助資料；後台巡查詳情可按項目的「輔助資料」按鈕查看。沒有內容的輔助資料不會顯示。內容來源：上次巡查結果為同一對象、同一項目最近已完成巡查的結果（可設定顯示次數）；對象屬性為巡查對象的指定資料；對象附件為巡查對象上載的附件，可按名稱關鍵字篩選。</p>
    {list.map((def, index) => <div className="item-card" key={def.id}>
      <header><strong>輔助資料 {index + 1}</strong><button type="button" className="tpl-remove" aria-label={`刪除輔助資料 ${index + 1}`} onClick={() => onChange({ auxiliary: list.filter((_, i) => i !== index) })}><DeleteOutlined /></button></header>
      <div className="group-editor-grid item-aux-grid">
        <Field label="名稱" required hint="1–20 字，不可重複"><input value={def.name} maxLength={20} onChange={(event) => update(index, { name: event.target.value })} placeholder="例如 上次巡查結果、水管走向圖" /></Field>
        <Field label="內容來源" required><Select ariaLabel={`輔助資料 ${index + 1} 內容來源`} value={def.source} onChange={(source) => update(index, { source: source as AuxSource, count: source === "上次巡查結果" ? def.count : undefined, attribute: source === "對象屬性" ? def.attribute ?? objectAttributes[0] : undefined, keyword: source === "對象附件" ? def.keyword ?? "" : undefined })}>{auxSources.map((source) => <option key={source}>{source}</option>)}</Select></Field>
        {def.source === "上次巡查結果" && <Field label="顯示次數" required hint={`1–${AUX_COUNT_MAX} 次，例如 5 即顯示上五次巡查結果`}><input type="number" min={1} max={AUX_COUNT_MAX} step={1} value={Number.isFinite(def.count ?? 1) ? def.count ?? 1 : ""} onChange={(event) => update(index, { count: event.target.value === "" ? NaN : Number(event.target.value) })} /></Field>}
        {def.source === "對象屬性" && <Field label="對象屬性" required><Select ariaLabel={`輔助資料 ${index + 1} 對象屬性`} value={def.attribute ?? ""} onChange={(attribute) => update(index, { attribute })}><option value="">請選擇對象屬性</option>{objectAttributes.map((attribute) => <option key={attribute}>{attribute}</option>)}</Select></Field>}
        {def.source === "對象附件" && <Field label="附件名稱關鍵字" hint="留空即顯示對象的全部附件"><input value={def.keyword ?? ""} maxLength={30} onChange={(event) => update(index, { keyword: event.target.value })} placeholder="例如 水管" /></Field>}
        <Field label="順序" required hint="數字越小越前"><input type="number" min={1} step={1} value={Number.isFinite(def.order) ? def.order : ""} onChange={(event) => update(index, { order: event.target.value === "" ? NaN : Number(event.target.value) })} /></Field>
      </div>
    </div>)}
    {!list.length && <div className="evt-empty">尚未設定輔助資料</div>}
    <div><Button icon={<PlusOutlined />} onClick={() => onChange({ auxiliary: [...list, { id: localId("AX"), name: "", source: "上次巡查結果", order: nextOrder }] })}>新增輔助資料</Button></div>
  </div></section>;
}

const emptySla: SlaHours = { assign: 4, firstReply: 4, resolve: 24, complete: 48 };
const slaFields: [keyof SlaHours, string][] = [["assign", "分派時限"], ["firstReply", "初覆時限"], ["resolve", "解決時限"], ["complete", "完成時限"]];
function SummariesTab({ draft, onChange }: { draft: ManagedItem; onChange: (patch: Patch) => void }) {
  const update = (index: number, patch: Partial<ItemSummary>) => onChange({ summaries: draft.summaries.map((entry, i) => i === index ? { ...entry, ...patch } : entry) });
  return <section className="group-editor-section"><header><h3>工作摘要</h3></header><div className="item-cards">
    <p className="tpl-hint">巡查員為此項目建立工作時，可直接選擇以下工作摘要並自動帶入工作類型。可為摘要設定專屬服務承諾：以該摘要（文字相同）建立的工作按此時限計算 SLA，未設定則按一般服務承諾規則。時限以小時計，適用於「一般」優先級；「緊急」×0.5、「特急」×0.25。</p>
    {draft.summaries.map((entry, index) => <div className="item-card" key={entry.id}>
      <header><strong>工作摘要 {index + 1}</strong><button type="button" className="tpl-remove" aria-label={`刪除工作摘要 ${index + 1}`} onClick={() => onChange({ summaries: draft.summaries.filter((_, i) => i !== index) })}><DeleteOutlined /></button></header>
      <div className="group-editor-grid">
        <Field label="工作摘要" required hint="1–100 字，例如 椅子的螺絲鬆脫、水管破裂"><input value={entry.summary} maxLength={100} onChange={(event) => update(index, { summary: event.target.value })} placeholder="請輸入工作摘要" /></Field>
        <Field label="工作類型" required><Select ariaLabel={`工作摘要 ${index + 1} 工作類型`} value={entry.workType} onChange={(workType) => update(index, { workType })}><option value="">請選擇工作類型</option>{workTypeOptions.map((type) => <option key={type}>{type}</option>)}</Select></Field>
      </div>
      <div className="item-sla">
        <div className="switch-row"><label className="switch-control"><input type="checkbox" aria-label={`工作摘要 ${index + 1} 自訂服務承諾`} checked={!!entry.sla} onChange={(event) => update(index, { sla: event.target.checked ? { ...emptySla } : null })} /><span className="switch" /></label><span className="switch-label">{entry.sla ? "自訂服務承諾" : "使用一般服務承諾規則"}</span></div>
        {entry.sla && <div className="item-sla-grid">{slaFields.map(([key, label]) => <Field key={key} label={`${label}（小時）`} required><input type="number" min={0.5} max={HOURS_MAX} step={0.5} value={Number.isFinite(entry.sla![key]) ? entry.sla![key] : ""} onChange={(event) => update(index, { sla: { ...entry.sla!, [key]: event.target.value === "" ? NaN : Number(event.target.value) } })} /></Field>)}</div>}
      </div>
    </div>)}
    {!draft.summaries.length && <div className="evt-empty">尚未設定工作摘要</div>}
    <div><Button icon={<PlusOutlined />} onClick={() => onChange({ summaries: [...draft.summaries, { id: localId("S"), summary: "", workType: "", sla: null }] })}>新增工作摘要</Button></div>
  </div></section>;
}

const newRule = (): NotifyRule => ({ id: localId("NR"), name: "", states: ["新建"], since: "建立", hours: 12, recipients: { execGroup: true, creator: false, groups: [] }, level: "一般", message: "工作［工作編號］「［工作摘要］」已［經過時間］仍處於［狀態］，請跟進。", active: true });
function NotificationsTab({ draft, onChange }: { draft: ManagedItem; onChange: (patch: Patch) => void }) {
  const { works } = useDemo(); const logs = useWorkLogs(); const refs = useInspectionRefs();
  const itemWorks = useMemo(() => draft.id ? works.filter((work) => !work.pendingSync).map(resolveWork).filter((work) => itemOfWork(work, refs)?.id === draft.id) : [], [works, refs, draft.id]);
  const now = demoNow().getTime();
  const triggeredCount = (rule: NotifyRule) => itemWorks.filter((work) => evaluateNotifications(work, { name: draft.name, notifications: [{ ...rule, active: true }] }, logs.filter((log) => log.workId === work.id), now)[0]?.triggered).length;
  const update = (index: number, patch: Partial<NotifyRule>) => onChange({ notifications: draft.notifications.map((rule, i) => i === index ? { ...rule, ...patch } : rule) });
  const toggleIn = <T,>(list: T[], value: T) => list.includes(value) ? list.filter((entry) => entry !== value) : [...list, value];
  return <section className="group-editor-section"><header><h3>工作通知</h3></header><div className="item-cards">
    <p className="tpl-hint">針對由此巡查項目建立的工作，在特定情況發送通知，例如工作新建 12 小時後仍處於「新建」。規則按示範時鐘即時評估，已觸發的通知會出現在通知中心及工作詳情（示範，不會真正發送）。此項目目前有 {itemWorks.length} 宗相關工作。</p>
    {draft.notifications.map((rule, index) => { const textId = `rule-message-${rule.id}`; return <div className={`item-card ${rule.active ? "" : "inactive"}`} key={rule.id}>
      <header><strong>通知 {index + 1}</strong><span className="item-card-meta">目前觸發 {triggeredCount(rule)} 宗</span>
        <div className="switch-row"><label className="switch-control"><input type="checkbox" aria-label={`通知 ${index + 1} 啟用`} checked={rule.active} onChange={(event) => update(index, { active: event.target.checked })} /><span className="switch" /></label><span className="switch-label">{rule.active ? "啟用" : "停用"}</span></div>
        <button type="button" className="tpl-remove" aria-label={`刪除通知 ${index + 1}`} onClick={() => onChange({ notifications: draft.notifications.filter((_, i) => i !== index) })}><DeleteOutlined /></button></header>
      <div className="group-editor-grid">
        <Field label="通知名稱" required hint="1–30 字"><input value={rule.name} maxLength={30} onChange={(event) => update(index, { name: event.target.value })} placeholder="例如 新建 12 小時仍未跟進" /></Field>
        <Field label="通知級別"><Select ariaLabel={`通知 ${index + 1} 級別`} value={rule.level} onChange={(level) => update(index, { level: level as NotifyRule["level"] })}>{noticeLevels.map((level) => <option key={level}>{level}</option>)}</Select></Field>
        <div className="field item-rule-condition"><span><b>*</b>觸發條件</span><div>
          <Select ariaLabel={`通知 ${index + 1} 計時起點`} value={rule.since} onChange={(since) => update(index, { since: since as NotifyRule["since"] })}><option value="建立">工作建立</option><option value="狀態變更">最後狀態變更</option></Select>
          <span>後</span><input type="number" min={1} max={HOURS_MAX} step={1} aria-label={`通知 ${index + 1} 經過小時`} value={Number.isFinite(rule.hours) ? rule.hours : ""} onChange={(event) => update(index, { hours: event.target.value === "" ? NaN : Number(event.target.value) })} /><span>小時，仍處於</span>
          <span className="item-chips">{notifyStates.map((state) => <button type="button" key={state} aria-pressed={rule.states.includes(state)} className={rule.states.includes(state) ? "on" : ""} onClick={() => update(index, { states: toggleIn(rule.states, state) })}>{state}</button>)}</span>
        </div></div>
        <div className="field item-rule-recipients"><span><b>*</b>通知對象</span><div>
          <label><input type="checkbox" checked={rule.recipients.execGroup} onChange={(event) => update(index, { recipients: { ...rule.recipients, execGroup: event.target.checked } })} />工作執行群組</label>
          <label><input type="checkbox" checked={rule.recipients.creator} onChange={(event) => update(index, { recipients: { ...rule.recipients, creator: event.target.checked } })} />工作建立人</label>
          <Select ariaLabel={`通知 ${index + 1} 加入群組`} value="" onChange={(group) => group && update(index, { recipients: { ...rule.recipients, groups: toggleIn(rule.recipients.groups, group) } })}><option value="">加入指定群組…</option>{groupCategories.map((category) => <optgroup key={category} label={category}>{groupCatalog.filter((group) => group.category === category && !rule.recipients.groups.includes(group.name)).map((group) => <option key={group.name}>{group.name}</option>)}</optgroup>)}</Select>
          {rule.recipients.groups.map((group) => <span className="item-tag" key={group}>{group}<button type="button" aria-label={`移除 ${group}`} onClick={() => update(index, { recipients: { ...rule.recipients, groups: rule.recipients.groups.filter((entry) => entry !== group) } })}>×</button></span>)}
        </div></div>
        <div className="field item-rule-message"><span><b>*</b>通知內容</span>
          <textarea id={textId} rows={3} maxLength={MESSAGE_MAX} value={rule.message} onChange={(event) => update(index, { message: event.target.value })} />
          <small>可插入參數：{notifyPlaceholders.map((key) => <button type="button" key={key} className="item-param" onClick={() => update(index, { message: `${rule.message}［${key}］` })}>［{key}］</button>)}</small>
        </div>
      </div>
    </div>; })}
    {!draft.notifications.length && <div className="evt-empty">尚未設定工作通知</div>}
    <div><Button icon={<PlusOutlined />} onClick={() => onChange({ notifications: [...draft.notifications, newRule()] })}>新增工作通知</Button></div>
  </div></section>;
}
