import { minimatch } from "minimatch";
import * as path from "path";
import { ServerConfig } from "./config";

export function isIgnored(localFile: string, workspaceRoot: string, config: ServerConfig): boolean {
  const rel = path.relative(workspaceRoot, localFile).split(path.sep).join("/");
  for (const pattern of config.ignore ?? []) {
    if (minimatch(rel, pattern, { dot: true, matchBase: true })) return true;
    // 也检查路径中包含被忽略目录的情况（如 node_modules/foo/bar.js）
    if (minimatch(rel, `${pattern}/**`, { dot: true })) return true;
  }
  return false;
}
