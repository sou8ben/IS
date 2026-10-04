import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { CheckOutlined, ExportOutlined, EyeOutlined, InfoCircleOutlined, PlusOutlined, ReloadOutlined } from "@ant-design/icons";
import { gridNames } from "./grid-data";
import { Button, DenseTable, Field, PageHeader, Pagination, Select, StatusTag, useToast } from "./components";
import { dispatchWork, resolveEvent } from "./event-data";
import { useInspections } from "./inspection-data";
import { policyUsers } from "./permission-rules";
import { nextIds } from "./plan-rules";
import { useDemo } from "./store";
import type { Column, Work } from "./types";
import { emptyWorkForm, IssueSummary, toDraft, WorkForm, type WorkFormState } from "./work-form";
import { gridOf, nowText, prefillFromEvent, prefillFromInspection, resolveWork, slaFor, useInspectionRefs, useWorkLogs, workTypeOptions, type WorkPrefill } from "./work-data";
import { defaultSlaRules, findDuplicateCandidates, mergeDuplicates, priorityFactor, topType, validateWork, workModes, type SlaState, type WorkIssue, type WorkLogEntry } from "./work-rules";

const signedIn = policyUsers[0].name;
const dateKey = (text: string) => text.slice(0, 10).replace(/-/g, "");
const contains = (value: string, query: string) => !query.trim() || value.toLowerCase().includes(query.trim().toLowerCase());
const logId = () => `WL-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
const slaTone = (state: SlaState) => state === "已逾時" ? "danger" as const : state === "將逾時" ? "warning" as const : "success" as const;
const workTypeTops = [...new Set(workTypeOptions.map(topType))];
const sources = ["巡查", "事件", "計劃", "獨立", "接口"];

type WorkRow = Work & { slaState: SlaState; slaText: string };
const emptyFilters = { keyword: "", type: "", status: "", group: "", sla: "", grid: "", priority: "", source: "", dup: "", voided: "", from: "", to: "", mode: "" };

// ---- 列表 ----
export function WorkListPage() {
  const navigate = useNavigate(); const { works } = useDemo(); const logs = useWorkLogs(); const inspectionRefs = useInspectionRefs();
  const [filters, setFilters] = useState(emptyFilters); const [page, setPage] = useState(1); const [pageSize, setPageSize] = useState(15);
  const filter = (key: keyof typeof emptyFilters, value: string) => { setFilters((current) => ({ ...current, [key]: value })); setPage(1); };
  const all: WorkRow[] = works.filter((work) => !work.pendingSync).map(resolveWork).map((work) => { const sla = slaFor(work, logs, inspectionRefs); return { ...work, slaState: sla.overall, slaText: sla.text }; });
  const view = (work: WorkRow) => ({ status: work.status, voided: work.voided, group: work.group, reopenCount: work.reopenCount, dupGroup: work.dupGroup, masterId: work.masterId, creator: work.creator, sla: work.slaState });
  const mode = workModes.find((item) => item.key === filters.mode);
  const rows = all.filter((work) => (contains(`${work.id}${work.title}${work.address}`, filters.keyword)) && (!filters.type || (filters.type.includes("／") ? work.type === filters.type : topType(work.type) === filters.type)) && (!filters.status || work.status === filters.status)
    && (!filters.group || work.group === filters.group) && (!filters.sla || work.slaState === filters.sla) && (!filters.grid || work.grid === filters.grid) && (!filters.priority || work.priority === filters.priority)
    && (!filters.source || work.source === filters.source) && (!filters.dup || (filters.dup === "已合併" ? !!work.masterId : filters.dup === "已關聯" ? !!work.dupGroup && !work.masterId : !work.dupGroup && !work.masterId))
    && (!filters.voided || (filters.voided === "已作廢") === !!work.voided) && (!filters.from || work.createdAt.slice(0, 10) >= filters.from) && (!filters.to || work.createdAt.slice(0, 10) <= filters.to)
    && (!mode || mode.test(view(work), signedIn)));
  const columns: Column<WorkRow>[] = ([
    { key: "id", title: "工作編號", width: 160 },
    { key: "title", title: "工作摘要", width: 220, render: (work) => <span className={work.voided ? "insp-voided" : ""}>{work.title}</span> },
    { key: "type", title: "工作類型", width: 160 },
    { key: "priority", title: "優先級", width: 80, render: (work) => <StatusTag>{work.priority}</StatusTag>, sortValue: (work) => ({ "一般": 0, "緊急": 1, "特急": 2 })[work.priority] },
    { key: "status", title: "狀態", width: 90, render: (work) => <StatusTag>{work.status}</StatusTag> },
    { key: "group", title: "執行群組", width: 140 },
    { key: "slaState", title: "服務承諾", width: 190, render: (work) => <span className="wrk-sla-cell"><StatusTag tone={slaTone(work.slaState)}>{work.slaState}</StatusTag><small>{work.slaText}</small></span>, sortValue: (work) => ({ "正常": 0, "將逾時": 1, "已逾時": 2 })[work.slaState] },
    { key: "source", title: "來源", width: 80 },
    { key: "dup", title: "重複", width: 100, render: (work) => work.masterId ? <StatusTag tone="warning">已合併</StatusTag> : work.dupGroup ? <StatusTag tone="info">已關聯</StatusTag> : "—", sortValue: (work) => work.masterId ? 2 : work.dupGroup ? 1 : 0 },
    { key: "voided", title: "作廢", width: 80, render: (work) => work.voided ? <StatusTag tone="danger">已作廢</StatusTag> : "—", sortValue: (work) => work.voided ? 1 : 0 },
    { key: "address", title: "地址", width: 220 }, { key: "grid", title: "網格", width: 120 },
    { key: "createdAt", title: "建立時間", width: 150 }, { key: "updatedAt", title: "最後更新", width: 150 },
  ] satisfies Column<WorkRow>[]).map((column) => ({ ...column, sortable: true }));
  const counted = rows.filter((work) => !work.voided).length;
  return <div className="page-content wrk-page">
    <PageHeader title="工作記錄" actions={<><Button icon={<ExportOutlined />}>匯出</Button><Button variant="primary" icon={<PlusOutlined />} onClick={() => navigate("/works/new")}>新增工作</Button></>} />
    <section className="panel list-panel wrk-list-panel">
      <div className="wrk-modes" role="group" aria-label="快速篩選">
        <button type="button" className={!filters.mode ? "on" : ""} onClick={() => filter("mode", "")}>全部<span>{all.length}</span></button>
        {workModes.map((item) => <button type="button" key={item.key} className={filters.mode === item.key ? "on" : ""} aria-pressed={filters.mode === item.key} onClick={() => filter("mode", filters.mode === item.key ? "" : item.key)}>{item.label}<span>{all.filter((work) => item.test(view(work), signedIn)).length}</span></button>)}
      </div>
      <div className="filter-bar wrk-filter-bar">
        <label className="filter-field"><span>關鍵字</span><input aria-label="關鍵字" value={filters.keyword} onChange={(event) => filter("keyword", event.target.value)} placeholder="編號、摘要或地址" /></label>
        <label className="filter-field"><span>工作類型</span><Select ariaLabel="工作類型" value={filters.type} onChange={(value) => filter("type", value)}><option value="">全部工作類型</option>{workTypeTops.map((top) => <optgroup key={top} label={top}><option value={top}>{top}（全部）</option>{workTypeOptions.filter((option) => topType(option) === top).map((option) => <option key={option} value={option}>{option}</option>)}</optgroup>)}</Select></label>
        <label className="filter-field"><span>狀態</span><Select ariaLabel="狀態" value={filters.status} onChange={(value) => filter("status", value)}><option value="">全部狀態</option><option>新建</option><option>跟進中</option><option>已解決</option><option>已關閉</option></Select></label>
        <label className="filter-field"><span>執行群組</span><Select ariaLabel="執行群組" value={filters.group} onChange={(value) => filter("group", value)}><option value="">全部群組</option>{[...new Set(all.map((work) => work.group))].map((name) => <option key={name}>{name}</option>)}</Select></label>
        <label className="filter-field"><span>服務承諾</span><Select ariaLabel="服務承諾" value={filters.sla} onChange={(value) => filter("sla", value)}><option value="">全部</option><option>正常</option><option>將逾時</option><option>已逾時</option></Select></label>
        <label className="filter-field"><span>網格</span><Select ariaLabel="網格" value={filters.grid} onChange={(value) => filter("grid", value)}><option value="">全部網格</option>{[...gridNames(), "未歸屬"].map((name) => <option key={name}>{name}</option>)}</Select></label>
        <label className="filter-field"><span>優先級</span><Select ariaLabel="優先級" value={filters.priority} onChange={(value) => filter("priority", value)}><option value="">全部</option><option>一般</option><option>緊急</option><option>特急</option></Select></label>
        <label className="filter-field"><span>來源</span><Select ariaLabel="來源" value={filters.source} onChange={(value) => filter("source", value)}><option value="">全部來源</option>{sources.map((source) => <option key={source}>{source}</option>)}</Select></label>
        <label className="filter-field"><span>重複狀態</span><Select ariaLabel="重複狀態" value={filters.dup} onChange={(value) => filter("dup", value)}><option value="">全部</option><option>無</option><option>已關聯</option><option>已合併</option></Select></label>
        <label className="filter-field"><span>作廢</span><Select ariaLabel="作廢" value={filters.voided} onChange={(value) => filter("voided", value)}><option value="">全部</option><option>未作廢</option><option>已作廢</option></Select></label>
        <label className="filter-field"><span>建立日期（由）</span><input aria-label="建立日期由" type="date" value={filters.from} onChange={(event) => filter("from", event.target.value)} /></label>
        <label className="filter-field"><span>建立日期（至）</span><input aria-label="建立日期至" type="date" value={filters.to} onChange={(event) => filter("to", event.target.value)} /></label>
        <div className="user-filter-actions"><Button variant="text" icon={<ReloadOutlined />} onClick={() => { setFilters(emptyFilters); setPage(1); }}>重設</Button></div>
      </div>
      <DenseTable rows={rows} columns={columns} stickyActions actionTitle="操作" page={Math.min(page, Math.max(1, Math.ceil(rows.length / pageSize)))} pageSize={pageSize} onSort={() => setPage(1)} emptyText="沒有符合條件的工作" renderActions={(work) => <button className="table-action-button" aria-label={`查看 ${work.id}`} onClick={() => navigate(`/works/${work.id}`)}><EyeOutlined />查看</button>} />
      <Pagination total={rows.length} page={page} pageSize={pageSize} onPageChange={setPage} onPageSizeChange={(size) => { setPageSize(size); setPage(1); }} />
      <div className="insp-count-note"><InfoCircleOutlined />目前結果共 {rows.length} 筆，其中 {counted} 筆未作廢，計入統計報表；已作廢的工作不計入。服務承諾按所屬巡查及工作類型的規則即時計算。</div>
    </section>
  </div>;
}

// ---- 新增 ----
interface LinkState { planId: string; eventId: string; inspectionId: string; inspectionItem: string; objectId?: string }

export function WorkCreatePage() {
  const navigate = useNavigate(); const [params] = useSearchParams(); const { showToast } = useToast();
  const { works, events, plans, addWork, addWorkLogs, updateWorks, updateEvent } = useDemo(); const inspections = useInspections();
  const resolvedWorks = works.filter((work) => !work.pendingSync).map(resolveWork);
  const [initial] = useState(() => {
    const inspection = inspections.all.find((record) => record.id === params.get("inspection")); const item = params.get("item") ?? "";
    const event = events.find((entry) => entry.id === params.get("event"));
    const fromInspection = inspection && item ? prefillFromInspection(inspection, item) : undefined;
    const fromEvent = !fromInspection && event ? prefillFromEvent(resolveEvent(event)) : undefined;
    const link: LinkState = { planId: params.get("plan") ?? inspection?.planId ?? event?.planId ?? "", eventId: event?.id ?? "", inspectionId: inspection?.id ?? "", inspectionItem: fromInspection ? item : "", objectId: inspection?.objectId };
    return { prefill: fromInspection ?? fromEvent, link };
  });
  const apply = (prefill: WorkPrefill | undefined, form: WorkFormState): WorkFormState => prefill ? { ...form, title: prefill.title, type: prefill.type, description: prefill.description, address: prefill.address, addressTouched: true, x: prefill.x, y: prefill.y } : form;
  const [form, setForm] = useState<WorkFormState>(() => apply(initial.prefill, emptyWorkForm()));
  const [link, setLink] = useState<LinkState>(initial.link); const [prefillNote, setPrefillNote] = useState(initial.prefill?.note ?? "");
  const [issues, setIssues] = useState<WorkIssue[]>([]); const [duplicates, setDuplicates] = useState<Work[] | null>(null);
  const change = (patch: Partial<WorkFormState>) => { setForm((current) => ({ ...current, ...patch })); setIssues([]); };
  const grid = form.x !== undefined && form.y !== undefined ? gridOf(form.x, form.y) : "";
  const suggestion = form.type && grid ? dispatchWork(form.type, grid, link.objectId) : undefined;
  const effective = form.groupTouched ? form.group : suggestion?.group ?? "";
  const source = link.inspectionId ? "巡查" : link.eventId ? "事件" : link.planId ? "計劃" : "獨立";
  const chosenInspection = inspections.all.find((record) => record.id === link.inspectionId);
  const chosenEvent = events.find((event) => event.id === link.eventId);
  const validate = () => validateWork(toDraft(form, effective), form.type && !workTypeOptions.includes(form.type) ? [form.type, ...workTypeOptions] : workTypeOptions);

  const create = (mode: "plain" | "merge", candidates: Work[] = []) => {
    const time = nowText(); const id = nextIds("WK", works.map((work) => work.id), dateKey(time), 1)[0];
    const work: Work = { id, title: form.title.trim(), type: form.type, source, priority: form.priority, status: "新建", group: effective, grid, address: form.address.trim(), sla: "正常", createdAt: time, updatedAt: time, description: form.description.trim() || form.title.trim(), creator: signedIn, x: form.x, y: form.y, attachments: form.attachments, planId: link.planId || undefined, eventId: link.eventId || undefined, inspectionId: link.inspectionId || undefined, inspectionItem: link.inspectionItem || undefined, objectId: link.objectId };
    const logs: WorkLogEntry[] = [{ id: logId(), workId: id, action: "建立工作", to: "新建", operator: signedIn, time, location: "後台操作（無定位）", comment: `由${source}建立${prefillNote ? `（${prefillNote}）` : ""}` }];
    logs.push({ id: logId(), workId: id, action: "自動分派", operator: "系統", time, location: "—", comment: form.groupTouched && suggestion && suggestion.group !== effective ? `手動指定執行群組「${effective}」（自動建議：${suggestion.group}，${suggestion.reason}）` : suggestion ? `${suggestion.reason}，分派至 ${effective}${suggestion.auto ? "" : "（待人工分派，已通知管理群組）"}` : `手動指定執行群組「${effective}」` });
    addWork(work);
    if (mode === "merge") {
      const merged = mergeDuplicates(work, candidates, { time, operator: signedIn, idPrefix: logId() });
      if (merged.error) showToast(merged.error, "error"); else { updateWorks(merged.patches!); logs.push(...merged.logs!); }
    }
    addWorkLogs(logs);
    if (chosenEvent) updateEvent(chosenEvent.id, { workIds: [...new Set([...chosenEvent.workIds, id])] });
    showToast(mode === "merge" ? `工作已建立，並合併 ${candidates.length} 宗重複工作` : "工作已建立並完成自動分派"); navigate(`/works/${id}`);
  };
  const save = () => {
    const found = validate();
    if (found.length) { setIssues(found); showToast(`請修正 ${found.length} 項問題`, "error"); window.scrollTo?.({ top: 0 }); return; }
    const candidates = findDuplicateCandidates(resolvedWorks, { id: "", type: form.type, x: form.x, y: form.y });
    if (candidates.length) { setDuplicates(candidates); return; }
    create("plain");
  };
  const linkExisting = (existing: Work) => {
    const time = nowText(); const patch: Partial<Work> = { updatedAt: time, ...(link.eventId && !existing.eventId ? { eventId: link.eventId } : {}), ...(link.inspectionId && !existing.inspectionId ? { inspectionId: link.inspectionId, inspectionItem: link.inspectionItem || undefined } : {}) };
    updateWorks([{ id: existing.id, patch }]);
    if (chosenEvent) updateEvent(chosenEvent.id, { workIds: [...new Set([...chosenEvent.workIds, existing.id])] });
    if (link.eventId || link.inspectionId) addWorkLogs([{ id: logId(), workId: existing.id, action: "關聯", operator: signedIn, time, location: "後台操作（無定位）", comment: `與${link.inspectionId ? `巡查 ${link.inspectionId}` : `事件 ${link.eventId}`} 建立關聯（疑似重複，改為關聯現有工作）` }]);
    showToast(`已關聯現有工作 ${existing.id}`); navigate(`/works/${existing.id}`);
  };
  const eventOptions = events.filter((event) => !event.pendingSync);
  return <div className="page-content wrk-create-page">
    <PageHeader eyebrow="工作記錄 / 新增工作" title="新增工作" actions={<><Button onClick={() => navigate("/works")}>取消</Button><Button variant="primary" icon={<CheckOutlined />} onClick={save}>建立工作</Button></>} />
    <IssueSummary issues={issues} />
    {prefillNote && <div className="plan-snapshot-note"><InfoCircleOutlined /><span>已按 {prefillNote} 預填工作類型、摘要、地址及位置，可自行修改。</span></div>}
    <div className="evt-form wrk-link-section"><section className="group-editor-section"><header><h3>來源及關聯</h3></header><div className="group-editor-grid">
      <Field label="來源"><input value={source} disabled /></Field>
      <Field label="所屬計劃" hint="不選即不關聯計劃"><Select ariaLabel="所屬計劃" value={link.planId} onChange={(planId) => setLink({ ...link, planId })}><option value="">不關聯計劃</option>{plans.map((plan) => <option key={plan.id} value={plan.id}>{plan.name}（{plan.id}）</option>)}</Select></Field>
      <Field label="關聯事件" hint="可按事件預填類型、地址及位置"><Select ariaLabel="關聯事件" value={link.eventId} onChange={(eventId) => setLink({ ...link, eventId, planId: link.planId || events.find((event) => event.id === eventId)?.planId || "" })}><option value="">不關聯事件</option>{eventOptions.map((event) => <option key={event.id} value={event.id}>{event.id} · {event.description}</option>)}</Select>
        {chosenEvent && <Button onClick={() => { const prefill = prefillFromEvent(resolveEvent(chosenEvent)); setForm(apply(prefill, form)); setPrefillNote(prefill.note); setIssues([]); }}>按事件預填</Button>}</Field>
      <Field label="關聯巡查" hint="選擇巡查項目後可預填"><Select ariaLabel="關聯巡查" value={link.inspectionId} onChange={(inspectionId) => { const record = inspections.all.find((item) => item.id === inspectionId); setLink({ ...link, inspectionId, inspectionItem: "", objectId: record?.objectId, planId: link.planId || record?.planId || "" }); }}><option value="">不關聯巡查</option>{inspections.all.filter((record) => record.status === "已完成").map((record) => <option key={record.id} value={record.id}>{record.id} · {record.snapshot.name}</option>)}</Select></Field>
      {chosenInspection && <Field label="巡查項目"><Select ariaLabel="巡查項目" value={link.inspectionItem} onChange={(inspectionItem) => setLink({ ...link, inspectionItem })}><option value="">不指定項目</option>{chosenInspection.snapshot.items.map((item) => <option key={item.key} value={item.key}>{item.name}</option>)}</Select>
        {link.inspectionItem && <Button onClick={() => { const prefill = prefillFromInspection(chosenInspection, link.inspectionItem); if (prefill) { setForm(apply(prefill, form)); setPrefillNote(prefill.note); setIssues([]); } }}>按巡查項目預填</Button>}</Field>}
    </div></section></div>
    <WorkForm form={form} issues={issues} group={{ effective, suggestion }} onChange={change} />
    {duplicates && <div className="overlay centered" role="presentation"><div className="dialog wrk-dup-dialog" role="alertdialog" aria-modal="true">
      <h2>發現疑似重複工作</h2><p>以下為同類型、{30} 米內、尚未關閉的工作。你可以關聯其中一宗、仍然新增，或新增後將它們合併為重複工作。</p>
      <ul>{duplicates.map((work) => <li key={work.id}><div><strong>{work.id} · {work.title}</strong><span>{work.type} · {work.status} · {work.group}</span></div><Button onClick={() => linkExisting(work)}>改為關聯此工作</Button></li>)}</ul>
      <div className="dialog-actions"><Button onClick={() => setDuplicates(null)}>取消</Button><Button onClick={() => { const list = duplicates; setDuplicates(null); create("merge", list); }}>新增並合併重複</Button><Button variant="primary" onClick={() => { setDuplicates(null); create("plain"); }}>仍然新增</Button></div>
    </div></div>}
  </div>;
}

// ---- 服務承諾規則（唯讀） ----
export function WorkSlaPage() {
  const rows = defaultSlaRules.map((rule) => ({ ...rule, id: rule.id }));
  const columns: Column<(typeof rows)[number]>[] = [
    { key: "id", title: "規則", width: 90 }, { key: "name", title: "名稱", width: 200 },
    { key: "inspectionType", title: "巡查類型", width: 130, render: (rule) => rule.inspectionType ?? "任何" }, { key: "topType", title: "工作類型", width: 110, render: (rule) => rule.topType ?? "任何" },
    { key: "assign", title: "分派時限", width: 100, render: (rule) => `${rule.limits.assign} 小時` }, { key: "firstReply", title: "初覆時限", width: 100, render: (rule) => `${rule.limits.firstReply} 小時` },
    { key: "resolve", title: "解決時限", width: 100, render: (rule) => `${rule.limits.resolve} 小時` }, { key: "complete", title: "完成時限", width: 100, render: (rule) => `${rule.limits.complete} 小時` },
  ];
  // Work summaries with their own 服務承諾 (set on 巡查項目) take priority over the rules above for works created with that summary.
  const { items } = useDemo();
  const summaryRows = items.flatMap((item) => item.summaries.filter((entry) => entry.sla).map((entry) => ({ id: `${item.id}-${entry.id}`, item, entry, limits: entry.sla! })));
  const summaryColumns: Column<(typeof summaryRows)[number]>[] = [
    { key: "item", title: "巡查項目", width: 200, render: (row) => <Link to={`/config/items?item=${row.item.id}`}>{row.item.code} {row.item.name}</Link>, sortValue: (row) => row.item.code },
    { key: "summary", title: "工作摘要", width: 180, render: (row) => row.entry.summary, sortValue: (row) => row.entry.summary }, { key: "workType", title: "工作類型", width: 150, render: (row) => row.entry.workType },
    { key: "assign", title: "分派時限", width: 100, render: (row) => `${row.limits.assign} 小時` }, { key: "firstReply", title: "初覆時限", width: 100, render: (row) => `${row.limits.firstReply} 小時` },
    { key: "resolve", title: "解決時限", width: 100, render: (row) => `${row.limits.resolve} 小時` }, { key: "complete", title: "完成時限", width: 100, render: (row) => `${row.limits.complete} 小時` },
  ];
  return <div className="page-content wrk-sla-page">
    <PageHeader title="服務承諾" />
    <section className="panel list-panel">
      <div className="insp-count-note"><InfoCircleOutlined />規則按順序比對，取第一條符合者：先看工作所屬巡查的類型及工作類型，再看工作類型，最後為默認。時限為「一般」優先級；{(Object.entries(priorityFactor) as [string, number][]).map(([name, factor]) => `${name} ×${factor}`).join("、")}。此頁為示範配置，只供查閱。</div>
      <DenseTable rows={rows} columns={columns} />
      <h4 className="wrk-sla-sub">工作摘要服務承諾<span>在巡查項目為工作摘要設定；以該摘要（摘要文字相同）由巡查項目建立的工作，優先使用這些時限。</span></h4>
      <DenseTable rows={summaryRows} columns={summaryColumns} emptyText="尚未有工作摘要設定服務承諾" />
      <div className="wrk-sla-note"><strong>計時方式</strong><ul><li>分派時限：由建立（或重啟）至首次「跟進」。</li><li>初覆時限：至首次「留言」或「跟進」。</li><li>解決時限：至「解決」；完成時限：至「關閉」。</li><li>重啟後另起一輪計時，歷次記錄保留；剩餘時間 ≤ 20% 時標為「將逾時」。</li></ul>
        <Link to="/works">返回工作記錄</Link></div>
    </section>
  </div>;
}
