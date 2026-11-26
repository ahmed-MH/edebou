import { MapPin, MessageCircle, Package, Phone, Truck } from "lucide-react";

import { updateOrderStatusAction } from "@/app/admin/(protected)/mutations";
import { AdminAutoRefresh } from "@/components/admin/admin-auto-refresh";
import { AdminPageHeader, AdminStatusBadge } from "@/components/admin";
import { getGovernorates } from "@/components/checkout/tunisia-governorates";
import { getAdminOrders } from "@/lib/admin/data";
import { formatTunisianDinars } from "@/lib/format-currency";
import { orderConfirmationMessage, whatsappUrl } from "@/lib/whatsapp";

export const dynamic = "force-dynamic";

const labels = {
  PENDING: "En attente",
  CONFIRMED: "Confirmée",
  SHIPPING: "En livraison",
  DELIVERED: "Livrée",
  CANCELLED: "Annulée",
} as const;

const tones = {
  PENDING: "warning",
  CONFIRMED: "info",
  SHIPPING: "brand",
  DELIVERED: "positive",
  CANCELLED: "neutral",
} as const;

const transitions = {
  PENDING: ["CONFIRMED", "CANCELLED"],
  CONFIRMED: ["SHIPPING", "CANCELLED"],
  SHIPPING: ["DELIVERED", "CANCELLED"],
  DELIVERED: [],
  CANCELLED: [],
} as const;

const governorateLabels = new Map<string, string>(
  getGovernorates("fr").map(({ code, label }) => [code, label]),
);

const dateFormatter = new Intl.DateTimeFormat("fr-TN", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Africa/Tunis",
});

export default async function AdminOrdersPage() {
  const orders = await getAdminOrders();

  return (
    <>
      <AdminPageHeader
        eyebrow="Opérations"
        title="Commandes"
        description="Confirmez les commandes, suivez la livraison et restaurez automatiquement le stock lors d’une annulation."
        actions={<AdminAutoRefresh />}
      />

      <div className="grid gap-4">
        {orders.map((order) => (
          <article key={order.id} className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
            <div className="flex flex-col gap-4 border-b border-zinc-100 p-5 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex flex-wrap items-center gap-3">
                <strong className="font-mono text-sm text-zinc-950">{order.orderNumber}</strong>
                <AdminStatusBadge tone={tones[order.status]}>{labels[order.status]}</AdminStatusBadge>
                <span className="text-xs font-semibold text-zinc-500">{dateFormatter.format(order.createdAt)}</span>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-5 lg:justify-end">
                <div className="text-end">
                  <span className="block text-xs font-semibold text-zinc-500">Total</span>
                  <strong className="text-lg font-black text-brand">{formatTunisianDinars(order.totalMillimes, "fr")}</strong>
                </div>
                {transitions[order.status].length > 0 ? (
                  <form action={updateOrderStatusAction} className="flex items-center gap-2">
                    <input type="hidden" name="id" value={order.id} />
                    <select name="status" aria-label={`Nouveau statut pour ${order.orderNumber}`} className="min-h-10 rounded-lg border border-zinc-300 bg-white px-3 text-sm font-bold">
                      {transitions[order.status].map((status) => (
                        <option key={status} value={status}>{labels[status]}</option>
                      ))}
                    </select>
                    <button type="submit" className="min-h-10 rounded-lg bg-zinc-950 px-4 text-sm font-extrabold text-white hover:bg-brand">
                      Mettre à jour
                    </button>
                  </form>
                ) : null}
              </div>
            </div>

            <div className="grid gap-5 p-5 lg:grid-cols-[minmax(16rem,0.7fr)_minmax(0,1.3fr)]">
              <section>
                <h3 className="font-black text-zinc-950">{order.customerName}</h3>
                <div className="mt-3 grid gap-2 text-sm text-zinc-600">
                  <a href={`tel:${order.phone}`} dir="ltr" className="flex items-center gap-2 font-bold text-zinc-900 hover:text-brand">
                    <Phone className="size-4 text-brand" aria-hidden="true" /> {order.phone}
                  </a>
                  {/* Same WhatsApp shortcut as the intents page, to confirm cash-on-delivery orders quickly. */}
                  <a href={whatsappUrl(order.phone, orderConfirmationMessage({ customerName: order.customerName, orderNumber: order.orderNumber, total: formatTunisianDinars(order.totalMillimes, "ar") }))} target="_blank" rel="noreferrer" className="inline-flex min-h-10 w-fit items-center gap-2 rounded-lg bg-emerald-600 px-4 text-sm font-extrabold text-white hover:bg-emerald-700">
                    <MessageCircle className="size-4" aria-hidden="true" /> WhatsApp
                  </a>
                  <p className="flex items-start gap-2">
                    <MapPin className="mt-0.5 size-4 shrink-0 text-brand" aria-hidden="true" />
                    <span>{order.address} · {governorateLabels.get(order.governorate) ?? order.governorate}</span>
                  </p>
                </div>
              </section>

              <section>
                <h3 className="flex items-center gap-2 text-sm font-black text-zinc-950">
                  <Package className="size-4 text-brand" aria-hidden="true" /> Articles
                </h3>
                <ul className="mt-3 grid gap-2">
                  {order.items.map((item) => (
                    <li key={item.id} className="flex items-center justify-between gap-4 rounded-xl bg-zinc-50 px-4 py-3 text-sm">
                      <span>
                        <strong className="block text-zinc-900">{item.productNameSnapshot}</strong>
                        <span className="text-xs text-zinc-500">{item.skuSnapshot} · {item.quantity} unité(s)</span>
                      </span>
                      <strong>{formatTunisianDinars(item.lineTotalMillimes, "fr")}</strong>
                    </li>
                  ))}
                </ul>
                <dl className="ms-auto mt-4 grid max-w-xs gap-2 text-sm">
                  <div className="flex justify-between"><dt className="text-zinc-500">Sous-total</dt><dd className="font-bold">{formatTunisianDinars(order.subtotalMillimes, "fr")}</dd></div>
                  <div className="flex justify-between"><dt className="flex items-center gap-1 text-zinc-500"><Truck className="size-3.5" aria-hidden="true" /> Livraison</dt><dd className="font-bold">{formatTunisianDinars(order.deliveryFeeMillimes, "fr")}</dd></div>
                </dl>
              </section>
            </div>
          </article>
        ))}
        {orders.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-zinc-300 bg-white p-14 text-center text-zinc-500">Aucune commande enregistrée.</div>
        ) : null}
      </div>
    </>
  );
}
