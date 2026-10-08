import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import ts from "typescript";

const source = await readFile(new URL("../src/inspection-type-rules.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText;
const { validateType, usageOf, canRename, renameBlockReason, deactivationBlock, nextTypeId, normalizeType, seedTypes } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`);

const options = { viewGroups: ["manage-facility", "manage-sanitation", "manage-green", "exec-facility"], executeGroups: ["exec-facility", "exec-sanitation", "exec-green"] };
const existing = seedTypes();

test("seed types are valid, unique and cover the five names used elsewhere", () => {
  existing.forEach((t) => { assert.equal(t.status, "生效"); assert.ok(t.updatedBy && /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(t.updatedAt), t.name); });
  assert.deepEqual(existing.map((t) => t.name), ["公園設施巡查", "街道環境巡查", "綠化設施巡查", "海濱設施巡查", "公共廁所巡查"]);
  existing.forEach((t) => assert.deepEqual(validateType(t, existing, options, t.id), [], t.name));
});
test("name is required, at most 50 characters, and unique", () => {
  const errors = (name, id) => validateType({ name }, existing, options, id);
  assert.deepEqual(errors("白鴿巢公園巡查"), []);
  assert.match(errors(" ")[0], /類型名稱/); assert.match(errors("字".repeat(51))[0], /50/);
  assert.match(errors("公園設施巡查")[0], /已存在/); assert.match(errors("  公園設施巡查 ")[0], /已存在/);
  assert.deepEqual(errors("公園設施巡查", "1"), [], "editing may keep its own name");
});
test("a default group is optional, but a chosen one must be offered by its dropdown", () => {
  const check = (draft) => validateType({ name: "新類型", ...draft }, existing, options);
  assert.deepEqual(check({}), []); assert.deepEqual(check({ viewGroup: "", executeGroup: "" }), []);
  assert.deepEqual(check({ viewGroup: "manage-green", executeGroup: "exec-green" }), []);
  assert.match(check({ viewGroup: "nope" })[0], /查看群組/);
  assert.match(check({ executeGroup: "manage-facility" })[0], /執行群組/, "a management group cannot be the default execution group");
});
test("usage counts objects and templates of the type, and the active ones", () => {
  const objects = [{ inspectionType: "A", status: "啟用" }, { inspectionType: "A", status: "停用" }, { inspectionType: "B", status: "啟用" }];
  const templates = [{ inspectionType: "A", status: "生效" }, { inspectionType: "A", status: "失效" }, { inspectionType: "B", status: "生效" }];
  assert.deepEqual(usageOf("A", objects, templates, 4), { objects: 2, activeObjects: 1, templates: 2, activeTemplates: 1, items: 4 });
  assert.deepEqual(usageOf("C", objects, templates, 0), { objects: 0, activeObjects: 0, templates: 0, activeTemplates: 0, items: 0 });
});
test("renaming is allowed only while nothing uses the type", () => {
  const unused = { objects: 0, activeObjects: 0, templates: 0, activeTemplates: 0, items: 0 };
  assert.equal(canRename(unused), true); assert.equal(renameBlockReason(unused), null);
  assert.equal(canRename({ ...unused, items: 1 }), false);
  assert.match(renameBlockReason({ ...unused, objects: 3, items: 2 }), /3 個對象、2 個巡查項目/);
  assert.match(renameBlockReason({ ...unused, templates: 1 }), /1 個巡查計劃模板.*失效/);
});
test("a type cannot be disabled while it has active objects or templates", () => {
  const usage = { objects: 5, activeObjects: 0, templates: 2, activeTemplates: 0, items: 3 };
  assert.equal(deactivationBlock(usage), null, "inactive objects and templates do not block");
  assert.match(deactivationBlock({ ...usage, activeObjects: 2 }), /2 個啟用中的對象.*失效/);
  assert.match(deactivationBlock({ ...usage, activeObjects: 2, activeTemplates: 1 }), /2 個啟用中的對象及 1 個生效中的巡查計劃模板/);
});
test("ids continue the highest number", () => { assert.equal(nextTypeId(["1", "5", "x"]), "6"); assert.equal(nextTypeId([]), "1"); });
test("stored types in the old shape are brought up to date", () => {
  const old = { id: "7", name: "舊類型", leadDepartment: "設施管理部", status: "停用" };
  assert.deepEqual(normalizeType(old), { id: "7", name: "舊類型", status: "失效", stepByStep: false, strictWorkflow: false, requireLocation: false, viewGroup: "", executeGroup: "", updatedBy: "", updatedAt: "" });
  assert.equal(normalizeType({ ...old, status: "啟用" }).status, "生效"); assert.equal(normalizeType({ ...old, status: "生效" }).status, "生效");
  const current = seedTypes()[0]; assert.deepEqual(normalizeType(current), current, "a current record is unchanged");
  assert.equal("leadDepartment" in normalizeType(old), false);
});
