import { ServerConfig } from "./config";

export interface RemoteFileInfo {
  name: string;
  type: "file" | "dir" | "symlink";
  size: number;
  modifiedAt: Date;
  remotePath: string;
}

export interface RemoteClient {
  connect(config: ServerConfig): Promise<void>;
  disconnect(): Promise<void>;
  isConnected(): boolean;
  upload(localPath: string, remotePath: string): Promise<void>;
  download(remotePath: string, localPath: string): Promise<void>;
  list(remotePath: string): Promise<RemoteFileInfo[]>;
  delete(remotePath: string): Promise<void>;
  ensureDir(remotePath: string): Promise<void>;
}

export function createClient(protocol: "sftp" | "ftp" | "ftps"): RemoteClient {
  if (protocol === "sftp") {
    // 动态 require 避免在 FTP 模式下加载 SSH2
    const { SftpRemoteClient } = require("./sftp-client");
    return new SftpRemoteClient();
  }
  const { FtpRemoteClient } = require("./ftp-client");
  return new FtpRemoteClient(protocol === "ftps");
}
