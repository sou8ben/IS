import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { useSearchParams } from "react-router-dom";
import { ArrowDownOutlined, ArrowUpOutlined, CloseOutlined, CopyOutlined, DeleteOutlined, EditOutlined, ExportOutlined, PlusOutlined, RadarChartOutlined, ReloadOutlined, SearchOutlined, UndoOutlined } from "@ant-design/icons";
import { METERS_PER_PX } from "./app/data";
import { BatchPickerDrawer, Button, ConfirmDialog, DenseTable, Field, FormDrawer, PageHeader, Pagination, Select, StatusTag, useToast } from "./components";
import { locateName } from "./grid-data";
import { BatchEditDrawer, useSelection } from "./inspection-template-page";
import { getObject } from "./object-data";
import { responsibilityGroups } from "./permission-rules";
import { LegendItem, PlanMap, type MapMarkerSpec } from "./plan-map";
import {
  applicableTemplates, copyPlanTemplate, newPlanTemplate, nextPlanTemplateCode, objectsNearRoute, routeLength, RULES_MAX, SCAN_RADIUS_DEFAULT, SCAN_RADIUS_MAX, SCAN_RADIUS_MIN, templateAppliesToObject, templateIdsOf, validatePlanTemplate,
  type PlanTemplate, type PlanTemplateContext, type PlanTemplateError, type PlanTemplateObject, type PlanTemplateTab, type Point,
} from "./plan-templates";
import { useDemo } from "./store";
import type { Column } from "./types";

