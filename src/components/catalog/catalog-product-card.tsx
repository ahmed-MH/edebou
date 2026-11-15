import { CircleAlert, CircleCheck, ImageIcon } from "lucide-react";

import type { AppLocale } from "@/i18n/routing";
import { isSafeLocalCatalogImagePath } from "@/lib/catalog-image";
import type {
  PublicProductAvailability,
  PublicProductSummaryDto,
} from "@/lib/dto/catalog";
import { formatTunisianDinars } from "@/lib/format-currency";

type CatalogProductCardProps = {
  availabilityLabel: string;
  imageFallbackLabel: string;
  locale: AppLocale;
  product: PublicProductSummaryDto;
  viewProductLabel: string;
};

const availabilityStyles: Record<PublicProductAvailability, string> = {
  IN_STOCK: "bg-emerald-50 text-emerald-800",
  LOW_STOCK: "bg-amber-50 text-amber-800",
  OUT_OF_STOCK: "bg-slate-100 text-slate-700",
};

export function CatalogProductCard({
  availabilityLabel,
  imageFallbackLabel,
  locale,
  product,
  viewProductLabel,
}: CatalogProductCardProps) {
  const AvailabilityIcon =
    product.availability === "IN_STOCK" ? CircleCheck : CircleAlert;
  const productPath = `${locale === "fr" ? "/fr" : ""}/products/${product.slug}`;
  const image =
    product.image && isSafeLocalCatalogImagePath(product.image.path)
      ? product.image
      : null;

  return (
    <article className="group flex h-full flex-col overflow-hidden rounded-[1.75rem] border border-border bg-white shadow-card transition-[border-color,transform,box-shadow] hover:-translate-y-1 hover:border-brand/25 hover:shadow-soft">
      <a
        href={productPath}
        aria-label={`${viewProductLabel}: ${product.name[locale]}`}
        className="flex h-full flex-col focus-visible:outline-offset-[-3px]"
      >
        <div className="product-media-stage relative mx-2 mt-2 aspect-[4/3] overflow-hidden rounded-[1.35rem]">
          {image ? (
            // Local catalog assets are rendered without inline styles to keep
            // the strict style-src-attr policy intact.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={image.path}
              alt={image.alt[locale]}
              width="800"
              height="800"
              loading="lazy"
              decoding="async"
              className="h-full w-full object-contain p-4 transition-transform duration-500 ease-out group-hover:scale-[1.035] sm:p-5"
            />
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center text-muted">
              <ImageIcon className="size-10" aria-hidden="true" />
              <span className="text-sm font-semibold">{imageFallbackLabel}</span>
            </div>
          )}
        </div>

        <div className="flex flex-1 flex-col px-4 pb-4 pt-5 sm:px-5 sm:pb-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs font-bold uppercase tracking-[0.12em] text-muted">
              {product.category.name[locale]}
            </span>
            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold ${availabilityStyles[product.availability]}`}
            >
              <AvailabilityIcon className="size-3.5" aria-hidden="true" />
              {availabilityLabel}
            </span>
          </div>

          <h2 className="mt-4 text-lg font-bold leading-7 text-ink">
            {product.name[locale]}
          </h2>
          <bdi className="price-value mt-auto pt-5 text-xl font-extrabold text-brand sm:text-2xl">
            {formatTunisianDinars(product.priceMillimes, locale)}
          </bdi>
          <span className="mt-4 inline-flex min-h-11 items-center justify-center rounded-xl bg-ink px-4 text-sm font-bold text-white transition-colors group-hover:bg-brand">
            {viewProductLabel}
          </span>
        </div>
      </a>
    </article>
  );
}
