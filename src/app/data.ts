import type { AppState, Inspection, InspectionTemplate, ItemResult, MapObject, Persona, Photo, WorkLog } from "./types";

export const asset = (name: string) => `${import.meta.env.BASE_URL}assets/${name}`;
export const MAP_SIZE = { width: 1536, height: 1024 };
/** 底圖每像素約等於的米數（示範比例） */
export const METERS_PER_PX = 2.6;

export const personas: Persona[] = [
  { id: "P1", name: "陳家朗", account: "chan.kl", role: "巡查主管", dept: "市政管理廳", groups: [{ name: "北區巡查一組", kind: "巡查" }, { name: "中區巡查組", kind: "巡查" }, { name: "北區報告組", kind: "報告" }] },
  { id: "P2", name: "黃志峰", account: "wong.cf", role: "工作執行人員", dept: "園林綠化處", groups: [{ name: "公園設施維護組", kind: "執行" }, { name: "綠化養護組", kind: "執行" }] },
  { id: "P3", name: "梁嘉敏", account: "leung.km", role: "設施管理主任", dept: "市政管理廳", groups: [{ name: "公共設施管理組", kind: "管理" }, { name: "環境衛生管理組", kind: "管理" }], acceptTypes: ["公共設施", "環境衛生", "綠化", "道路設施"] },
];

export const DEMO_PASSWORD = "123456";

/** 可作同行人的帳號（示範通訊錄） */
export const directory = [
  { account: "chan.kl", name: "陳家朗", dept: "北區巡查一組" },
  { account: "au.ws", name: "區詠珊", dept: "北區巡查一組" },
  { account: "lei.cc", name: "李芷晴", dept: "離島巡查組" },
  { account: "ho.hy", name: "何浩然", dept: "環境衛生執行組" },
  { account: "wong.cf", name: "黃志峰", dept: "公園設施維護組" },
  { account: "leung.km", name: "梁嘉敏", dept: "公共設施管理組" },
  { account: "kwan.mt", name: "關文婷", dept: "北區巡查一組" },
  { account: "lo.ks", name: "盧嘉聲", dept: "中區巡查組" },
];

export const execGroups = ["公園設施維護組", "環境衛生執行組", "綠化養護組", "道路維修組"];

export const addressBook = [
  { name: "黑沙環公園", parish: "花地瑪堂區", street: "黑沙環馬路", number: "—", building: "黑沙環公園", x: 640, y: 112 },
  { name: "黑沙環海濱座椅區", parish: "花地瑪堂區", street: "黑沙環海邊馬路", number: "—", building: "海濱座椅區", x: 655, y: 198 },
  { name: "黑沙環海濱休憩區", parish: "花地瑪堂區", street: "黑沙環海邊馬路", number: "—", building: "海濱休憩區", x: 716, y: 170 },
  { name: "美副將大馬路 42 號", parish: "望德堂區", street: "美副將大馬路", number: "42", building: "美副將大廈", x: 560, y: 238 },
  { name: "塔石廣場", parish: "望德堂區", street: "荷蘭園大馬路", number: "—", building: "塔石廣場", x: 548, y: 256 },
  { name: "議事亭前地", parish: "大堂區", street: "新馬路", number: "—", building: "議事亭前地", x: 470, y: 330 },
  { name: "筷子基北灣大馬路", parish: "花地瑪堂區", street: "筷子基北灣大馬路", number: "—", building: "筷子基社屋", x: 470, y: 170 },
  { name: "嘉模公園", parish: "嘉模堂區", street: "施督憲正街", number: "—", building: "嘉模公園", x: 640, y: 520 },
  { name: "黑沙海灘巴士站", parish: "聖方濟各堂區", street: "黑沙馬路", number: "—", building: "黑沙海灘", x: 1000, y: 850 },
];

/** 用戶當前位置（示範固定點，近黑沙環海濱座椅區） */
export const myLocation = { x: 652, y: 194, accuracy: 8 };

export const photoAssets = { seat: asset("app/seat.svg"), bin: asset("app/bin.svg"), tree: asset("app/tree.svg"), sign: asset("app/sign.svg"), pipe: asset("app/pipe.svg") };

