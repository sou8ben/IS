import { useMemo, useState, type ReactNode } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  AppstoreOutlined, ArrowLeftOutlined, BarChartOutlined, BellOutlined, CheckOutlined,
  ClockCircleOutlined, CloseCircleOutlined, CloudUploadOutlined, DeleteOutlined,
  EditOutlined, EnvironmentOutlined, ExclamationCircleFilled, ExportOutlined,
  FileDoneOutlined, FileSearchOutlined, FilterOutlined, FormOutlined, ImportOutlined,
  LockOutlined, PaperClipOutlined, PlusOutlined, ReloadOutlined, SafetyCertificateOutlined, SendOutlined,
  SettingOutlined, SwapOutlined, TeamOutlined, ThunderboltOutlined, ToolOutlined,
  UserOutlined, WarningFilled,
} from "@ant-design/icons";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { genericDatasets, makeRecords, reportTrend } from "./data";
import { useDemo } from "./store";
import type { Column, EventRecord, GenericRecord, Plan, Work, WorkStatus } from "./types";
import {
  ActivityTimeline, AttachmentViewer, Button, ConfirmDialog, DenseTable, Field, FilterBar,
  FormDrawer, GenericEditor, ImportWizard, MapSplitView, PageHeader, Pagination, RuleBuilder,
  Select, StatusTag, TreePanel, useToast,
} from "./components";

const kpiData = [
  { label: "今日巡查計劃", value: "24", meta: "進行中 7", icon: <FileDoneOutlined />, tone: "blue" },
  { label: "待處理工作", value: "38", meta: "較昨日 +6", icon: <ToolOutlined />, tone: "orange" },
  { label: "即將逾時", value: "9", meta: "需優先跟進", icon: <ClockCircleOutlined />, tone: "red" },
  { label: "本月巡查完成率", value: "94.6%", meta: "目標 92%", icon: <BarChartOutlined />, tone: "green" },
];

export function WorkbenchPage() {
  const { works, plans } = useDemo();
  const navigate = useNavigate();
  const urgent = works.filter((work) => work.sla !== "正常").slice(0, 4);
  return <div className="page-content dashboard-page">
    <PageHeader title="營運工作台" description="2026 年 9 月 29 日，星期二 · 澳門時間 11:56" actions={<><Button icon={<ReloadOutlined />}>重新整理</Button><Button variant="primary" icon={<PlusOutlined />} onClick={() => navigate("/works/new")}>新增工作</Button></>} />
    <section className="kpi-grid">{kpiData.map((item) => <article className="kpi-card" key={item.label}>
      <div className={`kpi-icon ${item.tone}`}>{item.icon}</div><div><span>{item.label}</span><strong>{item.value}</strong><small>{item.meta}</small></div>
    </article>)}</section>
    <div className="dashboard-grid">
      <section className="panel chart-panel"><header><div><h2>近 7 日營運趨勢</h2><p>已完成巡查與新增工作數量</p></div><Select value="近 7 日" onChange={() => undefined}><option>近 7 日</option><option>近 30 日</option></Select></header>
        <ResponsiveContainer width="100%" height={260}><AreaChart data={reportTrend} margin={{ top: 20, right: 18, left: -18, bottom: 0 }}><CartesianGrid strokeDasharray="3 3" stroke="#edf0f5"/><XAxis dataKey="day" tick={{ fill: "#7b8495", fontSize: 12 }} axisLine={false}/><YAxis tick={{ fill: "#7b8495", fontSize: 12 }} axisLine={false}/><Tooltip/><Legend/><Area type="monotone" name="巡查完成" dataKey="plans" stroke="#e60012" strokeWidth={2} fill="#fbe8ea" fillOpacity={0.8}/><Area type="monotone" name="新增工作" dataKey="works" stroke="#3b82f6" strokeWidth={2} fill="transparent"/></AreaChart></ResponsiveContainer>
      </section>
      <section className="panel attention-panel"><header><div><h2>需要關注</h2><p>即將或已逾時工作</p></div><Link to="/works">查看全部</Link></header>
        <div className="attention-list">{urgent.map((work) => <button key={work.id} onClick={() => navigate(`/works/${work.id}`)}><span className={`priority-line ${work.sla === "已逾時" ? "danger" : "warning"}`} /><div><strong>{work.title}</strong><span>{work.id} · {work.group}</span></div><StatusTag>{work.sla}</StatusTag></button>)}</div>
      </section>
      <section className="panel plan-progress"><header><div><h2>今日巡查進度</h2><p>按計劃完成比例</p></div><Link to="/plans">計劃管理</Link></header>
        <div className="progress-list">{plans.slice(0, 3).map((plan) => <button key={plan.id} onClick={() => navigate(`/plans/${plan.id}`)}><div><strong>{plan.name}</strong><span>{plan.group} · {plan.progress}/{plan.total}</span></div><div className="progress-track"><i style={{ width: `${Math.round(plan.progress / plan.total * 100)}%` }} /></div><b>{Math.round(plan.progress / plan.total * 100)}%</b></button>)}</div>
      </section>
      <section className="panel quick-actions"><header><div><h2>常用功能</h2><p>依目前角色顯示</p></div></header><div className="quick-grid">
        {[{ label: "新增計劃", path: "/plans/new", icon: <FileDoneOutlined /> }, { label: "新增事件", path: "/events/new", icon: <ExclamationCircleFilled /> }, { label: "軌跡查詢", path: "/tracking", icon: <EnvironmentOutlined /> }, { label: "匯入資料", path: "/reports/import", icon: <ImportOutlined /> }, { label: "自訂報表", path: "/reports/designer", icon: <BarChartOutlined /> }, { label: "系統日誌", path: "/system/logs", icon: <FileSearchOutlined /> }].map((item) => <button key={item.label} onClick={() => navigate(item.path)}>{item.icon}<span>{item.label}</span></button>)}
      </div></section>
    </div>
  </div>;
}

interface GenericListPageProps { title: string; description: string; dataset: keyof typeof genericDatasets; eyebrow?: string; tree?: string[]; editor?: "generic" | "rule"; primaryLabel?: string; }

