import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import ts from "typescript";

const source = await readFile(new URL("../src/item-rules.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText;
const m = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`);
const { validateItemType, validateItem, validateSummaries, validateNotifyRules, itemUsage, isLocked, deactivationBlock, summarySla, evaluateNotifications, nextItemCode, nextTypeId, sortItems, appKindOf, parseTime, validateAuxDefs, sortAux, lastResultOf, lastResultsOf, resultText, resolveAux, auxHasContent } = m;

const types = [{ id: "IT-01", name: "一般設施", order: 1, status: "生效" }, { id: "IT-02", name: "供水設施", order: 2, status: "生效" }];
const workTypes = ["公共設施／座椅", "綠化／灌溉"];
const groups = ["設施管理群組", "公園設施維護組"];
const item = (patch = {}) => ({ id: "ITEM-001", code: "ITEM-001", name: "座椅穩固狀態", inspectionType: "公園設施巡查", itemTypeId: "IT-01", inputKind: "是非", options: ["是", "否"], abnormal: ["否"], order: 1, summaries: [], notifications: [], status: "生效", updatedBy: "", updatedAt: "", ...patch });
const ctx = (patch = {}) => ({ all: [item(), item({ id: "ITEM-002", code: "ITEM-002", name: "灌溉水管", itemTypeId: "IT-02", inputKind: "單選", options: ["正常", "滲漏"], abnormal: ["滲漏"] })], inspectionTypes: ["公園設施巡查", "街道環境巡查"], itemTypeIds: ["IT-01", "IT-02"], workTypes, groups, ...patch });
const draft = (patch = {}) => item({ id: "NEW", code: "", name: "飲水機", ...patch });
const tabs = (d, c = ctx()) => validateItem(d, c).issues.map((issue) => issue.tab);
const messages = (d, c = ctx()) => validateItem(d, c).issues.map((issue) => issue.message).join(" | ");
const rule = (patch = {}) => ({ id: "R1", name: "新建 12 小時未跟進", states: ["新建"], since: "建立", hours: 12, recipients: { execGroup: true, creator: false, groups: ["設施管理群組"] }, level: "緊急", message: "工作［工作編號］已［經過時間］仍處於［狀態］", active: true, ...patch });

test("item types: name 1–30 and unique, order a positive integer, no 失效 while items are active", () => {
  assert.deepEqual(validateItemType({ name: "照明設施", order: 3, status: "生效" }, types, 0), []);
  assert.match(validateItemType({ name: " ", order: 1, status: "生效" }, types, 0)[0], /類型名稱/);
  assert.match(validateItemType({ name: "一般設施", order: 1, status: "生效" }, types, 0)[0], /已存在/);
  assert.deepEqual(validateItemType({ name: "一般設施", order: 1, status: "生效" }, types, 0, "IT-01"), [], "editing keeps its own name");
  assert.match(validateItemType({ name: "新類型", order: 0, status: "生效" }, types, 0)[0], /順序/);
  assert.match(validateItemType({ name: "新類型", order: 1.5, status: "生效" }, types, 0)[0], /順序/);
  assert.match(validateItemType({ name: "一般設施", order: 1, status: "失效" }, types, 3, "IT-01")[0], /3 個生效中/);
  assert.equal(nextTypeId(["IT-01", "IT-06"]), "IT-07");
});

test("a valid item passes; a blank code gets the next ITEM number", () => {
  const result = validateItem(draft(), ctx());
  assert.deepEqual(result.issues, []);
  assert.equal(result.record.code, "ITEM-003"); assert.deepEqual(result.record.options, ["是", "否"]);
  assert.equal(nextItemCode(["ITEM-001", "ITEM-033", "X"]), "ITEM-034");
});

test("basic data: code, name unique within the inspection type, types exist, order", () => {
  assert.ok(messages(draft({ code: "ITEM-001" })).includes("已存在"));
  assert.ok(messages(draft({ code: "有空 格" })).includes("英文字母"));
  assert.ok(messages(draft({ name: "座椅穩固狀態" })).includes("已有名為"));
  assert.deepEqual(tabs(draft({ name: "座椅穩固狀態", inspectionType: "街道環境巡查" })), [], "same name in another inspection type is fine");
  assert.ok(messages(draft({ inspectionType: "" })).includes("請選擇巡查類型"));
  assert.ok(messages(draft({ itemTypeId: "IT-99" })).includes("項目類型不存在"));
  assert.ok(messages(draft({ order: 0 })).includes("順序"));
});

test("input kinds: 是非 fixed options; 單選／多選 2–20 distinct options; 輸入框 length; 簽名 none", () => {
  assert.deepEqual(validateItem(draft({ options: ["x"] }), ctx()).record.options, ["是", "否"], "是非 options are always 是／否");
  assert.ok(messages(draft({ inputKind: "單選", options: ["一"], abnormal: [] })).includes("2–20"));
  assert.ok(messages(draft({ inputKind: "多選", options: ["a", ""], abnormal: [] })).includes("不可留空"));
  assert.ok(messages(draft({ inputKind: "單選", options: ["a", "A"], abnormal: [] })).includes("不可重複"));
  assert.ok(messages(draft({ inputKind: "單選", options: Array.from({ length: 21 }, (_, i) => `o${i}`), abnormal: [] })).includes("2–20"));
  assert.ok(messages(draft({ inputKind: "輸入框", options: [], abnormal: [] })).includes("字數上限"));
  const text = validateItem(draft({ inputKind: "輸入框", options: ["殘留"], abnormal: ["殘留"], maxLength: 500 }), ctx()).record;
  assert.deepEqual([text.options, text.abnormal, text.maxLength], [[], [], 500], "text items drop options");
  const signature = validateItem(draft({ inputKind: "簽名", options: [], abnormal: [], maxLength: 99 }), ctx()).record;
  assert.equal("maxLength" in signature, false);
});

test("abnormal values must be options, and a single answer cannot make every option abnormal", () => {
  assert.ok(messages(draft({ inputKind: "單選", options: ["正常", "滲漏"], abnormal: ["破裂"] })).includes("異常值須為選項"));
  assert.ok(messages(draft({ abnormal: ["是", "否"] })).includes("不可包含全部選項"));
  assert.deepEqual(tabs(draft({ inputKind: "多選", options: ["鬆脫", "破損"], abnormal: ["鬆脫", "破損"] })), [], "multi choice may mark every option");
});

test("usage locks the inspection type and input kind, and blocks 失效", () => {
  const templates = [{ items: [{ itemId: "ITEM-001" }], status: "生效" }, { items: [{ itemId: "ITEM-001" }], status: "失效" }];
  const usage = itemUsage("ITEM-001", templates, [{ items: [{ itemId: "ITEM-001" }] }]);
  assert.deepEqual(usage, { templates: 2, activeTemplates: 1, appTemplates: 1 }); assert.equal(isLocked(usage), true);
  assert.equal(isLocked(itemUsage("ITEM-009", templates, [])), false);
  assert.match(deactivationBlock(usage), /1 個生效中的巡查模板及 1 個 App 巡查表/);
  assert.equal(deactivationBlock({ templates: 1, activeTemplates: 0, appTemplates: 0 }), null, "only inactive templates use it");
  const locked = ctx({ usage, original: item() });
  assert.ok(messages(item({ inputKind: "單選", options: ["a", "b"], abnormal: [] }), locked).includes("輸入方式不可修改"));
  assert.ok(messages(item({ inspectionType: "街道環境巡查" }), locked).includes("巡查類型不可修改"));
  assert.ok(messages(item({ status: "失效" }), locked).includes("不可設為失效"));
  assert.deepEqual(tabs(item({ abnormal: ["是"] }), locked), [], "abnormal values stay editable");
});

test("work summaries: text 1–100 and unique, a leaf work type, ordered SLA hours", () => {
  const summary = (patch = {}) => ({ id: "S1", summary: "座椅螺絲鬆脫", workType: "公共設施／座椅", sla: null, ...patch });
  assert.deepEqual(validateSummaries([summary(), summary({ id: "S2", summary: "木條破損", sla: { assign: 2, firstReply: 2, resolve: 12, complete: 24 } })], workTypes), []);
  assert.match(validateSummaries([summary({ summary: "" })], workTypes)[0], /請輸入摘要/);
  assert.match(validateSummaries([summary(), summary({ id: "S2" })], workTypes).join(), /重複/);
  assert.match(validateSummaries([summary({ workType: "公共設施" })], workTypes)[0], /細分類型/);
  assert.match(validateSummaries([summary({ sla: { assign: 0, firstReply: 2, resolve: 12, complete: 24 } })], workTypes)[0], /大於 0/);
  assert.match(validateSummaries([summary({ sla: { assign: 20, firstReply: 2, resolve: 12, complete: 24 } })], workTypes)[0], /≤ 解決 ≤ 完成/);
  assert.match(validateSummaries([summary({ sla: { assign: 2, firstReply: 2, resolve: 30, complete: 24 } })], workTypes)[0], /≤ 解決 ≤ 完成/);
  const withSla = { summaries: [summary({ sla: { assign: 1, firstReply: 1, resolve: 6, complete: 12 } }), summary({ id: "S2", summary: "木條破損" })] };
  assert.deepEqual(summarySla(withSla, " 座椅螺絲鬆脫 "), { assign: 1, firstReply: 1, resolve: 6, complete: 12 });
  assert.equal(summarySla(withSla, "木條破損"), null, "a summary without its own SLA uses the general rules");
  assert.equal(summarySla(withSla, "公園座椅螺絲鬆脫"), null, "only an exact summary matches");
  assert.ok(tabs(draft({ summaries: [summary({ workType: "" })] })).includes("summaries"));
});

test("notification rules: name, states, hours, recipients, level and known placeholders", () => {
  assert.deepEqual(validateNotifyRules([rule()], groups), []);
  assert.match(validateNotifyRules([rule({ name: "" })], groups)[0], /通知名稱/);
  assert.match(validateNotifyRules([rule(), rule({ id: "R2" })], groups).join(), /重複/);
  assert.match(validateNotifyRules([rule({ states: [] })], groups)[0], /工作狀態/);
  assert.match(validateNotifyRules([rule({ hours: 0 })], groups)[0], /1–720/);
  assert.match(validateNotifyRules([rule({ hours: 2.5 })], groups)[0], /1–720/);
  assert.match(validateNotifyRules([rule({ recipients: { execGroup: false, creator: false, groups: [] } })], groups)[0], /通知對象/);
  assert.match(validateNotifyRules([rule({ recipients: { execGroup: false, creator: false, groups: ["不存在組"] } })], groups)[0], /群組不存在/);
  assert.match(validateNotifyRules([rule({ message: "請處理［負責人］" })], groups)[0], /不支援的參數「負責人」/);
  assert.ok(tabs(draft({ notifications: [rule({ hours: 0 })] })).includes("notifications"));
});

test("notifications trigger once the hours pass while the work stays in a listed state", () => {
  const work = { id: "WK-1", title: "座椅螺絲鬆脫", status: "新建", createdAt: "2026-09-29 00:00", group: "公園設施維護組", creator: "陳家朗" };
  const at = (text) => parseTime(text);
  const target = { name: "座椅穩固狀態", notifications: [rule()] };
  const [before] = evaluateNotifications(work, target, [], at("2026-09-29 11:59"));
  assert.deepEqual([before.applicable, before.triggered, before.dueAt], [true, false, "2026-09-29 12:00"]);
  const [after] = evaluateNotifications(work, target, [], at("2026-09-29 12:30"));
  assert.equal(after.triggered, true);
  assert.deepEqual(after.recipients, ["公園設施維護組", "設施管理群組"]);
  assert.equal(after.message, "工作WK-1已12 小時 30 分仍處於新建");
  const [followed] = evaluateNotifications({ ...work, status: "跟進中" }, target, [], at("2026-09-30 00:00"));
  assert.deepEqual([followed.applicable, followed.triggered], [false, false], "not in a listed state");
  assert.equal(evaluateNotifications({ ...work, voided: true }, target, [], at("2026-09-30 00:00"))[0].triggered, false, "voided works never trigger");
  assert.equal(evaluateNotifications(work, { name: "x", notifications: [rule({ active: false })] }, [], at("2026-09-30 00:00")).length, 0, "inactive rules are skipped");
  // since the last status change
  const sinceChange = { name: "x", notifications: [rule({ states: ["跟進中"], since: "狀態變更", hours: 2, recipients: { execGroup: false, creator: true, groups: [] } })] };
  const logs = [{ to: "新建", time: "2026-09-29 00:00" }, { to: "跟進中", time: "2026-09-29 09:46" }, { time: "2026-09-29 11:42" }];
  const [change] = evaluateNotifications({ ...work, status: "跟進中" }, sinceChange, logs, at("2026-09-29 12:06"));
  assert.deepEqual([change.base, change.dueAt, change.triggered, change.recipients], ["2026-09-29 09:46", "2026-09-29 11:46", true, ["陳家朗"]]);
});

test("items sort by inspection type, item-type order, then their own order; kinds map to the App", () => {
  const list = [item({ code: "C", inspectionType: "街道環境巡查", order: 1 }), item({ code: "B", itemTypeId: "IT-02", order: 1 }), item({ code: "A", order: 2 }), item({ code: "D", order: 1 })];
  assert.deepEqual(sortItems(list, ["公園設施巡查", "街道環境巡查"], types).map((entry) => entry.code), ["D", "A", "B", "C"]);
  assert.deepEqual(Object.values(appKindOf), ["BOOL", "SINGLE", "MULTI", "TEXT", "SIGNATURE"]);
});

test("輔助資料: name 1–20 and unique, a source, an order, an attribute for 對象屬性, a short keyword", () => {
  const def = (patch = {}) => ({ id: "A1", name: "上次巡查結果", source: "上次巡查結果", order: 1, ...patch });
  assert.deepEqual(validateAuxDefs([def(), def({ id: "A2", name: "路段地址", source: "對象屬性", order: 2, attribute: "地址" }), def({ id: "A3", name: "水管走向圖", source: "對象附件", order: 3, keyword: "水管" })]), []);
  assert.match(validateAuxDefs([def({ name: " " })])[0], /請輸入名稱/);
  assert.match(validateAuxDefs([def({ name: "字".repeat(21) })])[0], /20/);
  assert.match(validateAuxDefs([def(), def({ id: "A2" })]).join(), /重複/);
  assert.match(validateAuxDefs([def({ source: "其他" })])[0], /內容來源/);
  assert.match(validateAuxDefs([def({ order: 0 })])[0], /順序/);
  assert.match(validateAuxDefs([def({ source: "對象屬性" })])[0], /對象屬性/);
  assert.match(validateAuxDefs([def({ source: "對象屬性", attribute: "顏色" })])[0], /對象屬性/);
  assert.match(validateAuxDefs([def({ source: "對象附件", keyword: "字".repeat(31) })])[0], /30/);
  assert.deepEqual(validateAuxDefs([def({ count: 5 })]), []);
  assert.match(validateAuxDefs([def({ count: 11 })])[0], /顯示次數/); assert.match(validateAuxDefs([def({ count: 2.5 })])[0], /顯示次數/);
  assert.ok(tabs(draft({ auxiliary: [def({ order: 0 })] })).includes("auxiliary"));
  const saved = validateItem(draft({ auxiliary: [def({ source: "對象屬性", attribute: "地址", keyword: "x" }), def({ id: "A2", name: "圖", source: "對象附件", order: 2, keyword: "  ", attribute: "地址" })] }), ctx()).record.auxiliary;
  assert.deepEqual(saved, [{ id: "A1", name: "上次巡查結果", source: "對象屬性", order: 1, attribute: "地址" }, { id: "A2", name: "圖", source: "對象附件", order: 2 }], "only the source's own setting is kept");
  assert.deepEqual(sortAux([def({ id: "b", order: 2 }), def({ id: "a", order: 1 }), def({ id: "c", order: 2 })]).map((d) => d.id), ["a", "b", "c"]);
});

test("上次巡查結果: latest earlier completed, non-voided inspection of the same object and item", () => {
  const entry = (id, time, value, patch = {}) => ({ id, objectId: "OBJ-1", status: "已完成", time, items: [{ key: "seat", itemId: "ITEM-001", kind: "BOOL" }], results: { seat: { value } }, ...patch });
  const history = [
    entry("IN-1", "2026-09-20 09:00", "是"), entry("IN-2", "2026-09-25 09:00", "否", { results: { seat: { value: "否", remark: "螺絲鬆脫" } } }),
    entry("IN-3", "2026-09-27 09:00", "是", { voided: true }), entry("IN-4", "2026-09-28 09:00", "是", { objectId: "OBJ-2" }),
    entry("IN-5", "2026-09-28 10:00", "是", { status: "未完成" }), entry("IN-6", "2026-09-29 09:00", "是"),
    { id: "IN-7", objectId: "OBJ-1", status: "已完成", time: "2026-09-26 09:00", items: [{ key: "ITEM-001", itemId: "ITEM-001", kind: "BOOL" }], results: { "ITEM-001": { value: "是" } } },
  ];
  const target = (patch = {}) => ({ inspectionId: "IN-6", objectId: "OBJ-1", itemId: "ITEM-001", key: "seat", ...patch });
  const pick = (result) => result && { id: result.inspectionId, time: result.time, text: result.text, value: result.value, remark: result.remark };
  assert.deepEqual(pick(lastResultOf(history, target({ before: "2026-09-29 09:00" }))), { id: "IN-7", time: "2026-09-26 09:00", text: "是", value: "是", remark: undefined }, "matched by item id across templates; voided, other objects and unfinished ones are skipped");
  assert.deepEqual(pick(lastResultOf(history, target({ before: "2026-09-26 09:00" }))), { id: "IN-2", time: "2026-09-25 09:00", text: "否（備註：螺絲鬆脫）", value: "否", remark: "螺絲鬆脫" });
  assert.deepEqual(lastResultsOf(history, target({ before: "2026-09-29 09:00" }), 5).map((result) => result.inspectionId), ["IN-7", "IN-2", "IN-1"], "latest first, up to the count");
  const withMeta = lastResultsOf([entry("IN-10", "2026-09-28 09:00", "否", { inspector: "陳家朗", results: { seat: { value: "否", attachments: [{ id: "p1", name: "相片.jpg" }] } } })], target({ inspectionId: "x" }), 5)[0];
  assert.deepEqual([withMeta.inspector, withMeta.files.length, withMeta.raw], ["陳家朗", 1, "否"], "inspector and photos go along for the drawer");
  assert.equal(lastResultOf(history, target({ inspectionId: "IN-X" })).inspectionId, "IN-6", "an unfinished inspection sees the latest completed one");
  assert.equal(lastResultOf(history, target({ before: "2026-09-20 09:00" })), null, "nothing earlier");
  assert.equal(lastResultOf([entry("IN-8", "2026-09-28 09:00", "是", { items: [{ key: "seat", kind: "BOOL" }] })], target({ inspectionId: "x" })).inspectionId, "IN-8", "records without item ids match by key");
  assert.equal(lastResultOf([entry("IN-9", "2026-09-28 09:00", undefined)], target({ inspectionId: "x" })), null, "an empty result is not a last result");
  assert.equal(resultText("MULTI", { value: ["部件鬆脫", "表面破損"] }), "部件鬆脫、表面破損");
  assert.equal(resultText("SIGNATURE", { signature: "data:" }), "已簽名");
});

test("resolveAux gives each entry its value in order", () => {
  const defs = [{ id: "c", name: "水管走向圖", source: "對象附件", order: 3, keyword: "水管" }, { id: "a", name: "上次巡查結果", source: "上次巡查結果", order: 1 }, { id: "b", name: "路段地址", source: "對象屬性", order: 2, attribute: "地址" }, { id: "d", name: "網格", source: "對象屬性", order: 4, attribute: "堂區" }];
  const files = [{ id: "f1", name: "水管走向圖.pdf" }, { id: "f2", name: "現場相片.jpg" }];
  const entries = resolveAux(defs, { results: [], attribute: (name) => name === "地址" ? "黑沙環海邊馬路" : undefined, attachments: files });
  assert.deepEqual(entries.map((entry) => [entry.def.id, entry.text, entry.empty]), [["a", "—", true], ["b", "黑沙環海邊馬路", false], ["c", "水管走向圖.pdf", false], ["d", "—", true]]);
  assert.equal(auxHasContent(entries), true); assert.equal(auxHasContent([entries[0], entries[3]]), false, "no button when nothing has data");
  assert.deepEqual(entries[2].files.map((file) => file.id), ["f1"]);
  const results = ["否", "是", "是", "否", "是", "是"].map((value, index) => ({ inspectionId: `IN-${index}`, time: `2026-09-2${index}`, text: value, value }));
  const one = resolveAux([defs[1]], { results, attribute: () => undefined, attachments: [] })[0];
  assert.deepEqual([one.text, one.results.length], ["否", 1], "the default shows the last result");
  const five = resolveAux([{ ...defs[1], count: 5 }], { results, attribute: () => undefined, attachments: [] })[0];
  assert.deepEqual([five.text, five.results.map((result) => result.inspectionId)], ["否 · 是 · 是 · 否 · 是", ["IN-0", "IN-1", "IN-2", "IN-3", "IN-4"]]);
  assert.equal(resolveAux([{ ...defs[0], keyword: "" }], { results: [], attribute: () => undefined, attachments: files })[0].files.length, 2, "a blank keyword shows every attachment");
});
