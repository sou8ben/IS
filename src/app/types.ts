import type { WorkStatus } from "../types";

export type GroupKind = "檢視" | "巡查" | "執行" | "報告" | "管理";

export interface Persona {
  id: string;
  name: string;
  account: string;
  role: string;
  dept: string;
  groups: { name: string; kind: GroupKind }[];
  /** 管理群組關聯的工作類型頂層（驗收方） */
  acceptTypes?: string[];
}

export type InputKind = "BOOL" | "SINGLE" | "MULTI" | "TEXT" | "SIGNATURE";

export interface AuxData { label: string; source: "上次巡查結果" | "對象屬性" | "對象附件"; value?: string; date?: string }

export interface TemplateItem {
  key: string;
  name: string;
  itemType: string;
  kind: InputKind;
  options?: string[];
  abnormal?: string[];
  required: boolean;
  minAttachments: number;
  maxLength?: number;
  aux?: AuxData;
  summaries?: { summary: string; workType: string }[];
}

export interface InspectionTemplate {
  id: string;
  name: string;
  inspectionType: string;
  locationCheck: boolean;
  validDistance: number;
  checkOn: ("開始填寫" | "提交")[];
  items: TemplateItem[];
}

export interface MapObject {
  id: string;
  name: string;
  type: string;
  address: string;
  grid: string;
  /** 底圖像素坐標（1536 × 1024） */
  x: number;
  y: number;
  /** 與當前位置距離（米，示範值） */
  distance: number;
  nfc?: string;
}

export interface Photo { id: string; src: string; name: string; watermark: string; kind: "image" | "video"; doodle?: string; duration?: number }

export interface ItemResult { value?: string | string[]; remark?: string; photos: Photo[]; signature?: string }

export interface Inspection {
  id: string;
  planId?: string;
  objectId: string;
  templateId: string;
  seq: number;
  status: "未完成" | "已完成";
  inspector?: string;
  startedAt?: string;
  submittedAt?: string;
  savedAt?: string;
  results: Record<string, ItemResult>;
  location?: { passed: boolean; distance: number; accuracy: number; nfc?: string };
  supplements?: { reason: string; time: string; operator: string }[];
  pendingSync?: boolean;
}

export interface WorkLog {
  id: string;
  workId: string;
  action: string;
  from?: WorkStatus;
  to?: WorkStatus;
  operator: string;
  time: string;
  location: string;
  comment?: string;
  photos?: Photo[];
  pendingSync?: boolean;
  conflict?: boolean;
}

export interface PlanOp { planId: string; action: "開始作業" | "中止作業" | "完成作業" | "搶鎖失敗"; operator: string; time: string; reason?: string }

export interface SyncItem {
  id: string;
  kind: "事件" | "工作" | "巡查" | "工作操作" | "留言";
  title: string;
  tempCode: string;
  targetId: string;
  createdAt: string;
  status: "待同步" | "同步中" | "已同步" | "衝突";
  conflict?: string;
}

export interface Companion { account: string; name: string; dept: string; addedAt: string }

export interface AppSettings { fontSize: "標準" | "大" | "特大" | "跟隨系統"; language: "繁體中文" | "Português"; wifiOnlyVideo: boolean }

export interface PushMessage { id: string; level: "一般" | "緊急" | "特急"; title: string; body: string; route: string }

export interface AppState {
  loggedIn: boolean;
  rememberAccount: string;
  personaId: string;
  permissionGranted: boolean;
  deviceLocked: boolean;
  updateMode: "無" | "推薦" | "強制";
  updateDismissed: boolean;
  offline: boolean;
  simulateConflict: boolean;
  settings: AppSettings;
  companions: Companion[];
  inspections: Inspection[];
  workLogs: WorkLog[];
  planOps: PlanOp[];
  syncQueue: SyncItem[];
  push: PushMessage | null;
  mergedPlanIds: string[];
  workLinks: { inspectionId: string; itemKey?: string; workId: string }[];
  tempSerial: number;
  trackPoints: number;
}
