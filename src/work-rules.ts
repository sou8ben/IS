// Work record logic. Kept import-free (types only) so tests can transpile and run it directly.
import type { AttachmentRef } from "./inspection-rules";

export type WorkStatus = "新建" | "跟進中" | "已解決" | "已關閉";
export type WorkAction = "跟進" | "解決" | "關閉" | "重啟" | "重新分派" | "留言" | "作廢" | "解除作廢";
export type Priority = "一般" | "緊急" | "特急";
export type SlaState = "正常" | "將逾時" | "已逾時";
export const MAP_PX = { width: 1536, height: 1024 };
export const METERS_PER_PX = 2.6;
export const DUPLICATE_RADIUS_M = 30;
export const UNASSIGNED_GROUP = "待人工分派";
export const DESCRIPTION_MAX = 1000;

export interface WorkLike {
  id: string; title: string; type: string; priority: Priority; status: WorkStatus; group: string; sla: SlaState; createdAt: string; address?: string;
  voided?: boolean; masterId?: string; dupGroup?: string; reopenCount?: number; handler?: string; creator?: string; description?: string; x?: number; y?: number; updatedAt?: string;
}
export interface WorkLogEntry {
  id: string; workId: string; action: string; from?: WorkStatus; to?: WorkStatus; operator: string; time: string; location: string; comment?: string; attachments?: AttachmentRef[];
}
export interface ActionPayload { comment?: string; group?: string; attachmentCount?: number; attachments?: AttachmentRef[] }
export interface ActionContext { id: string; time: string; operator: string; location?: string; minAttachments?: number; logs?: WorkLogEntry[]; scheme?: SlaScheme }

export const statusTarget: Partial<Record<WorkAction, WorkStatus>> = { "跟進": "跟進中", "解決": "已解決", "關閉": "已關閉", "重啟": "新建", "重新分派": "新建" };
export const topType = (type: string) => type.split("／")[0];

/** Actions that make sense for the work's state; disallowed ones are simply absent. */
export function allowedActions(work: Pick<WorkLike, "status" | "voided" | "masterId">): WorkAction[] {
  if (work.voided) return ["解除作廢"];
  const actions: WorkAction[] = [];
  if (work.status === "新建") actions.push("跟進", "重新分派");
  if (work.status === "跟進中") actions.push("解決", "重新分派");
  if (work.status === "已解決") actions.push("關閉", "重啟");
  if (work.status === "已關閉" && !work.masterId) actions.push("重啟");
  actions.push("留言", "作廢");
  return actions;
}

const required: Partial<Record<WorkAction, string>> = { "解決": "請填寫處理說明。", "關閉": "請填寫驗收意見。", "重啟": "請填寫重啟原因。", "重新分派": "請填寫重新分派原因。", "留言": "請輸入留言內容。", "作廢": "請填寫作廢原因。", "解除作廢": "請填寫解除作廢原因。" };

