import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';

const serverPath = 'dist/mcp/server.js';

if (!existsSync(serverPath)) {
  console.error(`${serverPath} is missing. Run pnpm build first.`);
  process.exit(1);
}

const child = spawn(process.execPath, [serverPath], {
  stdio: ['pipe', 'pipe', 'pipe'],
});

let stdout = '';
let stderr = '';

child.stdout.on('data', chunk => {
  stdout += chunk;
});

child.stderr.on('data', chunk => {
  stderr += chunk;
});

child.stdin.end(
  [
    JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'initialize', params: {} }),
    JSON.stringify({ jsonrpc: '2.0', id: 2, method: 'resources/list', params: {} }),
    JSON.stringify({
      jsonrpc: '2.0',
      id: 3,
      method: 'resources/read',
      params: { uri: 'react-timer-hook://api' },
    }),
    JSON.stringify({ jsonrpc: '2.0', id: 4, method: 'tools/list', params: {} }),
    JSON.stringify({
      jsonrpc: '2.0',
      id: 5,
      method: 'tools/call',
      params: { name: 'get_recipe', arguments: { name: 'otp-resend' } },
    }),
    JSON.stringify({
      jsonrpc: '2.0',
      id: 6,
      method: 'tools/call',
      params: { name: 'search_docs', arguments: { query: 'polling' } },
    }),
    '',
  ].join('\n'),
);

const timeout = setTimeout(() => {
  child.kill('SIGTERM');
  console.error('MCP server check timed out.');
  process.exit(1);
}, 2000);

child.on('close', code => {
  clearTimeout(timeout);

  if (code !== 0) {
    console.error(stderr || `MCP server exited with code ${code}.`);
    process.exit(1);
  }

  const responses = stdout
    .trim()
    .split('\n')
    .filter(Boolean)
    .map(line => JSON.parse(line));

  const list = responses.find(response => response.id === 2)?.result?.resources ?? [];
  const api = responses.find(response => response.id === 3)?.result?.contents?.[0]?.text ?? '';
  const tools = responses.find(response => response.id === 4)?.result?.tools ?? [];
  const recipe = responses.find(response => response.id === 5)?.result?.content?.[0]?.text ?? '';
  const search = responses.find(response => response.id === 6)?.result?.content?.[0]?.text ?? '';

  if (list.length !== 3) {
    console.error(`Expected 3 MCP resources, received ${list.length}.`);
    process.exit(1);
  }

  if (!api.includes('@crup/react-timer-hook') || !api.includes('useTimerGroup')) {
    console.error('MCP API resource is missing expected package context.');
    process.exit(1);
  }

  if (!tools.some(tool => tool.name === 'get_recipe') || !tools.some(tool => tool.name === 'search_docs')) {
    console.error('MCP tools list is missing expected docs tools.');
    process.exit(1);
  }

  if (!recipe.includes('resend button') || !search.toLowerCase().includes('polling')) {
    console.error('MCP tool responses are missing expected recipe/search context.');
    process.exit(1);
  }
});
