import { Banknote, MessageCircle, Phone, Truck } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { BrandMark } from "@/components/ui/brand-mark";
import type { AppLocale } from "@/i18n/routing";
import { formatTunisianDinars } from "@/lib/format-currency";
import { orderService } from "@/lib/services/order-service";
import { generalQuestionMessage, whatsappUrl } from "@/lib/whatsapp";

type SiteFooterProps = {
  locale: AppLocale;
};

export async function SiteFooter({ locale }: SiteFooterProps) {
  const [tA11y, tFooter, tNavigation, settings] = await Promise.all([
    getTranslations("A11y"),
    getTranslations("Footer"),
    getTranslations("Navigation"),
    // Contact details come from Admin → Paramètres; the footer simply hides them if unavailable.
    orderService.getCheckoutSettings().catch(() => null),
  ]);
  const contactPhone = settings?.contactPhone && /^\+216[234579][0-9]{7}$/u.test(settings.contactPhone)
    ? settings.contactPhone
    : null;
  const currentYear = new Date().getFullYear();
  const homeHref = locale === "fr" ? "/fr" : "/";
  const productsHref = locale === "fr" ? "/fr/products" : "/products";
  const navigationItems = [
    { href: `${homeHref}#top`, label: tNavigation("home") },
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
            <ul className="mt-4 grid gap-3 text-sm font-semibold text-white/85">
              <li className="flex items-center gap-2">
                <Banknote className="size-4 shrink-0 text-white/60" aria-hidden="true" />
                {tFooter("cashOnDelivery")}
              </li>
              {settings ? (
                <li className="flex items-center gap-2">
                  <Truck className="size-4 shrink-0 text-white/60" aria-hidden="true" />
                  {tFooter("deliveryFee")}{" "}
                  <bdi className="price-value">{formatTunisianDinars(settings.deliveryFeeMillimes, locale)}</bdi>
                </li>
              ) : null}
            </ul>
            {contactPhone ? (
              <div className="mt-5 flex flex-wrap gap-3">
                <a
                  href={whatsappUrl(contactPhone, generalQuestionMessage)}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-emerald-600 px-4 text-sm font-bold text-white hover:bg-emerald-700"
                >
                  <MessageCircle className="size-5" aria-hidden="true" />
                  {tFooter("whatsapp")}
                </a>
                <a
                  href={`tel:${contactPhone}`}
                  className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-white/25 px-4 text-sm font-bold text-white hover:bg-white/10"
                >
                  <Phone className="size-5" aria-hidden="true" />
                  <bdi dir="ltr">{contactPhone.replace(/^\+216(\d{2})(\d{3})(\d{3})$/u, "$1 $2 $3")}</bdi>
                </a>
              </div>
            ) : null}
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
