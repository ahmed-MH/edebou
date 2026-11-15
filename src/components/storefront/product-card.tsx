import { CircleAlert, CircleCheck, Eye, ShoppingBag } from "lucide-react";
import type { Route } from "next";
import Link from "next/link";

import { cn } from "@/lib/cn";
import type { ProductAvailability } from "@/types/catalog";

type ProductCardProps = {
  name: string;
  imageSrc: string;
  imageAlt: string;
  formattedPrice: string;
  availability: ProductAvailability;
  availabilityLabel: string;
  actionLabel: string;
  href?: Route;
};

const availabilityStyles: Record<ProductAvailability, string> = {
  in_stock: "bg-emerald-50 text-emerald-800",
  low_stock: "bg-amber-50 text-amber-800",
  out_of_stock: "bg-slate-100 text-slate-700",
};

export function ProductCard({
  name,
  imageSrc,
  imageAlt,
  formattedPrice,
  availability,
  availabilityLabel,
  actionLabel,
  href,
}: ProductCardProps) {
  const AvailabilityIcon =
    availability === "in_stock" ? CircleCheck : CircleAlert;

  const content = (
    <>
      <div className="product-media-stage relative mx-2 mt-2 aspect-[4/3] overflow-hidden rounded-[1.25rem]">
        {/*
          These are tiny, local SVG fixtures. A native image keeps the strict
          style-src-attr CSP intact; next/image emits an inline style attribute.
        */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={imageSrc}
          alt={imageAlt}
          width="800"
          height="600"
          loading="lazy"
          decoding="async"
          className="h-full w-full object-contain p-4 transition-transform duration-500 ease-out group-hover:scale-[1.035] sm:p-5"
        />
      </div>
      <div className="flex flex-1 flex-col px-4 pb-4 pt-5 sm:px-5 sm:pb-5">
        <div
          className={cn(
            "inline-flex w-fit items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold",
            availabilityStyles[availability],
          )}
        >
          <AvailabilityIcon className="size-3.5" aria-hidden="true" />
          <span>{availabilityLabel}</span>
        </div>
        <h3 className="mt-4 min-h-12 text-base font-bold leading-6 text-ink sm:text-lg">
          {name}
        </h3>
        <bdi className="price-value mt-3 text-xl font-bold text-brand sm:text-2xl">
          {formattedPrice}
        </bdi>
        {href ? (
          <span className="mt-5 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-ink px-3 text-xs font-bold text-white transition-colors group-hover:bg-brand sm:text-sm">
            <Eye className="size-4" aria-hidden="true" />
            {actionLabel}
          </span>
        ) : (
          <button
            type="button"
            disabled
            className="mt-5 inline-flex min-h-11 w-full cursor-not-allowed items-center justify-center gap-2 rounded-xl border border-border bg-soft px-3 text-xs font-bold text-muted opacity-90 sm:text-sm"
          >
            <ShoppingBag className="size-4" aria-hidden="true" />
            {actionLabel}
          </button>
        )}
      </div>
    </>
  );

  return (
    <article className="group h-full overflow-hidden rounded-[1.65rem] border border-border bg-white shadow-card transition-[border-color,transform,box-shadow] hover:-translate-y-1 hover:border-brand/20 hover:shadow-soft focus-within:border-brand/30 focus-within:shadow-soft">
      {href ? (
        <Link
          href={href}
          aria-label={`${actionLabel}: ${name}`}
          className="flex h-full cursor-pointer flex-col focus-visible:outline-offset-[-3px]"
        >
          {content}
        </Link>
      ) : (
        <div className="flex h-full flex-col">{content}</div>
      )}
    </article>
  );
}
