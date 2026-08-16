# Setting DATAD up on another machine

Works the same on Linux, Windows and macOS. The helper is a Node script rather
than a shell script for exactly that reason.

## On the laptop that already works

```bash
git push                          # make sure your work is actually on GitHub
node scripts/datad.mjs export     # writes datad-secrets.bundle.json
```

That bundle holds the two files git deliberately does not carry:
`server/.env` and `client/.env`. **It contains live credentials** — your Atlas
connection string, JWT secret, Brevo API key and Cloudinary secret.

Move it through a password manager, an encrypted drive, or AirDrop. Not email,
not WhatsApp, not a gist. Delete it from both machines when you are done. If it
ever leaks, rotate those credentials rather than hoping.

## On the new laptop

```bash
git clone https://github.com/dhatchinamoorthiat-star/DATAD.git
cd DATAD
git checkout docs/overview-page
# drop datad-secrets.bundle.json into this folder, then:
node scripts/datad.mjs setup
```

`setup` restores the `.env` files, runs `npm install` in `server/` and
`client/`, builds the client, and finishes with a configuration check.

Then:

```bash
cd server && npm run dev     # API on http://localhost:5001
cd client && npm run dev     # UI  on http://localhost:5173
```

## Do not download the GitHub ZIP

A ZIP has no `.git` directory: no history, no branches, and no way to push work
back. Always `git clone`.

## Do not copy `node_modules`

Native packages are compiled per platform. Copying `node_modules` between
machines is what put a Windows build of `lightningcss` into a macOS checkout in
this repo, which broke `npm run build` in a way that looked nothing like the
actual cause. Always install fresh.

The same goes for `client/dist` — rebuild it.

## Commands

| Command | What it does |
|---|---|
| `npm run export-env` | Package `.env` files from a working machine |
| `npm run setup` | Restore, install, build, verify |
| `npm run doctor` | Check what is missing, change nothing |

Flags for `setup`: `--force` overwrites existing `.env` files (it refuses by
default), `--only-env` restores config without reinstalling.

## What is NOT in git, and whether you need it

| | Need to carry? | How to get it |
|---|---|---|
| `server/.env`, `client/.env` | **Yes** | The bundle, or fill in from `.env.example` |
| `node_modules/` | No — never copy | `npm install` |
| `client/dist/` | No | `npm run build` |
| `graphify-out/` (162 MB) | No | `graphify update .`, only if you use the graphify skill |
| `odysseus/` (699 MB) | No | Separate project, its own repo |
| `audit/`, `.wrangler/` | No | Regenerated locally |

## Requirements

Node 20 or newer (`node -v`). Nothing else — Mongo is Atlas, storage is
Cloudinary, mail is Brevo.

## If something is wrong

```bash
npm run doctor
```

It checks the Node version, the required server variables, whether a mail
transport is configured, and whether dependencies are installed. The mail check
matters more than it looks: registration gates on a verification email, so a
server with no mail transport cannot accept new users at all.
