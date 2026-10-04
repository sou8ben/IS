import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import ts from "typescript";

const source = await readFile(new URL("../src/inspection-rules.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText;
const { snapshotTemplate, validateResults, submitRecord, saveDraft, supplementRecord, setVoided, countable, resultOf, itemState, mergeResults, approachTrack, attachmentChars } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`);

const template = { id: "TPL-T", name: "測試模板", inspectionType: "公園設施巡查", locationCheck: true, validDistance: 100, checkOn: ["提交"], items: [
  { key: "seat", name: "座椅穩固", itemType: "一般設施", kind: "BOOL", options: ["是", "否"], abnormal: ["否"], required: true, minAttachments: 0 },
  { key: "play", name: "遊樂設施", itemType: "一般設施", kind: "MULTI", options: ["正常", "鬆脫"], abnormal: ["鬆脫"], required: true, minAttachments: 1 },
  { key: "note", name: "備註", itemType: "一般設施", kind: "TEXT", required: false, minAttachments: 0, maxLength: 5 },
  { key: "sign", name: "簽名", itemType: "一般設施", kind: "SIGNATURE", required: false, minAttachments: 0 },
] };
const file = (name = "a.jpg") => ({ id: name, name, size: 10, kind: "image", src: "data:image/jpeg;base64,AAAA" });
const record = (patch = {}) => ({ id: "IN-1", origin: "後台", objectId: "OBJ-1", templateId: "TPL-T", snapshot: snapshotTemplate(template, "2026-10-01 09:00"), seq: 1, status: "未完成", source: "獨立", results: {}, changes: [], ...patch });
const good = { seat: { value: "是", attachments: [] }, play: { value: ["正常"], attachments: [file()] } };

test("required items, attachment minimums and text length are validated", () => {
  const errors = validateResults(record().snapshot, {});
  assert.deepEqual(errors.map((e) => e.key), ["seat", "play", "play"]);
  assert.ok(errors.some((e) => e.message.includes("為必填")));
  assert.ok(errors.some((e) => e.message.includes("至少 1 個附件")));
  assert.deepEqual(validateResults(record().snapshot, good), []);
  assert.ok(validateResults(record().snapshot, { ...good, note: { value: "字數太多了啊", attachments: [] } }).some((e) => e.message.includes("不可超過 5 字")));
  assert.ok(validateResults(record().snapshot, { ...good, play: { value: [], attachments: [file()] } }).some((e) => e.key === "play" && e.message.includes("必填")));
});
test("snapshot is a deep copy and ignores later template edits", () => {
  const rec = record();
  template.items[0].required = false;
  template.items[0].options.push("不確定");
  assert.equal(rec.snapshot.items[0].required, true);
  assert.deepEqual(rec.snapshot.items[0].options, ["是", "否"]);
  template.items[0].required = true; template.items[0].options.pop();
});
test("a draft stays 未完成; a valid submit completes it; an invalid submit changes nothing", () => {
  const draft = saveDraft(record(), { seat: { value: "是", attachments: [] } });
  assert.equal(draft.status, "未完成"); assert.equal(draft.results.seat.value, "是");
  const bad = submitRecord(draft, draft.results, "2026-10-01 10:00", "區詠珊");
  assert.equal(bad.record, undefined); assert.ok(bad.errors.length);
  const ok = submitRecord(draft, good, "2026-10-01 10:00", "區詠珊");
  assert.equal(ok.record.status, "已完成"); assert.equal(ok.record.submittedAt, "2026-10-01 10:00"); assert.equal(ok.record.inspector, "區詠珊");
  assert.equal(ok.record.changes.at(-1).action, "提交巡查");
  assert.ok(submitRecord(ok.record, good, "x", "y").errors.length);
});
test("results and states", () => {
  const done = submitRecord(record(), good, "t", "o").record;
  assert.equal(resultOf(done), "正常"); assert.equal(resultOf(record()), "待填寫");
  const abnormal = { ...done, results: { ...done.results, play: { value: ["鬆脫"], attachments: [file()] } } };
  assert.equal(resultOf(abnormal), "異常");
  assert.equal(itemState(done.snapshot.items[1], abnormal.results.play), "異常");
  assert.equal(itemState(done.snapshot.items[2], undefined), "待填");
});
test("supplement only adds: fills empty items, appends attachments and keeps existing values", () => {
  const done = submitRecord(record(), good, "t", "o").record;
  const result = supplementRecord(done, done, { seat: { value: "否", attachments: [file("x.jpg")] }, note: { value: "好", attachments: [] } }, "補錄", "區詠珊", "2026-10-02 08:00");
  assert.equal(result.error, undefined);
  assert.equal(result.record.results.seat.value, "是");
  assert.equal(result.record.results.seat.attachments.length, 1);
  assert.equal(result.record.results.note.value, "好");
  assert.equal(result.record.changes.at(-1).action, "補入");
  assert.ok(supplementRecord(done, done, { seat: { attachments: [] } }, "x", "o", "t").error.includes("沒有可補入"));
  assert.ok(supplementRecord(done, done, { note: { value: "好", attachments: [] } }, " ", "o", "t").error.includes("原因"));
  assert.ok(supplementRecord(record(), record(), {}, "x", "o", "t").error.includes("已完成"));
});
test("an overlay supplements an App inspection without copying its results", () => {
  const app = { ...record({ origin: "App" }), status: "已完成", results: { seat: { value: "是", attachments: [] } } };
  const overlay = { ...app, results: {}, changes: [] };
  const { record: next } = supplementRecord(overlay, app, { play: { value: ["正常"], attachments: [file()] }, seat: { value: "否", attachments: [] } }, "補", "o", "t");
  assert.deepEqual(Object.keys(next.results), ["play"]);
  const merged = mergeResults(app.snapshot, app.results, next.results);
  assert.equal(merged.seat.value, "是"); assert.deepEqual(merged.play.value, ["正常"]);
});
test("void and unvoid need a reason and cannot repeat; voided inspections do not count", () => {
  const done = submitRecord(record(), good, "t", "o").record;
  assert.ok(setVoided(done, true, "", "o", "t").error);
  const voided = setVoided(done, true, "重複記錄", "o", "t").record;
  assert.equal(voided.voided, true); assert.equal(voided.voidReason, "重複記錄");
  assert.ok(setVoided(voided, true, "again", "o", "t").error);
  assert.ok(submitRecord({ ...voided, status: "未完成" }, good, "t", "o").errors.length);
  assert.ok(supplementRecord(voided, voided, { note: { value: "好", attachments: [] } }, "x", "o", "t").error.includes("作廢"));
  assert.deepEqual(countable([done, voided, record()]).map((r) => r.voided), [undefined]);
  const back = setVoided(voided, false, "誤作廢", "o", "t").record;
  assert.equal(back.voided, false); assert.equal(back.voidReason, undefined);
  assert.equal(countable([back]).length, 1);
});
test("approach track ends at the object and attachment budget counts inline data", () => {
  const track = approachTrack([600, 100], "2026-10-01 09:20");
  assert.deepEqual(track.at(-1), [600, 100, "09:20"]); assert.equal(track[0][2], "09:08");
  assert.equal(attachmentChars({ a: { attachments: [file(), { id: "n", name: "n.pdf", size: 1, kind: "file" }] } }), "data:image/jpeg;base64,AAAA".length);
});
