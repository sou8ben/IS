import { useEffect, useState } from "react";
import { directory, eventMeta, initialAppState, METERS_PER_PX, myTrack, objectIndex, planObjects, planRoutes, planTemplateOf, templates as appTemplates, workMeta } from "./app/data";
import { isAbnormal } from "./app/rules";
import type { Inspection, PlanOp } from "./app/types";
import { synthesizeTrack, trackLength, type PlanInspectionRow, type PlanSnapshot, type Point } from "./plan-rules";
import type { EventRecord, Plan, Work } from "./types";

export const APP_STATE_KEY = "is-app-demo-v1";

export interface PlanTemplateDef {
  id: string;
  code: string;
  name: string;
  grid: string;
  department: string;
  version: number;
  bufferM: number;
  route: Point[];
  objects: { objectId: string; templateIds: string[] }[];
  status: "生效" | "失效";
  updatedAt: string;
  changeNote?: string;
  /** Demonstration permission scope used for the create-plan check; missing scope makes the check deny. */
  policyScope?: { grid: string; department: string; objects: string[] };
}

const fromPlan = (planId: string, dropObjects: string[] = []) => ({
  route: planRoutes[planId] ?? [],
  objects: (planObjects[planId] ?? []).filter((object) => !dropObjects.includes(object.id)).map((object) => ({ objectId: object.id, templateIds: [planTemplateOf[planId]] })),
});

const facilityScope = { grid: "花地瑪堂北區", department: "設施管理部", objects: ["OBJ-001"] };
export const planTemplates: PlanTemplateDef[] = [
  { id: "PT001", code: "PT001", name: "公園設施巡查路線 A", grid: "花地瑪堂北區", department: "設施管理部", version: 4, bufferM: 60, status: "生效", updatedAt: "2026-09-30 10:15", changeNote: "v4：移除「照明燈柱組」，掃描距離由 50 米改為 60 米。", policyScope: facilityScope, ...fromPlan("PL-20260929-0003", ["OBJ-P03-11"]) },
  { id: "PT002", code: "PT002", name: "海濱休憩區路線", grid: "花地瑪堂北區", department: "設施管理部", version: 2, bufferM: 50, status: "生效", updatedAt: "2026-09-25 16:40", policyScope: facilityScope, ...fromPlan("PL-20260929-0005") },
  { id: "PT003", code: "PT003", name: "筷子基步行路線", grid: "花地瑪堂西區", department: "環境衛生部", version: 1, bufferM: 40, status: "生效", updatedAt: "2026-09-20 09:10", ...fromPlan("PL-20260929-0006") },
  { id: "PT004", code: "PT004", name: "中區步行路線", grid: "大堂中區", department: "環境衛生部", version: 3, bufferM: 50, status: "生效", updatedAt: "2026-09-26 11:30", policyScope: { grid: "大堂南區", department: "環境衛生部", objects: ["OBJ-002"] }, ...fromPlan("PL-20260929-0004") },
  { id: "PT005", code: "PT005", name: "氹仔綜合路線", grid: "氹仔中央區", department: "綠化部", version: 2, bufferM: 80, status: "生效", updatedAt: "2026-09-22 14:05", policyScope: { grid: "氹仔中央區", department: "綠化部", objects: ["OBJ-003"] }, ...fromPlan("PL-20260928-0018") },
  { id: "PT006", code: "PT006", name: "路環山徑路線", grid: "路環東區", department: "綠化部", version: 1, bufferM: 100, status: "生效", updatedAt: "2026-09-18 15:20", ...fromPlan("PL-20260927-0012") },
];

/** Seed plans were created from older template versions. */
const seedSnapshotMeta: Record<string, { version: number; bufferM: number }> = { "PL-20260929-0003": { version: 3, bufferM: 50 } };

export const templateOfPlan = (plan: Plan) => planTemplates.find((template) => template.id === plan.planTemplateId) ?? planTemplates.find((template) => template.name === plan.template);

export function snapshotFromTemplate(template: PlanTemplateDef, takenAt: string): PlanSnapshot {
  return { templateId: template.id, templateName: template.name, version: template.version, route: template.route.map(([x, y]) => [x, y]), bufferM: template.bufferM, objects: template.objects.map((object) => ({ objectId: object.objectId, templateIds: [...object.templateIds] })), takenAt };
}

