import type { Plan, Work } from "../types";
import { dispatchRules, grids, METERS_PER_PX, objectGroups, workMeta, workTypeConfig } from "./data";
import type { Inspection, InspectionTemplate, ItemResult, Persona, TemplateItem } from "./types";

// ---- 示範時鐘：以 2026-09-29 12:06 為起點，按實際經過時間推進 ----
const clockStart = Date.now();
const demoBase = new Date(2026, 8, 29, 12, 6).getTime();
export const demoNow = () => new Date(demoBase + (Date.now() - clockStart));
const pad = (value: number) => String(value).padStart(2, "0");
export const fmt = (date: Date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
export const nowText = () => fmt(demoNow());
export const clockText = () => { const now = demoNow(); return `${pad(now.getHours())}:${pad(now.getMinutes())}`; };
export const parseTime = (text: string) => { const [date, time = "00:00"] = text.split(" "); const [y, m, d] = date.split("-").map(Number); const [h, min] = time.split(":").map(Number); return new Date(y, m - 1, d, h, min).getTime(); };
export const shortTime = (text?: string) => text ? (text.startsWith("2026-09-29") ? text.slice(11) : text.slice(5)) : "—";

export const topType = (type: string) => type.split("／")[0];
export const gridOf = (x: number, y: number) => grids.find((grid) => x >= grid.x1 && x <= grid.x2 && y >= grid.y1 && y <= grid.y2)?.name ?? "未歸屬";
export const distanceM = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.round(Math.hypot(a.x - b.x, a.y - b.y) * METERS_PER_PX);

export const workCreator = (work: Work) => work.creator ?? workMeta[work.id]?.creator ?? "系統";
export const workHandler = (work: Work) => work.handler ?? workMeta[work.id]?.handler;
export const workInspection = (work: Work) => ({ inspectionId: work.inspectionId ?? workMeta[work.id]?.inspectionId, itemKey: work.inspectionItem ?? workMeta[work.id]?.inspectionItem, objectId: work.objectId ?? workMeta[work.id]?.objectId });
export const workDupGroup = (work: Work) => work.dupGroup ?? workMeta[work.id]?.dupGroup;
export const workPoint = (work: Work) => ({ x: work.x ?? workMeta[work.id]?.x ?? 640, y: work.y ?? workMeta[work.id]?.y ?? 120 });

// ---- 權限：操作按鈕按「狀態 × 身份」動態顯示（詳細設計 2.3、6.2） ----
export type WorkAction = "跟進" | "解決" | "關閉" | "重啟" | "重新分派" | "留言" | "作廢" | "解除作廢";
export const actionTarget: Partial<Record<WorkAction, Work["status"]>> = { "跟進": "跟進中", "解決": "已解決", "關閉": "已關閉", "重啟": "新建", "重新分派": "新建" };

export function availableActions(work: Work, persona: Persona): WorkAction[] {
  const execMember = persona.groups.some((group) => group.kind === "執行" && group.name === work.group);
  const admin = persona.groups.some((group) => group.kind === "管理");
  const acceptor = !!persona.acceptTypes?.includes(topType(work.type));
  const creator = workCreator(work) === persona.name;
  if (work.voided) return admin ? ["解除作廢"] : [];
  const actions: WorkAction[] = [];
  if (work.status === "新建" && execMember) actions.push("跟進");
  if (work.status === "跟進中" && execMember) actions.push("解決");
  if (work.status === "已解決" && acceptor) actions.push("關閉");
  if ((work.status === "已解決" || work.status === "已關閉") && (acceptor || creator)) actions.push("重啟");
  if ((work.status === "新建" || work.status === "跟進中") && (execMember || admin)) actions.push("重新分派");
  actions.push("留言");
  if (admin) actions.push("作廢");
  return actions;
}

export function actionDeniedReason(work: Work, persona: Persona) {
  if (work.status === "已解決" && !persona.acceptTypes?.includes(topType(work.type))) return "只有與此工作類型關聯的驗收群組可關閉工作";
  if ((work.status === "新建" || work.status === "跟進中") && !persona.groups.some((group) => group.kind === "執行" && group.name === work.group)) return `只有「${work.group}」成員可跟進及解決此工作`;
  return "";
}

// ---- 數據範圍 ----
export function isMyWork(work: Work, persona: Persona) { return workCreator(work) === persona.name || workHandler(work) === persona.name; }
export function isGroupWork(work: Work, persona: Persona, plans: Plan[]) {
  if (persona.groups.some((group) => group.kind === "管理")) return true;
  if (persona.groups.some((group) => group.name === work.group)) return true;
  const plan = plans.find((item) => item.id === work.planId);
  return isMyWork(work, persona) || (!!plan && persona.groups.some((group) => group.name === plan.group));
}
export const visiblePlans = (plans: Plan[], persona: Persona) => plans.filter((plan) => persona.groups.some((group) => group.kind === "巡查" && group.name === plan.group));

// ---- 自動分派（詳細設計 6.4） ----
export function dispatchWork(type: string, grid: string, objectId?: string) {
  const top = topType(type);
  const objectGroup = objectId ? objectGroups[objectId]?.[top] : undefined;
  if (objectGroup) return { group: objectGroup, reason: "對象負責群組", auto: true };
  const rule = dispatchRules.find((item) => item.type === top && (!item.grids.length || item.grids.includes(grid)));
  if (rule) return { group: rule.group, reason: `分派規則 #${rule.priority}「${rule.name}」`, auto: true };
  const fallback = workTypeConfig[top]?.defaultGroup;
  if (fallback) return { group: fallback, reason: "工作類型默認執行群組", auto: true };
  return { group: "待人工分派", reason: "無匹配規則，將通知管理群組", auto: false };
}

// ---- 服務承諾（詳細設計 6.5；示範時限：一般 24 小時、緊急 3.5 小時、特急 2 小時） ----
const slaLimitHours: Record<Work["priority"], number> = { "一般": 24, "緊急": 3.5, "特急": 2 };
const durationText = (minutes: number) => { const m = Math.abs(Math.round(minutes)); const d = Math.floor(m / 1440); const h = Math.floor((m % 1440) / 60); const r = m % 60; return d ? `${d} 日 ${h} 小時` : h ? `${h} 小時 ${r} 分` : `${r} 分鐘`; };
export function slaInfo(work: Work): { state: Work["sla"]; text: string; percent: number } {
  if (work.status === "已解決" || work.status === "已關閉") return { state: work.sla, text: work.status === "已關閉" ? "已完結，計時停止" : "已解決，等待驗收", percent: 100 };
  const limit = slaLimitHours[work.priority] * 60;
  const elapsed = (demoNow().getTime() - parseTime(work.createdAt)) / 60000;
  const remain = limit - elapsed;
  const percent = Math.min(100, Math.max(0, (elapsed / limit) * 100));
  if (remain < 0) return { state: "已逾時", text: `已逾時 ${durationText(remain)}`, percent: 100 };
  return { state: remain <= limit * 0.2 ? "將逾時" : "正常", text: `剩餘 ${durationText(remain)}`, percent };
}

// ---- 巡查表 ----
export function isAbnormal(item: TemplateItem, value: ItemResult["value"]) {
  if (!item.abnormal || value === undefined) return false;
  return Array.isArray(value) ? value.some((option) => item.abnormal!.includes(option)) : item.abnormal.includes(value);
}
const isEmpty = (item: TemplateItem, result?: ItemResult) => {
  if (item.kind === "SIGNATURE") return !result?.signature;
  const value = result?.value;
  return value === undefined || value === "" || (Array.isArray(value) && value.length === 0);
};

export interface SubmitError { key: string; message: string }
export function validateInspection(template: InspectionTemplate, inspection: Inspection, results: Record<string, ItemResult>): SubmitError[] {
  const errors: SubmitError[] = [];
  const location = inspection.location;
  if (template.locationCheck && template.checkOn.includes("提交") && !location?.nfc) {
    if (!location) errors.push({ key: "location", message: "尚未取得定位，請重新定位" });
    else if (location.accuracy > template.validDistance) errors.push({ key: "location", message: `定位精度不足（±${location.accuracy} 米），請重新定位` });
    else if (location.distance > template.validDistance) errors.push({ key: "location", message: `未在對象 ${template.validDistance} 米範圍內（目前距離 ${location.distance} 米）` });
  }
  template.items.forEach((item) => { if (item.required && isEmpty(item, results[item.key])) errors.push({ key: item.key, message: `『${item.name}』為必填` }); });
  template.items.forEach((item) => { const count = results[item.key]?.photos.length ?? 0; if (count < item.minAttachments) errors.push({ key: item.key, message: `『${item.name}』需至少 ${item.minAttachments} 張相片` }); });
  return errors;
}

// ---- 編號及模板參數 ----
export function nextCode(prefix: string, ids: string[], date = "20260929") {
  const max = ids.reduce((value, id) => { const match = id.match(new RegExp(`^${prefix}-${date}-(\\d{4})$`)); return match ? Math.max(value, Number(match[1])) : value; }, 0);
  return `${prefix}-${date}-${String(max + 1).padStart(4, "0")}`;
}
export const renderTemplate = (content: string, params: Record<string, string>) => content.replace(/［(.+?)］/g, (_, key: string) => params[key] ?? "");
