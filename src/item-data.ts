import { templates as baselineTemplates } from "./app/data";
import type { InspectionTemplate as AppTemplate, TemplateItem } from "./app/types";
import { initialTemplates, itemCatalog, type CatalogItem, type InspectionTemplate as BackOfficeTemplate } from "./inspection-templates";
import { appKindOf, hasOptions, type AuxDef, type ItemSummary, type ItemTypeRecord, type ManagedItem, type NotifyRule, type SlaHours } from "./item-rules";

// ---- 種子資料 ----
const typeNames = ["一般設施", "照明設施", "環境衛生", "供水設施", "道路設施", "綠化設施"];
export function seedItemTypes(): ItemTypeRecord[] {
  return typeNames.map((name, index) => ({ id: `IT-${String(index + 1).padStart(2, "0")}`, name, order: index + 1, status: "生效", updatedBy: "陳家朗", updatedAt: "2026-09-18 09:30" }));
}

type Seed = { options?: string[]; abnormal?: string[]; maxLength?: number; summaries?: [string, string, SlaHours?][]; notifications?: NotifyRule[] };
const sla = (assign: number, firstReply: number, resolve: number, complete: number): SlaHours => ({ assign, firstReply, resolve, complete });
const lights = { options: ["正常", "閃爍", "不亮"], abnormal: ["閃爍", "不亮"] };
const bins = { options: ["清潔", "一般", "滿溢"], abnormal: ["滿溢"] };
const note = { maxLength: 500 };
// Items the App templates use carry exactly the App's options, abnormal values, length limits and summaries.
const seeds: Record<string, Seed> = {
  "ITEM-001": { abnormal: ["否"], summaries: [["座椅固定螺絲鬆脫", "公共設施／座椅", sla(2, 2, 12, 24)], ["座椅木條破損", "公共設施／座椅"]], notifications: [
    { id: "NR-001", name: "新建 12 小時仍未跟進", states: ["新建"], since: "建立", hours: 12, recipients: { execGroup: true, creator: false, groups: ["設施管理群組"] }, level: "緊急", message: "工作［工作編號］「［工作摘要］」（［巡查項目］）建立已［經過時間］，仍處於［狀態］，請盡快跟進。", active: true },
    { id: "NR-002", name: "跟進 2 小時仍未解決", states: ["跟進中"], since: "狀態變更", hours: 2, recipients: { execGroup: true, creator: true, groups: [] }, level: "一般", message: "工作［工作編號］「［工作摘要］」已跟進［經過時間］，仍未解決，請更新處理進度。", active: true },
  ] },
  "ITEM-002": { ...lights, summaries: [["燈具故障", "公共設施／照明"]] },
  "ITEM-006": { options: ["正常", "部件鬆脫", "表面破損", "尖角外露"], abnormal: ["部件鬆脫", "表面破損", "尖角外露"], summaries: [["遊樂設施部件鬆脫", "公共設施／遊樂設施", sla(1, 1, 8, 12)]] },
  "ITEM-003": { ...bins, summaries: [["垃圾桶滿溢", "環境衛生／清潔"]] },
  "ITEM-007": { options: ["正常", "滲漏"], abnormal: ["滲漏"], summaries: [["灌溉水管滲漏", "綠化／灌溉"]] },
  "ITEM-008": note,
  "ITEM-009": {},
  "ITEM-010": { abnormal: ["否"] },
  "ITEM-011": { options: ["完整", "部分損毀", "缺失"], abnormal: ["部分損毀", "缺失"], summaries: [["告示牌損毀", "公共設施／標示"]] },
  "ITEM-012": { options: ["良好", "破損", "積水"], abnormal: ["破損", "積水"], summaries: [["路面破損", "道路設施／路面"], ["路面積水", "環境衛生／積水"]] },
  "ITEM-013": { abnormal: ["是"], summaries: [["垃圾堆積", "環境衛生／清潔"]] },
  "ITEM-005": { options: ["清晰", "褪色", "損毀"], abnormal: ["褪色", "損毀"], summaries: [["指示牌字樣褪色", "公共設施／標示"]] },
  "ITEM-014": note,
  "ITEM-015": { options: ["完好", "鬆動", "缺失"], abnormal: ["鬆動", "缺失"], summaries: [["渠蓋鬆動", "道路設施／路面", sla(1, 1, 6, 12)]] },
  "ITEM-016": { abnormal: ["是"], summaries: [["清除違例張貼", "環境衛生／清潔"]] },
  "ITEM-017": { ...lights, summaries: [["路燈故障", "公共設施／照明"]] },
  "ITEM-024": { options: ["健康", "枯枝", "傾斜", "枯死"], abnormal: ["枯枝", "傾斜", "枯死"], summaries: [["樹木枯枝需修剪", "綠化／樹木"], ["樹木傾斜", "綠化／樹木", sla(1, 1, 6, 12)]] },
  "ITEM-025": { abnormal: ["是"], summaries: [["樹枝阻礙通行", "綠化／樹木"]] },
  "ITEM-004": { options: ["正常", "滲漏", "不出水"], abnormal: ["滲漏", "不出水"], summaries: [["灌溉系統故障", "綠化／灌溉"]] },
  "ITEM-026": { options: ["良好", "缺水", "雜草叢生"], abnormal: ["缺水", "雜草叢生"], summaries: [["花圃需打理", "綠化／草地"]] },
  "ITEM-027": { options: ["無", "蟲害", "真菌", "白蟻"], abnormal: ["蟲害", "真菌", "白蟻"], summaries: [["樹木病蟲害處理", "綠化／樹木"]] },
  "ITEM-028": note,
  "ITEM-018": { abnormal: ["否"], summaries: [["海濱欄杆鬆動", "道路設施／欄杆"]] },
  "ITEM-019": { options: ["齊備", "缺失"], abnormal: ["缺失"], summaries: [["救生圈缺失", "公共設施／標示"]] },
  "ITEM-020": { ...lights, summaries: [["燈具故障", "公共設施／照明"]] },
  "ITEM-021": note,
  "ITEM-022": { options: ["良好", "破損", "濕滑"], abnormal: ["破損", "濕滑"], summaries: [["步道路面破損", "道路設施／路面"]] },
  "ITEM-023": { ...bins, summaries: [["垃圾桶滿溢", "環境衛生／清潔"]] },
  "ITEM-029": { options: ["清潔", "一般", "不潔"], abnormal: ["不潔"], summaries: [["洗手間地面清潔", "環境衛生／清潔"]] },
  "ITEM-030": { abnormal: ["否"], summaries: [["補充洗手液", "環境衛生／清潔"]] },
  "ITEM-031": { abnormal: ["否"] },
  "ITEM-032": { options: ["正常", "損壞"], abnormal: ["損壞"] },
  "ITEM-033": {},
};
// 巡查輔助資料 seeds, generated for every item: 上五次巡查結果 (上次 for text items; none for signatures), plus 對象屬性 / 對象附件 by item type.
const lastResults = (id: string, count: number): AuxDef => ({ id: `${id}-A1`, name: count > 1 ? "上五次巡查結果" : "上次巡查結果", source: "上次巡查結果", order: 1, ...(count > 1 ? { count } : {}) });
const attr = (id: string, n: number, name: string, attribute: string): AuxDef => ({ id: `${id}-A${n}`, name, source: "對象屬性", order: n, attribute });
const file = (id: string, n: number, name: string, keyword: string): AuxDef => ({ id: `${id}-A${n}`, name, source: "對象附件", order: n, keyword });
const byItemType: Record<string, (id: string) => AuxDef[]> = {
  "一般設施": (id) => [attr(id, 2, "負責維修群組", "負責執行群組"), file(id, 3, "設施相片", "設施相片")],
  "照明設施": (id) => [file(id, 2, "燈具保養記錄", "保養"), attr(id, 3, "所屬網格", "所屬網格")],
  "環境衛生": (id) => [attr(id, 2, "清潔範圍", "地址")],
  "供水設施": (id) => [file(id, 2, "水管走向圖", "水管")],
  "道路設施": (id) => [attr(id, 2, "路段地址", "地址"), file(id, 3, "路面維修記錄", "維修")],
  "綠化設施": (id) => [file(id, 2, "樹木登記表", "樹木"), attr(id, 3, "所屬網格", "所屬網格")],
};
/** Seed 輔助資料 of an item. */
export function seedAuxiliaryFor(id: string): AuxDef[] {
  const entry = itemCatalog.find((item) => item.id === id); if (!entry || entry.inputKind === "簽名") return [];
  return [lastResults(id, entry.inputKind === "輸入框" ? 1 : 5), ...(byItemType[entry.category]?.(id) ?? [])];
}
// Earlier seeds: items still holding exactly one of them (or nothing) are upgraded to the current seed on load; edited items are kept.
const one = (id: string): AuxDef => ({ id: `${id}-A1`, name: "上次巡查結果", source: "上次巡查結果", order: 1 });
const five = (id: string): AuxDef => ({ id: `${id}-A1`, name: "上五次巡查結果", source: "上次巡查結果", order: 1, count: 5 });
const earlierSeeds: Record<string, AuxDef[]>[] = [
  { "ITEM-001": [one("ITEM-001")], "ITEM-002": [one("ITEM-002")], "ITEM-006": [one("ITEM-006")], "ITEM-024": [one("ITEM-024")], "ITEM-012": [one("ITEM-012"), attr("ITEM-012", 2, "路段地址", "地址")], "ITEM-007": [file("ITEM-007", 1, "水管走向圖", "水管")], "ITEM-015": [attr("ITEM-015", 1, "所屬網格", "所屬網格")] },
  {
    "ITEM-001": [five("ITEM-001"), attr("ITEM-001", 2, "負責維修群組", "負責執行群組")], "ITEM-002": [five("ITEM-002"), file("ITEM-002", 2, "燈具保養記錄", "保養")], "ITEM-006": [five("ITEM-006"), file("ITEM-006", 2, "遊樂設施相片", "遊樂")],
    "ITEM-003": [five("ITEM-003")], "ITEM-007": [five("ITEM-007"), file("ITEM-007", 2, "水管走向圖", "水管")], "ITEM-008": [one("ITEM-008")], "ITEM-012": [five("ITEM-012"), attr("ITEM-012", 2, "路段地址", "地址")],
    "ITEM-013": [five("ITEM-013")], "ITEM-005": [five("ITEM-005"), file("ITEM-005", 2, "指示牌設計圖", "指示牌")], "ITEM-014": [one("ITEM-014")], "ITEM-018": [five("ITEM-018"), attr("ITEM-018", 2, "位置座標", "經緯度")],
    "ITEM-019": [five("ITEM-019")], "ITEM-020": [five("ITEM-020"), file("ITEM-020", 2, "燈具保養記錄", "保養")], "ITEM-021": [one("ITEM-021")], "ITEM-011": [attr("ITEM-011", 1, "設置地址", "地址")], "ITEM-015": [attr("ITEM-015", 1, "所屬網格", "所屬網格")], "ITEM-024": [five("ITEM-024")],
  },
];
export function upgradeAuxiliary(item: ManagedItem): ManagedItem {
  const current = JSON.stringify(item.auxiliary ?? []);
  const untouched = current === "[]" || earlierSeeds.some((seeds) => current === JSON.stringify(seeds[item.id] ?? []));
  return untouched ? { ...item, auxiliary: seedAuxiliaryFor(item.id) } : item;
}

