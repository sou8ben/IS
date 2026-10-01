import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { personas } from "./data";
import { clockText } from "./rules";
import { useApp } from "./store";
import type { AppState, PushMessage } from "./types";

export type DemoCommand =
  | { type: "offline"; value: boolean }
  | { type: "conflict"; value: boolean }
  | { type: "persona"; id: string }
  | { type: "push"; level: PushMessage["level"] }
  | { type: "locked"; value: boolean }
  | { type: "update"; mode: AppState["updateMode"] }
  | { type: "navigate"; path: string }
  | { type: "reset" }
  | { type: "logout" };

export interface DemoSnapshot { loggedIn: boolean; personaId: string; offline: boolean; simulateConflict: boolean; deviceLocked: boolean; updateMode: AppState["updateMode"]; pending: number; route: string }

const HOST = "is-demo-host";
const APP = "is-app";

export const screenIndex: { group: string; items: [string, string][] }[] = [
  { group: "登入與檢查", items: [["登入", "/login"], ["版本更新", "/check/update"], ["定位權限引導", "/check/permission"]] },
  { group: "主頁", items: [["主頁", "/home"]] },
  { group: "巡查", items: [["計劃列表", "/plans"], ["計劃作業頁", "/plans/PL-20260929-0003"], ["巡查表（待填寫）", "/inspections/IN-20260929-0030"], ["巡查表（已完成·異常）", "/inspections/IN-20260929-0024"], ["獨立新增巡查", "/inspections/new"], ["巡查列表", "/inspections"], ["巡查分佈地圖", "/inspections/map"]] },
  { group: "事件", items: [["事件列表", "/events"], ["新增事件", "/events/new"], ["事件詳情", "/events/EV-20260929-0006"], ["事件分佈地圖", "/events/map"]] },
  { group: "工作", items: [["工作列表", "/works"], ["新增工作", "/works/new"], ["工作詳情", "/works/WK-20260929-0012"], ["工作分佈地圖", "/works/map"]] },
  { group: "我的", items: [["我的", "/me"], ["通知中心", "/me/notifications"], ["同行人", "/me/companions"], ["設置", "/me/settings"], ["我的軌跡", "/me/track"], ["待同步記錄", "/me/sync"]] },
];

const scripts: [string, string][] = [
  ["巡查作業", "主頁 › 進行中計劃 › 選「海濱座椅區 A」› 座椅選「否」› 建立工作（疑似重複）› 故意漏填後提交 › 補齊再提交"],
  ["作業鎖", "中止 PL-0003 後，長按合併 PL-0005 及 PL-0006 開始作業；再試開始 PL-0004 看搶鎖失敗"],
  ["工作處理", "切換黃志峰：WK-0011 跟進、WK-0012 解決（附件不足會攔截）；切換梁嘉敏：WK-0096 關閉"],
  ["離線同步", "切換離線 › 新增事件及跟進工作 › 恢復在線 › 處理同步衝突 › 到後台確認記錄"],
  ["推送及管控", "分別發送一般／緊急／特急推送；開啟遠程鎖定或強制更新"],
];

export function useRunCommand() {
  const app = useApp(); const navigate = useNavigate(); const location = useLocation();
  return (command: DemoCommand) => {
    switch (command.type) {
      case "offline": app.patch({ offline: command.value }); break;
      case "conflict": app.patch({ simulateConflict: command.value }); break;
      case "persona": app.setPersona(command.id); if (location.pathname === "/login" || location.pathname.startsWith("/check")) navigate("/home"); break;
      case "push": app.autoLogin(); app.pushMessage(command.level); break;
      case "locked": if (command.value) { app.patch({ deviceLocked: true, loggedIn: false }); navigate("/check/locked"); } else { app.patch({ deviceLocked: false }); navigate("/login"); } break;
      case "update": app.patch({ updateMode: command.mode, updateDismissed: false }); if (command.mode !== "無") navigate("/check/update"); break;
      case "navigate": navigate(command.path); break;
      case "reset": app.resetAll(); navigate("/login"); break;
      case "logout": app.logout(); navigate("/login"); break;
    }
  };
}

