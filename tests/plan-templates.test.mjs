import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import ts from "typescript";

const source = await readFile(new URL("../src/plan-templates.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText;
const { newPlanTemplate, nextPlanTemplateCode, copyPlanTemplate, templateIdsOf, inspectionEntries, routeLength, distanceToRoute, objectsNearRoute, templateAppliesToObject, applicableTemplates, planRoute, validatePlanTemplate } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`);

const objects = [
  { id: "OBJ-A", name: "公園甲", inspectionType: "公園設施巡查", active: true },
  { id: "OBJ-B", name: "公園乙", inspectionType: "公園設施巡查", active: true },
  { id: "OBJ-C", name: "海濱丙", inspectionType: "海濱設施巡查", active: true },
  { id: "OBJ-D", name: "公園丁", inspectionType: "公園設施巡查", active: false },
];
const templates = [
  { id: "TPL001", name: "公園設施標準巡查表", inspectionType: "公園設施巡查", status: "生效", objects: [] },
  { id: "TPL006", name: "公園夜間照明巡查表", inspectionType: "公園設施巡查", status: "生效", objects: [{ objectId: "OBJ-A" }] },
  { id: "TPL004", name: "海濱設施巡查表", inspectionType: "海濱設施巡查", status: "生效", objects: [] },
  { id: "TPL005", name: "公共廁所巡查表", inspectionType: "公園設施巡查", status: "失效", objects: [] },
];
const context = { allowedGroupIds: ["inspect-north", "inspect-middle", "inspect-island"], objects, templates };
const base = { id: "PLT001", code: "PLT001", name: "公園日常路線", description: "", route: [[10, 10], [110, 10], [110, 110]], objects: [{ objectId: "OBJ-A", templateIds: ["TPL001", "TPL006"] }, { objectId: "OBJ-B", templateIds: ["TPL001"] }], groups: ["inspect-north"], rules: "", status: "生效", updatedBy: "陳家朗", updatedAt: "2026-09-26 17:05" };
const tpl = (patch = {}) => ({ ...structuredClone(base), id: "", code: "PLT099", name: "新路線", ...patch });
const messages = (template, all = [base]) => validatePlanTemplate(template, all, context).map((error) => error.message);
const has = (template, text, all) => messages(template, all).some((message) => message.includes(text));

test("a template with a route, objects and 巡查模板 is valid", () => {
  assert.deepEqual(validatePlanTemplate(base, [base], context), []);
  assert.deepEqual(validatePlanTemplate(tpl(), [base], context), []);
});
test("an object with two 巡查模板 produces one inspection per object × 巡查模板, in patrol order", () => {
  assert.deepEqual(inspectionEntries(base), [{ objectId: "OBJ-A", templateId: "TPL001" }, { objectId: "OBJ-A", templateId: "TPL006" }, { objectId: "OBJ-B", templateId: "TPL001" }]);
  assert.deepEqual(templateIdsOf(base), ["TPL001", "TPL006"]);
});
test("a blank template needs a code, a name and a route or objects", () => {
  const errors = validatePlanTemplate(newPlanTemplate(), [], context);
  assert.ok(errors.some((error) => error.tab === "basic" && error.message.includes("編號")));
  assert.ok(errors.some((error) => error.tab === "basic" && error.message.includes("名稱")));
  assert.ok(errors.some((error) => error.tab === "route" && error.message.includes("不可同時為空")));
});
test("code and name must be unique, and the name is at most 50 characters", () => {
  assert.ok(has(tpl({ code: "plt001" }), "已存在"));
  assert.ok(has(tpl({ name: "公園日常路線" }), "同名"));
  assert.ok(has(tpl({ name: "長".repeat(51) }), "50 字"));
  assert.deepEqual(validatePlanTemplate(base, [base], context), [], "a template does not clash with itself");
});
test("a template may have only a route, or only objects", () => {
  assert.deepEqual(validatePlanTemplate(tpl({ objects: [] }), [base], context), []);
  assert.deepEqual(validatePlanTemplate(tpl({ route: [] }), [base], context), []);
  assert.deepEqual(planRoute({ route: [], objects: base.objects }, { "OBJ-A": [1, 2], "OBJ-B": [3, 4] }), [[1, 2], [3, 4]], "no waypoints: the route follows the objects in order");
  assert.deepEqual(planRoute(base, { "OBJ-A": [1, 2] }), base.route, "waypoints win over the objects");
});
test("the route needs at least two waypoints, all inside the map", () => {
  assert.ok(has(tpl({ route: [[10, 10]] }), "至少需要 2 個途經點"));
  assert.ok(has(tpl({ route: [[10, 10], [2000, 10]] }), "地圖範圍內"));
  assert.ok(has(tpl({ route: [[10, 10], [20, -5]] }), "地圖範圍內"));
});
test("every object needs a 生效 巡查模板 of its type that applies to it", () => {
  assert.ok(has(tpl({ objects: [{ objectId: "OBJ-A", templateIds: [] }] }), "請為對象選擇巡查模板"));
  assert.ok(has(tpl({ objects: [{ objectId: "OBJ-C", templateIds: ["TPL001"] }] }), "不適用於對象"), "wrong inspection type");
  assert.ok(has(tpl({ objects: [{ objectId: "OBJ-B", templateIds: ["TPL006"] }] }), "不適用於對象"), "TPL006 lists only OBJ-A");
  assert.ok(has(tpl({ objects: [{ objectId: "OBJ-A", templateIds: ["TPL005"] }] }), "已失效"));
  assert.ok(has(tpl({ objects: [{ objectId: "OBJ-A", templateIds: ["TPL999"] }] }), "不存在"));
  assert.ok(has(tpl({ objects: [{ objectId: "OBJ-A", templateIds: ["TPL001", "TPL001"] }] }), "不可重複"));
});
test("objects must exist, be active and not repeat", () => {
  assert.ok(has(tpl({ objects: [{ objectId: "OBJ-X", templateIds: ["TPL001"] }] }), "不存在"));
  assert.ok(has(tpl({ objects: [{ objectId: "OBJ-D", templateIds: ["TPL001"] }] }), "已停用"));
  assert.ok(has(tpl({ objects: [{ objectId: "OBJ-A", templateIds: ["TPL001"] }, { objectId: "OBJ-A", templateIds: ["TPL001"] }] }), "對象不可重複"));
});
test("applicable groups must be inspection groups", () => {
  assert.ok(has(tpl({ groups: ["manage-facility"] }), "只可選擇巡查群組"));
  assert.deepEqual(validatePlanTemplate(tpl({ groups: [] }), [base], context), [], "no groups = every inspection group");
});
test("巡查模板 apply by inspection type and, when they list objects, only to those objects", () => {
  const [general, night] = templates;
  assert.equal(templateAppliesToObject(general, objects[1]), true);
  assert.equal(templateAppliesToObject(night, objects[1]), false);
  assert.equal(templateAppliesToObject(night, objects[0]), true);
  assert.deepEqual(applicableTemplates(objects[0], templates).map((item) => item.id), ["TPL001", "TPL006"], "失效 巡查模板 are not offered");
  assert.deepEqual(applicableTemplates(objects[2], templates).map((item) => item.id), ["TPL004"]);
});
test("codes continue the PLT series and a copy gets a new code and a free name", () => {
  assert.equal(nextPlanTemplateCode([]), "PLT001");
  assert.equal(nextPlanTemplateCode([{ code: "PLT007" }, { code: "PLT002" }, { code: "X1" }]), "PLT008");
  const copy = copyPlanTemplate(base, [base]);
  assert.equal(copy.id, ""); assert.equal(copy.code, "PLT002"); assert.equal(copy.name, "公園日常路線（副本）"); assert.equal(copy.status, "生效");
  assert.deepEqual(copy.route, base.route); assert.deepEqual(copy.objects, base.objects);
  copy.route.push([1, 1]); assert.equal(base.route.length, 3, "the copy does not share arrays with the source");
  assert.equal(copyPlanTemplate(base, [base, { ...base, name: "公園日常路線（副本）" }]).name, "公園日常路線（副本 2）");
});
test("route length and the scan for objects near the route", () => {
  assert.equal(routeLength([[0, 0], [30, 40], [30, 140]]), 150);
  assert.equal(routeLength([[0, 0]]), 0);
  assert.equal(distanceToRoute([50, 5], [[0, 0], [100, 0]]), 5, "distance to the line between waypoints, not only to the waypoints");
  assert.equal(distanceToRoute([-30, 40], [[0, 0], [100, 0]]), 50, "beyond an end, the distance is to that waypoint");
  assert.equal(distanceToRoute([3, 4], [[0, 0]]), 5);
  const found = objectsNearRoute([[0, 0], [100, 0]], [{ id: "far", x: 50, y: 200 }, { id: "mid", x: 50, y: 8 }, { id: "end", x: 104, y: 3 }], 10);
  assert.deepEqual(found.map((entry) => [entry.object.id, entry.distance]), [["end", 5], ["mid", 8]]);
});
