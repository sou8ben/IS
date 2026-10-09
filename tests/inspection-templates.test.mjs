import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import ts from "typescript";

const source = await readFile(new URL("../src/inspection-templates.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText;
const { initialTemplates, newTemplate, validateTemplate, moveItem, effectiveDistance, groupItemsByCategory, normalizeItems, moveCategory } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`);
const groups = ["inspect-north", "inspect-middle", "inspect-island"];
const tpl = (patch = {}) => ({ ...structuredClone(initialTemplates[0]), id: "", code: "TPL099", name: "新公園模板", ...patch });
const messages = (template) => validateTemplate(template, initialTemplates, groups).map((error) => error.message);
const has = (template, text) => messages(template).some((message) => message.includes(text));

test("all seed templates are valid", () => {
  for (const template of initialTemplates) assert.deepEqual(validateTemplate(template, initialTemplates, groups), [], template.code);
});
test("blank draft reports required fields and points at the right tabs", () => {
  const errors = validateTemplate(newTemplate(), initialTemplates, groups);
  for (const text of ["模板編號", "模板名稱", "巡查類型", "巡查項目"]) assert.ok(errors.some((error) => error.message.includes(text)), text);
  assert.ok(errors.some((error) => error.tab === "items"));
});
test("code is unique; name is unique within a type only", () => {
  assert.ok(has(tpl({ code: "tpl001" }), "已存在"));
  assert.ok(has(tpl({ name: "公園設施標準巡查表" }), "同名模板"));
  const street = initialTemplates[1];
  assert.equal(has({ ...structuredClone(street), id: "", code: "TPL098", name: "公園設施標準巡查表" }, "同名模板"), false);
});
test("distance and check points are required only with location check", () => {
  assert.ok(has(tpl({ validDistance: 5 }), "有效距離"));
  assert.ok(has(tpl({ validDistance: 100.5 }), "有效距離"));
  assert.ok(has(tpl({ checkOn: [] }), "檢查時點"));
  assert.deepEqual(messages(tpl({ locationCheck: false, validDistance: null, checkOn: [] })), []);
});
test("object distance override is range-checked", () => {
  assert.ok(has(tpl({ objects: [{ objectId: "OBJ-001", distance: 2000 }] }), "對象有效距離"));
  assert.deepEqual(messages(tpl({ objects: [{ objectId: "OBJ-001", distance: 30 }] })), []);
});
test("items: at least one, same type only, attachment range", () => {
  assert.ok(has(tpl({ items: [] }), "至少需要 1"));
  assert.ok(has(tpl({ items: [{ itemId: "ITEM-012", required: true, minAttachments: 0 }] }), "同一巡查類型的巡查項目"));
  assert.ok(has(tpl({ items: [{ itemId: "ITEM-001", required: true, minAttachments: 11 }] }), "最少附件數"));
  assert.ok(has(tpl({ items: [{ itemId: "ITEM-001", required: true, minAttachments: 0 }, { itemId: "ITEM-001", required: false, minAttachments: 0 }] }), "不可重複"));
});
test("objects must be of the same type", () => {
  assert.ok(has(tpl({ objects: [{ objectId: "OBJ-002", distance: null }] }), "同一巡查類型的對象"));
});
test("only inspection groups can be applied", () => {
  assert.ok(has(tpl({ groups: ["manage-facility"] }), "巡查群組"));
});
test("moveItem reorders and ignores out-of-range moves", () => {
  assert.deepEqual(moveItem(["a", "b", "c", "d"], 0, 2), ["b", "c", "a", "d"]);
  assert.deepEqual(moveItem(["a", "b", "c"], 2, 0), ["c", "a", "b"]);
  assert.deepEqual(moveItem(["a", "b"], 1, 5), ["a", "b"]);
});
test("effectiveDistance uses the override, else the template default", () => {
  const green = initialTemplates.find((t) => t.code === "TPL003");
  assert.equal(effectiveDistance(green, "OBJ-006"), 300);
  assert.equal(effectiveDistance(green, "OBJ-027"), 150);
  assert.equal(effectiveDistance(initialTemplates[0], "OBJ-001"), 100, "a template applying to all objects uses its default");
  assert.equal(effectiveDistance(initialTemplates.find((t) => !t.locationCheck), "OBJ-001"), null);
});
test("items are grouped by category in order of first appearance", () => {
  const groups = groupItemsByCategory(initialTemplates[0].items);
  assert.deepEqual(groups.map((group) => group.category), ["一般設施", "照明設施", "環境衛生", "供水設施"]);
  assert.deepEqual(groups[0].settings.map((setting) => setting.itemId), ["ITEM-001", "ITEM-006", "ITEM-008", "ITEM-009"]);
});
test("normalizeItems puts a new item at the end of its category", () => {
  const items = [...initialTemplates[0].items, { itemId: "ITEM-011", required: true, minAttachments: 0 }];
  assert.deepEqual(normalizeItems(items).map((setting) => setting.itemId), ["ITEM-001", "ITEM-006", "ITEM-008", "ITEM-009", "ITEM-011", "ITEM-002", "ITEM-003", "ITEM-007"]);
});
test("moveCategory moves a whole category block", () => {
  const moved = moveCategory(initialTemplates[0].items, 3, 0).map((setting) => setting.itemId);
  assert.deepEqual(moved, ["ITEM-007", "ITEM-001", "ITEM-006", "ITEM-008", "ITEM-009", "ITEM-002", "ITEM-003"]);
});
test("items of one category must stay adjacent", () => {
  const items = initialTemplates[0].items;
  assert.ok(has(tpl({ items: [items[0], items[4], items[1], items[2], items[3], items[5], items[6]] }), "相鄰排列"));
});
