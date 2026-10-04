import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import ts from "typescript";

const source = await readFile(new URL("../src/grid-rules.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText;
const m = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`);
const { lngLatToPx, pxToLngLat, polygonFromPx, pointInRings, areaM2, selfIntersects, overlapAreaM2, ringsPx, parseGeoJSON, validateGeometry, validateGrid, validateImport, buildLocator, locateGrid, countPoints, reassignPatches, seedGrids, formatArea, nextCode, nextId, toFeatureCollection, sampleFeatureCollection, vertexCount, partCount, validateGridName } = m;

const rect = (x1, y1, x2, y2) => polygonFromPx([[x1, y1], [x2, y1], [x2, y2], [x1, y2]]);
const grid = (id, name, boundary, status = "啟用", code = `G${id}`) => ({ id, code, name, boundary, status });
const feature = (properties, geometry, index = 0) => ({ index, properties, geometry });
const existing = () => [grid("1", "甲區", rect(0, 0, 100, 100)), grid("2", "乙區", rect(100, 0, 200, 100))];

test("projection is the inverse of the App's lat/lng formula", () => {
  const [lng, lat] = pxToLngLat([640, 112]);
  assert.equal(`${lat.toFixed(5)}, ${lng.toFixed(5)}`, "22.20290, 113.56211"); // same as the App's latLng(640, 112)
  const [x, y] = lngLatToPx(pxToLngLat([812.5, 333.25]));
  assert.ok(Math.abs(x - 812.5) < 0.02 && Math.abs(y - 333.25) < 0.02);
});
test("point in rings: concave shapes, holes and boundaries", () => {
  const L = ringsPx(polygonFromPx([[0, 0], [100, 0], [100, 40], [40, 40], [40, 100], [0, 100]]));
  assert.equal(pointInRings(20, 80, L), true); assert.equal(pointInRings(80, 80, L), false); assert.equal(pointInRings(80, 20, L), true);
  assert.equal(pointInRings(100, 20, L), true, "on the boundary counts as inside");
  const withHole = ringsPx({ type: "Polygon", coordinates: [polygonFromPx([[0, 0], [100, 0], [100, 100], [0, 100]]).coordinates[0], polygonFromPx([[40, 40], [60, 40], [60, 60], [40, 60]]).coordinates[0]] });
  assert.equal(pointInRings(10, 10, withHole), true); assert.equal(pointInRings(50, 50, withHole), false);
});
test("area subtracts holes and scales by the metres-per-pixel constant", () => {
  assert.ok(Math.abs(areaM2(rect(0, 0, 100, 50)) - 100 * 50 * 2.6 * 2.6) < 1);
  const holed = { type: "Polygon", coordinates: [polygonFromPx([[0, 0], [100, 0], [100, 100], [0, 100]]).coordinates[0], polygonFromPx([[40, 40], [60, 40], [60, 60], [40, 60]]).coordinates[0]] };
  assert.ok(Math.abs(areaM2(holed) - (10000 - 400) * 6.76) < 1);
});
test("self intersection and overlap", () => {
  assert.equal(selfIntersects([[0, 0], [100, 100], [100, 0], [0, 100], [0, 0]]), true);
  assert.equal(selfIntersects([[0, 0], [100, 0], [100, 100], [0, 100], [0, 0]]), false);
  const a = ringsPx(rect(0, 0, 100, 100));
  assert.equal(overlapAreaM2(a, ringsPx(rect(100, 0, 200, 100))), 0, "touching edges do not overlap");
  assert.equal(overlapAreaM2(a, ringsPx(rect(300, 300, 400, 400))), 0);
  const real = overlapAreaM2(a, ringsPx(rect(50, 50, 150, 150)));
  assert.ok(Math.abs(real - 50 * 50 * 6.76) / (50 * 50 * 6.76) < 0.05, `got ${real}`);
  const L = ringsPx(polygonFromPx([[0, 0], [100, 0], [100, 40], [40, 40], [40, 100], [0, 100]]));
  assert.equal(overlapAreaM2(L, ringsPx(rect(60, 60, 100, 100))), 0, "inside the notch of a concave shape");
});
test("GeoJSON parsing accepts three shapes and reports bad input", () => {
  const poly = rect(0, 0, 10, 10);
  assert.equal(parseGeoJSON(JSON.stringify({ type: "FeatureCollection", features: [{ type: "Feature", properties: { name: "A" }, geometry: poly }, { type: "Feature", properties: {}, geometry: poly }] })).features.length, 2);
  assert.equal(parseGeoJSON(JSON.stringify({ type: "Feature", properties: { name: "A" }, geometry: poly })).features[0].properties.name, "A");
  assert.equal(parseGeoJSON(JSON.stringify(poly)).features.length, 1);
  assert.match(parseGeoJSON("{oops").error, /JSON/);
  assert.match(parseGeoJSON('{"type":"Point","coordinates":[1,2]}').error, /不支援/);
  assert.match(parseGeoJSON('{"type":"FeatureCollection","features":[]}').error, /沒有/);
  assert.match(parseGeoJSON("[]").error, /type/);
});
test("geometry validation catches each structural problem", () => {
  const errors = (g) => validateGeometry(g).errors.join("|");
  assert.deepEqual(validateGeometry(rect(0, 0, 10, 10)).errors, []);
  assert.match(errors({ type: "Point", coordinates: [0, 0] }), /Polygon 或 MultiPolygon/);
  assert.match(errors(undefined), /缺少/);
  assert.match(errors({ type: "Polygon", coordinates: [[[113.53, 22.2], [113.54, 22.2], [113.53, 22.2]]] }), /至少需要 4/);
  assert.match(errors({ type: "Polygon", coordinates: [[[113.53, 22.2], [113.54, 22.2], [113.54, 22.19], [113.53, 22.19]]] }), /沒有閉合/);
  assert.match(errors({ type: "Polygon", coordinates: [[[113.53, 22.2], [113.54, 22.2], ["x", 22.19], [113.53, 22.2]]] }), /無效座標/);
  assert.match(errors({ type: "Polygon", coordinates: [[[113.53, 22.2], [113.54, 22.2], [113.53, 22.2], [113.53, 22.2]]] }), /面積為零/);
  assert.match(errors({ type: "Polygon", coordinates: [[[113.53, 22.2], [113.55, 22.18], [113.55, 22.2], [113.53, 22.18], [113.53, 22.2]]] }), /自相交/);
  assert.match(errors({ type: "Polygon", coordinates: [[[100, 22.2], [100.1, 22.2], [100.1, 22.19], [100, 22.2]]] }), /超出地圖範圍/);
});
test("a single grid needs a unique code and name, a valid range, and no overlap", () => {
  const ok = validateGrid({ code: "", name: "丙區", geometry: rect(300, 0, 400, 100) }, existing());
  assert.deepEqual(ok.errors, []); assert.equal(ok.record.code, "GRID001");
  assert.match(validateGrid({ code: "G1", name: "丙區", geometry: rect(300, 0, 400, 100) }, existing()).errors[0], /已存在/);
  assert.match(validateGrid({ code: "bad code", name: "丙區", geometry: rect(300, 0, 400, 100) }, existing()).errors[0], /英文字母/);
  assert.match(validateGrid({ code: "X".repeat(33), name: "丙區", geometry: rect(300, 0, 400, 100) }, existing()).errors[0], /32/);
  assert.match(validateGrid({ code: "", name: " ", geometry: rect(300, 0, 400, 100) }, existing()).errors[0], /名稱/);
  assert.match(validateGrid({ code: "", name: "字".repeat(51), geometry: rect(300, 0, 400, 100) }, existing()).errors[0], /50/);
  assert.match(validateGrid({ code: "", name: "甲區", geometry: rect(300, 0, 400, 100) }, existing()).errors[0], /已存在/);
  const overlap = validateGrid({ code: "", name: "丙區", geometry: rect(50, 0, 150, 100) }, existing());
  assert.equal(overlap.errors.length, 2); assert.match(overlap.errors[0], /與「甲區」重疊約/); assert.match(overlap.errors[1], /與「乙區」重疊/);
  assert.deepEqual(validateGrid({ code: "", name: "甲區", geometry: rect(0, 0, 100, 100) }, existing(), "1").errors, [], "editing may keep its own name and range");
  assert.deepEqual(validateGrid({ code: "", name: "丙區", geometry: rect(99, 0, 101, 100) }, existing()).errors.length > 0, true, "a 2 px sliver across two grids is a real overlap");
});
test("import: new grids pass; names and codes come from properties; codes are generated", () => {
  const r = validateImport([feature({ code: "NEW-1", name: "丙區" }, rect(300, 0, 400, 100)), feature({ name: "丁區" }, rect(400, 0, 500, 100), 1)], existing(), "覆蓋範圍");
  assert.equal(r.ok, true); assert.equal(r.applyCount, 2);
  assert.deepEqual(r.records.map((g) => [g.id, g.code, g.name, g.status]), [["1", "G1", "甲區", "啟用"], ["2", "G2", "乙區", "啟用"], ["3", "NEW-1", "丙區", "啟用"], ["4", "GRID001", "丁區", "啟用"]]);
  assert.deepEqual(r.rows.map((x) => x.action), ["新增", "新增"]);
});
test("import is all-or-nothing and lists every reason", () => {
  const r = validateImport([feature({ name: "丙區" }, rect(300, 0, 400, 100)), feature({ name: "丁區" }, rect(50, 50, 150, 150), 1), feature({}, rect(500, 0, 600, 100), 2), feature({ name: "戊區" }, { type: "Point", coordinates: [0, 0] }, 3)], existing(), "覆蓋範圍");
  assert.equal(r.ok, false); assert.equal(r.records, undefined);
  assert.deepEqual(r.rows.map((x) => x.errors.length > 0), [false, true, true, true]);
  assert.match(r.rows[1].errors.join(), /重疊/); assert.match(r.rows[2].errors.join(), /缺少 name/); assert.match(r.rows[3].errors.join(), /Polygon/);
});
test("import: overwrite replaces only the range; skip leaves matches alone", () => {
  const features = [feature({ code: "G1", name: "改名也不生效" }, rect(0, 0, 80, 100)), feature({ name: "丙區" }, rect(300, 0, 400, 100), 1)];
  const over = validateImport(features, existing(), "覆蓋範圍");
  assert.equal(over.ok, true); assert.deepEqual(over.rows.map((x) => x.action), ["覆蓋", "新增"]);
  assert.equal(over.records[0].name, "甲區"); assert.equal(over.records[0].id, "1"); assert.ok(Math.abs(areaM2(over.records[0].boundary) - 80 * 100 * 6.76) < 5);
  const skip = validateImport(features, existing(), "略過");
  assert.deepEqual(skip.rows.map((x) => x.action), ["略過", "新增"]); assert.equal(skip.applyCount, 1); assert.equal(skip.records.length, 3);
  assert.equal(validateImport([features[0]], existing(), "略過").ok, false, "nothing left to import");
});
test("import: an overwrite may take over the area of the grid it replaces, but not of another", () => {
  assert.equal(validateImport([feature({ code: "G1" }, rect(0, 0, 100, 100))], existing(), "覆蓋範圍").ok, true);
  assert.equal(validateImport([feature({ code: "G1" }, rect(0, 0, 150, 100))], existing(), "覆蓋範圍").ok, false);
});
test("import: duplicates inside the file and against existing names", () => {
  const dupName = validateImport([feature({ name: "丙區" }, rect(300, 0, 400, 100)), feature({ name: "丙區" }, rect(400, 0, 500, 100), 1)], existing(), "覆蓋範圍");
  assert.equal(dupName.ok, false); assert.match(dupName.rows[1].errors.join(), /檔內重複/);
  const dupCode = validateImport([feature({ code: "Z", name: "丙區" }, rect(300, 0, 400, 100)), feature({ code: "z", name: "丁區" }, rect(400, 0, 500, 100), 1)], existing(), "覆蓋範圍");
  assert.match(dupCode.rows[1].errors.join(), /編號.*重複/);
  const taken = validateImport([feature({ code: "NEW", name: "乙區" }, rect(300, 0, 400, 100))], existing(), "覆蓋範圍");
  assert.match(taken.rows[0].errors.join(), /已被其他網格使用/);
  const same = validateImport([feature({ code: "G1" }, rect(0, 0, 10, 10)), feature({ code: "G1" }, rect(0, 0, 20, 20), 1)], existing(), "覆蓋範圍");
  assert.match(same.rows[1].errors.join(), /同一個網格/);
  const overlapInFile = validateImport([feature({ name: "丙區" }, rect(300, 0, 400, 100)), feature({ name: "丁區" }, rect(350, 0, 450, 100), 1)], existing(), "覆蓋範圍");
  assert.match(overlapInFile.rows[1].errors.join(), /與「丙區」重疊/);
});
test("locating: first enabled match in list order, boundary inclusive, else none", () => {
  const list = [grid("1", "甲區", rect(0, 0, 100, 100)), grid("2", "乙區", rect(100, 0, 200, 100), "停用"), grid("3", "丙區", rect(100, 0, 300, 100))];
  const locator = buildLocator(list);
  assert.equal(locateGrid(locator, 50, 50), "甲區");
  assert.equal(locateGrid(locator, 100, 50), "甲區", "shared edge: the first grid wins");
  assert.equal(locateGrid(locator, 150, 50), "丙區", "disabled grids are skipped");
  assert.equal(locateGrid(locator, 500, 500), null);
});
test("seed grids are valid, disjoint and keep the old first-match result at every point", () => {
  const seeds = seedGrids();
  assert.equal(seeds.length, 7); assert.deepEqual(seeds.map((g) => g.code), ["GRID001", "GRID002", "GRID003", "GRID004", "GRID005", "GRID006", "GRID007"]);
  seeds.forEach((g) => assert.deepEqual(validateGeometry(g.boundary).errors, [], g.name));
  seeds.forEach((g, i) => seeds.slice(0, i).forEach((other) => assert.equal(overlapAreaM2(ringsPx(g.boundary), ringsPx(other.boundary)) <= 50, true, `${g.name} / ${other.name}`)));
  const old = [["花地瑪堂北區", 540, 40, 760, 230], ["花地瑪堂西區", 400, 100, 540, 260], ["望德堂中區", 520, 230, 620, 285], ["大堂中區", 470, 260, 600, 340], ["大堂南區", 380, 300, 520, 420], ["氹仔中央區", 510, 440, 920, 640], ["路環東區", 590, 640, 1200, 1000]];
  const oldLocate = (x, y) => old.find(([, x1, y1, x2, y2]) => x >= x1 && x <= x2 && y >= y1 && y <= y2)?.[0] ?? null;
  const locator = buildLocator(seeds); let checked = 0;
  for (let x = 0; x <= 1536; x += 5) for (let y = 0; y <= 1024; y += 5) { assert.equal(locateGrid(locator, x, y), oldLocate(x, y), `(${x}, ${y})`); checked++; }
  [[520, 270], [540, 260], [470, 300], [470, 330], [548, 256], [560, 238], [660, 201], [622, 92], [612, 532], [1000, 850]].forEach(([x, y]) => assert.equal(locateGrid(locator, x, y), oldLocate(x, y), `edge (${x}, ${y})`));
  assert.ok(checked > 60000);
});
test("object counts, re-assignment patches, ids, area text and files", () => {
  const g = grid("1", "甲區", rect(0, 0, 100, 100));
  assert.equal(countPoints(g, [{ x: 10, y: 10 }, { x: 100, y: 100 }, { x: 101, y: 50 }]), 2);
  const patches = reassignPatches([{ id: "a", grid: "甲區", x: 10, y: 10 }, { id: "b", grid: "乙區", x: 10, y: 10 }, { id: "c", grid: "甲區" }, { id: "d", grid: "未歸屬", x: 500, y: 500 }], (x, y) => x < 100 ? "甲區" : "未歸屬");
  assert.deepEqual(patches, [{ id: "b", from: "乙區", to: "甲區" }]);
  assert.equal(nextCode(["GRID009", "x", "grid010"]), "GRID011"); assert.equal(nextCode([]), "GRID001"); assert.equal(nextId(["1", "7", "x"]), "8");
  assert.equal(formatArea(12345.6), "12,346 m²"); assert.equal(formatArea(2500000), "2.50 km²"); assert.equal(formatArea(0), "0 m²");
  const fc = toFeatureCollection(seedGrids().slice(0, 2));
  assert.equal(fc.features[0].properties.status, "啟用"); assert.equal(parseGeoJSON(JSON.stringify(fc)).features.length, 2);
  const sample = sampleFeatureCollection();
  assert.equal(validateImport(parseGeoJSON(JSON.stringify(sample)).features, seedGrids(), "覆蓋範圍").ok, true, "the sample file imports cleanly into the seed grids");
  assert.equal(vertexCount(g.boundary), 4); assert.equal(partCount(g.boundary), 1);
});
test("renaming checks only the name", () => {
  assert.deepEqual(validateGridName("甲區", existing(), "1"), []);
  assert.match(validateGridName("乙區", existing(), "1")[0], /已存在/);
  assert.match(validateGridName(" ", existing(), "1")[0], /名稱/);
  assert.match(validateGridName("字".repeat(51), existing(), "1")[0], /50/);
});
