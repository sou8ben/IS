// Inspection plan logic. Kept import-free so tests can transpile and run it directly.

export type Point = [number, number];
export type PlannedSource = "計劃模板" | "額外加入" | "補入";
export type InspectionSource = PlannedSource | "現場建立";
export type PlanStatus = "未開始" | "進行中" | "已中止" | "已完成";

/**
 * Copy of the plan's 巡查計劃模板 and chosen objects taken when the plan is created; later template edits never change it.
 * `items` are the template's inspection items at creation, which the App gives to the plan's inspections.
 * (Plans created before 巡查計劃模板 drove plans carry a plan-template `version` and `bufferM` instead of `templateUpdatedAt`.)
 */
export interface PlanSnapshot<I = unknown> {
  templateId: string;
  templateName: string;
  templateUpdatedAt?: string;
  version?: number;
  route: Point[];
  bufferM?: number;
  objects: { objectId: string; templateIds: string[] }[];
  items?: I[];
  takenAt: string;
}

export interface PlannedInspection {
  id: string;
  objectId: string;
  templateId: string;
  seq: number;
  source: PlannedSource;
  status?: "未完成" | "已完成";
  inspector?: string;
  submittedAt?: string;
  result?: "正常" | "異常";
  reason?: string;
  addedBy?: string;
  addedAt?: string;
}

export interface PlanChange { time: string; operator: string; action: string; detail: string }

/** The fields the back office reads from App inspections. */
export interface AppInspectionLike {
  id: string;
  planId?: string;
  objectId: string;
  templateId: string;
  seq: number;
  status: "未完成" | "已完成";
  inspector?: string;
  submittedAt?: string;
}

export interface PlanInspectionRow {
  id: string;
  objectId: string;
  templateId: string;
  seq: number;
  source: InspectionSource;
  status: "未完成" | "已完成";
  inspector?: string;
  submittedAt?: string;
  result?: "正常" | "異常";
  reason?: string;
  app?: AppInspectionLike;
}

/** `objectIds` and `allowedGroupIds` (the template's applicable inspection groups; empty = any) are checked when given. */
export interface PlanForm { name: string; templateId: string; groupId: string; startAt: string; endAt: string; objectIds?: string[]; allowedGroupIds?: string[] }

export const isEditable = (status: string) => status === "未開始";
export const isEnded = (status: string) => status === "已完成" || status === "已中止";

/** Next `count` ids such as IN-20260930-0001, skipping every id already used for that date. */
export function nextIds(prefix: string, usedIds: string[], date: string, count: number): string[] {
  const pattern = new RegExp(`^${prefix}-${date}-(\\d{4})$`);
  const max = usedIds.reduce((value, id) => { const match = id.match(pattern); return match ? Math.max(value, Number(match[1])) : value; }, 0);
  return Array.from({ length: count }, (_, index) => `${prefix}-${date}-${String(max + index + 1).padStart(4, "0")}`);
}

/** Appends one inspection per object × template, continuing the sequence after `startSeq - 1`. */
export function appendInspections(
  entries: { objectId: string; templateId: string }[], usedIds: string[], date: string, startSeq: number, source: PlannedSource,
  extra: Partial<PlannedInspection> = {},
): PlannedInspection[] {
  const ids = nextIds("IN", usedIds, date, entries.length);
  return entries.map((entry, index) => ({ ...extra, id: ids[index], objectId: entry.objectId, templateId: entry.templateId, seq: startSeq + index, source }));
}

/** Inspections generated from a template snapshot when a plan is created. */
export function buildPlannedInspections(snapshot: PlanSnapshot, usedIds: string[], date: string): PlannedInspection[] {
  const entries = snapshot.objects.flatMap((object) => object.templateIds.map((templateId) => ({ objectId: object.objectId, templateId })));
  return appendInspections(entries, usedIds, date, 1, "計劃模板");
}

/**
 * Joins the plan's planned inspections with the App's inspections by id. App progress wins when present.
 * App-only inspections are kept: for seed plans they are the template inspections, otherwise they were created on site.
 */
