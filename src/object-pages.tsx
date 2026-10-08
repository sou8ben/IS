import { useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeftOutlined, CheckOutlined, EditOutlined, EnvironmentOutlined, ExportOutlined, EyeOutlined, PlusOutlined, ReloadOutlined, StopOutlined, UnorderedListOutlined, WarningFilled } from "@ant-design/icons";
import { AttachmentField } from "./attachments";
import { Button, ConfirmDialog, DenseTable, FormDrawer, PageHeader, Pagination, Select, StatusTag, useToast } from "./components";
import { latLng } from "./event-data";
import { areaM2, formatArea, lngLatToPx, ringsPx, type GridRecord } from "./grid-rules";
import { useInspections } from "./inspection-data";
import { resultOf, type InspectionRecord } from "./inspection-rules";
import { draftOfForm, emptyObjectForm, formOfObject, ObjectForm, ObjectIssueSummary, WorkGroupsEditor, type ObjectFormState } from "./object-form";
import { groupCatalog } from "./group-catalog";
import { assignGrid, nextObjectId, templatesOfObject, validateObject, validateWorkGroups, type ManagedObject, type ObjectIssue, type WorkGroupRow } from "./object-rules";
import { LegendItem, PlanMap, type MapLayerChip, type MapMarkerSpec, type MapPolygonSpec } from "./plan-map";
import { useDemo } from "./store";
import type { Column } from "./types";

const contains = (value: string, query: string) => !query.trim() || value.toLowerCase().includes(query.trim().toLowerCase());
const shapeKind = (object: ManagedObject) => !object.geojson ? "無" : object.geojson.type === "Point" ? "點" : "面";
const palette = ["#2468c9", "#18a058", "#e8830c", "#8e44ad", "#d93026", "#0f8f7e", "#c2410c", "#4f46e5"];

function download(name: string, data: unknown) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/geo+json" }));
  const link = document.createElement("a"); link.href = url; link.download = name; link.click(); URL.revokeObjectURL(url);
}
/** Grid of an object as shown: 自動 follows the position, 手動 is the chosen grid. */
function gridOf(object: ManagedObject, grids: GridRecord[]) { const id = assignGrid(object, grids); return grids.find((grid) => grid.id === id); }
const shapePolygon = (object: ManagedObject, extra: Partial<MapPolygonSpec> = {}): MapPolygonSpec[] => object.geojson && object.geojson.type !== "Point" ? [{ id: `shape-${object.id}`, rings: ringsPx(object.geojson), label: object.name, color: "#e60012", ...extra }] : [];

type ObjRow = ManagedObject & { gridName: string; shape: string };
const emptyFilters = { code: "", name: "", type: "", grid: "", mode: "", address: "", status: "" };