// ---- 巡查計劃模板 ----
// Baseline App templates: membership, order, required and attachments are fixed here; the item fields
// (name, type, kind, options, abnormal values, summaries) come live from the managed 巡查項目 via `itemId` (see item-data.ts).
// Completed seed inspections keep this baseline as their snapshot.
export const templates: InspectionTemplate[] = [
  { id: "TPL001", name: "公園設施標準巡查表", inspectionType: "公園設施巡查", locationCheck: true, validDistance: 100, checkOn: ["開始填寫", "提交"], items: [
    { key: "seat", itemId: "ITEM-001", name: "座椅穩固狀態", itemType: "一般設施", kind: "BOOL", options: ["是", "否"], abnormal: ["否"], required: true, minAttachments: 0, summaries: [{ summary: "座椅固定螺絲鬆脫", workType: "公共設施／座椅" }, { summary: "座椅木條破損", workType: "公共設施／座椅" }] },
    { key: "light", itemId: "ITEM-002", name: "照明設施狀態", itemType: "照明設施", kind: "SINGLE", options: ["正常", "閃爍", "不亮"], abnormal: ["閃爍", "不亮"], required: true, minAttachments: 0, summaries: [{ summary: "燈具故障", workType: "公共設施／照明" }] },
    { key: "play", itemId: "ITEM-006", name: "遊樂設施安全", itemType: "一般設施", kind: "MULTI", options: ["正常", "部件鬆脫", "表面破損", "尖角外露"], abnormal: ["部件鬆脫", "表面破損", "尖角外露"], required: true, minAttachments: 1, summaries: [{ summary: "遊樂設施部件鬆脫", workType: "公共設施／遊樂設施" }] },
    { key: "bin", itemId: "ITEM-003", name: "垃圾桶清潔度", itemType: "環境衛生", kind: "SINGLE", options: ["清潔", "一般", "滿溢"], abnormal: ["滿溢"], required: true, minAttachments: 0, summaries: [{ summary: "垃圾桶滿溢", workType: "環境衛生／清潔" }] },
    { key: "pipe", itemId: "ITEM-007", name: "灌溉水管", itemType: "供水設施", kind: "SINGLE", options: ["正常", "滲漏"], abnormal: ["滲漏"], required: false, minAttachments: 2, summaries: [{ summary: "灌溉水管滲漏", workType: "綠化／灌溉" }] },
    { key: "ground", itemId: "ITEM-008", name: "地面狀況描述", itemType: "一般設施", kind: "TEXT", required: false, minAttachments: 0, maxLength: 500 },
    { key: "sign", itemId: "ITEM-009", name: "管理處人員簽名", itemType: "一般設施", kind: "SIGNATURE", required: true, minAttachments: 0 },
  ] },
  { id: "TPL002", name: "街道環境標準巡查表", inspectionType: "街道環境巡查", locationCheck: true, validDistance: 100, checkOn: ["提交"], items: [
    { key: "road", itemId: "ITEM-012", name: "路面狀況", itemType: "道路設施", kind: "SINGLE", options: ["良好", "破損", "積水"], abnormal: ["破損", "積水"], required: true, minAttachments: 0, summaries: [{ summary: "路面破損", workType: "道路設施／路面" }, { summary: "路面積水", workType: "環境衛生／積水" }] },
    { key: "waste", itemId: "ITEM-013", name: "有否垃圾堆積", itemType: "環境衛生", kind: "BOOL", options: ["是", "否"], abnormal: ["是"], required: true, minAttachments: 0, summaries: [{ summary: "垃圾堆積", workType: "環境衛生／清潔" }] },
    { key: "signage", itemId: "ITEM-005", name: "指示牌清晰度", itemType: "一般設施", kind: "SINGLE", options: ["清晰", "褪色", "損毀"], abnormal: ["褪色", "損毀"], required: true, minAttachments: 0, summaries: [{ summary: "指示牌字樣褪色", workType: "公共設施／標示" }] },
    { key: "note", itemId: "ITEM-014", name: "其他觀察", itemType: "一般設施", kind: "TEXT", required: false, minAttachments: 0, maxLength: 500 },
  ] },
  { id: "TPL004", name: "海濱設施巡查表", inspectionType: "海濱設施巡查", locationCheck: true, validDistance: 100, checkOn: ["提交"], items: [
    { key: "rail", itemId: "ITEM-018", name: "欄杆穩固", itemType: "一般設施", kind: "BOOL", options: ["是", "否"], abnormal: ["否"], required: true, minAttachments: 0, summaries: [{ summary: "海濱欄杆鬆動", workType: "道路設施／欄杆" }] },
    { key: "buoy", itemId: "ITEM-019", name: "救生圈", itemType: "一般設施", kind: "SINGLE", options: ["齊備", "缺失"], abnormal: ["缺失"], required: true, minAttachments: 0, summaries: [{ summary: "救生圈缺失", workType: "公共設施／標示" }] },
    { key: "light", itemId: "ITEM-020", name: "照明設施狀態", itemType: "照明設施", kind: "SINGLE", options: ["正常", "閃爍", "不亮"], abnormal: ["閃爍", "不亮"], required: true, minAttachments: 0, summaries: [{ summary: "燈具故障", workType: "公共設施／照明" }] },
    { key: "note", itemId: "ITEM-021", name: "其他觀察", itemType: "一般設施", kind: "TEXT", required: false, minAttachments: 0, maxLength: 500 },
  ] },
];

