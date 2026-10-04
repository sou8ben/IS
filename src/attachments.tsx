import { useState, type ChangeEvent } from "react";
import { DeleteOutlined, FileOutlined, UploadOutlined } from "@ant-design/icons";
import { ATTACH_BUDGET_CHARS, ATTACH_MAX_FILE_BYTES, ATTACH_MAX_PER_ITEM, type AttachmentRef } from "./inspection-rules";

function toDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("讀取檔案失敗"));
    reader.onload = () => {
      const image = new Image();
      image.onerror = () => reject(new Error("不是有效的圖片"));
      image.onload = () => {
        const scale = Math.min(1, 800 / Math.max(image.width, image.height));
        const canvas = document.createElement("canvas"); canvas.width = Math.max(1, Math.round(image.width * scale)); canvas.height = Math.max(1, Math.round(image.height * scale));
        canvas.getContext("2d")?.drawImage(image, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", 0.7));
      };
      image.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}

export function AttachmentField({ files, min, usedChars, onChange, disabled, max = ATTACH_MAX_PER_ITEM }: { files: AttachmentRef[]; min: number; usedChars: number; onChange: (files: AttachmentRef[]) => void; disabled?: boolean; /** Most files allowed (default 6). */ max?: number }) {
  const [message, setMessage] = useState(""); const [busy, setBusy] = useState(false);
  const pick = async (event: ChangeEvent<HTMLInputElement>) => {
    const picked = Array.from(event.target.files ?? []); event.target.value = "";
    if (!picked.length) return;
    setBusy(true); const added: AttachmentRef[] = []; const problems: string[] = []; let chars = usedChars;
    for (const file of picked) {
      if (files.length + added.length >= max) { problems.push(`最多 ${max} 個附件`); break; }
      if (file.size > ATTACH_MAX_FILE_BYTES) { problems.push(`「${file.name}」超過 10 MB`); continue; }
      try {
        const isImage = file.type.startsWith("image/");
        const src = isImage ? await toDataUrl(file) : undefined;
        if (src && chars + src.length > ATTACH_BUDGET_CHARS) { problems.push(`「${file.name}」未能加入：此巡查的圖片附件已達示範儲存上限`); continue; }
        chars += src?.length ?? 0;
        added.push({ id: `ATT-${Date.now()}-${Math.round(Math.random() * 10000)}`, name: file.name, size: file.size, kind: isImage ? "image" : "file", src });
      } catch (error) { problems.push(`「${file.name}」${(error as Error).message}`); }
    }
    setBusy(false); setMessage(problems.join("；"));
    if (added.length) onChange([...files, ...added]);
  };
  const short = files.length < min;
  return <div className="insp-attach">
    <div className="insp-attach-grid">
      {files.map((file) => <figure key={file.id}>{file.src ? <img src={file.src} alt={file.name} /> : <FileOutlined />}<figcaption>{file.name}</figcaption>{!disabled && <button type="button" aria-label={`移除 ${file.name}`} onClick={() => onChange(files.filter((item) => item.id !== file.id))}><DeleteOutlined /></button>}</figure>)}
      {!disabled && files.length < max && <label className={`insp-attach-add ${busy ? "busy" : ""}`}><input type="file" accept="image/*,.pdf" multiple onChange={pick} disabled={busy} /><UploadOutlined /><span>{busy ? "處理中…" : "從電腦選擇檔案"}</span></label>}
    </div>
    <div className="insp-attach-meta"><span className={short ? "short" : "ok"}>已上傳 {files.length}{min ? ` / 最少 ${min}` : ""} 個{short ? "，附件數量不足" : ""}</span>{message && <em role="alert">{message}</em>}</div>
  </div>;
}
