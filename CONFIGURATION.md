# SFTP Sync 配置文档

本扩展通过工作区内的 **`.zed/sftp.json`** 配置文件工作 —— 保存任意文件时，扩展会沿目录向上查找该文件，按其中的规则把文件上传到远程服务器。

---

## 1. 配置文件位置

```
<workspace-root>/.zed/sftp.json
```

扩展会从被保存的文件所在目录起，逐级向上查找 `.zed/sftp.json`。**第一个命中的目录即为工作区根**，所有相对路径都以它为基准。

---

## 2. 最小可用示例

### SFTP（密码）

```json
{
  "protocol": "sftp",
  "host": "192.168.1.10",
  "username": "deploy",
  "password": "your-password",
  "remotePath": "/var/www/myapp"
}
```

保存任意文件时，扩展会用 SFTP 把 `<workspace>/src/app.ts` 上传到 `/var/www/myapp/src/app.ts`。

### SFTP（SSH 私钥，推荐）

```json
{
  "protocol": "sftp",
  "host": "example.com",
  "port": 22,
  "username": "deploy",
  "privateKeyPath": "~/.ssh/id_ed25519",
  "remotePath": "/srv/myapp"
}
```

### FTP / FTPS

```json
{
  "protocol": "ftps",
  "host": "ftp.example.com",
  "username": "ftpuser",
  "password": "secret",
  "remotePath": "/public_html"
}
```

---

## 3. 字段清单

### 服务器字段（顶层 或 profile 内均可）

| 字段 | 类型 | 必填 | 默认值 | 说明 |
|---|---|---|---|---|
| `protocol` | `"sftp" \| "ftp" \| "ftps"` | 否 | `"sftp"` | 传输协议 |
| `host` | string | **是** | — | 远程主机名或 IP |
| `port` | number | 否 | SFTP=22，FTP/FTPS=21 | 端口 |
| `username` | string | **是** | — | 登录用户名 |
| `password` | string | 视情况 | — | 密码（FTP/FTPS 通常必填；SFTP 在无私钥时必填） |
| `privateKeyPath` | string | 否 | — | SSH 私钥绝对/相对路径，支持 `~` 展开。**仅 SFTP**；存在时优先于 `password` |
| `remotePath` | string | **是** | `"/"` | 远程根目录，本地文件按相对路径映射到它下面 |

