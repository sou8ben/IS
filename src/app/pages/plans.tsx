import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { ActionSheet, Button, Checkbox, Dialog, Dropdown, Input, Radio, Selector, TextArea, Toast, type DropdownRef } from "antd-mobile";
import { AddOutline, CheckOutline, ClockCircleOutline, EnvironmentOutline, ExclamationCircleFill, FileOutline, MoreOutline, ScanningOutline, UnorderedListOutline } from "antd-mobile-icons";
import type { Plan } from "../../types";
import { AttachmentField, Card, Empty, FilterOptions, GroupTitle, InfoList, LegendDot, MapView, NfcPopup, Page, Progress, ReasonDialog, SignatureField, StatusTag, type MapMarker } from "../components";
import { eventMeta, myTrack, photoAssets, planRoutes } from "../data";
import { activeAppTemplates, appTemplate, itemsForInspection, templateAppliesTo } from "../../item-data";
import { auxEntriesFor, historyFromApp } from "../../aux-data";
import { getManagedObjects, getObject } from "../../object-data";
import { objectIndex } from "../../object-data";
import { groupTemplateItems, isAbnormal, nowText, shortTime, validateInspection, visiblePlans, workInspection, workPoint, type SubmitError } from "../rules";
import { useApp } from "../store";
import type { Inspection, ItemResult, TemplateItem } from "../types";

const TODAY = "2026-09-29";
const itemPhoto: Record<string, string> = { seat: photoAssets.seat, bin: photoAssets.bin, pipe: photoAssets.pipe, waste: photoAssets.bin, signage: photoAssets.sign, road: photoAssets.sign, rail: photoAssets.sign, buoy: photoAssets.sign, light: photoAssets.sign, play: photoAssets.seat };
export const inspectionAbnormal = (inspection: Inspection) => { return itemsForInspection(inspection).some((item) => isAbnormal(item, inspection.results[item.key]?.value)); };
const inspectionTone = (inspection: Inspection): MapMarker["tone"] => inspection.status === "已完成" ? (inspectionAbnormal(inspection) ? "issue" : "done") : "todo";

function PlanCard({ plan, works, selecting, checked, onToggle, onOpen, onLongPress }: { plan: Plan; works: number; selecting: boolean; checked: boolean; onToggle: () => void; onOpen: () => void; onLongPress: () => void }) {
  const timer = useRef<number>(0);
  const selectable = plan.status === "未開始" || plan.status === "已中止";
  const press = () => { timer.current = window.setTimeout(onLongPress, 520); };
  const release = () => window.clearTimeout(timer.current);
  return <div className={`m-plan-card ${checked ? "checked" : ""} ${selecting && !selectable ? "disabled" : ""}`} onPointerDown={press} onPointerUp={release} onPointerLeave={release} onContextMenu={(event) => { event.preventDefault(); onLongPress(); }}
    onClick={() => selecting ? selectable && onToggle() : onOpen()}>
    {selecting && <Checkbox checked={checked} disabled={!selectable} onClick={(event) => event.stopPropagation()} onChange={onToggle} />}
    <div className="m-plan-main">
      <div className="m-plan-title"><strong>{plan.name}</strong><StatusTag>{plan.status}</StatusTag></div>
      <span className="m-plan-meta"><ClockCircleOutline /> {shortTime(plan.startAt)}–{shortTime(plan.endAt)} · {plan.group}</span>
      <div className="m-plan-progress"><Progress value={plan.progress} total={plan.total} tone={plan.status === "已完成" ? "success" : "primary"} /><span>已執行 {plan.progress}/{plan.total}</span></div>
      <div className="m-plan-foot"><span>{plan.id}</span><span>關聯巡查 {plan.total}</span><span>關聯工作 {works}</span>{plan.executor && plan.status === "進行中" && <span className="exec">執行人 {plan.executor}</span>}</div>
    </div>
  </div>;
}

