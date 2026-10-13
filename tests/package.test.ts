import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
test("production bundle uses Komari RPC2 not Monitor push protocol", () => {
  const s = readFileSync("dist/index.html", "utf8");
  const asset = s.match(/\/assets\/(main\.[0-9a-f]{16}\.js)/)![1];
  const js = readFileSync("dist/assets/" + asset, "utf8");
  assert.match(js, /\/api\/rpc2/);
  assert.match(js, /common:getRecords/);
  assert.doesNotMatch(js, /\/api\/ws|series=metrics|series=ping/);
});
test("assets and attribution work on native theme subpath", () => {
  const s = readFileSync("dist/index.html", "utf8");
  assert.match(s, /\/themes\/komari-classic\/dist\/assets\//);
  const asset = s.match(/\/assets\/(main\.[0-9a-f]{16}\.js)/)![1];
  const js = readFileSync("dist/assets/" + asset, "utf8");
  assert.match(js, /ayingQAQ/);
  assert.match(js, /\/themes\/komari-classic\/dist\/flags\//);
});
test("Native ZIP packaging is reproducible, rooted correctly, and excludes demo", () => {
  const { execFileSync } = requireTools();
  execFileSync("python3", ["scripts/pack.py"]);
  const first = readFileSync("theme.zip");
  execFileSync("python3", ["scripts/pack.py"]);
  assert.deepEqual(readFileSync("theme.zip"), first);
  execFileSync("python3", ["scripts/verify_package.py"]);
});
function requireTools() {
  return tools;
}
import * as tools from "node:child_process";
test("Native Komari manifest declares managed config and upstream attribution", () => {
  assert.ok(existsSync("komari-theme.json"), "native manifest missing");
  const m = JSON.parse(readFileSync("komari-theme.json", "utf8"));
  assert.equal(m.short, "komari-classic");
  assert.equal(m.name, "Komari Classic");
  assert.equal(m.version, "1.0.0");
  assert.match(m.author, /ayingQAQ/);
  assert.equal(m.url, "https://github.com/StevenLi-codex/komari-theme-classic");
  assert.equal(m.configuration.type, "managed");
  assert.ok(
    m.configuration.data.some(
      (f: any) => f.key === "show_chart" && f.type === "switch",
    ),
  );
  assert.ok(
    !existsSync("theme.json"),
    "Monitor manifest must not remain active",
  );
});
