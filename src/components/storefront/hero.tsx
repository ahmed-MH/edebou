import {
  ArrowRight,
  HeartHandshake,
  House,
  Smartphone,
  Sparkles,
} from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";

import { Reveal } from "@/components/motion/reveal";
import { SplitText } from "@/components/ui/split-text";

const visualItems = [
  { key: "technology" as const, Icon: Smartphone },
  { key: "home" as const, Icon: House },
  { key: "lifestyle" as const, Icon: HeartHandshake },
  { key: "care" as const, Icon: Sparkles },
];

export async function Hero() {
  const [t, locale] = await Promise.all([getTranslations("Hero"), getLocale()]);

  return (
    <section className="px-4 pb-16 pt-6 sm:px-6 sm:pt-8 lg:px-8 lg:pb-24 lg:pt-10">
      <div className="mx-auto grid max-w-7xl overflow-hidden rounded-[1.75rem] bg-brand-soft lg:min-h-[29rem] lg:grid-cols-[1.25fr_0.75fr]">
        <div className="flex flex-col justify-center px-6 py-12 sm:px-10 lg:px-14 lg:py-16 xl:px-20">
          <p className="mb-5 inline-flex w-fit items-center rounded-full border border-brand/15 bg-white px-3.5 py-2 text-xs font-bold uppercase tracking-[0.14em] text-brand">
            {t("eyebrow")}
          </p>
          <SplitText
            tag="h1"
            text={t("title")}
            className="max-w-3xl text-4xl font-bold leading-[1.15] tracking-[-0.035em] text-ink sm:text-5xl lg:text-6xl"
          />
          <Reveal>
          <p className="mt-6 max-w-2xl text-base leading-8 text-muted sm:text-lg">
            {t("description")}
          </p>
          <div className="mt-8 flex flex-col gap-3 min-[390px]:flex-row">
            <a
              href="#products"
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-brand px-6 py-3 font-bold text-white shadow-lg shadow-brand/15 transition-colors hover:bg-brand-dark focus-visible:outline-white"
            >
              {t("primaryCta")}
              <ArrowRight
                className="size-4 rtl:-scale-x-100"
                aria-hidden="true"
              />
            </a>
            <a
              href={locale === "fr" ? "/fr/products" : "/products"}
              className="inline-flex min-h-12 items-center justify-center rounded-xl border border-ink/15 bg-white px-6 py-3 font-bold text-ink transition-colors hover:border-brand/30 hover:text-brand"
            >
              {t("secondaryCta")}
            </a>
          </div>
          </Reveal>
        </div>

        {/* Decorative only: hidden on phones so the products come right after the title. */}
        <div className="relative hidden items-center justify-center overflow-hidden bg-brand px-6 py-10 sm:px-10 lg:flex lg:py-14">
          <div
            aria-hidden="true"
            className="absolute -start-20 -top-20 size-64 rounded-full border-[3rem] border-white/10"
          />
          <div
            aria-hidden="true"
            className="absolute -bottom-28 -end-24 size-72 rounded-full border-[3.5rem] border-white/10"
          />
          <div className="relative w-full max-w-md" role="img" aria-label={t("visualLabel")}>
            <div className="grid grid-cols-2 gap-3 sm:gap-4">
              {visualItems.map(({ key, Icon }) => (
                <div
                  key={key}
                  className="flex aspect-square flex-col justify-between rounded-2xl border border-white/15 bg-white/10 p-4 text-white shadow-xl shadow-black/5 sm:p-5"
                >
                  <span className="inline-flex size-11 items-center justify-center rounded-xl bg-white text-brand sm:size-12">
                    <Icon className="size-5 sm:size-6" aria-hidden="true" />
                  </span>
                  <span className="text-sm font-bold sm:text-base">
                    {t(`visualItems.${key}`)}
                  </span>
                </div>
              ))}
            </div>
            <p className="mt-5 text-center text-sm font-semibold text-white/85">
              {t("visualCaption")}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
