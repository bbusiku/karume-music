import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
const root = path.resolve('dist/client');
const prefix = (process.env.NEXT_PUBLIC_BASE_PATH || '').replace(/\/$/, '');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
assert.ok(html.includes('카루메'), 'Missing player content');
let checked = 0;
for (const [, url] of html.matchAll(/(?:src|href)="([^"]+)"/g)) {
  if (/^(https?:|data:|#)/.test(url)) continue;
  let relative = url.split('?')[0];
  if (relative.startsWith('/')) {
    assert.ok(
      !prefix || relative.startsWith(prefix + '/'),
      `Resource misses Pages prefix: ${relative}`,
    );
    relative = relative.slice(prefix.length).replace(/^\//, '');
  }
  const file = path.resolve(root, relative);
  assert.ok(fs.existsSync(file), `Missing resource: ${url}`);
  checked++;
}
for (const file of [
  'index.html',
  'karume-reference.png',
  'setup.html',
  'collections.json',
  '.nojekyll',
])
  assert.ok(fs.existsSync(path.join(root, file)));
const catalog = JSON.parse(fs.readFileSync(path.join(root, 'collections.json'), 'utf8'));
assert.equal(catalog.version, 1);
for (const key of ['song', 'asmr', 'aegyo']) assert.ok(Array.isArray(catalog.collections[key].tracks));
console.log(
  `Static page and ${checked} asset references verified for ${prefix || '/'} deployment.`,
);
