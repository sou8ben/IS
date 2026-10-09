// Inspection item logic (巡查項目類型, 巡查項目, work summaries and their SLA, custom work notifications).
// Import-free so tests can transpile and run it directly.

export type ItemInputKind = "是非" | "單選" | "多選" | "輸入框" | "簽名";
export type RecordStatus = "生效" | "失效";
export type NotifyState = "新建" | "跟進中" | "已解決";
export type NoticeLevel = "一般" | "緊急" | "特急";
export type ItemTab = "basic" | "input" | "summaries" | "notifications" | "auxiliary";

/** Hours for a 一般 work, scaled by priority like the general SLA rules. */
export interface SlaHours { assign: number; firstReply: number; resolve: number; complete: number }
export interface ItemTypeRecord { id: string; name: string; order: number; status: RecordStatus; updatedBy: string; updatedAt: string }
/** A work summary offered when creating a work from the item; `sla` null means the general work SLA rules apply. */
export interface ItemSummary { id: string; summary: string; workType: string; sla: SlaHours | null }
export interface NotifyRecipients { execGroup: boolean; creator: boolean; groups: string[] }
/** Fires for a work created from the item when it is still in one of `states` `hours` after `since`. */
export interface NotifyRule { id: string; name: string; states: NotifyState[]; since: "建立" | "狀態變更"; hours: number; recipients: NotifyRecipients; level: NoticeLevel; message: string; active: boolean }
export type AuxSource = "上次巡查結果" | "對象屬性" | "對象附件";
/**
 * 巡查輔助資料: reference information shown with the item while it is filled or viewed.
 * `attribute` picks the object field for 對象屬性; `keyword` filters 對象附件 by file name (blank = all attachments).
 */
/** `count`: how many earlier results 上次巡查結果 shows (1–10, default 1; e.g. 5 = 上五次巡查結果). */
export interface AuxDef { id: string; name: string; source: AuxSource; order: number; count?: number; attribute?: string; keyword?: string }
export interface ManagedItem {
  id: string; code: string; name: string; inspectionType: string; itemTypeId: string;
  inputKind: ItemInputKind; options: string[]; abnormal: string[]; maxLength?: number; order: number;
  summaries: ItemSummary[]; notifications: NotifyRule[]; auxiliary: AuxDef[]; status: RecordStatus; updatedBy: string; updatedAt: string;
}
export interface ItemIssue { tab: ItemTab; message: string }

export const inputKinds: ItemInputKind[] = ["是非", "單選", "多選", "輸入框", "簽名"];
export const notifyStates: NotifyState[] = ["新建", "跟進中", "已解決"];
export const noticeLevels: NoticeLevel[] = ["一般", "緊急", "特急"];
export const notifyPlaceholders = ["工作編號", "工作摘要", "巡查項目", "狀態", "經過時間"];
export const auxSources: AuxSource[] = ["上次巡查結果", "對象屬性", "對象附件"];
/** The object fields 對象屬性 can show (built-in fields; objects have no custom fields). */
export const objectAttributes = ["對象編號", "對象名稱", "地址", "堂區", "所屬網格", "經緯度", "地圖範圍", "負責執行群組"];
export const AUX_NAME_MAX = 20; export const AUX_KEYWORD_MAX = 30; export const AUX_COUNT_MAX = 10;
/** Shown for an entry with nothing to show. */
export const AUX_EMPTY = "—";
export const BOOL_OPTIONS = ["是", "否"];
export const CODE_MAX = 32; export const NAME_MAX = 50; export const TYPE_NAME_MAX = 30; export const OPTIONS_MAX = 20; export const OPTION_MAX = 30;
export const TEXT_LIMIT_MAX = 1000; export const SUMMARY_MAX = 100; export const RULE_NAME_MAX = 30; export const MESSAGE_MAX = 200; export const HOURS_MAX = 720; export const ORDER_MAX = 9999;
/** The App's names for the input kinds. */
export const appKindOf: Record<ItemInputKind, "BOOL" | "SINGLE" | "MULTI" | "TEXT" | "SIGNATURE"> = { "是非": "BOOL", "單選": "SINGLE", "多選": "MULTI", "輸入框": "TEXT", "簽名": "SIGNATURE" };
export const hasOptions = (kind: ItemInputKind) => kind === "是非" || kind === "單選" || kind === "多選";

