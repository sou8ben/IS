// Inspection template data and validation. Kept import-free so tests can transpile and run it directly.

export type CheckPoint = "開始填寫" | "提交";
export type InputKind = "是非" | "單選" | "多選" | "輸入框" | "簽名";
export type TemplateTab = "basic" | "items" | "objects" | "groups";
export interface CatalogItem { id: string; code: string; name: string; inspectionType: string; category: string; inputKind: InputKind }
export interface CatalogObject { id: string; code: string; name: string; inspectionType: string; grid: string; address: string }
export interface TemplateItemSetting { itemId: string; required: boolean; minAttachments: number }
/** distance null = use the template's default effective distance. */
export interface TemplateObjectSetting { objectId: string; distance: number | null }
export interface InspectionTemplate {
  id: string;
  code: string;
  name: string;
  inspectionType: string;
  description: string;
  locationCheck: boolean;
  validDistance: number | null;
  checkOn: CheckPoint[];
  items: TemplateItemSetting[];
  objects: TemplateObjectSetting[];
  groups: string[];
  status: "生效" | "失效";
  planTemplateRefs: number;
  updatedBy: string;
  updatedAt: string;
}
export interface TemplateError { tab: TemplateTab; message: string }

export const checkPoints: CheckPoint[] = ["開始填寫", "提交"];
export const inspectionTypes = ["公園設施巡查", "街道環境巡查", "綠化設施巡查", "海濱設施巡查", "公共廁所巡查"];
export const DISTANCE_MIN = 10;
export const DISTANCE_MAX = 1000;
export const ATTACHMENTS_MAX = 10;

const item = (code: string, name: string, inspectionType: string, category: string, inputKind: InputKind): CatalogItem => ({ id: code, code, name, inspectionType, category, inputKind });
export const itemCatalog: CatalogItem[] = [
  item("ITEM-001", "座椅穩固狀態", "公園設施巡查", "一般設施", "是非"),
  item("ITEM-002", "照明設施狀態", "公園設施巡查", "照明設施", "單選"),
  item("ITEM-006", "遊樂設施安全", "公園設施巡查", "一般設施", "多選"),
  item("ITEM-003", "垃圾桶清潔度", "公園設施巡查", "環境衛生", "單選"),
  item("ITEM-007", "灌溉水管", "公園設施巡查", "供水設施", "單選"),
  item("ITEM-008", "地面狀況描述", "公園設施巡查", "一般設施", "輸入框"),
  item("ITEM-009", "管理處人員簽名", "公園設施巡查", "一般設施", "簽名"),
  item("ITEM-010", "飲水機狀態", "公園設施巡查", "供水設施", "是非"),
  item("ITEM-011", "告示牌完整性", "公園設施巡查", "一般設施", "單選"),
  item("ITEM-012", "路面狀況", "街道環境巡查", "道路設施", "單選"),
  item("ITEM-013", "有否垃圾堆積", "街道環境巡查", "環境衛生", "是非"),
  item("ITEM-005", "指示牌清晰度", "街道環境巡查", "一般設施", "單選"),
  item("ITEM-014", "其他觀察", "街道環境巡查", "一般設施", "輸入框"),
  item("ITEM-015", "渠蓋狀況", "街道環境巡查", "道路設施", "單選"),
  item("ITEM-016", "違例張貼廣告", "街道環境巡查", "環境衛生", "是非"),
  item("ITEM-017", "路燈狀態", "街道環境巡查", "照明設施", "單選"),
  item("ITEM-024", "樹木健康狀況", "綠化設施巡查", "綠化設施", "單選"),
  item("ITEM-025", "樹枝阻礙通行", "綠化設施巡查", "綠化設施", "是非"),
  item("ITEM-004", "灌溉系統狀態", "綠化設施巡查", "供水設施", "單選"),
  item("ITEM-026", "花圃狀況", "綠化設施巡查", "綠化設施", "單選"),
  item("ITEM-027", "病蟲害情況", "綠化設施巡查", "綠化設施", "多選"),
  item("ITEM-028", "其他觀察", "綠化設施巡查", "一般設施", "輸入框"),
  item("ITEM-018", "欄杆穩固", "海濱設施巡查", "一般設施", "是非"),
  item("ITEM-019", "救生圈", "海濱設施巡查", "一般設施", "單選"),
  item("ITEM-020", "照明設施狀態", "海濱設施巡查", "照明設施", "單選"),
  item("ITEM-021", "其他觀察", "海濱設施巡查", "一般設施", "輸入框"),
  item("ITEM-022", "步道路面", "海濱設施巡查", "道路設施", "單選"),
  item("ITEM-023", "垃圾桶清潔度", "海濱設施巡查", "環境衛生", "單選"),
  item("ITEM-029", "地面清潔程度", "公共廁所巡查", "環境衛生", "單選"),
  item("ITEM-030", "洗手液供應", "公共廁所巡查", "環境衛生", "是非"),
  item("ITEM-031", "通風設備運作", "公共廁所巡查", "一般設施", "是非"),
  item("ITEM-032", "無障礙設施狀態", "公共廁所巡查", "一般設施", "單選"),
  item("ITEM-033", "管理處人員簽名", "公共廁所巡查", "一般設施", "簽名"),
];

