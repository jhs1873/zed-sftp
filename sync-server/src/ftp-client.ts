import { Client, FileInfo } from "basic-ftp";
import * as path from "path";
import * as fs from "fs";
import { RemoteClient, RemoteFileInfo } from "./remote-client";
import { ServerConfig } from "./config";

export class FtpRemoteClient implements RemoteClient {
  private client = new Client();
  private secure: boolean;
  private connected = false;

  constructor(secure: boolean) {
    this.secure = secure;
  }

  isConnected(): boolean {
    return this.connected && !this.client.closed;
  }

  async connect(config: ServerConfig): Promise<void> {
    await this.client.access({
      host: config.host,
      port: config.port ?? 21,
      user: config.username,
      password: config.password ?? "",
      secure: this.secure,
    });
    this.connected = true;
  }

  async disconnect(): Promise<void> {
    this.client.close();
    this.connected = false;
  }

  async upload(localPath: string, remotePath: string): Promise<void> {
    const remoteDir = path.posix.dirname(remotePath);
    const remoteFile = path.posix.basename(remotePath);
    await this.client.ensureDir(remoteDir);
    await this.client.uploadFrom(localPath, remoteFile);
  }

  async download(remotePath: string, localPath: string): Promise<void> {
    const localDir = path.dirname(localPath);
    if (!fs.existsSync(localDir)) fs.mkdirSync(localDir, { recursive: true });
    await this.client.downloadTo(localPath, remotePath);
  }

  async list(remotePath: string): Promise<RemoteFileInfo[]> {
    const entries: FileInfo[] = await this.client.list(remotePath);
    return entries.map((e) => ({
      name: e.name,
      type: e.isDirectory ? "dir" : e.isSymbolicLink ? "symlink" : "file",
      size: e.size,
      modifiedAt: e.modifiedAt ?? new Date(0),
      remotePath: `${remotePath.replace(/\/$/, "")}/${e.name}`,
    }));
  }

  async delete(remotePath: string): Promise<void> {
    await this.client.remove(remotePath);
  }

  async ensureDir(remotePath: string): Promise<void> {
    await this.client.ensureDir(remotePath);
  }
}
