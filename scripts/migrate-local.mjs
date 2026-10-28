import {
  readFileSync,
  writeFileSync,
  mkdirSync,
  readdirSync,
  existsSync,
} from "node:fs";
import { execFileSync } from "node:child_process";
import path from "node:path";
if (!existsSync("dist/server/wrangler.json"))
  throw new Error("Run npm run build first.");
mkdirSync("work", { recursive: true });
const persist = process.env.RALLY_LOCAL_STATE_DIR || ".wrangler/state";
if (!path.resolve(persist).startsWith(process.cwd() + path.sep))
  throw new Error("Local state must stay inside the checkout.");
const cfg = JSON.parse(readFileSync("dist/server/wrangler.json", "utf8"));
const migrationConfig = {
  name: "rallypoint-local-migrations",
  compatibility_date: cfg.compatibility_date,
  d1_databases: cfg.d1_databases.map((d) => ({
    ...d,
    migrations_dir: path.resolve("drizzle"),
  })),
};
writeFileSync("work/local-migrations.json", JSON.stringify(migrationConfig));
execFileSync(
  process.execPath,
  [
    "--import",
    "./scripts/sites-env.mjs",
    "./node_modules/wrangler/bin/wrangler.js",
    "d1",
    "migrations",
    "apply",
    "DB",
    "--local",
    "--config",
    "work/local-migrations.json",
    "--persist-to",
    persist,
  ],
  { stdio: ["pipe", "inherit", "inherit"], input: "y\n" },
);
