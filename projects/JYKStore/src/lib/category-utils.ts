import { mockCategories } from "@/data/mock-categories";
import type { StoreCategory } from "@/types/pack";

export function getCategoryById(categoryId: string): StoreCategory | undefined {
  return mockCategories.find((category) => category.categoryId === categoryId);
}

export function countPacksInCategory(categoryId: string, packCountByCategory: Map<string, number>): number {
  return packCountByCategory.get(categoryId) ?? 0;
}
