#!/usr/bin/env node
// Creates locally trusted HTTPS dev certificates with mkcert (cross-platform). Never commit the output (certs/ is git-ignored).
// Usage: npm run certs [-- extra-hostname-or-LAN-IP ...]
import { spawnSync } from 'node:child_process';
import { mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
const run = (args) => spawnSync('mkcert', args, { encoding: 'utf8', shell: process.platform === 'win32' });
const v = run(['-version']);
if (v.error || v.status !== 0) {
  console.error('mkcert is not installed. Install it first: https://github.com/FiloSottile/mkcert  (Windows: choco install mkcert, macOS: brew install mkcert)');
  process.exit(1);
}
const install = run(['-install']);
if (install.status !== 0) console.warn('mkcert -install reported a problem:\n' + (install.stderr || ''));
mkdirSync('certs', { recursive: true });
const hosts = ['localhost', '127.0.0.1', '::1', ...process.argv.slice(2)];
const r = run(['-key-file', join('certs', 'dev-key.pem'), '-cert-file', join('certs', 'dev-cert.pem'), ...hosts]);
if (r.status !== 0) { console.error(r.stderr); process.exit(1); }
const caroot = (run(['-CAROOT']).stdout || '').trim();
console.log(`Created certs/dev-key.pem and certs/dev-cert.pem for: ${hosts.join(', ')}`);
if (caroot) console.log(`mkcert root CA: ${join(caroot, 'rootCA.pem')} ${existsSync(join(caroot, 'rootCA.pem')) ? '' : '(missing)'}`);
