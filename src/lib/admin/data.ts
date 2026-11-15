import "server-only";

import { Prisma } from "@/generated/prisma/client";
import { getAdminPrismaClient } from "@/lib/db/admin-prisma";
import { requireAdminSession } from "@/lib/admin/session";

import { calculateIntentScore } from "./intent-score";

export {
  calculateIntentScore,
  type IntentScore,
  type IntentStrength,
} from "./intent-score";

function safeInteger(value: bigint): number {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed)) {
    throw new Error("Admin aggregate exceeds the supported range.");
  }
  return parsed;
}

type StoredIntentItem = {
  readonly productSlug: string;
  readonly quantity: number;
  readonly productNameFr?: string;
  readonly productNameAr?: string;
  readonly sku?: string;
};

function readStoredIntentItems(value: unknown): readonly StoredIntentItem[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (
      !item ||
      typeof item !== "object" ||
      !("productSlug" in item) ||
      typeof item.productSlug !== "string" ||
      !("quantity" in item) ||
      typeof item.quantity !== "number"
    ) {
      return [];
    }
    return [
      {
        productSlug: item.productSlug,
        quantity: item.quantity,
        productNameFr:
          "productNameFr" in item && typeof item.productNameFr === "string"
            ? item.productNameFr
            : undefined,
        productNameAr:
          "productNameAr" in item && typeof item.productNameAr === "string"
            ? item.productNameAr
            : undefined,
        sku:
          "sku" in item && typeof item.sku === "string"
            ? item.sku
            : undefined,
      },
    ];
  });
}

export async function getAdminNavigationCounts() {
  await requireAdminSession();
  const now = new Date();
  const prisma = getAdminPrismaClient();
  await prisma.checkoutIntent.deleteMany({
    where: { expiresAt: { lte: now } },
  });
  const [pendingOrders, activeIntents] = await Promise.all([
    prisma.order.count({ where: { status: "PENDING" } }),
    prisma.checkoutIntent.count({
      where: {
        status: { in: ["ACTIVE", "CONTACTED"] },
        expiresAt: { gt: now },
      },
    }),
  ]);
  return { pendingOrders, activeIntents };
}

export async function getAdminDashboardData() {
  await requireAdminSession();
  const prisma = getAdminPrismaClient();
  const now = new Date();
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const sevenDaysAgo = new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000);
  sevenDaysAgo.setHours(0, 0, 0, 0);

  const [
    today,
    pendingOrders,
    activeIntents,
    totalIntents,
    convertedIntents,
    lowStockProducts,
    recentOrders,
    recentIntents,
    statusGroups,
    dailyRows,
  ] = await Promise.all([
    prisma.order.aggregate({
      where: {
        createdAt: { gte: startOfToday },
        status: { not: "CANCELLED" },
      },
      _count: { id: true },
      _sum: { total: true },
    }),
    prisma.order.count({ where: { status: "PENDING" } }),
    prisma.checkoutIntent.count({
      where: {
        status: { in: ["ACTIVE", "CONTACTED"] },
        expiresAt: { gt: now },
      },
    }),
    prisma.checkoutIntent.count({
      where: { firstSeenAt: { gte: thirtyDaysAgo } },
    }),
    prisma.checkoutIntent.count({
      where: { firstSeenAt: { gte: thirtyDaysAgo }, status: "CONVERTED" },
    }),
    prisma.product.count({
      where: { isActive: true, stockQuantity: { lte: 5 } },
    }),
    prisma.order.findMany({
      orderBy: { createdAt: "desc" },
      take: 6,
      select: {
        id: true,
        orderNumber: true,
        customerName: true,
        total: true,
        status: true,
        createdAt: true,
      },
    }),
    prisma.checkoutIntent.findMany({
      where: {
        status: { in: ["ACTIVE", "CONTACTED"] },
        expiresAt: { gt: now },
      },
      orderBy: { lastSeenAt: "desc" },
      take: 6,
      select: {
        id: true,
        customerName: true,
        phone: true,
        address: true,
        governorate: true,
        items: true,
        status: true,
        lastSeenAt: true,
      },
    }),
    prisma.order.groupBy({ by: ["status"], _count: { id: true } }),
    prisma.$queryRaw<
      Array<{ day: Date; orderCount: bigint; revenue: bigint }>
    >(Prisma.sql`
      SELECT
        date_trunc('day', "created_at") AS "day",
        COUNT(*)::bigint AS "orderCount",
        COALESCE(SUM("total"), 0)::bigint AS "revenue"
      FROM "orders"
      WHERE "created_at" >= ${sevenDaysAgo}
        AND "status" <> 'CANCELLED'::"order_status"
      GROUP BY date_trunc('day', "created_at")
      ORDER BY "day" ASC
    `),
  ]);

  const statusCounts = Object.fromEntries(
    statusGroups.map((group) => [group.status, group._count.id]),
  ) as Partial<Record<"PENDING" | "CONFIRMED" | "SHIPPING" | "DELIVERED" | "CANCELLED", number>>;

  return {
    metrics: {
      ordersToday: today._count.id,
      revenueTodayMillimes: safeInteger(today._sum.total ?? BigInt(0)),
      pendingOrders,
      activeIntents,
      lowStockProducts,
      conversionRate:
        totalIntents === 0
          ? 0
          : Math.round((convertedIntents / totalIntents) * 100),
    },
    recentOrders: recentOrders.map((order) => ({
      ...order,
      totalMillimes: safeInteger(order.total),
    })),
    recentIntents: recentIntents.map((intent) => ({
      ...intent,
      score: calculateIntentScore(intent),
    })),
    statusCounts,
    dailySales: dailyRows.map((row) => ({
      day: row.day,
      orderCount: safeInteger(row.orderCount),
      revenueMillimes: safeInteger(row.revenue),
    })),
  };
}

