import { RemoteClient, createClient } from "./remote-client";
import { ServerConfig } from "./config";

interface PoolEntry {
  client: RemoteClient;
  config: ServerConfig;
  lastUsed: number;
}

const IDLE_TIMEOUT_MS = 5 * 60 * 1000; // 5分钟无操作则断开

export class ConnectionPool {
  private pool = new Map<string, PoolEntry>();

  private key(config: ServerConfig): string {
    return `${config.protocol}://${config.username}@${config.host}:${config.port ?? (config.protocol === "sftp" ? 22 : 21)}${config.remotePath}`;
  }

  async getClient(config: ServerConfig): Promise<RemoteClient> {
    const k = this.key(config);
    const entry = this.pool.get(k);

    if (entry && entry.client.isConnected()) {
      entry.lastUsed = Date.now();
      return entry.client;
    }

    // 旧连接已断开，清理
    if (entry) this.pool.delete(k);

    const client = createClient(config.protocol);
    await client.connect(config);
    this.pool.set(k, { client, config, lastUsed: Date.now() });
    return client;
  }

  // 定期清理空闲连接
  startCleanup(): void {
    setInterval(() => {
      const now = Date.now();
      for (const [k, entry] of this.pool) {
        if (now - entry.lastUsed > IDLE_TIMEOUT_MS) {
          entry.client.disconnect().catch(() => {});
          this.pool.delete(k);
        }
      }
    }, 60_000);
  }
}

export const connectionPool = new ConnectionPool();
