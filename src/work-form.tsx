import { EnvironmentOutlined } from "@ant-design/icons";
import { AttachmentField } from "./attachments";
import { Field, Select } from "./components";
import { latLng } from "./event-data";
import { attachmentChars, type AttachmentRef } from "./inspection-rules";
import { LegendItem, PlanMap, type MapMarkerSpec } from "./plan-map";
import { gridOf, groupOptions, reverseGeocode, workTypeOptions } from "./work-data";
import { topType, type Priority, type WorkDraft, type WorkIssue } from "./work-rules";

export interface WorkFormState {
  title: string; type: string; priority: Priority; description: string; address: string; addressTouched: boolean;
  x?: number; y?: number; group: string; groupTouched: boolean; attachments: AttachmentRef[];
}
export const emptyWorkForm = (): WorkFormState => ({ title: "", type: "", priority: "一般", description: "", address: "", addressTouched: false, group: "", groupTouched: false, attachments: [] });
export const toDraft = (form: WorkFormState, group: string): WorkDraft => ({ title: form.title, type: form.type, priority: form.priority, description: form.description, address: form.address, x: form.x, y: form.y, group });
const sectionOf = (key: string) => key === "location" || key === "address" ? "wrk-sec-location" : key === "group" ? "wrk-sec-group" : "wrk-sec-basic";

export function IssueSummary({ issues }: { issues: WorkIssue[] }) {
  if (!issues.length) return null;
  return <div className="evt-error" role="alert"><strong>請修正以下 {issues.length} 項</strong><ol>{issues.map((issue, index) => <li key={index}><button type="button" onClick={() => document.getElementById(sectionOf(issue.key))?.scrollIntoView({ behavior: "smooth", block: "start" })}>{issue.message}</button></li>)}</ol></div>;
}

export interface GroupInfo { effective: string; suggestion?: { group: string; reason: string; auto: boolean }; locked?: boolean; changedHint?: string }

export function WorkForm({ form, issues, group, onChange }: { form: WorkFormState; issues: WorkIssue[]; group: GroupInfo; onChange: (patch: Partial<WorkFormState>) => void }) {
  const error = (key: string) => issues.find((issue) => issue.key === key)?.message;
  const pick = ([x, y]: [number, number]) => { const found = reverseGeocode(x, y); onChange({ x, y, ...(form.addressTouched ? {} : { address: found.address }) }); };
  const marker: MapMarkerSpec[] = form.x !== undefined && form.y !== undefined ? [{ id: "pick", kind: "work", x: form.x, y: form.y, tone: "work", label: "工", title: form.address || "工作位置" }] : [];
  const options = form.type && !workTypeOptions.includes(form.type) ? [form.type, ...workTypeOptions] : workTypeOptions;
  const tops = [...new Set(options.map(topType))];
  return <div className="evt-form wrk-form">
    <section className="group-editor-section" id="wrk-sec-basic"><header><h3>基本資料</h3></header><div className="group-editor-grid">
      <Field label="工作類型" required hint="已有預填時可直接修改"><Select ariaLabel="工作類型" value={form.type} onChange={(type) => onChange({ type })}><option value="">請選擇工作類型</option>{tops.map((top) => <optgroup key={top} label={top}>{options.filter((option) => topType(option) === top).map((option) => <option key={option} value={option}>{option.split("／").slice(1).join("／") || option}</option>)}</optgroup>)}</Select>{error("type") && <small className="evt-field-error">{error("type")}</small>}</Field>
      <Field label="優先級" required><Select ariaLabel="優先級" value={form.priority} onChange={(priority) => onChange({ priority: priority as Priority })}><option>一般</option><option>緊急</option><option>特急</option></Select></Field>
      <Field label="工作摘要" required hint="1–50 字"><input value={form.title} maxLength={50} onChange={(event) => onChange({ title: event.target.value })} placeholder="請輸入工作摘要" />{error("title") && <small className="evt-field-error">{error("title")}</small>}</Field>
      <Field label="描述"><textarea rows={4} value={form.description} onChange={(event) => onChange({ description: event.target.value })} placeholder="說明現場情況" /><small className={[...form.description].length > 1000 ? "evt-field-error" : "evt-counter"}>{[...form.description].length} / 1000</small>{error("description") && <small className="evt-field-error">{error("description")}</small>}</Field>
    </div></section>
    <section className="group-editor-section" id="wrk-sec-location"><header><h3>位置</h3></header><div className="evt-location">
      <div className="evt-pick"><PlanMap className="evt-pick-map" markers={marker} onPick={pick} fitKey={form.x === undefined ? "none" : "has"} legend={<LegendItem tone="work">工作位置</LegendItem>} /></div>
      <div className="evt-pick-note"><EnvironmentOutlined />{form.x === undefined ? "請點擊地圖選取工作位置（可先放大）。" : "點擊地圖可重新選點。"}{error("location") && <em className="evt-field-error">{error("location")}</em>}</div>
      <div className="group-editor-grid">
        <Field label="地址" required hint="按選點自動帶入，可手動修改"><input value={form.address} onChange={(event) => onChange({ address: event.target.value, addressTouched: true })} placeholder="請輸入地址" />{error("address") && <small className="evt-field-error">{error("address")}</small>}</Field>
        <Field label="經緯度"><input value={form.x === undefined || form.y === undefined ? "" : latLng(form.x, form.y)} readOnly disabled placeholder="選點後自動計算" /></Field>
        <Field label="網格" hint="按位置自動歸屬"><input value={form.x === undefined || form.y === undefined ? "" : gridOf(form.x, form.y)} readOnly disabled placeholder="選點後自動計算" /></Field>
      </div></div></section>
    <section className="group-editor-section" id="wrk-sec-group"><header><h3>執行群組</h3></header><div className="group-editor-grid">
      {group.locked
        ? <Field label="執行群組" hint="如需更改，請使用「重新分派」"><input value={group.effective} disabled /></Field>
        : <Field label="執行群組" required hint={group.suggestion ? (form.groupTouched && group.suggestion.group !== group.effective ? `已手動指定；自動建議為「${group.suggestion.group}」（${group.suggestion.reason}）` : `自動分派：${group.suggestion.reason}`) : "選擇工作類型及位置後自動分派"}><Select ariaLabel="執行群組" value={group.effective} onChange={(value) => onChange({ group: value, groupTouched: true })}><option value="">請選擇執行群組</option>{[...new Set([...groupOptions, group.effective].filter(Boolean))].map((name) => <option key={name}>{name}</option>)}</Select>{error("group") && <small className="evt-field-error">{error("group")}</small>}</Field>}
      {group.changedHint && <div className="plan-snapshot-note wrk-hint"><span>{group.changedHint}</span></div>}
    </div></section>
    <section className="group-editor-section"><header><h3>附件</h3></header><div className="evt-attach"><AttachmentField files={form.attachments} min={0} usedChars={attachmentChars({ a: { attachments: form.attachments } })} onChange={(attachments) => onChange({ attachments })} /></div></section>
  </div>;
}
