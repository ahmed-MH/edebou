import { BadgeDollarSign, Clock3, ShieldCheck, Store } from "lucide-react";

import { AdminPageHeader } from "@/components/admin";
import { AdminSettingsForm } from "@/components/admin/admin-settings-form";
import { getAdminSettings } from "@/lib/admin/data";
import { requireAdminSession } from "@/lib/admin/session";

export const dynamic = "force-dynamic";

function editableTnd(millimes: number): string {
  return `${Math.floor(millimes / 1_000)}.${String(millimes % 1_000).padStart(3, "0")}`;
}

const dateFormatter = new Intl.DateTimeFormat("fr-TN", {
  dateStyle: "long",
  timeStyle: "short",
  timeZone: "Africa/Tunis",
});

export default async function AdminSettingsPage() {
  const [settings, identity] = await Promise.all([getAdminSettings(), requireAdminSession()]);

  return (
    <>
      <AdminPageHeader eyebrow="Configuration" title="Paramètres de la boutique" description="Gérez les informations générales et les règles commerciales utilisées par la boutique." />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
          <div className="flex items-start gap-4">
            <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-brand/10 text-brand"><BadgeDollarSign className="size-6" aria-hidden="true" /></span>
            <div><h3 className="text-xl font-black">Réglages commerciaux</h3><p className="mt-1 text-sm leading-6 text-zinc-500">Le nom de la boutique et les frais appliqués aux nouvelles commandes.</p></div>
          </div>
          {settings ? (
            <AdminSettingsForm
              canEdit={identity.role === "OWNER"}
              storeName={settings.storeName}
              deliveryFee={editableTnd(settings.deliveryFeeMillimes)}
            />
          ) : <p className="mt-6 text-sm font-bold text-red-700">Paramètres indisponibles.</p>}
        </section>
        <div className="grid content-start gap-4">
          <aside className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6 text-sm text-emerald-950">
            <ShieldCheck className="size-7 text-emerald-700" aria-hidden="true" />
            <h3 className="mt-4 font-black">Contrôle renforcé</h3>
            <p className="mt-2 leading-6">Chaque changement est validé côté serveur et inscrit au journal d’audit.</p>
            <p className="mt-3 rounded-lg bg-white/70 px-3 py-2">Votre rôle : <strong>{identity.role}</strong></p>
          </aside>
          {settings ? (
            <aside className="rounded-2xl border border-zinc-200 bg-white p-6 text-sm text-zinc-700 shadow-sm">
              <div className="flex items-center gap-3"><Store className="size-5 text-brand" aria-hidden="true" /><strong>{settings.storeName}</strong></div>
              <div className="mt-4 flex items-start gap-3 border-t border-zinc-100 pt-4"><Clock3 className="mt-0.5 size-5 shrink-0 text-zinc-400" aria-hidden="true" /><p><span className="block text-xs font-bold uppercase tracking-wide text-zinc-400">Dernière modification</span><span className="mt-1 block">{dateFormatter.format(settings.updatedAt)}</span></p></div>
            </aside>
          ) : null}
        </div>
      </div>
    </>
  );
}