// ---- 計劃對象及路線 ----
const parkObjects: [string, number, number, number][] = [
  ["黑沙環公園東門", 600, 78, 280], ["兒童遊樂區", 622, 90, 232], ["中央花圃", 645, 100, 205], ["休憩亭", 668, 115, 195], ["公園洗手間", 688, 135, 180], ["健身設施區", 695, 158, 142], ["緩跑徑南段", 684, 182, 88],
  ["海濱座椅區 A", 662, 200, 26], ["海濱座椅區 B", 636, 202, 42], ["垃圾收集點", 612, 188, 96], ["照明燈柱組", 590, 165, 245], ["西入口指示牌", 578, 140, 62],
];

function spread(prefix: string, names: string[], cx: number, cy: number, radius: number, type: string, grid: string, street: string): MapObject[] {
  return names.map((name, index) => {
    const angle = (index / names.length) * Math.PI * 1.6 - Math.PI * 0.3;
    const x = Math.round(cx + Math.cos(angle) * radius * (0.6 + (index % 3) * 0.2));
    const y = Math.round(cy + Math.sin(angle) * radius * (0.6 + (index % 2) * 0.3));
    return { id: `${prefix}-${String(index + 1).padStart(2, "0")}`, name, type, address: `${street}${name}`, grid, x, y, distance: 60 + index * 37 };
  });
}

export const planObjects: Record<string, MapObject[]> = {
  "PL-20260929-0003": parkObjects.map(([name, x, y, distance], index) => ({ id: `OBJ-P03-${String(index + 1).padStart(2, "0")}`, name, type: "公園設施", address: `黑沙環公園${name}`, grid: "花地瑪堂北區", x, y, distance, nfc: index === 4 ? "NFC-0012" : undefined })),
  "PL-20260929-0005": spread("OBJ-P05", ["海濱步道北段", "觀景台", "海濱欄杆 A", "海濱欄杆 B", "救生圈站"], 718, 176, 34, "海濱設施", "花地瑪堂北區", "黑沙環海邊馬路"),
  "PL-20260929-0006": spread("OBJ-P06", ["北灣大馬路行人道", "筷子基巴士站", "社屋休憩區", "街市外圍"], 468, 176, 30, "街道環境", "花地瑪堂西區", "筷子基"),
  "PL-20260929-0004": spread("OBJ-P04", ["新馬路東段", "議事亭前地", "板樟堂街", "營地大街", "草堆街", "關前正街", "十月初五日街", "爐石塘巷", "大堂巷", "賣草地街", "大三巴街", "戀愛巷", "白馬行", "水坑尾街", "東望洋街", "南灣大馬路", "西灣湖景", "亞美打利庇盧大馬路"], 510, 312, 48, "街道環境", "大堂中區", "大堂區"),
  "PL-20260928-0018": spread("OBJ-P18", ["嘉模公園北側花圃", "嘉模公園溫室", "龍環葡韻", "氹仔中央公園入口", "中央公園噴水池", "中央公園兒童區", "中央公園洗手間", "花城公園", "海洋花園", "木棉街休憩區", "告利雅施利華街", "氹仔舊城區", "官也街", "消防局前地", "運動場外圍"], 640, 530, 60, "公園設施", "氹仔中央區", "氹仔"),
  "PL-20260927-0012": spread("OBJ-P12", ["黑沙水庫步道", "九澳水庫步道", "石排灣步道", "叠石塘山步道", "黑沙海灘休憩區", "路環步行徑入口", "天后古廟前地", "竹灣觀景台", "路環碼頭"], 900, 830, 90, "步道設施", "路環東區", "路環"),
};

