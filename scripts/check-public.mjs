import assert from "node:assert/strict";
import { readdir, readFile, lstat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const allowed = new Set([
  ".gitignore", "README.md", "PUBLISHING.md", "package.json", "docs/engineering.md", "FB-Autoload.html",
  "dist/index.html", "dist/style.css", "dist/app.js", "dist/recovery.mjs", "dist/launch-demo.mjs",
  "dist/assets/cover.svg", "dist/assets/mark.svg", "scripts/preview.mjs",
  "scripts/check-public.mjs", "scripts/build-preview.mjs", "tests/recovery.test.mjs", "tests/launch-demo.test.mjs", ".github/workflows/pages.yml",
]);
const files = [];
async function collect(directory, prefix = "") {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (entry.name === ".git" && !prefix) continue;
    const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
    const absolute = path.join(directory, entry.name);
    assert.ok(!(await lstat(absolute)).isSymbolicLink(), `Symlink forbidden: ${relative}`);
    if (entry.isDirectory()) await collect(absolute, relative);
    else files.push(relative);
  }
}
await collect(root);
assert.deepEqual([...files].sort(), [...allowed].sort(), "Public package must match the reviewed allowlist exactly");
const patterns = [
  ["long numeric ID", /\b\d{11,}\b/],
  ["JWT-shaped credential", /eyJ[A-Za-z0-9_-]{12,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/],
  ["Meta-shaped credential", /\bEAA[A-Za-z0-9]{40,}/],
  ["private key", /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/],
  ["GitHub-shaped credential", /\b(?:gh[pousr]_[A-Za-z0-9]{24,}|github_pat_[A-Za-z0-9_]{30,})/],
  ["personal filesystem path", /\/(?:Users|home)\/[\w.-]+\//],
  ["embedded credentials", /:\/\/[^\s/@]+:[^\s/@]+@/],
  ["external IP address", /\b(?!127\.0\.0\.1\b)(?:\d{1,3}\.){3}\d{1,3}\b/],
];
for (const relative of files) {
  const source = await readFile(path.join(root, relative), "utf8");
  if (relative !== "scripts/check-public.mjs") {
    for (const [label, pattern] of patterns) assert.ok(!pattern.test(source), `${label}: ${relative}`);
  }
  const externalUrls = source.match(/https?:\/\/[^\s"'<>`)]+/g) || [];
  for (const url of externalUrls) {
    const presentationLink = ["README.md", "scripts/check-public.mjs"].includes(relative) && url === "https://23e23e.github.io/fb-autoload-showcase/";
    assert.ok(presentationLink || url.startsWith("http://127.0.0.1:") || url === "http://localhost" || url === "http://www.w3.org/2000/svg", `Unreviewed URL in ${relative}`);
  }
  if (relative.startsWith("dist/") || relative === "FB-Autoload.html") {
    assert.ok(!/\b(?:fetch|XMLHttpRequest|WebSocket|sendBeacon)\s*\(/.test(source), `Network transport forbidden in ${relative}`);
    assert.ok(!/\b(?:localStorage|sessionStorage|document\.cookie)\b/.test(source), `Storage forbidden in ${relative}`);
  }
}
const html = await readFile(path.join(root, "dist/index.html"), "utf8");
assert.ok(html.includes("connect-src 'none'"));
assert.ok(html.includes("демонстрационные"));
for (const match of html.matchAll(/(?:src|href)="([^"#]+)"/g)) {
  assert.ok(allowed.has(`dist/${match[1]}`), `Broken or external asset: ${match[1]}`);
}
console.log(`PASS public package: ${files.length} explicitly allowed files, no matched secrets/operational IDs, no external page connections`);
const workflow = await readFile(path.join(root, ".github/workflows/pages.yml"), "utf8");
assert.ok(workflow.includes("- run: npm test"));
assert.ok(workflow.includes("- run: git diff --exit-code"));
assert.ok(workflow.includes("path: dist"));
assert.ok(!workflow.includes("pull_request_target"));
assert.ok(!workflow.includes("secrets."));
assert.ok(workflow.indexOf("pages: write") > workflow.indexOf("needs: verify"));
console.log("Pattern checks are not a guarantee. Review the final staged files and images manually before publication.");
