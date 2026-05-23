# 发布流程

本扩展由两部分组成，发布时必须保证版本号一致：

| 组件 | 文件 | 说明 |
|---|---|---|
| Zed 扩展元数据 | `extension.toml` 的 `version` | 提交到 Zed Extension Registry |
| 扩展 wasm 模块 | `Cargo.toml` 的 `version`（可选，不强制对外） | 由 Registry CI 编译 |
| 服务器版本常量 | `src/lib.rs` 的 `SERVER_VERSION` | wasm 用它拼接 download URL |
| sync-server | `sync-server/package.json` 的 `version` | tar.gz 内嵌 |

CI 的第一个 step 会校验四个版本是否一致，不一致直接 fail。

---

## 标准发版流程（每次发布）

### 1. 同步版本号

把同一个版本号写到 4 处（以 `0.1.1` 为例）：

```bash
# 1) extension.toml
sed -i 's/^version = ".*"/version = "0.1.1"/' extension.toml

# 2) src/lib.rs
sed -i 's/SERVER_VERSION: &str = ".*"/SERVER_VERSION: \&str = "0.1.1"/' src/lib.rs

# 3) sync-server/package.json
cd sync-server && npm version 0.1.1 --no-git-tag-version && cd ..

# 4) Cargo.toml（可选）
sed -i 's/^version = ".*"/version = "0.1.1"/' Cargo.toml
```

> Windows / Git Bash 下可用同样命令；如果 `sed -i` 报错，手工编辑这 4 个文件即可。

### 2. 提交并打 tag

```bash
git add extension.toml src/lib.rs sync-server/package.json Cargo.toml Cargo.lock
git commit -m "release: v0.1.1"
git tag v0.1.1
git push origin main --tags
```

### 3. GitHub Actions 自动产出 Release

- `.github/workflows/release.yml` 在 tag 推送时触发
- 它会：编译 sync-server → 打包 `sync-server.tar.gz` → 创建 GitHub Release 并上传
- 完成后 `https://github.com/jhs1873/zed-sftp/releases/download/v0.1.1/sync-server.tar.gz` 即可访问

### 4. 提交到 Zed Extension Registry

**首次提交**和**升级**步骤不同，分别说明：

#### 4a. 首次提交（仅做一次）

```bash
# 1) Fork 官方 registry
#    访问 https://github.com/zed-industries/extensions 点击 Fork

# 2) 克隆你 fork 的仓库
git clone https://github.com/jhs1873/extensions.git
cd extensions

# 3) 把你的扩展仓库作为 submodule 加入 extensions/ 目录
git submodule add https://github.com/jhs1873/zed-sftp.git extensions/sftp-sync

# 4) 切到对应 tag
cd extensions/sftp-sync
git checkout v0.1.0
cd ../..

# 5) 在 registry 根目录的 extensions.toml 里添加条目（按字母顺序插入）
```

把以下内容追加到 `extensions.toml`（注意字母顺序）：

```toml
[sftp-sync]
submodule = "extensions/sftp-sync"
version = "0.1.0"
```

继续：

```bash
# 6) 提交 + push 到 fork
git add .gitmodules extensions/sftp-sync extensions.toml
git commit -m "Add SFTP Sync extension"
git push origin main

# 7) 在浏览器打开你的 fork，点击 "Compare & pull request" 创建 PR
#    PR 标题示例：Add SFTP Sync extension
#    PR 描述写清扩展用途 + 链接到 README
```

PR 通过 Zed 团队审核合并后，扩展会自动出现在 Zed 内的 Extensions 面板里。

#### 4b. 升级版本

```bash
cd extensions  # 上次 fork 出来的目录
git pull origin main         # 同步 upstream 最新
cd extensions/sftp-sync
git fetch
git checkout v0.1.1          # 切到新 tag
cd ../..

# 修改 extensions.toml 里的 version 字段
sed -i 's/^version = ".*"/version = "0.1.1"/' extensions.toml  # 注意只改 [sftp-sync] 段下的

git add extensions/sftp-sync extensions.toml
git commit -m "Bump SFTP Sync to v0.1.1"
git push origin main
# 再次创建 PR
```

---

## 本地端到端预演（首次发版前强烈建议）

完整模拟一次"打包 → 上传 → 下载 → 启动"流程，不需要真发 GitHub Release：

```bash
# 1) 编译 sync-server
cd sync-server && npm ci && npm run build && cd ..

# 2) 本地打包
cd sync-server
tar -czf ../sync-server.tar.gz dist package.json package-lock.json
cd ..

# 3) 在仓库根目录起一个本地 HTTP server
python -m http.server 8000  # 或：npx http-server -p 8000

# 4) 临时改 src/lib.rs 的 RELEASE_BASE：
#    const RELEASE_BASE: &str = "http://localhost:8000";
#    然后把目录结构也对齐为 ./v0.1.0/sync-server.tar.gz
mkdir -p v0.1.0 && mv sync-server.tar.gz v0.1.0/

# 5) 重新构建 wasm + Rebuild Dev Extension
cargo build --target wasm32-wasip2 --release
cp target/wasm32-wasip2/release/zed_sftp.wasm extension.wasm
# 在 Zed 里 Rebuild Dev Extension

# 6) 删掉 Zed work_dir 下的 sync-server 强制重新下载验证：
rm -rf ~/AppData/Local/Zed/extensions/work/sftp-sync/sync-server
# 或在 macOS / Linux：
# rm -rf ~/Library/Application\ Support/Zed/extensions/work/sftp-sync/sync-server

# 7) 在 Zed 中保存一个文件，看是否触发下载并成功启动 LSP

# 8) 验证通过后：把 lib.rs 的 RELEASE_BASE 改回 GitHub 地址，重新 build
```

---

## 常见坑

**Q: tag 推了但 Release 没产出？**  
→ 检查 `.github/workflows/release.yml` 是否在 main 分支上（workflow 必须先于 tag 进 main），以及 Actions 的 `contents: write` 权限。

**Q: Release 产出了但用户安装扩展时报 "下载 sync-server 失败"？**  
→ 在浏览器手动访问 `https://github.com/jhs1873/zed-sftp/releases/download/v<VERSION>/sync-server.tar.gz`，确认能下载。注意 `v` 前缀。

**Q: 升级版本后老用户没拉到新 sync-server？**  
→ 当前 `lib.rs` 的判断逻辑是"入口文件存在就跳过下载"。版本切换时旧版 sync-server 还在 work 目录。如果要强制更新，可改为根据某个版本标记文件判断；或者让用户重装扩展（最干净）。

**Q: 测试时 Zed 总是用缓存的 sync-server？**  
→ 删除 `<Zed_data_dir>/extensions/work/sftp-sync/sync-server` 目录后 Rebuild Dev Extension。

---

## Checklist（每次发版照着走一遍）

- [ ] 4 处版本号已同步（extension.toml / lib.rs / package.json / Cargo.toml）
- [ ] `cargo build --target wasm32-wasip2 --release` 本地通过
- [ ] `cd sync-server && npm ci && npm run build` 本地通过
- [ ] CONFIGURATION.md 中如有新增字段，文档已更新
- [ ] `git push --tags` 后 GitHub Actions 显示 success
- [ ] Release 页面能下到 `sync-server.tar.gz`
- [ ] 在 Zed 里通过 Install Dev Extension 复现一遍能正常工作
- [ ] （正式发版）已向 zed-industries/extensions 提交 / 更新 PR
