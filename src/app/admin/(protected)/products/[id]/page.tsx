import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";

import { AdminPageHeader } from "@/components/admin";
import { AdminEditProductForm } from "@/components/admin/admin-catalog-create-forms";
import { getAdminCategories, getAdminProductForEdit } from "@/lib/admin/data";

export const dynamic = "force-dynamic";

export default async function AdminEditProductPage({
  params,
}: {
  readonly params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) notFound();
  const [product, categories] = await Promise.all([
    getAdminProductForEdit(id),
    getAdminCategories(),
  ]);
  if (!product) notFound();

  return (
    <>
      <AdminPageHeader
        eyebrow="Catalogue"
        title={`Modifier ${product.nameFr}`}
        description="Modifiez les textes et les photos. La première photo est l’image principale. Les prix et offres se règlent dans la liste des produits."
        actions={
          <Link href="/admin/products" className="inline-flex min-h-11 items-center rounded-xl border border-zinc-300 bg-white px-4 text-sm font-bold text-zinc-700">
            Retour aux produits
          </Link>
        }
      />
      <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm sm:p-7">
        <AdminEditProductForm product={product} categories={categories} />
      </section>
    </>
  );
}
