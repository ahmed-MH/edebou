import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { AdminLoginForm } from "@/components/admin/admin-login-form";
import { BrandMark } from "@/components/ui/brand-mark";
import { getOptionalAdminSession } from "@/lib/admin/session";

export const metadata: Metadata = {
  title: "Connexion administrateur — EDebou",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function AdminLoginPage() {
  if (await getOptionalAdminSession()) {
    redirect("/admin");
  }

  return (
    <main className="relative flex min-h-dvh items-center justify-center overflow-hidden bg-zinc-950 px-4 py-10 text-zinc-950">
      <div
        className="pointer-events-none absolute inset-0 opacity-70"
        aria-hidden="true"
      >
        <div className="absolute -start-24 -top-24 size-80 rounded-full bg-brand/30 blur-3xl" />
        <div className="absolute -bottom-36 end-0 size-96 rounded-full bg-brand/15 blur-3xl" />
      </div>

      <section className="relative w-full max-w-md rounded-3xl border border-white/10 bg-white p-6 shadow-2xl sm:p-9">
        <BrandMark className="h-11" />
        <p className="mt-8 text-xs font-extrabold uppercase tracking-[0.18em] text-brand">
          Accès sécurisé
        </p>
        <h1 className="mt-2 text-3xl font-black tracking-tight">
          Back-office EDebou
        </h1>
        <p className="mt-3 text-sm leading-6 text-zinc-600">
          Connectez-vous pour gérer les commandes, les clients non finalisés et le
          catalogue.
        </p>
        <AdminLoginForm />
        <p className="mt-6 border-t border-zinc-200 pt-5 text-xs leading-5 text-zinc-500">
          Les connexions sont limitées, journalisées et automatiquement
          expirées.
        </p>
      </section>
    </main>
  );
}
