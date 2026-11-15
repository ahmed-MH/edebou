import { History } from "lucide-react";

import { AdminPageHeader, AdminStatusBadge } from "@/components/admin";
import { getAdminAuditLogs } from "@/lib/admin/data";

export const dynamic = "force-dynamic";

const dateFormatter = new Intl.DateTimeFormat("fr-TN", {
  dateStyle: "medium",
  timeStyle: "medium",
  timeZone: "Africa/Tunis",
});

const actionLabels: Record<string, string> = {
  LOGIN_SUCCESS: "Connexion réussie",
  LOGIN_FAILURE: "Échec de connexion",
  LOGOUT: "Déconnexion",
  ORDER_STATUS_UPDATED: "Statut de commande modifié",
  CHECKOUT_INTENT_UPDATED: "Demande mise à jour",
  PRODUCT_UPDATED: "Produit modifié",
  CATEGORY_UPDATED: "Catégorie modifiée",
  STORE_SETTINGS_UPDATED: "Paramètres modifiés",
};

export default async function AdminAuditPage() {
  const logs = await getAdminAuditLogs();

  return (
    <>
      <AdminPageHeader eyebrow="Sécurité" title="Journal d’audit" description="Historique non public des connexions et des actions sensibles réalisées dans le back-office." />
      <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[54rem] text-sm">
            <thead className="border-b border-zinc-200 bg-zinc-50 text-xs uppercase tracking-wide text-zinc-500"><tr><th className="px-5 py-3 text-start">Date</th><th className="px-5 py-3 text-start">Action</th><th className="px-5 py-3 text-start">Administrateur</th><th className="px-5 py-3 text-start">Entité</th><th className="px-5 py-3 text-start">Référence</th></tr></thead>
            <tbody className="divide-y divide-zinc-100">
              {logs.map((log) => (
                <tr key={log.id} className="hover:bg-zinc-50/70">
                  <td className="whitespace-nowrap px-5 py-4 text-zinc-500">{dateFormatter.format(log.createdAt)}</td>
                  <td className="px-5 py-4"><AdminStatusBadge tone={log.action === "LOGIN_FAILURE" ? "brand" : "info"}>{actionLabels[log.action] ?? log.action}</AdminStatusBadge></td>
                  <td className="px-5 py-4"><strong className="block text-zinc-900">{log.actor?.displayName ?? "Système"}</strong><span className="text-xs text-zinc-500">{log.actor?.email ?? "—"}</span></td>
                  <td className="px-5 py-4 font-bold text-zinc-700">{log.entityType}</td>
                  <td className="max-w-64 truncate px-5 py-4 font-mono text-xs text-zinc-500">{log.entityId ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {logs.length === 0 ? <div className="p-14 text-center text-zinc-500"><History className="mx-auto mb-3 size-8" aria-hidden="true" /> Le journal est vide.</div> : null}
      </div>
    </>
  );
}
