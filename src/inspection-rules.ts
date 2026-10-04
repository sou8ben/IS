// Inspection record logic. Kept import-free so tests can transpile and run it directly.

export type InputKind = "BOOL" | "SINGLE" | "MULTI" | "TEXT" | "SIGNATURE";
export type InspectionStatus = "未完成" | "已完成";
export type InspectionSource = "計劃" | "獨立" | "補入";

export interface ItemSnapshot {
  key: string; itemId?: string; name: string; itemType: string; kind: InputKind;
  options?: string[]; abnormal?: string[]; required: boolean; minAttachments: number; maxLength?: number;
}
/** Template copy taken when the inspection is created; later template edits never change it. */
export interface TemplateSnapshot {
  templateId: string; name: string; inspectionType: string; locationCheck: boolean; validDistance: number;
  checkOn: string[]; items: ItemSnapshot[]; takenAt: string;
}
export interface AttachmentRef { id: string; name: string; size: number; kind: "image" | "file"; src?: string }
export interface ItemResultData { value?: string | string[]; remark?: string; signature?: string; attachments: AttachmentRef[] }
export type ResultMap = Record<string, ItemResultData>;
export interface InspectionChange { time: string; operator: string; action: string; detail: string }

/**
 * origin 後台: a full record owned by the back office.
 * origin App: only an overlay (void flag, supplements, change log) on an inspection that lives in the App.
 */
export interface InspectionRecord {
  id: string; origin: "後台" | "App"; planId?: string; objectId: string; templateId: string; snapshot: TemplateSnapshot;
  seq: number; status: InspectionStatus; source: InspectionSource; inspector?: string; startedAt?: string; submittedAt?: string;
  results: ResultMap; location?: { passed: boolean; distance: number; accuracy: number; nfc?: string };
  voided?: boolean; voidReason?: string; changes: InspectionChange[]; createdBy?: string; createdAt?: string;
}
export interface ResultIssue { key: string; message: string }

export const ATTACH_MAX_PER_ITEM = 6;
export const ATTACH_MAX_FILE_BYTES = 10 * 1024 * 1024;
/** Total characters of inline image data allowed per record, to keep browser storage safe. */
export const ATTACH_BUDGET_CHARS = 1_500_000;
export const kindLabels: Record<InputKind, string> = { BOOL: "是非", SINGLE: "單選", MULTI: "多選", TEXT: "輸入框", SIGNATURE: "簽名" };

export const emptyResult = (): ItemResultData => ({ attachments: [] });

export function snapshotTemplate(template: { id: string; name: string; inspectionType: string; locationCheck: boolean; validDistance: number; checkOn: string[]; items: ItemSnapshot[] }, takenAt: string): TemplateSnapshot {
  return {
    templateId: template.id, name: template.name, inspectionType: template.inspectionType, locationCheck: template.locationCheck, validDistance: template.validDistance, checkOn: [...template.checkOn], takenAt,
    items: template.items.map((item) => ({ key: item.key, ...(item.itemId ? { itemId: item.itemId } : {}), name: item.name, itemType: item.itemType, kind: item.kind, options: item.options && [...item.options], abnormal: item.abnormal && [...item.abnormal], required: item.required, minAttachments: item.minAttachments, maxLength: item.maxLength })),
  };
}

export function isAbnormal(item: ItemSnapshot, value: ItemResultData["value"]): boolean {
  if (!item.abnormal || value === undefined) return false;
  return Array.isArray(value) ? value.some((option) => item.abnormal!.includes(option)) : item.abnormal.includes(value);
}

export function isFilled(item: ItemSnapshot, result?: ItemResultData): boolean {
  if (!result) return false;
  if (item.kind === "SIGNATURE") return !!result.signature;
  const value = result.value;
  if (value === undefined) return false;
  return Array.isArray(value) ? value.length > 0 : value.trim() !== "";
}

export function itemIssues(item: ItemSnapshot, result?: ItemResultData): string[] {
  const issues: string[] = [];
  if (item.required && !isFilled(item, result)) issues.push(`『${item.name}』為必填`);
  const count = result?.attachments.length ?? 0;
  if (count < item.minAttachments) issues.push(`『${item.name}』需至少 ${item.minAttachments} 個附件（目前 ${count} 個）`);
  if (item.kind === "TEXT" && item.maxLength && typeof result?.value === "string" && [...result.value].length > item.maxLength) issues.push(`『${item.name}』不可超過 ${item.maxLength} 字`);
  return issues;
}

export function validateResults(snapshot: TemplateSnapshot, results: ResultMap): ResultIssue[] {
  return snapshot.items.flatMap((item) => itemIssues(item, results[item.key]).map((message) => ({ key: item.key, message })));
}

export function itemState(item: ItemSnapshot, result?: ItemResultData): "異常" | "已填" | "待填" {
  if (!isFilled(item, result)) return "待填";
  return isAbnormal(item, result?.value) ? "異常" : "已填";
}

/** 待填寫 until submitted; afterwards 異常 when any item holds an abnormal value. */
export function resultOf(record: Pick<InspectionRecord, "status" | "snapshot" | "results">): "正常" | "異常" | "待填寫" {
  if (record.status !== "已完成") return "待填寫";
  return record.snapshot.items.some((item) => isAbnormal(item, record.results[item.key]?.value)) ? "異常" : "正常";
}