const object = (code: string, name: string, inspectionType: string, grid: string, address: string): CatalogObject => ({ id: code, code, name, inspectionType, grid, address });
export const objectCatalog: CatalogObject[] = [
  object("OBJ-001", "黑沙環公園", "公園設施巡查", "花地瑪堂北區", "黑沙環海邊馬路"),
  object("OBJ-003", "紀念孫中山市政公園", "公園設施巡查", "花地瑪堂北區", "慕拉士大馬路"),
  object("OBJ-013", "黑沙環公園兒童遊樂區", "公園設施巡查", "花地瑪堂北區", "黑沙環公園西側"),
  object("OBJ-007", "盧廉若公園", "公園設施巡查", "望德堂中區", "荷蘭園大馬路"),
  object("OBJ-008", "二龍喉公園", "公園設施巡查", "望德堂中區", "士多鳥拜斯大馬路"),
  object("OBJ-009", "華士古達嘉馬花園", "公園設施巡查", "大堂南區", "東望洋街"),
  object("OBJ-010", "白鴿巢公園", "公園設施巡查", "大堂南區", "白鴿巢前地"),
  object("OBJ-004", "嘉模公園", "公園設施巡查", "氹仔中央區", "氹仔嘉模前地"),
  object("OBJ-011", "氹仔中央公園", "公園設施巡查", "氹仔中央區", "氹仔布拉干薩街"),
  object("OBJ-012", "石排灣郊野公園", "公園設施巡查", "路環東區", "路環石排灣馬路"),
  object("OBJ-002", "塔石廣場", "街道環境巡查", "望德堂中區", "塔石廣場"),
  object("OBJ-016", "美副將大馬路", "街道環境巡查", "望德堂中區", "美副將大馬路"),
  object("OBJ-014", "新馬路行人區", "街道環境巡查", "大堂南區", "新馬路"),
  object("OBJ-015", "議事亭前地", "街道環境巡查", "大堂南區", "議事亭前地"),
  object("OBJ-017", "筷子基北街", "街道環境巡查", "花地瑪堂北區", "筷子基北街"),
  object("OBJ-019", "黑沙環中街", "街道環境巡查", "花地瑪堂北區", "黑沙環中街"),
  object("OBJ-018", "施督憲正街", "街道環境巡查", "氹仔中央區", "氹仔施督憲正街"),
  object("OBJ-006", "路環步行徑", "綠化設施巡查", "路環東區", "路環石排灣郊野公園步行徑"),
  object("OBJ-025", "松山市政公園樹木區", "綠化設施巡查", "望德堂中區", "東望洋山"),
  object("OBJ-027", "美副將大馬路行道樹", "綠化設施巡查", "望德堂中區", "美副將大馬路"),
  object("OBJ-028", "白鴿巢公園古樹", "綠化設施巡查", "大堂南區", "白鴿巢前地"),
  object("OBJ-026", "嘉模公園花圃", "綠化設施巡查", "氹仔中央區", "氹仔嘉模前地"),
  object("OBJ-029", "黑沙環公園綠化帶", "綠化設施巡查", "花地瑪堂北區", "黑沙環海邊馬路"),
  object("OBJ-005", "黑沙海灘休憩區", "海濱設施巡查", "路環東區", "路環黑沙海灘"),
  object("OBJ-022", "竹灣海灘", "海濱設施巡查", "路環東區", "路環竹灣馬路"),
  object("OBJ-020", "黑沙環海濱休憩區", "海濱設施巡查", "花地瑪堂北區", "黑沙環海濱"),
  object("OBJ-024", "外港海濱步行徑", "海濱設施巡查", "花地瑪堂北區", "友誼大馬路海濱"),
  object("OBJ-021", "西灣湖景大馬路休憩區", "海濱設施巡查", "大堂南區", "西灣湖景大馬路"),
  object("OBJ-023", "氹仔海濱休憩區", "海濱設施巡查", "氹仔中央區", "氹仔海邊馬路"),
  object("OBJ-030", "黑沙環公園公共洗手間", "公共廁所巡查", "花地瑪堂北區", "黑沙環公園"),
  object("OBJ-031", "塔石廣場公共洗手間", "公共廁所巡查", "望德堂中區", "塔石廣場"),
  object("OBJ-032", "議事亭前地公共洗手間", "公共廁所巡查", "大堂南區", "議事亭前地"),
  object("OBJ-033", "嘉模公園公共洗手間", "公共廁所巡查", "氹仔中央區", "氹仔嘉模前地"),
  object("OBJ-034", "黑沙海灘公共洗手間", "公共廁所巡查", "路環東區", "路環黑沙海灘"),
];