export function GenericListPage({ title, description, dataset, eyebrow, tree, editor = "generic", primaryLabel = "新增" }: GenericListPageProps) {
  const source = genericDatasets[dataset];
  const [records, setRecords] = useState(source);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("全部狀態");
  const [selected, setSelected] = useState<string[]>([]);
  const [activeTree, setActiveTree] = useState(tree?.[0] ?? "");
  const [editing, setEditing] = useState<GenericRecord | null | undefined>();
  const [confirm, setConfirm] = useState(false);
  const { showToast } = useToast();
  const rows = records.filter((record) => (!search || `${record.name}${record.code}${record.owner}`.toLowerCase().includes(search.toLowerCase())) && (status === "全部狀態" || record.status === status));
  const columns: Column<GenericRecord>[] = [
    { key: "code", title: "編號", width: 138, sortable: true, render: (record) => <a>{record.code}</a> },
    { key: "name", title: "名稱", sortable: true }, { key: "category", title: "類別", width: 145 },
    { key: "owner", title: "負責部門", width: 160 }, { key: "count", title: "關聯數", width: 90 },
    { key: "updatedAt", title: "最後修改", width: 170, sortable: true }, { key: "status", title: "狀態", width: 90, render: (record) => <StatusTag>{record.status}</StatusTag> },
  ];
  const save = () => { setEditing(undefined); showToast(editing ? "變更已儲存" : "記錄已建立"); };
  const disableSelected = () => { setRecords(records.map((record) => selected.includes(record.id) ? { ...record, status: "停用" } : record)); setConfirm(false); setSelected([]); showToast("所選記錄已停用"); };
  return <div className="page-content">
    <PageHeader title={title} description={description} eyebrow={eyebrow} actions={<><Button icon={<CloudUploadOutlined />}>匯入</Button><Button icon={<ExportOutlined />}>匯出</Button><Button variant="primary" icon={<PlusOutlined />} onClick={() => setEditing(null)}>{primaryLabel}</Button></>} />
    <div className={tree ? "tree-layout" : ""}>{tree && <TreePanel title="分類" nodes={tree} active={activeTree} onChange={setActiveTree} />}
      <section className="panel list-panel">
        <FilterBar search={search} onSearch={setSearch} onReset={() => { setSearch(""); setStatus("全部狀態"); }} onAdvanced={() => showToast("已展開高級篩選條件")}><Select value={status} onChange={setStatus}><option>全部狀態</option><option>啟用</option><option>停用</option></Select>{activeTree && <span className="filter-chip">{activeTree}</span>}</FilterBar>
        {selected.length > 0 && <div className="batch-bar"><strong>已選 {selected.length} 筆</strong><Button icon={<EditOutlined />}>批量編輯</Button><Button variant="danger" icon={<DeleteOutlined />} onClick={() => setConfirm(true)}>停用所選</Button></div>}
        <DenseTable rows={rows} columns={columns} selected={selected} onSelected={setSelected} onRowClick={setEditing} />
        <Pagination total={rows.length} />
      </section>
    </div>
    <FormDrawer open={editing !== undefined} title={editing ? `編輯${title.replace("管理", "")}` : `新增${title.replace("管理", "")}`} subtitle={editing?.code} onClose={() => setEditing(undefined)} onSubmit={save}>
      {editor === "rule" ? <><div className="form-grid"><Field label="規則名稱" required><input defaultValue={editing?.name} /></Field><Field label="適用權限點" required><Select value="關閉工作" onChange={() => undefined}><option>關閉工作</option><option>作廢記錄</option></Select></Field></div><RuleBuilder/><Field label="拒絕提示語" required><input defaultValue="您目前的群組身份不允許執行此操作" /></Field><div className="test-result"><SafetyCertificateOutlined /><div><strong>試算通過</strong><span>測試用戶「陳家朗」符合目前條件</span></div></div></> : <GenericEditor record={editing ?? undefined} onSave={save} />}
    </FormDrawer>
    <ConfirmDialog open={confirm} title="停用所選記錄？" message={`停用後將不再出現在新記錄的可選清單，共影響 ${selected.length} 筆。`} danger confirmLabel="確認停用" onCancel={() => setConfirm(false)} onConfirm={disableSelected} />
  </div>;
}

export function WorkListPage() {
  const { works } = useDemo(); const navigate = useNavigate();
  const [search, setSearch] = useState(""); const [status, setStatus] = useState("全部狀態"); const [sla, setSla] = useState("全部 SLA"); const [selected, setSelected] = useState<string[]>([]);
  const rows = works.filter((work) => (!search || `${work.id}${work.title}${work.address}`.toLowerCase().includes(search.toLowerCase())) && (status === "全部狀態" || work.status === status) && (sla === "全部 SLA" || work.sla === sla));
  const columns: Column<Work>[] = [
    { key: "id", title: "工作編號", width: 166, sortable: true, render: (work) => <a>{work.id}</a> },
    { key: "title", title: "工作摘要", width: 260, render: (work) => <div className="cell-main"><strong>{work.title}</strong><span>{work.address}</span></div> },
    { key: "type", title: "工作類型", width: 170 }, { key: "priority", title: "優先級", width: 92, render: (work) => <StatusTag>{work.priority}</StatusTag> },
    { key: "status", title: "狀態", width: 98, render: (work) => <StatusTag>{work.status}</StatusTag> }, { key: "group", title: "執行群組", width: 170 },
    { key: "sla", title: "服務承諾", width: 110, render: (work) => <StatusTag>{work.sla}</StatusTag> }, { key: "updatedAt", title: "最後更新", width: 164, sortable: true },
  ];
  return <div className="page-content"><PageHeader title="工作管理" description="統一管理工作分派、跟進、解決、驗收及服務承諾" actions={<><Button icon={<ExportOutlined />}>匯出</Button><Button variant="primary" icon={<PlusOutlined />} onClick={() => navigate("/works/new")}>新增工作</Button></>} />
    <section className="panel list-panel"><FilterBar search={search} onSearch={setSearch} onReset={() => { setSearch(""); setStatus("全部狀態"); setSla("全部 SLA"); }} onAdvanced={() => undefined}>
      <Select value={status} onChange={setStatus}><option>全部狀態</option><option>新建</option><option>跟進中</option><option>已解決</option><option>已關閉</option></Select>
      <Select value={sla} onChange={setSla}><option>全部 SLA</option><option>正常</option><option>將逾時</option><option>已逾時</option></Select>
      <Select value="全部群組" onChange={() => undefined}><option>全部群組</option><option>公園設施維護組</option><option>綠化養護組</option></Select>
    </FilterBar>{selected.length > 0 && <div className="batch-bar"><strong>已選 {selected.length} 筆工作</strong><Button icon={<SwapOutlined />}>批量重新分派</Button><Button icon={<ExportOutlined />}>匯出所選</Button></div>}
    <DenseTable rows={rows} columns={columns} selected={selected} onSelected={setSelected} onRowClick={(work) => navigate(`/works/${work.id}`)} /><Pagination total={rows.length} /></section>
  </div>;
}

const actionTarget: Record<string, WorkStatus> = { "跟進": "跟進中", "解決": "已解決", "關閉": "已關閉", "重啟": "新建" };

