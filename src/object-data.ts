import { addressBook, myLocation, objectGroups, photoAssets, planObjects, METERS_PER_PX, workTypeTree } from "./app/data";
import type { MapObject } from "./app/types";
import { pointInRings, pxToLngLat, ringsPx, seedGrids, type GridRecord } from "./grid-rules";
import { inspectionTypes, objectCatalog } from "./inspection-templates";
import { assignGrid, dispatchGroupOf, DISPATCH_CATEGORY, pxOf, type ManagedObject } from "./object-rules";

export { inspectionTypes };
/** Top-level work types, as the dispatch lookup uses them. */
export const workTypeTops = workTypeTree.map((node) => node.value);

// The App names its object types differently from the inspection types.
const appTypeToInspection: Record<string, string> = { "公園設施": "公園設施巡查", "海濱設施": "海濱設施巡查", "街道環境": "街道環境巡查", "步道設施": "綠化設施巡查" };
const inspectionToAppType: Record<string, string> = { "公園設施巡查": "公園設施", "海濱設施巡查": "海濱設施", "街道環境巡查": "街道環境", "綠化設施巡查": "步道設施", "公共廁所巡查": "公共廁所" };

const seedGridList = seedGrids();
const gridByName = (name: string) => seedGridList.find((grid) => grid.name === name);
/** A deterministic point inside the named grid, for seed objects that had no position. */
function placeInGrid(name: string, index: number): [number, number] {
  const grid = gridByName(name); if (!grid) return [640, 112];
  const rings = ringsPx(grid.boundary); const xs = rings.flat().map((p) => p[0]); const ys = rings.flat().map((p) => p[1]);
  const inside: [number, number][] = [];
  for (let x = Math.min(...xs) + 15; x < Math.max(...xs); x += 30) for (let y = Math.min(...ys) + 15; y < Math.max(...ys); y += 30) if (pointInRings(x, y, rings)) inside.push([x, y]);
  return inside.length ? inside[(index * 5) % inside.length] : [Math.min(...xs) + 5, Math.min(...ys) + 5];
}

function seed(base: { id: string; inspectionType: string; name: string; address: string; px: [number, number]; claimedGrid: string; nfc?: string; demoDistance?: number }, index: number): ManagedObject {
  const [lng, lat] = pxToLngLat(base.px);
  const draft = { gridAssignMode: "自動" as const, gridId: null, latitude: lat, longitude: lng };
  const located = assignGrid(draft, seedGridList);
  const claimed = gridByName(base.claimedGrid);
  // keep today's grid exactly: when the position falls elsewhere than the stated grid, pin the stated one manually
  const manual = !!claimed && claimed.id !== located;
  return {
    id: base.id, inspectionType: base.inspectionType, gridId: manual ? claimed!.id : located, gridAssignMode: manual ? "手動" : "自動", code: base.id, name: base.name, address: base.address,
    latitude: lat, longitude: lng, geojson: null, attachments: [], workGroups: [], status: "啟用", nfc: base.nfc, demoDistance: base.demoDistance,
  };
}

// Seed object files for the 對象附件 輔助資料, generated for every object by inspection type: documents (no stored content)
// and photos that open (the App's demo images).
type Attachments = ManagedObject["attachments"];
const doc = (id: string, n: number, name: string) => ({ id: `${id}-ATT-${n}`, name, size: 245_760, kind: "file" as const });
const photo = (id: string, n: number, name: string, src: string) => ({ id: `${id}-ATT-${n}`, name, size: 120_000, kind: "image" as const, src });
const hash = (text: string) => [...text].reduce((sum, char) => (sum * 31 + char.charCodeAt(0)) % 997, 7);
const filesByType: Record<string, (id: string) => Attachments> = {
  "公園設施巡查": (id) => [photo(id, 1, "設施相片.jpg", photoAssets.seat), doc(id, 2, "燈具保養記錄（2026-08）.pdf"), doc(id, 3, "水管走向圖.pdf"), ...(hash(id) % 3 === 0 ? [doc(id, 4, "燈具保養記錄（2026-05）.pdf")] : [])],
  "海濱設施巡查": (id) => [photo(id, 1, "設施相片.jpg", photoAssets.seat), doc(id, 2, "燈具保養記錄（2026-08）.pdf"), doc(id, 3, "欄杆結構圖.pdf"), doc(id, 4, "步道維修記錄（2026-07）.pdf")],
  "街道環境巡查": (id) => [photo(id, 1, "設施相片.jpg", photoAssets.bin), photo(id, 2, "指示牌設計圖.jpg", photoAssets.sign), doc(id, 3, "路燈保養記錄（2026-08）.pdf"), doc(id, 4, "路面維修記錄（2026-07）.pdf")],
  "綠化設施巡查": (id) => [photo(id, 1, "樹木相片.jpg", photoAssets.tree), photo(id, 2, "設施相片.jpg", photoAssets.tree), doc(id, 3, "樹木登記表.pdf"), doc(id, 4, "水管走向圖.pdf")],
  "公共廁所巡查": (id) => [photo(id, 1, "設施相片.jpg", photoAssets.bin), doc(id, 2, "清潔排班表.pdf")],
};
/** Seed files of an object (by its inspection type). */
export const seedFilesFor = (object: Pick<ManagedObject, "id" | "inspectionType">): Attachments => filesByType[object.inspectionType]?.(object.id) ?? [];
// Earlier seeds: stored objects still holding exactly one of them (or nothing) get the current seed files on load; uploaded files are kept.
const pipeFiles = (id: string) => [doc(id, 1, "水管走向圖.pdf"), photo(id, 2, "水管現況相片.jpg", photoAssets.pipe)];
const lampFiles = (id: string) => [doc(id, 1, "燈具保養記錄（2026-08）.pdf"), doc(id, 2, "燈具保養記錄（2026-05）.pdf")];
const earlierFiles = (id: string): Attachments[] => [
  [doc(id, 1, "水管走向圖.pdf")],
  ({
    "OBJ-001": pipeFiles(id), "OBJ-P03-03": pipeFiles(id), "OBJ-P03-10": pipeFiles(id), "OBJ-P03-01": lampFiles(id), "OBJ-P03-11": lampFiles(id), "OBJ-P05-01": lampFiles(id), "OBJ-P05-02": lampFiles(id),
    "OBJ-P03-02": [photo(id, 1, "遊樂設施相片.jpg", photoAssets.seat), doc(id, 2, "遊樂設施安全證書.pdf")], "OBJ-P03-06": [photo(id, 1, "遊樂設施相片.jpg", photoAssets.seat)],
    "OBJ-P03-12": [photo(id, 1, "指示牌設計圖.jpg", photoAssets.sign)], "OBJ-P06-01": [photo(id, 1, "指示牌設計圖.jpg", photoAssets.sign)], "OBJ-P06-02": [photo(id, 1, "指示牌設計圖.jpg", photoAssets.sign)],
    "OBJ-P05-03": [doc(id, 1, "欄杆結構圖.pdf")], "OBJ-P05-04": [doc(id, 1, "欄杆結構圖.pdf")],
  } as Record<string, Attachments>)[id] ?? [],
].filter((files) => files.length);
export function upgradeAttachments<T extends Pick<ManagedObject, "id" | "inspectionType" | "attachments">>(object: T): T {
  const current = JSON.stringify(object.attachments ?? []);
  const untouched = current === "[]" || earlierFiles(object.id).some((files) => current === JSON.stringify(files));
  return untouched ? { ...object, attachments: seedFilesFor(object) } : object;
}