export function PlanListPage() {
  const { shared, persona, startPlans } = useApp(); const navigate = useNavigate();
  const [group, setGroup] = useState("全部"); const [date, setDate] = useState("今日"); const [status, setStatus] = useState("全部");
  const [selecting, setSelecting] = useState(false); const [selected, setSelected] = useState<string[]>([]);
  const dropdown = useRef<DropdownRef>(null);
  const mine = visiblePlans(shared.plans, persona);
  const rows = mine.filter((plan) => (group === "全部" || plan.group === group) && (date === "全部" || (date === "今日" ? plan.startAt.startsWith(TODAY) : plan.startAt >= "2026-09-27")) && (status === "全部" || plan.status === status));
  const hasActive = shared.plans.some((plan) => plan.status === "進行中" && plan.executor === persona.name);
  const inspectGroups = persona.groups.filter((item) => item.kind === "巡查").map((item) => item.name);
  const enterSelect = () => { if (hasActive) { Toast.show({ content: "已有計劃進行中，不可合併" }); return; } setSelecting(true); };
  const merge = () => {
    const error = startPlans(selected);
    if (error) { Dialog.alert({ title: "未能開始作業", content: error, confirmText: "知道了" }); return; }
    Toast.show({ icon: "success", content: `已合併並開始 ${selected.length} 個計劃` });
    navigate(`/plans/merge?ids=${selected.join(",")}`);
  };
  return <Page title="巡查計劃" back={false} right={<button className="m-nav-link" onClick={() => navigate("/inspections")}><UnorderedListOutline /> 巡查記錄</button>}
    footer={selecting ? <div className="m-footer-bar"><span>已選 {selected.length} 個計劃</span><Button onClick={() => { setSelecting(false); setSelected([]); }}>取消</Button><Button color="primary" disabled={selected.length < 2} onClick={merge}>合併開始作業</Button></div> : undefined}>
    <Dropdown className="m-dropdown" ref={dropdown}>
      <Dropdown.Item key="group" title={group === "全部" ? "全部所屬群組" : group}><FilterOptions value={group} options={[["全部", "全部所屬群組"], ...inspectGroups.map((name) => [name, name] as [string, string])]} onChange={(value) => { setGroup(value); dropdown.current?.close(); }} /></Dropdown.Item>
      <Dropdown.Item key="date" title={date}><FilterOptions value={date} options={[["今日", "今日"], ["本週", "本週"], ["全部", "全部日期"]]} onChange={(value) => { setDate(value); dropdown.current?.close(); }} /></Dropdown.Item>
      <Dropdown.Item key="status" title={status === "全部" ? "全部狀態" : status}><FilterOptions value={status} options={[["全部", "全部狀態"], ...["未開始", "進行中", "已中止", "已完成"].map((name) => [name, name] as [string, string])]} onChange={(value) => { setStatus(value); dropdown.current?.close(); }} /></Dropdown.Item>
    </Dropdown>
    <div className="m-list-hint">{selecting ? "選擇未開始或已中止的計劃，合併後一併加鎖" : "長按計劃卡片可多選合併作業"}<span>共 {rows.length} 個</span></div>
    {!inspectGroups.length ? <Empty title="你不屬任何巡查群組" text="巡查計劃只向指派的巡查群組成員顯示" /> : rows.length ? rows.map((plan) => <PlanCard key={plan.id} plan={plan} works={shared.works.filter((work) => work.planId === plan.id).length} selecting={selecting} checked={selected.includes(plan.id)}
      onToggle={() => setSelected(selected.includes(plan.id) ? selected.filter((id) => id !== plan.id) : [...selected, plan.id])} onOpen={() => navigate(`/plans/${plan.id}`)} onLongPress={() => { if (!selecting) { enterSelect(); if (!hasActive && (plan.status === "未開始" || plan.status === "已中止")) setSelected([plan.id]); } }} />)
      : <Empty title="沒有符合條件的計劃" text="請調整篩選條件" />}
  </Page>;
}

