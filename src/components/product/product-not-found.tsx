import { PackageX } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import type { AppLocale } from "@/i18n/routing";

export async function ProductNotFound({ locale }: { locale: AppLocale }) {
  const t = await getTranslations("ProductDetail");
  const catalogPath = `${locale === "fr" ? "/fr" : ""}/products`;

  return (
    <div id="top" className="min-h-screen bg-soft text-ink">
      <SiteHeader locale={locale} />
      <main id="main-content" className="px-4 py-16 sm:px-6 lg:px-8 lg:py-24">
        <div className="mx-auto max-w-2xl rounded-3xl border border-border bg-white px-6 py-12 text-center shadow-card sm:px-10">
          <span className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-brand-soft text-brand">
            <PackageX className="size-7" aria-hidden="true" />
          </span>
          <h1 className="mt-5 text-2xl font-bold text-ink">
            {t("notFoundTitle")}
          </h1>
          <p className="mx-auto mt-3 max-w-lg leading-7 text-muted">
            {t("notFoundDescription")}
          </p>
          <a
            href={catalogPath}
            className="mt-7 inline-flex min-h-11 items-center justify-center rounded-xl bg-ink px-5 text-sm font-bold text-white transition-colors hover:bg-brand"
          >
            {t("backToCatalog")}
          </a>
        </div>
      </main>
      <SiteFooter locale={locale} />
    </div>
  );
}