export const planRoutes: Record<string, [number, number][]> = {
  "PL-20260929-0003": [[586, 70], [612, 84], [650, 98], [690, 128], [700, 165], [676, 198], [630, 206], [592, 176], [575, 142]],
  "PL-20260929-0005": [[700, 150], [724, 160], [734, 186], [712, 204]],
  "PL-20260929-0006": [[446, 160], [470, 150], [494, 178], [470, 200]],
  "PL-20260929-0004": [[468, 286], [512, 272], [556, 300], [540, 346], [486, 352]],
  "PL-20260928-0018": [[586, 486], [640, 470], [700, 510], [682, 572], [604, 580]],
  "PL-20260927-0012": [[812, 780], [900, 760], [990, 820], [940, 900], [840, 890]],
};

export const planTemplateOf: Record<string, string> = { "PL-20260929-0003": "TPL001", "PL-20260929-0005": "TPL004", "PL-20260929-0006": "TPL002", "PL-20260929-0004": "TPL002", "PL-20260928-0018": "TPL001", "PL-20260927-0012": "TPL002" };

/** 預設被他人搶先佔用的計劃（示範搶鎖失敗） */
export const lockHolders: Record<string, string> = { "PL-20260929-0004": "區詠珊" };

export const objectIndex: Record<string, MapObject> = Object.fromEntries(Object.values(planObjects).flat().map((object) => [object.id, object]));

/** 獨立巡查可選的對象（不屬任何計劃的附近對象） */
export const nearbyObjects: MapObject[] = [...planObjects["PL-20260929-0003"], ...planObjects["PL-20260929-0005"], ...planObjects["PL-20260929-0006"]];

function normalResult(template: InspectionTemplate): Record<string, ItemResult> {
  return Object.fromEntries(template.items.map((item) => {
    const value = item.kind === "BOOL" ? (item.abnormal?.includes("是") ? "否" : "是") : item.kind === "SINGLE" ? item.options?.[0] : item.kind === "MULTI" ? [item.options?.[0] ?? ""] : item.kind === "TEXT" ? "狀況良好" : undefined;
    const photos: Photo[] = Array.from({ length: item.minAttachments }, (_, index) => ({ id: `seed-${item.key}-${index}`, src: item.key === "pipe" ? photoAssets.pipe : photoAssets.seat, name: `現場相片_${index + 1}.jpg`, watermark: "2026-09-29 08:52 巡查存檔", kind: "image" }));
    return [item.key, { value, photos, signature: item.kind === "SIGNATURE" ? "seed" : undefined }];
  }));
}

function seedInspections(): Inspection[] {
  let serial = 1;
  const doneCount: Record<string, number> = { "PL-20260929-0003": 7, "PL-20260928-0018": 15, "PL-20260927-0012": 3 };
  const inspectors: Record<string, string> = { "PL-20260929-0003": "陳家朗", "PL-20260928-0018": "李芷晴", "PL-20260927-0012": "李芷晴" };
  const list: Inspection[] = [];
  for (const [planId, objects] of Object.entries(planObjects)) {
    const template = templates.find((item) => item.id === planTemplateOf[planId])!;
    const date = planId.slice(3, 11);
    objects.forEach((object, index) => {
      const done = index < (doneCount[planId] ?? 0);
      const id = planId === "PL-20260929-0003" ? `IN-20260929-${String(23 + index).padStart(4, "0")}` : `IN-${date}-${String(100 + serial++).padStart(4, "0")}`;
      const results = done ? normalResult(template) : {};
      if (id === "IN-20260929-0024") results.seat = { value: "否", remark: "左側固定螺絲鬆脫", photos: [{ id: "seed-seat", src: photoAssets.seat, name: "座椅螺絲.jpg", watermark: "2026-09-29 09:14 黑沙環公園", kind: "image" }] };
      const time = `${planId === "PL-20260929-0003" ? "2026-09-29" : `${date.slice(0, 4)}-${date.slice(4, 6)}-${date.slice(6, 8)}`} ${String(8 + Math.floor((index * 17 + 40) / 60)).padStart(2, "0")}:${String((index * 17 + 40) % 60).padStart(2, "0")}`;
      list.push({ id, planId, objectId: object.id, templateId: template.id, seq: index + 1, status: done ? "已完成" : "未完成", inspector: done ? inspectors[planId] : undefined, startedAt: done ? time : undefined, submittedAt: done ? time : undefined, results, location: done ? { passed: true, distance: 12 + index * 3, accuracy: 8 } : undefined });
    });
  }
  return list;
}

