import { photoAssets, planObjects, templates as baselineTemplates } from "./app/data";
import { snapshotTemplate, type InspectionRecord, type ItemResultData, type ItemSnapshot } from "./inspection-rules";
import { appTemplate } from "./item-data";

// Demonstration inspection history: five weekly rounds of completed back-office inspections, so 上次巡查結果 / 上五次巡查結果
// have something to show. Results are deterministic: mostly normal, now and then abnormal (with a remark).

const rounds = ["2026-08-25", "2026-09-01", "2026-09-08", "2026-09-15", "2026-09-22"];
const ids = (planId: string) => (planObjects[planId] ?? []).map((object) => object.id);
// Order matters: ids are numbered per date in this order (the first three sets are unchanged from the first generated history).
const sets: { objectIds: string[]; templateId: string; inspectors: string[]; startMinute: number }[] = [
  { objectIds: ids("PL-20260929-0003"), templateId: "TPL001", inspectors: ["陳家朗", "何浩然"], startMinute: 9 * 60 },
  { objectIds: ids("PL-20260929-0005"), templateId: "TPL004", inspectors: ["陳家朗"], startMinute: 10 * 60 + 30 },
  { objectIds: ids("PL-20260929-0006"), templateId: "TPL002", inspectors: ["何浩然", "陳家朗"], startMinute: 10 * 60 + 30 },
  { objectIds: ids("PL-20260929-0004"), templateId: "TPL002", inspectors: ["李芷晴", "梁嘉敏"], startMinute: 14 * 60 },
  { objectIds: ids("PL-20260928-0018"), templateId: "TPL001", inspectors: ["李芷晴", "何浩然"], startMinute: 9 * 60 },
  { objectIds: ids("PL-20260927-0012"), templateId: "TPL002", inspectors: ["李芷晴"], startMinute: 14 * 60 },
  { objectIds: ["OBJ-001", "OBJ-003", "OBJ-013", "OBJ-007"], templateId: "TPL001", inspectors: ["陳家朗"], startMinute: 15 * 60 + 30 },
  { objectIds: ["OBJ-006", "OBJ-027"], templateId: "TPL003", inspectors: ["何浩然"], startMinute: 16 * 60 },
  { objectIds: ["OBJ-001", "OBJ-011"], templateId: "TPL006", inspectors: ["陳家朗", "何浩然"], startMinute: 19 * 60 + 30 },
];
const texts = ["狀況良好", "整體整潔", "有少量落葉，已即場清理", "狀況良好"];
const remarks = ["已通知維修組跟進", "已拍照記錄", "建議下次重點檢查"];
const photoFor: Record<string, string> = { pipe: photoAssets.pipe, bin: photoAssets.bin, light: photoAssets.sign, signage: photoAssets.sign, road: photoAssets.sign };
const pad = (n: number) => String(n).padStart(2, "0");
const clock = (date: string, minutes: number) => `${date} ${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}`;

/** About one answer in nine is abnormal; the pattern differs per object, round and item. */
const isAbnormalPick = (object: number, round: number, item: number) => (object * 31 + round * 17 + item * 7) % 9 === 4;

function resultFor(item: ItemSnapshot, abnormal: boolean, salt: number): ItemResultData {
  const normal = (item.options ?? []).find((option) => !item.abnormal?.includes(option));
  const bad = item.abnormal?.[0];
  const attachments = Array.from({ length: item.minAttachments }, (_, index) => ({ id: `${item.key}-${salt}-${index}`, name: `現場相片_${index + 1}.jpg`, size: 120_000, kind: "image" as const, src: photoFor[item.key] ?? photoAssets.seat }));
  switch (item.kind) {
    case "BOOL": case "SINGLE": return { value: abnormal && bad ? bad : normal, remark: abnormal && bad ? remarks[salt % remarks.length] : undefined, attachments };
    case "MULTI": return { value: [abnormal && bad ? bad : normal ?? ""], remark: abnormal && bad ? remarks[salt % remarks.length] : undefined, attachments };
    case "TEXT": return { value: texts[salt % texts.length], attachments };
    default: return { signature: "seed", attachments };
  }
}

export function seedHistoryRecords(): InspectionRecord[] {
  const records: InspectionRecord[] = [];
  rounds.forEach((date, round) => {
    let serial = 301;
    sets.forEach((set) => {
      // the App's original templates keep their result keys; the others come from 巡查計劃模板 (keys = item ids)
      const template = baselineTemplates.find((item) => item.id === set.templateId) ?? appTemplate(set.templateId);
      if (!template) return;
      set.objectIds.forEach((objectId, objectIndex) => {
        const minutes = set.startMinute + objectIndex * 6;
        const startedAt = clock(date, minutes - 5); const submittedAt = clock(date, minutes);
        const snapshot = snapshotTemplate(template, startedAt);
        const inspector = set.inspectors[round % set.inspectors.length];
        const id = `IN-${date.replace(/-/g, "")}-${String(serial++).padStart(4, "0")}`;
        const results = Object.fromEntries(snapshot.items.map((item, itemIndex) => [item.key, resultFor(item, isAbnormalPick(objectIndex, round, itemIndex), objectIndex + round + itemIndex)]));
        records.push({
          id, origin: "後台", objectId, templateId: template.id, snapshot, seq: 1, status: "已完成", source: "獨立", inspector, startedAt, submittedAt, results,
          changes: [{ time: submittedAt, operator: inspector, action: "提交巡查", detail: "歷史巡查（示範資料）" }], createdBy: inspector, createdAt: startedAt,
        });
      });
    });
  });
  return records;
}
