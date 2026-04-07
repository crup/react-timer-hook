import { readFileSync } from 'node:fs';

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));

const context = {
  package: pkg.name,
  version: pkg.version,
  docs: 'https://crup.github.io/react-timer-hook/',
  repository: 'https://github.com/crup/react-timer-hook',
  install: {
    alpha: `npm install ${pkg.name}@alpha`,
  },
  exports: [
    '@crup/react-timer-hook: useTimer',
    '@crup/react-timer-hook/group: useTimerGroup',
    '@crup/react-timer-hook/schedules: useScheduledTimer',
    '@crup/react-timer-hook/duration: durationParts',
    '@crup/react-timer-hook/diagnostics: consoleTimerDiagnostics',
    '@crup/react-timer-hook/full: convenience runtime exports',
  ],
  principles: [
    'Use now for wall-clock deadlines and clocks.',
    'Use elapsedMilliseconds for active elapsed duration.',
    'Use endWhen(snapshot) to end a lifecycle.',
    'Use cancel(reason) for terminal early stops.',
    'Keep formatting, timezone, retries, and business rules in userland.',
  ],
  docsResources: [
    'react-timer-hook://package',
    'react-timer-hook://api',
    'react-timer-hook://recipes',
  ],
};

console.log(JSON.stringify(context, null, 2));
