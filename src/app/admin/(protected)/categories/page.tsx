import { FolderTree, Plus } from "lucide-react";
import Link from "next/link";

import { updateCategoryAction } from "@/app/admin/(protected)/mutations";
import { AdminPageHeader, AdminStatusBadge } from "@/components/admin";
import { AdminDeleteSubmitButton } from "@/components/admin/admin-delete-submit-button";
import { getAdminCategories } from "@/lib/admin/data";

export const dynamic = "force-dynamic";

export default async function AdminCategoriesPage() {
  const categories = await getAdminCategories();

  return (
    <>
      <AdminPageHeader
        eyebrow="Catalogue"
        title="Catégories"
        description="Contrôlez les univers visibles dans le catalogue sans supprimer les produits associés."
        actions={
          <Link
            href="/admin/categories/new"
            className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-brand px-4 text-sm font-black text-white shadow-lg shadow-brand/20 transition hover:bg-brand-dark"
          >
            <Plus className="size-4" aria-hidden="true" />
            Nouvelle catégorie
          </Link>
        }
      />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {categories.map((category) => (
          <article key={category.id} className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <span className="flex size-11 items-center justify-center rounded-xl bg-brand/10 text-brand"><FolderTree className="size-5" aria-hidden="true" /></span>
              <AdminStatusBadge tone={category.isActive ? "positive" : "neutral"}>{category.isActive ? "Active" : "Masquée"}</AdminStatusBadge>
            </div>
            <h3 className="mt-5 text-xl font-black">{category.nameFr}</h3>
            <p className="mt-1 text-sm text-zinc-500" dir="rtl">{category.nameAr}</p>
            <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-zinc-400">{category.slug} · {category._count.products} produit(s)</p>
            <form action={updateCategoryAction} className="mt-5 grid gap-3 border-t border-zinc-100 pt-4">
              <input type="hidden" name="id" value={category.id} />
              <div className="flex items-center justify-between gap-3">
                <label className="inline-flex items-center gap-2 text-sm font-bold"><input type="checkbox" name="isActive" defaultChecked={category.isActive} className="size-4 accent-[var(--brand)]" /> Visible</label>
                <button type="submit" className="min-h-10 rounded-lg bg-zinc-950 px-4 text-sm font-extrabold text-white hover:bg-brand">Enregistrer</button>
              </div>
              <AdminDeleteSubmitButton
                kind="category"
                label="Supprimer la catégorie"
                confirmation={"Supprimer définitivement la catégorie « " + category.nameFr + " » ?"}
                disabled={category._count.products > 0}
                disabledReason="Déplacez ou supprimez d’abord les produits de cette catégorie."
              />
              {category._count.products > 0 ? (
                <p className="text-xs text-zinc-500">Suppression disponible lorsque la catégorie ne contient plus aucun produit.</p>
              ) : null}
            </form>
          </article>
        ))}
      </div>
    </>
  );
}
