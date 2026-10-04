import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import ts from "typescript";

const source = await readFile(new URL("../src/event-rules.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText;
const { fieldsFor, validateEvent, diffEvent, followPrompts, shouldConfirmTypeChange } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`);

const defsByType = {
  "公共設施異常": [{ name: "是否影響通行", kind: "BOOL", options: ["是", "否"], required: true }],
  "公共設施異常／座椅": [{ name: "損壞程度", kind: "SINGLE", options: ["輕微", "中度", "嚴重"], required: true }],
  "綠化問題／樹木": [{ name: "樹木編號", kind: "TEXT", required: false }],
};
const leaves = ["公共設施異常／座椅", "綠化問題／樹木"];
const now = "2026-10-01 10:00";
const draft = (patch = {}) => ({ type: "公共設施異常／座椅", description: "座椅鬆脫", address: "黑沙環公園", x: 600, y: 100, status: "無需跟進", custom: { "是否影響通行": "否", "損壞程度": "中度" }, ...patch });
const issues = (d, isNew = true) => validateEvent(d, fieldsFor(d.type, defsByType), leaves, now, isNew);
const has = (d, key, isNew = true) => issues(d, isNew).some((issue) => issue.key === key);

test("type-specific fields inherit: top-level first, then the leaf", () => {
  assert.deepEqual(fieldsFor("公共設施異常／座椅", defsByType).map((f) => f.name), ["是否影響通行", "損壞程度"]);
  assert.deepEqual(fieldsFor("綠化問題／樹木", defsByType).map((f) => f.name), ["樹木編號"]);
  assert.deepEqual(fieldsFor("", defsByType), []);
  assert.deepEqual(fieldsFor("其他／未知", defsByType), []);
});
test("a complete event is valid", () => assert.deepEqual(issues(draft()), []));
test("type must be chosen and be a leaf", () => {
  assert.ok(has(draft({ type: "" }), "type"));
  assert.ok(has(draft({ type: "公共設施異常" }), "type"));
});
test("description 1–1000 characters, address and location required", () => {
  assert.ok(has(draft({ description: "  " }), "description"));
  assert.ok(has(draft({ description: "字".repeat(1001) }), "description"));
  assert.equal(has(draft({ description: "字".repeat(1000) }), "description"), false);
  assert.ok(has(draft({ address: "" }), "address"));
  assert.ok(has(draft({ x: undefined }), "location"));
  assert.ok(has(draft({ x: 2000 }), "location"));
});
test("跟進中 needs an expected time, not earlier than now for new events only", () => {
  assert.ok(has(draft({ status: "跟進中" }), "followAt"));
  assert.ok(has(draft({ status: "跟進中", followAt: "2026-10-01T09:59" }), "followAt"));
  assert.equal(has(draft({ status: "跟進中", followAt: "2026-10-01T10:00" }), "followAt"), false);
  assert.equal(has(draft({ status: "跟進中", followAt: "2026-09-01 09:00" }), "followAt", false), false);
  assert.equal(has(draft({ status: "無需跟進" }), "followAt"), false);
});
test("required custom values must be filled and among the options", () => {
  assert.ok(has(draft({ custom: { "是否影響通行": "否" } }), "custom-損壞程度"));
  assert.ok(has(draft({ custom: { "是否影響通行": "也許", "損壞程度": "中度" } }), "custom-是否影響通行"));
  assert.equal(has(draft({ type: "綠化問題／樹木", custom: {} }), "custom-樹木編號"), false);
});
test("diffEvent lists only real changes", () => {
  assert.deepEqual(diffEvent(draft(), draft()), []);
  const after = draft({ status: "跟進中", followAt: "2026-10-02 09:00", x: 610, custom: { "是否影響通行": "是", "損壞程度": "中度" }, attachmentCount: 2 });
  assert.deepEqual(diffEvent(draft(), after), ["位置已更改", "跟進狀態：無需跟進 → 跟進中", "預計跟進時間：— → 2026-10-02 09:00", "是否影響通行：否 → 是", "附件數：0 → 2"]);
});
test("prompts suggest but never change the status", () => {
  assert.deepEqual(followPrompts({ status: "無需跟進" }, []), { suggestInProgress: true, suggestDone: false });
  assert.deepEqual(followPrompts({ status: "跟進中" }, [{ status: "已關閉" }, { status: "已關閉" }]), { suggestInProgress: false, suggestDone: true });
  assert.equal(followPrompts({ status: "跟進中" }, [{ status: "已關閉" }, { status: "跟進中" }]).suggestDone, false);
  assert.equal(followPrompts({ status: "已完成" }, [{ status: "已關閉" }]).suggestDone, false);
  assert.equal(followPrompts({ status: "跟進中" }, []).suggestDone, false);
});
test("changing type confirms only when custom values would be cleared", () => {
  assert.equal(shouldConfirmTypeChange({ a: "x" }, "A", "B"), true);
  assert.equal(shouldConfirmTypeChange({ a: "" }, "A", "B"), false);
  assert.equal(shouldConfirmTypeChange({ a: "x" }, "", "B"), false);
  assert.equal(shouldConfirmTypeChange({ a: "x" }, "A", "A"), false);
});
