import { spawn, execFileSync } from "node:child_process";
import { watch } from "node:fs";
import { join } from "node:path";
const root = join(import.meta.dirname, "..");
const runBuild = () =>
  execFileSync(process.execPath, [join(root, "scripts/build.mjs")], {
    stdio: "inherit",
    cwd: root,
  });
runBuild();
const server = spawn(process.execPath, [join(root, "scripts/serve.mjs")], {
  stdio: "inherit",
  cwd: root,
  windowsHide: true,
});
let timer;
for (const path of ["src", "public", "komari-theme.json", "index.html"])
  watch(
    join(root, path),
    { recursive: path === "src" || path === "public" },
    () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        try {
          runBuild();
          console.log("Rebuilt. Reload browser to view changes.");
        } catch {
          console.error("Build failed; fix the source and save again.");
        }
      }, 200);
    },
  );
process.on("SIGINT", () => {
  server.kill();
  process.exit();
});
process.on("SIGTERM", () => {
  server.kill();
  process.exit();
});
server.on("exit", (code) => process.exit(code ?? 1));
