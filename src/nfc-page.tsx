import { useEffect, useRef, useState, type ChangeEvent, type FormEvent, type MouseEvent } from "react";
import { CloseOutlined, CloudUploadOutlined, EditOutlined, EnvironmentFilled, ExportOutlined, FileImageOutlined, PlusOutlined, ReloadOutlined, UploadOutlined } from "@ant-design/icons";
import { Button, DenseTable, Field, FormDrawer, PageHeader, Pagination, Select, StatusTag, useToast } from "./components";
import { reverseGeocodeParts } from "./event-data";
import { lngLatToPx } from "./grid-rules";
import { departments, responsibilityGroups } from "./permission-rules";
import { fromMapPercent, initialNfcTags, NFC_MAX_PHOTOS, newNfcTag, toMapPercent, validateNfcTag, type NfcAddressParts, type NfcPhoto, type NfcTag } from "./nfc-tags";
import { composeAddress } from "./object-rules";
import { useDemo } from "./store";
import type { Column } from "./types";

const mapImageUrl = `${import.meta.env.BASE_URL}assets/macau-operations-map.png`;
const managementGroups = responsibilityGroups.filter((group) => group.kind === "管理");
const managementGroupIds = managementGroups.map((group) => group.id);
const childDepartments = departments.filter((department) => department !== "市政署");
const groupName = (id: string) => managementGroups.find((group) => group.id === id)?.name ?? "—";
const coordinate = (value: number | null) => value === null ? "—" : value.toFixed(6);
const contains = (value: string, query: string) => !query.trim() || value.toLowerCase().includes(query.trim().toLowerCase());
const nowText = () => { const d = new Date(); const pad = (n: number) => String(n).padStart(2, "0"); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`; };
const emptyFilters = { code: "", name: "", uid: "", address: "", group: "", department: "", status: "" };
type NfcFilters = typeof emptyFilters;

function DepartmentOptions() {
  return <optgroup label="市政署">{childDepartments.map((department) => <option key={department}>{department}</option>)}</optgroup>;
}

function NfcMapPicker({ lat, lng, onPick }: { lat: number | null; lng: number | null; onPick: (point: { lat: number; lng: number }) => void }) {
  const point = lat !== null && lng !== null ? toMapPercent(lat, lng) : null;
  const pick = (event: MouseEvent<HTMLButtonElement>) => {
    if (event.detail === 0) return; // keyboard activation has no pointer position
    const rect = event.currentTarget.getBoundingClientRect();
    onPick(fromMapPercent((event.clientX - rect.left) / rect.width * 100, (event.clientY - rect.top) / rect.height * 100));
  };
  return <div className="nfc-map-field">
    <button type="button" className="nfc-map-picker" aria-label="在地圖選取標籤位置" onClick={pick}>
      <img src={mapImageUrl} alt="" draggable={false} />
      {point && <span className="nfc-map-pin" style={{ left: `${point.x}%`, top: `${point.y}%` }}><EnvironmentFilled /></span>}
    </button>
    <small>{point ? "點擊地圖可重新選點。" : "點擊地圖選取標籤位置。"}示範底圖為示意，坐標按示範範圍換算。</small>
  </div>;
}

function NfcPhotos({ photos, onChange }: { photos: NfcPhoto[]; onChange: (photos: NfcPhoto[]) => void }) {
  const add = (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []).slice(0, NFC_MAX_PHOTOS - photos.length);
    onChange([...photos, ...files.map((file) => ({ name: file.name, url: URL.createObjectURL(file) }))]);
    event.target.value = "";
  };
  return <div className="nfc-photo-panel">
    <div className="nfc-photo-grid">
      {photos.map((photo, index) => <figure key={`${photo.name}-${index}`}>
        {photo.url ? <img src={photo.url} alt={photo.name} /> : <FileImageOutlined />}
        <figcaption>{photo.name}</figcaption>
        <button type="button" aria-label={`移除 ${photo.name}`} onClick={() => onChange(photos.filter((_, itemIndex) => itemIndex !== index))}><CloseOutlined /></button>
      </figure>)}
      {photos.length < NFC_MAX_PHOTOS && <label className="nfc-photo-upload"><input type="file" accept="image/*" multiple onChange={add} /><UploadOutlined /><span>上傳照片</span></label>}
    </div>
    <small>已上傳 {photos.length}/{NFC_MAX_PHOTOS} 張，方便現場辨認標籤位置。</small>
  </div>;
}

function NfcEditor({ draft, errors, onChange, onSubmit }: { draft: NfcTag; errors: string[]; onChange: (patch: Partial<NfcTag>) => void; onSubmit: () => void }) {
  const errorRef = useRef<HTMLDivElement>(null);
  const { objects } = useDemo();
  // the managed objects: only active ones are offered, plus the one already linked
  const objectOptions = objects.filter((object) => object.status === "啟用" || object.id === draft.objectId);
  useEffect(() => { if (errors.length) errorRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" }); }, [errors]);
  const isNew = !draft.id;
  const toNumber = (value: string) => value === "" ? null : Number(value);
  const setPart = (key: keyof NfcAddressParts, value: string) => { const addressParts = { ...draft.addressParts, [key]: value }; onChange({ addressParts, address: composeAddress(addressParts) }); };
  const pick = (point: { lat: number; lng: number }) => {
    const [x, y] = lngLatToPx([point.lng, point.lat]); const located = reverseGeocodeParts(x, y);
    onChange(located.parts ? { ...point, addressParts: located.parts, address: composeAddress(located.parts) } : point);
  };
  const submit = (event: FormEvent) => { event.preventDefault(); onSubmit(); };
  return <form className="group-editor-form" onSubmit={submit}>
    {errors.length > 0 && <div ref={errorRef} className="nfc-editor-error" role="alert">{errors.join(" ")}</div>}
    <section className="group-editor-section"><header><h3>標籤資料</h3></header><div className="group-editor-grid">
      <Field label="標籤編號" required hint="唯一，儲存後不可修改"><input value={draft.code} disabled={!isNew} onChange={(event) => onChange({ code: event.target.value })} placeholder="例如 NFC-0020" /></Field>
      <Field label="標籤名稱" required><input value={draft.name} maxLength={50} onChange={(event) => onChange({ name: event.target.value })} placeholder="請輸入標籤名稱" /></Field>
      <Field label="晶片 UID" required hint="唯一；可由 App 掃描回填"><input value={draft.uid} onChange={(event) => onChange({ uid: event.target.value })} placeholder="例如 04:3A:7F:B2:1C:5E:80" /></Field>
      <Field label="所屬部門" required><Select ariaLabel="所屬部門" value={draft.department} onChange={(department) => onChange({ department })}><option value="">請選擇部門</option><DepartmentOptions /></Select></Field>
      <Field label="管理群組" required hint="只列管理群組；綁定後由該群組管理此標籤"><Select ariaLabel="管理群組" value={draft.adminGroup} onChange={(adminGroup) => onChange({ adminGroup })}><option value="">請選擇管理群組</option>{managementGroups.map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}</Select></Field>
      <Field label="關聯對象" hint="掃描此標籤可作輔助到場紀錄，不作強制"><Select ariaLabel="關聯對象" value={draft.objectId ?? ""} onChange={(objectId) => onChange({ objectId: objectId || undefined })}><option value="">不關聯對象</option>{objectOptions.map((object) => <option key={object.id} value={object.id}>{object.code} · {object.name}</option>)}</Select></Field>
    </div></section>
    <section className="group-editor-section"><header><h3>位置資料</h3></header><div className="group-editor-grid">
      <div className="nfc-location-name"><Field label="名稱" required><input value={draft.facility} maxLength={100} onChange={(event) => onChange({ facility: event.target.value })} placeholder="請輸入名稱" /></Field></div>
      <div className="nfc-coordinate-row"><Field label="緯度" required><input type="number" step="0.000001" inputMode="decimal" value={draft.lat ?? ""} onChange={(event) => onChange({ lat: toNumber(event.target.value) })} placeholder="例如 22.211250" /></Field><Field label="經度" required><input type="number" step="0.000001" inputMode="decimal" value={draft.lng ?? ""} onChange={(event) => onChange({ lng: toNumber(event.target.value) })} placeholder="例如 113.555850" /></Field></div>
      <div className="field obj-address-parts"><span>結構化地址</span><div className="obj-parts-grid">
        <input aria-label="堂區" value={draft.addressParts.parish} onChange={(event) => setPart("parish", event.target.value)} placeholder="堂區" /><input aria-label="街道" value={draft.addressParts.street} onChange={(event) => setPart("street", event.target.value)} placeholder="街道" />
        <input aria-label="門牌" value={draft.addressParts.number} onChange={(event) => setPart("number", event.target.value)} placeholder="門牌" /><input aria-label="建築物" value={draft.addressParts.building} onChange={(event) => setPart("building", event.target.value)} placeholder="建築物" /></div>
        <small>填寫各部分會組成下方地址。</small></div>
      <Field label="地址" required hint="1–300 字，可直接修改"><input value={draft.address} maxLength={300} onChange={(event) => onChange({ address: event.target.value })} placeholder="請輸入地址" /></Field>
      <div className="field nfc-map-row"><span>地圖選點</span><NfcMapPicker lat={draft.lat} lng={draft.lng} onPick={pick} /></div>
    </div></section>
    <section className="group-editor-section"><header><h3>現場照片</h3></header><NfcPhotos photos={draft.photos} onChange={(photos) => onChange({ photos })} /></section>
    <section className="group-editor-section"><header><h3>標籤狀態</h3></header><div className="group-editor-status"><div className="bip-field"><span>狀態</span><div className="switch-row"><label className="switch-control"><input type="checkbox" aria-label="標籤生效" checked={draft.status === "生效"} onChange={(event) => onChange({ status: event.target.checked ? "生效" : "失效" })} /><span className="switch" /></label></div></div><div className="group-editor-count"><span>累計掃描次數</span><strong>{draft.scanCount}</strong></div></div></section>
    <button type="submit" className="sr-only">儲存</button>
  </form>;
}

export function NfcTagsPage() {
  const { objects: managedObjects } = useDemo();
  const objectName = (id?: string) => managedObjects.find((object) => object.id === id)?.name ?? "—";
  const { showToast } = useToast();
  const [tags, setTags] = useState<NfcTag[]>(() => structuredClone(initialNfcTags));
  const [filters, setFilters] = useState<NfcFilters>(emptyFilters);
  const [page, setPage] = useState(1); const [pageSize, setPageSize] = useState(15);
  const [draft, setDraft] = useState<NfcTag | null>(null); const [errors, setErrors] = useState<string[]>([]);
  const filter = (key: keyof NfcFilters, value: string) => { setFilters((current) => ({ ...current, [key]: value })); setPage(1); };
  const rows = tags.filter((tag) => contains(tag.code, filters.code) && contains(tag.name, filters.name) && contains(tag.uid, filters.uid) && contains(tag.address, filters.address)
    && (!filters.group || tag.adminGroup === filters.group) && (!filters.department || tag.department === filters.department) && (!filters.status || tag.status === filters.status));
  const open = (tag: NfcTag) => { setDraft(structuredClone(tag)); setErrors([]); };
  const change = (patch: Partial<NfcTag>) => { setDraft((current) => current ? { ...current, ...patch } : current); setErrors([]); };
  const save = () => {
    if (!draft) return;
    const tag: NfcTag = { ...draft, code: draft.code.trim(), name: draft.name.trim(), uid: draft.uid.trim().toUpperCase(), facility: draft.facility.trim(), address: draft.address.trim() };
    const found = validateNfcTag(tag, tags, managementGroupIds);
    if (found.length) { setErrors(found); return; }
    const saved: NfcTag = { ...tag, id: tag.id || `NFC-TAG-${Date.now()}`, updatedBy: "陳家朗", updatedAt: nowText() };
    setTags((current) => current.some((item) => item.id === saved.id) ? current.map((item) => item.id === saved.id ? saved : item) : [saved, ...current]);
    setDraft(null);
    showToast(tag.id ? "NFC 標籤已更新" : "NFC 標籤已建立");
  };
  const columns: Column<NfcTag>[] = ([
    { key: "code", title: "編號", width: 120 },
    { key: "name", title: "名稱", width: 200 },
    { key: "uid", title: "晶片 UID", width: 190, render: (tag) => <span className="nfc-uid">{tag.uid}</span> },
    { key: "department", title: "所屬部門", width: 115 },
    { key: "facility", title: "設施名稱", width: 170 },
    { key: "address", title: "地址", width: 240 },
    { key: "lat", title: "緯度", width: 110, render: (tag) => coordinate(tag.lat), sortValue: (tag) => tag.lat ?? 0 },
    { key: "lng", title: "經度", width: 120, render: (tag) => coordinate(tag.lng), sortValue: (tag) => tag.lng ?? 0 },
    { key: "adminGroup", title: "管理群組", width: 135, render: (tag) => groupName(tag.adminGroup), sortValue: (tag) => groupName(tag.adminGroup) },
    { key: "objectId", title: "關聯對象", width: 170, render: (tag) => objectName(tag.objectId), sortValue: (tag) => objectName(tag.objectId) },
    { key: "photos", title: "現場照片", width: 95, render: (tag) => `${tag.photos.length} 張`, sortValue: (tag) => tag.photos.length },
    { key: "status", title: "狀態", width: 85, render: (tag) => <StatusTag tone={tag.status === "生效" ? "success" : "neutral"}>{tag.status}</StatusTag> },
    { key: "updatedBy", title: "更新人", width: 100 },
    { key: "updatedAt", title: "更新時間", width: 160 },
  ] satisfies Column<NfcTag>[]).map((column) => ({ ...column, sortable: true }));
  return <div className="page-content nfc-tags-page">
    <PageHeader title="NFC 標籤" actions={<><Button icon={<CloudUploadOutlined />}>匯入</Button><Button icon={<ExportOutlined />}>匯出</Button><Button variant="primary" icon={<PlusOutlined />} onClick={() => open(newNfcTag())}>新增標籤</Button></>} />
    <section className="panel list-panel nfc-list-panel">
      <div className="filter-bar nfc-filter-bar">
        <label className="filter-field"><span>編號</span><input aria-label="編號" value={filters.code} onChange={(event) => filter("code", event.target.value)} placeholder="請輸入編號" /></label>
        <label className="filter-field"><span>名稱</span><input aria-label="名稱" value={filters.name} onChange={(event) => filter("name", event.target.value)} placeholder="請輸入名稱" /></label>
        <label className="filter-field"><span>晶片 UID</span><input aria-label="晶片 UID" value={filters.uid} onChange={(event) => filter("uid", event.target.value)} placeholder="請輸入晶片 UID" /></label>
        <label className="filter-field"><span>地址</span><input aria-label="地址" value={filters.address} onChange={(event) => filter("address", event.target.value)} placeholder="請輸入地址" /></label>
        <label className="filter-field"><span>管理群組</span><Select ariaLabel="管理群組" value={filters.group} onChange={(value) => filter("group", value)}><option value="">全部管理群組</option>{managementGroups.map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}</Select></label>
        <label className="filter-field"><span>所屬部門</span><Select ariaLabel="所屬部門" value={filters.department} onChange={(value) => filter("department", value)}><option value="">全部部門</option><DepartmentOptions /></Select></label>
        <label className="filter-field"><span>狀態</span><Select ariaLabel="狀態" value={filters.status} onChange={(value) => filter("status", value)}><option value="">全部狀態</option><option>生效</option><option>失效</option></Select></label>
        <div className="user-filter-actions"><Button variant="text" icon={<ReloadOutlined />} onClick={() => { setFilters(emptyFilters); setPage(1); }}>重設</Button></div>
      </div>
      <DenseTable rows={rows} columns={columns} stickyActions actionTitle="操作" page={Math.min(page, Math.max(1, Math.ceil(rows.length / pageSize)))} pageSize={pageSize} onSort={() => setPage(1)} renderActions={(tag) => <button className="table-action-button" aria-label={`編輯 ${tag.name}`} onClick={() => open(tag)}><EditOutlined />編輯</button>} />
      <Pagination total={rows.length} page={page} pageSize={pageSize} onPageChange={setPage} onPageSizeChange={(size) => { setPageSize(size); setPage(1); }} />
    </section>
    <FormDrawer open={!!draft} title={draft?.id ? "編輯 NFC 標籤" : "新增 NFC 標籤"} subtitle={draft?.id ? draft.code : undefined} className="nfc-editor-drawer" onClose={() => setDraft(null)} onSubmit={save}>
      {draft && <NfcEditor draft={draft} errors={errors} onChange={change} onSubmit={save} />}
    </FormDrawer>
  </div>;
}