export function useSnapshot(): DemoSnapshot {
  const { state, pending } = useApp(); const location = useLocation();
  return { loggedIn: state.loggedIn, personaId: state.personaId, offline: state.offline, simulateConflict: state.simulateConflict, deviceLocked: state.deviceLocked, updateMode: state.updateMode, pending, route: location.pathname + location.search };
}

/** 在 iframe 內：接收示範控制台指令，並回報狀態 */
export function useDemoBridge() {
  const run = useRunCommand(); const snapshot = useSnapshot();
  const runRef = useRef(run); runRef.current = run;
  const embedded = window.parent !== window;
  useEffect(() => {
    if (!embedded) return;
    const onMessage = (event: MessageEvent) => { if (event.origin === window.location.origin && event.data?.source === HOST) runRef.current(event.data.command as DemoCommand); };
    window.addEventListener("message", onMessage);
    window.parent.postMessage({ source: APP, type: "ready" }, window.location.origin);
    return () => window.removeEventListener("message", onMessage);
  }, [embedded]);
  const serialized = JSON.stringify(snapshot);
  useEffect(() => { if (embedded) window.parent.postMessage({ source: APP, type: "state", snapshot }, window.location.origin); }, [serialized]); // eslint-disable-line react-hooks/exhaustive-deps
}

export function DemoControls({ snapshot, run, compact }: { snapshot: DemoSnapshot | null; run: (command: DemoCommand) => void; compact?: boolean }) {
  const [openScripts, setOpenScripts] = useState(!compact);
  const s = snapshot;
  return <div className={`demo-controls ${compact ? "compact" : ""}`}>
    <section>
      <h3>當前身份</h3>
      <div className="demo-personas">{personas.map((persona) => <button key={persona.id} className={s?.loggedIn && s.personaId === persona.id ? "active" : ""} onClick={() => run({ type: "persona", id: persona.id })}><b>{persona.name.slice(0, 1)}</b><span><strong>{persona.name}</strong><small>{persona.groups.map((group) => `${group.name}（${group.kind}）`).join("、")}</small></span></button>)}</div>
      {!s?.loggedIn && <p className="demo-note">目前未登入；選擇身份即以該身份登入。示範密碼：123456</p>}
    </section>
    <section>
      <h3>網絡與同步</h3>
      <div className="demo-row"><span>網絡狀態</span><div className="demo-seg"><button className={!s?.offline ? "active" : ""} onClick={() => run({ type: "offline", value: false })}>在線</button><button className={s?.offline ? "active" : ""} onClick={() => run({ type: "offline", value: true })}>離線</button></div></div>
      <label className="demo-check"><input type="checkbox" checked={!!s?.simulateConflict} onChange={(event) => run({ type: "conflict", value: event.target.checked })} />恢復在線時，模擬一筆工作操作衝突</label>
      <p className="demo-note">待同步：{s?.pending ?? 0} 筆</p>
    </section>
    <section>
      <h3>模擬推送通知</h3>
      <div className="demo-buttons"><button onClick={() => run({ type: "push", level: "一般" })}>一般</button><button className="warn" onClick={() => run({ type: "push", level: "緊急" })}>緊急</button><button className="danger" onClick={() => run({ type: "push", level: "特急" })}>特急</button></div>
    </section>
    <section>
      <h3>裝置及版本</h3>
      <div className="demo-row"><span>遠程鎖定</span><div className="demo-seg"><button className={!s?.deviceLocked ? "active" : ""} onClick={() => run({ type: "locked", value: false })}>正常</button><button className={s?.deviceLocked ? "active" : ""} onClick={() => run({ type: "locked", value: true })}>已鎖定</button></div></div>
      <div className="demo-row"><span>版本更新</span><div className="demo-seg">{(["無", "推薦", "強制"] as const).map((mode) => <button key={mode} className={s?.updateMode === mode ? "active" : ""} onClick={() => run({ type: "update", mode })}>{mode}</button>)}</div></div>
    </section>
    <section>
      <h3>畫面索引</h3>
      {screenIndex.map((group) => <div className="demo-index" key={group.group}><span>{group.group}</span><div>{group.items.map(([label, path]) => <button key={path} className={s?.route === path ? "active" : ""} onClick={() => run({ type: "navigate", path })}>{label}</button>)}</div></div>)}
    </section>
    <section>
      <h3 className="demo-toggle" onClick={() => setOpenScripts(!openScripts)}>示範腳本<span>{openScripts ? "收起" : "展開"}</span></h3>
      {openScripts && <ol className="demo-scripts">{scripts.map(([title, text]) => <li key={title}><strong>{title}</strong><span>{text}</span></li>)}</ol>}
    </section>
    <section className="demo-footer">
      <button onClick={() => run({ type: "logout" })}>登出</button>
      <button className="danger" onClick={() => { if (window.confirm("重設所有示範資料？App 及後台的本地變更都會清除。")) run({ type: "reset" }); }}>重設示範資料</button>
    </section>
  </div>;
}

