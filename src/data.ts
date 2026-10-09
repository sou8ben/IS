import { seedGrids } from "./grid-rules";
import { initialTemplates } from "./inspection-templates";
import { seedTypes } from "./inspection-type-rules";
import { seedObjects } from "./object-data";
import { seedPlanTemplates } from "./plan-template-data";
import { seedItems, seedItemTypes } from "./item-data";
import { seedHistoryRecords } from "./history-seed";
import { groupCatalog } from "./group-catalog";
import type { DemoState, GenericRecord } from "./types";

export const initialState: DemoState = {
  works: [
    { id: "WK-20260929-0012", title: "公園座椅固定螺絲鬆脫", type: "公共設施／座椅", source: "巡查", priority: "緊急", status: "跟進中", group: "公園設施維護組", grid: "花地瑪堂北區", address: "黑沙環公園近兒童遊樂區", sla: "將逾時", createdAt: "2026-09-29 09:18", updatedAt: "2026-09-29 11:42", eventId: "EV-20260929-0006", planId: "PL-20260929-0003", description: "巡查人員發現座椅左側兩枚固定螺絲鬆脫，存在傾倒風險。" },
    { id: "WK-20260929-0010", title: "海濱座椅扶手鬆動", type: "公共設施／座椅", source: "事件", priority: "一般", status: "新建", group: "公園設施維護組", grid: "花地瑪堂北區", address: "黑沙環海濱座椅區 A 段", sla: "正常", createdAt: "2026-09-29 07:55", updatedAt: "2026-09-29 07:55", description: "市民反映海濱座椅扶手鬆動，需檢查固定件。" },
    { id: "WK-20260929-0011", title: "行人道樹枝阻礙通行", type: "綠化／樹木", source: "事件", priority: "一般", status: "新建", group: "綠化養護組", grid: "望德堂中區", address: "美副將大馬路 42 號前", sla: "正常", createdAt: "2026-09-29 08:42", updatedAt: "2026-09-29 08:42", eventId: "EV-20260929-0005", description: "樹枝下垂至行人高度，需安排修剪。" },
    { id: "WK-20260928-0096", title: "垃圾收集點圍板破損", type: "環境衛生／收集設施", source: "獨立", priority: "特急", status: "已解決", group: "環境衛生執行組", grid: "大堂南區", address: "新馬路近議事亭前地", sla: "已逾時", createdAt: "2026-09-28 14:10", updatedAt: "2026-09-29 10:12", description: "圍板尖角外露，已完成臨時加固，待驗收關閉。" },
    { id: "WK-20260928-0081", title: "花圃灌溉水管滲漏", type: "綠化／灌溉", source: "巡查", priority: "一般", status: "已關閉", group: "綠化養護組", grid: "氹仔中央區", address: "嘉模公園北側花圃", sla: "正常", createdAt: "2026-09-28 10:05", updatedAt: "2026-09-28 17:36", planId: "PL-20260928-0018", description: "水管接駁位滲漏，已更換接頭並測試。" },
    { id: "WK-20260927-0064", title: "指示牌字樣褪色", type: "公共設施／標示", source: "接口", priority: "一般", status: "新建", group: "待人工分派", grid: "路環東區", address: "黑沙海灘巴士站旁", sla: "已逾時", createdAt: "2026-09-27 16:20", updatedAt: "2026-09-27 16:20", description: "由市容平台轉入，需確認權責單位。" },
  ],
  plans: [
    { id: "PL-20260929-0003", name: "黑沙環公園設施日常巡查", template: "黑沙環公園日常巡查路線", templateId: "TPL001", planTemplateId: "PLT001", group: "北區巡查一組", status: "進行中", startAt: "2026-09-29 08:30", endAt: "2026-09-29 12:30", progress: 7, total: 12, executor: "陳家朗", grid: "花地瑪堂北區" },
    { id: "PL-20260929-0005", name: "黑沙環海濱休憩區巡查", template: "黑沙環海濱休憩區巡查路線", templateId: "TPL004", planTemplateId: "PLT002", group: "北區巡查一組", status: "未開始", startAt: "2026-09-29 15:00", endAt: "2026-09-29 17:00", progress: 0, total: 5, grid: "花地瑪堂北區" },
    { id: "PL-20260929-0006", name: "筷子基街道設施巡查", template: "筷子基街道設施巡查路線", templateId: "TPL002", planTemplateId: "PLT003", group: "北區巡查一組", status: "未開始", startAt: "2026-09-29 16:00", endAt: "2026-09-29 18:00", progress: 0, total: 4, grid: "花地瑪堂西區" },
    { id: "PL-20260929-0004", name: "中區街道環境巡查", template: "中區街道環境巡查路線", templateId: "TPL002", planTemplateId: "PLT004", group: "中區巡查組", status: "未開始", startAt: "2026-09-29 14:00", endAt: "2026-09-29 18:00", progress: 0, total: 18, grid: "大堂中區" },
    { id: "PL-20260928-0018", name: "氹仔公園設施巡查", template: "氹仔公園設施巡查路線", templateId: "TPL001", planTemplateId: "PLT005", group: "離島巡查組", status: "已完成", startAt: "2026-09-28 09:00", endAt: "2026-09-28 13:00", progress: 15, total: 15, executor: "李芷晴", grid: "氹仔中央區" },
    { id: "PL-20260927-0012", name: "路環步道巡查", template: "街道環境標準巡查表", templateId: "TPL002", group: "離島巡查組", status: "已中止", startAt: "2026-09-27 08:00", endAt: "2026-09-27 12:00", progress: 3, total: 9, grid: "路環東區" },
  ],
  events: [
    { id: "EV-20260929-0006", type: "公共設施異常／座椅", description: "座椅固定螺絲鬆脫", status: "跟進中", grid: "花地瑪堂北區", address: "黑沙環公園近兒童遊樂區", createdAt: "2026-09-29 09:12", planId: "PL-20260929-0003", workIds: ["WK-20260929-0012"] },
    { id: "EV-20260929-0005", type: "綠化問題／樹木", description: "行人道樹枝阻礙通行", status: "跟進中", grid: "望德堂中區", address: "美副將大馬路 42 號前", createdAt: "2026-09-29 08:36", workIds: ["WK-20260929-0011"] },
    { id: "EV-20260928-0028", type: "環境衛生／積水", description: "雨後排水口附近輕微積水", status: "無需跟進", grid: "氹仔中央區", address: "施督憲正街", createdAt: "2026-09-28 15:24", workIds: [] },
  ],
  // demonstration history: five weekly rounds of completed inspections (for 上次／上五次巡查結果)
  inspectionRecords: seedHistoryRecords(),
  workLogs: [],
  grids: seedGrids(),
  objects: seedObjects(),
  inspectionTemplates: structuredClone(initialTemplates),
  planTemplates: seedPlanTemplates(),
  inspectionTypes: seedTypes(),
  itemTypes: seedItemTypes(),
  items: seedItems(),
  notices: [
    { id: "N-102", title: "工作即將逾時", body: "WK-20260929-0012 剩餘 42 分鐘", time: "5 分鐘前", level: "緊急", read: false, route: "/works/WK-20260929-0012" },
    { id: "N-101", title: "巡查計劃已指派", body: "中區街道環境巡查將於 14:00 開始", time: "28 分鐘前", level: "一般", read: false, route: "/plans/PL-20260929-0004" },
    { id: "N-100", title: "市容通報完成", body: "本批次成功 12 宗，失敗 1 宗", time: "1 小時前", level: "特急", read: true, route: "/integrations/city-reports" },
  ],
};

