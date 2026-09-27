import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  mkdtempSync,
  mkdirSync,
  copyFileSync,
  writeFileSync,
  readFileSync,
  existsSync,
  rmSync,
} from 'node:fs';
import { resolve, join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { exitSession } from '../src/session.js';
const quote = (s) => "'" + s.replaceAll("'", "'\\''") + "'";
for (const reuse of [false, true])
  for (const exitMode of ['browser-close', 'in-game'])
    test(`launcher ${exitMode}: ${reuse ? 'reused' : 'owned'} production server, actual authenticated companion, owned process cleanup`, () => {
      mkdirSync('test-results', { recursive: true });
      const root = mkdtempSync(resolve('test-results/launcher-'));
      try {
        for (const dir of ['scripts', 'bin', 'dist'])
          mkdirSync(join(root, dir), { recursive: true });
        for (const file of ['launch-deck.sh', 'session-server.js', 'prepare-browser.js'])
          copyFileSync('scripts/' + file, join(root, 'scripts/' + file));
        writeFileSync(join(root, 'dist/index.html'), 'test build');
        if (reuse) writeFileSync(join(root, 'ready'), '');
        writeFileSync(
          join(root, 'bin/node'),
          `#!/bin/bash
if [[ "$1" == scripts/check-server.js ]]; then [[ -f ready ]]; exit; fi
if [[ "$1" == scripts/prepare-browser.js ]]; then exec ${quote(process.execPath)} "$@"; fi
if [[ "$1" == scripts/session-server.js ]]; then echo $$ > companion-pid; exec ${quote(process.execPath)} "$@"; fi
echo $$ > server-pid
touch ready
exec sleep 30
`,
          { mode: 0o755 },
        );
        writeFileSync(
          join(root, 'scripts/fake-browser.mjs'),
          `
import {writeFileSync} from 'node:fs';
const url=new URL(process.argv.at(-1)),params=new URLSearchParams(url.hash.slice(1));
const endpoint='http://127.0.0.1:'+params.get('sessionPort')+'/exit';
const wrong=await fetch(endpoint,{method:'POST',headers:{Origin:url.origin,Authorization:'Bearer wrong'}});
const badOrigin=await fetch(endpoint,{method:'POST',headers:{Origin:'http://example.com',Authorization:'Bearer '+params.get('sessionToken')}});
const options=await fetch(endpoint,{method:'OPTIONS',headers:{Origin:url.origin}});
const result=await fetch(endpoint,{method:'POST',headers:{Origin:url.origin,Authorization:'Bearer '+params.get('sessionToken')}});
writeFileSync('exit-result.json',JSON.stringify({wrong:wrong.status,badOrigin:badOrigin.status,options:options.status,allow:options.headers.get('access-control-allow-origin'),result:result.status}));
setInterval(()=>{},1000);
`,
        );
        writeFileSync(
          join(root, 'bin/firefox'),
          `#!/bin/bash
printf '%s\\n' "$@" > browser-args
echo $$ > browser-pid
${exitMode === 'in-game' ? `exec ${quote(process.execPath)} scripts/fake-browser.mjs "$@"` : 'exit 0'}
`,
          { mode: 0o755 },
        );
        const result = spawnSync('/bin/bash', [join(root, 'scripts/launch-deck.sh')], {
          env: { ...process.env, PATH: join(root, 'bin') + ':' + process.env.PATH },
          timeout: 10000,
        });
        assert.equal(result.status, 0, readFileSync(join(root, '.runtime/launcher.log'), 'utf8'));
        const args = readFileSync(join(root, 'browser-args'), 'utf8');
        assert(args.includes('--kiosk'));
        assert(args.includes('--no-remote'));
        assert(args.includes('http://127.0.0.1:5184/#sessionPort='));
        assert(args.includes(join(root, '.runtime/firefox-profile')));
        if (reuse) assert(!existsSync(join(root, 'server-pid')));
        for (const file of ['server-pid', 'browser-pid', 'companion-pid'])
          if (existsSync(join(root, file)))
            assert.throws(() => process.kill(Number(readFileSync(join(root, file), 'utf8')), 0));
        if (exitMode === 'in-game')
          assert.deepEqual(JSON.parse(readFileSync(join(root, 'exit-result.json'), 'utf8')), {
            wrong: 403,
            badOrigin: 403,
            options: 204,
            allow: 'http://127.0.0.1:5184',
            result: 200,
          });
      } finally {
        rmSync(root, { recursive: true, force: true });
      }
    });
test('browser exit freezes session and uses companion credentials; unsupported or failed launcher gives explicit Steam route', async () => {
  let request;
  const message = await exitSession(
    { hash: '#sessionPort=12345&sessionToken=abc' },
    async (...args) => {
      request = args;
      return { ok: true };
    },
  );
  assert.equal(request[0], 'http://127.0.0.1:12345/exit');
  assert.equal(request[1].method, 'POST');
  assert.equal(request[1].headers.Authorization, 'Bearer abc');
  assert.match(message, /Closing the game window/);
  assert.match(await exitSession({ hash: '' }), /Steam → Exit Game/);
  assert.match(
    await exitSession({ hash: '#sessionPort=12345&sessionToken=abc' }, async () => {
      throw new Error('offline');
    }),
    /launcher could not be reached/,
  );
});
