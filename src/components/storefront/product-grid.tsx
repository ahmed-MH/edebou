import { AlertTriangle, PackageSearch } from "lucide-react";
import type { Route } from "next";
import { getTranslations } from "next-intl/server";

import { ProductCard } from "@/components/storefront/product-card";
import { ProductRail } from "@/components/storefront/product-rail";
import type { AppLocale } from "@/i18n/routing";
import { isSafeLocalCatalogImagePath } from "@/lib/catalog-image";
import type { PublicProductAvailability } from "@/lib/dto/catalog";
import { formatTunisianDinars } from "@/lib/format-currency";
import { catalogService } from "@/lib/services";
import type { ProductAvailability } from "@/types/catalog";

type ProductGridProps = {
  locale: AppLocale;
};

type StorefrontProduct = {
  availability: ProductAvailability;
  imageAlt: string;
  imageSrc: string;
  key: string;
  href?: Route;
  name: string;
  priceMillimes: number;
};

const publicAvailability: Record<
  PublicProductAvailability,
  ProductAvailability
> = {
  IN_STOCK: "in_stock",
  LOW_STOCK: "low_stock",
  OUT_OF_STOCK: "out_of_stock",
};

export async function ProductGrid({ locale }: ProductGridProps) {
  const t = await getTranslations();
  const catalogPath = `${locale === "fr" ? "/fr" : ""}/products`;
  let hasCatalogError = false;
  let products: readonly StorefrontProduct[] = [];

  try {
    const catalog = await catalogService.listProducts({
      page: 1,
      pageSize: 8,
    });
    const databaseProducts = catalog.items.flatMap<StorefrontProduct>(
      (product) => {
        if (
          !product.image ||
          !isSafeLocalCatalogImagePath(product.image.path)
        ) {
          return [];
        }

        return [
          {
            key: product.slug,
            href: `${catalogPath}/${product.slug}` as Route,
            name: product.name[locale],
            imageSrc: product.image.path,
            imageAlt: product.image.alt[locale],
            priceMillimes: product.priceMillimes,
            availability: publicAvailability[product.availability],
          },
        ];
      },
    );

    products = databaseProducts;
  } catch {
    hasCatalogError = true;
  }

  return (
    <section
      id="products"
      aria-labelledby="products-heading"
      className="bg-soft px-4 py-16 sm:px-6 lg:px-8 lg:py-24"
    >
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <p className="text-sm font-bold uppercase tracking-[0.16em] text-brand">
              {t("Catalog.eyebrow")}
            </p>
            <h2
              id="products-heading"
              className="mt-3 text-3xl font-bold tracking-tight text-ink sm:text-4xl"
            >
              {t("Catalog.title")}
            </h2>
            <p className="mt-4 leading-8 text-muted">
              {t("Catalog.description")}
            </p>
          </div>
        </div>

        {hasCatalogError || products.length === 0 ? (
          <div className="mt-8 rounded-3xl border border-border bg-white px-6 py-10 text-center shadow-card sm:px-10">
            <span className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-brand-soft text-brand">
              {hasCatalogError ? (
                <AlertTriangle className="size-7" aria-hidden="true" />
              ) : (
                <PackageSearch className="size-7" aria-hidden="true" />
              )}
            </span>
            <h3 className="mt-5 text-xl font-bold text-ink">
              {t(
                hasCatalogError
                  ? "Catalog.errorTitle"
                  : "Catalog.emptyTitle",
              )}
            </h3>
            <p className="mx-auto mt-3 max-w-xl leading-7 text-muted">
              {t(
                hasCatalogError
                  ? "Catalog.errorDescription"
                  : "Catalog.emptyDescription",
              )}
            </p>
          </div>
        ) : (
          <ProductRail locale={locale}>
            {products.map((product) => (
              <ProductCard
                key={product.key}
                name={product.name}
                imageSrc={product.imageSrc}
                imageAlt={product.imageAlt}
                formattedPrice={formatTunisianDinars(
                  product.priceMillimes,
                  locale,
                )}
                availability={product.availability}
                availabilityLabel={t(`Availability.${product.availability}`)}
                href={product.href}
                actionLabel={t("Catalog.viewProduct")}
              />
            ))}
          </ProductRail>
        )}
      </div>
    </section>
  );
}
