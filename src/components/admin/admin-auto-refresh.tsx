"use client";

import { Radio } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export function AdminAutoRefresh({ intervalMs = 10_000 }: { intervalMs?: number }) {
  const router = useRouter();

  useEffect(() => {
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        router.refresh();
      }
    }, intervalMs);
    return () => window.clearInterval(timer);
  }, [intervalMs, router]);

  return (
    <span className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-700">
      <Radio className="size-3.5 animate-pulse" aria-hidden="true" />
      Actualisation automatique
    </span>
  );
}
