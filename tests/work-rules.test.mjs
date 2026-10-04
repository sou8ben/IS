import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import ts from "typescript";

const source = await readFile(new URL("../src/work-rules.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText;
const m = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`);
const { allowedActions, applyAction, computeSla, resolveScheme, defaultSlaRules, findDuplicateCandidates, mergeDuplicates, linkDuplicateGroup, syncPeers, validateWork, diffWork, canEdit, renderTemplate, operationPoint, workModes, parseTime, durationText } = m;

const work = (patch = {}) => ({ id: "WK-1", title: "座椅鬆脫", type: "公共設施／座椅", priority: "一般", status: "新建", group: "公園設施維護組", sla: "正常", createdAt: "2026-09-29 09:00", x: 600, y: 100, ...patch });
const ctx = (patch = {}) => ({ id: "L-1", time: "2026-09-29 10:00", operator: "黃志峰", ...patch });
const act = (w, action, payload = {}, c = {}) => applyAction(w, action, payload, ctx(c));
const log = (action, time, patch = {}) => ({ id: `${action}-${time}`, workId: "WK-1", action, operator: "x", time, location: "—", ...patch });
const scheme = defaultSlaRules[0]; // 公園設施巡查 · 公共設施: 2 / 2 / 12 / 24 hours
const now = (text) => parseTime(text);

test("allowed actions follow the state machine", () => {
  assert.deepEqual(allowedActions(work()), ["跟進", "重新分派", "留言", "作廢"]);
  assert.deepEqual(allowedActions(work({ status: "跟進中" })), ["解決", "重新分派", "留言", "作廢"]);
  assert.deepEqual(allowedActions(work({ status: "已解決" })), ["關閉", "重啟", "留言", "作廢"]);
  assert.deepEqual(allowedActions(work({ status: "已關閉" })), ["重啟", "留言", "作廢"]);
  assert.deepEqual(allowedActions(work({ voided: true })), ["解除作廢"]);
  assert.deepEqual(allowedActions(work({ status: "已關閉", masterId: "WK-9" })), ["留言", "作廢"]);
});
test("illegal transitions are rejected with a reason", () => {
  assert.match(act(work({ status: "已關閉" }), "跟進").error, /請先重啟/);
  assert.ok(act(work({ status: "新建" }), "解決", { comment: "x" }).error);
  assert.ok(act(work({ status: "跟進中" }), "關閉", { comment: "x" }).error);
  assert.match(act(work({ status: "已關閉", masterId: "WK-9" }), "重啟", { comment: "x" }).error, /合併/);
  assert.match(act(work({ voided: true }), "留言", { comment: "x" }).error, /解除作廢/);
});
test("each action checks its required fields", () => {
  assert.ok(act(work({ status: "跟進中" }), "解決", { comment: " " }).error.includes("處理說明"));
  assert.ok(act(work({ status: "跟進中" }), "解決", { comment: "完成", attachmentCount: 0 }, { minAttachments: 2 }).error.includes("至少 2 個附件"));
  assert.equal(act(work({ status: "跟進中" }), "解決", { comment: "完成", attachmentCount: 2 }, { minAttachments: 2 }).error, undefined);
  assert.ok(act(work({ status: "已解決" }), "關閉", {}).error.includes("驗收意見"));
  assert.ok(act(work({ status: "已關閉" }), "重啟", {}).error.includes("重啟原因"));
  assert.ok(act(work(), "重新分派", { comment: "x" }).error.includes("新執行群組"));
  assert.ok(act(work(), "重新分派", { comment: "x", group: "公園設施維護組" }).error.includes("相同"));
  assert.ok(act(work(), "重新分派", { group: "綠化養護組" }).error.includes("原因"));
  assert.ok(act(work(), "留言", {}).error); assert.ok(act(work(), "作廢", {}).error);
});
test("actions produce the right patch and log", () => {
  const follow = act(work(), "跟進");
  assert.deepEqual([follow.patch.status, follow.patch.handler, follow.log.from, follow.log.to], ["跟進中", "黃志峰", "新建", "跟進中"]);
  const reopen = act(work({ status: "已解決", reopenCount: 1 }), "重啟", { comment: "不合格" });
  assert.deepEqual([reopen.patch.status, reopen.patch.reopenCount], ["新建", 2]);
  const reassign = act(work({ status: "跟進中" }), "重新分派", { group: "綠化養護組", comment: "派錯" });
  assert.equal(reassign.patch.group, "綠化養護組"); assert.equal(reassign.patch.status, "新建"); assert.match(reassign.log.comment, /改派至 綠化養護組；原因：派錯/);
  const comment = act(work(), "留言", { comment: "已到場" });
  assert.equal(comment.patch.status, undefined); assert.equal(comment.log.to, undefined);
  assert.equal(act(work(), "作廢", { comment: "重複" }).patch.voided, true);
  assert.equal(act(work({ voided: true }), "解除作廢", { comment: "誤作廢" }).patch.voided, false);
  assert.equal(follow.log.location, "後台操作（無定位）");
});
test("sla scheme is matched by inspection type, then work type, then default", () => {
  assert.equal(resolveScheme(defaultSlaRules, { topType: "公共設施", inspectionType: "公園設施巡查" }).id, "SLA-01");
  assert.equal(resolveScheme(defaultSlaRules, { topType: "公共設施", inspectionType: "海濱設施巡查" }).id, "SLA-02");
  assert.equal(resolveScheme(defaultSlaRules, { topType: "公共設施" }).id, "SLA-02");
  assert.equal(resolveScheme(defaultSlaRules, { topType: "綠化" }).id, "SLA-04");
  assert.equal(resolveScheme(defaultSlaRules, { topType: "其他" }).id, "SLA-99");
});
test("sla metrics: running, nearly overdue, overdue and met", () => {
  const w = work();
  let r = computeSla(w, [], now("2026-09-29 09:30"), scheme);
  assert.equal(r.overall, "正常"); assert.equal(r.metrics[0].state, "進行中"); assert.equal(Math.round(r.metrics[0].usedMin), 30);
  r = computeSla(w, [], now("2026-09-29 10:40"), scheme); // 100 of 120 minutes: 20 left <= 20%
  assert.equal(r.overall, "將逾時");
  r = computeSla(w, [], now("2026-09-29 11:30"), scheme);
  assert.equal(r.overall, "已逾時"); assert.match(r.text, /已逾時/);
  r = computeSla(w, [log("跟進", "2026-09-29 09:30")], now("2026-09-29 10:00"), scheme);
  assert.deepEqual(r.metrics.slice(0, 2).map((x) => x.state), ["達標", "達標"]); assert.equal(r.metrics[2].state, "進行中");
  r = computeSla(w, [log("跟進", "2026-09-29 12:00")], now("2026-09-29 12:10"), scheme);
  assert.equal(r.metrics[0].state, "超時完成");
});
test("priority scales the limits and replies count from either a comment or a follow-up", () => {
  const urgent = computeSla(work({ priority: "特急" }), [], now("2026-09-29 09:00"), scheme);
  assert.equal(urgent.metrics[0].limitMin, 30); // 2h × 0.25
  const reply = computeSla(work(), [log("留言", "2026-09-29 09:20")], now("2026-09-29 09:30"), scheme);
  assert.equal(reply.metrics[1].state, "達標"); assert.equal(reply.metrics[0].state, "進行中");
});
test("closing without earlier steps skips them; a reopen starts a new round and keeps old rounds", () => {
  const logs = [log("跟進", "2026-09-29 09:30"), log("解決", "2026-09-29 10:00"), log("關閉", "2026-09-29 11:00"), log("重啟", "2026-09-29 12:00")];
  const w = work({ status: "新建", reopenCount: 1 });
  const round2 = computeSla(w, logs, now("2026-09-29 12:30"), scheme);
  assert.equal(round2.round, 2); assert.equal(round2.rounds, 2); assert.equal(round2.roundStart, "2026-09-29 12:00");
  assert.equal(round2.metrics[0].state, "進行中"); assert.equal(Math.round(round2.metrics[0].usedMin), 30);
  const round1 = computeSla(w, logs, now("2026-09-29 12:30"), scheme, 1);
  assert.deepEqual(round1.metrics.map((x) => x.state), ["達標", "達標", "達標", "達標"]); assert.equal(round1.overall, "正常");
  const merged = computeSla(work({ status: "已關閉" }), [log("關閉", "2026-09-29 10:00")], now("2026-09-29 11:00"), scheme);
  assert.deepEqual(merged.metrics.map((x) => x.state), ["—", "—", "—", "達標"]);
  assert.equal(computeSla(work({ voided: true }), [], now("2026-09-30 09:00"), scheme).overall, "正常");
});
test("duplicate candidates: same top type, within 30 m, open and not merged", () => {
  const target = { id: "WK-1", type: "公共設施／座椅", x: 600, y: 100 };
  const list = [work({ id: "WK-1" }), work({ id: "WK-2", x: 605, y: 100 }), work({ id: "WK-3", x: 700, y: 100 }), work({ id: "WK-4", type: "綠化／樹木", x: 601, y: 100 }),
    work({ id: "WK-5", status: "已關閉", x: 601, y: 100 }), work({ id: "WK-6", voided: true, x: 601, y: 100 }), work({ id: "WK-7", masterId: "WK-2", x: 601, y: 100 }), work({ id: "WK-8", type: "公共設施／照明", x: 610, y: 105 }), work({ id: "WK-9", x: undefined })];
  assert.deepEqual(findDuplicateCandidates(list, target).map((w) => w.id), ["WK-2", "WK-8"]);
  assert.deepEqual(findDuplicateCandidates(list, { ...target, x: undefined }), []);
});
test("merge closes the duplicates with the master id and logs both sides", () => {
  const master = work({ id: "WK-1", status: "跟進中" }); const dups = [work({ id: "WK-2" }), work({ id: "WK-3", status: "已解決" })];
  const result = mergeDuplicates(master, dups, { time: "2026-09-29 10:00", operator: "區詠珊", idPrefix: "M" });
  assert.deepEqual(result.patches.map((p) => [p.id, p.patch.status, p.patch.masterId]), [["WK-2", "已關閉", "WK-1"], ["WK-3", "已關閉", "WK-1"]]);
  assert.equal(result.logs.length, 3); assert.equal(result.logs[0].from, "新建"); assert.match(result.logs[0].comment, /已合併至 WK-1/); assert.match(result.logs[2].comment, /WK-2、WK-3/);
  assert.ok(mergeDuplicates(work({ status: "已關閉" }), dups, { time: "t", operator: "o", idPrefix: "M" }).error);
  assert.ok(mergeDuplicates(master, [], { time: "t", operator: "o", idPrefix: "M" }).error);
  assert.ok(mergeDuplicates(master, [master], { time: "t", operator: "o", idPrefix: "M" }).error);
  assert.ok(mergeDuplicates(master, [work({ id: "WK-4", masterId: "WK-9" })], { time: "t", operator: "o", idPrefix: "M" }).error.includes("WK-4"));
});
test("link mode shares one group and merges existing groups; peers sync by prior status", () => {
  const all = [{ id: "A", dupGroup: "DUP-0001" }, { id: "B", dupGroup: "DUP-0001" }, { id: "C" }, { id: "D" }];
  assert.ok(linkDuplicateGroup(all, ["C"], "DUP-0002").error);
  assert.deepEqual(linkDuplicateGroup(all, ["C", "D"], "DUP-0002"), { group: "DUP-0002", ids: ["C", "D"] });
  assert.deepEqual(linkDuplicateGroup(all, ["A", "C"], "DUP-0002"), { group: "DUP-0001", ids: ["A", "B", "C"] });
  const works = [work({ id: "A", dupGroup: "G", status: "跟進中" }), work({ id: "B", dupGroup: "G", status: "跟進中" }), work({ id: "C", dupGroup: "G", status: "新建" }), work({ id: "D", dupGroup: "G", status: "跟進中", voided: true }), work({ id: "E", status: "跟進中" })];
  assert.deepEqual(syncPeers("跟進中", works[0], works).map((w) => w.id), ["B"]);
  assert.deepEqual(syncPeers("跟進中", { id: "E" }, works), []);
});
test("work validation and diff", () => {
  const types = ["公共設施／座椅"]; const draft = { title: "座椅", type: "公共設施／座椅", priority: "一般", description: "", address: "黑沙環", x: 10, y: 10, group: "公園設施維護組" };
  assert.deepEqual(validateWork(draft, types), []);
  const keys = (d) => validateWork(d, types).map((i) => i.key);
  assert.ok(keys({ ...draft, title: " " }).includes("title")); assert.ok(keys({ ...draft, title: "字".repeat(51) }).includes("title"));
  assert.ok(keys({ ...draft, type: "" }).includes("type")); assert.ok(keys({ ...draft, type: "其他" }).includes("type"));
  assert.ok(keys({ ...draft, address: "" }).includes("address")); assert.ok(keys({ ...draft, x: undefined }).includes("location")); assert.ok(keys({ ...draft, y: 5000 }).includes("location"));
  assert.ok(keys({ ...draft, group: "" }).includes("group")); assert.ok(keys({ ...draft, description: "字".repeat(1001) }).includes("description"));
  assert.deepEqual(diffWork(draft, draft), []);
  assert.deepEqual(diffWork(draft, { ...draft, priority: "緊急", x: 20, address: "新地址" }), ["優先級：一般 → 緊急", "地址：黑沙環 → 新地址", "位置已更改"]);
  assert.equal(canEdit({ status: "跟進中" }), true); assert.equal(canEdit({ status: "已關閉" }), false); assert.equal(canEdit({ status: "新建", voided: true }), false);
});
test("templates, operation points, quick modes and durations", () => {
  assert.equal(renderTemplate("已於［當前時間］到場［工作編號］［未知］", { "當前時間": "10:00", "工作編號": "WK-1" }), "已於10:00到場WK-1");
  const p = operationPoint({ x: 600, y: 100 }, { id: "L1", location: "距工作地點 26 米" });
  assert.ok(Math.abs(Math.hypot(p[0] - 600, p[1] - 100) - 10) < 1.5); assert.deepEqual(p, operationPoint({ x: 600, y: 100 }, { id: "L1", location: "距工作地點 26 米" }));
  assert.equal(operationPoint({ x: 1, y: 1 }, { id: "L", location: "後台操作（無定位）" }), null);
  const mode = (key) => workModes.find((x) => x.key === key).test;
  assert.equal(mode("overdue")({ status: "跟進中", group: "g", sla: "已逾時" }, "me"), true);
  assert.equal(mode("overdue")({ status: "已關閉", group: "g", sla: "已逾時" }, "me"), false);
  assert.equal(mode("unassigned")({ status: "新建", group: "待人工分派", sla: "正常" }, "me"), true);
  assert.equal(mode("duplicate")({ status: "新建", group: "g", sla: "正常", masterId: "X" }, "me"), true);
  assert.equal(mode("mine")({ status: "新建", group: "g", sla: "正常", creator: "me" }, "me"), true);
  assert.equal(durationText(125), "2 小時 5 分"); assert.equal(durationText(-30), "30 分鐘"); assert.equal(durationText(1500), "1 日 1 小時");
});
