import {
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  PackageSearch,
  Search,
} from "lucide-react";
import type { Route } from "next";
import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";

import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import type { AppLocale } from "@/i18n/routing";
import type { PublicProductAvailability } from "@/lib/dto/catalog";
import { catalogService } from "@/lib/services";
import {
  parseProductListQuery,
  type ProductListQuery,
} from "@/lib/validators/catalog";

import { CatalogProductCard } from "./catalog-product-card";

export type CatalogSearchParams = Record<
  string,
  string | readonly string[] | undefined
>;

type CatalogPageProps = {
  locale: AppLocale;
  searchParams: Promise<CatalogSearchParams>;
};

type CatalogShellProps = {
  children: ReactNode;
  locale: AppLocale;
};

function CatalogShell({ children, locale }: CatalogShellProps) {
  return (
    <div id="top" className="min-h-screen bg-soft text-ink">
      <SiteHeader locale={locale} />
      {children}
      <SiteFooter locale={locale} />
    </div>
  );
}

export function catalogSearchParamsToUrlSearchParams(
  searchParams: CatalogSearchParams,
): URLSearchParams {
  const result = new URLSearchParams();

  for (const [key, value] of Object.entries(searchParams)) {
    if (typeof value === "string") {
      result.append(key, value);
      continue;
    }

    for (const item of value ?? []) {
      result.append(key, item);
    }
  }

  return result;
}

function createCatalogHref(
  locale: AppLocale,
  query: ProductListQuery,
  page: number,
): string {
  const pathname = `${locale === "fr" ? "/fr" : ""}/products`;
  const searchParams = new URLSearchParams();

  if (query.search) {
    searchParams.set("search", query.search);
  }
  if (query.category) {
    searchParams.set("category", query.category);
  }
  if (query.sort !== "newest") {
    searchParams.set("sort", query.sort);
  }
  if (page > 1) {
    searchParams.set("page", String(page));
  }

  const serialized = searchParams.toString();
  return serialized ? `${pathname}?${serialized}` : pathname;
}

function CatalogMessage({
  actionHref,
  actionLabel,
  description,
  icon,
  title,
}: {
  actionHref: string;
  actionLabel: string;
  description: string;
  icon: ReactNode;
  title: string;
}) {
  return (
    <div className="mx-auto max-w-2xl rounded-3xl border border-border bg-white px-6 py-12 text-center shadow-card sm:px-10">
      <span className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-brand-soft text-brand">
        {icon}
      </span>
      <h2 className="mt-5 text-2xl font-bold text-ink">{title}</h2>
      <p className="mx-auto mt-3 max-w-lg leading-7 text-muted">
        {description}
      </p>
      <a
        href={actionHref}
        className="mt-7 inline-flex min-h-11 items-center justify-center rounded-xl bg-ink px-5 text-sm font-bold text-white transition-colors hover:bg-brand"
      >
        {actionLabel}
      </a>
    </div>
  );
}

