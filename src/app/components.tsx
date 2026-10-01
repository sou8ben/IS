import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ChangeEvent, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { ActionSheet, Button, Dialog, NavBar, Popup, SearchBar, TextArea, Toast } from "antd-mobile";
import { AddOutline, CameraOutline, CheckCircleFill, CloseOutline, EditSOutline, EnvironmentOutline, LocationFill, MinusOutline, PlayOutline, ScanningOutline, UndoOutline } from "antd-mobile-icons";
import { toneMap } from "../components";
import type { StatusTone } from "../types";
import { addressBook, asset, MAP_SIZE, myLocation, photoAssets } from "./data";
import { gridOf, nowText } from "./rules";
import type { Photo } from "./types";

// ---- 頁面骨架 ----
export function useBack(fallback = "/home") {
  const navigate = useNavigate();
  return () => ((window.history.state as { idx?: number } | null)?.idx ?? 0) > 0 ? navigate(-1) : navigate(fallback, { replace: true });
}

export function Page({ title, back = true, backTo, onBack, right, children, footer, className = "", bodyClassName = "" }: {
  title: ReactNode; back?: boolean; backTo?: string; onBack?: () => void; right?: ReactNode; children: ReactNode; footer?: ReactNode; className?: string; bodyClassName?: string;
}) {
  const goBack = useBack(backTo);
  return <div className={`m-page ${className}`}>
    <NavBar className="m-navbar" backIcon={back} back={back ? "" : null} onBack={onBack ?? goBack} right={right}>{title}</NavBar>
    <div className={`m-page-body ${bodyClassName}`}>{children}</div>
    {footer && <div className="m-page-footer">{footer}</div>}
  </div>;
}

const extraTones: Record<string, StatusTone> = { "未完成": "neutral", "待同步": "warning", "同步中": "info", "已同步": "success", "衝突": "danger", "異常": "danger", "通過": "success", "不通過": "danger", "補錄": "info", "自動": "info", "已作廢": "neutral", "合併": "info", "已鎖定": "danger" };
export function StatusTag({ children, tone }: { children: ReactNode; tone?: StatusTone }) {
  const label = String(children);
  return <span className={`m-tag tone-${tone ?? extraTones[label] ?? toneMap[label] ?? "neutral"}`}>{children}</span>;
}

export function Card({ title, extra, children, className = "", id }: { title?: ReactNode; extra?: ReactNode; children: ReactNode; className?: string; id?: string }) {
  return <section className={`m-card ${className}`} id={id}>{(title || extra) && <header className="m-card-head"><strong>{title}</strong>{extra}</header>}{children}</section>;
}

export function InfoList({ items }: { items: [string, ReactNode][] }) {
  return <dl className="m-info">{items.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value ?? "—"}</dd></div>)}</dl>;
}

export function GroupTitle({ children, extra }: { children: ReactNode; extra?: ReactNode }) {
  return <div className="m-group-title"><span>{children}</span>{extra}</div>;
}

export function Progress({ value, total, tone = "primary" }: { value: number; total: number; tone?: "primary" | "success" }) {
  return <div className={`m-progress ${tone}`}><i style={{ width: `${total ? Math.min(100, (value / total) * 100) : 0}%` }} /></div>;
}

export function Empty({ title, text }: { title: string; text?: string }) {
  return <div className="m-empty"><svg viewBox="0 0 64 48" aria-hidden><rect x="10" y="12" width="44" height="30" rx="3" /><path d="M10 22h14l4 6h8l4-6h14" /></svg><strong>{title}</strong>{text && <span>{text}</span>}</div>;
}

// ---- 地圖組件（詳細設計 13.3：本地政府底圖，不使用第三方地圖） ----
export interface MapMarker { id: string; x: number; y: number; tone?: "todo" | "done" | "issue" | "work" | "event" | "active"; index?: ReactNode; title?: string; subtitle?: ReactNode; openLabel?: string; onOpen?: () => void }

