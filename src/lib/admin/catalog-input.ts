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
});
