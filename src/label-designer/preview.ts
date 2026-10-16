import { drawLabel, drawPrinterView, ensureLabelFonts, LabelData, LabelDesign, LabelWarning } from '../label-design';

export interface LabelPreviewElement extends HTMLElement {
  design: LabelDesign | null;
  data: LabelData;
  maxWidth: number;
  maxHeight: number;
  pxPerMm: number | null;
  stock: boolean;
  printerView: boolean;
  printerScale: number;
  fontsUrl: string;
  redraw(): void;
}

const PREVIEW_CSS = ':host{display:inline-block;line-height:0}canvas{display:block;background:#fff;box-shadow:0 0 0 1px rgba(16,24,40,.12),0 1px 2px rgba(16,24,40,.08);border-radius:2px}canvas.pixel{image-rendering:pixelated}';

export function defineLabelPreview(tag = 'rpk-label-preview'): void {
  if (typeof customElements === 'undefined' || customElements.get(tag)) return;

  class LabelPreview extends HTMLElement implements LabelPreviewElement {
    private canvas: HTMLCanvasElement;
    private queued = false;
    private state = {
      design: null as LabelDesign | null, data: {} as LabelData, maxWidth: 280, maxHeight: 140, pxPerMm: null as number | null,
      stock: true, printerView: false, printerScale: 1, fontsUrl: 'assets/label-fonts/'
    };

    constructor() {
      super();
      const root = this.attachShadow({ mode: 'open' });
      root.innerHTML = `<style>${PREVIEW_CSS}</style><canvas></canvas>`;
      this.canvas = root.querySelector('canvas') as HTMLCanvasElement;
    }

    connectedCallback(): void {
      this.queue();
      ensureLabelFonts(this.state.fontsUrl).then(() => this.queue());
    }

    get design(): LabelDesign | null { return this.state.design; }
    set design(v: LabelDesign | null) { this.state.design = v; this.queue(); }
    get data(): LabelData { return this.state.data; }
    set data(v: LabelData) { this.state.data = v || {}; this.queue(); }
    get maxWidth(): number { return this.state.maxWidth; }
    set maxWidth(v: number) { this.state.maxWidth = Number(v) || 280; this.queue(); }
    get maxHeight(): number { return this.state.maxHeight; }
    set maxHeight(v: number) { this.state.maxHeight = Number(v) || 140; this.queue(); }
    get pxPerMm(): number | null { return this.state.pxPerMm; }
    set pxPerMm(v: number | null) { this.state.pxPerMm = v ? Number(v) : null; this.queue(); }
    get stock(): boolean { return this.state.stock; }
    set stock(v: boolean) { this.state.stock = v !== false; this.queue(); }
    get printerView(): boolean { return this.state.printerView; }
    set printerView(v: boolean) { this.state.printerView = !!v; this.queue(); }
    get printerScale(): number { return this.state.printerScale; }
    set printerScale(v: number) { this.state.printerScale = Number(v) || 1; this.queue(); }
    get fontsUrl(): string { return this.state.fontsUrl; }
    set fontsUrl(v: string) { this.state.fontsUrl = v || 'assets/label-fonts/'; ensureLabelFonts(this.state.fontsUrl).then(() => this.queue()); }

    redraw(): void { this.queue(); }

    private queue(): void {
      if (this.queued) return;
      this.queued = true;
      Promise.resolve().then(() => { this.queued = false; this.draw(); });
    }

    private draw(): void {
      const s = this.state;
      const design = s.design;
      if (!design || !(design.widthMm > 0) || !(design.heightMm > 0)) return;
      let warnings: LabelWarning[];
      this.canvas.classList.toggle('pixel', s.printerView);
      if (s.printerView) {
        warnings = drawPrinterView(this.canvas, design, s.data);
        this.canvas.style.width = `${this.canvas.width * s.printerScale}px`;
        this.canvas.style.height = `${this.canvas.height * s.printerScale}px`;
      } else {
        const css = s.pxPerMm || Math.min(s.maxWidth / design.widthMm, s.maxHeight / design.heightMm);
        const dpr = Math.min(3, Math.max(1, window.devicePixelRatio || 1));
        warnings = drawLabel(this.canvas, design, s.data, { ppm: css * dpr, stock: s.stock });
        this.canvas.style.width = `${design.widthMm * css}px`;
        this.canvas.style.height = `${design.heightMm * css}px`;
      }
      this.dispatchEvent(new CustomEvent('labelwarnings', { detail: warnings }));
    }
  }

  customElements.define(tag, LabelPreview);
}
