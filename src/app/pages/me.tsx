import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Badge, Button, CapsuleTabs, Dialog, Input, List, Popup, Selector, Switch, Toast } from "antd-mobile";
import { BellOutline, ExclamationCircleFill, GlobalOutline, InformationCircleOutline, LoopOutline, ScanCodeOutline, SetOutline, TeamOutline, TravelOutline, UserOutline } from "antd-mobile-icons";
import { Card, Empty, GroupTitle, InfoList, MapView, Page, StatusTag } from "../components";
import { myTrack } from "../data";
import { DemoControls, useRunCommand, useSnapshot } from "../demo";
import { shortTime } from "../rules";
import { useApp } from "../store";
import { APP_VERSION, DEVICE_ID } from "./auth";

export function MePage() {
  const { state, shared, persona, pending, logout } = useApp(); const navigate = useNavigate();
  const unread = shared.notices.filter((notice) => !notice.read).length;
  const signOut = () => {
    if (pending) {
      Dialog.show({ title: "尚有待同步記錄", content: `本機仍有 ${pending} 筆記錄未上傳。建議先同步；如現在登出，資料會保留至下次登入。`, closeOnAction: true, actions: [
        { key: "sync", text: state.offline ? "查看待同步記錄" : "立即同步", bold: true, onClick: () => navigate("/me/sync") },
        { key: "out", text: "仍然登出", danger: true, onClick: () => { logout(); navigate("/login", { replace: true }); } },
        { key: "cancel", text: "取消" },
      ] });
      return;
    }
    Dialog.confirm({ title: "確認登出？", content: state.companions.length ? `同行人（${state.companions.length} 人）會一併結束。` : "登出後停止定位記錄。", confirmText: "登出", cancelText: "取消", onConfirm: () => { logout(); navigate("/login", { replace: true }); } });
  };
  return <Page title="我的" back={false}>
    <div className="m-me-head">
      <div className="m-avatar large">{persona.name.slice(0, 1)}</div>
      <div><strong>{persona.name}</strong><span>{persona.account} · {persona.role}</span><small>{persona.groups.map((group) => group.name).join("、")}</small></div>
    </div>
    <div className="m-me-stats">
      <button onClick={() => navigate("/me/sync")}><strong className={pending ? "warn" : ""}>{pending}</strong><span>待同步</span></button>
      <button onClick={() => navigate("/me/notifications")}><strong>{unread}</strong><span>未讀通知</span></button>
      <button onClick={() => navigate("/me/companions")}><strong>{state.companions.length}</strong><span>同行人</span></button>
    </div>
    <List className="m-list" mode="card">
      <List.Item prefix={<BellOutline />} extra={unread ? <Badge content={unread > 99 ? "99+" : unread} /> : null} onClick={() => navigate("/me/notifications")}>通知中心</List.Item>
      <List.Item prefix={<TeamOutline />} extra={state.companions.length ? `${state.companions.length} 人` : "未加入"} onClick={() => navigate("/me/companions")}>同行人</List.Item>
      <List.Item prefix={<TravelOutline />} onClick={() => navigate("/me/track")}>我的軌跡</List.Item>
      <List.Item prefix={<LoopOutline />} extra={pending ? <StatusTag>待同步</StatusTag> : "已同步"} onClick={() => navigate("/me/sync")}>待同步記錄</List.Item>
    </List>
    <List className="m-list" mode="card">
      <List.Item prefix={<SetOutline />} onClick={() => navigate("/me/settings")}>設置</List.Item>
      <List.Item prefix={<UserOutline />} onClick={() => navigate("/me/profile")}>用戶資料</List.Item>
      <List.Item prefix={<InformationCircleOutline />} extra={`v${APP_VERSION}`} onClick={() => navigate("/me/about")}>關於本原型</List.Item>
    </List>
    <div className="m-signout"><Button block onClick={signOut}>登出</Button></div>
  </Page>;
}

export function ProfilePage() {
  const { persona } = useApp();
  return <Page title="用戶資料" backTo="/me">
    <Card><InfoList items={[["姓名", persona.name], ["帳號", persona.account], ["部門", persona.dept], ["角色", persona.role], ["裝置編號", DEVICE_ID], ["App 版本", `v${APP_VERSION}`]]} /></Card>
    <GroupTitle>所屬群組</GroupTitle>
    <Card>{persona.groups.map((group) => <div className="m-group-row" key={group.name}><strong>{group.name}</strong><StatusTag tone="info">{group.kind}群組</StatusTag></div>)}</Card>
    <p className="m-footnote">用戶資料取自「平台」，只讀顯示；群組決定可見數據範圍。</p>
  </Page>;
}

