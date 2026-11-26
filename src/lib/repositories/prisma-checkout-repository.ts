import "server-only";

import { randomInt } from "node:crypto";

import { Prisma } from "@/generated/prisma/client";
import { getCheckoutPrismaClient } from "@/lib/db/checkout-prisma";
import { priceOrderLine } from "@/lib/checkout/offer-pricing";
import {
  CheckoutServiceUnavailableError,
  IdempotencyConflictError,
  OrderUnavailableError,
} from "@/lib/checkout/errors";

import type {
  CheckoutIntentRepository,
  CheckoutRepository,
  CheckoutSettingsRecord,
  CreateOrderPersistenceInput,
  OrderConfirmationRecord,
  RateLimitRecord,
  UpsertCheckoutIntentPersistenceInput,
} from "./checkout-repository";

const MAX_ORDER_TOTAL_MILLIMES = BigInt(100_000_000);
const MAX_TRANSACTION_ATTEMPTS = 3;
// Many Tunisian mobile customers share one public IP (carrier NAT), so keep this generous.
export const ORDER_RATE_LIMIT_MAX_ATTEMPTS = 40;
const RATE_LIMIT_WINDOW_SECONDS = 15 * 60;
const INTENT_RATE_LIMIT_MAX_ATTEMPTS = 60;

type TransactionClient = Prisma.TransactionClient;

interface ExistingOrderRow {
  readonly requestHash: string;
  readonly orderNumber: string;
  readonly subtotal: bigint;
  readonly deliveryFee: bigint;
  readonly total: bigint;
}

interface RateLimitRow {
  readonly requestCount: number;
  readonly retryAfterSeconds: number;
}

interface InsertedOrderRow {
  readonly id: string;
  readonly orderNumber: string;
  readonly subtotal: bigint;
  readonly deliveryFee: bigint;
  readonly total: bigint;
}

/** Short enough to read out on the phone, e.g. EDB-261126-4821 (Tunis date + 4 digits). */
export function createOrderNumber(now = new Date()): string {
  const date = new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Tunis" })
    .format(now)
    .slice(2)
    .replaceAll("-", "");
  // shortcut: 10,000 numbers per day; a clash is retried (see createOrder). Lengthen past ~500 orders/day.
  return `EDB-${date}-${String(randomInt(10_000)).padStart(4, "0")}`;
}

function isPrismaErrorCode(error: unknown, code: string): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError && error.code === code
  );
}

function isSerializableTransactionConflict(error: unknown): boolean {
  if (isPrismaErrorCode(error, "P2034")) {
    return true;
  }

  if (
    !(error instanceof Prisma.PrismaClientKnownRequestError) ||
    error.code !== "P2010"
  ) {
    return false;
  }

  const metadata = error.meta as
    | {
        readonly code?: unknown;
        readonly driverAdapterError?: {
          readonly cause?: {
            readonly code?: unknown;
            readonly originalCode?: unknown;
          };
        };
      }
    | undefined;

  return (
    metadata?.code === "40001" ||
    metadata?.driverAdapterError?.cause?.code === "40001" ||
    metadata?.driverAdapterError?.cause?.originalCode === "40001"
  );
}

class IdempotencyRaceLostError extends Error {
  constructor() {
    super("IDEMPOTENCY_RACE_LOST");
    this.name = "IdempotencyRaceLostError";
  }
}


function existingOrderToConfirmation(
  order: ExistingOrderRow,
): OrderConfirmationRecord {
  return {
    orderNumber: order.orderNumber,
    subtotal: order.subtotal,
    deliveryFee: order.deliveryFee,
    total: order.total,
    replayed: true,
  };
}

async function findExistingOrder(
  idempotencyKeyHash: string,
): Promise<ExistingOrderRow | null> {
  const prisma = getCheckoutPrismaClient();

  return prisma.order.findUnique({
    where: { idempotencyKeyHash },
    select: {
      requestHash: true,
      orderNumber: true,
      subtotal: true,
      deliveryFee: true,
      total: true,
    },
  });
}

async function resolveExistingOrder(
  idempotencyKeyHash: string,
  requestHash: string,
): Promise<OrderConfirmationRecord | null> {
  const existing = await findExistingOrder(idempotencyKeyHash);

  if (!existing) {
    return null;
  }

  if (existing.requestHash !== requestHash) {
    throw new IdempotencyConflictError();
  }

  return existingOrderToConfirmation(existing);
}

