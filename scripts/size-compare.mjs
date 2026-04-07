import { readFileSync } from 'node:fs';

const [, , basePath, headPath] = process.argv;

if (!basePath || !headPath) {
  console.error('Usage: node scripts/size-compare.mjs <base-report.json> <head-report.json>');
  process.exit(1);
}

const base = readJson(basePath);
const head = readJson(headPath);
const baseByFile = new Map(base.map(row => [row.label ?? row.file, row]));

console.log('| Entry | Files | Raw | Gzip | Brotli | Raw delta | Gzip delta | Brotli delta |');
console.log('| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |');

for (const row of head) {
  const label = row.label ?? row.file;
  const old = baseByFile.get(label);
  console.log(
    [
      `| ${label}`,
      row.files?.length ?? 1,
      formatBytes(row.bytes),
      formatBytes(row.gzipBytes),
      formatBytes(row.brotliBytes),
      formatDelta(old ? row.bytes - old.bytes : row.bytes),
      formatDelta(old ? row.gzipBytes - old.gzipBytes : row.gzipBytes),
      `${formatDelta(old ? row.brotliBytes - old.brotliBytes : row.brotliBytes)} |`,
    ].join(' | '),
  );
}

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  return `${(bytes / 1024).toFixed(2)} kB`;
}

function formatDelta(bytes) {
  const sign = bytes > 0 ? '+' : '';
  return `${sign}${formatBytes(bytes)}`;
}
