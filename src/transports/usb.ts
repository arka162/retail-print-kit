import { Transport } from './types';

export interface UsbOptions {
  vendorId?: number;
  productId?: number;
  /** Write timeout in milliseconds. Default 5000. */
  timeout?: number;
}

const USB_CLASS_PRINTER = 7;

type UsbModule = typeof import('usb');

function loadUsb(): UsbModule {
  try {
    return require('usb');
  } catch (err) {
    throw new Error('thermal-print: the "usb" package is not installed; run `npm install usb` to print over USB');
  }
}

/**
 * USB printer-class device. Needs the optional `usb` peer dependency. The detach listener is
 * attached on open and removed on close, so nothing leaks across printer instances.
 */
export class UsbTransport implements Transport {
  readonly name = 'usb';
  private usb: UsbModule | null = null;
  private device: import('usb').Device | null = null;
  private endpoint: import('usb').OutEndpoint | null = null;
  private iface: import('usb').Interface | null = null;
  private onDetach: ((d: import('usb').Device) => void) | null = null;

  constructor(private readonly options: UsbOptions = {}) {}

  static list(): Array<{ vendorId: number; productId: number }> {
    const usb = loadUsb();
    return usb
      .getDeviceList()
      .filter((d) => isPrinter(d, {}))
      .map((d) => ({ vendorId: d.deviceDescriptor.idVendor, productId: d.deviceDescriptor.idProduct }));
  }

  async open(): Promise<void> {
    const usb = loadUsb();
    this.usb = usb;
    const device = usb.getDeviceList().find((d) => isPrinter(d, this.options));
    if (!device) throw new Error('thermal-print: no USB printer found');
    device.open();
    const iface = device.interfaces?.find((i) => i.descriptor.bInterfaceClass === USB_CLASS_PRINTER) ?? device.interfaces?.[0];
    if (!iface) throw new Error('thermal-print: USB printer has no interface');
    if (process.platform !== 'win32' && iface.isKernelDriverActive()) {
      try {
        iface.detachKernelDriver();
      } catch {
        /* some platforms refuse; claiming may still work */
      }
    }
    iface.claim();
    const endpoint = iface.endpoints.find((e) => e.direction === 'out') as import('usb').OutEndpoint | undefined;
    if (!endpoint) throw new Error('thermal-print: USB printer has no OUT endpoint');
    this.device = device;
    this.iface = iface;
    this.endpoint = endpoint;
    this.onDetach = (d) => {
      if (d === device) {
        this.endpoint = null;
        this.iface = null;
        this.device = null;
      }
    };
    usb.usb.on('detach', this.onDetach);
  }

  write(bytes: Buffer): Promise<void> {
    const endpoint = this.endpoint;
    if (!endpoint) return Promise.reject(new Error('thermal-print: USB transport is not open'));
    endpoint.timeout = this.options.timeout ?? 5000;
    return new Promise((resolve, reject) => {
      endpoint.transfer(bytes, (err) => (err ? reject(err) : resolve()));
    });
  }

  async close(): Promise<void> {
    if (this.usb && this.onDetach) this.usb.usb.removeListener('detach', this.onDetach);
    this.onDetach = null;
    const iface = this.iface;
    const device = this.device;
    this.endpoint = null;
    this.iface = null;
    this.device = null;
    if (!device) return;
    await new Promise<void>((resolve) => {
      if (!iface) return resolve();
      iface.release(true, () => resolve());
    });
    try {
      device.close();
    } catch {
      /* already gone */
    }
  }
}

function isPrinter(d: import('usb').Device, o: UsbOptions): boolean {
  const desc = d.deviceDescriptor;
  if (o.vendorId !== undefined && desc.idVendor !== o.vendorId) return false;
  if (o.productId !== undefined && desc.idProduct !== o.productId) return false;
  if (o.vendorId !== undefined) return true;
  try {
    return (d.configDescriptor?.interfaces ?? []).some((alts) => alts.some((a) => a.bInterfaceClass === USB_CLASS_PRINTER));
  } catch {
    return false;
  }
}