const CODE_PATTERN = /^[A-Za-z0-9_-]+$/;
const lower = (text: string) => text.trim().toLowerCase();
const chars = (text: string) => [...text].length;
const isOrder = (value: number) => Number.isInteger(value) && value >= 1 && value <= ORDER_MAX;
const isHours = (value: number) => typeof value === "number" && Number.isFinite(value) && value > 0 && value <= HOURS_MAX;

export function nextItemCode(codes: string[]): string {
  const max = codes.reduce((value, code) => { const match = code.match(/^ITEM-(\d+)$/i); return match ? Math.max(value, Number(match[1])) : value; }, 0);
  return `ITEM-${String(max + 1).padStart(3, "0")}`;
}
export const nextTypeId = (ids: string[]) => `IT-${String(Math.max(0, ...ids.map((id) => Number(id.match(/^IT-(\d+)$/)?.[1] ?? 0))) + 1).padStart(2, "0")}`;

// ---- 巡查項目類型 ----
export function validateItemType(draft: { name: string; order: number; status: RecordStatus }, existing: ItemTypeRecord[], activeItems: number, editingId?: string): string[] {
  const errors: string[] = []; const name = draft.name.trim();
  if (!name) errors.push("請輸入類型名稱。");
  else if (chars(name) > TYPE_NAME_MAX) errors.push(`類型名稱不可超過 ${TYPE_NAME_MAX} 字。`);
  else if (existing.some((type) => type.id !== editingId && lower(type.name) === lower(name))) errors.push(`類型名稱「${name}」已存在。`);
  if (!isOrder(draft.order)) errors.push(`順序須為 1–${ORDER_MAX} 的整數。`);
  if (draft.status === "失效" && activeItems > 0) errors.push(`此類型仍有 ${activeItems} 個生效中的巡查項目，請先將它們設為失效。`);
  return errors;
}

// ---- 使用情況 ----
export interface ItemUsage { templates: number; activeTemplates: number; appTemplates: number }
export function itemUsage(itemId: string, templates: { items: { itemId: string }[]; status: string }[], appTemplates: { items: { itemId?: string }[] }[]): ItemUsage {
  const backOffice = templates.filter((template) => template.items.some((entry) => entry.itemId === itemId));
  return { templates: backOffice.length, activeTemplates: backOffice.filter((template) => template.status === "生效").length, appTemplates: appTemplates.filter((template) => template.items.some((entry) => entry.itemId === itemId)).length };
}
/** Inspection type and input kind cannot change once any template uses the item. */
export const isLocked = (usage: ItemUsage) => usage.templates + usage.appTemplates > 0;
export function deactivationBlock(usage: ItemUsage): string | null {
  if (!usage.activeTemplates && !usage.appTemplates) return null;
  const parts = [usage.activeTemplates && `${usage.activeTemplates} 個生效中的巡查模板`, usage.appTemplates && `${usage.appTemplates} 個 App 巡查表`].filter(Boolean);
  return `此項目仍被 ${parts.join("及 ")}使用，不可設為失效。`;
}

// ---- 工作摘要 ----
export function validateSummaries(summaries: ItemSummary[], workTypes: string[]): string[] {
  const errors: string[] = []; const seen = new Set<string>();
  summaries.forEach((entry, index) => {
    const label = `第 ${index + 1} 個工作摘要`; const text = entry.summary.trim();
    if (!text) errors.push(`${label}：請輸入摘要。`);
    else if (chars(text) > SUMMARY_MAX) errors.push(`${label}：摘要不可超過 ${SUMMARY_MAX} 字。`);
    else if (seen.has(lower(text))) errors.push(`${label}：摘要「${text}」重複。`);
    seen.add(lower(text));
    if (!entry.workType) errors.push(`${label}：請選擇工作類型。`);
    else if (!workTypes.includes(entry.workType)) errors.push(`${label}：工作類型須為細分類型。`);
    if (entry.sla) {
      const { assign, firstReply, resolve, complete } = entry.sla;
      if (![assign, firstReply, resolve, complete].every(isHours)) errors.push(`${label}：服務承諾時限須為大於 0、不超過 ${HOURS_MAX} 的小時數。`);
      else if (assign > resolve || firstReply > resolve || resolve > complete) errors.push(`${label}：時限須符合 分派、首次回覆 ≤ 解決 ≤ 完成。`);
    }
  });
  return errors;
}
export const summaryOf = (item: Pick<ManagedItem, "summaries"> | undefined, title: string) => item?.summaries.find((entry) => entry.summary.trim() === title.trim());
/** The SLA of the work summary the work was created with, or null when it has none (general rules apply). */
export const summarySla = (item: Pick<ManagedItem, "summaries"> | undefined, title: string): SlaHours | null => summaryOf(item, title)?.sla ?? null;