> **关于 `name` 字段：** 仅在 [多 Profile 模式](#4-多-profile-模式)下、写在 `profiles.<key>` 对象内时才会被识别，作为该 profile 的显示名使用。**单服务器模式（直接写在顶层）下的 `name` 会被静默忽略**，不会报错也不会生效。

### 全局选项（仅顶层）

| 字段 | 类型 | 默认值 | 说明 |
|---|---|---|---|
| `uploadOnSave` | boolean | `true` | 保存时是否自动上传，置 `false` 可临时关闭自动同步，只用 MCP 手动上传 |
| `ignore` | string[] | `[]` | 忽略上传的 glob 模式列表，详见 [§5](#5-ignore-忽略规则) |
| `profiles` | object | — | 多服务器模式，详见 [§4](#4-多-profile-模式) |
| `defaultProfile` | string | — | 多服务器模式下默认启用的 profile 键名 |

---

## 4. 多 Profile 模式

当你有多套环境（开发 / 预发 / 生产），使用 `profiles`：

```json
{
  "uploadOnSave": true,
  "ignore": ["node_modules", ".git", "dist", "*.log"],
  "defaultProfile": "dev",
  "profiles": {
    "dev": {
      "name": "开发服务器",
      "protocol": "sftp",
      "host": "10.0.0.5",
      "username": "dev",
      "privateKeyPath": "~/.ssh/id_ed25519",
      "remotePath": "/home/dev/projects/myapp"
    },
    "staging": {
      "name": "预发布",
      "protocol": "sftp",
      "host": "staging.example.com",
      "username": "deploy",
      "privateKeyPath": "~/.ssh/id_ed25519",
      "remotePath": "/var/www/staging/myapp"
    },
    "prod": {
      "name": "生产（禁用自动同步）",
      "protocol": "sftp",
      "host": "prod.example.com",
      "username": "deploy",
      "privateKeyPath": "~/.ssh/id_ed25519_prod",
      "remotePath": "/var/www/prod/myapp"
    }
  }
}
```

**规则：**
- `defaultProfile` 必须与 `profiles` 的某个键对应，找不到则配置失效（不会上传）。
- 顶层的 `uploadOnSave`、`ignore` 是全局基线，profile 内的同名字段会覆盖。
- 切换环境时改 `defaultProfile` 的值即可，无需删改其他 profile。

> ⚠️ 当前版本只识别 `defaultProfile`；如需快速在多 profile 间切换，编辑此字段后保存任意文件即可生效（配置基于 mtime 缓存，会自动刷新）。

---

## 5. `ignore` 忽略规则

`ignore` 是 [minimatch](https://github.com/isaacs/minimatch) 风格的 glob 数组。匹配是相对工作区根的 **POSIX 风格相对路径**。

```json
{
  "ignore": [
    "node_modules",
    ".git",
    "dist",
    "build",
    "*.log",
    ".env*",
    "**/*.tmp",
    "coverage"
  ]
}
```

**匹配规则（同时生效，命中其一即忽略）：**

1. **直接匹配** `rel`（启用 `matchBase` 和 `dot`）
   - `"*.log"` → 命中 `error.log`、`logs/server.log`（matchBase 让裸文件名模式跨层级匹配）
   - `".env*"` → 命中 `.env`、`.env.local`
2. **目录展开匹配** `${pattern}/**`
   - `"node_modules"` → 命中 `node_modules/foo/bar.js`、`packages/a/node_modules/...`
   - `"dist"` → 命中 `dist/index.js`

**实用模式：**

| 想忽略 | 写法 |
|---|---|
| 整个目录（任意层级） | `"node_modules"`、`"dist"` |
| 根目录下的特定文件 | `".env.production"` |
| 所有 `.log` 文件 | `"*.log"` |
| 仅根目录的 `tmp/` | `"tmp"`（注意：会同时匹配嵌套的 `tmp/`） |
| 特定后缀 | `"**/*.snap"` |

---

## 6. 路径映射

```
本地: <workspace>/src/components/Button.tsx
远程: <remotePath>/src/components/Button.tsx
```

- 工作区根 = 包含 `.zed/sftp.json` 的目录
- Windows 路径中的 `\` 会自动转为 `/`
- `remotePath` 末尾的 `/` 会被去除后拼接，因此 `"/var/www"` 和 `"/var/www/"` 等价
- 远程目录不存在时自动 `mkdir -p`

---

## 7. 认证规则

### SFTP

1. 如果 `privateKeyPath` 已配置 **且该文件存在** → 使用密钥认证
2. 否则使用 `password` 密码认证
3. 两者都没有 → 报错 `"SFTP: privateKeyPath 或 password 必须提供其一"`

> 私钥路径支持 `~` 展开：`"~/.ssh/id_rsa"` 自动转为 `C:\Users\<user>\.ssh\id_rsa`（Windows）或 `/home/<user>/.ssh/id_rsa`（Linux/macOS）。

### FTP / FTPS

只支持 `username + password`，`privateKeyPath` 会被忽略。

---

## 8. 连接复用

- 相同 `protocol + username + host + port + remotePath` 共享一条连接
- 空闲 **5 分钟**自动断开，下次保存时按需重连
- Profile 切换会自动开新连接（key 中含 remotePath）

---

## 9. 通过 MCP 手动操作

除了"保存即上传"，扩展同时提供 MCP 工具用于手动同步。在 Zed 的 AI 助手或其它 MCP 客户端中可调用：

| 工具名 | 作用 | 参数 |
|---|---|---|
| `sftp_upload_file` | 上传单个文件 | `local_path`（必填），`remote_path`（可选） |
| `sftp_download_file` | 下载远程文件 | `remote_path`（必填），`local_path`（可选） |
| `sftp_list_directory` | 列出远程目录 | `remote_path`（可选，默认 `remotePath`） |
| `sftp_sync_directory` | 批量上传整个本地目录（增量，不删远程） | `local_dir`（必填），`dry_run`（可选） |
| `sftp_delete_remote` | 删除远程文件 | `remote_path`（必填） |

> MCP server 启动方式：`node sync-server/dist/index.js --mcp`（默认 stdio 通信）。

---

## 10. 完整示例（生产级）

```json
{
  "uploadOnSave": true,
  "ignore": [
    ".git",
    "node_modules",
    "dist",
    "build",
    "target",
    "coverage",
    ".next",
    ".cache",
    "*.log",
    ".env*",
    ".DS_Store",
    "Thumbs.db",
    "**/*.tmp",
    "**/*.swp"
  ],
  "defaultProfile": "dev",
  "profiles": {
    "dev": {
      "name": "Dev (内网)",
      "protocol": "sftp",
      "host": "10.0.0.20",
      "port": 22,
      "username": "deploy",
      "privateKeyPath": "~/.ssh/id_ed25519",
      "remotePath": "/srv/apps/myproject"
    },
    "staging": {
      "name": "Staging",
      "protocol": "sftp",
      "host": "staging.example.com",
      "username": "deploy",
      "privateKeyPath": "~/.ssh/id_ed25519",
      "remotePath": "/var/www/staging/myproject"
    },
    "legacy-ftp": {
      "name": "旧 FTP 主机",
      "protocol": "ftps",
      "host": "ftp.example.com",
      "port": 21,
      "username": "webuser",
      "password": "<secret>",
      "remotePath": "/htdocs"
    }
  }
}
```

---

## 11. 常见问题

**Q: 保存了文件但没有上传？**
- 检查输出面板 (`zed: open log`) 是否有 `[sftp-sync]` 日志
- 确认 `uploadOnSave` 不是 `false`
- 确认文件不在 `ignore` 命中范围内
- 多 profile 模式下确认 `defaultProfile` 拼写正确

**Q: 想临时关闭自动同步？**
- 把顶层（或 profile 内）`uploadOnSave` 改为 `false`，配置会在保存下一个文件时刷新

**Q: 配置文件是否会被同步上传？**
- 会。如果不想暴露密钥/密码，请把 `.zed/sftp.json` 写进 `ignore`，或使用密钥认证 + `.zed/sftp.json` 不写明文密码。

**Q: 密码存在文件里不安全？**
- 推荐使用 `privateKeyPath` 走 SSH 密钥认证；如必须用密码，请把 `.zed/sftp.json` 加入项目 `.gitignore` 并避免推到远端。

**Q: 切换 profile 后旧连接还在吗？**
- 旧连接会保留 5 分钟空闲超时后自动断开，不影响新 profile 工作。