const updates = ["2026-09-20 10:15", "2026-09-21 14:40", "2026-09-23 09:05", "2026-09-25 16:20"];

export function seedItems(): ManagedItem[] {
  const types = seedItemTypes(); const orders: Record<string, number> = {};
  return itemCatalog.map((entry: CatalogItem, index) => {
    const seed = seeds[entry.id] ?? {};
    orders[entry.inspectionType] = (orders[entry.inspectionType] ?? 0) + 1;
    const options = entry.inputKind === "是非" ? ["是", "否"] : hasOptions(entry.inputKind) ? seed.options ?? [] : [];
    const summaries: ItemSummary[] = (seed.summaries ?? []).map(([summary, workType, limits], i) => ({ id: `${entry.id}-S${i + 1}`, summary, workType, sla: limits ?? null }));
    return {
      id: entry.id, code: entry.code, name: entry.name, inspectionType: entry.inspectionType, itemTypeId: types.find((type) => type.name === entry.category)!.id,
      inputKind: entry.inputKind, options, abnormal: seed.abnormal ?? [], ...(entry.inputKind === "輸入框" ? { maxLength: seed.maxLength ?? 500 } : {}),
      order: orders[entry.inspectionType], summaries, notifications: seed.notifications ?? [], auxiliary: seedAuxiliaryFor(entry.id), status: "生效", updatedBy: index % 3 ? "區詠珊" : "陳家朗", updatedAt: updates[index % updates.length],
    };
  });
}

