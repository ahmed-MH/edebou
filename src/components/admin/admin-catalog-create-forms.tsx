"use client";

import { useActionState } from "react";
import Link from "next/link";

import {
  createCategoryAction,
  createProductAction,
  type CatalogCreateState,
} from "@/app/admin/(protected)/mutations";
import { AdminFormField } from "@/components/admin/admin-form-field";
import { AdminProductImageUploader } from "@/components/admin/admin-product-image-uploader";

const initialState: CatalogCreateState = { message: "" };

const controlClassName = "min-h-12 rounded-xl";
const textareaClassName = "min-h-32 resize-y rounded-xl";

function firstError(
  state: CatalogCreateState,
  field: string,
): string | undefined {
  return state.errors?.[field]?.[0];
}

function Feedback({ state }: { readonly state: CatalogCreateState }) {
  if (!state.message) return null;

  return (
    <p
      aria-live="polite"
      className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-800"
      role="alert"
    >
      {state.message}
    </p>
  );
}

export function AdminCreateCategoryForm() {
  const [state, formAction, pending] = useActionState(
    createCategoryAction,
    initialState,
  );

  return (
    <form action={formAction} className="grid gap-6">
      <Feedback state={state} />
      <div className="grid gap-5 md:grid-cols-2">
        <AdminFormField
          id="category-name-fr"
          label="Nom en français"
          required
          requiredIndicator="*"
          error={firstError(state, "nameFr")}
          control={
            <input
              name="nameFr"
              maxLength={160}
              autoComplete="off"
              className={controlClassName}
              placeholder="Beauté et bien-être"
            />
          }
        />
        <AdminFormField
          id="category-name-ar"
          label="Nom en arabe"
          required
          requiredIndicator="*"
          error={firstError(state, "nameAr")}
          control={
            <input
              name="nameAr"
              maxLength={160}
              autoComplete="off"
              dir="rtl"
              className={controlClassName}
              placeholder="الجمال والعناية"
            />
          }
        />
      </div>
      <AdminFormField
        id="category-slug"
        label="Slug (adresse web)"
        required
        requiredIndicator="*"
        error={firstError(state, "slug")}
        hint="Minuscules, chiffres et tirets uniquement. Exemple : beaute-bien-etre."
        control={
          <input
            name="slug"
            maxLength={120}
            autoCapitalize="none"
            autoComplete="off"
            className={controlClassName}
            placeholder="beaute-bien-etre"
          />
        }
      />
      <label className="inline-flex min-h-12 items-center gap-3 rounded-xl border border-zinc-200 bg-zinc-50 px-4 text-sm font-bold text-zinc-800">
        <input
          name="isActive"
          type="checkbox"
          defaultChecked
          className="size-5 accent-[var(--brand)]"
        />
        Afficher immédiatement cette catégorie dans la boutique
      </label>
      <div className="flex flex-wrap justify-end gap-3 border-t border-zinc-100 pt-5">
        <Link
          href="/admin/categories"
          className="inline-flex min-h-12 items-center rounded-xl border border-zinc-300 px-5 text-sm font-extrabold text-zinc-700 hover:bg-zinc-50"
        >
          Annuler
        </Link>
        <button
          type="submit"
          disabled={pending}
          className="inline-flex min-h-12 items-center rounded-xl bg-brand px-6 text-sm font-black text-white shadow-lg shadow-brand/20 transition hover:bg-brand-dark disabled:cursor-wait disabled:opacity-60"
        >
          {pending ? "Création…" : "Créer la catégorie"}
        </button>
      </div>
    </form>
  );
}

