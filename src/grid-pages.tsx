import { useMemo, useRef, useState } from "react";
import { EditOutlined, EnvironmentOutlined, ExportOutlined, PlusOutlined, ReloadOutlined, SwapOutlined, UndoOutlined, UnorderedListOutlined, UploadOutlined } from "@ant-design/icons";
import { Button, ConfirmDialog, DenseTable, Field, FormDrawer, PageHeader, Pagination, Select, StatusTag, useToast } from "./components";
import { resolveEvent } from "./event-data";
import { locateName } from "./grid-data";
import {
  areaM2, countPoints, FILE_MAX_BYTES, formatArea, nextId, parseGeoJSON, partCount, polygonFromPx, reassignPatches, ringsPx, sampleFeatureCollection, toFeatureCollection, validateGeometry, validateGrid, validateImport, vertexCount,
  type GridGeometry, type GridRecord, type GridStatus, type ImportMode, type Pt,
} from "./grid-rules";
import { reassignObjectGrids } from "./object-rules";
import { getAllObjects } from "./plan-data";
import { LegendItem, PlanMap, type MapLayerChip, type MapMarkerSpec, type MapPolygonSpec } from "./plan-map";
import { policyUsers } from "./permission-rules";
import { useDemo } from "./store";
import type { Column } from "./types";
import { nowText, resolveWork } from "./work-data";

