import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { initialState } from "./data";
import type { DemoState, EventRecord, Notice, Plan, Work, WorkStatus } from "./types";

export const STORAGE_KEY = "iam-demo-state-v1";

interface DemoContextValue extends DemoState {
  updateWorkStatus: (id: string, status: WorkStatus) => void;
  updateWork: (id: string, patch: Partial<Work>) => void;
  addWork: (work: Work) => void;
  addEvent: (event: EventRecord) => void;
  addPlan: (plan: Plan) => void;
  updatePlan: (id: string, patch: Partial<Plan>) => void;
  updateEvent: (id: string, patch: Partial<EventRecord>) => void;
  addNotice: (notice: Notice) => void;
  markNoticeRead: (id: string) => void;
  markAllRead: () => void;
  resetDemo: () => void;
}

const DemoContext = createContext<DemoContextValue | null>(null);

function loadState(): DemoState {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? (JSON.parse(saved) as DemoState) : initialState;
  } catch {
    return initialState;
  }
}

export function DemoProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<DemoState>(loadState);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state]);

  useEffect(() => {
    const sync = (event: StorageEvent) => { if (event.key === STORAGE_KEY) setState(loadState()); };
    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, []);

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
    addEvent: (event) => setState((current) => ({ ...current, events: [event, ...current.events] })),
    addPlan: (plan) => setState((current) => ({ ...current, plans: [plan, ...current.plans] })),
    updatePlan: (id, patch) => setState((current) => ({ ...current, plans: current.plans.map((plan) => plan.id === id ? { ...plan, ...patch } : plan) })),
    updateEvent: (id, patch) => setState((current) => ({ ...current, events: current.events.map((event) => event.id === id ? { ...event, ...patch } : event) })),
    addNotice: (notice) => setState((current) => ({ ...current, notices: [notice, ...current.notices] })),
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

