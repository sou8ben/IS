import { useCallback, useEffect, useLayoutEffect, useRef, useState, type PointerEvent, type ReactNode } from "react";
import { CloseOutlined, CompressOutlined, MinusOutlined, PlusOutlined } from "@ant-design/icons";
import type { Point } from "./plan-rules";

const MAP = { width: 1536, height: 1024 };
const mapImageUrl = `${import.meta.env.BASE_URL}assets/macau-operations-map.png`;

export type MarkerTone = "todo" | "done" | "issue" | "event" | "work" | "object";
export interface MapMarkerSpec { id: string; kind: "inspection" | "event" | "work" | "object"; x: number; y: number; tone: MarkerTone; label?: string; title: string; detail?: ReactNode; /** Can be dragged when the map has `onMarkerDrag`. */ draggable?: boolean }
export interface MapTrackSpec { id: string; name: string; color: string; points: [number, number, string][] }
/** An area on the map (a grid). With `closed: false` it draws as an open path, for a polygon being drawn. */
export interface MapPolygonSpec { id: string; rings: Point[][]; label?: string; title?: string; detail?: ReactNode; color?: string; selected?: boolean; dim?: boolean; dashed?: boolean; closed?: boolean }
export interface MapLayerChip { key: string; label: string; count?: number; on: boolean }

interface View { cx: number; cy: number; zoom: number }