export function PlanWorkPage() {
  const { id } = useParams(); const [params] = useSearchParams(); const navigate = useNavigate();
  const { state, shared, persona, startPlans, stopPlans, finishPlans } = useApp();
  const ids = id ? [id] : (params.get("ids") ?? "").split(",").filter(Boolean);
  const plans = ids.map((planId) => shared.plans.find((plan) => plan.id === planId)).filter((plan): plan is Plan => !!plan);
  const [order, setOrder] = useState<"route" | "distance">("route");
  const [expanded, setExpanded] = useState(false);
  const [more, setMore] = useState(false); const [ops, setOps] = useState(false); const [nfc, setNfc] = useState(false);
  const [dialog, setDialog] = useState<"stop" | "finish" | null>(null);
  if (!plans.length) return <Page title="計劃作業"><Empty title="找不到計劃" /></Page>;
  const plan = plans[0];
  const inspections = state.inspections.filter((item) => item.planId && ids.includes(item.planId));
  const sorted = [...inspections].sort((a, b) => order === "route" ? (a.planId ?? "").localeCompare(b.planId ?? "") || a.seq - b.seq : (objectIndex[a.objectId]?.distance ?? 999) - (objectIndex[b.objectId]?.distance ?? 999));
  const done = inspections.filter((item) => item.status === "已完成").length;
  const mineActive = plans.every((item) => item.status === "進行中" && item.executor === persona.name);
  const otherExecutor = plans.find((item) => item.status === "進行中" && item.executor !== persona.name)?.executor;
  const works = shared.works.filter((work) => work.planId && ids.includes(work.planId));
  const events = shared.events.filter((event) => event.planId && ids.includes(event.planId));
  const markers: MapMarker[] = [
    ...inspections.map((item) => { const object = objectIndex[item.objectId]; return { id: item.id, x: object.x, y: object.y, tone: inspectionTone(item), index: item.seq, title: object.name, subtitle: `${item.status}${item.submittedAt ? ` · ${shortTime(item.submittedAt)}` : ""}`, openLabel: "巡查表", onOpen: () => navigate(`/inspections/${item.id}`) }; }),
    ...works.map((work) => ({ id: work.id, x: workPoint(work).x + 9, y: workPoint(work).y - 9, tone: "work" as const, index: "工", title: work.title, subtitle: `${work.id} · ${work.status}`, onOpen: () => navigate(`/works/${work.id}`) })),
    ...events.map((event) => ({ id: event.id, x: (event.x ?? eventMeta[event.id]?.x ?? 624) - 9, y: (event.y ?? eventMeta[event.id]?.y ?? 92) - 9, tone: "event" as const, index: "事", title: event.description, subtitle: event.id, onOpen: () => navigate(`/events/${event.id}`) })),
  ];
  const start = () => {
    const error = startPlans(ids);
    if (error) Dialog.alert({ title: "未能開始作業", content: error, confirmText: "知道了" });
    else Toast.show({ icon: "success", content: "已取得作業鎖，開始作業" });
  };
  const addActions = [
    { key: "inspection", text: "新增巡查", onClick: () => navigate(`/inspections/new?plan=${plan.id}`) },
    { key: "event", text: "新增事件", onClick: () => navigate(`/events/new?plan=${plan.id}`) },
    { key: "work", text: "新增工作", onClick: () => navigate(`/works/new?from=plan&plan=${plan.id}`) },
  ];
  const actions = [
    ...(mineActive ? addActions : []),
    ...(plan.status === "已完成" ? [{ key: "supplement", text: "補錄巡查／事件／工作", onClick: () => navigate(`/inspections/new?plan=${plan.id}&supplement=1`) }] : []),
    { key: "nfc", text: "掃描 NFC 標籤", onClick: () => setNfc(true) },
    { key: "ops", text: "作業記錄", onClick: () => setOps(true) },
  ];
  const footer = mineActive
    ? <div className="m-footer-bar"><Button onClick={() => setDialog("stop")}>中止作業</Button><Button color="primary" onClick={() => setDialog("finish")}>完成作業</Button></div>
    : otherExecutor ? <div className="m-footer-note"><ExclamationCircleFill /> {otherExecutor}正在執行此計劃，你只可查看</div>
    : plan.status === "已完成" ? <div className="m-footer-bar"><Button block onClick={() => navigate(`/inspections/new?plan=${plan.id}&supplement=1`)}>補錄巡查</Button></div>
    : <div className="m-footer-bar"><Button block color="primary" onClick={start}>{plans.length > 1 ? "合併開始作業" : "開始作業"}</Button></div>;
  return <Page title={plans.length > 1 ? `合併作業（${plans.length}）` : plan.name} backTo="/plans" right={<button className="m-nav-icon" aria-label="更多" onClick={() => setMore(true)}><MoreOutline /></button>} footer={footer} bodyClassName="m-work-body">
    <div className="m-plan-strip">
      <div><StatusTag>{plans.length > 1 ? "合併" : plan.status}</StatusTag><span>{plans.length > 1 ? plans.map((item) => item.name).join("、") : `${shortTime(plan.startAt)}–${shortTime(plan.endAt)} · ${plan.group}`}</span></div>
      <div className="m-plan-strip-progress"><strong>{done}<small>/{inspections.length}</small></strong><span>已巡查</span></div>
    </div>
    <div className={`m-split ${expanded ? "list-expanded" : ""}`}>
      <MapView key={ids.join()} markers={markers} routes={ids.map((planId) => planRoutes[planId] ?? plans.find((item) => item.id === planId)?.snapshot?.route ?? [])} track={mineActive && ids.includes("PL-20260929-0003") ? myTrack : undefined} className="m-split-map"
        legend={<><LegendDot tone="todo">未巡查</LegendDot><LegendDot tone="done">已完成</LegendDot><LegendDot tone="issue">有異常</LegendDot><LegendDot tone="work">工作</LegendDot></>} />
      <div className="m-split-list">
        <button className="m-sheet-handle" aria-label={expanded ? "收起清單" : "展開清單"} onClick={() => setExpanded(!expanded)}><i /></button>
        <div className="m-sheet-head"><strong>路線對象 {inspections.length}</strong><div className="m-seg small"><button className={order === "route" ? "active" : ""} onClick={() => setOrder("route")}>路線順序</button><button className={order === "distance" ? "active" : ""} onClick={() => setOrder("distance")}>距離排序</button></div></div>
        {plans.length > 1 && order === "route" ? plans.map((item) => <div key={item.id}><GroupTitle>{item.name}</GroupTitle>{sorted.filter((row) => row.planId === item.id).map((row) => <InspectionRow key={row.id} inspection={row} />)}</div>)
          : sorted.map((row) => <InspectionRow key={row.id} inspection={row} />)}
        {!inspections.length && <Empty title="此計劃只安排路線" text="到場後可按「新增巡查」現場建立，並自動關聯計劃" />}
      </div>
    </div>
    <ActionSheet visible={more} actions={actions} cancelText="取消" onClose={() => setMore(false)} onAction={() => setMore(false)} />
    <NfcPopup visible={nfc} onClose={() => setNfc(false)} onScanned={(tag) => { setNfc(false); Dialog.alert({ title: "已記錄輔助到場", content: `${tag.name}（${tag.code}）· ${nowText()}。NFC 打卡只作輔助紀錄，不作強制。`, confirmText: "知道了" }); }} />
    <ReasonDialog visible={dialog === "stop"} title="中止作業" description="中止後會釋放作業鎖，同組其他人員可接續執行。" placeholder="中止原因（選填，≤ 200 字）" confirmText="確認中止" onCancel={() => setDialog(null)} onConfirm={(reason) => { stopPlans(ids, reason); setDialog(null); Toast.show({ content: "已中止作業並釋放作業鎖" }); }} />
    <ReasonDialog visible={dialog === "finish"} title="完成作業" required={done < inspections.length} description={done < inspections.length ? `仍有 ${inspections.length - done} 個巡查未完成，須填寫原因才可完成作業。` : "全部巡查已完成，確認完成此作業？"} placeholder="未完成原因（≤ 200 字）" hideInput={done >= inspections.length} confirmText="確認完成" onCancel={() => setDialog(null)} onConfirm={(reason) => { finishPlans(ids, reason); setDialog(null); Toast.show({ icon: "success", content: "計劃已完成" }); navigate("/plans", { replace: true }); }} />
    <PlanOpsPopup visible={ops} planIds={ids} onClose={() => setOps(false)} />
  </Page>;
}