export function WorkDetailPage() {
  const { id = "" } = useParams(); const navigate = useNavigate(); const { works, updateWorkStatus, updateWork } = useDemo(); const { showToast } = useToast();
  const work = works.find((item) => item.id === id) ?? works[0];
  const [action, setAction] = useState<string | null>(null); const [tab, setTab] = useState("處理記錄"); const [confirmVoid, setConfirmVoid] = useState(false);
  const actions = work.status === "新建" ? ["跟進", "重新分派", "留言"] : work.status === "跟進中" ? ["解決", "重新分派", "留言"] : work.status === "已解決" ? ["關閉", "重啟", "留言"] : ["重啟", "留言"];
  const submitAction = () => {
    if (action && actionTarget[action]) updateWorkStatus(work.id, actionTarget[action]);
    if (action === "重新分派") updateWork(work.id, { group: "環境衛生執行組", status: "新建" });
    showToast(`${action}操作已提交`); setAction(null);
  };
  const timeline = [
    { title: work.status, time: work.updatedAt, text: work.status === "已解決" ? "何浩然提交處理說明及 2 個附件" : "陳家朗更新了工作狀態", tone: "success" as const },
    { title: "開始跟進", time: "2026-09-29 09:46", text: "執行人員：何浩然；操作位置距工作地點 18 米", tone: "info" as const },
    { title: "自動分派", time: "2026-09-29 09:19", text: `命中規則「公園設施／花地瑪堂」並分派至 ${work.group}` },
    { title: "建立工作", time: work.createdAt, text: `由${work.source}建立；關聯事件 ${work.eventId ?? "—"}` },
  ];
  return <div className="page-content detail-page"><PageHeader eyebrow="工作管理 / 工作詳情" title={work.title} description={`${work.id} · 建立於 ${work.createdAt}`} actions={<><Button icon={<ArrowLeftOutlined />} onClick={() => navigate("/works")}>返回列表</Button>{actions.map((label, index) => <Button key={label} variant={index === 0 ? "primary" : "default"} icon={label === "關閉" ? <CheckOutlined /> : label === "重新分派" ? <SwapOutlined /> : undefined} onClick={() => setAction(label)}>{label}</Button>)}<Button variant="danger" icon={<DeleteOutlined />} onClick={() => setConfirmVoid(true)}>作廢</Button></>} />
    <div className="status-strip"><div><span>目前狀態</span><StatusTag>{work.status}</StatusTag></div><div><span>優先級</span><StatusTag>{work.priority}</StatusTag></div><div><span>服務承諾</span><StatusTag>{work.sla}</StatusTag></div><div><span>執行群組</span><strong>{work.group}</strong></div><div><span>網格</span><strong>{work.grid}</strong></div></div>
    <div className="detail-layout"><main>
      <section className="panel info-panel"><header><h2>基本資料</h2><Button variant="text" icon={<EditOutlined />}>編輯</Button></header><dl className="description-grid"><div><dt>工作類型</dt><dd>{work.type}</dd></div><div><dt>來源</dt><dd>{work.source}</dd></div><div className="wide"><dt>地址</dt><dd>{work.address}</dd></div><div className="wide"><dt>問題描述</dt><dd>{work.description}</dd></div></dl></section>
      <section className="panel tab-panel"><nav>{["處理記錄", "留言", "附件", "關聯記錄"].map((item) => <button key={item} className={tab === item ? "active" : ""} onClick={() => setTab(item)}>{item}{item === "附件" && <span>3</span>}</button>)}</nav><div className="tab-content">
        {tab === "處理記錄" && <ActivityTimeline items={timeline} />}{tab === "留言" && <div className="comment-compose"><textarea placeholder="輸入留言內容" rows={4} /><div><Button icon={<PaperClipOutlined />}>加入附件</Button><Button variant="primary" icon={<SendOutlined />}>發送留言</Button></div></div>}{tab === "附件" && <AttachmentViewer />}{tab === "關聯記錄" && <div className="related-grid"><Link to={`/plans/${work.planId ?? "PL-20260929-0003"}`}><FileDoneOutlined /><span>巡查計劃<strong>{work.planId ?? "PL-20260929-0003"}</strong></span></Link><Link to="/events"><ExclamationCircleFilled /><span>事件<strong>{work.eventId ?? "EV-20260929-0006"}</strong></span></Link></div>}
      </div></section>
    </main><aside><section className="panel location-panel"><header><h2>位置與操作軌跡</h2></header><MapSplitView toolbar={false} /><div className="location-address"><EnvironmentOutlined /><span>{work.address}<small>最近操作位置：18 米</small></span></div></section><section className="panel sla-panel"><header><h2>服務承諾</h2></header><div className="sla-count"><strong>{work.sla === "已逾時" ? "已逾時 2小時 18分" : "剩餘 42 分鐘"}</strong><StatusTag>{work.sla}</StatusTag></div><div className="sla-track"><i style={{ width: work.sla === "已逾時" ? "100%" : "82%" }} /></div><dl><div><dt>首次回覆</dt><dd>已達標</dd></div><div><dt>解決時限</dt><dd>4 小時</dd></div><div><dt>完成時限</dt><dd>8 小時</dd></div></dl></section></aside></div>
    <FormDrawer open={!!action} title={`${action ?? ""}工作`} subtitle={work.id} onClose={() => setAction(null)} onSubmit={submitAction} submitLabel={`確認${action ?? ""}`}><div className="action-summary"><ToolOutlined /><div><strong>{work.title}</strong><span>{work.status} → {action ? actionTarget[action] ?? work.status : work.status}</span></div></div><div className="form-grid">{action === "重新分派" && <Field label="新執行群組" required><Select value="環境衛生執行組" onChange={() => undefined}><option>環境衛生執行組</option><option>綠化養護組</option></Select></Field>}<Field label={action === "關閉" ? "驗收意見" : action === "重啟" ? "重啟原因" : action === "解決" ? "處理說明" : "備註"} required={action !== "跟進"}><textarea rows={5} placeholder="請輸入操作說明" defaultValue={action === "解決" ? "已完成現場維修及安全檢查。" : ""} /></Field>{action === "解決" && <Field label="附件" required><div className="mini-upload"><CloudUploadOutlined />上傳處理相片（最少 2 張）</div></Field>}</div></FormDrawer>
    <ConfirmDialog open={confirmVoid} title="作廢此工作？" message="作廢後不計入統計，但所有處理記錄仍會保留。請確認已取得相應權限。" danger confirmLabel="確認作廢" onCancel={() => setConfirmVoid(false)} onConfirm={() => { updateWork(work.id, { voided: true }); setConfirmVoid(false); showToast("工作已作廢"); }} />
  </div>;
}

export function WorkCreatePage() {
  const navigate = useNavigate(); const { addWork, works } = useDemo(); const { showToast } = useToast(); const [duplicate, setDuplicate] = useState(false);
  const [form, setForm] = useState<{ title: string; type: string; priority: Work["priority"]; address: string; group: string; description: string }>({ title: "公園座椅扶手鬆動", type: "公共設施／座椅", priority: "一般", address: "黑沙環公園近休憩亭", group: "公園設施維護組", description: "巡查期間發現扶手鬆動。" });
  const submit = () => setDuplicate(true);
  const create = () => { const id = `WK-20260929-${String(works.length + 13).padStart(4, "0")}`; addWork({ id, ...form, source: "獨立", status: "新建", grid: "花地瑪堂北區", sla: "正常", createdAt: "2026-09-29 12:06", updatedAt: "2026-09-29 12:06" }); showToast("工作已建立並完成自動分派"); navigate(`/works/${id}`); };
  return <div className="page-content form-page"><PageHeader eyebrow="工作管理 / 新增工作" title="新增工作" description="系統將按對象、網格及工作類型自動計算執行群組" actions={<><Button onClick={() => navigate("/works")}>取消</Button><Button variant="primary" icon={<CheckOutlined />} onClick={submit}>建立工作</Button></>} />
    <div className="form-layout"><main><section className="panel form-section"><header><h2>工作資料</h2><span>標示 * 為必填</span></header><div className="form-grid two-col">
      <Field label="來源"><input value="獨立建立" disabled /></Field><Field label="優先級" required><Select value={form.priority} onChange={(value) => setForm({ ...form, priority: value as Work["priority"] })}><option>一般</option><option>緊急</option><option>特急</option></Select></Field>
      <Field label="工作摘要" required><input value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} /></Field><Field label="工作類型" required><Select value={form.type} onChange={(value) => setForm({ ...form, type: value })}><option>公共設施／座椅</option><option>綠化／樹木</option><option>環境衛生／收集設施</option></Select></Field>
      <Field label="描述"><textarea rows={5} value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} /></Field>
    </div></section><section className="panel form-section"><header><h2>位置與分派</h2></header><div className="form-grid two-col"><Field label="地址" required><input value={form.address} onChange={(event) => setForm({ ...form, address: event.target.value })} /></Field><Field label="所屬網格"><input value="花地瑪堂北區" disabled /></Field><Field label="執行群組" required hint="按對象負責群組規則自動選取"><Select value={form.group} onChange={(value) => setForm({ ...form, group: value })}><option>公園設施維護組</option><option>環境衛生執行組</option></Select></Field><Field label="附件"><div className="mini-upload"><CloudUploadOutlined />上傳相片或文件</div></Field></div></section></main><aside><MapSplitView toolbar={false}/><div className="assignment-card"><ThunderboltOutlined /><div><span>自動分派結果</span><strong>{form.group}</strong><small>命中：對象負責群組優先規則</small></div></div></aside></div>
    <ConfirmDialog open={duplicate} title="發現疑似重複工作" message="30 米內有一宗相同類型的未關閉工作 WK-20260929-0012。仍要建立新工作嗎？" confirmLabel="仍然新增" onCancel={() => { setDuplicate(false); navigate("/works/WK-20260929-0012"); }} onConfirm={create} />
  </div>;
}

