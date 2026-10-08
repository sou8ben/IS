import { useEffect, useState } from "react";
import { directory, eventMeta, initialAppState, METERS_PER_PX, myTrack, planObjects, planRoutes, planTemplateOf, workMeta } from "./app/data";
import { isAbnormal } from "./app/rules";
import { getManagedObjects, getObject, getObjects } from "./object-data";
import { activeAppTemplates, inspectionTemplateName, itemsForInspection, liveAppTemplates } from "./item-data";
import type { Inspection, InspectionTemplate as AppTemplate, MapObject, PlanOp, TemplateItem, WorkLog } from "./app/types";
import { synthesizeTrack, trackLength, type PlanInspectionRow, type PlanSnapshot, type Point } from "./plan-rules";
import type { EventRecord, Plan, Work } from "./types";

export const APP_STATE_KEY = "is-app-demo-v1";

/** The 巡查計劃模板 a plan uses: its own id, else (older plans) the template its snapshot's objects use, else the seed plan's template. */
export function templateIdOfPlan(plan: Pick<Plan, "id" | "templateId" | "snapshot">): string {
  return plan.templateId ?? (plan.snapshot && !plan.snapshot.templateId.startsWith("PT") ? plan.snapshot.templateId : plan.snapshot?.objects[0]?.templateIds[0]) ?? planTemplateOf[plan.id] ?? "";
}
/** Brings a stored plan up to date: plans made from the retired plan templates get their 巡查計劃模板 id and name. */
export function normalizePlan(plan: Plan): Plan {
  if (plan.templateId) return plan;
  const templateId = templateIdOfPlan(plan);
  return templateId ? { ...plan, templateId, template: inspectionTemplateName(templateId) } : plan;
}

/** The plan's snapshot; seed plans (created before snapshots) are rebuilt from the App's seed route and objects. */
export function snapshotOf(plan: Plan): PlanSnapshot<TemplateItem> | undefined {
  if (plan.snapshot) return plan.snapshot;
  if (!planRoutes[plan.id]) return undefined;
  const templateId = templateIdOfPlan(plan);
  return { templateId, templateName: inspectionTemplateName(templateId), route: planRoutes[plan.id], objects: (planObjects[plan.id] ?? []).map((object) => ({ objectId: object.id, templateIds: [templateId] })), takenAt: plan.createdAt ?? plan.startAt.slice(0, 10) };
}

/** Objects a 巡查計劃模板 can be planned for: active managed objects of its inspection type, limited to its listed objects when it lists any (in that order). */
export function planCandidates(template: Pick<AppTemplate, "inspectionType" | "objectIds">): MapObject[] {
  const managed = getManagedObjects().filter((object) => object.status === "啟用" && object.inspectionType === template.inspectionType);
  const listed = template.objectIds?.length ? template.objectIds.flatMap((id) => managed.filter((object) => object.id === id)) : managed;
  return listed.flatMap((object) => getObject(object.id) ?? []);
}
/** Snapshot of a 巡查計劃模板 and the chosen objects (in route order) when a plan is created. */
export function snapshotFromTemplate(template: AppTemplate, templateUpdatedAt: string, objectIds: string[], takenAt: string): PlanSnapshot<TemplateItem> {
  const route = objectIds.flatMap((id): Point[] => { const object = getObject(id); return object ? [[object.x, object.y]] : []; });
  return { templateId: template.id, templateName: template.name, templateUpdatedAt, route, objects: objectIds.map((objectId) => ({ objectId, templateIds: [template.id] })), items: structuredClone(template.items), takenAt };
}

export const groupMembers = (groupName: string) => directory.filter((person) => person.dept === groupName).map((person) => person.name);
export const objectOf = (id: string) => getObject(id);
/** The 巡查計劃模板 as App inspection forms (all, and the 生效 ones pickers offer). */
export { activeAppTemplates, inspectionTemplateName, liveAppTemplates };
/** Active managed objects: what pickers offer. */
export const getAllObjects = () => getObjects();

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

export interface AppPlanState { inspections: Inspection[]; planOps: PlanOp[]; workLogs: WorkLog[]; workLinks: { inspectionId: string; itemKey?: string; workId: string }[] }
function readAppState(): AppPlanState {
  try {
    const raw = localStorage.getItem(APP_STATE_KEY);
    const parsed = raw ? JSON.parse(raw) as Partial<AppPlanState> : null;
    return { inspections: Array.isArray(parsed?.inspections) ? parsed.inspections : initialAppState.inspections, planOps: Array.isArray(parsed?.planOps) ? parsed.planOps : initialAppState.planOps, workLogs: Array.isArray(parsed?.workLogs) ? parsed.workLogs : initialAppState.workLogs, workLinks: Array.isArray(parsed?.workLinks) ? parsed.workLinks : initialAppState.workLinks };
  } catch {
    return { inspections: initialAppState.inspections, planOps: initialAppState.planOps, workLogs: initialAppState.workLogs, workLinks: initialAppState.workLinks };
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
  const app = appInspections.find((item) => item.id === row.id);
  const items = app ? itemsForInspection(app) : itemsForInspection({ templateId: row.templateId, status: "已完成" });
  return items.some((item) => isAbnormal(item, app?.results[item.key]?.value)) ? "異常" : "正常";
}