const signedIn = policyUsers[0].name;
const palette = ["#2468c9", "#18a058", "#e8830c", "#8e44ad", "#d93026", "#0f8f7e", "#c2410c", "#4f46e5"];
const objectPoints = () => getAllObjects().map((object) => ({ x: object.x, y: object.y }));
const contains = (value: string, query: string) => !query.trim() || value.toLowerCase().includes(query.trim().toLowerCase());
const logId = () => `WL-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
const kindText = (grid: GridRecord) => `${grid.boundary.type}${partCount(grid.boundary) > 1 ? `（${partCount(grid.boundary)} 部分）` : ""} · ${vertexCount(grid.boundary)} 頂點`;

function download(name: string, data: unknown) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/geo+json" }));
  const link = document.createElement("a"); link.href = url; link.download = name; link.click(); URL.revokeObjectURL(url);
}

type GridRow = GridRecord & { area: number; objects: number };
const emptyFilters = { code: "", name: "", status: "" };

// ---- 列表 ----
export function GridListPage() {
  const { showToast } = useToast(); const { grids, objects: managedObjects, works, events, saveGrids, saveObjects, updateWorks, updateEvent, addWorkLogs } = useDemo();
  const points = useMemo(() => objectPoints(), [managedObjects, grids]); // eslint-disable-line react-hooks/exhaustive-deps
  const [view, setView] = useState<"list" | "map">("list"); const [filters, setFilters] = useState(emptyFilters); const [page, setPage] = useState(1); const [pageSize, setPageSize] = useState(15);
  const [drawer, setDrawer] = useState<{ kind: "create" } | { kind: "edit"; id: string } | { kind: "import" } | null>(null); const [confirmReassign, setConfirmReassign] = useState(false);
  const [layers, setLayers] = useState({ enabled: true, disabled: true, objects: false }); const [selected, setSelected] = useState<string | null>(null);
  const filter = (key: keyof typeof emptyFilters, value: string) => { setFilters((current) => ({ ...current, [key]: value })); setPage(1); };
  const all: GridRow[] = useMemo(() => grids.map((grid) => ({ ...grid, area: areaM2(grid.boundary), objects: countPoints(grid, points) })), [grids, points]);
  const rows = all.filter((grid) => contains(grid.code, filters.code) && contains(grid.name, filters.name) && (!filters.status || grid.status === filters.status));
  const columns: Column<GridRow>[] = ([
    { key: "code", title: "網格編號", width: 130 },
    { key: "name", title: "網格名稱", width: 200, render: (grid) => <span className="grid-name"><i style={{ background: grid.status === "啟用" ? palette[grids.findIndex((item) => item.id === grid.id) % palette.length] : "#98a1ae" }} />{grid.name}</span> },
    { key: "boundary", title: "範圍（GeoJSON）", width: 260, render: kindText, sortValue: (grid) => vertexCount(grid.boundary) },
    { key: "area", title: "面積", width: 120, render: (grid) => formatArea(grid.area) },
    { key: "objects", title: "網格內對象數", width: 130, render: (grid) => `${grid.objects} 個` },
    { key: "status", title: "狀態", width: 90, render: (grid) => <StatusTag tone={grid.status === "啟用" ? "success" : "neutral"}>{grid.status}</StatusTag> },
  ] satisfies Column<GridRow>[]).map((column) => ({ ...column, sortable: true }));

  const resolvedWorks = works.filter((work) => !work.pendingSync).map(resolveWork); const resolvedEvents = events.filter((event) => !event.pendingSync).map(resolveEvent);
  // The map shows the grids that pass the filters (all of them by default); clicking one opens its summary.
  const polygons: MapPolygonSpec[] = rows.flatMap((row) => {
    const index = grids.findIndex((grid) => grid.id === row.id); const on = row.status === "啟用"; if (on ? !layers.enabled : !layers.disabled) return [];
    const inGrid = <T extends { grid: string; voided?: boolean }>(list: T[]) => list.filter((item) => item.grid === row.name && !item.voided).length;
    return [{ id: row.id, rings: ringsPx(row.boundary), label: row.name, title: row.name, color: on ? palette[index % palette.length] : undefined, dim: !on, dashed: !on, selected: selected === row.id,
      detail: <span className="grid-popup">
        <span>{row.code} · <StatusTag tone={on ? "success" : "neutral"}>{row.status}</StatusTag></span>
        <span>範圍：{kindText(row)}</span><span>面積：{formatArea(row.area)}</span>
        <span>網格內：對象 {row.objects} 個 · 事件 {inGrid(resolvedEvents)} 宗 · 工作 {inGrid(resolvedWorks)} 宗</span>
        {!on && <em>已停用：不參與網格歸屬，位置落在此範圍的記錄會歸入其他網格或「未歸屬」。</em>}
        <button type="button" className="grid-popup-link" onClick={() => setDrawer({ kind: "edit", id: row.id })}>編輯網格</button></span> }];
  });
  const markers: MapMarkerSpec[] = layers.objects ? getAllObjects().map((object) => ({ id: object.id, kind: "object" as const, x: object.x, y: object.y, tone: "todo" as const, title: object.name, detail: <span>{object.address}<br />所在網格：{locateName(object.x, object.y)}</span> })) : [];
  const chips: MapLayerChip[] = [{ key: "enabled", label: "啟用網格", count: rows.filter((grid) => grid.status === "啟用").length, on: layers.enabled }, { key: "disabled", label: "停用網格", count: rows.filter((grid) => grid.status === "停用").length, on: layers.disabled }, { key: "objects", label: "對象", count: getAllObjects().length, on: layers.objects }];

  const workPatches = reassignPatches(resolvedWorks, locateName); const eventPatches = reassignPatches(resolvedEvents, locateName);
  // automatic objects follow their position; manual ones are skipped
  const objectPatches = reassignObjectGrids(managedObjects, grids);
  const reassign = () => {
    const time = nowText();
    if (workPatches.length) { updateWorks(workPatches.map((patch) => ({ id: patch.id, patch: { grid: patch.to, updatedAt: time } }))); addWorkLogs(workPatches.map((patch) => ({ id: logId(), workId: patch.id, action: "重新歸屬網格", operator: signedIn, time, location: "後台操作（無定位）", comment: `網格由「${patch.from}」改為「${patch.to}」` }))); }
    eventPatches.forEach((patch) => updateEvent(patch.id, { grid: patch.to }));
    if (objectPatches.length) saveObjects(managedObjects.map((object) => { const patch = objectPatches.find((item) => item.id === object.id); return patch ? { ...object, gridId: patch.to } : object; }));
    setConfirmReassign(false); showToast(`已重新歸屬 ${workPatches.length} 宗工作、${eventPatches.length} 宗事件及 ${objectPatches.length} 個對象`);
  };
  const editing = drawer?.kind === "edit" ? grids.find((grid) => grid.id === drawer.id) : undefined;
  return <div className="page-content grid-page">
    <PageHeader title="網格管理" actions={<>
      <Button icon={view === "list" ? <EnvironmentOutlined /> : <UnorderedListOutlined />} onClick={() => setView(view === "list" ? "map" : "list")}>{view === "list" ? "地圖視圖" : "列表視圖"}</Button>
      <Button icon={<SwapOutlined />} onClick={() => workPatches.length + eventPatches.length + objectPatches.length ? setConfirmReassign(true) : showToast("所有對象、事件及工作的網格已是最新")}>重新歸屬</Button>
      <Button icon={<ExportOutlined />} onClick={() => download("grids.geojson", toFeatureCollection(grids))}>匯出</Button>
      <Button icon={<UploadOutlined />} onClick={() => setDrawer({ kind: "import" })}>匯入</Button>
      <Button variant="primary" icon={<PlusOutlined />} onClick={() => setDrawer({ kind: "create" })}>新增網格</Button></>} />
    <section className="panel list-panel grid-list-panel">
      <div className="filter-bar grid-filter-bar">
        <label className="filter-field"><span>網格編號</span><input aria-label="網格編號" value={filters.code} onChange={(event) => filter("code", event.target.value)} placeholder="請輸入網格編號" /></label>
        <label className="filter-field"><span>網格名稱</span><input aria-label="網格名稱" value={filters.name} onChange={(event) => filter("name", event.target.value)} placeholder="請輸入網格名稱" /></label>
        <label className="filter-field"><span>狀態</span><Select ariaLabel="狀態" value={filters.status} onChange={(value) => filter("status", value)}><option value="">全部狀態</option><option>啟用</option><option>停用</option></Select></label>
        <div className="user-filter-actions"><Button variant="text" icon={<ReloadOutlined />} onClick={() => { setFilters(emptyFilters); setPage(1); }}>重設</Button></div>
      </div>
      {view === "list" ? <>
        <DenseTable rows={rows} columns={columns} stickyActions actionTitle="操作" page={Math.min(page, Math.max(1, Math.ceil(rows.length / pageSize)))} pageSize={pageSize} onSort={() => setPage(1)} emptyText="沒有符合條件的網格" renderActions={(grid) => <button className="table-action-button" aria-label={`編輯 ${grid.name}`} onClick={() => setDrawer({ kind: "edit", id: grid.id })}><EditOutlined />編輯</button>} />
        <Pagination total={rows.length} page={page} pageSize={pageSize} onPageChange={setPage} onPageSizeChange={(size) => { setPageSize(size); setPage(1); }} />
      </> : <div className="evt-map-wrap"><PlanMap polygons={polygons} markers={markers} onPolygonClick={setSelected} layers={chips} onToggleLayer={(key) => setLayers((current) => ({ ...current, [key]: !current[key as keyof typeof current] }))} selected={selected} onSelect={(id) => setSelected(id)} fitKey="all"
        legend={<><LegendItem tone="route">啟用網格</LegendItem><LegendItem tone="ghost">停用網格</LegendItem>{layers.objects && <LegendItem tone="todo">對象</LegendItem>}<span className="plan-map-legend-hint">點擊網格查看資料</span></>} /></div>}
    </section>
    {drawer?.kind === "create" && <CreateGridDrawer grids={grids} onClose={() => setDrawer(null)} onSaved={(record) => { saveGrids([...grids, record]); setDrawer(null); showToast("網格已建立；可使用「重新歸屬」更新現有事件及工作"); }} />}
    {editing && <EditGridDrawer grid={editing} grids={grids} objects={countPoints(editing, points)} onClose={() => setDrawer(null)} onSaved={(next, rangeChanged) => { saveGrids(grids.map((grid) => grid.id === next.id ? next : grid)); setDrawer(null); showToast(rangeChanged ? "網格已更新；範圍已更改，可使用「重新歸屬」更新現有事件及工作" : "網格已更新"); }} />}
    {drawer?.kind === "import" && <ImportDrawer grids={grids} onClose={() => setDrawer(null)} onImported={(records, text) => { saveGrids(records); setDrawer(null); showToast(text); }} />}
    <ConfirmDialog open={confirmReassign} title="重新歸屬事件、工作及對象？" message={`按目前啟用的網格，將更新 ${workPatches.length} 宗工作、${eventPatches.length} 宗事件及 ${objectPatches.length} 個「自動」對象的所屬網格（沒有位置的記錄及「手動」對象會略過）。`} confirmLabel="確認重新歸屬" onCancel={() => setConfirmReassign(false)} onConfirm={reassign} />
  </div>;
}

// ---- 新增 ----
function StatusSwitch({ value, onChange, summary }: { value: GridStatus; onChange: (value: GridStatus) => void; summary: { label: string; value: string } }) {
  return <section className="group-editor-section"><header><h3>網格狀態</h3></header><div className="group-editor-status"><div className="bip-field"><span>狀態</span><div className="switch-row"><label className="switch-control"><input type="checkbox" aria-label="網格啟用" checked={value === "啟用"} onChange={(event) => onChange(event.target.checked ? "啟用" : "停用")} /><span className="switch" /></label></div></div><div className="group-editor-count"><span>{summary.label}</span><strong>{summary.value}</strong></div></div></section>;
}

/** The drawing on the map. `replaced` means the current range is no longer kept (a new drawing was started, vertices were loaded, or all were cleared). */
interface DrawState { points: Pt[]; finished: boolean; replaced: boolean; loadedCurrent: boolean }
const blankDrawing: DrawState = { points: [], finished: false, replaced: false, loadedCurrent: false };

/**
 * The range editor shared by 新增 and 編輯: draw on the map, or edit the GeoJSON directly.
 * When editing, `initial` is the current range: it is kept until the user draws, loads its vertices, or clears.
 * Every range change (add, drag, finish, load, clear) is one step that 復原 takes back.
 */
function useRangeEditor(initial?: GridGeometry, onFeature?: (properties: Record<string, unknown>) => void) {
  const initialText = initial ? JSON.stringify(initial, null, 2) : "";
  const [tab, setTabValue] = useState<"draw" | "geojson">("draw"); const [text, setTextValue] = useState(initialText);
  const [draw, setDraw] = useState<DrawState>(blankDrawing); const [history, setHistory] = useState<DrawState[]>([]);
  const dragging = useRef(false);
  const { points, finished, replaced } = draw;
  const commit = (next: DrawState) => { setHistory((current) => [...current, draw]); setDraw(next); };
  const parsed = text.trim() ? parseGeoJSON(text) : undefined;
  const pasted = parsed && !parsed.error && parsed.features.length === 1 ? parsed.features[0] : undefined;
  const drawn = points.length >= 3 && finished ? polygonFromPx(points) : undefined;
  const geometry: unknown = tab === "draw" ? (drawn ?? (!replaced ? initial : undefined)) : pasted?.geometry;
  let problem: string | undefined;
  if (tab === "draw" && !geometry) problem = points.length >= 3 ? "請按「完成繪製」。" : points.length ? "繪製中的範圍至少需要 3 個點，再按「完成繪製」。" : initial ? "已清除所有頂點，請在地圖上重新繪製，或按「復原」恢復。" : "請在地圖上點擊至少 3 個點，再按「完成繪製」。";
  if (tab === "geojson" && !pasted) problem = !text.trim() ? "請貼上或選擇一個 GeoJSON 要素。" : parsed?.error ?? (parsed && parsed.features.length !== 1 ? `GeoJSON 含有 ${parsed.features.length} 個要素，單個網格只可有一個；多個網格請使用「匯入」。` : "無法解析 GeoJSON。");
  const checked = geometry ? validateGeometry(geometry).boundary : undefined;
  const changed = !!initial && !!geometry && JSON.stringify(geometry) !== JSON.stringify(initial);
  const canLoadVertices = !!initial && initial.type === "Polygon" && initial.coordinates.length === 1;
  return {
    tab, points, finished, replaced, loadedCurrent: draw.loadedCurrent, text, parsed, initial, geometry, problem, checked, changed, canLoadVertices, canUndo: history.length > 0,
    // A finished drawing is carried over, so the GeoJSON tab shows what was drawn.
    setTab: (next: "draw" | "geojson") => { if (next === "geojson" && drawn) setTextValue(JSON.stringify(drawn, null, 2)); setTabValue(next); },
    pick: (point: Pt) => { if (!finished) commit({ points: [...points, point], finished: false, replaced: true, loadedCurrent: false }); },
    /** Takes back the last range change: an added point, a drag, 完成繪製, 載入目前頂點 or 清除. */
    undo: () => { if (!history.length) return; setDraw(history[history.length - 1]); setHistory((current) => current.slice(0, -1)); },
    /** Removes every vertex. When editing, the current range is not restored (use 復原 for that). */
    clear: () => { if (points.length) commit({ points: [], finished: false, replaced: true, loadedCurrent: draw.loadedCurrent }); },
    finish: () => { if (points.length >= 3 && !finished) commit({ ...draw, finished: true }); },
    loadVertices: () => { if (initial && canLoadVertices) commit({ points: ringsPx(initial)[0].slice(0, -1), finished: true, replaced: true, loadedCurrent: true }); },
    cancelLoadedVertices: () => { if (draw.loadedCurrent) { setDraw(blankDrawing); setHistory([]); } },
    /** Drags a drawn or loaded vertex; one drag gesture is one 復原 step. */
    moveVertex: (index: number, point: Pt) => {
      if (!dragging.current) { dragging.current = true; setHistory((current) => [...current, draw]); }
      setDraw((current) => ({ ...current, points: current.points.map((vertex, i) => i === index ? point : vertex) }));
    },
    endDrag: () => { dragging.current = false; },
    setText: (value: string) => { setTextValue(value); const result = value.trim() ? parseGeoJSON(value) : undefined; const feature = result && !result.error && result.features.length === 1 ? result.features[0] : undefined; if (feature) onFeature?.(feature.properties); },
    resetText: () => setTextValue(initialText),
  };
}
type RangeEditor = ReturnType<typeof useRangeEditor>;

function RangeSection({ r, grids, editing, onTouch }: { r: RangeEditor; grids: GridRecord[]; editing?: GridRecord; onTouch: () => void }) {
  const [fileError, setFileError] = useState("");
  const others = grids.filter((grid) => grid.id !== editing?.id);
  const touch = (apply: () => void) => { apply(); onTouch(); };
  const readFile = async (file: File | undefined) => { if (!file) return; if (file.size > FILE_MAX_BYTES) { setFileError("檔案超過 20 MB。"); return; } setFileError(""); r.setText(await file.text()); onTouch(); };
  const polygons: MapPolygonSpec[] = [
    ...others.map((grid) => ({ id: grid.id, rings: ringsPx(grid.boundary), label: grid.name, dim: true, dashed: true })),
    ...(editing ? [{ id: "current", rings: ringsPx(editing.boundary), label: r.replaced ? "原有範圍" : "目前範圍", color: r.replaced ? undefined : "#2468c9", dim: r.replaced, dashed: true, selected: !r.replaced }] : []),
    ...(r.points.length ? [{ id: "draft", rings: [r.points], color: "#e60012", closed: r.finished && r.points.length >= 3, dashed: !r.finished }] : []),
  ];
  // Only drawn or loaded vertices are shown and can be dragged; the current range's vertices need 載入目前頂點 first.
  const markers: MapMarkerSpec[] = r.points.map((point, index) => ({ id: `v${index}`, kind: "object", x: point[0], y: point[1], tone: "object", label: String(index + 1), title: `頂點 ${index + 1}`, draggable: true }));
  const dragVertex = (id: string, point: Pt) => touch(() => r.moveVertex(Number(id.slice(1)), point));
  const drawnArea = r.tab === "draw" && r.finished && r.checked ? areaM2(r.checked) : undefined;
  const summary = r.checked ? `${kindText({ boundary: r.checked } as GridRecord)} · 面積 ${formatArea(areaM2(r.checked))}` : undefined;
  return <section className="group-editor-section"><header><h3>範圍</h3></header>
    <div className="grid-range-tabs segmented" role="tablist"><button type="button" role="tab" aria-selected={r.tab === "draw"} className={r.tab === "draw" ? "active" : ""} onClick={() => r.setTab("draw")}>在地圖繪製</button><button type="button" role="tab" aria-selected={r.tab === "geojson"} className={r.tab === "geojson" ? "active" : ""} onClick={() => r.setTab("geojson")}>編輯 GeoJSON</button></div>
    {r.tab === "draw" ? <>
      <div className="evt-pick"><PlanMap className="evt-pick-map" polygons={polygons} markers={markers} onPick={(point) => touch(() => r.pick(point))} onMarkerDrag={dragVertex} onMarkerDragEnd={r.endDrag} fitPolygon={r.points.length ? "draft" : editing ? "current" : undefined /* on return from the GeoJSON tab, show the drawing */} fitKey={editing ? `edit-${editing.id}` : "draw"} legend={<><LegendItem tone="route">{editing ? "此網格範圍／重新繪製的範圍" : "繪製中的範圍"}</LegendItem><LegendItem tone="ghost">其他網格</LegendItem></>} /></div>
      <div className="evt-pick-note grid-draw-bar"><span>{r.finished ? `已完成繪製：${r.points.length} 個頂點${drawnArea ? `，面積 ${formatArea(drawnArea)}` : ""}。拖動頂點可調整位置。` : r.points.length ? `已選 ${r.points.length} 個頂點，繼續點擊地圖，拖動頂點可調整位置；至少 3 個後可完成繪製。` : editing && !r.replaced ? (r.canLoadVertices ? "目前保持原有範圍。按「載入目前頂點」後可拖動頂點調整，或點擊地圖重新繪製。" : "目前保持原有範圍（多個區塊或含孔洞，不可載入頂點）。點擊地圖可重新繪製。") : editing ? "已清除所有頂點。點擊地圖重新繪製，或按「復原」恢復。" : "點擊地圖依次選取多邊形的頂點（可先放大），之後可拖動頂點調整。"}</span>
        <span className="grid-draw-actions">{r.canLoadVertices && !r.points.length && <Button onClick={() => touch(r.loadVertices)}>載入目前頂點</Button>}{editing && r.loadedCurrent && <Button onClick={() => touch(r.cancelLoadedVertices)}>取消</Button>}<Button icon={<UndoOutlined />} disabled={!r.canUndo} onClick={() => touch(r.undo)}>復原</Button><Button disabled={!r.points.length} onClick={() => touch(r.clear)}>清除</Button><Button variant="primary" disabled={r.points.length < 3 || r.finished} onClick={() => touch(r.finish)}>完成繪製</Button></span></div>
    </> : <div className="grid-geojson">
      <textarea rows={editing ? 14 : 9} value={r.text} onChange={(event) => touch(() => r.setText(event.target.value))} placeholder='貼上單個 Feature 或 Polygon／MultiPolygon，例如 {"type":"Feature","properties":{"name":"…"},"geometry":{…}}' aria-label="GeoJSON" spellCheck={false} />
      <div className="grid-geojson-bar"><label className="btn btn-default grid-file"><input type="file" accept=".geojson,.json,application/geo+json,application/json" onChange={(event) => { void readFile(event.target.files?.[0]); event.target.value = ""; }} />選擇檔案（≤ 20 MB）</label>
        {editing && <Button onClick={() => touch(r.resetText)}>還原目前範圍</Button>}
        <span className={fileError || r.parsed?.error || (r.parsed && r.parsed.features.length > 1) ? "grid-bad" : "grid-ok"}>{fileError || (!r.parsed ? "尚未輸入" : r.parsed.error ?? (r.parsed.features.length === 1 ? (summary ?? "已解析 1 個要素") : `含有 ${r.parsed.features.length} 個要素，請改用「匯入」`))}</span></div>
    </div>}
    {editing && <div className="evt-pick-note grid-range-summary"><span>{summary ? `${r.changed ? "修改後" : "目前"}範圍：${summary}。${r.changed ? "儲存後生效，可使用「重新歸屬」更新現有事件及工作。" : ""}` : "目前輸入的範圍尚未有效。"}</span></div>}
  </section>;
}

function IssueList({ errors }: { errors: string[] }) {
  return errors.length ? <div className="evt-error" role="alert"><strong>請修正以下 {errors.length} 項</strong><ol>{errors.map((message, index) => <li key={index}>{message}</li>)}</ol></div> : null;
}

export function CreateGridDrawer({ grids, onClose, onSaved }: { grids: GridRecord[]; onClose: () => void; onSaved: (record: GridRecord) => void }) {
  const [code, setCode] = useState(""); const [name, setName] = useState(""); const [status, setStatus] = useState<GridStatus>("啟用"); const [errors, setErrors] = useState<string[]>([]);
  const r = useRangeEditor(undefined, (properties) => { if (!name.trim() && typeof properties.name === "string") setName(properties.name); if (!code.trim() && typeof properties.code === "string") setCode(properties.code); });
  const change = (apply: () => void) => { apply(); setErrors([]); };
  const save = () => {
    const result = validateGrid({ code, name, geometry: r.geometry }, grids);
    const problems = [...(r.problem ? [r.problem] : []), ...result.errors.filter((message) => message !== "缺少 geometry。")];
    if (problems.length || !result.record) { setErrors(problems); return; }
    onSaved({ id: nextId(grids.map((grid) => grid.id)), code: result.record.code, name: result.record.name, boundary: result.record.boundary, status });
  };
  return <FormDrawer open title="新增網格" onClose={onClose} onSubmit={save} className="grid-drawer">
    <div className="evt-drawer-body"><IssueList errors={errors} />
      <div className="evt-form">
        <section className="group-editor-section"><header><h3>網格資料</h3></header><div className="group-editor-grid">
          <Field label="網格編號" hint="可留空，系統自動生成；唯一，儲存後不可修改"><input value={code} maxLength={32} onChange={(event) => change(() => setCode(event.target.value))} placeholder="例如 GRID008" /></Field>
          <Field label="網格名稱" required hint="1–50 字，唯一"><input value={name} maxLength={50} onChange={(event) => change(() => setName(event.target.value))} placeholder="請輸入網格名稱" /></Field>
        </div></section>
        <RangeSection r={r} grids={grids} onTouch={() => setErrors([])} />
        <StatusSwitch value={status} onChange={(value) => change(() => setStatus(value))} summary={{ label: "網格內對象數", value: "儲存後計算" }} />
      </div>
    </div>
  </FormDrawer>;
}

// ---- 編輯 ----
export function EditGridDrawer({ grid, grids, objects, onClose, onSaved }: { grid: GridRecord; grids: GridRecord[]; objects: number; onClose: () => void; onSaved: (grid: GridRecord, rangeChanged: boolean) => void }) {
  const [name, setName] = useState(grid.name); const [status, setStatus] = useState<GridStatus>(grid.status); const [errors, setErrors] = useState<string[]>([]); const [confirmOff, setConfirmOff] = useState(false);
  const r = useRangeEditor(grid.boundary);
  const save = () => {
    const result = validateGrid({ code: grid.code, name, geometry: r.geometry }, grids, grid.id);
    const problems = [...(r.problem ? [r.problem] : []), ...result.errors.filter((message) => message !== "缺少 geometry。")];
    if (problems.length || !result.record) { setErrors(problems); return; }
    onSaved({ ...grid, name: result.record.name, boundary: result.record.boundary, status }, r.changed);
  };
  const setStatusChecked = (next: GridStatus) => { if (next === "停用" && grid.status === "啟用") setConfirmOff(true); else setStatus(next); };
  return <FormDrawer open title="編輯網格" subtitle={grid.code} onClose={onClose} onSubmit={save} className="grid-drawer">
    <div className="evt-drawer-body"><IssueList errors={errors} />
      <div className="evt-form">
        <section className="group-editor-section"><header><h3>網格資料</h3></header><div className="group-editor-grid">
          <Field label="網格編號" hint="唯一，不可修改"><input value={grid.code} disabled /></Field>
          <Field label="網格名稱" required hint="1–50 字，唯一"><input value={name} maxLength={50} onChange={(event) => { setName(event.target.value); setErrors([]); }} /></Field>
        </div></section>
        <RangeSection r={r} grids={grids} editing={grid} onTouch={() => setErrors([])} />
        <StatusSwitch value={status} onChange={setStatusChecked} summary={{ label: "網格內對象數", value: String(objects) }} />
      </div>
    </div>
    <ConfirmDialog open={confirmOff} title="停用網格？" message={`網格內目前有 ${objects} 個對象，停用後對象保留原歸屬；新記錄不再歸屬到此網格，位於其中的新事件及工作會標為「未歸屬」或歸入其他啟用網格。`} danger confirmLabel="確認停用" onCancel={() => setConfirmOff(false)} onConfirm={() => { setStatus("停用"); setConfirmOff(false); }} />
  </FormDrawer>;
}

// ---- 匯入 ----
function ImportDrawer({ grids, onClose, onImported }: { grids: GridRecord[]; onClose: () => void; onImported: (records: GridRecord[], text: string) => void }) {
  const [text, setText] = useState(""); const [mode, setMode] = useState<ImportMode>("覆蓋範圍"); const [message, setMessage] = useState("");
  const parsed = useMemo(() => text.trim() ? parseGeoJSON(text) : undefined, [text]);
  const result = useMemo(() => parsed && !parsed.error ? validateImport(parsed.features, grids, mode) : undefined, [parsed, grids, mode]);
  const readFile = async (file: File | undefined) => { if (!file) return; if (file.size > FILE_MAX_BYTES) { setMessage("檔案超過 20 MB，請拆分後再匯入。"); return; } setText(await file.text()); setMessage(""); };
  const submit = () => {
    if (!text.trim()) { setMessage("請先選擇檔案或貼上 GeoJSON。"); return; }
    if (parsed?.error) { setMessage(parsed.error); return; }
    if (!result?.ok) { setMessage(result && !result.applyCount ? "沒有可匯入的網格（全部被略過）。" : "有要素未通過檢查，整批不會匯入，請修正後重新匯入。"); return; }
    const counts = (action: string) => result.rows.filter((row) => row.action === action).length;
    onImported(result.records!, `已匯入 ${result.applyCount} 個網格（新增 ${counts("新增")}、覆蓋 ${counts("覆蓋")}、略過 ${counts("略過")}）；可使用「重新歸屬」更新現有事件及工作`);
  };
  const polygons: MapPolygonSpec[] = [
    ...grids.map((grid) => ({ id: grid.id, rings: ringsPx(grid.boundary), label: grid.name, dim: true })),
    ...(result?.rows ?? []).filter((row) => row.boundary && row.action !== "略過").map((row) => ({ id: `in-${row.index}`, rings: ringsPx(row.boundary!), label: row.name || `要素 ${row.index + 1}`, color: row.errors.length ? "#d93026" : "#18a058", dashed: true, selected: true })),
  ];
  const passed = result?.rows.filter((row) => row.action === "略過" || !row.errors.length).length ?? 0;
  return <FormDrawer open title="匯入網格" subtitle="GeoJSON · Polygon 或 MultiPolygon，須帶 name 屬性" onClose={onClose} onSubmit={submit} submitLabel="確認匯入" className="grid-drawer grid-import-drawer">
    <div className="evt-drawer-body">
      {message && <div className="evt-error" role="alert">{message}</div>}
      <div className="evt-form">
        <section className="group-editor-section"><header><h3>匯入檔案</h3></header><div className="grid-geojson">
          <div className="grid-geojson-bar"><label className="btn btn-default grid-file"><input type="file" accept=".geojson,.json,application/geo+json,application/json" onChange={(event) => { void readFile(event.target.files?.[0]); event.target.value = ""; }} />選擇檔案（≤ 20 MB）</label>
            <Button onClick={() => { setText(JSON.stringify(sampleFeatureCollection(), null, 2)); setMessage(""); }}>載入示範檔</Button><Button onClick={() => download("grid-template.geojson", sampleFeatureCollection())}>下載範本</Button></div>
          <textarea rows={7} value={text} onChange={(event) => { setText(event.target.value); setMessage(""); }} placeholder="或在此貼上 GeoJSON（FeatureCollection）" aria-label="GeoJSON" />
          <Field label="重名處理" required hint="編號（無編號時按名稱）與現有網格相同的要素：覆蓋範圍只更新範圍，略過則不處理"><Select ariaLabel="重名處理" value={mode} onChange={(value) => setMode(value as ImportMode)}><option>覆蓋範圍</option><option>略過</option></Select></Field>
        </div></section>
        {(parsed?.error || result) && <section className="group-editor-section"><header><h3>檢查結果</h3></header>
          {parsed?.error ? <div className="evt-error grid-result-error" role="alert">{parsed.error}</div> : result && <>
            <div className={`grid-result-summary ${result.ok ? "ok" : "bad"}`}>{result.ok ? `全部通過：將匯入 ${result.applyCount} 個網格。` : result.applyCount ? `${result.rows.length - passed} 個要素未通過檢查，整批不會匯入。` : "沒有可匯入的網格。"}（共 {result.rows.length} 個要素，通過 {passed} 個）</div>
            <div className="evt-pick grid-import-map"><PlanMap className="evt-pick-map" polygons={polygons} fitKey={`${text.length}-${mode}`} legend={<><LegendItem tone="done">通過</LegendItem><LegendItem tone="issue">未通過</LegendItem><LegendItem tone="ghost">現有網格</LegendItem></>} /></div>
            <div className="grid-result-table"><table className="dense-table fluid"><thead><tr><th style={{ width: 44 }}>#</th><th style={{ width: 70 }}>動作</th><th style={{ width: 110 }}>編號</th><th style={{ width: 150 }}>名稱</th><th style={{ width: 90 }}>面積</th><th style={{ width: 60 }}>頂點</th><th>檢查結果</th></tr></thead><tbody>
              {result.rows.map((row) => <tr key={row.index}><td>{row.index + 1}</td><td><StatusTag tone={row.action === "新增" ? "success" : row.action === "覆蓋" ? "info" : "neutral"}>{row.action}</StatusTag></td><td>{row.code || "—"}</td><td>{row.name || "—"}</td><td>{row.boundary ? formatArea(row.areaM2) : "—"}</td><td>{row.boundary ? row.vertices : "—"}</td>
                <td className="grid-result-cell">{row.action === "略過" ? <span className="grid-muted">已存在，按設定略過</span> : row.errors.length ? <ul>{row.errors.map((error, index) => <li key={index}>{error}</li>)}</ul> : <span className="grid-ok">通過</span>}</td></tr>)}
            </tbody></table></div></>}
        </section>}
      </div>
    </div>
  </FormDrawer>;
}
