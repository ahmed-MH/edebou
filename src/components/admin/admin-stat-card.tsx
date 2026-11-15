import type { ReactNode } from "react";

import type { AdminIcon, AdminStatTone } from "@/types/admin-ui";

import { mergeClassNames } from "./class-names";

const toneClasses: Record<AdminStatTone, string> = {
  brand: "bg-[#E60023]/10 text-[#C9001F]",
  neutral: "bg-zinc-100 text-zinc-700",
  positive: "bg-emerald-50 text-emerald-700",
  warning: "bg-amber-50 text-amber-700",
};

export interface AdminStatCardProps {
  className?: string;
  icon?: AdminIcon;
  label: ReactNode;
  supportingText?: ReactNode;
  tone?: AdminStatTone;
  value: ReactNode;
}

export function AdminStatCard({
  className,
  icon: Icon,
  label,
  supportingText,
  tone = "neutral",
  value,
}: AdminStatCardProps) {
  return (
    <article
      className={mergeClassNames(
        "rounded-xl border border-zinc-200 bg-white p-5 shadow-sm",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <dl className="min-w-0">
          <dt className="text-sm font-medium text-zinc-600">{label}</dt>
          <dd className="mt-2 text-3xl font-bold tracking-tight text-zinc-950">
            {value}
          </dd>
        </dl>
        {Icon ? (
          <span
            className={mergeClassNames(
              "flex size-11 shrink-0 items-center justify-center rounded-lg",
              toneClasses[tone],
            )}
          >
            <Icon aria-hidden className="size-5" strokeWidth={1.8} />
          </span>
        ) : null}
      </div>
      {supportingText !== undefined && supportingText !== null ? (
        <div className="mt-4 text-sm leading-5 text-zinc-600">
          {supportingText}
        </div>
      ) : null}
    </article>
  );
}
