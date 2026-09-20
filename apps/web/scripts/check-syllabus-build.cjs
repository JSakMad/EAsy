// Run after next build. Unit tests do not exercise Turbopack's module rewriting.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createRequire } = require('node:module');

globalThis.AsyncLocalStorage = require('node:async_hooks').AsyncLocalStorage;

async function main() {
  const standalone = path.resolve(__dirname, '../.next/standalone');
  const server = path.join(standalone, 'apps/web/.next/server');
  const route = 'app/offerings/[id]/page';
  const manifest = JSON.parse(fs.readFileSync(path.join(server, 'server-reference-manifest.json'), 'utf8'));
  const action = Object.values(manifest.node).find(value => value.exportedName === 'uploadSyllabus');
  assert.ok(action, 'The upload action must exist in the production manifest');

  // Load the same chunks and action module used by an actual production POST.
  const runtime = require(path.join(server, 'chunks/ssr/[turbopack]_runtime.js'))(`server/${route}.js`);
  const page = fs.readFileSync(path.join(server, `${route}.js`), 'utf8');
  const chunks = [...page.matchAll(/R\.c\("([^"]+)"\)/g)];
  assert.ok(chunks.length, 'Expected Turbopack route chunks');
  for (const [, chunk] of chunks) runtime.c(chunk);
  const exports = await runtime.m(action.workers[route].moduleId).exports;
  assert.ok(Object.values(exports).some(value => typeof value === 'function'));

  const productionRequire = createRequire(path.join(server, `${route}.js`));
  const assets = path.dirname(productionRequire.resolve('pdfjs-dist/package.json'));
  assert.ok(assets.startsWith(standalone + path.sep), 'Assets must resolve inside the standalone deployment');
  assert.ok(fs.readFileSync(path.join(assets, 'standard_fonts/LiberationSans-Regular.ttf')).length > 0);
  assert.ok(fs.readFileSync(path.join(assets, 'cmaps/Adobe-Japan1-UCS2.bcmap')).length > 0);
  console.log('Production syllabus action loads successfully; PDF assets resolve inside the deployment.');
}

main().catch(error => { console.error(error); process.exitCode = 1; });
