import { useMemo } from "react";
import { commentTemplates, execGroups, workMeta, workTypeConfig } from "./app/data";
import { demoNow, nowText } from "./app/rules";
import { eventToWorkType, gridOf, reverseGeocode, workTypeOptions } from "./event-data";
import { evaluatePermission, policyUsers, responsibilityGroups, workPolicyObject, type PermissionRule, type PolicyUser } from "./permission-rules";
import { liveAppTemplates, objectOf, useAppPlanState } from "./plan-data";
import { useDemo } from "./store";
import type { EventRecord, Notice, Work } from "./types";
import { managedItemOf } from "./item-data";
import { evaluateNotifications, summarySla, type ManagedItem, type NotifyResult } from "./item-rules";
import { computeSla, defaultSlaRules, resolveScheme, topType, UNASSIGNED_GROUP, type SlaResult, type WorkAction, type WorkLogEntry } from "./work-rules";
import type { InspectionRecord } from "./inspection-rules";

export { commentTemplates, demoNow, execGroups, nowText, workTypeConfig, workTypeOptions, eventToWorkType, reverseGeocode, gridOf };
export const groupOptions = [...execGroups, UNASSIGNED_GROUP];

/** A work with the App's seed metadata (creator, handler, position, links, reopen count, duplicate group) filled in. */
export function resolveWork(work: Work): Work {
  const meta = workMeta[work.id];
  if (!meta) return work;
  return { ...work, creator: work.creator ?? meta.creator, handler: work.handler ?? meta.handler, x: work.x ?? meta.x, y: work.y ?? meta.y, objectId: work.objectId ?? meta.objectId, inspectionId: work.inspectionId ?? meta.inspectionId, inspectionItem: work.inspectionItem ?? meta.inspectionItem, reopenCount: work.reopenCount ?? meta.reopenCount, dupGroup: work.dupGroup ?? meta.dupGroup };
}

/** Process logs: the App's (read live) plus the back office's, merged by id and ordered by time. */
export function useWorkLogs(): WorkLogEntry[] {
  const { workLogs } = useDemo(); const app = useAppPlanState();
  return useMemo(() => {
    const entries = new Map<string, WorkLogEntry>();
    app.workLogs.forEach((log) => entries.set(log.id, { id: log.id, workId: log.workId, action: log.action, from: log.from, to: log.to, operator: log.operator, time: log.time, location: log.location, comment: log.comment, attachments: log.photos?.map((photo) => ({ id: photo.id, name: photo.name, size: 0, kind: "image" as const, src: photo.src })) }));
    workLogs.forEach((log) => entries.set(log.id, log));
    return [...entries.values()].sort((a, b) => a.time.localeCompare(b.time));
  }, [workLogs, app.workLogs]);
}

/** An inspection as far as works need it: App inspections and back-office records both qualify. */
export type InspectionRef = { id: string; templateId: string };
/** App inspections plus back-office inspection records, for finding the inspection (and so the 巡查項目) a work came from. */
export function useInspectionRefs(): InspectionRef[] {
  const { inspectionRecords } = useDemo(); const app = useAppPlanState();
  return useMemo(() => [...app.inspections, ...inspectionRecords], [app.inspections, inspectionRecords]);
}
/** The managed 巡查項目 a work was created from (through its inspection and item key), if any. */
export function itemOfWork(work: Work, inspections: InspectionRef[]): ManagedItem | undefined {
  const inspectionId = work.inspectionId ?? workMeta[work.id]?.inspectionId; const itemKey = work.inspectionItem ?? workMeta[work.id]?.inspectionItem;
  const inspection = inspectionId ? inspections.find((item) => item.id === inspectionId) : undefined;
  return inspection && itemKey ? managedItemOf(inspection.templateId, itemKey) : undefined;
}

/**
 * SLA rule for a work. A work created with a 巡查項目 work summary that has its own 服務承諾 uses those limits;
 * otherwise the general rules match its inspection's type (when it came from an inspection) and its top-level work type.
 */
