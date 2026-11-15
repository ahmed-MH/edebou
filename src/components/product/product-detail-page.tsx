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

import { ProductGallery } from "./product-gallery";
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
  let deliveryFeeMillimes: number | null = null;

  try {
    const slug = parseProductSlug(rawSlug);
    [product, deliveryFeeMillimes] = await Promise.all([
      catalogService.getProductBySlug(slug),
      orderService
        .getCheckoutSettings()
        .then((settings) => settings.deliveryFeeMillimes)
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

  return (
    <div id="top" className="min-h-screen bg-white text-ink">
      <SiteHeader locale={locale} />
      <main id="main-content" className="px-4 py-8 sm:px-6 lg:px-8 lg:py-12">
        <div className="mx-auto max-w-7xl">
          <a
            href={catalogPath}
            className="inline-flex min-h-11 items-center gap-2 text-xs font-bold uppercase tracking-[0.14em] text-muted transition-colors hover:text-brand"
          >
            <ArrowLeft
              className="size-4 rtl:rotate-180"
              aria-hidden="true"
            />
            {tProduct("backToCatalog")}
          </a>

          <div className="mt-5 grid gap-10 lg:grid-cols-[minmax(0,0.98fr)_minmax(24rem,0.78fr)] lg:items-start lg:gap-12 xl:gap-14">
            <ProductGallery
              images={product.images}
              locale={locale}
              fallbackLabel={tProduct("noImage")}
            />

            <aside className="lg:sticky lg:top-28">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-xs font-bold uppercase tracking-[0.14em]">
                <span className="text-brand">
                  {product.category.name[locale]}
                </span>
                <span className="size-1 rounded-full bg-border" aria-hidden="true" />
                <span
                  className={`inline-flex items-center gap-1.5 rounded-sm px-2 py-1 ${availabilityStyles[product.availability]}`}
                >
                  <AvailabilityIcon className="size-3.5" aria-hidden="true" />
                  {tAvailability(availabilityKey[product.availability])}
                </span>
              </div>

              <h1 className="mt-5 text-4xl font-extrabold uppercase leading-[1.02] tracking-[-0.035em] text-ink sm:text-5xl lg:text-[2.8rem] xl:text-5xl">
                {product.name[locale]}
              </h1>
              <dl className="mt-5 border-b border-ink/70 pb-7">
                <div>
                  <dt className="sr-only">
                    {tProduct("unitPriceLabel")}
                  </dt>
                  <dd>
                    <bdi className="price-value block text-xl font-semibold text-ink">
                      {formatTunisianDinars(product.priceMillimes, locale)}
                    </bdi>
                  </dd>
                </div>
                <div className="mt-3 flex items-center gap-2 text-xs uppercase tracking-[0.12em] text-muted">
                  <dt>
                    {tProduct("skuLabel")}
                  </dt>
                  <dd>
                    <bdi className="font-mono font-bold text-ink">
                      {product.sku}
                    </bdi>
                  </dd>
                </div>
              </dl>

              <section className="border-b border-border py-7">
                <h2 className="text-xs font-bold uppercase tracking-[0.16em] text-ink">
                  {tProduct("descriptionTitle")}
                </h2>
                <p className="mt-4 text-sm leading-7 text-muted sm:text-base">
                  {product.description[locale]}
                </p>
              </section>

              <ProductPurchasePanel
                slug={product.slug}
                locale={locale}
                availability={product.availability}
                basePriceMillimes={product.priceMillimes}
                deliveryFeeMillimes={deliveryFeeMillimes}
                priceTiers={product.priceTiers}
                productName={product.name[locale]}
                labels={{
                  addToCart: tProduct("addToCart"),
                  addedToCart: tProduct("addedToCart"),
                  decreaseQuantity: tProduct("decreaseQuantity"),
                  each: tProduct("eachLabel"),
                  fromQuantityLabels: [
                    1,
                    ...product.priceTiers.map((tier) => tier.minQuantity),
                  ].map((quantity) => tProduct("fromQuantity", { quantity })),
                  increaseQuantity: tProduct("increaseQuantity"),
                  outOfStock: tProduct("outOfStock"),
                  pricingDescription: tProduct("pricingDescription"),
                  pricingTitle: tProduct("pricingTitle"),
                  quantity: tProduct("quantityLabel"),
                  selectedUnitPrice: tProduct("selectedUnitPrice"),
                }}
              />
            </aside>
          </div>
        </div>
      </main>
      <SiteFooter locale={locale} />
    </div>
  );
}
