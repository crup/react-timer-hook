import { readFileSync } from 'node:fs';

const readme = readFileSync('README.md', 'utf8');

const required = [
  'useTimer',
  'useTimerGroup',
  'durationParts',
  './docs/API.md',
  './docs/TASKS.md',
  './docs/RECIPES.md',
];

const missing = required.filter(value => !readme.includes(value));

if (missing.length > 0) {
  console.error(`README.md is missing required references: ${missing.join(', ')}`);
  process.exit(1);
}
