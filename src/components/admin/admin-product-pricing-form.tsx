"use client";

import { useActionState } from "react";

import { updateProductAction } from "@/app/admin/(protected)/mutations";

import { AdminDeleteSubmitButton } from "./admin-delete-submit-button";

function editableTnd(millimes: number): string {
  return `${Math.floor(millimes / 1_000)}.${String(millimes % 1_000).padStart(3, "0")}`;
}

export function AdminProductPricingForm({ product }: {
  readonly product: {
    id: string;
    nameFr: string;
    priceMillimes: number;
    compareAtPriceMillimes: number | null;
    bundlePrice2Millimes: number | null;
    bundlePrice3Millimes: number | null;
    stockQuantity: number;
    isActive: boolean;
  };
}) {
  const [state, formAction, pending] = useActionState(updateProductAction, { message: "" });
  const fields = [
    { name: "price", label: "1 article", value: editableTnd(product.priceMillimes), required: true },
    { name: "compareAtPriceMillimes", label: "Ancien prix", value: product.compareAtPriceMillimes === null ? "" : editableTnd(product.compareAtPriceMillimes) },
    { name: "bundlePrice2", label: "2 articles", value: product.bundlePrice2Millimes === null ? "" : editableTnd(product.bundlePrice2Millimes) },
    { name: "bundlePrice3", label: "3 articles", value: product.bundlePrice3Millimes === null ? "" : editableTnd(product.bundlePrice3Millimes) },
  ] as const;

  return (
    <form action={formAction} className="grid grid-cols-2 items-end gap-3 px-4 py-4 sm:grid-cols-3 sm:px-5 xl:grid-cols-[repeat(5,minmax(0,8rem))_5rem_minmax(12rem,1fr)]">
      <input type="hidden" name="id" value={product.id} />
      <input type="hidden" name="expectedStockQuantity" value={product.stockQuantity} />
      {fields.map((field) => (
        <label key={field.name} className="grid gap-1 text-xs font-bold text-zinc-600">
          {field.label}
          <input
            name={field.name}
            inputMode="decimal"
            required={"required" in field && field.required}
            defaultValue={field.value}
            placeholder={field.name === "price" ? undefined : "Facultatif"}
            aria-invalid={Boolean(state.errors?.[field.name === "price" ? "priceMillimes" : field.name])}
            className="min-h-11 w-full min-w-0 rounded-lg border border-zinc-300 px-3 text-base font-bold text-zinc-950 sm:text-sm"
          />
        </label>
      ))}
      <label className="grid gap-1 text-xs font-bold text-zinc-600">Stock
        {/* Remount when the server stock changes so the field never resubmits a stale value. */}
        <input key={product.stockQuantity} name="stockQuantity" type="number" min={0} max={1_000_000} required defaultValue={product.stockQuantity} aria-invalid={Boolean(state.errors?.stockQuantity)} className="min-h-11 w-full min-w-0 rounded-lg border border-zinc-300 px-3 text-base font-bold text-zinc-950 sm:text-sm" />
      </label>
      <label className="inline-flex min-h-11 items-center gap-2 text-sm font-bold">
        <input name="isActive" type="checkbox" defaultChecked={product.isActive} className="size-5 accent-[var(--brand)]" />
        <span>Actif</span>
      </label>
      <div className="col-span-full flex flex-wrap items-center gap-2 xl:col-span-1 xl:ms-auto">
        <button type="submit" disabled={pending} className="min-h-11 flex-1 rounded-lg sm:flex-none bg-zinc-950 px-4 font-extrabold text-white hover:bg-brand disabled:opacity-60">
          {pending ? "Enregistrement…" : "Enregistrer"}
        </button>
        <AdminDeleteSubmitButton
          kind="product"
          label="Supprimer"
          confirmation={`Supprimer définitivement « ${product.nameFr} » ? Les anciennes commandes conserveront leur libellé.`}
        />
      </div>
      {state.message ? (
        <p role={state.errors ? "alert" : "status"} className={`col-span-full text-sm font-bold ${state.errors ? "text-red-700" : "text-emerald-700"}`}>
          {state.message} {state.errors ? Object.values(state.errors).flat().filter(Boolean).join(" ") : ""}
        </p>
      ) : null}
    </form>
  );
}
