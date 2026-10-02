import net from 'net';
import { Transport } from './types';

export interface NetOptions {
  port?: number;
  /** Connect and write timeout in milliseconds. Default 5000. */
  timeout?: number;
}

/** Raw TCP ("JetDirect", port 9100). Pure Node, works with every network receipt printer. */
export class NetTransport implements Transport {
  readonly name = 'net';
  private socket: net.Socket | null = null;
  private readonly port: number;
  private readonly timeout: number;

  constructor(public readonly host: string, options: NetOptions = {}) {
    this.port = options.port ?? 9100;
    this.timeout = options.timeout ?? 5000;
  }

  open(): Promise<void> {
    return new Promise((resolve, reject) => {
      const socket = new net.Socket();
      const fail = (err: Error) => {
        socket.destroy();
        this.socket = null;
        reject(err);
      };
      socket.setTimeout(this.timeout, () => fail(new Error(`thermal-print: timeout connecting to ${this.host}:${this.port}`)));
      socket.once('error', fail);
      socket.connect(this.port, this.host, () => {
        socket.removeListener('error', fail);
        socket.setTimeout(0);
        this.socket = socket;
        resolve();
      });
    });
  }

  write(bytes: Buffer): Promise<void> {
    const socket = this.socket;
    if (!socket) return Promise.reject(new Error('thermal-print: net transport is not open'));
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`thermal-print: timeout writing to ${this.host}:${this.port}`)), this.timeout);
      socket.write(bytes, (err) => {
        clearTimeout(timer);
        if (err) reject(err);
        else resolve();
      });
    });
  }

  close(): Promise<void> {
    const socket = this.socket;
    this.socket = null;
    if (!socket) return Promise.resolve();
    return new Promise((resolve) => {
      socket.once('close', () => resolve());
      socket.end();
      setTimeout(() => socket.destroy(), this.timeout).unref();
    });
  }
}
