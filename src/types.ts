import type { ReactNode } from "react";
import type { PlanChange, PlannedInspection, PlanSnapshot } from "./plan-rules";

export type WorkStatus = "新建" | "跟進中" | "已解決" | "已關閉";
export type StatusTone = "neutral" | "info" | "success" | "warning" | "danger";

export interface Work {
  id: string;
  title: string;
  type: string;
  source: string;
  priority: "一般" | "緊急" | "特急";
  status: WorkStatus;
  group: string;
  grid: string;
  address: string;
  sla: "正常" | "將逾時" | "已逾時";
  createdAt: string;
  updatedAt: string;
  eventId?: string;
  planId?: string;
  description: string;
  voided?: boolean;
  creator?: string;
  handler?: string;
  reopenCount?: number;
  objectId?: string;
  inspectionId?: string;
  inspectionItem?: string;
  dupGroup?: string;
  pendingSync?: boolean;
  x?: number;
  y?: number;
}

export interface Plan {
  id: string;
  name: string;
  template: string;
  group: string;
  status: "未開始" | "進行中" | "已中止" | "已完成";
  startAt: string;
  endAt: string;
  progress: number;
  total: number;
  executor?: string;
  grid: string;
  department?: string;
  objectIds?: string[];
  note?: string;
  planTemplateId?: string;
  groupId?: string;
  /** Plan template copy taken at creation; later template edits never change the plan. */
  snapshot?: PlanSnapshot;
  /** Inspections generated or added in the back office; the App materialises the non-補入 entries. */
  inspections?: PlannedInspection[];
  changes?: PlanChange[];
  createdBy?: string;
  createdAt?: string;
}

export interface EventRecord {
  id: string;
  type: string;
  description: string;
  status: "無需跟進" | "跟進中" | "已完成";
  grid: string;
  address: string;
  createdAt: string;
  planId?: string;
  workIds: string[];
  followAt?: string;
  custom?: Record<string, string>;
  creator?: string;
  pendingSync?: boolean;
  x?: number;
  y?: number;
}

export interface Notice {
  id: string;
  title: string;
  body: string;
  time: string;
  level: "一般" | "緊急" | "特急";
  read: boolean;
  route: string;
}

export interface DemoState {
  works: Work[];
  plans: Plan[];
  events: EventRecord[];
  notices: Notice[];
}

export interface NavItem {
  key: string;
  label: string;
  path?: string;
  icon?: ReactNode;
  children?: NavItem[];
}

export interface Column<T extends { id: string }> {
  key: keyof T | string;
  title: string;
  width?: number;
  render?: (row: T) => ReactNode;
  sortable?: boolean;
  sortValue?: (row: T) => string | number;
}

export interface GenericRecord {
  id: string;
  name: string;
  code: string;
  category: string;
  level?: string;
  roleType?: "管理員" | "普通用戶";
  owner: string;
  updatedAt: string;
  status: string;
  note?: string;
  count?: number;
}
