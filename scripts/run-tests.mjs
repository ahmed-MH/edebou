// npm runs scripts through cmd.exe on Windows, which does not expand globs, and
// Node 20 has no glob support in --test, so list the test files here instead.
import { spawnSync } from "node:child_process";
import { readdirSync } from "node:fs";

const files = readdirSync("tests")
  .filter((name) => /\.test\.(mjs|ts)$/u.test(name))
  .sort()
  .map((name) => `tests/${name}`);

const { status } = spawnSync(
  process.execPath,
  ["--conditions=react-server", "--import", "tsx", "--test", ...files],
  { stdio: "inherit" },
);
process.exit(status ?? 1);