export function MapView({ markers = [], routes, track, showTrackIndex, me = true, legend, pick, onPick, initial, className = "" }: {
  markers?: MapMarker[]; routes?: [number, number][][]; track?: [number, number, string?][]; showTrackIndex?: boolean; me?: boolean; legend?: ReactNode;
  pick?: boolean; onPick?: (point: { x: number; y: number }) => void; initial?: { x: number; y: number; zoom: number }; className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  const [view, setView] = useState<{ x: number; y: number; zoom: number } | null>(initial ?? null);
  const [selected, setSelected] = useState<string | null>(null);
  const drag = useRef<{ px: number; py: number; x: number; y: number; moved: boolean } | null>(null);
  const clamp = (next: { x: number; y: number; zoom: number }) => {
    if (!size?.w) return next;
    const zoom = Math.max(1, (size.h / size.w) * (MAP_SIZE.width / MAP_SIZE.height), Math.min(9, next.zoom));
    const halfW = MAP_SIZE.width / zoom / 2; const halfH = (size.h / (size.w * zoom * (MAP_SIZE.height / MAP_SIZE.width))) * MAP_SIZE.height / 2;
    return { zoom, x: Math.min(MAP_SIZE.width - halfW, Math.max(halfW, next.x)), y: Math.min(MAP_SIZE.height - halfH, Math.max(halfH, next.y)) };
  };

  useLayoutEffect(() => {
    const element = ref.current; if (!element) return;
    const observer = new ResizeObserver(() => setSize({ w: element.clientWidth, h: element.clientHeight }));
    observer.observe(element); setSize({ w: element.clientWidth, h: element.clientHeight });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (view || !size?.w) return;
    const points = [...markers.map((marker) => [marker.x, marker.y]), ...(routes ?? []).flat(), ...(track ?? []).map(([x, y]) => [x, y]), ...(me ? [[myLocation.x, myLocation.y]] : [])];
    if (!points.length) { setView({ x: myLocation.x, y: myLocation.y, zoom: 5 }); return; }
    const xs = points.map((point) => point[0]); const ys = points.map((point) => point[1]);
    const bw = Math.max(...xs) - Math.min(...xs) + 60; const bh = Math.max(...ys) - Math.min(...ys) + 70;
    const scale = Math.min(size.w / bw, size.h / bh);
    setView(clamp({ x: (Math.max(...xs) + Math.min(...xs)) / 2, y: (Math.max(...ys) + Math.min(...ys)) / 2, zoom: Math.min(7, (scale * MAP_SIZE.width) / size.w) }));
  }, [size, view]); // eslint-disable-line react-hooks/exhaustive-deps
  // 底圖須填滿容器：限制最小縮放及可平移範圍
  useEffect(() => { if (size?.w && view) { const next = clamp(view); if (next.x !== view.x || next.y !== view.y || next.zoom !== view.zoom) setView(next); } }, [size]); // eslint-disable-line react-hooks/exhaustive-deps

  const layerW = size && view ? size.w * view.zoom : 0;
  const layerH = layerW * (MAP_SIZE.height / MAP_SIZE.width);
  const left = size && view ? size.w / 2 - (view.x / MAP_SIZE.width) * layerW : 0;
  const top = size && view ? size.h / 2 - (view.y / MAP_SIZE.height) * layerH : 0;
  const pct = (x: number, y: number) => ({ left: `${(x / MAP_SIZE.width) * 100}%`, top: `${(y / MAP_SIZE.height) * 100}%` });
  const active = markers.find((marker) => marker.id === selected);

  const onDown = (event: ReactPointerEvent) => { if (!view) return; drag.current = { px: event.clientX, py: event.clientY, x: view.x, y: view.y, moved: false }; };
  const onMove = (event: ReactPointerEvent) => {
    const start = drag.current; if (!start || !view || !layerW) return;
    const dx = event.clientX - start.px; const dy = event.clientY - start.py;
    if (!start.moved && Math.hypot(dx, dy) < 5) return;
    if (!start.moved) { start.moved = true; (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId); }
    setView(clamp({ ...view, x: start.x - (dx / layerW) * MAP_SIZE.width, y: start.y - (dy / layerH) * MAP_SIZE.height }));
  };
  const onUp = () => { if (drag.current?.moved && pick && view) onPick?.({ x: Math.round(view.x), y: Math.round(view.y) }); window.setTimeout(() => { drag.current = null; }, 0); };
  const zoomBy = (factor: number) => view && setView(clamp({ ...view, zoom: view.zoom * factor }));
  const locate = () => { if (!view) return; setView(clamp({ ...view, x: myLocation.x, y: myLocation.y })); if (pick) onPick?.({ x: myLocation.x, y: myLocation.y }); };

  return <div className={`m-map ${className}`} ref={ref} onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}>
    {size && view && <div className="m-map-layer" style={{ width: layerW, height: layerH, transform: `translate(${left}px, ${top}px)` }}>
      <img src={asset("macau-operations-map.png")} alt="澳門底圖" draggable={false} />
      <svg viewBox={`0 0 ${MAP_SIZE.width} ${MAP_SIZE.height}`} preserveAspectRatio="none" aria-hidden>
        {routes?.map((route, index) => <polyline key={index} className="m-map-route" points={route.map((point) => point.join(",")).join(" ")} />)}
        {track && <polyline className="m-map-track" points={track.map(([x, y]) => `${x},${y}`).join(" ")} />}
      </svg>
      {track?.map(([x, y, time], index) => <span key={`${x}-${y}-${index}`} className={`m-map-trackdot ${showTrackIndex ? "numbered" : ""}`} style={pct(x, y)} title={time}>{showTrackIndex ? index + 1 : null}</span>)}
      {me && <span className="m-map-me" style={pct(myLocation.x, myLocation.y)} />}
      {markers.map((marker) => <button key={marker.id} className={`m-map-marker tone-${marker.tone ?? "todo"} ${selected === marker.id ? "selected" : ""}`} style={pct(marker.x, marker.y)} aria-label={marker.title}
        onClick={(event) => { event.stopPropagation(); if (!drag.current?.moved) setSelected(selected === marker.id ? null : marker.id); }}>
        <span>{marker.index ?? <LocationFill />}</span>
      </button>)}
    </div>}
    {pick && <div className="m-map-pin"><LocationFill /></div>}
    <div className="m-map-tools" onPointerDown={(event) => event.stopPropagation()}>
      <button aria-label="放大" onClick={() => zoomBy(1.4)}><AddOutline /></button>
      <button aria-label="縮小" onClick={() => zoomBy(1 / 1.4)}><MinusOutline /></button>
      <button aria-label="回到我的位置" onClick={locate}><EnvironmentOutline /></button>
    </div>
    {legend && <div className="m-map-legend">{legend}</div>}
    {active && <div className="m-map-card" onPointerDown={(event) => event.stopPropagation()}>
      <div><strong>{active.title}</strong>{active.subtitle && <span>{active.subtitle}</span>}</div>
      {active.onOpen && <Button size="mini" color="primary" fill="outline" onClick={active.onOpen}>{active.openLabel ?? "查看"}</Button>}
      <button className="m-map-card-close" aria-label="關閉" onClick={() => setSelected(null)}><CloseOutline /></button>
    </div>}
  </div>;
}

