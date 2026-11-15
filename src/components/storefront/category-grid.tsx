import {
  Dumbbell,
  House,
  Shirt,
  ShoppingBasket,
  Smartphone,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import { getTranslations } from "next-intl/server";

import { demoCategories } from "@/data/demo/categories";
import type { CategoryIconName } from "@/types/catalog";

const categoryIcons: Record<CategoryIconName, LucideIcon> = {
  Smartphone,
  House,
  Shirt,
  Sparkles,
  Dumbbell,
  ShoppingBasket,
};

export async function CategoryGrid() {
  const t = await getTranslations();

  return (
    <section id="categories" aria-labelledby="categories-heading" className="bg-white px-4 py-16 sm:px-6 lg:px-8 lg:py-24">
      <div className="mx-auto max-w-7xl">
        <div className="max-w-2xl">
          <p className="text-sm font-bold uppercase tracking-[0.16em] text-brand">
            {t("Categories.eyebrow")}
          </p>
          <h2
            id="categories-heading"
            className="mt-3 text-3xl font-bold tracking-tight text-ink sm:text-4xl"
          >
            {t("Categories.title")}
          </h2>
          <p className="mt-4 leading-8 text-muted">
            {t("Categories.description")}
          </p>
        </div>

        <ul className="mt-10 grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 xl:grid-cols-6">
          {demoCategories.map((category) => {
            const Icon = categoryIcons[category.iconName];

            return (
              <li
                key={category.id}
                className="flex min-h-40 flex-col justify-between rounded-2xl border border-border bg-white p-4 shadow-card transition-[border-color,transform] hover:-translate-y-0.5 hover:border-brand/25 sm:p-5"
              >
                <span className="inline-flex size-12 items-center justify-center rounded-xl bg-brand-soft text-brand">
                  <Icon className="size-6" aria-hidden="true" />
                </span>
                <h3 className="mt-6 text-sm font-bold leading-6 text-ink sm:text-base">
                  {t(category.nameKey)}
                </h3>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
