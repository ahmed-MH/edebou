import { Info } from "lucide-react";
import type { Route } from "next";
import { getTranslations } from "next-intl/server";

import { ProductCard } from "@/components/storefront/product-card";
import { ProductRail } from "@/components/storefront/product-rail";
import { demoProducts } from "@/data/demo/products";
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
  let isFallback = true;
  let products: readonly StorefrontProduct[] = demoProducts.map((product) => {
    const name = t(product.nameKey);

    return {
      key: product.id,
      name,
      imageSrc: product.imageSrc,
      imageAlt: t("Products.imageAlt", { name }),
      priceMillimes: product.priceMillimes,
      availability: product.availability,
    };
  });

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

    if (databaseProducts.length > 0) {
      products = databaseProducts;
      isFallback = false;
    }
  } catch {
    // The storefront remains usable with controlled demo data while a local
    // database is unavailable; no connection detail reaches the response.
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
              {t(isFallback ? "Products.eyebrow" : "Catalog.eyebrow")}
            </p>
            <h2
              id="products-heading"
              className="mt-3 text-3xl font-bold tracking-tight text-ink sm:text-4xl"
            >
              {t(isFallback ? "Products.title" : "Catalog.title")}
            </h2>
            <p className="mt-4 leading-8 text-muted">
              {t(isFallback ? "Products.description" : "Catalog.description")}
            </p>
          </div>
          {isFallback ? (
            <span className="inline-flex w-fit rounded-full border border-brand/15 bg-brand-soft px-3.5 py-2 text-xs font-bold uppercase tracking-wide text-brand-dark">
              {t("Products.demoBadge")}
            </span>
          ) : null}
        </div>

        {isFallback ? (
          <div className="mt-8 flex items-start gap-3 rounded-2xl border border-brand/15 bg-white p-4 sm:p-5">
            <span className="mt-0.5 inline-flex size-9 shrink-0 items-center justify-center rounded-xl bg-brand-soft text-brand">
              <Info className="size-4" aria-hidden="true" />
            </span>
            <div>
              <p className="font-bold text-ink">
                {t("Products.demoNoticeTitle")}
              </p>
              <p className="mt-1 text-sm leading-6 text-muted">
                {t("Products.demoNoticeBody")}
              </p>
            </div>
          </div>
        ) : null}

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
              actionLabel={
                product.href
                  ? t("Catalog.viewProduct")
                  : t("Products.cartUnavailable")
              }
            />
          ))}
        </ProductRail>
      </div>
    </section>
  );
}
