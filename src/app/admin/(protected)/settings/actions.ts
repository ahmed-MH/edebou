"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { updateStoreSettingsSchema } from "@/lib/admin/settings-input";
import { requireAdminSession } from "@/lib/admin/session";
import { getAdminPrismaClient } from "@/lib/db/admin-prisma";

export interface SettingsUpdateState {
  readonly status: "idle" | "success" | "error";
  readonly message: string;
  readonly errors?: Readonly<
    Partial<Record<"storeName" | "deliveryFee", readonly string[] | undefined>>
  >;
}

export async function updateSettingsAction(
  _previousState: SettingsUpdateState,
  formData: FormData,
): Promise<SettingsUpdateState> {
  const identity = await requireAdminSession();
  if (identity.role !== "OWNER") {
    return {
      status: "error",
      message: "Seul le propriétaire peut modifier les paramètres.",
    };
  }

  const parsed = updateStoreSettingsSchema.safeParse({
    storeName: formData.get("storeName"),
    deliveryFee: formData.get("deliveryFee"),
  });
  if (!parsed.success) {
    return {
      status: "error",
      message: "Vérifiez les champs indiqués avant d’enregistrer.",
      errors: z.flattenError(parsed.error).fieldErrors,
    };
  }

  const prisma = getAdminPrismaClient();
  const previous = await prisma.storeSettings.findUnique({
    where: { id: 1 },
    select: { storeName: true, deliveryFee: true },
  });
  if (!previous) {
    return {
      status: "error",
      message: "Les paramètres de la boutique sont indisponibles.",
    };
  }

  try {
    await prisma.$transaction([
      prisma.storeSettings.update({
        where: { id: 1 },
        data: {
          storeName: parsed.data.storeName,
          deliveryFee: BigInt(parsed.data.deliveryFee),
        },
        select: { id: true },
      }),
      prisma.adminAuditLog.create({
        data: {
          actorUserId: identity.id,
          action: "STORE_SETTINGS_UPDATED",
          entityType: "STORE_SETTINGS",
          entityId: "1",
          summary: {
            storeNameChanged: previous.storeName !== parsed.data.storeName,
            deliveryFeeChanged:
              previous.deliveryFee !== BigInt(parsed.data.deliveryFee),
          },
        },
        select: { id: true },
      }),
    ]);
  } catch (error) {
    console.error("Admin store settings update failed.", error);
    return {
      status: "error",
      message: "L’enregistrement a échoué. Réessayez dans quelques instants.",
    };
  }

  revalidatePath("/admin/settings");
  revalidatePath("/admin");
  revalidatePath("/");
  revalidatePath("/fr");
  revalidatePath("/checkout");
  revalidatePath("/fr/checkout");

  return {
    status: "success",
    message: "Les paramètres de la boutique ont bien été enregistrés.",
  };
}
