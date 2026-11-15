import { AlertTriangle, Boxes, PackageCheck, PackageX, Plus } from "lucide-react";
import Link from "next/link";

import { updateProductAction } from "@/app/admin/(protected)/mutations";
import { AdminPageHeader, AdminStatusBadge } from "@/components/admin";
import { AdminDeleteSubmitButton } from "@/components/admin/admin-delete-submit-button";
import { getAdminProducts } from "@/lib/admin/data";

export const dynamic = "force-dynamic";

function editableTnd(millimes: number): string {
  const dinars = Math.floor(millimes / 1_000);
  return `${dinars}.${String(millimes % 1_000).padStart(3, "0")}`;
}

export default async function AdminProductsPage() {
  const products = await getAdminProducts();
  const active = products.filter((product) => product.isActive).length;
  const low = products.filter((product) => product.isActive && product.stockQuantity <= 5 && product.stockQuantity > 0).length;
  const out = products.filter((product) => product.stockQuantity === 0).length;

  return (
    <>
      <AdminPageHeader
        eyebrow="Catalogue"
        title="Produits et stock"
        description="Modifiez rapidement le prix, la quantité disponible et la visibilité commerciale de chaque produit."
        actions={
          <Link
            href="/admin/products/new"
            className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-brand px-4 text-sm font-black text-white shadow-lg shadow-brand/20 transition hover:bg-brand-dark"
          >
            <Plus className="size-4" aria-hidden="true" />
            Nouveau produit
          </Link>
        }
      />

      <section className="mb-6 grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm"><PackageCheck className="size-5 text-emerald-600" aria-hidden="true" /><strong className="mt-3 block text-3xl font-black">{active}</strong><span className="text-sm text-zinc-500">Produits actifs</span></div>
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5"><AlertTriangle className="size-5 text-amber-700" aria-hidden="true" /><strong className="mt-3 block text-3xl font-black text-amber-950">{low}</strong><span className="text-sm text-amber-800">Stock faible</span></div>
        <div className="rounded-2xl border border-red-200 bg-red-50 p-5"><PackageX className="size-5 text-red-700" aria-hidden="true" /><strong className="mt-3 block text-3xl font-black text-red-950">{out}</strong><span className="text-sm text-red-800">Ruptures</span></div>
      </section>

      <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[70rem] text-sm">
            <thead className="border-b border-zinc-200 bg-zinc-50 text-xs uppercase tracking-wide text-zinc-500">
              <tr><th className="px-5 py-3 text-start">Produit</th><th className="px-5 py-3 text-start">Catégorie</th><th className="px-5 py-3 text-start">État</th><th className="px-5 py-3 text-start">Prix TND</th><th className="px-5 py-3 text-start">Stock</th><th className="px-5 py-3 text-center">Visible</th><th className="px-5 py-3 text-end">Action</th></tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {products.map((product) => (
                <tr key={product.id} className="hover:bg-zinc-50/70">
                  <td className="px-5 py-4"><strong className="block text-zinc-950">{product.nameFr}</strong><span className="mt-1 block text-xs text-zinc-500">{product.sku} · {product.slug}</span></td>
                  <td className="px-5 py-4 text-zinc-600">{product.category.nameFr}</td>
                  <td className="px-5 py-4">{product.stockQuantity === 0 ? <AdminStatusBadge tone="brand">Rupture</AdminStatusBadge> : product.stockQuantity <= 5 ? <AdminStatusBadge tone="warning">Faible</AdminStatusBadge> : <AdminStatusBadge tone="positive">Disponible</AdminStatusBadge>}</td>
                  <td colSpan={4} className="p-0">
                    <form action={updateProductAction} className="grid grid-cols-[9rem_7rem_6rem_minmax(15rem,1fr)] items-center gap-4 px-5 py-4">
                      <input type="hidden" name="id" value={product.id} />
                      <label className="sr-only" htmlFor={`price-${product.id}`}>Prix</label>
                      <input id={`price-${product.id}`} name="price" inputMode="decimal" required defaultValue={editableTnd(product.priceMillimes)} className="min-h-10 rounded-lg border border-zinc-300 px-3 font-bold" />
                      <label className="sr-only" htmlFor={`stock-${product.id}`}>Stock</label>
                      <input id={`stock-${product.id}`} name="stockQuantity" type="number" min={0} max={1_000_000} required defaultValue={product.stockQuantity} className="min-h-10 rounded-lg border border-zinc-300 px-3 font-bold" />
                      <label className="mx-auto inline-flex cursor-pointer items-center gap-2 font-bold"><input name="isActive" type="checkbox" defaultChecked={product.isActive} className="size-4 accent-[var(--brand)]" /><span>Actif</span></label>
                      <div className="ms-auto flex items-center gap-2">
                        <button type="submit" className="min-h-10 rounded-lg bg-zinc-950 px-4 font-extrabold text-white hover:bg-brand">Enregistrer</button>
                        <AdminDeleteSubmitButton
                          kind="product"
                          label="Supprimer"
                          confirmation={"Supprimer définitivement « " + product.nameFr + " » ? Les anciennes commandes conserveront leur libellé."}
                        />
                      </div>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {products.length === 0 ? <div className="p-14 text-center text-zinc-500"><Boxes className="mx-auto mb-3 size-8" aria-hidden="true" /> Aucun produit.</div> : null}
      </div>
    </>
  );
}
