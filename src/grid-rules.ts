// Grid geometry, GeoJSON parsing and validation. Kept import-free so tests can transpile and run it directly.

export type Position = [number, number]; // [lng, lat]
export type Pt = [number, number]; // map pixel [x, y]
export interface GeoPolygon { type: "Polygon"; coordinates: Position[][] }
export interface GeoMultiPolygon { type: "MultiPolygon"; coordinates: Position[][][] }
export type GridGeometry = GeoPolygon | GeoMultiPolygon;
export type GridStatus = "啟用" | "停用";
export interface GridRecord { id: string; code: string; name: string; boundary: GridGeometry; status: GridStatus }

export const MAP_PX = { width: 1536, height: 1024 };
export const METERS_PER_PX = 2.6;
export const CODE_MAX = 32;
export const NAME_MAX = 50;
export const FILE_MAX_BYTES = 20 * 1024 * 1024;
const LNG0 = 113.52; const LNG_PER_PX = 0.0000658; const LAT0 = 22.215; const LAT_PER_PX = 0.000108;
/** Overlap larger than this share of the smaller grid (and above a small noise floor) is rejected. */
const OVERLAP_RATIO = 0.005; const OVERLAP_FLOOR_M2 = 50;
const round6 = (value: number) => Math.round(value * 1e6) / 1e6;

// ---- 投影（與 App 的 latLng 互逆） ----
export const lngLatToPx = ([lng, lat]: Position): Pt => [(lng - LNG0) / LNG_PER_PX, (LAT0 - lat) / LAT_PER_PX];
export const pxToLngLat = ([x, y]: Pt): Position => [round6(LNG0 + x * LNG_PER_PX), round6(LAT0 - y * LAT_PER_PX)];

/** Normalised polygons of a boundary: each is [outer, ...holes]. */
export function polygonsOf(boundary: GridGeometry): Position[][][] { return boundary.type === "Polygon" ? [boundary.coordinates] : boundary.coordinates; }
export const ringsPx = (boundary: GridGeometry): Pt[][] => polygonsOf(boundary).flatMap((polygon) => polygon.map((ring) => ring.map(lngLatToPx)));
export const vertexCount = (boundary: GridGeometry) => polygonsOf(boundary).reduce((sum, polygon) => sum + polygon.reduce((inner, ring) => inner + Math.max(0, ring.length - 1), 0), 0);
export const partCount = (boundary: GridGeometry) => polygonsOf(boundary).length;

/** A closed polygon from clicked map points. */
export function polygonFromPx(points: Pt[]): GeoPolygon {
  const ring = points.map(pxToLngLat); const first = ring[0];
  return { type: "Polygon", coordinates: [[...ring, first]] };
}

// ---- 幾何 ----
const ringArea = (ring: Pt[]) => { let sum = 0; for (let i = 0; i < ring.length - 1; i++) sum += ring[i][0] * ring[i + 1][1] - ring[i + 1][0] * ring[i][1]; return Math.abs(sum) / 2; };
export function areaM2(boundary: GridGeometry): number {
  const px = polygonsOf(boundary).reduce((sum, polygon) => { const [outer, ...holes] = polygon.map((ring) => ring.map(lngLatToPx)); return sum + ringArea(outer) - holes.reduce((inner, hole) => inner + ringArea(hole), 0); }, 0);
  return px * METERS_PER_PX * METERS_PER_PX;
}
const BOUNDARY_EPS = 0.05;
function onSegment(p: Pt, a: Pt, b: Pt) {
  const cross = (b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0]);
  const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
  if (length === 0) return Math.hypot(p[0] - a[0], p[1] - a[1]) <= BOUNDARY_EPS;
  if (Math.abs(cross) / length > BOUNDARY_EPS) return false;
  const dot = ((p[0] - a[0]) * (b[0] - a[0]) + (p[1] - a[1]) * (b[1] - a[1])) / length;
  return dot >= -BOUNDARY_EPS && dot <= length + BOUNDARY_EPS;
}
const crossings = (x: number, y: number, rings: Pt[][]) => {
  let inside = false;
  for (const ring of rings) for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i]; const [xj, yj] = ring[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
};
/** Even-odd containment over all rings (holes work); points on a boundary count as inside. */
export function pointInRings(x: number, y: number, rings: Pt[][]): boolean {
  for (const ring of rings) for (let i = 0; i < ring.length - 1; i++) if (onSegment([x, y], ring[i], ring[i + 1])) return true;
  return crossings(x, y, rings);
}
const bbox = (rings: Pt[][]) => { const xs = rings.flat().map((p) => p[0]); const ys = rings.flat().map((p) => p[1]); return { x1: Math.min(...xs), y1: Math.min(...ys), x2: Math.max(...xs), y2: Math.max(...ys) }; };