async function createOrderTransaction(
  transaction: TransactionClient,
  input: CreateOrderPersistenceInput,
): Promise<OrderConfirmationRecord> {
  const replay = await transaction.order.findUnique({
    where: { idempotencyKeyHash: input.idempotencyKeyHash },
    select: {
      requestHash: true,
      orderNumber: true,
      subtotal: true,
      deliveryFee: true,
      total: true,
    },
  });

  if (replay) {
    if (replay.requestHash !== input.requestHash) {
      throw new IdempotencyConflictError();
    }

    return existingOrderToConfirmation(replay);
  }

  const sortedItems = [...input.request.items].sort((left, right) =>
    left.productSlug < right.productSlug
      ? -1
      : left.productSlug > right.productSlug
        ? 1
        : 0,
  );
  const slugs = sortedItems.map((item) => item.productSlug);

  const [products, settings] = await Promise.all([
    transaction.product.findMany({
      where: {
        slug: { in: slugs },
        isActive: true,
        category: { is: { isActive: true } },
      },
      select: {
        id: true,
        slug: true,
        sku: true,
        nameAr: true,
        nameFr: true,
        price: true,
        priceTiers: {
          where: { minQuantity: { lte: 100 } },
          select: { minQuantity: true, unitPrice: true, bundleTotal: true },
          orderBy: { minQuantity: "desc" },
        },
      },
      take: 20,
    }),
    transaction.storeSettings.findUnique({
      where: { id: 1 },
      select: { deliveryFee: true },
    }),
  ]);

  if (products.length !== sortedItems.length || !settings) {
    throw new OrderUnavailableError();
  }

  const productsBySlug = new Map(
    products.map((product) => [product.slug, product] as const),
  );
  const pricedItems = sortedItems.map((item) => {
    const product = productsBySlug.get(item.productSlug);
    if (!product) {
      throw new OrderUnavailableError();
    }

    const { unitPrice, lineTotal } = priceOrderLine(
      product.price,
      item.quantity,
      product.priceTiers,
    );
    return { item, product, unitPrice, lineTotal };
  });

  const subtotal = pricedItems.reduce(
    (sum, pricedItem) => sum + pricedItem.lineTotal,
    BigInt(0),
  );
  const total = subtotal + settings.deliveryFee;

  if (
    subtotal < BigInt(0) ||
    settings.deliveryFee < BigInt(0) ||
    total > MAX_ORDER_TOTAL_MILLIMES
  ) {
    throw new OrderUnavailableError();
  }

  for (const pricedItem of pricedItems) {
    const updated = await transaction.product.updateMany({
      where: {
        id: pricedItem.product.id,
        isActive: true,
        stockQuantity: { gte: pricedItem.item.quantity },
      },
      data: {
        stockQuantity: { decrement: pricedItem.item.quantity },
      },
    });

    if (updated.count !== 1) {
      throw new OrderUnavailableError();
    }
  }

  // A tagged parameterized statement lets PostgreSQL apply the protected
  // status/timestamp defaults. Prisma's model create would explicitly include
  // those columns and unnecessarily widen the checkout role's INSERT rights.
  const insertedOrders = await transaction.$queryRaw<InsertedOrderRow[]>(
    Prisma.sql`
      INSERT INTO "orders" (
        "order_number",
        "idempotency_key_hash",
        "request_hash",
        "customer_name",
        "phone",
        "governorate",
        "address",
        "notes",
        "subtotal",
        "delivery_fee",
        "total"
      ) VALUES (
        ${createOrderNumber()},
        ${input.idempotencyKeyHash},
        ${input.requestHash},
        ${input.request.customer.fullName},
        ${input.request.customer.phone},
        ${input.request.customer.governorate},
        ${input.request.customer.address},
        ${input.request.customer.notes ?? null},
        ${subtotal},
        ${settings.deliveryFee},
        ${total}
      )
      ON CONFLICT DO NOTHING
      RETURNING
        "id",
        "order_number" AS "orderNumber",
        "subtotal",
        "delivery_fee" AS "deliveryFee",
        "total"
    `,
  );
  const order = insertedOrders[0];
  if (!order) {
    // Either the same request already committed (idempotency key) or the short
    // order number clashed. Throwing rolls back every stock decrement; the caller
    // replays the committed winner, or retries with a fresh order number.
    throw new IdempotencyRaceLostError();
  }

  await transaction.orderItem.createMany({
    data: pricedItems.map((pricedItem) => ({
      orderId: order.id,
      productId: pricedItem.product.id,
      productNameSnapshot:
        input.request.locale === "ar"
          ? pricedItem.product.nameAr
          : pricedItem.product.nameFr,
      skuSnapshot: pricedItem.product.sku,
      quantity: pricedItem.item.quantity,
      unitPrice: pricedItem.unitPrice,
      lineTotal: pricedItem.lineTotal,
    })),
  });

  if (input.checkoutIntentTokenHash) {
    await transaction.$executeRaw(
      Prisma.sql`
        SELECT public.edebou_convert_checkout_intent(
          ${input.checkoutIntentTokenHash},
          ${order.id}::uuid
        )
      `,
    );
  }

  return {
    orderNumber: order.orderNumber,
    subtotal: order.subtotal,
    deliveryFee: order.deliveryFee,
    total: order.total,
    replayed: false,
  };
}

