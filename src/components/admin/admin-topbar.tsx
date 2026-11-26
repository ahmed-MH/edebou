import type { ReactNode } from "react";

import { mergeClassNames } from "./class-names";

export interface AdminTopbarProps {
  actions?: ReactNode;
  className?: string;
  description?: ReactNode;
  leading?: ReactNode;
  title: ReactNode;
  titleId?: string;
}

export function AdminTopbar({
  actions,
  className,
  description,
  leading,
  title,
  titleId,
}: AdminTopbarProps) {
  return (
    <header
      className={mergeClassNames(
        "border-b border-zinc-200 bg-white/95 px-4 py-3 backdrop-blur-sm sm:py-4 sm:px-6 lg:sticky lg:top-0 lg:z-20 lg:px-8",
        className,
      )}
    >
      <div className="mx-auto flex w-full max-w-[100rem] items-center gap-4">
        {leading ? <div className="shrink-0">{leading}</div> : null}
        <div className="min-w-0 flex-1">
          <h1
            id={titleId}
            className="truncate text-xl font-bold tracking-tight text-zinc-950 sm:text-2xl"
          >
            {title}
          </h1>
          {description !== undefined && description !== null ? (
            <div className="mt-1 hidden text-sm leading-5 text-zinc-600 sm:block">
              {description}
            </div>
          ) : null}
        </div>
        {actions !== undefined && actions !== null ? (
          <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
            {actions}
          </div>
        ) : null}
      </div>
    </header>
  );
}
