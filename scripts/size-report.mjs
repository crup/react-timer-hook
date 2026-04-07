import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, normalize } from 'node:path';
import { brotliCompressSync, gzipSync } from 'node:zlib';

const json = process.argv.includes('--json');
const entries = [
  ['core', 'dist/index.js'],
  ['full', 'dist/full.js'],
  ['timer group add-on', 'dist/group.js'],
  ['schedules add-on', 'dist/schedules.js'],
  ['duration helper', 'dist/duration.js'],
  ['diagnostics helper', 'dist/diagnostics.js'],
  ['core CJS', 'dist/index.cjs'],
  ['full CJS', 'dist/full.cjs'],
  ['timer group CJS', 'dist/group.cjs'],
  ['schedules CJS', 'dist/schedules.cjs'],
  ['duration CJS', 'dist/duration.cjs'],
  ['diagnostics CJS', 'dist/diagnostics.cjs'],
];

const rows = entries
  .filter(([, file]) => existsSync(file))
  .map(([label, file]) => {
    const files = collectFiles(file);
    const buffer = Buffer.concat(files.map(entryFile => readFileSync(entryFile)));
    return {
      label,
      file,
      files,
      bytes: buffer.length,
      gzipBytes: gzipSync(buffer).length,
      brotliBytes: brotliCompressSync(buffer).length,
    };
  });

if (json) {
  console.log(JSON.stringify(rows, null, 2));
} else {
  console.log('| Entry | Files | Raw | Gzip | Brotli |');
  console.log('| --- | ---: | ---: | ---: | ---: |');
  for (const row of rows) {
    console.log(`| ${row.label} | ${row.files.length} | ${formatBytes(row.bytes)} | ${formatBytes(row.gzipBytes)} | ${formatBytes(row.brotliBytes)} |`);
  }
}

function collectFiles(file, seen = new Set()) {
  const normalized = normalize(file);
  if (seen.has(normalized) || !existsSync(normalized)) return [];
  seen.add(normalized);

  const source = readFileSync(normalized, 'utf8');
  const imports = [...source.matchAll(/from\s*["'](\.\/[^"']+)["']/g)].map(match => match[1]);
  const dependencies = imports.flatMap(specifier => collectFiles(join(dirname(normalized), specifier), seen));
  return [normalized, ...dependencies];
}

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  return `${(bytes / 1024).toFixed(2)} kB`;
}
