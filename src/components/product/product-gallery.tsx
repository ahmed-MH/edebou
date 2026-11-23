"use client";

import { ChevronLeft, ChevronRight, ImageIcon } from "lucide-react";
import { useRef, useState, type TouchEvent } from "react";

import type { AppLocale } from "@/i18n/routing";
import { isSafeLocalCatalogImagePath } from "@/lib/catalog-image";
import type { PublicProductImageDto } from "@/lib/dto/catalog";

type ProductGalleryProps = {
  fallbackLabel: string;
  images: readonly PublicProductImageDto[];
  locale: AppLocale;
  showThumbnails?: boolean;
};

const galleryLabels = {
  ar: {
    gallery: "صور المنتج",
    next: "الصورة التالية",
    previous: "الصورة السابقة",
    select: "عرض الصورة",
  },
  fr: {
    gallery: "Photos du produit",
    next: "Image suivante",
    previous: "Image précédente",
    select: "Afficher l’image",
  },
} as const;

export function ProductGallery({
  fallbackLabel,
  images,
  locale,
  showThumbnails = true,
}: ProductGalleryProps) {
  const safeImages = images.filter((image) =>
    isSafeLocalCatalogImagePath(image.path),
  );
  const [activeIndex, setActiveIndex] = useState(0);
  const touchStartX = useRef<number | null>(null);
  const labels = galleryLabels[locale];
  const activeImage = safeImages[activeIndex] ?? safeImages[0];

  if (!activeImage) {
    return (
      <div className="flex aspect-square items-center justify-center overflow-hidden rounded-xl border border-border bg-white px-8 text-center text-muted">
        <div>
          <ImageIcon className="mx-auto size-12" aria-hidden="true" />
          <p className="mt-4 font-semibold">{fallbackLabel}</p>
        </div>
      </div>
    );
  }

  const showPrevious = () => {
    setActiveIndex((current) =>
      current === 0 ? safeImages.length - 1 : current - 1,
    );
  };
  const showNext = () => {
    setActiveIndex((current) => (current + 1) % safeImages.length);
  };
  const handleTouchStart = (event: TouchEvent<HTMLDivElement>) => {
    touchStartX.current = event.touches.item(0)?.clientX ?? null;
  };
  const handleTouchEnd = (event: TouchEvent<HTMLDivElement>) => {
    const endX = event.changedTouches.item(0)?.clientX;
    const startX = touchStartX.current;
    touchStartX.current = null;

    if (startX === null || endX === undefined || safeImages.length < 2) {
      return;
    }

    const distance = startX - endX;

    if (Math.abs(distance) < 48) {
      return;
    }

    if (distance > 0) {
      showNext();
    } else {
      showPrevious();
    }
  };

  return (
    <section aria-label={labels.gallery}>
      <div
        className="relative flex aspect-square touch-pan-y items-center justify-center overflow-hidden rounded-xl border border-border/80 bg-white"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          key={activeImage.path}
          src={activeImage.path}
          alt={activeImage.alt[locale]}
          width="1200"
          height="1200"
          fetchPriority="high"
          decoding="async"
          className="h-full w-full object-contain p-0 sm:p-3 lg:p-5"
        />

        {safeImages.length > 1 ? (
          <>
            <button
              type="button"
              onClick={showPrevious}
              aria-label={labels.previous}
              className="absolute left-2 top-1/2 z-10 inline-flex size-11 -translate-y-1/2 items-center justify-center rounded-full border border-border bg-white/95 text-ink shadow-card transition-[border-color,color,transform] hover:scale-105 hover:border-brand/30 hover:text-brand sm:left-4"
            >
              <ChevronLeft className="size-6" aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={showNext}
              aria-label={labels.next}
              className="absolute right-2 top-1/2 z-10 inline-flex size-11 -translate-y-1/2 items-center justify-center rounded-full border border-border bg-white/95 text-ink shadow-card transition-[border-color,color,transform] hover:scale-105 hover:border-brand/30 hover:text-brand sm:right-4"
            >
              <ChevronRight className="size-6" aria-hidden="true" />
            </button>
          </>
        ) : null}
      </div>

      {showThumbnails ? <ul
        className={`mt-4 flex gap-3 overflow-x-auto pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden ${
          safeImages.length <= 4 ? "justify-center" : "justify-start"
        }`}
        dir={locale === "ar" ? "rtl" : "ltr"}
      >
        {safeImages.map((image, index) => {
          const isActive = index === activeIndex;

          return (
            <li key={`${image.position}-${image.path}`} className="shrink-0">
              <button
                type="button"
                onClick={() => setActiveIndex(index)}
                aria-label={`${labels.select} ${index + 1}`}
                aria-pressed={isActive}
                className={`flex aspect-square w-20 items-center justify-center overflow-hidden bg-white p-1 transition-[border-color,opacity] sm:w-24 ${
                  isActive
                    ? "border-2 border-ink"
                    : "border-2 border-transparent opacity-70 hover:border-border hover:opacity-100"
                }`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={image.path}
                  alt=""
                  width="240"
                  height="240"
                  loading={index === 0 ? "eager" : "lazy"}
                  decoding="async"
                  className="h-full w-full object-contain"
                />
              </button>
            </li>
          );
        })}
      </ul> : null}
    </section>
  );
}

export function ProductAdditionalImages({
  images,
  locale,
  title,
}: {
  readonly images: readonly PublicProductImageDto[];
  readonly locale: AppLocale;
  readonly title: string;
}) {
  const additionalImages = images.slice(1).filter((image) =>
    isSafeLocalCatalogImagePath(image.path),
  );
  if (additionalImages.length === 0) return null;

  return (
    <section className="mt-10" aria-label={title}>
      <h2 className="mb-5 text-2xl font-extrabold text-ink">{title}</h2>
      <div className="grid gap-5">
        {additionalImages.map((image) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={`${image.position}-${image.path}`}
            src={image.path}
            alt={image.alt[locale]}
            width="1200"
            height="1200"
            loading="lazy"
            className="h-auto w-full rounded-xl border border-border object-contain"
          />
        ))}
      </div>
    </section>
  );
}
