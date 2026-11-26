import { Clock3, MapPin, MessageCircle, Phone, ShoppingBag, UserRound } from "lucide-react";

import { updateIntentAction } from "@/app/admin/(protected)/mutations";
import { AdminAutoRefresh } from "@/components/admin/admin-auto-refresh";
import { AdminPageHeader, AdminStatusBadge } from "@/components/admin";
import { getGovernorates } from "@/components/checkout/tunisia-governorates";
import { getAdminIntents, type IntentStrength } from "@/lib/admin/data";
import { unfinishedOrderMessage, whatsappUrl } from "@/lib/whatsapp";

export const dynamic = "force-dynamic";

const governorateLabels = new Map<string, string>(
  getGovernorates("fr").map(({ code, label }) => [code, label]),
);

const dateFormatter = new Intl.DateTimeFormat("fr-TN", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Africa/Tunis",
});

const statusLabels = {
  ACTIVE: "En cours",
  CONTACTED: "Contacté",
  CONVERTED: "Commande finalisée",
  DISMISSED: "Classé",
  EXPIRED: "Expiré",
} as const;

const statusTones = {
  ACTIVE: "warning",
  CONTACTED: "info",
  CONVERTED: "positive",
  DISMISSED: "neutral",
  EXPIRED: "neutral",
} as const;

const scoreTones: Record<IntentStrength, "positive" | "warning" | "neutral"> = {
  HIGH: "positive",
  MEDIUM: "warning",
  LOW: "neutral",
};

type IntentItem = {
  productSlug: string;
  productName: string;
  quantity: number;
  sku?: string;
};

function readItems(value: unknown): readonly IntentItem[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (
      item &&
      typeof item === "object" &&
      "productSlug" in item &&
      "productName" in item &&
      "quantity" in item &&
      typeof item.productSlug === "string" &&
      typeof item.productName === "string" &&
      typeof item.quantity === "number"
    ) {
      return [{
        productSlug: item.productSlug,
        productName: item.productName,
        quantity: item.quantity,
        sku:
          "sku" in item && typeof item.sku === "string"
            ? item.sku
            : undefined,
      }];
    }
    return [];
  });
}

