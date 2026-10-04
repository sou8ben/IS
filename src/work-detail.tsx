import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeftOutlined, EditOutlined, FileOutlined, InfoCircleOutlined, LinkOutlined, StopOutlined, WarningFilled } from "@ant-design/icons";
import { AttachmentField } from "./attachments";
import { Button, DenseTable, Field, FormDrawer, Select, StatusTag, useToast } from "./components";
import { dispatchWork, latLng } from "./event-data";
import { useInspections } from "./inspection-data";
import { policyUsers, workPolicyObject, type PolicyUser } from "./permission-rules";
import { usePermissionRules } from "./permission-store";
import { useAppPlanState } from "./plan-data";
import { LegendItem, PlanMap, type MapLayerChip, type MapMarkerSpec } from "./plan-map";
import { useDemo } from "./store";
import type { Column, Work } from "./types";
import { IssueSummary, toDraft, WorkForm, type WorkFormState } from "./work-form";
import { commentTemplates, defaultIdentityFor, gridOf, groupOptions, notificationsFor, nowText, operationForAction, resolveWork, schemeFor, slaFor, useInspectionRefs, useWorkLogs, workTypeConfig, workTypeOptions } from "./work-data";
import {
  allowedActions, applyAction, canEdit, diffWork, durationText, findDuplicateCandidates, linkDuplicateGroup, mergeDuplicates, operationPoint, renderTemplate, statusTarget, syncPeers, topType, validateWork,
  type ActionPayload, type WorkAction, type WorkIssue, type WorkLogEntry, type WorkStatus,
} from "./work-rules";
import type { AttachmentRef } from "./inspection-rules";