const req = (itemId: string, minAttachments = 0): TemplateItemSetting => ({ itemId, required: true, minAttachments });
const opt = (itemId: string, minAttachments = 0): TemplateItemSetting => ({ itemId, required: false, minAttachments });
const obj = (objectId: string, distance: number | null = null): TemplateObjectSetting => ({ objectId, distance });

export const initialTemplates: InspectionTemplate[] = [
  { id: "TPL001", code: "TPL001", name: "公園設施標準巡查表", inspectionType: "公園設施巡查", description: "按順序檢查座椅、照明、遊樂設施及衛生狀況；發現異常須拍照並建立工作，完成後由管理處人員簽名確認。", locationCheck: true, validDistance: 100, checkOn: ["開始填寫", "提交"], items: [req("ITEM-001"), req("ITEM-006", 1), opt("ITEM-008"), req("ITEM-009"), req("ITEM-002"), req("ITEM-003"), opt("ITEM-007", 2)], objects: [obj("OBJ-001"), obj("OBJ-003"), obj("OBJ-013", 50), obj("OBJ-007")], groups: ["inspect-north"], status: "生效", planTemplateRefs: 2, updatedBy: "陳家朗", updatedAt: "2026-09-29 10:20" },
  { id: "TPL002", code: "TPL002", name: "街道環境標準巡查表", inspectionType: "街道環境巡查", description: "沿步行路線檢查路面、垃圾堆積及標示狀況。", locationCheck: true, validDistance: 100, checkOn: ["提交"], items: [req("ITEM-012"), req("ITEM-013"), req("ITEM-005"), opt("ITEM-014")], objects: [], groups: ["inspect-middle"], status: "生效", planTemplateRefs: 1, updatedBy: "系統管理員", updatedAt: "2026-09-28 15:42" },
  { id: "TPL003", code: "TPL003", name: "綠化設施巡查表", inspectionType: "綠化設施巡查", description: "檢查樹木健康、阻礙通行及灌溉系統；病蟲害須附相片。", locationCheck: true, validDistance: 150, checkOn: ["提交"], items: [req("ITEM-024", 1), req("ITEM-025"), opt("ITEM-026"), opt("ITEM-027", 1), opt("ITEM-004")], objects: [obj("OBJ-006", 300), obj("OBJ-027")], groups: ["inspect-island"], status: "生效", planTemplateRefs: 1, updatedBy: "李芷晴", updatedAt: "2026-09-27 11:05" },
  { id: "TPL004", code: "TPL004", name: "海濱設施巡查表", inspectionType: "海濱設施巡查", description: "檢查欄杆、救生圈及照明設施。", locationCheck: true, validDistance: 100, checkOn: ["提交"], items: [req("ITEM-018"), req("ITEM-019"), opt("ITEM-021"), req("ITEM-020")], objects: [obj("OBJ-005"), obj("OBJ-020")], groups: [], status: "生效", planTemplateRefs: 0, updatedBy: "陳家朗", updatedAt: "2026-09-26 09:48" },
  { id: "TPL005", code: "TPL005", name: "公共廁所巡查表", inspectionType: "公共廁所巡查", description: "檢查清潔、洗手液及通風設備；地面不潔須附相片。", locationCheck: true, validDistance: 50, checkOn: ["開始填寫", "提交"], items: [req("ITEM-029", 1), req("ITEM-030"), req("ITEM-031"), opt("ITEM-032"), req("ITEM-033")], objects: [], groups: [], status: "失效", planTemplateRefs: 0, updatedBy: "黃志峰", updatedAt: "2026-09-24 16:30" },
  { id: "TPL006", code: "TPL006", name: "公園夜間照明巡查表", inspectionType: "公園設施巡查", description: "夜間檢查照明及告示牌，車巡為主，不作定位檢查。", locationCheck: false, validDistance: 100, checkOn: [], items: [req("ITEM-002", 1), opt("ITEM-011"), opt("ITEM-008")], objects: [obj("OBJ-001"), obj("OBJ-011")], groups: ["inspect-north", "inspect-island"], status: "生效", planTemplateRefs: 0, updatedBy: "陳家朗", updatedAt: "2026-09-25 20:15" },
];

