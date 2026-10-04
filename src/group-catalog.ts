// The groups of 群組管理, by category. Import-free so pure rules and tests can use it.
// Both the Group Management page and object work-responsibility groups read this list.

export const groupCategories = ["檢視群組", "巡查群組", "執行群組", "報告群組", "管理群組"] as const;
export type GroupCategory = typeof groupCategories[number];
export interface CatalogGroup { name: string; category: GroupCategory; owner: string }

export const groupCatalog: CatalogGroup[] = [
  { name: "工作檢視組", category: "檢視群組", owner: "市政管理廳" },
  { name: "北區巡查一組", category: "巡查群組", owner: "市政管理廳" },
  { name: "中區巡查組", category: "巡查群組", owner: "環境衛生處" },
  { name: "離島巡查組", category: "巡查群組", owner: "園林綠化處" },
  { name: "公園設施維護組", category: "執行群組", owner: "市政管理廳" },
  { name: "環境衛生執行組", category: "執行群組", owner: "環境衛生處" },
  { name: "綠化養護組", category: "執行群組", owner: "園林綠化處" },
  { name: "道路維修組", category: "執行群組", owner: "市政管理廳" },
  { name: "營運報告組", category: "報告群組", owner: "資訊處" },
  { name: "設施管理群組", category: "管理群組", owner: "市政管理廳" },
  { name: "環衛管理群組", category: "管理群組", owner: "環境衛生處" },
  { name: "綠化管理群組", category: "管理群組", owner: "園林綠化處" },
];

export const groupsOfCategory = (category: string, groups: CatalogGroup[] = groupCatalog) => groups.filter((group) => group.category === category);
export const categoryOfGroup = (name: string, groups: CatalogGroup[] = groupCatalog): GroupCategory | undefined => groups.find((group) => group.name === name)?.category;
