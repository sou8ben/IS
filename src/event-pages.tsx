import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeftOutlined, CheckOutlined, EditOutlined, EnvironmentOutlined, ExportOutlined, EyeOutlined, InfoCircleOutlined, LinkOutlined, PlusOutlined, ReloadOutlined, UnorderedListOutlined, WarningFilled } from "@ant-design/icons";
import { execGroups } from "./app/data";
import { gridNames } from "./grid-data";
import { AttachmentField } from "./attachments";
import { ActivityTimeline, BatchPickerDrawer, Button, ConfirmDialog, DenseTable, Field, FormDrawer, PageHeader, Pagination, Select, StatusTag, useToast } from "./components";
import { defsOfEvent, dispatchWork, eventToWorkType, eventTypeGroups, fieldsOfType, gridOf, latLng, leafEventTypes, resolveEvent, reverseGeocode, workTypeOptions, worksOfEvent } from "./event-data";
import { diffEvent, followPrompts, followStatuses, shouldConfirmTypeChange, validateEvent, type EventChange, type EventDraft, type EventIssue, type FollowStatus } from "./event-rules";
import { attachmentChars, type AttachmentRef } from "./inspection-rules";
import { positionOfWork, snapshotOf } from "./plan-data";
import { LegendItem, PlanMap, type MapLayerChip, type MapMarkerSpec } from "./plan-map";
import { nextIds } from "./plan-rules";
import { policyUsers } from "./permission-rules";
import { useDemo } from "./store";
import type { Column, EventRecord, Plan, Work } from "./types";

const signedInUser = policyUsers[0].name;
const pad = (n: number) => String(n).padStart(2, "0");
const fmt = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
const nowText = () => fmt(new Date());
const dateKey = (text: string) => text.slice(0, 10).replace(/-/g, "");
const toInput = (text?: string) => (text ?? "").replace(" ", "T");
const fromInput = (text: string) => text.replace("T", " ");
const contains = (value: string, query: string) => !query.trim() || value.toLowerCase().includes(query.trim().toLowerCase());
const tomorrowInput = () => toInput(fmt(new Date(Date.now() + 24 * 3600 * 1000)));

// ---- 表單 ----
interface EventFormState {
  type: string; description: string; status: FollowStatus; followAt: string; x?: number; y?: number; address: string; addressTouched: boolean;
  custom: Record<string, string>; planId: string; attachments: AttachmentRef[];
}
const emptyForm = (): EventFormState => ({ type: "", description: "", status: "無需跟進", followAt: "", address: "", addressTouched: false, custom: {}, planId: "", attachments: [] });
const formOf = (event: EventRecord): EventFormState => { const e = resolveEvent(event); return { type: e.type, description: e.description, status: e.status, followAt: toInput(e.followAt), x: e.x, y: e.y, address: e.address, addressTouched: true, custom: { ...(e.custom ?? {}) }, planId: e.planId ?? "", attachments: e.attachments ?? [] }; };
const toDraft = (form: EventFormState): EventDraft => ({ type: form.type, description: form.description, address: form.address, x: form.x, y: form.y, status: form.status, followAt: form.followAt ? fromInput(form.followAt) : undefined, custom: form.custom, planId: form.planId || undefined, attachmentCount: form.attachments.length });
const sectionOf = (key: string) => key === "location" || key === "address" ? "evt-sec-location" : key.startsWith("custom-") ? "evt-sec-custom" : "evt-sec-basic";

function IssueSummary({ issues }: { issues: EventIssue[] }) {
  if (!issues.length) return null;
  return <div className="evt-error" role="alert"><strong>請修正以下 {issues.length} 項</strong><ol>{issues.map((issue, index) => <li key={index}><button type="button" onClick={() => document.getElementById(sectionOf(issue.key))?.scrollIntoView({ behavior: "smooth", block: "start" })}>{issue.message}</button></li>)}</ol></div>;
}

