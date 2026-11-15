export type PublicProductAvailability =
  | "IN_STOCK"
  | "LOW_STOCK"
  | "OUT_OF_STOCK";

export interface PublicCategoryDto {
  readonly slug: string;
  readonly name: {
    readonly ar: string;
    readonly fr: string;
  };
}

export interface PublicProductImageDto {
  readonly path: string;
  readonly alt: {
    readonly ar: string;
    readonly fr: string;
  };
  readonly position: number;
}

export interface PublicProductPriceTierDto {
  readonly minQuantity: number;
  readonly unitPriceMillimes: number;
}

export interface PublicProductSummaryDto {
  readonly slug: string;
  readonly sku: string;
  readonly name: {
    readonly ar: string;
    readonly fr: string;
  };
  readonly priceMillimes: number;
  readonly currency: "TND";
  readonly availability: PublicProductAvailability;
  readonly category: PublicCategoryDto;
  readonly image: PublicProductImageDto | null;
}

export interface PublicProductDetailDto extends PublicProductSummaryDto {
  readonly description: {
    readonly ar: string;
    readonly fr: string;
  };
  readonly images: readonly PublicProductImageDto[];
  readonly priceTiers: readonly PublicProductPriceTierDto[];
}

export interface PublicPaginationDto {
  readonly page: number;
  readonly pageSize: number;
  readonly total: number;
  readonly totalPages: number;
}

export interface PublicProductPageDto {
  readonly items: readonly PublicProductSummaryDto[];
  readonly pagination: PublicPaginationDto;
}
