import { useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeftOutlined, CheckOutlined, ExportOutlined, EyeOutlined, FileOutlined, FileSearchOutlined, InfoCircleOutlined, LinkOutlined, PlusOutlined, ReloadOutlined, SaveOutlined, StopOutlined, WarningFilled } from "@ant-design/icons";
import { directory, execGroups } from "./app/data";
import { ActivityTimeline, BatchPickerDrawer, Button, ConfirmDialog, DenseTable, Field, FormDrawer, PageHeader, Pagination, Select, StatusTag, useToast } from "./components";
import { AttachmentField } from "./attachments";
import { auxEntriesFor, historyFromRecords } from "./aux-data";
import type { AuxEntry } from "./item-rules";
import { storedFor, templatesForObject, templateSnapshotOf, useInspections, workInspectionOf, worksOfInspection } from "./inspection-data";
import {
  approachTrack, attachmentChars, emptyResult, isAbnormal, isFilled, itemIssues, itemState, kindLabels, resultOf, saveDraft, setVoided, submitRecord, supplementRecord,
  type AttachmentRef, type InspectionRecord, type ItemResultData, type ItemSnapshot, type ResultIssue, type ResultMap,
} from "./inspection-rules";
import { inspectionPolicyObject, policyUsers } from "./permission-rules";
import { usePermissionRules } from "./permission-store";
import { getAllObjects, inspectionTemplateName, liveAppTemplates, objectOf, positionOfWork, snapshotOf, useAppPlanState } from "./plan-data";
import { LegendItem, PlanMap, type MapLayerChip, type MapMarkerSpec } from "./plan-map";
import { nextIds } from "./plan-rules";
import { useDemo } from "./store";
import type { Column, Work } from "./types";