// ---- 類型樹 ----
export interface TreeNode { label: string; value: string; children?: TreeNode[] }
export interface FieldDef { name: string; kind: "BOOL" | "SINGLE" | "TEXT"; options?: string[]; required: boolean }

export const eventTypeTree: TreeNode[] = [
  { label: "公共設施異常", value: "公共設施異常", children: [{ label: "座椅", value: "座椅" }, { label: "照明", value: "照明" }, { label: "標示", value: "標示" }] },
  { label: "環境衛生問題", value: "環境衛生問題", children: [{ label: "積水", value: "積水" }, { label: "垃圾堆積", value: "垃圾堆積" }] },
  { label: "綠化問題", value: "綠化問題", children: [{ label: "樹木", value: "樹木" }, { label: "草地", value: "草地" }] },
  { label: "道路通行問題", value: "道路通行問題", children: [{ label: "路面破損", value: "路面破損" }, { label: "障礙物", value: "障礙物" }] },
];

/** 事件專屬欄位：上級定義排在下級之前 */
export const eventFieldDefs: Record<string, FieldDef[]> = {
  "公共設施異常": [{ name: "是否影響通行", kind: "BOOL", options: ["是", "否"], required: true }],
  "公共設施異常／座椅": [{ name: "損壞程度", kind: "SINGLE", options: ["輕微", "中度", "嚴重"], required: true }],
  "公共設施異常／照明": [{ name: "燈柱編號", kind: "TEXT", required: false }],
  "環境衛生問題": [{ name: "估計範圍", kind: "SINGLE", options: ["少量", "中量", "大量"], required: true }],
  "綠化問題／樹木": [{ name: "樹木編號", kind: "TEXT", required: false }, { name: "是否阻礙通行", kind: "BOOL", options: ["是", "否"], required: true }],
  "道路通行問題": [{ name: "是否影響通行", kind: "BOOL", options: ["是", "否"], required: true }],
};

export const eventToWorkType: Record<string, string> = {
  "公共設施異常／座椅": "公共設施／座椅", "公共設施異常／照明": "公共設施／照明", "公共設施異常／標示": "公共設施／標示",
  "環境衛生問題／積水": "環境衛生／積水", "環境衛生問題／垃圾堆積": "環境衛生／清潔", "綠化問題／樹木": "綠化／樹木", "綠化問題／草地": "綠化／草地",
  "道路通行問題／路面破損": "道路設施／路面", "道路通行問題／障礙物": "道路設施／路面",
};

export const workTypeTree: TreeNode[] = [
  { label: "公共設施", value: "公共設施", children: ["座椅", "照明", "標示", "遊樂設施"].map((label) => ({ label, value: label })) },
  { label: "環境衛生", value: "環境衛生", children: ["收集設施", "清潔", "積水"].map((label) => ({ label, value: label })) },
  { label: "綠化", value: "綠化", children: ["樹木", "灌溉", "草地"].map((label) => ({ label, value: label })) },
  { label: "道路設施", value: "道路設施", children: ["路面", "欄杆"].map((label) => ({ label, value: label })) },
];

/** 工作類型配置（按頂層） */
export const workTypeConfig: Record<string, { resolveMinAttachments: number; defaultGroup?: string }> = {
  "公共設施": { resolveMinAttachments: 1 },
  "環境衛生": { resolveMinAttachments: 1, defaultGroup: "環境衛生執行組" },
  "綠化": { resolveMinAttachments: 0, defaultGroup: "綠化養護組" },
  "道路設施": { resolveMinAttachments: 0 },
};

/** 對象負責群組（覆蓋工作類型默認分派） */
export const objectGroups: Record<string, Record<string, string>> = Object.fromEntries(planObjects["PL-20260929-0003"].map((object) => [object.id, { "公共設施": "公園設施維護組" }]));

