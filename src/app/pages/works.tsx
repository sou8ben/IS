import { useMemo, useRef, useState } from "react";
import { Navigate, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { ActionSheet, Button, CascadePicker, Checkbox, Dialog, Dropdown, Input, Picker, Popup, SearchBar, Selector, SwipeAction, Tabs, TextArea, Toast, type DropdownRef } from "antd-mobile";
import { AddOutline, ExclamationCircleFill, MoreOutline, RightOutline } from "antd-mobile-icons";
import type { Work } from "../../types";
import { AddressField, AttachmentField, Card, Empty, FilterOptions, InfoList, LegendDot, MapView, Page, PhotoThumb, reverseGeocode, StatusTag, type AddressValue, type MapMarker } from "../components";
import { commentTemplates, eventToWorkType, execGroups, photoAssets, workTypeConfig, workTypeTree } from "../data";
import { appTemplate } from "../../item-data";
import { objectIndex } from "../../object-data";
import { actionDeniedReason, actionTarget, availableActions, dispatchWork, distanceM, isGroupWork, isMyWork, nowText, renderTemplate, shortTime, slaInfo, topType, workCreator, workDupGroup, workInspection, workPoint, type WorkAction } from "../rules";
import { useApp, type ActionPayload } from "../store";
import type { Photo } from "../types";

const statusActions: WorkAction[] = ["跟進", "解決", "關閉", "重啟", "重新分派"];

// ---- 工作列表 ----
function WorkCard({ work, onAction }: { work: Work; onAction: (work: Work, action: WorkAction) => void }) {
  const navigate = useNavigate(); const { persona } = useApp();
  const sla = slaInfo(work);
  const quick = availableActions(work, persona).filter((action) => action !== "作廢" && action !== "解除作廢").slice(0, 2);
  return <SwipeAction rightActions={quick.map((action, index) => ({ key: action, text: action, color: index === 0 && action !== "留言" ? "primary" : "light" }))} onAction={(action) => onAction(work, action.key as WorkAction)}>
    <button className={`m-work-card ${work.voided ? "voided" : ""}`} onClick={() => navigate(`/works/${work.id}`)}>
      <div className="m-work-title"><strong>{work.title}</strong><StatusTag>{work.voided ? "已作廢" : work.status}</StatusTag></div>
      <div className="m-work-tags">{work.priority !== "一般" && <StatusTag>{work.priority}</StatusTag>}{sla.state !== "正常" && !work.voided && <StatusTag>{sla.state}</StatusTag>}{work.pendingSync && <StatusTag>待同步</StatusTag>}<span>{work.type}</span></div>
      <span className="m-work-meta">{work.address}</span>
      <div className="m-work-foot"><span>{work.id}</span><span>{work.group}</span><span>{shortTime(work.updatedAt)}</span></div>
    </button>
  </SwipeAction>;
}

export function WorkListPage({ map }: { map?: boolean }) {
  const { shared, persona } = useApp(); const navigate = useNavigate();
  const [scope, setScope] = useState<"mine" | "group">("mine");
  const [keyword, setKeyword] = useState(""); const [status, setStatus] = useState("全部"); const [sla, setSla] = useState("全部"); const [priority, setPriority] = useState("全部");
  const [operation, setOperation] = useState<{ work: Work; action: WorkAction } | null>(null);
  const dropdown = useRef<DropdownRef>(null);
  const rows = shared.works.filter((work) => (scope === "mine" ? isMyWork(work, persona) : isGroupWork(work, persona, shared.plans))
    && (!keyword || `${work.id}${work.title}${work.address}`.includes(keyword)) && (status === "全部" || work.status === status) && (sla === "全部" || slaInfo(work).state === sla) && (priority === "全部" || work.priority === priority));
  const pick = (setter: (value: string) => void) => (value: string) => { setter(value); dropdown.current?.close(); };
  const markers: MapMarker[] = rows.map((work) => ({ id: work.id, ...workPoint(work), tone: work.status === "已關閉" || work.status === "已解決" ? "done" : slaInfo(work).state === "已逾時" ? "issue" : "work", index: "工", title: work.title, subtitle: `${work.id} · ${work.status}`, onOpen: () => navigate(`/works/${work.id}`) }));
  return <Page title={map ? "工作分佈" : "工作"} back={!!map} backTo="/works" bodyClassName={map ? "m-map-body" : ""}
    right={<div className="m-nav-actions">{!map && <button className="m-nav-icon" aria-label="新增工作" onClick={() => navigate("/works/new")}><AddOutline /></button>}<button className="m-nav-link" onClick={() => navigate(map ? "/works" : "/works/map", { replace: !!map })}>{map ? "列表" : "地圖"}</button></div>}>
    <Tabs className="m-tabs" activeKey={scope} onChange={(key) => setScope(key as "mine" | "group")} stretch><Tabs.Tab key="mine" title="我的" /><Tabs.Tab key="group" title="群組" /></Tabs>
    {!map && <div className="m-search"><SearchBar placeholder="搜尋編號、摘要或地址" value={keyword} onChange={setKeyword} /></div>}
    <Dropdown className="m-dropdown" ref={dropdown}>
      <Dropdown.Item key="status" title={status === "全部" ? "狀態" : status}><FilterOptions value={status} options={[["全部", "全部狀態"], ...["新建", "跟進中", "已解決", "已關閉"].map((value) => [value, value] as [string, string])]} onChange={pick(setStatus)} /></Dropdown.Item>
      <Dropdown.Item key="sla" title={sla === "全部" ? "服務承諾" : sla}><FilterOptions value={sla} options={[["全部", "全部"], ["正常", "正常"], ["將逾時", "將逾時"], ["已逾時", "已逾時"]]} onChange={pick(setSla)} /></Dropdown.Item>
      <Dropdown.Item key="priority" title={priority === "全部" ? "優先級" : priority}><FilterOptions value={priority} options={[["全部", "全部"], ["一般", "一般"], ["緊急", "緊急"], ["特急", "特急"]]} onChange={pick(setPriority)} /></Dropdown.Item>
    </Dropdown>
    {map ? <MapView key={`${scope}-${status}-${sla}-${priority}`} markers={markers} className="m-full-map" legend={<><LegendDot tone="work">處理中</LegendDot><LegendDot tone="issue">已逾時</LegendDot><LegendDot tone="done">已解決／關閉</LegendDot></>} />
      : <><div className="m-list-hint">{scope === "mine" ? "我建立或處理的工作" : "所屬群組數據範圍內的工作"}；左滑可快速操作<span>共 {rows.length} 筆</span></div>
        {rows.length ? rows.map((work) => <WorkCard key={work.id} work={work} onAction={(target, action) => setOperation({ work: target, action })} />) : <Empty title="沒有符合條件的工作" />}</>}
    <OperationPopup operation={operation} onClose={() => setOperation(null)} />
  </Page>;
}

// ---- 處理操作彈窗（詳細設計 14.6） ----
export function OperationPopup({ operation, onClose }: { operation: { work: Work; action: WorkAction } | null; onClose: () => void }) {
  const { persona, state, shared, workAction } = useApp();
  const [comment, setComment] = useState(""); const [group, setGroup] = useState<string>(); const [photos, setPhotos] = useState<Photo[]>([]); const [error, setError] = useState("");
  const [lastKey, setLastKey] = useState("");
  const key = operation ? `${operation.work.id}-${operation.action}` : "";
  if (key !== lastKey) { setLastKey(key); setComment(""); setGroup(undefined); setPhotos([]); setError(""); }
  if (!operation) return <Popup visible={false} />;
  const { work, action } = operation;
  const target = actionTarget[action];
  const minPhotos = action === "解決" ? workTypeConfig[topType(work.type)]?.resolveMinAttachments ?? 0 : 0;
  const spec: Record<WorkAction, { label: string; required: boolean; max: number; placeholder: string }> = {
    "跟進": { label: "備註", required: false, max: 500, placeholder: "選填，≤ 500 字" },
    "解決": { label: "處理說明", required: true, max: 1000, placeholder: "必填，說明處理方法及結果" },
    "關閉": { label: "驗收意見", required: true, max: 500, placeholder: "必填，≤ 500 字" },
    "重啟": { label: "重啟原因", required: true, max: 500, placeholder: "必填，重啟後回到新建" },
    "重新分派": { label: "原因", required: true, max: 500, placeholder: "必填，≤ 500 字" },
    "留言": { label: "留言內容", required: true, max: 1000, placeholder: "輸入留言，或選擇留言模板" },
    "作廢": { label: "作廢原因", required: true, max: 200, placeholder: "必填，≤ 200 字" },
    "解除作廢": { label: "原因", required: true, max: 200, placeholder: "必填，≤ 200 字" },
  };
  const field = spec[action];
  const templatesForStatus = commentTemplates.filter((item) => item.status.includes(work.status));
  const submit = () => {
    if (field.required && !comment.trim()) { setError(`請輸入${field.label}`); return; }
    if (action === "重新分派" && !group) { setError("請選擇新執行群組"); return; }
    if (photos.length < minPhotos) { setError(`此工作類型解決時須附至少 ${minPhotos} 個附件（目前 ${photos.length} 個）`); return; }
    const payload: ActionPayload = { comment: comment.trim() || undefined, photos, group };
    workAction(work, action, payload);
    onClose();
    Toast.show({ icon: "success", content: state.offline ? `已${action}，待同步` : `已${action}` });
    const dup = workDupGroup(work);
    if (dup && statusActions.includes(action)) {
      const peers = shared.works.filter((item) => item.id !== work.id && workDupGroup(item) === dup && item.status === work.status && !item.voided);
      if (peers.length) {
        let chosen = peers.map((item) => item.id);
        Dialog.confirm({
          title: "同步處理關聯工作？",
          content: <div className="m-dup-sync"><p>以下工作與本工作同屬重複工作組 {dup}，狀態同為「{work.status}」。勾選的工作將同步執行「{action}」。</p><Checkbox.Group defaultValue={chosen} onChange={(value) => { chosen = value as string[]; }}>{peers.map((item) => <Checkbox key={item.id} value={item.id}><strong>{item.id}</strong><span>{item.title}</span></Checkbox>)}</Checkbox.Group></div>,
          confirmText: "同步執行", cancelText: "不用",
          onConfirm: () => { peers.filter((item) => chosen.includes(item.id)).forEach((item) => workAction(item, action, { ...payload, comment: `${payload.comment ?? ""}（與 ${work.id} 同步處理）` })); Toast.show({ content: `已同步處理 ${chosen.length} 張工作` }); },
        });
      }
    }
  };
  return <Popup visible onMaskClick={onClose} bodyClassName="m-op-popup" destroyOnClose>
    <header><button onClick={onClose}>取消</button><strong>{action}工作</strong><button className="primary" onClick={submit}>確認</button></header>
    <div className="m-op-summary"><strong>{work.title}</strong><span>{work.id} · {work.status}{target ? ` → ${target}` : ""}</span></div>
    {action === "重新分派" && <Picker columns={[[...execGroups.filter((item) => item !== work.group).map((item) => ({ label: item, value: item }))]]} value={group ? [group] : []} onConfirm={(value) => { setGroup(value[0] as string); setError(""); }}>
      {(_, actions) => <button className="m-form-row" onClick={actions.open}><span><b>*</b>新執行群組</span><em className={group ? "" : "placeholder"}>{group ?? `請選擇（現為 ${work.group}）`}</em><RightOutline /></button>}
    </Picker>}
    {action === "留言" && templatesForStatus.length > 0 && <div className="m-op-templates"><span>留言模板</span><div>{templatesForStatus.map((item) => <button key={item.title} onClick={() => { setComment(renderTemplate(item.content, { "當前時間": nowText(), "工作編號": work.id, "工作類型": work.type, "操作人": persona.name })); setError(""); }}>{item.title}</button>)}</div></div>}
    <div className="m-op-field"><span>{field.required && <b>*</b>}{field.label}</span><TextArea value={comment} onChange={(value) => { setComment(value); setError(""); }} placeholder={field.placeholder} maxLength={field.max} showCount autoSize={{ minRows: 3, maxRows: 6 }} /></div>
    {(action === "解決" || action === "留言" || action === "跟進") && <div className="m-op-field"><span>{minPhotos > 0 && <b>*</b>}附件{minPhotos > 0 ? `（至少 ${minPhotos} 個）` : "（選填）"}</span><AttachmentField value={photos} onChange={setPhotos} min={minPhotos} max={6} place={work.address} sample={photoAssets.seat} /></div>}
    {action !== "留言" && action !== "作廢" && action !== "解除作廢" && <p className="m-op-note">{state.offline ? "離線中：操作先保存於本機，恢復網絡後同步" : "提交時自動附帶當前定位；定位失敗時仍可提交並記錄「未能定位」"}</p>}
    {error && <p className="m-op-error"><ExclamationCircleFill /> {error}</p>}
  </Popup>;
}

// ---- 工作詳情 ----
export function WorkDetailPage() {
  const { id = "" } = useParams(); const navigate = useNavigate();
  const { state, shared, persona } = useApp();
  const [tab, setTab] = useState("timeline"); const [operation, setOperation] = useState<WorkAction | null>(null); const [more, setMore] = useState(false);
  const work = shared.works.find((item) => item.id === id);
  const synced = state.syncQueue.find((item) => item.tempCode === id && item.status === "已同步");
  if (!work && synced) return <Navigate to={`/works/${synced.targetId}`} replace />;
  if (!work) return <Page title="工作詳情" backTo="/works"><Empty title="找不到工作" text="可能已同步為正式編號，請返回列表" /></Page>;
  const sla = slaInfo(work);
  const actions = availableActions(work, persona);
  const primary = actions.filter((action) => statusActions.includes(action));
  const logs = state.workLogs.filter((log) => log.workId === work.id).sort((a, b) => b.time.localeCompare(a.time));
  const comments = logs.filter((log) => log.action === "留言");
  const photos = logs.flatMap((log) => log.photos ?? []);
  const link = workInspection(work);
  const inspection = state.inspections.find((item) => item.id === link.inspectionId);
  const object = link.objectId ? objectIndex[link.objectId] : undefined;
  const plan = shared.plans.find((item) => item.id === (work.planId ?? inspection?.planId));
  const event = shared.events.find((item) => item.id === work.eventId || item.workIds.includes(work.id));
  const dup = workDupGroup(work); const peers = dup ? shared.works.filter((item) => item.id !== work.id && workDupGroup(item) === dup) : [];
  const denied = actionDeniedReason(work, persona);
  const point = workPoint(work);
  return <Page title="工作詳情" backTo="/works" right={<button className="m-nav-icon" aria-label="更多" onClick={() => setMore(true)}><MoreOutline /></button>}
    footer={<div className="m-footer-bar">{primary.length ? primary.slice(0, 3).map((action, index) => <Button key={action} color={index === 0 ? "primary" : "default"} onClick={() => setOperation(action)}>{action}</Button>) : <Button block onClick={() => setOperation("留言")}>留言</Button>}{primary.length > 0 && <Button onClick={() => setOperation("留言")}>留言</Button>}</div>}>
    {work.voided && <div className="m-inline-note danger">此工作已作廢，不計入統計；處理記錄保留。</div>}
    <Card className="m-work-head">
      <div className="m-work-title"><strong>{work.title}</strong><StatusTag>{work.status}</StatusTag></div>
      <div className="m-work-tags"><StatusTag>{work.priority}</StatusTag>{work.pendingSync && <StatusTag>待同步</StatusTag>}{(work.reopenCount ?? 0) > 0 && <StatusTag tone="warning">重啟 {work.reopenCount} 次</StatusTag>}<span>{work.id}</span></div>
      <div className={`m-sla sla-${sla.state}`}><div><span>服務承諾</span><strong>{sla.text}</strong></div><StatusTag>{sla.state}</StatusTag><div className="m-sla-track"><i style={{ width: `${sla.percent}%` }} /></div></div>
      <InfoList items={[["執行群組", <>{work.group}{work.group === "待人工分派" && <StatusTag>待人工分派</StatusTag>}</>], ["工作類型", work.type], ["建立人", `${workCreator(work)} · ${shortTime(work.createdAt)}`]]} />
      {denied && primary.length === 0 && <p className="m-perm-note"><ExclamationCircleFill /> {denied}；你仍可留言。</p>}
    </Card>
    <Card title="位置與描述">
      <MapView key={work.id} className="m-mini-map" initial={{ ...point, zoom: 5 }} markers={[{ id: work.id, ...point, tone: "work", index: "工", title: work.title, subtitle: work.address }]} />
      <InfoList items={[["地址", work.address], ["網格", work.grid], ["對象", object?.name ?? "—"], ["來源", work.source], ["描述", work.description]]} />
    </Card>
    <Tabs className="m-tabs card" activeKey={tab} onChange={setTab}>
      <Tabs.Tab key="timeline" title={`處理記錄 ${logs.length}`} />
      <Tabs.Tab key="comments" title={`留言 ${comments.length}`} />
      <Tabs.Tab key="files" title={`附件 ${photos.length}`} />
      <Tabs.Tab key="related" title="關聯" />
    </Tabs>
    <div className="m-card m-tab-card">
      {tab === "timeline" && <div className="m-timeline">{logs.map((log) => <div key={log.id} className={`m-tl-item ${log.conflict ? "conflict" : ""}`}>
        <i className={`m-tl-dot ${log.to ? "status" : ""}`} />
        <div className="m-tl-head"><strong>{log.action}{log.from && log.to ? <small>{log.from} → {log.to}</small> : null}</strong><time>{shortTime(log.time)}</time></div>
        <span className="m-tl-meta">{log.operator} · {log.location}{log.pendingSync ? " · " : ""}{log.pendingSync && <StatusTag>待同步</StatusTag>}{log.conflict && <StatusTag>衝突</StatusTag>}</span>
        {log.comment && <p>{log.comment}</p>}
        {log.photos && log.photos.length > 0 && <div className="m-tl-photos">{log.photos.map((photo) => <PhotoThumb key={photo.id} photo={photo} />)}</div>}
      </div>)}</div>}
      {tab === "comments" && <>{comments.length ? comments.map((log) => <div key={log.id} className="m-comment"><span className="m-avatar small">{log.operator.slice(0, 1)}</span><div><strong>{log.operator}<time>{shortTime(log.time)}</time></strong><p>{log.comment}</p>{log.photos && log.photos.length > 0 && <div className="m-tl-photos">{log.photos.map((photo) => <PhotoThumb key={photo.id} photo={photo} />)}</div>}</div></div>) : <Empty title="暫無留言" />}<Button block fill="outline" color="primary" onClick={() => setOperation("留言")}>寫留言</Button></>}
      {tab === "files" && (photos.length ? <div className="m-attach-grid">{photos.map((photo) => <PhotoThumb key={photo.id} photo={photo} />)}</div> : <Empty title="暫無附件" />)}
      {tab === "related" && <div className="m-related">
        {plan && <button onClick={() => navigate(`/plans/${plan.id}`)}><span>巡查計劃</span><strong>{plan.name}</strong><RightOutline /></button>}
        {inspection && <button onClick={() => navigate(`/inspections/${inspection.id}`)}><span>巡查</span><strong>{inspection.id} · {objectIndex[inspection.objectId]?.name}</strong><RightOutline /></button>}
        {event && <button onClick={() => navigate(`/events/${event.id}`)}><span>事件</span><strong>{event.id} · {event.description}</strong><RightOutline /></button>}
        {peers.map((item) => <button key={item.id} onClick={() => navigate(`/works/${item.id}`)}><span>重複工作組 {dup}</span><strong>{item.id} · {item.title}</strong><StatusTag>{item.status}</StatusTag></button>)}
        {!plan && !inspection && !event && !peers.length && <Empty title="沒有關聯記錄" />}
      </div>}
    </div>
    <ActionSheet visible={more} cancelText="取消" onClose={() => setMore(false)} onAction={() => setMore(false)} actions={[
      ...(actions.includes("作廢") ? [{ key: "void", text: "作廢工作", danger: true, onClick: () => setOperation("作廢") }] : []),
      ...(actions.includes("解除作廢") ? [{ key: "unvoid", text: "解除作廢", onClick: () => setOperation("解除作廢") }] : []),
      { key: "copy", text: "複製工作編號", onClick: () => { void navigator.clipboard?.writeText(work.id); Toast.show({ content: "已複製" }); } },
    ]} />
    <OperationPopup operation={operation ? { work, action: operation } : null} onClose={() => setOperation(null)} />
  </Page>;
}

// ---- 新增工作（詳細設計 6.4、6.7、14.6） ----
export function WorkFormPage() {
  const [params] = useSearchParams(); const navigate = useNavigate();
  const { state, shared, createWork, linkWorkToEvent, linkInspectionWork } = useApp();
  const from = params.get("from") ?? "獨立";
  const inspection = state.inspections.find((item) => item.id === params.get("inspection"));
  // The live template: work summaries (and their SLA) are taken from the current 巡查項目 settings.
  const template = inspection ? appTemplate(inspection.templateId) : undefined;
  const item = template?.items.find((entry) => entry.key === params.get("item"));
  const event = shared.events.find((entry) => entry.id === params.get("event"));
  const plan = shared.plans.find((entry) => entry.id === (params.get("plan") ?? inspection?.planId ?? event?.planId));
  const object = inspection ? objectIndex[inspection.objectId] : undefined;
  const itemPhotos = item && inspection ? inspection.results[item.key]?.photos ?? [] : [];
  const initial = useMemo(() => {
    if (object && item) return { summary: item.summaries?.[0]?.summary ?? "", type: item.summaries?.[0]?.workType ?? "", address: { ...reverseGeocode(object.x, object.y), address: object.address }, description: `巡查項目「${item.name}」結果異常：${[inspection?.results[item.key]?.value].flat().join("、")}${inspection?.results[item.key]?.remark ? `；${inspection.results[item.key]?.remark}` : ""}` };
    if (event) return { summary: event.description, type: eventToWorkType[event.type] ?? "", address: { ...reverseGeocode(event.x ?? 640, event.y ?? 120), address: event.address }, description: `由事件 ${event.id} 建立：${event.description}` };
    return { summary: "", type: "", address: undefined as AddressValue | undefined, description: "" };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const [summary, setSummary] = useState(initial.summary);
  const [type, setType] = useState(initial.type);
  const [description, setDescription] = useState(initial.description);
  const [priority, setPriority] = useState<Work["priority"]>("一般");
  const [address, setAddress] = useState<AddressValue | undefined>(initial.address);
  const [groupOverride, setGroupOverride] = useState<string>();
  const [carry, setCarry] = useState(true);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [summarySheet, setSummarySheet] = useState(false);
  const auto = type && address ? dispatchWork(type, address.grid, object?.id) : null;
  const group = groupOverride ?? auto?.group;
  const source = from === "inspection" ? "巡查" : from === "event" ? "事件" : from === "plan" ? "計劃" : "獨立";
  const back = inspection ? `/inspections/${inspection.id}` : event ? `/events/${event.id}` : plan ? `/plans/${plan.id}` : "/works";
  const save = (force = false) => {
    const found: Record<string, string> = {};
    if (!summary.trim()) found.summary = "請輸入工作摘要"; else if (summary.length > 100) found.summary = "工作摘要不可超過 100 字";
    if (!type) found.type = "請選擇工作類型（末級）";
    if (!address) found.address = "請選擇地址";
    setErrors(found);
    if (Object.keys(found).length) { Toast.show({ content: "請完成必填欄位" }); document.querySelector(".m-form-row.error, .m-form-block.error")?.scrollIntoView({ behavior: "smooth", block: "center" }); return; }
    const duplicates = shared.works.filter((work) => !work.voided && work.status !== "已關閉" && topType(work.type) === topType(type) && distanceM(workPoint(work), address!) <= 30);
    if (duplicates.length && !force) {
      const target = duplicates[0];
      Dialog.show({
        title: "發現疑似重複工作",
        content: <div className="m-dup">{duplicates.map((work) => <div key={work.id}><strong>{work.id} · {work.title}</strong><span>{work.type} · {work.status} · 距離約 {distanceM(workPoint(work), address!)} 米</span></div>)}<p>30 米內有同類型未關閉的工作。</p></div>,
        closeOnAction: true,
        actions: [
          { key: "link", text: `改為關聯現有工作 ${target.id}`, bold: true, onClick: () => {
            if (inspection) linkInspectionWork(inspection.id, item?.key, target.id);
            if (event) linkWorkToEvent(event.id, target.id);
            Toast.show({ icon: "success", content: `已關聯 ${target.id}` }); navigate(inspection || event ? back : `/works/${target.id}`, { replace: true });
          } },
          { key: "force", text: "仍然新增", onClick: () => save(true) },
          { key: "cancel", text: "取消" },
        ],
      });
      return;
    }
    const allPhotos = [...(carry ? itemPhotos : []), ...photos];
    const id = createWork({ title: summary.trim(), type, source, priority, group: group ?? "待人工分派", grid: address!.grid, address: address!.address, description, eventId: event?.id, planId: plan?.id, inspectionId: inspection?.id, inspectionItem: item?.key, objectId: object?.id, x: address!.x, y: address!.y }, auto ? `${groupOverride ? "人工選擇" : `按${auto.reason}`}分派至 ${group}` : "待人工分派", allPhotos);
    Toast.show({ icon: "success", content: state.offline ? "已保存於本機，待同步後分派" : `工作已建立，已分派至 ${group}` });
    navigate(inspection || event ? back : `/works/${id}`, { replace: true });
  };
  const typeValue = type ? type.split("／") : [];
  return <Page title="新增工作" backTo={back} footer={<div className="m-footer-bar"><Button onClick={() => navigate(back, { replace: true })}>取消</Button><Button color="primary" onClick={() => save()}>建立工作</Button></div>}>
    {state.offline && <div className="m-inline-note">離線建立的工作以本機編號保存，同步後由伺服器重新計算分派並轉為正式編號。</div>}
    <div className="m-form">
      <div className="m-form-title">工作資料</div>
      <div className="m-form-row readonly"><span>來源</span><em>{source}{inspection ? ` · ${inspection.id}` : event ? ` · ${event.id}` : ""}</em></div>
      <div className={`m-form-block ${errors.summary ? "error" : ""}`}>
        <span><b>*</b>工作摘要{item?.summaries?.length ? <button className="m-inline-link" onClick={() => setSummarySheet(true)}>從工作摘要選擇</button> : null}</span>
        <Input value={summary} onChange={(value) => { setSummary(value); setErrors({ ...errors, summary: "" }); }} placeholder="1–100 字" maxLength={100} clearable />
        {errors.summary && <small>{errors.summary}</small>}
      </div>
      <CascadePicker options={workTypeTree} value={typeValue} onConfirm={(value) => { setType(value.filter(Boolean).join("／")); setGroupOverride(undefined); setErrors({ ...errors, type: "" }); }}>
        {(_, actions) => <button className={`m-form-row ${errors.type ? "error" : ""}`} onClick={actions.open}><span><b>*</b>工作類型</span><em className={type ? "" : "placeholder"}>{type || "請選擇（只可選末級）"}</em><RightOutline />{errors.type && <small>{errors.type}</small>}</button>}
      </CascadePicker>
      <div className="m-form-row"><span><b>*</b>優先級</span><Selector className="m-selector inline" columns={3} value={[priority]} showCheckMark={false} options={["一般", "緊急", "特急"].map((value) => ({ label: value, value }))} onChange={(value) => value[0] && setPriority(value[0] as Work["priority"])} /></div>
      <div className="m-form-block"><span>描述</span><TextArea value={description} onChange={setDescription} placeholder="選填，≤ 1,000 字" maxLength={1000} showCount autoSize={{ minRows: 2, maxRows: 5 }} /></div>
      <div className="m-form-title">位置與分派</div>
      <div className={`m-form-block ${errors.address ? "error" : ""}`}><span><b>*</b>地址及經緯度</span><AddressField value={address} onChange={(value) => { setAddress(value); setGroupOverride(undefined); setErrors({ ...errors, address: "" }); }} />{errors.address && <small>{errors.address}</small>}</div>
      <div className="m-form-row readonly"><span>網格</span><em>{address?.grid ?? "按經緯度自動計算"}</em></div>
      <div className="m-form-row readonly"><span>對象</span><em>{object?.name ?? "—"}</em></div>
      <Picker columns={[[...execGroups, "待人工分派"].map((value) => ({ label: value, value }))]} value={group ? [group] : []} onConfirm={(value) => setGroupOverride(value[0] as string)}>
        {(_, actions) => <button className="m-form-row" onClick={actions.open}><span><b>*</b>執行群組</span><em className={group ? "" : "placeholder"}>{group ?? "選擇類型及地址後自動預選"}{group && !groupOverride && auto?.auto && <StatusTag>自動</StatusTag>}</em><RightOutline /></button>}
      </Picker>
      {auto && !groupOverride && <p className="m-form-hint">{auto.auto ? `按${auto.reason}預選，可修改` : auto.reason}</p>}
      <div className="m-form-title">附件</div>
      {itemPhotos.length > 0 && <div className="m-form-row"><Checkbox checked={carry} onChange={setCarry}>帶入巡查項目相片（{itemPhotos.length} 張）</Checkbox></div>}
      {carry && itemPhotos.length > 0 && <div className="m-attach-grid pad">{itemPhotos.map((photo) => <PhotoThumb key={photo.id} photo={photo} />)}</div>}
      <div className="m-form-block"><AttachmentField value={photos} onChange={setPhotos} place={address?.address ?? "現場"} sample={item?.key === "pipe" ? photoAssets.pipe : photoAssets.seat} /></div>
    </div>
    <ActionSheet visible={summarySheet} cancelText="取消" onClose={() => setSummarySheet(false)} extra="工作摘要（選擇後自動帶入工作類型）" actions={(item?.summaries ?? []).map((entry) => ({ key: entry.summary, text: entry.summary, description: entry.workType, onClick: () => { setSummary(entry.summary); setType(entry.workType); setGroupOverride(undefined); setSummarySheet(false); } }))} />
  </Page>;
}
