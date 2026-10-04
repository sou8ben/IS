import { useMemo, useState, type ReactNode } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  AppstoreOutlined, ArrowLeftOutlined, BarChartOutlined, BellOutlined, CheckOutlined,
  ClockCircleOutlined, CloseCircleOutlined, CloudUploadOutlined, DeleteOutlined,
  EditOutlined, EnvironmentOutlined, ExclamationCircleFilled, ExportOutlined,
  FileDoneOutlined, FileSearchOutlined, FormOutlined, ImportOutlined,
  LockOutlined, PaperClipOutlined, PlusOutlined, ReloadOutlined, SafetyCertificateOutlined, SendOutlined,
  SettingOutlined, SwapOutlined, TeamOutlined, ThunderboltOutlined, ToolOutlined,
  UserOutlined, WarningFilled,
} from "@ant-design/icons";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { genericDatasets, makeRecords, reportTrend } from "./data";
import { itemCatalog } from "./inspection-templates";
import { useDemo } from "./store";
import { usePermissionRules } from "./permission-store";
import { workPolicyObject } from "./permission-rules";
import type { Column, EventRecord, GenericRecord, Work, WorkStatus } from "./types";
import {
  ActivityTimeline, AttachmentViewer, Button, ConfirmDialog, DenseTable, Field, FilterBar,
  FormDrawer, GenericEditor, GroupEditor, ImportWizard, MapSplitView, PageHeader, Pagination, RuleBuilder,
  RoleEditor, Select, StatusTag, TreePanel, UserEditor, useToast,
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
        {[{ label: "新增計劃", path: "/plans/new", icon: <FileDoneOutlined /> }, { label: "新增事件", path: "/events/new", icon: <ExclamationCircleFilled /> }, { label: "新增工作", path: "/works/new", icon: <ToolOutlined /> }, { label: "匯入資料", path: "/reports/import", icon: <ImportOutlined /> }, { label: "自訂報表", path: "/reports/designer", icon: <BarChartOutlined /> }, { label: "系統日誌", path: "/system/logs", icon: <FileSearchOutlined /> }].map((item) => <button key={item.label} onClick={() => navigate(item.path)}>{item.icon}<span>{item.label}</span></button>)}
      </div></section>
    </div>
  </div>;
}

interface GenericListPageProps { title: string; description: string; dataset: keyof typeof genericDatasets; eyebrow?: string; tree?: string[]; editor?: "generic" | "rule"; primaryLabel?: string; }

interface UserFilterValues {
  name: string;
  login: string;
  mobile: string;
  phone: string;
  email: string;
  euid: string;
  municipal: "" | "是" | "否";
  status: "" | "生效" | "失效";
}

interface GroupFilterValues { code: string; name: string; owner: string; }
interface RoleFilterValues { code: string; name: string; status: "" | "生效" | "失效"; }

const emptyUserFilters: UserFilterValues = {
  name: "", login: "", mobile: "", phone: "", email: "", euid: "", municipal: "", status: "",
};

const emptyGroupFilters: GroupFilterValues = { code: "", name: "", owner: "" };
const emptyRoleFilters: RoleFilterValues = { code: "", name: "", status: "" };

interface UserDirectoryRecord extends Omit<UserFilterValues, "name" | "status"> {
  locked: "是" | "否";
  otpCount: number;
  updater: string;
}

const userDirectory: Record<string, UserDirectoryRecord> = {
  "USR-001": { login: "chan.kalong", mobile: "6612 4830", phone: "8399 2101", email: "kalong.chan@iam.gov.mo", euid: "EUID-100184", municipal: "是", locked: "否", otpCount: 1, updater: "系統管理員" },
  "USR-002": { login: "lei.chicheng", mobile: "6684 1027", phone: "8399 2108", email: "chicheng.lei@iam.gov.mo", euid: "EUID-100207", municipal: "是", locked: "否", otpCount: 0, updater: "陳家朗" },
  "USR-003": { login: "leong.kaman", mobile: "6231 7742", phone: "8399 2246", email: "kaman.leong@iam.gov.mo", euid: "EUID-100231", municipal: "是", locked: "否", otpCount: 2, updater: "系統管理員" },
  "USR-004": { login: "wong.chifong", mobile: "6655 9318", phone: "8399 2380", email: "chifong.wong@iam.gov.mo", euid: "EUID-100259", municipal: "是", locked: "是", otpCount: 5, updater: "陳家朗" },
  "USR-005": { login: "ho.houran", mobile: "6218 4459", phone: "2872 9014", email: "houran.ho@vendor.mo", euid: "EUID-200041", municipal: "否", locked: "否", otpCount: 1, updater: "黃志峰" },
  "USR-006": { login: "au.wingsan", mobile: "6688 3041", phone: "2872 9032", email: "wingsan.au@vendor.mo", euid: "EUID-200058", municipal: "否", locked: "是", otpCount: 3, updater: "系統管理員" },
};

