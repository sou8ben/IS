import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { initialState } from "./data";
import { setGridRegistry } from "./grid-data";
import type { GridRecord } from "./grid-rules";
import type { InspectionTemplate as BackOfficeTemplate } from "./inspection-templates";
import { normalizeType, type InspectionTypeRecord } from "./inspection-type-rules";
import { setItemRegistry, upgradeAuxiliary } from "./item-data";
import { normalizePlan } from "./plan-data";
import type { ItemTypeRecord, ManagedItem } from "./item-rules";
import type { InspectionRecord } from "./inspection-rules";
import { setObjectRegistry, upgradeAttachments } from "./object-data";
import { normalizeWorkGroups, type ManagedObject } from "./object-rules";
import { groupCatalog } from "./group-catalog";
import type { WorkLogEntry } from "./work-rules";
import type { DemoState, EventRecord, Notice, Plan, Work, WorkStatus } from "./types";

export const STORAGE_KEY = "iam-demo-state-v1";

interface DemoContextValue extends DemoState {
  updateWorkStatus: (id: string, status: WorkStatus) => void;
  updateWork: (id: string, patch: Partial<Work>) => void;
  addWork: (work: Work) => void;
  /** Several works at once, for duplicate merges and synced actions. */
  updateWorks: (patches: { id: string; patch: Partial<Work> }[]) => void;
  addWorkLogs: (entries: WorkLogEntry[]) => void;
  /** Replaces the managed grid list. */
  saveGrids: (grids: GridRecord[]) => void;
  saveObjects: (objects: ManagedObject[]) => void;
  saveInspectionTemplates: (templates: BackOfficeTemplate[]) => void;
  saveInspectionTypes: (types: InspectionTypeRecord[]) => void;
  saveItemTypes: (types: ItemTypeRecord[]) => void;
  saveItems: (items: ManagedItem[]) => void;
  addEvent: (event: EventRecord) => void;
  addPlan: (plan: Plan) => void;
  updatePlan: (id: string, patch: Partial<Plan>) => void;
  updateEvent: (id: string, patch: Partial<EventRecord>) => void;
  /** Inserts the record, or replaces the one with the same id. */
  saveInspectionRecord: (record: InspectionRecord) => void;
  addNotice: (notice: Notice) => void;
  /** Adds notices whose id is not present yet (used for triggered item notifications). */
  addNotices: (notices: Notice[]) => void;
  markNoticeRead: (id: string) => void;
  markAllRead: () => void;
  resetDemo: () => void;
}

const DemoContext = createContext<DemoContextValue | null>(null);

function loadState(): DemoState {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return initialState;
    // saved state may predate the current shape: upgrade inspection types and object work groups, drop the retired custom fields
    const { objectFieldDefs: _retired, ...merged } = { ...initialState, ...(JSON.parse(saved) as Partial<DemoState> & { objectFieldDefs?: unknown }) };
    const objects = merged.objects.map((object) => { const { customValues: _values, ...rest } = object as ManagedObject & { customValues?: unknown }; return upgradeAttachments({ ...rest, workGroups: normalizeWorkGroups(rest.workGroups ?? [], groupCatalog) }); });
    // items saved before 輔助資料 existed (or still holding an older seed) get the current seed entries
    const items = merged.items.map(upgradeAuxiliary);
    // the demonstration inspection history is added when missing
    const known = new Set(merged.inspectionRecords.map((record) => record.id));
    const inspectionRecords = [...merged.inspectionRecords, ...initialState.inspectionRecords.filter((record) => !known.has(record.id))];
    return { ...merged, objects, items, inspectionRecords, inspectionTypes: merged.inspectionTypes.map(normalizeType), plans: merged.plans.map(normalizePlan) };
  } catch {
    return initialState;
  }
}

export function DemoProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<DemoState>(loadState);

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch { /* storage full: keep working in memory */ }
  }, [state]);

  useEffect(() => {
    const sync = (event: StorageEvent) => { if (event.key === STORAGE_KEY) setState(loadState()); };
    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, []);

  // Keep the grid lookup in step with the state during render, so lookups in this render already use the latest grids.
  setGridRegistry(state.grids);
  setObjectRegistry(state.objects, state.grids);
  setItemRegistry(state.items, state.itemTypes, state.inspectionTemplates);
  const value = useMemo<DemoContextValue>(() => ({
    ...state,
    updateWorkStatus: (id, status) => setState((current) => ({
      ...current,
      works: current.works.map((work) => work.id === id ? { ...work, status, updatedAt: "2026-09-29 12:06" } : work),
    })),
    updateWork: (id, patch) => setState((current) => ({
      ...current,
      works: current.works.map((work) => work.id === id ? { ...work, ...patch, updatedAt: "2026-09-29 12:06" } : work),
    })),
    addWork: (work) => setState((current) => ({ ...current, works: [work, ...current.works] })),
    updateWorks: (patches) => setState((current) => ({ ...current, works: current.works.map((work) => { const entry = patches.find((item) => item.id === work.id); return entry ? { ...work, ...entry.patch } : work; }) })),
    saveGrids: (grids) => setState((current) => ({ ...current, grids })),
    saveObjects: (objects) => setState((current) => ({ ...current, objects })),
    saveInspectionTemplates: (inspectionTemplates) => setState((current) => ({ ...current, inspectionTemplates })),
    saveInspectionTypes: (inspectionTypes) => setState((current) => ({ ...current, inspectionTypes })),
    saveItemTypes: (itemTypes) => setState((current) => ({ ...current, itemTypes })),
    saveItems: (items) => setState((current) => ({ ...current, items })),
    addWorkLogs: (entries) => setState((current) => ({ ...current, workLogs: [...current.workLogs, ...entries.filter((entry) => !current.workLogs.some((item) => item.id === entry.id))] })),
    addEvent: (event) => setState((current) => ({ ...current, events: [event, ...current.events] })),
    addPlan: (plan) => setState((current) => ({ ...current, plans: [plan, ...current.plans] })),
    updatePlan: (id, patch) => setState((current) => ({ ...current, plans: current.plans.map((plan) => plan.id === id ? { ...plan, ...patch } : plan) })),
    updateEvent: (id, patch) => setState((current) => ({ ...current, events: current.events.map((event) => event.id === id ? { ...event, ...patch } : event) })),
    saveInspectionRecord: (record) => setState((current) => ({ ...current, inspectionRecords: current.inspectionRecords.some((item) => item.id === record.id) ? current.inspectionRecords.map((item) => item.id === record.id ? record : item) : [record, ...current.inspectionRecords] })),
    addNotice: (notice) => setState((current) => ({ ...current, notices: [notice, ...current.notices] })),
    addNotices: (notices) => setState((current) => { const known = new Set(current.notices.map((notice) => notice.id)); const fresh = notices.filter((notice) => !known.has(notice.id)); return fresh.length ? { ...current, notices: [...fresh, ...current.notices] } : current; }),
    markNoticeRead: (id) => setState((current) => ({ ...current, notices: current.notices.map((notice: Notice) => notice.id === id ? { ...notice, read: true } : notice) })),
    markAllRead: () => setState((current) => ({ ...current, notices: current.notices.map((notice) => ({ ...notice, read: true })) })),
    resetDemo: () => setState(initialState),
  }), [state]);

  return <DemoContext.Provider value={value}>{children}</DemoContext.Provider>;
}

export function useDemo() {
  const context = useContext(DemoContext);
  if (!context) throw new Error("useDemo must be used inside DemoProvider");
  return context;
}

