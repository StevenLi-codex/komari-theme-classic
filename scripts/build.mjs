import { execFileSync } from "node:child_process";
import {
  mkdirSync,
  readFileSync,
  writeFileSync,
  rmSync,
  cpSync,
} from "node:fs";
import { join, relative } from "node:path";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";
const root = fileURLToPath(new URL("../", import.meta.url));
const dist = join(root, "dist");
if (relative(root, dist) !== "dist")
  throw new Error("Unexpected output directory");
const assets = join(dist, "assets");
const manifest = JSON.parse(readFileSync(join(root, "theme.json"), "utf8"));
const hash = (data) =>
  createHash("sha256").update(data).digest("hex").slice(0, 16);
execFileSync(
  process.execPath,
  [join(root, "node_modules/typescript/bin/tsc"), "--noEmit"],
  { cwd: root, stdio: "inherit" },
);
const result = await build({
  entryPoints: [join(root, "src/main.ts")],
  bundle: true,
  write: false,
  format: "esm",
  target: "es2022",
  minify: true,
  charset: "utf8",
});
const js = result.outputFiles[0].contents;
const css = readFileSync(join(root, "src/styles.css"));
const jsName = `main.${hash(js)}.js`;
const cssName = `styles.${hash(css)}.css`;
rmSync(dist, { recursive: true, force: true });
mkdirSync(assets, { recursive: true });
writeFileSync(join(assets, jsName), js);
writeFileSync(join(assets, cssName), css);
const index = readFileSync(join(root, "index.html"), "utf8")
  .replace("/assets/main.js", `/assets/${jsName}`)
  .replace("/assets/styles.css", `/assets/${cssName}`)
  .replaceAll("__THEME_VERSION__", manifest.version);
writeFileSync(join(dist, "index.html"), index);
cpSync(join(root, "public"), dist, { recursive: true });
const demo = await build({
  entryPoints: [join(root, "src/demo-entry.ts")],
  bundle: true,
  write: false,
  format: "esm",
  target: "es2022",
  minify: true,
  charset: "utf8",
  external: ["/assets/*"],
  define: { __MAIN_ASSET__: JSON.stringify(`/assets/${jsName}`) },
});
const demoName = `demo.${hash(demo.outputFiles[0].contents)}.js`;
writeFileSync(join(assets, demoName), demo.outputFiles[0].contents);
writeFileSync(
  join(dist, "demo.html"),
  index.replace(`/assets/${jsName}`, `/assets/${demoName}`),
);
console.log(`Built x86 Monitor ${manifest.version}: ${jsName}, ${cssName}`);
