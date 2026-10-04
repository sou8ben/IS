import type { Inspection } from "./app/types";
import type { InspectionRecord } from "./inspection-rules";
import { getItem, itemsForInspection, managedItemOf } from "./item-data";
import { lastResultsOf, resolveAux, type AuxEntry, type AuxHistoryEntry } from "./item-rules";
import { dispatchGroupOf } from "./object-rules";
import { getManagedObjects, getObject } from "./object-data";

// 巡查輔助資料 values: the managed item's current settings, resolved for one inspection's object and time.

/** Back-office view: resolved inspection records (App inspections and back-office records together). */
export const historyFromRecords = (records: InspectionRecord[]): AuxHistoryEntry[] => records.map((record) => ({
  id: record.id, objectId: record.objectId, status: record.status, voided: record.voided, time: record.submittedAt, inspector: record.inspector, items: record.snapshot.items, results: record.results,
}));
/** App view: the App's own inspections plus back-office records (App-origin overlays are skipped, the App inspection itself is there). */
export const historyFromApp = (inspections: Inspection[], records: InspectionRecord[]): AuxHistoryEntry[] => [
  ...inspections.map((inspection) => ({
    id: inspection.id, objectId: inspection.objectId, status: inspection.status, time: inspection.submittedAt, inspector: inspection.inspector, items: itemsForInspection(inspection),
    results: Object.fromEntries(Object.entries(inspection.results).map(([key, result]) => [key, { value: result.value, signature: result.signature, remark: result.remark, attachments: result.photos.map((photo) => ({ id: photo.id, name: photo.name, src: photo.src, kind: photo.kind })) }])),
  })),
  ...historyFromRecords(records.filter((record) => record.origin === "後台")),
];

function objectAttribute(objectId: string, name: string): string | undefined {
  const object = getManagedObjects().find((item) => item.id === objectId); if (!object) return undefined;
  switch (name) {
    case "對象編號": return object.code;
    case "對象名稱": return object.name;
    case "地址": return object.address;
    case "堂區": return object.addressParts?.parish;
    case "所屬網格": return getObject(object.id)?.grid;
    case "經緯度": return `${object.latitude.toFixed(6)}, ${object.longitude.toFixed(6)}`;
    case "地圖範圍": return object.geojson ? object.geojson.type : undefined;
    case "負責執行群組": return dispatchGroupOf(object);
    default: return undefined;
  }
}

/**
 * The 輔助資料 of one template item for one inspection. The settings come from the managed item as it is now (by item id, else through
 * the template and key); 上次巡查結果 lists the latest earlier completed inspections of the same object and item.
 */
export function auxEntriesFor(item: { key: string; itemId?: string }, inspection: { id: string; objectId: string; templateId: string; submittedAt?: string }, history: AuxHistoryEntry[]): AuxEntry[] {
  const managed = item.itemId ? getItem(item.itemId) : managedItemOf(inspection.templateId, item.key);
  if (!managed?.auxiliary?.length) return [];
  const object = getManagedObjects().find((entry) => entry.id === inspection.objectId);
  // enough earlier results for the 上次巡查結果 entry that shows the most
  const count = Math.max(0, ...managed.auxiliary.filter((def) => def.source === "上次巡查結果").map((def) => def.count ?? 1));
  const results = count ? lastResultsOf(history, { inspectionId: inspection.id, objectId: inspection.objectId, itemId: managed.id, key: item.key, before: inspection.submittedAt }, count) : [];
  return resolveAux(managed.auxiliary, { results, attribute: (name) => objectAttribute(inspection.objectId, name), attachments: (object?.attachments ?? []).map((file) => ({ id: file.id, name: file.name, src: file.src, kind: file.kind })) });
}
