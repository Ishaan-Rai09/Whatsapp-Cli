# wa — WhatsApp CLI

A terminal WhatsApp client that works like a Unix tool. No API key. No cloud. No third-party server. Your messages stay on your machine.

```
$ wa chats
────────────────────────────────────────────────────────────────────────
  #       Name                         Unread  Last message
────────────────────────────────────────────────────────────────────────
  1      Alex                                You: sounds good  [22:05]
  2      Sara                                Message deleted  [18:19]
  3 [G] Dev Team                        Meeting at 5pm  [18:40]
  4 [G] College Friends                      Haha yes  [08:34]
────────────────────────────────────────────────────────────────────────
4 chats   ·   open: wa open "<name>"   ·   send: wa send "<name>" "<msg>"

$ wa open "Alex" --limit 5
── Alex ─────────────────────────────────────────────────── 5 msgs ──
[1]   22:01  Alex             hey you free tonight?
[2]   22:03  You              yes, what's up?
[3]   22:04  Alex             wanna grab dinner?
[4]   22:05  You              sounds good
[5]   22:06  Alex             great, see you at 8
────────────────────────────────────────────────────────────────────────
Reply: wa reply "Alex" <index> "your message"

$ wa send "Alex" "on my way"
✓  Message sent → Alex
```

> **Disclaimer** — This project is unofficial and not affiliated with, endorsed by, or connected to WhatsApp or Meta. Automating WhatsApp Web may violate their [Terms of Service](https://www.whatsapp.com/legal/terms-of-service). **Use at your own risk.**

---

## How it works

1. On first run (`wa auth login`) a QR code appears in your terminal
2. You scan it with your phone → **WhatsApp → Linked Devices → Link a Device**
3. The browser session is saved **locally** to `~/.whatsapp-cli/auth/` — scan once, reuse forever
4. **Option A (default):** Every command spins up a headless Chromium, authenticates with the saved session, does the job, then exits — takes 15–30 s per command
5. **Option B (recommended):** Run `wa daemon start` once — Chromium starts once and stays alive in the background. Subsequent commands respond in **< 1 second** via a local socket
6. **No data ever leaves your machine.** No backend, no API key, no relay server

---

## Requirements

| Requirement | Version |
|-------------|---------|
| Node.js | **≥ 20** |
| npm | **≥ 9** |
| OS | Windows / macOS / Linux |

> Puppeteer automatically downloads a compatible Chromium on first `npm install`. You do **not** need to install Chrome separately.

---

## Installation

```bash
# 1. Clone the repo
git clone https://github.com/your-username/whatsapp-cli.git
cd whatsapp-cli

# 2. Install dependencies
npm install --legacy-peer-deps

# 3. Build
npm run build

# 4. Register the global `wa` command
npm link
```

The `wa` command will now be available in any terminal window.

---

## First-time setup

```bash
wa auth login
```

A QR code renders directly in your terminal. Scan it from your phone:

**WhatsApp → Settings → Linked Devices → Link a Device**

The session is saved to `~/.whatsapp-cli/auth/`. You will never need to scan again unless you manually unlink the device from your phone or run `wa auth logout`.

---

## Commands

### ⚡ Speed up all commands with the background daemon

By default every `wa` command starts a fresh Chrome process — that costs 15–30 seconds. The **daemon** eliminates this by keeping one session alive:

```bash
# Start the daemon once (blocks until WhatsApp is ready)
wa daemon start

# All subsequent commands run in < 1 s:
wa chats
wa open "Alex"
wa send "Sara" "hey!"

# Check whether it is running:
wa daemon status

# Shut it down when you are done:
wa daemon stop
```

No extra flags needed — every command automatically detects and uses the daemon.

---

### List all chats

```bash
wa chats
```

Shows index, group tag `[G]`, name, unread count, last message preview, and timestamp.

---

### Read a chat

```bash
wa open "Alex"              # last 20 messages (default)
wa open "Dev Team" --limit 50  # last 50 messages  (-n 50 also works)
```

Name matching is **partial and case-insensitive** — `wa open "dev"` will match `Dev Team`.

Each message gets an index `[1]`, `[2]`, `[3]`… used by `wa reply`.

---

### Send a text message

```bash
wa send "Alex" "hey, you free?"
wa send "Dev Team" "meeting moved to 5pm"
```

---

### Send a file

Supports images, videos, audio, PDFs, ZIPs, and any other file type.

```bash
wa send "Alex" --file /path/to/report.pdf
wa send "Sara" --file /path/to/photo.jpg "taken today"
wa send "Alex" --file /path/to/archive.zip "project files"
```

Images, videos, and audio are sent inline. All other files (PDF, ZIP, etc.) are sent as documents.

---

### Reply to a specific message

```bash
wa open "Alex"                          # note the [index] of the target message
wa reply "Alex" 3 "sounds good!"        # reply to message [3]
wa reply "Dev Team" 7 "I will attend"
```

---

### Auth

```bash
wa auth login    # scan QR to link your account (first time only)
wa auth logout   # remove saved session from your machine
```

---

## Full command reference

```
wa daemon start                             Start background daemon (run once)
wa daemon stop                              Stop the daemon
wa daemon status                            Show daemon status
wa chats                                    List all chats
wa open "<name>" [--limit N | -n N]         Show last N messages (default 20)
wa send "<name>" "<message>"                Send a text message
wa send "<name>" --file <path> [caption]    Send a file
wa reply "<name>" <index> "<message>"       Reply to a message by index
wa auth login                               First-time QR login
wa auth logout                              Remove saved session
wa --help                                   Show help
wa <command> --help                         Help for a specific command
```

---

## npm scripts

```bash
npm start          # build + show help screen
npm run build      # compile TypeScript to dist/
npm run dev        # watch mode (rebuilds on file change)
npm run login      # build + run wa auth login
npm run clean      # delete dist/
```

---

## Security

### Your data stays local — always

| What | Where stored | Pushed to GitHub |
|------|-------------|------------------|
| WhatsApp session (cookies/keys) | `~/.whatsapp-cli/auth/` | Never (in `.gitignore`) |
| App config | `~/.whatsapp-cli/config.yml` | Never |
| Logs | `~/.whatsapp-cli/logs/` | Never |
| Daemon state (PID + port + token) | `~/.whatsapp-cli/daemon.json` | Never |
| Messages | Only in memory during the command | Never persisted to disk |

Session files are stored in your **home directory** (not inside the project folder), so they cannot be accidentally committed.

### Daemon security model

When you run `wa daemon start`, a background process listens on a **localhost-only** TCP port (`127.0.0.1:RANDOM`). It cannot be reached from any other machine on your network. The following measures prevent other processes on *your* machine from accessing it:

| Measure | Detail |
|---------|--------|
| **Secret token** | A 64-character random hex token is generated at startup using `crypto.randomBytes`. Every IPC request must include this token or it is rejected immediately. |
| **Timing-safe comparison** | Token comparison uses `crypto.timingSafeEqual` to prevent timing-based token guessing. |
| **File permissions** | `~/.whatsapp-cli/daemon.json` (which stores the token and port) is written with mode `0o600` — readable only by the owner, not by other OS users. |
| **Localhost binding** | The daemon binds to `127.0.0.1`, not `0.0.0.0`. It is completely unreachable from outside your machine. |
| **No persistent message storage** | Messages fetched over IPC are held in memory only for the duration of the command. Nothing is written to disk. |

### What has access to your messages

Only your machine. The headless browser connects directly to `web.whatsapp.com` — the same endpoint the official WhatsApp Web uses. No relay server or third-party service is involved.

### Before sharing your computer

```bash
wa auth logout    # deletes session, your account is immediately unlinked
```

### If you clone this from someone else's fork

**Never run pre-built `dist/` files from a fork you did not build yourself.** Always compile from source:

```bash
npm run build
```

A malicious `dist/cli.js` could silently send your session credentials anywhere. Only run what you compiled.

### Threat model

| Threat | Mitigation |
|--------|-----------|
| Session files committed to Git | `.gitignore` blocks all auth directories and `dist/` |
| Malicious fork with pre-built binary | Always build from source yourself |
| Network traffic going somewhere unexpected | All traffic goes to `web.whatsapp.com` only (same as browser WhatsApp Web) |
| Another local user reading your session or daemon | `~/.whatsapp-cli/` files are in your home dir; `daemon.json` is written 0o600 (owner-only) |
| Another local process hijacking the daemon socket | Random secret token is required for every RPC call; token is stored in owner-only `daemon.json` |

---

## Troubleshooting

**Command hangs for a long time then fails**
Your session may have expired. Run `wa auth login` to re-link.

**QR code looks garbled**
Your terminal may not support Unicode block characters. Use Windows Terminal, iTerm2, Alacritty, or any modern terminal emulator.

**`Not logged in. Run: wa auth login`**
You have not linked your account yet, or the session was revoked from your phone (WhatsApp → Linked Devices → remove the entry).

**Message confirmed as sent in terminal but not received**
Make sure you are on the latest build (`npm run build`). An older version had a race condition where the browser was destroyed before the WebSocket flushed.

**Puppeteer / Chromium download takes forever**
This only happens once, on `npm install`. Chromium is ~170 MB. After the first install it is cached in `node_modules/`.

---

## Project structure

```
source/
  cli.ts                   Entry point (Pastel CLI router)
  client.ts                WhatsApp adapter — wraps whatsapp-web.js
  config.ts                Config file manager
  commands/
    chats.tsx              wa chats
    open.tsx               wa open
    send.tsx               wa send
    reply.tsx              wa reply
    daemon/
      index.tsx            wa daemon  (help screen)
      start.tsx            wa daemon start
      stop.tsx             wa daemon stop
      status.tsx           wa daemon status
    auth/
      login.tsx            wa auth login
      logout.tsx           wa auth logout
  daemon/
    server.ts              Daemon process — WhatsApp session + TCP RPC server
    state.ts               Shared state-file types and helpers
  utils/
    connect.ts             Boot client (fast path: IPC, slow path: Puppeteer)
    ipc.ts                 Daemon IPC client + tryConnectDaemon()
    message-parser.ts      Format timestamps, previews, ack symbols
    logger.ts              File-based logger
  types/
    whatsapp.ts            Shared TypeScript types
```

---

## Tech stack

| Library | Purpose |
|---------|---------|
| [whatsapp-web.js](https://github.com/pedroslopez/whatsapp-web.js) | WhatsApp Web automation |
| [Puppeteer](https://pptr.dev) | Headless browser |
| [Ink](https://github.com/vadimdemedes/ink) | React for terminal rendering |
| [Pastel](https://github.com/vadimdemedes/pastel) | File-based CLI routing |
| [Fuse.js](https://fusejs.io) | Fuzzy chat name search |
| TypeScript + esbuild | Type safety and fast builds |

---

## Contributing

1. Fork the repo
2. `npm install --legacy-peer-deps`
3. `npm run dev` (watch mode — rebuilds on save)
4. Make changes in `source/`
5. `npm run build` to verify it compiles
6. Open a PR

**Never commit anything from `~/.whatsapp-cli/` or `dist/`.** Both are in `.gitignore` but please double-check before pushing.

---

## License

MIT — use freely, modify freely. No warranty. Not responsible if WhatsApp restricts your account.