/** Proper crossings only: two non-adjacent edges that cross each other. */
export function selfIntersects(ring: Pt[]): boolean {
  const n = ring.length - 1;
  const orient = (a: Pt, b: Pt, c: Pt) => Math.sign((b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]));
  for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
    if (j === i + 1 || (i === 0 && j === n - 1)) continue;
    const [a, b, c, d] = [ring[i], ring[i + 1], ring[j], ring[j + 1]];
    if (orient(a, b, c) * orient(a, b, d) < 0 && orient(c, d, a) * orient(c, d, b) < 0) return true;
  }
  return false;
}

/** Overlap in m², sampled on a 2 px grid with offset centres so shapes that only touch along an edge give 0. */
export function overlapAreaM2(a: Pt[][], b: Pt[][]): number {
  const A = bbox(a); const B = bbox(b);
  const x1 = Math.max(A.x1, B.x1); const y1 = Math.max(A.y1, B.y1); const x2 = Math.min(A.x2, B.x2); const y2 = Math.min(A.y2, B.y2);
  if (x1 >= x2 || y1 >= y2) return 0;
  const step = 2; let count = 0;
  for (let x = x1 + 0.37; x < x2; x += step) for (let y = y1 + 0.61; y < y2; y += step) if (crossings(x, y, a) && crossings(x, y, b)) count++;
  return count * step * step * METERS_PER_PX * METERS_PER_PX;
}

// ---- 解析及驗證 ----
export interface ParsedFeature { index: number; geometry: unknown; properties: Record<string, unknown> }
export function parseGeoJSON(text: string): { features: ParsedFeature[]; error?: string } {
  let data: unknown;
  try { data = JSON.parse(text); } catch { return { features: [], error: "不是有效的 JSON，請檢查檔案內容。" }; }
  const obj = data as { type?: string; features?: unknown; geometry?: unknown; properties?: Record<string, unknown> } | null;
  if (!obj || typeof obj !== "object" || typeof obj.type !== "string") return { features: [], error: "不是有效的 GeoJSON：缺少 type。" };
  if (obj.type === "FeatureCollection") {
    if (!Array.isArray(obj.features) || !obj.features.length) return { features: [], error: "FeatureCollection 沒有任何要素。" };
    return { features: obj.features.map((feature, index) => { const f = feature as { type?: string; geometry?: unknown; properties?: Record<string, unknown> } | null; return { index, geometry: f?.type === "Feature" ? f.geometry : undefined, properties: (f?.properties && typeof f.properties === "object" ? f.properties : {}) as Record<string, unknown> }; }) };
  }
  if (obj.type === "Feature") return { features: [{ index: 0, geometry: obj.geometry, properties: (obj.properties && typeof obj.properties === "object" ? obj.properties : {}) as Record<string, unknown> }] };
  if (obj.type === "Polygon" || obj.type === "MultiPolygon") return { features: [{ index: 0, geometry: obj, properties: {} }] };
  return { features: [], error: `不支援的 GeoJSON 類型「${obj.type}」，請使用 FeatureCollection、Feature、Polygon 或 MultiPolygon。` };
}