export function attachmentChars(results: ResultMap): number {
  return Object.values(results).reduce((sum, result) => sum + result.attachments.reduce((inner, file) => inner + (file.src?.startsWith("data:") ? file.src.length : 0), 0), 0);
}

export function saveDraft(record: InspectionRecord, results: ResultMap): InspectionRecord {
  return record.status === "未完成" ? { ...record, results } : record;
}

export function submitRecord(record: InspectionRecord, results: ResultMap, time: string, operator: string): { errors: ResultIssue[]; record?: InspectionRecord } {
  if (record.voided) return { errors: [{ key: "", message: "已作廢的巡查不可提交，請先解除作廢。" }] };
  if (record.status !== "未完成") return { errors: [{ key: "", message: "巡查已完成，只可補入資料。" }] };
  const errors = validateResults(record.snapshot, results);
  if (errors.length) return { errors };
  return { errors, record: { ...record, results, status: "已完成", startedAt: record.startedAt ?? time, submittedAt: time, inspector: record.inspector ?? operator, changes: [...record.changes, { time, operator, action: "提交巡查", detail: "全部必填項目及附件要求已符合，巡查已完成" }] } };
}

/** Result map `extra` laid over `base`: values only fill empty items, attachments and remarks are appended. */
export function mergeResults(snapshot: TemplateSnapshot, base: ResultMap, extra: ResultMap): ResultMap {
  const out: ResultMap = { ...base };
  for (const item of snapshot.items) {
    const add = extra[item.key]; if (!add) continue;
    const cur = out[item.key] ?? emptyResult();
    const fill = !isFilled(item, cur) && isFilled(item, add);
    out[item.key] = { ...cur, ...(fill ? { value: add.value, signature: add.signature } : {}), remark: [cur.remark, add.remark].filter(Boolean).join("；") || undefined, attachments: [...cur.attachments, ...add.attachments] };
  }
  return out;
}

/**
 * Supplements a completed inspection. Only adds: fills empty items, appends attachments and remarks.
 * `stored` is the record kept in the store (a full record, or the overlay of an App inspection); `current` is the resolved view.
 */
export function supplementRecord(stored: InspectionRecord, current: InspectionRecord, additions: ResultMap, reason: string, operator: string, time: string): { error?: string; record?: InspectionRecord } {
  if (current.status !== "已完成") return { error: "只有已完成的巡查可補入資料。" };
  if (current.voided) return { error: "已作廢的巡查不可補入，請先解除作廢。" };
  if (!reason.trim()) return { error: "請填寫補入原因。" };
  const effective: ResultMap = {};
  for (const item of current.snapshot.items) {
    const add = additions[item.key]; if (!add) continue;
    const fill = !isFilled(item, current.results[item.key]) && isFilled(item, add);
    if (!fill && !add.attachments.length && !add.remark?.trim()) continue;
    effective[item.key] = { attachments: add.attachments, remark: add.remark?.trim() || undefined, ...(fill ? { value: add.value, signature: add.signature } : {}) };
  }
  const touched = Object.keys(effective);
  if (!touched.length) return { error: "沒有可補入的內容：請填寫尚未填寫的項目，或加入附件／備註。" };
  const names = touched.map((key) => current.snapshot.items.find((item) => item.key === key)?.name ?? key).join("、");
  return { record: { ...stored, results: mergeResults(current.snapshot, stored.results, effective), changes: [...stored.changes, { time, operator, action: "補入", detail: `${names}；原因：${reason.trim()}` }] } };
}

export function setVoided(record: InspectionRecord, voided: boolean, reason: string, operator: string, time: string): { error?: string; record?: InspectionRecord } {
  if (!reason.trim()) return { error: voided ? "請填寫作廢原因。" : "請填寫解除作廢原因。" };
  if (!!record.voided === voided) return { error: voided ? "此巡查已作廢。" : "此巡查並未作廢。" };
  return { record: { ...record, voided, voidReason: voided ? reason.trim() : undefined, changes: [...record.changes, { time, operator, action: voided ? "作廢" : "解除作廢", detail: reason.trim() }] } };
}

/** Records that statistics may count: submitted and not voided. */
export const countable = <T extends Pick<InspectionRecord, "status" | "voided">>(records: T[]): T[] => records.filter((record) => record.status === "已完成" && !record.voided);

/** Demo inspector track approaching the object, ending at `endTime` (HH:mm or a full date time). */
export function approachTrack(target: [number, number], endTime: string, steps = 6): [number, number, string][] {
  const match = endTime.match(/(\d{1,2}):(\d{2})/);
  const end = match ? Number(match[1]) * 60 + Number(match[2]) : 9 * 60;
  const text = (minutes: number) => `${String(Math.floor(minutes / 60) % 24).padStart(2, "0")}:${String(((minutes % 60) + 60) % 60).padStart(2, "0")}`;
  return Array.from({ length: steps + 1 }, (_, index) => {
    const left = steps - index;
    return [Math.round(target[0] - left * 9), Math.round(target[1] + left * 6), text(end - left * 2)];
  });
}
