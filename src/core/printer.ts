import { Transport } from '../transports/types';
import { Profile } from '../profiles/types';
import { encode, EncodeContext } from './encode';
import { OpBuilder } from './builder';
import { PrinterStatus, parseEscPosStatus, parseStarStatus, UNSUPPORTED_STATUS } from './status';

export * from './builder';

export interface PrinterOptions extends EncodeContext {
  /** Send ESC @ and the profile code page on open. Default true. */
  initOnOpen?: boolean;
  /** Milliseconds to wait for a status reply. Default 1500. */
  statusTimeout?: number;
}

/** An `OpBuilder` bound to a transport: `open()`, record ops, `close()` sends them. */
export class Printer extends OpBuilder {
  private opened = false;

  constructor(
    public readonly transport: Transport,
    profile: Profile,
    private readonly options: PrinterOptions = {},
  ) {
    super(profile);
  }

  async open(): Promise<this> {
    await this.transport.open();
    this.opened = true;
    if (this.options.initOnOpen !== false) this.ops.unshift({ kind: 'init' });
    return this;
  }

  /** Encodes and sends everything recorded so far, keeping the connection open. */
  async flush(): Promise<this> {
    if (!this.opened) throw new Error('retail-print-kit: call open() before flush()');
    const ops = this.ops;
    this.ops = [];
    if (ops.length) await this.transport.write(encode(ops, this.profile, this.options));
    return this;
  }

  /** Flushes, then closes the transport. */
  async close(): Promise<void> {
    try {
      await this.flush();
    } finally {
      this.opened = false;
      await this.transport.close();
    }
  }

  /** Renders a template with data and appends the result. */
  render(template: import('../template/types').Template, data: unknown): this {
    const { render } = require('../template/render') as typeof import('../template/render');
    return this.append(render(template, data, this.profile));
  }

  /** HTML preview of the recorded ops. */
  toHtml(options?: import('../preview/html').HtmlPreviewOptions): string {
    const { opsToHtml } = require('../preview/html') as typeof import('../preview/html');
    return opsToHtml(this.ops, this.profile, options);
  }

  /** The bytes that would be sent for the recorded ops; useful for tests and previews. */
  toBuffer(): Buffer {
    return encode(this.ops, this.profile, this.options);
  }

  /**
   * Asks the printer for its state (ESC/POS DLE EOT 1..4). Flushes pending ops first so the
   * reply is not mixed with receipt data. Needs a transport with `read`.
   */
  async status(): Promise<PrinterStatus> {
    if (this.profile.set !== 'escpos' && this.profile.set !== 'star-line') return UNSUPPORTED_STATUS;
    if (!this.transport.read) throw new Error(`retail-print-kit: ${this.transport.name} transport cannot read from the printer`);
    await this.flush();
    const timeout = this.options.statusTimeout ?? 1500;
    if (this.profile.set === 'star-line') {
      await this.transport.write(Buffer.from([0x1b, 0x06, 0x01]));
      const reply = await this.transport.read(timeout);
      return parseStarStatus(Array.from(reply));
    }
    const bytes: number[] = [];
    for (const n of [1, 2, 3, 4]) {
      await this.transport.write(Buffer.from([0x10, 0x04, n]));
      const reply = await this.transport.read(timeout);
      bytes.push(reply[0]);
    }
    return parseEscPosStatus(bytes);
  }
}

