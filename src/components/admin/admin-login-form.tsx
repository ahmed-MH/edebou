"use client";

import { KeyRound, LoaderCircle, LockKeyhole, Mail } from "lucide-react";
import { useActionState } from "react";

import {
  loginAdminAction,
  type AdminLoginState,
} from "@/app/admin/login/actions";

const initialState: AdminLoginState = {};

export function AdminLoginForm() {
  const [state, action, pending] = useActionState(
    loginAdminAction,
    initialState,
  );

  return (
    <form action={action} className="mt-8 grid gap-5">
      <label className="grid gap-2 text-sm font-bold text-zinc-800">
        <span>Adresse e-mail</span>
        <span className="flex min-h-12 items-center rounded-xl border border-zinc-300 bg-white px-4 focus-within:border-brand focus-within:ring-2 focus-within:ring-brand/10">
          <Mail className="me-3 size-5 text-zinc-400" aria-hidden="true" />
          <input
            name="email"
            type="email"
            autoComplete="username"
            required
            maxLength={254}
            className="min-w-0 flex-1 bg-transparent outline-none"
            placeholder="admin@edebou.tn"
          />
        </span>
      </label>

      <label className="grid gap-2 text-sm font-bold text-zinc-800">
        <span>Mot de passe</span>
        <span className="flex min-h-12 items-center rounded-xl border border-zinc-300 bg-white px-4 focus-within:border-brand focus-within:ring-2 focus-within:ring-brand/10">
          <LockKeyhole className="me-3 size-5 text-zinc-400" aria-hidden="true" />
          <input
            name="password"
            type="password"
            autoComplete="current-password"
            required
            maxLength={128}
            className="min-w-0 flex-1 bg-transparent outline-none"
            placeholder="••••••••••••••"
          />
        </span>
      </label>

      {state.message ? (
        <div
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-800"
        >
          {state.message}
        </div>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-brand px-5 font-extrabold text-white shadow-lg shadow-brand/20 transition hover:bg-brand-dark disabled:cursor-wait disabled:bg-zinc-400"
      >
        {pending ? (
          <LoaderCircle className="size-5 animate-spin" aria-hidden="true" />
        ) : (
          <KeyRound className="size-5" aria-hidden="true" />
        )}
        {pending ? "Vérification…" : "Accéder au back-office"}
      </button>
    </form>
  );
}