export default async function AdminIntentsPage() {
  const intents = await getAdminIntents();
  const activeCount = intents.filter((intent) => intent.status === "ACTIVE").length;
  const highCount = intents.filter((intent) => intent.status === "ACTIVE" && intent.score.strength === "HIGH").length;
  const convertedCount = intents.filter((intent) => intent.status === "CONVERTED").length;

  return (
    <>
      <AdminPageHeader
        eyebrow="Suivi commercial"
        title="Clients non finalisés"
        description="Retrouvez ici les clients qui ont saisi un numéro valide mais n’ont pas confirmé leur commande. Le score est une règle indicative, jamais une certitude."
        actions={<AdminAutoRefresh intervalMs={8_000} />}
      />

      <div className="mb-6 rounded-2xl border border-brand/20 bg-brand/5 px-5 py-4 text-sm leading-6 text-zinc-700">
        <strong className="text-zinc-950">Enregistrement automatique :</strong>{" "}
        dès que le client termine un numéro tunisien valide de 8 chiffres,
        sa fiche apparaît ici après environ une seconde, même sans cliquer sur
        « Confirmer la commande ». Le nom et l’adresse se complètent ensuite en
        temps réel.
      </div>

      <section className="mb-6 grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm"><span className="text-sm font-semibold text-zinc-500">À traiter</span><strong className="mt-2 block text-3xl font-black">{activeCount}</strong></div>
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5"><span className="text-sm font-semibold text-emerald-700">Intention forte</span><strong className="mt-2 block text-3xl font-black text-emerald-900">{highCount}</strong></div>
        <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm"><span className="text-sm font-semibold text-zinc-500">Converties récemment</span><strong className="mt-2 block text-3xl font-black">{convertedCount}</strong></div>
      </section>

      <div className="grid gap-5 xl:grid-cols-2">
        {intents.map((intent) => {
          const items = readItems(intent.items);
          const isEditable = intent.status === "ACTIVE" || intent.status === "CONTACTED" || intent.status === "DISMISSED";

          return (
            <article key={intent.id} className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
              <div className="flex items-start gap-4 border-b border-zinc-100 p-5">
                <span className="flex size-14 shrink-0 flex-col items-center justify-center rounded-2xl bg-zinc-950 text-white">
                  <strong className="text-lg leading-none">{intent.score.score}</strong>
                  <span className="mt-1 text-[9px] font-bold uppercase tracking-wide">score</span>
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-lg font-black text-zinc-950">{intent.customerName || "Nom non renseigné"}</h3>
                    <AdminStatusBadge tone={statusTones[intent.status]}>{statusLabels[intent.status]}</AdminStatusBadge>
                    <AdminStatusBadge tone={scoreTones[intent.score.strength]}>{intent.score.label}</AdminStatusBadge>
                  </div>
                  <p className="mt-2 text-xs leading-5 text-zinc-500">{intent.score.explanation}</p>
                </div>
              </div>

              <div className="grid gap-4 p-5 sm:grid-cols-2">
                <div className="grid gap-3 text-sm">
                  <a href={`tel:${intent.phone}`} dir="ltr" className="flex items-center gap-2 font-extrabold text-zinc-950 hover:text-brand"><Phone className="size-4 text-brand" aria-hidden="true" /> {intent.phone}</a>
                  <p className="flex items-start gap-2 text-zinc-600"><UserRound className="mt-0.5 size-4 shrink-0 text-brand" aria-hidden="true" /> {intent.customerName || "—"}</p>
                  <p className="flex items-start gap-2 text-zinc-600"><MapPin className="mt-0.5 size-4 shrink-0 text-brand" aria-hidden="true" /> {intent.address || "Adresse non renseignée"}{intent.governorate ? ` · ${governorateLabels.get(intent.governorate) ?? intent.governorate}` : ""}</p>
                  <p className="flex items-center gap-2 text-xs text-zinc-500"><Clock3 className="size-4" aria-hidden="true" /> Dernière activité : {dateFormatter.format(intent.lastSeenAt)}</p>
                </div>
                <div className="rounded-xl bg-zinc-50 p-4">
                  <h4 className="flex items-center gap-2 text-sm font-black"><ShoppingBag className="size-4 text-brand" aria-hidden="true" /> Intérêt produit</h4>
                  <ul className="mt-2 grid gap-1 text-xs text-zinc-600">
                    {items.map((item) => (
                      <li key={item.productSlug}>
                        <strong className="text-zinc-900">{item.productName}</strong>
                        {item.sku ? <span className="text-zinc-400"> · {item.sku}</span> : null}
                        {" "}× {item.quantity}
                      </li>
                    ))}
                    {items.length === 0 ? <li>Produit non renseigné</li> : null}
                  </ul>
                  <p className="mt-3 text-[11px] font-semibold uppercase tracking-wide text-zinc-400">Source : {intent.source === "PRODUCT" ? "Fiche produit" : "Checkout"} · {intent.locale.toUpperCase()}</p>
                </div>
              </div>

              <div className="border-t border-zinc-100 bg-zinc-50/70 p-5">
                <div className="mb-4 flex flex-wrap gap-2">
                  <a href={whatsappUrl(intent.phone, unfinishedOrderMessage(intent.customerName))} target="_blank" rel="noreferrer" className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-emerald-600 px-4 text-sm font-extrabold text-white hover:bg-emerald-700"><MessageCircle className="size-4" aria-hidden="true" /> WhatsApp</a>
                  <a href={`tel:${intent.phone}`} className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-zinc-300 bg-white px-4 text-sm font-extrabold text-zinc-800 hover:border-brand hover:text-brand"><Phone className="size-4" aria-hidden="true" /> Appeler</a>
                </div>
                {isEditable ? (
                  <form action={updateIntentAction} className="grid gap-3 sm:grid-cols-[10rem_minmax(0,1fr)_auto] sm:items-end">
                    <input type="hidden" name="id" value={intent.id} />
                    <label className="grid gap-1 text-xs font-bold text-zinc-600">Statut<select name="status" defaultValue={intent.status === "CONVERTED" || intent.status === "EXPIRED" ? "ACTIVE" : intent.status} className="min-h-10 rounded-lg border border-zinc-300 bg-white px-3 text-sm text-zinc-900"><option value="ACTIVE">En cours</option><option value="CONTACTED">Contacté</option><option value="DISMISSED">Classé</option></select></label>
                    <label className="grid gap-1 text-xs font-bold text-zinc-600">Note interne<input name="adminNote" maxLength={500} defaultValue={intent.adminNote ?? ""} placeholder="Résultat de l’appel, préférence…" className="min-h-10 rounded-lg border border-zinc-300 bg-white px-3 text-sm font-normal text-zinc-900" /></label>
                    <button type="submit" className="min-h-10 rounded-lg bg-zinc-950 px-4 text-sm font-extrabold text-white hover:bg-brand">Enregistrer</button>
                  </form>
                ) : (
                  <p className="text-sm font-bold text-emerald-700">Commande créée : {intent.order?.orderNumber ?? "référence indisponible"}</p>
                )}
              </div>
            </article>
          );
        })}
      </div>

      {intents.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-zinc-300 bg-white p-14 text-center text-zinc-500">Aucun client non finalisé.</div>
      ) : null}
    </>
  );
}