function EventForm({ form, issues, plans, legacyType, onChange }: { form: EventFormState; issues: EventIssue[]; plans: Plan[]; legacyType?: string; onChange: (patch: Partial<EventFormState>) => void }) {
  const [pendingType, setPendingType] = useState<string | null>(null);
  const defs = fieldsOfType(form.type);
  const error = (key: string) => issues.find((issue) => issue.key === key)?.message;
  const applyType = (type: string) => onChange({ type, custom: {} });
  const changeType = (type: string) => { if (shouldConfirmTypeChange(form.custom, form.type, type)) setPendingType(type); else onChange({ type }); };
  const pick = ([x, y]: [number, number]) => { const found = reverseGeocode(x, y); onChange({ x, y, ...(form.addressTouched ? {} : { address: found.address }) }); };
  const marker: MapMarkerSpec[] = form.x !== undefined && form.y !== undefined ? [{ id: "pick", kind: "event", x: form.x, y: form.y, tone: "event", label: "事", title: form.address || "事件位置" }] : [];
  return <div className="evt-form">
    <section className="group-editor-section" id="evt-sec-basic"><header><h3>基本資料</h3></header><div className="group-editor-grid">
      <Field label="事件類型" required hint="只可選末級類型；專屬欄位按類型顯示">
        <Select ariaLabel="事件類型" value={form.type} onChange={changeType}><option value="">請選擇事件類型</option>{eventTypeGroups.map((group) => <optgroup key={group.label} label={group.label}>{group.leaves.map((leaf) => <option key={leaf} value={leaf}>{leaf.split("／").slice(-1)[0]}</option>)}</optgroup>)}{legacyType && !leafEventTypes.includes(legacyType) && <option value={legacyType}>{legacyType}（舊類型）</option>}</Select>
        {error("type") && <small className="evt-field-error">{error("type")}</small>}</Field>
      <Field label="跟進狀態" required hint="由人手登記，系統不會自動更改"><Select ariaLabel="跟進狀態" value={form.status} onChange={(status) => onChange({ status: status as FollowStatus })}>{followStatuses.map((status) => <option key={status}>{status}</option>)}</Select></Field>
      <Field label="預計跟進時間" required={form.status === "跟進中"} hint={form.status === "跟進中" ? "跟進中時必填，新事件不可早於建立時間" : "選填"}>
        <input type="datetime-local" value={form.followAt} onChange={(event) => onChange({ followAt: event.target.value })} />{error("followAt") && <small className="evt-field-error">{error("followAt")}</small>}</Field>
      <Field label="所屬計劃" hint="不選即為獨立事件"><Select ariaLabel="所屬計劃" value={form.planId} onChange={(planId) => onChange({ planId })}><option value="">獨立事件（不屬任何計劃）</option>{plans.map((plan) => <option key={plan.id} value={plan.id}>{plan.name}（{plan.id}）</option>)}</Select></Field>
      <Field label="描述" required><textarea rows={4} value={form.description} onChange={(event) => onChange({ description: event.target.value })} placeholder="1–1,000 字，說明現場情況" />
        <small className={[...form.description].length > 1000 ? "evt-field-error" : "evt-counter"}>{[...form.description].length} / 1000</small>{error("description") && <small className="evt-field-error">{error("description")}</small>}</Field>
    </div></section>
    <section className="group-editor-section" id="evt-sec-location"><header><h3>位置</h3></header><div className="evt-location">
      <div className="evt-pick"><PlanMap className="evt-pick-map" markers={marker} onPick={pick} fitKey={form.x === undefined ? "none" : "has"} legend={<LegendItem tone="event">事件位置</LegendItem>} /></div>
      <div className="evt-pick-note"><EnvironmentOutlined />{form.x === undefined ? "請點擊地圖選取事件位置（可先放大）。" : "點擊地圖可重新選點。"}{error("location") && <em className="evt-field-error">{error("location")}</em>}</div>
      <div className="group-editor-grid">
        <Field label="地址" required hint="按選點自動帶入，可手動修改"><input value={form.address} onChange={(event) => onChange({ address: event.target.value, addressTouched: true })} placeholder="請輸入地址" />{error("address") && <small className="evt-field-error">{error("address")}</small>}</Field>
        <Field label="經緯度"><input value={form.x === undefined || form.y === undefined ? "" : latLng(form.x, form.y)} readOnly disabled placeholder="選點後自動計算" /></Field>
        <Field label="網格" hint="按位置自動歸屬"><input value={form.x === undefined || form.y === undefined ? "" : gridOf(form.x, form.y)} readOnly disabled placeholder="選點後自動計算" /></Field>
      </div></div></section>
    <section className="group-editor-section" id="evt-sec-custom"><header><h3>專屬欄位</h3></header>{defs.length ? <div className="group-editor-grid">{defs.map((def) => def.kind === "TEXT"
      ? <Field key={def.name} label={def.name} required={def.required}><input value={form.custom[def.name] ?? ""} onChange={(event) => onChange({ custom: { ...form.custom, [def.name]: event.target.value } })} placeholder="請輸入" />{error(`custom-${def.name}`) && <small className="evt-field-error">{error(`custom-${def.name}`)}</small>}</Field>
      : <div className="field" key={def.name}><span>{def.required && <b>*</b>}{def.name}</span><div className="insp-choices" role="radiogroup" aria-label={def.name}>{(def.options ?? []).map((option) => <button type="button" key={option} role="radio" aria-checked={form.custom[def.name] === option} className={form.custom[def.name] === option ? "on" : ""} onClick={() => onChange({ custom: { ...form.custom, [def.name]: option } })}>{option}</button>)}</div>{error(`custom-${def.name}`) && <small className="evt-field-error">{error(`custom-${def.name}`)}</small>}</div>)}</div> : <div className="evt-empty">{form.type ? "此事件類型沒有專屬欄位" : "選擇事件類型後顯示專屬欄位"}</div>}</section>
    <section className="group-editor-section"><header><h3>附件</h3></header><div className="evt-attach"><AttachmentField files={form.attachments} min={0} usedChars={attachmentChars({ a: { attachments: form.attachments } })} onChange={(attachments) => onChange({ attachments })} /></div></section>
    <ConfirmDialog open={pendingType !== null} title="更換事件類型？" message="專屬欄位內容將清空。" confirmLabel="確認更換" onCancel={() => setPendingType(null)} onConfirm={() => { applyType(pendingType ?? ""); setPendingType(null); }} />
  </div>;
}

