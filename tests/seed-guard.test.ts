import assert from "node:assert/strict";
import test from "node:test";

import { getSeedDatabaseUrl } from "../prisma/seed-guard";

const localEnvironment: NodeJS.ProcessEnv = {
  NODE_ENV: "test",
  ALLOW_DEMO_SEED: "true",
  SEED_DATABASE_URL:
    "postgresql://seed_user:local_test_password@localhost:5432/edebou_test",
};

test("demo seed accepts only explicit development/test localhost URLs", () => {
  assert.equal(
    getSeedDatabaseUrl(localEnvironment),
    localEnvironment.SEED_DATABASE_URL,
  );
  assert.doesNotThrow(() =>
    getSeedDatabaseUrl({
      ...localEnvironment,
      SEED_DATABASE_URL:
        "postgresql://seed_user:local_test_password@[::1]:5432/edebou_test",
    }),
  );

  const rejectedEnvironments = [
    { ...localEnvironment, NODE_ENV: "production" },
    { ...localEnvironment, ALLOW_DEMO_SEED: "false" },
    {
      ...localEnvironment,
      SEED_DATABASE_URL:
        "postgresql://seed_user:local_test_password@database.example/edebou",
    },
  ] satisfies NodeJS.ProcessEnv[];

  for (const environment of rejectedEnvironments) {
    assert.throws(() => getSeedDatabaseUrl(environment));
  }
});

test("demo seed rejects query parameters that could override the local host", () => {
  for (const suffix of [
    "?host=database.example",
    "?hostaddr=203.0.113.10",
    "?application_name=seed",
  ]) {
    assert.throws(() =>
      getSeedDatabaseUrl({
        ...localEnvironment,
        SEED_DATABASE_URL: `${localEnvironment.SEED_DATABASE_URL}${suffix}`,
      }),
    );
  }
});
