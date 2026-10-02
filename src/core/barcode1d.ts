import { BarcodeType } from './ops';
import { Bitmap, emptyBitmap, setPixel } from './bitmap';

/** Bar/space run lengths for one symbol, starting with a bar. */
export type Pattern = number[];

const CODE128: string[] = [
  '212222','222122','222221','121223','121322','131222','122213','122312','132212','221213',
  '221312','231212','112232','122132','122231','113222','123122','123221','223211','221132',
  '221231','213212','223112','312131','311222','321122','321221','312212','322112','322211',
  '212123','212321','232121','111323','131123','131321','112313','132113','132311','211313',
  '231113','231311','112133','112331','132131','113123','113321','133121','313121','211331',
  '231131','213113','213311','213131','311123','311321','331121','312113','312311','332111',
  '314111','221411','431111','111224','111422','121124','121421','141122','141221','112214',
  '112412','122114','122411','142112','142211','241211','221114','413111','241112','134111',
  '111242','121142','121241','114212','124112','124211','411212','421112','421211','212141',
  '214121','412121','111143','111341','131141','114113','114311','411113','411311','113141',
  '114131','311141','411131','211412','211214','211232','2331112',
];
const C128_START_B = 104;
const C128_START_C = 105;
const C128_CODE_B = 100;
const C128_CODE_C = 99;
const C128_STOP = 106;

export function code128(data: string): Pattern {
  if (!/^[\x20-\x7e]*$/.test(data) || !data.length) throw new Error('thermal-print: CODE128 needs printable ASCII');
  const codes: number[] = [];
  let i = 0;
  let subset: 'B' | 'C' | null = null;
  const digitsAhead = (from: number) => {
    let n = 0;
    while (from + n < data.length && /[0-9]/.test(data[from + n])) n++;
    return n;
  };
  while (i < data.length) {
    const run = digitsAhead(i);
    const useC = run >= 4 || (run >= 2 && run === data.length - i);
    if (useC) {
      if (subset !== 'C') {
        codes.push(subset === null ? C128_START_C : C128_CODE_C);
        subset = 'C';
      }
      const pairs = Math.floor(run / 2);
      for (let k = 0; k < pairs; k++) {
        codes.push(parseInt(data.slice(i, i + 2), 10));
        i += 2;
      }
      continue;
    }
    if (subset !== 'B') {
      codes.push(subset === null ? C128_START_B : C128_CODE_B);
      subset = 'B';
    }
    codes.push(data.charCodeAt(i) - 32);
    i++;
  }
  let check = codes[0];
  for (let k = 1; k < codes.length; k++) check += codes[k] * k;
  codes.push(check % 103, C128_STOP);
  const out: number[] = [];
  for (const c of codes) for (const ch of CODE128[c]) out.push(Number(ch));
  return out;
}

const EAN_L = ['0001101','0011001','0010011','0111101','0100011','0110001','0101111','0111011','0110111','0001011'];
const EAN_G = ['0100111','0110011','0011011','0100001','0011101','0111001','0000101','0010001','0001001','0010111'];
const EAN_R = ['1110010','1100110','1101100','1000010','1011100','1001110','1010000','1000100','1001000','1110100'];
const EAN13_PARITY = ['LLLLLL','LLGLGG','LLGGLG','LLGGGL','LGLLGG','LGGLLG','LGGGLL','LGLGLG','LGLGGL','LGGLGL'];

function eanChecksum(digits: string): number {
  let sum = 0;
  for (let i = 0; i < digits.length; i++) {
    const weight = (digits.length - i) % 2 === 0 ? 1 : 3;
    sum += Number(digits[i]) * weight;
  }
  return (10 - (sum % 10)) % 10;
}

function bitsToPattern(bits: string): Pattern {
  const out: number[] = [];
  let cur = '1';
  let run = 0;
  if (bits[0] !== '1') out.push(0);
  for (const b of bits) {
    if (b === cur) run++;
    else {
      out.push(run);
      cur = b;
      run = 1;
    }
  }
  out.push(run);
  return out;
}