// ---- 列表 ----
const emptyFilters = { keyword: "", type: "", status: "", grid: "", plan: "", work: "", from: "", to: "" };

export function EventListPage() {
  const navigate = useNavigate(); const { events, plans, works } = useDemo(); const [view, setView] = useState<"list" | "map">("list");
  const [filters, setFilters] = useState(emptyFilters); const [page, setPage] = useState(1); const [pageSize, setPageSize] = useState(15); const [selected, setSelected] = useState<string | null>(null);
  const filter = (key: keyof typeof emptyFilters, value: string) => { setFilters((current) => ({ ...current, [key]: value })); setPage(1); };
  const resolved = events.filter((event) => !event.pendingSync).map(resolveEvent);
  const workCount = (event: EventRecord) => worksOfEvent(works, event).length;
  const rows = resolved.filter((event) => (contains(`${event.id}${event.description}${event.address}`, filters.keyword)) && (!filters.type || event.type === filters.type) && (!filters.status || event.status === filters.status)
    && (!filters.grid || event.grid === filters.grid) && (!filters.plan || event.planId === filters.plan) && (!filters.work || (filters.work === "有" ? workCount(event) > 0 : workCount(event) === 0))
    && (!filters.from || event.createdAt.slice(0, 10) >= filters.from) && (!filters.to || event.createdAt.slice(0, 10) <= filters.to));
  const planName = (id?: string) => plans.find((plan) => plan.id === id)?.name ?? id ?? "—";
  const columns: Column<EventRecord>[] = ([
    { key: "id", title: "事件編號", width: 160 },
    { key: "description", title: "事件描述", width: 240 },
    { key: "type", title: "事件類型", width: 170 },
    { key: "status", title: "跟進狀態", width: 100, render: (event) => <StatusTag>{event.status}</StatusTag> },
    { key: "grid", title: "網格", width: 120 },
    { key: "address", title: "地址", width: 220 },
    { key: "planId", title: "所屬計劃", width: 190, render: (event) => planName(event.planId), sortValue: (event) => planName(event.planId) },
    { key: "followAt", title: "預計跟進時間", width: 150, render: (event) => event.followAt ?? "—", sortValue: (event) => event.followAt ?? "" },
    { key: "works", title: "關聯工作", width: 90, render: (event) => workCount(event) || "—", sortValue: workCount },
    { key: "attachments", title: "附件數", width: 80, render: (event) => event.attachments?.length || "—", sortValue: (event) => event.attachments?.length ?? 0 },
    { key: "creator", title: "建立人", width: 100, render: (event) => event.creator ?? "—", sortValue: (event) => event.creator ?? "" },
    { key: "createdAt", title: "建立時間", width: 150 },
  ] satisfies Column<EventRecord>[]).map((column) => ({ ...column, sortable: true }));
  const markers: MapMarkerSpec[] = rows.flatMap((event) => event.x !== undefined && event.y !== undefined ? [{ id: event.id, kind: "event" as const, x: event.x, y: event.y, tone: "event" as const, label: "事", title: event.description, detail: <span>{event.id} · {event.type}<br />{event.status} · {event.address}<br /><Link to={`/events/${event.id}`}>查看事件</Link></span> }] : []);
  return <div className="page-content evt-page">
    <PageHeader title="事件記錄" actions={<><Button icon={view === "list" ? <EnvironmentOutlined /> : <UnorderedListOutlined />} onClick={() => setView(view === "list" ? "map" : "list")}>{view === "list" ? "地圖視圖" : "列表視圖"}</Button><Button icon={<ExportOutlined />}>匯出</Button><Button variant="primary" icon={<PlusOutlined />} onClick={() => navigate("/events/new")}>新增事件</Button></>} />
    <section className="panel list-panel evt-list-panel">
      <div className="filter-bar evt-filter-bar">
        <label className="filter-field"><span>關鍵字</span><input aria-label="關鍵字" value={filters.keyword} onChange={(event) => filter("keyword", event.target.value)} placeholder="編號、描述或地址" /></label>
        <label className="filter-field"><span>事件類型</span><Select ariaLabel="事件類型" value={filters.type} onChange={(value) => filter("type", value)}><option value="">全部事件類型</option>{eventTypeGroups.map((group) => <optgroup key={group.label} label={group.label}>{group.leaves.map((leaf) => <option key={leaf} value={leaf}>{leaf}</option>)}</optgroup>)}</Select></label>
        <label className="filter-field"><span>跟進狀態</span><Select ariaLabel="跟進狀態" value={filters.status} onChange={(value) => filter("status", value)}><option value="">全部狀態</option>{followStatuses.map((status) => <option key={status}>{status}</option>)}</Select></label>
        <label className="filter-field"><span>網格</span><Select ariaLabel="網格" value={filters.grid} onChange={(value) => filter("grid", value)}><option value="">全部網格</option>{[...gridNames(), "未歸屬"].map((name) => <option key={name}>{name}</option>)}</Select></label>
        <label className="filter-field"><span>所屬計劃</span><Select ariaLabel="所屬計劃" value={filters.plan} onChange={(value) => filter("plan", value)}><option value="">全部</option>{plans.map((plan) => <option key={plan.id} value={plan.id}>{plan.name}</option>)}</Select></label>
        <label className="filter-field"><span>關聯工作</span><Select ariaLabel="關聯工作" value={filters.work} onChange={(value) => filter("work", value)}><option value="">全部</option><option>有</option><option>無</option></Select></label>
        <label className="filter-field"><span>建立日期（由）</span><input aria-label="建立日期由" type="date" value={filters.from} onChange={(event) => filter("from", event.target.value)} /></label>
        <label className="filter-field"><span>建立日期（至）</span><input aria-label="建立日期至" type="date" value={filters.to} onChange={(event) => filter("to", event.target.value)} /></label>
        <div className="user-filter-actions"><Button variant="text" icon={<ReloadOutlined />} onClick={() => { setFilters(emptyFilters); setPage(1); }}>重設</Button></div>
      </div>
      {view === "list" ? <>
        <DenseTable rows={rows} columns={columns} stickyActions actionTitle="操作" page={Math.min(page, Math.max(1, Math.ceil(rows.length / pageSize)))} pageSize={pageSize} onSort={() => setPage(1)} emptyText="沒有符合條件的事件" renderActions={(event) => <button className="table-action-button" aria-label={`查看 ${event.id}`} onClick={() => navigate(`/events/${event.id}`)}><EyeOutlined />查看</button>} />
        <Pagination total={rows.length} page={page} pageSize={pageSize} onPageChange={setPage} onPageSizeChange={(size) => { setPageSize(size); setPage(1); }} />
      </> : <div className="evt-map-wrap"><PlanMap markers={markers} selected={selected} onSelect={setSelected} fitKey={`${rows.length}-${filters.status}-${filters.type}`} legend={<LegendItem tone="event">事件（{markers.length} 宗）</LegendItem>} /></div>}
    </section>
  </div>;
}

