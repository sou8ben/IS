// 巡查計劃模板 data and validation. Kept import-free so tests can transpile and run it directly.
// A 巡查計劃模板 predefines a route (waypoints), its objects and the 巡查模板 each object is inspected with; a plan is generated from it.

export type Point = [number, number];
export type PlanTemplateTab = "basic" | "route" | "objects" | "groups";
/** The 巡查模板 an object is inspected with; an object may have several, giving one inspection per 巡查模板. */
export interface PlanTemplateObject { objectId: string; templateIds: string[] }
export interface PlanTemplate {
  id: string;
  code: string;
  name: string;
  description: string;
  /** Waypoints in map pixels; empty or at least two. A template may have a route only, objects only, or both. */
  route: Point[];
  /** In patrol order. */
  objects: PlanTemplateObject[];
  /** Applicable inspection groups; empty = every inspection group. */
  groups: string[];
  /** 其他執行規則: free text until the rules are defined. */
  rules: string;
  status: "生效" | "失效";
  updatedBy: string;
  updatedAt: string;
}
export interface PlanTemplateError { tab: PlanTemplateTab; message: string }

/** What validation needs to know about the managed objects and the 巡查模板. */
export interface PlanTemplateContext {
  allowedGroupIds: string[];
  objects: { id: string; name: string; inspectionType: string; active: boolean }[];
  templates: { id: string; name: string; inspectionType: string; status: string; objects: { objectId: string }[] }[];
}

export const MAP_SIZE = { width: 1536, height: 1024 };
export const NAME_MAX = 50;
export const RULES_MAX = 500;
export const SCAN_RADIUS_DEFAULT = 150;
export const SCAN_RADIUS_MIN = 10;
export const SCAN_RADIUS_MAX = 2000;

export function newPlanTemplate(): PlanTemplate {
  return { id: "", code: "", name: "", description: "", route: [], objects: [], groups: [], rules: "", status: "生效", updatedBy: "", updatedAt: "" };
}

/** Next free code in the PLT001 series. */
export function nextPlanTemplateCode(all: Pick<PlanTemplate, "code">[]): string {
  const max = all.reduce((value, item) => { const match = item.code.match(/^PLT(\d+)$/i); return match ? Math.max(value, Number(match[1])) : value; }, 0);
  return `PLT${String(max + 1).padStart(3, "0")}`;
}

/** A copy to edit into a new template: new code and name, no id yet, 生效. */
export function copyPlanTemplate(source: PlanTemplate, all: PlanTemplate[]): PlanTemplate {
  let name = `${source.name}（副本）`; let count = 2;
  while (all.some((item) => item.name.trim() === name)) name = `${source.name}（副本 ${count++}）`;
  return { ...structuredClone(source), id: "", code: nextPlanTemplateCode(all), name, status: "生效", updatedBy: "", updatedAt: "" };
}

/** The distinct 巡查模板 ids used by the template, in order of first use. */
export function templateIdsOf(template: Pick<PlanTemplate, "objects">): string[] {
  return [...new Set(template.objects.flatMap((object) => object.templateIds))];
}

/** One planned inspection per object × 巡查模板, in patrol order. */
export function inspectionEntries(template: Pick<PlanTemplate, "objects">): { objectId: string; templateId: string }[] {
  return template.objects.flatMap((object) => object.templateIds.map((templateId) => ({ objectId: object.objectId, templateId })));
}

export const routeLength = (route: Point[]) => route.slice(1).reduce((sum, point, index) => sum + Math.hypot(point[0] - route[index][0], point[1] - route[index][1]), 0);

/** Distance from a point to the route (to its segments, or to the only waypoint). */
export function distanceToRoute(point: Point, route: Point[]): number {
  if (!route.length) return Infinity;
  if (route.length === 1) return Math.hypot(point[0] - route[0][0], point[1] - route[0][1]);
  return Math.min(...route.slice(1).map((end, index) => {
    const start = route[index]; const dx = end[0] - start[0]; const dy = end[1] - start[1]; const lengthSquared = dx * dx + dy * dy;
    const t = lengthSquared ? Math.min(1, Math.max(0, ((point[0] - start[0]) * dx + (point[1] - start[1]) * dy) / lengthSquared)) : 0;
    return Math.hypot(point[0] - (start[0] + t * dx), point[1] - (start[1] + t * dy));
  }));
}

/** Objects within `radius` of the route's waypoints and the lines between them, nearest first. */
export function objectsNearRoute<T extends { id: string; x: number; y: number }>(route: Point[], objects: T[], radius: number): { object: T; distance: number }[] {
  return objects.map((object) => ({ object, distance: distanceToRoute([object.x, object.y], route) })).filter((entry) => entry.distance <= radius).sort((a, b) => a.distance - b.distance || a.object.id.localeCompare(b.object.id));
}

