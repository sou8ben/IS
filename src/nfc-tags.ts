// NFC tag data and validation. Kept import-free so tests can transpile and run it directly.

export type NfcStatus = "生效" | "失效";
export interface NfcPhoto { name: string; url?: string }
export interface NfcTag {
  id: string;
  code: string;
  name: string;
  uid: string;
  department: string;
  facility: string;
  address: string;
  lat: number | null;
  lng: number | null;
  photos: NfcPhoto[];
  adminGroup: string;
  objectId?: string;
  status: NfcStatus;
  scanCount: number;
  updatedBy: string;
  updatedAt: string;
}

export const NFC_MAX_PHOTOS = 3;
// Demonstration Macau range; the static map image is projected linearly onto it.
export const nfcMapBounds = { north: 22.225, south: 22.1, west: 113.515, east: 113.61 };
const UID_PATTERN = /^([0-9A-F]{2}:){3,9}[0-9A-F]{2}$/i;

export const initialNfcTags: NfcTag[] = [
  { id: "NFC-TAG-0001", code: "NFC-0001", name: "黑沙環公園東門標籤", uid: "04:3A:7F:B2:1C:5E:80", department: "設施管理部", facility: "黑沙環公園東門入口", address: "澳門黑沙環海邊馬路黑沙環公園東門", lat: 22.21125, lng: 113.55585, photos: [{ name: "東門立柱_01.jpg" }], adminGroup: "manage-facility", objectId: "OBJ-001", status: "生效", scanCount: 128, updatedBy: "陳家朗", updatedAt: "2026-09-29 10:20" },
  { id: "NFC-TAG-0003", code: "NFC-0003", name: "塔石廣場服務站標籤", uid: "04:1D:92:6A:E3:47:80", department: "設施管理部", facility: "塔石廣場服務站", address: "澳門塔石廣場服務站外牆", lat: 22.2, lng: 113.55015, photos: [{ name: "服務站外牆_01.jpg" }, { name: "服務站外牆_02.jpg" }], adminGroup: "manage-facility", objectId: "OBJ-002", status: "生效", scanCount: 86, updatedBy: "系統管理員", updatedAt: "2026-09-28 15:42" },
  { id: "NFC-TAG-0005", code: "NFC-0005", name: "紀念孫中山市政公園入口標籤", uid: "04:C8:25:F1:9B:30:81", department: "綠化部", facility: "紀念孫中山市政公園正門", address: "澳門慕拉士大馬路紀念孫中山市政公園正門", lat: 22.2175, lng: 113.54635, photos: [], adminGroup: "manage-green", objectId: "OBJ-003", status: "生效", scanCount: 42, updatedBy: "李芷晴", updatedAt: "2026-09-27 11:05" },
  { id: "NFC-TAG-0008", code: "NFC-0008", name: "嘉模公園溫室標籤", uid: "04:6E:B4:08:D7:12:80", department: "綠化部", facility: "嘉模公園溫室", address: "氹仔嘉模公園溫室入口", lat: 22.16, lng: 113.55965, photos: [{ name: "溫室入口_01.jpg" }], adminGroup: "manage-green", objectId: "OBJ-004", status: "生效", scanCount: 37, updatedBy: "李芷晴", updatedAt: "2026-09-26 09:48" },
  { id: "NFC-TAG-0010", code: "NFC-0010", name: "黑沙海灘救生站標籤", uid: "04:59:A0:3C:66:EF:80", department: "環境衛生部", facility: "黑沙海灘救生站", address: "路環黑沙海灘救生站旁", lat: 22.1225, lng: 113.572, photos: [], adminGroup: "manage-sanitation", objectId: "OBJ-005", status: "失效", scanCount: 15, updatedBy: "黃志峰", updatedAt: "2026-09-24 16:30" },
  { id: "NFC-TAG-0012", code: "NFC-0012", name: "黑沙環公園洗手間標籤", uid: "04:8B:17:D4:2A:93:80", department: "環境衛生部", facility: "黑沙環公園公共洗手間", address: "澳門黑沙環公園公共洗手間入口", lat: 22.21, lng: 113.5549, photos: [{ name: "洗手間入口_01.jpg" }], adminGroup: "manage-sanitation", objectId: "OBJ-001", status: "生效", scanCount: 211, updatedBy: "陳家朗", updatedAt: "2026-09-29 08:56" },
];

export function newNfcTag(): NfcTag {
  return { id: "", code: "", name: "", uid: "", department: "", facility: "", address: "", lat: null, lng: null, photos: [], adminGroup: "", status: "生效", scanCount: 0, updatedBy: "", updatedAt: "" };
}

/** Position on the demo map as percentages, or null when outside the Macau range. */
export function toMapPercent(lat: number, lng: number): { x: number; y: number } | null {
  const { north, south, west, east } = nfcMapBounds;
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat > north || lat < south || lng < west || lng > east) return null;
  return { x: (lng - west) / (east - west) * 100, y: (north - lat) / (north - south) * 100 };
}

export function fromMapPercent(x: number, y: number): { lat: number; lng: number } {
  const { north, south, west, east } = nfcMapBounds;
  const clamp = (value: number) => Math.min(100, Math.max(0, value));
  const round = (value: number) => Math.round(value * 1e6) / 1e6;
  return { lat: round(north - clamp(y) / 100 * (north - south)), lng: round(west + clamp(x) / 100 * (east - west)) };
}

export function validateNfcTag(tag: NfcTag, all: NfcTag[], allowedGroupIds: string[]): string[] {
  const errors: string[] = [];
  const others = all.filter((item) => item.id !== tag.id);
  const code = tag.code.trim(); const name = tag.name.trim(); const uid = tag.uid.trim().toUpperCase(); const facility = tag.facility.trim();
  if (!code) errors.push("請輸入標籤編號。");
  else if (others.some((item) => item.code.trim().toLowerCase() === code.toLowerCase())) errors.push(`標籤編號「${code}」已存在。`);
  if (!name) errors.push("請輸入標籤名稱。");
  else if ([...name].length > 50) errors.push("標籤名稱不可超過 50 字。");
  if (!uid) errors.push("請輸入晶片 UID。");
  else if (!UID_PATTERN.test(uid)) errors.push("晶片 UID 格式不正確，應為以冒號分隔的十六進位位元組，例如 04:3A:7F:B2:1C:5E:80。");
  else if (others.some((item) => item.uid.trim().toUpperCase() === uid)) errors.push(`晶片 UID「${uid}」已綁定其他標籤。`);
  if (!tag.department) errors.push("請選擇所屬部門。");
  if (!facility) errors.push("請輸入設施名稱。");
  else if ([...facility].length > 100) errors.push("設施名稱不可超過 100 字。");
  if (!tag.address.trim()) errors.push("請輸入地址。");
  if (tag.lat === null || tag.lng === null || !Number.isFinite(tag.lat) || !Number.isFinite(tag.lng)) errors.push("請輸入緯度及經度，或在地圖選點。");
  else if (!toMapPercent(tag.lat, tag.lng)) errors.push("經緯度超出澳門範圍。");
  if (!tag.adminGroup) errors.push("請選擇管理群組。");
  else if (!allowedGroupIds.includes(tag.adminGroup)) errors.push("管理群組只可選擇管理類群組。");
  if (tag.photos.length > NFC_MAX_PHOTOS) errors.push(`現場照片最多 ${NFC_MAX_PHOTOS} 張。`);
  return errors;
}