const noticeCategory = (route: string) => route.startsWith("/works") ? "工作" : route.startsWith("/plans") ? "巡查" : "系統";

export function NotificationsPage() {
  const { shared } = useApp(); const navigate = useNavigate();
  const [filter, setFilter] = useState("全部");
  const [category, setCategory] = useState("全部");
  const rows = shared.notices.filter((notice) => (filter === "全部" || !notice.read) && (category === "全部" || noticeCategory(notice.route) === category));
  const open = (id: string, route: string) => {
    shared.markNoticeRead(id);
    const exists = (route.startsWith("/works/") && shared.works.some((work) => route.endsWith(work.id))) || (route.startsWith("/plans/") && shared.plans.some((plan) => route.endsWith(plan.id)));
    if (exists) navigate(route); else Toast.show({ content: "無權查看此通知的主體" });
  };
  return <Page title="通知中心" backTo="/me" right={<button className="m-nav-link" onClick={() => { rows.forEach((notice) => !notice.read && shared.markNoticeRead(notice.id)); Toast.show({ content: "當前篩選結果已全部標為已讀" }); }}>全部已讀</button>}>
    <div className="m-seg-bar"><div className="m-seg">{["全部", "未讀"].map((value) => <button key={value} className={filter === value ? "active" : ""} onClick={() => setFilter(value)}>{value}</button>)}</div></div>
    <CapsuleTabs className="m-capsules" activeKey={category} onChange={setCategory}>{["全部", "工作", "巡查", "系統"].map((value) => <CapsuleTabs.Tab key={value} title={value} />)}</CapsuleTabs>
    <div className="m-card flush">{rows.length ? rows.map((notice) => <button key={notice.id} className={`m-notice ${notice.read ? "" : "unread"}`} onClick={() => open(notice.id, notice.route)}>
      <span className={`m-notice-icon level-${notice.level}`}>{notice.level === "一般" ? <BellOutline /> : <ExclamationCircleFill />}</span>
      <div><strong>{notice.title}{notice.level !== "一般" && <StatusTag>{notice.level}</StatusTag>}</strong><p>{notice.body}</p><time>{notice.time} · {noticeCategory(notice.route)}</time></div>
      {!notice.read && <i className="m-unread-dot" />}
    </button>) : <Empty title="沒有通知" />}</div>
  </Page>;
}

export function CompanionsPage() {
  const { state, persona, addCompanion, removeCompanion } = useApp();
  const [open, setOpen] = useState(false); const [account, setAccount] = useState(""); const [password, setPassword] = useState(""); const [error, setError] = useState("");
  const submit = (qr?: string) => {
    const message = addCompanion(qr ?? account, qr ? "123456" : password);
    if (message) { setError(message); return; }
    setOpen(false); setAccount(""); setPassword(""); setError("");
    Toast.show({ icon: "success", content: "已驗證並加入同行人" });
  };
  return <Page title="同行人" backTo="/me" footer={<div className="m-footer-bar"><Button block color="primary" disabled={state.companions.length >= 5} onClick={() => { setError(""); setOpen(true); }}>加入同行人（{state.companions.length}/5）</Button></div>}>
    <div className="m-inline-note">同行人在本機驗證身份後加入。之後每取一個定位點，會為 {persona.name} 及每名同行人各寫一筆；主用戶登出時同行人一併結束。</div>
    <div className="m-card flush">{state.companions.length ? state.companions.map((item) => <div key={item.account} className="m-companion">
      <span className="m-avatar small">{item.name.slice(0, 1)}</span><div><strong>{item.name}</strong><span>{item.account} · {item.dept} · {shortTime(item.addedAt)} 加入</span></div>
      <Button size="mini" color="danger" fill="outline" onClick={() => { void Dialog.confirm({ title: `移除 ${item.name}？`, content: "移除後不再為此同行人記錄軌跡。", confirmText: "移除", onConfirm: () => removeCompanion(item.account) }); }}>移除</Button>
    </div>) : <Empty title="尚未加入同行人" text="最多 5 人" />}</div>
    <Popup visible={open} onMaskClick={() => setOpen(false)} bodyClassName="m-op-popup">
      <header><button onClick={() => setOpen(false)}>取消</button><strong>加入同行人</strong><button className="primary" onClick={() => submit()}>驗證並加入</button></header>
      <div className="m-form">
        <div className="m-form-row"><span><b>*</b>同行人帳號</span><Input className="m-input-right" value={account} onChange={(value) => { setAccount(value); setError(""); }} placeholder="如 au.ws" clearable /></div>
        <div className="m-form-row"><span><b>*</b>同行人密碼</span><Input className="m-input-right" type="password" value={password} onChange={(value) => { setPassword(value); setError(""); }} placeholder="只作即時驗證，不保存" /></div>
      </div>
      {error && <p className="m-op-error"><ExclamationCircleFill /> {error}</p>}
      <Button block fill="outline" className="m-qr-button" onClick={() => submit("au.ws")}><ScanCodeOutline /> 掃描同行人工作證二維碼</Button>
      <p className="m-op-note">示範：可用帳號 au.ws、lei.cc、kwan.mt，密碼 123456。</p>
    </Popup>
  </Page>;
}

