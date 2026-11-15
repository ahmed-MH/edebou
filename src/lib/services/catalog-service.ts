import "server-only";

import type {
  PublicCategoryDto,
  PublicProductDetailDto,
  PublicProductPageDto,
} from "@/lib/dto/catalog";
import {
  toPublicCategoryDto,
  toPublicProductDetailDto,
  toPublicProductSummaryDto,
} from "@/lib/dto/catalog-mappers";
import {
  ResourceNotFoundError,
  ServiceUnavailableError,
} from "@/lib/errors";
import type {
  CatalogRepository,
  ProductDetailRecord,
  ProductListCriteria,
} from "@/lib/repositories/catalog-repository";

export class CatalogService {
  constructor(private readonly repository: CatalogRepository) {}

  async listCategories(): Promise<readonly PublicCategoryDto[]> {
    try {
      const categories = await this.repository.listActiveCategories();
      return categories.map(toPublicCategoryDto);
    } catch {
      throw new ServiceUnavailableError();
    }
  }

  async listProducts(
    criteria: ProductListCriteria,
  ): Promise<PublicProductPageDto> {
    try {
      const result = await this.repository.listActiveProducts(criteria);

      return {
        items: result.items.map(toPublicProductSummaryDto),
        pagination: {
          page: criteria.page,
          pageSize: criteria.pageSize,
          total: result.total,
          totalPages: Math.ceil(result.total / criteria.pageSize),
        },
      };
    } catch {
      throw new ServiceUnavailableError();
    }
  }

  async getProductBySlug(slug: string): Promise<PublicProductDetailDto> {
    let product: ProductDetailRecord | null;

    try {
      product = await this.repository.findActiveProductBySlug(slug);
    } catch {
      throw new ServiceUnavailableError();
    }

    if (!product) {
      throw new ResourceNotFoundError();
    }

    try {
      return toPublicProductDetailDto(product);
    } catch {
      throw new ServiceUnavailableError();
    }
  }
}