export function newTemplate(): InspectionTemplate {
  return { id: "", code: "", name: "", inspectionType: "", description: "", locationCheck: true, validDistance: 100, checkOn: ["提交"], items: [], objects: [], groups: [], status: "生效", planTemplateRefs: 0, updatedBy: "", updatedAt: "" };
}

export function moveItem<T>(list: T[], from: number, to: number): T[] {
  if (from === to || from < 0 || to < 0 || from >= list.length || to >= list.length) return list;
  const next = [...list];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return next;
}

export interface ItemCategoryGroup { category: string; settings: TemplateItemSetting[] }

export function categoryOf(itemId: string): string {
  return itemCatalog.find((entry) => entry.id === itemId)?.category ?? "未分類";
}

/** Items grouped by 項目類型, groups in order of first appearance. */
export function groupItemsByCategory(items: TemplateItemSetting[]): ItemCategoryGroup[] {
  const groups: ItemCategoryGroup[] = [];
  for (const setting of items) {
    const category = categoryOf(setting.itemId);
    const group = groups.find((entry) => entry.category === category);
    if (group) group.settings.push(setting); else groups.push({ category, settings: [setting] });
  }
  return groups;
}

/** Keeps items of the same category adjacent; new items join the end of their category. */
export function normalizeItems(items: TemplateItemSetting[]): TemplateItemSetting[] {
  return groupItemsByCategory(items).flatMap((group) => group.settings);
}

