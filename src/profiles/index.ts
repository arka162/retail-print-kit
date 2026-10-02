import { Profile } from './types';
import { epsonTmT88, epsonTmT20, epsonTmM30, genericEscPos, genericEscPos58 } from './epson';
import { starTsp650, starMcPrint3, starTsp100 } from './star';

export * from './types';
export { epsonTmT88, epsonTmT20, epsonTmM30, genericEscPos, genericEscPos58, starTsp650, starMcPrint3, starTsp100 };

export const profiles: Record<string, Profile> = Object.fromEntries(
  [epsonTmT88, epsonTmT20, epsonTmM30, genericEscPos, genericEscPos58, starTsp650, starMcPrint3, starTsp100].map((p) => [p.id, p]),
);

export function profileById(id: string): Profile {
  const p = profiles[id];
  if (!p) throw new Error(`thermal-print: unknown profile "${id}"`);
  return p;
}
