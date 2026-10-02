import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { evaluatePermission, initialPermissionRules, newId, policyUsers, responsibilityGroups, validateRule, type PermissionContext, type PermissionDecision, type PermissionRule, type PolicyUser } from "./permission-rules";

export const POLICY_STORAGE_KEY = "is-permission-rules-v1";
const LOG_KEY = "is-permission-checks-v1";
export interface PermissionLog { id: string; user: string; userId: string; operation: string; objectId: string; time: string; mode: "提交校驗" | "全部規則試算" | "目前規則試算"; versions: string[]; decision: PermissionDecision }
function readRules(): PermissionRule[] {
  const raw = localStorage.getItem(POLICY_STORAGE_KEY);
  if (!raw) return structuredClone(initialPermissionRules);
  const parsed: unknown = JSON.parse(raw);
  if (!Array.isArray(parsed)) throw new Error("規則儲存格式異常，已拒絕操作。");
  // Invalid rule data must not silently restore permissive defaults.
  for (const rule of parsed) if (validateRule(rule, parsed).length) throw new Error("規則儲存資料異常，已拒絕操作。");
  return parsed;
}
function readLogs(): PermissionLog[] { try { const parsed = JSON.parse(localStorage.getItem(LOG_KEY) ?? "[]"); return Array.isArray(parsed) ? parsed : []; } catch { return []; } }
interface PermissionStore {
  rules: PermissionRule[]; logs: PermissionLog[]; storageError: string;
  saveRule: (rule: PermissionRule) => string | undefined;
  check: (context: PermissionContext, currentRule?: PermissionRule, submit?: boolean) => PermissionDecision;
  /** Checks a submission as `user`, defaulting to the signed-in demo user. */
  authorize: (operation: string, data: Pick<PermissionContext, "object" | "request">, user?: PolicyUser) => PermissionDecision;
}
const Context = createContext<PermissionStore | null>(null);
export function PermissionProvider({ children }: { children: ReactNode }) {
  const [rules, setRules] = useState<PermissionRule[]>(() => { try { return readRules(); } catch { return []; } });
  const [logs, setLogs] = useState(readLogs);
  const [storageError, setStorageError] = useState(() => { try { readRules(); return ""; } catch (error) { return String(error); } });
  useEffect(() => {
    // Only initialize missing storage, never overwrite an existing invalid configuration.
    try { if (localStorage.getItem(POLICY_STORAGE_KEY) === null) localStorage.setItem(POLICY_STORAGE_KEY, JSON.stringify(initialPermissionRules)); } catch { setStorageError("本地儲存不可用，提交校驗將拒絕操作。"); }
    const sync = (event: StorageEvent) => {
      if (event.key === POLICY_STORAGE_KEY || event.key === null) { try { setRules(readRules()); setStorageError(""); } catch (error) { setStorageError(String(error)); } }
      if (event.key === LOG_KEY || event.key === null) setLogs(readLogs());
    };
    window.addEventListener("storage", sync); return () => window.removeEventListener("storage", sync);
  }, []);
  const saveRule = (rule: PermissionRule) => {
    try {
      const latest = readRules(); const errors = validateRule(rule, latest); if (errors.length) return errors.join(" ");
      const existing = latest.find((r) => r.id === rule.id);
      if (existing && existing.version !== rule.version) return "此規則已在另一頁更新，請關閉後重新開啟編輯。";
      const saved = { ...rule, code: rule.code.trim(), name: rule.name.trim(), version: existing ? existing.version + 1 : 1, updatedBy: policyUsers[0].name, updatedAt: new Date().toLocaleString("sv-SE") };
      const next = existing ? latest.map((r) => r.id === saved.id ? saved : r) : [saved, ...latest];
      localStorage.setItem(POLICY_STORAGE_KEY, JSON.stringify(next)); setRules(next); setStorageError("");
    } catch (error) { return `無法儲存：${String(error)}`; }
  };
  const check = (context: PermissionContext, currentRule?: PermissionRule, submit = false): PermissionDecision => {
    let decision: PermissionDecision;
    try { decision = evaluatePermission(currentRule ? [currentRule] : readRules(), context); }
    catch (error) { decision = { allowed: false, reason: String(error), functional: false, responsibility: false, rules: [], forbiddenIdentities: [] }; }
    const log: PermissionLog = { id: newId(), user: context.user?.name ?? "未知用戶", userId: context.user?.id ?? "", operation: context.operation, objectId: context.object?.id ?? (context.request ? `新增計劃：${context.request.objects?.join("、") ?? "未設定"}` : "未設定"), time: new Date().toLocaleString("sv-SE"), mode: submit ? "提交校驗" : currentRule ? "目前規則試算" : "全部規則試算", versions: decision.rules.map((r) => `${r.code}@v${r.version}`), decision };
    try { const next = [log, ...readLogs()].slice(0, 500); while (next.length > 1 && JSON.stringify(next).length > 1_000_000) next.pop(); localStorage.setItem(LOG_KEY, JSON.stringify(next)); setLogs(next); }
    catch { decision = { ...decision, allowed: false, reason: "無法保存校驗紀錄，已拒絕操作。" }; setStorageError(decision.reason); }
    return decision;
  };
  return <Context.Provider value={{ rules, logs, storageError, saveRule, check, authorize: (operation, data, user) => check({ user: user ?? policyUsers[0], operation, groups: responsibilityGroups, ...data }, undefined, true) }}>{children}</Context.Provider>;
}
export function usePermissionRules() { const value = useContext(Context); if (!value) throw new Error("PermissionProvider is required"); return value; }