// ---- 列表 ----
export function ObjectListPage() {
  const navigate = useNavigate(); const { objects, grids, inspectionTypes: typeRecords } = useDemo(); const typeNames = typeRecords.map((type) => type.name);
  const [view, setView] = useState<"list" | "map">("list"); const [filters, setFilters] = useState(emptyFilters); const [page, setPage] = useState(1); const [pageSize, setPageSize] = useState(15);
  const [selected, setSelected] = useState<string | null>(null); const [layers, setLayers] = useState({ objects: true, shapes: true, grids: false });
  const filter = (key: keyof typeof emptyFilters, value: string) => { setFilters((current) => ({ ...current, [key]: value })); setPage(1); };
  const all: ObjRow[] = useMemo(() => objects.map((object) => ({ ...object, gridName: gridOf(object, grids)?.name ?? "未歸屬", shape: shapeKind(object) })), [objects, grids]);
  const rows = all.filter((object) => contains(object.code, filters.code) && contains(object.name, filters.name) && (!filters.type || object.inspectionType === filters.type) && (!filters.grid || object.gridName === filters.grid)
    && (!filters.mode || object.gridAssignMode === filters.mode) && contains(object.address, filters.address) && (!filters.status || object.status === filters.status));
  const columns: Column<ObjRow>[] = ([
    { key: "code", title: "對象編號", width: 130 },
    { key: "name", title: "對象名稱", width: 200 },
    { key: "inspectionType", title: "巡查類型", width: 130 },
    { key: "gridName", title: "所屬網格", width: 130 },
    { key: "gridAssignMode", title: "網格方式", width: 90, render: (object) => <StatusTag tone={object.gridAssignMode === "手動" ? "warning" : "neutral"}>{object.gridAssignMode}</StatusTag> },
    { key: "address", title: "地址", width: 240 },
    { key: "latitude", title: "經緯度", width: 170, render: (object) => `${object.latitude.toFixed(5)}, ${object.longitude.toFixed(5)}`, sortValue: (object) => object.latitude },
    { key: "shape", title: "地圖範圍", width: 90 },
    { key: "attachments", title: "附件數", width: 80, render: (object) => object.attachments.length || "—", sortValue: (object) => object.attachments.length },
    { key: "status", title: "狀態", width: 90, render: (object) => <StatusTag tone={object.status === "啟用" ? "success" : "neutral"}>{object.status}</StatusTag> },
  ] satisfies Column<ObjRow>[]).map((column) => ({ ...column, sortable: true }));
  const gridNames = [...new Set(grids.map((grid) => grid.name)), "未歸屬"];
  const polygons: MapPolygonSpec[] = [
    ...(layers.grids ? grids.map((grid, index) => ({ id: `grid-${grid.id}`, rings: ringsPx(grid.boundary), label: grid.name, color: grid.status === "啟用" ? palette[index % palette.length] : undefined, dim: true, dashed: grid.status !== "啟用" })) : []),
    ...(layers.shapes ? rows.flatMap((object) => shapePolygon(object, { dashed: object.status !== "啟用", dim: object.status !== "啟用" })) : []),
  ];
  const markers: MapMarkerSpec[] = layers.objects ? rows.map((object) => { const [x, y] = lngLatToPx([object.longitude, object.latitude]); return { id: object.id, kind: "object" as const, x, y, tone: object.status === "啟用" ? "object" as const : "todo" as const, title: object.name, detail: <span>{object.code} · {object.inspectionType}<br />{object.address}<br />網格：{object.gridName}<br /><Link to={`/config/objects/${object.id}`}>查看對象</Link></span> }; }) : [];
  const chips: MapLayerChip[] = [{ key: "objects", label: "對象", count: rows.length, on: layers.objects }, { key: "shapes", label: "地圖範圍", count: rows.filter((object) => object.shape === "面").length, on: layers.shapes }, { key: "grids", label: "網格", count: grids.length, on: layers.grids }];
  return <div className="page-content obj-page">
    <PageHeader title="對象管理" actions={<>
      <Button icon={view === "list" ? <EnvironmentOutlined /> : <UnorderedListOutlined />} onClick={() => setView(view === "list" ? "map" : "list")}>{view === "list" ? "地圖視圖" : "列表視圖"}</Button>
      <Button icon={<ExportOutlined />} onClick={() => download("objects.geojson", { type: "FeatureCollection", features: all.map((object) => ({ type: "Feature", properties: { code: object.code, name: object.name, inspectionType: object.inspectionType, address: object.address, status: object.status, grid: object.gridName }, geometry: { type: "Point", coordinates: [object.longitude, object.latitude] } })) })}>匯出</Button>
      <Button variant="primary" icon={<PlusOutlined />} onClick={() => navigate("/config/objects/new")}>新增對象</Button></>} />
    <section className="panel list-panel obj-list-panel">
      <div className="filter-bar obj-filter-bar">
        <label className="filter-field"><span>對象編號</span><input aria-label="對象編號" value={filters.code} onChange={(event) => filter("code", event.target.value)} placeholder="請輸入對象編號" /></label>
        <label className="filter-field"><span>對象名稱</span><input aria-label="對象名稱" value={filters.name} onChange={(event) => filter("name", event.target.value)} placeholder="請輸入對象名稱" /></label>
        <label className="filter-field"><span>巡查類型</span><Select ariaLabel="巡查類型" value={filters.type} onChange={(value) => filter("type", value)}><option value="">全部巡查類型</option>{typeNames.map((type) => <option key={type}>{type}</option>)}</Select></label>
        <label className="filter-field"><span>所屬網格</span><Select ariaLabel="所屬網格" value={filters.grid} onChange={(value) => filter("grid", value)}><option value="">全部網格</option>{gridNames.map((name) => <option key={name}>{name}</option>)}</Select></label>
        <label className="filter-field"><span>網格方式</span><Select ariaLabel="網格方式" value={filters.mode} onChange={(value) => filter("mode", value)}><option value="">全部</option><option>自動</option><option>手動</option></Select></label>
        <label className="filter-field"><span>地址</span><input aria-label="地址" value={filters.address} onChange={(event) => filter("address", event.target.value)} placeholder="請輸入地址關鍵字" /></label>
        <label className="filter-field"><span>狀態</span><Select ariaLabel="狀態" value={filters.status} onChange={(value) => filter("status", value)}><option value="">全部狀態</option><option>啟用</option><option>停用</option></Select></label>
        <div className="user-filter-actions"><Button variant="text" icon={<ReloadOutlined />} onClick={() => { setFilters(emptyFilters); setPage(1); }}>重設</Button></div>
      </div>
      {view === "list" ? <>
        <DenseTable rows={rows} columns={columns} stickyActions actionTitle="操作" page={Math.min(page, Math.max(1, Math.ceil(rows.length / pageSize)))} pageSize={pageSize} onSort={() => setPage(1)} emptyText="沒有符合條件的對象" renderActions={(object) => <button className="table-action-button" aria-label={`查看 ${object.name}`} onClick={() => navigate(`/config/objects/${object.id}`)}><EyeOutlined />查看</button>} />
        <Pagination total={rows.length} page={page} pageSize={pageSize} onPageChange={setPage} onPageSizeChange={(size) => { setPageSize(size); setPage(1); }} />
      </> : <div className="evt-map-wrap"><PlanMap polygons={polygons} markers={markers} layers={chips} onToggleLayer={(key) => setLayers((current) => ({ ...current, [key]: !current[key as keyof typeof current] }))} selected={selected} onSelect={setSelected} fitKey={`${rows.length}-${filters.type}-${filters.grid}`}
        legend={<><LegendItem tone="object">啟用對象</LegendItem><LegendItem tone="todo">停用對象</LegendItem><LegendItem tone="route">地圖範圍</LegendItem></>} /></div>}
    </section>
  </div>;
}

