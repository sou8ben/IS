import { useRef, useState } from "react";
import { Navigate, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { Button, CascadePicker, CheckList, DatePicker, Dialog, Dropdown, Input, NoticeBar, Picker, Popup, SearchBar, Selector, TextArea, Toast, type DropdownRef } from "antd-mobile";
import { AddOutline, RightOutline } from "antd-mobile-icons";
import type { EventRecord } from "../../types";
import { AddressField, AttachmentField, Card, currentAddress, Empty, FilterOptions, InfoList, LegendDot, MapView, Page, StatusTag, type AddressValue, type MapMarker } from "../components";
import { eventFieldDefs, eventMeta, eventTypeTree, photoAssets, type FieldDef } from "../data";
import { fmt, isGroupWork, shortTime } from "../rules";
import { useApp } from "../store";
import type { Photo } from "../types";

const eventPoint = (event: EventRecord) => ({ x: event.x ?? eventMeta[event.id]?.x ?? 640, y: event.y ?? eventMeta[event.id]?.y ?? 120 });
const eventCustom = (event: EventRecord) => event.custom ?? eventMeta[event.id]?.custom ?? {};
const fieldsOf = (type: string) => { const [top] = type.split("／"); return [...(eventFieldDefs[top] ?? []), ...(type.includes("／") ? eventFieldDefs[type] ?? [] : [])]; };

export function EventListPage({ map }: { map?: boolean }) {
  const { shared } = useApp(); const navigate = useNavigate();
  const [keyword, setKeyword] = useState(""); const [type, setType] = useState("全部"); const [status, setStatus] = useState("全部"); const [linked, setLinked] = useState("全部");
  const dropdown = useRef<DropdownRef>(null);
  const pick = (setter: (value: string) => void) => (value: string) => { setter(value); dropdown.current?.close(); };
  const rows = shared.events.filter((event) => (!keyword || `${event.id}${event.description}${event.address}`.includes(keyword)) && (type === "全部" || event.type.startsWith(type.slice(0, 4))) && (status === "全部" || event.status === status) && (linked === "全部" || (linked === "有" ? event.workIds.length > 0 : event.workIds.length === 0)));
  const markers: MapMarker[] = rows.map((event) => ({ id: event.id, ...eventPoint(event), tone: event.status === "已完成" ? "done" : "event", index: "事", title: event.description, subtitle: `${event.id} · ${event.status}`, onOpen: () => navigate(`/events/${event.id}`) }));
  return <Page title={map ? "事件分佈" : "事件"} back={!!map} backTo="/events" bodyClassName={map ? "m-map-body" : ""}
    right={<div className="m-nav-actions">{!map && <button className="m-nav-icon" aria-label="新增事件" onClick={() => navigate("/events/new")}><AddOutline /></button>}<button className="m-nav-link" onClick={() => navigate(map ? "/events" : "/events/map", { replace: !!map })}>{map ? "列表" : "地圖"}</button></div>}>
    {!map && <div className="m-search"><SearchBar placeholder="搜尋編號、描述或地址" value={keyword} onChange={setKeyword} /></div>}
    <Dropdown className="m-dropdown" ref={dropdown}>
      <Dropdown.Item key="type" title={type === "全部" ? "事件類型" : type}><FilterOptions value={type} options={[["全部", "全部類型"], ...eventTypeTree.map((node) => [node.value, node.label] as [string, string])]} onChange={pick(setType)} /></Dropdown.Item>
      <Dropdown.Item key="status" title={status === "全部" ? "跟進狀態" : status}><FilterOptions value={status} options={[["全部", "全部"], ["無需跟進", "無需跟進"], ["跟進中", "跟進中"], ["已完成", "已完成"]]} onChange={pick(setStatus)} /></Dropdown.Item>
      <Dropdown.Item key="linked" title={linked === "全部" ? "關聯工作" : `${linked}關聯工作`}><FilterOptions value={linked} options={[["全部", "全部"], ["有", "有關聯工作"], ["無", "無關聯工作"]]} onChange={pick(setLinked)} /></Dropdown.Item>
    </Dropdown>
    {map ? <MapView key={`${type}-${status}-${linked}`} markers={markers} className="m-full-map" legend={<><LegendDot tone="event">跟進中／無需跟進</LegendDot><LegendDot tone="done">已完成</LegendDot></>} />
      : <><div className="m-list-hint">事件只作登記，處理交由關聯的工作<span>共 {rows.length} 筆</span></div>
        {rows.length ? rows.map((event) => <button key={event.id} className="m-work-card" onClick={() => navigate(`/events/${event.id}`)}>
          <div className="m-work-title"><strong>{event.description}</strong><StatusTag>{event.status}</StatusTag></div>
          <div className="m-work-tags">{event.pendingSync && <StatusTag>待同步</StatusTag>}<span>{event.type}</span></div>
          <span className="m-work-meta">{event.address}</span>
          <div className="m-work-foot"><span>{event.id}</span><span>關聯工作 {event.workIds.length}</span><span>{shortTime(event.createdAt)}</span></div>
        </button>) : <Empty title="沒有符合條件的事件" />}</>}
  </Page>;
}

function CustomField({ def, value, onChange, error }: { def: FieldDef; value?: string; onChange: (value: string) => void; error?: boolean }) {
  if (def.kind === "TEXT") return <div className={`m-form-row ${error ? "error" : ""}`}><span>{def.required && <b>*</b>}{def.name}</span><Input className="m-input-right" value={value ?? ""} onChange={onChange} placeholder="請輸入" /></div>;
  return <div className={`m-form-row ${error ? "error" : ""}`}><span>{def.required && <b>*</b>}{def.name}</span><Selector className="m-selector inline" columns={def.options!.length} showCheckMark={false} value={value ? [value] : []} options={def.options!.map((option) => ({ label: option, value: option }))} onChange={(next) => onChange(next[0] ?? "")} /></div>;
}

export function EventFormPage() {
  const [params] = useSearchParams(); const navigate = useNavigate();
  const { state, shared, persona, createEvent } = useApp();
  const activePlan = shared.plans.find((plan) => plan.id === params.get("plan")) ?? shared.plans.find((plan) => plan.status === "進行中" && plan.executor === persona.name);
  const [type, setType] = useState("");
  const [description, setDescription] = useState("");
  const [address, setAddress] = useState<AddressValue | undefined>(() => currentAddress());
  const [status, setStatus] = useState<EventRecord["status"]>("無需跟進");
  const [followAt, setFollowAt] = useState<Date | null>(null);
  const [custom, setCustom] = useState<Record<string, string>>({});
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const defs = type ? fieldsOf(type) : [];
  const changeType = (next: string) => {
    if (Object.values(custom).some(Boolean) && next !== type) Dialog.confirm({ title: "更換事件類型？", content: "專屬欄位內容將清空。", confirmText: "更換", cancelText: "取消", onConfirm: () => { setType(next); setCustom({}); } });
    else setType(next);
    setErrors({ ...errors, type: "" });
  };
  const save = () => {
    const found: Record<string, string> = {};
    if (!type) found.type = "請選擇事件類型（只可選末級）";
    if (!description.trim()) found.description = "請輸入描述";
    if (!address) found.address = "請選擇地址";
    if (status === "跟進中" && !followAt) found.followAt = "跟進中時必須填寫預計跟進時間";
    defs.forEach((def) => { if (def.required && !custom[def.name]) found[`custom-${def.name}`] = `請填寫「${def.name}」`; });
    setErrors(found);
    if (Object.keys(found).length) { Toast.show({ content: Object.values(found)[0] }); window.setTimeout(() => document.querySelector(".m-form .error")?.scrollIntoView({ behavior: "smooth", block: "center" }), 30); return; }
    const id = createEvent({ type, description: description.trim(), status, grid: address!.grid, address: address!.address, planId: activePlan?.id, workIds: [], followAt: followAt ? fmt(followAt) : undefined, custom, x: address!.x, y: address!.y });
    Toast.show({ icon: "success", content: state.offline ? "事件已保存於本機，待同步" : "事件已登記" });
    navigate(`/events/${id}`, { replace: true });
  };
  return <Page title="新增事件" backTo="/events" footer={<div className="m-footer-bar"><Button onClick={() => navigate(-1)}>取消</Button><Button color="primary" onClick={save}>保存事件</Button></div>}>
    <div className="m-form">
      <div className="m-form-title">事件資料</div>
      <CascadePicker options={eventTypeTree} value={type ? type.split("／") : []} onConfirm={(value) => changeType(value.filter(Boolean).join("／"))}>
        {(_, actions) => <button className={`m-form-row ${errors.type ? "error" : ""}`} onClick={actions.open}><span><b>*</b>事件類型</span><em className={type ? "" : "placeholder"}>{type || "請選擇（只可選末級）"}</em><RightOutline />{errors.type && <small>{errors.type}</small>}</button>}
      </CascadePicker>
      <div className={`m-form-block ${errors.description ? "error" : ""}`}><span><b>*</b>描述</span><TextArea value={description} onChange={(value) => { setDescription(value); setErrors({ ...errors, description: "" }); }} placeholder="1–1,000 字，說明現場情況" maxLength={1000} showCount autoSize={{ minRows: 3, maxRows: 6 }} />{errors.description && <small>{errors.description}</small>}</div>
      <div className={`m-form-block ${errors.address ? "error" : ""}`}><span><b>*</b>地址及經緯度<em className="m-form-sub">預設以當前定位轉換，可移動圖釘修正</em></span><AddressField value={address} onChange={(value) => { setAddress(value); setErrors({ ...errors, address: "" }); }} /></div>
      <div className="m-form-row readonly"><span>網格</span><em>{address?.grid ?? "自動計算"}</em></div>
      <div className="m-form-row"><span><b>*</b>跟進狀態</span><Selector className="m-selector inline" columns={3} showCheckMark={false} value={[status]} options={["無需跟進", "跟進中", "已完成"].map((value) => ({ label: value, value }))} onChange={(value) => { if (value[0]) setStatus(value[0] as EventRecord["status"]); setErrors({ ...errors, followAt: "" }); }} /></div>
      {status === "跟進中" && <DatePicker precision="minute" min={new Date(2026, 8, 29, 12, 0)} value={followAt} onConfirm={(value) => { setFollowAt(value); setErrors({ ...errors, followAt: "" }); }} title="預計跟進時間">
        {(value, actions) => <button className={`m-form-row ${errors.followAt ? "error" : ""}`} onClick={actions.open}><span><b>*</b>預計跟進時間</span><em className={value ? "" : "placeholder"}>{value ? fmt(value) : "不早於建立時間"}</em><RightOutline />{errors.followAt && <small>{errors.followAt}</small>}</button>}
      </DatePicker>}
      {defs.length > 0 && <div className="m-form-title">專屬欄位 <small>（按類型層級繼承）</small></div>}
      {defs.map((def) => <CustomField key={def.name} def={def} value={custom[def.name]} error={!!errors[`custom-${def.name}`]} onChange={(value) => { setCustom({ ...custom, [def.name]: value }); setErrors({ ...errors, [`custom-${def.name}`]: "" }); }} />)}
      <div className="m-form-title">附件</div>
      <div className="m-form-block"><AttachmentField value={photos} onChange={setPhotos} place={address?.address ?? "現場"} sample={type.includes("樹") ? photoAssets.tree : type.includes("垃圾") || type.includes("積水") ? photoAssets.bin : photoAssets.seat} /></div>
      <div className="m-form-row readonly"><span>所屬計劃</span><em>{activePlan ? `${activePlan.name}（自動帶入）` : "—"}</em></div>
    </div>
  </Page>;
}

export function EventDetailPage() {
  const { id = "" } = useParams(); const navigate = useNavigate();
  const { state, shared, persona, linkWorkToEvent } = useApp();
  const [linking, setLinking] = useState(false); const [picked, setPicked] = useState<string[]>([]);
  const event = shared.events.find((item) => item.id === id);
  const synced = state.syncQueue.find((item) => item.tempCode === id && item.status === "已同步");
  if (!event && synced) return <Navigate to={`/events/${synced.targetId}`} replace />;
  if (!event) return <Page title="事件詳情" backTo="/events"><Empty title="找不到事件" text="可能已同步為正式編號，請返回列表" /></Page>;
  const works = shared.works.filter((work) => event.workIds.includes(work.id));
  const allClosed = works.length > 0 && works.every((work) => work.status === "已關閉");
  const plan = shared.plans.find((item) => item.id === event.planId);
  const custom = eventCustom(event);
  const point = eventPoint(event);
  const followAt = event.followAt ?? eventMeta[event.id]?.followAt;
  const candidates = shared.works.filter((work) => !event.workIds.includes(work.id) && !work.voided && isGroupWork(work, persona, shared.plans));
  const createWork = () => {
    if (event.status !== "無需跟進") { navigate(`/works/new?from=event&event=${event.id}`); return; }
    Dialog.show({ title: "建立工作", content: "此事件目前為「無需跟進」。建立工作後，建議把跟進狀態改為「跟進中」。", closeOnAction: true, actions: [
      { key: "change", text: "改為跟進中並建立工作", bold: true, onClick: () => { shared.updateEvent(event.id, { status: "跟進中" }); navigate(`/works/new?from=event&event=${event.id}`); } },
      { key: "keep", text: "保持不變並建立工作", onClick: () => navigate(`/works/new?from=event&event=${event.id}`) },
      { key: "cancel", text: "取消" },
    ] });
  };
  return <Page title="事件詳情" backTo="/events"
    footer={<div className="m-footer-bar"><Picker columns={[["無需跟進", "跟進中", "已完成"].map((value) => ({ label: value, value }))]} value={[event.status]} onConfirm={(value) => { shared.updateEvent(event.id, { status: value[0] as EventRecord["status"] }); Toast.show({ content: `跟進狀態已改為${value[0]}` }); }}>
      {(_, actions) => <Button onClick={actions.open}>修改跟進狀態</Button>}</Picker><Button color="primary" onClick={createWork}>建立工作</Button></div>}>
    {allClosed && event.status !== "已完成" && <NoticeBar color="info" wrap content="關聯工作已全部關閉，可把跟進狀態改為「已完成」（系統不會自動修改）。" extra={<Button size="mini" color="primary" onClick={() => shared.updateEvent(event.id, { status: "已完成" })}>改為已完成</Button>} />}
    <Card className="m-work-head">
      <div className="m-work-title"><strong>{event.description}</strong><StatusTag>{event.status}</StatusTag></div>
      <div className="m-work-tags">{event.pendingSync && <StatusTag>待同步</StatusTag>}<span>{event.id}</span></div>
      <InfoList items={[["事件類型", event.type], ["網格", event.grid], ["預計跟進時間", followAt ?? "—"], ["建立", `${event.creator ?? eventMeta[event.id]?.creator ?? "—"} · ${event.createdAt}`], ["所屬計劃", plan ? <button className="m-inline-link" onClick={() => navigate(`/plans/${plan.id}`)}>{plan.name}</button> : "—"]]} />
    </Card>
    <Card title="位置">
      <MapView key={event.id} className="m-mini-map" initial={{ ...point, zoom: 5 }} markers={[{ id: event.id, ...point, tone: "event", index: "事", title: event.description, subtitle: event.address }]} />
      <InfoList items={[["地址", event.address]]} />
    </Card>
    {Object.keys(custom).length > 0 && <Card title="專屬欄位"><InfoList items={Object.entries(custom).map(([key, value]) => [key, value || "—"])} /></Card>}
    <Card title={`關聯工作 ${works.length}`} extra={<button className="m-card-link" onClick={() => { setPicked([]); setLinking(true); }}>關聯現有工作</button>}>
      {works.length ? works.map((work) => <button key={work.id} className="m-linked" onClick={() => navigate(`/works/${work.id}`)}><span>{work.title}</span><strong>{work.id}</strong><StatusTag>{work.status}</StatusTag></button>) : <Empty title="尚未關聯工作" text="可按「建立工作」交由執行群組處理" />}
    </Card>
    <Card title="變更記錄"><div className="m-timeline compact"><div className="m-tl-item"><i className="m-tl-dot status" /><div className="m-tl-head"><strong>登記事件</strong><time>{shortTime(event.createdAt)}</time></div><span className="m-tl-meta">{event.creator ?? eventMeta[event.id]?.creator ?? "—"} · 來源 App</span></div></div></Card>
    <Popup visible={linking} onMaskClick={() => setLinking(false)} bodyClassName="m-op-popup">
      <header><button onClick={() => setLinking(false)}>取消</button><strong>關聯現有工作</strong><button className="primary" onClick={() => { picked.forEach((workId) => linkWorkToEvent(event.id, workId)); setLinking(false); if (picked.length) Toast.show({ icon: "success", content: `已關聯 ${picked.length} 張工作` }); }}>確定</button></header>
      {candidates.length ? <CheckList multiple value={picked} onChange={(value) => setPicked(value as string[])}>{candidates.map((work) => <CheckList.Item key={work.id} value={work.id}><strong>{work.title}</strong><small className="m-block-sub">{work.id} · {work.status} · {work.address}</small></CheckList.Item>)}</CheckList> : <Empty title="沒有可關聯的工作" text="只列你可見的記錄" />}
    </Popup>
  </Page>;
}

