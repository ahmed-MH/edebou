import "server-only";

import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "@/generated/prisma/client";

interface CheckoutPrismaGlobalState {
  __edebouCheckoutPrismaClient?: PrismaClient;
}

const checkoutPrismaGlobal = globalThis as typeof globalThis &
  CheckoutPrismaGlobalState;

function createCheckoutPrismaClient(): PrismaClient {
  const connectionString = process.env.CHECKOUT_DATABASE_URL;

  if (!connectionString) {
    throw new Error("Checkout database configuration is unavailable.");
  }

  const adapter = new PrismaPg({
    connectionString,
    max: 10,
    connectionTimeoutMillis: 3_000,
    idleTimeoutMillis: 10_000,
    statement_timeout: 5_000,
    application_name: "edebou-checkout",
  });

  return new PrismaClient({ adapter });
}

export function getCheckoutPrismaClient(): PrismaClient {
  checkoutPrismaGlobal.__edebouCheckoutPrismaClient ??=
    createCheckoutPrismaClient();
  return checkoutPrismaGlobal.__edebouCheckoutPrismaClient;
}

/** Intended for finite verification scripts and graceful shutdown only. */
export async function disconnectCheckoutPrismaClient(): Promise<void> {
  const client = checkoutPrismaGlobal.__edebouCheckoutPrismaClient;

  if (!client) {
    return;
  }

  try {
    await client.$disconnect();
  } finally {
    delete checkoutPrismaGlobal.__edebouCheckoutPrismaClient;
  }
}
