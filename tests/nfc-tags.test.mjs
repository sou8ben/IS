import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import ts from "typescript";

const source = await readFile(new URL("../src/nfc-tags.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText;
const { initialNfcTags, newNfcTag, validateNfcTag, toMapPercent, fromMapPercent, nfcMapBounds } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`);
const managementGroups = ["manage-facility", "manage-sanitation", "manage-green"];
const valid = () => ({ ...structuredClone(initialNfcTags[0]), id: "", code: "NFC-0099", uid: "04:AA:BB:CC:DD:EE:80" });

test("all seed tags are valid and land on the demo map", () => {
  for (const tag of initialNfcTags) {
    assert.deepEqual(validateNfcTag(tag, initialNfcTags, managementGroups), [], tag.code);
    assert.ok(toMapPercent(tag.lat, tag.lng), tag.code);
  }
});
test("a new valid tag passes", () => {
  assert.deepEqual(validateNfcTag(valid(), initialNfcTags, managementGroups), []);
});
test("blank draft reports every required field", () => {
  const errors = validateNfcTag(newNfcTag(), initialNfcTags, managementGroups);
  for (const text of ["標籤編號", "標籤名稱", "晶片 UID", "所屬部門", "設施名稱", "地址", "緯度", "管理群組"]) assert.ok(errors.some((e) => e.includes(text)), text);
});
test("duplicate code is rejected case-insensitively", () => {
  const errors = validateNfcTag({ ...valid(), code: "nfc-0001" }, initialNfcTags, managementGroups);
  assert.ok(errors.some((e) => e.includes("已存在")));
});
test("duplicate or malformed UID is rejected", () => {
  assert.ok(validateNfcTag({ ...valid(), uid: initialNfcTags[1].uid.toLowerCase() }, initialNfcTags, managementGroups).some((e) => e.includes("已綁定")));
  assert.ok(validateNfcTag({ ...valid(), uid: "04-3A-7F" }, initialNfcTags, managementGroups).some((e) => e.includes("格式不正確")));
});
test("editing a tag does not conflict with itself", () => {
  const tag = structuredClone(initialNfcTags[2]);
  assert.deepEqual(validateNfcTag({ ...tag, name: "新名稱" }, initialNfcTags, managementGroups), []);
});
test("only management groups can be bound", () => {
  assert.ok(validateNfcTag({ ...valid(), adminGroup: "inspect-north" }, initialNfcTags, managementGroups).some((e) => e.includes("管理類群組")));
});
test("coordinates outside Macau are rejected", () => {
  assert.ok(validateNfcTag({ ...valid(), lat: 23.1 }, initialNfcTags, managementGroups).some((e) => e.includes("超出澳門範圍")));
  assert.ok(validateNfcTag({ ...valid(), lng: null }, initialNfcTags, managementGroups).some((e) => e.includes("緯度及經度")));
});
test("at most three site photos", () => {
  const photos = [1, 2, 3, 4].map((n) => ({ name: `p${n}.jpg` }));
  assert.ok(validateNfcTag({ ...valid(), photos }, initialNfcTags, managementGroups).some((e) => e.includes("最多 3 張")));
});
test("map percent conversion round-trips and clamps", () => {
  const { x, y } = toMapPercent(22.16, 113.55965);
  assert.deepEqual(fromMapPercent(x, y), { lat: 22.16, lng: 113.55965 });
  assert.deepEqual(fromMapPercent(-10, 140), { lat: nfcMapBounds.south, lng: nfcMapBounds.west });
  assert.equal(toMapPercent(22.3, 113.55), null);
});
