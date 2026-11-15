import {
  ArrowRight,
  Banknote,
  ClipboardClock,
  PackageX,
  ShoppingCart,
  TrendingUp,
  UsersRound,
} from "lucide-react";
import Link from "next/link";

import {
  AdminPageHeader,
  AdminStatCard,
  AdminStatusBadge,
} from "@/components/admin";
import { AdminAutoRefresh } from "@/components/admin/admin-auto-refresh";
import { formatTunisianDinars } from "@/lib/format-currency";
import { getAdminDashboardData } from "@/lib/admin/data";

export const dynamic = "force-dynamic";

const dateFormatter = new Intl.DateTimeFormat("fr-TN", {
  day: "2-digit",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Africa/Tunis",
});

const dayFormatter = new Intl.DateTimeFormat("fr-TN", {
  weekday: "short",
  day: "2-digit",
  timeZone: "Africa/Tunis",
});

const orderLabels = {
  PENDING: "En attente",
  CONFIRMED: "Confirmée",
  SHIPPING: "En livraison",
  DELIVERED: "Livrée",
  CANCELLED: "Annulée",
} as const;

const orderTones = {
  PENDING: "warning",
  CONFIRMED: "info",
  SHIPPING: "brand",
  DELIVERED: "positive",
  CANCELLED: "neutral",
} as const;

function barHeight(value: number, maximum: number): string {
  if (maximum <= 0) return "h-2";
  const ratio = value / maximum;
  if (ratio > 0.85) return "h-32";
  if (ratio > 0.7) return "h-28";
  if (ratio > 0.55) return "h-24";
  if (ratio > 0.4) return "h-20";
  if (ratio > 0.25) return "h-16";
  if (ratio > 0.1) return "h-10";
  return "h-4";
}