// ---- 新增 ----
export function EventCreatePage() {
  const navigate = useNavigate(); const { showToast } = useToast(); const { events, plans, addEvent, updatePlan } = useDemo();
  const [form, setForm] = useState<EventFormState>(emptyForm); const [issues, setIssues] = useState<EventIssue[]>([]);
  const change = (patch: Partial<EventFormState>) => { setForm((current) => ({ ...current, ...patch })); setIssues([]); };
  const save = () => {
    const defs = fieldsOfType(form.type); const time = nowText();
    const found = validateEvent(toDraft(form), defs, leafEventTypes, time, true);
    if (found.length) { setIssues(found); showToast(`請修正 ${found.length} 項問題`, "error"); window.scrollTo?.({ top: 0 }); return; }
    const id = nextIds("EV", events.map((event) => event.id), dateKey(time), 1)[0];
    const custom = Object.fromEntries(defs.filter((def) => form.custom[def.name]).map((def) => [def.name, form.custom[def.name]]));
    addEvent({ id, type: form.type, description: form.description.trim(), status: form.status, grid: gridOf(form.x!, form.y!), address: form.address.trim(), createdAt: time, planId: form.planId || undefined, workIds: [], followAt: form.followAt ? fromInput(form.followAt) : undefined, custom, creator: signedInUser, x: form.x, y: form.y, attachments: form.attachments, fieldSnapshot: { type: form.type, defs }, source: form.planId ? "計劃" : "後台", changes: [{ time, operator: signedInUser, action: "登記事件", detail: `${form.type}；跟進狀態：${form.status}${form.planId ? `；關聯計劃 ${form.planId}` : "；獨立事件"}` }] });
    const plan = plans.find((item) => item.id === form.planId);
    if (plan) updatePlan(plan.id, { changes: [...(plan.changes ?? []), { time, operator: signedInUser, action: "關聯事件", detail: `新增事件 ${id}` }] });
    showToast("事件已登記"); navigate(`/events/${id}`);
  };
  return <div className="page-content evt-create-page">
    <PageHeader eyebrow="事件記錄 / 新增事件" title="新增事件" actions={<><Button onClick={() => navigate("/events")}>取消</Button><Button variant="primary" icon={<CheckOutlined />} onClick={save}>保存事件</Button></>} />
    <IssueSummary issues={issues} />
    <EventForm form={form} issues={issues} plans={plans} onChange={change} />
  </div>;
}

