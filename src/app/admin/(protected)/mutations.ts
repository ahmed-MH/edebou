"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { Prisma } from "@/generated/prisma/client";
import {
  createCategorySchema,
  createProductSchema,
} from "@/lib/admin/catalog-input";
import { deleteUploadedProductImages } from "@/lib/admin/product-images";
import { getAdminPrismaClient } from "@/lib/db/admin-prisma";
import { parseTunisianDinarsToMillimes } from "@/lib/money";
import { requireAdminSession } from "@/lib/admin/session";

const identifierSchema = z.string().uuid();
const orderStatusSchema = z.enum([
  "PENDING",
  "CONFIRMED",
  "SHIPPING",
  "DELIVERED",
  "CANCELLED",
]);
const intentStatusSchema = z.enum(["ACTIVE", "CONTACTED", "DISMISSED"]);

export interface CatalogCreateState {
  readonly message: string;
  readonly errors?: Readonly<Record<string, readonly string[] | undefined>>;
}

async function requireAdminMutation() {
  const identity = await requireAdminSession();
  if (identity.role === "VIEWER") {
    throw new Error("ADMIN_FORBIDDEN");
  }
  return identity;
}

function validationState(error: z.ZodError): CatalogCreateState {
  return {
    message: "Vérifiez les champs indiqués avant de continuer.",
    errors: z.flattenError(error).fieldErrors,
  };
}

function duplicateState(entity: "produit" | "catégorie"): CatalogCreateState {
  return {
    message:
      entity === "produit"
        ? "Un produit utilise déjà ce SKU ou ce slug."
        : "Une catégorie utilise déjà ce slug.",
  };
}

function isUniqueConflict(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  );
}

export async function createCategoryAction(
  _previousState: CatalogCreateState,
  formData: FormData,
): Promise<CatalogCreateState> {
  const identity = await requireAdminMutation();
  const parsed = createCategorySchema.safeParse({
    slug: formData.get("slug"),
    nameFr: formData.get("nameFr"),
    nameAr: formData.get("nameAr"),
    isActive: formData.get("isActive") === "on",
  });
  if (!parsed.success) return validationState(parsed.error);

  const prisma = getAdminPrismaClient();
  try {
    await prisma.$transaction(async (transaction) => {
      const category = await transaction.category.create({
        data: parsed.data,
        select: { id: true },
      });
      await transaction.adminAuditLog.create({
        data: {
          actorUserId: identity.id,
          action: "CATEGORY_CREATED",
          entityType: "CATEGORY",
          entityId: category.id,
          summary: {
            slug: parsed.data.slug,
            active: parsed.data.isActive,
          },
        },
        select: { id: true },
      });
    });
  } catch (error) {
    if (isUniqueConflict(error)) return duplicateState("catégorie");
    console.error("Admin category creation failed.", error);
    return {
      message:
        "La catégorie n’a pas pu être créée. Réessayez dans quelques instants.",
    };
  }

  revalidatePath("/admin/categories");
  revalidatePath("/fr/products");
  revalidatePath("/products");
  redirect("/admin/categories");
}

export async function createProductAction(
  _previousState: CatalogCreateState,
  formData: FormData,
): Promise<CatalogCreateState> {
  const identity = await requireAdminMutation();
  const parsed = createProductSchema.safeParse({
    categoryId: formData.get("categoryId"),
    sku: formData.get("sku"),
    slug: formData.get("slug"),
    nameFr: formData.get("nameFr"),
    nameAr: formData.get("nameAr"),
    descriptionFr: formData.get("descriptionFr"),
    descriptionAr: formData.get("descriptionAr"),
    priceMillimes: formData.get("priceMillimes"),
    stockQuantity: formData.get("stockQuantity"),
    imagePaths: formData.getAll("imagePaths"),
    isActive: formData.get("isActive") === "on",
  });
  if (!parsed.success) return validationState(parsed.error);

  const prisma = getAdminPrismaClient();
  const category = await prisma.category.findUnique({
    where: { id: parsed.data.categoryId },
    select: { id: true },
  });
  if (!category) {
    return {
      message: "La catégorie sélectionnée n’existe plus.",
      errors: { categoryId: ["Sélectionnez une autre catégorie."] },
    };
  }

  try {
    await prisma.$transaction(async (transaction) => {
      const product = await transaction.product.create({
        data: {
          categoryId: parsed.data.categoryId,
          sku: parsed.data.sku,
          slug: parsed.data.slug,
          nameFr: parsed.data.nameFr,
          nameAr: parsed.data.nameAr,
          descriptionFr: parsed.data.descriptionFr,
          descriptionAr: parsed.data.descriptionAr,
          price: BigInt(parsed.data.priceMillimes),
          stockQuantity: parsed.data.stockQuantity,
          isActive: parsed.data.isActive,
          images: {
            create: parsed.data.imagePaths.map((path, position) => ({
              path,
              altFr: parsed.data.nameFr,
              altAr: parsed.data.nameAr,
              position,
            })),
          },
        },
        select: { id: true },
      });
      await transaction.adminAuditLog.create({
        data: {
          actorUserId: identity.id,
          action: "PRODUCT_CREATED",
          entityType: "PRODUCT",
          entityId: product.id,
          summary: {
            sku: parsed.data.sku,
            slug: parsed.data.slug,
            active: parsed.data.isActive,
            initialStock: parsed.data.stockQuantity,
          },
        },
        select: { id: true },
      });
    });
  } catch (error) {
    if (isUniqueConflict(error)) return duplicateState("produit");
    console.error("Admin product creation failed.", error);
    return {
      message:
        "Le produit n’a pas pu être créé. Réessayez dans quelques instants.",
    };
  }

  revalidatePath("/admin");
  revalidatePath("/admin/products");
  revalidatePath("/fr");
  revalidatePath("/fr/products");
  revalidatePath("/");
  redirect("/admin/products");
}

