import { Transport, ReadQueue } from './types';

export interface SerialOptions {
  baudRate?: number;
  /** Write timeout in milliseconds. Default 5000. */
  timeout?: number;
}

type SerialPortCtor = typeof import('serialport').SerialPort;

function loadSerial(): SerialPortCtor {
  try {
    return require('serialport').SerialPort;
  } catch (err) {
    throw new Error('retail-print-kit: the "serialport" package is not installed; run `npm install serialport` to print over serial');
  }
}

/** RS-232 / USB-serial printer. Needs the optional `serialport` peer dependency. */
export class SerialTransport implements Transport {
  readonly name = 'serial';
  private port: InstanceType<SerialPortCtor> | null = null;
  private readonly inbox = new ReadQueue();

  constructor(public readonly path: string, private readonly options: SerialOptions = {}) {}

  static async list(): Promise<string[]> {
    const SerialPort = loadSerial();
    const ports = await SerialPort.list();
    return ports.map((p) => p.path);
  }

  open(): Promise<void> {
    const SerialPort = loadSerial();
    return new Promise((resolve, reject) => {
      const port = new SerialPort({ path: this.path, baudRate: this.options.baudRate ?? 9600 }, (err) => {
        if (err) return reject(err);
        port.on('data', (d: Buffer) => this.inbox.push(Buffer.from(d)));
        this.port = port;
        resolve();
      });
    });
  }

  write(bytes: Buffer): Promise<void> {
    const port = this.port;
    if (!port) return Promise.reject(new Error('retail-print-kit: serial transport is not open'));
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`retail-print-kit: timeout writing to ${this.path}`)), this.options.timeout ?? 5000);
      port.write(bytes, (err) => {
        if (err) {
          clearTimeout(timer);
          return reject(err);
        }
        port.drain((e) => {
          clearTimeout(timer);
          e ? reject(e) : resolve();
        });
      });
    });
  }

  read(timeoutMs: number): Promise<Buffer> {
    if (!this.port) return Promise.reject(new Error('retail-print-kit: serial transport is not open'));
    return this.inbox.next(timeoutMs, this.path);
  }

  close(): Promise<void> {
    const port = this.port;
    this.port = null;
    this.inbox.clear();
    if (!port || !port.isOpen) return Promise.resolve();
    return new Promise((resolve, reject) => port.close((err) => (err ? reject(err) : resolve())));
  }
}