// ---- 詳情 ----
type DetailTab = "基本資料" | "關聯工作" | "變更記錄";
type DrawerKind = "edit" | "work" | "link" | null;

export function EventDetailPage() {
  const { id = "" } = useParams(); const navigate = useNavigate(); const { events } = useDemo();
  const event = events.find((item) => item.id === id);
  if (!event) return <div className="page-content center-state"><WarningFilled /><h1>找不到事件</h1><p>事件「{id}」不存在。</p><Button onClick={() => navigate("/events")}>返回列表</Button></div>;
  return <EventDetail key={event.id} event={resolveEvent(event)} />;
}

function EventDetail({ event }: { event: EventRecord }) {
  const navigate = useNavigate(); const { showToast } = useToast(); const { plans, works, updateEvent, updateWork, addWork } = useDemo();
  const plan = plans.find((item) => item.id === event.planId);
  const [tab, setTab] = useState<DetailTab>("基本資料"); const [drawer, setDrawer] = useState<DrawerKind>(null); const [selected, setSelected] = useState<string | null>(null);
  const [layers, setLayers] = useState({ event: true, works: true, route: true });
  const linked = worksOfEvent(works, event); const prompts = followPrompts(event, linked); const defs = defsOfEvent(event);
  const log = (action: string, detail: string): EventChange[] => [...(event.changes ?? []), { time: nowText(), operator: signedInUser, action, detail }];
  const point: [number, number] | undefined = event.x !== undefined && event.y !== undefined ? [event.x, event.y] : undefined;
  const markers: MapMarkerSpec[] = [];
  if (layers.event && point) markers.push({ id: "event", kind: "event", x: point[0], y: point[1], tone: "event", label: "事", title: event.description, detail: <span>{event.id} · {event.type}<br />{event.status}<br />{event.address}</span> });
  if (layers.works) linked.forEach((work) => { const position = positionOfWork(work) ?? point; if (position) markers.push({ id: `work:${work.id}`, kind: "work", x: position[0], y: position[1], tone: "work", label: "工", title: work.title, detail: <span>{work.id} · {work.status}<br /><Link to={`/works/${work.id}`}>查看工作</Link></span> }); });
  const chips: MapLayerChip[] = [{ key: "event", label: "事件", on: layers.event }, { key: "works", label: "關聯工作", count: linked.length, on: layers.works }, ...(plan ? [{ key: "route", label: "計劃路線", on: layers.route }] : [])];
  const workColumns: Column<Work>[] = [
    { key: "id", title: "工作編號", width: 160 }, { key: "title", title: "工作摘要", width: 240 }, { key: "type", title: "工作類型", width: 160 },
    { key: "status", title: "狀態", width: 90, render: (work) => <StatusTag>{work.status}</StatusTag> }, { key: "group", title: "執行群組", width: 140 }, { key: "createdAt", title: "建立時間", width: 150 },
  ];
  const timeline = [...(event.changes ?? [])].sort((a, b) => b.time.localeCompare(a.time)).map((change) => ({ title: change.action, time: change.time, text: `${change.operator}：${change.detail}`, tone: "neutral" as const }));
  const markDone = () => { updateEvent(event.id, { status: "已完成", changes: log("更改跟進狀態", `${event.status} → 已完成（關聯工作已全部關閉）`) }); showToast("跟進狀態已改為已完成"); };
  const saveEdit = (patch: Partial<EventRecord>, lines: string[]) => { updateEvent(event.id, { ...patch, changes: log("編輯事件", lines.join("；") || "更新資料") }); setDrawer(null); showToast("事件已更新"); };
  const createWork = (input: { title: string; type: string; priority: Work["priority"]; group: string; address: string; description: string }, follow?: string) => {
    const time = nowText(); const workId = nextIds("WK", works.map((work) => work.id), dateKey(time), 1)[0];
    addWork({ ...input, id: workId, source: "事件", status: "新建", grid: event.grid, sla: "正常", createdAt: time, updatedAt: time, eventId: event.id, planId: event.planId, creator: signedInUser, x: event.x, y: event.y });
    const patch: Partial<EventRecord> = { workIds: [...event.workIds, workId], changes: log("新增工作", `${workId}（${input.group}）${follow ? "；跟進狀態改為跟進中" : ""}`) };
    if (follow) { patch.status = "跟進中"; patch.followAt = fromInput(follow); }
    updateEvent(event.id, patch); setDrawer(null); showToast(`已新增工作 ${workId}，並與事件雙向關聯`);
  };
  const linkWorks = (ids: string[]) => {
    ids.forEach((workId) => updateWork(workId, { eventId: event.id }));
    updateEvent(event.id, { workIds: [...new Set([...event.workIds, ...ids])], changes: log("關聯工作", ids.join("、")) });
    setDrawer(null); showToast(`已關聯 ${ids.length} 宗工作`);
  };
  return <div className="page-content detail-page evt-detail-page">
    <PageHeader eyebrow="事件記錄 / 事件詳情" title={event.description} actions={<><Button icon={<ArrowLeftOutlined />} onClick={() => navigate("/events")}>返回列表</Button><Button icon={<EditOutlined />} onClick={() => setDrawer("edit")}>編輯</Button><Button icon={<LinkOutlined />} onClick={() => setDrawer("link")}>關聯工作</Button><Button variant="primary" icon={<PlusOutlined />} onClick={() => setDrawer("work")}>建立工作</Button></>} />
    {prompts.suggestDone && <div className="plan-snapshot-note evt-prompt"><InfoCircleOutlined /><span>此事件的 {linked.length} 宗關聯工作已全部關閉，可將跟進狀態改為「已完成」。系統不會自動更改。</span><Button onClick={markDone}>改為已完成</Button></div>}
    <div className="status-strip evt-status-strip">
      <div><span>事件編號</span><strong>{event.id}</strong></div><div><span>跟進狀態</span><StatusTag>{event.status}</StatusTag></div><div><span>事件類型</span><strong>{event.type}</strong></div>
      <div><span>預計跟進時間</span><strong>{event.followAt ?? "—"}</strong></div><div><span>所屬計劃</span>{plan ? <Link to={`/plans/${plan.id}`}>{plan.name}</Link> : <strong>獨立事件</strong>}</div>
      <div><span>網格</span><strong>{event.grid}</strong></div><div><span>建立人</span><strong>{event.creator ?? "—"}</strong></div>
    </div>
    <section className="panel plan-map-panel evt-map-panel"><PlanMap route={layers.route && plan ? snapshotOf(plan)?.route : undefined} markers={markers} layers={chips} onToggleLayer={(key) => setLayers((current) => ({ ...current, [key]: !current[key as keyof typeof current] }))} selected={selected} onSelect={setSelected} fitKey={event.id}
      legend={<><LegendItem tone="event">事件</LegendItem><LegendItem tone="work">關聯工作</LegendItem>{plan && <LegendItem tone="route">計劃路線</LegendItem>}</>} /></section>
    <section className="panel tab-panel evt-tab-panel"><nav>{(["基本資料", "關聯工作", "變更記錄"] as DetailTab[]).map((name) => <button key={name} className={tab === name ? "active" : ""} onClick={() => setTab(name)}>{name}<span>{name === "關聯工作" ? linked.length : name === "變更記錄" ? timeline.length : (event.attachments?.length ?? 0)}</span></button>)}</nav>
      <div className="evt-tab-body">
        {tab === "基本資料" && <div className="evt-info">
          <dl className="description-grid">
            <div><dt>事件類型</dt><dd>{event.type}</dd></div><div><dt>跟進狀態</dt><dd>{event.status}</dd></div>
            <div className="wide"><dt>描述</dt><dd>{event.description}</dd></div><div className="wide"><dt>地址</dt><dd>{event.address}</dd></div>
            <div><dt>經緯度</dt><dd>{point ? latLng(point[0], point[1]) : "—"}</dd></div><div><dt>網格</dt><dd>{event.grid}</dd></div>
            <div><dt>建立時間</dt><dd>{event.createdAt}</dd></div><div><dt>預計跟進時間</dt><dd>{event.followAt ?? "—"}</dd></div>
          </dl>
          <h4>專屬欄位</h4>{defs.length || Object.keys(event.custom ?? {}).length ? <dl className="description-grid">{defs.map((def) => <div key={def.name}><dt>{def.required && "＊"}{def.name}</dt><dd>{event.custom?.[def.name] || "—"}</dd></div>)}{Object.entries(event.custom ?? {}).filter(([name]) => !defs.some((def) => def.name === name)).map(([name, value]) => <div key={name}><dt>{name}</dt><dd>{value}</dd></div>)}</dl> : <p className="evt-empty">此事件類型沒有專屬欄位</p>}
          <h4>附件</h4>{event.attachments?.length ? <AttachmentField files={event.attachments} min={0} usedChars={0} onChange={() => undefined} disabled /> : <p className="evt-empty">沒有附件</p>}
        </div>}
        {tab === "關聯工作" && <DenseTable rows={linked} columns={workColumns} emptyText="此事件暫無關聯工作" stickyActions actionTitle="操作" renderActions={(work) => <button className="table-action-button" onClick={() => navigate(`/works/${work.id}`)}><EyeOutlined />查看</button>} />}
        {tab === "變更記錄" && <div className="plan-timeline">{timeline.length ? <ActivityTimeline items={timeline} /> : <div className="empty-state"><strong>暫無變更記錄</strong></div>}</div>}
      </div>
    </section>
    {drawer === "edit" && <EditEventDrawer event={event} plans={plans} onClose={() => setDrawer(null)} onSave={saveEdit} />}
    {drawer === "work" && <WorkDrawer event={event} onClose={() => setDrawer(null)} onSave={createWork} />}
    {drawer === "link" && <BatchPickerDrawer title="關聯現有工作" noun="工作" filterLabel="網格" description="只列出尚未關聯事件的工作。" confirmLabel="批量關聯"
      rows={works.filter((work) => !work.pendingSync && !work.voided && !work.eventId && !event.workIds.includes(work.id)).map((work) => ({ id: work.id, title: work.title, meta: `${work.id} · ${work.type} · ${work.status}`, group: work.grid }))} onClose={() => setDrawer(null)} onConfirm={linkWorks} />}
  </div>;
}