export const LegendDot = ({ tone, children }: { tone: string; children: ReactNode }) => <span className="m-legend-item"><i className={`tone-${tone}`} />{children}</span>;

// ---- 附件組件（詳細設計 12.3、13.4：水印、塗鴉、影片時長） ----
export function PhotoThumb({ photo, large, onClick, onRemove }: { photo: Photo; large?: boolean; onClick?: () => void; onRemove?: () => void }) {
  return <div className={`m-photo ${large ? "large" : ""}`} onClick={onClick}>
    <img src={photo.src} alt={photo.name} draggable={false} />
    {photo.doodle && <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden><path d={photo.doodle} /></svg>}
    <span className="m-photo-wm">{photo.watermark}</span>
    {photo.kind === "video" && <span className="m-photo-video"><PlayOutline />0:{String(photo.duration ?? 0).padStart(2, "0")}</span>}
    {onRemove && <button className="m-photo-remove" aria-label="刪除附件" onClick={(event) => { event.stopPropagation(); onRemove(); }}><CloseOutline /></button>}
  </div>;
}

function readAlbumFile(file: File, place: string): Promise<Photo> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      const scale = Math.min(1, 640 / Math.max(image.width, image.height));
      const canvas = document.createElement("canvas"); canvas.width = Math.round(image.width * scale); canvas.height = Math.round(image.height * scale);
      canvas.getContext("2d")!.drawImage(image, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      resolve({ id: `P-${Date.now()}`, src: canvas.toDataURL("image/jpeg", 0.6), name: file.name, watermark: `${nowText()} ${place}`, kind: "image" });
    };
    image.onerror = () => { URL.revokeObjectURL(url); reject(new Error("無法讀取圖片")); };
    image.src = url;
  });
}

