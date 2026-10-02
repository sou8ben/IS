import { useEffect, useMemo, useState, type ReactNode } from "react";
import { HashRouter, Link, Navigate, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import {
  ApartmentOutlined, AppstoreOutlined, BellOutlined, BookOutlined, BuildOutlined,
  CaretDownOutlined, CloseOutlined, CloudServerOutlined, CodeOutlined, CompassOutlined,
  DatabaseOutlined, FileSearchOutlined, FolderOpenOutlined, GlobalOutlined, HomeOutlined,
  ImportOutlined, LeftOutlined, MenuFoldOutlined, MenuUnfoldOutlined, MobileOutlined, NodeIndexOutlined,
  NotificationOutlined, ReloadOutlined, SafetyCertificateOutlined, SearchOutlined,
  SettingOutlined, SolutionOutlined, TeamOutlined, ToolOutlined, UserOutlined,
} from "@ant-design/icons";
import { DemoProvider, useDemo } from "./store";
import { PermissionProvider } from "./permission-store";
import { PermissionRulesPage } from "./permission-page";
import { NfcTagsPage } from "./nfc-page";
import { InspectionTemplatesPage } from "./inspection-template-page";
import { PlanCreatePage, PlanDetailPage, PlanListPage } from "./plan-pages";
import { Button, ConfirmDialog, ToastProvider } from "./components";
import {
  DevicePage, EventEditorPage, EventListPage, GenericListPage, ImportPage, InspectionDetailPage, InspectionListPage,
  IntegrationCenterPage, LogPage, NotFoundPage, NotificationPage, ReportDesignerPage, ReportsDashboardPage, SimpleSettingsPage, TrackingPage,
  WorkCreatePage, WorkDetailPage, WorkListPage, WorkbenchPage,
} from "./pages";
import type { NavItem } from "./types";

const routeLabels: Record<string, string> = {
  "/workbench": "營運工作台", "/auth/users": "用戶管理", "/auth/groups": "群組管理", "/auth/roles": "角色與權限", "/auth/rules": "權限校驗規則",
  "/config/grids": "網格管理", "/config/inspection-types": "巡查類型", "/config/items": "巡查項目", "/config/objects": "對象管理", "/config/templates": "巡查模板", "/config/nfc": "NFC 標籤", "/config/plan-templates": "計劃模板",
  "/plans": "巡查計劃", "/plans/new": "新增計劃", "/inspections": "巡查記錄", "/events": "事件管理", "/events/new": "新增事件", "/events/types": "事件類型",
  "/works": "工作管理", "/works/new": "新增工作", "/works/types": "工作類型", "/works/sla": "服務承諾", "/works/comments": "留言模板", "/works/duplicates": "重複工作",
  "/tracking": "軌跡查詢", "/notifications": "通知中心", "/notifications/rules": "通知規則", "/reports": "營運報表", "/reports/designer": "自訂報表", "/reports/import": "資料匯入", "/reports/export": "匯出中心", "/reports/documents": "文書模板",
  "/system/devices": "裝置管理", "/system/versions": "應用版本", "/system/logs": "日誌查詢", "/system/parameters": "系統參數", "/system/attachments": "附件限制", "/integrations": "整合中心",
};

const navGroups: NavItem[] = [
  { key: "home", label: "首頁", path: "/workbench", icon: <HomeOutlined /> },
  { key: "operations", label: "巡查作業", icon: <CompassOutlined />, children: [
    { key: "plans", label: "巡查計劃", path: "/plans" }, { key: "inspections", label: "巡查記錄", path: "/inspections" }, { key: "events", label: "事件管理", path: "/events" }, { key: "works", label: "工作管理", path: "/works" }, { key: "tracking", label: "軌跡查詢", path: "/tracking" },
  ] },
  { key: "config", label: "基礎配置", icon: <BuildOutlined />, children: [
    { key: "grids", label: "網格管理", path: "/config/grids" }, { key: "types", label: "巡查類型", path: "/config/inspection-types" }, { key: "items", label: "巡查項目", path: "/config/items" }, { key: "objects", label: "對象管理", path: "/config/objects" }, { key: "templates", label: "巡查模板", path: "/config/templates" }, { key: "nfc", label: "NFC 標籤", path: "/config/nfc" }, { key: "plantpl", label: "計劃模板", path: "/config/plan-templates" },
  ] },
  { key: "org", label: "權限與組織", icon: <TeamOutlined />, children: [
    { key: "users", label: "用戶管理", path: "/auth/users" }, { key: "groups", label: "群組管理", path: "/auth/groups" }, { key: "roles", label: "角色與權限", path: "/auth/roles" }, { key: "rules", label: "校驗規則", path: "/auth/rules" },
  ] },
  { key: "analysis", label: "報表與通知", icon: <SolutionOutlined />, children: [
    { key: "reports", label: "營運報表", path: "/reports" }, { key: "designer", label: "自訂報表", path: "/reports/designer" }, { key: "notices", label: "通知中心", path: "/notifications" }, { key: "notice-rules", label: "通知規則", path: "/notifications/rules" }, { key: "imports", label: "匯入匯出", path: "/reports/import" },
  ] },
  { key: "system", label: "系統管理", icon: <SettingOutlined />, children: [
    { key: "devices", label: "裝置管理", path: "/system/devices" }, { key: "versions", label: "應用版本", path: "/system/versions" }, { key: "logs", label: "日誌查詢", path: "/system/logs" }, { key: "parameters", label: "系統參數", path: "/system/parameters" }, { key: "integrations", label: "整合中心", path: "/integrations" },
  ] },
];

const flattenedNav = navGroups.flatMap((group) => group.path ? [group] : group.children ?? []);

function AppShell() {
  const location = useLocation(); const navigate = useNavigate(); const { notices, markNoticeRead, resetDemo } = useDemo();
  const [collapsed, setCollapsed] = useState(false); const [expanded, setExpanded] = useState<string[]>(["operations"]); const [noticeOpen, setNoticeOpen] = useState(false); const [userOpen, setUserOpen] = useState(false); const [resetOpen, setResetOpen] = useState(false); const [query, setQuery] = useState("");
  const [tabs, setTabs] = useState<{ path: string; label: string }[]>([]);
  const currentLabel = useMemo(() => {
    const exact = routeLabels[location.pathname]; if (exact) return exact;
    if (location.pathname.startsWith("/works/")) return "工作詳情";
    if (location.pathname.startsWith("/plans/")) return "計劃詳情";
    if (location.pathname.startsWith("/inspections/")) return "巡查詳情";
    if (location.pathname.startsWith("/events/")) return "事件詳情";
    return "巡查派工管理";
  }, [location.pathname]);
  useEffect(() => {
    if (location.pathname === "/workbench") return;
    setTabs((current) => current.some((tab) => tab.path === location.pathname)
      ? current
      : [...current.slice(-7), { path: location.pathname, label: currentLabel }]);
  }, [location.pathname, currentLabel]);
  const unread = notices.filter((notice) => !notice.read).length;
  const results = query ? flattenedNav.filter((item) => item.label.includes(query)) : [];
  const go = (path: string) => { navigate(path); setQuery(""); setNoticeOpen(false); setUserOpen(false); };
  const closeTab = (path: string) => { const next = tabs.filter((tab) => tab.path !== path); setTabs(next); if (location.pathname === path) navigate(next.at(-1)?.path ?? "/workbench"); };
  return <div className={`app-shell ${collapsed ? "sidebar-collapsed" : ""}`}>
    <header className="global-header"><button className="app-switcher" aria-label="應用選單"><span className="brand-mark"><AppstoreOutlined/></span></button><div className="workspace-pill"><AppstoreOutlined/><span>市政署工作台</span><CaretDownOutlined/></div><div className="header-divider"/><strong className="product-title">巡查派工管理系統</strong><div className="global-search"><SearchOutlined/><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜尋人員、服務或功能" />{results.length > 0 && <div className="search-results">{results.map((item) => <button key={item.key} onClick={() => go(item.path!)}><FileSearchOutlined/><span>{item.label}</span><small>{item.path}</small></button>)}</div>}</div><button className="header-icon" aria-label="通知" onClick={() => setNoticeOpen(!noticeOpen)}><BellOutlined/>{unread > 0 && <b>{unread}</b>}</button><button className="header-icon"><BookOutlined/></button><button className="profile-button" onClick={() => setUserOpen(!userOpen)}><span>陳</span><div><strong>陳家朗</strong><small>巡查主管</small></div><CaretDownOutlined/></button>
      {noticeOpen && <div className="header-popover notice-popover"><header><strong>通知</strong><Link to="/notifications" onClick={() => setNoticeOpen(false)}>查看全部</Link></header>{notices.slice(0, 3).map((notice) => <button key={notice.id} className={!notice.read ? "unread" : ""} onClick={() => { markNoticeRead(notice.id); go(notice.route); }}><span className={`notice-dot level-${notice.level}`}/><div><strong>{notice.title}</strong><span>{notice.body}</span><small>{notice.time}</small></div></button>)}</div>}
      {userOpen && <div className="header-popover user-popover"><div className="user-card"><span>陳</span><div><strong>陳家朗</strong><small>北區巡查一組 · 巡查主管</small></div></div><button><UserOutlined/>個人資料</button><button><SettingOutlined/>偏好設定</button><button onClick={() => { window.open(`${import.meta.env.BASE_URL}app.html`, "_blank"); setUserOpen(false); }}><MobileOutlined/>開啟 App 原型</button><button onClick={() => setResetOpen(true)}><ReloadOutlined/>重設示範資料</button></div>}
    </header>
    <aside className="sidebar"><button className="collapse-button" onClick={() => setCollapsed(!collapsed)}>{collapsed ? <MenuUnfoldOutlined/> : <MenuFoldOutlined/>}<span>功能導航</span></button><nav>{navGroups.map((group) => <div className="nav-group" key={group.key}>{group.path ? <button className={location.pathname === group.path ? "active" : ""} onClick={() => go(group.path!)}>{group.icon}<span>{group.label}</span></button> : <><button className={group.children?.some((child) => location.pathname.startsWith(child.path!)) ? "active-parent" : ""} onClick={() => setExpanded(expanded.includes(group.key) ? expanded.filter((key) => key !== group.key) : [...expanded, group.key])}>{group.icon}<span>{group.label}</span><CaretDownOutlined className={expanded.includes(group.key) ? "rotated" : ""}/></button>{expanded.includes(group.key) && <div className="nav-children">{group.children?.map((item) => <button className={location.pathname === item.path || (item.path !== "/plans" && item.path !== "/works" && item.path !== "/events" && location.pathname.startsWith(item.path!)) ? "active" : ""} key={item.key} onClick={() => go(item.path!)}><span>{item.label}</span></button>)}</div>}</>}</div>)}</nav><div className="sidebar-footer"><GlobalOutlined/><span>繁體中文</span><small>v1.0 Prototype</small></div></aside>
    <main className="main-area"><div className="tab-strip"><Link to="/workbench" className={`home-tab ${location.pathname === "/workbench" ? "active" : ""}`}><HomeOutlined/>首頁</Link>{tabs.map((tab) => <div className={`route-tab ${location.pathname === tab.path ? "active" : ""}`} key={tab.path}><button onClick={() => navigate(tab.path)}>{tab.label}</button><button aria-label={`關閉${tab.label}`} onClick={() => closeTab(tab.path)}><CloseOutlined/></button></div>)}<div className="tab-tools"></div></div><div className="route-view"><RoutesContent/></div></main>
    <ConfirmDialog open={resetOpen} title="重設示範資料？" message="所有操作產生的本地變更將被清除，並恢復至初始示範狀態。" danger confirmLabel="確認重設" onCancel={() => setResetOpen(false)} onConfirm={() => { resetDemo(); setResetOpen(false); navigate("/workbench"); }} />
  </div>;
}

function RoutesContent() {
  return <Routes>
    <Route path="/" element={<Navigate to="/workbench" replace />} /><Route path="/workbench" element={<WorkbenchPage/>}/>
    <Route path="/auth/users" element={<GenericListPage title="用戶管理" description="管理平台用戶附加屬性、群組、角色及啟用狀態" dataset="users" eyebrow="權限與組織" primaryLabel="加入用戶"/>}/>
    <Route path="/auth/groups" element={<GenericListPage title="群組管理" description="按檢視、巡查、執行、報告及管理類型配置成員與數據範圍" dataset="groups" eyebrow="權限與組織" tree={["檢視群組", "巡查群組", "執行群組", "報告群組", "管理群組"]}/>}/>
    <Route path="/auth/roles" element={<GenericListPage title="角色與權限" description="配置後台及 App 功能權限樹與適用用戶" dataset="roles" eyebrow="權限與組織"/>}/><Route path="/auth/rules" element={<PermissionRulesPage/>}/>
    <Route path="/config/grids" element={<GenericListPage title="網格管理" description="匯入 GeoJSON、檢查重疊並統計網格內對象" dataset="grids"/>}/><Route path="/config/inspection-types" element={<GenericListPage title="巡查類型" description="維護巡查類型、主責部門及客製化欄位" dataset="inspectionTypes"/>}/>
    <Route path="/config/items" element={<GenericListPage title="巡查項目" description="配置輸入方式、異常值、工作摘要及輔助資料" dataset="items" tree={["一般設施", "供水設施", "照明設施", "環境衛生"]}/>}/><Route path="/config/objects" element={<GenericListPage title="對象管理" description="管理巡查對象、位置、附件、模板及工作負責群組" dataset="objects"/>}/>
    <Route path="/config/templates" element={<InspectionTemplatesPage/>}/><Route path="/config/nfc" element={<NfcTagsPage/>}/><Route path="/config/plan-templates" element={<GenericListPage title="計劃模板" description="設計巡查路線、掃描附近對象並指定巡查模板" dataset="planTemplates"/>}/>
    <Route path="/plans" element={<PlanListPage/>}/><Route path="/plans/new" element={<PlanCreatePage/>}/><Route path="/plans/:id" element={<PlanDetailPage/>}/><Route path="/inspections" element={<InspectionListPage/>}/><Route path="/inspections/:id" element={<InspectionDetailPage/>}/>
    <Route path="/events" element={<EventListPage/>}/><Route path="/events/new" element={<EventEditorPage/>}/><Route path="/events/types" element={<GenericListPage title="事件類型" description="管理層級類型、專屬欄位與對應工作類型" dataset="eventTypes" tree={["公共設施異常", "環境衛生問題", "綠化問題", "道路通行問題"]}/>}/><Route path="/events/:id" element={<EventEditorPage/>}/>
    <Route path="/works" element={<WorkListPage/>}/><Route path="/works/new" element={<WorkCreatePage/>}/><Route path="/works/types" element={<GenericListPage title="工作類型" description="配置流程、默認群組、分派規則及客製化通知" dataset="workTypes" tree={["公共設施維修", "環境衛生處理", "綠化養護", "道路設施"]}/>}/><Route path="/works/sla" element={<SimpleSettingsPage title="服務承諾" description="配置分派、初覆、解決及完成時限" kind="sla"/>}/><Route path="/works/comments" element={<GenericListPage title="留言模板" description="建立可插入參數並按工作狀態使用的留言模板" dataset="comments"/>}/><Route path="/works/duplicates" element={<SimpleSettingsPage title="重複工作" description="合併重複工作或建立同步處理關聯" kind="duplicates"/>}/><Route path="/works/:id" element={<WorkDetailPage/>}/>
    <Route path="/tracking" element={<TrackingPage/>}/><Route path="/notifications" element={<NotificationPage/>}/><Route path="/notifications/rules" element={<GenericListPage title="通知規則" description="按業務事件、接收對象、渠道及模板配置通知" dataset="notificationRules" editor="rule"/>}/>
    <Route path="/reports" element={<ReportsDashboardPage/>}/><Route path="/reports/designer" element={<ReportDesignerPage/>}/><Route path="/reports/import" element={<ImportPage/>}/><Route path="/reports/export" element={<SimpleSettingsPage title="匯出中心" description="追蹤 Excel、Word、PDF 及附件打包背景任務" kind="exports"/>}/><Route path="/reports/documents" element={<GenericListPage title="文書模板" description="管理巡查、事件及工作 Word/PDF 模板與標記符" dataset="documents"/>}/>
    <Route path="/system/devices" element={<DevicePage/>}/><Route path="/system/versions" element={<SimpleSettingsPage title="應用版本" description="發佈 Android 安裝包並設定強制或推薦更新" kind="versions"/>}/><Route path="/system/logs" element={<LogPage/>}/><Route path="/system/parameters" element={<SimpleSettingsPage title="系統參數" description="配置作業、定位、會話與背景任務參數" kind="params"/>}/><Route path="/system/attachments" element={<SimpleSettingsPage title="附件限制" description="按業務情景設定格式、大小、數量及壓縮方式" kind="params"/>}/><Route path="/integrations" element={<IntegrationCenterPage/>}/>
    <Route path="*" element={<NotFoundPage/>}/>
  </Routes>;
}

export function App() {
  return <HashRouter><DemoProvider><ToastProvider><PermissionProvider><AppShell/></PermissionProvider></ToastProvider></DemoProvider></HashRouter>;
}
