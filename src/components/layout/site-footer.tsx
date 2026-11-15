import { getTranslations } from "next-intl/server";

import { BrandMark } from "@/components/ui/brand-mark";
import type { AppLocale } from "@/i18n/routing";

type SiteFooterProps = {
  locale: AppLocale;
};

export async function SiteFooter({ locale }: SiteFooterProps) {
  const [tA11y, tFooter, tNavigation] = await Promise.all([
    getTranslations("A11y"),
    getTranslations("Footer"),
    getTranslations("Navigation"),
  ]);
  const currentYear = new Date().getFullYear();
  const homeHref = locale === "fr" ? "/fr" : "/";
  const productsHref = locale === "fr" ? "/fr/products" : "/products";
  const navigationItems = [
    { href: `${homeHref}#top`, label: tNavigation("home") },
    { href: `${homeHref}#categories`, label: tNavigation("categories") },
    { href: productsHref, label: tNavigation("products") },
  ];
  return (
    <footer className="bg-ink px-4 py-14 text-white sm:px-6 lg:px-8 lg:py-18">
      <div className="mx-auto max-w-7xl">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-[1.4fr_0.8fr_1fr] lg:gap-14">
          <div>
            <BrandMark
              variant="red"
              imageClassName="h-11 sm:h-12"
            />
            <p className="mt-4 max-w-sm text-sm leading-7 text-white/70">
              {tFooter("description")}
            </p>
          </div>

          <nav aria-label={tA11y("footerNavigation")}>
            <h2 className="text-sm font-bold uppercase tracking-[0.14em] text-white/55">
              {tFooter("exploreTitle")}
            </h2>
            <ul className="mt-4 grid gap-3 text-sm font-semibold">
              {navigationItems.map((item) => (
                <li key={item.href}>
                  <a
                    href={item.href}
                    className="inline-flex min-h-8 items-center text-white/80 transition-colors hover:text-white"
                  >
                    {item.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>

          <div>
            <h2 className="text-sm font-bold uppercase tracking-[0.14em] text-white/55">
              {tFooter("informationTitle")}
            </h2>
            <p className="mt-4 text-sm leading-7 text-white/75">
              {tFooter("informationBody")}
            </p>
          </div>

        </div>

        <div className="mt-12 border-t border-white/10 pt-6 text-xs text-white/55">
          <p>
            © {currentYear} EDebou. {tFooter("rights")}
          </p>
        </div>
      </div>
    </footer>
  );
}