export function PlanListPage() {
  const { plans } = useDemo(); const navigate = useNavigate(); const [search, setSearch] = useState(""); const [status, setStatus] = useState("全部狀態");
  const rows = plans.filter((plan) => (!search || `${plan.id}${plan.name}`.includes(search)) && (status === "全部狀態" || plan.status === status));
  const columns: Column<Plan>[] = [
    { key: "id", title: "計劃編號", width: 164, render: (plan) => <a>{plan.id}</a> }, { key: "name", title: "計劃名稱", width: 250 }, { key: "template", title: "計劃模板", width: 190 },
    { key: "group", title: "巡查群組", width: 160 }, { key: "startAt", title: "開始時間", width: 156 }, { key: "status", title: "狀態", width: 96, render: (plan) => <StatusTag>{plan.status}</StatusTag> },
    { key: "progress", title: "完成進度", width: 170, render: (plan) => <div className="table-progress"><div><i style={{ width: `${plan.total ? plan.progress / plan.total * 100 : 0}%` }} /></div><span>{plan.progress}/{plan.total}</span></div> },
  ];
  return <div className="page-content"><PageHeader title="巡查計劃" description="建立、指派及追蹤巡查計劃與作業進度" actions={<><Button icon={<ExportOutlined />}>匯出</Button><Button variant="primary" icon={<PlusOutlined />} onClick={() => navigate("/plans/new")}>新增計劃</Button></>} /><section className="panel list-panel"><FilterBar search={search} onSearch={setSearch} onReset={() => { setSearch(""); setStatus("全部狀態"); }}><Select value={status} onChange={setStatus}><option>全部狀態</option><option>未開始</option><option>進行中</option><option>已中止</option><option>已完成</option></Select><Select value="本週" onChange={() => undefined}><option>本週</option><option>今日</option><option>本月</option></Select></FilterBar><DenseTable rows={rows} columns={columns} onRowClick={(plan) => navigate(`/plans/${plan.id}`)} /><Pagination total={rows.length} /></section></div>;
}

export function PlanDetailPage() {
  const { id = "" } = useParams(); const { plans } = useDemo(); const { showToast } = useToast(); const [tab, setTab] = useState("巡查"); const [locked, setLocked] = useState(false);
  const plan = plans.find((item) => item.id === id) ?? plans[0];
  const inspections = makeRecords("IN", ["黑沙環公園東門", "兒童遊樂區", "中央花圃", "休憩亭", "公園洗手間"]);
  return <div className="page-content detail-page"><PageHeader eyebrow="巡查計劃 / 計劃詳情" title={plan.name} description={`${plan.id} · ${plan.startAt} 至 ${plan.endAt}`} actions={<><Button icon={<EditOutlined />}>編輯</Button><Button icon={<PlusOutlined />}>加入巡查</Button><Button variant="primary" icon={<LockOutlined />} onClick={() => setLocked(true)}>強制中止</Button></>} />
    <div className="status-strip"><div><span>狀態</span><StatusTag>{plan.status}</StatusTag></div><div><span>巡查群組</span><strong>{plan.group}</strong></div><div><span>目前執行人</span><strong>{plan.executor ?? "尚未開始"}</strong></div><div><span>完成進度</span><strong>{plan.progress} / {plan.total}</strong></div><div><span>所屬網格</span><strong>{plan.grid}</strong></div></div>
    <section className="panel plan-map-panel"><MapSplitView><div className="map-side-head"><div><h2>路線內對象</h2><span>共 {plan.total} 個巡查</span></div><FilterOutlined /></div><div className="object-list">{inspections.map((item, index) => <Link to="/inspections/IN-20260929-0024" key={item.id}><span className={`object-index ${index < plan.progress ? "done" : index === plan.progress ? "active" : ""}`}>{index < plan.progress ? <CheckOutlined /> : index + 1}</span><div><strong>{item.name}</strong><span>{index < plan.progress ? "已完成 · 09:32" : index === plan.progress ? "巡查中" : "未開始"}</span></div>{index === 2 && <StatusTag>異常</StatusTag>}</Link>)}</div></MapSplitView></section>
    <section className="panel tab-panel"><nav>{["巡查", "事件", "工作", "作業記錄"].map((item) => <button className={tab === item ? "active" : ""} key={item} onClick={() => setTab(item)}>{item}</button>)}</nav><div className="tab-content compact"><ActivityTimeline items={[{ title: "開始作業", time: "2026-09-29 08:36", text: "陳家朗取得作業鎖並開始執行計劃", tone: "info" }, { title: "完成巡查 IN-20260929-0023", time: "09:32", text: "兒童遊樂區發現 1 個異常項目" }, { title: "建立工作 WK-20260929-0012", time: "09:18", text: "由異常巡查項目建立並自動分派" }]} /></div></section>
    <ConfirmDialog open={locked} title="強制中止進行中的計劃？" message={`目前由 ${plan.executor ?? "其他人員"} 執行。強制中止會立即釋放作業鎖，請確認已與前線人員協調。`} danger confirmLabel="強制中止" onCancel={() => setLocked(false)} onConfirm={() => { setLocked(false); showToast("計劃已強制中止"); }} />
  </div>;
}

