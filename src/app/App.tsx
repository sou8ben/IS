import { useEffect, type ReactNode } from "react";
import { HashRouter, Navigate, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { ConfigProvider, NoticeBar, TabBar } from "antd-mobile";
import zhHK from "antd-mobile/es/locales/zh-HK";
import { AppOutline, BellOutline, CompassOutline, ExclamationCircleFill, FillinOutline, FlagOutline, LoopOutline, RightOutline, SoundOutline, UserOutline } from "antd-mobile-icons";
import { DemoProvider } from "../store";
import { AppProvider, useApp } from "./store";
import { useDemoBridge } from "./demo";
import { isMyWork } from "./rules";
import { CheckLockedPage, CheckPermissionPage, CheckUpdatePage, LoginPage } from "./pages/auth";
import { HomePage } from "./pages/home";
import { InspectionCreatePage, InspectionFormPage, InspectionListPage, PlanListPage, PlanWorkPage } from "./pages/plans";
import { EventDetailPage, EventFormPage, EventListPage } from "./pages/events";
import { WorkDetailPage, WorkFormPage, WorkListPage } from "./pages/works";
import { AboutPage, CompanionsPage, MePage, NotificationsPage, ProfilePage, SettingsPage, SyncPage, TrackPage } from "./pages/me";

const tabs = [
  { key: "/home", title: "主頁", icon: <AppOutline /> },
  { key: "/plans", title: "巡查", icon: <CompassOutline /> },
  { key: "/events", title: "事件", icon: <FlagOutline /> },
  { key: "/works", title: "工作", icon: <FillinOutline /> },
  { key: "/me", title: "我的", icon: <UserOutline /> },
];

function ActivePlanBar() {
  const { state, persona, shared } = useApp(); const navigate = useNavigate();
  const active = shared.plans.filter((plan) => plan.status === "進行中" && plan.executor === persona.name);
  if (!active.length) return null;
  const merged = state.mergedPlanIds.length > 1 && active.length > 1;
  const done = active.reduce((sum, plan) => sum + plan.progress, 0); const total = active.reduce((sum, plan) => sum + plan.total, 0);
  return <button className="m-plan-bar" onClick={() => navigate(merged ? `/plans/merge?ids=${state.mergedPlanIds.join(",")}` : `/plans/${active[0].id}`)}>
    <span className="m-plan-bar-dot" /><div><strong>{merged ? `合併作業 · ${active.length} 個計劃` : active[0].name}</strong><span>作業中 · 已巡查 {done}/{total}</span></div><em>返回作業</em><RightOutline />
  </button>;
}

function PushBanner() {
  const { state, clearPush, shared } = useApp(); const navigate = useNavigate();
  const push = state.push;
  useEffect(() => {
    if (!push || push.level === "特急") return;
    const timer = window.setTimeout(clearPush, push.level === "緊急" ? 8000 : 4000);
    return () => window.clearTimeout(timer);
  }, [push?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!push) return null;
  const open = () => { shared.markNoticeRead(push.id); clearPush(); navigate(push.route); };
  return <div className={`m-push level-${push.level}`} role="alert" onClick={open}>
    <div className="m-push-icon">{push.level === "一般" ? <BellOutline /> : <ExclamationCircleFill />}</div>
    <div className="m-push-text"><strong>{push.title}</strong><span>{push.body}</span><small>{push.level === "特急" ? "特急 · 重複提醒直至開啟" : push.level === "緊急" ? "緊急 · 高優先推送（聲音及震動）" : "巡查派工 · 剛剛"}</small></div>
    {push.level !== "一般" && <SoundOutline className="m-push-sound" />}
    {push.level !== "特急" && <button className="m-push-close" aria-label="關閉通知" onClick={(event) => { event.stopPropagation(); clearPush(); }}>×</button>}
  </div>;
}

function StatusBanner() {
  const { state, pending } = useApp(); const navigate = useNavigate();
  const conflicts = state.syncQueue.filter((item) => item.status === "衝突").length;
  const syncing = state.syncQueue.filter((item) => item.status === "待同步" || item.status === "同步中").length;
  if (state.offline) return <NoticeBar className="m-offline-bar" color="alert" wrap icon={<LoopOutline />} content={`離線模式：新增及操作先保存在本機，恢復網絡後自動同步${pending ? `（待同步 ${pending} 筆）` : ""}`} onClick={() => navigate("/me/sync")} />;
  if (syncing) return <NoticeBar className="m-offline-bar" color="info" icon={<LoopOutline className="spin" />} content={`網絡已恢復，正在同步 ${syncing} 筆記錄…`} />;
  if (conflicts) return <NoticeBar className="m-offline-bar" color="error" icon={<ExclamationCircleFill />} content={`有 ${conflicts} 筆同步衝突，點擊查看並處理`} extra={<RightOutline />} onClick={() => navigate("/me/sync")} />;
  return null;
}

function Layout({ children }: { children: ReactNode }) {
  const { state, shared, persona, autoLogin } = useApp(); const location = useLocation(); const navigate = useNavigate();
  const path = location.pathname;
  const isTab = tabs.some((tab) => tab.key === path);
  const isAuth = path === "/login" || path.startsWith("/check");
  useDemoBridge();
  useEffect(() => { if (!isAuth && !state.loggedIn && !state.deviceLocked) autoLogin(); }, [path]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { document.documentElement.dataset.font = state.settings.fontSize; }, [state.settings.fontSize]);
  if (state.deviceLocked && path !== "/check/locked") return <Navigate to="/check/locked" replace />;
  if (state.updateMode === "強制" && state.loggedIn && !isAuth) return <Navigate to="/check/update" replace />;
  const unread = shared.notices.filter((notice) => !notice.read).length;
  const myOpenWorks = shared.works.filter((work) => (isMyWork(work, persona) || persona.groups.some((group) => group.kind === "執行" && group.name === work.group)) && (work.status === "新建" || work.status === "跟進中") && !work.voided).length;
  return <div className="m-app">
    {!isAuth && <StatusBanner />}
    <div className="m-outlet">{children}</div>
    {isTab && <ActivePlanBar />}
    {isTab && <TabBar className="m-tabbar" activeKey={path} onChange={(key) => navigate(key)} safeArea>
      {tabs.map((tab) => <TabBar.Item key={tab.key} title={tab.title} icon={tab.icon} badge={tab.key === "/me" && unread ? (unread > 99 ? "99+" : unread) : tab.key === "/works" && myOpenWorks ? myOpenWorks : undefined} />)}
    </TabBar>}
    {!isAuth && <PushBanner />}
  </div>;
}

function RoutesContent() {
  const { state } = useApp(); const location = useLocation();
  // 每次導航重新掛載頁面，避免同一路由不同參數時沿用上一筆的本地狀態
  return <Layout><Routes key={location.pathname + location.search}>
    <Route path="/" element={<Navigate to={state.loggedIn ? "/home" : "/login"} replace />} />
    <Route path="/login" element={<LoginPage />} />
    <Route path="/check/locked" element={<CheckLockedPage />} />
    <Route path="/check/update" element={<CheckUpdatePage />} />
    <Route path="/check/permission" element={<CheckPermissionPage />} />
    <Route path="/home" element={<HomePage />} />
    <Route path="/plans" element={<PlanListPage />} />
    <Route path="/plans/merge" element={<PlanWorkPage />} />
    <Route path="/plans/:id" element={<PlanWorkPage />} />
    <Route path="/inspections" element={<InspectionListPage />} />
    <Route path="/inspections/map" element={<InspectionListPage map />} />
    <Route path="/inspections/new" element={<InspectionCreatePage />} />
    <Route path="/inspections/:id" element={<InspectionFormPage />} />
    <Route path="/events" element={<EventListPage />} />
    <Route path="/events/map" element={<EventListPage map />} />
    <Route path="/events/new" element={<EventFormPage />} />
    <Route path="/events/:id" element={<EventDetailPage />} />
    <Route path="/works" element={<WorkListPage />} />
    <Route path="/works/map" element={<WorkListPage map />} />
    <Route path="/works/new" element={<WorkFormPage />} />
    <Route path="/works/:id" element={<WorkDetailPage />} />
    <Route path="/me" element={<MePage />} />
    <Route path="/me/profile" element={<ProfilePage />} />
    <Route path="/me/notifications" element={<NotificationsPage />} />
    <Route path="/me/companions" element={<CompanionsPage />} />
    <Route path="/me/settings" element={<SettingsPage />} />
    <Route path="/me/track" element={<TrackPage />} />
    <Route path="/me/sync" element={<SyncPage />} />
    <Route path="/me/about" element={<AboutPage />} />
    <Route path="*" element={<Navigate to="/home" replace />} />
  </Routes></Layout>;
}

export function MobileApp() {
  return <ConfigProvider locale={zhHK}><HashRouter><DemoProvider><AppProvider><RoutesContent /></AppProvider></DemoProvider></HashRouter></ConfigProvider>;
}