export function AttachmentField({ value, onChange, min = 0, max = 9, place = "現場", allowAlbum = true, allowVideo = true, sample = photoAssets.seat, disabled }: {
  value: Photo[]; onChange: (photos: Photo[]) => void; min?: number; max?: number; place?: string; allowAlbum?: boolean; allowVideo?: boolean; sample?: string; disabled?: boolean;
}) {
  const [sheet, setSheet] = useState(false);
  const [camera, setCamera] = useState<"image" | "video" | null>(null);
  const [preview, setPreview] = useState<Photo | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const onFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]; event.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) { Toast.show({ content: "只接受圖片格式" }); return; }
    try { onChange([...value, await readAlbumFile(file, place)]); } catch { Toast.show({ content: "無法讀取圖片" }); }
  };
  return <div className="m-attach">
    <div className="m-attach-grid">
      {value.map((photo) => <PhotoThumb key={photo.id} photo={photo} onClick={() => setPreview(photo)} onRemove={disabled ? undefined : () => onChange(value.filter((item) => item.id !== photo.id))} />)}
      {!disabled && value.length < max && <button className="m-attach-add" onClick={() => setSheet(true)}><CameraOutline /><span>{value.length}/{max}</span></button>}
    </div>
    {min > 0 && <small className={`m-attach-hint ${value.length < min ? "short" : ""}`}>至少 {min} 張相片{value.length < min ? `，尚欠 ${min - value.length} 張` : ""}</small>}
    <ActionSheet visible={sheet} onClose={() => setSheet(false)} cancelText="取消" extra={allowAlbum ? "拍攝後自動加上日期時間水印" : "此情景只容許使用相機拍攝，拍攝後自動加上水印"} actions={[
      { key: "photo", text: "拍照", onClick: () => { setSheet(false); setCamera("image"); } },
      ...(allowVideo ? [{ key: "video", text: "錄影（最長 20 秒）", onClick: () => { setSheet(false); setCamera("video"); } }] : []),
      ...(allowAlbum ? [{ key: "album", text: "從相簿選擇", onClick: () => { setSheet(false); fileRef.current?.click(); } }] : []),
    ]} />
    <input ref={fileRef} type="file" accept="image/*" hidden onChange={onFile} />
    <CameraPopup mode={camera} sample={sample} place={place} onClose={() => setCamera(null)} onDone={(photo) => { onChange([...value, photo]); setCamera(null); }} />
    <Popup visible={!!preview} onMaskClick={() => setPreview(null)} bodyClassName="m-preview-body" position="bottom">
      {preview && <><PhotoThumb photo={preview} large /><div className="m-preview-meta"><strong>{preview.name}</strong><span>{preview.watermark}</span></div><Button block onClick={() => setPreview(null)}>關閉</Button></>}
    </Popup>
  </div>;
}