// ---- 即時登記（與後台共用狀態同步） ----
// The App's inspection forms are generated from the back-office 巡查模板 (items, required, attachments, location settings) with the
// managed 巡查項目 fields. Items of the original App templates keep their result keys (e.g. "seat"), so seed results line up.
let items: ManagedItem[] = seedItems();
let types: ItemTypeRecord[] = seedItemTypes();
let templates: BackOfficeTemplate[] = structuredClone(initialTemplates);
let byId = new Map(items.map((item) => [item.id, item]));
let live: AppTemplate[] = [];

export const itemTypeName = (id: string) => types.find((type) => type.id === id)?.name ?? "未分類";
const baselineItem = (templateId: string, itemId: string) => baselineTemplates.find((template) => template.id === templateId)?.items.find((item) => item.itemId === itemId);
/** One App template item: the managed item's fields, the template's required / attachment settings, and the original result key when the App had this item. (輔助資料 is resolved from the managed item when shown; see aux-data.ts.) */
function appItem(templateId: string, setting: { itemId: string; required: boolean; minAttachments: number }): TemplateItem | undefined {
  const managed = byId.get(setting.itemId); if (!managed) return undefined;
  const base = baselineItem(templateId, setting.itemId); const choice = hasOptions(managed.inputKind);
  return {
    key: base?.key ?? managed.id, itemId: managed.id, name: managed.name, itemType: itemTypeName(managed.itemTypeId), kind: appKindOf[managed.inputKind],
    options: choice ? [...managed.options] : undefined, abnormal: choice ? [...managed.abnormal] : undefined, required: setting.required, minAttachments: setting.minAttachments,
    maxLength: managed.inputKind === "輸入框" ? managed.maxLength : undefined,
    summaries: managed.summaries.length ? managed.summaries.map((entry) => ({ summary: entry.summary, workType: entry.workType })) : undefined,
  };
}
function toAppTemplate(template: BackOfficeTemplate): AppTemplate {
  const distances = Object.fromEntries(template.objects.filter((entry) => entry.distance !== null).map((entry) => [entry.objectId, entry.distance as number]));
  return {
    id: template.id, name: template.name, inspectionType: template.inspectionType, status: template.status, locationCheck: template.locationCheck, validDistance: template.validDistance ?? 100,
    checkOn: [...template.checkOn], objectDistances: Object.keys(distances).length ? distances : undefined, objectIds: template.objects.map((entry) => entry.objectId),
    items: template.items.flatMap((setting) => appItem(template.id, setting) ?? []),
  };
}
function rebuild() { byId = new Map(items.map((item) => [item.id, item])); live = templates.map(toAppTemplate); }
rebuild();

