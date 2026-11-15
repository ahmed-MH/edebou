"use client";

import {
  ClipboardList,
  FolderTree,
  Gauge,
  History,
  PackageSearch,
  Settings,
  UsersRound,
} from "lucide-react";
import { usePathname } from "next/navigation";

import { AdminSidebar } from "./admin-sidebar";

export function AdminNavigation({
  brand,
  footer,
  intentCount,
  pendingOrderCount,
}: {
  readonly brand: React.ReactNode;
  readonly footer: React.ReactNode;
  readonly intentCount: number;
  readonly pendingOrderCount: number;
}) {
  const pathname = usePathname();
  const isCurrent = (href: string) =>
    href === "/admin" ? pathname === href : pathname.startsWith(href);

  return (
    <AdminSidebar
      brand={brand}
      footer={footer}
      navigationLabel="Navigation du back-office"
      groups={[
        {
          id: "overview",
          label: "Pilotage",
          items: [
            {
              id: "dashboard",
              label: "Tableau de bord",
              href: "/admin",
              icon: Gauge,
              current: isCurrent("/admin"),
            },
          ],
        },
        {
          id: "commerce",
          label: "Commerce",
          items: [
            {
              id: "orders",
              label: "Commandes",
              href: "/admin/orders",
              icon: ClipboardList,
              badge: pendingOrderCount || undefined,
              current: isCurrent("/admin/orders"),
            },
            {
              id: "intents",
              label: "Clients non finalisés",
              href: "/admin/intents",
              icon: UsersRound,
              badge: intentCount || undefined,
              current: isCurrent("/admin/intents"),
            },
            {
              id: "products",
              label: "Produits",
              href: "/admin/products",
              icon: PackageSearch,
              current: isCurrent("/admin/products"),
            },
            {
              id: "categories",
              label: "Catégories",
              href: "/admin/categories",
              icon: FolderTree,
              current: isCurrent("/admin/categories"),
            },
          ],
        },
        {
          id: "system",
          label: "Système",
          items: [
            {
              id: "settings",
              label: "Paramètres",
              href: "/admin/settings",
              icon: Settings,
              current: isCurrent("/admin/settings"),
            },
            {
              id: "audit",
              label: "Journal d’audit",
              href: "/admin/audit",
              icon: History,
              current: isCurrent("/admin/audit"),
            },
          ],
        },
      ]}
    />
  );
}
