import { ExternalLink, LogOut, ShieldCheck } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import { logoutAdminAction } from "@/app/admin/(protected)/actions";
import { AdminNavigation } from "@/components/admin/admin-navigation";
import { AdminShell } from "@/components/admin/admin-shell";
import { AdminTopbar } from "@/components/admin/admin-topbar";
import { getAdminNavigationCounts } from "@/lib/admin/data";
import { requireAdminSession } from "@/lib/admin/session";

export const dynamic = "force-dynamic";

export default async function ProtectedAdminLayout({
  children,
}: {
  readonly children: ReactNode;
}) {
  const session = await requireAdminSession();
  const counts = await getAdminNavigationCounts();

  return (
    <AdminShell
      contentLabel="Contenu du back-office"
      sidebar={
        <AdminNavigation
          intentCount={counts.activeIntents}
          pendingOrderCount={counts.pendingOrders}
          brand={
            <Link
              href="/admin"
              aria-label="EDebou — tableau de bord"
              className="inline-flex min-h-11 items-center rounded-lg px-1"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/brand/logo-horizontal-primary.png"
                alt=""
                width="910"
                height="240"
                className="h-9 w-auto"
              />
            </Link>
          }
          footer={
            <div className="grid gap-3 text-xs text-zinc-600">
              <div className="flex items-center gap-2">
                <ShieldCheck className="size-4 text-emerald-600" aria-hidden="true" />
                <span>Session sécurisée</span>
              </div>
              <div>
                <strong className="block truncate text-zinc-900">
                  {session.displayName}
                </strong>
                <span className="block truncate">{session.email}</span>
              </div>
            </div>
          }
        />
      }
      topbar={
        <AdminTopbar
          title="Back-office EDebou"
          description="Pilotage des ventes et des opérations"
          actions={
            <>
              <Link
                href="/fr"
                target="_blank"
                className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-zinc-300 px-3 text-sm font-bold text-zinc-700 hover:bg-zinc-50"
              >
                <ExternalLink className="size-4" aria-hidden="true" />
                <span className="hidden sm:inline">Voir la boutique</span>
              </Link>
              <form action={logoutAdminAction}>
                <button
                  type="submit"
                  className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-zinc-900 px-3 text-sm font-bold text-white hover:bg-black"
                >
                  <LogOut className="size-4" aria-hidden="true" />
                  <span className="hidden sm:inline">Déconnexion</span>
                </button>
              </form>
            </>
          }
        />
      }
    >
      {children}
    </AdminShell>
  );
}
