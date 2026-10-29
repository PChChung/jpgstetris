// 上線前執行：node tools/stamp-version.mjs
// 在所有 HTML 引用的 css/js、以及 JS 之間的 import 後面加上 ?v=版本，
// 讓手機不會拿到「新頁面＋舊快取檔案」的混合版本（GitHub Pages 會快取 10 分鐘）
import { readdirSync, readFileSync, writeFileSync, statSync } from 'node:fs';
import { join, extname } from 'node:path';

const root = new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const now = new Date();
const pad = (n) => String(n).padStart(2, '0');
const version = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}${pad(now.getHours())}${pad(now.getMinutes())}`;

function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    if (name.startsWith('.') || name === 'node_modules' || name === 'tools') return [];
    const full = join(dir, name);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });
}

// 只處理相對路徑（不動 CDN 網址）
const isLocal = (url) => !/^(https?:)?\/\//.test(url);
const stamp = (url) => `${url.replace(/\?v=[^"'`]*$/, '')}?v=${version}`;

let changed = 0;
for (const file of walk(root)) {
  const ext = extname(file);
  if (ext !== '.html' && ext !== '.js') continue;
  const before = readFileSync(file, 'utf8');
  let after = before;
  if (ext === '.html') {
    after = after.replace(/(href|src)="([^"]+\.(?:css|js)(?:\?v=[^"]*)?)"/g, (m, attr, url) => (isLocal(url) ? `${attr}="${stamp(url)}"` : m));
  }
  after = after.replace(/((?:from|import)\s*\(?\s*)(['"])(\.{1,2}\/[^'"]+\.js(?:\?v=[^'"]*)?)\2/g, (m, lead, q, url) => `${lead}${q}${stamp(url)}${q}`);
  if (after !== before) {
    writeFileSync(file, after);
    changed++;
  }
}
console.log(`version ${version}: updated ${changed} files`);
