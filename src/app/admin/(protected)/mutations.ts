"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { Prisma } from "@/generated/prisma/client";
import {
  createCategorySchema,
  createProductSchema,
  productPricingSchema,
  updateProductContentSchema,
} from "@/lib/admin/catalog-input";
import { deleteUploadedProductImages } from "@/lib/admin/product-images";
import { getAdminPrismaClient } from "@/lib/db/admin-prisma";
import { assertAdminMutationRequest } from "@/lib/admin/request-security";
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
  await assertAdminMutationRequest();
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
    compareAtPriceMillimes: formData.get("compareAtPriceMillimes"),
    bundlePrice2: formData.get("bundlePrice2"),
    bundlePrice3: formData.get("bundlePrice3"),
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
          compareAtPrice: parsed.data.compareAtPriceMillimes === undefined ? null : BigInt(parsed.data.compareAtPriceMillimes),
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
          priceTiers: {
            create: ([2, 3] as const).flatMap((quantity) => {
              const total = quantity === 2 ? parsed.data.bundlePrice2 : parsed.data.bundlePrice3;
              return total === undefined ? [] : [{
                minQuantity: quantity,
                unitPrice: BigInt(Math.floor(total / quantity)),
                bundleTotal: BigInt(total),
              }];
            }),
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
    // Already in that status (e.g. a double-click): nothing to change or log.
    if (order.status === nextStatus) return;

    const transitions: Record<typeof order.status, readonly typeof order.status[]> = {
      PENDING: ["CONFIRMED", "CANCELLED"],
      CONFIRMED: ["SHIPPING", "CANCELLED"],
      SHIPPING: ["DELIVERED", "CANCELLED"],
      DELIVERED: [],
      CANCELLED: [],
    };
    if (!transitions[order.status].includes(nextStatus)) {
      throw new Error("INVALID_ORDER_TRANSITION");
    }

    const restoreStock = nextStatus === "CANCELLED" && !order.stockRestoredAt;
    // Conditional write: a concurrent update (double-click, second admin) waits on
    // the row lock, then matches nothing, so stock can never be restored twice.
    const claimed = await transaction.order.updateMany({
      where: { id, status: order.status, stockRestoredAt: order.stockRestoredAt },
      data: {
        status: nextStatus,
        ...(restoreStock ? { stockRestoredAt: new Date() } : {}),
      },
    });
    if (claimed.count !== 1) {
      // A simultaneous identical click already did the work: treat it as done, not as an error.
      const latest = await transaction.order.findUnique({ where: { id }, select: { status: true } });
      if (latest?.status === nextStatus) return;
      throw new Error("ORDER_CHANGED_CONCURRENTLY");
    }

    if (restoreStock) {
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

export async function updateProductAction(
  _previousState: CatalogCreateState,
  formData: FormData,
): Promise<CatalogCreateState> {
  const identity = await requireAdminMutation();
  const id = identifierSchema.parse(formData.get("id"));
  const stockSchema = z.coerce.number().int().min(0).max(1_000_000);
  const parsedStock = stockSchema.safeParse(formData.get("stockQuantity"));
  const expectedStock = stockSchema.parse(formData.get("expectedStockQuantity"));
  if (!parsedStock.success) return {
    message: "Vérifiez le stock saisi.",
    errors: { stockQuantity: [parsedStock.error.issues[0]?.message ?? "Stock invalide."] },
  };
  const parsedPricing = productPricingSchema.safeParse({
    priceMillimes: formData.get("price"),
    compareAtPriceMillimes: formData.get("compareAtPriceMillimes"),
    bundlePrice2: formData.get("bundlePrice2"),
    bundlePrice3: formData.get("bundlePrice3"),
  });
  if (!parsedPricing.success) return validationState(parsedPricing.error);
  const pricing = parsedPricing.data;
  const priceMillimes = pricing.priceMillimes;
  const stockQuantity = parsedStock.data;
  const isActive = formData.get("isActive") === "on";
  const prisma = getAdminPrismaClient();

  const previous = await prisma.product.findUnique({
    where: { id },
    select: { isActive: true, slug: true },
  });
  if (!previous) throw new Error("PRODUCT_NOT_FOUND");

  const stockChanged = stockQuantity !== expectedStock;
  try {
    await prisma.$transaction(async (transaction) => {
      await transaction.product.update({
        where: { id },
        data: { price: BigInt(priceMillimes), compareAtPrice: pricing.compareAtPriceMillimes === undefined ? null : BigInt(pricing.compareAtPriceMillimes), isActive },
        select: { id: true },
      });
      if (stockChanged) {
        // Only overwrite the stock the admin actually saw; orders may have decremented it since.
        const stockUpdate = await transaction.product.updateMany({
          where: { id, stockQuantity: expectedStock },
          data: { stockQuantity },
        });
        if (stockUpdate.count !== 1) throw new Error("STOCK_CHANGED");
      }
      await transaction.productPriceTier.deleteMany({
        // The form is the only editor of offers: replace them all so no hidden offer survives.
        where: { productId: id },
      });
      for (const quantity of [2, 3] as const) {
        const total = quantity === 2 ? pricing.bundlePrice2 : pricing.bundlePrice3;
        if (total !== undefined) {
          await transaction.productPriceTier.create({
            data: {
              productId: id,
              minQuantity: quantity,
              unitPrice: BigInt(Math.floor(total / quantity)),
              bundleTotal: BigInt(total),
            },
            select: { id: true },
          });
        }
      }
      await transaction.adminAuditLog.create({
        data: {
          actorUserId: identity.id,
          action: "PRODUCT_UPDATED",
          entityType: "PRODUCT",
          entityId: id,
          summary: {
            stockFrom: expectedStock,
            stockTo: stockChanged ? stockQuantity : expectedStock,
            activeFrom: previous.isActive,
            activeTo: isActive,
          },
        },
        select: { id: true },
      });
    });
  } catch (error) {
    if (!(error instanceof Error) || error.message !== "STOCK_CHANGED") throw error;
    revalidatePath("/admin/products");
    return {
      message: "Le stock a changé depuis l’ouverture de la page (nouvelles commandes). Rien n’a été enregistré : vérifiez le stock affiché puis réessayez.",
      errors: { stockQuantity: ["Stock modifié entre-temps."] },
    };
  }
  revalidatePath("/admin");
  revalidatePath("/admin/products");
  revalidatePath("/fr");
  revalidatePath("/");
  revalidatePath(`/products/${previous.slug}`);
  revalidatePath(`/fr/products/${previous.slug}`);
  return { message: "Prix, offres et stock enregistrés." };
}

export async function updateProductContentAction(
  _previousState: CatalogCreateState,
  formData: FormData,
): Promise<CatalogCreateState> {
  const identity = await requireAdminMutation();
  const id = identifierSchema.parse(formData.get("id"));
  const parsed = updateProductContentSchema.safeParse({
    categoryId: formData.get("categoryId"),
    nameFr: formData.get("nameFr"),
    nameAr: formData.get("nameAr"),
    descriptionFr: formData.get("descriptionFr"),
    descriptionAr: formData.get("descriptionAr"),
    imagePaths: formData.getAll("imagePaths"),
  });
  if (!parsed.success) return validationState(parsed.error);

  const prisma = getAdminPrismaClient();
  const previous = await prisma.product.findUnique({
    where: { id },
    select: { slug: true, images: { select: { path: true } } },
  });
  if (!previous) return { message: "Ce produit n’existe plus." };

  try {
    await prisma.$transaction(async (transaction) => {
      await transaction.productImage.deleteMany({ where: { productId: id } });
      await transaction.product.update({
        where: { id },
        data: {
          categoryId: parsed.data.categoryId,
          nameFr: parsed.data.nameFr,
          nameAr: parsed.data.nameAr,
          descriptionFr: parsed.data.descriptionFr,
          descriptionAr: parsed.data.descriptionAr,
          images: {
            create: parsed.data.imagePaths.map((path, position) => ({
              path,
              position,
              altFr: parsed.data.nameFr,
              altAr: parsed.data.nameAr,
            })),
          },
        },
        select: { id: true },
      });
      await transaction.adminAuditLog.create({
        data: {
          actorUserId: identity.id,
          action: "PRODUCT_UPDATED",
          entityType: "PRODUCT",
          entityId: id,
          summary: { slug: previous.slug, contentUpdated: true, imageCount: parsed.data.imagePaths.length },
        },
        select: { id: true },
      });
    });
  } catch (error) {
    console.error("Admin product content update failed.", error);
    return { message: "Le produit n’a pas pu être enregistré. Réessayez." };
  }

  try {
    const removedPaths = previous.images
      .map((image) => image.path)
      .filter((path) => !parsed.data.imagePaths.includes(path));
    const orphanedPaths = await Promise.all(removedPaths.map(async (path) => ({
      path,
      count: await prisma.productImage.count({ where: { path } }),
    })));
    await deleteUploadedProductImages(orphanedPaths.filter((image) => image.count === 0).map((image) => image.path));
  } catch (error) {
    console.error("Old product image cleanup failed.", error);
  }

  revalidatePath("/admin/products");
  revalidatePath("/products");
  revalidatePath("/fr/products");
  revalidatePath(`/products/${previous.slug}`);
  revalidatePath(`/fr/products/${previous.slug}`);
  redirect("/admin/products");
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
