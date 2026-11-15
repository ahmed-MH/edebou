import { FolderPlus } from "lucide-react";
import Link from "next/link";

import { AdminCreateCategoryForm } from "@/components/admin/admin-catalog-create-forms";
import { AdminPageHeader } from "@/components/admin";

export const dynamic = "force-dynamic";

export default function AdminNewCategoryPage() {
  return (
    <>
      <AdminPageHeader
        eyebrow="Catalogue"
        title="Nouvelle catégorie"
        description="Créez un univers bilingue qui pourra recevoir vos produits."
        actions={
          <Link
            href="/admin/categories"
            className="inline-flex min-h-11 items-center rounded-xl border border-zinc-300 bg-white px-4 text-sm font-extrabold text-zinc-700 hover:bg-zinc-50"
          >
            Retour aux catégories
          </Link>
        }
      />
      <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm sm:p-7">
        <div className="mb-6 flex items-center gap-3 border-b border-zinc-100 pb-5">
          <span className="flex size-12 items-center justify-center rounded-xl bg-brand/10 text-brand">
            <FolderPlus className="size-6" aria-hidden="true" />
          </span>
          <div>
            <h3 className="font-black text-zinc-950">Informations de la catégorie</h3>
            <p className="mt-1 text-sm text-zinc-500">Les deux langues sont obligatoires.</p>
          </div>
        </div>
        <AdminCreateCategoryForm />
      </section>
    </>
  );
}