export function SettingsPage() {
  const { state, updateSettings } = useApp(); const navigate = useNavigate();
  const [uploading, setUploading] = useState(false);
  return <Page title="設置" backTo="/me">
    <GroupTitle>顯示</GroupTitle>
    <div className="m-form">
      <div className="m-form-row"><span><GlobalOutline /> 語言</span><Selector className="m-selector inline" columns={2} showCheckMark={false} value={[state.settings.language]} options={[{ label: "繁體中文", value: "繁體中文" }, { label: "Português", value: "Português" }]} onChange={(value) => { if (!value[0]) return; updateSettings({ language: value[0] as "繁體中文" }); if (value[0] !== "繁體中文") Toast.show({ content: "其他語言待確認，示範版只提供繁體中文介面" }); }} /></div>
      <div className="m-form-block"><span>字體大小</span><Selector className="m-selector" columns={4} showCheckMark={false} value={[state.settings.fontSize]} options={(["標準", "大", "特大", "跟隨系統"] as const).map((value) => ({ label: value, value }))} onChange={(value) => value[0] && updateSettings({ fontSize: value[0] as typeof state.settings.fontSize })} /><small className="m-form-sub">預設「大」，方便戶外閱讀（選項待確認）</small></div>
    </div>
    <GroupTitle>附件上傳策略</GroupTitle>
    <div className="m-form"><div className="m-form-row"><span>影片只在 Wi-Fi 上傳</span><Switch checked={state.settings.wifiOnlyVideo} onChange={(checked) => updateSettings({ wifiOnlyVideo: checked })} /></div></div>
    <GroupTitle>系統</GroupTitle>
    <List className="m-list" mode="card">
      <List.Item extra={`v${APP_VERSION}`} onClick={() => state.updateMode === "無" ? Dialog.alert({ title: "檢查更新", content: `目前版本 v${APP_VERSION}，已是最新版本。`, confirmText: "知道了" }) : navigate("/check/update")}>檢查更新</List.Item>
      <List.Item extra={uploading ? "上傳中…" : "上傳加密日誌至後台"} onClick={() => { setUploading(true); window.setTimeout(() => { setUploading(false); Toast.show({ icon: "success", content: "已上傳 3 個加密日誌檔" }); }, 900); }}>上傳日誌</List.Item>
      <List.Item extra={<StatusTag tone={state.syncQueue.some((item) => item.status !== "已同步") ? "warning" : "success"}>{state.syncQueue.filter((item) => item.status !== "已同步").length} 筆</StatusTag>} onClick={() => navigate("/me/sync")}>待同步記錄</List.Item>
      <List.Item onClick={() => navigate("/me/profile")}>用戶資料</List.Item>
    </List>
  </Page>;
}

const drift: [number, number, string] = [742, 64, "08:47"];