export function AdminCreateProductForm({
  categories,
}: {
  readonly categories: readonly {
    id: string;
    nameFr: string;
    isActive: boolean;
  }[];
}) {
  const [state, formAction, pending] = useActionState(
    createProductAction,
    initialState,
  );
  const hasCategories = categories.length > 0;

  return (
    <form action={formAction} className="grid gap-7">
      <Feedback state={state} />
      {!hasCategories ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          Créez d’abord une catégorie avant d’ajouter un produit.{" "}
          <Link href="/admin/categories/new" className="font-black underline">
            Ajouter une catégorie
          </Link>
        </div>
      ) : null}

      <fieldset className="grid gap-5">
        <legend className="mb-4 text-lg font-black text-zinc-950">
          Identification
        </legend>
        <div className="grid gap-5 md:grid-cols-2">
          <AdminFormField
            id="product-name-fr"
            label="Nom en français"
            required
            requiredIndicator="*"
            error={firstError(state, "nameFr")}
            control={
              <input
                name="nameFr"
                maxLength={200}
                autoComplete="off"
                className={controlClassName}
                placeholder="Nom commercial du produit"
              />
            }
          />
          <AdminFormField
            id="product-name-ar"
            label="Nom en arabe"
            required
            requiredIndicator="*"
            error={firstError(state, "nameAr")}
            control={
              <input
                name="nameAr"
                maxLength={200}
                autoComplete="off"
                dir="rtl"
                className={controlClassName}
                placeholder="اسم المنتج"
              />
            }
          />
          <AdminFormField
            id="product-sku"
            label="Référence SKU"
            required
            requiredIndicator="*"
            error={firstError(state, "sku")}
            hint="Référence interne unique, par exemple COL-350."
            control={
              <input
                name="sku"
                maxLength={64}
                autoCapitalize="characters"
                autoComplete="off"
                className={controlClassName}
                placeholder="COL-350"
              />
            }
          />
          <AdminFormField
            id="product-slug"
            label="Slug (adresse web)"
            required
            requiredIndicator="*"
            error={firstError(state, "slug")}
            hint="Exemple : collagen-renover-350g."
            control={
              <input
                name="slug"
                maxLength={120}
                autoCapitalize="none"
                autoComplete="off"
                className={controlClassName}
                placeholder="collagen-renover-350g"
              />
            }
          />
          <AdminFormField
            id="product-category"
            label="Catégorie"
            required
            requiredIndicator="*"
            error={firstError(state, "categoryId")}
            control={
              <select
                name="categoryId"
                defaultValue=""
                disabled={!hasCategories}
                className={controlClassName}
              >
                <option value="" disabled>
                  Choisir une catégorie
                </option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.nameFr}
                    {category.isActive ? "" : " (masquée)"}
                  </option>
                ))}
              </select>
            }
          />
          <AdminProductImageUploader
            serverError={firstError(state, "imagePaths")}
          />
        </div>
      </fieldset>

      <fieldset className="grid gap-5 border-t border-zinc-100 pt-7">
        <legend className="mb-4 text-lg font-black text-zinc-950">
          Description bilingue
        </legend>
        <div className="grid gap-5 lg:grid-cols-2">
          <AdminFormField
            id="product-description-fr"
            label="Description française"
            required
            requiredIndicator="*"
            error={firstError(state, "descriptionFr")}
            control={
              <textarea
                name="descriptionFr"
                maxLength={5_000}
                className={textareaClassName}
                placeholder="Décrivez les bénéfices et l’utilisation du produit."
              />
            }
          />
          <AdminFormField
            id="product-description-ar"
            label="Description arabe"
            required
            requiredIndicator="*"
            error={firstError(state, "descriptionAr")}
            control={
              <textarea
                name="descriptionAr"
                maxLength={5_000}
                dir="rtl"
                className={textareaClassName}
                placeholder="اكتب فوائد المنتج وطريقة الاستعمال."
              />
            }
          />
        </div>
      </fieldset>

      <fieldset className="grid gap-5 border-t border-zinc-100 pt-7">
        <legend className="mb-4 text-lg font-black text-zinc-950">
          Vente et disponibilité
        </legend>
        <div className="grid gap-5 md:grid-cols-2">
          <AdminFormField
            id="product-price"
            label="Prix en TND"
            required
            requiredIndicator="*"
            error={firstError(state, "priceMillimes")}
            hint="Exemple : 59.900 pour 59 dinars et 900 millimes."
            control={
              <input
                name="priceMillimes"
                inputMode="decimal"
                autoComplete="off"
                className={controlClassName}
                placeholder="59.900"
              />
            }
          />
          <AdminFormField
            id="product-stock"
            label="Stock initial"
            required
            requiredIndicator="*"
            error={firstError(state, "stockQuantity")}
            control={
              <input
                name="stockQuantity"
                type="number"
                min={0}
                max={1_000_000}
                defaultValue={0}
                className={controlClassName}
              />
            }
          />
        </div>
        <label className="inline-flex min-h-12 items-center gap-3 rounded-xl border border-zinc-200 bg-zinc-50 px-4 text-sm font-bold text-zinc-800">
          <input
            name="isActive"
            type="checkbox"
            defaultChecked
            className="size-5 accent-[var(--brand)]"
          />
          Publier ce produit immédiatement dans la boutique
        </label>
      </fieldset>

      <div className="flex flex-wrap justify-end gap-3 border-t border-zinc-100 pt-5">
        <Link
          href="/admin/products"
          className="inline-flex min-h-12 items-center rounded-xl border border-zinc-300 px-5 text-sm font-extrabold text-zinc-700 hover:bg-zinc-50"
        >
          Annuler
        </Link>
        <button
          type="submit"
          disabled={pending || !hasCategories}
          className="inline-flex min-h-12 items-center rounded-xl bg-brand px-6 text-sm font-black text-white shadow-lg shadow-brand/20 transition hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-50"
        >
          {pending ? "Création…" : "Créer le produit"}
        </button>
      </div>
    </form>
  );
}
