import "server-only";

import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "@/generated/prisma/client";

interface PrismaGlobalState {
  __edebouPrismaClient?: PrismaClient;
}

const prismaGlobal = globalThis as typeof globalThis & PrismaGlobalState;

function createPrismaClient(): PrismaClient {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error("Database configuration is unavailable.");
  }

  const adapter = new PrismaPg({
    connectionString,
    max: 10,
    connectionTimeoutMillis: 5_000,
    idleTimeoutMillis: 10_000,
    statement_timeout: 5_000,
    application_name: "edebou-web",
  });

  // Prisma and the pg pool are both created lazily. Importing this module during
  // `next build` neither requires DATABASE_URL nor opens a database connection.
  return new PrismaClient({ adapter });
}

export function getPrismaClient(): PrismaClient {
  prismaGlobal.__edebouPrismaClient ??= createPrismaClient();
  return prismaGlobal.__edebouPrismaClient;
}

/** Intended for finite scripts and graceful process shutdown, never per request. */
export async function disconnectPrismaClient(): Promise<void> {
  const client = prismaGlobal.__edebouPrismaClient;

  if (!client) {
    return;
  }

  try {
    await client.$disconnect();
  } finally {
    delete prismaGlobal.__edebouPrismaClient;
  }
}