export const dispatchRules = [
  { priority: 1, name: "北區公共設施", grids: ["花地瑪堂北區", "花地瑪堂西區"], type: "公共設施", group: "公園設施維護組" },
  { priority: 2, name: "綠化類工作", grids: [] as string[], type: "綠化", group: "綠化養護組" },
  { priority: 3, name: "道路設施（半島）", grids: ["大堂中區", "大堂南區", "望德堂中區", "花地瑪堂北區"], type: "道路設施", group: "道路維修組" },
];

export const commentTemplates = [
  { title: "已到場檢查", content: "已於［當前時間］到場檢查工作［工作編號］，稍後更新處理進度。", status: ["新建", "跟進中"] },
  { title: "已安排承辦商", content: "工作［工作編號］（［工作類型］）已安排承辦商跟進，預計 24 小時內完成。", status: ["跟進中"] },
  { title: "待物料到貨", content: "［工作編號］所需物料待到貨，到貨後即安排處理。", status: ["跟進中"] },
  { title: "處理完成請驗收", content: "［工作編號］已處理完成，請驗收。操作人：［操作人］", status: ["已解決"] },
];

/** 種子工作的補充資料（舊資料不含這些欄位時使用） */
export const workMeta: Record<string, { creator: string; handler?: string; x: number; y: number; objectId?: string; inspectionId?: string; inspectionItem?: string; reopenCount?: number; dupGroup?: string }> = {
  "WK-20260929-0012": { creator: "陳家朗", handler: "黃志峰", x: 622, y: 92, objectId: "OBJ-P03-02", inspectionId: "IN-20260929-0024", inspectionItem: "seat", dupGroup: "DUP-0001" },
  "WK-20260929-0010": { creator: "區詠珊", x: 660, y: 201, objectId: "OBJ-P03-08", dupGroup: "DUP-0001" },
  "WK-20260929-0011": { creator: "陳家朗", x: 560, y: 238 },
  "WK-20260928-0096": { creator: "何浩然", handler: "何浩然", x: 470, y: 330 },
  "WK-20260928-0081": { creator: "李芷晴", handler: "黃志峰", x: 646, y: 518, reopenCount: 0 },
  "WK-20260927-0064": { creator: "市容平台（接口）", x: 1000, y: 850 },
};

export const eventMeta: Record<string, { creator: string; x: number; y: number; custom?: Record<string, string>; followAt?: string }> = {
  "EV-20260929-0006": { creator: "陳家朗", x: 624, y: 90, custom: { "是否影響通行": "否", "損壞程度": "中度" }, followAt: "2026-09-29 17:00" },
  "EV-20260929-0005": { creator: "陳家朗", x: 560, y: 238, custom: { "樹木編號": "T-0421", "是否阻礙通行": "是" }, followAt: "2026-09-30 10:00" },
  "EV-20260928-0028": { creator: "李芷晴", x: 612, y: 532, custom: { "估計範圍": "少量" } },
};

const log = (workId: string, action: string, operator: string, time: string, location: string, comment?: string, from?: WorkLog["from"], to?: WorkLog["to"], photos?: Photo[]): WorkLog => ({ id: `${workId}-${action}-${time}`, workId, action, operator, time, location, comment, from, to, photos });

