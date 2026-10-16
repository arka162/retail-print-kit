import {
  dotsToMm, drawLabel, ElementType, ensureLabelFonts, FIELDS, FieldOption, FONTS, imageFromSource, LabelData, LabelDesign, LabelElement,
  labelDataFromItem, LabelWarning, MM_PER_INCH, mmToDots, newId, sampleData, snapToDot
} from '../label-design';
import { defineLabelPreview, LabelPreviewElement } from './preview';
import { DESIGNER_CSS } from './styles';

type Handle = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w';
type CheckKind = 'all' | 'cut' | 'wrap' | 'shrink' | 'missing' | 'barcode';
interface Guide { axis: 'x' | 'y'; mm: number; }
interface DragState { kind: 'move' | 'resize'; id: string; handle?: Handle; startX: number; startY: number; orig: LabelElement; moved: boolean; }
interface CheckResult { item: any; data: LabelData; warnings: LabelWarning[]; }

export interface LabelItemSource {
  search?(query: string): Promise<any[]>;
  page?(offset: number, limit: number): Promise<{ items: any[]; total: number; storeName?: string } | null>;
}

export interface LabelDesignerElement extends HTMLElement {
  design: LabelDesign | null;
  name: string;
  readOnly: boolean;
  fontsUrl: string;
  itemSource: LabelItemSource | null;
  storeName: string;
  error: string;
  readonly dirty: boolean;
  getDesign(): LabelDesign | null;
  markSaved(): void;
  requestSave(): void;
  undo(): void;
  redo(): void;
  useSample(item: any): void;
}

interface PaletteEntry { kind: ElementType; label: string; icon: string; }

const BASIC_PALETTE: PaletteEntry[] = [
  { kind: 'text', label: 'Text', icon: 'T' }, { kind: 'line', label: 'Line', icon: '—' }, { kind: 'box', label: 'Box', icon: '▢' },
  { kind: 'fill', label: 'Filled box', icon: '■' }, { kind: 'qr', label: 'QR code', icon: '⌗' }, { kind: 'image', label: 'Logo', icon: '◪' }
];
const HANDLES: Handle[] = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];
const ZOOMS = [0.5, 0.75, 1, 1.25, 1.5, 2, 3, 4];
const CSS_PX_PER_MM = 96 / MM_PER_INCH;
const CHECK_PAGE = 200;
const CHECK_MAX_ITEMS = 6000;
const QR_HINT = 'Link or text. Add a field with {{itemName}}, {{barcode}} and so on.';
const TRASH = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/></svg>';

function esc(value: any): string {
  return String(value === undefined || value === null ? '' : value).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' } as any)[c]);
}

function on(flag: any): string {
  return flag ? ' on' : '';
}

function formatMoney(value: any): string {
  const n = Number(value);
  return Number.isFinite(n) ? `$${n.toFixed(2)}` : '';
}

