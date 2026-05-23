# SFTP Sync for Zed

> Save and sync: upload files to remote servers over **SFTP / FTP / FTPS** from the [Zed](https://zed.dev) editor.

**English** | [简体中文](./README.zh-CN.md)

[![Release](https://img.shields.io/github/v/release/jhs1873/zed-sftp)](https://github.com/jhs1873/zed-sftp/releases)
[![License](https://img.shields.io/github/license/jhs1873/zed-sftp)](./LICENSE)

---

## Features

- 📤 **Upload on save** — Auto-sync any saved file to remote, mapped by its workspace-relative path
- 🔐 **Multiple protocols** — SFTP (password / SSH key), FTP, FTPS
- 🗂️ **Multi-profile** — One config can hold dev / staging / production servers
- 🚫 **Flexible ignore rules** — `.gitignore`-style globs
- 🤖 **MCP tools** — Invoke `upload` / `download` / `list` / `sync` / `delete` manually from the Zed AI assistant
- ♻️ **Connection pooling** — Connections to the same server are reused, idle for 5 minutes then disconnected

---

## Installation

### Option A: Zed Extension Registry (recommended for end users)

> `v0.1.0` has been submitted to the Zed Registry (effective once the PR is merged). Then:

1. Open the command palette in Zed: `zed: extensions`
2. Search for **SFTP Sync**
3. Click Install

On first launch the extension automatically fetches the sync-server runtime (~20 KB) from this repository's GitHub Release.

### Option B: Install Dev Extension (for developers)

```bash
git clone https://github.com/jhs1873/zed-sftp.git
cd zed-sftp
# Build sync-server once (the release CI handles this automatically afterwards)
cd sync-server && npm install && npm run build && cd ..
# Build the wasm
cargo build --target wasm32-wasip2 --release
cp target/wasm32-wasip2/release/zed_sftp.wasm extension.wasm
```

Then in Zed: command palette → `zed: extensions` → **Install Dev Extension** → pick the `zed-sftp` directory.

---

## Quick Start

Create `.zed/sftp.json` at your project root:

```json
{
  "protocol": "sftp",
  "host": "example.com",
  "username": "deploy",
  "privateKeyPath": "~/.ssh/id_ed25519",
  "remotePath": "/srv/myapp",
  "ignore": ["node_modules", ".git", "dist", "*.log"]
}
```

Saving any file will upload it to `/srv/myapp/<relative-path>`.

📖 **Full reference: [CONFIGURATION.md](./CONFIGURATION.md)**

---

## Using the AI Assistant (MCP Tools)

The extension also exposes 5 MCP tools, callable from the Zed AI assistant:

| Tool | Purpose |
|---|---|
| `sftp_upload_file` | Upload a single file |
| `sftp_download_file` | Download a remote file |
| `sftp_list_directory` | List a remote directory |
| `sftp_sync_directory` | Batch-sync a local directory to remote (supports `dry_run`) |
| `sftp_delete_remote` | Delete a remote file |

---

## Project Layout

```
zed-sftp/
├── src/lib.rs              # Zed extension wasm entry (Rust)
├── extension.toml          # Extension manifest
├── sync-server/            # LSP + MCP server (TypeScript)
│   ├── src/
│   │   ├── index.ts        # Entry: dispatches LSP / MCP by --mcp flag
│   │   ├── lsp-server.ts   # Listens for didSave and triggers uploads
│   │   ├── mcp-server.ts   # Exposes MCP tools
│   │   ├── config.ts       # Reads .zed/sftp.json
│   │   ├── sftp-client.ts  # ssh2-sftp-client wrapper
│   │   └── ftp-client.ts   # basic-ftp wrapper
│   └── package.json
├── CONFIGURATION.md        # Configuration reference
└── PUBLISHING.md           # Release process
```

**Two-tier architecture:**
- **Rust wasm (`src/lib.rs`)** runs inside Zed's sandbox: installs deps, fetches sync-server, and tells Zed how to launch the LSP.
- **Node.js sync-server** is the actual worker process, spawned by Zed as a native child process.

---

## Development

```bash
# After modifying Rust, rebuild the wasm:
cargo build --target wasm32-wasip2 --release && cp target/wasm32-wasip2/release/zed_sftp.wasm extension.wasm

# After modifying sync-server, recompile:
cd sync-server && npm run build
```

After editing the source, find SFTP Sync in the Zed extensions panel → **Rebuild Dev Extension** to reload.

For the release process see [PUBLISHING.md](./PUBLISHING.md).

---

## License

[MIT](./LICENSE)
