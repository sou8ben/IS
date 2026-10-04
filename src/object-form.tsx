import { useState } from "react";
import { DeleteOutlined, EnvironmentOutlined, PlusOutlined } from "@ant-design/icons";
import { AttachmentField } from "./attachments";
import { Button, Field, Select } from "./components";
import { latLng, reverseGeocode, reverseGeocodeParts } from "./event-data";
import { FILE_MAX_BYTES, lngLatToPx, locateGridRecord, parseGeoJSON, pxToLngLat, ringsPx, validateObjectShape, type GridRecord, type ObjectShape } from "./grid-rules";
import { attachmentChars, type AttachmentRef } from "./inspection-rules";
import { groupCategories, groupsOfCategory } from "./group-catalog";
import { useDemo } from "./store";
import { ATTACH_MAX, composeAddress, DISPATCH_CATEGORY, type AddressParts, type GridAssignMode, type ManagedObject, type ObjectIssue, type ObjectStatus, type WorkGroupRow } from "./object-rules";
import { LegendItem, PlanMap, type MapMarkerSpec, type MapPolygonSpec } from "./plan-map";

const emptyParts: AddressParts = { parish: "", street: "", number: "", building: "" };
export interface ObjectFormState {
  inspectionType: string; code: string; name: string; status: ObjectStatus;
  parts: AddressParts; address: string; addressTouched: boolean; latitude: string; longitude: string; geoText: string;
  gridAssignMode: GridAssignMode; gridId: string; attachments: AttachmentRef[]; workGroups: WorkGroupRow[];
}
export const emptyObjectForm = (): ObjectFormState => ({ inspectionType: "", code: "", name: "", status: "啟用", parts: emptyParts, address: "", addressTouched: false, latitude: "", longitude: "", geoText: "", gridAssignMode: "自動", gridId: "", attachments: [], workGroups: [] });
export const formOfObject = (object: ManagedObject): ObjectFormState => ({
  inspectionType: object.inspectionType, code: object.code, name: object.name, status: object.status, parts: object.addressParts ?? emptyParts, address: object.address, addressTouched: true,
  latitude: String(object.latitude), longitude: String(object.longitude), geoText: object.geojson ? JSON.stringify(object.geojson, null, 2) : "", gridAssignMode: object.gridAssignMode, gridId: object.gridId ?? "",
  attachments: object.attachments, workGroups: object.workGroups.map((row) => ({ ...row })),
});

/** The object the form describes, plus problems found while reading it (GeoJSON text). `base` keeps seed-only fields when editing. */
export function draftOfForm(form: ObjectFormState, id: string, base?: ManagedObject): { draft: ManagedObject; problems: ObjectIssue[] } {
  const problems: ObjectIssue[] = []; let geojson: ObjectShape | null = null;
  if (form.geoText.trim()) {
    const parsed = parseGeoJSON(form.geoText);
    if (parsed.error) problems.push({ key: "geojson", message: parsed.error });
    else if (parsed.features.length !== 1) problems.push({ key: "geojson", message: `地圖檔案含有 ${parsed.features.length} 個要素，對象只可有一個。` });
    else geojson = parsed.features[0].geometry as ObjectShape;
  }
  const parts = Object.values(form.parts).some((value) => value.trim()) ? form.parts : undefined;
  const draft: ManagedObject = {
    ...base, id, inspectionType: form.inspectionType, gridId: form.gridAssignMode === "手動" ? form.gridId || null : null, gridAssignMode: form.gridAssignMode, code: form.code, name: form.name, address: form.address, addressParts: parts,
    latitude: form.latitude.trim() === "" ? NaN : Number(form.latitude), longitude: form.longitude.trim() === "" ? NaN : Number(form.longitude), geojson, attachments: form.attachments, workGroups: form.workGroups, status: form.status,
  };
  return { draft, problems };
}

const sectionOf = (key: string) => key === "type" || key === "code" || key === "name" ? "obj-sec-basic" : key === "location" || key === "address" ? "obj-sec-location" : key === "geojson" ? "obj-sec-geo" : key === "grid" ? "obj-sec-grid" : key === "attachments" ? "obj-sec-attach" : "obj-sec-groups";
export function ObjectIssueSummary({ issues }: { issues: ObjectIssue[] }) {
  if (!issues.length) return null;
  return <div className="evt-error" role="alert"><strong>請修正以下 {issues.length} 項</strong><ol>{issues.map((issue, index) => <li key={index}><button type="button" onClick={() => document.getElementById(sectionOf(issue.key))?.scrollIntoView({ behavior: "smooth", block: "start" })}>{issue.message}</button></li>)}</ol></div>;
}