export function defineLabelDesigner(tag = 'rpk-label-designer'): void {
  if (typeof customElements === 'undefined' || customElements.get(tag)) return;
  defineLabelPreview();

  class LabelDesigner extends HTMLElement implements LabelDesignerElement {
    private root: ShadowRoot;
    private refs: { [key: string]: HTMLElement } = {};
    private d: LabelDesign | null = null;
    private label = '';
    private ro = false;
    private fonts = 'assets/label-fonts/';
    private source: LabelItemSource | null = null;
    private store = '';
    private errorText = '';
    private savedState = '';
    private savedAt: Date | null = null;
    private undoStack: string[] = [];
    private redoStack: string[] = [];
    private drag: DragState | null = null;
    private mode: 'design' | 'check' = 'design';
    private zoom = 1;
    private unit: 'in' | 'mm' = 'in';
    private snap = true;
    private showGrid = true;
    private selectedId: string | null = null;
    private guides: Guide[] = [];
    private warnings: LabelWarning[] = [];
    private paletteFilter = '';
    private data: LabelData = sampleData();
    private sampleName = 'Sample item';
    private sampleResults: any[] = [];
    private samplePickerOpen = false;
    private sampleLoading = false;
    private sampleTimer: any = null;
    private imageMode: 'dither' | 'threshold' = 'dither';
    private imageError = '';
    private checkRunning = false;
    private checkDone = 0;
    private checkTotal = 0;
    private checkResults: CheckResult[] = [];
    private checkFilter: CheckKind = 'all';
    private checkSelected: CheckResult | null = null;
    private checkError = '';
    private checkToken = 0;
    private frame = 0;
    private pending = new Set<string>();
    private listening = false;

    constructor() {
      super();
      this.root = this.attachShadow({ mode: 'open' });
      this.root.innerHTML = `<style>${DESIGNER_CSS}</style>${this.skeleton()}`;
      this.root.querySelectorAll<HTMLElement>('[data-ref]').forEach((el) => { this.refs[el.dataset.ref as string] = el; });
      this.root.addEventListener('click', (e) => this.onClick(e));
      this.root.addEventListener('change', (e) => this.onChange(e));
      this.root.addEventListener('input', (e) => this.onInput(e));
      this.root.addEventListener('pointerdown', (e) => this.onPointerDown(e as PointerEvent));
      this.root.addEventListener('dragstart', (e) => this.onDragStart(e as DragEvent));
      this.refs.stage.addEventListener('dragover', (e) => { e.preventDefault(); if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy'; });
      this.refs.stage.addEventListener('drop', (e) => this.onDrop(e));
    }

    connectedCallback(): void {
      if (!this.listening) {
        window.addEventListener('pointermove', this.onPointerMove);
        window.addEventListener('pointerup', this.onPointerUp);
        window.addEventListener('keydown', this.onKey);
        this.listening = true;
      }
      ensureLabelFonts(this.fonts).then(() => this.update('stage'));
      this.update('all');
    }

    disconnectedCallback(): void {
      window.removeEventListener('pointermove', this.onPointerMove);
      window.removeEventListener('pointerup', this.onPointerUp);
      window.removeEventListener('keydown', this.onKey);
      this.listening = false;
      this.checkToken++;
    }

    get design(): LabelDesign | null { return this.d; }
    set design(v: LabelDesign | null) {
      this.d = v ? this.normalizeDesign(JSON.parse(JSON.stringify(v))) : null;
      this.undoStack = [];
      this.redoStack = [];
      this.selectedId = null;
      this.checkResults = [];
      this.checkSelected = null;
      this.savedState = this.saveState();
      this.zoom = this.fitZoom();
      this.update('all');
    }
    get name(): string { return this.label; }
    set name(v: string) {
      this.label = String(v || '');
      (this.refs.name as HTMLInputElement).value = this.label;
      this.savedState = this.saveState();
      this.update('top');
    }
    get readOnly(): boolean { return this.ro; }
    set readOnly(v: boolean) { this.ro = !!v; (this.refs.name as HTMLInputElement).readOnly = this.ro; this.update('all'); }
    get fontsUrl(): string { return this.fonts; }
    set fontsUrl(v: string) { this.fonts = v || 'assets/label-fonts/'; ensureLabelFonts(this.fonts).then(() => this.update('stage')); }
    get itemSource(): LabelItemSource | null { return this.source; }
    set itemSource(v: LabelItemSource | null) { this.source = v; this.update('top'); }
    get storeName(): string { return this.store; }
    set storeName(v: string) { this.store = String(v || ''); this.update('check'); }
    get error(): string { return this.errorText; }
    set error(v: string) { this.errorText = String(v || ''); this.update('top'); }
    get dirty(): boolean { return !!this.d && this.saveState() !== this.savedState; }

    getDesign(): LabelDesign | null { return this.d ? JSON.parse(JSON.stringify(this.d)) : null; }

    markSaved(): void {
      this.savedState = this.saveState();
      this.savedAt = new Date();
      this.errorText = '';
      this.update('top');
    }

    requestSave(): void {
      if (!this.d || this.ro) return;
      const name = this.label.trim();
      if (!name) { this.errorText = 'Give the template a name.'; this.update('top'); return; }
      this.errorText = '';
      this.update('top');
      this.emit('designsave', { design: this.getDesign(), name });
    }

    undo(): void {
      const prev = this.undoStack.pop();
      if (!prev) return;
      this.redoStack.push(this.snapshot());
      this.restore(prev);
    }

    redo(): void {
      const next = this.redoStack.pop();
      if (!next) return;
      this.undoStack.push(this.snapshot());
      this.restore(next);
    }

    useSample(item: any): void {
      this.data = labelDataFromItem(item, { limits: this.d ? this.d.limits : undefined, storeName: this.store });
      this.sampleName = item.posdecs || item.item_name || 'Item';
      this.samplePickerOpen = false;
      this.emit('samplepick', { item });
      this.update('all');
    }

    private skeleton(): string {
      return `<div class="ld">
  <div class="ld-top">
    <input class="ld-name" type="text" data-ref="name" data-input="name" maxlength="100" aria-label="Template name">
    <span class="lt-chip" data-ref="size"></span>
    <span class="lt-chip" data-ref="printer"></span>
    <span class="ld-saved" data-ref="saved"></span>
    <span class="lt-error" data-ref="error"></span>
    <span class="lt-sp"></span>
    <div class="lt-seg" data-ref="modes"></div>
    <span class="lt-sp"></span>
    <span class="ld-actions" data-ref="tools"></span>
    <div class="ld-sample">
      <button type="button" class="lt-btn lt-btn-sm" data-act="picker" data-ref="sampleBtn" title="Item shown on the label"></button>
      <div class="ld-picker" data-ref="picker" hidden>
        <input class="lt-input" type="text" placeholder="Search items or scan a UPC" data-input="sampleSearch">
        <div data-ref="pickList"></div>
      </div>
    </div>
    <span class="ld-actions"><slot name="actions"></slot></span>
  </div>
  <div class="ld-body" data-ref="body">
    <aside class="ld-left">
      <input class="lt-input" type="text" placeholder="Search fields…" data-input="palette">
      <span class="lt-eyebrow">Item fields</span>
      <div class="ld-tiles" data-ref="fields"></div>
      <span class="lt-eyebrow">Basic</span>
      <div class="ld-tiles" data-ref="basic"></div>
      <p class="lt-note">Drag a field onto the label, or click it to add it at the top left.</p>
      <span class="lt-eyebrow">Layers</span>
      <div class="ld-layers" data-ref="layers"></div>
    </aside>
    <section class="ld-center" data-ref="center">
      <div class="ld-board">
        <div class="ld-ruler-x" data-ref="rulerX"></div>
        <div class="ld-ruler-y" data-ref="rulerY"></div>
        <div class="ld-stage" data-ref="stage">
          <canvas class="lt-canvas" data-ref="canvas"></canvas>
          <div class="ld-grid" data-ref="grid"></div>
          <div data-ref="elements"></div>
          <div data-ref="guides"></div>
        </div>
        <div class="ld-stocktag" data-ref="stocktag" hidden>Pre-printed color is a guide and is not printed</div>
      </div>
      <div class="ld-status" data-ref="status"></div>
    </section>
    <aside class="ld-right" data-ref="props"></aside>
  </div>
  <div class="ld-check" data-ref="check" hidden></div>
  <div class="ld-empty" data-ref="empty">No label to design yet.</div>
</div>`;
    }

    private emit(type: string, detail: any): void {
      this.dispatchEvent(new CustomEvent(type, { detail, bubbles: true, composed: true }));
    }

    private update(part: string): void {
      this.pending.add(part);
      if (this.frame) return;
      this.frame = requestAnimationFrame(() => {
        this.frame = 0;
        const parts = this.pending;
        this.pending = new Set();
        const all = parts.has('all');
        if (all || parts.has('top')) this.renderTop();
        if (all || parts.has('palette')) this.renderPalette();
        if (all || parts.has('layers')) this.renderLayers();
        if (all || parts.has('stage')) this.renderStage();
        if (all || parts.has('props')) this.renderProps();
        if (all || parts.has('status')) this.renderStatus();
        if (all || parts.has('check')) this.renderCheck();
      });
    }

    private changed(): void {
      this.emit('designchange', { design: this.getDesign(), name: this.label, dirty: this.dirty });
      this.update('top');
      this.update('layers');
      this.update('stage');
      this.update('props');
      this.update('status');
    }

    private normalizeDesign(design: LabelDesign): LabelDesign {
      design.elements = (design.elements || []).map((e) => ({ ...e, id: e.id || newId() }));
      return design;
    }

    private get pxPerMm(): number { return CSS_PX_PER_MM * this.zoom; }
    private get selected(): LabelElement | null { return this.d && this.selectedId ? this.d.elements.find((e) => e.id === this.selectedId) || null : null; }
    private get dpi(): number { return this.d ? this.d.dpi : 203; }
    private get gridMm(): number { return this.unit === 'in' ? MM_PER_INCH / 16 : 1; }
    private get canWrite(): boolean { return !this.ro && !!this.d; }

    private fitZoom(): number {
      if (!this.d) return 1;
      const width = this.getBoundingClientRect().width || window.innerWidth;
      const avail = Math.max(320, Math.min(width - 640, 900));
      const z = Math.min(avail / (this.d.widthMm * CSS_PX_PER_MM), 260 / (this.d.heightMm * CSS_PX_PER_MM));
      return ZOOMS.reduce((best, v) => (v <= z && v > best ? v : best), ZOOMS[0]);
    }

    private fmt(mm: number): string { return this.unit === 'in' ? (mm / MM_PER_INCH).toFixed(2) : mm.toFixed(1); }

    private parseLen(value: any): number | null {
      if (value === null || String(value).trim() === '') return null;
      const n = Number(value);
      if (!Number.isFinite(n)) return null;
      return this.unit === 'in' ? n * MM_PER_INCH : n;
    }

    private fieldLabel(key: string | undefined): string {
      const f = FIELDS.find((x) => x.key === key);
      return f ? f.label : key || '';
    }

    private boundField(el: LabelElement): string {
      const m = String(el.value || '').match(/^\{\{(\w+)\}\}$/);
      return m ? m[1] : '';
    }

    private isNative(el: LabelElement | null): boolean { return !!el && el.font === 'printer' && !!el.native; }

    private elementTitle(el: LabelElement): string {
      const f = this.boundField(el);
      if (el.type === 'barcode') return 'Barcode';
      if (el.type === 'price') return this.fieldLabel(f) || 'Price';
      if (el.type === 'text') return f ? this.fieldLabel(f) : 'Text';
      return ({ qr: 'QR code', box: 'Box', fill: 'Filled box', line: 'Line', image: 'Image' } as any)[el.type] || el.type;
    }

    private snapshot(): string { return JSON.stringify({ design: this.d }); }
    private saveState(): string { return JSON.stringify({ name: this.label.trim(), design: this.d }); }

    private remember(): void {
      this.undoStack.push(this.snapshot());
      if (this.undoStack.length > 100) this.undoStack.shift();
      this.redoStack = [];
    }

    private restore(state: string): void {
      this.d = JSON.parse(state).design;
      if (this.selectedId && !this.selected) this.selectedId = null;
      this.changed();
    }

    private snapMm(mm: number): number {
      const step = this.snap ? this.gridMm : 0;
      return snapToDot(step ? Math.round(mm / step) * step : mm, this.dpi);
    }

    private defaultElement(kind: ElementType, field?: string): LabelElement {
      const d = this.d as LabelDesign;
      const base: LabelElement = { id: newId(), type: kind, x: 2, y: 2, w: Math.min(30, d.widthMm - 4), h: 5 };
      if (kind === 'text') return { ...base, value: field ? `{{${field}}}` : 'Text', font: 'sans', size: 10, weight: field === 'itemName' ? 700 : 400, align: 'left', fit: 'cut', w: Math.min(40, d.widthMm - 4), h: 5 };
      if (kind === 'price') return { ...base, value: `{{${field || 'price'}}}`, font: 'sans', size: 28, weight: 700, align: 'center', format: 'super', w: Math.min(35, d.widthMm - 4), h: 12 };
      if (kind === 'barcode') return { ...base, value: '{{barcode}}', symbology: 'UPC_A', module: 2, hri: true, w: Math.min(dotsToMm(115 * 2, this.dpi), d.widthMm - 2), h: 9 };
      if (kind === 'qr') return { ...base, value: 'https://', w: 12, h: 12 };
      if (kind === 'line') return { ...base, w: Math.min(30, d.widthMm - 4), h: dotsToMm(3, this.dpi) };
      if (kind === 'box') return { ...base, w: 20, h: 10, stroke: 0.3 };
      if (kind === 'image') return { ...base, w: 15, h: 15 };
      return { ...base, w: 20, h: 6 };
    }

    private kindFor(field: string): ElementType {
      if (field === 'barcode') return 'barcode';
      if (field === 'price' || field === 'cashPrice' || field === 'creditPrice') return 'price';
      return 'text';
    }

    private addElement(kind: ElementType, field?: string, at?: { x: number; y: number }): void {
      if (!this.d || !this.canWrite) return;
      this.remember();
      const el = this.defaultElement(kind, field);
      if (at) {
        el.x = this.snapMm(Math.max(0, Math.min(at.x, this.d.widthMm - el.w)));
        el.y = this.snapMm(Math.max(0, Math.min(at.y, this.d.heightMm - el.h)));
      } else {
        const n = this.d.elements.length % 6;
        el.x = this.snapMm(2 + n * 2);
        el.y = this.snapMm(2 + n * 2);
      }
      this.d.elements = [...this.d.elements, el];
      this.selectedId = el.id;
      this.changed();
    }

    private change(mutator: (el: LabelElement) => void, keepNative = true): void {
      const el = this.selected;
      if (!el || !this.d || !this.canWrite) return;
      this.remember();
      mutator(el);
      if (!keepNative && el.native) { delete el.native; delete el.nativeFit; if (el.font === 'printer') el.font = 'sans'; }
      this.d.elements = [...this.d.elements];
      this.changed();
    }

    private setStyle(key: keyof LabelElement, value: any): void {
      const keepNative = key === 'when' || key === 'value';
      this.change((el) => { (el as any)[key] = value; }, keepNative);
    }

    private setPos(key: 'x' | 'y' | 'w' | 'h', value: any): void {
      const mm = this.parseLen(value);
      if (mm === null) { this.update('props'); return; }
      this.change((el) => {
        (el as any)[key] = Math.max(key === 'w' || key === 'h' ? dotsToMm(2, this.dpi) : -1000, snapToDot(mm, this.dpi));
        if (el.type === 'qr' && (key === 'w' || key === 'h')) el.w = el.h = (el as any)[key];
      }, key === 'x' || key === 'y');
    }

    private setAtLeast(key: 'size' | 'lines', value: any): void {
      const n = Number(value);
      if (value === null || String(value).trim() === '' || !Number.isFinite(n)) { this.update('props'); return; }
      this.setStyle(key, Math.max(1, key === 'lines' ? Math.round(n) : n));
    }

    private setDesign(key: 'widthMm' | 'heightMm' | 'gapMm', value: any): void {
      if (!this.d || !this.canWrite) return;
      const mm = this.parseLen(value);
      if (mm === null || mm < (key === 'gapMm' ? 0 : 5) || mm > (key === 'gapMm' ? 20 : 300)) { this.update('props'); return; }
      this.remember();
      (this.d as any)[key] = Math.round(mm * 100) / 100;
      this.changed();
    }

    private duplicateSelected(): void {
      const el = this.selected;
      if (!el || !this.d || !this.canWrite) return;
      this.remember();
      const copy = { ...JSON.parse(JSON.stringify(el)), id: newId(), x: snapToDot(el.x + 2, this.dpi), y: snapToDot(el.y + 2, this.dpi) };
      this.d.elements = [...this.d.elements, copy];
      this.selectedId = copy.id;
      this.changed();
    }

    private removeSelected(): void {
      if (!this.d || !this.selectedId || !this.canWrite) return;
      this.remember();
      this.d.elements = this.d.elements.filter((e) => e.id !== this.selectedId);
      this.selectedId = null;
      this.changed();
    }

    private moveLayer(step: number): void {
      const d = this.d;
      if (!d || !this.selectedId || !this.canWrite) return;
      const i = d.elements.findIndex((e) => e.id === this.selectedId);
      const j = i + step;
      if (i < 0 || j < 0 || j >= d.elements.length) return;
      this.remember();
      const list = [...d.elements];
      [list[i], list[j]] = [list[j], list[i]];
      d.elements = list;
      this.changed();
    }

    private onClick(event: Event): void {
      const target = (event.target as HTMLElement).closest('[data-act]') as HTMLElement | null;
      if (!target || (target as HTMLButtonElement).disabled) return;
      const act = target.dataset.act as string;
      const v = target.dataset.v as string;
      const el = this.selected;
      switch (act) {
        case 'mode': this.setMode(v as 'design' | 'check'); break;
        case 'undo': this.undo(); break;
        case 'redo': this.redo(); break;
        case 'zoom': this.zoomBy(Number(v)); break;
        case 'grid': this.showGrid = !this.showGrid; this.update('stage'); this.update('top'); break;
        case 'snap': this.snap = !this.snap; this.update('top'); this.update('status'); break;
        case 'unit': this.unit = v as 'in' | 'mm'; this.update('all'); break;
        case 'picker': this.togglePicker(); break;
        case 'sample': this.useSample(this.sampleResults[Number(v)]); break;
        case 'add': this.addElement(target.dataset.kind as ElementType, target.dataset.field || undefined); break;
        case 'layer': this.selectedId = v; this.update('layers'); this.update('stage'); this.update('props'); this.update('status'); break;
        case 'forward': this.moveLayer(1); break;
        case 'backward': this.moveLayer(-1); break;
        case 'duplicate': this.duplicateSelected(); break;
        case 'remove': this.removeSelected(); break;
        case 'style': this.setStyle(target.dataset.key as keyof LabelElement, v); break;
        case 'toggle': if (el) this.setStyle(v as keyof LabelElement, v === 'hri' ? el.hri === false : !(el as any)[v]); break;
        case 'bold': if (el) this.setStyle('weight', (el.weight || 400) >= 700 ? 400 : 700); break;
        case 'imageMode': this.imageMode = v as 'dither' | 'threshold'; this.update('props'); break;
        case 'printer': if (this.d && this.canWrite && this.d.printer !== v) { this.remember(); this.d = { ...this.d, printer: v as any }; this.changed(); } break;
        case 'dpi': if (this.d && this.canWrite && this.d.dpi !== Number(v)) { this.remember(); this.d = { ...this.d, dpi: Number(v) }; this.changed(); } break;
        case 'checkFilter': this.checkFilter = v as CheckKind; this.update('check'); break;
        case 'checkPick': this.checkSelected = this.filteredProblems()[Number(v)] || null; this.update('check'); break;
        case 'checkRun': this.runCheck(); break;
        case 'letWrap': this.letWrap(v); break;
      }
    }

    private onChange(event: Event): void {
      const target = event.target as HTMLInputElement;
      const key = target.dataset && target.dataset.change;
      if (!key) return;
      const value = target.type === 'checkbox' ? target.checked : target.value;
      switch (key) {
        case 'pos': this.setPos(target.dataset.key as any, value); break;
        case 'field': this.change((el) => { el.value = value ? `{{${value}}}` : (el.type === 'text' ? 'Text' : el.value); }); break;
        case 'text': this.change((el) => { el.value = String(value); }); break;
        case 'symbology': this.setStyle('symbology', value); break;
        case 'module': this.setStyle('module', Number(value)); break;
        case 'hri': { const el = this.selected; if (el) this.setStyle('hri', el.hri === false); break; }
        case 'font': this.setStyle('font', value); break;
        case 'size': this.setAtLeast('size', value); break;
        case 'lines': this.setAtLeast('lines', value); break;
        case 'fit': this.setStyle('fit', value); break;
        case 'stroke': { const mm = this.parseLen(value); if (mm === null) this.update('props'); else this.setStyle('stroke', Math.max(0.1, mm)); break; }
        case 'when': this.setStyle('when', value || undefined); break;
        case 'image': this.onImageFile(target); break;
        case 'design': this.setDesign(target.dataset.key as any, value); break;
        case 'stock': this.toggleStock(); break;
        case 'stockColor': this.setStock('color', value); break;
        case 'stockFrom': this.setStock('from', value); break;
      }
    }

    private onInput(event: Event): void {
      const target = event.target as HTMLInputElement;
      const key = target.dataset && target.dataset.input;
      if (key === 'name') {
        this.label = target.value;
        if (this.label.trim()) this.errorText = '';
        this.emit('designchange', { design: this.getDesign(), name: this.label, dirty: this.dirty });
        this.update('top');
      } else if (key === 'palette') {
        this.paletteFilter = target.value;
        this.update('palette');
      } else if (key === 'sampleSearch') {
        clearTimeout(this.sampleTimer);
        const q = target.value;
        this.sampleTimer = setTimeout(() => this.findSamples(q), 300);
      }
    }

    private onDragStart(event: DragEvent): void {
      const tile = (event.target as HTMLElement).closest('[data-act="add"]') as HTMLElement | null;
      if (!tile || !event.dataTransfer) return;
      event.dataTransfer.setData('text/plain', JSON.stringify({ kind: tile.dataset.kind, field: tile.dataset.field || null }));
      event.dataTransfer.effectAllowed = 'copy';
    }

    private onDrop(event: DragEvent): void {
      event.preventDefault();
      let spec: { kind: ElementType; field: string | null } | null = null;
      try { spec = JSON.parse(event.dataTransfer ? event.dataTransfer.getData('text/plain') : ''); } catch (e) { spec = null; }
      if (!spec || !spec.kind) return;
      const rect = this.refs.stage.getBoundingClientRect();
      this.addElement(spec.kind, spec.field || undefined, { x: (event.clientX - rect.left) / this.pxPerMm, y: (event.clientY - rect.top) / this.pxPerMm });
    }

    private onPointerDown(event: PointerEvent): void {
      const target = event.target as HTMLElement;
      const handle = target.closest('[data-handle]') as HTMLElement | null;
      const box = target.closest('[data-el]') as HTMLElement | null;
      if (!target.closest('.ld-center')) return;
      if (!box) {
        if (this.selectedId) { this.selectedId = null; this.update('layers'); this.update('stage'); this.update('props'); this.update('status'); }
        return;
      }
      event.stopPropagation();
      const el = this.d && this.d.elements.find((e) => e.id === box.dataset.el);
      if (!el) return;
      if (this.selectedId !== el.id) {
        this.selectedId = el.id;
        this.update('layers'); this.update('stage'); this.update('props'); this.update('status');
      }
      if (!this.canWrite || event.button !== 0) return;
      this.drag = { kind: handle ? 'resize' : 'move', id: el.id, handle: handle ? handle.dataset.handle as Handle : undefined, startX: event.clientX, startY: event.clientY, orig: { ...el }, moved: false };
    }

    private onPointerMove = (event: PointerEvent): void => {
      const drag = this.drag;
      if (!drag || !this.d) return;
      const dx = (event.clientX - drag.startX) / this.pxPerMm;
      const dy = (event.clientY - drag.startY) / this.pxPerMm;
      if (!drag.moved && Math.abs(dx) + Math.abs(dy) < 0.3) return;
      if (!drag.moved) { this.remember(); drag.moved = true; }
      const el = this.d.elements.find((e) => e.id === drag.id);
      if (!el) return;
      const o = drag.orig;
      if (drag.kind === 'move') {
        const pos = this.withGuides(el, o.x + dx, o.y + dy);
        el.x = pos.x;
        el.y = pos.y;
      } else {
        const h = drag.handle as Handle;
        let x = o.x; let y = o.y; let w = o.w; let hgt = o.h;
        if (h.includes('e')) w = o.w + dx;
        if (h.includes('s')) hgt = o.h + dy;
        if (h.includes('w')) { x = o.x + dx; w = o.w - dx; }
        if (h.includes('n')) { y = o.y + dy; hgt = o.h - dy; }
        const min = dotsToMm(2, this.dpi);
        if (w < min) { if (h.includes('w')) x -= min - w; w = min; }
        if (hgt < min) { if (h.includes('n')) y -= min - hgt; hgt = min; }
        el.x = this.snapMm(x); el.y = this.snapMm(y); el.w = Math.max(min, this.snapMm(w)); el.h = Math.max(min, this.snapMm(hgt));
        if (el.type === 'qr') el.h = el.w;
      }
      this.update('stage');
      this.update('status');
    };

    private onPointerUp = (): void => {
      const drag = this.drag;
      this.drag = null;
      this.guides = [];
      if (drag && drag.moved) this.changed();
      else this.update('stage');
    };

    private onKey = (event: KeyboardEvent): void => {
      if (this.mode !== 'design' || !this.d || !this.isConnected) return;
      const origin = (event.composedPath()[0] || event.target) as HTMLElement;
      const tag = origin && origin.tagName;
      const typing = tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA' || (origin && origin.isContentEditable);
      const mod = event.metaKey || event.ctrlKey;
      const key = event.key.toLowerCase();
      if (mod && key === 's') { event.preventDefault(); this.requestSave(); return; }
      if (typing) return;
      if (mod && key === 'z') { event.preventDefault(); if (event.shiftKey) this.redo(); else this.undo(); return; }
      if (mod && key === 'y') { event.preventDefault(); this.redo(); return; }
      const el = this.selected;
      if (!el || !this.canWrite) { if (event.key === 'Escape' && this.selectedId) { this.selectedId = null; this.update('all'); } return; }
      if (mod && key === 'd') { event.preventDefault(); this.duplicateSelected(); return; }
      if (event.key === 'Delete' || event.key === 'Backspace') { event.preventDefault(); this.removeSelected(); return; }
      if (event.key === 'Escape') { this.selectedId = null; this.update('all'); return; }
      const step = dotsToMm(event.shiftKey ? 10 : 1, this.dpi);
      const moves: { [k: string]: [number, number] } = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
      const mv = moves[event.key];
      if (mv) {
        event.preventDefault();
        this.remember();
        el.x = snapToDot(el.x + mv[0], this.dpi);
        el.y = snapToDot(el.y + mv[1], this.dpi);
        this.d.elements = [...this.d.elements];
        this.changed();
      }
    };

    private withGuides(el: LabelElement, x: number, y: number): { x: number; y: number } {
      const d = this.d as LabelDesign;
      const tol = 0.8;
      const guides: Guide[] = [];
      const xs: number[] = [d.widthMm / 2];
      const ys: number[] = [d.heightMm / 2];
      for (const o of d.elements) {
        if (o.id === el.id) continue;
        xs.push(o.x, o.x + o.w, o.x + o.w / 2);
        ys.push(o.y, o.y + o.h, o.y + o.h / 2);
      }
      const tryAxis = (start: number, size: number, lines: number[], axis: 'x' | 'y'): number => {
        for (const line of lines) {
          for (const [offset, edge] of [[0, start], [size / 2, start + size / 2], [size, start + size]]) {
            if (Math.abs(edge - line) <= tol) { guides.push({ axis, mm: line }); return snapToDot(line - offset, this.dpi); }
          }
        }
        return start;
      };
      const nx = tryAxis(this.snapMm(x), el.w, xs, 'x');
      const ny = tryAxis(this.snapMm(y), el.h, ys, 'y');
      this.guides = guides;
      return { x: nx, y: ny };
    }

    private zoomBy(step: number): void {
      const i = ZOOMS.indexOf(this.zoom);
      this.zoom = ZOOMS[Math.max(0, Math.min(ZOOMS.length - 1, (i < 0 ? 2 : i) + step))];
      this.update('top');
      this.update('stage');
    }

    private setMode(mode: 'design' | 'check'): void {
      this.mode = mode;
      if (mode === 'check' && !this.checkRunning && !this.checkResults.length) this.runCheck();
      this.update('all');
    }

    private togglePicker(): void {
      this.samplePickerOpen = !this.samplePickerOpen;
      if (this.samplePickerOpen && !this.sampleResults.length) this.findSamples('');
      this.update('top');
    }

    private findSamples(query: string): void {
      if (!this.source || !this.source.search) { this.update('top'); return; }
      this.sampleLoading = true;
      this.update('top');
      this.source.search(query).then((items) => {
        this.sampleLoading = false;
        this.sampleResults = items || [];
        this.update('top');
      }, () => { this.sampleLoading = false; this.sampleResults = []; this.update('top'); });
    }

    private onImageFile(input: HTMLInputElement): void {
      const file = input.files && input.files[0];
      input.value = '';
      const el = this.selected;
      if (!file || !el || el.type !== 'image') return;
      if (!/^image\/(png|jpe?g|gif|webp|bmp|svg\+xml)$/.test(file.type)) { this.imageError = 'Use a PNG, JPG, GIF, WebP, BMP or SVG image.'; this.update('props'); return; }
      if (file.size > 5 * 1024 * 1024) { this.imageError = 'The image is larger than 5 MB.'; this.update('props'); return; }
      this.imageError = '';
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        const w = Math.max(8, mmToDots(el.w, this.dpi));
        const h = Math.max(8, mmToDots(el.h, this.dpi));
        URL.revokeObjectURL(url);
        if (w * h > 900 * 900) { this.imageError = 'Make the image box smaller (it is too many printer dots).'; this.update('props'); return; }
        const bits = imageFromSource(img, img.naturalWidth || img.width, img.naturalHeight || img.height, w, h, this.imageMode);
        const target = this.d && this.d.elements.find((e) => e.id === el.id);
        if (!target || !this.d) return;
        this.remember();
        target.image = bits;
        this.d.elements = [...this.d.elements];
        this.changed();
      };
      img.onerror = () => { this.imageError = 'That image could not be read.'; URL.revokeObjectURL(url); this.update('props'); };
      img.src = url;
    }

    private toggleStock(): void {
      if (!this.d || !this.canWrite) return;
      this.remember();
      const d = this.d;
      d.stock = d.stock ? null : { color: '#f3e436', x: d.widthMm * 0.52, y: 0, w: d.widthMm * 0.48, h: d.heightMm };
      this.changed();
    }

    private setStock(key: 'color' | 'from', value: any): void {
      const d = this.d;
      if (!d || !d.stock || !this.canWrite) return;
      this.remember();
      if (key === 'color') d.stock.color = String(value);
      else {
        const pct = Math.max(0, Math.min(100, Number(value))) / 100;
        d.stock.x = d.widthMm * pct;
        d.stock.w = d.widthMm - d.stock.x;
      }
      this.changed();
    }

    private runCheck(): void {
      const source = this.source;
      if (!this.d || !source || !source.page) { this.checkError = 'Pick a store to check against its items.'; this.update('check'); return; }
      const token = ++this.checkToken;
      const design = JSON.parse(JSON.stringify(this.d)) as LabelDesign;
      this.checkRunning = true;
      this.checkError = '';
      this.checkResults = [];
      this.checkDone = 0;
      this.checkTotal = 0;
      this.checkSelected = null;
      this.update('check');
      const canvas = document.createElement('canvas');
      const page = (offset: number) => {
        (source.page as any)(offset, CHECK_PAGE).then((res: any) => {
          if (token !== this.checkToken) return;
          if (!res) { this.checkRunning = false; this.checkError = 'Could not load the store items.'; this.update('check'); return; }
          if (res.storeName) this.store = res.storeName;
          this.checkTotal = Math.min(res.total, CHECK_MAX_ITEMS);
          for (const item of res.items) {
            const data = labelDataFromItem(item, { limits: design.limits, storeName: this.store });
            this.checkResults.push({ item, data, warnings: drawLabel(canvas, design, data, { ppm: 3 }) });
          }
          this.checkDone = this.checkResults.length;
          const next = offset + res.items.length;
          if (res.items.length && next < this.checkTotal) { this.update('check'); setTimeout(() => page(next), 0); }
          else {
            this.checkRunning = false;
            this.checkSelected = this.problems()[0] || this.checkResults[0] || null;
            this.update('check');
          }
        }, () => {
          if (token !== this.checkToken) return;
          this.checkRunning = false;
          this.checkError = 'Could not load the store items.';
          this.update('check');
        });
      };
      ensureLabelFonts(this.fonts).then(() => page(0));
    }

    private problems(): CheckResult[] { return this.checkResults.filter((r) => r.warnings.length); }

    private filteredProblems(): CheckResult[] {
      const f = this.checkFilter;
      return this.problems().filter((r) => f === 'all' || r.warnings.some((w) => w.kind === f)).slice(0, 120);
    }

    private letWrap(id: string): void {
      if (!this.d || !this.canWrite) return;
      this.remember();
      const target = this.d.elements.find((e) => e.id === id);
      if (target) {
        target.fit = 'wrap';
        target.lines = 2;
        if (target.native) { delete target.native; delete target.nativeFit; if (target.font === 'printer') target.font = 'sans'; }
      }
      this.d = { ...this.d, elements: [...this.d.elements] };
      this.changed();
      this.runCheck();
    }

    private itemTitle(item: any): string { return item.posdecs || item.item_name || `Item ${item.item_id}`; }

    private printerDots(): string { return this.d ? `${mmToDots(this.d.widthMm, this.dpi)} × ${mmToDots(this.d.heightMm, this.dpi)} dots` : ''; }

    private renderTop(): void {
      const d = this.d;
      const r = this.refs;
      r.empty.hidden = !!d;
      r.body.hidden = !d || this.mode !== 'design';
      r.check.hidden = !d || this.mode !== 'check';
      if (!d) return;
      const name = r.name as HTMLInputElement;
      if (name.value !== this.label && this.root.activeElement !== name) name.value = this.label;
      r.size.textContent = this.unit === 'in'
        ? `${+(d.widthMm / MM_PER_INCH).toFixed(2)} × ${+(d.heightMm / MM_PER_INCH).toFixed(2)} in`
        : `${+d.widthMm.toFixed(1)} × ${+d.heightMm.toFixed(1)} mm`;
      r.printer.textContent = `${d.printer === 'zpl' ? 'Zebra' : 'Godex'} · ${this.dpi} dpi`;
      const dirty = this.dirty;
      r.saved.className = `ld-saved${dirty ? ' ld-unsaved' : ''}`;
      r.saved.textContent = dirty ? 'Unsaved changes' : this.savedAt ? `Saved ${this.savedAt.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}` : '';
      r.error.textContent = this.errorText;
      r.modes.innerHTML = `<button type="button" class="${on(this.mode === 'design').trim()}" data-act="mode" data-v="design">Design</button><button type="button" class="${on(this.mode === 'check').trim()}" data-act="mode" data-v="check">Check items</button>`;
      r.tools.innerHTML = this.mode !== 'design' ? '' : `
        <button type="button" class="lt-icon-btn" data-act="undo" title="Undo (Ctrl+Z)" ${this.undoStack.length ? '' : 'disabled'}>↶</button>
        <button type="button" class="lt-icon-btn" data-act="redo" title="Redo (Ctrl+Shift+Z)" ${this.redoStack.length ? '' : 'disabled'}>↷</button>
        <span class="ld-div"></span>
        <button type="button" class="lt-icon-btn" data-act="zoom" data-v="-1" title="Zoom out">−</button>
        <span class="ld-zoom">${Math.round(this.zoom * 100)}%</span>
        <button type="button" class="lt-icon-btn" data-act="zoom" data-v="1" title="Zoom in">+</button>
        <span class="ld-div"></span>
        <button type="button" class="lt-icon-btn${on(this.showGrid)}" data-act="grid" title="Grid">#</button>
        <button type="button" class="lt-icon-btn${on(this.snap)}" data-act="snap" title="Snap to grid">⌖</button>
        <div class="lt-seg lt-seg-sm"><button type="button" class="${on(this.unit === 'in').trim()}" data-act="unit" data-v="in">in</button><button type="button" class="${on(this.unit === 'mm').trim()}" data-act="unit" data-v="mm">mm</button></div>`;
      r.sampleBtn.textContent = `Sample: ${this.sampleName} ▾`;
      r.picker.hidden = !this.samplePickerOpen;
      if (this.samplePickerOpen) {
        const hasSource = !!(this.source && this.source.search);
        r.pickList.innerHTML = !hasSource ? '<div class="ld-pick-empty">Pick a store to use its items.</div>'
          : this.sampleLoading ? '<div class="ld-pick-empty">Searching…</div>'
          : this.sampleResults.map((it, i) => `<button type="button" class="ld-pick" data-act="sample" data-v="${i}"><span>${esc(this.itemTitle(it))}</span><small>${esc(formatMoney(it.price))}</small></button>`).join('')
            || '<div class="ld-pick-empty">No items found.</div>';
      }
    }

    private renderPalette(): void {
      const q = this.paletteFilter.trim().toLowerCase();
      const fields = FIELDS.filter((f: FieldOption) => !q || f.label.toLowerCase().includes(q));
      const dis = this.canWrite ? '' : ' disabled';
      this.refs.fields.innerHTML = fields.map((f) => `<button type="button" class="ld-tile" draggable="true" data-act="add" data-kind="${this.kindFor(f.key)}" data-field="${esc(f.key)}"${dis}>${esc(f.label)}</button>`).join('');
      this.refs.basic.innerHTML = BASIC_PALETTE.map((b) => `<button type="button" class="ld-tile" draggable="true" data-act="add" data-kind="${b.kind}"${dis}><i>${b.icon}</i>${esc(b.label)}</button>`).join('');
    }

    private renderLayers(): void {
      const d = this.d;
      if (!d) return;
      this.refs.layers.innerHTML = d.elements.length
        ? d.elements.slice().reverse().map((el) => `<button type="button" class="ld-layer${on(el.id === this.selectedId)}" data-act="layer" data-v="${esc(el.id)}">${esc(this.elementTitle(el))}${this.isNative(el) ? '<small>printer font</small>' : ''}</button>`).join('')
        : '<span class="lt-note">Nothing on the label yet.</span>';
    }

    private ticks(axis: 'x' | 'y'): string {
      const d = this.d as LabelDesign;
      const lenMm = axis === 'x' ? d.widthMm : d.heightMm;
      const ppm = this.pxPerMm;
      const out: string[] = [];
      const tick = (px: number, len: number, label: string | null) => {
        const pos = axis === 'x' ? `left:${px}px;height:${len}px` : `top:${px}px;width:${len}px`;
        out.push(`<i style="${pos}">${label !== null ? `<b>${label}</b>` : ''}</i>`);
      };
      if (this.unit === 'in') {
        const steps = Math.floor((lenMm / MM_PER_INCH) * 8 + 1e-6);
        for (let i = 0; i <= steps; i++) tick((i / 8) * MM_PER_INCH * ppm, i % 8 === 0 ? 18 : i % 4 === 0 ? 10 : i % 2 === 0 ? 6 : 4, i % 8 === 0 ? String(i / 8) : null);
      } else {
        for (let i = 0; i <= Math.floor(lenMm); i++) tick(i * ppm, i % 10 === 0 ? 18 : i % 5 === 0 ? 10 : 5, i % 10 === 0 ? String(i) : null);
      }
      return out.join('');
    }

    private renderStage(): void {
      const d = this.d;
      if (!d || this.mode !== 'design') return;
      const r = this.refs;
      const ppm = this.pxPerMm;
      const w = d.widthMm * ppm;
      const h = d.heightMm * ppm;
      r.stage.style.width = `${w}px`;
      r.stage.style.height = `${h}px`;
      r.rulerX.style.width = `${w}px`;
      r.rulerY.style.height = `${h}px`;
      r.rulerX.innerHTML = this.ticks('x');
      r.rulerY.innerHTML = this.ticks('y');
      const canvas = r.canvas as HTMLCanvasElement;
      const dpr = Math.min(3, Math.max(1, window.devicePixelRatio || 1));
      this.warnings = drawLabel(canvas, d, this.data, { ppm: ppm * dpr, stock: true });
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      r.grid.hidden = !this.showGrid;
      r.grid.style.backgroundSize = `${this.gridMm * ppm}px ${this.gridMm * ppm}px`;
      const warned = new Set(this.warnings.map((x) => x.elementId));
      r.elements.innerHTML = d.elements.map((el) => {
        const handles = el.id === this.selectedId && this.canWrite ? HANDLES.map((hd) => `<span class="ld-h ld-h-${hd}" data-handle="${hd}"></span>`).join('') : '';
        return `<div class="ld-el${on(el.id === this.selectedId)}${warned.has(el.id) ? ' warn' : ''}" data-el="${esc(el.id)}" title="${esc(this.elementTitle(el))}" style="left:${el.x * ppm}px;top:${el.y * ppm}px;width:${el.w * ppm}px;height:${el.h * ppm}px">${handles}</div>`;
      }).join('');
      r.guides.innerHTML = this.guides.map((g) => `<div class="ld-guide ld-guide-${g.axis}" style="${g.axis === 'x' ? 'left' : 'top'}:${g.mm * ppm}px"></div>`).join('');
      r.stocktag.hidden = !d.stock;
    }

    private renderStatus(): void {
      const d = this.d;
      if (!d) return;
      const s = this.selected;
      const warning = s ? this.warnings.find((w) => w.elementId === s.id) : undefined;
      const left = s
        ? `<b>${esc(this.elementTitle(s))}</b><span>X ${this.fmt(s.x)} · Y ${this.fmt(s.y)} · W ${this.fmt(s.w)} · H ${this.fmt(s.h)} ${this.unit}</span>${warning ? `<span class="lt-chip lt-chip-warn">${esc(warning.message)}</span>` : ''}`
        : `<span>${d.elements.length} element${d.elements.length === 1 ? '' : 's'} · grid ${this.unit === 'in' ? '1/16 in' : '1 mm'}${this.snap ? ' · snap on' : ''}</span>`;
      this.refs.status.innerHTML = `${left}<span class="lt-sp"></span><span>Arrow keys move 1 dot, Shift moves 10</span>`;
    }

    private renderProps(): void {
      const d = this.d;
      if (!d || this.mode !== 'design') return;
      const el = this.selected;
      const ro = this.canWrite ? '' : ' disabled';
      const rd = this.canWrite ? '' : ' readonly';
      const sec = (body: string) => `<div class="ld-sec">${body}</div>`;
      if (!el) {
        this.refs.props.innerHTML = [
          '<div class="ld-sec ld-head"><div><div class="ld-title">Label</div><div class="lt-note">Select an element to change it.</div></div></div>',
          sec(`<span class="lt-eyebrow">Size (${this.unit})</span><div class="ld-two">
            <label class="lt-field"><span class="ld-label">Width</span><input class="lt-input" type="number" step="0.01" value="${this.fmt(d.widthMm)}" data-change="design" data-key="widthMm"${rd}></label>
            <label class="lt-field"><span class="ld-label">Height</span><input class="lt-input" type="number" step="0.01" value="${this.fmt(d.heightMm)}" data-change="design" data-key="heightMm"${rd}></label>
            <label class="lt-field"><span class="ld-label">Gap</span><input class="lt-input" type="number" step="0.01" value="${this.fmt(d.gapMm || 0)}" data-change="design" data-key="gapMm"${rd}></label></div>`),
          sec(`<span class="lt-eyebrow">Printer</span>
            <div class="lt-seg"><button type="button" class="${on(d.printer !== 'zpl').trim()}" data-act="printer" data-v="ezpl"${ro}>Godex</button><button type="button" class="${on(d.printer === 'zpl').trim()}" data-act="printer" data-v="zpl"${ro}>Zebra</button></div>
            <div class="lt-seg"><button type="button" class="${on(d.dpi === 203).trim()}" data-act="dpi" data-v="203"${ro}>203 dpi</button><button type="button" class="${on(d.dpi === 300).trim()}" data-act="dpi" data-v="300"${ro}>300 dpi</button></div>
            ${d.elements.some((e) => e.native && !(e.native as any)[d.printer || 'ezpl']) ? '<p class="lt-note lt-warn-text">Some elements use the other printer\'s font. They will print with a designer font on this printer.</p>' : ''}`),
          sec(`<span class="lt-eyebrow">Pre-printed stock</span>
            <label class="lt-check"><input type="checkbox" data-change="stock" ${d.stock ? 'checked' : ''}${ro}> Show a pre-printed color as a guide</label>
            ${d.stock ? `<div class="ld-two"><label class="lt-field"><span class="ld-label">Color</span><input class="lt-input" type="color" value="${esc(d.stock.color)}" data-change="stockColor"${ro}></label>
            <label class="lt-field"><span class="ld-label">Starts at (% of width)</span><input class="lt-input" type="number" min="0" max="100" value="${Math.round((d.stock.x / d.widthMm) * 100)}" data-change="stockFrom"${rd}></label></div>` : ''}`),
          sec(`<span class="lt-eyebrow">Printer area</span><p class="lt-note">${this.printerDots()} at ${d.dpi} dpi.</p>`)
        ].join('');
        return;
      }
      const typeName = el.type === 'price' ? 'Price' : el.type.charAt(0).toUpperCase() + el.type.slice(1);
      const parts: string[] = [];
      parts.push(`<div class="ld-sec ld-head"><div><div class="ld-title">${esc(this.elementTitle(el))}</div><div class="lt-note">${typeName} element</div></div><span class="lt-sp"></span>
        <button type="button" class="lt-icon-btn" data-act="forward" title="Bring forward"${ro}>▲</button>
        <button type="button" class="lt-icon-btn" data-act="backward" title="Send backward"${ro}>▼</button>
        <button type="button" class="lt-icon-btn" data-act="duplicate" title="Duplicate (Ctrl+D)"${ro}>⧉</button>
        <button type="button" class="lt-icon-btn" data-act="remove" title="Delete (Del)"${ro}>${TRASH}</button></div>`);
      if (this.isNative(el)) parts.push(sec('<p class="lt-note">Printer font: this prints with the printer\'s own font, exactly like today\'s labels. You can move it. Changing its size or style switches it to a designer font.</p>'));
      if (el.type === 'text' || el.type === 'price' || el.type === 'barcode' || el.type === 'qr') {
        const bound = this.boundField(el);
        let data = '<span class="lt-eyebrow">Data</span>';
        if (el.type !== 'qr') {
          data += `<label class="lt-field"><span class="ld-label">Field</span><select class="lt-input" data-change="field"${ro}>
            ${el.type === 'text' ? `<option value=""${bound ? '' : ' selected'}>Fixed text</option>` : ''}
            ${FIELDS.map((f) => `<option value="${esc(f.key)}"${bound === f.key ? ' selected' : ''}>${esc(f.label)}</option>`).join('')}</select></label>`;
        }
        if (el.type === 'qr' || (el.type === 'text' && !bound)) {
          data += `<label class="lt-field"><span class="ld-label">${el.type === 'qr' ? esc(QR_HINT) : 'Text'}</span><input class="lt-input" type="text" value="${esc(el.value)}" data-change="text"${rd}></label>`;
        }
        if (el.type === 'price') {
          data += `<div class="lt-field"><span class="ld-label">Format</span><div class="lt-seg lt-seg-sm">
            <button type="button" class="${on(el.format === 'super').trim()}" data-act="style" data-key="format" data-v="super"${ro}>$7<sup>59</sup></button>
            <button type="button" class="${on(!el.format || el.format === 'plain').trim()}" data-act="style" data-key="format" data-v="plain"${ro}>$7.59</button>
            <button type="button" class="${on(el.format === 'nosign').trim()}" data-act="style" data-key="format" data-v="nosign"${ro}>7.59</button></div></div>`;
        }
        if (el.type === 'barcode') {
          const sym = el.symbology || 'UPC_A';
          const mod = el.module || 2;
          data += `<label class="lt-field"><span class="ld-label">Type</span><select class="lt-input" data-change="symbology"${ro}>
              ${[['UPC_A', 'UPC-A'], ['EAN13', 'EAN-13'], ['CODE128', 'Code 128']].map(([v, l]) => `<option value="${v}"${sym === v ? ' selected' : ''}>${l}</option>`).join('')}</select></label>
            <label class="lt-field"><span class="ld-label">Bar width (printer dots)</span><select class="lt-input" data-change="module"${ro}>
              ${[1, 2, 3, 4].map((n) => `<option value="${n}"${mod === n ? ' selected' : ''}>${n}</option>`).join('')}</select></label>
            <label class="lt-check"><input type="checkbox" data-change="hri" ${el.hri !== false ? 'checked' : ''}${ro}> Show the digits</label>`;
        }
        parts.push(sec(data));
      }
      if (el.type === 'text' || el.type === 'price') {
        const font = el.font || 'sans';
        const fit = el.fit || (el.type === 'price' ? 'shrink' : 'cut');
        parts.push(sec(`<span class="lt-eyebrow">Text</span><div class="ld-two">
          <label class="lt-field"><span class="ld-label">Font</span><select class="lt-input" data-change="font"${ro}>
            ${FONTS.filter((f) => f.key !== 'printer' || el.font === 'printer').map((f) => `<option value="${f.key}"${font === f.key ? ' selected' : ''}>${esc(f.label)}</option>`).join('')}</select></label>
          <label class="lt-field"><span class="ld-label">Size (pt)</span><input class="lt-input" type="number" min="4" max="200" step="0.5" value="${el.size ? Math.round(el.size * 10) / 10 : ''}" data-change="size"${rd}></label></div>
          <p class="lt-note">The size stays the same on every label. A long value never makes the font smaller unless you choose Shrink.</p>
          <label class="lt-field"><span class="ld-label">If it does not fit</span><select class="lt-input" data-change="fit"${this.canWrite && el.type !== 'price' ? '' : ' disabled'}>
            ${[['cut', 'Cut at the edge'], ['wrap', 'Wrap onto more lines'], ['shrink', 'Shrink that label only']].map(([v, l]) => `<option value="${v}"${fit === v ? ' selected' : ''}>${l}</option>`).join('')}</select></label>
          ${el.fit === 'wrap' ? `<label class="lt-field"><span class="ld-label">Lines</span><input class="lt-input lt-num" type="number" min="1" max="6" value="${el.lines || 2}" data-change="lines"${rd}></label>` : ''}
          <div class="ld-row"><div class="lt-seg lt-seg-sm">
            <button type="button" class="${on(!el.align || el.align === 'left').trim()}" data-act="style" data-key="align" data-v="left"${ro}>Left</button>
            <button type="button" class="${on(el.align === 'center').trim()}" data-act="style" data-key="align" data-v="center"${ro}>Center</button>
            <button type="button" class="${on(el.align === 'right').trim()}" data-act="style" data-key="align" data-v="right"${ro}>Right</button></div></div>
          <div class="ld-row">
            <button type="button" class="lt-icon-btn${on((el.weight || 400) >= 700)}" data-act="bold" title="Bold"${ro}><b>B</b></button>
            <button type="button" class="lt-icon-btn${on(el.italic)}" data-act="toggle" data-v="italic" title="Italic"${ro}><i>I</i></button>
            <button type="button" class="lt-icon-btn${on(el.upper)}" data-act="toggle" data-v="upper" title="Capitals"${ro}>AA</button>
            ${el.type === 'text' ? `<button type="button" class="lt-icon-btn${on(el.inverse)}" data-act="toggle" data-v="inverse" title="White on black"${ro}>◩</button>` : ''}
            ${el.type === 'price' ? `<button type="button" class="lt-icon-btn${on(el.strike)}" data-act="toggle" data-v="strike" title="Strike through (was price)"${ro}><s>S</s></button>` : ''}
          </div>`));
      }
      if (el.type === 'image') {
        parts.push(sec(`<span class="lt-eyebrow">Image</span><div class="lt-seg lt-seg-sm">
          <button type="button" class="${on(this.imageMode === 'dither').trim()}" data-act="imageMode" data-v="dither">Photo (dots)</button>
          <button type="button" class="${on(this.imageMode === 'threshold').trim()}" data-act="imageMode" data-v="threshold">Logo (solid)</button></div>
          <label class="lt-btn lt-btn-sm ld-upload${this.canWrite ? '' : ' disabled'}">Upload image<input type="file" accept="image/*" data-change="image" hidden${ro}></label>
          <p class="lt-note">The image is turned into black and white printer dots at the box size. Resize the box first, then upload, for the sharpest print.</p>
          ${this.imageError ? `<span class="lt-error">${esc(this.imageError)}</span>` : ''}`));
      }
      if (el.type === 'box') {
        parts.push(sec(`<span class="lt-eyebrow">Box</span><label class="lt-field"><span class="ld-label">Line thickness (${this.unit})</span><input class="lt-input lt-num" type="number" min="0" step="0.01" value="${this.fmt(el.stroke || 0.3)}" data-change="stroke"${rd}></label>`));
      }
      parts.push(sec(`<span class="lt-eyebrow">Position and size (${this.unit})</span><div class="ld-two">
        ${(['x', 'y', 'w', 'h'] as const).map((k) => `<label class="lt-field"><span class="ld-label">${k.toUpperCase()}</span><input class="lt-input" type="number" step="0.01" value="${this.fmt((el as any)[k])}" data-change="pos" data-key="${k}"${rd}></label>`).join('')}</div>`));
      parts.push(sec(`<span class="lt-eyebrow">Show</span><select class="lt-input" data-change="when"${ro}>
        <option value=""${el.when ? '' : ' selected'}>On every label</option>
        ${FIELDS.map((f) => `<option value="${esc(f.key)}"${el.when === f.key ? ' selected' : ''}>Only when ${esc(f.label)} has a value</option>`).join('')}</select>`));
      this.refs.props.innerHTML = parts.join('');
    }

    private renderCheck(): void {
      const d = this.d;
      if (!d || this.mode !== 'check') return;
      const problems = this.problems();
      const count = (kind: string) => problems.filter((r) => r.warnings.some((w) => w.kind === kind)).length;
      const pct = (n: number) => (this.checkResults.length ? (n / this.checkResults.length) * 100 : 0);
      const fits = this.checkResults.length - problems.length;
      const cut = new Set<string>();
      problems.forEach((r) => r.warnings.filter((w) => w.kind === 'cut').forEach((w) => cut.add(w.elementId)));
      const cutEls = d.elements.filter((e) => cut.has(e.id) && e.type === 'text');
      const filters: [CheckKind, string][] = [['all', 'All'], ['cut', 'Cut'], ['wrap', 'Too many lines'], ['shrink', 'Shrunk'], ['missing', 'Missing data'], ['barcode', 'Bad barcode']];
      const shown = this.filteredProblems();
      const scale = d.dpi > 250 ? 0.6 : 0.9;
      this.refs.check.innerHTML = `<div class="ld-check-main">
        <div class="lt-card ld-printer"><div class="ld-card-head"><b>Printer view</b><span class="lt-chip">${this.printerDots()}</span><span class="lt-sp"></span>
          ${this.checkSelected ? `<span class="lt-note">${esc(this.itemTitle(this.checkSelected.item))}</span>` : ''}</div>
          <div class="ld-printer-body"><rpk-label-preview data-ref-check="printer"></rpk-label-preview><p class="lt-note">What the printer puts on the label, dot for dot. A pre-printed color is not printed.</p></div></div>
        <div class="lt-card"><div class="ld-card-head"><b>Items that need a look</b><span class="lt-chip lt-chip-warn">${problems.length}</span><span class="lt-sp"></span>
          <div class="lt-seg lt-seg-sm">${filters.map(([k, l]) => `<button type="button" class="${on(this.checkFilter === k).trim()}" data-act="checkFilter" data-v="${k}">${l}${k === 'all' ? '' : ` <b>${count(k)}</b>`}</button>`).join('')}</div></div>
          ${this.checkRunning ? `<div class="lt-empty">Checking ${this.checkDone} of ${this.checkTotal || '…'} items…</div>` : ''}
          ${!this.checkRunning && this.checkError ? `<div class="lt-empty">${esc(this.checkError)}</div>` : ''}
          ${!this.checkRunning && !this.checkError && !problems.length && this.checkResults.length ? '<div class="lt-empty">Every item fits.</div>' : ''}
          ${this.checkRunning ? '' : `<div class="ld-problems">${shown.map((r, i) => `<button type="button" class="ld-problem${on(r === this.checkSelected)}" data-act="checkPick" data-v="${i}">
            <rpk-label-preview data-problem="${i}"></rpk-label-preview><span class="ld-pmsg">${esc(r.warnings[r.warnings.length - 1].message)}</span><span class="lt-note">${esc(this.itemTitle(r.item))}</span></button>`).join('')}</div>`}
        </div></div>
        <aside class="lt-card ld-summary"><span class="lt-eyebrow">Checked against</span>
          <div class="ld-metric">${this.checkResults.length.toLocaleString()} items</div>
          <div class="lt-note">${esc(this.store || 'This store')}${this.checkTotal > this.checkResults.length && !this.checkRunning ? ` · first ${this.checkResults.length}` : ''}</div>
          <div class="ld-bar"><span class="ok" style="width:${pct(fits)}%"></span><span class="bad" style="width:${pct(problems.length)}%"></span></div>
          <div class="ld-li"><i class="ok"></i>Fits as designed<b>${fits.toLocaleString()}</b></div>
          <div class="ld-li"><i class="bad"></i>Need a look<b>${problems.length.toLocaleString()}</b></div>
          ${cutEls.length && this.canWrite ? `<span class="lt-eyebrow">Quick fixes</span>${cutEls.map((e) => `<div class="ld-fix"><div><b>Let ${esc(this.elementTitle(e))} use 2 lines</b><p class="lt-note">The font size stays the same on every label.</p></div><button type="button" class="lt-btn lt-btn-sm" data-act="letWrap" data-v="${esc(e.id)}">Apply</button></div>`).join('')}` : ''}
          <button type="button" class="lt-btn" data-act="checkRun"${this.checkRunning ? ' disabled' : ''}>Check again</button>
          <p class="lt-note">Fixes change the template, never the items. Save to keep them.</p></aside>`;
      const printer = this.refs.check.querySelector('[data-ref-check="printer"]') as LabelPreviewElement | null;
      if (printer) {
        printer.fontsUrl = this.fonts;
        printer.printerView = true;
        printer.printerScale = scale;
        printer.data = this.checkSelected ? this.checkSelected.data : this.data;
        printer.design = d;
      }
      this.refs.check.querySelectorAll<HTMLElement>('[data-problem]').forEach((node) => {
        const preview = node as LabelPreviewElement;
        const r = shown[Number(node.dataset.problem)];
        preview.fontsUrl = this.fonts;
        preview.maxWidth = 230;
        preview.maxHeight = 90;
        preview.data = r.data;
        preview.design = d;
      });
    }
  }

  customElements.define(tag, LabelDesigner);
}