const isPosition = (value: unknown): value is Position => Array.isArray(value) && value.length >= 2 && Number.isFinite(value[0]) && Number.isFinite(value[1]);
export function validateGeometry(geometry: unknown): { errors: string[]; boundary?: GridGeometry } {
  const g = geometry as { type?: string; coordinates?: unknown } | null | undefined;
  if (!g || typeof g !== "object") return { errors: ["缺少 geometry。"] };
  if (g.type !== "Polygon" && g.type !== "MultiPolygon") return { errors: [`要素須為 Polygon 或 MultiPolygon（目前為 ${String(g.type)}）。`] };
  const polygons: unknown[] = g.type === "Polygon" ? [g.coordinates] : Array.isArray(g.coordinates) ? g.coordinates : [];
  if (!polygons.length) return { errors: ["範圍沒有任何座標。"] };
  const errors: string[] = []; const clean: Position[][][] = [];
  polygons.forEach((polygon, pi) => {
    if (!Array.isArray(polygon) || !polygon.length) { errors.push(`第 ${pi + 1} 個多邊形沒有環。`); return; }
    const rings: Position[][] = [];
    (polygon as unknown[]).forEach((ring, ri) => {
      const label = `第 ${pi + 1} 個多邊形的${ri === 0 ? "外環" : `第 ${ri} 個內環`}`;
      if (!Array.isArray(ring) || ring.length < 4) { errors.push(`${label}至少需要 4 個座標點（含閉合點）。`); return; }
      if (!ring.every(isPosition)) { errors.push(`${label}含有無效座標。`); return; }
      const positions = (ring as Position[]).map(([lng, lat]) => [lng, lat] as Position);
      const first = positions[0]; const last = positions[positions.length - 1];
      if (first[0] !== last[0] || first[1] !== last[1]) { errors.push(`${label}沒有閉合（首尾座標須相同）。`); return; }
      const px = positions.map(lngLatToPx);
      if (px.some(([x, y]) => x < 0 || y < 0 || x > MAP_PX.width || y > MAP_PX.height)) errors.push(`${label}有座標超出地圖範圍。`);
      if (selfIntersects(px)) errors.push(`${label}的邊界自相交。`);
      else if (ringArea(px) < 1) errors.push(`${label}面積為零。`);
      rings.push(positions);
    });
    clean.push(rings);
  });
  if (errors.length) return { errors };
  return { errors, boundary: g.type === "Polygon" ? { type: "Polygon", coordinates: clean[0] } : { type: "MultiPolygon", coordinates: clean } };
}

const pad3 = (n: number) => String(n).padStart(3, "0");
export function nextCode(codes: string[]): string {
  const max = codes.reduce((value, code) => { const match = code.match(/^GRID(\d+)$/i); return match ? Math.max(value, Number(match[1])) : value; }, 0);
  return `GRID${pad3(max + 1)}`;
}
export const nextId = (ids: string[]) => String(Math.max(0, ...ids.map((id) => Number(id) || 0)) + 1);
const CODE_PATTERN = /^[A-Za-z0-9_-]+$/;
const lower = (text: string) => text.trim().toLowerCase();

function overlapMessage(candidate: Pt[][], candidateArea: number, other: { name: string; boundary: GridGeometry }): string | null {
  const overlap = overlapAreaM2(candidate, ringsPx(other.boundary));
  if (overlap <= 0) return null;
  const smaller = Math.min(candidateArea, areaM2(other.boundary));
  if (overlap <= Math.max(smaller * OVERLAP_RATIO, OVERLAP_FLOOR_M2)) return null;
  return `與「${other.name}」重疊約 ${formatArea(overlap)}（佔較小網格 ${(overlap / smaller * 100).toFixed(1)}%）。`;
}

