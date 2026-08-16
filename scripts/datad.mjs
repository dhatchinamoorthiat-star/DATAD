#!/usr/bin/env node
/**
 * DATAD portable setup — works identically on Linux, Windows and macOS.
 *
 * Written in Node rather than shell because the project already requires Node,
 * and a bash script would not run on Windows while a PowerShell one would not
 * run anywhere else. Uses only built-in modules, so it works on a freshly
 * cloned repo before `npm install` has been run.
 *
 *   node scripts/datad.mjs export   on the laptop that already works
 *   node scripts/datad.mjs setup    on the new laptop, after cloning
 *   node scripts/datad.mjs doctor   anywhere, to check what is missing
 *
 * The bundle written by `export` contains live credentials. It is gitignored,
 * but treat it like a password: move it through a password manager or an
 * encrypted transfer, and delete it from both machines afterwards.
 */

import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BUNDLE = path.join(ROOT, 'datad-secrets.bundle.json');

// Files that git deliberately does not carry but the app cannot start without.
const SECRET_FILES = [
  { rel: 'server/.env', required: true },
  { rel: 'client/.env', required: false },
];

// Without these the server exits at boot (see server/index.js REQUIRED_ENV).
const REQUIRED_SERVER_VARS = ['MONGODB_URI', 'JWT_SECRET', 'CLIENT_URL'];

// Registration gates on a verification email, so with no mail transport nobody
// can sign up. Any one of these groups is enough.
const MAIL_GROUPS = [
  ['BREVO_API_KEY', 'BREVO_FROM_EMAIL'],
  ['SMTP_HOST', 'SMTP_USER', 'SMTP_PASS'],
  ['GMAIL_USER', 'GMAIL_APP_PASSWORD'],
];

const c = {
  ok: (s) => `\x1b[32m${s}\x1b[0m`,
  warn: (s) => `\x1b[33m${s}\x1b[0m`,
  err: (s) => `\x1b[31m${s}\x1b[0m`,
  dim: (s) => `\x1b[2m${s}\x1b[0m`,
  bold: (s) => `\x1b[1m${s}\x1b[0m`,
};

const read = (rel) => {
  const p = path.join(ROOT, rel);
  return fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : null;
};

/** Variable NAMES only — this never returns or prints a value. */
const varNames = (contents) =>
  (contents || '')
    .split('\n')
    .map((l) => l.match(/^\s*([A-Z0-9_]+)\s*=/))
    .filter(Boolean)
    .map((m) => m[1]);

const hasValue = (contents, name) =>
  new RegExp(`^\\s*${name}\\s*=\\s*\\S`, 'm').test(contents || '');

// ── export ─────────────────────────────────────────────────────────────────

function doExport() {
  console.log(c.bold('\nPackaging the files git does not carry\n'));

  const files = {};
  let missingRequired = false;

  for (const { rel, required } of SECRET_FILES) {
    const contents = read(rel);
    if (contents === null) {
      console.log(`  ${required ? c.err('missing') : c.dim('absent')}  ${rel}`);
      if (required) missingRequired = true;
      continue;
    }
    files[rel] = contents;
    console.log(`  ${c.ok('added  ')}  ${rel} ${c.dim(`(${varNames(contents).length} variables)`)}`);
  }

  if (missingRequired) {
    console.log(c.err('\nserver/.env is missing — run this on the laptop that already works.\n'));
    process.exit(1);
  }

  fs.writeFileSync(
    BUNDLE,
    JSON.stringify(
      {
        _warning: 'CONTAINS LIVE CREDENTIALS. Transfer securely, then delete from both machines.',
        _created: new Date().toISOString(),
        files,
      },
      null,
      2
    ),
    { mode: 0o600 } // owner-only, on the platforms that honour it
  );

  console.log(c.bold(`\nWrote ${path.basename(BUNDLE)}`));
  console.log(`
${c.warn('This file contains live credentials.')} It is gitignored, but:
  • move it via a password manager, encrypted drive or AirDrop — not email or chat
  • delete it from BOTH machines once setup is done
  • if it ever leaks, rotate the Mongo, Brevo and Cloudinary credentials

On the new laptop:
  ${c.bold('git clone https://github.com/dhatchinamoorthiat-star/DATAD.git')}
  ${c.dim('# drop the bundle into the repo root, then:')}
  ${c.bold('node scripts/datad.mjs setup')}
`);
}

// ── setup ──────────────────────────────────────────────────────────────────

function run(cmd, args, cwd) {
  // shell:true so `npm` resolves to npm.cmd on Windows without special-casing.
  const res = spawnSync(cmd, args, { cwd, stdio: 'inherit', shell: true });
  return res.status === 0;
}

