import { PrismaPg } from "@prisma/adapter-pg";
import { config as loadEnvironment } from "dotenv";

import { PrismaClient } from "../src/generated/prisma/client";
import { getSeedDatabaseUrl } from "./seed-guard";

loadEnvironment({
  path: process.env.DATABASE_ENV_FILE ?? ".env.database",
  override: false,
  quiet: true,
});

const categories = [
  { slug: "electronics", nameAr: "الإلكترونيات", nameFr: "Électronique" },
  { slug: "home", nameAr: "المنزل", nameFr: "Maison" },
  { slug: "fashion", nameAr: "الموضة", nameFr: "Mode" },
  { slug: "beauty", nameAr: "الجمال", nameFr: "Beauté" },
  { slug: "sport", nameAr: "الرياضة", nameFr: "Sport" },
  { slug: "essentials", nameAr: "الأساسيات", nameFr: "Essentiels" },
] as const;

const products = [
  {
    categorySlug: "electronics",
    sku: "DEMO-EAR-001",
    slug: "wireless-earbuds",
    nameAr: "سماعات أذن لاسلكية",
    nameFr: "Écouteurs sans fil",
    descriptionAr: "سماعات لاسلكية مريحة للاستخدام اليومي.",
    descriptionFr: "Des écouteurs sans fil confortables pour le quotidien.",
    price: BigInt(79_900),
    stockQuantity: 24,
    isActive: true,
    image: {
      path: "/demo/wireless-earbuds.svg",
      altAr: "سماعات أذن لاسلكية",
      altFr: "Écouteurs sans fil",
    },
    tiers: [
      { minQuantity: 6, unitPrice: BigInt(75_900) },
      { minQuantity: 12, unitPrice: BigInt(71_900) },
    ],
  },
  {
    categorySlug: "home",
    sku: "DEMO-KET-001",
    slug: "electric-kettle",
    nameAr: "غلاية كهربائية",
    nameFr: "Bouilloire électrique",
    descriptionAr: "غلاية كهربائية عملية وسريعة للمنزل.",
    descriptionFr: "Une bouilloire électrique pratique et rapide pour la maison.",
    price: BigInt(89_900),
    stockQuantity: 5,
    isActive: true,
    image: {
      path: "/demo/electric-kettle.svg",
      altAr: "غلاية كهربائية",
      altFr: "Bouilloire électrique",
    },
    tiers: [
      { minQuantity: 4, unitPrice: BigInt(85_900) },
      { minQuantity: 10, unitPrice: BigInt(81_900) },
    ],
  },
  {
    categorySlug: "fashion",
    sku: "DEMO-BAG-001",
    slug: "daily-backpack",
    nameAr: "حقيبة ظهر يومية",
    nameFr: "Sac à dos quotidien",
    descriptionAr: "حقيبة ظهر خفيفة ومتينة للتنقل اليومي.",
    descriptionFr: "Un sac à dos léger et résistant pour les déplacements quotidiens.",
    price: BigInt(64_900),
    stockQuantity: 18,
    isActive: true,
    image: {
      path: "/demo/daily-backpack.svg",
      altAr: "حقيبة ظهر يومية",
      altFr: "Sac à dos quotidien",
    },
    tiers: [
      { minQuantity: 6, unitPrice: BigInt(61_900) },
      { minQuantity: 12, unitPrice: BigInt(58_900) },
    ],
  },
  {
    categorySlug: "beauty",
    sku: "DEMO-CARE-001",
    slug: "daily-care-set",
    nameAr: "مجموعة العناية اليومية",
    nameFr: "Coffret soin quotidien",
    descriptionAr: "مجموعة مختارة للعناية اليومية.",
    descriptionFr: "Une sélection de produits pour les soins quotidiens.",
    price: BigInt(39_900),
    stockQuantity: 0,
    isActive: true,
    image: {
      path: "/demo/daily-care-set.svg",
      altAr: "مجموعة العناية اليومية",
      altFr: "Coffret soin quotidien",
    },
    tiers: [
      { minQuantity: 8, unitPrice: BigInt(37_900) },
      { minQuantity: 16, unitPrice: BigInt(35_900) },
    ],
  },
  {
    categorySlug: "electronics",
    sku: "DEMO-ARCHIVE-001",
    slug: "archived-power-bank",
    nameAr: "بطارية محمولة مؤرشفة",
    nameFr: "Batterie externe archivée",
    descriptionAr: "منتج تجريبي غير نشط للتحقق من ترشيح الكتالوج.",
    descriptionFr: "Produit de démonstration inactif pour vérifier le filtrage du catalogue.",
    price: BigInt(54_900),
    stockQuantity: 10,
    isActive: false,
    image: null,
    tiers: [],
  },
] as const;

