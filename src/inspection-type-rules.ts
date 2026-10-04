// Inspection type logic. Kept import-free so tests can transpile and run it directly.

export type TypeStatus = "生效" | "失效";
export interface InspectionTypeRecord {
  id: string; name: string; status: TypeStatus;
  /** 巡查 - 按步驟巡查 */
  stepByStep: boolean;
  /** 工作 - 嚴格工作流程 */
  strictWorkflow: boolean;
  /** 工作 - 新建工作時需要定位 */
  requireLocation: boolean;
  /** 工作 - 預設查看群組 (group id, blank = none) */
  viewGroup: string;
  /** 工作 - 預設執行群組 (group id, blank = none) */
  executeGroup: string;
  updatedBy: string; updatedAt: string;
}
export const NAME_MAX = 50;
const lower = (text: string) => text.trim().toLowerCase();

export interface TypeGroupOptions { viewGroups: string[]; executeGroups: string[] }
/** Name 1–50 characters and unique; a chosen default group must be one the dropdown offers. */
export function validateType(draft: { name: string; viewGroup?: string; executeGroup?: string }, existing: InspectionTypeRecord[], options: TypeGroupOptions, editingId?: string): string[] {
  const errors: string[] = []; const name = draft.name.trim();
  if (!name) errors.push("請輸入類型名稱。");
  else if ([...name].length > NAME_MAX) errors.push(`類型名稱不可超過 ${NAME_MAX} 字。`);
  else if (existing.some((type) => type.id !== editingId && lower(type.name) === lower(name))) errors.push(`類型名稱「${name}」已存在。`);
  if (draft.viewGroup && !options.viewGroups.includes(draft.viewGroup)) errors.push("預設工作查看群組不存在。");
  if (draft.executeGroup && !options.executeGroups.includes(draft.executeGroup)) errors.push("預設工作執行群組必須是執行群組。");
  return errors;
}

export interface TypeUsage { objects: number; activeObjects: number; templates: number; activeTemplates: number; items: number }
const isActive = (status: string) => status === "啟用" || status === "生效";
export function usageOf(name: string, objects: { inspectionType: string; status: string }[], templates: { inspectionType: string; status: string }[], itemCount: number): TypeUsage {
  const mine = <T extends { inspectionType: string }>(list: T[]) => list.filter((entry) => entry.inspectionType === name);
  return { objects: mine(objects).length, activeObjects: mine(objects).filter((object) => isActive(object.status)).length, templates: mine(templates).length, activeTemplates: mine(templates).filter((template) => isActive(template.status)).length, items: itemCount };
}

/** The name can change only while nothing uses the type. */
export const canRename = (usage: TypeUsage) => usage.objects + usage.templates + usage.items === 0;
export function renameBlockReason(usage: TypeUsage): string | null {
  if (canRename(usage)) return null;
  const parts = [usage.objects && `${usage.objects} 個對象`, usage.templates && `${usage.templates} 個巡查模板`, usage.items && `${usage.items} 個巡查項目`].filter(Boolean);
  return `此類型已有 ${parts.join("、")} 使用，名稱不可修改；如不再使用請改為失效。`;
}
/** A type cannot become 失效 while it has active objects or templates. */
export function deactivationBlock(usage: TypeUsage): string | null {
  if (!usage.activeObjects && !usage.activeTemplates) return null;
  const parts = [usage.activeObjects && `${usage.activeObjects} 個啟用中的對象`, usage.activeTemplates && `${usage.activeTemplates} 個生效中的巡查模板`].filter(Boolean);
  return `此類型仍有 ${parts.join("及 ")}，請先將它們停用／失效後，再將類型設為失效。`;
}

export const nextTypeId = (ids: string[]) => String(Math.max(0, ...ids.map((id) => Number(id) || 0)) + 1);

/** Brings a stored type up to the current shape: 啟用／停用 become 生效／失效, new settings get defaults, the retired lead department is dropped. */
export function normalizeType(raw: Partial<Omit<InspectionTypeRecord, "status">> & { id: string; name: string; status?: string }): InspectionTypeRecord {
  const text = (value: unknown) => typeof value === "string" ? value : "";
  return {
    id: raw.id, name: raw.name, status: raw.status === "停用" || raw.status === "失效" ? "失效" : "生效",
    stepByStep: raw.stepByStep === true, strictWorkflow: raw.strictWorkflow === true, requireLocation: raw.requireLocation === true,
    viewGroup: text(raw.viewGroup), executeGroup: text(raw.executeGroup), updatedBy: text(raw.updatedBy), updatedAt: text(raw.updatedAt),
  };
}

export function seedTypes(): InspectionTypeRecord[] {
  // name, step by step, strict workflow, location on new work, view group, execution group, updated by, updated at
  const rows: [string, boolean, boolean, boolean, string, string, string, string][] = [
    ["公園設施巡查", false, true, true, "manage-facility", "exec-facility", "陳家朗", "2026-09-18 10:20"],
    ["街道環境巡查", true, false, true, "manage-sanitation", "exec-sanitation", "區詠珊", "2026-09-19 14:05"],
    ["綠化設施巡查", false, false, true, "manage-green", "exec-green", "陳家朗", "2026-09-21 09:40"],
    ["海濱設施巡查", false, true, false, "manage-facility", "exec-facility", "區詠珊", "2026-09-22 16:30"],
    ["公共廁所巡查", true, true, true, "manage-sanitation", "exec-sanitation", "陳家朗", "2026-09-24 11:15"],
  ];
  return rows.map(([name, stepByStep, strictWorkflow, requireLocation, viewGroup, executeGroup, updatedBy, updatedAt], index) => ({ id: String(index + 1), name, status: "生效", stepByStep, strictWorkflow, requireLocation, viewGroup, executeGroup, updatedBy, updatedAt }));
}