export function PlanMap({ route, ghostRoute, markers = [], tracks = [], polygons = [], onPolygonClick, fitPolygon, layers, onToggleLayer, selected, onSelect, onPick, onMarkerDrag, onMarkerDragEnd, legend, fitKey = "", className = "" }: {
  route?: Point[]; ghostRoute?: Point[]; markers?: MapMarkerSpec[]; tracks?: MapTrackSpec[]; polygons?: MapPolygonSpec[]; /** Makes polygons clickable; without it they ignore the pointer so map picking still works. */ onPolygonClick?: (id: string) => void; /** Fit to this polygon only, instead of everything. */ fitPolygon?: string; layers?: MapLayerChip[]; onToggleLayer?: (key: string) => void;
  selected?: string | null; onSelect?: (id: string | null) => void; /** Click on the map background (not a drag) reports the map pixel position. */ onPick?: (point: Point) => void; /** Dragging a `draggable` marker reports its new map pixel position as it moves. */ onMarkerDrag?: (id: string, point: Point) => void; /** Called once when a marker drag ends (after at least one move). */ onMarkerDragEnd?: (id: string) => void; legend?: ReactNode; fitKey?: string; className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [view, setView] = useState<View | null>(null);
  const [popup, setPopup] = useState<string | null>(null);
  const drag = useRef<{ x: number; y: number; view: View; moved: boolean } | null>(null);
  const suppressClick = useRef(false);
  const markerDrag = useRef<{ id: string; x: number; y: number; moved: boolean } | null>(null);
  const [dragging, setDragging] = useState<string | null>(null);

  useLayoutEffect(() => {
    const element = ref.current; if (!element) return;
    const measure = () => setSize({ w: element.clientWidth, h: element.clientHeight });
    const observer = new ResizeObserver(measure); observer.observe(element); measure();
    return () => observer.disconnect();
  }, []);

  const clamp = useCallback((next: View): View => {
    if (!size.w || !size.h) return next;
    const minZoom = Math.max(1, (size.h / size.w) * (MAP.width / MAP.height));
    const zoom = Math.min(14, Math.max(minZoom, next.zoom));
    const halfW = MAP.width / zoom / 2; const halfH = halfW * size.h / size.w;
    return { zoom, cx: Math.min(MAP.width - halfW, Math.max(halfW, next.cx)), cy: Math.min(MAP.height - halfH, Math.max(halfH, next.cy)) };
  }, [size.w, size.h]);

  const fit = useCallback(() => {
    if (!size.w || !size.h) return;
    const points = [...(route ?? []), ...(fitPolygon ? polygons.filter((polygon) => polygon.id === fitPolygon) : polygons).flatMap((polygon) => polygon.rings.flat()), ...markers.map((marker): Point => [marker.x, marker.y]), ...tracks.flatMap((track) => track.points.map(([x, y]): Point => [x, y]))];
    if (!points.length) { setView(clamp({ cx: MAP.width / 2, cy: MAP.height / 2, zoom: 1 })); return; }
    const xs = points.map((point) => point[0]); const ys = points.map((point) => point[1]);
    const bw = Math.max(Math.max(...xs) - Math.min(...xs) + 90, 240); const bh = Math.max(Math.max(...ys) - Math.min(...ys) + 90, 240);
    const viewWidth = Math.max(bw, bh * size.w / size.h);
    setView(clamp({ cx: (Math.max(...xs) + Math.min(...xs)) / 2, cy: (Math.max(...ys) + Math.min(...ys)) / 2, zoom: MAP.width / viewWidth }));
  }, [size.w, size.h, route, markers, tracks, polygons, clamp]);

  // Fit once the size is known and whenever the caller changes what the map is about.
  useEffect(() => { if (size.w) fit(); }, [size.w, size.h, fitKey]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!selected) { setPopup(null); return; }
    setPopup(selected);
    const marker = markers.find((item) => item.id === selected);
    if (marker) setView((current) => current ? clamp({ ...current, cx: marker.x, cy: marker.y }) : current);
  }, [selected]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const element = ref.current; if (!element) return;
    const wheel = (event: WheelEvent) => { event.preventDefault(); setView((current) => current ? clamp({ ...current, zoom: current.zoom * (event.deltaY < 0 ? 1.2 : 1 / 1.2) }) : current); };
    element.addEventListener("wheel", wheel, { passive: false });
    return () => element.removeEventListener("wheel", wheel);
  }, [clamp]);

  const current = view ?? { cx: MAP.width / 2, cy: MAP.height / 2, zoom: 1 };
  const vbW = MAP.width / current.zoom; const vbH = size.w ? vbW * size.h / size.w : MAP.height;
  const vbX = current.cx - vbW / 2; const vbY = current.cy - vbH / 2;
  const scale = size.w ? size.w / vbW : 1; // screen px per map px
  const u = (px: number) => px / scale; // screen px → map units, keeps symbols a constant size
  const zoomBy = (factor: number) => setView((value) => value ? clamp({ ...value, zoom: value.zoom * factor }) : value);

  // Capture the pointer only once a drag starts, so plain clicks still reach the markers.
  const toMap = (event: PointerEvent<HTMLDivElement>): Point => {
    const rect = event.currentTarget.getBoundingClientRect();
    return [Math.round(Math.min(MAP.width, Math.max(0, vbX + (event.clientX - rect.left) / scale))), Math.round(Math.min(MAP.height, Math.max(0, vbY + (event.clientY - rect.top) / scale)))];
  };
  const down = (event: PointerEvent<HTMLDivElement>) => {
    suppressClick.current = false;
    if ((event.target as Element).closest("button, .plan-map-popup")) return;
    const handle = onMarkerDrag ? (event.target as Element).closest<SVGGElement>(".plan-map-marker.draggable") : null;
    if (handle?.dataset.id) { markerDrag.current = { id: handle.dataset.id, x: event.clientX, y: event.clientY, moved: false }; return; }
    drag.current = { x: event.clientX, y: event.clientY, view: current, moved: false };
  };
  const move = (event: PointerEvent<HTMLDivElement>) => {
    const handle = markerDrag.current;
    if (handle) {
      if (!handle.moved && Math.abs(event.clientX - handle.x) + Math.abs(event.clientY - handle.y) > 3) { handle.moved = true; event.currentTarget.setPointerCapture(event.pointerId); setDragging(handle.id); setPopup(null); }
      if (handle.moved) onMarkerDrag?.(handle.id, toMap(event));
      return;
    }
    const start = drag.current; if (!start) return;
    const dx = event.clientX - start.x; const dy = event.clientY - start.y;
    if (!start.moved && Math.abs(dx) + Math.abs(dy) > 3) { start.moved = true; event.currentTarget.setPointerCapture(event.pointerId); }
    if (start.moved) setView(clamp({ ...start.view, cx: start.view.cx - dx / scale, cy: start.view.cy - dy / scale }));
  };
  const up = (event: PointerEvent<HTMLDivElement>) => {
    const handle = markerDrag.current;
    if (handle) { markerDrag.current = null; suppressClick.current = handle.moved; setDragging(null); if (handle.moved) onMarkerDragEnd?.(handle.id); return; }
    const start = drag.current; suppressClick.current = !!start?.moved; drag.current = null;
    if (start && !start.moved && onPick && !(event.target as Element).closest(`.plan-map-marker, .plan-map-popup${onPolygonClick ? ", .plan-map-polygon" : ""}`)) {
      onPick(toMap(event));
    }
  };
  const pick = (id: string) => { if (suppressClick.current) { suppressClick.current = false; return; } setPopup(id); onSelect?.(id); };
  const pickPolygon = (id: string) => { if (suppressClick.current) { suppressClick.current = false; return; } setPopup(id); onPolygonClick?.(id); };

  const routePoints = (points: Point[]) => points.map(([x, y]) => `${x},${y}`).join(" ");
  const arrows = (route ?? []).slice(1).map((point, index) => {
    const from = route![index]; const angle = Math.atan2(point[1] - from[1], point[0] - from[0]) * 180 / Math.PI;
    return <path key={index} className="plan-map-arrow" d="M -5 -4 L 5 0 L -5 4 Z" transform={`translate(${(from[0] + point[0]) / 2} ${(from[1] + point[1]) / 2}) rotate(${angle}) scale(${u(1)})`} />;
  });
  const ringArea = (ring: Point[]) => { let sum = 0; for (let i = 0; i < ring.length - 1; i++) sum += ring[i][0] * ring[i + 1][1] - ring[i + 1][0] * ring[i][1]; return sum / 2; };
  /** Area-weighted centre of the polygon's largest ring, or the mean of the points for an open path. */
  const centroidOf = (polygon: MapPolygonSpec): Point => {
    const ring = [...polygon.rings].sort((a, b) => Math.abs(ringArea(b)) - Math.abs(ringArea(a)))[0] ?? [];
    if (!ring.length) return [0, 0];
    const area = ringArea(ring);
    if (polygon.closed === false || Math.abs(area) < 1e-6) return [ring.reduce((sum, p) => sum + p[0], 0) / ring.length, ring.reduce((sum, p) => sum + p[1], 0) / ring.length];
    let cx = 0; let cy = 0;
    for (let i = 0; i < ring.length - 1; i++) { const f = ring[i][0] * ring[i + 1][1] - ring[i + 1][0] * ring[i][1]; cx += (ring[i][0] + ring[i + 1][0]) * f; cy += (ring[i][1] + ring[i + 1][1]) * f; }
    return [cx / (6 * area), cy / (6 * area)];
  };
  const pathOf = (polygon: MapPolygonSpec) => polygon.rings.map((ring) => `M${ring.map(([x, y]) => `${x} ${y}`).join(" L")}${polygon.closed === false ? "" : " Z"}`).join(" ");
  const popupPolygon = polygons.find((polygon) => polygon.id === popup && (polygon.detail || polygon.title));
  const popupMarker = markers.find((marker) => marker.id === popup);
  const popupAt: Point | undefined = popupMarker ? [popupMarker.x, popupMarker.y] : popupPolygon ? centroidOf(popupPolygon) : undefined;
  const anchor = popupAt ? { x: (popupAt[0] - vbX) * scale, y: (popupAt[1] - vbY) * scale } : undefined;
  const popupRef = useRef<HTMLDivElement>(null);
  const [placement, setPlacement] = useState({ below: false, left: 0, arrow: 0 });
  // Measure the popup before paint: flip it below the point when it would be cut off at the top, and keep it inside the map sideways.
  useLayoutEffect(() => {
    const element = popupRef.current; if (!element || !anchor) return;
    const w = element.offsetWidth; const h = element.offsetHeight; const margin = 8;
    const left = size.w > w + margin * 2 ? Math.min(size.w - w / 2 - margin, Math.max(w / 2 + margin, anchor.x)) : anchor.x;
    const next = { below: anchor.y - h - 18 < margin && anchor.y + h + 18 <= size.h - margin, left, arrow: anchor.x - left };
    setPlacement((current) => current.below === next.below && current.left === next.left && current.arrow === next.arrow ? current : next);
  });

  return <div className={`plan-map ${className}`}>
    <div ref={ref} className="plan-map-canvas" onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}>
      <svg viewBox={`${vbX} ${vbY} ${vbW} ${vbH}`} preserveAspectRatio="none" role="img" aria-label="巡查計劃地圖">
        <image href={mapImageUrl} x={0} y={0} width={MAP.width} height={MAP.height} preserveAspectRatio="none" />
        {polygons.map((polygon) => <path key={polygon.id} className={`plan-map-polygon ${onPolygonClick ? "interactive" : ""} ${polygon.selected ? "selected" : ""} ${polygon.dim ? "dim" : ""} ${polygon.dashed ? "dashed" : ""} ${polygon.closed === false ? "open" : ""}`} style={{ color: polygon.color }} d={pathOf(polygon)} fillRule="evenodd" onClick={onPolygonClick ? () => pickPolygon(polygon.id) : undefined}><title>{polygon.label ?? polygon.title}</title></path>)}
        {polygons.filter((polygon) => polygon.label && polygon.closed !== false).map((polygon) => { const [x, y] = centroidOf(polygon); return <text key={`label-${polygon.id}`} className={`plan-map-polygon-label ${polygon.dim ? "dim" : ""}`} transform={`translate(${x} ${y}) scale(${u(1)})`}>{polygon.label}</text>; })}
        {ghostRoute && ghostRoute.length > 1 && <polyline className="plan-map-ghost" points={routePoints(ghostRoute)} />}
        {route && route.length > 1 && <g>
          <polyline className="plan-map-route-casing" points={routePoints(route)} />
          <polyline className="plan-map-route" points={routePoints(route)} />
          {arrows}
          {[["起", route[0]], ["終", route[route.length - 1]]].map(([text, point]) => { const [x, y] = point as Point; return <g key={text as string} className="plan-map-terminal" transform={`translate(${x} ${y}) scale(${u(1)})`}><circle r={9} /><text dy={3.5}>{text as string}</text></g>; })}
        </g>}
        {tracks.map((track) => { const last = track.points[track.points.length - 1]; return <g key={track.id} className="plan-map-track" style={{ color: track.color }}>
          <polyline points={track.points.map(([x, y]) => `${x},${y}`).join(" ")} />
          <g transform={`translate(${last[0]} ${last[1]}) scale(${u(1)})`}><circle r={6} /><text x={9} dy={4}>{track.name} {last[2]}</text></g>
        </g>; })}
        {markers.map((marker) => {
          const active = popup === marker.id || dragging === marker.id; const draggable = !!onMarkerDrag && !!marker.draggable;
          return <g key={marker.id} data-id={marker.id} className={`plan-map-marker kind-${marker.kind} tone-${marker.tone} ${active ? "active" : ""} ${draggable ? "draggable" : ""} ${dragging === marker.id ? "dragging" : ""}`} transform={`translate(${marker.x} ${marker.y}) scale(${u(active ? 1.25 : 1)})`} onClick={() => pick(marker.id)}>
            <title>{marker.title}</title>
            {marker.kind === "event" ? <rect x={-8} y={-8} width={16} height={16} rx={2} transform="rotate(45)" /> : marker.kind === "work" ? <rect x={-9} y={-9} width={18} height={18} rx={4} /> : <circle r={11} />}
            {marker.label && <text dy={4}>{marker.label}</text>}
          </g>;
        })}
      </svg>
      {anchor && (popupMarker || popupPolygon) && <div ref={popupRef} className={`plan-map-popup ${placement.below ? "below" : ""}`} style={{ left: placement.left || anchor.x, top: anchor.y, ["--arrow-x" as string]: `calc(50% + ${placement.arrow}px)` }}>
        <button type="button" className="plan-map-popup-close" aria-label="關閉" onClick={() => { setPopup(null); onSelect?.(null); }}><CloseOutlined /></button>
        <strong>{popupMarker?.title ?? popupPolygon?.title ?? popupPolygon?.label}</strong>{popupMarker?.detail ?? popupPolygon?.detail}
      </div>}
    </div>
    {layers && <div className="plan-map-layers" role="group" aria-label="地圖圖層">{layers.map((layer) => <button type="button" key={layer.key} className={layer.on ? "on" : ""} aria-pressed={layer.on} onClick={() => onToggleLayer?.(layer.key)}>{layer.label}{layer.count !== undefined && <span>{layer.count}</span>}</button>)}</div>}
    <div className="plan-map-zoom"><button type="button" aria-label="放大" onClick={() => zoomBy(1.4)}><PlusOutlined /></button><button type="button" aria-label="縮小" onClick={() => zoomBy(1 / 1.4)}><MinusOutlined /></button><button type="button" aria-label="顯示全部" onClick={fit}><CompressOutlined /></button></div>
    {legend && <div className="plan-map-legend">{legend}</div>}
  </div>;
}

export function LegendItem({ tone, children }: { tone: MarkerTone | "route" | "track" | "ghost"; children: ReactNode }) {
  return <span className="plan-map-legend-item"><i className={`legend-${tone}`} />{children}</span>;
}
