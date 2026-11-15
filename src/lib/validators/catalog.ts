import { z } from "zod";

import { InvalidRequestError } from "@/lib/errors";

export const PUBLIC_PRODUCT_PAGE_SIZE_MAX = 24;
export const PUBLIC_PRODUCT_PAGE_MAX = 1_000;
export const PUBLIC_SEARCH_LENGTH_MAX = 80;

export const publicProductSortValues = [
  "newest",
  "price-asc",
  "price-desc",
] as const;

export type PublicProductSort = (typeof publicProductSortValues)[number];

const boundedIntegerString = (maximum: number) =>
  z
    .string()
    .max(String(maximum).length)
    .regex(/^\d+$/u)
    .transform(Number)
    .pipe(z.number().int().min(1).max(maximum));

const slugSchema = z
  .string()
  .trim()
  .min(1)
  .max(120)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/u);

const searchSchema = z
  .string()
  .transform((value) => value.trim().normalize("NFKC"))
  .pipe(
    z
      .string()
      .min(2)
      .max(PUBLIC_SEARCH_LENGTH_MAX)
      .refine((value) => !/[\u0000-\u001f\u007f]/u.test(value)),
  );

const productListQuerySchema = z
  .object({
    page: boundedIntegerString(PUBLIC_PRODUCT_PAGE_MAX).optional(),
    pageSize: boundedIntegerString(PUBLIC_PRODUCT_PAGE_SIZE_MAX).optional(),
    search: z.preprocess(
      (value) => (value === "" ? undefined : value),
      searchSchema.optional(),
    ),
    category: z.preprocess(
      (value) => (value === "" ? undefined : value),
      slugSchema.optional(),
    ),
    sort: z.enum(publicProductSortValues).optional(),
  })
  .strict()
  .transform((query) => ({
    page: query.page ?? 1,
    pageSize: query.pageSize ?? 12,
    search: query.search,
    category: query.category,
    sort: query.sort ?? "newest",
  }));

const emptyQuerySchema = z.object({}).strict();

export type ProductListQuery = z.output<typeof productListQuerySchema>;

function searchParamsToUniqueRecord(
  searchParams: URLSearchParams,
): Record<string, string> {
  const values: Record<string, string> = Object.create(null) as Record<
    string,
    string
  >;

  for (const [key, value] of searchParams) {
    if (Object.hasOwn(values, key)) {
      throw new InvalidRequestError();
    }

    values[key] = value;
  }

  return values;
}

export function parseProductListQuery(
  searchParams: URLSearchParams,
): ProductListQuery {
  const result = productListQuerySchema.safeParse(
    searchParamsToUniqueRecord(searchParams),
  );

  if (!result.success) {
    throw new InvalidRequestError();
  }

  return result.data;
}

export function parseEmptyQuery(searchParams: URLSearchParams): void {
  const result = emptyQuerySchema.safeParse(
    searchParamsToUniqueRecord(searchParams),
  );

  if (!result.success) {
    throw new InvalidRequestError();
  }
}

export function parseProductSlug(value: string): string {
  const result = slugSchema.safeParse(value);

  if (!result.success) {
    throw new InvalidRequestError();
  }

  return result.data;
}