export function PlanFormPage() {
  const { addPlan, plans } = useDemo(); const navigate = useNavigate(); const { showToast } = useToast();
  const create = () => { const plan: Plan = { id: `PL-20260929-${String(plans.length + 5).padStart(4, "0")}`, name: "南灣湖設施巡查", template: "中區步行路線", group: "中區巡查組", status: "未開始", startAt: "2026-09-30 09:00", endAt: "2026-09-30 12:00", progress: 0, total: 14, grid: "大堂南區" }; addPlan(plan); showToast("計劃已建立，並產生 14 個巡查"); navigate(`/plans/${plan.id}`); };
  return <div className="page-content form-page"><PageHeader eyebrow="巡查計劃 / 新增計劃" title="新增巡查計劃" description="選擇模板後，系統會預覽路線並產生對象 × 模板巡查清單" actions={<><Button onClick={() => navigate("/plans")}>取消</Button><Button variant="primary" icon={<CheckOutlined />} onClick={create}>建立計劃</Button></>} />
    <div className="plan-create-grid"><section className="panel form-section"><header><h2>計劃設定</h2></header><div className="form-grid two-col"><Field label="計劃名稱" required><input defaultValue="南灣湖設施巡查" /></Field><Field label="計劃模板" required><Select value="中區步行路線" onChange={() => undefined}><option>中區步行路線</option><option>公園設施巡查路線 A</option></Select></Field><Field label="開始時間" required><input type="datetime-local" defaultValue="2026-09-30T09:00" /></Field><Field label="結束時間" required><input type="datetime-local" defaultValue="2026-09-30T12:00" /></Field><Field label="巡查群組" required><Select value="中區巡查組" onChange={() => undefined}><option>中區巡查組</option><option>北區巡查一組</option></Select></Field><Field label="預設巡查人員"><Select value="梁嘉敏" onChange={() => undefined}><option>梁嘉敏</option><option>陳家朗</option></Select></Field><Field label="備註"><textarea rows={4} placeholder="選填" /></Field></div></section><section className="panel preview-panel"><header><div><h2>路線及巡查預覽</h2><p>將產生 14 個巡查</p></div><StatusTag>14 個對象</StatusTag></header><MapSplitView toolbar={false}/><div className="preview-summary"><span><b>8.4 km</b>預計路線</span><span><b>3 小時</b>預計時長</span><span><b>14</b>巡查項目</span></div></section></div>
  </div>;
}

export function InspectionDetailPage() {
  const navigate = useNavigate(); const { showToast } = useToast(); const [supplement, setSupplement] = useState(false);
  const items = [{ name: "座椅穩固狀態", result: "否", abnormal: true, note: "左側固定螺絲鬆脫" }, { name: "座椅表面清潔", result: "正常", abnormal: false }, { name: "周邊地面狀態", result: "正常", abnormal: false }, { name: "照明設施", result: "正常", abnormal: false }];
  return <div className="page-content detail-page"><PageHeader eyebrow="巡查記錄 / 詳情" title="黑沙環公園 · 兒童遊樂區" description="IN-20260929-0024 · 公園設施標準巡查表" actions={<><Button icon={<ArrowLeftOutlined />} onClick={() => navigate(-1)}>返回</Button><Button icon={<PlusOutlined />} onClick={() => setSupplement(true)}>補錄</Button><Button variant="primary" icon={<ToolOutlined />} onClick={() => navigate("/works/new")}>建立工作</Button></>} />
    <div className="status-strip"><div><span>狀態</span><StatusTag>已完成</StatusTag></div><div><span>巡查人員</span><strong>陳家朗</strong></div><div><span>提交時間</span><strong>2026-09-29 09:16</strong></div><div><span>定位校驗</span><StatusTag>通過</StatusTag></div><div><span>距離／精度</span><strong>18m / 8m</strong></div></div>
    <div className="inspection-layout"><main><section className="panel inspection-sheet"><header><div><h2>巡查項目結果</h2><p>共 4 項 · 1 項異常</p></div><StatusTag tone="danger">發現異常</StatusTag></header>{items.map((item, index) => <article className={item.abnormal ? "abnormal" : ""} key={item.name}><div className="inspection-index">{String(index + 1).padStart(2, "0")}</div><div><strong>{item.name}</strong><span>上次巡查：2026-09-22 · 正常</span>{item.note && <p>{item.note}</p>}</div><StatusTag tone={item.abnormal ? "danger" : "success"}>{item.result}</StatusTag>{item.abnormal && <Button variant="primary" onClick={() => navigate("/works/WK-20260929-0012")}>查看工作</Button>}</article>)}</section><section className="panel"><header className="section-header"><h2>附件與簽名</h2></header><AttachmentViewer /></section></main><aside><section className="panel location-panel"><header><h2>提交位置</h2></header><MapSplitView toolbar={false}/><div className="location-address"><EnvironmentOutlined /><span>黑沙環公園近兒童遊樂區<small>定位校驗通過 · 距對象 18 米</small></span></div></section><section className="panel change-log"><header><h2>變更記錄</h2></header><ActivityTimeline items={[{ title: "提交巡查", time: "09:16", text: "陳家朗提交巡查結果" }, { title: "開始填寫", time: "09:08", text: "定位校驗通過" }]} /></section></aside></div>
    <FormDrawer open={supplement} title="補錄巡查資料" subtitle="IN-20260929-0024" onClose={() => setSupplement(false)} onSubmit={() => { setSupplement(false); showToast("補錄資料已保存並留痕"); }}><Field label="補錄原因" required><textarea rows={4} defaultValue="補充現場整體照片" /></Field><Field label="附件"><div className="mini-upload"><CloudUploadOutlined />加入相片或文件</div></Field></FormDrawer>
  </div>;
}

export function EventListPage() {
  const { events } = useDemo(); const navigate = useNavigate(); const [search, setSearch] = useState(""); const [status, setStatus] = useState("全部狀態");
  const rows = events.filter((event) => (!search || `${event.id}${event.description}${event.address}`.includes(search)) && (status === "全部狀態" || event.status === status));
  const columns: Column<EventRecord>[] = [{ key: "id", title: "事件編號", width: 168, render: (event) => <a>{event.id}</a> }, { key: "description", title: "事件描述", width: 280 }, { key: "type", title: "事件類型", width: 190 }, { key: "status", title: "跟進狀態", width: 112, render: (event) => <StatusTag>{event.status}</StatusTag> }, { key: "grid", title: "網格", width: 150 }, { key: "createdAt", title: "建立時間", width: 170 }, { key: "workIds", title: "關聯工作", width: 100, render: (event) => event.workIds.length }];
  return <div className="page-content"><PageHeader title="事件管理" description="登記事件及其跟進狀態，並關聯後續處理工作" actions={<><Button icon={<EnvironmentOutlined />}>地圖視圖</Button><Button variant="primary" icon={<PlusOutlined />} onClick={() => navigate("/events/new")}>新增事件</Button></>} /><section className="panel list-panel"><FilterBar search={search} onSearch={setSearch} onReset={() => { setSearch(""); setStatus("全部狀態"); }}><Select value={status} onChange={setStatus}><option>全部狀態</option><option>無需跟進</option><option>跟進中</option><option>已完成</option></Select></FilterBar><DenseTable rows={rows} columns={columns} onRowClick={(event) => navigate(`/events/${event.id}`)} /><Pagination total={rows.length} /></section></div>;
}