// ---- 工作通知 ----
export function validateNotifyRules(rules: NotifyRule[], groups: string[]): string[] {
  const errors: string[] = []; const seen = new Set<string>();
  rules.forEach((rule, index) => {
    const label = `第 ${index + 1} 個通知`; const name = rule.name.trim();
    if (!name) errors.push(`${label}：請輸入通知名稱。`);
    else if (chars(name) > RULE_NAME_MAX) errors.push(`${label}：通知名稱不可超過 ${RULE_NAME_MAX} 字。`);
    else if (seen.has(lower(name))) errors.push(`${label}：通知名稱「${name}」重複。`);
    seen.add(lower(name));
    if (!rule.states.length) errors.push(`${label}：請選擇至少一個工作狀態。`);
    else if (rule.states.some((state) => !notifyStates.includes(state))) errors.push(`${label}：工作狀態無效。`);
    if (rule.since !== "建立" && rule.since !== "狀態變更") errors.push(`${label}：計時起點無效。`);
    if (!Number.isInteger(rule.hours) || rule.hours < 1 || rule.hours > HOURS_MAX) errors.push(`${label}：經過時間須為 1–${HOURS_MAX} 的整數小時。`);
    if (!rule.recipients.execGroup && !rule.recipients.creator && !rule.recipients.groups.length) errors.push(`${label}：請選擇至少一個通知對象。`);
    if (rule.recipients.groups.some((group) => !groups.includes(group))) errors.push(`${label}：通知群組不存在。`);
    if (!noticeLevels.includes(rule.level)) errors.push(`${label}：通知級別無效。`);
    const message = rule.message.trim();
    if (!message) errors.push(`${label}：請輸入通知內容。`);
    else if (chars(message) > MESSAGE_MAX) errors.push(`${label}：通知內容不可超過 ${MESSAGE_MAX} 字。`);
    const unknown = [...message.matchAll(/［(.+?)］/g)].map((match) => match[1]).filter((key) => !notifyPlaceholders.includes(key));
    if (unknown.length) errors.push(`${label}：不支援的參數「${unknown.join("、")}」。`);
  });
  return errors;
}