export function snapshotOf(plan: Plan): PlanSnapshot | undefined {
  if (plan.snapshot) return plan.snapshot;
  if (!planRoutes[plan.id]) return undefined;
  const template = templateOfPlan(plan);
  const meta = seedSnapshotMeta[plan.id];
  return { templateId: template?.id ?? "", templateName: plan.template, version: meta?.version ?? template?.version ?? 1, route: planRoutes[plan.id], bufferM: meta?.bufferM ?? template?.bufferM ?? 50, objects: fromPlan(plan.id).objects, takenAt: plan.createdAt ?? plan.startAt.slice(0, 10) };
}

export const groupMembers = (groupName: string) => directory.filter((person) => person.dept === groupName).map((person) => person.name);
export const objectOf = (id: string) => objectIndex[id];
export const inspectionTemplates = appTemplates;
export const inspectionTemplateName = (id: string) => appTemplates.find((template) => template.id === id)?.name ?? id;
export const allObjects = Object.values(objectIndex);

export const positionOfWork = (work: Work): Point | undefined => work.x !== undefined && work.y !== undefined ? [work.x, work.y] : workMeta[work.id] ? [workMeta[work.id].x, workMeta[work.id].y] : undefined;
export const positionOfEvent = (event: EventRecord): Point | undefined => event.x !== undefined && event.y !== undefined ? [event.x, event.y] : eventMeta[event.id] ? [eventMeta[event.id].x, eventMeta[event.id].y] : undefined;

export interface MemberTrack { name: string; color: string; points: [number, number, string][] }
const trackColors = ["#2468c9", "#8e44ad", "#0f8f7e"];

/** Demonstration tracks of the plan's group members; 陳家朗 on PL-20260929-0003 uses the App's recorded track. */
export function planTracks(plan: Plan, snapshot: PlanSnapshot | undefined, doneRatio: number): MemberTrack[] {
  if (plan.status === "未開始" || !snapshot) return [];
  const members = groupMembers(plan.group);
  const executor = plan.executor ?? members[0];
  const ratio = plan.status === "已完成" ? 1 : Math.max(0.15, doneRatio);
  const tracks: MemberTrack[] = [];
  if (executor) tracks.push({ name: executor, color: trackColors[0], points: plan.id === "PL-20260929-0003" && executor === "陳家朗" ? myTrack : synthesizeTrack(snapshot.route, ratio, plan.startAt) });
  const companion = members.find((member) => member !== executor);
  if (companion) tracks.push({ name: companion, color: trackColors[1], points: synthesizeTrack(snapshot.route, ratio * 0.7, plan.startAt, [9, -7]) });
  return tracks.filter((track) => track.points.length > 1);
}

export const trackMeters = (points: [number, number, string?][]) => Math.round(trackLength(points) * METERS_PER_PX);

export interface AppPlanState { inspections: Inspection[]; planOps: PlanOp[] }
function readAppState(): AppPlanState {
  try {
    const raw = localStorage.getItem(APP_STATE_KEY);
    const parsed = raw ? JSON.parse(raw) as Partial<AppPlanState> : null;
    return { inspections: Array.isArray(parsed?.inspections) ? parsed.inspections : initialAppState.inspections, planOps: Array.isArray(parsed?.planOps) ? parsed.planOps : initialAppState.planOps };
  } catch {
    return { inspections: initialAppState.inspections, planOps: initialAppState.planOps };
  }
}

/** Read-only view of App progress; refreshes when the App saves in another tab or frame. */
export function useAppPlanState(): AppPlanState {
  const [state, setState] = useState<AppPlanState>(readAppState);
  useEffect(() => {
    const sync = (event: StorageEvent) => { if (event.key === APP_STATE_KEY) setState(readAppState()); };
    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, []);
  return state;
}

export function inspectionResult(row: PlanInspectionRow, appInspections: Inspection[]): "正常" | "異常" | "待填寫" {
  if (row.result) return row.result;
  if (row.status !== "已完成") return "待填寫";
  const template = appTemplates.find((item) => item.id === row.templateId);
  const results = appInspections.find((item) => item.id === row.id)?.results ?? {};
  return template?.items.some((item) => isAbnormal(item, results[item.key]?.value)) ? "異常" : "正常";
}