export function EventEditorPage() {
  const { id } = useParams(); const { events, addEvent } = useDemo(); const navigate = useNavigate(); const { showToast } = useToast(); const event = events.find((item) => item.id === id);
  const save = () => { if (!event) addEvent({ id: `EV-20260929-${String(events.length + 7).padStart(4, "0")}`, type: "公共設施異常／照明", description: "公園照明燈閃爍", status: "跟進中", grid: "花地瑪堂北區", address: "黑沙環公園南側入口", createdAt: "2026-09-29 12:06", workIds: [] }); showToast(event ? "事件資料已更新" : "事件已建立"); navigate("/events"); };
  return <div className="page-content form-page"><PageHeader eyebrow="事件管理" title={event ? event.description : "新增事件"} description={event?.id ?? "填寫事件資料並選擇地圖位置"} actions={<><Button onClick={() => navigate("/events")}>取消</Button><Button variant="primary" icon={<CheckOutlined />} onClick={save}>儲存事件</Button></>} /><div className="form-layout"><main><section className="panel form-section"><header><h2>事件資料</h2></header><div className="form-grid two-col"><Field label="事件類型" required><Select value={event?.type ?? "公共設施異常／照明"} onChange={() => undefined}><option>公共設施異常／照明</option><option>綠化問題／樹木</option></Select></Field><Field label="跟進狀態" required><Select value={event?.status ?? "跟進中"} onChange={() => undefined}><option>無需跟進</option><option>跟進中</option><option>已完成</option></Select></Field><Field label="描述" required><textarea rows={5} defaultValue={event?.description ?? "公園照明燈閃爍"} /></Field><Field label="預計跟進時間" required><input type="datetime-local" defaultValue="2026-09-29T16:00" /></Field><Field label="地址" required><input defaultValue={event?.address ?? "黑沙環公園南側入口"} /></Field><Field label="所屬網格"><input disabled value={event?.grid ?? "花地瑪堂北區"} /></Field><Field label="附件"><div className="mini-upload"><CloudUploadOutlined />加入附件</div></Field></div></section></main><aside><MapSplitView toolbar={false}/>{event && <section className="panel related-box"><header><h2>關聯工作</h2></header>{event.workIds.length ? event.workIds.map((workId) => <Link to={`/works/${workId}`} key={workId}><ToolOutlined />{workId}</Link>) : <div className="mini-empty">尚未建立關聯工作</div>}<Button variant="primary" icon={<PlusOutlined />} onClick={() => navigate("/works/new")}>建立工作</Button></section>}</aside></div></div>;
}

export function TrackingPage() {
  const [type, setType] = useState("用戶軌跡"); const [queried, setQueried] = useState(true);
  return <div className="page-content tracking-page"><PageHeader title="軌跡查詢" description="按人員、巡查計劃或巡查記錄檢視定位點及最後位置" actions={<Button icon={<ExportOutlined />}>匯出軌跡</Button>} /><section className="panel track-filter"><div className="segmented">{["用戶軌跡", "巡查計劃軌跡", "巡查軌跡"].map((item) => <button key={item} className={type === item ? "active" : ""} onClick={() => setType(item)}>{item}</button>)}</div><Field label="人員"><Select value="陳家朗" onChange={() => undefined}><option>陳家朗</option><option>李芷晴</option></Select></Field><Field label="日期範圍"><input value="2026-09-29 — 2026-09-29" readOnly /></Field><label className="switch-row"><input type="checkbox" defaultChecked /><span className="switch" />過濾漂移點</label><Button variant="primary" icon={<SearchIcon />} onClick={() => setQueried(true)}>查詢</Button></section><section className="panel track-map"><MapSplitView><div className="track-summary"><header><h2>陳家朗</h2><StatusTag>在線</StatusTag></header><dl><div><dt>定位點</dt><dd>126</dd></div><div><dt>有效點</dt><dd>119</dd></div><div><dt>移動距離</dt><dd>8.4 km</dd></div><div><dt>最後位置</dt><dd>11:52</dd></div></dl><Button icon={<EnvironmentOutlined />}>定位最後位置</Button><div className="track-events"><strong>關鍵定位點</strong><span><i />09:08 開始巡查</span><span><i />09:16 提交巡查</span><span><i />09:46 開始跟進工作</span></div></div></MapSplitView>{!queried && <div className="map-empty">請先設定條件並查詢</div>}</section></div>;
}

function SearchIcon() { return <FileSearchOutlined />; }

export function NotificationPage() {
  const { notices, markNoticeRead, markAllRead } = useDemo(); const navigate = useNavigate();
  return <div className="page-content"><PageHeader title="通知中心" description="查看系統、推送、短訊及電郵通知的閱讀與投遞狀態" actions={<Button icon={<CheckOutlined />} onClick={markAllRead}>全部標為已讀</Button>} /><div className="notification-layout"><section className="panel notification-list"><header><h2>最近通知</h2><div className="segmented small"><button className="active">全部</button><button>未讀</button><button>緊急</button></div></header>{notices.map((notice) => <button className={!notice.read ? "unread" : ""} key={notice.id} onClick={() => { markNoticeRead(notice.id); navigate(notice.route); }}><span className={`notice-icon level-${notice.level}`}><BellOutlined /></span><div><strong>{notice.title}</strong><p>{notice.body}</p><time>{notice.time}</time></div><StatusTag>{notice.level}</StatusTag></button>)}</section><section className="panel delivery-panel"><header><h2>今日投遞概況</h2></header><div className="delivery-stats"><span><strong>186</strong>系統通知</span><span><strong>172</strong>推送成功</span><span><strong>24</strong>電郵成功</span><span className="danger"><strong>3</strong>發送失敗</span></div><h3>渠道成功率</h3>{[{ name: "系統", value: 100 }, { name: "App 推送", value: 96 }, { name: "短訊", value: 98 }, { name: "電郵", value: 92 }].map((item) => <div className="channel-row" key={item.name}><span>{item.name}</span><div><i style={{ width: `${item.value}%` }} /></div><b>{item.value}%</b></div>)}</section></div></div>;
}

export function ReportsDashboardPage() {
  const pie = [{ name: "已關閉", value: 62, color: "#2ba471" }, { name: "跟進中", value: 21, color: "#3b82f6" }, { name: "新建", value: 11, color: "#aab2c0" }, { name: "已逾時", value: 6, color: "#d54941" }];
  return <div className="page-content"><PageHeader title="營運報表" description="巡查、事件、工作與服務承諾的綜合統計" actions={<><Button icon={<ExportOutlined />}>匯出 PDF</Button><Button variant="primary" icon={<BarChartOutlined />}>建立自訂報表</Button></>} /><div className="report-filter"><Select value="2026 年 9 月" onChange={() => undefined}><option>2026 年 9 月</option></Select><Select value="全部網格" onChange={() => undefined}><option>全部網格</option></Select><Select value="全部群組" onChange={() => undefined}><option>全部群組</option></Select><Button variant="primary">套用</Button></div><section className="kpi-grid compact">{[{ label: "巡查完成率", value: "94.6%", meta: "較上月 +2.1%" }, { label: "工作結案率", value: "88.2%", meta: "較上月 +4.3%" }, { label: "SLA 達標率", value: "91.8%", meta: "目標 90%" }, { label: "平均處理時長", value: "5.4h", meta: "較上月 -0.8h" }].map((item) => <article className="kpi-card" key={item.label}><div><span>{item.label}</span><strong>{item.value}</strong><small>{item.meta}</small></div></article>)}</section><div className="report-grid"><section className="panel chart-panel"><header><h2>巡查與工作趨勢</h2></header><ResponsiveContainer width="100%" height={270}><BarChart data={reportTrend}><CartesianGrid strokeDasharray="3 3" stroke="#edf0f5"/><XAxis dataKey="day"/><YAxis/><Tooltip/><Legend/><Bar dataKey="plans" name="完成巡查" fill="#e60012" radius={[2,2,0,0]}/><Bar dataKey="works" name="新增工作" fill="#7799c8" radius={[2,2,0,0]}/></BarChart></ResponsiveContainer></section><section className="panel chart-panel"><header><h2>工作狀態分佈</h2></header><ResponsiveContainer width="100%" height={270}><PieChart><Pie data={pie} dataKey="value" nameKey="name" innerRadius={62} outerRadius={92} paddingAngle={2}>{pie.map((entry) => <Cell key={entry.name} fill={entry.color}/>)}</Pie><Tooltip/><Legend/></PieChart></ResponsiveContainer></section></div></div>;
}