export function GenericListPage({ title, description, dataset, eyebrow, tree, editor = "generic", primaryLabel = "新增" }: GenericListPageProps) {
  const source = genericDatasets[dataset];
  const [records, setRecords] = useState(source);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("全部狀態");
  const [userFilters, setUserFilters] = useState<UserFilterValues>(emptyUserFilters);
  const [groupFilters, setGroupFilters] = useState<GroupFilterValues>(emptyGroupFilters);
  const [roleFilters, setRoleFilters] = useState<RoleFilterValues>(emptyRoleFilters);
  const [selected, setSelected] = useState<string[]>([]);
  const [activeTree, setActiveTree] = useState(tree?.[0] ?? "");
  const [editing, setEditing] = useState<GenericRecord | null | undefined>();
  const [confirm, setConfirm] = useState(false);
  const { showToast } = useToast();
  const { inspectionTypes } = useDemo();
  const treeNodes = dataset === "items" ? inspectionTypes.map((type) => type.name) : (tree ?? []);
  const selectedTree = treeNodes.includes(activeTree) ? activeTree : (treeNodes[0] ?? "");
  const itemTypeOf = (record: GenericRecord) => itemCatalog.find((item) => item.id === record.id)?.inspectionType;
  const rows = records.filter((record) => {
    if (dataset === "groups") return (activeTree === "全部群組" || record.category === activeTree) && (!groupFilters.code || record.code.toLowerCase().includes(groupFilters.code.trim().toLowerCase())) && (!groupFilters.name || record.name.toLowerCase().includes(groupFilters.name.trim().toLowerCase())) && (!groupFilters.owner || record.owner === groupFilters.owner);
    if (dataset === "roles") {
      const roleStatus = record.status === "啟用" ? "生效" : "失效";
      return (!roleFilters.code || record.code.toLowerCase().includes(roleFilters.code.trim().toLowerCase()))
        && (!roleFilters.name || record.name.toLowerCase().includes(roleFilters.name.trim().toLowerCase()))
        && (!roleFilters.status || roleStatus === roleFilters.status);
    }
    if (dataset === "items") return itemTypeOf(record) === selectedTree && (!search || `${record.name}${record.code}${record.owner}`.toLowerCase().includes(search.toLowerCase())) && (status === "全部狀態" || record.status === status);
    if (dataset !== "users") return (!search || `${record.name}${record.code}${record.owner}`.toLowerCase().includes(search.toLowerCase())) && (status === "全部狀態" || record.status === status);
    const detail = userDirectory[record.id];
    const contains = (value: string, query: string) => !query || value.toLowerCase().includes(query.trim().toLowerCase());
    const displayStatus = record.status === "啟用" ? "生效" : "失效";
    return !!detail
      && contains(record.name, userFilters.name)
      && contains(detail.login, userFilters.login)
      && contains(detail.mobile, userFilters.mobile)
      && contains(detail.phone, userFilters.phone)
      && contains(detail.email, userFilters.email)
      && contains(detail.euid, userFilters.euid)
      && (!userFilters.municipal || detail.municipal === userFilters.municipal)
      && (!userFilters.status || displayStatus === userFilters.status);
  });
  const genericColumns: Column<GenericRecord>[] = [
    { key: "code", title: "編號", width: 138, sortable: true, render: (record) => <a>{record.code}</a> },
    { key: "name", title: "名稱", sortable: true }, { key: "category", title: "類別", width: 145 },
    { key: "owner", title: "負責部門", width: 160 }, { key: "count", title: "關聯數", width: 90 },
    { key: "updatedAt", title: "最後修改", width: 170, sortable: true }, { key: "status", title: "狀態", width: 90, render: (record) => <StatusTag>{record.status}</StatusTag> },
  ];
  const userColumns: Column<GenericRecord>[] = [
    { key: "name", title: "用戶姓名", width: 120, sortable: true },
    { key: "login", title: "登入帳號", width: 135, sortable: true, sortValue: (record) => userDirectory[record.id]?.login ?? "", render: (record) => userDirectory[record.id]?.login ?? "—" },
    { key: "mobile", title: "手機電話", width: 115, sortable: true, sortValue: (record) => userDirectory[record.id]?.mobile ?? "", render: (record) => userDirectory[record.id]?.mobile ?? "—" },
    { key: "phone", title: "聯絡電話", width: 115, sortable: true, sortValue: (record) => userDirectory[record.id]?.phone ?? "", render: (record) => userDirectory[record.id]?.phone ?? "—" },
    { key: "email", title: "電郵地址", width: 225, sortable: true, sortValue: (record) => userDirectory[record.id]?.email ?? "", render: (record) => userDirectory[record.id]?.email ?? "—" },
    { key: "euid", title: "EUID", width: 125, sortable: true, sortValue: (record) => userDirectory[record.id]?.euid ?? "", render: (record) => userDirectory[record.id]?.euid ?? "—" },
    { key: "municipal", title: "市政署用戶", width: 105, sortable: true, sortValue: (record) => userDirectory[record.id]?.municipal ?? "", render: (record) => userDirectory[record.id]?.municipal ?? "—" },
    { key: "status", title: "狀態", width: 85, sortable: true, sortValue: (record) => record.status === "啟用" ? "生效" : "失效", render: (record) => <StatusTag tone={record.status === "啟用" ? "success" : "neutral"}>{record.status === "啟用" ? "生效" : "失效"}</StatusTag> },
    { key: "locked", title: "鎖定", width: 75, sortable: true, sortValue: (record) => userDirectory[record.id]?.locked ?? "", render: (record) => <StatusTag tone={userDirectory[record.id]?.locked === "是" ? "danger" : "neutral"}>{userDirectory[record.id]?.locked ?? "—"}</StatusTag> },
    { key: "otpCount", title: "獲取驗證碼次數", width: 130, sortable: true, sortValue: (record) => userDirectory[record.id]?.otpCount ?? 0, render: (record) => userDirectory[record.id]?.otpCount ?? "—" },
    { key: "updater", title: "更新人", width: 115, sortable: true, sortValue: (record) => userDirectory[record.id]?.updater ?? "", render: (record) => userDirectory[record.id]?.updater ?? "—" },
    { key: "updatedAt", title: "更新時間", width: 165, sortable: true },
  ];
  const groupColumns: Column<GenericRecord>[] = [
    { key: "code", title: "編號", width: 138, sortable: true, render: (record) => <a>{record.code}</a> },
    { key: "name", title: "名稱", width: 230, sortable: true },
    { key: "category", title: "群組分類", width: 130, sortable: true },
    { key: "owner", title: "附屬部門", width: 180, sortable: true },
    { key: "count", title: "關聯用戶數", width: 120, sortable: true },
    { key: "updatedAt", title: "最後修改", width: 170, sortable: true },
    { key: "status", title: "狀態", width: 90, sortable: true, render: (record) => <StatusTag>{record.status}</StatusTag> },
  ];
  const roleColumns: Column<GenericRecord>[] = [
    { key: "code", title: "編號", width: 138, sortable: true, render: (record) => <a>{record.code}</a> },
    { key: "name", title: "名稱", width: 230, sortable: true },
    { key: "level", title: "層級", width: 130, sortable: true, sortValue: (record) => record.level ?? "—", render: (record) => record.level ?? "—" },
    { key: "roleType", title: "角色類型", width: 145, sortable: true, sortValue: (record) => record.roleType ?? "", render: (record) => record.roleType ?? "普通用戶" },
    { key: "status", title: "狀態", width: 95, sortable: true, sortValue: (record) => record.status === "啟用" ? "生效" : "失效", render: (record) => <StatusTag tone={record.status === "啟用" ? "success" : "neutral"}>{record.status === "啟用" ? "生效" : "失效"}</StatusTag> },
  ];
  const columns = dataset === "users" ? userColumns : dataset === "groups" ? groupColumns : dataset === "roles" ? roleColumns : genericColumns;
  const save = () => { setEditing(undefined); showToast(editing ? "變更已儲存" : "記錄已建立"); };
  const disableSelected = () => { setRecords(records.map((record) => selected.includes(record.id) ? { ...record, status: "停用" } : record)); setConfirm(false); setSelected([]); showToast("所選記錄已停用"); };
  const treeCounts = dataset === "items" ? Object.fromEntries(treeNodes.map((node) => [node, records.filter((record) => itemTypeOf(record) === node).length])) : undefined;
  return <div className="page-content">
    <PageHeader title={title} description={description} eyebrow={eyebrow} actions={<><Button icon={<CloudUploadOutlined />}>匯入</Button><Button icon={<ExportOutlined />}>匯出</Button><Button variant="primary" icon={<PlusOutlined />} onClick={() => setEditing(null)}>{primaryLabel}</Button></>} />
    <div className={treeNodes.length ? "tree-layout tree-page-layout" : dataset === "users" ? "user-page-layout" : "page-body-layout"}>{treeNodes.length > 0 && <TreePanel title={dataset === "groups" ? "群組分類" : dataset === "items" ? "巡查類型" : "分類"} nodes={treeNodes} counts={dataset === "groups" ? Object.fromEntries(treeNodes.map((node) => [node, node === "全部群組" ? records.length : records.filter((record) => record.category === node).length])) : treeCounts} active={selectedTree} onChange={setActiveTree} />}
      <section className={`panel list-panel ${dataset === "users" ? "user-list-panel" : dataset === "groups" ? "group-list-panel" : ""}`}>
        {dataset === "users" ? <div className="filter-bar user-filter-bar">
          <label className="filter-field"><span>用戶名稱</span><input aria-label="用戶名稱" value={userFilters.name} onChange={(event) => setUserFilters({ ...userFilters, name: event.target.value })} placeholder="請輸入用戶名稱" /></label>
          <label className="filter-field"><span>登入帳號</span><input aria-label="登入帳號" value={userFilters.login} onChange={(event) => setUserFilters({ ...userFilters, login: event.target.value })} placeholder="請輸入登入帳號" /></label>
          <label className="filter-field"><span>手機電話</span><input aria-label="手機電話" value={userFilters.mobile} onChange={(event) => setUserFilters({ ...userFilters, mobile: event.target.value })} placeholder="請輸入手機電話" /></label>
          <label className="filter-field"><span>聯絡電話</span><input aria-label="聯絡電話" value={userFilters.phone} onChange={(event) => setUserFilters({ ...userFilters, phone: event.target.value })} placeholder="請輸入聯絡電話" /></label>
          <label className="filter-field"><span>電郵地址</span><input aria-label="電郵地址" value={userFilters.email} onChange={(event) => setUserFilters({ ...userFilters, email: event.target.value })} placeholder="請輸入電郵地址" /></label>
          <label className="filter-field"><span>EUID</span><input aria-label="EUID" value={userFilters.euid} onChange={(event) => setUserFilters({ ...userFilters, euid: event.target.value })} placeholder="請輸入 EUID" /></label>
          <label className="filter-field"><span>市政署用戶</span><Select ariaLabel="市政署用戶" value={userFilters.municipal} onChange={(value) => setUserFilters({ ...userFilters, municipal: value as UserFilterValues["municipal"] })}><option value="">全部</option><option>是</option><option>否</option></Select></label>
          <label className="filter-field"><span>狀態</span><Select ariaLabel="狀態" value={userFilters.status} onChange={(value) => setUserFilters({ ...userFilters, status: value as UserFilterValues["status"] })}><option value="">全部</option><option>生效</option><option>失效</option></Select></label>
          <div className="user-filter-actions"><Button variant="text" icon={<ReloadOutlined />} onClick={() => setUserFilters(emptyUserFilters)}>重設</Button></div>
        </div> : dataset === "groups" ? <div className="filter-bar group-filter-bar">
          <label className="filter-field"><span>編號</span><input aria-label="編號" value={groupFilters.code} onChange={(event) => setGroupFilters({ ...groupFilters, code: event.target.value })} placeholder="請輸入編號" /></label>
          <label className="filter-field"><span>名稱</span><input aria-label="名稱" value={groupFilters.name} onChange={(event) => setGroupFilters({ ...groupFilters, name: event.target.value })} placeholder="請輸入名稱" /></label>
          <label className="filter-field"><span>附屬部門</span><Select ariaLabel="附屬部門" value={groupFilters.owner} onChange={(value) => setGroupFilters({ ...groupFilters, owner: value })}><option value="">全部附屬部門</option><option>市政管理廳</option><option>環境衛生處</option><option>園林綠化處</option><option>資訊處</option></Select></label>
          <div className="user-filter-actions"><Button variant="text" icon={<ReloadOutlined />} onClick={() => setGroupFilters(emptyGroupFilters)}>重設</Button></div>
        </div> : dataset === "roles" ? <div className="filter-bar role-filter-bar">
          <label className="filter-field"><span>編號</span><input aria-label="編號" value={roleFilters.code} onChange={(event) => setRoleFilters({ ...roleFilters, code: event.target.value })} placeholder="請輸入編號" /></label>
          <label className="filter-field"><span>名稱</span><input aria-label="名稱" value={roleFilters.name} onChange={(event) => setRoleFilters({ ...roleFilters, name: event.target.value })} placeholder="請輸入名稱" /></label>
          <label className="filter-field"><span>狀態</span><Select ariaLabel="狀態" value={roleFilters.status} onChange={(value) => setRoleFilters({ ...roleFilters, status: value as RoleFilterValues["status"] })}><option value="">全部狀態</option><option>生效</option><option>失效</option></Select></label>
          <div className="user-filter-actions"><Button variant="text" icon={<ReloadOutlined />} onClick={() => setRoleFilters(emptyRoleFilters)}>重設</Button></div>
        </div> : <FilterBar search={search} onSearch={setSearch} onReset={() => { setSearch(""); setStatus("全部狀態"); }} onAdvanced={() => showToast("已展開高級篩選條件")}><Select value={status} onChange={setStatus}><option>全部狀態</option><option>啟用</option><option>停用</option></Select>{activeTree && <span className="filter-chip">{activeTree}</span>}</FilterBar>}
        {dataset !== "users" && dataset !== "groups" && dataset !== "roles" && selected.length > 0 && <div className="batch-bar"><strong>已選 {selected.length} 筆</strong><Button icon={<EditOutlined />}>批量編輯</Button><Button variant="danger" icon={<DeleteOutlined />} onClick={() => setConfirm(true)}>停用所選</Button></div>}
        <DenseTable
          rows={rows}
          columns={columns}
          selected={dataset === "users" || dataset === "groups" || dataset === "roles" ? undefined : selected}
          onSelected={dataset === "users" || dataset === "groups" || dataset === "roles" ? undefined : setSelected}
          onRowClick={dataset === "users" || dataset === "groups" || dataset === "roles" ? undefined : setEditing}
          actionTitle={dataset === "users" || dataset === "groups" || dataset === "roles" ? "操作" : ""}
          stickyActions={dataset === "users" || dataset === "groups" || dataset === "roles"}
          renderActions={dataset === "users" || dataset === "groups" || dataset === "roles" ? (record) => <button className="table-action-button" aria-label={`編輯 ${record.name}`} onClick={() => setEditing(record)}><EditOutlined />編輯</button> : undefined}
        />
        <Pagination total={rows.length} />
      </section>
    </div>
    <FormDrawer open={editing !== undefined} title={editing ? `編輯${title.replace("管理", "")}` : `新增${title.replace("管理", "")}`} subtitle={editing?.code} onClose={() => setEditing(undefined)} onSubmit={save} className={dataset === "users" ? "user-editor-drawer" : dataset === "groups" ? "group-editor-drawer" : dataset === "roles" ? "role-editor-drawer" : ""}>
      {editor === "rule" ? <><div className="form-grid"><Field label="規則名稱" required><input defaultValue={editing?.name} /></Field><Field label="適用權限點" required><Select value="關閉工作" onChange={() => undefined}><option>關閉工作</option><option>作廢記錄</option></Select></Field></div><RuleBuilder/><Field label="拒絕提示語" required><input defaultValue="您目前的群組身份不允許執行此操作" /></Field><div className="test-result"><SafetyCertificateOutlined /><div><strong>試算通過</strong><span>測試用戶「陳家朗」符合目前條件</span></div></div></> : dataset === "users" ? <UserEditor record={editing ?? undefined} onSave={save} /> : dataset === "groups" ? <GroupEditor record={editing ?? undefined} onSave={save} /> : dataset === "roles" ? <RoleEditor record={editing ?? undefined} onSave={save} /> : <GenericEditor record={editing ?? undefined} onSave={save} />}
    </FormDrawer>
    <ConfirmDialog open={confirm} title="停用所選記錄？" message={`停用後將不再出現在新記錄的可選清單，共影響 ${selected.length} 筆。`} danger confirmLabel="確認停用" onCancel={() => setConfirm(false)} onConfirm={disableSelected} />
  </div>;
}

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
