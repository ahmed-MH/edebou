"use client";

import { CheckCircle2, LoaderCircle, Save, ShieldAlert } from "lucide-react";
import { useActionState } from "react";

import {
  updateSettingsAction,
  type SettingsUpdateState,
} from "@/app/admin/(protected)/settings/actions";
import { AdminFormField } from "@/components/admin/admin-form-field";

const initialState: SettingsUpdateState = {
  status: "idle",
  message: "",
};

function firstError(
  state: SettingsUpdateState,
  field: "storeName" | "deliveryFee",
): string | undefined {
  return state.errors?.[field]?.[0];
}

export function AdminSettingsForm({
  canEdit,
  deliveryFee,
  storeName,
}: {
  readonly canEdit: boolean;
  readonly deliveryFee: string;
  readonly storeName: string;
}) {
  const [state, formAction, pending] = useActionState(
    updateSettingsAction,
    initialState,
  );

  return (
    <form action={formAction} className="mt-7 grid gap-6">
      {!canEdit ? (
        <div className="flex gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
          <ShieldAlert className="mt-0.5 size-5 shrink-0 text-amber-700" aria-hidden="true" />
          <p>
            Seul le compte propriétaire peut modifier ces réglages. Vous pouvez
            les consulter sans risque de changement accidentel.
          </p>
        </div>
      ) : null}

      {state.message ? (
        <div
          aria-live="polite"
          className={`flex items-start gap-3 rounded-xl border px-4 py-3 text-sm font-bold ${
            state.status === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-900"
              : "border-red-200 bg-red-50 text-red-800"
          }`}
          role={state.status === "error" ? "alert" : "status"}
        >
          {state.status === "success" ? (
            <CheckCircle2 className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
          ) : (
            <ShieldAlert className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
          )}
          <span>{state.message}</span>
        </div>
      ) : null}

      <div className="grid gap-5 md:grid-cols-2">
        <AdminFormField
          id="settings-store-name"
          label="Nom de la boutique"
          required
          requiredIndicator="*"
          error={firstError(state, "storeName")}
          hint="Nom interne affiché dans les réglages du back-office."
          control={
            <input
              name="storeName"
              defaultValue={storeName}
              maxLength={160}
              autoComplete="organization"
              disabled={!canEdit || pending}
              className="min-h-12 rounded-xl"
            />
          }
        />
        <AdminFormField
          id="settings-delivery-fee"
          label="Frais de livraison (TND)"
          required
          requiredIndicator="*"
          error={firstError(state, "deliveryFee")}
          hint="Ce montant est appliqué immédiatement aux nouvelles commandes."
          control={
            <input
              name="deliveryFee"
              defaultValue={deliveryFee}
              inputMode="decimal"
              autoComplete="off"
              disabled={!canEdit || pending}
              className="min-h-12 rounded-xl"
            />
          }
        />
      </div>

      <div className="flex justify-end border-t border-zinc-100 pt-5">
        <button
          type="submit"
          disabled={!canEdit || pending}
          className="inline-flex min-h-12 min-w-48 items-center justify-center gap-2 rounded-xl bg-brand px-6 text-sm font-black text-white shadow-lg shadow-brand/20 transition hover:bg-brand-dark disabled:cursor-not-allowed disabled:bg-zinc-300 disabled:shadow-none"
        >
          {pending ? (
            <LoaderCircle className="size-5 animate-spin" aria-hidden="true" />
          ) : (
            <Save className="size-5" aria-hidden="true" />
          )}
          {pending ? "Enregistrement…" : "Enregistrer les paramètres"}
        </button>
      </div>
    </form>
  );
}