const signedInUser = policyUsers[0].name;
const defaultIdentityId = policyUsers.find((user) => user.id === "USR-006")?.id ?? policyUsers[0].id;
const pad = (n: number) => String(n).padStart(2, "0");
const nowText = () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`; };
const dateKey = (text: string) => text.slice(0, 10).replace(/-/g, "");
const contains = (value: string, query: string) => !query.trim() || value.toLowerCase().includes(query.trim().toLowerCase());
const unique = <T,>(values: T[]) => [...new Set(values)];
const objectName = (id: string) => objectOf(id)?.name ?? id;
const resultTone = (result: string) => result === "異常" ? "danger" as const : result === "正常" ? "success" as const : "neutral" as const;
const workTypes = ["公共設施／座椅", "公共設施／照明", "環境衛生／收集設施", "綠化／樹木", "道路設施／路面"];
const valueText = (item: ItemSnapshot, result?: ItemResultData) => item.kind === "SIGNATURE" ? (result?.signature ? `已簽名：${result.signature}` : "—") : Array.isArray(result?.value) ? (result!.value as string[]).join("、") || "—" : (result?.value as string | undefined) || "—";

// ---- 輸入 ----
function ValueInput({ item, result, disabled, onChange }: { item: ItemSnapshot; result: ItemResultData; disabled?: boolean; onChange: (patch: Partial<ItemResultData>) => void }) {
  if (item.kind === "TEXT") {
    const text = typeof result.value === "string" ? result.value : "";
    return <div><textarea rows={3} disabled={disabled} value={text} onChange={(event) => onChange({ value: event.target.value })} placeholder="請輸入內容" />{item.maxLength && <small className={[...text].length > item.maxLength ? "insp-over" : ""}>{[...text].length} / {item.maxLength}</small>}</div>;
  }
  if (item.kind === "SIGNATURE") return <input disabled={disabled} value={result.signature ?? ""} onChange={(event) => onChange({ signature: event.target.value || undefined })} placeholder="請輸入簽名人姓名（示範簽名）" />;
  const multi = item.kind === "MULTI"; const selected = Array.isArray(result.value) ? result.value : typeof result.value === "string" && result.value ? [result.value] : [];
  const toggle = (option: string) => onChange({ value: multi ? (selected.includes(option) ? selected.filter((entry) => entry !== option) : [...selected, option]) : option });
  return <div className="insp-choices" role={multi ? "group" : "radiogroup"}>{(item.options ?? []).map((option) => { const on = selected.includes(option); const bad = item.abnormal?.includes(option); return <button type="button" key={option} disabled={disabled} className={`${on ? "on" : ""} ${bad ? "abnormal" : ""}`} role={multi ? "checkbox" : "radio"} aria-checked={on} onClick={() => toggle(option)}>{option}</button>; })}</div>;
}

function groupItems(items: ItemSnapshot[]) {
  const groups: { type: string; items: { item: ItemSnapshot; no: number }[] }[] = []; let no = 0;
  items.forEach((item) => { const group = groups.find((entry) => entry.type === item.itemType) ?? (groups.push({ type: item.itemType, items: [] }), groups[groups.length - 1]); group.items.push({ item, no: ++no }); });
  return groups;
}

// ---- 列表 ----
const emptyFilters = { id: "", object: "", plan: "", template: "", inspector: "", status: "", result: "", source: "", voided: "", from: "", to: "" };

export function InspectionListPage() {
  const navigate = useNavigate(); const { showToast } = useToast(); const { plans, works } = useDemo(); const { all } = useInspections(); const app = useAppPlanState();
  const [filters, setFilters] = useState(emptyFilters); const [page, setPage] = useState(1); const [pageSize, setPageSize] = useState(15);
  const filter = (key: keyof typeof emptyFilters, value: string) => { setFilters((current) => ({ ...current, [key]: value })); setPage(1); };
  const planName = (id?: string) => plans.find((plan) => plan.id === id)?.name ?? id ?? "—";
  const rows = all.filter((record) => contains(record.id, filters.id) && contains(objectName(record.objectId), filters.object) && contains(`${record.planId ?? ""}${planName(record.planId)}`, filters.plan)
    && (!filters.template || record.snapshot.name === filters.template) && contains(record.inspector ?? "", filters.inspector) && (!filters.status || record.status === filters.status)
    && (!filters.result || resultOf(record) === filters.result) && (!filters.source || record.source === filters.source) && (!filters.voided || (filters.voided === "已作廢") === !!record.voided)
    && (!filters.from || (record.submittedAt ?? "").slice(0, 10) >= filters.from) && (!filters.to || (!!record.submittedAt && record.submittedAt.slice(0, 10) <= filters.to)));
  const counted = rows.filter((record) => record.status === "已完成" && !record.voided).length;
  const columns: Column<InspectionRecord>[] = ([
    { key: "id", title: "巡查編號", width: 160 },
    { key: "objectId", title: "巡查對象", width: 190, render: (record) => <span className={record.voided ? "insp-voided" : ""}>{objectName(record.objectId)}</span>, sortValue: (record) => objectName(record.objectId) },
    { key: "planId", title: "所屬計劃", width: 190, render: (record) => planName(record.planId), sortValue: (record) => planName(record.planId) },
    { key: "template", title: "巡查計劃模板", width: 190, render: (record) => record.snapshot.name, sortValue: (record) => record.snapshot.name },
    { key: "source", title: "來源", width: 80 },
    { key: "inspector", title: "巡查人員", width: 100, render: (record) => record.inspector ?? "—", sortValue: (record) => record.inspector ?? "" },
    { key: "status", title: "狀態", width: 90, render: (record) => <StatusTag>{record.status}</StatusTag> },
    { key: "result", title: "結果", width: 90, render: (record) => { const result = resultOf(record); return <StatusTag tone={resultTone(result)}>{result}</StatusTag>; }, sortValue: resultOf },
    { key: "works", title: "關聯工作", width: 90, render: (record) => worksOfInspection(works, record.id, app.workLinks).length || "—", sortValue: (record) => worksOfInspection(works, record.id, app.workLinks).length },
    { key: "submittedAt", title: "提交時間", width: 150, render: (record) => record.submittedAt ?? "—", sortValue: (record) => record.submittedAt ?? "" },
    { key: "voided", title: "作廢", width: 80, render: (record) => record.voided ? <StatusTag tone="danger">已作廢</StatusTag> : "—", sortValue: (record) => record.voided ? 1 : 0 },
  ] satisfies Column<InspectionRecord>[]).map((column) => ({ ...column, sortable: true }));
  return <div className="page-content insp-page">
    <PageHeader title="巡查記錄" actions={<><Button icon={<ExportOutlined />} onClick={() => showToast("巡查記錄匯出任務已建立")}>匯出</Button><Button variant="primary" icon={<PlusOutlined />} onClick={() => navigate("/inspections/new")}>新增巡查</Button></>} />
    <section className="panel list-panel insp-list-panel">
      <div className="filter-bar insp-filter-bar">
        <label className="filter-field"><span>巡查編號</span><input aria-label="巡查編號" value={filters.id} onChange={(event) => filter("id", event.target.value)} placeholder="請輸入巡查編號" /></label>
        <label className="filter-field"><span>巡查對象</span><input aria-label="巡查對象" value={filters.object} onChange={(event) => filter("object", event.target.value)} placeholder="請輸入對象名稱" /></label>
        <label className="filter-field"><span>所屬計劃</span><input aria-label="所屬計劃" value={filters.plan} onChange={(event) => filter("plan", event.target.value)} placeholder="計劃編號或名稱" /></label>
        <label className="filter-field"><span>巡查計劃模板</span><Select ariaLabel="巡查計劃模板" value={filters.template} onChange={(value) => filter("template", value)}><option value="">全部巡查計劃模板</option>{unique(all.map((record) => record.snapshot.name)).map((name) => <option key={name}>{name}</option>)}</Select></label>
        <label className="filter-field"><span>巡查人員</span><input aria-label="巡查人員" value={filters.inspector} onChange={(event) => filter("inspector", event.target.value)} placeholder="請輸入人員姓名" /></label>
        <label className="filter-field"><span>狀態</span><Select ariaLabel="狀態" value={filters.status} onChange={(value) => filter("status", value)}><option value="">全部狀態</option><option>未完成</option><option>已完成</option></Select></label>
        <label className="filter-field"><span>結果</span><Select ariaLabel="結果" value={filters.result} onChange={(value) => filter("result", value)}><option value="">全部結果</option><option>正常</option><option>異常</option><option>待填寫</option></Select></label>
        <label className="filter-field"><span>來源</span><Select ariaLabel="來源" value={filters.source} onChange={(value) => filter("source", value)}><option value="">全部來源</option><option>計劃</option><option>獨立</option><option>補入</option></Select></label>
        <label className="filter-field"><span>作廢</span><Select ariaLabel="作廢" value={filters.voided} onChange={(value) => filter("voided", value)}><option value="">全部</option><option>未作廢</option><option>已作廢</option></Select></label>
        <label className="filter-field"><span>提交日期（由）</span><input aria-label="提交日期由" type="date" value={filters.from} onChange={(event) => filter("from", event.target.value)} /></label>
        <label className="filter-field"><span>提交日期（至）</span><input aria-label="提交日期至" type="date" value={filters.to} onChange={(event) => filter("to", event.target.value)} /></label>
        <div className="user-filter-actions"><Button variant="text" icon={<ReloadOutlined />} onClick={() => { setFilters(emptyFilters); setPage(1); }}>重設</Button></div>
      </div>
      <DenseTable rows={rows} columns={columns} stickyActions actionTitle="操作" page={Math.min(page, Math.max(1, Math.ceil(rows.length / pageSize)))} pageSize={pageSize} onSort={() => setPage(1)} emptyText="沒有符合條件的巡查記錄" renderActions={(record) => <button className="table-action-button" aria-label={`查看 ${record.id}`} onClick={() => navigate(`/inspections/${record.id}`)}><EyeOutlined />查看</button>} />
      <Pagination total={rows.length} page={page} pageSize={pageSize} onPageChange={setPage} onPageSizeChange={(size) => { setPageSize(size); setPage(1); }} />
      <div className="insp-count-note"><InfoCircleOutlined />目前結果共 {rows.length} 筆，其中 {counted} 筆已完成且未作廢，計入統計報表；已作廢及未完成的巡查不計入。</div>
    </section>
  </div>;
}

// ---- 新增 ----
export function InspectionCreatePage() {
  const navigate = useNavigate(); const { showToast } = useToast(); const { plans, updatePlan, saveInspectionRecord } = useDemo(); const { all } = useInspections();
  const openPlans = plans.filter((plan) => plan.status === "未開始" || plan.status === "進行中");
  const [planId, setPlanId] = useState(""); const [objectId, setObjectId] = useState(getAllObjects()[0]?.id ?? ""); const [templateId, setTemplateId] = useState(""); const [inspector, setInspector] = useState(""); const [error, setError] = useState("");
  const plan = openPlans.find((item) => item.id === planId);
  const planObjects = plan ? snapshotOf(plan)?.objects ?? [] : [];
  const objectOptions = plan ? planObjects.map((entry) => objectOf(entry.objectId)).filter((object): object is NonNullable<typeof object> => !!object) : getAllObjects();
  const effectiveObject = objectOptions.some((object) => object.id === objectId) ? objectId : objectOptions[0]?.id ?? "";
  const templateOptions = plan ? templatesFromIds(planObjects.find((entry) => entry.objectId === effectiveObject)?.templateIds ?? []) : templatesForObject(effectiveObject);
  const effectiveTemplate = templateOptions.some((template) => template.id === templateId) ? templateId : templateOptions[0]?.id ?? "";
  const create = () => {
    if (!effectiveObject || !effectiveTemplate) { setError("請選擇巡查對象及巡查計劃模板。"); return; }
    if (plan && all.some((record) => record.planId === plan.id && record.objectId === effectiveObject && record.templateId === effectiveTemplate && !record.voided)) { setError("此計劃已有相同對象及巡查計劃模板的巡查。"); return; }
    const time = nowText();
    const id = nextIds("IN", [...all.map((record) => record.id), ...plans.flatMap((item) => (item.inspections ?? []).map((entry) => entry.id))], dateKey(time), 1)[0];
    const seq = plan ? Math.max(0, ...all.filter((record) => record.planId === plan.id).map((record) => record.seq), ...(plan.inspections ?? []).map((entry) => entry.seq)) + 1 : 1;
    const record: InspectionRecord = { id, origin: "後台", planId: plan?.id, objectId: effectiveObject, templateId: effectiveTemplate, snapshot: templateSnapshotOf(effectiveTemplate, time), seq, status: "未完成", source: plan ? "計劃" : "獨立", inspector: inspector || undefined, results: {}, changes: [{ time, operator: signedInUser, action: "建立巡查", detail: `${plan ? `加入計劃 ${plan.id}` : "獨立巡查"}；巡查計劃模板「${inspectionTemplateName(effectiveTemplate)}」已複製為快照` }], createdBy: signedInUser, createdAt: time };
    saveInspectionRecord(record);
    if (plan) updatePlan(plan.id, { inspections: [...(plan.inspections ?? []), { id, objectId: effectiveObject, templateId: effectiveTemplate, seq, source: "額外加入", addedBy: signedInUser, addedAt: time }], total: plan.total + 1, changes: [...(plan.changes ?? []), { time, operator: signedInUser, action: "增加巡查", detail: `由巡查記錄新增 ${id}` }] });
    showToast("巡查已建立（未完成），請填寫巡查項目並提交"); navigate(`/inspections/${id}`);
  };
  const people = unique(directory.map((person) => person.name));
  return <div className="page-content insp-create-page">
    <PageHeader eyebrow="巡查記錄 / 新增巡查" title="新增巡查" actions={<><Button onClick={() => navigate("/inspections")}>取消</Button><Button variant="primary" icon={<CheckOutlined />} onClick={create}>建立巡查</Button></>} />
    <section className="panel form-section insp-create-form"><header><h2>巡查設定</h2><span>建立後狀態為「未完成」，於詳情頁按巡查計劃模板填寫並提交</span></header>
      {error && <div className="insp-error" role="alert">{error}</div>}
      <div className="form-grid two-col">
        <Field label="所屬計劃" hint="不選即為獨立巡查；只列未開始或進行中的計劃"><Select ariaLabel="所屬計劃" value={planId} onChange={(value) => { setPlanId(value); setError(""); }}><option value="">獨立巡查（不屬任何計劃）</option>{openPlans.map((item) => <option key={item.id} value={item.id}>{item.name}（{item.id}）</option>)}</Select></Field>
        <Field label="巡查人員"><Select ariaLabel="巡查人員" value={inspector} onChange={setInspector}><option value="">未指定（由填寫者提交時記錄）</option>{people.map((name) => <option key={name}>{name}</option>)}</Select></Field>
        <Field label="巡查對象" required><Select ariaLabel="巡查對象" value={effectiveObject} onChange={(value) => { setObjectId(value); setError(""); }}>{objectOptions.map((object) => <option key={object.id} value={object.id}>{object.name}（{object.grid}）</option>)}</Select></Field>
        <Field label="巡查計劃模板" required hint="建立時複製巡查計劃模板快照，之後巡查計劃模板更改不影響此巡查"><Select ariaLabel="巡查計劃模板" value={effectiveTemplate} onChange={(value) => { setTemplateId(value); setError(""); }}>{templateOptions.map((template) => <option key={template.id} value={template.id}>{template.name}</option>)}</Select></Field>
      </div>
      {effectiveTemplate && <TemplatePreview templateId={effectiveTemplate} />}
    </section>
  </div>;
}

function templatesFromIds(ids: string[]) { return liveAppTemplates().filter((template) => ids.includes(template.id)); }
function TemplatePreview({ templateId }: { templateId: string }) {
  const snapshot = templateSnapshotOf(templateId, "");
  return <div className="insp-template-preview"><strong>巡查計劃模板內容預覽</strong><span>{snapshot.items.length} 個巡查項目（必填 {snapshot.items.filter((item) => item.required).length}）· 定位檢查{snapshot.locationCheck ? `開啟，有效距離 ${snapshot.validDistance} 米（${snapshot.checkOn.join("、")}）` : "關閉"}</span>
    <ul>{groupItems(snapshot.items).map((group) => <li key={group.type}><b>{group.type}</b>{group.items.map(({ item }) => <em key={item.key}>{item.required && "＊"}{item.name}{item.minAttachments ? `（附件≥${item.minAttachments}）` : ""}</em>)}</li>)}</ul></div>;
}

// ---- 詳情 ----
type DetailTab = "項目結果" | "附件" | "相關工作" | "變更記錄";
type DrawerKind = "supplement" | "void" | "work" | "link" | null;

export function InspectionDetailPage() {
  const { id = "" } = useParams(); const navigate = useNavigate(); const { all, stored } = useInspections(); const { inspectionRecords } = useDemo();
  const record = all.find((item) => item.id === id);
  if (!record) return <div className="page-content center-state"><WarningFilled /><h1>找不到巡查</h1><p>巡查「{id}」不存在。</p><Button onClick={() => navigate("/inspections")}>返回列表</Button></div>;
  return <InspectionDetail key={`${record.id}-${inspectionRecords.length}`} record={record} stored={stored(record.id)} />;
}

function InspectionDetail({ record, stored }: { record: InspectionRecord; stored: InspectionRecord | undefined }) {
  const navigate = useNavigate(); const { showToast } = useToast(); const { authorize } = usePermissionRules(); const app = useAppPlanState();
  const { plans, works, saveInspectionRecord, updatePlan, addWork, updateWork } = useDemo(); const { all } = useInspections();
  const plan = plans.find((item) => item.id === record.planId);
  // 輔助資料: the items' current settings, resolved for this inspection's object and time
  const history = useMemo(() => historyFromRecords(all), [all]);
  const auxOf = (item: ItemSnapshot) => auxEntriesFor(item, record, history);
  const [auxItem, setAuxItem] = useState<ItemSnapshot | null>(null);
  const result = resultOf(record); const object = objectOf(record.objectId);
  const editable = record.origin === "後台" && record.status === "未完成" && !record.voided;
  const [draft, setDraft] = useState<ResultMap>(record.results); const [issues, setIssues] = useState<ResultIssue[]>([]);
  const [tab, setTab] = useState<DetailTab>("項目結果"); const [drawer, setDrawer] = useState<DrawerKind>(null); const [workItem, setWorkItem] = useState<string | undefined>(); const [selected, setSelected] = useState<string | null>(null);
  const [layers, setLayers] = useState({ object: true, works: true, tracks: true });
  const related = worksOfInspection(works, record.id, app.workLinks);
  const worksOfItem = (key: string) => related.filter((work) => workInspectionOf(work).itemKey === key || app.workLinks.some((link) => link.workId === work.id && link.inspectionId === record.id && link.itemKey === key));
  const view = editable ? draft : record.results;
  const baseStored = () => storedFor(record, stored);
  const adjustPlan = (dTotal: number, dDone: number) => { if (plan) updatePlan(plan.id, { total: Math.max(0, plan.total + dTotal), progress: Math.max(0, plan.progress + dDone) }); };

  const saveNow = () => { const next = saveDraft(baseStored(), draft); saveInspectionRecord(next); return next; };
  const onSaveDraft = () => { saveNow(); showToast("草稿已儲存，巡查仍為未完成"); };
  const onSubmit = () => {
    const outcome = submitRecord(baseStored(), draft, nowText(), signedInUser);
    if (!outcome.record) { setIssues(outcome.errors); showToast(`提交前請修正 ${outcome.errors.length} 項問題`, "error"); document.getElementById("insp-issues")?.scrollIntoView({ behavior: "smooth", block: "center" }); return; }
    saveInspectionRecord(outcome.record); setIssues([]); adjustPlan(0, 1); showToast("巡查已提交，狀態更新為已完成");
  };
  const patchItem = (key: string, patch: Partial<ItemResultData>) => { setDraft((current) => ({ ...current, [key]: { ...(current[key] ?? emptyResult()), ...patch } })); setIssues((current) => current.filter((entry) => entry.key !== key)); };

  const markers: MapMarkerSpec[] = [];
  const objectPoint: [number, number] | undefined = object ? [object.x, object.y] : undefined;
  if (layers.object && object) markers.push({ id: "object", kind: "inspection", x: object.x, y: object.y, tone: result === "異常" ? "issue" : record.status === "已完成" ? "done" : "todo", label: String(record.seq), title: object.name, detail: <span>{record.id} · {record.snapshot.name}<br />{record.status} · {result}{record.location ? <><br />定位校驗：{record.location.passed ? "通過" : "不通過"}（距離 {record.location.distance} 米，精度 ±{record.location.accuracy} 米）</> : null}</span> });
  if (layers.works) related.forEach((work) => { const point = positionOfWork(work) ?? objectPoint; if (point) markers.push({ id: `work:${work.id}`, kind: "work", x: point[0], y: point[1], tone: "work", label: "工", title: work.title, detail: <span>{work.id} · {work.status}<br /><Link to={`/works/${work.id}`}>查看工作</Link></span> }); });
  const tracks = layers.tracks && objectPoint && record.submittedAt && record.inspector ? [{ id: "inspector", name: record.inspector, color: "#2468c9", points: approachTrack(objectPoint, record.submittedAt.slice(11) || "09:00") }] : [];
  const chips: MapLayerChip[] = [{ key: "object", label: "巡查對象", on: layers.object }, { key: "works", label: "相關工作", count: related.length, on: layers.works }, { key: "tracks", label: "巡查人員軌跡", on: layers.tracks }];
  const allFiles = record.snapshot.items.flatMap((item) => (view[item.key]?.attachments ?? []).map((file) => ({ file, item })));
  const timeline = [...record.changes].sort((a, b) => b.time.localeCompare(a.time)).map((change) => ({ title: change.action, time: change.time, text: `${change.operator}：${change.detail}`, tone: change.action.includes("作廢") && !change.action.includes("解除") ? "danger" as const : "neutral" as const }));
  const workColumns: Column<Work>[] = [
    { key: "id", title: "工作編號", width: 160 }, { key: "title", title: "工作摘要", width: 220 }, { key: "item", title: "巡查項目", width: 150, render: (work) => record.snapshot.items.find((item) => item.key === workInspectionOf(work).itemKey)?.name ?? "—" },
    { key: "type", title: "工作類型", width: 150 }, { key: "status", title: "狀態", width: 90, render: (work) => <StatusTag>{work.status}</StatusTag> }, { key: "group", title: "執行群組", width: 140 },
  ];
  const attachmentTotal = allFiles.length;

  const doVoid = (voided: boolean, reason: string, identityId: string): string | undefined => {
    const identity = policyUsers.find((user) => user.id === identityId) ?? policyUsers[0];
    const decision = authorize("void-inspection", { object: inspectionPolicyObject({ id: record.id, grid: object?.grid ?? "", objectType: object?.type ?? "", status: record.status }) }, identity);
    if (!decision.allowed) return `權限校驗未通過：${decision.reason}`;
    const outcome = setVoided(baseStored(), voided, reason, identity.name, nowText());
    if (!outcome.record) return outcome.error;
    saveInspectionRecord(outcome.record);
    if (record.status === "已完成") adjustPlan(voided ? -1 : 1, voided ? -1 : 1); else adjustPlan(voided ? -1 : 1, 0);
    setDrawer(null); showToast(voided ? "巡查已作廢，不再計入統計" : "已解除作廢"); return undefined;
  };
  const doSupplement = (additions: ResultMap, reason: string): string | undefined => {
    const outcome = supplementRecord(baseStored(), record, additions, reason, signedInUser, nowText());
    if (!outcome.record) return outcome.error;
    saveInspectionRecord(outcome.record); setDrawer(null); showToast("補入資料已保存並留痕"); return undefined;
  };
  const createWork = (input: { title: string; type: string; priority: Work["priority"]; group: string; address: string; description: string }) => {
    const time = nowText(); const workId = nextIds("WK", works.map((work) => work.id), dateKey(time), 1)[0];
    if (editable) saveNow();
    addWork({ ...input, id: workId, source: "巡查", status: "新建", grid: object?.grid ?? plan?.grid ?? "", sla: "正常", createdAt: time, updatedAt: time, planId: record.planId, creator: signedInUser, objectId: record.objectId, inspectionId: record.id, inspectionItem: workItem, x: object?.x, y: object?.y });
    saveInspectionRecord({ ...baseStored(), results: editable ? draft : baseStored().results, changes: [...baseStored().changes, { time, operator: signedInUser, action: "新增工作", detail: `${workId}${workItem ? `（${record.snapshot.items.find((item) => item.key === workItem)?.name}）` : ""}` }] });
    setDrawer(null); showToast(`已新增工作 ${workId}`);
  };
  const linkWorks = (ids: string[]) => {
    const time = nowText(); if (editable) saveNow();
    ids.forEach((workId) => updateWork(workId, { inspectionId: record.id, inspectionItem: workItem, objectId: record.objectId }));
    saveInspectionRecord({ ...baseStored(), results: editable ? draft : baseStored().results, changes: [...baseStored().changes, { time, operator: signedInUser, action: "關聯工作", detail: ids.join("、") }] });
    setDrawer(null); showToast(`已關聯 ${ids.length} 宗工作`);
  };
  const openWork = (key?: string, kind: "work" | "link" = "work") => { setWorkItem(key); setDrawer(kind); };
  const requiredCount = record.snapshot.items.filter((item) => item.required).length;
  const filledRequired = record.snapshot.items.filter((item) => item.required && isFilled(item, view[item.key])).length;

  return <div className="page-content detail-page insp-detail-page">
    <PageHeader eyebrow="巡查記錄 / 巡查詳情" title={object?.name ?? record.objectId} actions={<>
      <Button icon={<ArrowLeftOutlined />} onClick={() => navigate("/inspections")}>返回列表</Button>
      {record.status === "已完成" && !record.voided && <Button icon={<PlusOutlined />} onClick={() => setDrawer("supplement")}>補入</Button>}
      {!record.voided && record.status === "已完成" && <Button icon={<LinkOutlined />} onClick={() => openWork(undefined, "link")}>關聯工作</Button>}
      {record.voided ? <Button variant="primary" icon={<ReloadOutlined />} onClick={() => setDrawer("void")}>解除作廢</Button> : <Button variant="danger" icon={<StopOutlined />} onClick={() => setDrawer("void")}>作廢</Button>}
    </>} />
    {record.voided && <div className="insp-void-banner" role="status"><StopOutlined /><span><strong>此巡查已作廢</strong>，不參與統計報表計算。原因：{record.voidReason}</span></div>}
    <div className="status-strip insp-status-strip">
      <div><span>巡查編號</span><strong>{record.id}</strong></div><div><span>狀態</span><StatusTag>{record.status}</StatusTag></div><div><span>結果</span><StatusTag tone={resultTone(result)}>{result}</StatusTag></div>
      <div><span>巡查計劃模板</span><strong>{record.snapshot.name}（快照）</strong></div><div><span>所屬計劃</span>{plan ? <Link to={`/plans/${plan.id}`}>{plan.name}</Link> : <strong>獨立巡查</strong>}</div>
      <div><span>巡查人員</span><strong>{record.inspector ?? "未指定"}</strong></div><div><span>提交時間</span><strong>{record.submittedAt ?? "—"}</strong></div>
      <div><span>定位校驗</span>{record.location ? <StatusTag tone={record.location.passed ? "success" : "danger"}>{record.location.nfc ? "NFC 輔助" : record.location.passed ? "通過" : "不通過"}</StatusTag> : <strong>{record.snapshot.locationCheck ? "待校驗" : "不需要"}</strong>}</div>
    </div>
    {record.origin === "App" && record.status === "未完成" && !record.voided && <div className="plan-snapshot-note"><InfoCircleOutlined /><span>此巡查由前線人員在 App 填寫，完成並提交後結果會顯示於此；後台只可作廢。</span></div>}
    <section className="panel plan-map-panel insp-map-panel"><PlanMap route={plan ? snapshotOf(plan)?.route : undefined} markers={markers} tracks={tracks} layers={chips} onToggleLayer={(key) => setLayers((current) => ({ ...current, [key]: !current[key as keyof typeof current] }))} selected={selected} onSelect={setSelected} fitKey={record.id}
      legend={<><LegendItem tone={result === "異常" ? "issue" : record.status === "已完成" ? "done" : "todo"}>巡查對象</LegendItem><LegendItem tone="work">相關工作</LegendItem><LegendItem tone="track">巡查人員軌跡（示範）</LegendItem></>} /></section>
    <section className="panel tab-panel insp-tab-panel"><nav>{(["項目結果", "附件", "相關工作", "變更記錄"] as DetailTab[]).map((name) => <button key={name} className={tab === name ? "active" : ""} onClick={() => setTab(name)}>{name}<span>{name === "項目結果" ? record.snapshot.items.length : name === "附件" ? attachmentTotal : name === "相關工作" ? related.length : timeline.length}</span></button>)}</nav>
      <div className="insp-tab-body">
        {tab === "項目結果" && <div>
          {editable && <div className="insp-fill-bar"><span>填寫進度：必填 {filledRequired} / {requiredCount}</span><div><Button icon={<SaveOutlined />} onClick={onSaveDraft}>儲存草稿</Button><Button variant="primary" icon={<CheckOutlined />} onClick={onSubmit}>提交巡查</Button></div></div>}
          {issues.length > 0 && <div className="insp-error" id="insp-issues" role="alert"><strong>提交前請修正以下 {issues.length} 項</strong><ol>{issues.map((issue, index) => <li key={index}><button type="button" onClick={() => document.getElementById(`insp-item-${issue.key}`)?.scrollIntoView({ behavior: "smooth", block: "center" })}>{issue.message}</button></li>)}</ol></div>}
          {groupItems(record.snapshot.items).map((group) => <div className="insp-group" key={group.type}><div className="insp-group-title"><strong>{group.type}</strong><span>{group.items.length} 項</span></div>
            {group.items.map(({ item, no }) => <ItemCard key={item.key} no={no} item={item} aux={auxOf(item)} onAux={() => setAuxItem(item)} result={view[item.key]} editable={editable} issues={issues.filter((issue) => issue.key === item.key)} usedChars={attachmentChars(view)} works={worksOfItem(item.key)} onChange={(patch) => patchItem(item.key, patch)} onNewWork={() => openWork(item.key, "work")} onLinkWork={() => openWork(item.key, "link")} />)}
          </div>)}
        </div>}
        {tab === "附件" && (allFiles.length ? <div className="insp-attach-all">{allFiles.map(({ file, item }) => <a key={file.id} href={file.src} target="_blank" rel="noreferrer" className={file.src ? "" : "nolink"}>{file.src ? <img src={file.src} alt={file.name} /> : <FileOutlined />}<span>{file.name}</span><small>{item.name}</small></a>)}</div> : <div className="empty-state"><strong>暫無附件</strong></div>)}
        {tab === "相關工作" && <DenseTable rows={related} columns={workColumns} emptyText="此巡查暫無相關工作" stickyActions actionTitle="操作" renderActions={(work) => <button className="table-action-button" onClick={() => navigate(`/works/${work.id}`)}><EyeOutlined />查看</button>} />}
        {tab === "變更記錄" && <div className="plan-timeline">{timeline.length ? <ActivityTimeline items={timeline} /> : <div className="empty-state"><strong>暫無變更記錄</strong></div>}</div>}
      </div>
    </section>
    {auxItem && <AuxDrawer item={auxItem} entries={auxOf(auxItem)} objectName={object?.name ?? record.objectId} onClose={() => setAuxItem(null)} />}
    {drawer === "supplement" && <SupplementDrawer record={record} usedChars={attachmentChars(record.results)} onClose={() => setDrawer(null)} onSave={doSupplement} />}
    {drawer === "void" && <VoidDrawer record={record} onClose={() => setDrawer(null)} onSave={doVoid} />}
    {drawer === "work" && <WorkDrawer record={record} itemName={record.snapshot.items.find((item) => item.key === workItem)?.name} itemValue={workItem ? valueText(record.snapshot.items.find((item) => item.key === workItem)!, view[workItem]) : ""} address={object?.address ?? ""} onClose={() => setDrawer(null)} onSave={createWork} />}
    {drawer === "link" && <BatchPickerDrawer title="關聯現有工作" noun="工作" filterLabel="網格" description={workItem ? `關聯至巡查項目「${record.snapshot.items.find((item) => item.key === workItem)?.name}」；只列出尚未關聯巡查的工作。` : "只列出尚未關聯巡查的工作。"} confirmLabel="批量關聯"
      rows={works.filter((work) => !work.pendingSync && !work.voided && !workInspectionOf(work).inspectionId && !app.workLinks.some((link) => link.workId === work.id)).map((work) => ({ id: work.id, title: work.title, meta: `${work.id} · ${work.type} · ${work.status}`, group: work.grid }))} onClose={() => setDrawer(null)} onConfirm={linkWorks} />}
  </div>;
}

/** Opens the item's 輔助資料; configured-but-empty entries use a quiet inline state. */
function AuxButton({ entries, onOpen }: { entries: AuxEntry[]; onOpen: () => void }) {
  const shown = entries.filter((entry) => !entry.empty).length;
  if (!shown) return <span className="insp-aux-empty">無輔助記錄</span>;
  // BIP small default button: white, grey border, brand red on hover; the count is plain text
  return <button type="button" className="insp-aux-button" onClick={onOpen} aria-label={`查看 ${shown} 項輔助資料`}><FileSearchOutlined />輔助資料<em>{shown}</em></button>;
}

/** 輔助資料 drawer: each entry with something to show, in order; earlier results as a table, object attributes as values, attachments as files. */
function AuxDrawer({ item, entries, objectName, onClose }: { item: ItemSnapshot; entries: AuxEntry[]; objectName: string; onClose: () => void }) {
  const shown = entries.filter((entry) => !entry.empty);
  return <FormDrawer open title="輔助資料" subtitle={`${item.name} · ${objectName}`} onClose={onClose} cancelLabel="關閉" className="evt-drawer aux-drawer">
    <div className="evt-drawer-body aux-drawer-body">
      {shown.map((entry) => <section key={entry.def.id} className="group-editor-section"><header><h3>{entry.def.name}</h3></header><div className="aux-section">
        <p className="aux-source">內容來源：{entry.def.source}{entry.def.source === "上次巡查結果" ? `（最近 ${entry.def.count ?? 1} 次）` : entry.def.source === "對象屬性" ? `（${entry.def.attribute}）` : entry.def.keyword ? `（名稱包含「${entry.def.keyword}」）` : ""}</p>
        {entry.results?.length ? <div className="aux-results-wrap"><table className="dense-table fluid aux-results"><thead><tr><th className="nowrap">巡查時間</th><th>結果</th><th className="nowrap">巡查人員</th><th>備註</th><th className="nowrap">附件</th><th className="nowrap">巡查編號</th></tr></thead><tbody>
          {entry.results.map((result) => <tr key={result.inspectionId}><td className="nowrap">{result.time}</td><td><StatusTag tone={isAbnormal(item, result.raw) ? "danger" : "success"}>{result.value}</StatusTag></td><td className="nowrap">{result.inspector ?? "—"}</td><td>{result.remark ?? "—"}</td>
            <td className="nowrap">{result.files?.length ? <span className="aux-file-links">{result.files.map((file, index) => file.src ? <a key={file.id} href={file.src} target="_blank" rel="noreferrer" title={file.name}>相片{index + 1}</a> : <span key={file.id} title={file.name}>相片{index + 1}</span>)}</span> : "—"}</td>
            <td className="nowrap"><Link to={`/inspections/${result.inspectionId}`} onClick={onClose}>{result.inspectionId}</Link></td></tr>)}
        </tbody></table></div>
        : entry.files?.length ? <div className="aux-files">{entry.files.map((file) => file.src
          ? <a key={file.id} href={file.src} target="_blank" rel="noreferrer" className="aux-file">{file.kind === "image" ? <img src={file.src} alt={file.name} /> : <FileOutlined />}<span>{file.name}</span></a>
          : <span key={file.id} className="aux-file nolink"><FileOutlined /><span>{file.name}</span><small>未有檔案內容</small></span>)}</div>
        : <div className="aux-value">{entry.text}</div>}
      </div></section>)}
    </div>
  </FormDrawer>;
}

function ItemCard({ no, item, aux, onAux, result, editable, issues, usedChars, works, onChange, onNewWork, onLinkWork }: {
  no: number; item: ItemSnapshot; aux: AuxEntry[]; onAux: () => void; result?: ItemResultData; editable: boolean; issues: ResultIssue[]; usedChars: number; works: Work[];
  onChange: (patch: Partial<ItemResultData>) => void; onNewWork: () => void; onLinkWork: () => void;
}) {
  const current = result ?? emptyResult(); const abnormal = isAbnormal(item, current.value); const state = itemState(item, result); const problems = itemIssues(item, result);
  return <section id={`insp-item-${item.key}`} className={`insp-item ${abnormal ? "abnormal" : ""} ${issues.length ? "error" : ""}`}>
    <header><span className="insp-item-no">{String(no).padStart(2, "0")}</span><strong>{item.required && <b>*</b>}{item.name}</strong>
      <AuxButton entries={aux} onOpen={onAux} />
      <span className="insp-chips"><i>{kindLabels[item.kind]}</i>{item.required && <i className="req">必填</i>}{item.minAttachments > 0 && <i className={current.attachments.length < item.minAttachments ? "warn" : ""}>附件 {current.attachments.length}/{item.minAttachments}</i>}<StatusTag tone={state === "異常" ? "danger" : state === "已填" ? "success" : "neutral"}>{state}</StatusTag></span></header>
    {editable ? <>
      <ValueInput item={item} result={current} onChange={onChange} />
      <AttachmentField files={current.attachments} min={item.minAttachments} usedChars={usedChars} onChange={(attachments) => onChange({ attachments })} />
      <input className="insp-remark" value={current.remark ?? ""} maxLength={200} onChange={(event) => onChange({ remark: event.target.value || undefined })} placeholder="項目備註（選填，200 字內）" />
      {problems.length > 0 && <ul className="insp-hints">{problems.map((text) => <li key={text}>{text}</li>)}</ul>}
    </> : <>
      <div className="insp-value">{valueText(item, current)}</div>
      {current.remark && <p className="insp-remark-text">備註：{current.remark}</p>}
      {current.attachments.length > 0 && <div className="insp-attach"><AttachmentField files={current.attachments} min={0} usedChars={0} onChange={() => undefined} disabled /></div>}
    </>}
    {(abnormal || works.length > 0) && <div className="insp-abnormal-bar">{abnormal && <span><WarningFilled />此項目為異常值，建議新增工作跟進</span>}
      {works.map((work) => <Link key={work.id} to={`/works/${work.id}`} className="insp-linked-work">{work.id}<StatusTag>{work.status}</StatusTag></Link>)}
      {abnormal && <span className="insp-abnormal-actions"><Button icon={<PlusOutlined />} onClick={onNewWork}>新增工作</Button><Button icon={<LinkOutlined />} onClick={onLinkWork}>關聯現有工作</Button></span>}</div>}
  </section>;
}

function FormMessage({ text }: { text: string }) { return text ? <div className="insp-error" role="alert">{text}</div> : null; }

function SupplementDrawer({ record, usedChars, onClose, onSave }: { record: InspectionRecord; usedChars: number; onClose: () => void; onSave: (additions: ResultMap, reason: string) => string | undefined }) {
  const [additions, setAdditions] = useState<ResultMap>({}); const [reason, setReason] = useState(""); const [error, setError] = useState("");
  const patch = (key: string, value: Partial<ItemResultData>) => { setAdditions((current) => ({ ...current, [key]: { ...(current[key] ?? emptyResult()), ...value } })); setError(""); };
  const extra = Object.values(additions).reduce((sum, entry) => sum + attachmentChars({ x: entry }), 0);
  return <FormDrawer open title="補入巡查資料" subtitle={`${record.id} · 只可補入，不改動已提交的內容`} onClose={onClose} onSubmit={() => setError(onSave(additions, reason) ?? "")} submitLabel="確認補入" className="insp-drawer">
    <div className="insp-drawer-body"><FormMessage text={error} />
      <Field label="補入原因" required><textarea rows={3} value={reason} onChange={(event) => { setReason(event.target.value); setError(""); }} placeholder="例如：現場完成後補充相片" /></Field>
      {record.snapshot.items.map((item) => { const current = record.results[item.key]; const add = additions[item.key] ?? emptyResult(); const filled = isFilled(item, current);
        return <div className="insp-supp-item" key={item.key}><strong>{item.name}<small>{filled ? `已填寫：${valueText(item, current)}` : "尚未填寫"}</small></strong>
          {!filled && <ValueInput item={item} result={add} onChange={(value) => patch(item.key, value)} />}
          <AttachmentField files={add.attachments} min={0} usedChars={usedChars + extra} onChange={(attachments) => patch(item.key, { attachments })} />
          <input className="insp-remark" value={add.remark ?? ""} onChange={(event) => patch(item.key, { remark: event.target.value || undefined })} placeholder="補充備註（選填）" /></div>; })}
    </div>
  </FormDrawer>;
}

function VoidDrawer({ record, onClose, onSave }: { record: InspectionRecord; onClose: () => void; onSave: (voided: boolean, reason: string, identityId: string) => string | undefined }) {
  const voided = !!record.voided; const [reason, setReason] = useState(""); const [identityId, setIdentityId] = useState(defaultIdentityId); const [error, setError] = useState("");
  return <FormDrawer open title={voided ? "解除作廢" : "作廢巡查"} subtitle={record.id} onClose={onClose} onSubmit={() => setError(onSave(!voided, reason, identityId) ?? "")} submitLabel={voided ? "確認解除作廢" : "確認作廢"} className="insp-drawer">
    <div className="insp-drawer-body"><FormMessage text={error} />
      <div className="permission-hint">{voided ? "解除作廢後，此巡查會重新參與統計報表的計算。" : "作廢後，此巡查不參與統計報表的計算，原有記錄仍會保留，可由有權限人員解除。"}操作須通過「作廢巡查」權限校驗。</div>
      <Field label={voided ? "解除作廢原因" : "作廢原因"} required><textarea rows={4} value={reason} onChange={(event) => { setReason(event.target.value); setError(""); }} /></Field>
      <Field label="提交身份（示範）" hint="提交時以此身份重新校驗功能權限及權責範圍"><Select ariaLabel="提交身份" value={identityId} onChange={(value) => { setIdentityId(value); setError(""); }}>{policyUsers.map((user) => <option key={user.id} value={user.id}>{user.name}（{user.roles.join("、")}）</option>)}</Select></Field>
    </div>
  </FormDrawer>;
}

function WorkDrawer({ record, itemName, itemValue, address, onClose, onSave }: { record: InspectionRecord; itemName?: string; itemValue: string; address: string; onClose: () => void; onSave: (input: { title: string; type: string; priority: Work["priority"]; group: string; address: string; description: string }) => void }) {
  const [form, setForm] = useState({ title: itemName ? `${itemName}異常` : "", type: workTypes[0], priority: "一般" as Work["priority"], group: execGroups[0], address, description: itemName ? `巡查「${itemName}」異常（${itemValue}），來自巡查 ${record.id}。` : "" });
  const [error, setError] = useState("");
  const change = (patch: Partial<typeof form>) => { setForm((current) => ({ ...current, ...patch })); setError(""); };
  const save = () => { if (!form.title.trim() || !form.address.trim()) { setError("請填寫工作摘要及地址。"); return; } onSave({ ...form, title: form.title.trim(), address: form.address.trim(), description: form.description.trim() || form.title.trim() }); };
  return <FormDrawer open title="新增工作" subtitle={`${record.id}${itemName ? ` · ${itemName}` : ""}`} onClose={onClose} onSubmit={save} submitLabel="建立工作" className="insp-drawer">
    <div className="insp-drawer-body"><FormMessage text={error} /><div className="form-grid two-col">
      <Field label="工作摘要" required><input value={form.title} maxLength={50} onChange={(event) => change({ title: event.target.value })} /></Field>
      <Field label="工作類型" required><Select ariaLabel="工作類型" value={form.type} onChange={(type) => change({ type })}>{workTypes.map((type) => <option key={type}>{type}</option>)}</Select></Field>
      <Field label="優先級" required><Select ariaLabel="優先級" value={form.priority} onChange={(priority) => change({ priority: priority as Work["priority"] })}><option>一般</option><option>緊急</option><option>特急</option></Select></Field>
      <Field label="執行群組" required><Select ariaLabel="執行群組" value={form.group} onChange={(group) => change({ group })}>{execGroups.map((group) => <option key={group}>{group}</option>)}</Select></Field>
      <Field label="地址" required><input value={form.address} onChange={(event) => change({ address: event.target.value })} /></Field>
      <Field label="描述"><textarea rows={4} value={form.description} onChange={(event) => change({ description: event.target.value })} /></Field>
    </div></div>
  </FormDrawer>;
}
