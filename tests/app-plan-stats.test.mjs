import { test } from "node:test";
import assert from "node:assert/strict";
import { build } from "esbuild";
import { fileURLToPath } from "node:url";

// src/app/rules.ts imports the App's seed data, so bundle it (as vite would) instead of transpiling a single file.
const entry = `export { planStats, isMergeable, planTag, PLAN_COLORS } from "./src/app/rules.ts";`;
const result = await build({ stdin: { contents: entry, resolveDir: fileURLToPath(new URL("..", import.meta.url)), loader: "ts" }, bundle: true, write: false, platform: "node", format: "esm", logLevel: "silent", loader: { ".png": "dataurl", ".jpg": "dataurl", ".svg": "dataurl" }, define: { "import.meta.env.BASE_URL": '"/"' } });
const { planStats, isMergeable, planTag, PLAN_COLORS } = await import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString("base64")}`);

const inspection = (planId, status, onSite) => ({ planId, status, ...(onSite ? { onSite: true } : {}) });

test("a plan card counts scheduled and on-site inspections apart", () => {
  const inspections = [inspection("PL-1", "已完成"), inspection("PL-1", "已完成"), inspection("PL-1", "未完成"), inspection("PL-1", "已完成", true), inspection("PL-1", "未完成", true), inspection("PL-2", "已完成")];
  assert.deepEqual(planStats("PL-1", inspections, [], []), { planned: 3, done: 2, linked: 5, onSite: 2, works: 0, events: 0 });
  assert.deepEqual(planStats("PL-2", inspections, [], []), { planned: 1, done: 1, linked: 1, onSite: 0, works: 0, events: 0 });
  assert.deepEqual(planStats("PL-9", inspections, [], []), { planned: 0, done: 0, linked: 0, onSite: 0, works: 0, events: 0 });
});
test("on-site inspections never count towards 已執行 / 需巡查", () => {
  const stats = planStats("PL-1", [inspection("PL-1", "已完成", true), inspection("PL-1", "已完成", true)], [], []);
  assert.equal(stats.done, 0); assert.equal(stats.planned, 0); assert.equal(stats.linked, 2); assert.equal(stats.onSite, 2);
});
test("linked works and events are counted per plan; voided works are left out", () => {
  const works = [{ planId: "PL-1" }, { planId: "PL-1", voided: true }, { planId: "PL-1" }, { planId: "PL-2" }, {}];
  const events = [{ planId: "PL-1" }, { planId: "PL-2" }, { planId: "PL-2" }, {}];
  const stats = planStats("PL-1", [], works, events);
  assert.equal(stats.works, 2); assert.equal(stats.events, 1);
  assert.equal(planStats("PL-2", [], works, events).events, 2);
});
test("only not-started or stopped plans can be shown merged", () => {
  assert.equal(isMergeable({ status: "未開始" }), true); assert.equal(isMergeable({ status: "已中止" }), true);
  assert.equal(isMergeable({ status: "進行中" }), false); assert.equal(isMergeable({ status: "已完成" }), false);
});
test("merged plans are told apart by letter and colour, repeating after the palette runs out", () => {
  assert.deepEqual(planTag(0), { letter: "A", color: PLAN_COLORS[0] });
  assert.deepEqual(planTag(2), { letter: "C", color: PLAN_COLORS[2] });
  assert.equal(planTag(PLAN_COLORS.length).color, PLAN_COLORS[0]);
  assert.equal(new Set(Array.from({ length: PLAN_COLORS.length }, (_, index) => planTag(index).color)).size, PLAN_COLORS.length);
  assert.equal(planTag(PLAN_COLORS.length).letter, String.fromCharCode(65 + PLAN_COLORS.length));
});
