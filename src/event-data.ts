import { addressBook, eventFieldDefs, eventMeta, eventToWorkType, eventTypeTree, workTypeTree } from "./app/data";
import { dispatchWork, gridOf } from "./app/rules";
import { fieldsFor, type EventFieldDef } from "./event-rules";
import type { EventRecord, Work } from "./types";

export { dispatchWork, eventToWorkType };

/** Only leaf types can be chosen; the label is the path joined by "／". */
export const eventTypeGroups = eventTypeTree.map((top) => ({ label: top.label, leaves: (top.children ?? [{ label: top.label, value: top.value }]).map((child) => (top.children ? `${top.value}／${child.value}` : child.value)) }));
export const leafEventTypes = eventTypeGroups.flatMap((group) => group.leaves);
/** Work types a work can be created with, as "頂層／下級". */
export const workTypeOptions = workTypeTree.flatMap((top) => (top.children ?? []).map((child) => `${top.value}／${child.value}`));
export const fieldsOfType = (type: string): EventFieldDef[] => fieldsFor(type, eventFieldDefs);

/** An event with the App's seed metadata (position, custom values, follow-up time, creator) filled in. */
export function resolveEvent(event: EventRecord): EventRecord {
  const meta = eventMeta[event.id];
  if (!meta) return event;
  return { ...event, x: event.x ?? meta.x, y: event.y ?? meta.y, custom: event.custom ?? meta.custom, followAt: event.followAt ?? meta.followAt, creator: event.creator ?? meta.creator };
}

/** Defs the event was registered with: its snapshot, else the current definitions for its type. */
export const defsOfEvent = (event: EventRecord): EventFieldDef[] => event.fieldSnapshot?.defs ?? fieldsOfType(event.type);

export const worksOfEvent = (works: Work[], event: EventRecord) => works.filter((work) => !work.pendingSync && !work.voided && (work.eventId === event.id || event.workIds.includes(work.id)));

/** Nearest address-book entry gives the address; the grid comes from the position. Mirrors the App's lookup without its UI code. */
export function reverseGeocode(x: number, y: number): { address: string; grid: string; approx: boolean } {
  const grid = gridOf(x, y);
  const nearest = addressBook.map((entry) => ({ entry, d: Math.hypot(entry.x - x, entry.y - y) })).sort((a, b) => a.d - b.d)[0];
  if (nearest && nearest.d <= 12) return { address: `${nearest.entry.parish} ${nearest.entry.street}${nearest.entry.number !== "—" ? ` ${nearest.entry.number} 號` : ""} ${nearest.entry.building}`, grid, approx: false };
  if (nearest && nearest.d <= 45) return { address: `${nearest.entry.parish} ${nearest.entry.street} 近${nearest.entry.building}`, grid, approx: true };
  return { address: `${grid}（未能鎖定地址，請手動補充）`, grid, approx: true };
}

/** The nearest address-book entry as structured parts (堂區, 街道, 門牌, 建築物), or empty parts when none is close enough. */
export function reverseGeocodeParts(x: number, y: number): { parts: { parish: string; street: string; number: string; building: string } | null; grid: string } {
  const nearest = addressBook.map((entry) => ({ entry, d: Math.hypot(entry.x - x, entry.y - y) })).sort((a, b) => a.d - b.d)[0];
  const grid = gridOf(x, y);
  if (!nearest || nearest.d > 45) return { parts: null, grid };
  const { parish, street, number, building } = nearest.entry;
  return { parts: { parish, street, number: number === "—" ? "" : number, building: nearest.d <= 12 ? building : `近${building}` }, grid };
}

export const latLng = (x: number, y: number) => `${(22.215 - y * 0.000108).toFixed(5)}, ${(113.52 + x * 0.0000658).toFixed(5)}`;
export { gridOf };