export function seedObjects(): ManagedObject[] {
  const fromApp = Object.values(planObjects).flat().map((object, index) => seed({ id: object.id, inspectionType: appTypeToInspection[object.type] ?? "公園設施巡查", name: object.name, address: object.address, px: [object.x, object.y], claimedGrid: object.grid, nfc: object.nfc, demoDistance: object.distance }, index));
  const counters: Record<string, number> = {};
  const fromCatalog = objectCatalog.map((entry, index) => {
    const book = addressBook.find((item) => item.name === entry.name);
    counters[entry.grid] = (counters[entry.grid] ?? 0) + 1;
    const px: [number, number] = book ? [book.x, book.y] : placeInGrid(entry.grid, counters[entry.grid] + index);
    const object = seed({ id: entry.id, inspectionType: entry.inspectionType, name: entry.name, address: entry.address, px, claimedGrid: entry.grid }, index);
    return { ...object, attachments: seedFilesFor(object) };
  });
  const groups = fromApp.map((object) => ({ ...object, attachments: seedFilesFor(object), workGroups: [...new Set(Object.values(objectGroups[object.id] ?? {}))].map((group) => ({ category: DISPATCH_CATEGORY, group })) }));
  return [...groups, ...fromCatalog];
}

// ---- 即時登記（與後台共用狀態同步） ----
let objects: ManagedObject[] = seedObjects();
let grids: GridRecord[] = seedGridList;
let byId = new Map<string, MapObject>();
let active: MapObject[] = [];

function toMapObject(object: ManagedObject): MapObject {
  const [x, y] = pxOf(object); const gridId = assignGrid(object, grids);
  return {
    id: object.id, name: object.name, type: inspectionToAppType[object.inspectionType] ?? object.inspectionType, address: object.address, grid: grids.find((grid) => grid.id === gridId)?.name ?? "未歸屬",
    x, y, distance: object.demoDistance ?? Math.round(Math.hypot(x - myLocation.x, y - myLocation.y) * METERS_PER_PX), nfc: object.nfc,
  };
}
function rebuild() { const all = objects.map(toMapObject); byId = new Map(all.map((object) => [object.id, object])); active = all.filter((_, index) => objects[index].status === "啟用"); }
rebuild();

/** Kept in step with the shared state by DemoProvider, so lookups in the App and back office see the managed objects. */
export function setObjectRegistry(nextObjects: ManagedObject[], nextGrids: GridRecord[]) {
  if (nextObjects === objects && nextGrids === grids) return;
  objects = nextObjects; grids = nextGrids; rebuild();
}
/** Any object, including disabled ones, so existing records keep resolving. */
export const getObject = (id: string): MapObject | undefined => byId.get(id);
/** Active objects only: what pickers offer. */
export const getObjects = (): MapObject[] => active;
export const getManagedObjects = () => objects;
/** The App's lookup table, backed by the registry (`objectIndex[id]`), so objects created in the back office resolve in the App too. */
export const objectIndex: Record<string, MapObject> = new Proxy({}, { get: (_target, key) => (typeof key === "string" ? byId.get(key) : undefined) }) as Record<string, MapObject>;
/** The object's execution group (群組管理 category 執行群組); dispatch sends every work of the object there. */
export const objectGroupOf = (id: string): string | undefined => { const object = objects.find((item) => item.id === id); return object ? dispatchGroupOf(object) : undefined; };
