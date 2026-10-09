import { useEffect, useMemo, useRef, useState, type DragEvent, type FormEvent, type KeyboardEvent, type ReactNode } from "react";
import { useSearchParams } from "react-router-dom";
import { CloseOutlined, CloudUploadOutlined, DeleteOutlined, EditOutlined, ExportOutlined, HolderOutlined, PlusOutlined, ReloadOutlined, SearchOutlined } from "@ant-design/icons";
import { BatchPickerDrawer, Button, ConfirmDialog, DenseTable, Field, FormDrawer, PageHeader, Pagination, Select, StatusTag, useToast } from "./components";
import { getObject } from "./object-data";
import { templateIdsOfPlan } from "./plan-data";
import { responsibilityGroups } from "./permission-rules";
import { useDemo } from "./store";
import {
  ATTACHMENTS_MAX, checkPoints, DISTANCE_MAX, DISTANCE_MIN, groupItemsByCategory, moveCategory, moveItem, newTemplate,
  normalizeItems, validateTemplate,
  type InspectionTemplate, type TemplateError, type TemplateItemSetting, type TemplateObjectSetting, type TemplateTab,
} from "./inspection-templates";
import type { Column } from "./types";
import { catalogView } from "./item-data";
import { sortItems } from "./item-rules";

type Patch = Partial<InspectionTemplate>;
const inspectionGroups = responsibilityGroups.filter((group) => group.kind === "巡查");
const inspectionGroupIds = inspectionGroups.map((group) => group.id);
const groupName = (id: string) => inspectionGroups.find((group) => group.id === id)?.name ?? id;
const unique = (values: string[]) => [...new Set(values)];
const contains = (value: string, query: string) => !query.trim() || value.toLowerCase().includes(query.trim().toLowerCase());
const nowText = () => { const d = new Date(); const pad = (n: number) => String(n).padStart(2, "0"); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`; };
const toNumber = (value: string) => value === "" ? null : Number(value);
const checkOnText = (template: InspectionTemplate) => template.locationCheck && template.checkOn.length ? template.checkOn.join("、") : "—";
const groupsText = (template: InspectionTemplate) => template.groups.length ? template.groups.map(groupName).join("、") : "全部群組";
const emptyFilters = { code: "", name: "", type: "", location: "", status: "" };
type TemplateFilters = typeof emptyFilters;
const editorTabs: { key: TemplateTab; label: string }[] = [{ key: "basic", label: "基礎數據" }, { key: "items", label: "巡查項目" }, { key: "objects", label: "適用對象" }, { key: "groups", label: "適用群組" }];

export function BatchEditDrawer({ title, count, error, onClose, onApply, children }: { title: string; count: number; error?: string; onClose: () => void; onApply: () => void; children: ReactNode }) {
  return <div className="group-user-drawer-mask" role="presentation" onMouseDown={onClose}><aside className="group-user-drawer tpl-side-drawer" role="dialog" aria-modal="true" aria-label={title} onMouseDown={(event) => event.stopPropagation()}>
    <header><div><h3>{title}</h3><p>套用至已選的 {count} 筆；留空或「保持不變」的欄位不會修改。</p></div><button type="button" aria-label="關閉" onClick={onClose}><CloseOutlined /></button></header>
    <div className="group-user-drawer-body tpl-batch-edit-body">{children}{error && <div className="tpl-editor-error" role="alert">{error}</div>}</div>
    <footer><span>已選 {count} 筆</span><Button variant="primary" onClick={onApply}>套用</Button></footer>
  </aside></div>;
}

export function useSelection(visibleIds: string[]) {
  const [selected, setSelected] = useState<string[]>([]);
  const allSelected = visibleIds.length > 0 && visibleIds.every((id) => selected.includes(id));
  const toggle = (id: string) => setSelected((ids) => ids.includes(id) ? ids.filter((item) => item !== id) : [...ids, id]);
  const toggleMany = (targets: string[]) => setSelected((ids) => targets.every((id) => ids.includes(id)) ? ids.filter((id) => !targets.includes(id)) : unique([...ids, ...targets]));
  const toggleAll = () => toggleMany(visibleIds);
  const drop = (removed: string[]) => setSelected((ids) => ids.filter((id) => !removed.includes(id)));
  return { selected, allSelected, toggle, toggleMany, toggleAll, drop };
}

type ItemDrag = { kind: "item"; index: number; category: string } | { kind: "group"; groupIndex: number };

function ItemsTab({ draft, onChange }: { draft: InspectionTemplate; onChange: (patch: Patch) => void }) {
  const [search, setSearch] = useState("");
  const [picker, setPicker] = useState(false); const [batchEdit, setBatchEdit] = useState(false);
  const [batchRequired, setBatchRequired] = useState(""); const [batchAttachments, setBatchAttachments] = useState(""); const [batchError, setBatchError] = useState("");
  const [armed, setArmed] = useState<string | null>(null); const [drag, setDrag] = useState<ItemDrag | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null); const [overGroup, setOverGroup] = useState<number | null>(null);
  const [focusKey, setFocusKey] = useState<string | null>(null); const bodyRef = useRef<HTMLTableSectionElement>(null);
  // The managed 巡查項目 (item-type order, then item order); existing selections keep resolving when an item is 失效, but only 生效 ones can be added.
  const { items: managedItems, itemTypes } = useDemo();
  const catalog = useMemo(() => { const sorted = sortItems(managedItems, [], itemTypes); return catalogView(sorted).map((item, index) => ({ ...item, active: sorted[index].status === "生效" })); }, [managedItems, itemTypes]);
  const itemById = useMemo(() => new Map(catalog.map((item) => [item.id, item.active ? item : { ...item, name: `${item.name}（失效）` }])), [catalog]);
  const filtering = search.trim() !== "";
  let flatIndex = 0;
  const groups = groupItemsByCategory(draft.items, catalog).map((group, groupIndex) => {
    const entries = group.settings.map((setting) => ({ setting, index: flatIndex++, item: itemById.get(setting.itemId) }));
    return { ...group, groupIndex, start: entries[0].index, end: entries[entries.length - 1].index, entries: entries.filter(({ item }) => item && (contains(item.name, search) || contains(item.code, search))) };
  });
  const visibleGroups = groups.filter((group) => group.entries.length);
  const { selected, allSelected, toggle, toggleMany, toggleAll, drop } = useSelection(visibleGroups.flatMap((group) => group.entries.map((entry) => entry.setting.itemId)));
  const candidates = catalog.filter((item) => item.active && item.inspectionType === draft.inspectionType && !draft.items.some((setting) => setting.itemId === item.id));
  useEffect(() => { if (focusKey) bodyRef.current?.querySelector<HTMLButtonElement>(`[data-handle="${focusKey}"]`)?.focus(); }, [focusKey, draft.items]);
  const update = (itemId: string, patch: Partial<TemplateItemSetting>) => onChange({ items: draft.items.map((setting) => setting.itemId === itemId ? { ...setting, ...patch } : setting) });
  const remove = (ids: string[]) => { onChange({ items: draft.items.filter((setting) => !ids.includes(setting.itemId)) }); drop(ids); };
  const endDrag = () => { setArmed(null); setDrag(null); setOverIndex(null); setOverGroup(null); };
  const arrow = (event: KeyboardEvent) => event.key === "ArrowUp" ? -1 : event.key === "ArrowDown" ? 1 : 0;
  const keyMoveItem = (event: KeyboardEvent, index: number, start: number, end: number, itemId: string) => {
    const delta = arrow(event); if (!delta) return;
    event.preventDefault();
    if (index + delta < start || index + delta > end) return; // items stay inside their category
    onChange({ items: moveItem(draft.items, index, index + delta) }); setFocusKey(`item:${itemId}`);
  };
  const keyMoveGroup = (event: KeyboardEvent, groupIndex: number, category: string) => {
    const delta = arrow(event); if (!delta) return;
    event.preventDefault(); onChange({ items: moveCategory(draft.items, groupIndex, groupIndex + delta, catalog) }); setFocusKey(`group:${category}`);
  };
  const dropOn = (groupIndex: number, index?: number) => {
    if (drag?.kind === "group") onChange({ items: moveCategory(draft.items, drag.groupIndex, groupIndex, catalog) });
    else if (drag?.kind === "item" && index !== undefined) onChange({ items: moveItem(draft.items, drag.index, index) });
    endDrag();
  };
  const overRow = (event: DragEvent, groupIndex: number, category: string, index?: number) => {
    if (drag?.kind === "group" && drag.groupIndex !== groupIndex) { event.preventDefault(); setOverGroup(groupIndex); setOverIndex(null); }
    else if (drag?.kind === "item" && index !== undefined && drag.category === category) { event.preventDefault(); setOverIndex(index); setOverGroup(null); }
  };
  const groupLine = (groupIndex: number, edge: "header" | "last") => drag?.kind === "group" && overGroup === groupIndex
    ? (edge === "header" && drag.groupIndex > groupIndex ? "drag-over-before" : edge === "last" && drag.groupIndex < groupIndex ? "drag-over-after" : "") : "";
  const itemLine = (index: number) => drag?.kind === "item" && overIndex === index && drag.index !== index ? (drag.index < index ? "drag-over-after" : "drag-over-before") : "";
  const startDrag = (event: DragEvent, next: ItemDrag) => { setDrag(next); event.dataTransfer.effectAllowed = "move"; event.dataTransfer.setData("text/plain", JSON.stringify(next)); };
  const add = (ids: string[]) => { onChange({ items: normalizeItems([...draft.items, ...catalog.filter((item) => ids.includes(item.id)).map((item) => ({ itemId: item.id, required: true, minAttachments: 0 }))], catalog) }); setPicker(false); };
  const openBatchEdit = () => { setBatchRequired(""); setBatchAttachments(""); setBatchError(""); setBatchEdit(true); };
  const applyBatchEdit = () => {
    const attachments = toNumber(batchAttachments);
    if (attachments !== null && (!Number.isInteger(attachments) || attachments < 0 || attachments > ATTACHMENTS_MAX)) { setBatchError(`最少附件數須為 0–${ATTACHMENTS_MAX} 的整數。`); return; }
    onChange({ items: draft.items.map((setting) => selected.includes(setting.itemId) ? { ...setting, ...(batchRequired ? { required: batchRequired === "必填" } : {}), ...(attachments !== null ? { minAttachments: attachments } : {}) } : setting) });
    setBatchEdit(false);
  };
  return <section className="group-editor-section tpl-list-section">
    <header><h3>巡查項目</h3><Button variant="primary" icon={<PlusOutlined />} disabled={!draft.inspectionType} onClick={() => setPicker(true)}>批量新增</Button></header>
    <div className="tpl-section-toolbar"><div className="group-user-search"><SearchOutlined /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="搜尋已加入的項目名稱或編號" /></div><span>{!draft.inspectionType ? "請先在基礎數據選擇巡查類型" : filtering ? "搜尋時暫停拖動排序" : "拖動類別或項目的把手（或按方向鍵）調整順序；項目只可在所屬類別內移動"}</span></div>
    {selected.length > 0 && <div className="batch-bar"><strong>已選 {selected.length} 項</strong><Button icon={<EditOutlined />} onClick={openBatchEdit}>批量編輯</Button><Button variant="danger" icon={<DeleteOutlined />} onClick={() => remove(selected)}>批量移除</Button></div>}
    <div className="tpl-table-wrap"><table className="dense-table tpl-editor-table">
      <thead><tr><th className="check-cell"><input type="checkbox" aria-label="全選巡查項目" checked={allSelected} disabled={!visibleGroups.length} onChange={toggleAll} /></th><th className="tpl-handle-cell"><span className="sr-only">排序把手</span></th><th style={{ width: 56 }}>順序</th><th style={{ width: 96 }}>項目編號</th><th>項目名稱</th><th style={{ width: 90 }}>輸入方式</th><th style={{ width: 110 }}>填寫要求</th><th style={{ width: 100 }}>最少附件數</th><th style={{ width: 64 }}>操作</th></tr></thead>
      <tbody ref={bodyRef}>{visibleGroups.flatMap((group) => {
        const groupIds = group.entries.map((entry) => entry.setting.itemId);
        const groupAll = groupIds.every((id) => selected.includes(id)); const groupSome = groupIds.some((id) => selected.includes(id));
        const groupDragging = drag?.kind === "group" && drag.groupIndex === group.groupIndex ? "dragging" : "";
        const lastId = groupIds[groupIds.length - 1];
        const header = <tr key={`group-${group.category}`} className={`tpl-category-row ${groupDragging} ${groupLine(group.groupIndex, "header")}`} draggable={armed === `group:${group.category}`}
          onDragStart={(event) => startDrag(event, { kind: "group", groupIndex: group.groupIndex })} onDragOver={(event) => overRow(event, group.groupIndex, group.category)} onDrop={(event) => { event.preventDefault(); dropOn(group.groupIndex); }} onDragEnd={endDrag}>
          <td className="check-cell"><input type="checkbox" aria-label={`全選${group.category}`} checked={groupAll} ref={(element) => { if (element) element.indeterminate = groupSome && !groupAll; }} onChange={() => toggleMany(groupIds)} /></td>
          <td className="tpl-handle-cell"><button type="button" className="tpl-drag-handle" data-handle={`group:${group.category}`} disabled={filtering} aria-label={`拖動或按方向鍵調整「${group.category}」類別順序`} onPointerDown={() => setArmed(`group:${group.category}`)} onPointerUp={() => setArmed(null)} onKeyDown={(event) => keyMoveGroup(event, group.groupIndex, group.category)}><HolderOutlined /></button></td>
          <td colSpan={7}><div className="tpl-category-title"><strong>{group.category}</strong><span>{group.settings.length} 項 · 必填 {group.settings.filter((setting) => setting.required).length} 項</span></div></td>
        </tr>;
        return [header, ...group.entries.map(({ setting, index, item }) => item && <tr key={setting.itemId} draggable={armed === `item:${setting.itemId}`}
          className={`${drag?.kind === "item" && drag.index === index ? "dragging" : groupDragging} ${itemLine(index)} ${setting.itemId === lastId ? groupLine(group.groupIndex, "last") : ""}`}
          onDragStart={(event) => startDrag(event, { kind: "item", index, category: group.category })} onDragOver={(event) => overRow(event, group.groupIndex, group.category, index)} onDrop={(event) => { event.preventDefault(); dropOn(group.groupIndex, index); }} onDragEnd={endDrag}>
          <td className="check-cell"><input type="checkbox" aria-label={`選擇 ${item.name}`} checked={selected.includes(setting.itemId)} onChange={() => toggle(setting.itemId)} /></td>
          <td className="tpl-handle-cell"><button type="button" className="tpl-drag-handle" data-handle={`item:${setting.itemId}`} disabled={filtering} aria-label={`拖動或按方向鍵調整「${item.name}」順序`} onPointerDown={() => setArmed(`item:${setting.itemId}`)} onPointerUp={() => setArmed(null)} onKeyDown={(event) => keyMoveItem(event, index, group.start, group.end, setting.itemId)}><HolderOutlined /></button></td>
          <td>{index + 1}</td><td>{item.code}</td><td title={item.name}>{item.name}</td><td>{item.inputKind}</td>
          <td><Select ariaLabel={`${item.name}填寫要求`} value={setting.required ? "必填" : "選填"} onChange={(value) => update(setting.itemId, { required: value === "必填" })}><option>必填</option><option>選填</option></Select></td>
          <td><input className="tpl-number" type="number" min={0} max={ATTACHMENTS_MAX} step={1} aria-label={`${item.name}最少附件數`} value={setting.minAttachments} onChange={(event) => update(setting.itemId, { minAttachments: toNumber(event.target.value) ?? 0 })} /></td>
          <td><button type="button" className="tpl-remove" onClick={() => remove([setting.itemId])}>移除</button></td>
        </tr>)];
      })}</tbody>
    </table>{!visibleGroups.length && <div className="tpl-empty">{draft.items.length ? "沒有符合搜尋的項目" : "尚未加入巡查項目，模板至少需要 1 項"}</div>}</div>
    {picker && <BatchPickerDrawer title="批量新增巡查項目" noun="巡查項目" description="搜尋及複選同類型巡查項目，一次加入模板。" filterLabel="項目類型" grouped rows={candidates.map((item) => ({ id: item.id, title: item.name, meta: `${item.code} · ${item.inputKind}`, group: item.category }))} onClose={() => setPicker(false)} onConfirm={add} />}
    {batchEdit && <BatchEditDrawer title="批量編輯巡查項目" count={selected.length} error={batchError} onClose={() => setBatchEdit(false)} onApply={applyBatchEdit}>
      <Field label="填寫要求"><Select ariaLabel="批量填寫要求" value={batchRequired} onChange={(value) => { setBatchRequired(value); setBatchError(""); }}><option value="">保持不變</option><option>必填</option><option>選填</option></Select></Field>
      <Field label="最少附件數" hint={`0–${ATTACHMENTS_MAX}；留空保持不變`}><input type="number" min={0} max={ATTACHMENTS_MAX} step={1} value={batchAttachments} onChange={(event) => { setBatchAttachments(event.target.value); setBatchError(""); }} placeholder="保持不變" /></Field>
    </BatchEditDrawer>}
  </section>;
}

function ObjectsTab({ draft, onChange }: { draft: InspectionTemplate; onChange: (patch: Patch) => void }) {
  const [search, setSearch] = useState(""); const [grid, setGrid] = useState("");
  const [picker, setPicker] = useState(false); const [batchEdit, setBatchEdit] = useState(false);
  const [batchDistance, setBatchDistance] = useState(""); const [batchError, setBatchError] = useState("");
  const { objects: managed, grids } = useDemo();
  // the managed objects: existing selections keep resolving even when disabled, but only active ones can be added
  const catalog = useMemo(() => managed.map((object) => ({ id: object.id, code: object.code, name: object.status === "啟用" ? object.name : `${object.name}（停用）`, inspectionType: object.inspectionType, grid: getObject(object.id)?.grid ?? "未歸屬", address: object.address, active: object.status === "啟用" })), [managed, grids]); // eslint-disable-line react-hooks/exhaustive-deps
  const objectById = useMemo(() => new Map(catalog.map((object) => [object.id, object])), [catalog]);
  const rows = draft.objects.map((setting) => ({ setting, object: objectById.get(setting.objectId) })).filter(({ object }) => object && (!grid || object.grid === grid) && (contains(object.name, search) || contains(object.code, search) || contains(object.address, search)));
  const { selected, allSelected, toggle, toggleAll, drop } = useSelection(rows.map((row) => row.setting.objectId));
  const candidates = catalog.filter((object) => object.active && object.inspectionType === draft.inspectionType && !draft.objects.some((setting) => setting.objectId === object.id));
  const gridOptions = unique(catalog.filter((object) => object.inspectionType === draft.inspectionType).map((object) => object.grid));
  const defaultText = draft.validDistance ?? "—";
  const update = (objectId: string, patch: Partial<TemplateObjectSetting>) => onChange({ objects: draft.objects.map((setting) => setting.objectId === objectId ? { ...setting, ...patch } : setting) });
  const remove = (ids: string[]) => { onChange({ objects: draft.objects.filter((setting) => !ids.includes(setting.objectId)) }); drop(ids); };
  const add = (ids: string[]) => { onChange({ objects: [...draft.objects, ...catalog.filter((object) => ids.includes(object.id)).map((object) => ({ objectId: object.id, distance: null }))] }); setPicker(false); };
  const openBatchEdit = () => { setBatchDistance(""); setBatchError(""); setBatchEdit(true); };
  const applyBatchEdit = () => {
    const distance = toNumber(batchDistance);
    if (distance !== null && (!Number.isInteger(distance) || distance < DISTANCE_MIN || distance > DISTANCE_MAX)) { setBatchError(`有效距離須留空或為 ${DISTANCE_MIN}–${DISTANCE_MAX} 米的整數。`); return; }
    onChange({ objects: draft.objects.map((setting) => selected.includes(setting.objectId) ? { ...setting, distance } : setting) });
    setBatchEdit(false);
  };
  return <>
    <p className="tpl-hint">未指定對象時，模板適用「{draft.inspectionType || "所選巡查類型"}」下全部對象。{draft.locationCheck ? `對象有效距離留空即使用模板預設 ${defaultText} 米。` : "定位檢查已關閉，有效距離不適用。"}</p>
    <section className="group-editor-section tpl-list-section">
      <header><h3>適用對象</h3><Button variant="primary" icon={<PlusOutlined />} disabled={!draft.inspectionType} onClick={() => setPicker(true)}>批量新增</Button></header>
      <div className="tpl-section-toolbar"><div className="group-user-search"><SearchOutlined /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="搜尋已加入的對象名稱、編號或地址" /></div><Select ariaLabel="篩選網格" value={grid} onChange={setGrid}><option value="">全部網格</option>{gridOptions.map((option) => <option key={option}>{option}</option>)}</Select></div>
      {selected.length > 0 && <div className="batch-bar"><strong>已選 {selected.length} 個</strong><Button icon={<EditOutlined />} disabled={!draft.locationCheck} onClick={openBatchEdit}>批量編輯</Button><Button variant="danger" icon={<DeleteOutlined />} onClick={() => remove(selected)}>批量移除</Button></div>}
      <div className="tpl-table-wrap"><table className="dense-table tpl-editor-table">
        <thead><tr><th className="check-cell"><input type="checkbox" aria-label="全選適用對象" checked={allSelected} disabled={!rows.length} onChange={toggleAll} /></th><th style={{ width: 96 }}>對象編號</th><th>對象名稱</th><th style={{ width: 120 }}>所屬網格</th><th style={{ width: 190 }}>地址</th><th style={{ width: 140 }}>有效距離（米）</th><th style={{ width: 64 }}>操作</th></tr></thead>
        <tbody>{rows.map(({ setting, object }) => object && <tr key={setting.objectId}>
          <td className="check-cell"><input type="checkbox" aria-label={`選擇 ${object.name}`} checked={selected.includes(setting.objectId)} onChange={() => toggle(setting.objectId)} /></td>
          <td>{object.code}</td><td title={object.name}>{object.name}</td><td>{object.grid}</td><td title={object.address}>{object.address}</td>
          <td><input className="tpl-number" type="number" min={DISTANCE_MIN} max={DISTANCE_MAX} step={1} disabled={!draft.locationCheck} aria-label={`${object.name}有效距離`} value={draft.locationCheck ? setting.distance ?? "" : ""} onChange={(event) => update(setting.objectId, { distance: toNumber(event.target.value) })} placeholder={draft.locationCheck ? `預設 ${defaultText}` : "不適用"} /></td>
          <td><button type="button" className="tpl-remove" onClick={() => remove([setting.objectId])}>移除</button></td>
        </tr>)}</tbody>
      </table>{!rows.length && <div className="tpl-empty">{draft.objects.length ? "沒有符合篩選的對象" : "未指定對象，適用類型下全部對象"}</div>}</div>
    </section>
    {picker && <BatchPickerDrawer title="批量新增適用對象" noun="對象" description="搜尋及複選同類型對象，一次加入模板。" filterLabel="網格" rows={candidates.map((object) => ({ id: object.id, title: object.name, meta: `${object.code} · ${object.grid} · ${object.address}`, group: object.grid }))} onClose={() => setPicker(false)} onConfirm={add} />}
    {batchEdit && <BatchEditDrawer title="批量編輯適用對象" count={selected.length} error={batchError} onClose={() => setBatchEdit(false)} onApply={applyBatchEdit}>
      <Field label="有效距離（米）" hint={`${DISTANCE_MIN}–${DISTANCE_MAX} 米；留空即改用模板預設 ${defaultText} 米`}><input type="number" min={DISTANCE_MIN} max={DISTANCE_MAX} step={1} value={batchDistance} onChange={(event) => { setBatchDistance(event.target.value); setBatchError(""); }} placeholder={`預設 ${defaultText}`} /></Field>
    </BatchEditDrawer>}
  </>;
}

function GroupsTab({ draft, onChange }: { draft: InspectionTemplate; onChange: (patch: Patch) => void }) {
  const toggle = (id: string) => onChange({ groups: inspectionGroupIds.filter((groupId) => groupId === id ? !draft.groups.includes(id) : draft.groups.includes(groupId)) });
  return <section className="group-editor-section"><header><h3>適用巡查群組</h3></header><div className="tpl-group-body">
    <p className="tpl-hint">未選擇群組時，模板適用全部巡查群組。</p>
    <div className="tpl-group-list">{inspectionGroups.map((group) => <label key={group.id}><input type="checkbox" checked={draft.groups.includes(group.id)} onChange={() => toggle(group.id)} /><span><strong>{group.name}</strong><small>{group.department} · 網格：{group.grids.join("、")}</small></span></label>)}</div>
  </div></section>;
}

function BasicTab({ draft, onChange, onSubmit }: { draft: InspectionTemplate; onChange: (patch: Patch) => void; onSubmit: () => void }) {
  // Plans using this template (each plan keeps its own snapshot); open ones are 未開始 or 進行中.
  const { plans } = useDemo();
  const planRefs = draft.id ? plans.filter((plan) => templateIdsOfPlan(plan).includes(draft.id)) : [];
  const openRefs = planRefs.filter((plan) => plan.status === "未開始" || plan.status === "進行中");
  const { inspectionTypes: typeRecords } = useDemo();
  const isNew = !draft.id;
  const [pendingType, setPendingType] = useState<string | null>(null); const [confirmDisable, setConfirmDisable] = useState(false);
  const changeType = (inspectionType: string) => {
    if (inspectionType === draft.inspectionType) return;
    if (draft.items.length || draft.objects.length) setPendingType(inspectionType); else onChange({ inspectionType });
  };
  const changeStatus = (active: boolean) => { if (!active && openRefs.length > 0) setConfirmDisable(true); else onChange({ status: active ? "生效" : "失效" }); };
  const toggleCheckPoint = (point: string) => onChange({ checkOn: checkPoints.filter((item) => item === point ? !draft.checkOn.includes(item) : draft.checkOn.includes(item)) });
  const submit = (event: FormEvent) => { event.preventDefault(); onSubmit(); };
  return <form className="tpl-basic-form" onSubmit={submit}>
    <section className="group-editor-section"><header><h3>模板資料</h3></header><div className="group-editor-grid">
      <Field label="編號" required hint="唯一，儲存後不可修改"><input value={draft.code} disabled={!isNew} onChange={(event) => onChange({ code: event.target.value })} placeholder="例如 TPL007" /></Field>
      <Field label="模板名稱" required hint="1–50 字，同一巡查類型內唯一"><input value={draft.name} maxLength={50} onChange={(event) => onChange({ name: event.target.value })} placeholder="請輸入模板名稱" /></Field>
      <Field label="巡查類型" required hint={isNew ? "項目及對象只可選同類型記錄" : "建立後不可修改"}>{isNew ? <Select ariaLabel="巡查類型" value={draft.inspectionType} onChange={changeType}><option value="">請選擇巡查類型</option>{typeRecords.filter((type) => type.status === "生效").map((type) => <option key={type.id}>{type.name}</option>)}</Select> : <input value={draft.inspectionType} disabled />}</Field>
      <Field label="巡查要求"><textarea rows={4} value={draft.description} onChange={(event) => onChange({ description: event.target.value })} placeholder="說明巡查要求、作業步驟、輸入規範及附件要求" /></Field>
    </div></section>
    <section className="group-editor-section"><header><h3>定位檢查</h3></header><div className="group-editor-grid tpl-location-grid">
      <div className="bip-field"><span>定位檢查</span><div className="switch-row"><label className="switch-control"><input type="checkbox" aria-label="啟用定位檢查" checked={draft.locationCheck} onChange={(event) => onChange({ locationCheck: event.target.checked })} /><span className="switch" /></label></div></div>
      <Field label="有效距離（米）" required={draft.locationCheck} hint={`${DISTANCE_MIN}–${DISTANCE_MAX} 米；對象可單獨覆寫`}><input type="number" min={DISTANCE_MIN} max={DISTANCE_MAX} step={1} disabled={!draft.locationCheck} value={draft.validDistance ?? ""} onChange={(event) => onChange({ validDistance: toNumber(event.target.value) })} placeholder="預設 100" /></Field>
      <fieldset className="bip-field tpl-check-points" disabled={!draft.locationCheck}><legend>{draft.locationCheck && <b>*</b>}檢查時點</legend><div>{checkPoints.map((point) => <label key={point}><input type="checkbox" checked={draft.checkOn.includes(point)} onChange={() => toggleCheckPoint(point)} /><span>{point}</span></label>)}</div></fieldset>
      <p className="tpl-hint tpl-location-hint">巡查員須位於對象的有效距離範圍內，才可在所選時點開始填寫或提交巡查。</p>
    </div></section>
    <section className="group-editor-section"><header><h3>模板狀態</h3></header><div className="group-editor-status"><div className="bip-field"><span>狀態</span><div className="switch-row"><label className="switch-control"><input type="checkbox" aria-label="模板生效" checked={draft.status === "生效"} onChange={(event) => changeStatus(event.target.checked)} /><span className="switch" /></label></div></div><div className="group-editor-count"><span>使用中的巡查計劃（共 {planRefs.length} 個）</span><strong>{openRefs.length}</strong></div></div></section>
    <button type="submit" className="sr-only">儲存</button>
    <ConfirmDialog open={pendingType !== null} title="更改巡查類型？" message={`巡查項目及對象只可選同類型記錄，更改後將移除已加入的 ${draft.items.length} 個項目及 ${draft.objects.length} 個對象。`} danger confirmLabel="確認更改" onCancel={() => setPendingType(null)} onConfirm={() => { onChange({ inspectionType: pendingType ?? "", items: [], objects: [] }); setPendingType(null); }} />
    <ConfirmDialog open={confirmDisable} title="停用巡查模板？" message={`此模板正被 ${openRefs.length} 個未開始或進行中的巡查計劃使用。停用後不可再用於新計劃及新巡查；這些計劃沿用建立時的模板快照，已生成的巡查不受影響。`} danger confirmLabel="確認停用" onCancel={() => setConfirmDisable(false)} onConfirm={() => { onChange({ status: "失效" }); setConfirmDisable(false); }} />
  </form>;
}

function TemplateEditor({ draft, tab, errors, onTab, onChange, onSubmit }: { draft: InspectionTemplate; tab: TemplateTab; errors: TemplateError[]; onTab: (tab: TemplateTab) => void; onChange: (patch: Patch) => void; onSubmit: () => void }) {
  const errorRef = useRef<HTMLDivElement>(null);
  useEffect(() => { if (errors.length) errorRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" }); }, [errors]);
  const counts: Partial<Record<TemplateTab, number>> = { items: draft.items.length, objects: draft.objects.length, groups: draft.groups.length };
  return <div className="tpl-editor">
    <nav className="bip-editor-tabs" role="tablist" aria-label="巡查模板設定">{editorTabs.map((item) => <button type="button" role="tab" key={item.key} aria-selected={tab === item.key} className={tab === item.key ? "active" : ""} onClick={() => onTab(item.key)}>{item.label}{counts[item.key] !== undefined && <span>{counts[item.key]}</span>}</button>)}</nav>
    <div className="tpl-tab-content" role="tabpanel">
      {errors.length > 0 && <div ref={errorRef} className="tpl-editor-error" role="alert">{errors.map((error) => error.message).join(" ")}</div>}
      {tab === "basic" && <BasicTab draft={draft} onChange={onChange} onSubmit={onSubmit} />}
      {tab === "items" && <ItemsTab draft={draft} onChange={onChange} />}
      {tab === "objects" && <ObjectsTab draft={draft} onChange={onChange} />}
      {tab === "groups" && <GroupsTab draft={draft} onChange={onChange} />}
    </div>
  </div>;
}

export function InspectionTemplatesPage() {
  const { showToast } = useToast();
  const { inspectionTemplates: templates, saveInspectionTemplates, objects: managedObjects, inspectionTypes: typeRecords, items: managedItems } = useDemo();
  const [filters, setFilters] = useState<TemplateFilters>(emptyFilters);
  const [page, setPage] = useState(1); const [pageSize, setPageSize] = useState(15);
  const [params] = useSearchParams(); // ?template=ID opens that template (linked from plan detail)
  const [draft, setDraft] = useState<InspectionTemplate | null>(() => { const linked = templates.find((item) => item.id === params.get("template")); return linked ? structuredClone(linked) : null; }); const [tab, setTab] = useState<TemplateTab>("basic"); const [errors, setErrors] = useState<TemplateError[]>([]);
  const filter = (key: keyof TemplateFilters, value: string) => { setFilters((current) => ({ ...current, [key]: value })); setPage(1); };
  const rows = templates.filter((template) => contains(template.code, filters.code) && contains(template.name, filters.name) && (!filters.type || template.inspectionType === filters.type)
    && (!filters.location || (template.locationCheck ? "開啟" : "關閉") === filters.location) && (!filters.status || template.status === filters.status));
  const open = (template: InspectionTemplate) => { setDraft(structuredClone(template)); setTab("basic"); setErrors([]); };
  const change = (patch: Patch) => { setDraft((current) => current ? { ...current, ...patch } : current); setErrors([]); };
  const save = () => {
    if (!draft) return;
    const template: InspectionTemplate = { ...draft, code: draft.code.trim(), name: draft.name.trim(), description: draft.description.trim() };
    const found = validateTemplate(template, templates, inspectionGroupIds, managedObjects, typeRecords.map((type) => type.name), catalogView(managedItems));
    if (found.length) { setErrors(found); if (!found.some((error) => error.tab === tab)) setTab(found[0].tab); return; }
    const saved: InspectionTemplate = { ...template, id: template.id || `TPL-${Date.now()}`, updatedBy: "陳家朗", updatedAt: nowText() };
    saveInspectionTemplates(templates.some((item) => item.id === saved.id) ? templates.map((item) => item.id === saved.id ? saved : item) : [saved, ...templates]);
    setDraft(null);
    showToast(template.id ? "巡查模板已更新" : "巡查模板已建立");
  };
  const columns: Column<InspectionTemplate>[] = ([
    { key: "code", title: "編號", width: 110 },
    { key: "name", title: "名稱", width: 200 },
    { key: "inspectionType", title: "巡查類型", width: 130 },
    { key: "locationCheck", title: "定位檢查", width: 100, render: (template) => <StatusTag tone={template.locationCheck ? "info" : "neutral"}>{template.locationCheck ? "開啟" : "關閉"}</StatusTag>, sortValue: (template) => template.locationCheck ? "開啟" : "關閉" },
    { key: "validDistance", title: "有效距離（米）", width: 125, render: (template) => template.locationCheck ? template.validDistance ?? "—" : "—", sortValue: (template) => template.locationCheck ? template.validDistance ?? 0 : -1 },
    { key: "checkOn", title: "檢查時點", width: 150, render: checkOnText, sortValue: checkOnText },
    { key: "items", title: "巡查項目", width: 100, render: (template) => `${template.items.length} 項`, sortValue: (template) => template.items.length },
    { key: "objects", title: "適用對象", width: 110, render: (template) => template.objects.length ? `${template.objects.length} 個` : "全部對象", sortValue: (template) => template.objects.length },
    { key: "groups", title: "適用巡查群組", width: 200, render: groupsText, sortValue: groupsText },
    { key: "status", title: "狀態", width: 85, render: (template) => <StatusTag tone={template.status === "生效" ? "success" : "neutral"}>{template.status}</StatusTag> },
    { key: "updatedBy", title: "更新人", width: 100 },
    { key: "updatedAt", title: "更新時間", width: 160 },
  ] satisfies Column<InspectionTemplate>[]).map((column) => ({ ...column, sortable: true }));
  return <div className="page-content tpl-page">
    <PageHeader title="巡查模板" actions={<><Button icon={<CloudUploadOutlined />}>匯入</Button><Button icon={<ExportOutlined />}>匯出</Button><Button variant="primary" icon={<PlusOutlined />} onClick={() => open(newTemplate())}>新增模板</Button></>} />
    <section className="panel list-panel tpl-list-panel">
      <div className="filter-bar tpl-filter-bar">
        <label className="filter-field"><span>編號</span><input aria-label="編號" value={filters.code} onChange={(event) => filter("code", event.target.value)} placeholder="請輸入編號" /></label>
        <label className="filter-field"><span>名稱</span><input aria-label="名稱" value={filters.name} onChange={(event) => filter("name", event.target.value)} placeholder="請輸入名稱" /></label>
        <label className="filter-field"><span>巡查類型</span><Select ariaLabel="巡查類型" value={filters.type} onChange={(value) => filter("type", value)}><option value="">全部巡查類型</option>{typeRecords.map((type) => <option key={type.id}>{type.name}</option>)}</Select></label>
        <label className="filter-field"><span>定位檢查</span><Select ariaLabel="定位檢查" value={filters.location} onChange={(value) => filter("location", value)}><option value="">全部</option><option>開啟</option><option>關閉</option></Select></label>
        <label className="filter-field"><span>狀態</span><Select ariaLabel="狀態" value={filters.status} onChange={(value) => filter("status", value)}><option value="">全部狀態</option><option>生效</option><option>失效</option></Select></label>
        <div className="user-filter-actions"><Button variant="text" icon={<ReloadOutlined />} onClick={() => { setFilters(emptyFilters); setPage(1); }}>重設</Button></div>
      </div>
      <DenseTable rows={rows} columns={columns} stickyActions actionTitle="操作" page={Math.min(page, Math.max(1, Math.ceil(rows.length / pageSize)))} pageSize={pageSize} onSort={() => setPage(1)} renderActions={(template) => <button className="table-action-button" aria-label={`編輯 ${template.name}`} onClick={() => open(template)}><EditOutlined />編輯</button>} />
      <Pagination total={rows.length} page={page} pageSize={pageSize} onPageChange={setPage} onPageSizeChange={(size) => { setPageSize(size); setPage(1); }} />
    </section>
    <FormDrawer open={!!draft} title={draft?.id ? "編輯巡查模板" : "新增巡查模板"} subtitle={draft?.id ? draft.code : undefined} className="tpl-editor-drawer" onClose={() => setDraft(null)} onSubmit={save}>
      {draft && <TemplateEditor draft={draft} tab={tab} errors={errors} onTab={setTab} onChange={change} onSubmit={save} />}
    </FormDrawer>
  </div>;
}