export function TrackPage() {
  const { state } = useApp();
  const [numbers, setNumbers] = useState(false); const [filterDrift, setFilterDrift] = useState(true);
  const points = filterDrift ? myTrack : [...myTrack.slice(0, 6), drift, ...myTrack.slice(6)];
  const last = myTrack[myTrack.length - 1];
  return <Page title="我的軌跡" backTo="/me" bodyClassName="m-map-body">
    <div className="m-track-bar"><span>今日 · 本人軌跡</span><label>點序號 <Switch checked={numbers} onChange={setNumbers} /></label><label>過濾漂移點 <Switch checked={filterDrift} onChange={setFilterDrift} /></label></div>
    <MapView key={`${numbers}-${filterDrift}`} className="m-full-map" track={points} showTrackIndex={numbers} />
    <div className="m-track-summary">
      <div><strong>{points.length}</strong><span>定位點</span></div><div><strong>1.8 km</strong><span>里程</span></div><div><strong>{last[2]}</strong><span>最後位置</span></div><div><strong>{state.companions.length}</strong><span>同行人</span></div>
      <p>定位間隔 3 分鐘（後台參數），App 退到背景亦持續記錄。{filterDrift ? "已過濾精度差於 100 米或速度超過 150 公里／小時的漂移點。" : "目前顯示包括 1 個漂移點。"}</p>
    </div>
  </Page>;
}

export function SyncPage() {
  const { state, pending, patch, resolveConflict } = useApp(); const navigate = useNavigate();
  const groups: [string, typeof state.syncQueue][] = [["衝突", state.syncQueue.filter((item) => item.status === "衝突")], ["待上傳", state.syncQueue.filter((item) => item.status === "待同步" || item.status === "同步中")], ["已同步", state.syncQueue.filter((item) => item.status === "已同步")]];
  return <Page title="待同步記錄" backTo="/me" footer={<div className="m-footer-bar"><Button onClick={() => patch({ syncQueue: state.syncQueue.filter((item) => item.status !== "已同步") })}>清除已同步</Button><Button color="primary" disabled={state.offline || !pending} onClick={() => { Toast.show({ content: "同步引擎正在逐筆上傳" }); }}>{state.offline ? "離線中，無法同步" : "立即同步"}</Button></div>}>
    <div className={`m-sync-head ${state.offline ? "offline" : ""}`}><LoopOutline /><div><strong>{state.offline ? "離線模式" : "網絡正常"}</strong><span>待同步 {pending} 筆 · 網絡恢復、回到前台及每 2 分鐘自動同步；逐筆確認後才移除，中斷可續傳。</span></div></div>
    {state.syncQueue.length === 0 && <Empty title="沒有待同步記錄" text="離線建立的事件、工作、巡查及操作會在這裡排隊" />}
    {groups.filter(([, items]) => items.length).map(([title, items]) => <div key={title}><GroupTitle>{title}（{items.length}）</GroupTitle><div className="m-card flush">{items.map((item) => <div key={item.id} className="m-sync-item">
      <div><strong>{item.title}</strong><span>{item.kind} · {item.tempCode !== item.targetId && item.status === "已同步" ? `${item.tempCode} → ${item.targetId}` : item.tempCode} · {shortTime(item.createdAt)}</span>{item.conflict && <p>{item.conflict}</p>}</div>
      <StatusTag>{item.status}</StatusTag>
      {item.status === "衝突" && <div className="m-sync-actions"><Button size="mini" onClick={() => { const log = state.workLogs.find((entry) => entry.id === item.targetId); if (log) navigate(`/works/${log.workId}`); }}>查看</Button><Button size="mini" color="primary" fill="outline" onClick={() => { resolveConflict(item.id, "重做"); Toast.show({ content: "已按伺服器最新狀態重做操作" }); }}>重做</Button><Button size="mini" color="danger" fill="outline" onClick={() => { resolveConflict(item.id, "放棄"); Toast.show({ content: "已放棄本地操作" }); }}>放棄</Button></div>}
    </div>)}</div></div>)}
    <p className="m-footnote">衝突規則：新增類（巡查結果、事件、新工作、留言）一律接受；狀態類以伺服器為準，本地操作標為「衝突」。</p>
  </Page>;
}

export function AboutPage() {
  const run = useRunCommand(); const snapshot = useSnapshot();
  return <Page title="關於本原型" backTo="/me">
    <Card><p className="m-about">巡查派工管理系統前線 App 的 HTML5 可點擊原型，依據《詳細設計》第 12 節及 14.10 節製作，組件及視覺參照用友 BIP 移動端。資料保存在本機瀏覽器，並與後台原型共用。</p></Card>
    <GroupTitle>示範控制台</GroupTitle>
    <DemoControls snapshot={snapshot} run={run} compact />
  </Page>;
}