function PlanOpsPopup({ visible, planIds, onClose }: { visible: boolean; planIds: string[]; onClose: () => void }) {
  const { state } = useApp();
  const rows = state.planOps.filter((op) => planIds.includes(op.planId)).reverse();
  return <ReasonDialog visible={visible} title="作業記錄" hideInput confirmText="關閉" hideCancel onCancel={onClose} onConfirm={onClose} description={<div className="m-ops">{rows.length ? rows.map((op, index) => <div key={index}><StatusTag tone={op.action === "搶鎖失敗" ? "danger" : op.action === "開始作業" ? "info" : "neutral"}>{op.action}</StatusTag><span>{op.operator} · {shortTime(op.time)}{op.reason ? ` · ${op.reason}` : ""}</span></div>) : <span>尚無作業記錄</span>}</div>} />;
}

function InspectionRow({ inspection }: { inspection: Inspection }) {
  const navigate = useNavigate(); const { state, shared } = useApp();
  const object = objectIndex[inspection.objectId]; const template = appTemplate(inspection.templateId);
  const abnormal = inspection.status === "已完成" && inspectionAbnormal(inspection);
  const works = shared.works.filter((work) => workInspection(work).inspectionId === inspection.id || state.workLinks.some((link) => link.workId === work.id && link.inspectionId === inspection.id)).length;
  return <button className="m-insp-row" onClick={() => navigate(`/inspections/${inspection.id}`)}>
    <span className={`m-insp-index tone-${inspectionTone(inspection)}`}>{inspection.status === "已完成" && !abnormal ? <CheckOutline /> : inspection.seq}</span>
    <div><strong>{object?.name}</strong><span>{template?.name} · 距離 {object?.distance ?? "—"} 米{works ? ` · 工作 ${works}` : ""}</span></div>
    <div className="m-insp-status">{abnormal ? <StatusTag>異常</StatusTag> : <StatusTag>{inspection.status}</StatusTag>}{inspection.pendingSync && <StatusTag>待同步</StatusTag>}<small>{inspection.submittedAt ? shortTime(inspection.submittedAt) : ""}</small></div>
  </button>;
}