export function moveCategory(items: TemplateItemSetting[], from: number, to: number): TemplateItemSetting[] {
  return moveItem(groupItemsByCategory(items), from, to).flatMap((group) => group.settings);
}

/** Effective distance for one object, or null when the template has no location check. */
export function effectiveDistance(template: InspectionTemplate, objectId: string): number | null {
  if (!template.locationCheck) return null;
  return template.objects.find((setting) => setting.objectId === objectId)?.distance ?? template.validDistance;
}

const isIntIn = (value: number | null, min: number, max: number) => value !== null && Number.isInteger(value) && value >= min && value <= max;

export function validateTemplate(template: InspectionTemplate, all: InspectionTemplate[], allowedGroupIds: string[]): TemplateError[] {
  const errors: TemplateError[] = [];
  const add = (tab: TemplateTab, message: string) => errors.push({ tab, message });
  const others = all.filter((item) => item.id !== template.id);
  const code = template.code.trim(); const name = template.name.trim();
  if (!code) add("basic", "請輸入模板編號。");
  else if (others.some((item) => item.code.trim().toLowerCase() === code.toLowerCase())) add("basic", `模板編號「${code}」已存在。`);
  if (!name) add("basic", "請輸入模板名稱。");
  else if ([...name].length > 50) add("basic", "模板名稱不可超過 50 字。");
  else if (template.inspectionType && others.some((item) => item.inspectionType === template.inspectionType && item.name.trim() === name)) add("basic", `「${template.inspectionType}」已有同名模板「${name}」。`);
  if (!template.inspectionType) add("basic", "請選擇巡查類型。");
  else if (!inspectionTypes.includes(template.inspectionType)) add("basic", "巡查類型不存在。");
  if (template.locationCheck) {
    if (!isIntIn(template.validDistance, DISTANCE_MIN, DISTANCE_MAX)) add("basic", `有效距離須為 ${DISTANCE_MIN}–${DISTANCE_MAX} 米的整數。`);
    if (!template.checkOn.length) add("basic", "定位檢查開啟時須選擇至少一個檢查時點。");
  }
  if (!template.items.length) add("items", "模板至少需要 1 個巡查項目。");
  const itemIds = template.items.map((setting) => setting.itemId);
  if (new Set(itemIds).size !== itemIds.length) add("items", "巡查項目不可重複加入。");
  const foreignItems = template.items.filter((setting) => itemCatalog.find((entry) => entry.id === setting.itemId)?.inspectionType !== template.inspectionType);
  if (template.inspectionType && foreignItems.length) add("items", "只可加入同一巡查類型的巡查項目。");
  if (normalizeItems(template.items).some((setting, index) => setting !== template.items[index])) add("items", "同一項目類型的巡查項目須相鄰排列。");
  if (template.items.some((setting) => !isIntIn(setting.minAttachments, 0, ATTACHMENTS_MAX))) add("items", `最少附件數須為 0–${ATTACHMENTS_MAX} 的整數。`);
  const objectIds = template.objects.map((setting) => setting.objectId);
  if (new Set(objectIds).size !== objectIds.length) add("objects", "適用對象不可重複加入。");
  const foreignObjects = template.objects.filter((setting) => objectCatalog.find((entry) => entry.id === setting.objectId)?.inspectionType !== template.inspectionType);
  if (template.inspectionType && foreignObjects.length) add("objects", "只可加入同一巡查類型的對象。");
  if (template.locationCheck && template.objects.some((setting) => setting.distance !== null && !isIntIn(setting.distance, DISTANCE_MIN, DISTANCE_MAX))) add("objects", `對象有效距離須留空或為 ${DISTANCE_MIN}–${DISTANCE_MAX} 米的整數。`);
  if (template.groups.some((group) => !allowedGroupIds.includes(group))) add("groups", "適用群組只可選擇巡查群組。");
  return errors;
}
