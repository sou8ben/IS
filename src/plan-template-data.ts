import { planObjects, planRoutes, planTemplateOf } from "./app/data";
import { getObject } from "./object-data";
import type { PlanTemplate, Point } from "./plan-templates";

/** The seed plans were made from these 巡查計劃模板 (the seed plan of 路環步道 predates them and has none). */
export const seedPlanTemplateOf: Record<string, string> = {
  "PL-20260929-0003": "PLT001", "PL-20260929-0005": "PLT002", "PL-20260929-0006": "PLT003", "PL-20260929-0004": "PLT004", "PL-20260928-0018": "PLT005",
};

const fromSeedPlan = (planId: string, code: string, name: string, description: string, groups: string[], updatedBy: string, updatedAt: string): PlanTemplate => ({
  id: code, code, name, description,
  route: (planRoutes[planId] ?? []).map(([x, y]): Point => [x, y]),
  objects: (planObjects[planId] ?? []).map((object) => ({ objectId: object.id, templateIds: [planTemplateOf[planId]] })),
  groups, rules: "", status: "生效", updatedBy, updatedAt,
});

const positionOf = (objectId: string): Point => { const object = getObject(objectId); return object ? [Math.round(object.x), Math.round(object.y)] : [0, 0]; };

/** Demonstration 巡查計劃模板: one per seed plan, one whose object has two 巡查模板, and one with a route only. */
export function seedPlanTemplates(): PlanTemplate[] {
  const dayAndNight = ["OBJ-001", "OBJ-013", "OBJ-003"];
  return [
    fromSeedPlan("PL-20260929-0003", "PLT001", "黑沙環公園日常巡查路線", "由公園東門沿遊樂區、花圃至海濱座椅區的固定路線，逐點填寫公園設施標準巡查表。", ["inspect-north"], "陳家朗", "2026-09-26 17:05"),
    fromSeedPlan("PL-20260929-0005", "PLT002", "黑沙環海濱休憩區巡查路線", "海濱步道、觀景台、欄杆及救生圈站的固定路線。", ["inspect-north"], "陳家朗", "2026-09-26 17:30"),
    fromSeedPlan("PL-20260929-0006", "PLT003", "筷子基街道設施巡查路線", "筷子基行人道、巴士站及街市外圍的步行路線。", ["inspect-north"], "李芷晴", "2026-09-27 09:10"),
    fromSeedPlan("PL-20260929-0004", "PLT004", "中區街道環境巡查路線", "新馬路至大三巴一帶街道的步行路線。", ["inspect-middle"], "李芷晴", "2026-09-27 09:40"),
    fromSeedPlan("PL-20260928-0018", "PLT005", "氹仔公園設施巡查路線", "嘉模公園至氹仔中央公園一帶的公園設施路線。", ["inspect-island"], "黃志峰", "2026-09-25 16:20"),
    {
      id: "PLT006", code: "PLT006", name: "黑沙環公園日夜間巡查路線", description: "日間按標準巡查表檢查，黑沙環公園另須在夜間檢查照明，同一對象配兩個巡查模板，生成計劃時各產生一個巡查。",
      route: dayAndNight.map(positionOf),
      objects: [{ objectId: "OBJ-001", templateIds: ["TPL001", "TPL006"] }, { objectId: "OBJ-013", templateIds: ["TPL001"] }, { objectId: "OBJ-003", templateIds: ["TPL001"] }],
      groups: ["inspect-north"], rules: "", status: "生效", updatedBy: "陳家朗", updatedAt: "2026-09-28 11:25",
    },
    {
      id: "PLT007", code: "PLT007", name: "氹仔海濱現場巡查路線", description: "只定義路線，不預先列出對象；巡查員沿路線在現場新增巡查。",
      route: [[640, 530], [690, 556], [742, 592], [790, 640]], objects: [], groups: ["inspect-island"], rules: "", status: "生效", updatedBy: "黃志峰", updatedAt: "2026-09-28 14:10",
    },
  ];
}