const signedIn = policyUsers[0].name;
const dateKey = (text: string) => text.slice(0, 10).replace(/-/g, "");
const logId = () => `WL-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
const statusActions: WorkAction[] = ["跟進", "解決", "關閉", "重啟", "重新分派"];
const toneOfAction = (action: string) => action === "跟進" ? "todo" as const : action === "解決" || action === "關閉" ? "done" as const : action === "重啟" ? "issue" as const : action === "重新分派" ? "event" as const : "object" as const;
const metricTone = (state: string) => state === "已逾時" || state === "超時完成" ? "danger" as const : state === "將逾時" ? "warning" as const : state === "達標" ? "success" as const : "neutral" as const;
const commentLabel: Record<WorkAction, string> = { "跟進": "備註（選填）", "解決": "處理說明", "關閉": "驗收意見", "重啟": "重啟原因", "重新分派": "重新分派原因", "留言": "留言內容", "作廢": "作廢原因", "解除作廢": "解除作廢原因" };

export function WorkDetailPage() {
  const { id = "" } = useParams(); const navigate = useNavigate(); const { works } = useDemo();
  const work = works.find((item) => item.id === id);
  if (!work) return <div className="page-content center-state"><WarningFilled /><h1>找不到工作</h1><p>工作「{id}」不存在。</p><Button onClick={() => navigate("/works")}>返回列表</Button></div>;
  return <WorkDetail key={work.id} work={resolveWork(work)} />;
}

type Drawer = { kind: "action"; action: WorkAction } | { kind: "edit" | "link" | "dup" } | null;
type Tab = "處理流程" | "基本資料" | "留言" | "關聯記錄" | "附件" | "項目通知";
interface SyncPrompt { action: WorkAction; payload: ActionPayload; identity: PolicyUser; prior: WorkStatus; peers: Work[] }

function WorkDetail({ work }: { work: Work }) {
  const navigate = useNavigate(); const { showToast } = useToast(); const { rules, authorize } = usePermissionRules();
  const { works, events, plans, updateWorks, addWorkLogs } = useDemo(); const logs = useWorkLogs(); const app = useAppPlanState(); const inspectionStore = useInspections();
  const [tab, setTab] = useState<Tab>("處理流程"); const [drawer, setDrawer] = useState<Drawer>(null); const [selected, setSelected] = useState<string | null>(null);
  const [layers, setLayers] = useState({ work: true, ops: true }); const [round, setRound] = useState<number | undefined>(); const [sync, setSync] = useState<SyncPrompt | null>(null);
  const resolvedWorks = works.filter((item) => !item.pendingSync).map(resolveWork);
  const ownLogs = logs.filter((log) => log.workId === work.id);
  const master = work.masterId ? resolvedWorks.find((item) => item.id === work.masterId) : undefined;
  const masterLogs = master ? logs.filter((log) => log.workId === master.id) : [];
  const merged = resolvedWorks.filter((item) => item.masterId === work.id);
  const peers = work.dupGroup ? resolvedWorks.filter((item) => item.id !== work.id && item.dupGroup === work.dupGroup && !item.masterId) : [];
  const plan = plans.find((item) => item.id === work.planId); const event = events.find((item) => item.id === work.eventId || item.workIds.includes(work.id)); const inspection = inspectionStore.all.find((item) => item.id === work.inspectionId);
  const inspectionRefs = useInspectionRefs();
  const sla = slaFor(work, logs, inspectionRefs, undefined, round); const allowed = allowedActions(work);
  const itemNotices = notificationsFor(work, logs, inspectionRefs);
  const point = work.x !== undefined && work.y !== undefined ? { x: work.x, y: work.y } : undefined;

  const markers: MapMarkerSpec[] = [];
  if (layers.work && point) markers.push({ id: "work", kind: "work", x: point.x, y: point.y, tone: "work", label: "工", title: work.title, detail: <span>{work.id} · {work.type}<br />{work.status} · {work.address}</span> });
  const located = ownLogs.map((log, index) => ({ log, index, at: point ? operationPoint(point, log) : null })).filter((entry) => entry.at);
  if (layers.ops) located.forEach(({ log, index, at }) => markers.push({ id: `op:${log.id}`, kind: "object", x: at![0], y: at![1], tone: toneOfAction(log.action), label: String(index + 1), title: `${index + 1}. ${log.action}`, detail: <span>{log.operator} · {log.time}<br />{log.location}{log.comment ? <><br />{log.comment}</> : null}</span> }));
  const chips: MapLayerChip[] = [{ key: "work", label: "工作位置", on: layers.work }, { key: "ops", label: "操作位置", count: located.length, on: layers.ops }];

  const afterAction = (done: SyncPrompt) => {
    setDrawer(null);
    if (statusActions.includes(done.action)) { const list = syncPeers(done.prior, work, resolvedWorks); if (list.length) { setSync({ ...done, peers: list }); return; } }
  };
  const runSync = (chosen: Work[]) => {
    if (!sync) return;
    const patches: { id: string; patch: Partial<Work> }[] = []; const newLogs: WorkLogEntry[] = []; const skipped: string[] = [];
    chosen.forEach((peer) => {
      const outcome = applyAction(peer, sync.action, { ...sync.payload, comment: `${sync.payload.comment ?? ""}（與 ${work.id} 同步處理）` }, { id: logId(), time: nowText(), operator: sync.identity.name, minAttachments: workTypeConfig[topType(peer.type)]?.resolveMinAttachments ?? 0, logs, scheme: schemeFor(peer, app.inspections) });
      const decision = outcome.patch ? authorize(operationForAction(sync.action), { object: workPolicyObject({ id: peer.id, group: peer.group, type: peer.type, grid: peer.grid, status: peer.status, creator: peer.creator, handler: peer.handler }) }, sync.identity) : undefined;
      if (outcome.patch && decision?.allowed) { patches.push({ id: peer.id, patch: outcome.patch as Partial<Work> }); newLogs.push(outcome.log!); } else skipped.push(peer.id);
    });
    if (patches.length) { updateWorks(patches); addWorkLogs(newLogs); }
    showToast(`已同步處理 ${patches.length} 宗工作${skipped.length ? `，${skipped.length} 宗未能處理（${skipped.join("、")}）` : ""}`, skipped.length ? "error" : undefined); setSync(null);
  };
  const unlink = () => { updateWorks([{ id: work.id, patch: { dupGroup: "" } }]); addWorkLogs([{ id: logId(), workId: work.id, action: "解除關聯", operator: signedIn, time: nowText(), location: "後台操作（無定位）", comment: `離開重複工作組 ${work.dupGroup}` }]); showToast("已解除重複工作關聯"); };

  const peerColumns: Column<Work>[] = [{ key: "id", title: "工作編號", width: 160 }, { key: "title", title: "工作摘要", width: 220 }, { key: "status", title: "狀態", width: 90, render: (item) => <StatusTag>{item.status}</StatusTag> }, { key: "group", title: "執行群組", width: 140 }];
  const attachments: { file: AttachmentRef; from: string }[] = [...(work.attachments ?? []).map((file) => ({ file, from: "建立時上傳" })), ...ownLogs.flatMap((log) => (log.attachments ?? []).map((file) => ({ file, from: `${log.action} · ${log.time}` })))];
  const commentLogs = ownLogs.filter((log) => log.action === "留言");

  return <div className="page-content detail-page wrk-detail-page">
    <PageHeader2 work={work} allowed={allowed} onBack={() => navigate("/works")} onAction={(action) => setDrawer({ kind: "action", action })} onOpen={(kind) => setDrawer({ kind })} />
    {work.voided && <div className="insp-void-banner" role="status"><StopOutlined /><span><strong>此工作已作廢</strong>，不參與統計報表計算。</span></div>}
    {master && <div className="plan-snapshot-note wrk-merged-note"><InfoCircleOutlined /><span>此工作已合併為重複工作，保留工作為 <Link to={`/works/${master.id}`}>{master.id} · {master.title}</Link>；下方同時顯示保留工作的處理流程。</span></div>}
    <div className="status-strip wrk-status-strip">
      <div><span>工作編號</span><strong>{work.id}</strong></div><div><span>狀態</span><StatusTag>{work.status}</StatusTag></div><div><span>優先級</span><StatusTag>{work.priority}</StatusTag></div>
      <div><span>服務承諾</span><StatusTag tone={sla.overall === "已逾時" ? "danger" : sla.overall === "將逾時" ? "warning" : "success"}>{sla.overall}</StatusTag></div>
      <div><span>執行群組</span><strong>{work.group}</strong></div><div><span>工作類型</span><strong>{work.type}</strong></div><div><span>來源</span><strong>{work.source}</strong></div><div><span>重啟次數</span><strong>{work.reopenCount ?? 0}</strong></div>
    </div>
    <div className="wrk-top-grid">
      <section className="panel plan-map-panel wrk-map-panel"><PlanMap markers={markers} layers={chips} onToggleLayer={(key) => setLayers((current) => ({ ...current, [key]: !current[key as keyof typeof current] }))} selected={selected} onSelect={setSelected} fitKey={work.id}
        legend={<><LegendItem tone="work">工作位置</LegendItem><LegendItem tone="todo">跟進</LegendItem><LegendItem tone="done">解決／關閉</LegendItem><LegendItem tone="issue">重啟</LegendItem><LegendItem tone="event">改派</LegendItem></>} /><div className="wrk-map-note">{ownLogs.length - located.length > 0 ? `${ownLogs.length - located.length} 筆操作沒有定位（後台操作或系統記錄），不顯示於地圖。` : "所有操作均有定位。"}操作位置為示範推算。</div></section>
      <section className="panel wrk-sla-panel"><header><div><h2>服務承諾</h2><p>{sla.schemeName} · 第 {sla.round} / {sla.rounds} 輪（自 {sla.roundStart}）</p></div><StatusTag tone={sla.overall === "已逾時" ? "danger" : sla.overall === "將逾時" ? "warning" : "success"}>{sla.overall}</StatusTag></header>
        <div className="wrk-sla-text">{sla.text}</div>
        {sla.rounds > 1 && <div className="wrk-sla-round"><Select ariaLabel="計時輪次" value={String(sla.round)} onChange={(value) => setRound(Number(value))}>{Array.from({ length: sla.rounds }, (_, index) => <option key={index} value={index + 1}>第 {index + 1} 輪{index + 1 === sla.rounds ? "（目前）" : ""}</option>)}</Select></div>}
        <ul className="wrk-sla-metrics">{sla.metrics.map((metric) => <li key={metric.key}><div><strong>{metric.label}</strong><StatusTag tone={metricTone(metric.state)}>{metric.state}</StatusTag></div><div className="wrk-sla-bar"><i className={`tone-${metricTone(metric.state)}`} style={{ width: `${metric.state === "—" ? 0 : Math.min(100, metric.usedMin / metric.limitMin * 100)}%` }} /></div><small>{metric.state === "—" ? "未計（直接進入後續步驟）" : `已用 ${durationText(metric.usedMin)} / 限 ${durationText(metric.limitMin)}${metric.done ? "" : metric.remainingMin >= 0 ? `，剩餘 ${durationText(metric.remainingMin)}` : `，已逾 ${durationText(metric.remainingMin)}`}`}</small></li>)}</ul>
      </section>
    </div>
    <section className="panel tab-panel wrk-tab-panel"><nav>{(["處理流程", "基本資料", "留言", "關聯記錄", "附件", ...(itemNotices.item ? ["項目通知"] : [])] as Tab[]).map((name) => <button key={name} className={tab === name ? "active" : ""} onClick={() => setTab(name)}>{name}<span>{name === "處理流程" ? ownLogs.length : name === "留言" ? commentLogs.length : name === "附件" ? attachments.length : name === "關聯記錄" ? peers.length + merged.length + [plan, event, inspection, master].filter(Boolean).length : name === "項目通知" ? itemNotices.results.filter((result) => result.triggered).length : "·"}</span></button>)}</nav>
      <div className="wrk-tab-body">
        {tab === "處理流程" && <><Timeline logs={ownLogs} />{master && <div className="wrk-master-timeline"><h4>保留工作 {master.id} 的處理流程</h4><Timeline logs={masterLogs} /></div>}</>}
        {tab === "基本資料" && <dl className="description-grid">
          <div><dt>工作類型</dt><dd>{work.type}</dd></div><div><dt>優先級</dt><dd>{work.priority}</dd></div><div className="wide"><dt>工作摘要</dt><dd>{work.title}</dd></div><div className="wide"><dt>描述</dt><dd>{work.description || "—"}</dd></div>
          <div className="wide"><dt>地址</dt><dd>{work.address}</dd></div><div><dt>經緯度</dt><dd>{point ? latLng(point.x, point.y) : "—"}</dd></div><div><dt>網格</dt><dd>{work.grid}</dd></div>
          <div><dt>建立人</dt><dd>{work.creator ?? "—"}</dd></div><div><dt>處理人</dt><dd>{work.handler ?? "—"}</dd></div><div><dt>建立時間</dt><dd>{work.createdAt}</dd></div><div><dt>最後更新</dt><dd>{work.updatedAt}</dd></div></dl>}
        {tab === "留言" && <div><div className="wrk-comment-bar"><Button variant="primary" disabled={!allowed.includes("留言")} onClick={() => setDrawer({ kind: "action", action: "留言" })}>新增留言</Button></div>{commentLogs.length ? <Timeline logs={commentLogs} /> : <div className="empty-state"><strong>暫無留言</strong></div>}</div>}
        {tab === "關聯記錄" && <div className="wrk-links">
          <ul className="wrk-link-list">
            <li><span>所屬計劃</span>{plan ? <Link to={`/plans/${plan.id}`}>{plan.id} · {plan.name}</Link> : "—"}</li>
            <li><span>關聯事件</span>{event ? <Link to={`/events/${event.id}`}>{event.id} · {event.description}</Link> : "—"}</li>
            <li><span>關聯巡查</span>{inspection ? <Link to={`/inspections/${inspection.id}`}>{inspection.id} · {inspection.snapshot.name}{work.inspectionItem ? `（${inspection.snapshot.items.find((item) => item.key === work.inspectionItem)?.name ?? work.inspectionItem}）` : ""}</Link> : "—"}</li>
            {master && <li><span>保留工作</span><Link to={`/works/${master.id}`}>{master.id} · {master.title}</Link></li>}
          </ul>
          {merged.length > 0 && <><h4>已合併至本工作的重複工作</h4><DenseTable rows={merged} columns={peerColumns} stickyActions actionTitle="操作" renderActions={(item) => <button className="table-action-button" onClick={() => navigate(`/works/${item.id}`)}>查看</button>} /></>}
          {work.dupGroup && <><div className="wrk-links-head"><h4>重複工作組 {work.dupGroup}（只登記關聯）</h4><Button onClick={unlink}>解除關聯</Button></div>{peers.length ? <DenseTable rows={peers} columns={peerColumns} stickyActions actionTitle="操作" renderActions={(item) => <button className="table-action-button" onClick={() => navigate(`/works/${item.id}`)}>查看</button>} /> : <div className="evt-empty">組內暫無其他工作</div>}</>}
        </div>}
        {tab === "項目通知" && itemNotices.item && <div className="wrk-item-notices">
          <p className="plan-hint">此工作由巡查項目「{itemNotices.item.name}」建立，按該項目設定的客製化工作通知，以示範時鐘即時評估；已觸發的通知會出現在通知中心（示範，不會真正發送）。<Link to={`/config/items?item=${itemNotices.item.id}`}>前往巡查項目</Link></p>
          {itemNotices.results.length ? <ul>{itemNotices.results.map((result) => <li key={result.rule.id} className={result.triggered ? "on" : result.applicable ? "wait" : "off"}>
            <header><strong>{result.rule.name}</strong><StatusTag tone={result.triggered ? "danger" : result.applicable ? "warning" : "neutral"}>{result.triggered ? "已觸發" : result.applicable ? "未觸發" : "不適用"}</StatusTag><span>{result.rule.level}</span></header>
            <span>條件：{result.rule.since === "建立" ? "建立" : "最後狀態變更"}後 {result.rule.hours} 小時仍處於 {result.rule.states.join("／")}（起點 {result.base}，{result.triggered ? "已於" : "預計"} {result.dueAt} 觸發）{!result.applicable && `；目前狀態為 ${work.status}${work.voided ? "（已作廢）" : ""}`}</span>
            <span>通知對象：{result.recipients.join("、")}</span><span>內容：{result.message}</span>
          </li>)}</ul> : <div className="evt-empty">此巡查項目沒有啟用中的工作通知</div>}
        </div>}
        {tab === "附件" && (attachments.length ? <div className="insp-attach-all">{attachments.map(({ file, from }) => <a key={file.id} href={file.src} target="_blank" rel="noreferrer" className={file.src ? "" : "nolink"}>{file.src ? <img src={file.src} alt={file.name} /> : <FileOutlined />}<span>{file.name}</span><small>{from}</small></a>)}</div> : <div className="empty-state"><strong>暫無附件</strong></div>)}
      </div>
    </section>
    {drawer?.kind === "action" && <ActionDrawer work={work} action={drawer.action} logs={logs} onClose={() => setDrawer(null)} onDone={afterAction} />}
    {drawer?.kind === "edit" && <EditWorkDrawer work={work} onClose={() => setDrawer(null)} onSaved={() => { setDrawer(null); showToast("工作已更新"); }} />}
    {drawer?.kind === "link" && <LinkDrawer work={work} onClose={() => setDrawer(null)} onSaved={() => { setDrawer(null); showToast("關聯已更新"); }} />}
    {drawer?.kind === "dup" && <DuplicateDrawer work={work} all={resolvedWorks} onClose={() => setDrawer(null)} onDone={(text) => { setDrawer(null); showToast(text); }} />}
    {sync && <div className="overlay centered" role="presentation"><div className="dialog wrk-dup-dialog" role="alertdialog" aria-modal="true"><SyncList sync={sync} workId={work.id} onCancel={() => setSync(null)} onConfirm={runSync} /></div></div>}
  </div>;
}

function PageHeader2({ work, allowed, onBack, onAction, onOpen }: { work: Work; allowed: WorkAction[]; onBack: () => void; onAction: (action: WorkAction) => void; onOpen: (kind: "edit" | "link" | "dup") => void }) {
  const statusFirst = allowed.find((action) => statusActions.includes(action));
  return <div className="page-header"><div><div className="eyebrow">工作記錄 / 工作詳情</div><h1>{work.title}</h1></div><div className="page-actions">
    <Button icon={<ArrowLeftOutlined />} onClick={onBack}>返回列表</Button>
    {allowed.filter((action) => statusActions.includes(action)).map((action) => <Button key={action} variant={action === statusFirst ? "primary" : "default"} onClick={() => onAction(action)}>{action}</Button>)}
    {allowed.includes("留言") && <Button onClick={() => onAction("留言")}>留言</Button>}
    {canEdit(work) && <Button icon={<EditOutlined />} onClick={() => onOpen("edit")}>編輯</Button>}
    {!work.voided && <><Button icon={<LinkOutlined />} onClick={() => onOpen("link")}>關聯</Button><Button onClick={() => onOpen("dup")}>重複工作</Button></>}
    {allowed.includes("作廢") && <Button variant="danger" onClick={() => onAction("作廢")}>作廢</Button>}
    {allowed.includes("解除作廢") && <Button variant="primary" onClick={() => onAction("解除作廢")}>解除作廢</Button>}
  </div></div>;
}

function Timeline({ logs }: { logs: WorkLogEntry[] }) {
  if (!logs.length) return <div className="empty-state"><strong>暫無處理記錄</strong></div>;
  return <ol className="wrk-timeline">{[...logs].reverse().map((log) => <li key={log.id}>
    <span className={`wrk-dot tone-${toneOfAction(log.action)}`} />
    <div className="wrk-entry"><header><strong>{log.action}</strong>{log.from && log.to && <span className="wrk-change"><StatusTag>{log.from}</StatusTag>→<StatusTag>{log.to}</StatusTag></span>}<time>{log.time}</time></header>
      <div className="wrk-entry-meta">{log.operator} · {log.location}</div>{log.comment && <p>{log.comment}</p>}
      {log.attachments?.length ? <div className="wrk-entry-files">{log.attachments.map((file) => file.src ? <a key={file.id} href={file.src} target="_blank" rel="noreferrer"><img src={file.src} alt={file.name} /></a> : <span key={file.id}><FileOutlined />{file.name}</span>)}</div> : null}</div></li>)}</ol>;
}

function SyncList({ sync, workId, onCancel, onConfirm }: { sync: SyncPrompt; workId: string; onCancel: () => void; onConfirm: (chosen: Work[]) => void }) {
  const [chosen, setChosen] = useState<string[]>(sync.peers.map((peer) => peer.id));
  return <><h2>同步處理關聯工作？</h2><p>以下工作與 {workId} 同屬重複工作組，且同為「{sync.prior}」。勾選的工作將同步執行「{sync.action}」。</p>
    <ul>{sync.peers.map((peer) => <li key={peer.id}><label className="wrk-sync-row"><input type="checkbox" checked={chosen.includes(peer.id)} onChange={() => setChosen((current) => current.includes(peer.id) ? current.filter((id) => id !== peer.id) : [...current, peer.id])} /><span><strong>{peer.id} · {peer.title}</strong><small>{peer.type} · {peer.group}</small></span></label></li>)}</ul>
    <div className="dialog-actions"><Button onClick={onCancel}>不用</Button><Button variant="primary" disabled={!chosen.length} onClick={() => onConfirm(sync.peers.filter((peer) => chosen.includes(peer.id)))}>同步執行</Button></div></>;
}

// ---- 處理操作 ----
function ActionDrawer({ work, action, logs, onClose, onDone }: { work: Work; action: WorkAction; logs: WorkLogEntry[]; onClose: () => void; onDone: (done: SyncPrompt) => void }) {
  const { rules, authorize } = usePermissionRules(); const { updateWorks, addWorkLogs } = useDemo(); const inspectionRefs = useInspectionRefs(); const { showToast } = useToast();
  const [comment, setComment] = useState(""); const [group, setGroup] = useState(""); const [files, setFiles] = useState<AttachmentRef[]>([]); const [error, setError] = useState("");
  const [identityId, setIdentityId] = useState(() => defaultIdentityFor(action, work, rules).id);
  const target = statusTarget[action]; const minAttachments = action === "解決" ? workTypeConfig[topType(work.type)]?.resolveMinAttachments ?? 0 : 0;
  const templates = commentTemplates.filter((template) => (template.status as string[]).includes(work.status));
  const identity = policyUsers.find((user) => user.id === identityId) ?? policyUsers[0];
  const submit = () => {
    const payload: ActionPayload = { comment, group, attachmentCount: files.length, attachments: files };
    const outcome = applyAction(work, action, payload, { id: logId(), time: nowText(), operator: identity.name, minAttachments, logs, scheme: schemeFor(work, inspectionRefs) });
    if (!outcome.patch) { setError(outcome.error ?? "無法執行此操作。"); return; }
    const decision = authorize(operationForAction(action), { object: workPolicyObject({ id: work.id, group: work.group, type: work.type, grid: work.grid, status: work.status, creator: work.creator, handler: work.handler }) }, identity);
    if (!decision.allowed) { setError(`權限校驗未通過：${decision.reason}`); return; }
    updateWorks([{ id: work.id, patch: outcome.patch as Partial<Work> }]); addWorkLogs([outcome.log!]); showToast(`已${action}`);
    onDone({ action, payload, identity, prior: work.status, peers: [] });
  };
  return <FormDrawer open title={`${action}工作`} subtitle={work.id} onClose={onClose} onSubmit={submit} submitLabel={`確認${action}`} className="evt-drawer">
    <div className="evt-drawer-body">{error && <div className="evt-error" role="alert">{error}</div>}
      <div className="wrk-action-summary"><strong>{work.title}</strong><span>{target ? <><StatusTag>{work.status}</StatusTag> → <StatusTag>{target}</StatusTag></> : "不改變工作狀態"}</span></div>
      {action === "重新分派" && <Field label="新執行群組" required><Select ariaLabel="新執行群組" value={group} onChange={(value) => { setGroup(value); setError(""); }}><option value="">請選擇新執行群組</option>{groupOptions.filter((name) => name !== work.group).map((name) => <option key={name}>{name}</option>)}</Select></Field>}
      {action === "留言" && templates.length > 0 && <div className="wrk-templates"><span>留言模板</span><div>{templates.map((template) => <button type="button" key={template.title} onClick={() => { setComment(renderTemplate(template.content, { "當前時間": nowText().slice(11), "工作編號": work.id, "工作類型": work.type, "操作人": identity.name })); setError(""); }}>{template.title}</button>)}</div></div>}
      <Field label={commentLabel[action]} required={action !== "跟進"}><textarea rows={5} value={comment} onChange={(event) => { setComment(event.target.value); setError(""); }} placeholder={action === "留言" ? "可選擇上方模板後再修改" : "請輸入說明"} /></Field>
      {action === "解決" && <div className="field"><span>{minAttachments > 0 && <b>*</b>}附件{minAttachments > 0 ? `（此工作類型最少 ${minAttachments} 個）` : "（選填）"}</span><AttachmentField files={files} min={minAttachments} usedChars={0} onChange={setFiles} /></div>}
      <Field label="提交身份（示範）" hint="提交時以此身份重新校驗功能權限及權責範圍，已預選能通過校驗的身份"><Select ariaLabel="提交身份" value={identityId} onChange={(value) => { setIdentityId(value); setError(""); }}>{policyUsers.map((user) => <option key={user.id} value={user.id}>{user.name}（{user.roles.join("、")}）</option>)}</Select></Field>
    </div>
  </FormDrawer>;
}

// ---- 編輯 ----
function EditWorkDrawer({ work, onClose, onSaved }: { work: Work; onClose: () => void; onSaved: () => void }) {
  const { updateWorks, addWorkLogs } = useDemo();
  const [form, setForm] = useState<WorkFormState>(() => ({ title: work.title, type: work.type, priority: work.priority, description: work.description, address: work.address, addressTouched: true, x: work.x, y: work.y, group: work.group, groupTouched: true, attachments: work.attachments ?? [] }));
  const [issues, setIssues] = useState<WorkIssue[]>([]);
  const change = (patch: Partial<WorkFormState>) => { setForm((current) => ({ ...current, ...patch })); setIssues([]); };
  const grid = form.x !== undefined && form.y !== undefined ? gridOf(form.x, form.y) : work.grid;
  const suggestion = form.type ? dispatchWork(form.type, grid, work.objectId) : undefined;
  const hint = suggestion && suggestion.group !== work.group && (form.type !== work.type || grid !== work.grid) ? `按新的類型及位置，自動分派建議為「${suggestion.group}」（${suggestion.reason}），目前為「${work.group}」。編輯不會更改執行群組，如需更改請使用「重新分派」。` : undefined;
  const save = () => {
    const found = validateWork(toDraft(form, work.group), form.type && !workTypeOptions.includes(form.type) ? [form.type, ...workTypeOptions] : workTypeOptions);
    if (found.length) { setIssues(found); return; }
    const before = { title: work.title, type: work.type, priority: work.priority, description: work.description, address: work.address, x: work.x, y: work.y };
    const after = { title: form.title.trim(), type: form.type, priority: form.priority, description: form.description.trim(), address: form.address.trim(), x: form.x, y: form.y };
    const lines = diffWork(before, after); const time = nowText();
    updateWorks([{ id: work.id, patch: { ...after, grid, attachments: form.attachments, updatedAt: time } }]);
    addWorkLogs([{ id: logId(), workId: work.id, action: "編輯工作", operator: signedIn, time, location: "後台操作（無定位）", comment: lines.join("；") || "更新附件或其他資料" }]);
    onSaved();
  };
  return <FormDrawer open title="編輯工作" subtitle={`${work.id} · 可修改類型、地址、位置、優先級等`} onClose={onClose} onSubmit={save} className="evt-drawer">
    <div className="evt-drawer-body"><IssueSummary issues={issues} /><WorkForm form={form} issues={issues} group={{ effective: work.group, locked: true, changedHint: hint }} onChange={change} /></div>
  </FormDrawer>;
}

// ---- 關聯 ----
function LinkDrawer({ work, onClose, onSaved }: { work: Work; onClose: () => void; onSaved: () => void }) {
  const { events, plans, updateWorks, addWorkLogs, updateEvent } = useDemo(); const inspections = useInspections();
  const currentEvent = events.find((item) => item.id === work.eventId || item.workIds.includes(work.id));
  const [eventId, setEventId] = useState(currentEvent?.id ?? ""); const [inspectionId, setInspectionId] = useState(work.inspectionId ?? ""); const [planId, setPlanId] = useState(work.planId ?? "");
  const save = () => {
    const time = nowText(); const lines: string[] = [];
    if (eventId !== (currentEvent?.id ?? "")) lines.push(`事件：${currentEvent?.id ?? "—"} → ${eventId || "—"}`);
    if (inspectionId !== (work.inspectionId ?? "")) lines.push(`巡查：${work.inspectionId || "—"} → ${inspectionId || "—"}`);
    if (planId !== (work.planId ?? "")) lines.push(`計劃：${work.planId || "—"} → ${planId || "—"}`);
    if (!lines.length) { onClose(); return; }
    updateWorks([{ id: work.id, patch: { eventId, inspectionId, planId, ...(inspectionId !== (work.inspectionId ?? "") ? { inspectionItem: "" } : {}), updatedAt: time } }]);
    if (currentEvent && currentEvent.id !== eventId) updateEvent(currentEvent.id, { workIds: currentEvent.workIds.filter((id) => id !== work.id) });
    const next = events.find((item) => item.id === eventId); if (next && !next.workIds.includes(work.id)) updateEvent(next.id, { workIds: [...next.workIds, work.id] });
    addWorkLogs([{ id: logId(), workId: work.id, action: "更改關聯", operator: signedIn, time, location: "後台操作（無定位）", comment: lines.join("；") }]);
    onSaved();
  };
  return <FormDrawer open title="關聯記錄" subtitle={`${work.id} · 關聯事件、巡查及計劃（留空即取消關聯）`} onClose={onClose} onSubmit={save} className="evt-drawer">
    <div className="evt-drawer-body"><div className="form-grid">
      <Field label="關聯事件"><Select ariaLabel="關聯事件" value={eventId} onChange={setEventId}><option value="">不關聯事件</option>{events.filter((item) => !item.pendingSync).map((item) => <option key={item.id} value={item.id}>{item.id} · {item.description}</option>)}</Select></Field>
      <Field label="關聯巡查"><Select ariaLabel="關聯巡查" value={inspectionId} onChange={setInspectionId}><option value="">不關聯巡查</option>{inspections.all.map((item) => <option key={item.id} value={item.id}>{item.id} · {item.snapshot.name}</option>)}</Select></Field>
      <Field label="所屬計劃"><Select ariaLabel="所屬計劃" value={planId} onChange={setPlanId}><option value="">不關聯計劃</option>{plans.map((item) => <option key={item.id} value={item.id}>{item.name}（{item.id}）</option>)}</Select></Field>
    </div></div>
  </FormDrawer>;
}

// ---- 重複工作 ----
function DuplicateDrawer({ work, all, onClose, onDone }: { work: Work; all: Work[]; onClose: () => void; onDone: (text: string) => void }) {
  const { updateWorks, addWorkLogs } = useDemo();
  const [mode, setMode] = useState<"merge" | "link">("merge");
  const candidates = findDuplicateCandidates(all, work); const others = all.filter((item) => item.id !== work.id && !item.voided && item.status !== "已關閉" && !item.masterId && !candidates.some((entry) => entry.id === item.id));
  const [picked, setPicked] = useState<string[]>(candidates.map((item) => item.id)); const [keep, setKeep] = useState(work.id); const [error, setError] = useState("");
  const toggle = (id: string) => { setPicked((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]); setError(""); };
  const members = [work, ...all.filter((item) => picked.includes(item.id))];
  const keepId = members.some((item) => item.id === keep) ? keep : work.id;
  const submit = () => {
    const time = nowText();
    if (mode === "merge") {
      const master = members.find((item) => item.id === keepId)!;
      const result = mergeDuplicates(master, members.filter((item) => item.id !== keepId), { time, operator: signedIn, idPrefix: logId() });
      if (!result.patches) { setError(result.error ?? ""); return; }
      updateWorks(result.patches); addWorkLogs(result.logs!); onDone(`已合併 ${result.patches.length} 宗重複工作，保留 ${master.id}`);
    } else {
      const numbers = all.map((item) => Number(item.dupGroup?.match(/DUP-(\d+)/)?.[1] ?? 0)); const next = `DUP-${String(Math.max(0, ...numbers) + 1).padStart(4, "0")}`;
      const result = linkDuplicateGroup(all, members.map((item) => item.id), next);
      if (!result.ids) { setError(result.error ?? ""); return; }
      updateWorks(result.ids.map((id) => ({ id, patch: { dupGroup: result.group } })));
      addWorkLogs(members.map((item): WorkLogEntry => ({ id: logId(), workId: item.id, action: "關聯重複工作", operator: signedIn, time, location: "後台操作（無定位）", comment: `加入重複工作組 ${result.group}（${result.ids!.join("、")}）` })));
      onDone(`已建立重複工作組 ${result.group}`);
    }
  };
  const row = (item: Work) => <li key={item.id}><label className="wrk-sync-row"><input type="checkbox" checked={picked.includes(item.id)} onChange={() => toggle(item.id)} /><span><strong>{item.id} · {item.title}</strong><small>{item.type} · {item.status} · {item.group}</small></span></label></li>;
  return <FormDrawer open title="重複工作" subtitle={work.id} onClose={onClose} onSubmit={submit} submitLabel={mode === "merge" ? "確認合併" : "確認關聯"} className="evt-drawer">
    <div className="evt-drawer-body">{error && <div className="evt-error" role="alert">{error}</div>}
      <div className="segmented wrk-segmented" role="tablist"><button type="button" role="tab" aria-selected={mode === "merge"} className={mode === "merge" ? "active" : ""} onClick={() => setMode("merge")}>合併模式</button><button type="button" role="tab" aria-selected={mode === "link"} className={mode === "link" ? "active" : ""} onClick={() => setMode("link")}>關聯模式</button></div>
      <p className="wrk-mode-hint">{mode === "merge" ? "選定保留工作，其餘工作按規則自動以「重複」原因關閉；被關閉的工作會顯示保留工作的處理流程。" : "只登記關聯。其中一宗的處理流程更新時，如其餘工作狀態相同，可選擇是否同步更新。"}</p>
      <h4>符合規則的工作（同類型、{30} 米內、未關閉）</h4>
      {candidates.length ? <ul className="wrk-sync-list">{candidates.map(row)}</ul> : <div className="evt-empty">沒有符合規則的工作</div>}
      {others.length > 0 && <details><summary>其他未關閉的工作（{others.length}）</summary><ul className="wrk-sync-list">{others.map(row)}</ul></details>}
      {mode === "merge" && <Field label="保留工作" required hint="其餘已選工作將被關閉並合併至保留工作"><Select ariaLabel="保留工作" value={keepId} onChange={setKeep}>{members.map((item) => <option key={item.id} value={item.id}>{item.id} · {item.title}{item.id === work.id ? "（本工作）" : ""}</option>)}</Select></Field>}
    </div>
  </FormDrawer>;
}
