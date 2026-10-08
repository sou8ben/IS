import { useMemo, useState } from "react";
import { EditOutlined, ExportOutlined, PlusOutlined, ReloadOutlined } from "@ant-design/icons";
import { Button, DenseTable, Field, FormDrawer, PageHeader, Pagination, Select, StatusTag, useToast } from "./components";
import { canRename, deactivationBlock, nextTypeId, renameBlockReason, usageOf, validateType, type InspectionTypeRecord, type TypeStatus } from "./inspection-type-rules";
import { responsibilityGroups } from "./permission-rules";
import { useDemo } from "./store";
import type { Column } from "./types";
import { getItems } from "./item-data";

const contains = (value: string, query: string) => !query.trim() || value.toLowerCase().includes(query.trim().toLowerCase());
const itemCountOf = (name: string) => getItems().filter((item) => item.inspectionType === name).length; // managed 巡查項目 (registry in step with the shared state)
const nowText = () => { const d = new Date(); const pad = (n: number) => String(n).padStart(2, "0"); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`; };
const yesNo = (value: boolean) => value ? "是" : "否";

// Work groups: any group may be allowed to view the works of a type, but only an execution group can be its default executor.
const groupName = (id: string) => responsibilityGroups.find((group) => group.id === id)?.name ?? "—";
const executeGroups = responsibilityGroups.filter((group) => group.kind === "執行");
const groupOptions = { viewGroups: responsibilityGroups.map((group) => group.id), executeGroups: executeGroups.map((group) => group.id) };
const viewGroupKinds = ["管理", "執行", "巡查"];

function download(name: string, data: unknown) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }));
  const link = document.createElement("a"); link.href = url; link.download = name; link.click(); URL.revokeObjectURL(url);
}

type TypeRow = InspectionTypeRecord & { viewGroupName: string; executeGroupName: string; objects: number; templates: number; items: number };
const emptyFilters = { name: "", status: "" };

// ---- 列表 ----
export function InspectionTypeListPage() {
  const { showToast } = useToast(); const { inspectionTypes, objects, inspectionTemplates, items, saveInspectionTypes } = useDemo();
  const [filters, setFilters] = useState(emptyFilters); const [page, setPage] = useState(1); const [pageSize, setPageSize] = useState(15);
  const [drawer, setDrawer] = useState<{ kind: "create" } | { kind: "edit"; id: string } | null>(null);
  const filter = (key: keyof typeof emptyFilters, value: string) => { setFilters((current) => ({ ...current, [key]: value })); setPage(1); };
  const all: TypeRow[] = useMemo(() => inspectionTypes.map((type) => {
    const usage = usageOf(type.name, objects, inspectionTemplates, itemCountOf(type.name));
    return { ...type, viewGroupName: type.viewGroup ? groupName(type.viewGroup) : "—", executeGroupName: type.executeGroup ? groupName(type.executeGroup) : "—", objects: usage.objects, templates: usage.templates, items: usage.items };
  }), [inspectionTypes, objects, inspectionTemplates, items]); // eslint-disable-line react-hooks/exhaustive-deps
  const rows = all.filter((type) => contains(type.name, filters.name) && (!filters.status || type.status === filters.status));
  const columns: Column<TypeRow>[] = ([
    { key: "name", title: "類型名稱", width: 190 },
    { key: "stepByStep", title: "巡查 - 按步驟巡查", width: 150, render: (type) => yesNo(type.stepByStep), sortValue: (type) => Number(type.stepByStep) },
    { key: "strictWorkflow", title: "工作 - 嚴格流程", width: 140, render: (type) => yesNo(type.strictWorkflow), sortValue: (type) => Number(type.strictWorkflow) },
    { key: "viewGroupName", title: "工作 - 預設查看群組", width: 170 },
    { key: "executeGroupName", title: "工作 - 預設執行群組", width: 170 },
    { key: "objects", title: "下屬對象", width: 100, render: (type) => `${type.objects} 個` },
    { key: "templates", title: "下屬巡查計劃模板", width: 150, render: (type) => `${type.templates} 個` },
    { key: "items", title: "下屬巡查項目", width: 130, render: (type) => `${type.items} 個` },
    { key: "status", title: "狀態", width: 90, render: (type) => <StatusTag tone={type.status === "生效" ? "success" : "neutral"}>{type.status}</StatusTag> },
    { key: "updatedBy", title: "更新人", width: 100 },
    { key: "updatedAt", title: "更新時間", width: 160 },
  ] satisfies Column<TypeRow>[]).map((column) => ({ ...column, sortable: true }));
  const editing = drawer?.kind === "edit" ? inspectionTypes.find((type) => type.id === drawer.id) : undefined;
  const saved = (type: InspectionTypeRecord) => {
    saveInspectionTypes(editing ? inspectionTypes.map((item) => item.id === type.id ? type : item) : [...inspectionTypes, type]);
    setDrawer(null); showToast(editing ? "巡查類型已更新" : "巡查類型已建立");
  };
  return <div className="page-content type-page">
    <PageHeader title="巡查類型" actions={<><Button icon={<ExportOutlined />} onClick={() => download("inspection-types.json", all.map((type) => ({ name: type.name, status: type.status, stepByStep: type.stepByStep, strictWorkflow: type.strictWorkflow, requireLocation: type.requireLocation, viewGroup: type.viewGroupName, executeGroup: type.executeGroupName, updatedBy: type.updatedBy, updatedAt: type.updatedAt })))}>匯出</Button><Button variant="primary" icon={<PlusOutlined />} onClick={() => setDrawer({ kind: "create" })}>新增巡查類型</Button></>} />
    <section className="panel list-panel type-list-panel">
      <div className="filter-bar type-filter-bar">
        <label className="filter-field"><span>類型名稱</span><input aria-label="類型名稱" value={filters.name} onChange={(event) => filter("name", event.target.value)} placeholder="請輸入類型名稱" /></label>
        <label className="filter-field"><span>狀態</span><Select ariaLabel="狀態" value={filters.status} onChange={(value) => filter("status", value)}><option value="">全部狀態</option><option>生效</option><option>失效</option></Select></label>
        <div className="user-filter-actions"><Button variant="text" icon={<ReloadOutlined />} onClick={() => { setFilters(emptyFilters); setPage(1); }}>重設</Button></div>
      </div>
      <DenseTable rows={rows} columns={columns} stickyActions actionTitle="操作" page={Math.min(page, Math.max(1, Math.ceil(rows.length / pageSize)))} pageSize={pageSize} onSort={() => setPage(1)} emptyText="沒有符合條件的巡查類型" renderActions={(type) => <button className="table-action-button" aria-label={`編輯 ${type.name}`} onClick={() => setDrawer({ kind: "edit", id: type.id })}><EditOutlined />編輯</button>} />
      <Pagination total={rows.length} page={page} pageSize={pageSize} onPageChange={setPage} onPageSizeChange={(size) => { setPageSize(size); setPage(1); }} />
    </section>
    {drawer && (drawer.kind === "create" || editing) && <TypeDrawer type={editing} onClose={() => setDrawer(null)} onSaved={saved} />}
  </div>;
}

// ---- 新增／編輯 ----
/** A yes/no setting: only the narrow switch toggles, the adjacent word is plain text. */
function YesNoField({ label, value, onChange }: { label: string; value: boolean; onChange: (value: boolean) => void }) {
  return <div className="field"><span>{label}</span><div className="switch-row"><label className="switch-control"><input type="checkbox" aria-label={label} checked={value} onChange={(event) => onChange(event.target.checked)} /><span className="switch" /></label><span className="switch-label">{yesNo(value)}</span></div></div>;
}

export function TypeDrawer({ type, onClose, onSaved }: { type?: InspectionTypeRecord; onClose: () => void; onSaved: (type: InspectionTypeRecord) => void }) {
  const { inspectionTypes, objects, inspectionTemplates } = useDemo();
  const [name, setName] = useState(type?.name ?? ""); const [status, setStatus] = useState<TypeStatus>(type?.status ?? "生效");
  const [stepByStep, setStepByStep] = useState(type?.stepByStep ?? false); const [strictWorkflow, setStrictWorkflow] = useState(type?.strictWorkflow ?? false); const [requireLocation, setRequireLocation] = useState(type?.requireLocation ?? false);
  const [viewGroup, setViewGroup] = useState(type?.viewGroup ?? ""); const [executeGroup, setExecuteGroup] = useState(type?.executeGroup ?? "");
  const [errors, setErrors] = useState<string[]>([]);
  const usage = usageOf(type?.name ?? "", objects, inspectionTemplates, type ? itemCountOf(type.name) : 0);
  const locked = !!type && !canRename(usage);
  const change = (apply: () => void) => { apply(); setErrors([]); };
  const blockedDeactivation = (next: TypeStatus) => next === "失效" && (!type || type.status === "生效") ? deactivationBlock(usage) : null;
  const toggleStatus = (checked: boolean) => {
    const next: TypeStatus = checked ? "生效" : "失效"; const blocked = blockedDeactivation(next);
    if (blocked) { setErrors([blocked]); return; }
    change(() => setStatus(next));
  };
  const save = () => {
    const effectiveName = (locked ? type!.name : name).trim();
    const found = [...validateType({ name: effectiveName, viewGroup, executeGroup }, inspectionTypes, groupOptions, type?.id)];
    const blocked = blockedDeactivation(status); if (blocked) found.push(blocked);
    if (found.length) { setErrors(found); return; }
    onSaved({ id: type?.id ?? nextTypeId(inspectionTypes.map((item) => item.id)), name: effectiveName, status, stepByStep, strictWorkflow, requireLocation, viewGroup, executeGroup, updatedBy: "陳家朗", updatedAt: nowText() });
  };
  return <FormDrawer open title={type ? "編輯巡查類型" : "新增巡查類型"} subtitle={type?.name} onClose={onClose} onSubmit={save} className="evt-drawer type-drawer">
    <div className="evt-drawer-body">
      {errors.length > 0 && <div className="evt-error" role="alert"><strong>請修正以下 {errors.length} 項</strong><ol>{errors.map((message, index) => <li key={index}>{message}</li>)}</ol></div>}
      <div className="evt-form">
        <section className="group-editor-section"><header><h3>類型資料</h3></header><div className="group-editor-grid">
          <Field label="類型名稱" required hint={locked ? renameBlockReason(usage) ?? undefined : "1–50 字，不可重複；已被對象、巡查計劃模板或項目使用後不可修改"}><input value={locked ? type!.name : name} maxLength={50} disabled={locked} onChange={(event) => change(() => setName(event.target.value))} placeholder="例如 公園設施巡查" /></Field>
          <div className="field"><span>狀態</span><div className="switch-row"><label className="switch-control"><input type="checkbox" aria-label="類型生效" checked={status === "生效"} onChange={(event) => toggleStatus(event.target.checked)} /><span className="switch" /></label><span className="switch-label">{status}</span></div><small>仍有啟用中的對象或生效中的巡查計劃模板時不可設為失效</small></div>
          <div className="type-flag-row">
            <YesNoField label="按步驟巡查" value={stepByStep} onChange={(value) => change(() => setStepByStep(value))} />
            <YesNoField label="嚴格工作流程" value={strictWorkflow} onChange={(value) => change(() => setStrictWorkflow(value))} />
            <YesNoField label="新建工作時需要定位" value={requireLocation} onChange={(value) => change(() => setRequireLocation(value))} />
          </div>
          <Field label="預設工作查看群組"><Select ariaLabel="預設工作查看群組" value={viewGroup} onChange={(value) => change(() => setViewGroup(value))}><option value="">不指定</option>{viewGroupKinds.map((kind) => <optgroup key={kind} label={`${kind}群組`}>{responsibilityGroups.filter((group) => group.kind === kind).map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}</optgroup>)}</Select></Field>
          <Field label="預設工作執行群組"><Select ariaLabel="預設工作執行群組" value={executeGroup} onChange={(value) => change(() => setExecuteGroup(value))}><option value="">不指定</option>{executeGroups.map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}</Select></Field>
        </div></section>
      </div>
    </div>
  </FormDrawer>;
}