export async function CatalogPage({
  locale,
  searchParams,
}: CatalogPageProps) {
  const [tCatalog, tAvailability] = await Promise.all([
    getTranslations("Catalog"),
    getTranslations("Availability"),
  ]);
  const catalogPath = `${locale === "fr" ? "/fr" : ""}/products`;

  let query: ProductListQuery;

  try {
    query = parseProductListQuery(
      catalogSearchParamsToUrlSearchParams(await searchParams),
    );
  } catch {
    return (
      <CatalogShell locale={locale}>
        <main id="main-content" className="px-4 py-16 sm:px-6 lg:px-8 lg:py-24">
          <CatalogMessage
            title={tCatalog("errorTitle")}
            description={tCatalog("errorDescription")}
            actionHref={catalogPath}
            actionLabel={tCatalog("clearFilters")}
            icon={<AlertTriangle className="size-7" aria-hidden="true" />}
          />
        </main>
      </CatalogShell>
    );
  }

  let result: Awaited<ReturnType<typeof catalogService.listProducts>>;
  let categories: Awaited<ReturnType<typeof catalogService.listCategories>>;

  try {
    [result, categories] = await Promise.all([
      catalogService.listProducts(query),
      catalogService.listCategories(),
    ]);
  } catch {
    return (
      <CatalogShell locale={locale}>
        <main id="main-content" className="px-4 py-16 sm:px-6 lg:px-8 lg:py-24">
          <CatalogMessage
            title={tCatalog("errorTitle")}
            description={tCatalog("errorDescription")}
            actionHref={catalogPath}
            actionLabel={tCatalog("retry")}
            icon={<AlertTriangle className="size-7" aria-hidden="true" />}
          />
        </main>
      </CatalogShell>
    );
  }

  if (
    result.pagination.totalPages > 0 &&
    query.page > result.pagination.totalPages
  ) {
    redirect(
      createCatalogHref(locale, query, result.pagination.totalPages) as Route,
    );
  }

  const availabilityLabels: Record<PublicProductAvailability, string> = {
    IN_STOCK: tAvailability("in_stock"),
    LOW_STOCK: tAvailability("low_stock"),
    OUT_OF_STOCK: tAvailability("out_of_stock"),
  };
  const hasFilters = Boolean(
    query.search || query.category || query.sort !== "newest" || query.page > 1,
  );

  return (
    <CatalogShell locale={locale}>
      <main id="main-content">
        <section className="border-b border-border bg-white px-4 py-12 sm:px-6 lg:px-8 lg:py-16">
          <div className="mx-auto max-w-7xl">
            <p className="text-sm font-bold uppercase tracking-[0.16em] text-brand">
              {tCatalog("eyebrow")}
            </p>
            <h1 className="mt-3 max-w-3xl text-3xl font-extrabold tracking-tight text-ink sm:text-4xl lg:text-5xl">
              {tCatalog("title")}
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-8 text-muted sm:text-lg">
              {tCatalog("description")}
            </p>

            <form
              action={catalogPath}
              method="get"
              className="mt-9 grid gap-4 rounded-3xl border border-border bg-soft p-4 shadow-card sm:p-6 lg:grid-cols-[minmax(0,1.5fr)_minmax(12rem,0.8fr)_minmax(12rem,0.8fr)_auto] lg:items-end"
            >
              <label className="grid gap-2 text-sm font-bold text-ink">
                <span>{tCatalog("searchLabel")}</span>
                <span className="relative">
                  <Search
                    className="pointer-events-none absolute start-4 top-1/2 size-5 -translate-y-1/2 text-muted"
                    aria-hidden="true"
                  />
                  <input
                    type="search"
                    name="search"
                    defaultValue={query.search ?? ""}
                    minLength={2}
                    maxLength={80}
                    placeholder={tCatalog("searchPlaceholder")}
                    className="min-h-12 w-full rounded-xl border border-border bg-white py-2 pe-4 ps-12 font-normal text-ink outline-none transition-colors placeholder:text-muted/80 focus:border-brand"
                  />
                </span>
              </label>

              <label className="grid gap-2 text-sm font-bold text-ink">
                <span>{tCatalog("categoryLabel")}</span>
                <select
                  name="category"
                  defaultValue={query.category ?? ""}
                  className="min-h-12 rounded-xl border border-border bg-white px-4 font-normal text-ink outline-none transition-colors focus:border-brand"
                >
                  <option value="">{tCatalog("allCategories")}</option>
                  {categories.map((category) => (
                    <option key={category.slug} value={category.slug}>
                      {category.name[locale]}
                    </option>
                  ))}
                </select>
              </label>

              <label className="grid gap-2 text-sm font-bold text-ink">
                <span>{tCatalog("sortLabel")}</span>
                <select
                  name="sort"
                  defaultValue={query.sort}
                  className="min-h-12 rounded-xl border border-border bg-white px-4 font-normal text-ink outline-none transition-colors focus:border-brand"
                >
                  <option value="newest">{tCatalog("sort.newest")}</option>
                  <option value="price-asc">{tCatalog("sort.priceAsc")}</option>
                  <option value="price-desc">
                    {tCatalog("sort.priceDesc")}
                  </option>
                </select>
              </label>

              <button
                type="submit"
                className="inline-flex min-h-12 items-center justify-center rounded-xl bg-brand px-5 text-sm font-bold text-white transition-colors hover:bg-brand-dark"
              >
                {tCatalog("applyFilters")}
              </button>
            </form>
          </div>
        </section>

        <section className="px-4 py-12 sm:px-6 lg:px-8 lg:py-16" aria-live="polite">
          <div className="mx-auto max-w-7xl">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <p className="font-semibold text-muted">
                {tCatalog("resultsCount", {
                  count: result.pagination.total,
                })}
              </p>
              {hasFilters ? (
                <a
                  href={catalogPath}
                  className="inline-flex min-h-10 items-center rounded-lg px-3 text-sm font-bold text-brand underline-offset-4 hover:underline"
                >
                  {tCatalog("clearFilters")}
                </a>
              ) : null}
            </div>

            {result.items.length > 0 ? (
              <div className="mt-7 grid grid-cols-1 gap-5 min-[420px]:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 xl:gap-6">
                {result.items.map((product) => (
                  <CatalogProductCard
                    key={product.slug}
                    locale={locale}
                    product={product}
                    availabilityLabel={availabilityLabels[product.availability]}
                    imageFallbackLabel={tCatalog("imageFallback")}
                    viewProductLabel={tCatalog("viewProduct")}
                  />
                ))}
              </div>
            ) : (
              <div className="mt-8">
                <CatalogMessage
                  title={tCatalog("emptyTitle")}
                  description={tCatalog("emptyDescription")}
                  actionHref={catalogPath}
                  actionLabel={tCatalog("clearFilters")}
                  icon={<PackageSearch className="size-7" aria-hidden="true" />}
                />
              </div>
            )}

            {result.pagination.totalPages > 1 ? (
              <nav
                aria-label={tCatalog("paginationLabel")}
                className="mt-10 flex flex-wrap items-center justify-center gap-3"
              >
                {query.page > 1 ? (
                  <a
                    href={createCatalogHref(locale, query, query.page - 1)}
                    rel="prev"
                    className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-border bg-white px-4 text-sm font-bold text-ink transition-colors hover:border-brand/30 hover:text-brand"
                  >
                    <ChevronLeft
                      className="size-4 rtl:rotate-180"
                      aria-hidden="true"
                    />
                    {tCatalog("previousPage")}
                  </a>
                ) : null}

                <span className="inline-flex min-h-11 items-center rounded-xl bg-white px-4 text-sm font-semibold text-muted">
                  {tCatalog("pageSummary", {
                    page: result.pagination.page,
                    total: result.pagination.totalPages,
                  })}
                </span>

                {query.page < result.pagination.totalPages ? (
                  <a
                    href={createCatalogHref(locale, query, query.page + 1)}
                    rel="next"
                    className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-border bg-white px-4 text-sm font-bold text-ink transition-colors hover:border-brand/30 hover:text-brand"
                  >
                    {tCatalog("nextPage")}
                    <ChevronRight
                      className="size-4 rtl:rotate-180"
                      aria-hidden="true"
                    />
                  </a>
                ) : null}
              </nav>
            ) : null}
          </div>
        </section>
      </main>
    </CatalogShell>
  );
}
