import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import ts from "typescript";

const source = await readFile(new URL("../src/plan-rules.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText;
const { nextIds, appendInspections, buildPlannedInspections, mergePlanInspections, validatePlanForm, isEditable, isEnded, synthesizeTrack, trackLength, majority } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`);

const snapshot = { templateId: "TPL001", templateName: "公園設施標準巡查表", templateUpdatedAt: "2026-09-29 10:20", route: [[0, 0], [100, 0], [100, 100]], takenAt: "2026-09-30 08:00",
  objects: [{ objectId: "OBJ-A", templateIds: ["TPL001"] }, { objectId: "OBJ-B", templateIds: ["TPL001", "TPL004"] }] };
const form = (patch = {}) => ({ name: "黑沙環公園設施巡查", templateId: "TPL001", groupId: "inspect-north", startAt: "2026-09-30T09:00", endAt: "2026-09-30T12:00", ...patch });

test("nextIds continues after the highest id of the same date only", () => {
  assert.deepEqual(nextIds("IN", ["IN-20260930-0007", "IN-20260929-0040", "IN-20260930-0002"], "20260930", 2), ["IN-20260930-0008", "IN-20260930-0009"]);
  assert.deepEqual(nextIds("PL", [], "20261001", 1), ["PL-20261001-0001"]);
});
test("a plan generates one inspection per object × inspection template", () => {
  const list = buildPlannedInspections(snapshot, ["IN-20260930-0003"], "20260930");
  assert.deepEqual(list.map((item) => [item.id, item.objectId, item.templateId, item.seq, item.source]), [
    ["IN-20260930-0004", "OBJ-A", "TPL001", 1, "計劃模板"],
    ["IN-20260930-0005", "OBJ-B", "TPL001", 2, "計劃模板"],
    ["IN-20260930-0006", "OBJ-B", "TPL004", 3, "計劃模板"],
  ]);
});
test("added inspections continue the sequence and carry their source", () => {
  const added = appendInspections([{ objectId: "OBJ-C", templateId: "TPL002" }], ["IN-20260930-0006"], "20260930", 4, "額外加入", { addedBy: "區詠珊" });
  assert.deepEqual(added, [{ addedBy: "區詠珊", id: "IN-20260930-0007", objectId: "OBJ-C", templateId: "TPL002", seq: 4, source: "額外加入" }]);
});
test("App progress wins over the planned entry; App-only rows are kept", () => {
  const planned = buildPlannedInspections(snapshot, [], "20260930");
  const app = [
    { id: planned[0].id, planId: "PL-1", objectId: "OBJ-A", templateId: "TPL001", seq: 1, status: "已完成", inspector: "陳家朗", submittedAt: "2026-09-30 09:20" },
    { id: "IN-20260930-0099", planId: "PL-1", objectId: "OBJ-Z", templateId: "TPL001", seq: 9, status: "未完成" },
    { id: "IN-OTHER", planId: "PL-2", objectId: "OBJ-A", templateId: "TPL001", seq: 1, status: "已完成" },
  ];
  const rows = mergePlanInspections("PL-1", planned, app);
  assert.equal(rows.length, 4);
  assert.equal(rows[0].status, "已完成"); assert.equal(rows[0].inspector, "陳家朗");
  assert.equal(rows[1].status, "未完成");
  assert.equal(rows.at(-1).id, "IN-20260930-0099"); assert.equal(rows.at(-1).source, "現場建立");
});
test("seed plans without planned entries show App inspections as template inspections", () => {
  const app = [{ id: "IN-1", planId: "PL-SEED", objectId: "OBJ-A", templateId: "TPL001", seq: 1, status: "未完成" }];
  assert.equal(mergePlanInspections("PL-SEED", undefined, app)[0].source, "計劃模板");
  const extra = appendInspections([{ objectId: "OBJ-B", templateId: "TPL001" }], ["IN-1"], "20260929", 2, "額外加入");
  const rows = mergePlanInspections("PL-SEED", extra, app);
  assert.deepEqual(rows.map((row) => row.source), ["計劃模板", "額外加入"]);
});
test("plan form requires name, template, group and a valid time window", () => {
  assert.deepEqual(validatePlanForm(form()), []);
  assert.ok(validatePlanForm(form({ name: " " })).some((e) => e.includes("計劃名稱")));
  assert.ok(validatePlanForm(form({ name: "長".repeat(51) })).some((e) => e.includes("50 字")));
  assert.ok(validatePlanForm(form({ templateId: "" })).some((e) => e.includes("巡查模板")));
  assert.ok(validatePlanForm(form({ groupId: "" })).some((e) => e.includes("巡查群組")));
  assert.ok(validatePlanForm(form({ endAt: "2026-09-30T09:00" })).some((e) => e.includes("晚於")));
  assert.deepEqual(validatePlanForm(form({ startAt: "2026-09-30 09:00", endAt: "2026-09-30T10:00" })), []);
});
test("only not-started plans are editable; finished and stopped plans are ended", () => {
  assert.equal(isEditable("未開始"), true); assert.equal(isEditable("進行中"), false);
  assert.equal(isEnded("已完成"), true); assert.equal(isEnded("已中止"), true); assert.equal(isEnded("進行中"), false);
});
test("synthesized tracks follow the route up to the given share", () => {
  const full = synthesizeTrack(snapshot.route, 1, "2026-09-30 09:00");
  assert.deepEqual(full[0], [0, 0, "09:00"]);
  assert.deepEqual(full.at(-1).slice(0, 2), [100, 100]);
  assert.ok(Math.abs(trackLength(full) - 200) < 1);
  const half = synthesizeTrack(snapshot.route, 0.5, "2026-09-30 09:00");
  assert.deepEqual(half.at(-1).slice(0, 2), [100, 0]);
  assert.equal(half[1][2], "09:03");
  assert.deepEqual(synthesizeTrack(snapshot.route, 0, "09:00"), []);
  assert.deepEqual(synthesizeTrack([[0, 0]], 1, "09:00"), []);
});
test("plan objects and the template's applicable groups are checked when given", () => {
  assert.deepEqual(validatePlanForm(form({ objectIds: ["OBJ-A"], allowedGroupIds: ["inspect-north"] })), []);
  assert.ok(validatePlanForm(form({ objectIds: [] })).some((e) => e.includes("至少 1 個巡查對象")));
  assert.ok(validatePlanForm(form({ allowedGroupIds: ["inspect-island"] })).some((e) => e.includes("適用群組")));
  assert.deepEqual(validatePlanForm(form({ allowedGroupIds: [] })), [], "a template listing no groups allows any inspection group");
});
test("majority picks the most frequent value, the first seen on a tie", () => {
  assert.equal(majority(["北區", "中區", "北區"]), "北區"); assert.equal(majority(["中區", "北區"]), "中區"); assert.equal(majority([]), undefined);
});
