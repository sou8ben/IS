import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowDownOutlined, ArrowLeftOutlined, ArrowUpOutlined, CheckOutlined, CloseOutlined, EditOutlined, ExportOutlined, EyeOutlined, InfoCircleOutlined, LinkOutlined, LockOutlined, PlusOutlined, ReloadOutlined, SearchOutlined, WarningFilled } from "@ant-design/icons";
import { execGroups } from "./app/data";
import { ActivityTimeline, BatchPickerDrawer, Button, ConfirmDialog, DenseTable, Field, FormDrawer, PageHeader, Pagination, Select, StatusTag, useToast } from "./components";
import { usePermissionRules } from "./permission-store";
import { policyUsers, requestObjects, responsibilityGroups, type PlanRequest } from "./permission-rules";
import {
  activeAppTemplates, groupMembers, inspectionResult, inspectionTemplateName, objectOf, planCandidates, planTracks, positionOfEvent, positionOfWork,
  snapshotFromTemplate, snapshotOf, templateIdOfPlan, trackMeters, useAppPlanState,
} from "./plan-data";
import { appTemplate, templateAppliesTo } from "./item-data";
import { getManagedObjects } from "./object-data";
import { LegendItem, PlanMap, type MapLayerChip, type MapMarkerSpec } from "./plan-map";
import { appendInspections, buildPlannedInspections, isEditable, isEnded, majority, mergePlanInspections, nextIds, validatePlanForm, type PlanChange, type PlanInspectionRow } from "./plan-rules";
import { useDemo } from "./store";
import { useInspections, templateSnapshotOf } from "./inspection-data";
import type { Column, EventRecord, Plan, Work } from "./types";