function EditEventDrawer({ event, plans, onClose, onSave }: { event: EventRecord; plans: Plan[]; onClose: () => void; onSave: (patch: Partial<EventRecord>, lines: string[]) => void }) {
  const [form, setForm] = useState<EventFormState>(() => formOf(event)); const [issues, setIssues] = useState<EventIssue[]>([]);
  const change = (patch: Partial<EventFormState>) => { setForm((current) => ({ ...current, ...patch })); setIssues([]); };
  const save = () => {
    const defs = fieldsOfType(form.type); const before = toDraft(formOf(event)); const after = toDraft(form);
    const found = validateEvent(after, defs, [...leafEventTypes, event.type], nowText(), false);
    if (found.length) { setIssues(found); return; }
    const custom = Object.fromEntries(defs.filter((def) => form.custom[def.name]).map((def) => [def.name, form.custom[def.name]]));
    const typeChanged = form.type !== event.type;
    onSave({ type: form.type, description: form.description.trim(), status: form.status, followAt: after.followAt, address: form.address.trim(), x: form.x, y: form.y, grid: gridOf(form.x!, form.y!), planId: form.planId || undefined, custom, attachments: form.attachments, ...(typeChanged ? { fieldSnapshot: { type: form.type, defs } } : {}) }, diffEvent(before, after));
  };
  return <FormDrawer open title="編輯事件" subtitle={event.id} onClose={onClose} onSubmit={save} className="evt-drawer">
    <div className="evt-drawer-body"><IssueSummary issues={issues} /><EventForm form={form} issues={issues} plans={plans} legacyType={event.type} onChange={change} /></div>
  </FormDrawer>;
}

