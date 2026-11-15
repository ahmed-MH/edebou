import { config as loadEnvironment } from "dotenv";
import { defineConfig } from "prisma/config";

// Next.js must receive only DATABASE_URL at runtime. Infrastructure,
// migration, shadow and seed credentials live in a separate ignored file
// that Next does not auto-load.
loadEnvironment({
  path: process.env.DATABASE_ENV_FILE ?? ".env.database",
  override: false,
  quiet: true,
});

const migrationUrl = process.env.MIGRATION_DATABASE_URL;
const shadowDatabaseUrl = process.env.SHADOW_DATABASE_URL;

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  ...(migrationUrl
    ? {
        datasource: {
          url: migrationUrl,
          ...(shadowDatabaseUrl ? { shadowDatabaseUrl } : {}),
        },
      }
    : {}),
});
