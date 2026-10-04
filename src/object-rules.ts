// Inspection object logic. Pure: depends only on the pure grid geometry module, so tests can run it directly.
import { lngLatToPx, locateGridRecord, MAP_PX, validateObjectShape, type GridRecord, type ObjectShape } from "./grid-rules";
import type { AttachmentRef } from "./inspection-rules";

export type GridAssignMode = "手動" | "自動";
export type ObjectStatus = "啟用" | "停用";
export interface AddressParts { parish: string; street: string; number: string; building: string }
/** One responsible group of the object: a 群組管理 category and a group in it. */
export interface WorkGroupRow { category: string; group: string }
export interface ManagedObject {
  id: string; inspectionType: string; gridId: string | null; gridAssignMode: GridAssignMode; code: string; name: string;
  address: string; addressParts?: AddressParts; latitude: number; longitude: number; geojson: ObjectShape | null;
  attachments: AttachmentRef[]; workGroups: WorkGroupRow[]; status: ObjectStatus;
  /** Seed-only values the App's demo relies on. */ nfc?: string; demoDistance?: number;
}
export interface ObjectIssue { key: string; message: string }

export const CODE_MAX = 32; export const NAME_MAX = 100; export const ADDRESS_MAX = 300; export const ATTACH_MAX = 10;
const CODE_PATTERN = /^[A-Za-z0-9_-]+$/;
const lower = (text: string) => text.trim().toLowerCase();

export function composeAddress(parts: AddressParts): string {
  const street = `${parts.street.trim()}${parts.number.trim() ? ` ${parts.number.trim()} 號` : ""}`.trim();
  return [parts.parish.trim(), street, parts.building.trim()].filter(Boolean).join(" ");
}

export function nextObjectCode(codes: string[]): string {
  const max = codes.reduce((value, code) => { const match = code.match(/^OBJ-(\d+)$/i); return match ? Math.max(value, Number(match[1])) : value; }, 0);
  return `OBJ-${String(max + 1).padStart(3, "0")}`;
}
export const nextObjectId = (ids: string[]) => `OBJ-N${String(Math.max(0, ...ids.map((id) => Number(id.match(/^OBJ-N(\d+)$/)?.[1] ?? 0))) + 1).padStart(4, "0")}`;
export const pxOf = (object: Pick<ManagedObject, "latitude" | "longitude">) => lngLatToPx([object.longitude, object.latitude]);

// ---- 網格 ----
/** 自動: the first enabled grid containing the position; 手動: the grid chosen by the user. */
export function assignGrid(object: Pick<ManagedObject, "gridAssignMode" | "gridId" | "latitude" | "longitude">, grids: GridRecord[]): string | null {
  if (object.gridAssignMode === "手動") return object.gridId;
  const [x, y] = pxOf(object);
  return locateGridRecord(grids, x, y)?.id ?? null;
}
/** 自動 objects whose stored grid differs from the one their position now falls in; 手動 objects are skipped. */
export function reassignObjectGrids(objects: ManagedObject[], grids: GridRecord[]): { id: string; from: string | null; to: string | null }[] {
  return objects.flatMap((object) => { if (object.gridAssignMode !== "自動") return []; const to = assignGrid(object, grids); return to !== object.gridId ? [{ id: object.id, from: object.gridId, to }] : []; });
}

/** The groups the rows can use: 群組管理's list, by category. */
export interface GroupOption { name: string; category: string }
export const DISPATCH_CATEGORY = "執行群組";
/** Category and group required, the group must belong to the category, no row twice, and at most one execution group (the one dispatch uses). */
export function validateWorkGroups(rows: WorkGroupRow[], groups: GroupOption[]): string[] {
  const errors: string[] = []; const seen = new Set<string>(); const categories = new Set(groups.map((group) => group.category));
  rows.forEach((row, index) => {
    const label = `第 ${index + 1} 行`;
    if (!row.category) errors.push(`${label}：請選擇群組分類。`);
    else if (!categories.has(row.category)) errors.push(`${label}：群組分類不存在。`);
    if (!row.group.trim()) errors.push(`${label}：請選擇群組。`);
    else if (row.category && !groups.some((group) => group.name === row.group && group.category === row.category)) errors.push(`${label}：「${row.group}」不屬於${row.category || "所選分類"}。`);
    const key = `${row.category}|${row.group}`;
    if (row.category && row.group && seen.has(key)) errors.push(`${label}：「${row.group}」重複。`);
    seen.add(key);
  });
  if (rows.filter((row) => row.category === DISPATCH_CATEGORY).length > 1) errors.push(`${DISPATCH_CATEGORY}只可設定一個，派工時使用。`);
  return errors;
}
/** Saved rows of the older shape (work type + execution group) become 執行群組 rows; duplicates and extra execution groups are dropped. */
export function normalizeWorkGroups(rows: ({ category?: string; group: string; workType?: string })[], groups: GroupOption[]): WorkGroupRow[] {
  const out: WorkGroupRow[] = [];
  rows.forEach((row) => {
    const category = row.category ?? groups.find((group) => group.name === row.group)?.category ?? DISPATCH_CATEGORY;
    if (out.some((item) => item.category === category && (item.group === row.group || category === DISPATCH_CATEGORY))) return;
    out.push({ category, group: row.group });
  });
  return out;
}
/** The object's execution group, which dispatch uses for all of its works. */
export const dispatchGroupOf = (object: Pick<ManagedObject, "workGroups">) => object.workGroups.find((row) => row.category === DISPATCH_CATEGORY)?.group;