export const seedWorkLogs: WorkLog[] = [
  log("WK-20260929-0010", "建立工作", "區詠珊", "2026-09-29 07:55", "距工作地點 3 米", "由市民反映登記", undefined, "新建"),
  log("WK-20260929-0010", "自動分派", "系統", "2026-09-29 07:55", "—", "按對象負責群組分派至公園設施維護組"),
  log("WK-20260929-0012", "建立工作", "陳家朗", "2026-09-29 09:18", "距工作地點 6 米", "由巡查 IN-20260929-0024 異常項目「座椅穩固狀態」建立", undefined, "新建"),
  log("WK-20260929-0012", "自動分派", "系統", "2026-09-29 09:18", "—", "按對象負責群組分派至公園設施維護組"),
  log("WK-20260929-0012", "跟進", "黃志峰", "2026-09-29 09:46", "距工作地點 18 米", "已到場檢查，需更換固定螺絲", "新建", "跟進中"),
  log("WK-20260929-0012", "留言", "黃志峰", "2026-09-29 11:42", "距工作地點 22 米", "工作 WK-20260929-0012（公共設施／座椅）已安排承辦商跟進，預計 24 小時內完成。"),
  log("WK-20260929-0011", "建立工作", "陳家朗", "2026-09-29 08:42", "距工作地點 9 米", "由事件 EV-20260929-0005 建立", undefined, "新建"),
  log("WK-20260929-0011", "自動分派", "系統", "2026-09-29 08:42", "—", "命中分派規則 #2「綠化類工作」，分派至綠化養護組"),
  log("WK-20260928-0096", "建立工作", "何浩然", "2026-09-28 14:10", "距工作地點 4 米", "獨立建立", undefined, "新建"),
  log("WK-20260928-0096", "自動分派", "系統", "2026-09-28 14:10", "—", "按工作類型默認群組分派至環境衛生執行組"),
  log("WK-20260928-0096", "跟進", "何浩然", "2026-09-28 15:02", "距工作地點 11 米", "現場圍起警示帶", "新建", "跟進中"),
  log("WK-20260928-0096", "解決", "何浩然", "2026-09-29 10:12", "距工作地點 7 米", "已完成臨時加固，待驗收關閉", "跟進中", "已解決", [{ id: "s96a", src: photoAssets.bin, name: "加固完成.jpg", watermark: "2026-09-29 10:10 新馬路", kind: "image" }]),
  log("WK-20260928-0081", "建立工作", "李芷晴", "2026-09-28 10:05", "距工作地點 5 米", "由巡查 PL-20260928-0018 建立", undefined, "新建"),
  log("WK-20260928-0081", "跟進", "黃志峰", "2026-09-28 11:20", "距工作地點 14 米", undefined, "新建", "跟進中"),
  log("WK-20260928-0081", "解決", "黃志峰", "2026-09-28 15:48", "距工作地點 9 米", "已更換接頭並測試", "跟進中", "已解決", [{ id: "s81a", src: photoAssets.pipe, name: "更換接頭.jpg", watermark: "2026-09-28 15:40 嘉模公園", kind: "image" }]),
  log("WK-20260928-0081", "關閉", "梁嘉敏", "2026-09-28 17:36", "—", "驗收合格", "已解決", "已關閉"),
  log("WK-20260927-0064", "建立工作", "市容平台（接口）", "2026-09-27 16:20", "—", "由跨部門市容巡查通報平台轉入", undefined, "新建"),
  log("WK-20260927-0064", "自動分派", "系統", "2026-09-27 16:20", "—", "無匹配分派規則，標為待人工分派並已通知管理群組"),
];

export const initialAppState: AppState = {
  loggedIn: false,
  rememberAccount: "chan.kl",
  personaId: "P1",
  permissionGranted: false,
  deviceLocked: false,
  updateMode: "無",
  updateDismissed: false,
  offline: false,
  simulateConflict: true,
  settings: { fontSize: "大", language: "繁體中文", wifiOnlyVideo: true },
  companions: [],
  inspections: seedInspections(),
  workLogs: seedWorkLogs,
  planOps: [
    { planId: "PL-20260929-0003", action: "開始作業", operator: "陳家朗", time: "2026-09-29 08:36" },
    { planId: "PL-20260927-0012", action: "開始作業", operator: "李芷晴", time: "2026-09-27 08:05" },
    { planId: "PL-20260927-0012", action: "中止作業", operator: "李芷晴", time: "2026-09-27 10:12", reason: "天雨暫停" },
  ],
  syncQueue: [],
  push: null,
  mergedPlanIds: [],
  workLinks: [],
  tempSerial: 1,
  trackPoints: 38,
};

/** 我的軌跡（示範點，近黑沙環公園） */
export const myTrack: [number, number, string][] = [
  [586, 72, "08:30"], [598, 78, "08:33"], [614, 86, "08:36"], [624, 92, "08:39"], [638, 97, "08:42"], [650, 101, "08:45"], [662, 110, "08:48"], [676, 120, "08:51"],
  [688, 134, "08:54"], [694, 150, "08:57"], [696, 164, "09:00"], [690, 178, "09:03"], [680, 188, "09:06"], [668, 196, "09:09"], [660, 198, "09:12"], [652, 194, "09:15"],
];