export async function getAdminOrders() {
  await requireAdminSession();
  const orders = await getAdminPrismaClient().order.findMany({
    orderBy: { createdAt: "desc" },
    take: 150,
    select: {
      id: true,
      orderNumber: true,
      customerName: true,
      phone: true,
      governorate: true,
      address: true,
      subtotal: true,
      deliveryFee: true,
      total: true,
      status: true,
      createdAt: true,
      items: {
        select: {
          id: true,
          productNameSnapshot: true,
          skuSnapshot: true,
          quantity: true,
          unitPrice: true,
          lineTotal: true,
        },
      },
    },
  });

  return orders.map((order) => ({
    ...order,
    subtotalMillimes: safeInteger(order.subtotal),
    deliveryFeeMillimes: safeInteger(order.deliveryFee),
    totalMillimes: safeInteger(order.total),
    items: order.items.map((item) => ({
      ...item,
      unitPriceMillimes: safeInteger(item.unitPrice),
      lineTotalMillimes: safeInteger(item.lineTotal),
    })),
  }));
}

export async function getAdminIntents() {
  await requireAdminSession();
  const now = new Date();
  const prisma = getAdminPrismaClient();
  const intents = await prisma.checkoutIntent.findMany({
    where: { expiresAt: { gt: now }, status: { not: "EXPIRED" } },
    orderBy: [{ status: "asc" }, { lastSeenAt: "desc" }],
    take: 200,
    select: {
      id: true,
      customerName: true,
      phone: true,
      governorate: true,
      address: true,
      locale: true,
      source: true,
      items: true,
      status: true,
      adminNote: true,
      firstSeenAt: true,
      lastSeenAt: true,
      contactedAt: true,
      convertedAt: true,
      order: { select: { orderNumber: true } },
    },
  });

  const storedItems = intents.map((intent) => readStoredIntentItems(intent.items));
  const productSlugs = [
    ...new Set(
      storedItems.flatMap((items) => items.map((item) => item.productSlug)),
    ),
  ];
  const products =
    productSlugs.length > 0
      ? await prisma.product.findMany({
          where: { slug: { in: productSlugs } },
          select: {
            slug: true,
            sku: true,
            nameFr: true,
            nameAr: true,
          },
        })
      : [];
  const productsBySlug = new Map(
    products.map((product) => [product.slug, product] as const),
  );

  return intents.map((intent, index) => {
    const items = (storedItems[index] ?? []).map((item) => {
      const product = productsBySlug.get(item.productSlug);
      return {
        productSlug: item.productSlug,
        quantity: item.quantity,
        productName:
          intent.locale === "ar"
            ? item.productNameAr ?? product?.nameAr ?? item.productSlug
            : item.productNameFr ?? product?.nameFr ?? item.productSlug,
        sku: item.sku ?? product?.sku,
      };
    });
    return {
      ...intent,
      items,
      score: calculateIntentScore({ ...intent, items }),
    };
  });
}

export async function getAdminProducts() {
  await requireAdminSession();
  const products = await getAdminPrismaClient().product.findMany({
    orderBy: [{ isActive: "desc" }, { updatedAt: "desc" }],
    take: 300,
    select: {
      id: true,
      sku: true,
      slug: true,
      nameFr: true,
      nameAr: true,
      price: true,
      stockQuantity: true,
      isActive: true,
      updatedAt: true,
      category: { select: { nameFr: true } },
    },
  });
  return products.map((product) => ({
    ...product,
    priceMillimes: safeInteger(product.price),
  }));
}

export async function getAdminCategories() {
  await requireAdminSession();
  return getAdminPrismaClient().category.findMany({
    orderBy: { nameFr: "asc" },
    select: {
      id: true,
      slug: true,
      nameFr: true,
      nameAr: true,
      isActive: true,
      updatedAt: true,
      _count: { select: { products: true } },
    },
  });
}

export async function getAdminSettings() {
  await requireAdminSession();
  const settings = await getAdminPrismaClient().storeSettings.findUnique({
    where: { id: 1 },
    select: { storeName: true, deliveryFee: true, updatedAt: true },
  });
  return settings
    ? { ...settings, deliveryFeeMillimes: safeInteger(settings.deliveryFee) }
    : null;
}

export async function getAdminAuditLogs() {
  await requireAdminSession();
  return getAdminPrismaClient().adminAuditLog.findMany({
    orderBy: { createdAt: "desc" },
    take: 200,
    select: {
      id: true,
      action: true,
      entityType: true,
      entityId: true,
      summary: true,
      createdAt: true,
      actor: { select: { displayName: true, email: true } },
    },
  });
}
