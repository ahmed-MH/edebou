import { z } from "zod";

import { parseTunisianDinarsToMillimes } from "@/lib/money";

const slugSchema = z
  .string()
  .trim()
  .min(1, "Le slug est obligatoire.")
  .max(120, "Le slug ne peut pas dépasser 120 caractères.")
  .regex(
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
    "Utilisez uniquement des minuscules, chiffres et tirets.",
  );

const localImagePathSchema = z
  .string()
  .trim()
  .max(512, "Le chemin de l’image est trop long.")
  .regex(
    /^\/[A-Za-z0-9][A-Za-z0-9/_.-]*$/,
    "Utilisez un chemin public local, par exemple /products/article.webp.",
  )
  .refine(
    (value) => !/(^|\/)\.\.?($|\/)/u.test(value),
    "Le chemin de l’image est invalide.",
  );

const priceSchema = z
  .string()
  .trim()
  .min(1, "Le prix est obligatoire.")
  .max(32, "Le prix est invalide.")
  .transform((value, context) => {
    try {
      return parseTunisianDinarsToMillimes(value);
    } catch {
      context.addIssue({
        code: "custom",
        message: "Entrez un prix TND valide avec au maximum 3 décimales.",
      });
      return z.NEVER;
    }
  });

const optionalBundlePriceSchema = z.preprocess(
  (value) => value === "" || value == null ? undefined : value,
  priceSchema.optional(),
);

const optionalComparePriceSchema = z.preprocess(
  (value) => value === "" || value == null ? undefined : value,
  priceSchema.optional(),
);

function validateBundlePrices(
  pricing: { priceMillimes: number; bundlePrice2?: number; bundlePrice3?: number },
  context: z.RefinementCtx,
) {
  for (const quantity of [2, 3] as const) {
    const field = quantity === 2 ? "bundlePrice2" : "bundlePrice3";
    const value = pricing[field];
    if (value !== undefined && (value <= 0 || value > pricing.priceMillimes * quantity)) {
      context.addIssue({
        code: "custom",
        path: [field],
        message: `Le prix pour ${quantity} articles doit être positif et ne pas dépasser le prix normal.`,
      });
    }
  }
}

export const productPricingSchema = z.object({
  priceMillimes: priceSchema,
  compareAtPriceMillimes: optionalComparePriceSchema,
  bundlePrice2: optionalBundlePriceSchema,
  bundlePrice3: optionalBundlePriceSchema,
}).superRefine((pricing, context) => {
  validateBundlePrices(pricing, context);
  if (pricing.compareAtPriceMillimes !== undefined && pricing.compareAtPriceMillimes <= pricing.priceMillimes) {
    context.addIssue({ code: "custom", path: ["compareAtPriceMillimes"], message: "Le prix barré doit être supérieur au prix actuel." });
  }
});

export const createCategorySchema = z.object({
  slug: slugSchema,
  nameFr: z
    .string()
    .trim()
    .min(1, "Le nom français est obligatoire.")
    .max(160, "Le nom français ne peut pas dépasser 160 caractères."),
  nameAr: z
    .string()
    .trim()
    .min(1, "Le nom arabe est obligatoire.")
    .max(160, "Le nom arabe ne peut pas dépasser 160 caractères."),
  isActive: z.boolean(),
});

export const createProductSchema = z.object({
  categoryId: z.string().uuid("Sélectionnez une catégorie valide."),
  sku: z
    .string()
    .trim()
    .min(1, "La référence SKU est obligatoire.")
    .max(64, "La référence ne peut pas dépasser 64 caractères.")
    .regex(
      /^[A-Za-z0-9][A-Za-z0-9._-]*$/,
      "Le SKU peut contenir des lettres, chiffres, points, tirets et underscores.",
    ),
  slug: slugSchema,
  nameFr: z
    .string()
    .trim()
    .min(1, "Le nom français est obligatoire.")
    .max(200, "Le nom français ne peut pas dépasser 200 caractères."),
  nameAr: z
    .string()
    .trim()
    .min(1, "Le nom arabe est obligatoire.")
    .max(200, "Le nom arabe ne peut pas dépasser 200 caractères."),
  descriptionFr: z
    .string()
    .trim()
    .min(1, "La description française est obligatoire.")
    .max(5_000, "La description ne peut pas dépasser 5 000 caractères."),
  descriptionAr: z
    .string()
    .trim()
    .min(1, "La description arabe est obligatoire.")
    .max(5_000, "La description ne peut pas dépasser 5 000 caractères."),
  priceMillimes: priceSchema,
  compareAtPriceMillimes: optionalComparePriceSchema,
  bundlePrice2: optionalBundlePriceSchema,
  bundlePrice3: optionalBundlePriceSchema,
  stockQuantity: z.coerce
    .number()
    .int("Le stock doit être un nombre entier.")
    .min(0, "Le stock ne peut pas être négatif.")
    .max(1_000_000, "Le stock est trop élevé."),
  imagePaths: z
    .array(localImagePathSchema)
    .min(1, "Ajoutez au moins une image.")
    .max(8, "Vous pouvez ajouter au maximum 8 images.")
    .refine(
      (paths) => new Set(paths).size === paths.length,
      "Chaque image ne peut apparaître qu’une seule fois.",
    ),
  isActive: z.boolean(),
}).superRefine((product, context) => {
  validateBundlePrices(product, context);
  if (product.compareAtPriceMillimes !== undefined && product.compareAtPriceMillimes <= product.priceMillimes) {
    context.addIssue({ code: "custom", path: ["compareAtPriceMillimes"], message: "Le prix barré doit être supérieur au prix actuel." });
  }
});

export const updateProductContentSchema = z.object({
  categoryId: createProductSchema.shape.categoryId,
  nameFr: createProductSchema.shape.nameFr,
  nameAr: createProductSchema.shape.nameAr,
  descriptionFr: createProductSchema.shape.descriptionFr,
  descriptionAr: createProductSchema.shape.descriptionAr,
  imagePaths: createProductSchema.shape.imagePaths,
});
