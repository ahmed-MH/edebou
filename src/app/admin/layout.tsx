import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: { default: "Back-office — EDebou", template: "%s — EDebou" },
  robots: { index: false, follow: false, nocache: true },
};

export default function AdminLayout({ children }: { readonly children: ReactNode }) {
  return children;
}