// ---- 巡查表 ----
function ItemControl({ item, result, disabled, onChange }: { item: TemplateItem; result: ItemResult; disabled: boolean; onChange: (value: ItemResult) => void }) {
  const { persona } = useApp();
  if (item.kind === "BOOL" || item.kind === "SINGLE" || item.kind === "MULTI") {
    const value = Array.isArray(result.value) ? result.value : result.value ? [result.value] : [];
    return <Selector className={`m-selector ${item.kind === "BOOL" ? "bool" : ""}`} columns={item.kind === "BOOL" ? 2 : 3} multiple={item.kind === "MULTI"} disabled={disabled} value={value} showCheckMark={false}
      options={(item.options ?? []).map((option) => ({ label: item.abnormal?.includes(option) ? <span className="m-opt-abnormal">{option}</span> : option, value: option }))}
      onChange={(next) => onChange({ ...result, value: item.kind === "MULTI" ? next : next[0] })} />;
  }
  if (item.kind === "TEXT") return <TextArea className="m-textarea" disabled={disabled} placeholder="輸入內容" value={(result.value as string) ?? ""} maxLength={item.maxLength} showCount autoSize={{ minRows: 2, maxRows: 5 }} onChange={(value) => onChange({ ...result, value })} />;
  return <SignatureField value={result.signature} disabled={disabled} signer={persona.name} onChange={(signature) => onChange({ ...result, signature })} />;
}