function CameraPopup({ mode, sample, place, onClose, onDone }: { mode: "image" | "video" | null; sample: string; place: string; onClose: () => void; onDone: (photo: Photo) => void }) {
  const [stage, setStage] = useState<"shoot" | "review">("shoot");
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [strokes, setStrokes] = useState<string[]>([]);
  const [doodle, setDoodle] = useState(false);
  const [flash, setFlash] = useState(false);
  const [watermark, setWatermark] = useState("");
  const svgRef = useRef<SVGSVGElement>(null);
  const drawing = useRef(false);
  useEffect(() => { if (mode) { setStage("shoot"); setRecording(false); setSeconds(0); setStrokes([]); setDoodle(false); } }, [mode]);
  useEffect(() => {
    if (!recording) return;
    const timer = window.setInterval(() => setSeconds((value) => { if (value + 1 >= 20) { setRecording(false); setStage("review"); Toast.show({ content: "已達 20 秒上限，自動停止錄影" }); return 20; } return value + 1; }), 1000);
    return () => window.clearInterval(timer);
  }, [recording]);
  const shoot = () => {
    setWatermark(`${nowText()} ${place}`);
    if (mode === "video") { if (recording) { setRecording(false); setStage("review"); } else { setSeconds(0); setRecording(true); } return; }
    setFlash(true); window.setTimeout(() => { setFlash(false); setStage("review"); }, 160);
  };
  const point = (event: ReactPointerEvent) => { const box = svgRef.current!.getBoundingClientRect(); return `${(((event.clientX - box.left) / box.width) * 100).toFixed(1)} ${(((event.clientY - box.top) / box.height) * 100).toFixed(1)}`; };
  const photo: Photo = { id: `P-${Date.now()}`, src: sample, name: mode === "video" ? `現場影片_${seconds}s.mp4` : "現場相片.jpg", watermark, kind: mode === "video" ? "video" : "image", duration: mode === "video" ? Math.max(1, seconds) : undefined, doodle: strokes.join(" ") || undefined };
  return <Popup visible={!!mode} position="bottom" bodyClassName="m-camera" destroyOnClose>
    <div className="m-camera-top"><button onClick={onClose} aria-label="關閉相機"><CloseOutline /></button><span>{mode === "video" ? (recording ? `錄影中 0:${String(seconds).padStart(2, "0")} / 0:20` : "錄影 · 最長 20 秒") : "拍照"}</span><i /></div>
    {stage === "shoot" ? <>
      <div className={`m-camera-view ${flash ? "flash" : ""}`}><img src={sample} alt="相機取景" /><div className="m-camera-grid" />{recording && <span className="m-camera-rec">REC</span>}</div>
      <div className="m-camera-bar"><span>{mode === "video" ? "按下開始，再按停止" : "水印：日期時間 + 地點"}</span><button className={`m-shutter ${mode === "video" ? "video" : ""} ${recording ? "recording" : ""}`} aria-label={mode === "video" ? "錄影" : "拍照"} onClick={shoot}><i /></button><span /></div>
    </> : <>
      <div className="m-camera-view review">
        <PhotoThumb photo={photo} large />
        {mode === "image" && <svg ref={svgRef} className={`m-doodle ${doodle ? "active" : ""}`} viewBox="0 0 100 100" preserveAspectRatio="none"
          onPointerDown={(event) => { if (!doodle) return; drawing.current = true; (event.currentTarget as Element).setPointerCapture(event.pointerId); setStrokes([...strokes, `M${point(event)}`]); }}
          onPointerMove={(event) => { if (!drawing.current) return; const next = [...strokes]; next[next.length - 1] += ` L${point(event)}`; setStrokes(next); }}
          onPointerUp={() => { drawing.current = false; }}><path d={strokes.join(" ")} /></svg>}
      </div>
      <div className="m-camera-actions">
        {mode === "image" && <><Button fill="none" className={doodle ? "on" : ""} onClick={() => setDoodle(!doodle)}><EditSOutline /> 塗鴉</Button><Button fill="none" disabled={!strokes.length} onClick={() => setStrokes(strokes.slice(0, -1))}><UndoOutline /> 撤銷</Button></>}
        <Button fill="none" onClick={() => { setStage("shoot"); setStrokes([]); setSeconds(0); }}>重拍</Button>
        <Button color="primary" onClick={() => onDone(photo)}>{mode === "video" ? "使用影片" : "使用相片"}</Button>
      </div>
    </>}
  </Popup>;
}

