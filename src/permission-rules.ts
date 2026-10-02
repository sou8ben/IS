// Prototype-only policy engine. Production must reconstruct trusted context and recheck on the server.
export type RuleEffect = "允許" | "拒絕";
export type RuleStatus = "生效" | "失效";
export type Verdict = "通過" | "不符合" | "資料缺失";
export const operations = [
  { id: "follow", name: "跟進工作", module: "工作管理", object: "工作", kind: "執行" },
  { id: "resolve", name: "解決工作", module: "工作管理", object: "工作", kind: "執行" },
  { id: "close", name: "關閉工作", module: "工作管理", object: "工作", kind: "管理" },
  { id: "reopen", name: "重啟工作", module: "工作管理", object: "工作", kind: "管理" },
  { id: "assign", name: "重新分派工作", module: "工作管理", object: "工作", kind: "管理" },
  { id: "void", name: "作廢工作", module: "工作管理", object: "工作", kind: "管理" },
  { id: "comment", name: "工作留言", module: "工作管理", object: "工作", kind: "任一" },
  { id: "create-plan", name: "制定巡查計劃", module: "巡查計劃", object: "新增巡查計劃", kind: "管理" },
  { id: "execute-inspection", name: "執行巡查", module: "巡查記錄", object: "巡查記錄", kind: "巡查" },
] as const;
export const modules = [...new Set(operations.map((op) => op.module))];
export const departments = ["市政署", "設施管理部", "環境衛生部", "綠化部"];
export const grids = ["花地瑪堂北區", "望德堂中區", "大堂南區", "氹仔中央區", "路環東區"];
export const workTypes = ["公共設施／座椅", "公共設施／指示牌", "環境衛生／收集設施", "綠化／樹木", "綠化／灌溉"];
export interface ResponsibilityGroup {
  id: string; name: string; kind: string; department: string;
  types: string[]; grids: string[]; managedGroups: string[]; objects: string[]; planning: boolean;
}
export const responsibilityGroups: ResponsibilityGroup[] = [
  { id: "exec-facility", name: "公園設施維護組", kind: "執行", department: "設施管理部", types: workTypes.slice(0, 2), grids: grids.slice(0, 3), managedGroups: [], objects: [], planning: false },
  { id: "exec-sanitation", name: "環境衛生執行組", kind: "執行", department: "環境衛生部", types: [workTypes[2]], grids: [grids[2]], managedGroups: [], objects: [], planning: false },
  { id: "exec-green", name: "綠化養護組", kind: "執行", department: "綠化部", types: workTypes.slice(3), grids: grids.slice(1, 4), managedGroups: [], objects: [], planning: false },
  { id: "inspect-north", name: "北區巡查一組", kind: "巡查", department: "設施管理部", types: workTypes.slice(0, 2), grids: [grids[0]], managedGroups: [], objects: ["OBJ-001"], planning: false },
  { id: "inspect-middle", name: "中區巡查組", kind: "巡查", department: "環境衛生部", types: [workTypes[2]], grids: [grids[2]], managedGroups: [], objects: ["OBJ-002"], planning: false },
  { id: "inspect-island", name: "離島巡查組", kind: "巡查", department: "綠化部", types: workTypes.slice(3), grids: [grids[3]], managedGroups: [], objects: ["OBJ-003"], planning: false },
  { id: "manage-facility", name: "設施管理群組", kind: "管理", department: "設施管理部", types: workTypes.slice(0, 2), grids: [grids[0]], managedGroups: ["inspect-north"], objects: ["OBJ-001"], planning: true },
  { id: "manage-sanitation", name: "環衛管理群組", kind: "管理", department: "環境衛生部", types: [workTypes[2]], grids: [grids[2]], managedGroups: ["inspect-middle"], objects: ["OBJ-002"], planning: true },
  { id: "manage-green", name: "綠化管理群組", kind: "管理", department: "綠化部", types: workTypes.slice(3), grids: [grids[3]], managedGroups: ["inspect-island"], objects: ["OBJ-003"], planning: true },
];
export const requestObjects = [
  { id: "OBJ-001", name: "黑沙環公園座椅", type: workTypes[0], grid: grids[0], department: "設施管理部" },
  { id: "OBJ-002", name: "南灣垃圾收集站", type: workTypes[2], grid: grids[2], department: "環境衛生部" },
  { id: "OBJ-003", name: "氹仔中央公園灌溉設施", type: workTypes[4], grid: grids[3], department: "綠化部" },
];
export interface PolicyUser { id: string; name: string; account: string; roles: string[]; level: number; department: string; groups: string[]; permissions: string[] }
const allPermissions = operations.map((op) => op.id);
export const policyUsers: PolicyUser[] = [
  { id: "USR-001", name: "陳家朗", account: "chan.kl", roles: ["巡查主管"], level: 3, department: "設施管理部", groups: ["inspect-north", "manage-facility"], permissions: allPermissions },
  { id: "USR-002", name: "李芷晴", account: "lei.cc", roles: ["執行人員"], level: 1, department: "環境衛生部", groups: ["exec-sanitation"], permissions: allPermissions },
  { id: "USR-003", name: "梁嘉敏", account: "leong.km", roles: ["管理主管"], level: 4, department: "環境衛生部", groups: ["manage-sanitation"], permissions: allPermissions },
  { id: "USR-004", name: "黃志峰", account: "wong.cf", roles: ["管理員"], level: 5, department: "環境衛生部", groups: ["exec-sanitation", "manage-sanitation"], permissions: allPermissions },
  { id: "USR-005", name: "何浩然", account: "ho.hr", roles: ["前台用戶"], level: 1, department: "綠化部", groups: ["inspect-island"], permissions: ["execute-inspection", "comment"] },
  { id: "USR-006", name: "區詠珊", account: "ao.ws", roles: ["管理主管"], level: 4, department: "設施管理部", groups: ["manage-facility"], permissions: allPermissions },
];
export type FieldKind = "text" | "list" | "number" | "boolean";
export interface PolicyField { id: string; label: string; kind: FieldKind; options?: string[]; source: "用戶" | "對象" | "職責關係" | "請求" }
export const policyFields: PolicyField[] = [
  { id: "user.roles", label: "操作用戶：角色", kind: "list", options: [...new Set(policyUsers.flatMap((u) => u.roles))], source: "用戶" },
  { id: "user.level", label: "操作用戶：數字層級", kind: "number", source: "用戶" },
  { id: "user.department", label: "操作用戶：部門", kind: "text", options: departments, source: "用戶" },
  { id: "user.groups", label: "操作用戶：所屬群組", kind: "list", options: responsibilityGroups.map((g) => g.id), source: "用戶" },
  { id: "user.groupKinds", label: "操作用戶：群組類型", kind: "list", options: ["檢視", "巡查", "執行", "報告", "管理"], source: "用戶" },
  ...(["department", "executionGroup", "managementGroup", "inspectionGroup", "type", "grid", "status", "creator", "handler"] as const).map((id, index): PolicyField => ({ id: `object.${id}`, label: `操作對象：${["所屬部門", "執行群組", "管理群組", "巡查群組", "工作類型", "網格", "目前狀態", "建立人", "執行人"][index]}`, kind: "text", source: "對象", options: id === "department" ? departments : id.endsWith("Group") ? responsibilityGroups.map((g) => g.id) : id === "type" ? workTypes : id === "grid" ? grids : id === "status" ? ["新建", "跟進中", "已解決", "已關閉", "未開始", "進行中", "已完成"] : policyUsers.map((u) => u.id) })),
  ...(["executionMember", "managementMember", "inspectionMember", "typeScope", "gridScope", "planning", "requestGroupScope", "requestObjectsScope"] as const).map((id, index): PolicyField => ({ id: `relation.${id}`, label: `同一群組職責：${["屬於對象執行群組", "屬於對象管理群組", "屬於對象巡查群組", "工作類型在範圍內", "網格在範圍內", "具有計劃制定職責", "所選群組在範圍內", "所選對象均在範圍內"][index]}`, kind: "boolean", source: "職責關係" })),
  { id: "request.group", label: "請求資料：所選群組", kind: "text", options: responsibilityGroups.map((g) => g.id), source: "請求" },
  { id: "request.department", label: "請求資料：部門", kind: "text", options: departments, source: "請求" },
  { id: "request.grid", label: "請求資料：網格", kind: "text", options: grids, source: "請求" },
  { id: "request.objects", label: "請求資料：所選對象", kind: "list", options: requestObjects.map((o) => o.id), source: "請求" },
];
export const operatorLabels = { eq: "等於", neq: "不等於", gt: "大於", lt: "小於", in: "屬於", notIn: "不屬於", any: "包含任一", unset: "未設定" };
export type Operator = keyof typeof operatorLabels;
export function fieldOperators(kind: FieldKind): Operator[] { return kind === "number" ? ["eq", "neq", "gt", "lt", "unset"] : kind === "list" ? ["any", "in", "notIn", "unset"] : kind === "boolean" ? ["eq", "neq"] : ["eq", "neq", "in", "notIn", "unset"]; }
export interface RuleCondition { id: string; type: "condition"; field: string; operator: Operator; mode: "value" | "field"; value: string; reference?: string }
export interface ConditionGroup { id: string; type: "group"; match: "all" | "any"; children: ConditionNode[] }
export type ConditionNode = RuleCondition | ConditionGroup;
export interface PermissionRule { id: string; code: string; name: string; module: string; operation: string; effect: RuleEffect; message: string; description: string; status: RuleStatus; conditions: ConditionGroup; version: number; updatedBy: string; updatedAt: string }
export const newId = () => globalThis.crypto.randomUUID();
export const newCondition = (): RuleCondition => ({ id: newId(), type: "condition", field: "user.groupKinds", operator: "any", mode: "value", value: "管理" });
export const newConditionGroup = (): ConditionGroup => ({ id: newId(), type: "group", match: "all", children: [newCondition()] });
export function newPermissionRule(): PermissionRule { return { id: newId(), code: "", name: "", module: "工作管理", operation: "close", effect: "拒絕", message: "", description: "", status: "生效", conditions: newConditionGroup(), version: 1, updatedBy: "陳家朗", updatedAt: "" }; }
export function valueLabel(value: string): string { return responsibilityGroups.find((g) => g.id === value)?.name ?? policyUsers.find((u) => u.id === value)?.name ?? requestObjects.find((o) => o.id === value)?.name ?? ({ true: "是", false: "否", all: "全部符合", any: "任一符合" } as Record<string, string>)[value] ?? value; }
export function summarize(node: ConditionNode): string {
  if (node.type === "group") return `（${node.children.map(summarize).join(node.match === "all" ? " 且 " : " 或 ")}）`;
  return `${policyFields.find((f) => f.id === node.field)?.label ?? node.field} ${operatorLabels[node.operator]}${node.operator === "unset" ? "" : ` ${node.mode === "field" ? policyFields.find((f) => f.id === node.reference)?.label ?? "未選欄位" : node.value.split("|").map(valueLabel).join("、")}`}`;
}
export function validateRule(rule: PermissionRule, others: PermissionRule[] = []): string[] {
  const errors: string[] = [];
  if (!rule.code.trim() || !rule.name.trim()) errors.push("請填寫編號及名稱。");
  if (!rule.id || !Number.isSafeInteger(rule.version) || rule.version < 1) errors.push("規則識別或版本無效。");
  if (others.filter((r) => r.id === rule.id).length > 1) errors.push("規則識別重複。");
  if (rule.conditions?.type !== "group") errors.push("校驗條件必須使用條件組。");
  if (others.some((r) => r.id !== rule.id && r.code.trim().toLowerCase() === rule.code.trim().toLowerCase())) errors.push("規則編號已存在。");
  if (!operations.some((op) => op.id === rule.operation && op.module === rule.module)) errors.push("模組與操作不一致。");
  if (!["允許", "拒絕"].includes(rule.effect) || !["生效", "失效"].includes(rule.status)) errors.push("規則效果或狀態無效。");
  if (rule.effect === "拒絕" && !rule.message.trim()) errors.push("拒絕規則必須填寫拒絕提示語。");
  let count = 0;
  const visit = (node: ConditionNode, depth: number) => {
    if (++count > 100 || depth > 6) { errors.push("條件最多 100 項、6 層分組。"); return; }
    if (!node || (node.type !== "condition" && node.type !== "group")) { errors.push("條件格式無效。"); return; }
    if (node.type === "group") {
      if (!["all", "any"].includes(node.match) || !Array.isArray(node.children) || !node.children.length) { errors.push("條件組不可為空。"); return; }
      node.children.forEach((child) => visit(child, depth + 1)); return;
    }
    const field = policyFields.find((f) => f.id === node.field);
    if (!field || !fieldOperators(field.kind).includes(node.operator)) { errors.push("條件欄位或比較方式無效。"); return; }
    if (rule.operation === "create-plan" && field.source === "對象") errors.push("新增計劃尚無操作對象，請使用請求資料欄位。");
    if (rule.operation !== "create-plan" && field.source === "請求") errors.push("此操作不提供新增計劃請求資料。");
    if (node.operator === "unset") return;
    if (node.mode === "field") {
      const ref = policyFields.find((f) => f.id === node.reference);
      if (!ref || ref.source !== "對象" || ref.kind !== field.kind || rule.operation === "create-plan") errors.push("請選擇相同資料類型的操作對象欄位。");
    } else if (node.mode !== "value" || !node.value.trim()) errors.push("條件比較值不可為空。");
    else if (field.kind === "number" && !Number.isFinite(Number(node.value))) errors.push("層級必須為數字。");
    else if (field.kind === "boolean" && !["true", "false"].includes(node.value)) errors.push("職責關係必須選擇是或否。");
    else if (field.options && node.value.split("|").some((v) => !field.options!.includes(v))) errors.push("條件值不在可選範圍內。");
  };
  visit(rule.conditions, 0);
  return [...new Set(errors)];
}
const condition = (field: string, value: string, operator: Operator = "eq"): RuleCondition => ({ id: newId(), type: "condition", field, operator, mode: "value", value });
const seed = (code: string, name: string, operation: string, effect: RuleEffect, children: RuleCondition[], message = ""): PermissionRule => ({ id: code, code, name, operation, module: operations.find((op) => op.id === operation)!.module, effect, message, description: "預設職責校驗規則", status: "生效", version: 1, updatedBy: "系統", updatedAt: "2026-10-02 09:00:00", conditions: { id: `${code}-conditions`, type: "group", match: "all", children } });
export const initialPermissionRules: PermissionRule[] = [
  seed("PERM-001", "執行群組禁止關閉工作", "close", "拒絕", [condition("user.groupKinds", "執行", "any")], "執行群組不可關閉工作，即使同時具有管理身份。"),
  seed("PERM-002", "管理群組驗收工作", "close", "允許", [condition("relation.managementMember", "true"), condition("relation.typeScope", "true"), condition("relation.gridScope", "true"), condition("object.status", "已解決")]),
  seed("PERM-003", "巡查群組禁止制定計劃", "create-plan", "拒絕", [condition("user.groupKinds", "巡查", "any")], "巡查群組不可制定巡查計劃，即使同時具有管理身份。"),
  seed("PERM-004", "制定計劃職責校驗", "create-plan", "允許", [condition("relation.planning", "true"), condition("relation.requestGroupScope", "true"), condition("relation.requestObjectsScope", "true"), condition("relation.gridScope", "true")]),
  ...["follow", "resolve", "reopen", "assign", "void", "comment", "execute-inspection"].map((id, index) => seed(`PERM-${String(index + 5).padStart(3, "0")}`, `${operations.find((op) => op.id === id)!.name}職責校驗`, id, "允許", [condition("relation.typeScope", "true"), condition("relation.gridScope", "true")])),
];
export interface PolicyObject { id: string; department?: string; executionGroup?: string; managementGroup?: string; inspectionGroup?: string; type?: string; grid?: string; status?: string; creator?: string; handler?: string }
export interface PlanRequest { group?: string; department?: string; grid?: string; objects?: string[] }
export interface PermissionContext { user?: PolicyUser; operation: string; object?: PolicyObject; request?: PlanRequest; groups: ResponsibilityGroup[] }
export interface ConditionResult { id: string; summary: string; result: Verdict; actual?: string; children?: ConditionResult[] }
export interface RuleResult { id: string; code: string; name: string; version: number; effect: RuleEffect; matched: boolean; error?: string; witness?: string; conditions: ConditionResult; attempts?: { group: string; responsibility: boolean; conditions: ConditionResult }[] }
export interface PermissionDecision { allowed: boolean; reason: string; functional: boolean; responsibility: boolean; witness?: string; rules: RuleResult[]; forbiddenIdentities: string[] }
const labelActual = (v: unknown) => Array.isArray(v) ? v.map(String).map(valueLabel).join("、") || "（空）" : valueLabel(String(v));
function readField(id: string, ctx: PermissionContext, group?: ResponsibilityGroup): unknown {
  const [source, field] = id.split(".");
  if (source === "user") {
    if (field === "groupKinds") return ctx.user?.groups.map((g) => ctx.groups.find((item) => item.id === g)?.kind);
    return ctx.user?.[field as keyof PolicyUser];
  }
  if (source === "object") return ctx.object?.[field as keyof PolicyObject];
  if (source === "request") return ctx.request?.[field as keyof PlanRequest];
  if (!group) return false;
  switch (field) {
    case "executionMember": return ctx.object?.executionGroup === undefined ? undefined : group.id === ctx.object.executionGroup && group.kind === "執行";
    case "managementMember": return ctx.object?.managementGroup === undefined ? undefined : group.id === ctx.object.managementGroup && group.kind === "管理";
    case "inspectionMember": return ctx.object?.inspectionGroup === undefined ? undefined : group.id === ctx.object.inspectionGroup && group.kind === "巡查";
    case "typeScope": return !ctx.object?.type ? undefined : group.types?.includes(ctx.object.type);
    case "gridScope": { const grid = ctx.operation === "create-plan" ? ctx.request?.grid : ctx.object?.grid; return !grid ? undefined : group.grids?.includes(grid); }
    case "planning": return group.planning;
    case "requestGroupScope": return !ctx.request?.group ? undefined : group.managedGroups?.includes(ctx.request.group);
    case "requestObjectsScope": return !ctx.request?.objects?.length ? undefined : ctx.request.objects.every((id) => { const obj = requestObjects.find((o) => o.id === id); return !!obj && group.objects?.includes(id) && group.types?.includes(obj.type) && group.grids?.includes(obj.grid) && obj.grid === ctx.request?.grid && obj.department === ctx.request?.department; });
    default: return undefined;
  }
}
function evaluateNode(node: ConditionNode, ctx: PermissionContext, group?: ResponsibilityGroup): ConditionResult {
  if (node.type === "group") {
    const children = node.children.map((child) => evaluateNode(child, ctx, group));
    const unknown = children.some((c) => c.result === "資料缺失");
    const pass = node.match === "all" ? children.every((c) => c.result === "通過") : children.some((c) => c.result === "通過");
    return { id: node.id, summary: node.match === "all" ? "全部符合" : "任一符合", children, result: unknown ? "資料缺失" : pass ? "通過" : "不符合" };
  }
  const actual = readField(node.field, ctx, group);
  const field = policyFields.find((f) => f.id === node.field)!;
  const expected = node.mode === "field" ? readField(node.reference!, ctx, group) : field.kind === "number" ? Number(node.value) : field.kind === "boolean" ? node.value === "true" : node.value.split("|");
  const missing = actual === undefined || actual === null || (Array.isArray(actual) && actual.some((v) => v === undefined));
  if (node.operator === "unset") return { id: node.id, summary: summarize(node), result: missing || actual === "" || (Array.isArray(actual) && !actual.length) ? "通過" : "不符合", actual: missing ? "未設定" : labelActual(actual) };
  if (missing || expected === undefined) return { id: node.id, summary: summarize(node), result: "資料缺失", actual: "缺少可信資料" };
  const a = Array.isArray(actual) ? actual : [actual]; const b = Array.isArray(expected) ? expected : [expected];
  let pass: boolean;
  switch (node.operator) {
    case "eq": pass = a.length === b.length && a.every((v, i) => v === b[i]); break;
    case "neq": pass = !(a.length === b.length && a.every((v, i) => v === b[i])); break;
    case "gt": pass = Number(actual) > Number(expected); break;
    case "lt": pass = Number(actual) < Number(expected); break;
    case "any": pass = a.some((v) => b.includes(v)); break;
    case "in": pass = a.length > 0 && a.every((v) => b.includes(v)); break;
    case "notIn": pass = a.every((v) => !b.includes(v)); break;
    default: pass = false;
  }
  return { id: node.id, summary: summarize(node), result: pass ? "通過" : "不符合", actual: labelActual(actual) };
}
function hasResponsibility(ctx: PermissionContext, group: ResponsibilityGroup): boolean {
  if (ctx.operation === "create-plan") return group.kind === "管理" && group.planning && group.department === ctx.request?.department && readField("relation.requestGroupScope", ctx, group) === true && readField("relation.requestObjectsScope", ctx, group) === true && readField("relation.gridScope", ctx, group) === true;
  const op = operations.find((o) => o.id === ctx.operation);
  const member = op?.kind === "管理" ? readField("relation.managementMember", ctx, group) : op?.kind === "巡查" ? readField("relation.inspectionMember", ctx, group) : op?.kind === "任一" ? ["executionMember", "managementMember", "inspectionMember"].some((f) => readField(`relation.${f}`, ctx, group) === true) : readField("relation.executionMember", ctx, group);
  return member === true && group.department === ctx.object?.department && readField("relation.typeScope", ctx, group) === true && readField("relation.gridScope", ctx, group) === true;
}
export function evaluatePermission(rules: PermissionRule[], ctx: PermissionContext): PermissionDecision {
  const decision: PermissionDecision = { allowed: false, reason: "校驗資料缺失。", functional: false, responsibility: false, rules: [], forbiddenIdentities: [] };
  try {
    const op = operations.find((item) => item.id === ctx.operation);
    if (!op || !ctx.user || !Array.isArray(ctx.user.permissions) || !ctx.user.permissions.includes(ctx.operation)) return { ...decision, reason: "未具備此操作的功能權限。" };
    decision.functional = true;
    if (!Array.isArray(ctx.user.groups) || !ctx.user.groups.length || ctx.user.groups.some((id) => !ctx.groups.some((g) => g.id === id))) return decision;
    if (ctx.operation === "create-plan" ? !ctx.request?.department || !ctx.request.grid || !ctx.request.group || !ctx.request.objects?.length || ctx.request.objects.some((id) => !requestObjects.some((o) => o.id === id)) || !ctx.groups.some((g) => g.id === ctx.request!.group) : !ctx.object?.id || !ctx.object.department || !ctx.object.type || !ctx.object.grid || !ctx.object.status) return decision;
    const candidates = ctx.groups.filter((g) => ctx.user!.groups.includes(g.id));
    const applicable = rules.filter((r) => r.status === "生效" && r.operation === ctx.operation);
    for (const rule of applicable) {
      const errors = validateRule(rule);
      if (errors.length) { decision.rules.push({ id: rule.id, code: rule.code, name: rule.name, version: rule.version, effect: rule.effect, matched: false, error: errors.join(" "), conditions: { id: rule.conditions?.id ?? rule.id, summary: "規則配置異常", result: "資料缺失" } }); continue; }
      const attempts = candidates.map((group) => ({ group, conditions: evaluateNode(rule.conditions, ctx, group) }));
      // An allow's rule conditions and mandatory responsibility checks must share one witness.
      const chosen = attempts.find((a) => a.conditions.result === "通過" && (rule.effect === "拒絕" || hasResponsibility(ctx, a.group))) ?? attempts.find((a) => a.conditions.result === "通過") ?? attempts.find((a) => a.conditions.result === "資料缺失") ?? attempts[0];
      decision.rules.push({ id: rule.id, code: rule.code, name: rule.name, version: rule.version, effect: rule.effect, matched: chosen.conditions.result === "通過" && (rule.effect === "拒絕" || hasResponsibility(ctx, chosen.group)), witness: chosen.group.name, conditions: chosen.conditions, attempts: attempts.map((a) => ({ group: a.group.name, responsibility: hasResponsibility(ctx, a.group), conditions: a.conditions })), error: attempts.some((a) => a.conditions.result === "資料缺失") ? "條件所需資料缺失。" : undefined });
    }
    const denies = decision.rules.filter((r) => r.effect === "拒絕" && r.matched);
    if (denies.length) {
      const identities = new Set<string>();
      const findIdentities = (node: ConditionNode, group?: ResponsibilityGroup) => {
        if (evaluateNode(node, ctx, group).result !== "通過") return;
        if (node.type === "group") { node.children.forEach((child) => findIdentities(child, group)); return; }
        if (!["any", "in", "eq"].includes(node.operator)) return;
        const values = node.value.split("|");
        if (node.field === "user.groupKinds") candidates.filter((g) => values.includes(g.kind)).forEach((g) => identities.add(`${g.name}（${g.kind}）`));
        if (node.field === "user.groups") candidates.filter((g) => values.includes(g.id)).forEach((g) => identities.add(`${g.name}（${g.kind}）`));
        if (node.field === "user.roles") ctx.user!.roles.filter((role) => values.includes(role)).forEach((role) => identities.add(role));
        if (node.field.startsWith("relation.") && node.field.endsWith("Member") && node.value === "true" && group) identities.add(`${group.name}（${group.kind}）`);
      };
      denies.forEach((result) => { const rule = applicable.find((r) => r.id === result.id)!; const group = candidates.find((g) => g.name === result.witness); findIdentities(rule.conditions, group); });
      decision.forbiddenIdentities = [...identities];
      return { ...decision, reason: denies.map((r) => applicable.find((a) => a.id === r.id)!.message).join(" ") };
    }
    if (decision.rules.some((r) => r.error)) return { ...decision, reason: "校驗異常或條件資料缺失，拒絕操作。" };
    const witness = candidates.find((g) => hasResponsibility(ctx, g));
    decision.responsibility = !!witness;
    const allow = decision.rules.find((r) => r.effect === "允許" && r.matched);
    if (!allow) return { ...decision, reason: !witness ? "操作對象不在同一群組的完整職責範圍內。" : "未命中完整的生效允許規則。" };
    return { ...decision, allowed: true, witness: allow.witness, reason: `通過 ${allow.code}，同一職責群組：${allow.witness}。` };
  } catch { return { ...decision, allowed: false, reason: "校驗異常，已拒絕操作。" }; }
}
export function workPolicyObject(work: { id: string; group: string; type: string; grid: string; status: string; creator?: string; handler?: string }): PolicyObject {
  const execution = responsibilityGroups.find((g) => g.name === work.group && g.kind === "執行");
  const management = responsibilityGroups.find((g) => g.kind === "管理" && g.department === execution?.department && g.types.includes(work.type));
  const inspection = responsibilityGroups.find((g) => g.kind === "巡查" && g.department === execution?.department && g.grids.includes(work.grid));
  return { id: work.id, department: execution?.department, executionGroup: execution?.id, managementGroup: management?.id, inspectionGroup: inspection?.id, type: work.type, grid: work.grid, status: work.status, creator: policyUsers.find((u) => u.name === work.creator)?.id, handler: policyUsers.find((u) => u.name === work.handler)?.id };
}
