import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { initialState } from "./data";
import type { DemoState, EventRecord, Notice, Plan, Work, WorkStatus } from "./types";

const STORAGE_KEY = "iam-demo-state-v1";

interface DemoContextValue extends DemoState {
  updateWorkStatus: (id: string, status: WorkStatus) => void;
  updateWork: (id: string, patch: Partial<Work>) => void;
  addWork: (work: Work) => void;
  addEvent: (event: EventRecord) => void;
  addPlan: (plan: Plan) => void;
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