// ---- 簽名板 ----
export function SignatureField({ value, onChange, disabled, signer }: { value?: string; onChange: (value?: string) => void; disabled?: boolean; signer: string }) {
  const [open, setOpen] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const inked = useRef(false); const drawing = useRef(false);
  useEffect(() => {
    if (!open) return;
    const timer = window.setTimeout(() => {
      const canvas = canvasRef.current; if (!canvas) return;
      const ratio = window.devicePixelRatio || 1;
      canvas.width = canvas.clientWidth * ratio; canvas.height = canvas.clientHeight * ratio;
      const context = canvas.getContext("2d")!; context.scale(ratio, ratio); context.lineWidth = 2.4; context.lineCap = "round"; context.lineJoin = "round"; context.strokeStyle = "#1f2329";
      inked.current = false;
    }, 320);
    return () => window.clearTimeout(timer);
  }, [open]);
  const pos = (event: ReactPointerEvent<HTMLCanvasElement>) => { const box = event.currentTarget.getBoundingClientRect(); return [event.clientX - box.left, event.clientY - box.top] as const; };
  const clear = () => { const canvas = canvasRef.current; if (!canvas) return; canvas.getContext("2d")!.clearRect(0, 0, canvas.width, canvas.height); inked.current = false; };
  const confirm = () => {
    if (!inked.current) { Toast.show({ content: "空白簽名視為未填，請先簽名" }); return; }
    onChange(canvasRef.current!.toDataURL("image/png")); setOpen(false);
  };
  return <div className="m-sign">
    {value ? <div className="m-sign-preview">{value === "seed" ? <span className="m-sign-seed">{signer}</span> : <img src={value} alt="簽名" />}{!disabled && <button onClick={() => setOpen(true)}>重新簽名</button>}</div>
      : <button className="m-sign-empty" disabled={disabled} onClick={() => setOpen(true)}><EditSOutline /> 點擊簽名</button>}
    <Popup visible={open} onMaskClick={() => setOpen(false)} bodyClassName="m-sign-popup">
      <header><strong>簽名</strong><span>請在框內簽署，保存為 PNG</span></header>
      <canvas ref={canvasRef} className="m-sign-canvas"
        onPointerDown={(event) => { drawing.current = true; event.currentTarget.setPointerCapture(event.pointerId); const [x, y] = pos(event); const context = event.currentTarget.getContext("2d")!; context.beginPath(); context.moveTo(x, y); }}
        onPointerMove={(event) => { if (!drawing.current) return; const [x, y] = pos(event); const context = event.currentTarget.getContext("2d")!; context.lineTo(x, y); context.stroke(); inked.current = true; }}
        onPointerUp={() => { drawing.current = false; }} />
      <footer><Button onClick={clear}>清除重簽</Button><Button color="primary" onClick={confirm}>確定</Button></footer>
    </Popup>
  </div>;
}

// ---- 地址組件（詳細設計 13.2） ----
export interface AddressValue { address: string; x: number; y: number; grid: string; approx?: boolean; parish?: string }

export function reverseGeocode(x: number, y: number): AddressValue {
  const nearest = addressBook.map((entry) => ({ entry, d: Math.hypot(entry.x - x, entry.y - y) })).sort((a, b) => a.d - b.d)[0];
  const grid = gridOf(x, y);
  if (nearest.d <= 12) return { address: `${nearest.entry.parish} ${nearest.entry.street}${nearest.entry.number !== "—" ? ` ${nearest.entry.number} 號` : ""} ${nearest.entry.building}`, x, y, grid, parish: nearest.entry.parish };
  if (nearest.d <= 45) return { address: `${nearest.entry.parish} ${nearest.entry.street} 近${nearest.entry.building}`, x, y, grid, parish: nearest.entry.parish, approx: true };
  return { address: `${grid}（未能鎖定地址，已保存經緯度）`, x, y, grid, approx: true };
}
export const currentAddress = () => reverseGeocode(myLocation.x, myLocation.y);
export const latLng = (x: number, y: number) => `${(22.215 - y * 0.000108).toFixed(5)}, ${(113.52 + x * 0.0000658).toFixed(5)}`;

export function AddressField({ value, onChange }: { value?: AddressValue; onChange: (value: AddressValue) => void }) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<AddressValue | undefined>(value);
  const [keyword, setKeyword] = useState("");
  const [center, setCenter] = useState<{ x: number; y: number; zoom: number }>();
  const matches = useMemo(() => keyword ? addressBook.filter((entry) => `${entry.name}${entry.street}${entry.building}`.includes(keyword)) : [], [keyword]);
  const openPicker = () => { const start = value ?? currentAddress(); setDraft(start); setCenter({ x: start.x, y: start.y, zoom: 5 }); setKeyword(""); setOpen(true); };
  return <div className="m-address">
    <div className="m-address-text">{value ? <><span>{value.address}</span><small>{value.approx && <StatusTag tone="warning">近似地址</StatusTag>} {latLng(value.x, value.y)}</small></> : <span className="placeholder">請選擇地址</span>}</div>
    <div className="m-address-actions">
      <Button size="small" fill="outline" onClick={() => { onChange(currentAddress()); Toast.show({ icon: "success", content: "已按當前定位填入" }); }}><EnvironmentOutline /> 當前定位</Button>
      <Button size="small" fill="outline" onClick={openPicker}>地圖選點</Button>
    </div>
    <Popup visible={open} onMaskClick={() => setOpen(false)} bodyClassName="m-address-popup" destroyOnClose>
      <header><button onClick={() => setOpen(false)}>取消</button><strong>選擇地址</strong><button className="primary" onClick={() => { if (draft) onChange(draft); setOpen(false); }}>確定</button></header>
      <SearchBar placeholder="輸入街道或建築物名稱" value={keyword} onChange={setKeyword} />
      {matches.length > 0 && <div className="m-address-matches">{matches.map((entry) => <button key={entry.name} onClick={() => { const next = reverseGeocode(entry.x, entry.y); setDraft(next); setCenter({ x: entry.x, y: entry.y, zoom: 6 }); setKeyword(""); }}><strong>{entry.name}</strong><span>{entry.parish} · {entry.street}</span></button>)}</div>}
      {center && <MapView key={`${center.x}-${center.y}`} pick initial={center} onPick={(point) => setDraft(reverseGeocode(point.x, point.y))} className="m-address-map" />}
      <div className="m-address-result">{draft && <><strong>{draft.address}</strong><span>{draft.approx ? "近似地址，請確認；" : ""}網格：{draft.grid} · {latLng(draft.x, draft.y)}</span></>}<small>拖動地圖以移動圖釘</small></div>
    </Popup>
  </div>;
}

