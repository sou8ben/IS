import type { ReactNode } from "react";
import type { EventChange, EventFieldDef } from "./event-rules";
import type { GridRecord } from "./grid-rules";
import type { InspectionTemplate as BackOfficeTemplate } from "./inspection-templates";
import type { InspectionTypeRecord } from "./inspection-type-rules";
import type { ItemTypeRecord, ManagedItem } from "./item-rules";
import type { ManagedObject } from "./object-rules";
import type { AttachmentRef, InspectionRecord } from "./inspection-rules";
import type { WorkLogEntry } from "./work-rules";
import type { PlanChange, PlannedInspection, PlanSnapshot } from "./plan-rules";
import type { TemplateItem } from "./app/types";

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
  /** Files uploaded from the computer in the back office. */
  attachments?: AttachmentRef[];
  /** Set when the work was closed as a duplicate of this kept work. */
  masterId?: string;
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
  /** The 巡查模板 the plan uses (`template` holds its name as at creation). */
  templateId?: string;
  /** Retired: the plan template of plans created before 巡查模板 drove plans. */
  planTemplateId?: string;
  groupId?: string;
  /** 巡查模板 and chosen objects as at creation, with the template items; later template edits never change the plan. */
  snapshot?: PlanSnapshot<TemplateItem>;
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
  /** Files uploaded from the computer in the back office. */
  attachments?: AttachmentRef[];
  /** Type name and field definitions at registration; later type edits never change the event. */
  fieldSnapshot?: { type: string; defs: EventFieldDef[] };
  changes?: EventChange[];
  source?: "後台" | "App" | "計劃";
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
  /** Back-office inspections, plus overlays (void, supplements) on App inspections. */
  inspectionRecords: InspectionRecord[];
  /** Work process logs written by the back office; the App's own logs stay in its store. */
  workLogs: WorkLogEntry[];
  /** Managed grids; they drive the grid assignment of events, works and objects. */
  grids: GridRecord[];
  /** Managed inspection objects; the single list the pickers, templates, NFC and the App read. */
  objects: ManagedObject[];
  /** Back-office inspection templates (shared so object detail can show related ones). */
  inspectionTemplates: BackOfficeTemplate[];
  /** Managed inspection types: the top-level classification of objects, items and templates. */
  inspectionTypes: InspectionTypeRecord[];
  /** 巡查項目類型 and 巡查項目: the App inspection forms, templates and work summaries read them. */
  itemTypes: ItemTypeRecord[];
  items: ManagedItem[];
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
