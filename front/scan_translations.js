const fs = require('fs');
const path = require('path');
const content = fs.readFileSync('src/lib/translations.ts', 'utf8');
const fn = new Function(content.replace('export const translations =', 'return'));
const tr = fn();

function getNested(obj, key) {
  const parts = key.split('.');
  let curr = obj;
  for (const p of parts) {
    if (curr && typeof curr === 'object' && curr[p] !== undefined) curr = curr[p];
    else return undefined;
  }
  return curr;
}

function scanDir(dir) {
  let files = [];
  for (const item of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, item.name);
    if (item.isDirectory()) {
      if (item.name !== 'node_modules' && item.name !== 'dist') files = files.concat(scanDir(full));
    } else if (item.name.endsWith('.tsx') || item.name.endsWith('.ts')) {
      files.push(full);
    }
  }
  return files;
}

const allFiles = scanDir('src');
const regex = /t\(\s*['"]([a-zA-Z0-9_.]+)['"]/g;
const missingInUz = new Map();
const missingInRu = new Map();
const missingInEn = new Map();

for (const file of allFiles) {
  if (file.includes('translations.ts')) continue;
  const txt = fs.readFileSync(file, 'utf8');
  let match;
  while ((match = regex.exec(txt)) !== null) {
    const k = match[1];
    if (getNested(tr.uz, k) === undefined) {
      if (!missingInUz.has(k)) missingInUz.set(k, []);
      missingInUz.get(k).push(path.relative('src', file));
    }
    if (getNested(tr.ru, k) === undefined) {
      if (!missingInRu.has(k)) missingInRu.set(k, []);
      missingInRu.get(k).push(path.relative('src', file));
    }
    if (getNested(tr.en, k) === undefined) {
      if (!missingInEn.has(k)) missingInEn.set(k, []);
      missingInEn.get(k).push(path.relative('src', file));
    }
  }
}

console.log('=== MISSING KEYS IN UZ (' + missingInUz.size + ') ===');
for (const [k, files] of missingInUz.entries()) {
  console.log(k, '->', files.join(', '));
}

console.log('\n=== MISSING KEYS IN RU (' + missingInRu.size + ') ===');
for (const [k, files] of missingInRu.entries()) {
  console.log(k, '->', files.join(', '));
}

console.log('\n=== MISSING KEYS IN EN (' + missingInEn.size + ') ===');
for (const [k, files] of missingInEn.entries()) {
  console.log(k, '->', files.join(', '));
}
