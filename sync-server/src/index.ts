import { connectionPool } from "./connection-pool";
import { startLspServer } from "./lsp-server";
import { startMcpServer } from "./mcp-server";

const mode = process.argv[2];

connectionPool.startCleanup();

if (mode === "--mcp") {
  // MCP 模式：通过 MCP 协议提供手动操作工具
  startMcpServer().catch((err) => {
    console.error("[sftp-sync] MCP server 启动失败:", err);
    process.exit(1);
  });
} else {
  // 默认 LSP 模式（--stdio）：Zed 启动时使用
  startLspServer();
}