export function ReportDesignerPage() {
  const { showToast } = useToast(); const [fields, setFields] = useState(["工作編號", "工作類型", "狀態", "執行群組"]); const all = ["工作編號", "工作摘要", "工作類型", "狀態", "優先級", "執行群組", "網格", "建立時間", "解決時間", "SLA 狀態"];
  return <div className="page-content report-designer"><PageHeader title="自訂報表設計" description="選擇資料集、欄位及呈現方式，即時預覽報表" actions={<><Button>另存副本</Button><Button variant="primary" icon={<CheckOutlined />} onClick={() => showToast("報表「工作跟進月報」已儲存")}>儲存報表</Button></>} /><div className="designer-layout"><aside className="panel field-bank"><h2>資料欄位</h2><Select value="工作" onChange={() => undefined}><option>工作</option><option>巡查計劃</option><option>事件</option></Select><div className="tree-search"><FileSearchOutlined /><input placeholder="搜尋欄位" /></div>{all.map((field) => <button className={fields.includes(field) ? "selected" : ""} key={field} onClick={() => setFields(fields.includes(field) ? fields.filter((item) => item !== field) : [...fields, field])}><span>{field}</span>{fields.includes(field) && <CheckOutlined />}</button>)}</aside><main><section className="panel report-config"><div className="form-grid two-col"><Field label="報表名稱" required><input defaultValue="工作跟進月報" /></Field><Field label="呈現方式"><Select value="表格" onChange={() => undefined}><option>表格</option><option>柱狀圖</option><option>折線圖</option><option>網格地圖</option></Select></Field></div><div className="selected-fields"><strong>顯示欄位</strong>{fields.map((field, index) => <span key={field}><b>{index + 1}</b>{field}<button onClick={() => setFields(fields.filter((item) => item !== field))}>×</button></span>)}</div><RuleBuilder /></section><section className="panel report-preview"><header><h2>即時預覽</h2><span>依示範資料顯示首 5 筆</span></header><DenseTable rows={makeRecords("WK", ["公園座椅螺絲鬆脫", "樹枝阻礙通行", "垃圾站圍板破損", "灌溉水管滲漏", "指示牌字樣褪色"])} columns={[{ key: "code", title: "工作編號" }, { key: "name", title: "工作摘要" }, { key: "category", title: "工作類型" }, { key: "status", title: "狀態", render: (row) => <StatusTag>{row.status}</StatusTag> }, { key: "owner", title: "執行群組" }]} /></section></main></div></div>;
}

export function ImportPage() {
  return <div className="page-content"><PageHeader title="資料匯入" description="下載範本、上傳 Excel 並在確認前完成格式與邏輯驗證" actions={<Button icon={<CloudUploadOutlined />}>下載匯入範本</Button>} /><section className="panel import-page"><div className="import-type"><Field label="資料類型"><Select value="對象" onChange={() => undefined}><option>對象</option><option>群組及成員</option><option>巡查項目</option><option>NFC 標籤</option></Select></Field><div><strong>匯入規則</strong><span>單一交易匯入；任何一筆失敗將整批回滾</span></div></div><ImportWizard /></section></div>;
}

export function DevicePage() {
  const [search, setSearch] = useState(""); const [selected, setSelected] = useState<GenericRecord | null>(null); const [wipe, setWipe] = useState(false); const { showToast } = useToast();
  const rows = makeRecords("DEV", ["Samsung Galaxy XCover 7", "Samsung Galaxy A55", "Pixel 10 Pro", "Samsung Galaxy XCover 6"]);
  const columns: Column<GenericRecord>[] = [{ key: "code", title: "裝置編號", width: 145, render: (row) => <a>{row.code}</a> }, { key: "name", title: "型號", width: 210 }, { key: "category", title: "系統版本", width: 130, render: () => "Android 15" }, { key: "owner", title: "最後使用者", width: 150 }, { key: "updatedAt", title: "最後在線", width: 170 }, { key: "status", title: "狀態", width: 100, render: (row) => <StatusTag>{row.status}</StatusTag> }];
  return <div className="page-content"><PageHeader title="裝置管理" description="查看裝置心跳、遠程鎖定、擦除及異常日誌" actions={<Button icon={<ExportOutlined />}>匯出裝置</Button>} /><section className="panel list-panel"><FilterBar search={search} onSearch={setSearch} onReset={() => setSearch("")}><Select value="全部狀態" onChange={() => undefined}><option>全部狀態</option><option>正常</option><option>已鎖定</option></Select></FilterBar><DenseTable rows={rows.filter((row) => row.name.includes(search) || row.code.includes(search))} columns={columns} onRowClick={setSelected} /><Pagination total={rows.length} /></section><FormDrawer open={!!selected} title="裝置詳情" subtitle={selected?.code} onClose={() => setSelected(null)}><dl className="detail-list"><div><dt>裝置型號</dt><dd>{selected?.name}</dd></div><div><dt>系統／應用版本</dt><dd>Android 15 / 2.4.0</dd></div><div><dt>最後使用者</dt><dd>{selected?.owner}</dd></div><div><dt>最後在線</dt><dd>{selected?.updatedAt}</dd></div></dl><div className="danger-zone"><strong>裝置控制</strong><Button icon={<LockOutlined />} onClick={() => showToast("鎖定指令已下發")}>遠程鎖定</Button><Button variant="danger" icon={<DeleteOutlined />} onClick={() => setWipe(true)}>遠程擦除</Button></div></FormDrawer><ConfirmDialog open={wipe} title="遠程擦除此裝置？" message={`此操作不可撤回。裝置下次連線後會清除本地資料、附件與日誌。目標：${selected?.code}`} danger confirmLabel="確認擦除" onCancel={() => setWipe(false)} onConfirm={() => { setWipe(false); setSelected(null); showToast("擦除指令已排程"); }} /></div>;
}

export function LogPage() {
  const [search, setSearch] = useState(""); const [detail, setDetail] = useState<GenericRecord | null>(null);
  const rows = makeRecords("LOG", ["更新工作狀態", "建立巡查計劃", "修改群組成員", "接口推送失敗", "服務承諾掃描完成", "遠程鎖定裝置"]);
  const columns: Column<GenericRecord>[] = [{ key: "updatedAt", title: "時間", width: 170 }, { key: "category", title: "日誌類型", width: 130 }, { key: "name", title: "操作", width: 230 }, { key: "code", title: "對象 ID", width: 150 }, { key: "owner", title: "操作人／調用方", width: 170 }, { key: "status", title: "結果", width: 100, render: (row) => <StatusTag>{row.status}</StatusTag> }];
  return <div className="page-content"><PageHeader title="日誌查詢" description="查詢業務操作、系統異常、接口調用及背景任務記錄" actions={<Button icon={<ExportOutlined />}>匯出日誌</Button>} /><section className="panel list-panel"><FilterBar search={search} onSearch={setSearch} onReset={() => setSearch("")}><Select value="業務操作" onChange={() => undefined}><option>業務操作</option><option>系統異常</option><option>接口調用</option><option>系統任務</option></Select><input className="date-filter" value="2026-09-01 — 2026-09-29" readOnly /></FilterBar><DenseTable rows={rows.filter((row) => row.name.includes(search) || row.code.includes(search))} columns={columns} onRowClick={setDetail} /><Pagination total={rows.length}/></section><FormDrawer open={!!detail} title="日誌詳情" subtitle={detail?.code} onClose={() => setDetail(null)}><dl className="detail-list"><div><dt>操作</dt><dd>{detail?.name}</dd></div><div><dt>操作人</dt><dd>{detail?.owner}</dd></div><div><dt>時間</dt><dd>{detail?.updatedAt}</dd></div><div><dt>IP</dt><dd>10.28.16.42</dd></div></dl><div className="diff-view"><div><strong>變更前</strong><pre>{`{\n  "status": "新建",\n  "group": "公園設施維護組"\n}`}</pre></div><div><strong>變更後</strong><pre>{`{\n  "status": "跟進中",\n  "group": "公園設施維護組"\n}`}</pre></div></div></FormDrawer></div>;
}

