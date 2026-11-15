import type { ReactNode } from "react";

import { mergeClassNames } from "./class-names";

export interface AdminShellProps {
  children: ReactNode;
  className?: string;
  contentClassName?: string;
  contentLabel: string;
  sidebar: ReactNode;
  topbar: ReactNode;
}

export function AdminShell({
  children,
  className,
  contentClassName,
  contentLabel,
  sidebar,
  topbar,
}: AdminShellProps) {
  return (
    <div
      className={mergeClassNames(
        "min-h-dvh bg-zinc-50 text-zinc-950 lg:grid lg:grid-cols-[18rem_minmax(0,1fr)]",
        className,
      )}
    >
      {sidebar}
      <div className="min-w-0">
        {topbar}
        <main
          aria-label={contentLabel}
          className={mergeClassNames(
            "mx-auto w-full max-w-[100rem] p-4 sm:p-6 lg:p-8",
            contentClassName,
          )}
        >
          {children}
        </main>
      </div>
    </div>
  );
}
