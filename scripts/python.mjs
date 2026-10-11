import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
const script = process.argv[2];
if (!["pack.py", "verify_package.py"].includes(script))
  throw new Error("Unknown package script");
const command =
  process.env.PYTHON || (process.platform === "win32" ? "python" : "python3");
const result = spawnSync(
  command,
  [fileURLToPath(new URL(script, import.meta.url))],
  { stdio: "inherit" },
);
if (result.error) console.error(result.error.message);
process.exit(result.status ?? 1);
