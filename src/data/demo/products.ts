import type { DemoProduct } from "@/types/catalog";

export const demoProducts = Object.freeze([
  Object.freeze({
    id: "demo-wireless-earbuds",
    slug: "wireless-earbuds",
    nameKey: "Products.items.wirelessEarbuds",
    categoryId: "electronics",
    imageSrc: "/demo/wireless-earbuds.svg",
    priceMillimes: 79_900,
    availability: "in_stock",
    demo: true,
  }),
  Object.freeze({
    id: "demo-electric-kettle",
    slug: "electric-kettle",
    nameKey: "Products.items.electricKettle",
    categoryId: "home",
    imageSrc: "/demo/electric-kettle.svg",
    priceMillimes: 89_900,
    availability: "low_stock",
    demo: true,
  }),
  Object.freeze({
    id: "demo-daily-backpack",
    slug: "daily-backpack",
    nameKey: "Products.items.dailyBackpack",
    categoryId: "fashion",
    imageSrc: "/demo/daily-backpack.svg",
    priceMillimes: 64_900,
    availability: "in_stock",
    demo: true,
  }),
  Object.freeze({
    id: "demo-daily-care-set",
    slug: "daily-care-set",
    nameKey: "Products.items.dailyCareSet",
    categoryId: "beauty",
    imageSrc: "/demo/daily-care-set.svg",
    priceMillimes: 39_900,
    availability: "out_of_stock",
    demo: true,
  }),
] as const satisfies readonly DemoProduct[]);
