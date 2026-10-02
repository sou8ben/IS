import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeftOutlined, CheckOutlined, EditOutlined, ExportOutlined, EyeOutlined, InfoCircleOutlined, LinkOutlined, LockOutlined, PlusOutlined, ReloadOutlined, WarningFilled } from "@ant-design/icons";
import { execGroups } from "./app/data";
import { ActivityTimeline, BatchPickerDrawer, Button, ConfirmDialog, DenseTable, Field, FormDrawer, PageHeader, Pagination, Select, StatusTag, useToast } from "./components";
import { usePermissionRules } from "./permission-store";
import { policyUsers, requestObjects, responsibilityGroups, type PlanRequest } from "./permission-rules";
import {
  allObjects, groupMembers, inspectionResult, inspectionTemplateName, inspectionTemplates, objectOf, planTemplates, planTracks, positionOfEvent, positionOfWork,
  snapshotFromTemplate, snapshotOf, templateOfPlan, trackMeters, useAppPlanState, type PlanTemplateDef,
} from "./plan-data";
import { LegendItem, PlanMap, type MapLayerChip, type MapMarkerSpec } from "./plan-map";
import { appendInspections, buildPlannedInspections, isEditable, isEnded, mergePlanInspections, nextIds, validatePlanForm, type PlanChange, type PlanInspectionRow } from "./plan-rules";
import { useDemo } from "./store";
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
const eventTypes = ["公共設施異常／座椅", "公共設施異常／照明", "環境衛生／積水", "綠化問題／樹木", "道路通行問題／路面"];
const workTypes = ["公共設施／座椅", "公共設施／照明", "環境衛生／收集設施", "綠化／樹木", "道路設施／路面"];

function planRequest(template: PlanTemplateDef | undefined, groupId: string): PlanRequest {
  return template?.policyScope ? { group: groupId, department: template.policyScope.department, grid: template.policyScope.grid, objects: template.policyScope.objects } : { group: groupId };
}

function FormError({ errors }: { errors: string[] }) {
  return errors.length ? <div className="plan-form-error" role="alert">{errors.join(" ")}</div> : null;
}

function IdentityField({ value, onChange }: { value: string; onChange: (id: string) => void }) {
  return <Field label="提交身份（示範）" hint="提交時以此身份重新校驗功能權限、禁止身份及權責範圍"><Select ariaLabel="提交身份" value={value} onChange={onChange}>{policyUsers.map((user) => <option key={user.id} value={user.id}>{user.name}（{user.roles.join("、")}）</option>)}</Select></Field>;
}

