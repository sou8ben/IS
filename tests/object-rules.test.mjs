import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import ts from "typescript";

const compile = async (file) => ts.transpileModule(await readFile(new URL(`../src/${file}`, import.meta.url), "utf8"), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText;
const dataUrl = (js) => `data:text/javascript;base64,${Buffer.from(js).toString("base64")}`;
const grid = await import(dataUrl(await compile("grid-rules.ts")));
const objectJs = (await compile("object-rules.ts")).replace(/from "\.\/grid-rules"/, `from "${dataUrl(await compile("grid-rules.ts"))}"`);
const m = await import(dataUrl(objectJs));
const { composeAddress, nextObjectCode, nextObjectId, assignGrid, reassignObjectGrids, validateObject, templatesOfObject, pxOf, validateWorkGroups, normalizeWorkGroups, dispatchGroupOf } = m;
const { seedGrids, pxToLngLat, polygonFromPx } = grid;

const grids = seedGrids(); // 花地瑪堂北區 = id 1 (x 540–760, y 40–230)
const at = ([x, y]) => { const [lng, lat] = pxToLngLat([x, y]); return { longitude: lng, latitude: lat }; };
const object = (patch = {}) => ({ id: "OBJ-001", inspectionType: "公園設施巡查", gridId: "1", gridAssignMode: "自動", code: "OBJ-001", name: "黑沙環公園", address: "花地瑪堂區 黑沙環馬路", ...at([640, 110]), geojson: null, attachments: [], workGroups: [], status: "啟用", ...patch });
const groups = [{ name: "公園設施維護組", category: "執行群組" }, { name: "綠化養護組", category: "執行群組" }, { name: "工作檢視組", category: "檢視群組" }, { name: "設施管理群組", category: "管理群組" }];
const ctx = (patch = {}) => ({ all: [object(), object({ id: "OBJ-002", code: "OBJ-002", name: "塔石廣場" })], inspectionTypes: ["公園設施巡查", "街道環境巡查"], grids, groups, ...patch });
const draft = (patch = {}) => object({ id: "", code: "", name: "新對象", ...patch });
const keys = (d, c = ctx()) => validateObject(d, c).errors.map((e) => e.key);

test("address parts compose into one structured address", () => {
  assert.equal(composeAddress({ parish: "花地瑪堂區", street: "黑沙環馬路", number: "12", building: "黑沙環公園" }), "花地瑪堂區 黑沙環馬路 12 號 黑沙環公園");
  assert.equal(composeAddress({ parish: " 嘉模堂區", street: "施督憲正街", number: "", building: "" }), "嘉模堂區 施督憲正街");
  assert.equal(composeAddress({ parish: "", street: "", number: "", building: "" }), "");
});
test("auto codes and ids continue the highest numbers", () => {
  assert.equal(nextObjectCode(["OBJ-001", "OBJ-034", "OBJ-P03-01", "x"]), "OBJ-035"); assert.equal(nextObjectCode([]), "OBJ-001");
  assert.equal(nextObjectId(["OBJ-001", "OBJ-N0007", "OBJ-N0002"]), "OBJ-N0008"); assert.equal(nextObjectId(["OBJ-001"]), "OBJ-N0001");
});
test("auto grid follows the position; manual grid is kept; no match is none", () => {
  assert.equal(assignGrid(object({ gridAssignMode: "自動", gridId: null }), grids), "1");
  assert.equal(assignGrid(object({ gridAssignMode: "自動", ...at([1400, 900]) }), grids), null);
  assert.equal(assignGrid(object({ gridAssignMode: "手動", gridId: "7" }), grids), "7");
  const disabled = grids.map((g) => g.id === "1" ? { ...g, status: "停用" } : g);
  assert.equal(assignGrid(object({ gridAssignMode: "自動" }), disabled), null, "disabled grids are skipped");
});
test("re-assignment updates only auto objects whose grid changed", () => {
  const list = [object({ id: "a", gridId: "2" }), object({ id: "b", gridId: "1" }), object({ id: "c", gridAssignMode: "手動", gridId: "2" }), object({ id: "d", gridId: null, ...at([1400, 900]) })];
  assert.deepEqual(reassignObjectGrids(list, grids), [{ id: "a", from: "2", to: "1" }]);
});
test("a valid object passes and gets its auto code and grid", () => {
  const result = validateObject(draft({ gridId: null }), ctx());
  assert.deepEqual(result.errors, []); assert.equal(result.record.code, "OBJ-003"); assert.equal(result.record.gridId, "1");
  assert.equal(validateObject(draft({ code: "MY_1" }), ctx()).record.code, "MY_1");
  assert.deepEqual(validateObject(object(), ctx({ editingId: "OBJ-001" })).errors, [], "editing may keep its own code");
});
test("object validation covers every rule", () => {
  assert.ok(keys(draft({ inspectionType: "" })).includes("type")); assert.ok(keys(draft({ inspectionType: "不存在" })).includes("type"));
  assert.ok(keys(draft({ code: "OBJ-002" })).includes("code")); assert.ok(keys(draft({ code: "obj-002" })).includes("code"));
  assert.ok(keys(draft({ code: "bad code" })).includes("code")); assert.ok(keys(draft({ code: "X".repeat(33) })).includes("code"));
  assert.ok(keys(draft({ name: " " })).includes("name")); assert.ok(keys(draft({ name: "字".repeat(101) })).includes("name"));
  assert.ok(keys(draft({ address: "" })).includes("address")); assert.ok(keys(draft({ address: "字".repeat(301) })).includes("address"));
  assert.ok(keys(draft({ latitude: NaN })).includes("location")); assert.ok(keys(draft({ latitude: 30, longitude: 120 })).includes("location"));
  assert.ok(keys(draft({ gridAssignMode: "手動", gridId: null })).includes("grid")); assert.ok(keys(draft({ gridAssignMode: "手動", gridId: "99" })).includes("grid"));
  const file = (n) => ({ id: String(n), name: `${n}.jpg`, size: 1, kind: "image" });
  assert.ok(keys(draft({ attachments: Array.from({ length: 11 }, (_, n) => file(n)) })).includes("attachments"));
  assert.ok(!keys(draft({ attachments: Array.from({ length: 10 }, (_, n) => file(n)) })).includes("attachments"));
});
test("the map file may be a point, polygon or multipolygon, and nothing else", () => {
  const poly = polygonFromPx([[600, 80], [680, 80], [680, 140], [600, 140]]);
  assert.deepEqual(keys(draft({ geojson: poly })), []);
  assert.deepEqual(keys(draft({ geojson: { type: "Point", coordinates: [113.56, 22.2] } })), []);
  assert.deepEqual(keys(draft({ geojson: { type: "MultiPolygon", coordinates: [poly.coordinates, polygonFromPx([[700, 80], [740, 80], [740, 120]]).coordinates] } })), []);
  assert.deepEqual(keys(draft({ geojson: { type: "LineString", coordinates: [[113.56, 22.2], [113.57, 22.2]] } })), ["geojson"]);
  assert.deepEqual(keys(draft({ geojson: { type: "Point", coordinates: [10, 10] } })), ["geojson"]);
  assert.deepEqual(keys(draft({ geojson: { type: "Polygon", coordinates: [[[113.56, 22.2], [113.57, 22.2], [113.56, 22.19]]] } })), ["geojson"]);
});
test("work-type groups need unique known types and a group", () => {
  assert.deepEqual(keys(draft({ workGroups: [{ category: "執行群組", group: "公園設施維護組" }, { category: "檢視群組", group: "工作檢視組" }] })), []);
  assert.ok(keys(draft({ workGroups: [{ category: "執行群組", group: "工作檢視組" }] })).includes("workGroups"), "the group must belong to the category");
});
test("related templates: same type, listing the object or listing none", () => {
  const t = (id, inspectionType, objects, status = "生效") => ({ id, name: id, inspectionType, status, objects: objects.map((objectId) => ({ objectId })) });
  const list = [t("A", "公園設施巡查", ["OBJ-001"]), t("B", "公園設施巡查", []), t("C", "公園設施巡查", ["OBJ-009"]), t("D", "街道環境巡查", []), t("E", "公園設施巡查", ["OBJ-001"], "失效")];
  assert.deepEqual(templatesOfObject(list, { id: "OBJ-001", inspectionType: "公園設施巡查" }).map((x) => [x.template.id, x.scope]), [["A", "指定對象"], ["B", "類型下全部對象"], ["E", "指定對象"]]);
  assert.deepEqual(templatesOfObject(list, { id: "OBJ-001", inspectionType: "街道環境巡查" }).map((x) => x.template.id), ["D"]);
  const [x, y] = pxOf(object(at([640, 110]))); assert.ok(Math.abs(x - 640) < 0.02 && Math.abs(y - 110) < 0.02);
});
test("work groups follow 群組管理: category and group required, no duplicates, one execution group", () => {
  const check = (rows) => validateWorkGroups(rows, groups);
  assert.deepEqual(check([]), []);
  assert.deepEqual(check([{ category: "執行群組", group: "公園設施維護組" }, { category: "管理群組", group: "設施管理群組" }, { category: "檢視群組", group: "工作檢視組" }]), []);
  assert.match(check([{ category: "", group: "" }]).join(), /群組分類.*群組/);
  assert.match(check([{ category: "不存在", group: "公園設施維護組" }]).join(), /分類不存在/);
  assert.match(check([{ category: "管理群組", group: "公園設施維護組" }])[0], /不屬於管理群組/);
  assert.match(check([{ category: "管理群組", group: "設施管理群組" }, { category: "管理群組", group: "設施管理群組" }]).join(), /重複/);
  assert.match(check([{ category: "執行群組", group: "公園設施維護組" }, { category: "執行群組", group: "綠化養護組" }]).join(), /只可設定一個/);
});
test("saved rows of the old shape become execution-group rows; dispatch uses the execution group", () => {
  assert.deepEqual(normalizeWorkGroups([{ workType: "公共設施", group: "公園設施維護組" }, { workType: "綠化", group: "綠化養護組" }], groups), [{ category: "執行群組", group: "公園設施維護組" }], "one execution group is kept");
  assert.deepEqual(normalizeWorkGroups([{ workType: "公共設施", group: "設施管理群組" }], groups), [{ category: "管理群組", group: "設施管理群組" }], "a known group takes its own category");
  const rows = [{ category: "檢視群組", group: "工作檢視組" }, { category: "執行群組", group: "綠化養護組" }];
  assert.deepEqual(normalizeWorkGroups(rows, groups), rows, "current rows are unchanged");
  assert.equal(dispatchGroupOf({ workGroups: rows }), "綠化養護組"); assert.equal(dispatchGroupOf({ workGroups: [rows[0]] }), undefined);
});