// ---- 對象 ----
export interface ObjectContext { all: ManagedObject[]; inspectionTypes: string[]; grids: GridRecord[]; groups: GroupOption[]; editingId?: string }

/** Validates an object; the returned record has its auto code and (in 自動 mode) its grid filled in. */
export function validateObject(draft: ManagedObject, ctx: ObjectContext): { errors: ObjectIssue[]; record?: ManagedObject } {
  const errors: ObjectIssue[] = []; const add = (key: string, message: string) => errors.push({ key, message });
  const others = ctx.all.filter((object) => object.id !== ctx.editingId);
  const code = draft.code.trim(); const name = draft.name.trim(); const address = draft.address.trim();
  if (!draft.inspectionType) add("type", "請選擇巡查類型。"); else if (!ctx.inspectionTypes.includes(draft.inspectionType)) add("type", "巡查類型不存在。");
  if (code) {
    if (code.length > CODE_MAX) add("code", `對象編號不可超過 ${CODE_MAX} 字。`);
    else if (!CODE_PATTERN.test(code)) add("code", "對象編號只可使用英文字母、數字、- 及 _。");
    else if (others.some((object) => lower(object.code) === lower(code))) add("code", `對象編號「${code}」已存在。`);
  }
  if (!name) add("name", "請輸入對象名稱。"); else if ([...name].length > NAME_MAX) add("name", `對象名稱不可超過 ${NAME_MAX} 字。`);
  if (!address) add("address", "請輸入地址。"); else if ([...address].length > ADDRESS_MAX) add("address", `地址不可超過 ${ADDRESS_MAX} 字。`);
  if (!Number.isFinite(draft.latitude) || !Number.isFinite(draft.longitude)) add("location", "請在地圖上選取對象位置。");
  else { const [x, y] = pxOf(draft); if (x < 0 || y < 0 || x > MAP_PX.width || y > MAP_PX.height) add("location", "對象位置超出地圖範圍。"); }
  let geojson: ObjectShape | null = null;
  if (draft.geojson) { const checked = validateObjectShape(draft.geojson); checked.errors.forEach((message) => add("geojson", message)); geojson = checked.shape ?? null; }
  if (draft.gridAssignMode === "手動" && !draft.gridId) add("grid", "手動指定網格時請選擇網格。");
  else if (draft.gridAssignMode === "手動" && !ctx.grids.some((grid) => grid.id === draft.gridId)) add("grid", "所選網格不存在。");
  if (draft.attachments.length > ATTACH_MAX) add("attachments", `附件最多 ${ATTACH_MAX} 個。`);
  validateWorkGroups(draft.workGroups, ctx.groups).forEach((message) => add("workGroups", message));
  if (errors.length) return { errors };
  const record: ManagedObject = { ...draft, code: code || nextObjectCode(ctx.all.map((object) => object.code)), name, address, geojson };
  return { errors, record: { ...record, gridId: assignGrid(record, ctx.grids) } };
}

// ---- 關聯 ----
export interface TemplateLike { id: string; name: string; inspectionType: string; status: string; objects: { objectId: string }[] }
/** Templates of the object's inspection type that list it, or list no objects at all (meaning every object of the type). */
export function templatesOfObject<T extends TemplateLike>(templates: T[], object: Pick<ManagedObject, "id" | "inspectionType">): { template: T; scope: "指定對象" | "類型下全部對象" }[] {
  return templates.filter((template) => template.inspectionType === object.inspectionType && (!template.objects.length || template.objects.some((entry) => entry.objectId === object.id)))
    .map((template) => ({ template, scope: template.objects.length ? "指定對象" as const : "類型下全部對象" as const }));
}