export async function updateOrderStatusAction(formData: FormData): Promise<void> {
  const identity = await requireAdminMutation();
  const id = identifierSchema.parse(formData.get("id"));
  const nextStatus = orderStatusSchema.parse(formData.get("status"));
  const prisma = getAdminPrismaClient();

  await prisma.$transaction(async (transaction) => {
    const order = await transaction.order.findUnique({
      where: { id },
      select: {
        status: true,
        stockRestoredAt: true,
        items: { select: { productId: true, quantity: true } },
      },
    });
    if (!order) throw new Error("ORDER_NOT_FOUND");

    const transitions: Record<typeof order.status, readonly typeof order.status[]> = {
      PENDING: ["CONFIRMED", "CANCELLED"],
      CONFIRMED: ["SHIPPING", "CANCELLED"],
      SHIPPING: ["DELIVERED", "CANCELLED"],
      DELIVERED: [],
      CANCELLED: [],
    };
    if (order.status !== nextStatus && !transitions[order.status].includes(nextStatus)) {
      throw new Error("INVALID_ORDER_TRANSITION");
    }

    if (nextStatus === "CANCELLED" && !order.stockRestoredAt) {
      for (const item of order.items) {
        if (item.productId) {
          await transaction.product.update({
            where: { id: item.productId },
            data: { stockQuantity: { increment: item.quantity } },
            select: { id: true },
          });
        }
      }
    }

    await transaction.order.update({
      where: { id },
      data: {
        status: nextStatus,
        ...(nextStatus === "CANCELLED" && !order.stockRestoredAt
          ? { stockRestoredAt: new Date() }
          : {}),
      },
      select: { id: true },
    });
    await transaction.adminAuditLog.create({
      data: {
        actorUserId: identity.id,
        action: "ORDER_STATUS_UPDATED",
        entityType: "ORDER",
        entityId: id,
        summary: { from: order.status, to: nextStatus },
      },
      select: { id: true },
    });
  });

  revalidatePath("/admin");
  revalidatePath("/admin/orders");
}

export async function updateIntentAction(formData: FormData): Promise<void> {
  const identity = await requireAdminMutation();
  const id = identifierSchema.parse(formData.get("id"));
  const status = intentStatusSchema.parse(formData.get("status"));
  const adminNote = z
    .string()
    .trim()
    .max(500)
    .transform((value) => value || null)
    .parse(formData.get("adminNote") ?? "");
  const prisma = getAdminPrismaClient();
  const current = await prisma.checkoutIntent.findUnique({
    where: { id },
    select: { status: true },
  });
  if (!current || current.status === "CONVERTED" || current.status === "EXPIRED") {
    throw new Error("INTENT_NOT_EDITABLE");
  }

  await prisma.$transaction([
    prisma.checkoutIntent.update({
      where: { id },
      data: {
        status,
        adminNote,
        contactedAt: status === "CONTACTED" ? new Date() : null,
      },
      select: { id: true },
    }),
    prisma.adminAuditLog.create({
      data: {
        actorUserId: identity.id,
        action: "CHECKOUT_INTENT_UPDATED",
        entityType: "CHECKOUT_INTENT",
        entityId: id,
        summary: { from: current.status, to: status },
      },
      select: { id: true },
    }),
  ]);
  revalidatePath("/admin");
  revalidatePath("/admin/intents");
}