function WorkDrawer({ event, onClose, onSave }: { event: EventRecord; onClose: () => void; onSave: (input: { title: string; type: string; priority: Work["priority"]; group: string; address: string; description: string }, follow?: string) => void }) {
  const mapped = eventToWorkType[event.type] ?? "";
  const [form, setForm] = useState({ title: event.description.slice(0, 50), type: mapped, priority: "一般" as Work["priority"], group: "", address: event.address, description: `${event.description}（來自事件 ${event.id}）` });
  const [groupTouched, setGroupTouched] = useState(false); const [follow, setFollow] = useState(event.status === "無需跟進"); const [followAt, setFollowAt] = useState(tomorrowInput()); const [error, setError] = useState("");
  const suggestion = form.type ? dispatchWork(form.type, event.grid) : undefined;
  const group = groupTouched || !suggestion ? form.group : suggestion.group;
  const options = form.type && !workTypeOptions.includes(form.type) ? [form.type, ...workTypeOptions] : workTypeOptions;
  const change = (patch: Partial<typeof form>) => { setForm((current) => ({ ...current, ...patch })); setError(""); };
  const save = () => {
    if (!form.title.trim() || !form.type || !form.address.trim() || !group) { setError("請填寫工作摘要、工作類型、地址及執行群組。"); return; }
    if (follow && (!followAt || fromInput(followAt) < nowText())) { setError("改為跟進中時，預計跟進時間必填且不可早於現在。"); return; }
    onSave({ ...form, group, title: form.title.trim(), address: form.address.trim(), description: form.description.trim() || form.title.trim() }, follow ? followAt : undefined);
  };
  return <FormDrawer open title="建立工作" subtitle={`${event.id} · 將與此事件雙向關聯`} onClose={onClose} onSubmit={save} submitLabel="建立工作" className="evt-drawer">
    <div className="evt-drawer-body">{error && <div className="evt-error" role="alert">{error}</div>}
      <div className="form-grid two-col">
        <Field label="工作摘要" required><input value={form.title} maxLength={50} onChange={(e) => change({ title: e.target.value })} /></Field>
        <Field label="工作類型" required hint={mapped ? "已按事件類型預填" : "此事件類型未配置對應工作類型，請選擇"}><Select ariaLabel="工作類型" value={form.type} onChange={(type) => change({ type })}><option value="">請選擇工作類型</option>{options.map((type) => <option key={type}>{type}</option>)}</Select></Field>
        <Field label="優先級" required><Select ariaLabel="優先級" value={form.priority} onChange={(priority) => change({ priority: priority as Work["priority"] })}><option>一般</option><option>緊急</option><option>特急</option></Select></Field>
        <Field label="跟進群組" required hint={suggestion && !groupTouched ? `自動分派：${suggestion.reason}` : "可手動指定"}><Select ariaLabel="跟進群組" value={group} onChange={(value) => { setGroupTouched(true); change({ group: value }); }}><option value="">請選擇跟進群組</option>{[...new Set([...execGroups, "待人工分派", group].filter(Boolean))].map((name) => <option key={name}>{name}</option>)}</Select></Field>
        <Field label="地址" required><input value={form.address} onChange={(e) => change({ address: e.target.value })} /></Field>
        <Field label="描述"><textarea rows={4} value={form.description} onChange={(e) => change({ description: e.target.value })} /></Field>
      </div>
      {event.status === "無需跟進" && <div className="evt-follow-prompt"><label><input type="checkbox" checked={follow} onChange={(e) => setFollow(e.target.checked)} />此事件目前為「無需跟進」，建議同時改為「跟進中」</label>{follow && <Field label="預計跟進時間" required><input type="datetime-local" value={followAt} onChange={(e) => setFollowAt(e.target.value)} /></Field>}</div>}
    </div>
  </FormDrawer>;
}
