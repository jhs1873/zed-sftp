import SftpClient from "ssh2-sftp-client";
import * as path from "path";
import * as fs from "fs";
import { RemoteClient, RemoteFileInfo } from "./remote-client";
import { ServerConfig } from "./config";

export class SftpRemoteClient implements RemoteClient {
  private client = new SftpClient();
  private connected = false;

  isConnected(): boolean {
    return this.connected;
  }

  async connect(config: ServerConfig): Promise<void> {
    const opts: SftpClient.ConnectOptions = {
      host: config.host,
      port: config.port ?? 22,
      username: config.username,
    };

    if (config.privateKeyPath && fs.existsSync(config.privateKeyPath)) {
      opts.privateKey = fs.readFileSync(config.privateKeyPath);
    } else if (config.password) {
      opts.password = config.password;
    } else {
      throw new Error("SFTP: privateKeyPath 或 password 必须提供其一");
    }

    await this.client.connect(opts);
    this.connected = true;
  }

  async disconnect(): Promise<void> {
    await this.client.end();
    this.connected = false;
  }

  async upload(localPath: string, remotePath: string): Promise<void> {
    const remoteDir = path.posix.dirname(remotePath);
    await this.client.mkdir(remoteDir, true);
    await this.client.put(localPath, remotePath);
  }

  async download(remotePath: string, localPath: string): Promise<void> {
    const localDir = path.dirname(localPath);
    if (!fs.existsSync(localDir)) fs.mkdirSync(localDir, { recursive: true });
    await this.client.get(remotePath, localPath);
  }

  async list(remotePath: string): Promise<RemoteFileInfo[]> {
    const entries = await this.client.list(remotePath);
    return entries.map((e) => ({
      name: e.name,
      type: e.type === "d" ? "dir" : e.type === "l" ? "symlink" : "file",
      size: e.size,
      modifiedAt: new Date(e.modifyTime),
      remotePath: `${remotePath.replace(/\/$/, "")}/${e.name}`,
    }));
  }

  async delete(remotePath: string): Promise<void> {
    await this.client.delete(remotePath);
  }

  async ensureDir(remotePath: string): Promise<void> {
    await this.client.mkdir(remotePath, true);
  }
}
