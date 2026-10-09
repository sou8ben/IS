import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { initialState } from "../data";
import { useDemo } from "../store";
import { itemsForInspection } from "../item-data";
import type { EventRecord, Notice, Work } from "../types";
import { DEMO_PASSWORD, directory, initialAppState, lockHolders, personas } from "./data";
import { actionTarget, nextCode, nowText, type WorkAction } from "./rules";
import type { AppSettings, AppState, Inspection, ItemResult, Persona, Photo, PushMessage, SyncItem, WorkLog } from "./types";

const APP_KEY = "is-app-demo-v1";

function load(): AppState {
  try {
    const saved = localStorage.getItem(APP_KEY);
    return saved ? { ...initialAppState, ...(JSON.parse(saved) as Partial<AppState>) } : initialAppState;
  } catch {
    return initialAppState;
  }
}

const pushSamples: Record<PushMessage["level"], Omit<PushMessage, "id" | "level">> = {
  "一般": { title: "工作新留言", body: "WK-20260929-0012 有新留言：承辦商預計 14:30 到場。", route: "/works/WK-20260929-0012" },
  "緊急": { title: "工作已分派（緊急）", body: "WK-20260929-0011 行人道樹枝阻礙通行，已分派至綠化養護組。", route: "/works/WK-20260929-0011" },
  "特急": { title: "特急工作：垃圾收集點圍板破損", body: "WK-20260928-0096 圍板尖角外露，請即時處理。", route: "/works/WK-20260928-0096" },
};

export type ActionPayload = { comment?: string; photos?: Photo[]; group?: string };

interface AppContextValue {
  state: AppState;
  persona: Persona;
  pending: number;
  login: (account: string, password: string, remember: boolean) => string | null;
  logout: () => void;
  autoLogin: () => void;
  setPersona: (id: string) => void;
  patch: (value: Partial<AppState>) => void;
  updateSettings: (value: Partial<AppSettings>) => void;
  addCompanion: (account: string, password: string) => string | null;
  removeCompanion: (account: string) => void;
  updateInspection: (id: string, value: Partial<Inspection>) => void;
  submitInspection: (id: string, results: Record<string, ItemResult>) => void;
  supplementInspection: (id: string, reason: string, results: Record<string, ItemResult>) => void;
  addInspection: (objectId: string, templateId: string, planId?: string) => string;
  startPlans: (ids: string[]) => string | null;
  stopPlans: (ids: string[], reason?: string) => void;
  finishPlans: (ids: string[], reason?: string) => void;
  createWork: (work: Omit<Work, "id" | "createdAt" | "updatedAt" | "status" | "sla">, dispatchNote: string, photos?: Photo[]) => string;
  createEvent: (event: Omit<EventRecord, "id" | "createdAt">) => string;
  linkWorkToEvent: (eventId: string, workId: string) => void;
  linkInspectionWork: (inspectionId: string, itemKey: string | undefined, workId: string) => void;
  workAction: (work: Work, action: WorkAction, payload: ActionPayload) => void;
  pushMessage: (level: PushMessage["level"]) => void;
  clearPush: () => void;
  resolveConflict: (itemId: string, choice: "重做" | "放棄") => void;
  resetAll: () => void;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const shared = useDemo();
  const [state, setState] = useState<AppState>(load);
  const sharedRef = useRef(shared); sharedRef.current = shared;
  const stateRef = useRef(state); stateRef.current = state;
  const persona = personas.find((item) => item.id === state.personaId) ?? personas[0];

  useEffect(() => { localStorage.setItem(APP_KEY, JSON.stringify(state)); }, [state]);

