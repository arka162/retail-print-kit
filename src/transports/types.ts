export interface Transport {
  readonly name: string;
  open(): Promise<void>;
  write(bytes: Buffer): Promise<void>;
  /** Resolves with the next bytes the printer sends, or rejects after `timeoutMs`. Optional. */
  read?(timeoutMs: number): Promise<Buffer>;
  close(): Promise<void>;
}

/** Shared read queue for transports that receive data as events. */
export class ReadQueue {
  private chunks: Buffer[] = [];
  private waiters: Array<{ resolve: (b: Buffer) => void; reject: (e: Error) => void; timer: NodeJS.Timeout }> = [];

  push(chunk: Buffer): void {
    const w = this.waiters.shift();
    if (w) {
      clearTimeout(w.timer);
      w.resolve(chunk);
    } else {
      this.chunks.push(chunk);
    }
  }

  next(timeoutMs: number, what: string): Promise<Buffer> {
    const ready = this.chunks.shift();
    if (ready) return Promise.resolve(ready);
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.waiters = this.waiters.filter((x) => x.timer !== timer);
        reject(new Error(`thermal-print: timeout waiting for ${what}`));
      }, timeoutMs);
      this.waiters.push({ resolve, reject, timer });
    });
  }

  clear(): void {
    this.chunks = [];
    for (const w of this.waiters) {
      clearTimeout(w.timer);
      w.reject(new Error('thermal-print: transport closed'));
    }
    this.waiters = [];
  }
}