type Patch = Partial<PlanTemplate>;
const inspectionGroups = responsibilityGroups.filter((group) => group.kind === "巡查");
const inspectionGroupIds = inspectionGroups.map((group) => group.id);
const groupName = (id: string) => inspectionGroups.find((group) => group.id === id)?.name ?? id;
const unique = (values: string[]) => [...new Set(values)];
const contains = (value: string, query: string) => !query.trim() || value.toLowerCase().includes(query.trim().toLowerCase());
const nowText = () => { const d = new Date(); const pad = (n: number) => String(n).padStart(2, "0"); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`; };
const meters = (px: number) => Math.round(px * METERS_PER_PX);
const groupsText = (template: PlanTemplate) => template.groups.length ? template.groups.map(groupName).join("、") : "全部群組";
const emptyFilters = { code: "", name: "", group: "", status: "" };
type Filters = typeof emptyFilters;
const editorTabs: { key: PlanTemplateTab; label: string }[] = [{ key: "basic", label: "基礎數據" }, { key: "route", label: "路線" }, { key: "objects", label: "對象及巡查模板" }, { key: "groups", label: "適用群組" }];

/** Objects and 巡查模板 as validation and the editor see them. */
export function usePlanTemplateCatalog() {
  const { objects: managed, grids, inspectionTemplates } = useDemo();
  const objects = useMemo(() => managed.map((object) => ({ id: object.id, code: object.code, name: object.name, inspectionType: object.inspectionType, address: object.address, active: object.status === "啟用", grid: getObject(object.id)?.grid ?? "未歸屬", x: getObject(object.id)?.x ?? 0, y: getObject(object.id)?.y ?? 0 })), [managed, grids]); // eslint-disable-line react-hooks/exhaustive-deps
  const context: PlanTemplateContext = useMemo(() => ({ allowedGroupIds: inspectionGroupIds, objects: objects.map(({ id, name, inspectionType, active }) => ({ id, name, inspectionType, active })), templates: inspectionTemplates.map((template) => ({ id: template.id, name: template.name, inspectionType: template.inspectionType, status: template.status, objects: template.objects })) }), [objects, inspectionTemplates]);
  return { objects, objectById: new Map(objects.map((object) => [object.id, object])), templates: inspectionTemplates, context };
}

// ---- 路線 ----
function RouteTab({ draft, onChange }: { draft: PlanTemplate; onChange: (patch: Patch) => void }) {
  const { objectById } = usePlanTemplateCatalog();
  const [selected, setSelected] = useState<string | null>(null);
  const history = useRef<Point[][]>([]); const dragging = useRef(false); const [, refresh] = useState(0);
  const remember = () => { history.current = [...history.current.slice(-19), draft.route.map((point) => [...point] as Point)]; refresh((n) => n + 1); };
  const setRoute = (route: Point[]) => { remember(); onChange({ route }); };
  const markers: MapMarkerSpec[] = [
    ...draft.objects.flatMap((setting, index): MapMarkerSpec[] => { const object = objectById.get(setting.objectId); return object ? [{ id: `obj:${object.id}`, kind: "object", x: object.x, y: object.y, tone: "object", label: String(index + 1), title: `${index + 1}. ${object.name}`, detail: <span>{object.address}<br />{object.grid}</span> }] : []; }),
    ...draft.route.map((point, index): MapMarkerSpec => ({ id: `wp:${index}`, kind: "inspection", x: point[0], y: point[1], tone: "todo", label: String(index + 1), title: `途經點 ${index + 1}`, detail: <span>所在網格：{locateName(point[0], point[1])}<br />拖動可調整位置</span>, draggable: true })),
  ];
  const move = (index: number, delta: number) => { const next = [...draft.route]; const [moved] = next.splice(index, 1); next.splice(index + delta, 0, moved); setRoute(next); };
  const undo = () => { const previous = history.current.pop(); if (previous) { onChange({ route: previous }); refresh((n) => n + 1); } };
  const drag = (id: string, point: Point) => {
    if (!id.startsWith("wp:")) return;
    if (!dragging.current) { dragging.current = true; remember(); }
    const index = Number(id.slice(3)); onChange({ route: draft.route.map((item, position) => position === index ? point : item) });
  };
  return <section className="group-editor-section ptpl-route-section">
    <header><h3>巡查路線</h3><div className="ptpl-route-tools"><Button icon={<UndoOutlined />} disabled={!history.current.length} onClick={undo}>復原</Button><Button variant="danger" icon={<DeleteOutlined />} disabled={!draft.route.length} onClick={() => setRoute([])}>清除路線</Button></div></header>
    <p className="tpl-hint">在地圖上依次點選途經點，連線成巡查路線；可拖動途經點調整位置。巡查計劃模板可只有路線而不列對象，由前線在現場新增巡查。</p>
    <div className="ptpl-map-wrap"><PlanMap className="ptpl-map" route={draft.route.length >= 2 ? draft.route : undefined} markers={markers} selected={selected} onSelect={setSelected} onPick={(point) => { setRoute([...draft.route, point]); setSelected(null); }}
      onMarkerDrag={drag} onMarkerDragEnd={() => { dragging.current = false; }} fitKey={`route-${draft.id || "new"}`} legend={<><LegendItem tone="route">巡查路線</LegendItem><LegendItem tone="todo">途經點</LegendItem><LegendItem tone="object">對象</LegendItem></>} /></div>
    <div className="ptpl-route-summary"><span>途經點 <strong>{draft.route.length}</strong> 個</span><span>路線長度 <strong>{meters(routeLength(draft.route))}</strong> 米</span>{draft.route.length === 1 && <em>路線至少需要 2 個途經點</em>}</div>
    {draft.route.length > 0 && <div className="tpl-table-wrap"><table className="dense-table fluid tpl-editor-table"><thead><tr><th style={{ width: 56 }}>次序</th><th>位置（地圖坐標）</th><th style={{ width: 140 }}>所在網格</th><th style={{ width: 120 }}>與上一點距離</th><th style={{ width: 150 }}>操作</th></tr></thead>
      <tbody>{draft.route.map((point, index) => <tr key={index} className={selected === `wp:${index}` ? "selected" : ""} onClick={() => setSelected(`wp:${index}`)}>
        <td>{index + 1}</td><td>{point[0]}, {point[1]}</td><td>{locateName(point[0], point[1])}</td><td>{index ? `${meters(Math.hypot(point[0] - draft.route[index - 1][0], point[1] - draft.route[index - 1][1]))} 米` : "—"}</td>
        <td onClick={(event) => event.stopPropagation()}><span className="obj-def-actions"><button type="button" aria-label={`上移途經點 ${index + 1}`} disabled={index === 0} onClick={() => move(index, -1)}><ArrowUpOutlined /></button><button type="button" aria-label={`下移途經點 ${index + 1}`} disabled={index === draft.route.length - 1} onClick={() => move(index, 1)}><ArrowDownOutlined /></button><button type="button" aria-label={`移除途經點 ${index + 1}`} onClick={() => { setRoute(draft.route.filter((_, position) => position !== index)); setSelected(null); }}><CloseOutlined /></button></span></td>
      </tr>)}</tbody></table></div>}
  </section>;
}

// ---- 對象及巡查模板 ----
function TemplateCell({ setting, templates, objectById, onChange }: { setting: PlanTemplateObject; templates: ReturnType<typeof usePlanTemplateCatalog>["templates"]; objectById: ReturnType<typeof usePlanTemplateCatalog>["objectById"]; onChange: (templateIds: string[]) => void }) {
  const object = objectById.get(setting.objectId);
  const available = object ? applicableTemplates(object, templates).filter((template) => !setting.templateIds.includes(template.id)) : [];
  return <div className="ptpl-template-cell">
    {setting.templateIds.map((id) => { const template = templates.find((item) => item.id === id); const invalid = !template || template.status !== "生效" || (object && !templateAppliesToObject(template, object)); return <span key={id} className={`ptpl-tag ${invalid ? "invalid" : ""}`}>{template?.name ?? id}{template && template.status !== "生效" ? "（失效）" : ""}<button type="button" aria-label={`移除巡查模板 ${template?.name ?? id}`} onClick={() => onChange(setting.templateIds.filter((item) => item !== id))}><CloseOutlined /></button></span>; })}
    {!setting.templateIds.length && <em>尚未選擇</em>}
    {available.length > 0 && <Select ariaLabel={`${object?.name ?? setting.objectId}加入巡查模板`} value="" onChange={(id) => id && onChange([...setting.templateIds, id])}><option value="">＋ 加入巡查模板</option>{available.map((template) => <option key={template.id} value={template.id}>{template.name}</option>)}</Select>}
  </div>;
}

function ObjectsTab({ draft, onChange }: { draft: PlanTemplate; onChange: (patch: Patch) => void }) {
  const { showToast } = useToast();
  const { objects, objectById, templates } = usePlanTemplateCatalog();
  const [search, setSearch] = useState(""); const [grid, setGrid] = useState("");
  const [picker, setPicker] = useState<"all" | "near" | null>(null); const [radius, setRadius] = useState(SCAN_RADIUS_DEFAULT);
  const [batchEdit, setBatchEdit] = useState(false); const [batchMode, setBatchMode] = useState<"add" | "replace">("add"); const [batchChoice, setBatchChoice] = useState<Record<string, string>>({}); const [batchError, setBatchError] = useState("");
  const rows = draft.objects.map((setting, index) => ({ setting, index, object: objectById.get(setting.objectId) })).filter(({ object }) => !object || ((!grid || object.grid === grid) && (contains(object.name, search) || contains(object.code, search) || contains(object.address, search))));
  const { selected, allSelected, toggle, toggleAll, drop } = useSelection(rows.map((row) => row.setting.objectId));
  const taken = new Set(draft.objects.map((setting) => setting.objectId));
  const candidates = objects.filter((object) => object.active && !taken.has(object.id));
  const nearby = objectsNearRoute(draft.route, candidates, radius / METERS_PER_PX);
  const gridOptions = unique(draft.objects.flatMap((setting) => objectById.get(setting.objectId)?.grid ?? []));
  const defaultFor = (objectId: string) => { const object = objectById.get(objectId); const first = object ? applicableTemplates(object, templates)[0] : undefined; return first ? [first.id] : []; };
  const update = (objectId: string, templateIds: string[]) => onChange({ objects: draft.objects.map((setting) => setting.objectId === objectId ? { ...setting, templateIds } : setting) });
  const remove = (ids: string[]) => { onChange({ objects: draft.objects.filter((setting) => !ids.includes(setting.objectId)) }); drop(ids); };
  const move = (index: number, delta: number) => { const next = [...draft.objects]; const [moved] = next.splice(index, 1); next.splice(index + delta, 0, moved); onChange({ objects: next }); };
  const add = (ids: string[]) => { onChange({ objects: [...draft.objects, ...ids.map((objectId) => ({ objectId, templateIds: defaultFor(objectId) }))] }); setPicker(null); showToast(`已加入 ${ids.length} 個對象，並預設選擇生效且適用的巡查模板`); };
  const scan = () => { if (draft.route.length < 1) { showToast("請先在「路線」設定途經點", "error"); return; } setPicker("near"); };
  // 按巡查類型批量選擇：每種巡查類型選一個適用於全部所選對象的巡查模板
  const selectedObjects = draft.objects.filter((setting) => selected.includes(setting.objectId)).flatMap((setting) => objectById.get(setting.objectId) ?? []);
  const typesSelected = unique(selectedObjects.map((object) => object.inspectionType));
  const optionsFor = (type: string) => { const group = selectedObjects.filter((object) => object.inspectionType === type); return templates.filter((template) => template.status === "生效" && template.inspectionType === type && group.every((object) => templateAppliesToObject(template, object))); };
  const openBatchEdit = () => { setBatchMode("add"); setBatchChoice({}); setBatchError(""); setBatchEdit(true); };
  const applyBatchEdit = () => {
    const chosen = Object.entries(batchChoice).filter(([, id]) => id);
    if (!chosen.length) { setBatchError("請至少為一種巡查類型選擇巡查模板。"); return; }
    onChange({ objects: draft.objects.map((setting) => {
      const object = objectById.get(setting.objectId); const id = object && selected.includes(setting.objectId) ? batchChoice[object.inspectionType] : "";
      if (!id) return setting;
      return { ...setting, templateIds: batchMode === "replace" ? [id] : setting.templateIds.includes(id) ? setting.templateIds : [...setting.templateIds, id] };
    }) });
    setBatchEdit(false);
  };
  const markers: MapMarkerSpec[] = draft.objects.flatMap((setting, index): MapMarkerSpec[] => { const object = objectById.get(setting.objectId); return object ? [{ id: object.id, kind: "object", x: object.x, y: object.y, tone: "object", label: String(index + 1), title: `${index + 1}. ${object.name}`, detail: <span>{object.address}<br />{object.grid} · {setting.templateIds.length} 個巡查模板</span> }] : []; });
  const inspections = draft.objects.reduce((sum, setting) => sum + setting.templateIds.length, 0);
  return <>
    <p className="tpl-hint">每個對象可配一個或多個巡查模板，生成計劃時按「對象 × 巡查模板」產生相應數量的巡查；巡查模板只列出生效、同巡查類型且適用該對象的。對象次序即巡查次序，模板沒有途經點時路線按此次序連線。</p>
    <section className="group-editor-section ptpl-preview-section"><header><h3>地圖預覽</h3><span className="ptpl-summary">{draft.objects.length} 個對象 · 產生 {inspections} 個巡查</span></header>
      <div className="ptpl-map-wrap small"><PlanMap className="ptpl-map" route={draft.route.length >= 2 ? draft.route : draft.objects.length >= 2 ? markers.map((marker): Point => [marker.x, marker.y]) : undefined} markers={markers} fitKey={`objects-${draft.id || "new"}-${draft.objects.length}`} legend={<><LegendItem tone="route">{draft.route.length >= 2 ? "巡查路線" : "路線（按對象次序）"}</LegendItem><LegendItem tone="object">對象</LegendItem></>} /></div>
    </section>
    <section className="group-editor-section tpl-list-section">
      <header><h3>對象及巡查模板</h3><div className="ptpl-route-tools"><Button icon={<RadarChartOutlined />} onClick={scan}>掃描路線附近</Button><Button variant="primary" icon={<PlusOutlined />} onClick={() => setPicker("all")}>批量新增</Button></div></header>
      <div className="tpl-section-toolbar"><div className="group-user-search"><SearchOutlined /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="搜尋已加入的對象名稱、編號或地址" /></div><Select ariaLabel="篩選網格" value={grid} onChange={setGrid}><option value="">全部網格</option>{gridOptions.map((option) => <option key={option}>{option}</option>)}</Select></div>
      {selected.length > 0 && <div className="batch-bar"><strong>已選 {selected.length} 個</strong><Button icon={<EditOutlined />} onClick={openBatchEdit}>批量選擇巡查模板</Button><Button variant="danger" icon={<DeleteOutlined />} onClick={() => remove(selected)}>批量移除</Button></div>}
      <div className="tpl-table-wrap"><table className="dense-table tpl-editor-table ptpl-object-table">
        <thead><tr><th className="check-cell"><input type="checkbox" aria-label="全選對象" checked={allSelected} disabled={!rows.length} onChange={toggleAll} /></th><th style={{ width: 54 }}>次序</th><th style={{ width: 96 }}>對象編號</th><th style={{ width: 170 }}>對象名稱</th><th style={{ width: 110 }}>巡查類型</th><th style={{ width: 110 }}>所屬網格</th><th>巡查模板</th><th style={{ width: 130 }}>操作</th></tr></thead>
        <tbody>{rows.map(({ setting, index, object }) => <tr key={setting.objectId}>
          <td className="check-cell"><input type="checkbox" aria-label={`選擇 ${object?.name ?? setting.objectId}`} checked={selected.includes(setting.objectId)} onChange={() => toggle(setting.objectId)} /></td>
          <td>{index + 1}</td><td>{object?.code ?? setting.objectId}</td><td title={object?.name}>{object ? `${object.name}${object.active ? "" : "（停用）"}` : "（對象已不存在）"}</td><td>{object?.inspectionType ?? "—"}</td><td>{object?.grid ?? "—"}</td>
          <td><TemplateCell setting={setting} templates={templates} objectById={objectById} onChange={(ids) => update(setting.objectId, ids)} /></td>
          <td><span className="obj-def-actions"><button type="button" aria-label="上移" disabled={index === 0 || !!search || !!grid} onClick={() => move(index, -1)}><ArrowUpOutlined /></button><button type="button" aria-label="下移" disabled={index === draft.objects.length - 1 || !!search || !!grid} onClick={() => move(index, 1)}><ArrowDownOutlined /></button><button type="button" aria-label={`移除 ${object?.name ?? setting.objectId}`} onClick={() => remove([setting.objectId])}><CloseOutlined /></button></span></td>
        </tr>)}</tbody>
      </table>{!rows.length && <div className="tpl-empty">{draft.objects.length ? "沒有符合篩選的對象" : "尚未加入對象；模板可只有路線，由前線在現場新增巡查"}</div>}</div>
    </section>
    {picker === "all" && <BatchPickerDrawer title="批量新增對象" noun="對象" description="搜尋及複選生效的巡查對象，一次加入；加入後可為每個對象選擇巡查模板。" filterLabel="網格" rows={candidates.map((object) => ({ id: object.id, title: object.name, meta: `${object.code} · ${object.inspectionType} · ${object.grid} · ${object.address}`, group: object.grid }))} onClose={() => setPicker(null)} onConfirm={add} />}
    {picker === "near" && <BatchPickerDrawer title="掃描路線附近的對象" noun="對象" description="列出路線及途經點附近、尚未加入的生效對象，按距離由近至遠排列。" filterLabel="網格" confirmLabel="加入所選對象"
      rows={nearby.map(({ object, distance }) => ({ id: object.id, title: object.name, meta: `${object.code} · ${object.inspectionType} · ${object.grid} · 距路線約 ${meters(distance)} 米`, group: object.grid }))}
      footer={<div className="form-grid"><Field label="掃描範圍（米）" hint={`${SCAN_RADIUS_MIN}–${SCAN_RADIUS_MAX} 米；以途經點及相鄰途經點之間的連線計算`}><input type="number" min={SCAN_RADIUS_MIN} max={SCAN_RADIUS_MAX} step={10} value={radius} onChange={(event) => setRadius(Math.min(SCAN_RADIUS_MAX, Math.max(SCAN_RADIUS_MIN, Number(event.target.value) || SCAN_RADIUS_DEFAULT)))} /></Field></div>}
      onClose={() => setPicker(null)} onConfirm={add} />}
    {batchEdit && <BatchEditDrawer title="批量選擇巡查模板" count={selected.length} error={batchError} onClose={() => setBatchEdit(false)} onApply={applyBatchEdit}>
      <Field label="套用方式"><Select ariaLabel="套用方式" value={batchMode} onChange={(value) => setBatchMode(value as "add" | "replace")}><option value="add">加入（保留原有巡查模板）</option><option value="replace">取代原有巡查模板</option></Select></Field>
      {typesSelected.map((type) => <Field key={type} label={type} hint={`${selectedObjects.filter((object) => object.inspectionType === type).length} 個對象；只列出適用於全部這些對象的生效巡查模板`}>
        <Select ariaLabel={`${type}巡查模板`} value={batchChoice[type] ?? ""} onChange={(value) => { setBatchChoice((current) => ({ ...current, [type]: value })); setBatchError(""); }}><option value="">不更改</option>{optionsFor(type).map((template) => <option key={template.id} value={template.id}>{template.name}</option>)}</Select></Field>)}
    </BatchEditDrawer>}
  </>;
}

function GroupsTab({ draft, onChange }: { draft: PlanTemplate; onChange: (patch: Patch) => void }) {
  const toggle = (id: string) => onChange({ groups: inspectionGroupIds.filter((groupId) => groupId === id ? !draft.groups.includes(id) : draft.groups.includes(groupId)) });
  return <section className="group-editor-section"><header><h3>適用巡查群組</h3></header><div className="tpl-group-body">
    <p className="tpl-hint">建立計劃時只可選擇這些巡查群組；未選擇群組時，巡查計劃模板適用全部巡查群組。</p>
    <div className="tpl-group-list">{inspectionGroups.map((group) => <label key={group.id}><input type="checkbox" checked={draft.groups.includes(group.id)} onChange={() => toggle(group.id)} /><span><strong>{group.name}</strong><small>{group.department} · 網格：{group.grids.join("、")}</small></span></label>)}</div>
  </div></section>;
}

function BasicTab({ draft, onChange, onSubmit }: { draft: PlanTemplate; onChange: (patch: Patch) => void; onSubmit: () => void }) {
  // Plans generated from this template (each keeps its own snapshot); open ones are 未開始 or 進行中.
  const { plans } = useDemo();
  const planRefs = draft.id ? plans.filter((plan) => plan.planTemplateId === draft.id) : [];
  const openRefs = planRefs.filter((plan) => plan.status === "未開始" || plan.status === "進行中");
  const isNew = !draft.id; const [confirmDisable, setConfirmDisable] = useState(false);
  const changeStatus = (active: boolean) => { if (!active && openRefs.length > 0) setConfirmDisable(true); else onChange({ status: active ? "生效" : "失效" }); };
  const submit = (event: FormEvent) => { event.preventDefault(); onSubmit(); };
  return <form className="tpl-basic-form" onSubmit={submit}>
    <section className="group-editor-section"><header><h3>巡查計劃模板資料</h3></header><div className="group-editor-grid">
      <Field label="編號" required hint="唯一，儲存後不可修改"><input value={draft.code} disabled={!isNew} onChange={(event) => onChange({ code: event.target.value })} placeholder="例如 PLT008" /></Field>
      <Field label="名稱" required hint="1–50 字，不可與其他巡查計劃模板同名"><input value={draft.name} maxLength={50} onChange={(event) => onChange({ name: event.target.value })} placeholder="請輸入名稱" /></Field>
      <Field label="說明"><textarea rows={3} value={draft.description} onChange={(event) => onChange({ description: event.target.value })} placeholder="說明路線範圍、適用情景" /></Field>
      <Field label="其他執行規則" hint={`內容待確認，暫以文字記錄；不超過 ${RULES_MAX} 字`}><textarea rows={3} value={draft.rules} maxLength={RULES_MAX} onChange={(event) => onChange({ rules: event.target.value })} placeholder="選填" /></Field>
    </div></section>
    <section className="group-editor-section"><header><h3>巡查計劃模板狀態</h3></header><div className="group-editor-status"><div className="bip-field"><span>狀態</span><div className="switch-row"><label className="switch-control"><input type="checkbox" aria-label="巡查計劃模板生效" checked={draft.status === "生效"} onChange={(event) => changeStatus(event.target.checked)} /><span className="switch" /></label></div></div><div className="group-editor-count"><span>使用中的巡查計劃（共 {planRefs.length} 個）</span><strong>{openRefs.length}</strong></div></div></section>
    <button type="submit" className="sr-only">儲存</button>
    <ConfirmDialog open={confirmDisable} title="停用巡查計劃模板？" message={`此巡查計劃模板正被 ${openRefs.length} 個未開始或進行中的巡查計劃使用。停用後不可再用於新計劃；這些計劃沿用建立時的快照，已生成的巡查不受影響。`} danger confirmLabel="確認停用" onCancel={() => setConfirmDisable(false)} onConfirm={() => { onChange({ status: "失效" }); setConfirmDisable(false); }} />
  </form>;
}

function Editor({ draft, tab, errors, onTab, onChange, onSubmit }: { draft: PlanTemplate; tab: PlanTemplateTab; errors: PlanTemplateError[]; onTab: (tab: PlanTemplateTab) => void; onChange: (patch: Patch) => void; onSubmit: () => void }) {
  const errorRef = useRef<HTMLDivElement>(null);
  useEffect(() => { if (errors.length) errorRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" }); }, [errors]);
  const counts: Partial<Record<PlanTemplateTab, number>> = { route: draft.route.length, objects: draft.objects.length, groups: draft.groups.length };
  return <div className="tpl-editor">
    <nav className="bip-editor-tabs" role="tablist" aria-label="巡查計劃模板設定">{editorTabs.map((item) => <button type="button" role="tab" key={item.key} aria-selected={tab === item.key} className={tab === item.key ? "active" : ""} onClick={() => onTab(item.key)}>{item.label}{counts[item.key] !== undefined && <span>{counts[item.key]}</span>}</button>)}</nav>
    <div className="tpl-tab-content" role="tabpanel">
      {errors.length > 0 && <div ref={errorRef} className="tpl-editor-error" role="alert">{errors.map((error) => error.message).join(" ")}</div>}
      {tab === "basic" && <BasicTab draft={draft} onChange={onChange} onSubmit={onSubmit} />}
      {tab === "route" && <RouteTab draft={draft} onChange={onChange} />}
      {tab === "objects" && <ObjectsTab draft={draft} onChange={onChange} />}
      {tab === "groups" && <GroupsTab draft={draft} onChange={onChange} />}
    </div>
  </div>;
}

export function PlanTemplatesPage() {
  const { showToast } = useToast();
  const { planTemplates: templates, savePlanTemplates, plans } = useDemo();
  const { context, templates: inspectionTemplates } = usePlanTemplateCatalog();
  const [filters, setFilters] = useState<Filters>(emptyFilters);
  const [page, setPage] = useState(1); const [pageSize, setPageSize] = useState(15);
  const [params] = useSearchParams(); // ?template=ID opens that template (linked from plan detail)
  const [draft, setDraft] = useState<PlanTemplate | null>(() => { const linked = templates.find((item) => item.id === params.get("template")); return linked ? structuredClone(linked) : null; });
  const [tab, setTab] = useState<PlanTemplateTab>("basic"); const [errors, setErrors] = useState<PlanTemplateError[]>([]);
  const filter = (key: keyof Filters, value: string) => { setFilters((current) => ({ ...current, [key]: value })); setPage(1); };
  const rows = templates.filter((template) => contains(template.code, filters.code) && contains(template.name, filters.name)
    && (!filters.group || !template.groups.length || template.groups.includes(filters.group)) && (!filters.status || template.status === filters.status));
  const open = (template: PlanTemplate) => { setDraft(structuredClone(template)); setTab("basic"); setErrors([]); };
  const change = (patch: Patch) => { setDraft((current) => current ? { ...current, ...patch } : current); setErrors([]); };
  const save = () => {
    if (!draft) return;
    const template: PlanTemplate = { ...draft, code: draft.code.trim(), name: draft.name.trim(), description: draft.description.trim(), rules: draft.rules.trim() };
    const found = validatePlanTemplate(template, templates, context);
    if (found.length) { setErrors(found); if (!found.some((error) => error.tab === tab)) setTab(found[0].tab); return; }
    const saved: PlanTemplate = { ...template, id: template.id || template.code, updatedBy: "陳家朗", updatedAt: nowText() };
    savePlanTemplates(templates.some((item) => item.id === saved.id) ? templates.map((item) => item.id === saved.id ? saved : item) : [saved, ...templates]);
    setDraft(null);
    showToast(template.id ? "巡查計劃模板已更新" : "巡查計劃模板已建立");
  };
  const copy = (template: PlanTemplate) => { setDraft(copyPlanTemplate(template, templates)); setTab("basic"); setErrors([]); showToast(`已複製「${template.name}」，請確認編號及名稱後儲存`); };
  const usage = (template: PlanTemplate) => plans.filter((plan) => plan.planTemplateId === template.id).length;
  const templateNames = (template: PlanTemplate) => templateIdsOf(template).map((id) => inspectionTemplates.find((item) => item.id === id)?.name ?? id).join("、") || "—";
  const columns: Column<PlanTemplate>[] = ([
    { key: "code", title: "編號", width: 100 },
    { key: "name", title: "名稱", width: 230 },
    { key: "route", title: "路線途經點", width: 110, render: (template) => template.route.length ? `${template.route.length} 個` : "無路線", sortValue: (template) => template.route.length },
    { key: "routeLength", title: "路線長度（米）", width: 120, render: (template) => template.route.length > 1 ? meters(routeLength(template.route)) : "—", sortValue: (template) => routeLength(template.route) },
    { key: "objects", title: "對象", width: 90, render: (template) => template.objects.length ? `${template.objects.length} 個` : "只有路線", sortValue: (template) => template.objects.length },
    { key: "templates", title: "巡查模板", width: 230, render: templateNames, sortValue: templateNames },
    { key: "inspections", title: "產生巡查數", width: 110, render: (template) => `${template.objects.reduce((sum, object) => sum + object.templateIds.length, 0)} 個`, sortValue: (template) => template.objects.reduce((sum, object) => sum + object.templateIds.length, 0) },
    { key: "groups", title: "適用巡查群組", width: 160, render: groupsText, sortValue: groupsText },
    { key: "plans", title: "使用中的計劃", width: 120, render: (template) => `${usage(template)} 個`, sortValue: usage },
    { key: "status", title: "狀態", width: 85, render: (template) => <StatusTag tone={template.status === "生效" ? "success" : "neutral"}>{template.status}</StatusTag> },
    { key: "updatedBy", title: "更新人", width: 100 },
    { key: "updatedAt", title: "更新時間", width: 160 },
  ] satisfies Column<PlanTemplate>[]).map((column) => ({ ...column, sortable: true }));
  return <div className="page-content tpl-page ptpl-page">
    <PageHeader title="巡查計劃模板" actions={<><Button icon={<ExportOutlined />}>匯出</Button><Button variant="primary" icon={<PlusOutlined />} onClick={() => open({ ...newPlanTemplate(), code: nextPlanTemplateCode(templates) })}>新增巡查計劃模板</Button></>} />
    <section className="panel list-panel tpl-list-panel ptpl-list-panel">
      <div className="filter-bar tpl-filter-bar ptpl-filter-bar">
        <label className="filter-field"><span>編號</span><input aria-label="編號" value={filters.code} onChange={(event) => filter("code", event.target.value)} placeholder="請輸入編號" /></label>
        <label className="filter-field"><span>名稱</span><input aria-label="名稱" value={filters.name} onChange={(event) => filter("name", event.target.value)} placeholder="請輸入名稱" /></label>
        <label className="filter-field"><span>適用巡查群組</span><Select ariaLabel="適用巡查群組" value={filters.group} onChange={(value) => filter("group", value)}><option value="">全部巡查群組</option>{inspectionGroups.map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}</Select></label>
        <label className="filter-field"><span>狀態</span><Select ariaLabel="狀態" value={filters.status} onChange={(value) => filter("status", value)}><option value="">全部狀態</option><option>生效</option><option>失效</option></Select></label>
        <div className="user-filter-actions"><Button variant="text" icon={<ReloadOutlined />} onClick={() => { setFilters(emptyFilters); setPage(1); }}>重設</Button></div>
      </div>
      <DenseTable rows={rows} columns={columns} stickyActions actionTitle="操作" page={Math.min(page, Math.max(1, Math.ceil(rows.length / pageSize)))} pageSize={pageSize} onSort={() => setPage(1)}
        renderActions={(template) => <><button className="table-action-button" aria-label={`編輯 ${template.name}`} onClick={() => open(template)}><EditOutlined />編輯</button><button className="table-action-button" aria-label={`複製 ${template.name}`} onClick={() => copy(template)}><CopyOutlined />複製</button></>} />
      <Pagination total={rows.length} page={page} pageSize={pageSize} onPageChange={setPage} onPageSizeChange={(size) => { setPageSize(size); setPage(1); }} />
    </section>
    <FormDrawer open={!!draft} title={draft?.id ? "編輯巡查計劃模板" : "新增巡查計劃模板"} subtitle={draft?.id ? draft.code : undefined} className="tpl-editor-drawer ptpl-editor-drawer" onClose={() => setDraft(null)} onSubmit={save}>
      {draft && <Editor draft={draft} tab={tab} errors={errors} onTab={setTab} onChange={change} onSubmit={save} />}
    </FormDrawer>
  </div>;
}

/** Exported for the render smoke test. */
export { Editor as PlanTemplateEditor };