export function ean13(data: string): Pattern {
  let d = data.replace(/\D/g, '');
  if (d.length === 12) d += eanChecksum(d);
  if (d.length !== 13) throw new Error('thermal-print: EAN13 needs 12 or 13 digits');
  const parity = EAN13_PARITY[Number(d[0])];
  let bits = '101';
  for (let i = 1; i <= 6; i++) bits += (parity[i - 1] === 'L' ? EAN_L : EAN_G)[Number(d[i])];
  bits += '01010';
  for (let i = 7; i <= 12; i++) bits += EAN_R[Number(d[i])];
  bits += '101';
  return bitsToPattern(bits);
}

export function upcA(data: string): Pattern {
  let d = data.replace(/\D/g, '');
  if (d.length === 11) d += eanChecksum(d);
  if (d.length !== 12) throw new Error('thermal-print: UPC-A needs 11 or 12 digits');
  return ean13('0' + d);
}

export function ean8(data: string): Pattern {
  let d = data.replace(/\D/g, '');
  if (d.length === 7) d += eanChecksum(d);
  if (d.length !== 8) throw new Error('thermal-print: EAN8 needs 7 or 8 digits');
  let bits = '101';
  for (let i = 0; i < 4; i++) bits += EAN_L[Number(d[i])];
  bits += '01010';
  for (let i = 4; i < 8; i++) bits += EAN_R[Number(d[i])];
  bits += '101';
  return bitsToPattern(bits);
}

const CODE39: Record<string, string> = {
  '0': '101001101101', '1': '110100101011', '2': '101100101011', '3': '110110010101', '4': '101001101011',
  '5': '110100110101', '6': '101100110101', '7': '101001011011', '8': '110100101101', '9': '101100101101',
  A: '110101001011', B: '101101001011', C: '110110100101', D: '101011001011', E: '110101100101',
  F: '101101100101', G: '101010011011', H: '110101001101', I: '101101001101', J: '101011001101',
  K: '110101010011', L: '101101010011', M: '110110101001', N: '101011010011', O: '110101101001',
  P: '101101101001', Q: '101010110011', R: '110101011001', S: '101101011001', T: '101011011001',
  U: '110010101011', V: '100110101011', W: '110011010101', X: '100101101011', Y: '110010110101',
  Z: '100110110101', '-': '100101011011', '.': '110010101101', ' ': '100110101101', '$': '100100100101',
  '/': '100100101001', '+': '100101001001', '%': '101001001001', '*': '100101101101',
};

export function code39(data: string): Pattern {
  const text = `*${data.toUpperCase()}*`;
  let bits = '';
  for (const ch of text) {
    const p = CODE39[ch];
    if (!p) throw new Error(`thermal-print: CODE39 cannot encode "${ch}"`);
    bits += p + '0';
  }
  return bitsToPattern(bits.slice(0, -1));
}

export function pattern(type: BarcodeType, data: string): Pattern {
  switch (type) {
    case 'CODE128': return code128(data);
    case 'EAN13': return ean13(data);
    case 'UPC_A': return upcA(data);
    case 'EAN8': return ean8(data);
    case 'CODE39': return code39(data);
    default:
      throw new Error(`thermal-print: bitmap rendering of ${type} is not implemented`);
  }
}

/** Bitmap of a 1D barcode: `module` dots per narrow bar, `height` dots, 10-module quiet zones. */
export function barcodeBitmap(type: BarcodeType, data: string, module = 2, height = 80): Bitmap {
  const p = pattern(type, data);
  const quiet = 10 * module;
  const width = p.reduce((a, b) => a + b, 0) * module + quiet * 2;
  const b = emptyBitmap(width, height);
  let x = quiet;
  let bar = true;
  for (const run of p) {
    if (bar) for (let dx = 0; dx < run * module; dx++) for (let y = 0; y < height; y++) setPixel(b, x + dx, y, true);
    x += run * module;
    bar = !bar;
  }
  return b;
}
