import { Op } from './ops';
import { Profile } from '../profiles/types';
import { encodeEscPos } from './escpos-encoder';

export function encode(ops: Op[], profile: Profile): Buffer {
  switch (profile.set) {
    case 'escpos':
      return encodeEscPos(ops, profile);
    case 'star-line':
    case 'star-graphic':
      throw new Error(`thermal-print: command set "${profile.set}" is not implemented yet`);
  }
}
