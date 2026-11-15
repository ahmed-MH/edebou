"use client";

import { useSyncExternalStore } from "react";
import { useSearchParams } from "next/navigation";

import { getPathname, usePathname } from "@/i18n/navigation";
import type { AppLocale } from "@/i18n/routing";
import { cn } from "@/lib/cn";

type LocaleOption = {
  locale: AppLocale;
  label: string;
};

type LocaleSwitcherProps = {
  currentLocale: AppLocale;
  label: string;
  options: readonly LocaleOption[];
  compact?: boolean;
  inverted?: boolean;
};

function subscribeToHashChange(onStoreChange: () => void): () => void {
  window.addEventListener("hashchange", onStoreChange);
  return () => window.removeEventListener("hashchange", onStoreChange);
}

function getHashSnapshot(): string {
  return window.location.hash;
}

export function LocaleSwitcher({
  currentLocale,
  label,
  options,
  compact = false,
  inverted = false,
}: LocaleSwitcherProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const query = searchParams.toString();
  const hash = useSyncExternalStore(
    subscribeToHashChange,
    getHashSnapshot,
    () => "",
  );

  return (
    <nav aria-label={label}>
      <ul
        className={cn(
          "flex items-center rounded-xl border p-1",
          inverted
            ? "border-white/20 bg-white/10"
            : "border-border bg-soft",
        )}
      >
        {options.map((option) => {
          const localizedPathname = getPathname({
            href: pathname,
            locale: option.locale,
          });
          const href = `${localizedPathname}${query ? `?${query}` : ""}${hash}`;
          const isCurrent = option.locale === currentLocale;

          return (
            <li key={option.locale}>
              <a
                href={href}
                hrefLang={option.locale}
                lang={option.locale}
                aria-current={isCurrent ? "page" : undefined}
                className={cn(
                  "inline-flex min-h-9 items-center justify-center rounded-lg px-3 text-xs font-bold transition-colors",
                  compact && "px-2",
                  isCurrent && !inverted && "bg-white text-ink shadow-sm",
                  isCurrent && inverted && "bg-white text-ink",
                  !isCurrent && !inverted && "text-muted hover:text-ink",
                  !isCurrent && inverted && "text-white/80 hover:text-white",
                )}
              >
                {option.label}
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
