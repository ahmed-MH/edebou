import type { ReactNode } from "react";

const tones = {
  brand: "bg-red-50 text-red-700 ring-red-600/15",
  neutral: "bg-zinc-100 text-zinc-700 ring-zinc-500/15",
  positive: "bg-emerald-50 text-emerald-700 ring-emerald-600/15",
  warning: "bg-amber-50 text-amber-800 ring-amber-600/20",
  info: "bg-sky-50 text-sky-700 ring-sky-600/15",
} as const;

export function AdminStatusBadge({
  children,
  tone = "neutral",
}: {
  readonly children: ReactNode;
  readonly tone?: keyof typeof tones;
}) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-extrabold ring-1 ring-inset ${tones[tone]}`}
    >
      {children}
    </span>
  );
}