export function schemeFor(work: Work, inspections: InspectionRef[]) {
  const item = itemOfWork(work, inspections); const limits = summarySla(item, work.title);
  if (item && limits) return { id: `SUM-${item.id}`, name: `工作摘要「${work.title.trim()}」（${item.name}）`, limits };
  const inspectionId = work.inspectionId ?? workMeta[work.id]?.inspectionId;
  const inspection = inspectionId ? inspections.find((entry) => entry.id === inspectionId) : undefined;
  const inspectionType = inspection ? liveAppTemplates().find((template) => template.id === inspection.templateId)?.inspectionType : undefined;
  return resolveScheme(defaultSlaRules, { topType: topType(work.type), inspectionType });
}

/** The item's custom work notifications evaluated for one work at the demo clock. */
export function notificationsFor(work: Work, logs: WorkLogEntry[], inspections: InspectionRef[], now = demoNow().getTime()): { item?: ManagedItem; results: NotifyResult[] } {
  const item = itemOfWork(work, inspections);
  if (!item) return { results: [] };
  return { item, results: evaluateNotifications(work, item, logs.filter((log) => log.workId === work.id), now) };
}
/** Notices for every triggered item notification; ids are stable so each is added to 通知中心 once. */
export function useTriggeredNotices(): Notice[] {
  const { works, items } = useDemo(); const logs = useWorkLogs(); const inspections = useInspectionRefs();
  return useMemo(() => works.filter((work) => !work.pendingSync).map(resolveWork).flatMap((work) => notificationsFor(work, logs, inspections).results.filter((result) => result.triggered).map((result): Notice => ({
    id: `ITN-${work.id}-${result.rule.id}`, title: `工作通知：${result.rule.name}`, body: `${result.message}（通知：${result.recipients.join("、")}）`, time: result.dueAt, level: result.rule.level, read: false, route: `/works/${work.id}`,
  }))), [works, items, logs, inspections]); // eslint-disable-line react-hooks/exhaustive-deps
}
export function slaFor(work: Work, logs: WorkLogEntry[], inspections: InspectionRef[], now = demoNow().getTime(), round?: number): SlaResult {
  return computeSla(work, logs, now, schemeFor(work, inspections), round);
}

const operationOf: Record<WorkAction, string> = { "跟進": "follow", "解決": "resolve", "關閉": "close", "重啟": "reopen", "重新分派": "assign", "留言": "comment", "作廢": "void", "解除作廢": "void" };
export const operationForAction = (action: WorkAction) => operationOf[action];

/** First demo identity that passes the permission check for this action, so the usual path works; else the first user. */
export function defaultIdentityFor(action: WorkAction, work: Work, rules: PermissionRule[]): PolicyUser {
  const object = workPolicyObject({ id: work.id, group: work.group, type: work.type, grid: work.grid, status: work.status, creator: work.creator, handler: work.handler });
  return policyUsers.find((user) => evaluatePermission(structuredClone(rules), { user: structuredClone(user), operation: operationOf[action], object, groups: structuredClone(responsibilityGroups) }).allowed) ?? policyUsers[0];
}

export interface WorkPrefill { title: string; type: string; description: string; address: string; x?: number; y?: number; objectId?: string; note: string }

/** From an inspection item: type and summary from the item's work summary, location from the object, description from the abnormal value. */
export function prefillFromInspection(record: InspectionRecord, itemKey: string): WorkPrefill | undefined {
  const item = liveAppTemplates().find((template) => template.id === record.templateId)?.items.find((entry) => entry.key === itemKey);
  const object = objectOf(record.objectId);
  if (!item || !object) return undefined;
  const result = record.results[itemKey]; const value = [result?.value].flat().filter(Boolean).join("、");
  const summary = item.summaries?.[0];
  return { title: summary?.summary ?? `${item.name}異常`, type: summary?.workType ?? "", description: `巡查項目「${item.name}」結果異常：${value || "—"}${result?.remark ? `；備註：${result.remark}` : ""}`, address: object.address, x: object.x, y: object.y, objectId: object.id, note: `巡查 ${record.id} 的項目「${item.name}」` };
}

/** From an event: type through the event-to-work-type table, address and position from the event. */
export function prefillFromEvent(event: EventRecord): WorkPrefill {
  return { title: event.description.slice(0, 50), type: eventToWorkType[event.type] ?? "", description: `由事件 ${event.id} 建立：${event.description}`, address: event.address, x: event.x, y: event.y, note: `事件 ${event.id}（${event.type}）` };
}