async function seed(): Promise<void> {
  const adapter = new PrismaPg({ connectionString: getSeedDatabaseUrl() });
  const prisma = new PrismaClient({ adapter });

  try {
    await prisma.$transaction(async (transaction) => {
      const categoryIds = new Map<string, string>();

      for (const category of categories) {
        const persistedCategory = await transaction.category.upsert({
          where: { slug: category.slug },
          create: { ...category, isActive: true },
          update: {
            nameAr: category.nameAr,
            nameFr: category.nameFr,
            isActive: true,
          },
          select: { id: true },
        });

        categoryIds.set(category.slug, persistedCategory.id);
      }

      for (const product of products) {
        const categoryId = categoryIds.get(product.categorySlug);

        if (!categoryId) {
          throw new Error("A demo product references an unknown category.");
        }

        const persistedProduct = await transaction.product.upsert({
          where: { sku: product.sku },
          create: {
            categoryId,
            sku: product.sku,
            slug: product.slug,
            nameAr: product.nameAr,
            nameFr: product.nameFr,
            descriptionAr: product.descriptionAr,
            descriptionFr: product.descriptionFr,
            price: product.price,
            stockQuantity: product.stockQuantity,
            isActive: product.isActive,
          },
          update: {
            categoryId,
            slug: product.slug,
            nameAr: product.nameAr,
            nameFr: product.nameFr,
            descriptionAr: product.descriptionAr,
            descriptionFr: product.descriptionFr,
            price: product.price,
            stockQuantity: product.stockQuantity,
            isActive: product.isActive,
          },
          select: { id: true },
        });

        // Demo-owned children converge without changing stable IDs on an
        // identical rerun, while stale fixture rows are pruned transactionally.
        if (product.image) {
          await transaction.productImage.upsert({
            where: {
              productId_position: {
                productId: persistedProduct.id,
                position: 0,
              },
            },
            create: {
              productId: persistedProduct.id,
              position: 0,
              ...product.image,
            },
            update: product.image,
          });
          await transaction.productImage.deleteMany({
            where: {
              productId: persistedProduct.id,
              position: { not: 0 },
            },
          });
        } else {
          await transaction.productImage.deleteMany({
            where: { productId: persistedProduct.id },
          });
        }

        for (const tier of product.tiers) {
          await transaction.productPriceTier.upsert({
            where: {
              productId_minQuantity: {
                productId: persistedProduct.id,
                minQuantity: tier.minQuantity,
              },
            },
            create: { productId: persistedProduct.id, ...tier },
            update: { unitPrice: tier.unitPrice },
          });
        }
        await transaction.productPriceTier.deleteMany({
          where: {
            productId: persistedProduct.id,
            ...(product.tiers.length > 0
              ? {
                  minQuantity: {
                    notIn: product.tiers.map((tier) => tier.minQuantity),
                  },
                }
              : {}),
          },
        });
      }

      await transaction.storeSettings.upsert({
        where: { id: 1 },
        create: {
          id: 1,
          deliveryFee: BigInt(8_000),
          storeName: "EDebou",
        },
        update: {
          deliveryFee: BigInt(8_000),
          storeName: "EDebou",
        },
      });
    });
  } finally {
    await prisma.$disconnect();
  }
}

seed().catch(() => {
  console.error("The local demo seed failed. No connection details were logged.");
  process.exitCode = 1;
});
