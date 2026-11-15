"use client";

import { useEffect, useRef, useState } from "react";
import { Menu, X } from "lucide-react";

import { cn } from "@/lib/cn";

type NavigationItem = {
  href: string;
  label: string;
};

type MobileNavigationProps = {
  ariaLabel: string;
  openLabel: string;
  closeLabel: string;
  menuTitle: string;
  items: readonly NavigationItem[];
  languageSwitcher: React.ReactNode;
};

const focusableSelector =
  'a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function MobileNavigation({
  ariaLabel,
  openLabel,
  closeLabel,
  menuTitle,
  items,
  languageSwitcher,
}: MobileNavigationProps) {
  const [isOpen, setIsOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const panel = panelRef.current;
    const trigger = triggerRef.current;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const focusable = panel?.querySelectorAll<HTMLElement>(focusableSelector);
    focusable?.item(0)?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsOpen(false);
        return;
      }

      if (event.key !== "Tab" || !focusable?.length) {
        return;
      }

      const first = focusable.item(0);
      const last = focusable.item(focusable.length - 1);

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    document.body.classList.add("overflow-hidden");

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.classList.remove("overflow-hidden");
      (previouslyFocused ?? trigger)?.focus();
    };
  }, [isOpen]);

  return (
    <div className="lg:hidden">
      <button
        ref={triggerRef}
        type="button"
        aria-label={isOpen ? closeLabel : openLabel}
        aria-expanded={isOpen}
        aria-controls="mobile-navigation-panel"
        onClick={() => setIsOpen(true)}
        className="inline-flex size-12 items-center justify-center rounded-2xl border border-border bg-white text-ink shadow-[0_4px_14px_rgb(17_24_39/5%)] transition-[border-color,color,transform] hover:scale-[1.03] hover:border-brand/30 hover:text-brand"
      >
        <Menu className="size-6" aria-hidden="true" />
      </button>

      <div
        inert={!isOpen}
        className={cn(
          "fixed inset-0 z-[60] transition-opacity duration-200",
          isOpen ? "visible opacity-100" : "invisible opacity-0",
        )}
        aria-hidden={!isOpen}
      >
        <button
          type="button"
          tabIndex={isOpen ? 0 : -1}
          aria-label={closeLabel}
          onClick={() => setIsOpen(false)}
          className="absolute inset-0 bg-ink/45"
        />
        <div
          ref={panelRef}
          id="mobile-navigation-panel"
          role="dialog"
          aria-modal="true"
          aria-label={ariaLabel}
          className={cn(
            "absolute inset-y-0 start-0 flex max-h-dvh w-[min(88vw,22rem)] flex-col overflow-y-auto overscroll-contain bg-white p-5 shadow-2xl transition-transform duration-200",
            isOpen ? "translate-x-0" : "ltr:-translate-x-full rtl:translate-x-full",
          )}
        >
          <div className="flex items-center justify-between gap-4 border-b border-border pb-5">
            <p className="text-lg font-bold text-ink">{menuTitle}</p>
            <button
              type="button"
              aria-label={closeLabel}
              onClick={() => setIsOpen(false)}
              className="inline-flex size-11 items-center justify-center rounded-xl border border-border text-ink hover:text-brand"
            >
              <X className="size-5" aria-hidden="true" />
            </button>
          </div>

          <nav aria-label={ariaLabel} className="mt-6">
            <ul className="grid gap-2">
              {items.map((item) => (
                <li key={item.href}>
                  <a
                    href={item.href}
                    onClick={() => setIsOpen(false)}
                    className="flex min-h-12 items-center rounded-xl px-4 font-semibold text-ink transition-colors hover:bg-brand-soft hover:text-brand"
                  >
                    {item.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>

          <div className="mt-auto border-t border-border pt-5">
            {languageSwitcher}
          </div>
        </div>
      </div>
    </div>
  );
}