function GroupSelect({ value, onChange }: { value: string; onChange: (id: string) => void }) {
  return <Select ariaLabel="巡查群組" value={value} onChange={onChange}><option value="">請選擇巡查群組</option>{inspectionGroups.map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}</Select>;
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
  const { plans } = useDemo(); const navigate = useNavigate();
  const [filters, setFilters] = useState(emptyFilters); const [page, setPage] = useState(1); const [pageSize, setPageSize] = useState(15);
  const filter = (key: keyof typeof emptyFilters, value: string) => { setFilters((current) => ({ ...current, [key]: value })); setPage(1); };
  const rows = plans.filter((plan) => contains(plan.id, filters.id) && contains(plan.name, filters.name) && (!filters.template || plan.template === filters.template) && (!filters.group || plan.group === filters.group)
    && (!filters.status || plan.status === filters.status) && (!filters.from || plan.startAt.slice(0, 10) >= filters.from) && (!filters.to || plan.startAt.slice(0, 10) <= filters.to));
  const columns: Column<Plan>[] = ([
    { key: "id", title: "計劃編號", width: 170 },
    { key: "name", title: "計劃名稱", width: 230 },
    { key: "template", title: "計劃模板", width: 170 },
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
        <label className="filter-field"><span>計劃模板</span><Select ariaLabel="計劃模板" value={filters.template} onChange={(value) => filter("template", value)}><option value="">全部計劃模板</option>{unique([...planTemplates.map((template) => template.name), ...plans.map((plan) => plan.template)]).map((name) => <option key={name}>{name}</option>)}</Select></label>
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
  const { plans, addPlan } = useDemo(); const navigate = useNavigate(); const { showToast } = useToast(); const { authorize } = usePermissionRules(); const app = useAppPlanState();
  const activeTemplates = planTemplates.filter((template) => template.status === "生效");
  const [form, setForm] = useState({ name: "黑沙環公園設施巡查", templateId: activeTemplates[0]?.id ?? "", startAt: "2026-09-30T09:00", endAt: "2026-09-30T12:00", groupId: "inspect-north", executor: "", note: "" });
  const [identityId, setIdentityId] = useState(defaultIdentityId); const [errors, setErrors] = useState<string[]>([]); const [selected, setSelected] = useState<string | null>(null);
  const template = planTemplates.find((item) => item.id === form.templateId);
  const change = (patch: Partial<typeof form>) => { setForm((current) => ({ ...current, ...patch })); setErrors([]); };
  const changeGroup = (groupId: string) => change({ groupId, executor: groupMembers(inspectionGroups.find((group) => group.id === groupId)?.name ?? "").includes(form.executor) ? form.executor : "" });
  const preview = template ? template.objects.flatMap((object, objectIndex) => object.templateIds.map((templateId) => ({ object: objectOf(object.objectId), objectIndex, templateId }))) : [];
  const request = planRequest(template, form.groupId);
  const create = () => {
    const found = validatePlanForm(form);
    if (found.length || !template) { setErrors(found); return; }
    const identity = policyUsers.find((user) => user.id === identityId) ?? policyUsers[0];
    const decision = authorize("create-plan", { request }, identity);
    if (!decision.allowed) { setErrors([`權限校驗未通過：${decision.reason}`]); showToast(decision.reason, "error"); return; }
    const group = inspectionGroups.find((item) => item.id === form.groupId)!;
    const time = nowText(); const startAt = fromInput(form.startAt);
    const snapshot = snapshotFromTemplate(template, time);
    const usedIds = [...app.inspections.map((item) => item.id), ...plans.flatMap((plan) => (plan.inspections ?? []).map((item) => item.id))];
    const inspections = buildPlannedInspections(snapshot, usedIds, dateKey(startAt));
    const id = nextIds("PL", plans.map((plan) => plan.id), dateKey(startAt), 1)[0];
    const change: PlanChange = { time, operator: identity.name, action: "建立計劃", detail: `以「${template.name}」v${template.version} 快照建立，產生 ${inspections.length} 個巡查` };
    addPlan({ id, name: form.name.trim(), template: template.name, planTemplateId: template.id, group: group.name, groupId: group.id, status: "未開始", startAt, endAt: fromInput(form.endAt), executor: form.executor || undefined, progress: 0, total: inspections.length, grid: template.grid, department: template.department, note: form.note.trim() || undefined, snapshot, inspections, changes: [change], createdBy: identity.name, createdAt: time });
    showToast(`計劃已建立，產生 ${inspections.length} 個巡查`);
    navigate(`/plans/${id}`);
  };
  const markers = (template?.objects ?? []).flatMap((entry, index): MapMarkerSpec[] => { const object = objectOf(entry.objectId); return object ? [{ id: entry.objectId, kind: "object", x: object.x, y: object.y, tone: "object", label: String(index + 1), title: `${index + 1}. ${object.name}`, detail: <span>{object.address}<br />巡查模板：{entry.templateIds.map(inspectionTemplateName).join("、")}</span> }] : []; });
  return <div className="page-content plan-create-page">
    <PageHeader eyebrow="巡查計劃 / 新增計劃" title="新增巡查計劃" actions={<><Button onClick={() => navigate("/plans")}>取消</Button><Button variant="primary" icon={<CheckOutlined />} onClick={create}>建立計劃</Button></>} />
    <div className="plan-create-layout">
      <div className="plan-create-form">
        <FormError errors={errors} />
        <section className="panel form-section"><header><h2>計劃設定</h2></header><div className="form-grid two-col">
          <Field label="計劃名稱" required><input value={form.name} maxLength={50} onChange={(event) => change({ name: event.target.value })} placeholder="請輸入計劃名稱" /></Field>
          <Field label="計劃模板" required hint="建立時複製模板快照，之後模板更改不影響此計劃"><Select ariaLabel="計劃模板" value={form.templateId} onChange={(templateId) => { change({ templateId }); setSelected(null); }}><option value="">請選擇計劃模板</option>{activeTemplates.map((item) => <option key={item.id} value={item.id}>{item.name}（v{item.version}）</option>)}</Select></Field>
          <Field label="開始時間" required><input type="datetime-local" value={form.startAt} onChange={(event) => change({ startAt: event.target.value })} /></Field>
          <Field label="結束時間" required><input type="datetime-local" value={form.endAt} onChange={(event) => change({ endAt: event.target.value })} /></Field>
          <Field label="巡查群組" required hint="計劃指派予此群組，在指定時間內執行"><GroupSelect value={form.groupId} onChange={changeGroup} /></Field>
          <Field label="預設巡查人員"><ExecutorSelect groupId={form.groupId} value={form.executor} onChange={(executor) => change({ executor })} /></Field>
          <Field label="附屬部門"><input value={template?.department ?? ""} disabled /></Field>
          <Field label="所屬網格"><input value={template?.grid ?? ""} disabled /></Field>
          <Field label="備註"><textarea rows={3} value={form.note} onChange={(event) => change({ note: event.target.value })} placeholder="選填" /></Field>
        </div></section>
        <section className="panel form-section"><header><h2>權限校驗資料（示範）</h2></header><div className="form-grid">
          <IdentityField value={identityId} onChange={(value) => { setIdentityId(value); setErrors([]); }} />
          <dl className="plan-request-list"><div><dt>附屬部門</dt><dd>{request.department ?? "—"}</dd></div><div><dt>網格</dt><dd>{request.grid ?? "—"}</dd></div><div><dt>巡查群組</dt><dd>{inspectionGroups.find((group) => group.id === form.groupId)?.name ?? "—"}</dd></div><div><dt>權責對象</dt><dd>{request.objects?.map((id) => requestObjects.find((object) => object.id === id)?.name ?? id).join("、") ?? "—"}</dd></div></dl>
          {template && !template.policyScope && <div className="plan-warning"><WarningFilled />此計劃模板未配置示範權責資料，提交時會因資料缺失被拒絕。</div>}
          <p className="plan-hint">使用示範身份及權責資料；正式環境須由服務端以目前登入用戶重新校驗。</p>
        </div></section>
      </div>
      <section className="panel plan-preview-panel">
        <header><div><h2>計劃模板預覽</h2><p>{template ? `${template.code} · v${template.version} · ${template.grid} · 更新於 ${template.updatedAt}` : "請選擇計劃模板"}</p></div><StatusTag tone="info">{preview.length} 個巡查</StatusTag></header>
        {template && <div className="plan-preview-stats"><div><span>途經點</span><strong>{template.route.length}</strong></div><div><span>巡查對象</span><strong>{template.objects.length}</strong></div><div><span>產生巡查</span><strong>{preview.length}</strong></div><div><span>掃描距離</span><strong>{template.bufferM} 米</strong></div></div>}
        <PlanMap className="plan-preview-map" route={template?.route} markers={markers} selected={selected} onSelect={setSelected} fitKey={form.templateId} legend={<><LegendItem tone="route">巡查路線</LegendItem><LegendItem tone="object">巡查對象</LegendItem></>} />
        <div className="plan-preview-table"><table className="dense-table"><thead><tr><th style={{ width: 52 }}>序號</th><th>巡查對象</th><th style={{ width: 170 }}>地址</th><th style={{ width: 170 }}>巡查模板</th></tr></thead><tbody>
          {preview.map((row, index) => row.object && <tr key={`${row.object.id}-${row.templateId}`} className={`clickable ${selected === row.object.id ? "selected" : ""}`} onClick={() => setSelected(row.object!.id)}><td>{index + 1}</td><td>{row.object.name}</td><td title={row.object.address}>{row.object.address}</td><td>{inspectionTemplateName(row.templateId)}</td></tr>)}
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
  const { plans, events, works, updatePlan, addEvent, addWork, updateEvent, updateWork } = useDemo(); const app = useAppPlanState();
  const [tab, setTab] = useState<DetailTab>("巡查"); const [selected, setSelected] = useState<string | null>(null);
  const [layers, setLayers] = useState<Record<string, boolean>>({ route: true, inspections: true, events: true, works: true, tracks: true });
  const [hiddenTracks, setHiddenTracks] = useState<string[]>([]); const [ghost, setGhost] = useState(false);
  const [drawer, setDrawer] = useState<DrawerKind>(null); const [confirmStop, setConfirmStop] = useState(false);
  const [extraTemplate, setExtraTemplate] = useState(inspectionTemplates[0]?.id ?? ""); const [extraIdentity, setExtraIdentity] = useState(defaultIdentityId);
  const snapshot = snapshotOf(plan); const currentTemplate = templateOfPlan(plan);
  const rows = mergePlanInspections(plan.id, plan.inspections, app.inspections);
  const planEvents = events.filter((event) => event.planId === plan.id && !event.pendingSync);
  const planWorks = works.filter((work) => work.planId === plan.id && !work.pendingSync && !work.voided);
  const done = rows.filter((row) => row.status === "已完成").length;
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
    const decision = authorize("create-plan", { request: planRequest(currentTemplate, groupIdOf(plan)) }, identity);
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
    { key: "source", title: "來源", width: 96, render: (row) => <StatusTag tone={sourceTone[row.source]}>{row.source}</StatusTag>, sortable: true },
    { key: "status", title: "狀態", width: 90, render: (row) => <StatusTag>{row.status}</StatusTag>, sortable: true },
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
      <div><span>計劃模板</span><strong>{plan.template}{snapshot ? ` · v${snapshot.version} 快照` : ""}</strong></div><div><span>巡查群組</span><strong>{plan.group}</strong></div>
      <div><span>預設巡查人員</span><strong>{plan.executor ?? "未指定"}</strong></div><div><span>計劃時間</span><strong>{plan.startAt} – {plan.endAt.slice(11)}</strong></div>
      <div><span>完成進度</span><ProgressCell done={done} total={rows.length} /></div>
    </div>
    {snapshot && currentTemplate && currentTemplate.version !== snapshot.version && <div className="plan-snapshot-note"><InfoCircleOutlined /><span>計劃模板「{currentTemplate.name}」已更新至 v{currentTemplate.version}{currentTemplate.changeNote ? `（${currentTemplate.changeNote}）` : ""}；本計劃沿用建立時的 v{snapshot.version} 快照（{snapshot.objects.length} 個對象、掃描距離 {snapshot.bufferM} 米），不受模板更改影響。</span><Button variant="text" onClick={() => setGhost(!ghost)}>{ghost ? "隱藏目前模板路線" : "對照目前模板路線"}</Button></div>}
    {!snapshot && <div className="plan-snapshot-note"><InfoCircleOutlined /><span>此計劃沒有計劃模板快照，地圖只顯示事件、工作及軌跡。</span></div>}
    <section className="panel plan-map-panel"><PlanMap route={layers.route ? snapshot?.route : undefined} ghostRoute={ghost ? currentTemplate?.route : undefined} markers={markers} tracks={visibleTracks} layers={chips} onToggleLayer={(key) => setLayers((current) => ({ ...current, [key]: !current[key] }))} selected={selected} onSelect={select} fitKey={plan.id}
      legend={<><LegendItem tone="route">計劃路線</LegendItem>{ghost && <LegendItem tone="ghost">目前模板路線</LegendItem>}<LegendItem tone="todo">未巡查</LegendItem><LegendItem tone="done">已完成</LegendItem><LegendItem tone="issue">有異常</LegendItem><LegendItem tone="event">事件</LegendItem><LegendItem tone="work">工作</LegendItem><LegendItem tone="track">人員軌跡（示範）</LegendItem></>} /></section>
    <section className="panel tab-panel plan-tab-panel"><nav>{(["巡查", "事件", "工作", "人員軌跡", "作業記錄"] as DetailTab[]).map((item) => <button key={item} className={tab === item ? "active" : ""} onClick={() => setTab(item)}>{item}<span>{item === "巡查" ? rows.length : item === "事件" ? planEvents.length : item === "工作" ? planWorks.length : item === "人員軌跡" ? tracks.length : timeline.length}</span></button>)}</nav>
      <div className="plan-tab-body">
        {tab === "巡查" && <DenseTable rows={rows} columns={inspectionColumns} onRowClick={(row) => focus(row.id, "inspections")} emptyText="此計劃暫無巡查" />}
        {tab === "事件" && <DenseTable rows={planEvents} columns={eventColumns} onRowClick={(event) => focus(`event:${event.id}`, "events")} emptyText="此計劃暫無事件" stickyActions actionTitle="操作" renderActions={(event) => <button className="table-action-button" onClick={() => navigate(`/events/${event.id}`)}><EyeOutlined />查看</button>} />}
        {tab === "工作" && <DenseTable rows={planWorks} columns={workColumns} onRowClick={(work) => focus(`work:${work.id}`, "works")} emptyText="此計劃暫無工作" stickyActions actionTitle="操作" renderActions={(work) => <button className="table-action-button" onClick={() => navigate(`/works/${work.id}`)}><EyeOutlined />查看</button>} />}
        {tab === "人員軌跡" && <><p className="plan-hint plan-tab-hint">示範軌跡按計劃路線推算；正式環境取自巡查群組人員的定位上報。</p><DenseTable rows={trackRows} columns={trackColumns} emptyText={plan.status === "未開始" ? "計劃尚未開始，暫無軌跡" : "暫無軌跡"} /></>}
        {tab === "作業記錄" && <div className="plan-timeline">{timeline.length ? <ActivityTimeline items={timeline} /> : <div className="empty-state"><strong>暫無作業記錄</strong></div>}</div>}
      </div>
    </section>

    {drawer === "edit" && <EditPlanDrawer plan={plan} onClose={() => setDrawer(null)} onSave={(patch, detail, operator) => { updatePlan(plan.id, { ...patch, changes: log("編輯計劃", detail, operator) }); setDrawer(null); showToast("計劃已更新"); }} />}
    {drawer === "add" && <BatchPickerDrawer title="增加巡查" noun="對象" filterLabel="網格" description="選擇對象及巡查模板，為未開始的計劃增加額外巡查。" confirmLabel="增加巡查"
      rows={[...allObjects].sort((a, b) => Number(b.grid === plan.grid) - Number(a.grid === plan.grid)).map((object) => ({ id: object.id, title: object.name, meta: `${object.id} · ${object.address}`, group: object.grid }))}
      footer={<div className="form-grid"><Field label="巡查模板" required><Select ariaLabel="額外巡查模板" value={extraTemplate} onChange={setExtraTemplate}>{inspectionTemplates.map((template) => <option key={template.id} value={template.id}>{template.name}</option>)}</Select></Field><IdentityField value={extraIdentity} onChange={setExtraIdentity} /></div>}
      onClose={() => setDrawer(null)} onConfirm={addExtra} />}
    {drawer === "supplement" && <SupplementInspectionDrawer plan={plan} rows={rows} onClose={() => setDrawer(null)} onSave={(entry, detail) => {
      const added = appendInspections([entry], usedIds, dateKey(plan.startAt), nextSeq, "補入", { status: "已完成", inspector: entry.inspector, submittedAt: entry.submittedAt, result: entry.result, reason: entry.reason, addedBy: signedInUser, addedAt: nowText() });
      updatePlan(plan.id, { inspections: [...(plan.inspections ?? []), ...added], total: rows.length + 1, progress: done + 1, changes: log("補入巡查", `${added[0].id}：${detail}`) });
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
function EditPlanDrawer({ plan, onClose, onSave }: { plan: Plan; onClose: () => void; onSave: (patch: Partial<Plan>, detail: string, operator: string) => void }) {
  const { authorize } = usePermissionRules();
  const [form, setForm] = useState({ name: plan.name, groupId: groupIdOf(plan), executor: plan.executor ?? "", startAt: toInput(plan.startAt), endAt: toInput(plan.endAt), note: plan.note ?? "" });
  const [identityId, setIdentityId] = useState(defaultIdentityId); const [errors, setErrors] = useState<string[]>([]);
  const change = (patch: Partial<typeof form>) => { setForm((current) => ({ ...current, ...patch })); setErrors([]); };
  const save = () => {
    const found = validatePlanForm({ ...form, templateId: plan.planTemplateId ?? plan.template });
    if (found.length) { setErrors(found); return; }
    const group = inspectionGroups.find((item) => item.id === form.groupId)!;
    const identity = policyUsers.find((user) => user.id === identityId) ?? policyUsers[0];
    const decision = authorize("create-plan", { request: planRequest(templateOfPlan(plan), form.groupId) }, identity);
    if (!decision.allowed) { setErrors([`權限校驗未通過：${decision.reason}`]); return; }
    const patch: Partial<Plan> = { name: form.name.trim(), group: group.name, groupId: group.id, executor: form.executor || undefined, startAt: fromInput(form.startAt), endAt: fromInput(form.endAt), note: form.note.trim() || undefined };
    const diffs = [patch.group !== plan.group && `巡查群組 ${plan.group} → ${patch.group}`, (patch.startAt !== plan.startAt || patch.endAt !== plan.endAt) && `時間 ${patch.startAt} – ${patch.endAt?.slice(11)}`, patch.executor !== plan.executor && `預設巡查人員 ${plan.executor ?? "未指定"} → ${patch.executor ?? "未指定"}`, patch.name !== plan.name && `名稱改為「${patch.name}」`].filter(Boolean);
    onSave(patch, diffs.length ? diffs.join("；") : "更新備註", identity.name);
  };
  return <FormDrawer open title="編輯計劃" subtitle={`${plan.id} · 只限未開始的計劃`} onClose={onClose} onSubmit={save} className="plan-drawer">
    <FormError errors={errors} />
    <div className="form-grid two-col">
      <Field label="計劃名稱" required><input value={form.name} maxLength={50} onChange={(event) => change({ name: event.target.value })} /></Field>
      <Field label="計劃模板"><input value={`${plan.template}（快照，不可更改）`} disabled /></Field>
      <Field label="開始時間" required><input type="datetime-local" value={form.startAt} onChange={(event) => change({ startAt: event.target.value })} /></Field>
      <Field label="結束時間" required><input type="datetime-local" value={form.endAt} onChange={(event) => change({ endAt: event.target.value })} /></Field>
      <Field label="巡查群組" required><GroupSelect value={form.groupId} onChange={(groupId) => change({ groupId, executor: "" })} /></Field>
      <Field label="預設巡查人員"><ExecutorSelect groupId={form.groupId} value={form.executor} onChange={(executor) => change({ executor })} /></Field>
      <Field label="備註"><textarea rows={3} value={form.note} onChange={(event) => change({ note: event.target.value })} /></Field>
      <IdentityField value={identityId} onChange={(value) => { setIdentityId(value); setErrors([]); }} />
    </div>
  </FormDrawer>;
}

function objectOptions(plan: Plan, rows: PlanInspectionRow[]) {
  const planIds = unique(rows.map((row) => row.objectId));
  return [...planIds.map((id) => objectOf(id)).filter((object) => !!object), ...allObjects.filter((object) => !planIds.includes(object.id) && object.grid === plan.grid)];
}

function SupplementInspectionDrawer({ plan, rows, onClose, onSave }: { plan: Plan; rows: PlanInspectionRow[]; onClose: () => void; onSave: (entry: { objectId: string; templateId: string; inspector: string; submittedAt: string; result: "正常" | "異常"; reason: string }, detail: string) => void }) {
  const options = objectOptions(plan, rows);
  const people = unique([...groupMembers(plan.group), ...(plan.executor ? [plan.executor] : [])]);
  const [form, setForm] = useState({ objectId: options[0]?.id ?? "", templateId: rows[0]?.templateId ?? inspectionTemplates[0]?.id ?? "", inspector: plan.executor ?? people[0] ?? "", submittedAt: toInput(plan.endAt), result: "正常" as "正常" | "異常", reason: "" });
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
      <Field label="巡查模板" required><Select ariaLabel="補入巡查模板" value={form.templateId} onChange={(templateId) => change({ templateId })}>{inspectionTemplates.map((template) => <option key={template.id} value={template.id}>{template.name}</option>)}</Select></Field>
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