export default async function AdminDashboardPage() {
  const data = await getAdminDashboardData();
  const maxDailyRevenue = Math.max(
    0,
    ...data.dailySales.map((day) => day.revenueMillimes),
  );

  return (
    <>
      <AdminPageHeader
        eyebrow="Vue d’ensemble"
        title="Tableau de bord"
        description="Une lecture rapide de l’activité commerciale, des commandes à traiter et des opportunités à rappeler."
        actions={<AdminAutoRefresh />}
      />

      <section aria-label="Indicateurs clés" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
        <AdminStatCard
          label="Commandes aujourd’hui"
          value={data.metrics.ordersToday}
          icon={ShoppingCart}
          tone="brand"
          supportingText="Hors annulations"
        />
        <AdminStatCard
          label="Chiffre du jour"
          value={formatTunisianDinars(data.metrics.revenueTodayMillimes, "fr")}
          icon={Banknote}
          tone="positive"
          supportingText="Montant commandé"
        />
        <AdminStatCard
          label="À confirmer"
          value={data.metrics.pendingOrders}
          icon={ClipboardClock}
          tone="warning"
          supportingText="Commandes en attente"
        />
        <AdminStatCard
          label="Clients non finalisés"
          value={data.metrics.activeIntents}
          icon={UsersRound}
          tone="brand"
          supportingText="Numéro saisi, sans commande"
        />
        <AdminStatCard
          label="Conversion 30 jours"
          value={`${data.metrics.conversionRate}%`}
          icon={TrendingUp}
          tone="positive"
          supportingText="Demandes devenues commandes"
        />
        <AdminStatCard
          label="Stock faible"
          value={data.metrics.lowStockProducts}
          icon={PackageX}
          tone="warning"
          supportingText="Produits à 5 unités ou moins"
        />
      </section>

      <div className="mt-7 grid gap-6 xl:grid-cols-[minmax(0,1.3fr)_minmax(24rem,0.7fr)]">
        <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h3 className="text-lg font-black">Activité des 7 derniers jours</h3>
              <p className="mt-1 text-sm text-zinc-500">Montant des commandes hors annulations</p>
            </div>
            <AdminStatusBadge tone="info">
              {data.dailySales.reduce((sum, day) => sum + day.orderCount, 0)} commandes
            </AdminStatusBadge>
          </div>
          <div className="mt-8 flex min-h-44 items-end gap-3 border-b border-zinc-200 px-1">
            {data.dailySales.length > 0 ? (
              data.dailySales.map((day) => (
                <div key={day.day.toISOString()} className="flex min-w-0 flex-1 flex-col items-center justify-end gap-2">
                  <span className="text-[10px] font-bold text-zinc-500 sm:text-xs">
                    {formatTunisianDinars(day.revenueMillimes, "fr")}
                  </span>
                  <div
                    className={`w-full max-w-14 rounded-t-lg bg-gradient-to-t from-brand-dark to-brand ${barHeight(day.revenueMillimes, maxDailyRevenue)}`}
                    title={`${day.orderCount} commande(s)`}
                  />
                  <span className="pb-2 text-[10px] font-bold capitalize text-zinc-500 sm:text-xs">
                    {dayFormatter.format(day.day)}
                  </span>
                </div>
              ))
            ) : (
              <p className="m-auto pb-8 text-sm text-zinc-500">Aucune vente sur cette période.</p>
            )}
          </div>
          <div className="mt-5 flex flex-wrap gap-2">
            {Object.entries(orderLabels).map(([status, label]) => (
              <span key={status} className="inline-flex items-center gap-2 rounded-lg bg-zinc-50 px-3 py-2 text-xs font-bold text-zinc-600">
                {label}
                <strong className="text-zinc-950">
                  {data.statusCounts[status as keyof typeof data.statusCounts] ?? 0}
                </strong>
              </span>
            ))}
          </div>
        </section>

        <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="text-lg font-black">Opportunités récentes</h3>
              <p className="mt-1 text-sm text-zinc-500">Score indicatif et explicable</p>
            </div>
            <Link href="/admin/intents" className="text-sm font-extrabold text-brand hover:underline">
              Tout voir
            </Link>
          </div>
          <ul className="mt-5 divide-y divide-zinc-100">
            {data.recentIntents.map((intent) => (
              <li key={intent.id} className="flex items-center gap-4 py-4 first:pt-0 last:pb-0">
                <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-zinc-950 text-sm font-black text-white">
                  {intent.score.score}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-extrabold text-zinc-950">
                    {intent.customerName || "Nom non renseigné"}
                  </p>
                  <p className="mt-1 truncate text-sm text-zinc-500" dir="ltr">
                    {intent.phone}
                  </p>
                </div>
                <AdminStatusBadge tone={intent.score.strength === "HIGH" ? "positive" : intent.score.strength === "MEDIUM" ? "warning" : "neutral"}>
                  {intent.score.label}
                </AdminStatusBadge>
              </li>
            ))}
            {data.recentIntents.length === 0 ? (
              <li className="py-10 text-center text-sm text-zinc-500">Aucun client non finalisé.</li>
            ) : null}
          </ul>
        </section>
      </div>

      <section className="mt-6 overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-zinc-200 px-5 py-4 sm:px-6">
          <div>
            <h3 className="text-lg font-black">Dernières commandes</h3>
            <p className="mt-1 text-sm text-zinc-500">Les dossiers les plus récents à traiter</p>
          </div>
          <Link href="/admin/orders" className="inline-flex items-center gap-2 text-sm font-extrabold text-brand hover:underline">
            Toutes les commandes <ArrowRight className="size-4" aria-hidden="true" />
          </Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[48rem] text-sm">
            <thead className="bg-zinc-50 text-start text-xs uppercase tracking-wide text-zinc-500">
              <tr>
                <th className="px-6 py-3 text-start">Commande</th>
                <th className="px-6 py-3 text-start">Client</th>
                <th className="px-6 py-3 text-start">Date</th>
                <th className="px-6 py-3 text-end">Total</th>
                <th className="px-6 py-3 text-end">Statut</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {data.recentOrders.map((order) => (
                <tr key={order.id} className="hover:bg-zinc-50/70">
                  <td className="px-6 py-4 font-mono font-bold text-zinc-950">{order.orderNumber}</td>
                  <td className="px-6 py-4 font-bold text-zinc-800">{order.customerName}</td>
                  <td className="px-6 py-4 text-zinc-500">{dateFormatter.format(order.createdAt)}</td>
                  <td className="px-6 py-4 text-end font-extrabold">{formatTunisianDinars(order.totalMillimes, "fr")}</td>
                  <td className="px-6 py-4 text-end">
                    <AdminStatusBadge tone={orderTones[order.status]}>{orderLabels[order.status]}</AdminStatusBadge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