export interface GridDraft { code: string; name: string; geometry: unknown }
/** Single grid (create form). A blank code gets an automatic one. */
export function validateGrid(draft: GridDraft, existing: GridRecord[], editingId?: string): { errors: string[]; record?: { code: string; name: string; boundary: GridGeometry } } {
  const errors: string[] = []; const others = existing.filter((grid) => grid.id !== editingId);
  const code = draft.code.trim(); const name = draft.name.trim();
  if (code) {
    if (code.length > CODE_MAX) errors.push(`網格編號不可超過 ${CODE_MAX} 字。`);
    else if (!CODE_PATTERN.test(code)) errors.push("網格編號只可使用英文字母、數字、- 及 _。");
    else if (others.some((grid) => lower(grid.code) === lower(code))) errors.push(`網格編號「${code}」已存在。`);
  }
  if (!name) errors.push("請輸入網格名稱。"); else if ([...name].length > NAME_MAX) errors.push(`網格名稱不可超過 ${NAME_MAX} 字。`);
  else if (others.some((grid) => lower(grid.name) === lower(name))) errors.push(`網格名稱「${name}」已存在。`);
  const checked = validateGeometry(draft.geometry);
  errors.push(...checked.errors);
  if (checked.boundary) {
    const px = ringsPx(checked.boundary); const area = areaM2(checked.boundary);
    others.forEach((other) => { const message = overlapMessage(px, area, other); if (message) errors.push(message); });
  }
  if (errors.length || !checked.boundary) return { errors };
  return { errors, record: { code: code || nextCode(existing.map((grid) => grid.code)), name, boundary: checked.boundary } };
}

/** Name-only check for editing: the range is read-only there, so it is not re-validated. */
export function validateGridName(name: string, existing: GridRecord[], editingId: string): string[] {
  const trimmed = name.trim();
  if (!trimmed) return ["請輸入網格名稱。"];
  if ([...trimmed].length > NAME_MAX) return [`網格名稱不可超過 ${NAME_MAX} 字。`];
  if (existing.some((grid) => grid.id !== editingId && lower(grid.name) === lower(trimmed))) return [`網格名稱「${trimmed}」已存在。`];
  return [];
}

export type ImportMode = "覆蓋範圍" | "略過";
export interface ImportRow { index: number; code: string; name: string; action: "新增" | "覆蓋" | "略過"; errors: string[]; areaM2: number; vertices: number; boundary?: GridGeometry; targetId?: string }