const owners = ["市政管理廳", "環境衛生處", "園林綠化處", "資訊處"];
const categories = ["公共設施", "環境衛生", "綠化養護", "系統配置"];

export function makeRecords(prefix: string, labels: string[], status = "啟用"): GenericRecord[] {
  return labels.map((name, index) => ({
    id: `${prefix}-${String(index + 1).padStart(3, "0")}`,
    code: `${prefix}${String(index + 1).padStart(3, "0")}`,
    name,
    category: categories[index % categories.length],
    owner: owners[index % owners.length],
    updatedAt: `2026-09-${String(29 - (index % 8)).padStart(2, "0")} ${String(9 + (index % 8)).padStart(2, "0")}:20`,
    status: index === labels.length - 1 && labels.length > 4 ? "停用" : status,
    count: 3 + index * 4,
    note: index % 2 ? "已套用平台標準配置" : "由管理群組維護",
  }));
}

export const genericDatasets: Record<string, GenericRecord[]> = {
  users: makeRecords("USR", ["陳家朗", "李芷晴", "梁嘉敏", "黃志峰", "何浩然", "區詠珊"]),
  // 群組管理: the shared group list, each in its category (the same list object work groups use)
  groups: makeRecords("GRP", groupCatalog.map((group) => group.name), "啟用").map((record, index) => ({ ...record, category: groupCatalog[index].category, owner: groupCatalog[index].owner, status: "啟用" })),
  roles: makeRecords("ROL", ["系統管理員", "巡查主管", "前線巡查員", "工作執行人員", "報表檢視員"]).map((record, index) => ({
    ...record,
    level: String(index + 1),
    roleType: index === 0 ? "管理員" : "普通用戶",
  })),
  rules: makeRecords("PERM", ["關閉工作校驗", "新增計劃校驗", "執行計劃校驗", "跟進工作校驗", "作廢記錄校驗"]),
  items: makeRecords("ITEM", ["座椅穩固狀態", "照明設施狀態", "垃圾桶清潔度", "灌溉系統狀態", "指示牌清晰度", "遊樂設施安全"]),
  eventTypes: makeRecords("ET", ["公共設施異常", "環境衛生問題", "綠化問題", "道路通行問題", "其他事件"]),
  workTypes: makeRecords("WT", ["公共設施維修", "環境衛生處理", "樹木修剪", "灌溉維修", "標示更換"]),
  comments: makeRecords("MSG", ["已到場檢查", "已安排承辦商", "待物料到貨", "處理完成請驗收"]),
  notificationRules: makeRecords("NTF", ["工作分派通知", "工作狀態變更", "服務承諾將逾時", "計劃即將開始", "市容通報結果"]),
  documents: makeRecords("DOC", ["巡查記錄表", "事件登記表", "工作處理報告", "月度營運報告"]),
  appVersions: makeRecords("APP", ["2.4.0", "2.3.2", "2.3.1", "2.2.0"], "已發佈"),
  thirdParties: makeRecords("EXT", ["跨部門市容巡查通報平台", "一戶通通知模組", "地籍局地址服務", "郵電局雲簽"]),
};

export const reportTrend = [
  { day: "09/23", plans: 42, works: 18 }, { day: "09/24", plans: 48, works: 22 },
  { day: "09/25", plans: 46, works: 17 }, { day: "09/26", plans: 51, works: 26 },
  { day: "09/27", plans: 39, works: 14 }, { day: "09/28", plans: 56, works: 21 },
  { day: "09/29", plans: 61, works: 28 },
];