export function applyAction(work: WorkLike, action: WorkAction, payload: ActionPayload, ctx: ActionContext): { error?: string; patch?: Partial<WorkLike>; log?: WorkLogEntry } {
  if (!allowedActions(work).includes(action)) {
    if (work.voided) return { error: "已作廢的工作只可解除作廢。" };
    if (work.status === "已關閉" && action === "跟進") return { error: "工作已關閉，不可直接跟進，請先重啟。" };
    if (work.masterId && action === "重啟") return { error: "此工作已合併為重複工作，不可重啟。" };
    return { error: `「${work.status}」狀態下不可執行「${action}」。` };
  }
  const comment = payload.comment?.trim();
  if (required[action] && !comment) return { error: required[action] };
  if (action === "解決" && (payload.attachmentCount ?? 0) < (ctx.minAttachments ?? 0)) return { error: `此工作類型解決時須附至少 ${ctx.minAttachments} 個附件（目前 ${payload.attachmentCount ?? 0} 個）。` };
  if (action === "重新分派") {
    if (!payload.group) return { error: "請選擇新執行群組。" };
    if (payload.group === work.group) return { error: "新執行群組與目前相同。" };
  }
  const to = statusTarget[action];
  const patch: Partial<WorkLike> = { updatedAt: ctx.time };
  if (to) patch.status = to;
  if (action === "跟進" || action === "解決") patch.handler = ctx.operator;
  if (action === "重新分派") patch.group = payload.group;
  if (action === "重啟") patch.reopenCount = (work.reopenCount ?? 0) + 1;
  if (action === "作廢") patch.voided = true;
  if (action === "解除作廢") patch.voided = false;
  const log: WorkLogEntry = { id: ctx.id, workId: work.id, action, ...(to ? { from: work.status, to } : {}), operator: ctx.operator, time: ctx.time, location: ctx.location ?? "後台操作（無定位）", comment: action === "重新分派" ? `改派至 ${payload.group}；原因：${comment}` : comment, attachments: payload.attachments?.length ? payload.attachments : undefined };
  if (ctx.scheme) patch.sla = computeSla({ ...work, ...patch }, [...(ctx.logs ?? []), log], parseTime(ctx.time), ctx.scheme).overall;
  return { patch, log };
}

// ---- 時間 ----
export const parseTime = (text: string) => { const [date, time = "00:00"] = text.split(" "); const [y, m, d] = date.split("-").map(Number); const [h, min] = time.split(":").map(Number); return new Date(y, m - 1, d, h || 0, min || 0).getTime(); };
export function durationText(minutes: number): string {
  const m = Math.abs(Math.round(minutes)); const d = Math.floor(m / 1440); const h = Math.floor((m % 1440) / 60); const r = m % 60;
  return d ? `${d} 日 ${h} 小時` : h ? `${h} 小時 ${r} 分` : `${r} 分鐘`;
}

// ---- 服務承諾（按巡查類型、工作類型配置） ----
export interface SlaLimits { assign: number; firstReply: number; resolve: number; complete: number }
export interface SlaScheme { id: string; name: string; inspectionType?: string; topType?: string; limits: SlaLimits }
export const priorityFactor: Record<Priority, number> = { "一般": 1, "緊急": 0.5, "特急": 0.25 };
/** Ordered: the first matching rule wins; the last has no conditions. Limits are hours for a 一般 work. */
export const defaultSlaRules: SlaScheme[] = [
  { id: "SLA-01", name: "公園設施巡查 · 公共設施", inspectionType: "公園設施巡查", topType: "公共設施", limits: { assign: 2, firstReply: 2, resolve: 12, complete: 24 } },
  { id: "SLA-02", name: "公共設施", topType: "公共設施", limits: { assign: 4, firstReply: 4, resolve: 24, complete: 48 } },
  { id: "SLA-03", name: "環境衛生", topType: "環境衛生", limits: { assign: 2, firstReply: 2, resolve: 8, complete: 24 } },
  { id: "SLA-04", name: "綠化", topType: "綠化", limits: { assign: 8, firstReply: 8, resolve: 48, complete: 72 } },
  { id: "SLA-05", name: "道路設施", topType: "道路設施", limits: { assign: 4, firstReply: 4, resolve: 24, complete: 48 } },
  { id: "SLA-99", name: "默認", limits: { assign: 4, firstReply: 4, resolve: 24, complete: 48 } },
];
export function resolveScheme(rules: SlaScheme[], match: { topType: string; inspectionType?: string }): SlaScheme {
  return rules.find((rule) => (!rule.topType || rule.topType === match.topType) && (!rule.inspectionType || rule.inspectionType === match.inspectionType)) ?? rules[rules.length - 1];
}

