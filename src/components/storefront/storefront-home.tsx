import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { CategoryGrid } from "@/components/storefront/category-grid";
import { Hero } from "@/components/storefront/hero";
import { ProductGrid } from "@/components/storefront/product-grid";
import type { AppLocale } from "@/i18n/routing";

type StorefrontHomeProps = {
  locale: AppLocale;
};

export function StorefrontHome({ locale }: StorefrontHomeProps) {
  return (
    <div id="top" className="min-h-screen bg-white text-ink">
      <SiteHeader locale={locale} />
      <main id="main-content">
        <Hero />
        <CategoryGrid locale={locale} />
        <ProductGrid locale={locale} />
      </main>
      <SiteFooter locale={locale} />
    </div>
  );
}
