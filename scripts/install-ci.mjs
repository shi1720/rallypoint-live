import { spawnSync } from "node:child_process";
import { accessSync, constants } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = fileURLToPath(new URL("../", import.meta.url));
const [major, minor] = process.versions.node.split(".").map(Number);
if (major < 24 || (major === 24 && minor < 12)) {
  throw new Error(
    "Rallypoint requires Node.js 24.12 or newer. Select that runtime before installing.",
  );
}
if (!process.env.npm_execpath) {
  throw new Error("Run this installer with npm run install:ci.");
}
if (
  !["SHARP_IGNORE_GLOBAL_LIBVIPS", "SHARP_FORCE_GLOBAL_LIBVIPS"].some(
    (name) => name in process.env,
  )
) {
  process.env.SHARP_IGNORE_GLOBAL_LIBVIPS = "1";
}
const result = spawnSync(
  process.execPath,
  [
    process.env.npm_execpath,
    "ci",
    "--include=dev",
    "--include=optional",
    "--no-audit",
    "--no-fund",
  ],
  {
    cwd: projectRoot,
    stdio: "inherit",
    env: process.env,
  },
);
if (result.error) throw result.error;
if (result.signal) process.kill(process.pid, result.signal);
if (result.status !== 0) process.exit(result.status ?? 1);
try {
  accessSync(
    path.join(
      projectRoot,
      "node_modules",
      ".bin",
      process.platform === "win32" ? "next.cmd" : "next",
    ),
    process.platform === "win32" ? constants.F_OK : constants.X_OK,
  );
} catch {
  throw new Error(
    "Installation finished, but the Next.js executable is missing. Run npm ci again and inspect its output.",
  );
}
