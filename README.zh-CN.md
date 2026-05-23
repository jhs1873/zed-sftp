# SFTP Sync for Zed

> 保存即同步：在 [Zed](https://zed.dev) 编辑器中通过 **SFTP / FTP / FTPS** 把文件上传到远程服务器。

[English](./README.md) | **简体中文**

[![Release](https://img.shields.io/github/v/release/jhs1873/zed-sftp)](https://github.com/jhs1873/zed-sftp/releases)
[![License](https://img.shields.io/github/license/jhs1873/zed-sftp)](./LICENSE)

---

## 特性

- 📤 **保存即上传** — 保存任何文件时自动同步到远程，路径按工作区相对位置映射
- 🔐 **多协议** — 支持 SFTP（密码 / SSH 密钥）、FTP、FTPS
- 🗂️ **多 Profile** — 一份配置容纳开发 / 预发 / 生产多套服务器
- 🚫 **灵活忽略** — `.gitignore` 风格的 glob 规则
- 🤖 **MCP 工具** — 在 Zed AI 助手里手动 `upload` / `download` / `list` / `sync` / `delete`
- ♻️ **连接复用** — 同一服务器共享连接，5 分钟空闲自动断开

---

## 安装

### 方式 A：Zed Extension Registry（推荐，最终用户）

> 当前仓库 `v0.1.0` 已提交至 Zed Registry（PR 合并后生效）。届时：

1. 在 Zed 中打开命令面板：`zed: extensions`
2. 搜索 **SFTP Sync**
3. 点击 Install

扩展首次启动时会自动从本仓库的 GitHub Release 拉取 sync-server 运行时（约 20 KB）。

### 方式 B：Install Dev Extension（开发者）

```bash
git clone https://github.com/jhs1873/zed-sftp.git
cd zed-sftp
# 编译 sync-server 一次（后续 release CI 会自动做这步）
cd sync-server && npm install && npm run build && cd ..
# 编译 wasm
cargo build --target wasm32-wasip2 --release
cp target/wasm32-wasip2/release/zed_sftp.wasm extension.wasm
```

然后在 Zed 中：命令面板 → `zed: extensions` → **Install Dev Extension** → 选 `zed-sftp` 目录。

---

## 快速开始

在你的项目根目录创建 `.zed/sftp.json`：

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

保存任意文件 → 自动上传到 `/srv/myapp/<相对路径>`。

📖 **完整配置参考：[CONFIGURATION.md](./CONFIGURATION.md)**

---

## 在 AI 助手中使用（MCP 工具）

扩展同时提供 5 个 MCP 工具，可在 Zed AI 对话里手动调用：

| 工具 | 作用 |
|---|---|
| `sftp_upload_file` | 上传单个文件 |
| `sftp_download_file` | 下载远程文件 |
| `sftp_list_directory` | 列出远程目录 |
| `sftp_sync_directory` | 批量同步本地目录到远程（支持 `dry_run`） |
| `sftp_delete_remote` | 删除远程文件 |

---

## 项目结构

```
zed-sftp/
├── src/lib.rs              # Zed 扩展 wasm 入口（Rust）
├── extension.toml          # 扩展清单
├── sync-server/            # LSP + MCP 服务器（TypeScript）
│   ├── src/
│   │   ├── index.ts        # 入口：根据 --mcp 参数分发 LSP / MCP
│   │   ├── lsp-server.ts   # 监听 didSave 触发上传
│   │   ├── mcp-server.ts   # 暴露 MCP 工具
│   │   ├── config.ts       # 读 .zed/sftp.json
│   │   ├── sftp-client.ts  # ssh2-sftp-client 封装
│   │   └── ftp-client.ts   # basic-ftp 封装
│   └── package.json
├── CONFIGURATION.md        # 配置文档
└── PUBLISHING.md           # 发版流程
```

**两段架构：**
- **Rust wasm（`src/lib.rs`）** 在 Zed 沙箱中运行，负责"装依赖、拉 sync-server、告诉 Zed 怎么启动 LSP"。
- **Node.js sync-server** 是真正干活的进程，被 Zed spawn 成原生子进程。

---

## 开发

```bash
# 修改 Rust 后重新构建 wasm：
cargo build --target wasm32-wasip2 --release && cp target/wasm32-wasip2/release/zed_sftp.wasm extension.wasm

# 修改 sync-server 后重新编译：
cd sync-server && npm run build
```

修改完源码后，在 Zed extensions 面板找到 SFTP Sync → **Rebuild Dev Extension** 重新加载。

发版流程见 [PUBLISHING.md](./PUBLISHING.md)。

---

## License

[MIT](./LICENSE)
