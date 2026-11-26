import { AlertTriangle, ArrowLeft, CircleAlert, CircleCheck, Truck } from "lucide-react";
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
      <main id="main-content" className="px-4 pb-28 pt-3 sm:px-6 sm:pt-6">
        {/* Phones: big photo, then name + price on one line, then the order form, so the photo
            and the first fields show without scrolling. Computers: photo left, form right. */}
        <div className="mx-auto flex max-w-3xl flex-col lg:grid lg:max-w-6xl lg:grid-cols-2 lg:items-start lg:gap-10">
          <div className="order-2 mt-3 lg:col-start-2 lg:mt-0">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-semibold sm:text-sm">
              <a
                href={catalogPath}
                className="inline-flex min-h-9 items-center gap-1 text-muted transition-colors hover:text-brand"
              >
                <ArrowLeft className="size-4 rtl:rotate-180" aria-hidden="true" />
                {tProduct("backToCatalog")}
              </a>
              <span className="text-brand">{product.category.name[locale]}</span>
              <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 ${availabilityStyles[product.availability]}`}>
                <AvailabilityIcon className="size-3.5" aria-hidden="true" />
                {tAvailability(availabilityKey[product.availability])}
              </span>
            </div>

            <div className="mt-1 flex items-start justify-between gap-3">
                <h1 className="min-w-0 text-xl font-extrabold leading-tight tracking-tight text-ink sm:text-3xl">
                  {product.name[locale]}
                </h1>
                <div className="flex shrink-0 flex-col items-end gap-1.5">
                  <bdi className="price-tag price-value text-xl sm:text-3xl">
                    {formatTunisianDinars(product.priceMillimes, locale)}
                  </bdi>
                  {discountPercent !== null ? (
                    <div className="flex items-center gap-1.5">
                      <bdi className="price-value text-sm font-semibold text-muted line-through decoration-brand/70 decoration-2">
                        {formatTunisianDinars(product.compareAtPriceMillimes!, locale)}
                      </bdi>
                      <span dir="ltr" className="rounded-full bg-amber-400 px-2 py-0.5 text-xs font-black text-ink shadow-sm">
                        -{discountPercent}%
                      </span>
                    </div>
                  ) : null}
                  {/* Delivery fee from Admin → Paramètres, so the customer knows the full cost up front. */}
                  {checkoutSettings ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-bold text-emerald-800 ring-1 ring-emerald-200">
                      <Truck className="size-3.5" aria-hidden="true" />
                      {checkoutSettings.deliveryFeeMillimes === 0 ? (
                        tProduct("deliveryFree")
                      ) : (
                        <>
                          {tProduct("deliveryFee")}{" "}
                          <bdi className="price-value">{formatTunisianDinars(checkoutSettings.deliveryFeeMillimes, locale)}</bdi>
                        </>
                      )}
                    </span>
                  ) : null}
                </div>
              </div>

          <div className="mt-3">
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
                  whatsapp: tProduct("whatsapp"),
                }}
            />
          </div>
          </div>

          <div className="order-1 lg:sticky lg:top-28 lg:col-start-1 lg:row-start-1">
            <ProductGallery
              images={product.images}
              locale={locale}
              fallbackLabel={tProduct("noImage")}
              showThumbnails={false}
            />
          </div>

          <div className="order-3 lg:col-span-2">
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
        </div>
      </main>
      <SiteFooter locale={locale} />
      {product.availability !== "OUT_OF_STOCK" ? <div className="h-20" aria-hidden="true" /> : null}
    </div>
  );
}