export function InspectionFormPage() {
  const { id = "" } = useParams(); const navigate = useNavigate();
  const { state, shared, persona, updateInspection, submitInspection, supplementInspection } = useApp();
  const inspection = state.inspections.find((item) => item.id === id);
  // 輔助資料 history: the App's inspections plus back-office records
  const auxHistory = useMemo(() => historyFromApp(state.inspections, shared.inspectionRecords), [state.inspections, shared.inspectionRecords]);
  // Item fields come live from 巡查項目 until submission; a submitted inspection keeps the items it was submitted with.
  const base = inspection ? appTemplate(inspection.templateId) : undefined;
  // the object's effective distance from the 巡查模板 (per-object override, else the template default)
  const template = base && inspection ? { ...base, validDistance: base.objectDistances?.[inspection.objectId] ?? base.validDistance, items: itemsForInspection(inspection) } : undefined;
  const object = inspection ? objectIndex[inspection.objectId] : undefined;
  const plan = shared.plans.find((item) => item.id === inspection?.planId);
  const [results, setResults] = useState<Record<string, ItemResult>>(inspection?.results ?? {});
  const [errors, setErrors] = useState<SubmitError[]>([]);
  const [supplementing, setSupplementing] = useState(false);
  const [supplementReason, setSupplementReason] = useState(false);
  const [nfc, setNfc] = useState(false);
  const [dirty, setDirty] = useState(false);
  const dirtyRef = useRef(false); const resultsRef = useRef(results);
  dirtyRef.current = dirty; resultsRef.current = results;
  const lockedByOther = !!plan && !(plan.status === "進行中" && plan.executor === persona.name);
  const editable = !!inspection && ((inspection.status === "未完成" && !lockedByOther) || supplementing);

  useEffect(() => {
    if (!inspection || inspection.status !== "未完成" || lockedByOther || inspection.startedAt || !object) return;
    updateInspection(inspection.id, { startedAt: nowText(), inspector: persona.name, location: { passed: object.distance <= (template?.validDistance ?? 100), distance: object.distance, accuracy: 8 } });
  }, [inspection?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!editable || supplementing) return;
    const timer = window.setInterval(() => { if (dirtyRef.current) { updateInspection(id, { results: resultsRef.current, savedAt: nowText() }); setDirty(false); Toast.show({ content: "已自動暫存" }); } }, 30000);
    return () => { window.clearInterval(timer); if (dirtyRef.current) updateInspection(id, { results: resultsRef.current, savedAt: nowText() }); };
  }, [editable, supplementing, id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!inspection || !template || !object) return <Page title="巡查表"><Empty title="找不到巡查" /></Page>;
  const location = inspection.location;
  const errorKeys = new Set(errors.map((error) => error.key));
  const setItem = (key: string, value: ItemResult) => { setResults({ ...results, [key]: value }); setDirty(true); if (errors.length) setErrors(errors.filter((error) => error.key !== key)); };
  const saveDraft = () => { updateInspection(id, { results, savedAt: nowText() }); setDirty(false); Toast.show({ icon: "success", content: "已暫存（暫存不做必填檢查）" }); };
  const relocate = () => { updateInspection(id, { location: { passed: true, distance: Math.min(object.distance, 18), accuracy: 6 } }); setErrors(errors.filter((error) => error.key !== "location")); Toast.show({ icon: "success", content: "定位成功（±6 米）" }); };
  const submit = () => {
    const found = validateInspection(template, inspection, results);
    setErrors(found);
    if (found.length) {
      Toast.show({ content: `有 ${found.length} 項未符合要求` });
      window.setTimeout(() => document.getElementById(found[0].key === "location" ? "insp-errors" : `item-${found[0].key}`)?.scrollIntoView({ behavior: "smooth", block: "center" }), 50);
      return;
    }
    Dialog.confirm({ title: "提交巡查？", content: "提交後表單轉為唯讀，之後只可補錄結果、附件及關聯工作。", confirmText: "提交", cancelText: "再檢查",
      onConfirm: () => { submitInspection(id, results); setDirty(false); Toast.show({ icon: "success", content: state.offline ? "已提交，待網絡恢復後同步" : "巡查已提交" }); navigate(plan ? `/plans/${plan.id}` : "/inspections", { replace: true }); } });
  };
  const linkedWorks = shared.works.filter((work) => workInspection(work).inspectionId === id || state.workLinks.some((link) => link.workId === work.id && link.inspectionId === id));
  const itemOf = (workId: string) => state.workLinks.find((link) => link.workId === workId && link.inspectionId === id)?.itemKey;
  const inspectors = [inspection.inspector ?? persona.name, ...(inspection.status === "未完成" ? state.companions.map((item) => item.name) : [])];
  const footer = inspection.status === "已完成" && !supplementing
    ? <div className="m-footer-bar"><Button block onClick={() => setSupplementing(true)}>補錄</Button></div>
    : supplementing ? <div className="m-footer-bar"><Button onClick={() => { setSupplementing(false); setResults(inspection.results); }}>取消補錄</Button><Button color="primary" onClick={() => setSupplementReason(true)}>保存補錄</Button></div>
    : editable ? <div className="m-footer-bar"><Button onClick={saveDraft}>暫存</Button><Button color="primary" onClick={submit}>提交</Button></div>
    : <div className="m-footer-note"><ExclamationCircleFill /> {plan?.executor && plan.status === "進行中" ? `${plan.executor}正在執行此計劃，只可查看` : "計劃開始作業後才可填寫"}</div>;
  return <Page title="巡查表" backTo={plan ? `/plans/${plan.id}` : "/inspections"} right={inspection.savedAt && editable ? <span className="m-nav-sub">已暫存 {shortTime(inspection.savedAt)}</span> : undefined} footer={footer}>
    <Card className="m-insp-head">
      <div className="m-insp-title"><div><strong>{object.name}</strong><span>{inspection.id} · {template.name}</span></div><StatusTag>{supplementing ? "補錄" : inspection.status}</StatusTag></div>
      <InfoList items={[["所屬計劃", plan ? plan.name : "獨立巡查"], ["巡查人員", inspectors.join("、") + (inspection.status === "未完成" && state.companions.length ? "（含同行人）" : "")], ["開始時間", inspection.startedAt ?? "—"], ...(inspection.submittedAt ? [["提交時間", inspection.submittedAt] as [string, ReactNode]] : [])]} />
      {template.locationCheck && <div className={`m-loc ${location?.nfc || location?.passed ? "ok" : "bad"} ${errorKeys.has("location") ? "error" : ""}`}>
        <EnvironmentOutline />
        <div><strong>定位校驗：{location?.nfc ? "NFC 輔助到場" : location ? (location.passed ? "通過" : "不通過") : "未定位"}</strong><span>{location ? `距離 ${location.distance} 米 · 精度 ±${location.accuracy} 米 · 有效距離 ${template.validDistance} 米` : "尚未取得定位"}{location?.nfc ? ` · 標籤 ${location.nfc}` : ""}</span></div>
        {editable && !supplementing && <div className="m-loc-actions"><Button size="mini" fill="outline" onClick={relocate}>重新定位</Button><Button size="mini" fill="outline" onClick={() => setNfc(true)}><ScanningOutline /> NFC</Button></div>}
      </div>}
    </Card>
    {errors.length > 0 && <div className="m-error-summary" id="insp-errors"><strong><ExclamationCircleFill /> 提交前請修正以下 {errors.length} 項</strong><ol>{errors.map((error, index) => <li key={index}><button onClick={() => document.getElementById(error.key === "location" ? "insp-errors" : `item-${error.key}`)?.scrollIntoView({ behavior: "smooth", block: "center" })}>{error.message}</button></li>)}</ol></div>}
    {lockedByOther && inspection.status === "未完成" && <div className="m-inline-note">此巡查屬計劃「{plan?.name}」，需由持有作業鎖的人員填寫。</div>}
    <GroupTitle extra={<span>{template.items.filter((item) => item.required).length} 項必填</span>}>巡查項目</GroupTitle>
    {groupTemplateItems(template.items).map((group) => <div className="m-item-group" key={group.type}><div className="m-item-category"><strong>{group.type}</strong><span>{group.items.length} 項</span></div>{group.items.map(({ item, no }) => {
      const result = results[item.key] ?? { photos: [] };
      const abnormal = isAbnormal(item, result.value);
      const works = linkedWorks.filter((work) => (workInspection(work).inspectionId === id ? workInspection(work).itemKey : itemOf(work.id)) === item.key);
      return <section key={item.key} id={`item-${item.key}`} className={`m-item ${abnormal ? "abnormal" : ""} ${errorKeys.has(item.key) ? "error" : ""}`}>
        <header><span className="m-item-no">{String(no).padStart(2, "0")}</span><strong>{item.required && <b>*</b>}{item.name}</strong>{abnormal && <StatusTag>異常</StatusTag>}</header>
        {auxEntriesFor(item, inspection, auxHistory).filter((entry) => !entry.empty).map((entry) => <div className="m-aux" key={entry.def.id}><FileOutline /><span>{entry.def.name}：{entry.results?.length === 1 ? `${entry.results[0].value}（${entry.results[0].time.slice(5, 10)}）` : entry.text}</span></div>)}
        <ItemControl item={item} result={result} disabled={!editable} onChange={(value) => setItem(item.key, value)} />
        {errors.filter((error) => error.key === item.key).map((error) => <p className="m-item-error" key={error.message}>{error.message}</p>)}
        {abnormal && (editable || !works.length) && <div className="m-abnormal-bar"><span>選到異常值，建議建立工作跟進</span><Button size="mini" color="primary" onClick={() => { updateInspection(id, { results, savedAt: nowText() }); setDirty(false); navigate(`/works/new?from=inspection&inspection=${id}&item=${item.key}`); }}><AddOutline /> 建立工作</Button></div>}
        {works.map((work) => <button key={work.id} className="m-linked" onClick={() => navigate(`/works/${work.id}`)}><span>已建立工作</span><strong>{work.id}</strong><StatusTag>{work.status}</StatusTag></button>)}
        {(editable || result.photos.length > 0 || item.minAttachments > 0) && <AttachmentField value={result.photos} min={item.minAttachments} max={6} place={object.name} allowAlbum={false} allowVideo sample={itemPhoto[item.key] ?? photoAssets.seat} disabled={!editable} onChange={(photos) => setItem(item.key, { ...result, photos })} />}
        {editable ? <Input className="m-remark" placeholder="項目備註（選填，≤ 200 字）" maxLength={200} value={result.remark ?? ""} onChange={(remark) => setItem(item.key, { ...result, remark })} /> : result.remark ? <p className="m-remark-text">備註：{result.remark}</p> : null}
      </section>;
    })}</div>)}
    {linkedWorks.length > 0 && <Card title="相關工作">{linkedWorks.map((work) => <button key={work.id} className="m-linked" onClick={() => navigate(`/works/${work.id}`)}><span>{work.title}</span><strong>{work.id}</strong><StatusTag>{work.status}</StatusTag></button>)}</Card>}
    {(inspection.supplements?.length ?? 0) > 0 && <Card title="補錄記錄">{inspection.supplements!.map((entry, index) => <div className="m-supplement" key={index}><strong>{entry.operator} · {shortTime(entry.time)}</strong><span>{entry.reason}</span></div>)}</Card>}
    <NfcPopup visible={nfc} expected={object.nfc} onClose={() => setNfc(false)} onScanned={(tag) => {
      setNfc(false);
      if (tag.code !== object.nfc) { Dialog.alert({ title: "標籤與對象不符", content: `掃描到「${tag.name}」（${tag.code}），不屬於本巡查對象。NFC 只作輔助到場紀錄。`, confirmText: "知道了" }); return; }
      updateInspection(id, { location: { ...(location ?? { distance: object.distance, accuracy: 8 }), passed: true, nfc: tag.code } }); setErrors(errors.filter((error) => error.key !== "location")); Toast.show({ icon: "success", content: "已記錄 NFC 輔助到場" });
    }} />
    <ReasonDialog visible={supplementReason} title="保存補錄" required description="補錄全程留痕，原值保留在變更記錄。" placeholder="補錄原因（必填，≤ 200 字）" confirmText="保存" onCancel={() => setSupplementReason(false)} onConfirm={(reason) => { supplementInspection(id, reason, results); setSupplementReason(false); setSupplementing(false); Toast.show({ icon: "success", content: "補錄已保存並留痕" }); }} />
  </Page>;
}

