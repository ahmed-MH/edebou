import type { Metadata, Viewport } from "next";
import { Cairo, Montserrat } from "next/font/google";
import { headers } from "next/headers";
import { connection } from "next/server";
import { hasLocale, NextIntlClientProvider } from "next-intl";
import { getTranslations } from "next-intl/server";
import type { ReactNode } from "react";

import { CartProvider } from "@/components/cart/cart-provider";
import { MetaPixel } from "@/components/analytics/meta-pixel";
import { SmoothScroll } from "@/components/motion/smooth-scroll";
import { siteConfig } from "@/config/site";
import { routing, type AppLocale } from "@/i18n/routing";

import "./globals.css";

const montserrat = Montserrat({
  variable: "--font-montserrat",
  subsets: ["latin"],
  display: "swap",
});

const cairo = Cairo({
  variable: "--font-cairo",
  subsets: ["arabic", "latin"],
  display: "swap",
});

export const viewport: Viewport = {
  colorScheme: "light",
  themeColor: "#E60023",
};

async function getRequestLocale(): Promise<AppLocale> {
  const requestedLocale = (await headers()).get("x-edebou-locale");
  return hasLocale(routing.locales, requestedLocale)
    ? requestedLocale
    : routing.defaultLocale;
}

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getRequestLocale();
  const t = await getTranslations({ locale, namespace: "Metadata" });

  return {
    title: t("title"),
    description: t("description"),
    alternates: {
      canonical: locale === "ar" ? "/" : "/fr",
      languages: {
        ar: "/",
        fr: "/fr",
      },
    },
    other: {
      "facebook-domain-verification": siteConfig.facebookDomainVerification,
    },
  };
}

export default async function RootLayout({ children }: { children: ReactNode }) {
  // A fresh CSP nonce is attached during request-time rendering.
  await connection();

  const locale = await getRequestLocale();
  const direction = locale === "ar" ? "rtl" : "ltr";

  return (
    <html
      lang={locale}
      dir={direction}
      data-scroll-behavior="smooth"
      className={`${montserrat.variable} ${cairo.variable}`}
    >
      <body>
        <NextIntlClientProvider
          locale={locale}
          messages={null}
          timeZone="Africa/Tunis"
        >
          <CartProvider>{children}</CartProvider>
          <SmoothScroll />
          {siteConfig.metaPixelId ? <MetaPixel pixelId={siteConfig.metaPixelId} /> : null}
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