export async function updateProductAction(formData: FormData): Promise<void> {
  const identity = await requireAdminMutation();
  const id = identifierSchema.parse(formData.get("id"));
  const stockQuantity = z.coerce.number().int().min(0).max(1_000_000).parse(
    formData.get("stockQuantity"),
  );
  const priceMillimes = parseTunisianDinarsToMillimes(
    z.string().max(32).parse(formData.get("price")),
  );
  const isActive = formData.get("isActive") === "on";
  const prisma = getAdminPrismaClient();

  const previous = await prisma.product.findUnique({
    where: { id },
    select: { stockQuantity: true, price: true, isActive: true },
  });
  if (!previous) throw new Error("PRODUCT_NOT_FOUND");

  await prisma.$transaction([
    prisma.product.update({
      where: { id },
      data: { stockQuantity, price: BigInt(priceMillimes), isActive },
      select: { id: true },
    }),
    prisma.adminAuditLog.create({
      data: {
        actorUserId: identity.id,
        action: "PRODUCT_UPDATED",
        entityType: "PRODUCT",
        entityId: id,
        summary: {
          stockFrom: previous.stockQuantity,
          stockTo: stockQuantity,
          activeFrom: previous.isActive,
          activeTo: isActive,
        },
      },
      select: { id: true },
    }),
  ]);
  revalidatePath("/admin");
  revalidatePath("/admin/products");
  revalidatePath("/fr");
  revalidatePath("/");
}

export async function deleteProductAction(formData: FormData): Promise<void> {
  const identity = await requireAdminMutation();
  const id = identifierSchema.parse(formData.get("id"));
  const prisma = getAdminPrismaClient();
  const imagePaths = await prisma.$transaction(async (transaction) => {
    const product = await transaction.product.findUnique({
      where: { id },
      select: {
        id: true,
        sku: true,
        slug: true,
        nameFr: true,
        images: { select: { path: true } },
      },
    });
    if (!product) throw new Error("PRODUCT_NOT_FOUND");

    await transaction.product.delete({
      where: { id },
      select: { id: true },
    });
    await transaction.adminAuditLog.create({
      data: {
        actorUserId: identity.id,
        action: "PRODUCT_DELETED",
        entityType: "PRODUCT",
        entityId: id,
        summary: {
          sku: product.sku,
          slug: product.slug,
          nameFr: product.nameFr,
        },
      },
      select: { id: true },
    });
    return product.images.map((image) => image.path);
  });

  await deleteUploadedProductImages(imagePaths);
  revalidatePath("/admin");
  revalidatePath("/admin/products");
  revalidatePath("/admin/categories");
  revalidatePath("/fr");
  revalidatePath("/fr/products");
  revalidatePath("/");
}

export async function updateCategoryAction(formData: FormData): Promise<void> {
  const identity = await requireAdminMutation();
  const id = identifierSchema.parse(formData.get("id"));
  const isActive = formData.get("isActive") === "on";
  const prisma = getAdminPrismaClient();
  const previous = await prisma.category.findUnique({
    where: { id },
    select: { isActive: true },
  });
  if (!previous) throw new Error("CATEGORY_NOT_FOUND");

  await prisma.$transaction([
    prisma.category.update({
      where: { id },
      data: { isActive },
      select: { id: true },
    }),
    prisma.adminAuditLog.create({
      data: {
        actorUserId: identity.id,
        action: "CATEGORY_UPDATED",
        entityType: "CATEGORY",
        entityId: id,
        summary: { activeFrom: previous.isActive, activeTo: isActive },
      },
      select: { id: true },
    }),
  ]);
  revalidatePath("/admin/categories");
  revalidatePath("/fr/products");
  revalidatePath("/products");
}

export async function deleteCategoryAction(formData: FormData): Promise<void> {
  const identity = await requireAdminMutation();
  const id = identifierSchema.parse(formData.get("id"));
  const prisma = getAdminPrismaClient();

  await prisma.$transaction(async (transaction) => {
    const category = await transaction.category.findUnique({
      where: { id },
      select: {
        slug: true,
        nameFr: true,
        _count: { select: { products: true } },
      },
    });
    if (!category) throw new Error("CATEGORY_NOT_FOUND");
    if (category._count.products > 0) throw new Error("CATEGORY_NOT_EMPTY");

    await transaction.category.delete({
      where: { id },
      select: { id: true },
    });
    await transaction.adminAuditLog.create({
      data: {
        actorUserId: identity.id,
        action: "CATEGORY_DELETED",
        entityType: "CATEGORY",
        entityId: id,
        summary: {
          slug: category.slug,
          nameFr: category.nameFr,
        },
      },
      select: { id: true },
    });
  });

  revalidatePath("/admin/categories");
  revalidatePath("/fr/products");
  revalidatePath("/products");
}