export function InspectionCreatePage() {
  const [params] = useSearchParams(); const navigate = useNavigate(); const { shared, addInspection } = useApp();
  const plan = shared.plans.find((item) => item.id === params.get("plan"));
  const supplement = params.get("supplement") === "1";
  const [templateId, setTemplateId] = useState(activeAppTemplates()[0].id);
  const [objectId, setObjectId] = useState<string>();
  const template = appTemplate(templateId)!;
  // the nearest active objects the 巡查模板 applies to (same inspection type, and listed by the template when it lists objects)
  const objects = useMemo(() => getManagedObjects().filter((managed) => managed.status === "啟用" && templateAppliesTo(template, managed)).flatMap((managed) => getObject(managed.id) ?? []).sort((a, b) => a.distance - b.distance).slice(0, 30), [template]);
  const create = () => {
    if (!objectId) { Toast.show({ content: "請選擇巡查對象" }); return; }
    const id = addInspection(objectId, templateId, plan?.id);
    Toast.show({ icon: "success", content: supplement ? "已加入補錄巡查" : "已建立巡查" });
    navigate(`/inspections/${id}`, { replace: true });
  };
  return <Page title={supplement ? "補錄巡查" : "新增巡查"} backTo={plan ? `/plans/${plan.id}` : "/inspections"} footer={<div className="m-footer-bar"><Button block color="primary" onClick={create}>建立並開始填寫</Button></div>}>
    {plan && <div className="m-inline-note">{supplement ? "計劃已完成，新增的巡查將標記為補錄。" : `將自動關聯計劃「${plan.name}」。`}</div>}
    <GroupTitle>巡查模板（只列所屬巡查群組適用的模板）</GroupTitle>
    <Radio.Group value={templateId} onChange={(value) => { setTemplateId(String(value)); setObjectId(undefined); }}>
      <div className="m-radio-list">{activeAppTemplates().map((item) => <Radio key={item.id} value={item.id}><strong>{item.name}</strong><small>{item.inspectionType} · {item.items.length} 個項目{item.locationCheck ? ` · 定位 ${item.validDistance} 米` : ""}</small></Radio>)}</div>
    </Radio.Group>
    <GroupTitle extra={<span>按距離由近至遠</span>}>巡查對象</GroupTitle>
    <Radio.Group value={objectId} onChange={(value) => setObjectId(String(value))}>
      <div className="m-radio-list">{objects.map((object) => <Radio key={object.id} value={object.id}><strong>{object.name}</strong><small>{object.distance} 米 · {object.grid}</small></Radio>)}</div>
    </Radio.Group>
    {!objects.length && <Empty title="附近沒有適用此模板的對象" />}
  </Page>;
}

