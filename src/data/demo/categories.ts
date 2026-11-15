import type { DemoCategory } from "@/types/catalog";

export const demoCategories = Object.freeze([
  Object.freeze({
    id: "electronics",
    nameKey: "Categories.items.electronics",
    iconName: "Smartphone",
    demo: true,
  }),
  Object.freeze({
    id: "home",
    nameKey: "Categories.items.home",
    iconName: "House",
    demo: true,
  }),
  Object.freeze({
    id: "fashion",
    nameKey: "Categories.items.fashion",
    iconName: "Shirt",
    demo: true,
  }),
  Object.freeze({
    id: "beauty",
    nameKey: "Categories.items.beauty",
    iconName: "Sparkles",
    demo: true,
  }),
  Object.freeze({
    id: "sport",
    nameKey: "Categories.items.sport",
    iconName: "Dumbbell",
    demo: true,
  }),
  Object.freeze({
    id: "essentials",
    nameKey: "Categories.items.essentials",
    iconName: "ShoppingBasket",
    demo: true,
  }),
] as const satisfies readonly DemoCategory[]);
