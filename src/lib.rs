use zed_extension_api::{self as zed, LanguageServerId, Result};

/// 必须与 extension.toml 中的 version 保持一致：发布 Zed 扩展时打的 git tag
/// 对应 GitHub Release 的 `vX.Y.Z`，本扩展会从那里拉取预编译好的 sync-server。
const SERVER_VERSION: &str = "0.1.0";
const RELEASE_BASE: &str = "https://github.com/jhs1873/zed-sftp/releases/download";
/// tar.gz 内部布局：dist/、package.json、package-lock.json（无 node_modules）。
/// 解压目标是 work_dir/sync-server，运行入口为 work_dir/sync-server/dist/index.js。
const SERVER_DIR: &str = "sync-server";
const SERVER_ENTRY_REL: &str = "sync-server/dist/index.js";

struct SftpSyncExtension {
    server_installed: bool,
}

impl zed::Extension for SftpSyncExtension {
    fn new() -> Self {
        Self {
            server_installed: false,
        }
    }

    fn language_server_command(
        &mut self,
        language_server_id: &LanguageServerId,
        _worktree: &zed::Worktree,
    ) -> Result<zed::Command> {
        if !self.server_installed {
            self.install_server(language_server_id)?;
        }

        // Zed 启动 LSP 时 cwd 是用户的项目根目录，必须传绝对路径。
        // wasm sandbox 的 cwd = work_dir，sync-server 也解压在 work_dir 下，所以从这里拼。
        let work_dir = std::env::current_dir()
            .map_err(|e| format!("无法获取扩展工作目录: {e}"))?;
        let server_script = work_dir.join(SERVER_ENTRY_REL);

        Ok(zed::Command {
            command: zed::node_binary_path()?,
            args: vec![server_script.to_string_lossy().into_owned()],
            env: Default::default(),
        })
    }
}

impl SftpSyncExtension {
    fn install_server(&mut self, language_server_id: &LanguageServerId) -> Result<()> {
        zed::set_language_server_installation_status(
            language_server_id,
            &zed::LanguageServerInstallationStatus::CheckingForUpdate,
        );

        // 1) 运行时 npm 依赖：Zed 把它们装到 work_dir/node_modules。
        //    Node 加载 work_dir/sync-server/dist/index.js 时，require 会向上找到这里。
        let packages = [
            ("ssh2-sftp-client", "10.0.3"),
            ("basic-ftp", "5.0.5"),
            ("minimatch", "9.0.4"),
            ("vscode-languageserver", "9.0.1"),
            ("vscode-languageserver-textdocument", "1.0.11"),
            ("vscode-uri", "3.0.8"),
            ("@modelcontextprotocol/sdk", "1.10.2"),
        ];

        for (pkg, version) in &packages {
            let installed = zed::npm_package_installed_version(pkg)?;
            if installed.is_none() {
                zed::set_language_server_installation_status(
                    language_server_id,
                    &zed::LanguageServerInstallationStatus::Downloading,
                );
                zed::npm_install_package(pkg, version)?;
            }
        }

        // 2) sync-server 编译产物：从 GitHub Releases 拉对应版本的 tar.gz，
        //    GzipTar 类型会自动解压到 SERVER_DIR/ 下。
        //    判断是否需要重新下载：用入口文件是否存在 + 当前是否已是目标版本来粗判。
        //    这里简化为"入口缺失则重新下载"，版本字符串变化触发的更新由用户重装扩展处理。
        let server_entry = std::path::Path::new(SERVER_ENTRY_REL);
        if !server_entry.exists() {
            zed::set_language_server_installation_status(
                language_server_id,
                &zed::LanguageServerInstallationStatus::Downloading,
            );
            let url = format!("{RELEASE_BASE}/v{SERVER_VERSION}/sync-server.tar.gz");
            zed::download_file(&url, SERVER_DIR, zed::DownloadedFileType::GzipTar)
                .map_err(|e| format!("下载 sync-server 失败 ({url}): {e}"))?;
        }

        zed::set_language_server_installation_status(
            language_server_id,
            &zed::LanguageServerInstallationStatus::None,
        );

        self.server_installed = true;
        Ok(())
    }
}

zed::register_extension!(SftpSyncExtension);