/** A 巡查模板 applies to an object of its inspection type, and to the objects it lists when it lists any. */
export function templateAppliesToObject(template: { inspectionType: string; objects: { objectId: string }[] }, object: { id: string; inspectionType: string }): boolean {
  return template.inspectionType === object.inspectionType && (!template.objects.length || template.objects.some((setting) => setting.objectId === object.id));
}

/** The 生效 巡查模板 an object can be inspected with, in list order. */
export function applicableTemplates<T extends { inspectionType: string; status: string; objects: { objectId: string }[] }>(object: { id: string; inspectionType: string }, templates: T[]): T[] {
  return templates.filter((template) => template.status === "生效" && templateAppliesToObject(template, object));
}

/** The route a plan takes: the waypoints, else the objects' positions in patrol order. */
export function planRoute(template: Pick<PlanTemplate, "route" | "objects">, positions: Record<string, Point | undefined>): Point[] {
  if (template.route.length >= 2) return template.route.map((point) => [...point] as Point);
  return template.objects.flatMap((object) => { const point = positions[object.objectId]; return point ? [point] : []; });
}

const inMap = (point: Point) => point.length === 2 && point.every((value) => Number.isFinite(value)) && point[0] >= 0 && point[0] <= MAP_SIZE.width && point[1] >= 0 && point[1] <= MAP_SIZE.height;

/**
 * Everything that stops a template from being saved or used: required data, route, objects with their 巡查模板, groups.
 * Used both when editing the template and when a plan is created from it (which also needs it 生效).
 */
export function validatePlanTemplate(template: PlanTemplate, all: PlanTemplate[], context: PlanTemplateContext): PlanTemplateError[] {
  const errors: PlanTemplateError[] = [];
  const add = (tab: PlanTemplateTab, message: string) => errors.push({ tab, message });
  const others = all.filter((item) => item.id !== template.id);
  const code = template.code.trim(); const name = template.name.trim();
  if (!code) add("basic", "請輸入編號。");
  else if (others.some((item) => item.code.trim().toLowerCase() === code.toLowerCase())) add("basic", `編號「${code}」已存在。`);
  if (!name) add("basic", "請輸入名稱。");
  else if ([...name].length > NAME_MAX) add("basic", `名稱不可超過 ${NAME_MAX} 字。`);
  else if (others.some((item) => item.name.trim() === name)) add("basic", `已有同名巡查計劃模板「${name}」。`);
  if ([...template.rules].length > RULES_MAX) add("basic", `其他執行規則不可超過 ${RULES_MAX} 字。`);

  if (template.route.length === 1) add("route", "路線至少需要 2 個途經點。");
  if (template.route.some((point) => !inMap(point))) add("route", "途經點須在地圖範圍內。");
  if (template.route.length < 2 && !template.objects.length) add("route", "路線及對象不可同時為空：請在地圖設定路線，或加入至少 1 個對象。");

  const objectIds = template.objects.map((setting) => setting.objectId);
  if (new Set(objectIds).size !== objectIds.length) add("objects", "對象不可重複加入。");
  const objectById = new Map(context.objects.map((object) => [object.id, object]));
  const templateById = new Map(context.templates.map((item) => [item.id, item]));
  const unassigned: string[] = []; const problems = new Set<string>();
  for (const setting of template.objects) {
    const object = objectById.get(setting.objectId);
    const label = object?.name ?? setting.objectId;
    if (!object) { problems.add(`對象「${label}」不存在。`); continue; }
    if (!object.active) problems.add(`對象「${label}」已停用，請移除。`);
    if (!setting.templateIds.length) { unassigned.push(label); continue; }
    if (new Set(setting.templateIds).size !== setting.templateIds.length) problems.add(`對象「${label}」的巡查模板不可重複。`);
    for (const templateId of setting.templateIds) {
      const item = templateById.get(templateId);
      if (!item) problems.add(`對象「${label}」的巡查模板「${templateId}」不存在。`);
      else if (item.status !== "生效") problems.add(`巡查模板「${item.name}」已失效，請改用其他巡查模板（對象「${label}」）。`);
      else if (!templateAppliesToObject(item, object)) problems.add(`巡查模板「${item.name}」不適用於對象「${label}」。`);
    }
  }
  if (unassigned.length) add("objects", `請為對象選擇巡查模板：${unassigned.slice(0, 3).join("、")}${unassigned.length > 3 ? `等 ${unassigned.length} 個` : ""}。`);
  problems.forEach((message) => add("objects", message));
  if (template.groups.some((group) => !context.allowedGroupIds.includes(group))) add("groups", "適用群組只可選擇巡查群組。");
  return errors;
}
