import assert from "node:assert/strict";
import test from "node:test";

import { getCheckoutDatabaseTestUrls } from "../scripts/checkout-database-test-guard";

const localEnvironment: NodeJS.ProcessEnv = {
  NODE_ENV: "test",
  ALLOW_CHECKOUT_DB_TEST: "true",
  MIGRATION_DATABASE_URL:
    "postgresql://migration:local-password@localhost:5432/edebou_test",
  CHECKOUT_DATABASE_URL:
    "postgresql://checkout:local-password@localhost:5432/edebou_test",
};

test("checkout DB verification requires explicit local/test consent", () => {
  assert.deepEqual(getCheckoutDatabaseTestUrls(localEnvironment), {
    migrationUrl: localEnvironment.MIGRATION_DATABASE_URL,
    checkoutUrl: localEnvironment.CHECKOUT_DATABASE_URL,
  });

  for (const environment of [
    { ...localEnvironment, NODE_ENV: "production" },
    { ...localEnvironment, ALLOW_CHECKOUT_DB_TEST: "false" },
    {
      ...localEnvironment,
      MIGRATION_DATABASE_URL:
        "postgresql://migration:password@database.example/edebou_test",
    },
    {
      ...localEnvironment,
      CHECKOUT_DATABASE_URL:
        "postgresql://checkout:password@localhost:5432/another_database",
    },
    {
      ...localEnvironment,
      CHECKOUT_DATABASE_URL:
        "postgresql://migration:password@localhost:5432/edebou_test",
    },
  ] satisfies NodeJS.ProcessEnv[]) {
    assert.throws(() => getCheckoutDatabaseTestUrls(environment));
  }
});

test("checkout DB verification rejects every URL query override", () => {
  for (const suffix of [
    "?host=database.example",
    "?hostaddr=203.0.113.10",
    "?application_name=test",
  ]) {
    assert.throws(() =>
      getCheckoutDatabaseTestUrls({
        ...localEnvironment,
        CHECKOUT_DATABASE_URL: `${localEnvironment.CHECKOUT_DATABASE_URL}${suffix}`,
      }),
    );
  }
});
