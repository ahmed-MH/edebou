"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { Children, useRef, type ReactNode } from "react";

import type { AppLocale } from "@/i18n/routing";

type ProductRailProps = {
  children: ReactNode;
  locale: AppLocale;
};

const railLabels = {
  ar: {
    next: "عرض المنتجات التالية",
    previous: "عرض المنتجات السابقة",
    region: "منتجات مختارة",
  },
  fr: {
    next: "Afficher les produits suivants",
    previous: "Afficher les produits précédents",
    region: "Produits sélectionnés",
  },
} as const;

export function ProductRail({ children, locale }: ProductRailProps) {
  const railRef = useRef<HTMLUListElement>(null);
  const labels = railLabels[locale];
  const items = Children.toArray(children);
  const railId = `home-product-rail-${locale}`;

  const move = (direction: -1 | 1) => {
    const rail = railRef.current;

    if (!rail) {
      return;
    }

    const distance = Math.max(rail.clientWidth * 0.82, 260);
    const localeDirection = locale === "ar" ? -direction : direction;

    rail.scrollBy({
      behavior: "smooth",
      left: localeDirection * distance,
    });
  };

  return (
    <div className="mt-8" role="region" aria-label={labels.region}>
      {items.length > 1 ? (
        <div className="mb-4 flex items-center justify-end gap-2">
          <button
            type="button"
            aria-controls={railId}
            aria-label={labels.previous}
            onClick={() => move(-1)}
            className="inline-flex size-11 items-center justify-center rounded-full border border-border bg-white text-ink shadow-card transition-[border-color,color,transform] hover:scale-105 hover:border-brand/30 hover:text-brand"
          >
            <ChevronLeft className="size-5 rtl:rotate-180" aria-hidden="true" />
          </button>
          <button
            type="button"
            aria-controls={railId}
            aria-label={labels.next}
            onClick={() => move(1)}
            className="inline-flex size-11 items-center justify-center rounded-full border border-border bg-white text-ink shadow-card transition-[border-color,color,transform] hover:scale-105 hover:border-brand/30 hover:text-brand"
          >
            <ChevronRight className="size-5 rtl:rotate-180" aria-hidden="true" />
          </button>
        </div>
      ) : null}

      <ul
        ref={railRef}
        id={railId}
        dir={locale === "ar" ? "rtl" : "ltr"}
        className="flex snap-x snap-mandatory gap-4 overflow-x-auto overscroll-x-contain pb-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden md:gap-5 xl:gap-6"
      >
        {items.map((item, index) => (
          <li
            key={index}
            className="w-[84%] shrink-0 snap-start min-[430px]:w-[47%] md:w-[31%] xl:w-[23.5%]"
          >
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}
