import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Badge, Button, Dialog } from "antd-mobile";
import { AddCircleOutline, BellOutline, CompassOutline, ExclamationCircleOutline, FillinOutline, FlagOutline, RightOutline, ScanningOutline, TeamOutline, TravelOutline } from "antd-mobile-icons";
import { Card, Empty, NfcPopup, Progress, StatusTag } from "../components";
import { isMyWork, nowText, shortTime, slaInfo, visiblePlans } from "../rules";
import { useApp } from "../store";

export function HomePage() {
  const { state, shared, persona } = useApp(); const navigate = useNavigate();
  const [nfc, setNfc] = useState(false);
  const plans = visiblePlans(shared.plans, persona).filter((plan) => plan.startAt.startsWith("2026-09-29"));
  const active = shared.plans.filter((plan) => plan.status === "進行中" && plan.executor === persona.name);
  const scope = shared.works.filter((work) => !work.voided && (isMyWork(work, persona) || persona.groups.some((group) => group.name === work.group) || persona.groups.some((group) => group.kind === "管理")));
  const openWorks = scope.filter((work) => work.status === "新建" || work.status === "跟進中");
  const attention = openWorks.map((work) => ({ work, sla: slaInfo(work) })).filter((item) => item.sla.state !== "正常").slice(0, 3);
  const unread = shared.notices.filter((notice) => !notice.read).length;
  const hour = Number(nowText().slice(11, 13));
  const stats = [
    { label: "待執行計劃", value: plans.filter((plan) => plan.status !== "已完成").length, path: "/plans" },
    { label: "已完成計劃", value: plans.filter((plan) => plan.status === "已完成").length, path: "/plans" },
    { label: "待處理工作", value: openWorks.length, path: "/works" },
    { label: "已完成工作", value: scope.filter((work) => work.status === "已解決" || work.status === "已關閉").length, path: "/works" },
  ];
  const shortcuts = [
    { label: "新增事件", icon: <FlagOutline />, tone: "orange", onClick: () => navigate("/events/new") },
    { label: "新增工作", icon: <FillinOutline />, tone: "red", onClick: () => navigate("/works/new") },
    { label: "獨立巡查", icon: <CompassOutline />, tone: "blue", onClick: () => navigate("/inspections/new") },
    { label: "NFC 打卡", icon: <ScanningOutline />, tone: "green", onClick: () => setNfc(true) },
    { label: "我的軌跡", icon: <TravelOutline />, tone: "blue", onClick: () => navigate("/me/track") },
    { label: "同行人", icon: <TeamOutline />, tone: "orange", onClick: () => navigate("/me/companions") },
  ];
  return <div className="m-page m-home">
    <div className="m-page-body">
      <header className="m-home-head">
        <div className="m-avatar">{persona.name.slice(0, 1)}</div>
        <div className="m-home-greet"><strong>{persona.name}，{hour < 12 ? "早晨" : hour < 18 ? "午安" : "晚上好"}</strong><span>{persona.groups[0].name} · {persona.role}</span></div>
        <button className="m-home-bell" aria-label="通知中心" onClick={() => navigate("/me/notifications")}><Badge content={unread ? (unread > 99 ? "99+" : unread) : null}><BellOutline /></Badge></button>
      </header>
      <div className="m-home-date">2026 年 9 月 29 日 星期二 · 澳門時間 {nowText().slice(11)}{state.companions.length ? ` · 同行 ${state.companions.length} 人` : ""}</div>
      <div className="m-stats">{stats.map((item) => <button key={item.label} onClick={() => navigate(item.path)}><strong>{item.value}</strong><span>{item.label}</span></button>)}</div>
      {active.length > 0 && <Card className="m-active-card" title="進行中計劃" extra={<StatusTag>進行中</StatusTag>}>
        {active.map((plan) => <div key={plan.id} className="m-active-plan"><div><strong>{plan.name}</strong><span>{shortTime(plan.startAt)}–{shortTime(plan.endAt)} · 已巡查 {plan.progress}/{plan.total}</span></div><Progress value={plan.progress} total={plan.total} /></div>)}
        <Button block color="primary" onClick={() => navigate(state.mergedPlanIds.length > 1 ? `/plans/merge?ids=${state.mergedPlanIds.join(",")}` : `/plans/${active[0].id}`)}>繼續作業</Button>
      </Card>}
      <Card title="常用功能"><div className="m-shortcuts">{shortcuts.map((item) => <button key={item.label} onClick={item.onClick}><span className={`m-shortcut-icon ${item.tone}`}>{item.icon}</span>{item.label}</button>)}</div></Card>
      <Card title="今日計劃" extra={<button className="m-card-link" onClick={() => navigate("/plans")}>全部 <RightOutline /></button>}>
        {plans.length ? plans.slice(0, 4).map((plan) => <button key={plan.id} className="m-home-row" onClick={() => navigate(`/plans/${plan.id}`)}><div><strong>{plan.name}</strong><span>{shortTime(plan.startAt)}–{shortTime(plan.endAt)} · {plan.progress}/{plan.total}{plan.executor && plan.status === "進行中" ? ` · ${plan.executor}` : ""}</span></div><StatusTag>{plan.status}</StatusTag></button>)
          : <Empty title="今日沒有指派給你的計劃" />}
      </Card>
      <Card title="需要關注" extra={<button className="m-card-link" onClick={() => navigate("/works")}>工作 <RightOutline /></button>}>
        {attention.length ? attention.map(({ work, sla }) => <button key={work.id} className="m-home-row" onClick={() => navigate(`/works/${work.id}`)}><i className={`m-row-bar ${sla.state === "已逾時" ? "danger" : "warning"}`} /><div><strong>{work.title}</strong><span>{work.id} · {work.group}</span></div><StatusTag>{sla.state}</StatusTag></button>)
          : <div className="m-home-ok"><ExclamationCircleOutline /> 沒有將逾時或已逾時的工作</div>}
      </Card>
      <button className="m-home-add" onClick={() => navigate("/events/new")}><AddCircleOutline /> 現場發現問題？立即登記事件</button>
    </div>
    <NfcPopup visible={nfc} onClose={() => setNfc(false)} onScanned={(tag) => { setNfc(false); Dialog.alert({ title: "已記錄輔助到場", content: `${tag.name}（${tag.code}）· ${nowText()}。此紀錄會與定位及軌跡互相參照。`, confirmText: "知道了" }); }} />
  </div>;
}
