import { defineConfig } from 'tsup';

export default defineConfig([
  {
    entry: {
      index: 'src/index.ts',
      group: 'src/group.ts',
      duration: 'src/duration.ts',
      schedules: 'src/schedules.ts',
      diagnostics: 'src/diagnostics.ts',
    },
    format: ['esm', 'cjs'],
    dts: true,
    minify: true,
    sourcemap: false,
    clean: true,
    external: ['react'],
  },
  {
    entry: {
      'mcp/server': 'mcp/server.mjs',
    },
    format: ['esm'],
    platform: 'node',
    target: 'node18',
    dts: false,
    minify: true,
    sourcemap: false,
    clean: false,
    banner: {
      js: '#!/usr/bin/env node',
    },
  },
]);
