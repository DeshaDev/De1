import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';

const port = 4174;
const child = spawn(process.execPath, ['server.js'], {
  env: { ...process.env, NODE_ENV: 'production', PORT: String(port), TRUST_PROXY_HOPS: '0' },
  stdio: 'ignore',
});

try {
  let response;
  for (let attempt = 0; attempt < 30; attempt += 1) {
    if (child.exitCode !== null) throw new Error('Production server exited before becoming ready');
    try {
      response = await fetch(`http://127.0.0.1:${port}/`);
      if (response.ok) break;
    } catch {
      // The listener may need a moment to start.
    }
    await delay(300);
  }
  assert.ok(response?.ok, 'Production server did not return a successful homepage response');
  const html = await response.text();
  assert.match(html, /بصيرة/);
} finally {
  child.kill('SIGTERM');
}
