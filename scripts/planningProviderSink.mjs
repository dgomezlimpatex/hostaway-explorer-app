import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';

function parseArguments(argv) {
  const separator = argv.indexOf('--');
  return separator === -1 ? [] : argv.slice(separator + 1);
}

const command = parseArguments(process.argv.slice(2));
const requests = [];
const server = createServer((request, response) => {
  let body = '';
  request.setEncoding('utf8');
  request.on('data', (chunk) => { body += chunk; });
  request.on('end', () => {
    requests.push({ method: request.method, url: request.url, bodyBytes: Buffer.byteLength(body) });
    response.writeHead(202, { 'content-type': 'application/json' });
    response.end(JSON.stringify({ sink: true, id: `sink-${requests.length}` }));
  });
});

await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const address = server.address();
assert.ok(address && typeof address === 'object');
const endpoint = `http://127.0.0.1:${address.port}`;

try {
  if (command.length > 0) {
    const child = spawn(command[0], command.slice(1), {
      cwd: process.cwd(),
      env: {
        ...process.env,
        PLANNING_NOTIFICATION_MODE: 'test',
        PLANNING_PROVIDER_SINK_URL: endpoint,
        META_GRAPH_API_URL: endpoint,
        RESEND_API_URL: endpoint,
        WHATSAPP_ACCESS_TOKEN: '',
        RESEND_API_KEY: '',
        PLANNING_NOTIFICATIONS_LIVE: 'false',
      },
      stdio: 'inherit',
      shell: false,
    });
    const exitCode = await new Promise((resolve, reject) => {
      child.once('error', reject);
      child.once('exit', resolve);
    });
    assert.equal(exitCode, 0, `el probe terminó con código ${exitCode}`);
  }

  assert.equal(
    requests.length,
    0,
    `provider sink recibió ${requests.length} llamadas: desarrollo/carga debe producir cero Meta/Resend`,
  );
  console.log(`planning-provider-sink: OK endpoint=${endpoint} requests=0`);
} finally {
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
}