const inspectionGroups = responsibilityGroups.filter((group) => group.kind === "巡查");
const groupIdOf = (plan: Plan) => plan.groupId ?? inspectionGroups.find((group) => group.name === plan.group)?.id ?? "";
const defaultIdentityId = policyUsers.find((user) => user.id === "USR-006")?.id ?? policyUsers[0].id;
const signedInUser = policyUsers[0].name;
const pad = (n: number) => String(n).padStart(2, "0");
const nowText = () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`; };
const dateKey = (text: string) => text.slice(0, 10).replace(/-/g, "");
const toInput = (text: string) => text.replace(" ", "T");
const fromInput = (text: string) => text.replace("T", " ");
const contains = (value: string, query: string) => !query.trim() || value.toLowerCase().includes(query.trim().toLowerCase());
const unique = (values: string[]) => [...new Set(values)];
const sourceTone: Record<string, "neutral" | "info" | "warning" | "success"> = { "計劃模板": "neutral", "額外加入": "info", "補入": "warning", "現場建立": "success" };
/** Inspections generated when the plan was created are stored with source 計劃模板; they come from the plan's 巡查模板. */
const sourceLabel = (source: string) => source === "計劃模板" ? "按巡查模板" : source;
const eventTypes = ["公共設施異常／座椅", "公共設施異常／照明", "環境衛生／積水", "綠化問題／樹木", "道路通行問題／路面"];
const workTypes = ["公共設施／座椅", "公共設施／照明", "環境衛生／收集設施", "綠化／樹木", "道路設施／路面"];

/**
 * The create-plan permission request, built from the plan: the inspection group and its department, the grid most of the plan's objects are in,
 * and the demonstration responsibility objects (`requestObjects`) of that grid and department. No such object means missing data, so the check denies.
 */
function planRequest(groupId: string, objectIds: string[]): PlanRequest {
  const department = responsibilityGroups.find((group) => group.id === groupId)?.department;
  const grid = majority(objectIds.flatMap((id) => objectOf(id)?.grid ?? []));
  const objects = requestObjects.filter((object) => object.grid === grid && object.department === department).map((object) => object.id);
  return { group: groupId || undefined, department, grid, objects: objects.length ? objects : undefined };
}
/** The template's applicable inspection groups; a template listing none allows every inspection group. */
const allowedGroupsOf = (groupIds: string[] | undefined) => groupIds?.length ? inspectionGroups.filter((group) => groupIds.includes(group.id)) : inspectionGroups;

function FormError({ errors }: { errors: string[] }) {
  return errors.length ? <div className="plan-form-error" role="alert">{errors.join(" ")}</div> : null;
}

function IdentityField({ value, onChange }: { value: string; onChange: (id: string) => void }) {
  return <Field label="提交身份（示範）" hint="提交時以此身份重新校驗功能權限、禁止身份及權責範圍"><Select ariaLabel="提交身份" value={value} onChange={onChange}>{policyUsers.map((user) => <option key={user.id} value={user.id}>{user.name}（{user.roles.join("、")}）</option>)}</Select></Field>;
}

function GroupSelect({ value, onChange, groups = inspectionGroups }: { value: string; onChange: (id: string) => void; groups?: typeof inspectionGroups }) {
  return <Select ariaLabel="巡查群組" value={value} onChange={onChange}><option value="">請選擇巡查群組</option>{groups.map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}</Select>;
}

function ExecutorSelect({ groupId, value, onChange }: { groupId: string; value: string; onChange: (name: string) => void }) {
  const members = groupMembers(inspectionGroups.find((group) => group.id === groupId)?.name ?? "");
  return <Select ariaLabel="預設巡查人員" value={value} onChange={onChange}><option value="">不指定（群組成員均可執行）</option>{members.map((name) => <option key={name}>{name}</option>)}</Select>;
}

function ProgressCell({ done, total }: { done: number; total: number }) {
  return <div className="table-progress"><div><i style={{ width: `${total ? done / total * 100 : 0}%` }} /></div><span>{done}/{total}</span></div>;
}

// ---- 列表 ----
const emptyFilters = { id: "", name: "", template: "", group: "", status: "", from: "", to: "" };

export function PlanListPage() {
  const { plans, inspectionTemplates } = useDemo(); const navigate = useNavigate();
  const [filters, setFilters] = useState(emptyFilters); const [page, setPage] = useState(1); const [pageSize, setPageSize] = useState(15);
  const filter = (key: keyof typeof emptyFilters, value: string) => { setFilters((current) => ({ ...current, [key]: value })); setPage(1); };
  const rows = plans.filter((plan) => contains(plan.id, filters.id) && contains(plan.name, filters.name) && (!filters.template || plan.template === filters.template) && (!filters.group || plan.group === filters.group)
    && (!filters.status || plan.status === filters.status) && (!filters.from || plan.startAt.slice(0, 10) >= filters.from) && (!filters.to || plan.startAt.slice(0, 10) <= filters.to));
  const columns: Column<Plan>[] = ([
    { key: "id", title: "計劃編號", width: 170 },
    { key: "name", title: "計劃名稱", width: 230 },
    { key: "template", title: "巡查模板", width: 170 },
    { key: "group", title: "巡查群組", width: 130 },
    { key: "executor", title: "預設巡查人員", width: 120, render: (plan) => plan.executor ?? "—", sortValue: (plan) => plan.executor ?? "" },
    { key: "startAt", title: "開始時間", width: 150 },
    { key: "endAt", title: "結束時間", width: 150 },
    { key: "status", title: "狀態", width: 90, render: (plan) => <StatusTag>{plan.status}</StatusTag> },
    { key: "total", title: "巡查數", width: 90, render: (plan) => `${plan.total} 個` },
    { key: "progress", title: "完成進度", width: 170, render: (plan) => <ProgressCell done={plan.progress} total={plan.total} />, sortValue: (plan) => plan.total ? plan.progress / plan.total : 0 },
  ] satisfies Column<Plan>[]).map((column) => ({ ...column, sortable: true }));
  return <div className="page-content plan-page">
    <PageHeader title="巡查計劃" actions={<><Button icon={<ExportOutlined />}>匯出</Button><Button variant="primary" icon={<PlusOutlined />} onClick={() => navigate("/plans/new")}>新增計劃</Button></>} />
    <section className="panel list-panel plan-list-panel">
      <div className="filter-bar plan-filter-bar">
        <label className="filter-field"><span>計劃編號</span><input aria-label="計劃編號" value={filters.id} onChange={(event) => filter("id", event.target.value)} placeholder="請輸入計劃編號" /></label>
        <label className="filter-field"><span>計劃名稱</span><input aria-label="計劃名稱" value={filters.name} onChange={(event) => filter("name", event.target.value)} placeholder="請輸入計劃名稱" /></label>
        <label className="filter-field"><span>巡查模板</span><Select ariaLabel="巡查模板" value={filters.template} onChange={(value) => filter("template", value)}><option value="">全部巡查模板</option>{unique([...inspectionTemplates.map((template) => template.name), ...plans.map((plan) => plan.template)]).map((name) => <option key={name}>{name}</option>)}</Select></label>
        <label className="filter-field"><span>巡查群組</span><Select ariaLabel="巡查群組" value={filters.group} onChange={(value) => filter("group", value)}><option value="">全部巡查群組</option>{unique([...inspectionGroups.map((group) => group.name), ...plans.map((plan) => plan.group)]).map((name) => <option key={name}>{name}</option>)}</Select></label>
        <label className="filter-field"><span>狀態</span><Select ariaLabel="狀態" value={filters.status} onChange={(value) => filter("status", value)}><option value="">全部狀態</option><option>未開始</option><option>進行中</option><option>已中止</option><option>已完成</option></Select></label>
        <label className="filter-field"><span>開始日期（由）</span><input aria-label="開始日期由" type="date" value={filters.from} onChange={(event) => filter("from", event.target.value)} /></label>
        <label className="filter-field"><span>開始日期（至）</span><input aria-label="開始日期至" type="date" value={filters.to} onChange={(event) => filter("to", event.target.value)} /></label>
        <div className="user-filter-actions"><Button variant="text" icon={<ReloadOutlined />} onClick={() => { setFilters(emptyFilters); setPage(1); }}>重設</Button></div>
      </div>
      <DenseTable rows={rows} columns={columns} stickyActions actionTitle="操作" page={Math.min(page, Math.max(1, Math.ceil(rows.length / pageSize)))} pageSize={pageSize} onSort={() => setPage(1)} renderActions={(plan) => <button className="table-action-button" aria-label={`查看 ${plan.name}`} onClick={() => navigate(`/plans/${plan.id}`)}><EyeOutlined />查看</button>} />
      <Pagination total={rows.length} page={page} pageSize={pageSize} onPageChange={setPage} onPageSizeChange={(size) => { setPageSize(size); setPage(1); }} />
    </section>
  </div>;
}

// ---- 新增 ----
export function PlanCreatePage() {
  const { plans, addPlan, inspectionTemplates } = useDemo(); const navigate = useNavigate(); const { showToast } = useToast(); const { authorize } = usePermissionRules(); const app = useAppPlanState();
  const templates = activeAppTemplates();
  // A template that lists objects starts with all of them chosen (in its order); one that applies to every object of its type starts empty.
  const defaultObjects = (templateId: string) => { const template = appTemplate(templateId); return template?.objectIds?.length ? planCandidates(template).map((object) => object.id) : []; };
  const [form, setForm] = useState({ name: "黑沙環公園設施巡查", templateId: templates[0]?.id ?? "", startAt: "2026-09-30T09:00", endAt: "2026-09-30T12:00", groupId: "inspect-north", executor: "", note: "" });
  const [objectIds, setObjectIds] = useState<string[]>(() => defaultObjects(templates[0]?.id ?? ""));
  const [gridFilter, setGridFilter] = useState(""); const [search, setSearch] = useState("");
  const [identityId, setIdentityId] = useState(defaultIdentityId); const [errors, setErrors] = useState<string[]>([]); const [selected, setSelected] = useState<string | null>(null);
  const template = templates.find((item) => item.id === form.templateId); const record = inspectionTemplates.find((item) => item.id === form.templateId);
  const allowedGroups = allowedGroupsOf(record?.groups);
  const candidates = template ? planCandidates(template) : [];
  const chosen = objectIds.flatMap((id) => objectOf(id) ?? []);
  const grid = majority(chosen.map((object) => object.grid)) ?? "";
  const group = inspectionGroups.find((item) => item.id === form.groupId);
  const request = planRequest(form.groupId, objectIds);
  const change = (patch: Partial<typeof form>) => { setForm((current) => ({ ...current, ...patch })); setErrors([]); };
  const changeGroup = (groupId: string) => change({ groupId, executor: groupMembers(inspectionGroups.find((item) => item.id === groupId)?.name ?? "").includes(form.executor) ? form.executor : "" });
  const changeTemplate = (templateId: string) => {
    const allowed = allowedGroupsOf(inspectionTemplates.find((item) => item.id === templateId)?.groups).map((item) => item.id);
    const keep = allowed.includes(form.groupId);
    change({ templateId, groupId: keep ? form.groupId : allowed[0] ?? "", executor: keep ? form.executor : "" });
    setObjectIds(defaultObjects(templateId)); setGridFilter(""); setSearch(""); setSelected(null);
  };
  const setObjects = (next: string[]) => { setObjectIds(next); setErrors([]); };
  const visible = candidates.filter((object) => (!gridFilter || object.grid === gridFilter) && (contains(object.name, search) || contains(object.address, search) || contains(object.id, search)));
  const allVisible = visible.length > 0 && visible.every((object) => objectIds.includes(object.id));
  const toggleAll = () => setObjects(allVisible ? objectIds.filter((id) => !visible.some((object) => object.id === id)) : [...objectIds, ...visible.filter((object) => !objectIds.includes(object.id)).map((object) => object.id)]);
  const move = (index: number, delta: number) => { const next = [...objectIds]; const [moved] = next.splice(index, 1); next.splice(index + delta, 0, moved); setObjects(next); };
  const create = () => {
    const found = validatePlanForm({ ...form, objectIds, allowedGroupIds: record?.groups });
    if (found.length || !template || !record || !group) { setErrors(found); return; }
    const identity = policyUsers.find((user) => user.id === identityId) ?? policyUsers[0];
    const decision = authorize("create-plan", { request }, identity);
    if (!decision.allowed) { setErrors([`權限校驗未通過：${decision.reason}`]); showToast(decision.reason, "error"); return; }
    const time = nowText(); const startAt = fromInput(form.startAt);
    const snapshot = snapshotFromTemplate(template, record.updatedAt, objectIds, time);
    const usedIds = [...app.inspections.map((item) => item.id), ...plans.flatMap((plan) => (plan.inspections ?? []).map((item) => item.id))];
    const inspections = buildPlannedInspections(snapshot, usedIds, dateKey(startAt));
    const id = nextIds("PL", plans.map((plan) => plan.id), dateKey(startAt), 1)[0];
    const log: PlanChange = { time, operator: identity.name, action: "建立計劃", detail: `以巡查模板「${template.name}」（${template.items.length} 個巡查項目）及 ${objectIds.length} 個對象建立，產生 ${inspections.length} 個巡查` };
    addPlan({ id, name: form.name.trim(), template: template.name, templateId: template.id, group: group.name, groupId: group.id, status: "未開始", startAt, endAt: fromInput(form.endAt), executor: form.executor || undefined, progress: 0, total: inspections.length, grid, department: group.department, objectIds, note: form.note.trim() || undefined, snapshot, inspections, changes: [log], createdBy: identity.name, createdAt: time });
    showToast(`計劃已建立，產生 ${inspections.length} 個巡查`);
    navigate(`/plans/${id}`);
  };
  const route = chosen.map((object): [number, number] => [object.x, object.y]);
  const markers = chosen.map((object, index): MapMarkerSpec => ({ id: object.id, kind: "object", x: object.x, y: object.y, tone: "object", label: String(index + 1), title: `${index + 1}. ${object.name}`, detail: <span>{object.address}<br />{object.grid}</span> }));
  return <div className="page-content plan-create-page">
    <PageHeader eyebrow="巡查計劃 / 新增計劃" title="新增巡查計劃" actions={<><Button onClick={() => navigate("/plans")}>取消</Button><Button variant="primary" icon={<CheckOutlined />} onClick={create}>建立計劃</Button></>} />
    <div className="plan-create-layout">
      <div className="plan-create-form">
        <FormError errors={errors} />
        <section className="panel form-section"><header><h2>計劃設定</h2></header><div className="form-grid two-col">
          <Field label="計劃名稱" required><input value={form.name} maxLength={50} onChange={(event) => change({ name: event.target.value })} placeholder="請輸入計劃名稱" /></Field>
          <Field label="巡查模板" required hint="計劃的巡查按此模板填寫；建立時保存模板快照，之後模板更改不影響此計劃"><Select ariaLabel="巡查模板" value={form.templateId} onChange={changeTemplate}><option value="">請選擇巡查模板</option>{templates.map((item) => <option key={item.id} value={item.id}>{item.name}（{item.inspectionType}）</option>)}</Select></Field>
          <Field label="開始時間" required><input type="datetime-local" value={form.startAt} onChange={(event) => change({ startAt: event.target.value })} /></Field>
          <Field label="結束時間" required><input type="datetime-local" value={form.endAt} onChange={(event) => change({ endAt: event.target.value })} /></Field>
          <Field label="巡查群組" required hint={record?.groups.length ? "只列出巡查模板的適用巡查群組" : "巡查模板適用全部巡查群組"}><GroupSelect value={form.groupId} onChange={changeGroup} groups={allowedGroups} /></Field>
          <Field label="預設巡查人員"><ExecutorSelect groupId={form.groupId} value={form.executor} onChange={(executor) => change({ executor })} /></Field>
          <Field label="附屬部門" hint="取自巡查群組"><input value={group?.department ?? ""} disabled /></Field>
          <Field label="所屬網格" hint="所選對象最多所在的網格"><input value={grid} disabled /></Field>
          <Field label="備註"><textarea rows={3} value={form.note} onChange={(event) => change({ note: event.target.value })} placeholder="選填" /></Field>
        </div></section>
        <section className="panel form-section plan-object-section"><header><h2>巡查對象</h2><span>{template ? (template.objectIds?.length ? `模板指定 ${template.objectIds.length} 個對象` : `模板適用「${template.inspectionType}」下全部對象`) : ""} · 已選 {objectIds.length} 個</span></header>
          {template ? <>
            <div className="plan-object-toolbar">
              <Select ariaLabel="按網格篩選" value={gridFilter} onChange={setGridFilter}><option value="">全部網格</option>{unique(candidates.map((object) => object.grid)).map((name) => <option key={name}>{name}</option>)}</Select>
              <div className="group-user-search"><SearchOutlined /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="搜尋對象名稱、編號或地址" /></div>
              <label className="plan-object-all"><input type="checkbox" checked={allVisible} disabled={!visible.length} onChange={toggleAll} />全選結果（{visible.length}）</label>
            </div>
            <ul className="plan-object-list">{visible.map((object) => <li key={object.id}><label><input type="checkbox" checked={objectIds.includes(object.id)} onChange={() => setObjects(objectIds.includes(object.id) ? objectIds.filter((id) => id !== object.id) : [...objectIds, object.id])} /><span><strong>{object.name}</strong><small>{object.id} · {object.grid} · {object.address}</small></span></label></li>)}
              {!visible.length && <li className="plan-object-empty">{candidates.length ? "沒有符合篩選的對象" : "此巡查模板沒有可用的生效對象"}</li>}</ul>
          </> : <p className="plan-hint">請先選擇巡查模板。</p>}
        </section>
        <section className="panel form-section"><header><h2>權限校驗資料（示範）</h2></header><div className="form-grid">
          <IdentityField value={identityId} onChange={(value) => { setIdentityId(value); setErrors([]); }} />
          <dl className="plan-request-list"><div><dt>附屬部門</dt><dd>{request.department ?? "—"}</dd></div><div><dt>網格</dt><dd>{request.grid ?? "—"}</dd></div><div><dt>巡查群組</dt><dd>{group?.name ?? "—"}</dd></div><div><dt>權責對象（示範）</dt><dd>{request.objects?.map((id) => requestObjects.find((object) => object.id === id)?.name ?? id).join("、") ?? "—"}</dd></div></dl>
          {objectIds.length > 0 && !request.objects && <div className="plan-warning"><WarningFilled />所選網格及部門沒有示範權責對象，提交時會因資料缺失被拒絕。</div>}
          <p className="plan-hint">按計劃資料推算：部門取自巡查群組、網格取自所選對象，權責對象為該網格及部門的示範對象。正式環境須由服務端以目前登入用戶重新校驗。</p>
        </div></section>
      </div>
      <section className="panel plan-preview-panel">
        <header><div><h2>計劃預覽</h2><p>{template && record ? `${record.code} · ${template.inspectionType} · ${template.items.length} 個巡查項目 · 更新於 ${record.updatedAt}` : "請選擇巡查模板"}</p></div><span className="plan-preview-count">{objectIds.length} 個巡查</span></header>
        {template && <div className="plan-preview-stats"><div><span>巡查對象</span><strong>{objectIds.length}</strong></div><div><span>產生巡查</span><strong>{objectIds.length}</strong></div><div><span>路線長度</span><strong>{trackMeters(route)} 米</strong></div><div><span>定位檢查</span><strong>{template.locationCheck ? `${template.validDistance} 米` : "關閉"}</strong></div></div>}
        <PlanMap className="plan-preview-map" route={route} markers={markers} selected={selected} onSelect={setSelected} fitKey={`${form.templateId}-${objectIds.length}`} legend={<><LegendItem tone="route">巡查路線（按對象次序）</LegendItem><LegendItem tone="object">巡查對象</LegendItem></>} />
        <div className="plan-preview-table"><table className="dense-table fluid"><thead><tr><th style={{ width: 52 }}>序號</th><th>巡查對象</th><th style={{ width: 150 }}>地址</th><th style={{ width: 140 }}>巡查模板</th><th style={{ width: 140 }}>次序</th></tr></thead><tbody>
          {chosen.map((object, index) => <tr key={object.id} className={`clickable ${selected === object.id ? "selected" : ""}`} onClick={() => setSelected(object.id)}><td>{index + 1}</td><td>{object.name}</td><td title={object.address}>{object.address}</td><td>{template?.name}</td>
            <td onClick={(event) => event.stopPropagation()}><span className="obj-def-actions"><button type="button" aria-label="上移" disabled={index === 0} onClick={() => move(index, -1)}><ArrowUpOutlined /></button><button type="button" aria-label="下移" disabled={index === chosen.length - 1} onClick={() => move(index, 1)}><ArrowDownOutlined /></button><button type="button" aria-label={`移除 ${object.name}`} onClick={() => setObjects(objectIds.filter((id) => id !== object.id))}><CloseOutlined /></button></span></td></tr>)}
          {!chosen.length && <tr><td colSpan={5} className="plan-object-empty">請在左側勾選巡查對象；路線按此處次序連線</td></tr>}
        </tbody></table></div>
      </section>
    </div>
  </div>;
}

// ---- 詳情 ----
type DrawerKind = "edit" | "add" | "supplement" | "event" | "work" | "linkEvent" | "linkWork" | null;
type DetailTab = "巡查" | "事件" | "工作" | "人員軌跡" | "作業記錄";

export function PlanDetailPage() {
  const { id = "" } = useParams(); const { plans } = useDemo(); const navigate = useNavigate();
  const plan = plans.find((item) => item.id === id);
  if (!plan) return <div className="page-content center-state"><WarningFilled /><h1>找不到計劃</h1><p>計劃「{id}」不存在或已被移除。</p><Button onClick={() => navigate("/plans")}>返回列表</Button></div>;
  return <PlanDetail key={plan.id} plan={plan} />;
}

function PlanDetail({ plan }: { plan: Plan }) {
  const navigate = useNavigate(); const { showToast } = useToast(); const { authorize } = usePermissionRules();
  const { plans, events, works, inspectionTemplates, updatePlan, addEvent, addWork, updateEvent, updateWork, saveInspectionRecord } = useDemo(); const app = useAppPlanState(); const inspectionStore = useInspections();
  const [tab, setTab] = useState<DetailTab>("巡查"); const [selected, setSelected] = useState<string | null>(null);
  const [layers, setLayers] = useState<Record<string, boolean>>({ route: true, inspections: true, events: true, works: true, tracks: true });
  const [hiddenTracks, setHiddenTracks] = useState<string[]>([]);
  const [drawer, setDrawer] = useState<DrawerKind>(null); const [confirmStop, setConfirmStop] = useState(false);
  const templateId = templateIdOfPlan(plan); const currentTemplate = inspectionTemplates.find((item) => item.id === templateId);
  const [extraTemplate, setExtraTemplate] = useState(templateId || activeAppTemplates()[0]?.id || ""); const [extraIdentity, setExtraIdentity] = useState(defaultIdentityId);
  const snapshot = snapshotOf(plan);
  // The template moved on after the plan was created (its update time is later than the snapshot's).
  const templateChanged = !!snapshot && !!currentTemplate && currentTemplate.updatedAt > (snapshot.templateUpdatedAt ?? snapshot.takenAt);
  // Back-office inspection records and voids overlay the App's progress; voided inspections stay listed but are not counted.
  const resolved = new Map(inspectionStore.all.map((item) => [item.id, item]));
  const voidedIds = new Set(inspectionStore.all.filter((item) => item.voided).map((item) => item.id));
  const rows = mergePlanInspections(plan.id, plan.inspections, app.inspections).map((row) => { const live = resolved.get(row.id); return live ? { ...row, status: live.status, inspector: live.inspector ?? row.inspector, submittedAt: live.submittedAt ?? row.submittedAt } : row; });
  const countedRows = rows.filter((row) => !voidedIds.has(row.id));
  const planEvents = events.filter((event) => event.planId === plan.id && !event.pendingSync);
  const planWorks = works.filter((work) => work.planId === plan.id && !work.pendingSync && !work.voided);
  const done = countedRows.filter((row) => row.status === "已完成").length;
  const tracks = planTracks(plan, snapshot, rows.length ? done / rows.length : 0);
  const editable = isEditable(plan.status); const ended = isEnded(plan.status);
  const usedIds = [...app.inspections.map((item) => item.id), ...plans.flatMap((item) => (item.inspections ?? []).map((entry) => entry.id))];
  const nextSeq = Math.max(0, ...rows.map((row) => row.seq)) + 1;
  const log = (action: string, detail: string, operator = signedInUser): PlanChange[] => [...(plan.changes ?? []), { time: nowText(), operator, action, detail }];
  const resultOf = (row: PlanInspectionRow) => inspectionResult(row, app.inspections);

  const inspectionMarkers: MapMarkerSpec[] = rows.flatMap((row) => { const object = objectOf(row.objectId); if (!object) return []; const result = resultOf(row); return [{ id: row.id, kind: "inspection" as const, x: object.x, y: object.y, tone: result === "異常" ? "issue" as const : row.status === "已完成" ? "done" as const : "todo" as const, label: String(row.seq), title: `${row.seq}. ${object.name}`, detail: <span>{row.id} · {inspectionTemplateName(row.templateId)}<br />{row.status}{row.status === "已完成" ? ` · ${result}` : ""}{row.inspector ? ` · ${row.inspector}` : ""}{row.submittedAt ? ` · ${row.submittedAt.slice(11)}` : ""}<br />來源：{row.source}</span> }]; });
  const eventMarkers: MapMarkerSpec[] = planEvents.flatMap((event) => { const point = positionOfEvent(event); return point ? [{ id: `event:${event.id}`, kind: "event" as const, x: point[0], y: point[1], tone: "event" as const, label: "事", title: event.description, detail: <span>{event.id} · {event.type}<br />{event.status} · {event.address}<br /><Link to={`/events/${event.id}`}>查看事件</Link></span> }] : []; });
  const workMarkers: MapMarkerSpec[] = planWorks.flatMap((work) => { const point = positionOfWork(work); return point ? [{ id: `work:${work.id}`, kind: "work" as const, x: point[0], y: point[1], tone: "work" as const, label: "工", title: work.title, detail: <span>{work.id} · {work.type}<br />{work.status} · {work.group}<br /><Link to={`/works/${work.id}`}>查看工作</Link></span> }] : []; });
  const markers = [...(layers.inspections ? inspectionMarkers : []), ...(layers.events ? eventMarkers : []), ...(layers.works ? workMarkers : [])];
  const visibleTracks = layers.tracks ? tracks.filter((track) => !hiddenTracks.includes(track.name)).map((track) => ({ id: track.name, ...track })) : [];
  const chips: MapLayerChip[] = [
    { key: "route", label: "路線", on: layers.route }, { key: "inspections", label: "巡查", count: inspectionMarkers.length, on: layers.inspections },
    { key: "events", label: "事件", count: eventMarkers.length, on: layers.events }, { key: "works", label: "工作", count: workMarkers.length, on: layers.works },
    { key: "tracks", label: "人員軌跡", count: tracks.length, on: layers.tracks },
  ];
  const select = (markerId: string | null) => {
    setSelected(markerId);
    if (markerId?.startsWith("event:")) setTab("事件"); else if (markerId?.startsWith("work:")) setTab("工作"); else if (markerId) setTab("巡查");
  };
  const focus = (markerId: string, layer: string) => { setLayers((current) => ({ ...current, [layer]: true })); setSelected(markerId); };

  const stop = () => { updatePlan(plan.id, { status: "已中止", changes: log("強制中止", `由 ${plan.executor ?? "前線人員"} 持有的作業鎖已釋放`) }); setConfirmStop(false); showToast("計劃已強制中止"); };
  const addExtra = (objectIds: string[]) => {
    const identity = policyUsers.find((user) => user.id === extraIdentity) ?? policyUsers[0];
    const decision = authorize("create-plan", { request: planRequest(groupIdOf(plan), unique(rows.map((row) => row.objectId))) }, identity);
    if (!decision.allowed) { showToast(`權限校驗未通過：${decision.reason}`, "error"); return; }
    const entries = objectIds.filter((objectId) => !rows.some((row) => row.objectId === objectId && row.templateId === extraTemplate)).map((objectId) => ({ objectId, templateId: extraTemplate }));
    if (!entries.length) { showToast("所選對象已有相同巡查模板的巡查", "error"); return; }
    const added = appendInspections(entries, usedIds, dateKey(plan.startAt), nextSeq, "額外加入", { addedBy: identity.name, addedAt: nowText() });
    updatePlan(plan.id, { inspections: [...(plan.inspections ?? []), ...added], total: rows.length + added.length, changes: log("增加巡查", `額外加入 ${added.length} 個巡查（${inspectionTemplateName(extraTemplate)}）`, identity.name) });
    setDrawer(null); showToast(`已增加 ${added.length} 個巡查`);
  };
  const linkRecords = (kind: "event" | "work", ids: string[]) => {
    ids.forEach((recordId) => kind === "event" ? updateEvent(recordId, { planId: plan.id }) : updateWork(recordId, { planId: plan.id }));
    updatePlan(plan.id, { changes: log(kind === "event" ? "關聯事件" : "關聯工作", ids.join("、")) });
    setDrawer(null); showToast(`已關聯 ${ids.length} 宗${kind === "event" ? "事件" : "工作"}`);
  };

  const inspectionColumns: Column<PlanInspectionRow>[] = [
    { key: "seq", title: "序號", width: 64, sortable: true },
    { key: "id", title: "巡查編號", width: 160, sortable: true },
    { key: "objectId", title: "巡查對象", width: 190, render: (row) => objectOf(row.objectId)?.name ?? row.objectId, sortable: true, sortValue: (row) => objectOf(row.objectId)?.name ?? "" },
    { key: "templateId", title: "巡查模板", width: 170, render: (row) => inspectionTemplateName(row.templateId), sortable: true, sortValue: (row) => inspectionTemplateName(row.templateId) },
    { key: "source", title: "來源", width: 104, render: (row) => <StatusTag tone={sourceTone[row.source]}>{sourceLabel(row.source)}</StatusTag>, sortable: true, sortValue: (row) => sourceLabel(row.source) },
    { key: "status", title: "狀態", width: 90, render: (row) => <>{voidedIds.has(row.id) ? <StatusTag tone="danger">已作廢</StatusTag> : <StatusTag>{row.status}</StatusTag>}</>, sortable: true },
    { key: "result", title: "結果", width: 90, render: (row) => { const result = resultOf(row); return <StatusTag tone={result === "異常" ? "danger" : result === "正常" ? "success" : "neutral"}>{result}</StatusTag>; }, sortable: true, sortValue: resultOf },
    { key: "inspector", title: "巡查人員", width: 100, render: (row) => row.inspector ?? "—", sortable: true, sortValue: (row) => row.inspector ?? "" },
    { key: "submittedAt", title: "提交時間", width: 150, render: (row) => row.submittedAt ?? "—", sortable: true, sortValue: (row) => row.submittedAt ?? "" },
  ];
  const eventColumns: Column<EventRecord>[] = [
    { key: "id", title: "事件編號", width: 160, sortable: true }, { key: "description", title: "事件描述", width: 220 }, { key: "type", title: "事件類型", width: 170 },
    { key: "status", title: "跟進狀態", width: 100, render: (event) => <StatusTag>{event.status}</StatusTag>, sortable: true }, { key: "address", title: "地址", width: 200 }, { key: "createdAt", title: "建立時間", width: 150, sortable: true },
  ];
  const workColumns: Column<Work>[] = [
    { key: "id", title: "工作編號", width: 160, sortable: true }, { key: "title", title: "工作摘要", width: 220 }, { key: "type", title: "工作類型", width: 160 },
    { key: "status", title: "狀態", width: 90, render: (work) => <StatusTag>{work.status}</StatusTag>, sortable: true }, { key: "group", title: "執行群組", width: 140, sortable: true },
    { key: "sla", title: "服務承諾", width: 100, render: (work) => <StatusTag>{work.sla}</StatusTag> }, { key: "createdAt", title: "建立時間", width: 150, sortable: true },
  ];
  const trackRows = tracks.map((track) => ({ ...track, id: track.name }));
  const trackColumns: Column<(typeof trackRows)[number]>[] = [
    { key: "name", title: "人員", width: 140, render: (track) => <span className="plan-track-name"><i style={{ background: track.color }} />{track.name}{track.name === plan.executor ? "（預設巡查人員）" : ""}</span> },
    { key: "points", title: "定位點", width: 100, render: (track) => `${track.points.length} 個` },
    { key: "distance", title: "移動距離", width: 120, render: (track) => `${trackMeters(track.points)} 米` },
    { key: "first", title: "首個定位", width: 110, render: (track) => track.points[0]?.[2] ?? "—" },
    { key: "last", title: "最後位置", width: 110, render: (track) => track.points[track.points.length - 1]?.[2] ?? "—" },
    { key: "visible", title: "地圖顯示", width: 100, render: (track) => <label className="plan-track-toggle"><input type="checkbox" checked={!hiddenTracks.includes(track.name)} onChange={() => setHiddenTracks((current) => current.includes(track.name) ? current.filter((name) => name !== track.name) : [...current, track.name])} />顯示</label> },
  ];
  const timeline = [
    ...app.planOps.filter((op) => op.planId === plan.id).map((op) => ({ time: op.time, title: op.action, text: `${op.operator}（App）${op.reason ? `：${op.reason}` : ""}`, tone: op.action === "中止作業" || op.action === "搶鎖失敗" ? "warning" as const : "info" as const })),
    ...(plan.changes ?? []).map((change) => ({ time: change.time, title: change.action, text: `${change.operator}：${change.detail}`, tone: "neutral" as const })),
  ].sort((a, b) => b.time.localeCompare(a.time));

  return <div className="page-content detail-page plan-detail-page">
    <PageHeader eyebrow="巡查計劃 / 計劃詳情" title={plan.name} actions={<>
      <Button icon={<ArrowLeftOutlined />} onClick={() => navigate("/plans")}>返回列表</Button>
      {editable && <><Button icon={<EditOutlined />} onClick={() => setDrawer("edit")}>編輯計劃</Button><Button variant="primary" icon={<PlusOutlined />} onClick={() => setDrawer("add")}>增加巡查</Button></>}
      {plan.status === "進行中" && <Button variant="danger" icon={<LockOutlined />} onClick={() => setConfirmStop(true)}>強制中止</Button>}
      {ended && <><Button icon={<LinkOutlined />} onClick={() => setDrawer("linkEvent")}>關聯事件</Button><Button icon={<LinkOutlined />} onClick={() => setDrawer("linkWork")}>關聯工作</Button><Button icon={<PlusOutlined />} onClick={() => setDrawer("event")}>補入事件</Button><Button icon={<PlusOutlined />} onClick={() => setDrawer("work")}>補入工作</Button><Button variant="primary" icon={<PlusOutlined />} onClick={() => setDrawer("supplement")}>補入巡查</Button></>}
    </>} />
    <div className="status-strip plan-status-strip">
      <div><span>計劃編號</span><strong>{plan.id}</strong></div><div><span>狀態</span><StatusTag>{plan.status}</StatusTag></div>
      <div><span>巡查模板</span><strong>{currentTemplate ? <Link to={`/config/templates?template=${currentTemplate.id}`}>{plan.template}</Link> : plan.template}{snapshot ? "（建立時快照）" : ""}</strong></div><div><span>巡查群組</span><strong>{plan.group}</strong></div>
      <div><span>預設巡查人員</span><strong>{plan.executor ?? "未指定"}</strong></div><div><span>計劃時間</span><strong>{plan.startAt} – {plan.endAt.slice(11)}</strong></div>
      <div><span>完成進度</span><ProgressCell done={done} total={countedRows.length} /></div>
    </div>
    {templateChanged && currentTemplate && snapshot && <div className="plan-snapshot-note"><InfoCircleOutlined /><span>巡查模板「{currentTemplate.name}」已於 {currentTemplate.updatedAt} 更新；本計劃沿用建立時的快照（{snapshot.objects.length} 個對象{snapshot.items ? `、${snapshot.items.length} 個巡查項目` : ""}），{snapshot.items ? "計劃內的巡查不受模板更改影響。" : "此計劃早於模板快照功能建立，未提交的巡查按目前模板填寫。"}</span></div>}
    {!snapshot && <div className="plan-snapshot-note"><InfoCircleOutlined /><span>此計劃沒有巡查模板快照，地圖只顯示事件、工作及軌跡。</span></div>}
    <section className="panel plan-map-panel"><PlanMap route={layers.route ? snapshot?.route : undefined} markers={markers} tracks={visibleTracks} layers={chips} onToggleLayer={(key) => setLayers((current) => ({ ...current, [key]: !current[key] }))} selected={selected} onSelect={select} fitKey={plan.id}
      legend={<><LegendItem tone="route">計劃路線</LegendItem><LegendItem tone="todo">未巡查</LegendItem><LegendItem tone="done">已完成</LegendItem><LegendItem tone="issue">有異常</LegendItem><LegendItem tone="event">事件</LegendItem><LegendItem tone="work">工作</LegendItem><LegendItem tone="track">人員軌跡（示範）</LegendItem></>} /></section>
    <section className="panel tab-panel plan-tab-panel"><nav>{(["巡查", "事件", "工作", "人員軌跡", "作業記錄"] as DetailTab[]).map((item) => <button key={item} className={tab === item ? "active" : ""} onClick={() => setTab(item)}>{item}<span>{item === "巡查" ? rows.length : item === "事件" ? planEvents.length : item === "工作" ? planWorks.length : item === "人員軌跡" ? tracks.length : timeline.length}</span></button>)}</nav>
      <div className="plan-tab-body">
        {tab === "巡查" && <DenseTable rows={rows} columns={inspectionColumns} onRowClick={(row) => focus(row.id, "inspections")} emptyText="此計劃暫無巡查" stickyActions actionTitle="操作" renderActions={(row) => <button className="table-action-button" onClick={() => navigate(`/inspections/${row.id}`)}><EyeOutlined />查看</button>} />}
        {tab === "事件" && <DenseTable rows={planEvents} columns={eventColumns} onRowClick={(event) => focus(`event:${event.id}`, "events")} emptyText="此計劃暫無事件" stickyActions actionTitle="操作" renderActions={(event) => <button className="table-action-button" onClick={() => navigate(`/events/${event.id}`)}><EyeOutlined />查看</button>} />}
        {tab === "工作" && <DenseTable rows={planWorks} columns={workColumns} onRowClick={(work) => focus(`work:${work.id}`, "works")} emptyText="此計劃暫無工作" stickyActions actionTitle="操作" renderActions={(work) => <button className="table-action-button" onClick={() => navigate(`/works/${work.id}`)}><EyeOutlined />查看</button>} />}
        {tab === "人員軌跡" && <><p className="plan-hint plan-tab-hint">示範軌跡按計劃路線推算；正式環境取自巡查群組人員的定位上報。</p><DenseTable rows={trackRows} columns={trackColumns} emptyText={plan.status === "未開始" ? "計劃尚未開始，暫無軌跡" : "暫無軌跡"} /></>}
        {tab === "作業記錄" && <div className="plan-timeline">{timeline.length ? <ActivityTimeline items={timeline} /> : <div className="empty-state"><strong>暫無作業記錄</strong></div>}</div>}
      </div>
    </section>

    {drawer === "edit" && <EditPlanDrawer plan={plan} objectIds={unique(rows.map((row) => row.objectId))} allowedGroupIds={currentTemplate?.groups} onClose={() => setDrawer(null)} onSave={(patch, detail, operator) => { updatePlan(plan.id, { ...patch, changes: log("編輯計劃", detail, operator) }); setDrawer(null); showToast("計劃已更新"); }} />}
    {drawer === "add" && <BatchPickerDrawer key={extraTemplate} title="增加巡查" noun="對象" filterLabel="網格" description="選擇巡查模板及其適用對象，為未開始的計劃增加額外巡查。" confirmLabel="增加巡查"
      rows={applicableObjects(extraTemplate).sort((a, b) => Number(b.grid === plan.grid) - Number(a.grid === plan.grid)).map((object) => ({ id: object.id, title: object.name, meta: `${object.id} · ${object.address}`, group: object.grid }))}
      footer={<div className="form-grid"><Field label="巡查模板" required hint="只列出此模板適用的對象"><Select ariaLabel="額外巡查模板" value={extraTemplate} onChange={setExtraTemplate}>{activeAppTemplates().map((template) => <option key={template.id} value={template.id}>{template.name}</option>)}</Select></Field><IdentityField value={extraIdentity} onChange={setExtraIdentity} /></div>}
      onClose={() => setDrawer(null)} onConfirm={addExtra} />}
    {drawer === "supplement" && <SupplementInspectionDrawer plan={plan} rows={rows} defaultTemplate={templateId} onClose={() => setDrawer(null)} onSave={(entry, detail) => {
      const added = appendInspections([entry], usedIds, dateKey(plan.startAt), nextSeq, "補入", { status: "已完成", inspector: entry.inspector, submittedAt: entry.submittedAt, result: entry.result, reason: entry.reason, addedBy: signedInUser, addedAt: nowText() });
      updatePlan(plan.id, { inspections: [...(plan.inspections ?? []), ...added], total: rows.length + 1, progress: done + 1, changes: log("補入巡查", `${added[0].id}：${detail}`) });
      const time = nowText();
      saveInspectionRecord({ id: added[0].id, origin: "後台", planId: plan.id, objectId: entry.objectId, templateId: entry.templateId, snapshot: templateSnapshotOf(entry.templateId, time), seq: added[0].seq, status: "已完成", source: "補入", inspector: entry.inspector, submittedAt: entry.submittedAt, results: {}, changes: [{ time, operator: signedInUser, action: "補入巡查", detail: `由計劃 ${plan.id} 補入；${detail}` }], createdBy: signedInUser, createdAt: time });
      setDrawer(null); showToast(`已補入巡查 ${added[0].id}`);
    }} />}
    {drawer === "event" && <SupplementEventDrawer plan={plan} rows={rows} onClose={() => setDrawer(null)} onSave={(input, reason) => {
      const time = nowText(); const eventId = nextIds("EV", events.map((event) => event.id), dateKey(time), 1)[0];
      addEvent({ ...input, id: eventId, grid: plan.grid, createdAt: time, planId: plan.id, workIds: [], creator: signedInUser });
      updatePlan(plan.id, { changes: log("補入事件", `${eventId}：${reason}`) }); setDrawer(null); showToast(`已補入事件 ${eventId}`);
    }} />}
    {drawer === "work" && <SupplementWorkDrawer plan={plan} rows={rows} onClose={() => setDrawer(null)} onSave={(input, reason) => {
      const time = nowText(); const workId = nextIds("WK", works.map((work) => work.id), dateKey(time), 1)[0];
      addWork({ ...input, id: workId, source: "巡查", status: "新建", grid: plan.grid, sla: "正常", createdAt: time, updatedAt: time, planId: plan.id, creator: signedInUser });
      updatePlan(plan.id, { changes: log("補入工作", `${workId}：${reason}`) }); setDrawer(null); showToast(`已補入工作 ${workId}`);
    }} />}
    {drawer === "linkEvent" && <BatchPickerDrawer title="關聯現有事件" noun="事件" filterLabel="網格" description="只列出尚未關聯計劃的事件。" confirmLabel="批量關聯"
      rows={events.filter((event) => !event.planId && !event.pendingSync).map((event) => ({ id: event.id, title: event.description, meta: `${event.id} · ${event.type} · ${event.createdAt}`, group: event.grid }))} onClose={() => setDrawer(null)} onConfirm={(ids) => linkRecords("event", ids)} />}
    {drawer === "linkWork" && <BatchPickerDrawer title="關聯現有工作" noun="工作" filterLabel="網格" description="只列出尚未關聯計劃的工作。" confirmLabel="批量關聯"
      rows={works.filter((work) => !work.planId && !work.pendingSync && !work.voided).map((work) => ({ id: work.id, title: work.title, meta: `${work.id} · ${work.type} · ${work.status}`, group: work.grid }))} onClose={() => setDrawer(null)} onConfirm={(ids) => linkRecords("work", ids)} />}
    <ConfirmDialog open={confirmStop} title="強制中止進行中的計劃？" message={`目前由 ${plan.executor ?? "其他人員"} 執行。強制中止會立即釋放作業鎖，請確認已與前線人員協調。`} danger confirmLabel="強制中止" onCancel={() => setConfirmStop(false)} onConfirm={stop} />
  </div>;
}

// ---- 抽屜 ----
function EditPlanDrawer({ plan, objectIds, allowedGroupIds, onClose, onSave }: { plan: Plan; objectIds: string[]; allowedGroupIds?: string[]; onClose: () => void; onSave: (patch: Partial<Plan>, detail: string, operator: string) => void }) {
  const { authorize } = usePermissionRules();
  const [form, setForm] = useState({ name: plan.name, groupId: groupIdOf(plan), executor: plan.executor ?? "", startAt: toInput(plan.startAt), endAt: toInput(plan.endAt), note: plan.note ?? "" });
  const [identityId, setIdentityId] = useState(defaultIdentityId); const [errors, setErrors] = useState<string[]>([]);
  const change = (patch: Partial<typeof form>) => { setForm((current) => ({ ...current, ...patch })); setErrors([]); };
  const save = () => {
    const found = validatePlanForm({ ...form, templateId: templateIdOfPlan(plan), allowedGroupIds });
    if (found.length) { setErrors(found); return; }
    const group = inspectionGroups.find((item) => item.id === form.groupId)!;
    const identity = policyUsers.find((user) => user.id === identityId) ?? policyUsers[0];
    const decision = authorize("create-plan", { request: planRequest(form.groupId, objectIds) }, identity);
    if (!decision.allowed) { setErrors([`權限校驗未通過：${decision.reason}`]); return; }
    const patch: Partial<Plan> = { name: form.name.trim(), group: group.name, groupId: group.id, executor: form.executor || undefined, startAt: fromInput(form.startAt), endAt: fromInput(form.endAt), note: form.note.trim() || undefined };
    const diffs = [patch.group !== plan.group && `巡查群組 ${plan.group} → ${patch.group}`, (patch.startAt !== plan.startAt || patch.endAt !== plan.endAt) && `時間 ${patch.startAt} – ${patch.endAt?.slice(11)}`, patch.executor !== plan.executor && `預設巡查人員 ${plan.executor ?? "未指定"} → ${patch.executor ?? "未指定"}`, patch.name !== plan.name && `名稱改為「${patch.name}」`].filter(Boolean);
    onSave(patch, diffs.length ? diffs.join("；") : "更新備註", identity.name);
  };
  return <FormDrawer open title="編輯計劃" subtitle={`${plan.id} · 只限未開始的計劃`} onClose={onClose} onSubmit={save} className="plan-drawer">
    <FormError errors={errors} />
    <div className="form-grid two-col">
      <Field label="計劃名稱" required><input value={form.name} maxLength={50} onChange={(event) => change({ name: event.target.value })} /></Field>
      <Field label="巡查模板"><input value={`${plan.template}（快照，不可更改）`} disabled /></Field>
      <Field label="開始時間" required><input type="datetime-local" value={form.startAt} onChange={(event) => change({ startAt: event.target.value })} /></Field>
      <Field label="結束時間" required><input type="datetime-local" value={form.endAt} onChange={(event) => change({ endAt: event.target.value })} /></Field>
      <Field label="巡查群組" required hint={allowedGroupIds?.length ? "只列出巡查模板的適用巡查群組" : undefined}><GroupSelect value={form.groupId} onChange={(groupId) => change({ groupId, executor: "" })} groups={allowedGroupsOf(allowedGroupIds)} /></Field>
      <Field label="預設巡查人員"><ExecutorSelect groupId={form.groupId} value={form.executor} onChange={(executor) => change({ executor })} /></Field>
      <Field label="備註"><textarea rows={3} value={form.note} onChange={(event) => change({ note: event.target.value })} /></Field>
      <IdentityField value={identityId} onChange={(value) => { setIdentityId(value); setErrors([]); }} />
    </div>
  </FormDrawer>;
}

/** Active objects as map objects. */
const activeObjects = () => getManagedObjects().filter((object) => object.status === "啟用").flatMap((object) => objectOf(object.id) ?? []);
/** Active objects a template applies to (its inspection type, and its listed objects when it lists any). */
const applicableObjects = (templateId: string) => { const template = appTemplate(templateId); return template ? getManagedObjects().filter((object) => object.status === "啟用" && templateAppliesTo(template, object)).flatMap((object) => objectOf(object.id) ?? []) : []; };

function objectOptions(plan: Plan, rows: PlanInspectionRow[]) {
  const planIds = unique(rows.map((row) => row.objectId));
  return [...planIds.map((id) => objectOf(id)).filter((object) => !!object), ...activeObjects().filter((object) => !planIds.includes(object.id) && object.grid === plan.grid)];
}

function SupplementInspectionDrawer({ plan, rows, defaultTemplate, onClose, onSave }: { plan: Plan; rows: PlanInspectionRow[]; defaultTemplate: string; onClose: () => void; onSave: (entry: { objectId: string; templateId: string; inspector: string; submittedAt: string; result: "正常" | "異常"; reason: string }, detail: string) => void }) {
  const options = objectOptions(plan, rows);
  const people = unique([...groupMembers(plan.group), ...(plan.executor ? [plan.executor] : [])]);
  const [form, setForm] = useState({ objectId: options[0]?.id ?? "", templateId: defaultTemplate || rows[0]?.templateId || activeAppTemplates()[0]?.id || "", inspector: plan.executor ?? people[0] ?? "", submittedAt: toInput(plan.endAt), result: "正常" as "正常" | "異常", reason: "" });
  const [errors, setErrors] = useState<string[]>([]);
  const change = (patch: Partial<typeof form>) => { setForm((current) => ({ ...current, ...patch })); setErrors([]); };
  const save = () => {
    const found = [!form.objectId && "請選擇巡查對象。", !form.templateId && "請選擇巡查模板。", !form.inspector && "請選擇巡查人員。", !form.submittedAt && "請填寫巡查時間。", !form.reason.trim() && "請填寫補入原因。"].filter((item): item is string => !!item);
    if (found.length) { setErrors(found); return; }
    onSave({ ...form, submittedAt: fromInput(form.submittedAt), reason: form.reason.trim() }, `${objectOf(form.objectId)?.name ?? form.objectId}（${form.result}）；原因：${form.reason.trim()}`);
  };
  return <FormDrawer open title="補入巡查" subtitle={`${plan.id} · 已結束計劃的補錄巡查會標示「補入」`} onClose={onClose} onSubmit={save} submitLabel="確認補入" className="plan-drawer">
    <FormError errors={errors} />
    <div className="form-grid two-col">
      <Field label="巡查對象" required><Select ariaLabel="補入巡查對象" value={form.objectId} onChange={(objectId) => change({ objectId })}>{options.map((object) => <option key={object.id} value={object.id}>{object.name}（{object.id}）</option>)}</Select></Field>
      <Field label="巡查模板" required><Select ariaLabel="補入巡查模板" value={form.templateId} onChange={(templateId) => change({ templateId })}>{activeAppTemplates().map((template) => <option key={template.id} value={template.id}>{template.name}</option>)}</Select></Field>
      <Field label="巡查人員" required><Select ariaLabel="補入巡查人員" value={form.inspector} onChange={(inspector) => change({ inspector })}>{people.map((name) => <option key={name}>{name}</option>)}</Select></Field>
      <Field label="巡查時間" required><input type="datetime-local" value={form.submittedAt} onChange={(event) => change({ submittedAt: event.target.value })} /></Field>
      <Field label="巡查結果" required><Select ariaLabel="補入巡查結果" value={form.result} onChange={(result) => change({ result: result as "正常" | "異常" })}><option>正常</option><option>異常</option></Select></Field>
      <Field label="補入原因" required><textarea rows={3} value={form.reason} onChange={(event) => change({ reason: event.target.value })} placeholder="例如：現場已巡查但 App 離線未能提交" /></Field>
    </div>
  </FormDrawer>;
}

function SupplementEventDrawer({ plan, rows, onClose, onSave }: { plan: Plan; rows: PlanInspectionRow[]; onClose: () => void; onSave: (input: Pick<EventRecord, "type" | "description" | "status" | "address" | "x" | "y">, reason: string) => void }) {
  const options = objectOptions(plan, rows);
  const [form, setForm] = useState({ type: eventTypes[0], description: "", status: "跟進中" as EventRecord["status"], objectId: options[0]?.id ?? "", address: options[0]?.address ?? "", reason: "" });
  const [errors, setErrors] = useState<string[]>([]);
  const change = (patch: Partial<typeof form>) => { setForm((current) => ({ ...current, ...patch })); setErrors([]); };
  const save = () => {
    const found = [!form.description.trim() && "請填寫事件描述。", !form.address.trim() && "請填寫地址。", !form.reason.trim() && "請填寫補入原因。"].filter((item): item is string => !!item);
    if (found.length) { setErrors(found); return; }
    const object = objectOf(form.objectId);
    onSave({ type: form.type, description: form.description.trim(), status: form.status, address: form.address.trim(), x: object?.x, y: object?.y }, form.reason.trim());
  };
  return <FormDrawer open title="補入事件" subtitle={`${plan.id} · 事件將關聯至此計劃`} onClose={onClose} onSubmit={save} submitLabel="確認補入" className="plan-drawer">
    <FormError errors={errors} />
    <div className="form-grid two-col">
      <Field label="事件類型" required><Select ariaLabel="補入事件類型" value={form.type} onChange={(type) => change({ type })}>{eventTypes.map((type) => <option key={type}>{type}</option>)}</Select></Field>
      <Field label="跟進狀態" required><Select ariaLabel="補入事件跟進狀態" value={form.status} onChange={(status) => change({ status: status as EventRecord["status"] })}><option>無需跟進</option><option>跟進中</option><option>已完成</option></Select></Field>
      <Field label="關聯巡查對象" hint="用作地圖位置及預設地址"><Select ariaLabel="補入事件對象" value={form.objectId} onChange={(objectId) => change({ objectId, address: objectOf(objectId)?.address ?? form.address })}><option value="">不關聯對象</option>{options.map((object) => <option key={object.id} value={object.id}>{object.name}</option>)}</Select></Field>
      <Field label="地址" required><input value={form.address} onChange={(event) => change({ address: event.target.value })} /></Field>
      <Field label="事件描述" required><textarea rows={3} value={form.description} onChange={(event) => change({ description: event.target.value })} /></Field>
      <Field label="補入原因" required><textarea rows={3} value={form.reason} onChange={(event) => change({ reason: event.target.value })} placeholder="例如：巡查時口頭報告，事後補錄" /></Field>
    </div>
  </FormDrawer>;
}

function SupplementWorkDrawer({ plan, rows, onClose, onSave }: { plan: Plan; rows: PlanInspectionRow[]; onClose: () => void; onSave: (input: Pick<Work, "title" | "type" | "priority" | "group" | "address" | "description" | "objectId" | "x" | "y">, reason: string) => void }) {
  const options = objectOptions(plan, rows);
  const [form, setForm] = useState({ title: "", type: workTypes[0], priority: "一般" as Work["priority"], group: execGroups[0], objectId: options[0]?.id ?? "", address: options[0]?.address ?? "", description: "", reason: "" });
  const [errors, setErrors] = useState<string[]>([]);
  const change = (patch: Partial<typeof form>) => { setForm((current) => ({ ...current, ...patch })); setErrors([]); };
  const save = () => {
    const found = [!form.title.trim() && "請填寫工作摘要。", !form.address.trim() && "請填寫地址。", !form.reason.trim() && "請填寫補入原因。"].filter((item): item is string => !!item);
    if (found.length) { setErrors(found); return; }
    const object = objectOf(form.objectId);
    onSave({ title: form.title.trim(), type: form.type, priority: form.priority, group: form.group, address: form.address.trim(), description: form.description.trim() || form.title.trim(), objectId: form.objectId || undefined, x: object?.x, y: object?.y }, form.reason.trim());
  };
  return <FormDrawer open title="補入工作" subtitle={`${plan.id} · 工作將關聯至此計劃`} onClose={onClose} onSubmit={save} submitLabel="確認補入" className="plan-drawer">
    <FormError errors={errors} />
    <div className="form-grid two-col">
      <Field label="工作摘要" required><input value={form.title} maxLength={50} onChange={(event) => change({ title: event.target.value })} /></Field>
      <Field label="工作類型" required><Select ariaLabel="補入工作類型" value={form.type} onChange={(type) => change({ type })}>{workTypes.map((type) => <option key={type}>{type}</option>)}</Select></Field>
      <Field label="優先級" required><Select ariaLabel="補入工作優先級" value={form.priority} onChange={(priority) => change({ priority: priority as Work["priority"] })}><option>一般</option><option>緊急</option><option>特急</option></Select></Field>
      <Field label="執行群組" required><Select ariaLabel="補入工作執行群組" value={form.group} onChange={(group) => change({ group })}>{execGroups.map((group) => <option key={group}>{group}</option>)}</Select></Field>
      <Field label="關聯巡查對象" hint="用作地圖位置及預設地址"><Select ariaLabel="補入工作對象" value={form.objectId} onChange={(objectId) => change({ objectId, address: objectOf(objectId)?.address ?? form.address })}><option value="">不關聯對象</option>{options.map((object) => <option key={object.id} value={object.id}>{object.name}</option>)}</Select></Field>
      <Field label="地址" required><input value={form.address} onChange={(event) => change({ address: event.target.value })} /></Field>
      <Field label="描述"><textarea rows={3} value={form.description} onChange={(event) => change({ description: event.target.value })} /></Field>
      <Field label="補入原因" required><textarea rows={3} value={form.reason} onChange={(event) => change({ reason: event.target.value })} placeholder="例如：現場即時處理，事後補錄工作" /></Field>
    </div>
  </FormDrawer>;
}
