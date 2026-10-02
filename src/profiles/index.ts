import { Profile } from './types';
import { epsonTmT88, epsonTmT20, epsonTmM30, genericEscPos, genericEscPos58 } from './epson';

export * from './types';
export { epsonTmT88, epsonTmT20, epsonTmM30, genericEscPos, genericEscPos58 };

export const profiles: Record<string, Profile> = {
  [epsonTmT88.id]: epsonTmT88,
  [epsonTmT20.id]: epsonTmT20,
  [epsonTmM30.id]: epsonTmM30,
  [genericEscPos.id]: genericEscPos,
  [genericEscPos58.id]: genericEscPos58,
};

export function profileById(id: string): Profile {
  const p = profiles[id];
  if (!p) throw new Error(`thermal-print: unknown profile "${id}"`);
  return p;
}
