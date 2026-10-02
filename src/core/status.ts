export interface PrinterStatus {
  /** False when the profile's command set has no status query implemented. */
  supported: boolean;
  online: boolean;
  coverOpen: boolean;
  paperOut: boolean;
  paperNearEnd: boolean;
  cutterError: boolean;
  recoverableError: boolean;
  unrecoverableError: boolean;
  /** Level of drawer kick-out connector pin 3; which level means "open" depends on the drawer. */
  drawerPinHigh: boolean;
  raw: number[];
}

/** Parses the four ESC/POS real-time status bytes (DLE EOT 1..4). */
export function parseEscPosStatus(b: number[]): PrinterStatus {
  const [printer = 0, offline = 0, error = 0, paper = 0] = b;
  return {
    supported: true,
    online: (printer & 0x08) === 0,
    drawerPinHigh: (printer & 0x04) !== 0,
    coverOpen: (offline & 0x04) !== 0,
    paperOut: (offline & 0x20) !== 0 || (paper & 0x60) !== 0,
    paperNearEnd: (paper & 0x0c) !== 0,
    cutterError: (error & 0x08) !== 0,
    recoverableError: (error & 0x40) !== 0,
    unrecoverableError: (error & 0x20) !== 0,
    raw: b,
  };
}

export const UNSUPPORTED_STATUS: PrinterStatus = {
  supported: false,
  online: true,
  coverOpen: false,
  paperOut: false,
  paperNearEnd: false,
  cutterError: false,
  recoverableError: false,
  unrecoverableError: false,
  drawerPinHigh: false,
  raw: [],
};

/**
 * Parses a Star Line Mode status block (reply to ESC ACK SOH). Bit positions follow the Star Line
 * Mode command specification as read; verify against a TSP650II / mC-Print before relying on it.
 */
export function parseStarStatus(b: number[]): PrinterStatus {
  const [, printer = 0, error = 0, , paper = 0] = b;
  return {
    supported: true,
    online: (printer & 0x08) === 0,
    coverOpen: (printer & 0x20) !== 0,
    drawerPinHigh: (printer & 0x04) !== 0,
    cutterError: (error & 0x08) !== 0,
    unrecoverableError: (error & 0x20) !== 0,
    recoverableError: (error & 0x40) !== 0,
    paperNearEnd: (paper & 0x04) !== 0,
    paperOut: (paper & 0x08) !== 0,
    raw: b,
  };
}
