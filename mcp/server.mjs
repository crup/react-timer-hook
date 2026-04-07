import { createInterface } from 'node:readline';
import { readFileSync } from 'node:fs';

const pkg = readPackage();
const apiText = `# @crup/react-timer-hook

A lightweight React hooks library for building timers, stopwatches, and real-time clocks with minimal boilerplate.

Docs: https://crup.github.io/react-timer-hook/
Package: @crup/react-timer-hook
Install: npm install @crup/react-timer-hook@latest
Runtime: Node 18+ and React 18+
Repository: https://github.com/crup/react-timer-hook

Public exports:
- @crup/react-timer-hook: useTimer(options) for one timer lifecycle.
- @crup/react-timer-hook/group: useTimerGroup(options) for many keyed independent lifecycles with one shared scheduler.
- @crup/react-timer-hook/schedules: useScheduledTimer(options) for schedule-enabled timers with timing context.
- @crup/react-timer-hook/duration: durationParts(milliseconds) for duration display helper values.
- @crup/react-timer-hook/diagnostics: consoleTimerDiagnostics(options) for optional event logging.

Core rules:
- Use timer.now for wall-clock deadlines and clocks.
- Use timer.elapsedMilliseconds for active elapsed duration.
- Use endWhen(snapshot) to end a lifecycle.
- Use onError(error, snapshot, controls) when onEnd can throw or reject.
- Use cancel(reason) for terminal early stops.
- Keep formatting, timezone, retries, and business rules in userland.

Schedules:
- Use useScheduledTimer() from @crup/react-timer-hook/schedules.
- Schedules are opt-in and default to overlap: "skip".
- Schedule callbacks receive context with scheduledAt, firedAt, nextRunAt, overdueCount, and effectiveEveryMs.
- Schedule callbacks can define onError(error, snapshot, controls, context); otherwise timer or item onError is used.

Recipes:
- Wall clock: new Date(timer.now).
- Stopwatch: render timer.elapsedMilliseconds.
- Absolute countdown: Math.max(0, expiresAt - timer.now).
- Pausable countdown: durationMs - timer.elapsedMilliseconds.
- OTP resend: disable the resend button until elapsedMilliseconds reaches the cooldown.
- Polling: use schedules with overlap: "skip".
- Many independent timers: use useTimerGroup().
`;

