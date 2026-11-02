import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";

const read = relative => readFile(new URL(relative, import.meta.url), "utf8");
const [template, css, app, model, mark] = await Promise.all([
  read("../dist/index.html"), read("../dist/style.css"), read("../dist/app.js"),
  read("../dist/launch-demo.mjs"), read("../dist/assets/mark.svg"),
]);
const loader = 'const loadDemoModule = () => import("./launch-demo.mjs");';
assert.equal(app.split(loader).length, 2, "The offline bundle must replace exactly one module loader");
const bundledModel = model.replace(/^export /gm, "");
const exports = [...model.matchAll(/^export (?:function|const) (\w+)/gm)].map(match => match[1]);
assert.ok(exports.includes("createLaunchDemo"));
const script = app.replace(loader, `const loadDemoModule = () => {\n${bundledModel}\nreturn { ${exports.join(", ")} };\n};`);
assert.ok(!/<\/script/i.test(script));
assert.ok(!/<\/style/i.test(css));
const hash = value => createHash("sha256").update(value).digest("base64");
const policy = `default-src 'none'; script-src 'sha256-${hash(script)}'; style-src 'sha256-${hash(css)}'; img-src data:; connect-src 'none'; base-uri 'none'; form-action 'none'`;
const icon = `data:image/svg+xml;base64,${Buffer.from(mark).toString("base64")}`;
const result = template
  .replace(/(<meta http-equiv="Content-Security-Policy" content=")[^"]+/, `$1${policy}`)
  .replace('<link rel="stylesheet" href="style.css">', `<style>${css}</style>`)
  .replace('  <script src="app.js" defer></script>\n', "")
  .replaceAll('"assets/mark.svg"', `"${icon}"`)
  .replace("</body>", `<script>${script}</script>\n</body>`);
assert.ok(!result.includes('src="app.js"'));
assert.ok(!result.includes('import("./launch-demo.mjs")'));
await writeFile(new URL("../FB-Autoload.html", import.meta.url), result);
console.log("Built FB-Autoload.html: self-contained offline preview with hash-based CSP");
