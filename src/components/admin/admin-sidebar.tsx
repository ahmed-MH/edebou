import type { ReactNode } from "react";

import type { AdminNavigationGroup } from "@/types/admin-ui";

import { mergeClassNames } from "./class-names";

export interface AdminSidebarProps {
  brand: ReactNode;
  className?: string;
  footer?: ReactNode;
  groups: readonly AdminNavigationGroup[];
  navigationLabel: string;
}

export function AdminSidebar({
  brand,
  className,
  footer,
  groups,
  navigationLabel,
}: AdminSidebarProps) {
  return (
    <aside
      className={mergeClassNames(
        "border-b border-zinc-200 bg-white lg:sticky lg:top-0 lg:h-dvh lg:border-b-0 lg:border-e",
        className,
      )}
    >
      <div className="flex h-full min-h-0 flex-col">
        <div className="flex min-h-18 items-center border-b border-zinc-100 px-5 py-4">
          {brand}
        </div>

        <nav
          aria-label={navigationLabel}
          className="min-h-0 flex-1 overflow-x-auto p-3 lg:overflow-y-auto lg:p-4"
        >
          <div className="flex min-w-max gap-5 lg:min-w-0 lg:flex-col lg:gap-6">
            {groups.map((group) => (
              <div key={group.id}>
                <h2 className="mb-2 px-3 text-xs font-semibold text-zinc-500">
                  {group.label}
                </h2>
                <ul className="flex gap-1 lg:flex-col">
                  {group.items.map((item) => {
                    const Icon = item.icon;

                    return (
                      <li key={item.id}>
                        <a
                          aria-current={item.current ? "page" : undefined}
                          className={mergeClassNames(
                            "group flex min-h-11 items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[#E60023] focus-visible:ring-offset-2",
                            item.current
                              ? "bg-[#E60023]/10 text-[#C9001F]"
                              : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-950",
                          )}
                          href={item.href}
                        >
                          {Icon ? (
                            <Icon
                              aria-hidden
                              className="size-5 shrink-0"
                              strokeWidth={1.8}
                            />
                          ) : null}
                          <span>{item.label}</span>
                          {item.badge !== undefined && item.badge !== null ? (
                            <span className="ms-auto rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-semibold text-zinc-700 group-aria-[current=page]:bg-white group-aria-[current=page]:text-[#C9001F]">
                              {item.badge}
                            </span>
                          ) : null}
                        </a>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>
        </nav>

        {footer ? (
          <div className="border-t border-zinc-100 p-4">{footer}</div>
        ) : null}
      </div>
    </aside>
  );
}