export function InspectionListPage({ map }: { map?: boolean }) {
  const { state, shared, persona } = useApp(); const navigate = useNavigate();
  const [filter, setFilter] = useState<"未完成" | "已完成" | "全部">("未完成");
  const planIds = visiblePlans(shared.plans, persona).map((plan) => plan.id);
  const rows = state.inspections.filter((item) => (!item.planId || planIds.includes(item.planId)) && (filter === "全部" || item.status === filter));
  const markers: MapMarker[] = rows.map((item) => { const object = objectIndex[item.objectId]; return { id: item.id, x: object.x, y: object.y, tone: inspectionTone(item), index: item.seq, title: object.name, subtitle: item.status, openLabel: "巡查表", onOpen: () => navigate(`/inspections/${item.id}`) }; });
  return <Page title={map ? "巡查分佈" : "巡查記錄"} backTo="/plans" right={<button className="m-nav-link" onClick={() => navigate(map ? "/inspections" : "/inspections/map", { replace: true })}>{map ? "列表" : "地圖"}</button>} bodyClassName={map ? "m-map-body" : ""}
    footer={map ? undefined : <div className="m-footer-bar"><Button block color="primary" onClick={() => navigate("/inspections/new")}><AddOutline /> 獨立新增巡查</Button></div>}>
    <div className="m-seg-bar"><div className="m-seg">{(["未完成", "已完成", "全部"] as const).map((value) => <button key={value} className={filter === value ? "active" : ""} onClick={() => setFilter(value)}>{value}</button>)}</div><span>{rows.length} 筆</span></div>
    {map ? <MapView key={filter} markers={markers} className="m-full-map" legend={<><LegendDot tone="todo">未巡查</LegendDot><LegendDot tone="done">已完成</LegendDot><LegendDot tone="issue">有異常</LegendDot></>} />
      : <div className="m-card flush">{rows.map((row) => <InspectionRow key={row.id} inspection={row} />)}{!rows.length && <Empty title="沒有巡查記錄" />}</div>}
  </Page>;
}
