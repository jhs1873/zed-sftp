import * as path from "path";
import { ServerConfig } from "./config";

export function toRemotePath(localFile: string, workspaceRoot: string, config: ServerConfig): string {
  const rel = path.relative(workspaceRoot, localFile);
  // 统一用正斜杠（远程通常是 Linux）
  const relPosix = rel.split(path.sep).join("/");
  const remoteBase = config.remotePath.replace(/\/$/, "");
  return `${remoteBase}/${relPosix}`;
}

export function workspaceRootFromFile(localFile: string, configRoot: string): string {
  return configRoot;
}