/** Kept in step with the shared state by DemoProvider, so the App's inspection forms and the back office see the managed templates and items. */
export function setItemRegistry(nextItems: ManagedItem[], nextTypes: ItemTypeRecord[], nextTemplates: BackOfficeTemplate[] = templates) {
  if (nextItems === items && nextTypes === types && nextTemplates === templates) return;
  items = nextItems; types = nextTypes; templates = nextTemplates; rebuild();
}
export const getItem = (id: string) => byId.get(id);
export const getItems = () => items;
export const getItemTypes = () => types;
/** The managed items as template-catalog rows (category = item type name), for the template page and its rules. */
export const catalogView = (list: ManagedItem[] = items): CatalogItem[] => list.map((item) => ({ id: item.id, code: item.code, name: item.name, inspectionType: item.inspectionType, category: itemTypeName(item.itemTypeId), inputKind: item.inputKind }));
/** Every 巡查模板 as an App inspection form (including 失效 ones, so existing inspections keep resolving). */
export const liveAppTemplates = () => live;
/** 生效 templates: what pickers offer for new inspections and plans. */
export const activeAppTemplates = () => live.filter((template) => template.status !== "失效");
export const appTemplate = (id: string) => live.find((template) => template.id === id);
export const inspectionTemplateName = (id: string) => appTemplate(id)?.name ?? baselineTemplates.find((template) => template.id === id)?.name ?? id;
export const baselineTemplate = (id: string) => baselineTemplates.find((template) => template.id === id);
/** Whether a template applies to an object: same inspection type, and the template lists no objects (all of the type) or lists this one. */
export const templateAppliesTo = (template: Pick<AppTemplate, "inspectionType" | "objectIds">, object: { id: string; inspectionType: string }) => template.inspectionType === object.inspectionType && (!template.objectIds?.length || template.objectIds.includes(object.id));
/** The items an App inspection uses: its own snapshot, else the original App template for completed seed inspections, else the live template. */
export function itemsForInspection(inspection: { templateId: string; status: string; items?: TemplateItem[] }): TemplateItem[] {
  if (inspection.items) return inspection.items;
  if (inspection.status === "已完成") { const base = baselineTemplate(inspection.templateId); if (base) return base.items; }
  return appTemplate(inspection.templateId)?.items ?? [];
}
/** The managed item behind an App template item key (e.g. "seat" in TPL001). */
export const managedItemOf = (templateId: string, key?: string) => { const itemId = (appTemplate(templateId)?.items ?? baselineTemplate(templateId)?.items ?? []).find((item) => item.key === key)?.itemId; return itemId ? byId.get(itemId) : undefined; };