// ---- 新增 ----
export function ObjectCreatePage() {
  const navigate = useNavigate(); const { showToast } = useToast(); const { objects, grids, inspectionTypes: typeRecords, saveObjects } = useDemo();
  const [form, setForm] = useState<ObjectFormState>(emptyObjectForm); const [issues, setIssues] = useState<ObjectIssue[]>([]);
  const change = (patch: Partial<ObjectFormState>) => { setForm((current) => ({ ...current, ...patch })); setIssues([]); };
  const save = () => {
    const id = nextObjectId(objects.map((object) => object.id));
    const { draft, problems } = draftOfForm(form, id);
    const result = validateObject(draft, { all: objects, inspectionTypes: typeRecords.map((type) => type.name), grids, groups: groupCatalog });
    const found = [...problems, ...result.errors];
    if (found.length || !result.record) { setIssues(found); showToast(`請修正 ${found.length} 項問題`, "error"); window.scrollTo?.({ top: 0 }); return; }
    saveObjects([...objects, result.record]); showToast("對象已建立"); navigate(`/config/objects/${id}`);
  };
  return <div className="page-content obj-create-page">
    <PageHeader eyebrow="對象管理 / 新增對象" title="新增對象" actions={<><Button onClick={() => navigate("/config/objects")}>取消</Button><Button variant="primary" icon={<CheckOutlined />} onClick={save}>保存對象</Button></>} />
    <ObjectIssueSummary issues={issues} />
    <ObjectForm form={form} issues={issues} grids={grids} mode="create" onChange={change} />
  </div>;
}

