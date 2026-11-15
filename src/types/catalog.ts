/** Stable identifiers used by the storefront demo catalog. */
export type CategoryId =
  | "electronics"
  | "home"
  | "fashion"
  | "beauty"
  | "sport"
  | "essentials";

/** Keys for the deliberately small, explicit Lucide icon registry. */
export type CategoryIconName =
  | "Smartphone"
  | "House"
  | "Shirt"
  | "Sparkles"
  | "Dumbbell"
  | "ShoppingBasket";

export type CategoryTranslationKey = `Categories.items.${CategoryId}`;

export type ProductAvailability = "in_stock" | "low_stock" | "out_of_stock";

export type ProductTranslationKey =
  | "Products.items.wirelessEarbuds"
  | "Products.items.electricKettle"
  | "Products.items.dailyBackpack"
  | "Products.items.dailyCareSet";

export interface DemoCategory {
  readonly id: CategoryId;
  readonly nameKey: CategoryTranslationKey;
  readonly iconName: CategoryIconName;
  readonly demo: true;
}

export interface DemoProduct {
  readonly id: string;
  readonly slug: string;
  readonly nameKey: ProductTranslationKey;
  readonly categoryId: CategoryId;
  readonly imageSrc: `/demo/${string}.svg`;
  /** Price in millimes: 1 TND = 1,000 millimes. */
  readonly priceMillimes: number;
  readonly availability: ProductAvailability;
  readonly demo: true;
}
