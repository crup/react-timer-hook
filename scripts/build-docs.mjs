import { spawn } from 'node:child_process';

const command = process.platform === 'win32'
  ? 'node_modules/.bin/docusaurus.cmd'
  : 'node_modules/.bin/docusaurus';

const child = spawn(command, ['build', 'docs-site'], {
  env: {
    ...process.env,
    NO_UPDATE_NOTIFIER: '1',
  },
  stdio: ['ignore', 'pipe', 'pipe'],
});

let succeeded = false;
let settled = false;

const finish = code => {
  if (settled) return;
  settled = true;
  process.exit(code);
};

const watch = stream => {
  stream.on('data', chunk => {
    const text = chunk.toString();
    process.stdout.write(text);
    if (text.includes('Generated static files in')) {
      succeeded = true;
      setTimeout(() => {
        if (!settled) {
          child.kill();
          finish(0);
        }
      }, 3000).unref();
    }
  });
};

watch(child.stdout);
child.stderr.on('data', chunk => process.stderr.write(chunk));

child.on('error', error => {
  console.error(error);
  finish(1);
});

child.on('exit', code => {
  finish(succeeded ? 0 : code ?? 1);
});

setTimeout(() => {
  if (!succeeded) {
    child.kill();
    console.error('Docusaurus build timed out before reporting success.');
    finish(1);
  }
}, 120000).unref();
