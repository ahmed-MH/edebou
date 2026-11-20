import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const projectRoot = fileURLToPath(new URL("../", import.meta.url));

async function readProjectFile(path) {
  return readFile(join(projectRoot, path), "utf8");
}

function collectLeafKeys(value, prefix = "") {
  return Object.entries(value).flatMap(([key, child]) => {
    const nextKey = prefix ? `${prefix}.${key}` : key;
    return typeof child === "string"
      ? [nextKey]
      : collectLeafKeys(child, nextKey);
  });
}

async function collectFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = await Promise.all(
    entries.map((entry) => {
      const path = join(directory, entry.name);
      return entry.isDirectory() ? collectFiles(path) : [path];
    }),
  );
  return files.flat();
}

test("Arabic and French catalogs expose identical non-empty message keys", async () => {
  const [arabic, french] = await Promise.all([
    readProjectFile("messages/ar.json").then(JSON.parse),
    readProjectFile("messages/fr.json").then(JSON.parse),
  ]);

  assert.deepEqual(collectLeafKeys(arabic), collectLeafKeys(french));

  for (const catalog of [arabic, french]) {
    for (const key of collectLeafKeys(catalog)) {
      const value = key.split(".").reduce((node, part) => node[part], catalog);
      assert.equal(typeof value, "string");
      assert.notEqual(value.trim(), "");
    }
  }
});

test("the admin surface is authenticated and localized catch-all still rejects unknown paths", async () => {
  const appDirectory = join(projectRoot, "src/app");
  const appFiles = await collectFiles(appDirectory);
  const normalized = appFiles.map((file) => file.replaceAll("\\", "/"));

  assert.equal(normalized.some((file) => file.includes("/admin/login/page.tsx")), true);

  const protectedLayout = await readProjectFile(
    "src/app/admin/(protected)/layout.tsx",
  );
  assert.match(protectedLayout, /requireAdminSession\(\)/);
  const adminSession = await readProjectFile("src/lib/admin/session.ts");
  assert.match(adminSession, /redirect\("\/admin\/login"\)/);

  const catchAll = await readProjectFile(
    "src/app/[locale]/[...rest]/page.tsx",
  );
  assert.match(catchAll, /notFound\(\)/);
  assert.doesNotMatch(catchAll, /components\/admin/);
});

test("default-locale routes use shared UI and remain canonically unprefixed", async () => {
  const [rootPage, localePage, proxy] = await Promise.all([
    readProjectFile("src/app/page.tsx"),
    readProjectFile("src/app/[locale]/page.tsx"),
    readProjectFile("src/proxy.ts"),
  ]);

  assert.match(rootPage, /StorefrontHome locale="ar"/);
  assert.match(localePage, /<StorefrontHome locale=\{locale\}/);
  assert.match(localePage, /redirect\("\/"\)/);
  assert.match(proxy, /pathname\.slice\(3\) \|\| "\/"/);
  assert.doesNotMatch(proxy, /NextResponse\.rewrite/);
});

test("the production home page renders only live catalog products", async () => {
  const [rootPage, localePage, productGrid] = await Promise.all([
    readProjectFile("src/app/page.tsx"),
    readProjectFile("src/app/[locale]/page.tsx"),
    readProjectFile("src/components/storefront/product-grid.tsx"),
  ]);

  assert.match(rootPage, /export const dynamic = "force-dynamic"/);
  assert.match(localePage, /export const dynamic = "force-dynamic"/);
  assert.match(productGrid, /catalogService\.listProducts/);
  assert.doesNotMatch(productGrid, /demoProducts|@\/data\/demo\/products/);
});

