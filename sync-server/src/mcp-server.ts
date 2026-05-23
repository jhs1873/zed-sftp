import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import * as fs from "fs";
import * as path from "path";
import { ConfigManager } from "./config";
import { connectionPool } from "./connection-pool";
import { toRemotePath } from "./path-mapper";
import { isIgnored } from "./ignore-filter";

const configManager = new ConfigManager();

function findWorkspaceRoot(filePath: string): string | null {
  let dir = path.isAbsolute(filePath) ? path.dirname(filePath) : process.cwd();
  while (true) {
    if (fs.existsSync(path.join(dir, ".zed", "sftp.json"))) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

async function getClientForCwd(): Promise<{ client: any; config: any; root: string } | null> {
  const root = findWorkspaceRoot(process.cwd());
  if (!root) return null;
  const sentinel = path.join(root, ".zed", "sftp.json");
  const config = await configManager.getConfig(sentinel);
  if (!config) return null;
  const client = await connectionPool.getClient(config);
  return { client, config, root };
}

export async function startMcpServer(): Promise<void> {
  const server = new Server(
    { name: "sftp-sync", version: "0.1.0" },
    { capabilities: { tools: {} } }
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: [
      {
        name: "sftp_upload_file",
        description: "上传本地文件到远程服务器",
        inputSchema: {
          type: "object",
          properties: {
            local_path: { type: "string", description: "本地文件绝对路径" },
            remote_path: { type: "string", description: "远程路径（可选，默认按配置映射）" },
          },
          required: ["local_path"],
        },
      },
      {
        name: "sftp_download_file",
        description: "从远程服务器下载文件到本地",
        inputSchema: {
          type: "object",
          properties: {
            remote_path: { type: "string", description: "远程文件路径" },
            local_path: { type: "string", description: "本地保存路径（可选）" },
          },
          required: ["remote_path"],
        },
      },
      {
        name: "sftp_list_directory",
        description: "列出远程目录内容",
        inputSchema: {
          type: "object",
          properties: {
            remote_path: { type: "string", description: "远程目录路径（可选，默认为 remotePath）" },
          },
        },
      },
      {
        name: "sftp_sync_directory",
        description: "将本地目录同步到远程（仅上传，不删除远程多余文件）",
        inputSchema: {
          type: "object",
          properties: {
            local_dir: { type: "string", description: "本地目录路径" },
            dry_run: { type: "boolean", description: "仅预览，不实际上传" },
          },
          required: ["local_dir"],
        },
      },
      {
        name: "sftp_delete_remote",
        description: "删除远程文件",
        inputSchema: {
          type: "object",
          properties: {
            remote_path: { type: "string", description: "远程文件路径" },
          },
          required: ["remote_path"],
        },
      },
    ],
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    try {
      const ctx = await getClientForCwd();
      if (!ctx) {
        return { content: [{ type: "text", text: "错误：未找到 .zed/sftp.json 配置文件" }] };
      }
      const { client, config, root } = ctx;

      if (name === "sftp_upload_file") {
        const localPath = args?.local_path as string;
        const remotePath = (args?.remote_path as string | undefined) ?? toRemotePath(localPath, root, config);
        await client.upload(localPath, remotePath);
        return { content: [{ type: "text", text: `上传成功: ${localPath} → ${remotePath}` }] };
      }

      if (name === "sftp_download_file") {
        const remotePath = args?.remote_path as string;
        const localPath = (args?.local_path as string | undefined) ??
          path.join(root, path.relative(config.remotePath, remotePath));
        await client.download(remotePath, localPath);
        return { content: [{ type: "text", text: `下载成功: ${remotePath} → ${localPath}` }] };
      }

      if (name === "sftp_list_directory") {
        const remotePath = (args?.remote_path as string | undefined) ?? config.remotePath;
        const entries = await client.list(remotePath);
        const lines = entries.map((e: any) =>
          `${e.type === "dir" ? "📁" : "📄"} ${e.name}  (${e.size} bytes, ${e.modifiedAt?.toISOString() ?? "-"})`
        );
        return { content: [{ type: "text", text: lines.join("\n") || "（空目录）" }] };
      }

      if (name === "sftp_sync_directory") {
        const localDir = args?.local_dir as string;
        const dryRun = (args?.dry_run as boolean | undefined) ?? false;
        const results = await syncDirectory(client, config, localDir, root, dryRun);
        const summary = dryRun ? `[预览] 待上传 ${results.length} 个文件:\n` : `上传完成 ${results.length} 个文件:\n`;
        return { content: [{ type: "text", text: summary + results.join("\n") }] };
      }

      if (name === "sftp_delete_remote") {
        const remotePath = args?.remote_path as string;
        await client.delete(remotePath);
        return { content: [{ type: "text", text: `已删除: ${remotePath}` }] };
      }

      return { content: [{ type: "text", text: `未知工具: ${name}` }] };
    } catch (err: any) {
      return { content: [{ type: "text", text: `错误: ${err?.message ?? String(err)}` }] };
    }
  });

  const transport = new StdioServerTransport();
  await server.connect(transport);
}

async function syncDirectory(
  client: any,
  config: any,
  localDir: string,
  root: string,
  dryRun: boolean
): Promise<string[]> {
  const uploaded: string[] = [];
  const walk = (dir: string) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (isIgnored(full, root, config)) continue;
      if (entry.isDirectory()) {
        walk(full);
      } else {
        const remotePath = toRemotePath(full, root, config);
        if (!dryRun) client.upload(full, remotePath);
        uploaded.push(`${full} → ${remotePath}`);
      }
    }
  };
  walk(localDir);
  return uploaded;
}
