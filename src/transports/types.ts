export interface Transport {
  readonly name: string;
  open(): Promise<void>;
  write(bytes: Buffer): Promise<void>;
  close(): Promise<void>;
}