test("application source avoids unsafe HTML and dynamic code execution", async () => {
  const sourceFiles = (await collectFiles(join(projectRoot, "src"))).filter(
    (file) => /\.(?:ts|tsx)$/.test(file),
  );
  const source = (
    await Promise.all(sourceFiles.map((file) => readFile(file, "utf8")))
  ).join("\n");

  assert.doesNotMatch(source, /dangerouslySetInnerHTML/);
  assert.doesNotMatch(source, /\beval\s*\(/);
  assert.doesNotMatch(source, /new\s+Function\s*\(/);
});

test("demo SVG assets contain no active or external content", async () => {
  const svgFiles = await collectFiles(join(projectRoot, "public/demo"));
  assert.equal(svgFiles.length, 5);

  for (const file of svgFiles) {
    const svg = await readFile(file, "utf8");
    assert.match(svg, /<svg\b/);
    assert.doesNotMatch(
      svg,
      /<script\b|<foreignObject\b|\bon[a-z]+\s*=|(?:href|src)\s*=\s*["']https?:\/\//i,
    );
  }
});

test("runtime and database environment templates keep privileged secrets separated", async () => {
  const gitignore = await readProjectFile(".gitignore");
  assert.match(gitignore, /^\.env\*$/m);
  assert.match(gitignore, /^!\.env\.example$/m);
  assert.match(gitignore, /^!\.env\.database\.example$/m);
  assert.match(gitignore, /^\/backups\/$/m);
  assert.match(gitignore, /^\/storage\/$/m);

  const parseEnvironment = (source) =>
    Object.fromEntries(
      source
      .split("\n")
      .filter((line) => /^[A-Z][A-Z0-9_]*=/.test(line))
      .map((line) => {
        const separator = line.indexOf("=");
        return [line.slice(0, separator), line.slice(separator + 1)];
      }),
    );
  const [runtimeExample, databaseExample] = await Promise.all([
    readProjectFile(".env.example"),
    readProjectFile(".env.database.example"),
  ]);
  const runtimeEnvironment = parseEnvironment(runtimeExample);
  const databaseEnvironment = parseEnvironment(databaseExample);

  assert.deepEqual(Object.keys(runtimeEnvironment), [
    "DATABASE_URL",
    "CHECKOUT_DATABASE_URL",
    "ADMIN_DATABASE_URL",
    "PUBLIC_APP_ORIGIN",
    "ADMIN_APP_ORIGIN",
    "CHECKOUT_ALLOWED_ORIGINS",
    "CHECKOUT_IDEMPOTENCY_PEPPER",
    "CHECKOUT_IP_HASH_PEPPER",
    "CHECKOUT_TRUSTED_PROXY_HOPS",
    "ADMIN_SESSION_HASH_PEPPER",
    "ADMIN_IP_HASH_PEPPER",
    "ADMIN_TRUSTED_PROXY_HOPS",
    "ADMIN_SESSION_TTL_HOURS",
    "PRODUCT_UPLOAD_DIR",
  ]);
  assert.equal(runtimeEnvironment.DATABASE_URL, "");
  assert.equal(runtimeEnvironment.CHECKOUT_DATABASE_URL, "");
  assert.equal(runtimeEnvironment.ADMIN_DATABASE_URL, "");
  assert.equal(runtimeEnvironment.CHECKOUT_IDEMPOTENCY_PEPPER, "");
  assert.equal(runtimeEnvironment.CHECKOUT_IP_HASH_PEPPER, "");

  for (const secretName of [
    "POSTGRES_BOOTSTRAP_PASSWORD",
    "POSTGRES_MIGRATION_PASSWORD",
    "POSTGRES_APP_PASSWORD",
    "POSTGRES_CHECKOUT_PASSWORD",
    "POSTGRES_ADMIN_PASSWORD",
    "DATABASE_URL",
    "CHECKOUT_DATABASE_URL",
    "ADMIN_DATABASE_URL",
    "MIGRATION_DATABASE_URL",
    "SHADOW_DATABASE_URL",
    "SEED_DATABASE_URL",
  ]) {
    assert.equal(
      databaseEnvironment[secretName],
      "",
      `${secretName} must stay blank`,
    );
  }
  assert.equal(databaseEnvironment.ALLOW_DEMO_SEED, "false");
  assert.equal(databaseEnvironment.ALLOW_CHECKOUT_DB_TEST, "false");
  assert.doesNotMatch(runtimeExample + databaseExample, /NEXT_PUBLIC_/);
  assert.doesNotMatch(
    runtimeExample,
    /MIGRATION|SHADOW|SEED|BOOTSTRAP|POSTGRES_/,
  );
});
