// Event record logic. Kept import-free so tests can transpile and run it directly.

export type FollowStatus = "無需跟進" | "跟進中" | "已完成";
export interface EventFieldDef { name: string; kind: "BOOL" | "SINGLE" | "TEXT"; options?: string[]; required: boolean }
export interface EventChange { time: string; operator: string; action: string; detail: string }
export interface EventDraft {
  type: string; description: string; address: string; x?: number; y?: number; status: FollowStatus;
  followAt?: string; custom: Record<string, string>; planId?: string; attachmentCount?: number;
}
export interface EventIssue { key: string; message: string }

export const MAP_PX = { width: 1536, height: 1024 };
export const DESCRIPTION_MAX = 1000;
export const followStatuses: FollowStatus[] = ["無需跟進", "跟進中", "已完成"];

/** Type-specific fields: the top-level type's first, then the leaf's own (as in the App's event form). */
export function fieldsFor(type: string, defsByType: Record<string, EventFieldDef[]>): EventFieldDef[] {
  if (!type) return [];
  const [top] = type.split("／");
  return [...(defsByType[top] ?? []), ...(type.includes("／") ? defsByType[type] ?? [] : [])];
}

const normalizeTime = (value: string) => value.replace("T", " ").slice(0, 16);

/** `now` is "YYYY-MM-DD HH:mm". The not-earlier-than-now rule applies to new events only. */
export function validateEvent(draft: EventDraft, defs: EventFieldDef[], leafTypes: string[], now: string, isNew: boolean): EventIssue[] {
  const issues: EventIssue[] = [];
  const add = (key: string, message: string) => issues.push({ key, message });
  if (!draft.type) add("type", "請選擇事件類型（只可選末級）。");
  else if (!leafTypes.includes(draft.type)) add("type", "事件類型只可選末級類型。");
  const description = draft.description.trim();
  if (!description) add("description", "請輸入描述。");
  else if ([...description].length > DESCRIPTION_MAX) add("description", `描述不可超過 ${DESCRIPTION_MAX} 字。`);
  if (!draft.address.trim()) add("address", "請輸入地址。");
  if (draft.x === undefined || draft.y === undefined) add("location", "請在地圖上選取事件位置。");
  else if (draft.x < 0 || draft.y < 0 || draft.x > MAP_PX.width || draft.y > MAP_PX.height) add("location", "事件位置超出地圖範圍。");
  if (draft.status === "跟進中") {
    if (!draft.followAt) add("followAt", "跟進中時必須填寫預計跟進時間。");
    else if (isNew && normalizeTime(draft.followAt) < now) add("followAt", "預計跟進時間不可早於建立時間。");
  }
  defs.forEach((def) => {
    const value = draft.custom[def.name];
    if (def.required && !value?.trim()) add(`custom-${def.name}`, `請填寫「${def.name}」。`);
    else if (value && def.kind !== "TEXT" && !(def.options ?? []).includes(value)) add(`custom-${def.name}`, `「${def.name}」的值不在可選範圍內。`);
  });
  return issues;
}

/** Human-readable change lines for the log; empty when nothing changed. */
export function diffEvent(before: EventDraft, after: EventDraft): string[] {
  const lines: string[] = [];
  const same = (a: unknown, b: unknown) => (a ?? "") === (b ?? "");
  const check = (label: string, a: unknown, b: unknown) => { if (!same(a, b)) lines.push(`${label}：${a || "—"} → ${b || "—"}`); };
  check("事件類型", before.type, after.type);
  check("描述", before.description, after.description);
  check("地址", before.address, after.address);
  if (!same(before.x, after.x) || !same(before.y, after.y)) lines.push("位置已更改");
  check("跟進狀態", before.status, after.status);
  check("預計跟進時間", before.followAt, after.followAt);
  check("所屬計劃", before.planId, after.planId);
  [...new Set([...Object.keys(before.custom), ...Object.keys(after.custom)])].forEach((name) => check(name, before.custom[name], after.custom[name]));
  if ((before.attachmentCount ?? 0) !== (after.attachmentCount ?? 0)) lines.push(`附件數：${before.attachmentCount ?? 0} → ${after.attachmentCount ?? 0}`);
  return lines;
}

/** Prompts only: the follow-up status is registered by a person and never changed automatically. */
export function followPrompts(event: { status: FollowStatus }, works: { status: string }[]): { suggestInProgress: boolean; suggestDone: boolean } {
  return { suggestInProgress: event.status === "無需跟進", suggestDone: event.status !== "已完成" && works.length > 0 && works.every((work) => work.status === "已關閉") };
}

export function shouldConfirmTypeChange(custom: Record<string, string>, oldType: string, newType: string): boolean {
  return !!oldType && oldType !== newType && Object.values(custom).some((value) => !!value);
}
