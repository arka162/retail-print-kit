import net from 'net';
import os from 'os';
import { NetTransport } from './net';
import { identify, Identity } from '../core/identify';

export interface DiscoverOptions {
  /** TCP port to probe. Default 9100 (raw printing). */
  port?: number;
  /** Per-host connect timeout in milliseconds. Default 400. */
  timeout?: number;
  /** Simultaneous probes. Default 64. */
  concurrency?: number;
  /** Subnets as "192.168.1" prefixes; defaults to every private IPv4 /24 this machine is on. */
  subnets?: string[];
  /** Ask each printer found for its maker and model. Default false. */
  identify?: boolean;
}

export interface DiscoveredPrinter {
  host: string;
  port: number;
  identity?: Identity;
}

function isPrivate(ip: string): boolean {
  return /^10\./.test(ip) || /^192\.168\./.test(ip) || /^172\.(1[6-9]|2\d|3[01])\./.test(ip);
}

export function localSubnets(): string[] {
  const out = new Set<string>();
  for (const list of Object.values(os.networkInterfaces())) {
    for (const a of list ?? []) {
      if (a.family === 'IPv4' && !a.internal && isPrivate(a.address)) out.add(a.address.split('.').slice(0, 3).join('.'));
    }
  }
  return [...out];
}

function probe(host: string, port: number, timeout: number): Promise<boolean> {
  return new Promise((resolve) => {
    const s = new net.Socket();
    const done = (ok: boolean) => {
      s.destroy();
      resolve(ok);
    };
    s.setTimeout(timeout, () => done(false));
    s.once('error', () => done(false));
    s.connect(port, host, () => done(true));
  });
}

/** Sweeps the local /24 networks for hosts that accept raw printing connections. */
export async function discoverNetworkPrinters(options: DiscoverOptions = {}): Promise<DiscoveredPrinter[]> {
  const port = options.port ?? 9100;
  const timeout = options.timeout ?? 400;
  const subnets = options.subnets ?? localSubnets();
  const hosts: string[] = [];
  for (const s of subnets) for (let i = 1; i < 255; i++) hosts.push(`${s}.${i}`);
  const found: DiscoveredPrinter[] = [];
  let next = 0;
  const worker = async () => {
    while (next < hosts.length) {
      const host = hosts[next++];
      if (await probe(host, port, timeout)) found.push({ host, port });
    }
  };
  await Promise.all(Array.from({ length: Math.min(options.concurrency ?? 64, hosts.length) }, worker));
  found.sort((a, b) => a.host.localeCompare(b.host, undefined, { numeric: true }));
  if (options.identify) {
    for (const p of found) {
      const t = new NetTransport(p.host, { port: p.port, timeout: 2000 });
      try {
        await t.open();
        p.identity = await identify(t, 800);
      } catch {
        /* leave unidentified */
      } finally {
        await t.close().catch(() => undefined);
      }
    }
  }
  return found;
}
