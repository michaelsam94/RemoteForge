import { Client, ClientChannel } from 'ssh2';
import * as vscode from 'vscode';
import { SshConnectConfig } from '../core/ssh/SshCredentials';
import { buildConnectConfig } from '../core/ssh/SshExecutor';

export class RemoteSshPseudoterminal implements vscode.Pseudoterminal {
  private readonly writeEmitter = new vscode.EventEmitter<string>();
  readonly onDidWrite = this.writeEmitter.event;

  private readonly closeEmitter = new vscode.EventEmitter<number | void>();
  readonly onDidClose = this.closeEmitter.event;

  private client?: Client;
  private stream?: ClientChannel;

  constructor(
    private readonly config: SshConnectConfig,
    private readonly remoteCwd: string
  ) {}

  open(): void {
    const client = new Client();
    this.client = client;

    client.on('ready', () => {
      client.shell({ cols: 120, rows: 30 }, (error, stream) => {
          if (error) {
            this.writeEmitter.fire(`\r\nRemoteForge SSH error: ${error.message}\r\n`);
            this.closeEmitter.fire(1);
            client.end();
            return;
          }

          this.stream = stream;
          stream.on('data', (chunk: Buffer | string) => {
            this.writeEmitter.fire(String(chunk));
          });
          stream.stderr.on('data', (chunk: Buffer | string) => {
            this.writeEmitter.fire(String(chunk));
          });
          stream.on('close', () => {
            client.end();
            this.closeEmitter.fire(0);
          });
          stream.write(`cd ${shellQuote(this.remoteCwd)}\n`);
          this.writeEmitter.fire(`\r\nRemoteForge connected: ${this.remoteCwd}\r\n`);
        }
      );
    });

    client.on('error', error => {
      this.writeEmitter.fire(`\r\nRemoteForge SSH error: ${error.message}\r\n`);
      this.closeEmitter.fire(1);
    });

    client.connect(buildConnectConfig(this.config));
  }

  close(): void {
    this.stream?.close();
    this.client?.end();
  }

  handleInput(data: string): void {
    this.stream?.write(data);
  }

  setDimensions(dimensions: vscode.TerminalDimensions): void {
    if (this.stream) {
      this.stream.setWindow(dimensions.rows, dimensions.columns, 0, 0);
    }
  }
}

function shellQuote(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`;
}
