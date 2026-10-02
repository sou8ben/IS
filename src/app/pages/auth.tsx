import { useEffect, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { Button, Checkbox, Dialog, Input, ProgressBar, Toast } from "antd-mobile";
import { CheckCircleFill, CompassOutline, ExclamationCircleFill, EyeInvisibleOutline, EyeOutline, LockFill, LockOutline, SetOutline, SoundOutline, UserOutline } from "antd-mobile-icons";
import { useApp } from "../store";
import type { AppState } from "../types";

export const DEVICE_ID = "AND-7F3K-2291";
export const APP_VERSION = "2.4.0";

export function nextCheck(state: Pick<AppState, "deviceLocked" | "updateMode" | "updateDismissed" | "permissionGranted">) {
  if (state.deviceLocked) return "/check/locked";
  if (state.updateMode === "強制" || (state.updateMode === "推薦" && !state.updateDismissed)) return "/check/update";
  if (!state.permissionGranted) return "/check/permission";
  return "/home";
}

function BrandMark() {
  return <div className="m-brand"><svg viewBox="0 0 48 48" aria-hidden><rect width="48" height="48" rx="12" /><path d="M14 30l7-14 6 10 4-6 5 10" /><circle cx="33" cy="15" r="3" /></svg></div>;
}

export function LoginPage() {
  const { state, login, patch } = useApp(); const navigate = useNavigate();
  const [account, setAccount] = useState(state.rememberAccount);
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(!!state.rememberAccount);
  const [visible, setVisible] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const submit = () => {
    if (!account.trim() || !password) { setError(!account.trim() ? "請輸入帳號" : "請輸入密碼"); return; }
    setLoading(true);
    window.setTimeout(() => {
      setLoading(false);
      const message = login(account, password, remember);
      if (message) { setError(message); return; }
      navigate(nextCheck(state), { replace: true });
    }, 450);
  };
  const sso = () => { void Dialog.confirm({
    title: "公務通／商社通登入",
    content: "將跳轉至公務通進行單點登入。友空間 App 暫不支援此方式，實際提供與否視移動端路線而定。示範將以陳家朗身份登入。",
    confirmText: "繼續", cancelText: "取消",
    onConfirm: () => { patch({ loggedIn: true, personaId: "P1" }); navigate(nextCheck(state), { replace: true }); },
  }); };
  return <div className="m-login">
    <div className="m-login-hero"><BrandMark /><h1>巡查派工管理系統</h1><p>市政署 · 前線巡查 App</p></div>
    <div className="m-login-form">
      <label className="m-login-field"><UserOutline /><Input placeholder="帳號" value={account} onChange={(value) => { setAccount(value); setError(""); }} clearable autoComplete="username" /></label>
      <label className="m-login-field"><LockOutline /><Input placeholder="密碼" type={visible ? "text" : "password"} value={password} onChange={(value) => { setPassword(value); setError(""); }} onEnterPress={submit} autoComplete="current-password" /><button type="button" aria-label={visible ? "隱藏密碼" : "顯示密碼"} onClick={() => setVisible(!visible)}>{visible ? <EyeOutline /> : <EyeInvisibleOutline />}</button></label>
      <div className="m-login-options"><Checkbox checked={remember} onChange={setRemember}>記住帳號</Checkbox><span>不提供記住密碼</span></div>
      {error && <p className="m-login-error"><ExclamationCircleFill /> {error}</p>}
      <Button block color="primary" size="large" loading={loading} onClick={submit}>登入</Button>
      <div className="m-login-divider"><span>或</span></div>
      <Button block size="large" onClick={sso}>公務通／商社通登入</Button>
      <p className="m-login-hint">示範帳號：chan.kl（巡查）、wong.cf（執行）、leung.km（管理）；密碼 123456</p>
    </div>
    <footer className="m-login-foot">v{APP_VERSION} · 裝置 {DEVICE_ID}</footer>
  </div>;
}

export function CheckLockedPage() {
  const { state } = useApp();
  return <div className="m-check danger">
    <div className="m-check-icon"><LockFill /></div>
    <h1>此裝置已被遠程鎖定</h1>
    <p>系統管理員已鎖定此裝置，本機會話已清除，所有請求均會被拒絕。{state.deviceLocked ? "" : "裝置已解除鎖定，請重新登入。"}</p>
    <dl className="m-check-info"><div><dt>裝置編號</dt><dd>{DEVICE_ID}</dd></div><div><dt>鎖定原因</dt><dd>裝置遺失報告</dd></div><div><dt>鎖定時間</dt><dd>2026-09-29 12:06</dd></div></dl>
    <Button block fill="outline" onClick={() => { Toast.show({ content: "系統管理員熱線：2833 7676" }); }}>聯絡系統管理員</Button>
  </div>;
}

export function CheckUpdatePage() {
  const { state, patch } = useApp(); const navigate = useNavigate();
  const [progress, setProgress] = useState<number | null>(null);
  useEffect(() => {
    if (progress === null || progress >= 100) return;
    const timer = window.setTimeout(() => setProgress(Math.min(100, progress + 12)), 180);
    return () => window.clearTimeout(timer);
  }, [progress]);
  useEffect(() => {
    if (progress !== 100) return;
    Toast.show({ icon: "success", content: "已安裝 v2.5.0（示範）" });
    patch({ updateMode: "無" });
    navigate(nextCheck({ ...state, updateMode: "無" }), { replace: true });
  }, [progress]); // eslint-disable-line react-hooks/exhaustive-deps
  if (state.updateMode === "無") return <div className="m-check"><div className="m-check-icon ok"><CheckCircleFill /></div><h1>已是最新版本</h1><p>目前版本 v{APP_VERSION}</p><Button block color="primary" onClick={() => navigate(state.loggedIn ? "/home" : "/login", { replace: true })}>返回</Button></div>;
  const forced = state.updateMode === "強制";
  return <div className="m-check">
    <div className="m-check-icon info"><SetOutline /></div>
    <h1>發現新版本 v2.5.0</h1>
    <p>{forced ? "此版本為強制更新，目前版本低於最低支援版本，更新後才可繼續使用。" : "建議更新以獲得最新功能及修正。"}</p>
    <div className="m-check-notes"><strong>更新說明</strong><ul><li>巡查表支援離線自動暫存</li><li>工作留言可插入留言模板參數</li><li>修正同行人軌跡偶爾缺點的問題</li></ul><span>安裝包 38.6 MB · 由署內網絡下載，不經應用商店</span></div>
    {progress !== null ? <div className="m-check-progress"><ProgressBar percent={progress} /><span>下載中 {progress}%</span></div>
      : <Button block color="primary" size="large" onClick={() => setProgress(0)}>下載並安裝</Button>}
    {!forced && progress === null && <Button block fill="none" onClick={() => { patch({ updateDismissed: true }); navigate(nextCheck({ ...state, updateDismissed: true }), { replace: true }); }}>稍後再說</Button>}
  </div>;
}

export function CheckPermissionPage() {
  const { patch } = useApp(); const navigate = useNavigate();
  const [granted, setGranted] = useState({ location: false, battery: false, notify: false });
  const items: { key: keyof typeof granted; icon: ReactNode; title: string; text: string; action: string }[] = [
    { key: "location", icon: <CompassOutline />, title: "定位權限：始終允許", text: "App 退到背景時仍需持續記錄軌跡（每 3 分鐘 1 點），並在登入、登出及操作時取點。", action: "設為始終允許" },
    { key: "battery", icon: <SetOutline />, title: "忽略電池最佳化", text: "避免系統省電機制中止前台定位服務，確保軌跡完整。", action: "前往設定" },
    { key: "notify", icon: <SoundOutline />, title: "通知權限", text: "接收工作分派、將逾時及特急通知（聲音及震動）。", action: "允許通知" },
  ];
  const all = Object.values(granted).every(Boolean);
  const finish = () => { patch({ permissionGranted: true }); navigate("/home", { replace: true }); };
  return <div className="m-check m-permission">
    <h1>開始使用前，請授予以下權限</h1>
    <p>巡查軌跡及現場定位校驗需要以下設定。</p>
    <div className="m-permission-list">{items.map((item, index) => <article key={item.key} className={`m-permission-item ${granted[item.key] ? "done" : ""}`}>
      <div className="m-permission-head">
        <span className="m-permission-icon">{item.icon}</span>
        <div className="m-permission-title"><strong>{item.title}</strong><span>步驟 {index + 1}／{items.length}</span></div>
        {granted[item.key] && <span className="m-permission-ok"><CheckCircleFill /> 已授予</span>}
      </div>
      <small className="m-permission-desc">{item.text}</small>
      {!granted[item.key] && <Button className="m-permission-action" block size="small" color="primary" fill="outline" onClick={() => { setGranted({ ...granted, [item.key]: true }); Toast.show({ content: "已從系統設定返回" }); }}>{item.action}</Button>}
    </article>)}</div>
    <Button block color="primary" size="large" disabled={!all} onClick={finish}>完成，進入主頁</Button>
    <Button block fill="none" onClick={() => { void Dialog.confirm({ title: "稍後設定？", content: "未授予「始終允許定位」及忽略電池最佳化，軌跡可能不完整，定位校驗亦可能失敗。", confirmText: "仍然繼續", cancelText: "返回設定", onConfirm: finish }); }}>稍後設定</Button>
  </div>;
}
