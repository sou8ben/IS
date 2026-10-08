import { useMemo } from "react";
import { workMeta } from "./app/data";
import type { Inspection } from "./app/types";
import { getAllObjects, liveAppTemplates, useAppPlanState } from "./plan-data";
import { activeAppTemplates, baselineTemplate, itemsForInspection, templateAppliesTo } from "./item-data";
import { getManagedObjects } from "./object-data";
import { mergeResults, snapshotTemplate, type InspectionRecord, type ItemSnapshot, type ResultMap, type TemplateSnapshot } from "./inspection-rules";
import { useDemo } from "./store";
import type { Work } from "./types";

export const templateSnapshotOf = (templateId: string, takenAt: string): TemplateSnapshot => {
  const template = liveAppTemplates().find((item) => item.id === templateId);
  const emptyTemplate = { id: templateId, name: templateId, inspectionType: "", locationCheck: false, validDistance: 0, checkOn: [], items: [] as ItemSnapshot[] };
  return snapshotTemplate(template ? { ...template, items: template.items } : emptyTemplate, takenAt);
};

function appSnapshotOf(app: Inspection): TemplateSnapshot {
  const template = baselineTemplate(app.templateId); const takenAt = app.submittedAt ?? app.startedAt ?? "";
  return template ? snapshotTemplate({ ...template, items: itemsForInspection(app) }, takenAt) : templateSnapshotOf(app.templateId, takenAt);
}

/** An App inspection viewed as a record. Its snapshot is the items it was submitted with (or the baseline for completed seed inspections, the live template while 未完成). */
export function appToRecord(app: Inspection): InspectionRecord {
  const results: ResultMap = Object.fromEntries(Object.entries(app.results).map(([key, result]) => [key, {
    value: result.value, remark: result.remark, signature: result.signature,
    attachments: result.photos.map((photo) => ({ id: photo.id, name: photo.name, size: 0, kind: photo.kind === "image" ? "image" as const : "file" as const, src: photo.src })),
  }]));
  return {
    id: app.id, origin: "App", planId: app.planId, objectId: app.objectId, templateId: app.templateId, snapshot: appSnapshotOf(app),
    seq: app.seq, status: app.status, source: app.planId ? "計劃" : "獨立", inspector: app.inspector, startedAt: app.startedAt, submittedAt: app.submittedAt, results, location: app.location,
    changes: (app.supplements ?? []).map((entry) => ({ time: entry.time, operator: entry.operator, action: "補入（App）", detail: entry.reason })),
  };
}

/** Back-office records over App inspections: overlays apply to App inspections, App completion flows into back-office records. */
export function resolveInspections(records: InspectionRecord[], apps: Inspection[]): InspectionRecord[] {
  const byId = new Map(records.map((record) => [record.id, record]));
  const out: InspectionRecord[] = apps.map((app) => {
    const base = appToRecord(app); const stored = byId.get(app.id);
    if (!stored) return base;
    if (stored.origin === "App") return { ...base, voided: stored.voided, voidReason: stored.voidReason, results: mergeResults(base.snapshot, base.results, stored.results), changes: [...base.changes, ...stored.changes] };
    const fromApp = base.status === "已完成" && stored.status === "未完成";
    return fromApp ? { ...stored, status: base.status, inspector: base.inspector, startedAt: base.startedAt, submittedAt: base.submittedAt, results: base.results, location: base.location } : { ...stored, location: stored.location ?? base.location };
  });
  const appIds = new Set(apps.map((app) => app.id));
  records.filter((record) => record.origin === "後台" && !appIds.has(record.id)).forEach((record) => out.push(record));
  return out;
}

export interface InspectionStore { all: InspectionRecord[]; stored: (id: string) => InspectionRecord | undefined }

export function useInspections(): InspectionStore {
  const { inspectionRecords } = useDemo(); const app = useAppPlanState();
  return useMemo(() => ({ all: resolveInspections(inspectionRecords, app.inspections), stored: (id) => inspectionRecords.find((record) => record.id === id) }), [inspectionRecords, app.inspections]);
}

/** The stored record to save: the full record for back-office inspections, an overlay for App ones. */
export function storedFor(resolved: InspectionRecord, stored: InspectionRecord | undefined): InspectionRecord {
  if (stored) return stored;
  return resolved.origin === "App" ? { ...resolved, results: {}, changes: [], voided: undefined, voidReason: undefined } : resolved;
}

export const workInspectionOf = (work: Work) => ({ inspectionId: work.inspectionId ?? workMeta[work.id]?.inspectionId, itemKey: work.inspectionItem ?? workMeta[work.id]?.inspectionItem });
export const worksOfInspection = (works: Work[], inspectionId: string, appLinks: { inspectionId: string; itemKey?: string; workId: string }[] = []) => works.filter((work) => !work.pendingSync && !work.voided && (workInspectionOf(work).inspectionId === inspectionId || appLinks.some((link) => link.inspectionId === inspectionId && link.workId === work.id)));

/** 生效 巡查計劃模板 that apply to an object: its inspection type, and the template lists no objects or lists this one. */
export function templatesForObject(objectId: string) {
  const managed = getManagedObjects().find((object) => object.id === objectId);
  return managed ? activeAppTemplates().filter((template) => templateAppliesTo(template, managed)) : [];
}
export { getAllObjects };