export function SuccessMark() { return <CheckCircleFill className="m-success-mark" />; }

// ---- 篩選、原因輸入、NFC ----
export function FilterOptions({ value, options, onChange }: { value: string; options: [string, string][]; onChange: (value: string) => void }) {
  return <div className="m-filter-options">{options.map(([key, label]) => <button key={key} className={value === key ? "active" : ""} onClick={() => onChange(key)}>{label}{value === key && <CheckCircleFill />}</button>)}</div>;
}

export function ReasonDialog({ visible, title, description, placeholder = "請輸入原因", required, hideInput, hideCancel, maxLength = 200, confirmText = "確定", danger, onCancel, onConfirm }: {
  visible: boolean; title: string; description?: ReactNode; placeholder?: string; required?: boolean; hideInput?: boolean; hideCancel?: boolean; maxLength?: number; confirmText?: string; danger?: boolean;
  onCancel: () => void; onConfirm: (reason: string) => void;
}) {
  const [reason, setReason] = useState("");
  useEffect(() => { if (visible) setReason(""); }, [visible]);
  const blocked = !!required && !hideInput && !reason.trim();
  return <Dialog visible={visible} title={title} onClose={onCancel}
    content={<div className="m-reason">{description && <div className="m-reason-desc">{description}</div>}{!hideInput && <TextArea className="m-reason-input" placeholder={placeholder} value={reason} onChange={setReason} maxLength={maxLength} showCount rows={3} />}{blocked && reason.length > 0 && <small>請輸入內容</small>}</div>}
    actions={[[...(hideCancel ? [] : [{ key: "cancel", text: "取消", onClick: onCancel }]), { key: "ok", text: confirmText, bold: true, danger, disabled: blocked, onClick: () => onConfirm(reason.trim()) }]]} />;
}

export const nfcTags = [{ code: "NFC-0012", name: "黑沙環公園洗手間標籤", object: "公園洗手間" }, { code: "NFC-0003", name: "塔石廣場服務站標籤", object: "塔石廣場" }];

export function NfcPopup({ visible, expected, onClose, onScanned }: { visible: boolean; expected?: string; onClose: () => void; onScanned: (tag: (typeof nfcTags)[number]) => void }) {
  const [scanning, setScanning] = useState(false);
  useEffect(() => { if (!visible) setScanning(false); }, [visible]);
  const scan = () => { setScanning(true); window.setTimeout(() => onScanned(nfcTags.find((tag) => tag.code === expected) ?? nfcTags[0]), 1100); };
  return <Popup visible={visible} onMaskClick={onClose} bodyClassName="m-nfc">
    <div className={`m-nfc-wave ${scanning ? "active" : ""}`}><ScanningOutline /></div>
    <strong>{scanning ? "正在讀取標籤…" : "請將手機背面靠近 NFC 標籤"}</strong>
    <span>NFC 打卡可作室內或 GPS 精度不足時的輔助到場紀錄，不作強制，並與定位及軌跡互相參照。</span>
    <div className="m-nfc-actions"><Button onClick={onClose}>取消</Button><Button color="primary" loading={scanning} onClick={scan}>模擬感應標籤</Button></div>
  </Popup>;
}