/** A whole file. Any failing feature makes `ok` false, and then nothing is imported. */
export function validateImport(features: ParsedFeature[], existing: GridRecord[], mode: ImportMode): { rows: ImportRow[]; ok: boolean; applyCount: number; records?: GridRecord[] } {
  const rows: ImportRow[] = features.map((feature) => {
    const name = typeof feature.properties.name === "string" ? feature.properties.name.trim() : ""; const code = typeof feature.properties.code === "string" ? feature.properties.code.trim() : "";
    const target = (code ? existing.find((grid) => lower(grid.code) === lower(code)) : undefined) ?? (!code && name ? existing.find((grid) => lower(grid.name) === lower(name)) : undefined);
    const checked = validateGeometry(feature.geometry);
    const action: ImportRow["action"] = target ? (mode === "略過" ? "略過" : "覆蓋") : "新增";
    const row: ImportRow = { index: feature.index, code: target?.code ?? code, name: target?.name ?? name, action, errors: action === "略過" ? [] : [...checked.errors], areaM2: checked.boundary ? areaM2(checked.boundary) : 0, vertices: checked.boundary ? vertexCount(checked.boundary) : 0, boundary: checked.boundary, targetId: target?.id };
    if (action === "略過") return row;
    if (action === "新增") { if (!name) row.errors.push("缺少 name 屬性。"); else if ([...name].length > NAME_MAX) row.errors.push(`網格名稱不可超過 ${NAME_MAX} 字。`); }
    if (code) { if (code.length > CODE_MAX) row.errors.push(`網格編號不可超過 ${CODE_MAX} 字。`); else if (!CODE_PATTERN.test(code)) row.errors.push("網格編號只可使用英文字母、數字、- 及 _。"); }
    if (action === "新增" && name && existing.some((grid) => lower(grid.name) === lower(name))) row.errors.push(`網格名稱「${name}」已被其他網格使用。`);
    return row;
  });
  // duplicates inside the file
  const live = rows.filter((row) => row.action !== "略過");
  live.forEach((row, i) => live.slice(0, i).forEach((earlier) => {
    if (row.targetId && row.targetId === earlier.targetId) row.errors.push(`與第 ${earlier.index + 1} 個要素指向同一個網格「${row.name}」。`);
    else if (!row.targetId && earlier.name && row.name && lower(row.name) === lower(earlier.name) && !earlier.targetId) row.errors.push(`網格名稱「${row.name}」在檔內重複（第 ${earlier.index + 1} 個要素）。`);
    if (!row.targetId && row.code && earlier.code && lower(row.code) === lower(earlier.code) && !earlier.targetId) row.errors.push(`網格編號「${row.code}」在檔內重複（第 ${earlier.index + 1} 個要素）。`);
  }));
  // codes for new features without one
  const codes = [...existing.map((grid) => grid.code), ...rows.map((row) => row.code).filter(Boolean)];
  rows.forEach((row) => { if (row.action === "新增" && !row.code) { row.code = nextCode(codes); codes.push(row.code); } });
  // overlap against the grids that remain, then inside the file
  const replaced = new Set(rows.filter((row) => row.action === "覆蓋").map((row) => row.targetId));
  const remaining = existing.filter((grid) => !replaced.has(grid.id));
  live.forEach((row, i) => {
    if (!row.boundary) return;
    const px = ringsPx(row.boundary);
    remaining.forEach((other) => { const message = overlapMessage(px, row.areaM2, other); if (message) row.errors.push(message); });
    live.slice(0, i).forEach((earlier) => { if (earlier.boundary) { const message = overlapMessage(px, row.areaM2, { name: earlier.name || `第 ${earlier.index + 1} 個要素`, boundary: earlier.boundary }); if (message) row.errors.push(message); } });
  });
  const applyCount = live.length; const failed = live.some((row) => row.errors.length > 0);
  if (failed || !applyCount) return { rows, ok: false, applyCount };
  let ids = existing.map((grid) => grid.id);
  const records: GridRecord[] = existing.map((grid) => { const row = rows.find((entry) => entry.action === "覆蓋" && entry.targetId === grid.id); return row ? { ...grid, boundary: row.boundary! } : grid; });
  rows.filter((row) => row.action === "新增").forEach((row) => { const id = nextId(ids); ids = [...ids, id]; records.push({ id, code: row.code, name: row.name, boundary: row.boundary!, status: "啟用" }); });
  return { rows, ok: true, applyCount, records };
}

// ---- 歸屬 ----
export interface Locator { name: string; rings: Pt[][] }
export const buildLocator = (grids: GridRecord[]): Locator[] => grids.filter((grid) => grid.status === "啟用").map((grid) => ({ name: grid.name, rings: ringsPx(grid.boundary) }));
/** First matching enabled grid in list order, boundary inclusive; null when none matches (未歸屬). */
export function locateGrid(locator: Locator[], x: number, y: number): string | null { return locator.find((entry) => pointInRings(x, y, entry.rings))?.name ?? null; }
export const countPoints = (grid: GridRecord, points: { x: number; y: number }[]) => { const rings = ringsPx(grid.boundary); return points.filter((point) => pointInRings(point.x, point.y, rings)).length; };

/** Records whose grid would change; records without a position are skipped. */
export function reassignPatches<T extends { id: string; grid: string; x?: number; y?: number }>(items: T[], locate: (x: number, y: number) => string): { id: string; from: string; to: string }[] {
  return items.flatMap((item) => { if (item.x === undefined || item.y === undefined) return []; const to = locate(item.x, item.y); return to !== item.grid ? [{ id: item.id, from: item.grid, to }] : []; });
}

