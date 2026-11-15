import { ArrowRight } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { Link } from "@/i18n/navigation";

export default async function NotFound() {
  const t = await getTranslations("NotFound");

  return (
    <main className="grid min-h-screen place-items-center bg-soft px-4 py-16">
      <section className="w-full max-w-xl rounded-3xl border border-border bg-white p-8 text-center shadow-soft sm:p-12">
        <p className="text-sm font-bold uppercase tracking-[0.18em] text-brand">
          {t("eyebrow")}
        </p>
        <h1 className="mt-4 text-3xl font-bold tracking-tight text-ink sm:text-4xl">
          {t("title")}
        </h1>
        <p className="mx-auto mt-4 max-w-md leading-8 text-muted">
          {t("description")}
        </p>
        <Link
          href="/"
          className="mt-8 inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-brand px-6 py-3 font-bold text-white transition-colors hover:bg-brand-dark focus-visible:outline-white"
        >
          {t("backHome")}
          <ArrowRight className="size-4 rtl:-scale-x-100" aria-hidden="true" />
        </Link>
      </section>
    </main>
  );
}
