import "server-only";

import type { PublicProductSort } from "@/lib/validators/catalog";

export interface CategoryRecord {
  readonly slug: string;
  readonly nameAr: string;
  readonly nameFr: string;
}

export interface ProductImageRecord {
  readonly path: string;
  readonly altAr: string;
  readonly altFr: string;
  readonly position: number;
}

export interface ProductPriceTierRecord {
  readonly minQuantity: number;
  readonly unitPrice: bigint;
}

export interface ProductSummaryRecord {
  readonly slug: string;
  readonly sku: string;
  readonly nameAr: string;
  readonly nameFr: string;
  readonly price: bigint;
  readonly stockQuantity: number;
  readonly category: CategoryRecord;
  readonly images: readonly ProductImageRecord[];
}

export interface ProductDetailRecord extends ProductSummaryRecord {
  readonly descriptionAr: string;
  readonly descriptionFr: string;
  readonly priceTiers: readonly ProductPriceTierRecord[];
}

export interface ProductListCriteria {
  readonly page: number;
  readonly pageSize: number;
  readonly search?: string;
  readonly category?: string;
  readonly sort?: PublicProductSort;
}

export interface ProductListRecord {
  readonly items: readonly ProductSummaryRecord[];
  readonly total: number;
}

export interface CatalogRepository {
  listActiveCategories(): Promise<readonly CategoryRecord[]>;
  listActiveProducts(criteria: ProductListCriteria): Promise<ProductListRecord>;
  findActiveProductBySlug(slug: string): Promise<ProductDetailRecord | null>;
}
