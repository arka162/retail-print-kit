import { Transport } from './types';

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
    throw new Error('thermal-print: the "serialport" package is not installed; run `npm install serialport` to print over serial');
  }
}

/** RS-232 / USB-serial printer. Needs the optional `serialport` peer dependency. */
export class SerialTransport implements Transport {
  readonly name = 'serial';
  private port: InstanceType<SerialPortCtor> | null = null;

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
        this.port = port;
        resolve();
      });
    });
  }

  write(bytes: Buffer): Promise<void> {
    const port = this.port;
    if (!port) return Promise.reject(new Error('thermal-print: serial transport is not open'));
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`thermal-print: timeout writing to ${this.path}`)), this.options.timeout ?? 5000);
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

  close(): Promise<void> {
    const port = this.port;
    this.port = null;
    if (!port || !port.isOpen) return Promise.resolve();
    return new Promise((resolve, reject) => port.close((err) => (err ? reject(err) : resolve())));
  }
}