// ---- 呈現及檔案 ----
export function formatArea(m2: number): string {
  if (m2 >= 1e6) return `${(m2 / 1e6).toFixed(2)} km²`;
  return `${Math.round(m2).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",")} m²`;
}
export function toFeatureCollection(grids: GridRecord[]) {
  return { type: "FeatureCollection", features: grids.map((grid) => ({ type: "Feature", properties: { code: grid.code, name: grid.name, status: grid.status }, geometry: grid.boundary })) };
}
/** Two small grids in an unused part of the demo map, for trying the import. */
export function sampleFeatureCollection() {
  const rect = (x1: number, y1: number, x2: number, y2: number): GeoPolygon => polygonFromPx([[x1, y1], [x2, y1], [x2, y2], [x1, y2]]);
  return { type: "FeatureCollection", features: [
    { type: "Feature", properties: { code: "SAMPLE-A", name: "示範新網格 A" }, geometry: rect(630, 240, 720, 320) },
    { type: "Feature", properties: { name: "示範新網格 B" }, geometry: rect(730, 240, 820, 320) },
  ] };
}

// ---- 種子網格 ----
const rect = (x1: number, y1: number, x2: number, y2: number): Pt[] => [[x1, y1], [x2, y1], [x2, y2], [x1, y2]];
/**
 * The App's original 7 rectangles overlapped in places. These shapes keep the old first-match result at every point
 * (an earlier grid keeps its area; a later one gives way with an L-shaped cut) while no two grids overlap any more.
 */
const seedShapes: { name: string; ring: Pt[] }[] = [
  { name: "花地瑪堂北區", ring: rect(540, 40, 760, 230) },
  { name: "花地瑪堂西區", ring: rect(400, 100, 540, 260) },
  { name: "望德堂中區", ring: [[540, 230], [620, 230], [620, 285], [520, 285], [520, 260], [540, 260]] },
  { name: "大堂中區", ring: [[470, 260], [520, 260], [520, 285], [600, 285], [600, 340], [470, 340]] },
  { name: "大堂南區", ring: [[380, 300], [470, 300], [470, 340], [520, 340], [520, 420], [380, 420]] },
  { name: "氹仔中央區", ring: rect(510, 440, 920, 640) },
  { name: "路環東區", ring: rect(590, 640, 1200, 1000) },
];
export const seedGrids = (): GridRecord[] => seedShapes.map((shape, index) => ({ id: String(index + 1), code: `GRID${pad3(index + 1)}`, name: shape.name, boundary: polygonFromPx(shape.ring), status: "啟用" }));

// ---- 對象用的形狀及網格查找 ----
export interface GeoPoint { type: "Point"; coordinates: Position }
export type ObjectShape = GeoPoint | GridGeometry;

/** The first enabled grid (in list order) that contains the map point; boundary inclusive. */
export function locateGridRecord(grids: GridRecord[], x: number, y: number): GridRecord | undefined {
  return grids.find((grid) => grid.status === "啟用" && pointInRings(x, y, ringsPx(grid.boundary)));
}

/** An object's map file: a Point, Polygon or MultiPolygon inside the map. */
export function validateObjectShape(shape: unknown): { errors: string[]; shape?: ObjectShape } {
  const s = shape as { type?: string; coordinates?: unknown } | null | undefined;
  if (!s || typeof s !== "object") return { errors: ["缺少 geometry。"] };
  if (s.type === "Point") {
    const c = s.coordinates;
    if (!Array.isArray(c) || c.length < 2 || !Number.isFinite(c[0]) || !Number.isFinite(c[1])) return { errors: ["Point 的座標無效。"] };
    const [x, y] = lngLatToPx([c[0], c[1]]);
    if (x < 0 || y < 0 || x > MAP_PX.width || y > MAP_PX.height) return { errors: ["Point 座標超出地圖範圍。"] };
    return { errors: [], shape: { type: "Point", coordinates: [c[0], c[1]] } };
  }
  if (s.type === "Polygon" || s.type === "MultiPolygon") { const checked = validateGeometry(s); return { errors: checked.errors, shape: checked.boundary }; }
  return { errors: [`地圖檔案須為 Point、Polygon 或 MultiPolygon（目前為 ${String(s.type)}）。`] };
}
