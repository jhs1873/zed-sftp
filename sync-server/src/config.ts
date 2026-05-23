import * as fs from "fs";
import * as path from "path";
import * as os from "os";

export type Protocol = "sftp" | "ftp" | "ftps";

export interface ServerConfig {
  name?: string;
  protocol: Protocol;
  host: string;
  port?: number;
  username: string;
  password?: string;
  privateKeyPath?: string;
  remotePath: string;
  uploadOnSave?: boolean;
  ignore?: string[];
  context?: string;
}

export interface SftpConfig {
  uploadOnSave?: boolean;
  ignore?: string[];
  profiles?: Record<string, Partial<ServerConfig>>;
  defaultProfile?: string;
  context?: string;
  // root-level server fields (single-server mode)
  protocol?: Protocol;
  host?: string;
  port?: number;
  username?: string;
  password?: string;
  privateKeyPath?: string;
  remotePath?: string;
}

export class ConfigManager {
  private cache = new Map<string, { config: ServerConfig; mtime: number }>();

  async getConfig(localFilePath: string): Promise<ServerConfig | null> {
    const workspaceRoot = this.findWorkspaceRoot(localFilePath);
    if (!workspaceRoot) return null;

    const configPath = path.join(workspaceRoot, ".zed", "sftp.json");
    if (!fs.existsSync(configPath)) return null;

    const stat = fs.statSync(configPath);
    const cached = this.cache.get(configPath);
    if (cached && cached.mtime === stat.mtimeMs) return cached.config;

    try {
      const raw: SftpConfig = JSON.parse(fs.readFileSync(configPath, "utf-8"));
      const config = this.resolve(raw, workspaceRoot);
      if (!config) return null;
      this.cache.set(configPath, { config, mtime: stat.mtimeMs });
      return config;
    } catch {
      return null;
    }
  }

  private resolve(raw: SftpConfig, workspaceRoot: string): ServerConfig | null {
    let base: Partial<ServerConfig> = {
      uploadOnSave: raw.uploadOnSave ?? true,
      ignore: raw.ignore ?? [],
    };

    // 多 Profile 模式
    if (raw.profiles && raw.defaultProfile) {
      const profile = raw.profiles[raw.defaultProfile];
      if (!profile) return null;
      base = { ...base, ...profile };
    } else if (raw.host) {
      // 单服务器模式
      base = {
        ...base,
        protocol: raw.protocol ?? "sftp",
        host: raw.host,
        port: raw.port,
        username: raw.username ?? "",
        password: raw.password,
        privateKeyPath: raw.privateKeyPath,
        remotePath: raw.remotePath ?? "/",
      };
    } else {
      return null;
    }

    // 展开 ~ 路径
    if (base.privateKeyPath?.startsWith("~")) {
      base.privateKeyPath = path.join(os.homedir(), base.privateKeyPath.slice(1));
    }

    if (!base.host || !base.username || !base.remotePath) return null;

    return {
      protocol: base.protocol ?? "sftp",
      host: base.host,
      port: base.port,
      username: base.username,
      password: base.password,
      privateKeyPath: base.privateKeyPath,
      remotePath: base.remotePath,
      uploadOnSave: base.uploadOnSave ?? true,
      ignore: base.ignore ?? [],
      name: base.name,
    };
  }

  private findWorkspaceRoot(filePath: string): string | null {
    let dir = path.dirname(filePath);
    while (true) {
      if (fs.existsSync(path.join(dir, ".zed", "sftp.json"))) return dir;
      const parent = path.dirname(dir);
      if (parent === dir) return null;
      dir = parent;
    }
  }
}
