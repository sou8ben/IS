import { test } from "node:test";
import assert from "node:assert/strict";
import { build } from "esbuild";
import { fileURLToPath } from "node:url";

// The seed 巡查計劃模板 import the App's seed data, so bundle them (as vite would) instead of transpiling a single file.
const entry = `
export { seedPlanTemplates, seedPlanTemplateOf } from "./src/plan-template-data.ts";
export { seedObjects } from "./src/object-data.ts";
export { initialTemplates } from "./src/inspection-templates.ts";
export { initialState } from "./src/data.ts";
export { validatePlanTemplate, inspectionEntries } from "./src/plan-templates.ts";
export { responsibilityGroups } from "./src/permission-rules.ts";`;
const result = await build({ stdin: { contents: entry, resolveDir: fileURLToPath(new URL("..", import.meta.url)), loader: "ts" }, bundle: true, write: false, platform: "node", format: "esm", logLevel: "silent", loader: { ".png": "dataurl", ".jpg": "dataurl", ".svg": "dataurl" }, define: { "import.meta.env.BASE_URL": '"/"' } });
const { seedPlanTemplates, seedPlanTemplateOf, seedObjects, initialTemplates, initialState, validatePlanTemplate, inspectionEntries, responsibilityGroups } = await import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString("base64")}`);

const context = {
  allowedGroupIds: responsibilityGroups.filter((group) => group.kind === "巡查").map((group) => group.id),
  objects: seedObjects().map((object) => ({ id: object.id, name: object.name, inspectionType: object.inspectionType, active: object.status === "啟用" })),
  templates: initialTemplates.map((template) => ({ id: template.id, name: template.name, inspectionType: template.inspectionType, status: template.status, objects: template.objects })),
};
const templates = seedPlanTemplates();

test("every seed 巡查計劃模板 is valid", () => {
  for (const template of templates) assert.deepEqual(validatePlanTemplate(template, templates, context), [], template.code);
});
test("seed plans belong to the seed template they were made from and have as many inspections as it lists", () => {
  for (const [planId, templateId] of Object.entries(seedPlanTemplateOf)) {
    const plan = initialState.plans.find((item) => item.id === planId); const template = templates.find((item) => item.id === templateId);
    assert.equal(plan.planTemplateId, templateId, planId); assert.equal(plan.template, template.name, planId); assert.equal(plan.total, inspectionEntries(template).length, planId);
  }
  assert.equal(initialState.plans.find((item) => item.id === "PL-20260927-0012").planTemplateId, undefined, "the 路環步道 plan predates 巡查計劃模板");
});
test("the demonstration templates show an object with two 巡查模板 and a route-only template", () => {
  assert.ok(templates.some((template) => template.objects.some((object) => object.templateIds.length === 2)));
  assert.ok(templates.some((template) => template.route.length >= 2 && !template.objects.length));
  assert.ok(templates.every((template) => template.route.flat().every(Number.isInteger)), "waypoints are whole map pixels");
  assert.deepEqual(initialState.planTemplates.map((template) => template.id), templates.map((template) => template.id));
});
