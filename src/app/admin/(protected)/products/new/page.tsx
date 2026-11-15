import { PackagePlus } from "lucide-react";
import Link from "next/link";

import { AdminCreateProductForm } from "@/components/admin/admin-catalog-create-forms";
import { AdminPageHeader } from "@/components/admin";
import { getAdminCategories } from "@/lib/admin/data";

export const dynamic = "force-dynamic";

export default async function AdminNewProductPage() {
  const categories = await getAdminCategories();

  return (
    <>
      <AdminPageHeader
        eyebrow="Catalogue"
        title="Nouveau produit"
        description="Ajoutez le contenu bilingue, le prix, le stock et le visuel initial du produit."
        actions={
          <Link
            href="/admin/products"
            className="inline-flex min-h-11 items-center rounded-xl border border-zinc-300 bg-white px-4 text-sm font-extrabold text-zinc-700 hover:bg-zinc-50"
          >
            Retour aux produits
          </Link>
        }
      />
      <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm sm:p-7">
        <div className="mb-7 flex items-center gap-3 border-b border-zinc-100 pb-5">
          <span className="flex size-12 items-center justify-center rounded-xl bg-brand/10 text-brand">
            <PackagePlus className="size-6" aria-hidden="true" />
          </span>
          <div>
            <h3 className="font-black text-zinc-950">Fiche du produit</h3>
            <p className="mt-1 text-sm text-zinc-500">Tous les champs marqués d’un astérisque sont obligatoires.</p>
          </div>
        </div>
        <AdminCreateProductForm categories={categories} />
      </section>
    </>
  );
}
