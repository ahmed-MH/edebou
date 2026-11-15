"use client";

import { Trash2 } from "lucide-react";

import {
  deleteCategoryAction,
  deleteProductAction,
} from "@/app/admin/(protected)/mutations";

export function AdminDeleteSubmitButton({
  kind,
  label,
  confirmation,
  disabled = false,
  disabledReason,
}: {
  readonly kind: "product" | "category";
  readonly label: string;
  readonly confirmation: string;
  readonly disabled?: boolean;
  readonly disabledReason?: string;
}) {
  return (
    <button
      type="submit"
      formAction={
        kind === "product" ? deleteProductAction : deleteCategoryAction
      }
      disabled={disabled}
      title={disabled ? disabledReason : undefined}
      onClick={(event) => {
        if (!window.confirm(confirmation)) event.preventDefault();
      }}
      className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-red-200 bg-white px-3 text-sm font-extrabold text-red-700 transition hover:border-red-300 hover:bg-red-50 disabled:cursor-not-allowed disabled:border-zinc-200 disabled:bg-zinc-100 disabled:text-zinc-400"
    >
      <Trash2 className="size-4" aria-hidden="true" />
      {label}
    </button>
  );
}