export function IntegrationCenterPage() {
  const { showToast } = useToast(); const [tab, setTab] = useState("第三方系統"); const [token, setToken] = useState(false);
  const tabs = ["第三方系統", "事件訂閱", "市容類型映射", "通報紀錄"];
  return <div className="page-content"><PageHeader title="整合中心" description="管理第三方服務賬號、事件訂閱及跨部門市容通報" actions={<Button variant="primary" icon={<PlusOutlined />}>新增第三方系統</Button>} /><section className="panel tab-panel integration-panel"><nav>{tabs.map((item) => <button key={item} className={tab === item ? "active" : ""} onClick={() => setTab(item)}>{item}</button>)}</nav><div className="tab-content">
    {tab === "第三方系統" && <DenseTable rows={genericDatasets.thirdParties} columns={[{ key: "code", title: "系統編號", width: 150 }, { key: "name", title: "系統名稱", width: 280 }, { key: "owner", title: "負責部門", width: 170 }, { key: "updatedAt", title: "Token 到期日", width: 170 }, { key: "status", title: "狀態", width: 100, render: (row) => <StatusTag>{row.status}</StatusTag> }, { key: "note", title: "操作", render: () => <Button variant="text" onClick={() => setToken(true)}>重新產生 Token</Button> }]} />}
    {tab === "事件訂閱" && <RuleBuilder/>}{tab === "市容類型映射" && <DenseTable rows={genericDatasets.workTypes} columns={[{ key: "name", title: "本系統工作類型" }, { key: "category", title: "平台通報類型" }, { key: "note", title: "確認方式", render: () => "建立時需確認" }, { key: "status", title: "狀態", render: (row) => <StatusTag>{row.status}</StatusTag> }]} />}{tab === "通報紀錄" && <DenseTable rows={makeRecords("CITY", ["每日定時通報批次", "工作 WK-20260929-0012", "工作 WK-20260928-0096", "工作 WK-20260927-0064"])} columns={[{ key: "code", title: "通報編號" }, { key: "name", title: "內容" }, { key: "updatedAt", title: "通報時間" }, { key: "status", title: "結果", render: (row) => <StatusTag>{row.status}</StatusTag> }, { key: "note", title: "備註" }]} />}
  </div></section><ConfirmDialog open={token} title="重新產生 Token？" message="舊 Token 將即時失效。新 Token 只會顯示一次，請妥善保存。" confirmLabel="產生新 Token" onCancel={() => setToken(false)} onConfirm={() => { setToken(false); showToast("新 Token 已產生並複製"); }} /></div>;
}

export function SimpleSettingsPage({ title, description, kind }: { title: string; description: string; kind: "params" | "versions" | "duplicates" | "sla" | "exports" }) {
  const { showToast } = useToast(); const [saved, setSaved] = useState(false);
  const content: Record<string, ReactNode> = {
    params: <div className="settings-groups"><section><h3>作業與定位</h3><Field label="自動定位間隔（秒）"><input type="number" defaultValue="180" /></Field><Field label="作業鎖逾時（小時）"><input type="number" defaultValue="12" /></Field><Field label="會話超時（分鐘）"><input type="number" defaultValue="30" /></Field></section><section><h3>附件限制</h3><Field label="單檔上限（MB）"><input type="number" defaultValue="20" /></Field><Field label="圖片壓縮目標（KB）"><input type="number" defaultValue="500" /></Field><Field label="影片最長秒數"><input type="number" defaultValue="20" /></Field></section></div>,
    versions: <DenseTable rows={genericDatasets.appVersions} columns={[{ key: "name", title: "版本名稱" }, { key: "code", title: "版本編號" }, { key: "category", title: "更新類型", render: (_, ) => "推薦更新" }, { key: "updatedAt", title: "發佈時間" }, { key: "status", title: "狀態", render: (row) => <StatusTag>{row.status}</StatusTag> }]} />,
    duplicates: <div className="duplicate-board"><div><h3>候選主工作</h3><article><input type="radio" defaultChecked/><div><strong>WK-20260929-0012</strong><span>公園座椅固定螺絲鬆脫 · 18 米</span></div><StatusTag>跟進中</StatusTag></article></div><div className="merge-arrow"><SwapOutlined/><span>合併後共享主工作時間線</span></div><div><h3>被合併工作</h3><article><input type="checkbox" defaultChecked/><div><strong>WK-20260929-0014</strong><span>兒童區座椅零件鬆脫 · 26 米</span></div><StatusTag>新建</StatusTag></article></div></div>,
    sla: <div className="settings-groups"><section><h3>市政設施標準承諾</h3><Field label="分派時限（小時）"><input type="number" defaultValue="1"/></Field><Field label="初覆時限（小時）"><input type="number" defaultValue="2"/></Field><Field label="解決時限（小時）"><input type="number" defaultValue="4"/></Field><Field label="完成時限（小時）"><input type="number" defaultValue="8"/></Field></section><section><h3>提醒設定</h3><Field label="將逾時提醒比例"><input type="number" defaultValue="20"/></Field><Field label="計時日曆"><Select value="全日計" onChange={() => undefined}><option>全日計</option><option>只計辦公時間（待確認）</option></Select></Field></section></div>,
    exports: <div className="export-center"><section><FileDoneOutlined/><div><strong>工作處理報告批量匯出</strong><span>已完成 · 24 個 PDF · 18.2 MB</span></div><Button>下載</Button></section><section><ClockCircleOutlined/><div><strong>巡查記錄 Excel 匯出</strong><span>處理中 · 68%</span></div><StatusTag>處理中</StatusTag></section><section><CloseCircleOutlined/><div><strong>事件附件打包</strong><span>失敗 · 1 個附件無法讀取</span></div><Button>重試</Button></section></div>,
  };
  return <div className="page-content"><PageHeader title={title} description={description} actions={<Button variant="primary" icon={<CheckOutlined />} onClick={() => { setSaved(true); showToast("設定已儲存並記錄操作日誌"); }}>儲存變更</Button>} /><section className="panel settings-page">{saved && <div className="inline-success"><CheckOutlined />變更已保存，App 相關參數將於下次心跳時更新。</div>}{content[kind]}</section></div>;
}

export function NotFoundPage() { return <div className="page-content center-state"><WarningFilled/><h1>找不到頁面</h1><p>此路由尚未配置，請從左側選單重新進入。</p><Link to="/workbench" className="btn btn-primary">返回工作台</Link></div>; }
