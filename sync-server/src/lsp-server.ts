import {
  createConnection,
  TextDocumentSyncKind,
  ProposedFeatures,
  InitializeResult,
} from "vscode-languageserver/node";
import { URI } from "vscode-uri";
import * as path from "path";
import { ConfigManager } from "./config";
import { connectionPool } from "./connection-pool";
import { isIgnored } from "./ignore-filter";
import { toRemotePath } from "./path-mapper";

export function startLspServer(): void {
  const connection = createConnection(ProposedFeatures.all, process.stdin, process.stdout);
  const configManager = new ConfigManager();

  connection.onInitialize((): InitializeResult => ({
    capabilities: {
      textDocumentSync: {
        openClose: false,
        change: TextDocumentSyncKind.None,
        save: true, // 只需要 didSave，不需要内容同步
      },
    },
  }));

  connection.onDidSaveTextDocument(async (params) => {
    const localPath = URI.parse(params.textDocument.uri).fsPath;
    const config = await configManager.getConfig(localPath);

    if (!config) return;
    if (!config.uploadOnSave) return;

    // 找到 workspace root（config 所在目录）
    const workspaceRoot = findWorkspaceRoot(localPath);
    if (!workspaceRoot) return;

    if (isIgnored(localPath, workspaceRoot, config)) {
      connection.console.log(`[sftp-sync] 忽略: ${localPath}`);
      return;
    }

    const remotePath = toRemotePath(localPath, workspaceRoot, config);

    try {
      const client = await connectionPool.getClient(config);
      await client.upload(localPath, remotePath);
      connection.console.log(`[sftp-sync] 上传成功: ${path.basename(localPath)} → ${remotePath}`);
    } catch (err: any) {
      connection.console.error(`[sftp-sync] 上传失败: ${localPath}\n${err?.message ?? err}`);
    }
  });

  connection.listen();
}

function findWorkspaceRoot(filePath: string): string | null {
  const fs = require("fs");
  let dir = path.dirname(filePath);
  while (true) {
    if (fs.existsSync(path.join(dir, ".zed", "sftp.json"))) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}