export type MetricKey = "assign" | "firstReply" | "resolve" | "complete";
export type MetricState = "達標" | "超時完成" | "進行中" | "將逾時" | "已逾時" | "—";
export interface SlaMetric { key: MetricKey; label: string; limitMin: number; usedMin: number; remainingMin: number; state: MetricState; done: boolean }
export interface SlaResult { round: number; rounds: number; roundStart: string; schemeName: string; metrics: SlaMetric[]; overall: SlaState; text: string; percent: number }
const metricDefs: { key: MetricKey; label: string; actions: string[] }[] = [
  { key: "assign", label: "分派時限", actions: ["跟進"] }, { key: "firstReply", label: "初覆時限", actions: ["跟進", "留言"] },
  { key: "resolve", label: "解決時限", actions: ["解決"] }, { key: "complete", label: "完成時限", actions: ["關閉"] },
];
const fmtTime = (ms: number) => { const d = new Date(ms); const p = (n: number) => String(n).padStart(2, "0"); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`; };

/** Timing per round: 分派 to the first 跟進, 初覆 to the first 留言 or 跟進, 解決 to 解決, 完成 to 關閉. 重啟 starts a new round. */
export function computeSla(work: Pick<WorkLike, "id" | "createdAt" | "priority" | "status" | "voided">, logs: WorkLogEntry[], now: number, scheme: SlaScheme, round?: number): SlaResult {
  const own = logs.filter((log) => log.workId === work.id).sort((a, b) => parseTime(a.time) - parseTime(b.time));
  const starts = [parseTime(work.createdAt), ...own.filter((log) => log.action === "重啟").map((log) => parseTime(log.time))];
  const index = Math.min(Math.max((round ?? starts.length) - 1, 0), starts.length - 1);
  const start = starts[index]; const end = starts[index + 1] ?? Infinity;
  const inRound = own.filter((log) => { const t = parseTime(log.time); return t >= start && t < end; });
  const factor = priorityFactor[work.priority];
  const raw = metricDefs.map((def) => {
    const hit = inRound.find((log) => def.actions.includes(log.action));
    const limitMin = scheme.limits[def.key] * 60 * factor;
    return { def, hit, limitMin };
  });
  // 解決 or 完成 reached without an earlier step (for example a merge closing the work) means that step is not counted.
  const skipped = (i: number) => raw.slice(Math.max(i + 1, 2)).some((entry) => entry.hit);
  const frozen = !!work.voided;
  const metrics: SlaMetric[] = raw.map(({ def, hit, limitMin }, i) => {
    if (hit) { const used = (parseTime(hit.time) - start) / 60000; return { key: def.key, label: def.label, limitMin, usedMin: used, remainingMin: limitMin - used, state: used <= limitMin ? "達標" : "超時完成", done: true }; }
    if (skipped(i)) return { key: def.key, label: def.label, limitMin, usedMin: 0, remainingMin: limitMin, state: "—", done: true };
    const used = ((Number.isFinite(end) ? Math.min(end, now) : now) - start) / 60000; const remaining = limitMin - used;
    const state: MetricState = frozen ? "進行中" : remaining < 0 ? "已逾時" : remaining <= limitMin * 0.2 ? "將逾時" : "進行中";
    return { key: def.key, label: def.label, limitMin, usedMin: used, remainingMin: remaining, state, done: false };
  });
  const open = Number.isFinite(end) ? [] : metrics.filter((metric) => !metric.done);
  const current = open[0];
  const worst = open.some((metric) => metric.state === "已逾時") ? "已逾時" : open.some((metric) => metric.state === "將逾時") ? "將逾時" : "正常";
  const lateDone = metrics.some((metric) => metric.state === "超時完成");
  const overall: SlaState = !open.length || frozen ? (lateDone ? "已逾時" : "正常") : worst;
  const text = !Number.isFinite(end) && current && !frozen ? (current.remainingMin < 0 ? `${current.label}已逾時 ${durationText(current.remainingMin)}` : `${current.label}剩餘 ${durationText(current.remainingMin)}`) : work.status === "已關閉" ? "已完結，計時停止" : frozen ? "已作廢，計時停止" : "本輪已結束";
  const percent = current ? Math.min(100, Math.max(0, current.usedMin / current.limitMin * 100)) : 100;
  return { round: index + 1, rounds: starts.length, roundStart: fmtTime(start), schemeName: scheme.name, metrics, overall, text, percent };
}

// ---- 重複工作 ----
export const distanceM = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.round(Math.hypot(a.x - b.x, a.y - b.y) * METERS_PER_PX);

/** Open works of the same top-level type within the radius that are not already merged. */
export function findDuplicateCandidates<T extends WorkLike>(works: T[], target: { id: string; type: string; x?: number; y?: number }, radiusM = DUPLICATE_RADIUS_M): T[] {
  if (target.x === undefined || target.y === undefined) return [];
  const point = { x: target.x, y: target.y };
  return works.filter((work) => work.id !== target.id && topType(work.type) === topType(target.type) && work.status !== "已關閉" && !work.voided && !work.masterId && work.x !== undefined && work.y !== undefined && distanceM(point, { x: work.x, y: work.y }) <= radiusM);
}

export function mergeDuplicates(master: WorkLike, duplicates: WorkLike[], ctx: { time: string; operator: string; idPrefix: string }): { error?: string; patches?: { id: string; patch: Partial<WorkLike> }[]; logs?: WorkLogEntry[] } {
  if (master.voided || master.status === "已關閉" || master.masterId) return { error: "保留工作必須是未關閉、未作廢且未被合併的工作。" };
  if (!duplicates.length) return { error: "請選擇至少一宗要合併的重複工作。" };
  if (duplicates.some((work) => work.id === master.id)) return { error: "保留工作不可同時是被合併的工作。" };
  const bad = duplicates.find((work) => work.voided || work.status === "已關閉" || work.masterId);
  if (bad) return { error: `工作 ${bad.id} 已關閉、作廢或已合併，不可合併。` };
  const patches = duplicates.map((work) => ({ id: work.id, patch: { status: "已關閉" as const, masterId: master.id, updatedAt: ctx.time } as Partial<WorkLike> }));
  const logs: WorkLogEntry[] = [
    ...duplicates.map((work, index): WorkLogEntry => ({ id: `${ctx.idPrefix}-${index}`, workId: work.id, action: "關閉", from: work.status, to: "已關閉", operator: ctx.operator, time: ctx.time, location: "後台操作（無定位）", comment: `重複工作，已合併至 ${master.id}` })),
    { id: `${ctx.idPrefix}-m`, workId: master.id, action: "合併重複工作", operator: ctx.operator, time: ctx.time, location: "後台操作（無定位）", comment: `合併 ${duplicates.length} 宗重複工作：${duplicates.map((work) => work.id).join("、")}` },
  ];
  return { patches, logs };
}

/** One shared group for the selected works; groups they already belong to are merged into it. */
export function linkDuplicateGroup(all: { id: string; dupGroup?: string }[], selectedIds: string[], newGroup: string): { error?: string; group?: string; ids?: string[] } {
  if (selectedIds.length < 2) return { error: "請選擇至少兩宗工作建立關聯。" };
  const selected = all.filter((work) => selectedIds.includes(work.id));
  const groups = new Set(selected.map((work) => work.dupGroup).filter((group): group is string => !!group));
  const group = [...groups][0] ?? newGroup;
  return { group, ids: all.filter((work) => selectedIds.includes(work.id) || (work.dupGroup && groups.has(work.dupGroup))).map((work) => work.id) };
}

/** Group peers that still have the status `work` had before the action, so the same action may be synced to them. */
export function syncPeers<T extends WorkLike>(priorStatus: WorkStatus, work: { id: string; dupGroup?: string }, all: T[]): T[] {
  if (!work.dupGroup) return [];
  return all.filter((item) => item.id !== work.id && item.dupGroup === work.dupGroup && item.status === priorStatus && !item.voided && !item.masterId);
}

// ---- 新增／編輯 ----
export interface WorkDraft { title: string; type: string; priority: Priority; description: string; address: string; x?: number; y?: number; group: string }
export interface WorkIssue { key: string; message: string }
export function validateWork(draft: WorkDraft, typeOptions: string[]): WorkIssue[] {
  const issues: WorkIssue[] = []; const add = (key: string, message: string) => issues.push({ key, message });
  const title = draft.title.trim();
  if (!title) add("title", "請輸入工作摘要。"); else if ([...title].length > 50) add("title", "工作摘要不可超過 50 字。");
  if (!draft.type) add("type", "請選擇工作類型。"); else if (!typeOptions.includes(draft.type)) add("type", "工作類型不在可選範圍內。");
  if (!draft.address.trim()) add("address", "請輸入地址。");
  if (draft.x === undefined || draft.y === undefined) add("location", "請在地圖上選取工作位置。");
  else if (draft.x < 0 || draft.y < 0 || draft.x > MAP_PX.width || draft.y > MAP_PX.height) add("location", "工作位置超出地圖範圍。");
  if (!draft.group) add("group", "請選擇執行群組。");
  if ([...draft.description].length > DESCRIPTION_MAX) add("description", `描述不可超過 ${DESCRIPTION_MAX} 字。`);
  return issues;
}

/** A work can be edited while it is neither voided nor closed. */
export const canEdit = (work: Pick<WorkLike, "status" | "voided">) => !work.voided && work.status !== "已關閉";

export function diffWork(before: Omit<WorkDraft, "group">, after: Omit<WorkDraft, "group">): string[] {
  const lines: string[] = []; const check = (label: string, a: unknown, b: unknown) => { if ((a ?? "") !== (b ?? "")) lines.push(`${label}：${a || "—"} → ${b || "—"}`); };
  check("工作摘要", before.title, after.title); check("工作類型", before.type, after.type); check("優先級", before.priority, after.priority); check("地址", before.address, after.address); check("描述", before.description, after.description);
  if (before.x !== after.x || before.y !== after.y) lines.push("位置已更改");
  return lines;
}

// ---- 輔助 ----
export const renderTemplate = (content: string, params: Record<string, string>) => content.replace(/［(.+?)］/g, (_, key: string) => params[key] ?? "");

/** Where an operation happened: a stable offset from the work, derived from the "距工作地點 N 米" text. */
export function operationPoint(point: { x: number; y: number }, log: Pick<WorkLogEntry, "id" | "location">): [number, number] | null {
  const match = log.location.match(/(\d+)\s*米/);
  if (!match) return null;
  let hash = 0; for (const ch of log.id) hash = (hash * 31 + ch.charCodeAt(0)) % 3600;
  const radius = Number(match[1]) / METERS_PER_PX; const angle = hash / 10 * Math.PI / 180;
  return [Math.round(point.x + Math.cos(angle) * radius), Math.round(point.y + Math.sin(angle) * radius)];
}

export interface WorkView { status: WorkStatus; voided?: boolean; group: string; reopenCount?: number; dupGroup?: string; masterId?: string; creator?: string; sla: SlaState }
export const workModes: { key: string; label: string; test: (work: WorkView, me: string) => boolean }[] = [
  { key: "soon", label: "即將逾時", test: (work) => !work.voided && work.status !== "已關閉" && work.sla === "將逾時" },
  { key: "overdue", label: "已逾時", test: (work) => !work.voided && work.status !== "已關閉" && work.sla === "已逾時" },
  { key: "unassigned", label: "待人工分派", test: (work) => !work.voided && work.group === UNASSIGNED_GROUP && work.status !== "已關閉" },
  { key: "accept", label: "待驗收", test: (work) => !work.voided && work.status === "已解決" },
  { key: "reopened", label: "已重啟", test: (work) => (work.reopenCount ?? 0) > 0 },
  { key: "duplicate", label: "重複工作", test: (work) => !!work.dupGroup || !!work.masterId },
  { key: "mine", label: "我建立的", test: (work, me) => work.creator === me },
  { key: "voided", label: "已作廢", test: (work) => !!work.voided },
];
