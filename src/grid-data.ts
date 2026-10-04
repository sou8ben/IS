import { buildLocator, locateGrid, seedGrids, type GridRecord, type Locator } from "./grid-rules";

/**
 * The live grid list, shared by the back office and the App. DemoProvider keeps it in step with the shared state,
 * so `locateName` (the App's `gridOf`) and the grid dropdowns always use the grids managed on the grid page.
 */
let grids: GridRecord[] = seedGrids();
let locator: Locator[] = buildLocator(grids);

export function setGridRegistry(next: GridRecord[]) {
  if (next === grids) return;
  grids = next; locator = buildLocator(next);
}
export const gridNames = () => grids.filter((grid) => grid.status === "啟用").map((grid) => grid.name);
export const locateName = (x: number, y: number) => locateGrid(locator, x, y) ?? "未歸屬";
export { seedGrids };
