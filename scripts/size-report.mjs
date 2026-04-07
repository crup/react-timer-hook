import { existsSync, readFileSync } from 'node:fs';
import { brotliCompressSync, gzipSync } from 'node:zlib';

const json = process.argv.includes('--json');
const files = ['dist/index.js', 'dist/index.cjs', 'dist/index.d.ts'];

const rows = files
  .filter(file => existsSync(file))
  .map(file => {
    const buffer = readFileSync(file);
    return {
      file,
      bytes: buffer.length,
      gzipBytes: gzipSync(buffer).length,
      brotliBytes: brotliCompressSync(buffer).length,
    };
  });

if (json) {
  console.log(JSON.stringify(rows, null, 2));
} else {
  console.log('| File | Raw | Gzip | Brotli |');
  console.log('| --- | ---: | ---: | ---: |');
  for (const row of rows) {
    console.log(`| \`${row.file}\` | ${formatBytes(row.bytes)} | ${formatBytes(row.gzipBytes)} | ${formatBytes(row.brotliBytes)} |`);
  }
}

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  return `${(bytes / 1024).toFixed(2)} kB`;
}