  // 舊的共用示範資料缺少 App 新增的計劃及工作時補回
  useEffect(() => {
    initialState.plans.filter((plan) => !shared.plans.some((item) => item.id === plan.id)).forEach((plan) => shared.addPlan(plan));
    initialState.works.filter((work) => !shared.works.some((item) => item.id === work.id)).forEach((work) => shared.addWork(work));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const patch = (value: Partial<AppState>) => setState((current) => ({ ...current, ...value }));
  const queue = (item: Omit<SyncItem, "id" | "createdAt" | "status">) => setState((current) => ({ ...current, syncQueue: [...current.syncQueue, { ...item, id: `Q-${Date.now()}-${current.syncQueue.length}`, createdAt: nowText(), status: "待同步" }] }));
  const addLog = (entry: Omit<WorkLog, "id" | "operator" | "time">, operator = persona.name) => {
    const log: WorkLog = { ...entry, id: `LOG-${Date.now()}-${Math.round(Math.random() * 1000)}`, operator, time: nowText(), pendingSync: stateRef.current.offline && operator !== "系統" };
    setState((current) => ({ ...current, workLogs: [...current.workLogs, log] }));
    return log;
  };
  const tempId = () => { const id = `L-${String(stateRef.current.tempSerial).padStart(4, "0")}`; setState((current) => ({ ...current, tempSerial: current.tempSerial + 1 })); return id; };
  const syncPlanProgress = (planId: string | undefined, inspections: Inspection[]) => {
    if (!planId) return;
    const list = inspections.filter((item) => item.planId === planId);
    // 後台補入的巡查只存在於計劃記錄，進度亦須計入
    const supplements = (sharedRef.current.plans.find((plan) => plan.id === planId)?.inspections ?? []).filter((entry) => entry.source === "補入").length;
    sharedRef.current.updatePlan(planId, { progress: list.filter((item) => item.status === "已完成").length + supplements, total: list.length + supplements });
  };

  // 後台建立計劃或增加巡查後，App 未有的巡查按計劃快照補建為「未完成」；「補入」只屬後台補錄，不下發
  useEffect(() => {
    const missing = shared.plans.flatMap((plan) => (plan.inspections ?? []).filter((entry) => entry.source !== "補入" && !stateRef.current.inspections.some((item) => item.id === entry.id)).map((entry) => ({ planId: plan.id, entry })));
    if (!missing.length) return;
    // inspections of a plan take their 巡查模板 items from the plan snapshot, so later edits to the 巡查模板 or 巡查計劃模板 do not change them
    const snapshotItems = (planId: string, templateId: string) => { const snapshot = shared.plans.find((plan) => plan.id === planId)?.snapshot; const own = snapshot?.templates?.find((entry) => entry.templateId === templateId); return own ? structuredClone(own.items) : snapshot?.items && snapshot.templateId === templateId ? structuredClone(snapshot.items) : undefined; };
    const added: Inspection[] = missing.map(({ planId, entry }) => ({ id: entry.id, planId, objectId: entry.objectId, templateId: entry.templateId, seq: entry.seq, status: "未完成", results: {}, items: snapshotItems(planId, entry.templateId) }));
    const inspections = [...stateRef.current.inspections, ...added];
    setState((current) => ({ ...current, inspections: [...current.inspections, ...added.filter((item) => !current.inspections.some((existing) => existing.id === item.id))] }));
    [...new Set(missing.map((item) => item.planId))].forEach((planId) => syncPlanProgress(planId, inspections));
  }, [shared.plans]); // eslint-disable-line react-hooks/exhaustive-deps

  // 後台的工作處理記錄同步到 App 的處理流程（附件轉為相片）
  useEffect(() => {
    const missing = shared.workLogs.filter((entry) => !stateRef.current.workLogs.some((item) => item.id === entry.id));
    if (!missing.length) return;
    const logs: WorkLog[] = missing.map((entry) => ({ id: entry.id, workId: entry.workId, action: entry.action, from: entry.from, to: entry.to, operator: entry.operator, time: entry.time, location: entry.location, comment: entry.comment, photos: entry.attachments?.filter((file) => file.src).map((file) => ({ id: file.id, src: file.src!, name: file.name, watermark: `${entry.time} 後台`, kind: "image" as const })) }));
    setState((current) => ({ ...current, workLogs: [...current.workLogs, ...logs.filter((log) => !current.workLogs.some((item) => item.id === log.id))] }));
  }, [shared.workLogs]); // eslint-disable-line react-hooks/exhaustive-deps

  // 後台新增的獨立巡查（無計劃）下發為「未完成」；有計劃的由上面的計劃同步處理
  useEffect(() => {
    const missing = shared.inspectionRecords.filter((record) => record.origin === "後台" && !record.planId && !record.voided && record.status === "未完成" && !stateRef.current.inspections.some((item) => item.id === record.id));
    if (!missing.length) return;
    const added: Inspection[] = missing.map((record) => ({ id: record.id, objectId: record.objectId, templateId: record.templateId, seq: record.seq, status: "未完成", inspector: record.inspector, results: {} }));
    setState((current) => ({ ...current, inspections: [...current.inspections, ...added.filter((item) => !current.inspections.some((existing) => existing.id === item.id))] }));
  }, [shared.inspectionRecords]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---- 同步引擎：在線時逐筆處理佇列（詳細設計 12.2） ----
  useEffect(() => {
    if (state.offline) return;
    const item = state.syncQueue.find((entry) => entry.status === "待同步" || entry.status === "同步中");
    if (!item) return;
    const timer = window.setTimeout(() => {
      if (item.status === "待同步") { setState((current) => ({ ...current, syncQueue: current.syncQueue.map((entry) => entry.id === item.id ? { ...entry, status: "同步中" } : entry) })); return; }
      const data = sharedRef.current;
      let finalId = item.targetId; let status: SyncItem["status"] = "已同步"; let conflict: string | undefined;
      if (item.kind === "工作") {
        finalId = nextCode("WK", data.works.map((work) => work.id));
        data.updateWork(item.targetId, { id: finalId, pendingSync: false });
        data.events.filter((event) => event.workIds.includes(item.targetId)).forEach((event) => data.updateEvent(event.id, { workIds: event.workIds.map((id) => id === item.targetId ? finalId : id) }));
        setState((current) => ({ ...current, workLogs: current.workLogs.map((log) => log.workId === item.targetId ? { ...log, workId: finalId, pendingSync: false } : log), workLinks: current.workLinks.map((link) => link.workId === item.targetId ? { ...link, workId: finalId } : link) }));
      } else if (item.kind === "事件") {
        finalId = nextCode("EV", data.events.map((event) => event.id));
        data.updateEvent(item.targetId, { id: finalId, pendingSync: false });
        data.works.filter((work) => work.eventId === item.targetId).forEach((work) => data.updateWork(work.id, { eventId: finalId }));
      } else if (item.kind === "巡查") {
        setState((current) => ({ ...current, inspections: current.inspections.map((entry) => entry.id === item.targetId ? { ...entry, pendingSync: false } : entry) }));
      } else {
        const log = stateRef.current.workLogs.find((entry) => entry.id === item.targetId);
        if (item.kind === "工作操作" && stateRef.current.simulateConflict && log) {
          status = "衝突"; conflict = `你離線期間，此工作已由梁嘉敏於伺服器上更新。本地「${log.action}」操作與伺服器狀態衝突，已以伺服器為準。`;
          if (log.from) data.updateWork(log.workId, { status: log.from });
          setState((current) => ({ ...current, simulateConflict: false, workLogs: current.workLogs.map((entry) => entry.id === log.id ? { ...entry, pendingSync: false, conflict: true } : entry) }));
        } else {
          setState((current) => ({ ...current, workLogs: current.workLogs.map((entry) => entry.id === item.targetId ? { ...entry, pendingSync: false } : entry) }));
        }
      }
      setState((current) => ({ ...current, syncQueue: current.syncQueue.map((entry) => entry.id === item.id ? { ...entry, status, conflict, tempCode: entry.tempCode, targetId: finalId } : entry) }));
    }, item.status === "待同步" ? 300 : 700);
    return () => window.clearTimeout(timer);
  }, [state.offline, state.syncQueue]);

  const value = useMemo<AppContextValue>(() => ({
    state, persona,
    pending: state.syncQueue.filter((item) => item.status !== "已同步").length,
    login: (account, password, remember) => {
      const found = personas.find((item) => item.account === account.trim().toLowerCase());
      if (!found || password !== DEMO_PASSWORD) return "帳號或密碼不正確；連續錯誤 5 次將按平台策略鎖定帳號";
      patch({ loggedIn: true, personaId: found.id, rememberAccount: remember ? found.account : "" });
      return null;
    },
    logout: () => patch({ loggedIn: false, companions: [], push: null }),
    autoLogin: () => { if (!stateRef.current.loggedIn) patch({ loggedIn: true, permissionGranted: true }); },
    setPersona: (id) => patch({ personaId: id, loggedIn: true, permissionGranted: true, companions: [] }),
    patch,
    updateSettings: (value) => setState((current) => ({ ...current, settings: { ...current.settings, ...value } })),
    addCompanion: (account, password) => {
      const entry = directory.find((item) => item.account === account.trim().toLowerCase());
      if (!entry) return "找不到此帳號";
      if (entry.name === persona.name) return "不可加入當前用戶";
      if (state.companions.some((item) => item.account === entry.account)) return "此同行人已在名單內";
      if (state.companions.length >= 5) return "同行人最多 5 人";
      if (password !== DEMO_PASSWORD) return "密碼不正確，驗證失敗";
      patch({ companions: [...state.companions, { account: entry.account, name: entry.name, dept: entry.dept, addedAt: nowText() }] });
      return null;
    },
    removeCompanion: (account) => patch({ companions: state.companions.filter((item) => item.account !== account) }),
    updateInspection: (id, value) => setState((current) => ({ ...current, inspections: current.inspections.map((item) => item.id === id ? { ...item, ...value } : item) })),
    submitInspection: (id, results) => {
      const inspections = state.inspections.map((item) => item.id === id ? { ...item, items: item.items ?? itemsForInspection(item), results, status: "已完成" as const, inspector: persona.name, submittedAt: nowText(), savedAt: nowText(), pendingSync: state.offline } : item);
      patch({ inspections });
      if (state.offline) queue({ kind: "巡查", title: `提交巡查 ${id}`, tempCode: id, targetId: id });
      syncPlanProgress(inspections.find((item) => item.id === id)?.planId, inspections);
    },
    supplementInspection: (id, reason, results) => patch({ inspections: state.inspections.map((item) => item.id === id ? { ...item, items: item.items ?? itemsForInspection(item), results, supplements: [...(item.supplements ?? []), { reason, time: nowText(), operator: persona.name }] } : item) }),
    addInspection: (objectId, templateId, planId) => {
      const id = nextCode("IN", state.inspections.map((item) => item.id));
      const inspections = [...state.inspections, { id, planId, objectId, templateId, seq: state.inspections.filter((item) => item.planId === planId).length + 1, status: "未完成" as const, results: {}, ...(planId ? { onSite: true } : {}) }];
      patch({ inspections });
      syncPlanProgress(planId, inspections);
      return id;
    },
    startPlans: (ids) => {
      const own = shared.plans.find((plan) => plan.status === "進行中" && plan.executor === persona.name && !ids.includes(plan.id));
      if (own) return `你已有進行中的計劃「${own.name}」，請先中止或完成後再開始其他計劃`;
      const taken = ids.map((id) => shared.plans.find((plan) => plan.id === id)).find((plan) => plan && ((plan.status === "進行中" && plan.executor && plan.executor !== persona.name) || lockHolders[plan.id]));
      if (taken) {
        const holder = taken.executor && taken.executor !== persona.name ? taken.executor : lockHolders[taken.id];
        shared.updatePlan(taken.id, { status: "進行中", executor: holder });
        patch({ planOps: [...state.planOps, { planId: taken.id, action: "搶鎖失敗", operator: persona.name, time: nowText(), reason: `${holder}已持有作業鎖` }] });
        return `${holder}正在執行此計劃${ids.length > 1 ? "，全部計劃未開始（已回滾）" : ""}`;
      }
      ids.forEach((id) => shared.updatePlan(id, { status: "進行中", executor: persona.name }));
      patch({ mergedPlanIds: ids.length > 1 ? ids : [], planOps: [...state.planOps, ...ids.map((planId) => ({ planId, action: "開始作業" as const, operator: persona.name, time: nowText() }))] });
      return null;
    },
    stopPlans: (ids, reason) => {
      ids.forEach((id) => shared.updatePlan(id, { status: "已中止", executor: undefined }));
      patch({ mergedPlanIds: [], planOps: [...state.planOps, ...ids.map((planId) => ({ planId, action: "中止作業" as const, operator: persona.name, time: nowText(), reason }))] });
    },
    finishPlans: (ids, reason) => {
      ids.forEach((id) => shared.updatePlan(id, { status: "已完成" }));
      patch({ mergedPlanIds: [], planOps: [...state.planOps, ...ids.map((planId) => ({ planId, action: "完成作業" as const, operator: persona.name, time: nowText(), reason }))] });
    },
    createWork: (input, dispatchNote, photos) => {
      const id = state.offline ? tempId() : nextCode("WK", shared.works.map((work) => work.id));
      const time = nowText();
      shared.addWork({ ...input, id, status: "新建", sla: "正常", createdAt: time, updatedAt: time, creator: persona.name, pendingSync: state.offline });
      if (input.eventId) { const event = shared.events.find((item) => item.id === input.eventId); if (event) shared.updateEvent(event.id, { workIds: [...event.workIds, id] }); }
      addLog({ workId: id, action: "建立工作", to: "新建", location: "距工作地點 5 米", comment: `由${input.source}建立${input.inspectionId ? `（巡查 ${input.inspectionId}）` : input.eventId ? `（事件 ${input.eventId}）` : ""}`, photos: photos?.length ? photos : undefined });
      if (!state.offline) addLog({ workId: id, action: "自動分派", location: "—", comment: dispatchNote }, "系統");
      else queue({ kind: "工作", title: input.title, tempCode: id, targetId: id });
      return id;
    },
    createEvent: (input) => {
      const id = state.offline ? tempId() : nextCode("EV", shared.events.map((event) => event.id));
      shared.addEvent({ ...input, id, createdAt: nowText(), creator: persona.name, pendingSync: state.offline });
      if (state.offline) queue({ kind: "事件", title: input.description, tempCode: id, targetId: id });
      return id;
    },
    linkWorkToEvent: (eventId, workId) => {
      const event = shared.events.find((item) => item.id === eventId);
      if (event && !event.workIds.includes(workId)) shared.updateEvent(eventId, { workIds: [...event.workIds, workId] });
      const work = shared.works.find((item) => item.id === workId);
      if (work && !work.eventId) shared.updateWork(workId, { eventId });
    },
    linkInspectionWork: (inspectionId, itemKey, workId) => {
      patch({ workLinks: [...state.workLinks, { inspectionId, itemKey, workId }] });
      addLog({ workId, action: "關聯巡查", location: "—", comment: `與巡查 ${inspectionId} 建立關聯（疑似重複，改為關聯現有工作）` });
    },
    workAction: (work, action, payload) => {
      const to = actionTarget[action];
      const time = nowText();
      if (action === "作廢" || action === "解除作廢") shared.updateWork(work.id, { voided: action === "作廢", updatedAt: time });
      else if (to) shared.updateWork(work.id, { status: to, updatedAt: time, ...(action === "跟進" || action === "解決" ? { handler: persona.name } : {}), ...(action === "重新分派" && payload.group ? { group: payload.group } : {}), ...(action === "重啟" ? { reopenCount: (work.reopenCount ?? 0) + 1 } : {}) });
      const log = addLog({ workId: work.id, action, from: to ? work.status : undefined, to, location: action === "留言" ? "—" : `距工作地點 ${8 + Math.round(Math.random() * 20)} 米`, comment: action === "重新分派" ? `改派至 ${payload.group}；原因：${payload.comment ?? ""}` : payload.comment, photos: payload.photos });
      if (state.offline && !work.pendingSync) queue({ kind: action === "留言" ? "留言" : "工作操作", title: `${work.id} ${action}`, tempCode: work.id, targetId: log.id });
    },
    pushMessage: (level) => {
      const sample = pushSamples[level];
      const message: PushMessage = { ...sample, id: `N-${Date.now()}`, level };
      const notice: Notice = { id: message.id, title: sample.title, body: sample.body, time: "剛剛", level, read: false, route: sample.route };
      shared.addNotice(notice);
      patch({ push: message });
    },
    clearPush: () => patch({ push: null }),
    resolveConflict: (itemId, choice) => {
      const item = state.syncQueue.find((entry) => entry.id === itemId);
      const log = state.workLogs.find((entry) => entry.id === item?.targetId);
      if (!item || !log) return;
      if (choice === "重做" && log.to) shared.updateWork(log.workId, { status: log.to, updatedAt: nowText() });
      patch({
        syncQueue: state.syncQueue.filter((entry) => entry.id !== itemId),
        workLogs: choice === "重做" ? state.workLogs.map((entry) => entry.id === log.id ? { ...entry, conflict: false, time: nowText(), comment: `${entry.comment ?? ""}（衝突後重做）` } : entry) : state.workLogs.filter((entry) => entry.id !== log.id),
      });
    },
    resetAll: () => { shared.resetDemo(); setState({ ...initialAppState }); },
  }), [state, persona, shared]); // eslint-disable-line react-hooks/exhaustive-deps

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) throw new Error("useApp must be used inside AppProvider");
  return { ...context, shared: useDemo() };
}