async function consumeRateLimitWindow(
  clientKeyHash: string,
  maxAttempts: number,
): Promise<RateLimitRecord> {
  const rows = await getCheckoutPrismaClient().$queryRaw<RateLimitRow[]>(
    Prisma.sql`
      INSERT INTO "checkout_rate_limits" (
        "key_hash", "window_started_at", "request_count", "updated_at"
      )
      VALUES (${clientKeyHash}, clock_timestamp(), 1, clock_timestamp())
      ON CONFLICT ("key_hash") DO UPDATE
      SET
        "request_count" = CASE
          WHEN "checkout_rate_limits"."window_started_at" <=
            clock_timestamp() - make_interval(secs => ${RATE_LIMIT_WINDOW_SECONDS})
          THEN 1
          ELSE LEAST("checkout_rate_limits"."request_count" + 1, 1000000)
        END,
        "window_started_at" = CASE
          WHEN "checkout_rate_limits"."window_started_at" <=
            clock_timestamp() - make_interval(secs => ${RATE_LIMIT_WINDOW_SECONDS})
          THEN clock_timestamp()
          ELSE "checkout_rate_limits"."window_started_at"
        END,
        "updated_at" = clock_timestamp()
      RETURNING
        "request_count" AS "requestCount",
        GREATEST(
          1,
          CEIL(EXTRACT(EPOCH FROM (
            "window_started_at" + make_interval(secs => ${RATE_LIMIT_WINDOW_SECONDS}) -
            clock_timestamp()
          )))::integer
        ) AS "retryAfterSeconds"
    `,
  );

  const result = rows[0];
  if (!result) {
    throw new CheckoutServiceUnavailableError();
  }

  return {
    allowed: result.requestCount <= maxAttempts,
    retryAfterSeconds: result.retryAfterSeconds,
  };
}

class PrismaCheckoutRepository
  implements CheckoutRepository, CheckoutIntentRepository
{
  async getSettings(): Promise<CheckoutSettingsRecord> {
    const settings = await getCheckoutPrismaClient().storeSettings.findUnique({
      where: { id: 1 },
      select: { deliveryFee: true, contactPhone: true },
    });

    if (!settings) {
      throw new CheckoutServiceUnavailableError();
    }

    return settings;
  }

  consumeRateLimit(clientKeyHash: string): Promise<RateLimitRecord> {
    return consumeRateLimitWindow(clientKeyHash, ORDER_RATE_LIMIT_MAX_ATTEMPTS);
  }

  consumeIntentRateLimit(clientKeyHash: string): Promise<RateLimitRecord> {
    return consumeRateLimitWindow(clientKeyHash, INTENT_RATE_LIMIT_MAX_ATTEMPTS);
  }

  async upsertCheckoutIntent(
    input: UpsertCheckoutIntentPersistenceInput,
  ): Promise<void> {
    const itemsJson = JSON.stringify(input.intent.items);
    await getCheckoutPrismaClient().$executeRaw(
      Prisma.sql`
        SELECT public.edebou_upsert_checkout_intent(
          ${input.tokenHash},
          ${input.intent.customer.fullName ?? null},
          ${input.intent.customer.phone},
          ${input.intent.customer.governorate ?? null},
          ${input.intent.customer.address ?? null},
          ${input.intent.locale},
          ${input.intent.source},
          ${itemsJson}::jsonb,
          ${input.expiresAt}
        )
      `,
    );
  }

  async createOrder(
    input: CreateOrderPersistenceInput,
  ): Promise<OrderConfirmationRecord> {
    const existing = await resolveExistingOrder(
      input.idempotencyKeyHash,
      input.requestHash,
    );
    if (existing) {
      return existing;
    }

    const prisma = getCheckoutPrismaClient();

    for (let attempt = 1; attempt <= MAX_TRANSACTION_ATTEMPTS; attempt += 1) {
      try {
        return await prisma.$transaction(
          (transaction) => createOrderTransaction(transaction, input),
          {
            isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
            maxWait: 2_000,
            timeout: 5_000,
          },
        );
      } catch (error) {
        if (error instanceof IdempotencyConflictError) {
          throw error;
        }

        if (error instanceof IdempotencyRaceLostError) {
          const replay = await resolveExistingOrder(
            input.idempotencyKeyHash,
            input.requestHash,
          );
          if (replay) {
            return replay;
          }
          // No committed twin: it was an order-number clash, so try again with a new number.
          if (attempt < MAX_TRANSACTION_ATTEMPTS) continue;

          throw new CheckoutServiceUnavailableError();
        }

        if (
          isSerializableTransactionConflict(error) &&
          attempt < MAX_TRANSACTION_ATTEMPTS
        ) {
          await new Promise((resolve) => setTimeout(resolve, attempt * 25));
          continue;
        }

        throw error;
      }
    }

    throw new CheckoutServiceUnavailableError();
  }
}

export const prismaCheckoutRepository: CheckoutRepository & CheckoutIntentRepository =
  new PrismaCheckoutRepository();