function StatusIcons({ offline }: { offline: boolean }) {
  return <span className="device-icons" aria-hidden>
    <svg viewBox="0 0 18 12"><rect x="0" y="8" width="3" height="4" rx=".5" /><rect x="5" y="5" width="3" height="7" rx=".5" /><rect x="10" y="2.5" width="3" height="9.5" rx=".5" opacity={offline ? 0.3 : 1} /><rect x="15" y="0" width="3" height="12" rx=".5" opacity={offline ? 0.3 : 1} /></svg>
    {offline ? <svg viewBox="0 0 16 12"><path d="M1 4.2a10 10 0 0 1 14 0M3.6 6.9a6.2 6.2 0 0 1 8.8 0M6.3 9.6a2.4 2.4 0 0 1 3.4 0" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" opacity=".3" /><path d="M2 1l12 10" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg>
      : <svg viewBox="0 0 16 12"><path d="M1 4.2a10 10 0 0 1 14 0M3.6 6.9a6.2 6.2 0 0 1 8.8 0M6.3 9.6a2.4 2.4 0 0 1 3.4 0" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg>}
    <svg viewBox="0 0 26 12"><rect x=".6" y=".6" width="21.8" height="10.8" rx="2.6" fill="none" stroke="currentColor" strokeWidth="1.2" /><rect x="2.4" y="2.4" width="14.6" height="7.2" rx="1.2" /><rect x="23.6" y="3.8" width="1.8" height="4.4" rx=".8" /></svg>
    <b>76%</b>
  </span>;
}

/** 桌面示範頁：Android 手機框 + 示範控制台；App 本身在 iframe 內運行 */
export function DemoHost() {
  const frame = useRef<HTMLIFrameElement>(null);
  const [snapshot, setSnapshot] = useState<DemoSnapshot | null>(null);
  const [clock, setClock] = useState(clockText());
  const [src] = useState(() => `${import.meta.env.BASE_URL}app.html?embed=1${window.location.hash || "#/login"}`);
  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin || event.data?.source !== APP) return;
      if (event.data.type === "state") { const next = event.data.snapshot as DemoSnapshot; setSnapshot(next); window.history.replaceState(null, "", `#${next.route}`); }
    };
    window.addEventListener("message", onMessage);
    const timer = window.setInterval(() => setClock(clockText()), 15000);
    return () => { window.removeEventListener("message", onMessage); window.clearInterval(timer); };
  }, []);
  const run = (command: DemoCommand) => frame.current?.contentWindow?.postMessage({ source: HOST, command }, window.location.origin);
  return <div className="host">
    <header className="host-head">
      <span className="host-brand"><i />巡查派工管理系統</span><strong>前線 App 原型</strong><em>BIP 移動端風格 · 可點擊示範</em>
      <a href={`${import.meta.env.BASE_URL}#/workbench`} target="_blank" rel="noreferrer">開啟後台原型</a>
    </header>
    <main className="host-main">
      <div className="host-stage">
        <div className="device">
          <div className="device-screen">
            <div className="device-status"><span>{clock}</span><StatusIcons offline={!!snapshot?.offline} /></div>
            <iframe ref={frame} src={src} title="巡查派工 App" />
            <div className="device-gesture"><i /></div>
          </div>
        </div>
        <p className="host-caption">Android · 390 × 844 · 資料保存在本機瀏覽器，與後台原型共用</p>
      </div>
      <aside className="host-panel"><header><strong>示範控制台</strong><span>模擬身份、網絡、推送及裝置情景</span></header><DemoControls snapshot={snapshot} run={run} /></aside>
    </main>
  </div>;
}