function doSetup({ force, onlyEnv }) {
  console.log(c.bold('\nSetting up DATAD\n'));

  // 1. Restore the files git does not carry.
  if (fs.existsSync(BUNDLE)) {
    const bundle = JSON.parse(fs.readFileSync(BUNDLE, 'utf8'));
    for (const [rel, contents] of Object.entries(bundle.files || {})) {
      const dest = path.join(ROOT, rel);
      if (fs.existsSync(dest) && !force) {
        console.log(`  ${c.warn('kept   ')}  ${rel} ${c.dim('(already exists — pass --force to overwrite)')}`);
        continue;
      }
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      fs.writeFileSync(dest, contents, { mode: 0o600 });
      console.log(`  ${c.ok('restored')} ${rel}`);
    }
  } else {
    console.log(`  ${c.warn('no bundle found')} ${c.dim(`(${path.basename(BUNDLE)})`)}`);
    console.log(c.dim('  Copy .env.example to .env in server/ and client/ and fill them in by hand,'));
    console.log(c.dim('  or run `node scripts/datad.mjs export` on your other laptop first.\n'));
  }

  if (onlyEnv) {
    console.log(c.dim('\n--only-env: skipping install and build.\n'));
    doDoctor({ exitOnFail: false });
    return;
  }

  // 2. Dependencies. Never copied between machines: native packages like
  //    lightningcss and the jest binaries are platform-specific, and a
  //    node_modules carried from another OS fails in confusing ways.
  console.log(c.bold('\nInstalling dependencies (this takes a few minutes)\n'));
  for (const dir of ['server', 'client']) {
    console.log(c.dim(`  → npm install in ${dir}/`));
    if (!run('npm', ['install'], path.join(ROOT, dir))) {
      console.log(c.err(`\nnpm install failed in ${dir}/.\n`));
      process.exit(1);
    }
  }

  // 3. The server serves client/dist in production; without a build there is
  //    no frontend to serve.
  console.log(c.bold('\nBuilding the client\n'));
  if (!run('npm', ['run', 'build'], path.join(ROOT, 'client'))) {
    console.log(c.warn('\nClient build failed — the API will still run, but nothing will be served at /.\n'));
  }

  console.log(c.bold('\nChecking configuration\n'));
  doDoctor({ exitOnFail: false });

  console.log(`
${c.bold('Start it:')}
  ${c.bold('cd server && npm run dev')}   ${c.dim('# API on http://localhost:5001')}
  ${c.bold('cd client && npm run dev')}   ${c.dim('# UI  on http://localhost:5173')}

${c.warn('Delete the bundle now that setup is done:')}
  ${c.bold(process.platform === 'win32' ? `del ${path.basename(BUNDLE)}` : `rm ${path.basename(BUNDLE)}`)}
`);
}

// ── doctor ─────────────────────────────────────────────────────────────────

function doDoctor({ exitOnFail = true } = {}) {
  let failed = false;
  const fail = (m) => { console.log(`  ${c.err('✗')} ${m}`); failed = true; };
  const pass = (m) => console.log(`  ${c.ok('✓')} ${m}`);
  const warn = (m) => console.log(`  ${c.warn('!')} ${m}`);

  const major = Number(process.versions.node.split('.')[0]);
  if (major >= 20) pass(`Node ${process.versions.node}`);
  else fail(`Node ${process.versions.node} — this project needs Node 20 or newer`);

  const server = read('server/.env');
  if (!server) {
    fail('server/.env missing — the server will exit at boot');
  } else {
    const missing = REQUIRED_SERVER_VARS.filter((v) => !hasValue(server, v));
    if (missing.length) fail(`server/.env missing required: ${missing.join(', ')}`);
    else pass(`server/.env has ${REQUIRED_SERVER_VARS.join(', ')}`);

    const group = MAIL_GROUPS.find((g) => g.every((v) => hasValue(server, v)));
    if (group) pass(`mail transport configured (${group[0].split('_')[0].toLowerCase()})`);
    else fail('no mail transport — registration needs a verification email, so nobody can sign up');

    if (!hasValue(server, 'ADMIN_EMAIL')) warn('ADMIN_EMAIL unset — no account will be promoted to admin');
  }

  if (!read('client/.env')) warn('client/.env missing — defaults to /api, fine for local dev');
  else pass('client/.env present');

  for (const dir of ['server', 'client']) {
    if (fs.existsSync(path.join(ROOT, dir, 'node_modules'))) pass(`${dir}/node_modules installed`);
    else fail(`${dir}/node_modules missing — run: cd ${dir} && npm install`);
  }

  if (fs.existsSync(path.join(ROOT, 'client', 'dist'))) pass('client built');
  else warn('client not built yet — run: cd client && npm run build');

  if (exitOnFail && failed) {
    console.log(c.err('\nSome checks failed. See above.\n'));
    process.exit(1);
  }
  if (!failed) console.log(c.ok('\nEverything checks out.\n'));
  return !failed;
}

// ── entry ──────────────────────────────────────────────────────────────────

const [cmd] = process.argv.slice(2);
const force = process.argv.includes('--force');
const onlyEnv = process.argv.includes('--only-env');

switch (cmd) {
  case 'export': doExport(); break;
  case 'setup': doSetup({ force, onlyEnv }); break;
  case 'doctor': doDoctor(); break;
  default:
    console.log(`
${c.bold('DATAD portable setup')}

  ${c.bold('node scripts/datad.mjs export')}   package .env files from a working laptop
  ${c.bold('node scripts/datad.mjs setup')}    restore them here, install deps, build
  ${c.bold('node scripts/datad.mjs doctor')}   check what is missing

Flags for setup:
  ${c.bold('--force')}      overwrite existing .env files
  ${c.bold('--only-env')}   restore .env only, skip install and build
`);
    process.exit(cmd ? 1 : 0);
}