// ---- 詳情 ----
type Tab = "基本資料" | "關聯巡查計劃模板" | "最近巡查記錄" | "工作負責群組";

export function ObjectDetailPage() {
  const { id = "" } = useParams(); const navigate = useNavigate(); const { objects } = useDemo();
  const object = objects.find((item) => item.id === id);
  if (!object) return <div className="page-content center-state"><WarningFilled /><h1>找不到對象</h1><p>對象「{id}」不存在。</p><Button onClick={() => navigate("/config/objects")}>返回列表</Button></div>;
  return <ObjectDetail key={object.id} object={object} />;
}

function ObjectDetail({ object }: { object: ManagedObject }) {
  const navigate = useNavigate(); const { showToast } = useToast(); const { objects, grids, inspectionTemplates, saveObjects } = useDemo(); const inspections = useInspections();
  const [tab, setTab] = useState<Tab>("基本資料"); const [editing, setEditing] = useState(false); const [confirmOff, setConfirmOff] = useState(false); const [selected, setSelected] = useState<string | null>(null);
  const [groups, setGroups] = useState<WorkGroupRow[]>(() => object.workGroups.map((row) => ({ ...row }))); const [groupErrors, setGroupErrors] = useState<string[]>([]);
  const grid = gridOf(object, grids);
  const [x, y] = lngLatToPx([object.longitude, object.latitude]);
  const related = templatesOfObject(inspectionTemplates, object).map(({ template, scope }) => ({ id: template.id, template, scope }));
  const recent: InspectionRecord[] = inspections.all.filter((record) => record.objectId === object.id).sort((a, b) => (b.submittedAt ?? b.createdAt ?? "").localeCompare(a.submittedAt ?? a.createdAt ?? "")).slice(0, 10);
  const explicitTemplates = inspectionTemplates.filter((template) => template.objects.some((entry) => entry.objectId === object.id)).length;
  const update = (patch: Partial<ManagedObject>) => saveObjects(objects.map((item) => item.id === object.id ? { ...item, ...patch } : item));
  const markers: MapMarkerSpec[] = [{ id: "object", kind: "object", x, y, tone: object.status === "啟用" ? "object" : "todo", label: "對", title: object.name, detail: <span>{object.code} · {object.inspectionType}<br />{object.address}</span> },
    ...(object.geojson?.type === "Point" ? [{ id: "shape-point", kind: "event" as const, x: lngLatToPx(object.geojson.coordinates)[0], y: lngLatToPx(object.geojson.coordinates)[1], tone: "event" as const, title: "地圖檔案（點）" }] : [])];
  const polygons: MapPolygonSpec[] = [...grids.map((item) => ({ id: item.id, rings: ringsPx(item.boundary), label: item.name, dim: true, dashed: item.status !== "啟用", selected: item.id === grid?.id })), ...shapePolygon(object, { id: "shape" })];
  const saveGroups = () => {
    const found = validateWorkGroups(groups, groupCatalog);
    if (found.length) { setGroupErrors(found); return; }
    update({ workGroups: groups }); setGroupErrors([]); showToast("工作負責群組已更新，之後新增的工作會按此分派");
  };
  const templateColumns: Column<(typeof related)[number]>[] = [
    { key: "code", title: "巡查計劃模板編號", width: 150, render: (row) => row.template.code }, { key: "name", title: "巡查計劃模板名稱", width: 220, render: (row) => row.template.name },
    { key: "scope", title: "適用方式", width: 130, render: (row) => <StatusTag tone={row.scope === "指定對象" ? "info" : "neutral"}>{row.scope}</StatusTag> },
    { key: "location", title: "有效距離（米）", width: 130, render: (row) => row.template.locationCheck ? row.template.objects.find((entry) => entry.objectId === object.id)?.distance ?? row.template.validDistance ?? "—" : "不需要定位" },
    { key: "status", title: "狀態", width: 90, render: (row) => <StatusTag tone={row.template.status === "生效" ? "success" : "neutral"}>{row.template.status}</StatusTag> },
  ];
  const recentColumns: Column<InspectionRecord>[] = [
    { key: "id", title: "巡查編號", width: 160, render: (record) => <Link to={`/inspections/${record.id}`}>{record.id}</Link> }, { key: "template", title: "巡查計劃模板", width: 190, render: (record) => record.snapshot.name },
    { key: "status", title: "狀態", width: 90, render: (record) => <StatusTag>{record.status}</StatusTag> },
    { key: "result", title: "結果", width: 90, render: (record) => { const result = resultOf(record); return <StatusTag tone={result === "異常" ? "danger" : result === "正常" ? "success" : "neutral"}>{result}</StatusTag>; } },
    { key: "inspector", title: "巡查人員", width: 100, render: (record) => record.inspector ?? "—" }, { key: "submittedAt", title: "提交時間", width: 150, render: (record) => record.submittedAt ?? "—" },
    { key: "voided", title: "作廢", width: 80, render: (record) => record.voided ? <StatusTag tone="danger">已作廢</StatusTag> : "—" },
  ];
  return <div className="page-content detail-page obj-detail-page">
    <PageHeader eyebrow="對象管理 / 對象詳情" title={object.name} actions={<>
      <Button icon={<ArrowLeftOutlined />} onClick={() => navigate("/config/objects")}>返回列表</Button>
      <Button icon={<EditOutlined />} onClick={() => setEditing(true)}>編輯</Button>
      {object.status === "啟用" ? <Button variant="danger" icon={<StopOutlined />} onClick={() => setConfirmOff(true)}>停用</Button> : <Button variant="primary" onClick={() => { update({ status: "啟用" }); showToast("對象已啟用"); }}>啟用</Button>}</>} />
    <div className="status-strip obj-status-strip">
      <div><span>對象編號</span><strong>{object.code}</strong></div><div><span>巡查類型</span><strong>{object.inspectionType}</strong></div>
      <div><span>所屬網格</span><strong>{grid?.name ?? "未歸屬"}</strong><StatusTag tone={object.gridAssignMode === "手動" ? "warning" : "neutral"}>{object.gridAssignMode}</StatusTag></div>
      <div><span>狀態</span><StatusTag tone={object.status === "啟用" ? "success" : "neutral"}>{object.status}</StatusTag></div><div><span>經緯度</span><strong>{object.latitude.toFixed(5)}, {object.longitude.toFixed(5)}</strong></div><div><span>地圖範圍</span><strong>{shapeKind(object)}{object.geojson && object.geojson.type !== "Point" ? `（${formatArea(areaM2(object.geojson))}）` : ""}</strong></div>
    </div>
    <section className="panel plan-map-panel obj-map-panel"><PlanMap polygons={polygons} markers={markers} selected={selected} onSelect={setSelected} fitPolygon={object.geojson && object.geojson.type !== "Point" ? "shape" : "none"} fitKey={object.id}
      legend={<><LegendItem tone="object">對象位置</LegendItem>{object.geojson && <LegendItem tone="route">地圖範圍</LegendItem>}<LegendItem tone="ghost">網格（高亮為所屬網格）</LegendItem></>} /></section>
    <section className="panel tab-panel obj-tab-panel"><nav>{(["基本資料", "關聯巡查計劃模板", "最近巡查記錄", "工作負責群組"] as Tab[]).map((name) => <button key={name} className={tab === name ? "active" : ""} onClick={() => setTab(name)}>{name}<span>{name === "關聯巡查計劃模板" ? related.length : name === "最近巡查記錄" ? recent.length : name === "工作負責群組" ? object.workGroups.length : object.attachments.length}</span></button>)}</nav>
      <div className="obj-tab-body">
        {tab === "基本資料" && <div className="evt-info">
          <dl className="description-grid">
            <div><dt>對象編號</dt><dd>{object.code}</dd></div><div><dt>巡查類型</dt><dd>{object.inspectionType}</dd></div><div className="wide"><dt>對象名稱</dt><dd>{object.name}</dd></div>
            <div className="wide"><dt>地址</dt><dd>{object.address}</dd></div><div><dt>經緯度</dt><dd>{object.latitude.toFixed(7)}, {object.longitude.toFixed(7)}</dd></div><div><dt>地圖座標</dt><dd>{latLng(x, y)}</dd></div>
            <div><dt>所屬網格</dt><dd>{grid?.name ?? "未歸屬"}（{object.gridAssignMode}）</dd></div><div><dt>地圖檔案</dt><dd>{object.geojson ? object.geojson.type : "無"}</dd></div>
          </dl>
          <h4>附件</h4>{object.attachments.length ? <AttachmentField files={object.attachments} min={0} usedChars={0} onChange={() => undefined} disabled /> : <p className="evt-empty">沒有附件</p>}
        </div>}
        {tab === "關聯巡查計劃模板" && <><p className="plan-hint obj-tab-hint">列出同一巡查類型下，指定了此對象或沒有指定任何對象（適用類型下全部對象）的巡查計劃模板。<Link to="/config/templates">前往巡查計劃模板</Link></p><DenseTable rows={related} columns={templateColumns} emptyText="沒有適用於此對象的巡查計劃模板" /></>}
        {tab === "最近巡查記錄" && <DenseTable rows={recent} columns={recentColumns} emptyText="此對象尚未有巡查記錄" />}
        {tab === "工作負責群組" && <div className="obj-groups">
          <p className="plan-hint">按群組管理的分類指定此對象的負責群組。執行群組只可設一個：此對象的所有新工作都會分派給它，優先於派工規則及工作類型默認群組；未設定時照常按規則分派。<Link to="/auth/groups">前往群組管理</Link></p>
          {groupErrors.length > 0 && <div className="evt-error" role="alert">{groupErrors.join(" ")}</div>}
          <WorkGroupsEditor rows={groups} onChange={(rows) => { setGroups(rows); setGroupErrors([]); }} />
          <div className="obj-groups-save"><Button variant="primary" onClick={saveGroups}>儲存工作負責群組</Button></div>
        </div>}
      </div>
    </section>
    {editing && <EditObjectDrawer object={object} onClose={() => setEditing(false)} onSaved={() => { setEditing(false); showToast("對象已更新"); }} />}
    <ConfirmDialog open={confirmOff} title="停用對象？" message={`停用後，此對象不再出現在巡查計劃模板及計劃的可選清單；${explicitTemplates ? `目前有 ${explicitTemplates} 個巡查計劃模板指定了此對象，` : ""}已有的巡查、事件及工作記錄保留不變。`} danger confirmLabel="確認停用" onCancel={() => setConfirmOff(false)} onConfirm={() => { update({ status: "停用" }); setConfirmOff(false); showToast("對象已停用"); }} />
  </div>;
}