const pad = (n: number) => String(n).padStart(2, "0");
export const parseTime = (text: string) => { const [date, time = "00:00"] = text.split(" "); const [y, m, d] = date.split("-").map(Number); const [h, min] = time.split(":").map(Number); return new Date(y, m - 1, d, h || 0, min || 0).getTime(); };
export const formatTime = (ms: number) => { const d = new Date(ms); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`; };
export function elapsedText(minutes: number): string {
  const total = Math.max(0, Math.floor(minutes)); const days = Math.floor(total / 1440); const hours = Math.floor((total % 1440) / 60); const mins = total % 60;
  return days ? `${days} 日 ${hours} 小時` : hours ? `${hours} 小時 ${mins} 分` : `${mins} 分鐘`;
}
export const renderMessage = (content: string, params: Record<string, string>) => content.replace(/［(.+?)］/g, (_, key: string) => params[key] ?? "");

export interface NotifyWork { id: string; title: string; status: string; createdAt: string; voided?: boolean; group: string; creator?: string }
export interface NotifyLog { to?: string; time: string }
export interface NotifyResult { rule: NotifyRule; base: string; dueAt: string; applicable: boolean; triggered: boolean; recipients: string[]; message: string }
/**
 * Evaluates the item's active rules for one work at `now` (ms). A rule applies while the work is not voided and is in one of its states;
 * it triggers once `hours` have passed since creation, or since the last status change (a log entry with `to`).
 */
export function evaluateNotifications(work: NotifyWork, item: Pick<ManagedItem, "name" | "notifications">, logs: NotifyLog[], now: number): NotifyResult[] {
  const created = parseTime(work.createdAt);
  const changes = logs.filter((log) => log.to).map((log) => parseTime(log.time)).filter((time) => time >= created);
  const lastChange = changes.length ? Math.max(...changes) : created;
  return item.notifications.filter((rule) => rule.active).map((rule) => {
    const base = rule.since === "建立" ? created : lastChange; const due = base + rule.hours * 3600000;
    const applicable = !work.voided && (rule.states as string[]).includes(work.status);
    const recipients = [...(rule.recipients.execGroup ? [work.group || "執行群組"] : []), ...(rule.recipients.creator ? [work.creator ?? "建立人"] : []), ...rule.recipients.groups];
    const message = renderMessage(rule.message, { "工作編號": work.id, "工作摘要": work.title, "巡查項目": item.name, "狀態": work.status, "經過時間": elapsedText((now - base) / 60000) });
    return { rule, base: formatTime(base), dueAt: formatTime(due), applicable, triggered: applicable && now >= due, recipients: [...new Set(recipients)], message };
  });
}

// ---- 輔助資料 ----
export function validateAuxDefs(defs: AuxDef[]): string[] {
  const errors: string[] = []; const seen = new Set<string>();
  defs.forEach((def, index) => {
    const label = `第 ${index + 1} 個輔助資料`; const name = def.name.trim();
    if (!name) errors.push(`${label}：請輸入名稱。`);
    else if (chars(name) > AUX_NAME_MAX) errors.push(`${label}：名稱不可超過 ${AUX_NAME_MAX} 字。`);
    else if (seen.has(lower(name))) errors.push(`${label}：名稱「${name}」重複。`);
    seen.add(lower(name));
    if (!auxSources.includes(def.source)) errors.push(`${label}：請選擇內容來源。`);
    if (!isOrder(def.order)) errors.push(`${label}：順序須為 1–${ORDER_MAX} 的整數。`);
    if (def.source === "上次巡查結果" && def.count !== undefined && (!Number.isInteger(def.count) || def.count < 1 || def.count > AUX_COUNT_MAX)) errors.push(`${label}：顯示次數須為 1–${AUX_COUNT_MAX} 的整數。`);
    if (def.source === "對象屬性" && !objectAttributes.includes(def.attribute ?? "")) errors.push(`${label}：請選擇對象屬性。`);
    if (def.source === "對象附件" && chars((def.keyword ?? "").trim()) > AUX_KEYWORD_MAX) errors.push(`${label}：附件名稱關鍵字不可超過 ${AUX_KEYWORD_MAX} 字。`);
  });
  return errors;
}
/** Entries in their order (a tie keeps the list order). */
export const sortAux = <T extends Pick<AuxDef, "order">>(defs: T[]): T[] => defs.map((def, index) => ({ def, index })).sort((a, b) => a.def.order - b.def.order || a.index - b.index).map((entry) => entry.def);

export interface AuxFile { id: string; name: string; src?: string; kind?: string }
/** An inspection as the 上次巡查結果 lookup needs it (App inspections and back-office records both map to this). */
export interface AuxHistoryEntry {
  id: string; objectId: string; status: string; voided?: boolean; time?: string; inspector?: string;
  items: { key: string; itemId?: string; kind: string }[];
  results: Record<string, { value?: string | string[]; signature?: string; remark?: string; attachments?: AuxFile[] } | undefined>;
}
/** One earlier result: `value` is the answer, `text` adds the remark, `raw` is the stored value (for the abnormal check). */
export interface LastResult { inspectionId: string; time: string; text: string; value: string; remark?: string; raw?: string | string[]; inspector?: string; files?: AuxFile[] }
/** A result's answer as text: choices joined, a signature as 已簽名. */
export function resultValue(kind: string, result: AuxHistoryEntry["results"][string]): string {
  if (!result) return "";
  return kind === "SIGNATURE" ? (result.signature || result.value ? "已簽名" : "") : Array.isArray(result.value) ? result.value.filter(Boolean).join("、") : (result.value ?? "").trim();
}
/** A result as text, with the remark when there is one. */
export function resultText(kind: string, result: AuxHistoryEntry["results"][string]): string {
  const value = resultValue(kind, result);
  return value ? `${value}${result?.remark?.trim() ? `（備註：${result.remark.trim()}）` : ""}` : "";
}
/**
 * Earlier results, latest first (up to `count`): completed, non-voided inspections of the same object with the same item (matched by item id,
 * else by key) and a filled result, submitted before `before` (the current inspection's submission; none while it is unfinished), excluding the current one.
 */
export function lastResultsOf(history: AuxHistoryEntry[], target: { inspectionId: string; objectId: string; itemId?: string; key: string; before?: string }, count = 1): LastResult[] {
  const found: LastResult[] = [];
  for (const entry of history) {
    if (entry.id === target.inspectionId || entry.objectId !== target.objectId || entry.status !== "已完成" || entry.voided || !entry.time) continue;
    if (target.before && entry.time >= target.before) continue;
    const item = entry.items.find((candidate) => target.itemId && candidate.itemId ? candidate.itemId === target.itemId : candidate.key === target.key);
    const result = item ? entry.results[item.key] : undefined; const value = item ? resultValue(item.kind, result) : "";
    if (value) found.push({ inspectionId: entry.id, time: entry.time, text: resultText(item!.kind, result), value, remark: result?.remark?.trim() || undefined, raw: result?.value, inspector: entry.inspector, files: result?.attachments?.length ? result.attachments : undefined });
  }
  return found.sort((a, b) => b.time.localeCompare(a.time) || b.inspectionId.localeCompare(a.inspectionId)).slice(0, Math.max(1, count));
}
/** The latest earlier result (see `lastResultsOf`), or null. */
export const lastResultOf = (history: AuxHistoryEntry[], target: Parameters<typeof lastResultsOf>[1]): LastResult | null => lastResultsOf(history, target, 1)[0] ?? null;

/** One 輔助資料 with its value; `empty` when there is nothing to show (「—」). 上次巡查結果 entries carry their results, latest first. */
export interface AuxEntry { def: AuxDef; text: string; empty: boolean; results?: LastResult[]; files?: AuxFile[] }
/** Whether any entry has something to show; the 輔助資料 button is only shown then. */
export const auxHasContent = (entries: AuxEntry[]) => entries.some((entry) => !entry.empty);
/** The item's 輔助資料 in order, with their values for one inspection. `results` are the earlier results, latest first (enough for the largest count). */
export function resolveAux(defs: AuxDef[], ctx: { results: LastResult[]; attribute: (name: string) => string | undefined; attachments: AuxFile[] }): AuxEntry[] {
  return sortAux(defs).map((def): AuxEntry => {
    if (def.source === "上次巡查結果") {
      const results = ctx.results.slice(0, def.count ?? 1);
      return { def, results, empty: !results.length, text: results.length ? results.length === 1 ? results[0].text : results.map((result) => result.value).join(" · ") : AUX_EMPTY };
    }
    if (def.source === "對象屬性") { const value = def.attribute ? ctx.attribute(def.attribute)?.trim() : ""; return { def, empty: !value, text: value || AUX_EMPTY }; }
    const keyword = (def.keyword ?? "").trim().toLowerCase();
    const files = ctx.attachments.filter((file) => !keyword || file.name.toLowerCase().includes(keyword));
    return { def, files, empty: !files.length, text: files.length ? files.map((file) => file.name).join("、") : AUX_EMPTY };
  });
}

// ---- 巡查項目 ----
export interface ItemContext { all: ManagedItem[]; inspectionTypes: string[]; itemTypeIds: string[]; workTypes: string[]; groups: string[]; usage?: ItemUsage; original?: ManagedItem }
/** Validates an item; the returned record has its auto code and kind-normalised options. */
export function validateItem(draft: ManagedItem, ctx: ItemContext): { issues: ItemIssue[]; record?: ManagedItem } {
  const issues: ItemIssue[] = []; const add = (tab: ItemTab, message: string) => issues.push({ tab, message });
  const others = ctx.all.filter((item) => item.id !== draft.id);
  const code = draft.code.trim(); const name = draft.name.trim();
  if (code) {
    if (code.length > CODE_MAX) add("basic", `項目編號不可超過 ${CODE_MAX} 字。`);
    else if (!CODE_PATTERN.test(code)) add("basic", "項目編號只可使用英文字母、數字、- 及 _。");
    else if (others.some((item) => lower(item.code) === lower(code))) add("basic", `項目編號「${code}」已存在。`);
  }
  if (!draft.inspectionType) add("basic", "請選擇巡查類型。"); else if (!ctx.inspectionTypes.includes(draft.inspectionType)) add("basic", "巡查類型不存在。");
  if (!name) add("basic", "請輸入項目名稱。");
  else if (chars(name) > NAME_MAX) add("basic", `項目名稱不可超過 ${NAME_MAX} 字。`);
  else if (draft.inspectionType && others.some((item) => item.inspectionType === draft.inspectionType && lower(item.name) === lower(name))) add("basic", `「${draft.inspectionType}」已有名為「${name}」的巡查項目。`);
  if (!draft.itemTypeId) add("basic", "請選擇項目類型。"); else if (!ctx.itemTypeIds.includes(draft.itemTypeId)) add("basic", "項目類型不存在。");
  if (!isOrder(draft.order)) add("basic", `順序須為 1–${ORDER_MAX} 的整數。`);
  if (ctx.original && ctx.usage && isLocked(ctx.usage)) {
    if (draft.inspectionType !== ctx.original.inspectionType) add("basic", "已被巡查模板使用，巡查類型不可修改。");
    if (draft.inputKind !== ctx.original.inputKind) add("input", "已被巡查模板使用，輸入方式不可修改。");
  }
  if (draft.status === "失效" && ctx.usage) { const blocked = deactivationBlock(ctx.usage); if (blocked) add("basic", blocked); }

  let options: string[] = []; let abnormal: string[] = []; let maxLength: number | undefined;
  if (!inputKinds.includes(draft.inputKind)) add("input", "請選擇輸入方式。");
  else if (draft.inputKind === "是非") options = [...BOOL_OPTIONS];
  else if (draft.inputKind === "單選" || draft.inputKind === "多選") {
    options = draft.options.map((option) => option.trim());
    if (options.length < 2 || options.length > OPTIONS_MAX) add("input", `${draft.inputKind}須有 2–${OPTIONS_MAX} 個選項。`);
    if (options.some((option) => !option)) add("input", "選項不可留空。");
    else if (options.some((option) => chars(option) > OPTION_MAX)) add("input", `每個選項不可超過 ${OPTION_MAX} 字。`);
    else if (new Set(options.map(lower)).size !== options.length) add("input", "選項不可重複。");
  } else if (draft.inputKind === "輸入框") {
    maxLength = draft.maxLength;
    if (maxLength === undefined || !Number.isInteger(maxLength) || maxLength < 1 || maxLength > TEXT_LIMIT_MAX) add("input", `字數上限須為 1–${TEXT_LIMIT_MAX} 的整數。`);
  }
  if (hasOptions(draft.inputKind)) {
    abnormal = draft.abnormal.map((value) => value.trim()).filter((value) => options.includes(value));
    if (draft.abnormal.some((value) => !options.includes(value.trim()))) add("input", "異常值須為選項之一。");
    if (draft.inputKind !== "多選" && abnormal.length && abnormal.length === options.length) add("input", "異常值不可包含全部選項，否則任何結果都會被判為異常。");
  }
  validateSummaries(draft.summaries, ctx.workTypes).forEach((message) => add("summaries", message));
  validateNotifyRules(draft.notifications, ctx.groups).forEach((message) => add("notifications", message));
  validateAuxDefs(draft.auxiliary ?? []).forEach((message) => add("auxiliary", message));
  if (issues.length) return { issues };
  const record: ManagedItem = {
    ...draft, code: code || nextItemCode(ctx.all.map((item) => item.code)), name, options, abnormal, maxLength,
    summaries: draft.summaries.map((entry) => ({ ...entry, summary: entry.summary.trim() })),
    notifications: draft.notifications.map((rule) => ({ ...rule, name: rule.name.trim(), message: rule.message.trim() })),
    auxiliary: (draft.auxiliary ?? []).map((def) => ({ id: def.id, name: def.name.trim(), source: def.source, order: def.order, ...(def.source === "上次巡查結果" && def.count && def.count > 1 ? { count: def.count } : {}), ...(def.source === "對象屬性" ? { attribute: def.attribute } : {}), ...(def.source === "對象附件" && def.keyword?.trim() ? { keyword: def.keyword.trim() } : {}) })),
  };
  if (record.maxLength === undefined) delete record.maxLength;
  return { issues, record };
}

/** List order: inspection type (managed order), then item type order, then the item's own order, then code. */
export function sortItems<T extends Pick<ManagedItem, "inspectionType" | "itemTypeId" | "order" | "code">>(items: T[], inspectionTypes: string[], itemTypes: Pick<ItemTypeRecord, "id" | "order">[]): T[] {
  const typeIndex = (name: string) => { const index = inspectionTypes.indexOf(name); return index < 0 ? Number.MAX_SAFE_INTEGER : index; };
  const kindOrder = (id: string) => itemTypes.find((type) => type.id === id)?.order ?? Number.MAX_SAFE_INTEGER;
  return [...items].sort((a, b) => typeIndex(a.inspectionType) - typeIndex(b.inspectionType) || kindOrder(a.itemTypeId) - kindOrder(b.itemTypeId) || a.order - b.order || a.code.localeCompare(b.code));
}
