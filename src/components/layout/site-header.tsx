import { Search } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { CartLink } from "@/components/cart/cart-link";
import { BrandMark } from "@/components/ui/brand-mark";
import type { AppLocale } from "@/i18n/routing";

import { LocaleSwitcher } from "./locale-switcher";
import { MobileNavigation } from "./mobile-navigation";

type SiteHeaderProps = {
  locale: AppLocale;
  productPage?: boolean;
};

type SearchPreviewProps = {
  label: string;
  placeholder: string;
  action: string;
  className?: string;
};

function CatalogSearch({
  label,
  placeholder,
  action,
  className,
}: SearchPreviewProps) {
  return (
    <form role="search" aria-label={label} action={action} method="get" className={className}>
      <div className="flex min-h-12 items-center gap-3 rounded-xl border border-border bg-soft px-4 text-muted transition-colors focus-within:border-brand/40">
        <input
          type="search"
          name="search"
          minLength={2}
          maxLength={80}
          aria-label={label}
          placeholder={placeholder}
          className="min-w-0 flex-1 bg-transparent text-sm text-ink outline-none placeholder:text-muted/90"
        />
        <button
          type="submit"
          aria-label={label}
          className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg text-muted transition-colors hover:bg-white hover:text-brand"
        >
          <Search className="size-5" aria-hidden="true" />
        </button>
      </div>
    </form>
  );
}

export async function SiteHeader({ locale, productPage = false }: SiteHeaderProps) {
  const [tA11y, tHeader, tNavigation] = await Promise.all([
    getTranslations("A11y"),
    getTranslations("Header"),
    getTranslations("Navigation"),
  ]);

  const homeHref = locale === "fr" ? "/fr" : "/";
  const productsHref = locale === "fr" ? "/fr/products" : "/products";
  const searchPlaceholder = tHeader("searchPlaceholder");
  const navigationItems = [
    { href: `${homeHref}#top`, label: tNavigation("home") },
    { href: `${homeHref}#categories`, label: tNavigation("categories") },
    { href: productsHref, label: tNavigation("products") },
  ];
  const localeOptions = [
    { locale: "ar" as const, label: tHeader("arabic") },
    { locale: "fr" as const, label: tHeader("french") },
  ];
  const languageSwitcher = (
    <LocaleSwitcher
      currentLocale={locale}
      label={tA11y("languageNavigation")}
      options={localeOptions}
    />
  );

  return (
    <>
      <a
        href="#main-content"
        className="fixed start-4 top-3 z-[70] -translate-y-24 rounded-lg bg-ink px-4 py-3 font-bold text-white transition-transform focus:translate-y-0"
      >
        {tA11y("skipToContent")}
      </a>

      <header className="sticky top-0 z-40 border-b border-border bg-white/95">
        {productPage ? (
          <div className="bg-brand px-4 py-1.5 text-center text-sm font-bold text-white sm:text-base">
            {tHeader("welcome")}
          </div>
        ) : null}
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className={`grid grid-cols-[4.25rem_minmax(0,1fr)_4.25rem] items-center gap-3 md:flex md:min-h-[4.75rem] md:gap-5 lg:gap-7 ${productPage ? "min-h-16" : "min-h-20"}`}>
            <MobileNavigation
              ariaLabel={tA11y("mobileNavigation")}
              openLabel={tHeader("openMenu")}
              closeLabel={tHeader("closeMenu")}
              menuTitle={tHeader("menuTitle")}
              items={navigationItems}
              languageSwitcher={languageSwitcher}
            />

            <BrandMark
              className="min-w-0 shrink-0 justify-self-center md:justify-self-auto"
              imageClassName={productPage ? "h-8 min-[390px]:h-9 md:h-9" : "h-10 min-[390px]:h-11 md:h-9"}
            />

            <CatalogSearch
              label={tHeader("searchLabel")}
              placeholder={searchPlaceholder}
              action={productsHref}
              className="hidden min-w-0 flex-1 md:block"
            />

            <div className="ms-auto hidden shrink-0 lg:block">
              {languageSwitcher}
            </div>

            <CartLink locale={locale} />
          </div>

          <CatalogSearch
            label={tHeader("searchLabel")}
            placeholder={searchPlaceholder}
            action={productsHref}
            className={productPage ? "hidden" : "pb-4 md:hidden"}
          />
        </div>

        <nav
          aria-label={tA11y("primaryNavigation")}
          className="hidden border-t border-border/80 lg:block"
        >
          <ul className="mx-auto flex min-h-11 max-w-7xl items-center gap-8 px-8 text-sm font-semibold text-muted">
            {navigationItems.map((item) => (
              <li key={item.href}>
                <a
                  href={item.href}
                  className="inline-flex min-h-11 items-center border-b-2 border-transparent transition-colors hover:border-brand hover:text-brand"
                >
                  {item.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      </header>
    </>
  );
}