/** Rows of 群組管理 category and group: the group list follows the chosen category. Shared by the form and the detail page. */
export function WorkGroupsEditor({ rows, onChange }: { rows: WorkGroupRow[]; onChange: (rows: WorkGroupRow[]) => void }) {
  const set = (index: number, patch: Partial<WorkGroupRow>) => onChange(rows.map((row, i) => i === index ? { ...row, ...patch } : row));
  const hasDispatch = rows.some((row) => row.category === DISPATCH_CATEGORY);
  return <>
    {rows.length > 0 && <table className="dense-table obj-groups-table"><thead><tr><th style={{ width: 200 }}>群組分類</th><th>群組</th><th style={{ width: 64 }}>操作</th></tr></thead><tbody>{rows.map((row, index) => {
      const taken = new Set(rows.filter((other, i) => i !== index && other.category === row.category).map((other) => other.group));
      return <tr key={index}>
        <td><Select ariaLabel={`第 ${index + 1} 行群組分類`} value={row.category} onChange={(category) => set(index, { category, group: "" })}><option value="">請選擇分類</option>{groupCategories.map((category) => <option key={category} disabled={category === DISPATCH_CATEGORY && hasDispatch && row.category !== DISPATCH_CATEGORY}>{category}</option>)}</Select></td>
        <td><Select ariaLabel={`第 ${index + 1} 行群組`} value={row.group} onChange={(group) => set(index, { group })}><option value="">{row.category ? "請選擇群組" : "請先選擇分類"}</option>{groupsOfCategory(row.category).filter((group) => group.name === row.group || !taken.has(group.name)).map((group) => <option key={group.name}>{group.name}</option>)}</Select></td>
        <td><button type="button" className="tpl-remove" aria-label="移除此行" onClick={() => onChange(rows.filter((_, i) => i !== index))}><DeleteOutlined /></button></td></tr>;
    })}</tbody></table>}
    <div><Button icon={<PlusOutlined />} onClick={() => onChange([...rows, { category: hasDispatch ? "" : DISPATCH_CATEGORY, group: "" }])}>新增一行</Button></div>
  </>;
}