function EditObjectDrawer({ object, onClose, onSaved }: { object: ManagedObject; onClose: () => void; onSaved: () => void }) {
  const { objects, grids, inspectionTypes: typeRecords, saveObjects } = useDemo();
  const [form, setForm] = useState<ObjectFormState>(() => formOfObject(object)); const [issues, setIssues] = useState<ObjectIssue[]>([]);
  const change = (patch: Partial<ObjectFormState>) => { setForm((current) => ({ ...current, ...patch })); setIssues([]); };
  const save = () => {
    const { draft, problems } = draftOfForm(form, object.id, object);
    const result = validateObject(draft, { all: objects, inspectionTypes: typeRecords.map((type) => type.name), grids, groups: groupCatalog, editingId: object.id });
    const found = [...problems, ...result.errors];
    if (found.length || !result.record) { setIssues(found); return; }
    saveObjects(objects.map((item) => item.id === object.id ? result.record! : item)); onSaved();
  };
  return <FormDrawer open title="編輯對象" subtitle={object.code} onClose={onClose} onSubmit={save} className="evt-drawer obj-drawer">
    <div className="evt-drawer-body"><ObjectIssueSummary issues={issues} /><ObjectForm form={form} issues={issues} grids={grids} mode="edit" onChange={change} /></div>
  </FormDrawer>;
}
