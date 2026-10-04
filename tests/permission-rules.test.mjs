import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import ts from "typescript";

// Run the exact frontend engine without a browser or a separate mock implementation.
const source = await readFile(new URL("../src/permission-rules.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText;
const { evaluatePermission, initialPermissionRules, policyUsers, responsibilityGroups, newConditionGroup, validateRule, summarize, workPolicyObject, inspectionPolicyObject } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`);
const clone = (v) => structuredClone(v);
const target = { id: "WK-TEST", department: "環境衛生部", executionGroup: "exec-sanitation", managementGroup: "manage-sanitation", inspectionGroup: "inspect-middle", type: "環境衛生／收集設施", grid: "大堂南區", status: "已解決" };
const context = (user = policyUsers[2], object = target, operation = "close") => ({ user: clone(user), object: clone(object), operation, groups: clone(responsibilityGroups) });
const run = (ctx, rules = initialPermissionRules) => evaluatePermission(clone(rules), ctx);
const leaf = (field, value, operator = "eq", rest = {}) => ({ id: crypto.randomUUID(), type: "condition", field, operator, mode: "value", value, ...rest });

test("all seed rules are valid; codes are unique", () => {
  for (const rule of initialPermissionRules) assert.deepEqual(validateRule(rule, initialPermissionRules), []);
});
test("management in the correct scope can close resolved work", () => {
  const result = run(context()); assert.equal(result.allowed, true); assert.equal(result.functional, true); assert.equal(result.responsibility, true); assert.equal(result.witness, "環衛管理群組");
});
test("execution-only identity cannot close", () => {
  const result = run(context(policyUsers[1])); assert.equal(result.allowed, false); assert.match(result.reason, /執行群組不可/); assert.equal(result.rules.find((r) => r.code === "PERM-001").matched, true);
});
test("execution plus management administrator is denied; allow cannot override", () => {
  const result = run(context(policyUsers[3])); assert.equal(result.allowed, false); assert.equal(result.rules.find((r) => r.code === "PERM-002").matched, true); assert.match(result.reason, /即使同時具有管理身份/); assert.deepEqual(result.forbiddenIdentities, ["環境衛生執行組（執行）"]);
});
test("missing functional permission stops before rule evaluation", () => {
  const ctx = context(); ctx.user.permissions = []; const result = run(ctx); assert.equal(result.allowed, false); assert.equal(result.functional, false); assert.equal(result.rules.length, 0);
});
test("out-of-scope grid and department fail closed", () => {
  for (const patch of [{ grid: "路環東區" }, { department: "綠化部" }]) { const result = run(context(undefined, { ...target, ...patch })); assert.equal(result.allowed, false); assert.equal(result.responsibility, false); }
});
test("wrong work status does not match acceptance allow", () => {
  const result = run(context(undefined, { ...target, status: "跟進中" })); assert.equal(result.allowed, false); assert.match(result.reason, /未命中/);
});
test("membership in group A and type scope in group B cannot be combined", () => {
  const ctx = context();
  ctx.user.groups.push("manage-other");
  ctx.groups.find((g) => g.id === "manage-sanitation").types = [];
  ctx.groups.push({ ...clone(ctx.groups.find((g) => g.id === "manage-sanitation")), id: "manage-other", name: "另一管理群組", types: [target.type] });
  const result = run(ctx); assert.equal(result.allowed, false); assert.equal(result.rules.find((r) => r.code === "PERM-002").matched, false);
});
test("rule condition witness and mandatory responsibility witness must be the same", () => {
  const ctx = context(); const extra = { ...clone(ctx.groups.find((g) => g.id === "manage-sanitation")), id: "manage-other", name: "另一管理群組" };
  ctx.user.groups.push(extra.id); ctx.groups.push(extra);
  const allow = clone(initialPermissionRules.find((r) => r.code === "PERM-002"));
  allow.conditions.children = [leaf("relation.managementMember", "false")];
  assert.equal(run(ctx, [allow]).allowed, false);
});
test("plan creation checks prospective request data and all selected objects", () => {
  const ctx = { ...context(), operation: "create-plan", object: undefined, request: { group: "inspect-middle", department: "環境衛生部", grid: "大堂南區", objects: ["OBJ-002"] } };
  assert.equal(run(ctx).allowed, true);
  for (const patch of [{ group: "inspect-north" }, { objects: ["OBJ-002", "OBJ-001"] }, { grid: "路環東區" }, { objects: [] }, { department: "市政署" }]) assert.equal(run({ ...ctx, request: { ...ctx.request, ...patch } }).allowed, false);
});
test("inspection plus management identity cannot create a plan", () => {
  const ctx = { ...context(policyUsers[0]), operation: "create-plan", object: undefined, request: { group: "inspect-north", department: "設施管理部", grid: "花地瑪堂北區", objects: ["OBJ-001"] } };
  const result = run(ctx); assert.equal(result.allowed, false); assert.match(result.reason, /巡查群組不可/);
});
test("inactive allow and no configured allow deny; inactive deny does not apply", () => {
  const rules = clone(initialPermissionRules); rules.find((r) => r.code === "PERM-002").status = "失效"; assert.equal(run(context(), rules).allowed, false);
  assert.equal(run(context(), []).allowed, false);
  rules.find((r) => r.code === "PERM-002").status = "生效"; rules.find((r) => r.code === "PERM-001").status = "失效";
  assert.equal(run(context(policyUsers[3]), rules).allowed, true);
});
test("missing target/user/group data is rejected rather than defaulting to allow", () => {
  for (const patch of [{ object: undefined }, { user: undefined }, { object: { ...target, grid: undefined } }, { groups: [] }]) assert.equal(run({ ...context(), ...patch }).allowed, false);
});
test("missing data in a deny rule fails closed even with a matching allow", () => {
  const rules = clone(initialPermissionRules); const deny = rules.find((r) => r.code === "PERM-001"); deny.conditions.children = [leaf("object.creator", "USR-001")];
  assert.equal(run(context(), rules).allowed, false);
});
test("nested ANY/ALL and numeric comparisons evaluate actual values", () => {
  const allow = clone(initialPermissionRules.find((r) => r.code === "PERM-002"));
  allow.conditions.children.push({ ...newConditionGroup(), match: "any", children: [leaf("user.level", "10", "gt"), leaf("user.level", "5", "lt")] });
  assert.equal(run(context(), [allow]).allowed, true);
  allow.conditions.children.at(-1).children[1].value = "3"; assert.equal(run(context(), [allow]).allowed, false);
  assert.match(summarize(allow.conditions), / 或 /);
});
test("object-field comparisons and multi-choice membership work", () => {
  const allow = clone(initialPermissionRules.find((r) => r.code === "PERM-002"));
  allow.conditions.children.push(leaf("user.department", "", "eq", { mode: "field", reference: "object.department" }), leaf("user.roles", "管理主管|巡查主管", "any"));
  assert.deepEqual(validateRule(allow), []); assert.equal(run(context(), [allow]).allowed, true);
});
test("unset can be configured but cannot bypass missing mandatory responsibility data", () => {
  const allow = clone(initialPermissionRules.find((r) => r.code === "PERM-002")); allow.conditions.children = [leaf("object.creator", "", "unset")]; assert.equal(run(context(), [allow]).allowed, true);
  assert.equal(run(context(undefined, { ...target, grid: undefined }), [allow]).allowed, false);
});
test("invalid config, empty groups, duplicate code and numeric format are rejected", () => {
  const rule = clone(initialPermissionRules[1]); rule.code = initialPermissionRules[0].code; assert.match(validateRule(rule, initialPermissionRules).join(" "), /已存在/);
  rule.conditions.children = []; assert.match(validateRule(rule).join(" "), /不可為空/); assert.equal(run(context(), [rule]).allowed, false);
  rule.conditions.children = [leaf("user.level", "abc")]; assert.match(validateRule(rule).join(" "), /數字/);
  rule.conditions.children = [leaf("user.level", "1", "eq", { mode: "field", reference: "object.department" })]; assert.match(validateRule(rule).join(" "), /相同資料類型/);
});
test("unknown work assignment does not infer a responsibility grant", () => {
  const object = workPolicyObject({ id: "UNKNOWN", group: "待人工分派", type: target.type, grid: target.grid, status: "已解決" }); assert.equal(object.department, undefined); assert.equal(run(context(undefined, object)).allowed, false);
});
test("simulation is pure and never mutates rule/context/business data", () => {
  const rules = clone(initialPermissionRules); const ctx = context(); const before = JSON.stringify({ rules, ctx }); run(ctx, rules); assert.equal(JSON.stringify({ rules, ctx }), before);
});
test("data errors in nested ANY cannot hide behind a passing branch", () => {
  const rules = clone(initialPermissionRules); const deny = rules[0];
  deny.conditions.match = "any"; deny.conditions.children = [leaf("user.roles", "管理主管", "any"), leaf("object.creator", "USR-001")];
  const result = run(context(), rules); assert.equal(result.allowed, false); assert.match(result.reason, /資料缺失/);
});
test("malformed context/configuration returns a denial, not an exception", () => {
  assert.equal(run({ ...context(), groups: null }).allowed, false);
  const rule = clone(initialPermissionRules[1]); rule.conditions.children = [leaf("unknown.field", "x")]; assert.equal(run(context(), [rule]).allowed, false);
  rule.conditions = null; assert.equal(run(context(), [rule]).allowed, false);
});
test("infinite numeric values, missing deny messages and mismatched modules are invalid", () => {
  const rule = clone(initialPermissionRules[0]); rule.message = ""; rule.module = "巡查計劃"; rule.conditions.children = [leaf("user.level", "Infinity")];
  const errors = validateRule(rule).join(" "); assert.match(errors, /提示語/); assert.match(errors, /不一致/); assert.match(errors, /數字/);
});
test("void-inspection: management in scope is allowed; other scope, inspection-only and unmapped data are denied", () => {
  const inspection = (grid, objectType = "公園設施") => inspectionPolicyObject({ id: "IN-1", grid, objectType, status: "已完成" });
  const as = (user, object) => run(context(user, object, "void-inspection"));
  const facility = policyUsers.find((u) => u.id === "USR-006");
  assert.equal(as(facility, inspection("花地瑪堂北區")).allowed, true);
  assert.equal(as(facility, inspection("大堂南區", "街道環境")).allowed, false);
  assert.equal(as(policyUsers.find((u) => u.id === "USR-003"), inspection("花地瑪堂北區")).allowed, false, "management group of another scope");
  assert.equal(as(policyUsers[0], inspection("花地瑪堂北區")).allowed, true, "an inspector who is also in the in-scope management group");
  assert.equal(as(policyUsers.find((u) => u.id === "USR-005"), inspection("花地瑪堂北區")).allowed, false);
  assert.equal(as(facility, inspection("花地瑪堂西區")).allowed, false, "grid without a management group");
});
