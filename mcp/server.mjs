import { createInterface } from 'node:readline';
import { readFileSync } from 'node:fs';

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));

const resources = {
  'react-timer-hook://package': {
    name: 'Package',
    mimeType: 'application/json',
    text: JSON.stringify(
      {
        name: pkg.name,
        version: pkg.version,
        docs: 'https://crup.github.io/react-timer-hook/',
        install: `npm install ${pkg.name}@alpha`,
      },
      null,
      2,
    ),
  },
  'react-timer-hook://api': {
    name: 'API',
    mimeType: 'text/markdown',
    text: readFileSync(new URL('../docs-site/static/llms-full.txt', import.meta.url), 'utf8'),
  },
  'react-timer-hook://recipes': {
    name: 'Recipes',
    mimeType: 'text/markdown',
    text: [
      '# Recipes',
      '',
      '- Countdown: derive remaining time with Math.max(0, expiresAt - timer.now).',
      '- Stopwatch: render timer.elapsedMilliseconds.',
      '- Clock: render new Date(timer.now) with user-owned formatting.',
      '- Polling: import useScheduledTimer from @crup/react-timer-hook/schedules.',
      '- Many timers: import useTimerGroup from @crup/react-timer-hook/group.',
    ].join('\n'),
  },
};

const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: false });

rl.on('line', line => {
  if (!line.trim()) return;

  let request;
  try {
    request = JSON.parse(line);
  } catch {
    return;
  }

  const { id, method, params } = request;

  if (method === 'initialize') {
    respond(id, {
      protocolVersion: '2024-11-05',
      serverInfo: { name: 'react-timer-hook-docs', version: pkg.version },
      capabilities: { resources: {} },
    });
    return;
  }

  if (method === 'resources/list') {
    respond(id, {
      resources: Object.entries(resources).map(([uri, resource]) => ({
        uri,
        name: resource.name,
        mimeType: resource.mimeType,
      })),
    });
    return;
  }

  if (method === 'resources/read') {
    const resource = resources[params?.uri];
    if (!resource) {
      respondError(id, -32004, `Unknown resource: ${params?.uri ?? 'missing uri'}`);
      return;
    }

    respond(id, {
      contents: [
        {
          uri: params.uri,
          mimeType: resource.mimeType,
          text: resource.text,
        },
      ],
    });
    return;
  }

  respondError(id, -32601, `Method not found: ${method}`);
});

function respond(id, result) {
  process.stdout.write(`${JSON.stringify({ jsonrpc: '2.0', id, result })}\n`);
}

function respondError(id, code, message) {
  process.stdout.write(`${JSON.stringify({ jsonrpc: '2.0', id, error: { code, message } })}\n`);
}