export function ObjectForm({ form, issues, grids, mode, onChange }: { form: ObjectFormState; issues: ObjectIssue[]; grids: GridRecord[]; mode: "create" | "edit"; onChange: (patch: Partial<ObjectFormState>) => void }) {
  const [fileError, setFileError] = useState("");
  const { inspectionTypes: typeRecords } = useDemo();
  const typeNames = typeRecords.filter((type) => type.status === "生效").map((type) => type.name); // new objects can only use active types
  const error = (key: string) => issues.find((issue) => issue.key === key)?.message;
  const lat = form.latitude.trim() === "" ? NaN : Number(form.latitude); const lng = form.longitude.trim() === "" ? NaN : Number(form.longitude);
  const px = Number.isFinite(lat) && Number.isFinite(lng) ? lngLatToPx([lng, lat]) : null;
  const onMap = !!px && px[0] >= 0 && px[1] >= 0 && px[0] <= 1536 && px[1] <= 1024;
  const autoGrid = px && onMap ? locateGridRecord(grids, px[0], px[1]) : undefined;
  const parsed = form.geoText.trim() ? parseGeoJSON(form.geoText) : undefined;
  const shape = parsed && !parsed.error && parsed.features.length === 1 ? validateObjectShape(parsed.features[0].geometry) : undefined;
  const pick = ([x, y]: [number, number]) => {
    const [lngValue, latValue] = pxToLngLat([x, y]); const geo = reverseGeocodeParts(x, y);
    const patch: Partial<ObjectFormState> = { latitude: String(latValue), longitude: String(lngValue) };
    if (!form.addressTouched) { if (geo.parts) { patch.parts = geo.parts; patch.address = composeAddress(geo.parts); } else patch.address = reverseGeocode(x, y).address; }
    onChange(patch);
  };
  const setPart = (key: keyof AddressParts, value: string) => { const parts = { ...form.parts, [key]: value }; onChange({ parts, address: composeAddress(parts), addressTouched: false }); };
  const readFile = async (file: File | undefined) => { if (!file) return; if (file.size > FILE_MAX_BYTES) { setFileError("檔案超過 20 MB。"); return; } setFileError(""); onChange({ geoText: await file.text() }); };

  const polygons: MapPolygonSpec[] = [
    ...grids.map((grid) => ({ id: grid.id, rings: ringsPx(grid.boundary), label: grid.name, dim: true, dashed: true, selected: (form.gridAssignMode === "自動" ? autoGrid?.id : form.gridId) === grid.id })),
    ...(shape?.shape && shape.shape.type !== "Point" ? [{ id: "shape", rings: ringsPx(shape.shape), label: "地圖範圍", color: "#e60012" }] : []),
  ];
  const markers: MapMarkerSpec[] = [
    ...(px && onMap ? [{ id: "pick", kind: "object" as const, x: px[0], y: px[1], tone: "object" as const, label: "對", title: form.name || "對象位置" }] : []),
    ...(shape?.shape?.type === "Point" ? [{ id: "shape-point", kind: "event" as const, x: lngLatToPx(shape.shape.coordinates)[0], y: lngLatToPx(shape.shape.coordinates)[1], tone: "event" as const, title: "地圖檔案（點）" }] : []),
  ];
  const gridOptions = grids.filter((grid) => grid.status === "啟用" || grid.id === form.gridId);
  return <div className="evt-form obj-form">
    <section className="group-editor-section" id="obj-sec-basic"><header><h3>基本資料</h3></header><div className="group-editor-grid">
      <Field label="巡查類型" required hint="建立後不可修改">
        {mode === "create" ? <Select ariaLabel="巡查類型" value={form.inspectionType} onChange={(inspectionType) => onChange({ inspectionType })}><option value="">請選擇巡查類型</option>{typeNames.map((type) => <option key={type}>{type}</option>)}</Select> : <input value={form.inspectionType} disabled />}
        {error("type") && <small className="evt-field-error">{error("type")}</small>}</Field>
      <Field label="對象編號" hint={mode === "create" ? "可留空，系統自動生成；唯一，儲存後不可修改" : "唯一，不可修改"}><input value={form.code} maxLength={32} disabled={mode === "edit"} onChange={(event) => onChange({ code: event.target.value })} placeholder="例如 OBJ-035" />{error("code") && <small className="evt-field-error">{error("code")}</small>}</Field>
      <Field label="對象名稱" required hint="1–100 字"><input value={form.name} maxLength={100} onChange={(event) => onChange({ name: event.target.value })} placeholder="例如 白鴿巢公園" />{error("name") && <small className="evt-field-error">{error("name")}</small>}</Field>
      <Field label="狀態" hint="停用後不再出現在模板及計劃的可選清單"><Select ariaLabel="狀態" value={form.status} onChange={(status) => onChange({ status: status as ObjectStatus })}><option>啟用</option><option>停用</option></Select></Field>
    </div></section>
    <section className="group-editor-section" id="obj-sec-location"><header><h3>位置</h3></header><div className="evt-location">
      <div className="evt-pick"><PlanMap className="evt-pick-map" polygons={polygons} markers={markers} onPick={pick} fitKey="obj" legend={<><LegendItem tone="object">對象位置</LegendItem>{shape?.shape && <LegendItem tone="route">地圖檔案</LegendItem>}<LegendItem tone="ghost">網格</LegendItem></>} /></div>
      <div className="evt-pick-note"><EnvironmentOutlined />{px && onMap ? "點擊地圖可重新選點。" : "請點擊地圖選取對象位置（可先放大），或直接輸入經緯度。"}{error("location") && <em className="evt-field-error">{error("location")}</em>}</div>
      <div className="group-editor-grid">
        <Field label="緯度" required><input type="number" step="0.0000001" inputMode="decimal" value={form.latitude} onChange={(event) => onChange({ latitude: event.target.value })} placeholder="例如 22.2029" /></Field>
        <Field label="經度" required><input type="number" step="0.0000001" inputMode="decimal" value={form.longitude} onChange={(event) => onChange({ longitude: event.target.value })} placeholder="例如 113.5621" /></Field>
        <div className="field obj-address-parts"><span>結構化地址</span><div className="obj-parts-grid">
          <input aria-label="堂區" value={form.parts.parish} onChange={(event) => setPart("parish", event.target.value)} placeholder="堂區" /><input aria-label="街道" value={form.parts.street} onChange={(event) => setPart("street", event.target.value)} placeholder="街道" />
          <input aria-label="門牌" value={form.parts.number} onChange={(event) => setPart("number", event.target.value)} placeholder="門牌" /><input aria-label="建築物" value={form.parts.building} onChange={(event) => setPart("building", event.target.value)} placeholder="建築物" /></div>
          <small>按選點自動帶入最近的地址，填寫各部分會組成下方地址</small></div>
        <Field label="地址" required hint="1–300 字，可直接修改"><input value={form.address} maxLength={300} onChange={(event) => onChange({ address: event.target.value, addressTouched: true })} placeholder="請輸入地址" />{error("address") && <small className="evt-field-error">{error("address")}</small>}</Field>
        {px && onMap && <Field label="地圖座標" hint="與事件、工作使用同一換算"><input value={latLng(px[0], px[1])} disabled /></Field>}
      </div></div></section>
    <section className="group-editor-section" id="obj-sec-geo"><header><h3>地圖檔案</h3></header><div className="grid-geojson">
      <textarea rows={6} value={form.geoText} onChange={(event) => { setFileError(""); onChange({ geoText: event.target.value }); }} placeholder='選填：貼上 Point、Polygon 或 MultiPolygon 的 GeoJSON（Feature 亦可），用於顯示對象的範圍' aria-label="GeoJSON" spellCheck={false} />
      <div className="grid-geojson-bar"><label className="btn btn-default grid-file"><input type="file" accept=".geojson,.json,application/geo+json,application/json" onChange={(event) => { void readFile(event.target.files?.[0]); event.target.value = ""; }} />選擇檔案（≤ 20 MB）</label>{form.geoText && <Button onClick={() => onChange({ geoText: "" })}>清除</Button>}
        <span className={fileError || error("geojson") || parsed?.error || (shape && shape.errors.length) ? "grid-bad" : "grid-ok"}>{fileError || error("geojson") || (!parsed ? "未提供地圖檔案" : parsed.error ?? (parsed.features.length !== 1 ? `含有 ${parsed.features.length} 個要素，對象只可有一個` : shape && shape.errors.length ? shape.errors[0] : `已解析：${shape?.shape?.type}`))}</span></div>
    </div></section>
    <section className="group-editor-section" id="obj-sec-grid"><header><h3>所屬網格</h3></header><div className="group-editor-grid">
      <Field label="網格配置方式" required hint="自動：按經緯度歸屬；手動：自行指定，不會被自動歸屬覆蓋"><Select ariaLabel="網格配置方式" value={form.gridAssignMode} onChange={(value) => onChange({ gridAssignMode: value as GridAssignMode })}><option>自動</option><option>手動</option></Select></Field>
      {form.gridAssignMode === "自動"
        ? <Field label="所屬網格" hint="按位置即時計算；網格變更後可在網格管理使用「重新歸屬」更新"><input value={px && onMap ? autoGrid?.name ?? "未歸屬" : "請先選取位置"} disabled /></Field>
        : <Field label="所屬網格" required><Select ariaLabel="所屬網格" value={form.gridId} onChange={(gridId) => onChange({ gridId })}><option value="">請選擇網格</option>{gridOptions.map((grid) => <option key={grid.id} value={grid.id}>{grid.name}{grid.status === "停用" ? "（停用）" : ""}</option>)}</Select>{error("grid") && <small className="evt-field-error">{error("grid")}</small>}</Field>}
    </div></section>
    <section className="group-editor-section" id="obj-sec-attach"><header><h3>附件</h3></header><div className="evt-attach"><AttachmentField files={form.attachments} min={0} max={ATTACH_MAX} usedChars={attachmentChars({ a: { attachments: form.attachments } })} onChange={(attachments) => onChange({ attachments })} />{error("attachments") && <small className="evt-field-error">{error("attachments")}</small>}</div></section>
    <section className="group-editor-section" id="obj-sec-groups"><header><h3>工作負責群組</h3></header><div className="obj-groups">
      <p className="plan-hint">按群組管理的分類指定此對象的負責群組。執行群組只可設一個：此對象的所有新工作都會分派給它，優先於派工規則及工作類型默認群組；未設定時照常按規則分派。</p>
      <WorkGroupsEditor rows={form.workGroups} onChange={(workGroups) => onChange({ workGroups })} />
      {error("workGroups") && <small className="evt-field-error">{issues.filter((issue) => issue.key === "workGroups").map((issue) => issue.message).join(" ")}</small>}
    </div></section>
  </div>;
}