export function mergePlanInspections(planId: string, planned: PlannedInspection[] | undefined, app: AppInspectionLike[]): PlanInspectionRow[] {
  const appRows = app.filter((item) => item.planId === planId);
  const list = planned ?? [];
  const hasTemplateEntries = list.some((item) => item.source === "計劃模板");
  const rows: PlanInspectionRow[] = list.map((item) => {
    const live = appRows.find((entry) => entry.id === item.id);
    return { ...item, status: live?.status ?? item.status ?? "未完成", inspector: live?.inspector ?? item.inspector, submittedAt: live?.submittedAt ?? item.submittedAt, app: live };
  });
  appRows.filter((entry) => !list.some((item) => item.id === entry.id)).forEach((entry) => rows.push({
    id: entry.id, objectId: entry.objectId, templateId: entry.templateId, seq: entry.seq, source: hasTemplateEntries ? "現場建立" : "計劃模板",
    status: entry.status, inspector: entry.inspector, submittedAt: entry.submittedAt, app: entry,
  }));
  return rows.sort((a, b) => a.seq - b.seq || a.id.localeCompare(b.id));
}

export function validatePlanForm(form: PlanForm): string[] {
  const errors: string[] = [];
  const name = form.name.trim();
  if (!name) errors.push("請輸入計劃名稱。");
  else if ([...name].length > 50) errors.push("計劃名稱不可超過 50 字。");
  if (!form.templateId) errors.push("請選擇巡查計劃模板。");
  if (form.objectIds && !form.objectIds.length) errors.push("請選擇至少 1 個巡查對象。");
  if (!form.groupId) errors.push("請選擇巡查群組。");
  else if (form.allowedGroupIds?.length && !form.allowedGroupIds.includes(form.groupId)) errors.push("所選巡查群組不在巡查計劃模板的適用群組內。");
  if (!form.startAt || !form.endAt) errors.push("請填寫開始及結束時間。");
  else if (form.endAt.replace("T", " ") <= form.startAt.replace("T", " ")) errors.push("結束時間須晚於開始時間。");
  return errors;
}

const toMinutes = (time: string) => { const match = time.match(/(\d{1,2}):(\d{2})/); return match ? Number(match[1]) * 60 + Number(match[2]) : 8 * 60; };
const clockText = (minutes: number) => `${String(Math.floor(minutes / 60) % 24).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;

/** Demo track along the route: covers `ratio` of its length, one point about every 14 px, three minutes apart. */
export function synthesizeTrack(route: Point[], ratio: number, startAt: string, offset: Point = [0, 0]): [number, number, string][] {
  const share = Math.min(1, Math.max(0, ratio));
  if (route.length < 2 || share === 0) return [];
  const segments = route.slice(1).map((point, index) => ({ from: route[index], to: point, length: Math.hypot(point[0] - route[index][0], point[1] - route[index][1]) }));
  const total = segments.reduce((sum, segment) => sum + segment.length, 0);
  const target = total * share;
  const steps = Math.max(2, Math.round(target / 14));
  const start = toMinutes(startAt);
  return Array.from({ length: steps + 1 }, (_, index) => {
    let distance = target * index / steps;
    const segment = segments.find((item) => { if (distance <= item.length) return true; distance -= item.length; return false; }) ?? segments[segments.length - 1];
    const t = segment.length ? Math.min(1, distance / segment.length) : 0;
    const x = Math.round(segment.from[0] + (segment.to[0] - segment.from[0]) * t + offset[0]);
    const y = Math.round(segment.from[1] + (segment.to[1] - segment.from[1]) * t + offset[1]);
    return [x, y, clockText(start + index * 3)];
  });
}

/** The most frequent value (first seen wins a tie), e.g. the plan's grid from its objects' grids. */
export function majority(values: string[]): string | undefined {
  const counts = new Map<string, number>(); values.forEach((value) => counts.set(value, (counts.get(value) ?? 0) + 1));
  let best: string | undefined; let bestCount = 0;
  counts.forEach((count, value) => { if (count > bestCount) { best = value; bestCount = count; } });
  return best;
}

export function trackLength(points: [number, number, string?][]): number {
  return points.slice(1).reduce((sum, point, index) => sum + Math.hypot(point[0] - points[index][0], point[1] - points[index][1]), 0);
}