const resources = {
  'react-timer-hook://package': {
    name: 'Package',
    mimeType: 'application/json',
    text: JSON.stringify(
      {
        name: pkg.name,
        version: pkg.version,
        docs: 'https://crup.github.io/react-timer-hook/',
        install: `npm install ${pkg.name}@latest`,
      },
      null,
      2,
    ),
  },
  'react-timer-hook://api': {
    name: 'API',
    mimeType: 'text/markdown',
    text: apiText,
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

const recipes = {
  'wall-clock': 'Use useTimer({ autoStart: true }) and render new Date(timer.now). Keep locale and timezone formatting in userland.',
  stopwatch: 'Use useTimer({ updateIntervalMs: 100 }). Render timer.elapsedMilliseconds and wire start, pause, resume, restart, and reset to buttons.',
  'absolute-countdown': 'Use timer.now for server deadlines: const remainingMs = Math.max(0, expiresAt - timer.now). Use endWhen: snapshot => snapshot.now >= expiresAt.',
  'pausable-countdown': 'Use timer.elapsedMilliseconds for active elapsed time: const remainingMs = durationMs - timer.elapsedMilliseconds. Paused time is excluded.',
  'otp-resend': 'Use a duration countdown. Disable the resend button while timer.isRunning and enable it after timer.isEnded or remainingMs <= 0.',
  polling: 'Import useScheduledTimer from @crup/react-timer-hook/schedules. Add schedules: [{ id, everyMs, overlap: "skip", callback }].',
  'autosave-heartbeat': 'Use useScheduledTimer with a schedule every 5000-15000ms. Keep retry/backoff and request state in app code.',
  'timer-group': 'Import useTimerGroup from @crup/react-timer-hook/group for many keyed timers that each need independent pause, resume, cancel, restart, or onEnd.',
  'per-item-polling': 'Use useTimerGroup with item schedules when each row needs independent polling cadence or cancel conditions.',
  diagnostics: 'Import consoleTimerDiagnostics from @crup/react-timer-hook/diagnostics and pass diagnostics only while debugging.',
};

const tools = [
  {
    name: 'get_api_docs',
    title: 'Get API docs',
    description: 'Return the compact API notes for @crup/react-timer-hook.',
    inputSchema: {
      type: 'object',
      properties: {},
      additionalProperties: false,
    },
  },
  {
    name: 'get_recipe',
    title: 'Get recipe',
    description: 'Return guidance for a named recipe or use case.',
    inputSchema: {
      type: 'object',
      properties: {
        name: {
          type: 'string',
          description: `Recipe name. Known values: ${Object.keys(recipes).join(', ')}.`,
        },
      },
      required: ['name'],
      additionalProperties: false,
    },
  },
  {
    name: 'search_docs',
    title: 'Search docs',
    description: 'Search API and recipe notes for a query.',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Search query such as countdown, polling, group, diagnostics, or OTP.',
        },
      },
      required: ['query'],
      additionalProperties: false,
    },
  },
];

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
  const hasId = Object.hasOwn(request, 'id');

  if (!method) {
    if (hasId) respondError(id, -32600, 'Invalid request: missing method.');
    return;
  }

  if (method === 'initialize') {
    respond(id, {
      protocolVersion: '2024-11-05',
      serverInfo: { name: 'react-timer-hook-docs', version: pkg.version },
      capabilities: { resources: {}, tools: {} },
    });
    return;
  }

  if (method === 'notifications/initialized' || method.startsWith('notifications/')) {
    return;
  }

  if (method === 'ping') {
    if (hasId) respond(id, {});
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

  if (method === 'tools/list') {
    respond(id, { tools });
    return;
  }

  if (method === 'tools/call') {
    const name = params?.name;
    const args = params?.arguments ?? {};

    if (name === 'get_api_docs') {
      respondTool(id, apiText);
      return;
    }

    if (name === 'get_recipe') {
      const recipe = recipes[normalizeRecipeName(args.name)];
      if (!recipe) {
        respondError(id, -32602, `Unknown recipe: ${args.name ?? 'missing name'}`);
        return;
      }

      respondTool(id, recipe);
      return;
    }

    if (name === 'search_docs') {
      const query = String(args.query ?? '').trim().toLowerCase();
      if (!query) {
        respondError(id, -32602, 'search_docs requires a non-empty query.');
        return;
      }

      const matches = [
        ...searchEntries('api', { api: apiText }, query),
        ...searchEntries('recipe', recipes, query),
      ];

      respondTool(id, matches.length > 0 ? matches.join('\n\n') : `No matches for "${query}".`);
      return;
    }

    respondError(id, -32601, `Tool not found: ${name ?? 'missing name'}`);
    return;
  }

  if (hasId) respondError(id, -32601, `Method not found: ${method}`);
});

function respond(id, result) {
  process.stdout.write(`${JSON.stringify({ jsonrpc: '2.0', id, result })}\n`);
}

function respondTool(id, text) {
  respond(id, { content: [{ type: 'text', text }] });
}

function respondError(id, code, message) {
  if (id === undefined) return;
  process.stdout.write(`${JSON.stringify({ jsonrpc: '2.0', id, error: { code, message } })}\n`);
}

function normalizeRecipeName(value) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-');
}

function searchEntries(kind, values, query) {
  return Object.entries(values)
    .filter(([name, text]) => `${name}\n${text}`.toLowerCase().includes(query))
    .map(([name, text]) => `## ${kind}: ${name}\n${text}`);
}

function readPackage() {
  for (const path of ['../../package.json', '../package.json']) {
    try {
      return JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'));
    } catch {
      // Try the next path. The bundled file runs from dist/mcp, while the source file runs from mcp.
    }
  }

  return { name: '@crup/react-timer-hook', version: '0.0.0' };
}
