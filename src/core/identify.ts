import { Transport } from '../transports/types';
import { Profile } from '../profiles/types';
import { profiles, epsonTmT88, epsonTmT20, epsonTmM30, genericEscPos, starTsp650, starTsp100 } from '../profiles';

export interface Identity {
  maker: string | null;
  model: string | null;
  firmware: string | null;
  set: 'escpos' | 'star-line' | 'unknown';
  profile: Profile | null;
}

/** USB vendor ids of receipt printer makers; used before any byte is sent. */
export const USB_VENDORS: Record<number, { maker: string; profile: Profile }> = {
  0x04b8: { maker: 'Epson', profile: epsonTmT88 },
  0x0519: { maker: 'Star Micronics', profile: starTsp650 },
  0x1504: { maker: 'Bixolon', profile: genericEscPos },
  0x1d90: { maker: 'Citizen', profile: genericEscPos },
};

export function profileForUsb(vendorId: number, productId?: number): Profile {
  const v = USB_VENDORS[vendorId];
  if (!v) return genericEscPos;
  if (vendorId === 0x0519 && productId !== undefined && productId <= 0x0002) return starTsp100;
  return v.profile;
}

/** Picks a profile from the model string an ESC/POS printer reports with GS I. */
export function profileForModel(maker: string | null, model: string | null): Profile {
  const m = (model ?? '').toUpperCase();
  if (/T88/.test(m)) return epsonTmT88;
  if (/T20/.test(m)) return epsonTmT20;
  if (/M30/.test(m)) return epsonTmM30;
  if (/^EPSON/i.test(maker ?? '')) return epsonTmT88;
  for (const p of Object.values(profiles)) if (m && p.model.toUpperCase().includes(m)) return p;
  return genericEscPos;
}

async function ask(transport: Transport, bytes: number[], timeoutMs: number): Promise<Buffer | null> {
  if (!transport.read) throw new Error(`thermal-print: ${transport.name} transport cannot read from the printer`);
  await transport.write(Buffer.from(bytes));
  try {
    return await transport.read(timeoutMs);
  } catch {
    return null;
  }
}

function infoString(reply: Buffer | null): string | null {
  if (!reply || reply[0] !== 0x5f) return null;
  const end = reply.indexOf(0, 1);
  return reply.subarray(1, end === -1 ? reply.length : end).toString('ascii').trim() || null;
}

/**
 * Asks an open transport what is on the other end: ESC/POS `GS I 66/67/65` (maker, model,
 * firmware), then a Star Line status request when ESC/POS stays silent.
 */
export async function identify(transport: Transport, timeoutMs = 1500): Promise<Identity> {
  const maker = infoString(await ask(transport, [0x1d, 0x49, 66], timeoutMs));
  const model = infoString(await ask(transport, [0x1d, 0x49, 67], timeoutMs));
  if (maker || model) {
    const firmware = infoString(await ask(transport, [0x1d, 0x49, 65], timeoutMs));
    return { maker, model, firmware, set: 'escpos', profile: profileForModel(maker, model) };
  }
  const star = await ask(transport, [0x1b, 0x06, 0x01], timeoutMs);
  if (star && star.length >= 2) return { maker: 'Star Micronics', model: null, firmware: null, set: 'star-line', profile: starTsp650 };
  return { maker: null, model: null, firmware: null, set: 'unknown', profile: null };
}
