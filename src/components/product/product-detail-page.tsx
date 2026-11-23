import { AlertTriangle, ArrowLeft, CircleAlert, CircleCheck } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";

import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import type { AppLocale } from "@/i18n/routing";
import type { PublicProductAvailability } from "@/lib/dto/catalog";
import {
  InvalidRequestError,
  ResourceNotFoundError,
} from "@/lib/errors";
import { formatTunisianDinars } from "@/lib/format-currency";
import { catalogService } from "@/lib/services";
import { orderService } from "@/lib/services/order-service";
import { parseProductSlug } from "@/lib/validators/catalog";

import { ProductAdditionalImages, ProductGallery } from "./product-gallery";
import { ProductPurchasePanel } from "./product-purchase-panel";

type ProductDetailPageProps = {
  locale: AppLocale;
  rawSlug: string;
};

const availabilityStyles: Record<PublicProductAvailability, string> = {
  IN_STOCK: "bg-emerald-50 text-emerald-800",
  LOW_STOCK: "bg-amber-50 text-amber-800",
  OUT_OF_STOCK: "bg-slate-100 text-slate-700",
};

export async function ProductDetailPage({
  locale,
  rawSlug,
}: ProductDetailPageProps) {
  const [tCatalog, tProduct, tAvailability] = await Promise.all([
    getTranslations("Catalog"),
    getTranslations("ProductDetail"),
    getTranslations("Availability"),
  ]);
  const catalogPath = `${locale === "fr" ? "/fr" : ""}/products`;
  let product: Awaited<ReturnType<typeof catalogService.getProductBySlug>>;
  let checkoutSettings: Awaited<ReturnType<typeof orderService.getCheckoutSettings>> | null = null;

  try {
    const slug = parseProductSlug(rawSlug);
    [product, checkoutSettings] = await Promise.all([
      catalogService.getProductBySlug(slug),
      orderService
        .getCheckoutSettings()
        .catch(() => null),
    ]);
  } catch (error) {
    if (
      error instanceof InvalidRequestError ||
      error instanceof ResourceNotFoundError
    ) {
      notFound();
    }

    return (
      <div id="top" className="min-h-screen bg-soft text-ink">
        <SiteHeader locale={locale} />
        <main id="main-content" className="px-4 py-16 sm:px-6 lg:px-8 lg:py-24">
          <div className="mx-auto max-w-2xl rounded-3xl border border-border bg-white px-6 py-12 text-center shadow-card sm:px-10">
            <span className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-brand-soft text-brand">
              <AlertTriangle className="size-7" aria-hidden="true" />
            </span>
            <h1 className="mt-5 text-2xl font-bold text-ink">
              {tCatalog("errorTitle")}
            </h1>
            <p className="mx-auto mt-3 max-w-lg leading-7 text-muted">
              {tCatalog("errorDescription")}
            </p>
            <a
              href={`${catalogPath}/${encodeURIComponent(rawSlug)}`}
              className="mt-7 inline-flex min-h-11 items-center justify-center rounded-xl bg-ink px-5 text-sm font-bold text-white transition-colors hover:bg-brand"
            >
              {tCatalog("retry")}
            </a>
          </div>
        </main>
        <SiteFooter locale={locale} />
      </div>
    );
  }

  const AvailabilityIcon =
    product.availability === "IN_STOCK" ? CircleCheck : CircleAlert;
  const availabilityKey = {
    IN_STOCK: "in_stock",
    LOW_STOCK: "low_stock",
    OUT_OF_STOCK: "out_of_stock",
  } as const;
  const discountPercent = product.compareAtPriceMillimes && product.compareAtPriceMillimes > product.priceMillimes
    ? Math.round((1 - product.priceMillimes / product.compareAtPriceMillimes) * 100)
    : null;
  const contactPhone = checkoutSettings?.contactPhone && /^\+216[234579][0-9]{7}$/u.test(checkoutSettings.contactPhone)
    ? checkoutSettings.contactPhone
    : null;

  return (
    <div id="top" className="min-h-screen bg-white text-ink">
      <SiteHeader locale={locale} productPage />
      <main id="main-content" className="px-4 pb-28 pt-4 sm:px-6 sm:pt-8">
        <div className="mx-auto max-w-3xl">
          <a
            href={catalogPath}
            className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-muted transition-colors hover:text-brand"
          >
            <ArrowLeft
              className="size-4 rtl:rotate-180"
              aria-hidden="true"
            />
            {tProduct("backToCatalog")}
          </a>

          <div className="mt-3 flex flex-wrap items-center gap-3 text-sm font-semibold">
            <span className="text-brand">{product.category.name[locale]}</span>
            <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 ${availabilityStyles[product.availability]}`}>
              <AvailabilityIcon className="size-4" aria-hidden="true" />
              {tAvailability(availabilityKey[product.availability])}
            </span>
          </div>
          <h1 className="mt-4 text-3xl font-extrabold leading-tight tracking-tight text-ink sm:text-4xl">
            {product.name[locale]}
          </h1>

          <div className="mt-5">
            <ProductGallery
              images={product.images}
              locale={locale}
              fallbackLabel={tProduct("noImage")}
              showThumbnails={false}
            />
          </div>

          <div className="mt-5 border-b border-brand/60 pb-5">
            <p className="text-sm font-semibold text-muted">{tProduct("unitPriceLabel")}</p>
            <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1">
              <bdi className="price-value text-3xl font-extrabold text-ink">
                {formatTunisianDinars(product.priceMillimes, locale)}
              </bdi>
              {discountPercent !== null ? (
                <>
                  <bdi className="price-value text-xl text-muted line-through">
                    {formatTunisianDinars(product.compareAtPriceMillimes!, locale)}
                  </bdi>
                  <span className="rounded-lg border border-brand/40 bg-brand-soft px-2 py-1 text-base font-bold text-brand">
                    -{discountPercent}%
                  </span>
                </>
              ) : null}
            </div>
          </div>

          <div className="mt-6">
            <ProductPurchasePanel
                slug={product.slug}
                locale={locale}
                availability={product.availability}
                basePriceMillimes={product.priceMillimes}
                contactPhone={contactPhone}
                deliveryFeeMillimes={checkoutSettings?.deliveryFeeMillimes ?? null}
                priceTiers={product.priceTiers}
                productName={product.name[locale]}
                labels={{
                  addToCart: tProduct("addToCart"),
                  addedToCart: tProduct("addedToCart"),
                  callUs: tProduct("callUs"),
                  decreaseQuantity: tProduct("decreaseQuantity"),
                  fromQuantityLabels: [
                    1,
                    ...product.priceTiers.map((tier) => tier.minQuantity),
                  ].map((quantity) => tProduct("offerQuantity", { quantity })),
                  increaseQuantity: tProduct("increaseQuantity"),
                  outOfStock: tProduct("outOfStock"),
                  orderNow: tProduct("orderNow"),
                  pricingDescription: tProduct("pricingDescription"),
                  pricingTitle: tProduct("pricingTitle"),
                  quantity: tProduct("quantityLabel"),
                }}
            />
          </div>

          <section className="mt-10 border-t border-border pt-8">
            <h2 className="text-2xl font-extrabold text-ink">{tProduct("descriptionTitle")}</h2>
            <p className="mt-4 whitespace-pre-line text-base leading-8 text-ink/85">
              {product.description[locale]}
            </p>
            <p className="mt-5 text-sm text-muted">
              {tProduct("skuLabel")} : <bdi className="font-mono">{product.sku}</bdi>
            </p>
          </section>
          <ProductAdditionalImages
            images={product.images}
            locale={locale}
            title={tProduct("additionalPhotos")}
          />
        </div>
      </main>
      <SiteFooter locale={locale} />
      {product.availability !== "OUT_OF_STOCK" ? <div className="h-20" aria-hidden="true" /> : null}
    </div>
  );
}
