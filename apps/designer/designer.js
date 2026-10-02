/* thermal-print designer: builds receipt or label templates and previews them live. */
(function () {
  'use strict';
  const T = window.ThermalPrint;
  const $ = (id) => document.getElementById(id);
  const STORAGE = 'thermal-print-designer';

  const SAMPLE_RECEIPT = {
    id: 'A1042', date: new Date().toISOString(),
    store: { name: 'My Store', address: '1 Main St, Springfield', phone: '(555) 010-2030' },
    items: [{ name: 'Coffee, large', qty: 2, total: 5 }, { name: 'Bagel', qty: 1, total: 7.5 }],
    subtotal: 12.5, tax: 1.03, total: 13.53, tender: 'VISA ****4242', customer: null, notes: ['No refunds on food'],
  };
  const SAMPLE_LABEL = { name: 'Coffee Beans 1lb', unit: '16 oz', price: 12.99, upc: '036000291452', brand: 'Acme', reorderId: 'RE-4411', sale: false };

  const DEFAULT_RECEIPT = {
    name: 'receipt', version: 1, kind: 'receipt', blocks: [
      { type: 'text', value: '{{store.name | upper}}', align: 'center', style: 'b', size: [2, 2] },
      { type: 'text', value: '{{store.address}}', align: 'center' },
      { type: 'text', value: '{{date | date:datetime}}   #{{id}}', align: 'center' },
      { type: 'line' },
      { type: 'table', rows: 'items', columns: [
        { value: '{{name}}', header: 'Item', width: 0.6 }, { value: '{{qty}}', header: 'Qty', width: 0.1, align: 'CENTER' },
        { value: '{{total | money:$}}', header: 'Amount', width: 0.3, align: 'RIGHT' } ] },
      { type: 'line' },
      { type: 'row', cells: [{ value: 'Subtotal', width: 0.7 }, { value: '{{subtotal | money:$}}', width: 0.3, align: 'RIGHT' }] },
      { type: 'row', cells: [{ value: 'Tax', width: 0.7 }, { value: '{{tax | money:$}}', width: 0.3, align: 'RIGHT' }] },
      { type: 'row', cells: [{ value: 'TOTAL', width: 0.7 }, { value: '{{total | money:$}}', width: 0.3, align: 'RIGHT' }] },
      { type: 'text', value: '{{tender}}' },
      { type: 'if', when: 'customer', blocks: [{ type: 'text', value: 'Thank you, {{customer.name}}!' }], else: [{ type: 'text', value: 'Thank you!' }] },
      { type: 'each', items: 'notes', blocks: [{ type: 'text', value: '* {{this}}' }] },
      { type: 'qr', value: 'https://example.com/r/{{id}}', align: 'center', size: 4 },
      { type: 'cut' }, { type: 'drawer' } ] };
  const DEFAULT_LABEL = {
    name: 'shelf-label', version: 1, kind: 'label', widthMm: 50.8, heightMm: 25.4, dpi: 203, elements: [
      { type: 'text', x: 18, y: 14, value: '{{name}}', height: 26 },
      { type: 'text', x: 19, y: 43, value: '{{unit}}', height: 20 },
      { type: 'text', x: 92, y: 65, value: '{{price | money:$}}', height: 85, bold: true },
      { type: 'barcode', x: 35, y: 140, value: '{{upc}}', format: 'UPC_A', height: 35 },
      { type: 'text', x: 260, y: 140, value: '{{brand}}', height: 26 },
      { type: 'text', x: 260, y: 170, value: '{{reorderId}}', height: 26 },
      { type: 'text', x: 18, y: 70, value: 'SALE', height: 24, invert: true, when: 'sale' } ] };

  const ALIGN = ['left', 'center', 'right'];
  const CELL_ALIGN = ['LEFT', 'CENTER', 'RIGHT'];
  const FORMATS = ['CODE128', 'EAN13', 'EAN8', 'UPC_A', 'UPC_E', 'CODE39', 'ITF', 'CODABAR'];
  const ROT = [0, 90, 180, 270];
  const num = (min, max, step) => ({ kind: 'number', min, max, step: step || 1 });
  const F = {
    receipt: {
      text: { value: 'text', align: { kind: 'select', options: ALIGN }, style: { kind: 'select', options: ['normal', 'b', 'u', 'bu', 'u2', 'bu2'] }, size: 'size', font: { kind: 'select', options: ['a', 'b'] } },
      line: { char: 'text' },
      row: { cells: { kind: 'list', fields: ['value', 'width', 'align'] } },
      table: { rows: 'text', header: 'bool', columns: { kind: 'list', fields: ['value', 'width', 'align', 'header'] } },
      feed: { lines: num(0, 50) }, newline: { count: num(1, 50) },
      cut: { partial: 'bool', feed: num(0, 20) }, drawer: { pin: { kind: 'select', options: [2, 5] } },
      qr: { value: 'text', size: num(1, 16), align: { kind: 'select', options: ALIGN } },
      barcode: { value: 'text', format: { kind: 'select', options: FORMATS }, height: num(1, 255), width: num(2, 6), align: { kind: 'select', options: ALIGN }, text: 'bool' },
      each: { items: 'text' }, if: { when: 'text' },
    },
    label: {
      text: { x: num(0, 9999), y: num(0, 9999), value: 'text', height: num(4, 999), width: num(0, 999), rotation: { kind: 'select', options: ROT }, bold: 'bool', invert: 'bool', when: 'text' },
      barcode: { x: num(0, 9999), y: num(0, 9999), value: 'text', format: { kind: 'select', options: FORMATS }, height: num(1, 999), module: num(1, 10), rotation: { kind: 'select', options: ROT }, text: 'bool', when: 'text' },
      qr: { x: num(0, 9999), y: num(0, 9999), value: 'text', module: num(1, 16), correction: { kind: 'select', options: ['L', 'M', 'Q', 'H'] }, rotation: { kind: 'select', options: ROT }, when: 'text' },
      box: { x: num(0, 9999), y: num(0, 9999), width: num(1, 9999), height: num(1, 9999), thickness: num(1, 50) },
      rect: { x: num(0, 9999), y: num(0, 9999), width: num(1, 9999), height: num(1, 9999) },
    },
  };
  const NEW = {
    receipt: { text: { type: 'text', value: 'Text' }, line: { type: 'line' }, row: { type: 'row', cells: [{ value: 'Left', width: 0.5 }, { value: 'Right', width: 0.5, align: 'RIGHT' }] },
      table: { type: 'table', rows: 'items', columns: [{ value: '{{name}}', header: 'Item', width: 0.7 }, { value: '{{total | money:$}}', header: 'Amount', width: 0.3, align: 'RIGHT' }] },
      feed: { type: 'feed', lines: 1 }, newline: { type: 'newline', count: 1 }, cut: { type: 'cut' }, drawer: { type: 'drawer' },
      qr: { type: 'qr', value: 'https://example.com', align: 'center', size: 4 }, barcode: { type: 'barcode', value: '12345678', format: 'CODE128', height: 60, align: 'center' },
      each: { type: 'each', items: 'items', blocks: [{ type: 'text', value: '{{name}}' }] }, if: { type: 'if', when: 'customer', blocks: [{ type: 'text', value: 'yes' }], else: [] } },
    label: { text: { type: 'text', x: 10, y: 10, value: 'Text', height: 24 }, barcode: { type: 'barcode', x: 10, y: 60, value: '{{upc}}', format: 'CODE128', height: 40 },
      qr: { type: 'qr', x: 10, y: 10, value: 'https://example.com', module: 3 }, box: { type: 'box', x: 2, y: 2, width: 100, height: 60, thickness: 2 }, rect: { type: 'rect', x: 10, y: 10, width: 50, height: 4 } },
  };

  let tpl = DEFAULT_RECEIPT;
  let data = SAMPLE_RECEIPT;
  let selected = null;
  let language = 'zpl';

  function kind() { return tpl.kind === 'label' ? 'label' : 'receipt'; }
  function items() { return kind() === 'label' ? tpl.elements : tpl.blocks; }
  function byPath(path) {
    let list = items();
    let node = null;
    for (let i = 0; i < path.length; i++) {
      const p = path[i];
      node = list[p.index];
      if (!node) return null;
      if (p.child) list = node[p.child] = node[p.child] || [];
    }
    return node;
  }
  function listAt(path) {
    if (!path.length) return items();
    const parent = byPath(path.slice(0, -1));
    const last = path[path.length - 1];
    if (!path[path.length - 2] || !path[path.length - 2].child) {
      if (path.length === 1) return items();
    }
    const p = path[path.length - 2];
    return p && p.child ? byPath(path.slice(0, -1))[p.child] : items();
  }

  function save() { try { localStorage.setItem(STORAGE, JSON.stringify({ tpl, data, language })); } catch (e) { /* ignore */ } }
  function load() {
    try {
      const s = JSON.parse(localStorage.getItem(STORAGE));
      if (s && s.tpl) { tpl = s.tpl; data = s.data || data; language = s.language || language; }
    } catch (e) { /* ignore */ }
  }

  function render() {
    $('name').value = tpl.name || '';
    $('kind').value = kind();
    $('receipt-opts').hidden = kind() !== 'receipt';
    $('label-opts').hidden = kind() !== 'label';
    if (kind() === 'label') { $('widthMm').value = tpl.widthMm; $('heightMm').value = tpl.heightMm; $('dpi').value = tpl.dpi || 203; $('language').value = language; }
    renderPalette(); renderTree(); renderProps(); renderPreview(); save();
  }

  function renderPalette() {
    const pal = $('palette');
    pal.innerHTML = '';
    Object.keys(NEW[kind()]).forEach((t) => {
      const b = document.createElement('button');
      b.textContent = t;
      b.onclick = () => { const list = selected ? listAt(selected) : items(); list.push(JSON.parse(JSON.stringify(NEW[kind()][t]))); selected = selected ? selected.slice(0, -1).concat([{ index: list.length - 1 }]) : [{ index: list.length - 1 }]; render(); };
      pal.appendChild(b);
    });
  }

  function summary(b) {
    if (b.value !== undefined) return b.value;
    if (b.cells) return b.cells.map((c) => c.value).join(' | ');
    if (b.columns) return 'rows: ' + b.rows;
    if (b.items) return 'each ' + b.items;
    if (b.when) return 'if ' + b.when;
    if (b.char) return b.char;
    return Object.keys(b).filter((k) => k !== 'type').map((k) => k + '=' + b[k]).join(' ');
  }

  function renderTree() {
    const tree = $('tree');
    tree.innerHTML = '';
    const walk = (list, path, depth) => {
      list.forEach((b, i) => {
        const p = path.concat([{ index: i }]);
        const row = document.createElement('div');
        row.className = 'node' + (selected && samePath(selected, p) ? ' selected' : '');
        row.style.paddingLeft = 6 + depth * 14 + 'px';
        row.innerHTML = '<span class="type">' + b.type + '</span><span class="label"></span><span class="tools"></span>';
        row.querySelector('.label').textContent = summary(b);
        const tools = row.querySelector('.tools');
        [['▲', () => move(list, i, -1)], ['▼', () => move(list, i, 1)], ['⧉', () => { list.splice(i + 1, 0, JSON.parse(JSON.stringify(b))); }], ['✕', () => { list.splice(i, 1); selected = null; }]].forEach(([t, fn]) => {
          const bt = document.createElement('button'); bt.className = 'small'; bt.textContent = t;
          bt.onclick = (e) => { e.stopPropagation(); fn(); render(); };
          tools.appendChild(bt);
        });
        row.onclick = () => { selected = p; render(); };
        tree.appendChild(row);
        if (kind() === 'receipt') {
          if (b.blocks) { walk(b.blocks, path.concat([{ index: i, child: 'blocks' }]), depth + 1); }
          if (b.else) { const h = document.createElement('div'); h.className = 'muted'; h.style.paddingLeft = 6 + (depth + 1) * 14 + 'px'; h.textContent = 'else'; tree.appendChild(h); walk(b.else, path.concat([{ index: i, child: 'else' }]), depth + 1); }
        }
      });
    };
    walk(items(), [], 0);
  }
  function samePath(a, b) { return a.length === b.length && a.every((x, i) => x.index === b[i].index && x.child === b[i].child); }
  function move(list, i, d) { const j = i + d; if (j < 0 || j >= list.length) return; const t = list[i]; list[i] = list[j]; list[j] = t; if (selected) selected[selected.length - 1].index = j; }

  function renderProps() {
    const box = $('props');
    box.innerHTML = '';
    const b = selected && byPath(selected);
    if (!b) { box.innerHTML = '<p class="muted">Select a block, or add one.</p>'; return; }
    const schema = F[kind()][b.type] || {};
    const title = document.createElement('div'); title.innerHTML = '<strong>' + b.type + '</strong>'; box.appendChild(title);
    Object.keys(schema).forEach((key) => {
      const def = schema[key];
      const row = document.createElement('div'); row.className = 'field';
      const lab = document.createElement('label'); lab.textContent = key; row.appendChild(lab);
      let input;
      if (def === 'text') { input = document.createElement('input'); input.value = b[key] == null ? '' : b[key]; input.oninput = () => { b[key] = input.value; renderPreview(); renderTreeSoft(); }; }
      else if (def === 'bool') { input = document.createElement('input'); input.type = 'checkbox'; input.checked = b[key] !== false && b[key] !== undefined ? !!b[key] : false; input.onchange = () => { b[key] = input.checked; renderPreview(); }; }
      else if (def === 'size') { input = document.createElement('div'); input.innerHTML = 'w <input type="number" min="1" max="8" style="width:50px"> h <input type="number" min="1" max="8" style="width:50px">'; const [w, h] = input.querySelectorAll('input'); w.value = (b.size || [1, 1])[0]; h.value = (b.size || [1, 1])[1]; w.oninput = h.oninput = () => { b.size = [Number(w.value) || 1, Number(h.value) || 1]; renderPreview(); }; }
      else if (def.kind === 'number') { input = document.createElement('input'); input.type = 'number'; input.min = def.min; input.max = def.max; input.step = def.step; input.value = b[key] == null ? '' : b[key]; input.oninput = () => { b[key] = input.value === '' ? undefined : Number(input.value); renderPreview(); }; }
      else if (def.kind === 'select') { input = document.createElement('select'); def.options.forEach((o) => { const op = document.createElement('option'); op.value = o; op.textContent = o; input.appendChild(op); }); input.value = b[key] == null ? def.options[0] : b[key]; input.onchange = () => { const v = input.value; b[key] = typeof def.options[0] === 'number' ? Number(v) : v; renderPreview(); }; }
      else if (def.kind === 'list') { input = document.createElement('div'); input.className = 'list'; const list = b[key] = b[key] || []; const draw = () => { input.innerHTML = ''; list.forEach((it, i) => { const r = document.createElement('div'); r.className = 'item'; r.innerHTML = '<input placeholder="value"><input type="number" step="0.05" placeholder="width"><select>' + CELL_ALIGN.map((a) => '<option>' + a + '</option>').join('') + '</select><button class="small">✕</button>'; const [v, w] = r.querySelectorAll('input'); const sel = r.querySelector('select'); v.value = it.value || ''; w.value = it.width == null ? '' : it.width; sel.value = it.align || 'LEFT'; v.oninput = () => { it.value = v.value; renderPreview(); }; w.oninput = () => { it.width = w.value === '' ? undefined : Number(w.value); renderPreview(); }; sel.onchange = () => { it.align = sel.value; renderPreview(); }; if (def.fields.includes('header')) { const hd = document.createElement('input'); hd.placeholder = 'header'; hd.value = it.header || ''; hd.oninput = () => { it.header = hd.value; renderPreview(); }; r.insertBefore(hd, w); r.style.gridTemplateColumns = '1fr 80px 60px 80px auto'; } r.querySelector('button').onclick = () => { list.splice(i, 1); draw(); renderPreview(); }; input.appendChild(r); }); const add = document.createElement('button'); add.className = 'small'; add.textContent = '+ cell'; add.onclick = () => { list.push({ value: '', width: 0.3 }); draw(); renderPreview(); }; input.appendChild(add); }; draw(); }
      row.appendChild(input);
      box.appendChild(row);
    });
  }
  function renderTreeSoft() { const sel = $('tree').querySelector('.node.selected .label'); const b = selected && byPath(selected); if (sel && b) sel.textContent = summary(b); }

  function profile() { return T.profiles[$('profile').value] || T.epsonTmT88; }

  function renderPreview() {
    const pv = $('preview');
    const err = $('error');
    try {
      data = JSON.parse($('data').value || '{}');
      err.hidden = true;
      if (kind() === 'receipt') {
        const ops = T.render(tpl, data, profile());
        let iframe = pv.querySelector('iframe');
        if (!iframe) { pv.innerHTML = ''; iframe = document.createElement('iframe'); pv.appendChild(iframe); }
        iframe.srcdoc = T.opsToHtml(ops, profile());
        if (!$('bytes').hidden) $('bytes').textContent = JSON.stringify(ops, null, 1);
      } else {
        const label = T.renderLabel(tpl, data);
        pv.innerHTML = T.labelToSvg(label);
        const svg = pv.querySelector('svg');
        const scale = Math.min(1, (pv.clientWidth - 32) / label.width);
        svg.setAttribute('width', label.width * 3 * scale);
        svg.setAttribute('height', label.height * 3 * scale);
        wireDrag(svg, label);
        if (!$('bytes').hidden) $('bytes').textContent = bytesText(label);
      }
      save();
    } catch (e) {
      err.hidden = false;
      err.textContent = e.message;
    }
  }
  function bytesText(label) {
    if (language === 'tspl') return new TextDecoder('latin1').decode(T.encodeTspl(label));
    return language === 'ezpl' ? T.encodeEzpl(label) : T.encodeZpl(label);
  }

  /* Label elements can be dragged on the preview; the visible element index maps back to the template. */
  function wireDrag(svg, label) {
    const scope = { root: data, current: data };
    const visible = tpl.elements.map((e, i) => ({ e, i })).filter(({ e }) => !e.when || T.truthy(e.when, scope));
    const nodes = Array.from(svg.querySelectorAll('text, image, rect')).slice(1);
    let k = 0;
    label.ops.forEach((op, idx) => {
      const el = visible[idx];
      if (!el) return;
      const count = op.kind === 'text' && op.invert ? 2 : op.kind === 'barcode' && op.text !== false ? 2 : 1;
      for (let c = 0; c < count; c++) {
        const n = nodes[k++];
        if (!n) return;
        n.setAttribute('data-i', el.i);
        if (selected && selected[0].index === el.i) n.classList.add('selected-el');
      }
    });
    let drag = null;
    const pt = (ev) => { const r = svg.getBoundingClientRect(); return { x: (ev.clientX - r.left) * label.width / r.width, y: (ev.clientY - r.top) * label.height / r.height }; };
    svg.onpointerdown = (ev) => {
      const n = ev.target.closest('[data-i]');
      if (!n) return;
      const i = Number(n.getAttribute('data-i'));
      const e = tpl.elements[i];
      selected = [{ index: i }];
      drag = { e, start: pt(ev), x: e.x, y: e.y };
      svg.setPointerCapture(ev.pointerId);
      renderTree(); renderProps();
    };
    svg.onpointermove = (ev) => { if (!drag) return; const p = pt(ev); drag.e.x = Math.max(0, Math.round(drag.x + p.x - drag.start.x)); drag.e.y = Math.max(0, Math.round(drag.y + p.y - drag.start.y)); renderPreview(); renderProps(); };
    svg.onpointerup = () => { drag = null; save(); };
  }

  /* header wiring */
  $('name').oninput = () => { tpl.name = $('name').value; save(); };
  $('kind').onchange = () => { if (!confirm('Switch kind? The current layout is replaced by the default ' + $('kind').value + '.')) { $('kind').value = kind(); return; } tpl = JSON.parse(JSON.stringify($('kind').value === 'label' ? DEFAULT_LABEL : DEFAULT_RECEIPT)); data = $('kind').value === 'label' ? SAMPLE_LABEL : SAMPLE_RECEIPT; $('data').value = JSON.stringify(data, null, 2); selected = null; render(); };
  ['widthMm', 'heightMm', 'dpi'].forEach((id) => { $(id).onchange = () => { tpl[id] = Number($(id).value); renderPreview(); }; });
  $('language').onchange = () => { language = $('language').value; renderPreview(); };
  $('profile').onchange = () => renderPreview();
  $('data').oninput = () => renderPreview();
  $('new').onclick = () => { if (!confirm('Start a new ' + kind() + ' template?')) return; tpl = JSON.parse(JSON.stringify(kind() === 'label' ? DEFAULT_LABEL : DEFAULT_RECEIPT)); tpl.blocks && (tpl.blocks = []); tpl.elements && (tpl.elements = []); selected = null; render(); };
  $('export').onclick = () => { const blob = new Blob([JSON.stringify(tpl, null, 2)], { type: 'application/json' }); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = (tpl.name || kind()) + '.json'; a.click(); };
  $('copy').onclick = () => { navigator.clipboard.writeText(JSON.stringify(tpl, null, 2)); };
  $('import').onclick = () => $('file').click();
  $('file').onchange = () => { const f = $('file').files[0]; if (!f) return; f.text().then((t) => { const j = JSON.parse(t); if (!j.version) throw new Error('not a template'); tpl = j; data = j.kind === 'label' ? SAMPLE_LABEL : SAMPLE_RECEIPT; $('data').value = JSON.stringify(data, null, 2); selected = null; render(); }).catch((e) => { $('error').hidden = false; $('error').textContent = e.message; }); };
  $('code').onclick = () => { $('bytes').hidden = !$('bytes').hidden; renderPreview(); };
  window.addEventListener('keydown', (ev) => { if (ev.key === 'Delete' && selected && document.activeElement.tagName !== 'INPUT' && document.activeElement.tagName !== 'TEXTAREA') { listAt(selected).splice(selected[selected.length - 1].index, 1); selected = null; render(); } });

  Object.values(T.profiles).forEach((p) => { const o = document.createElement('option'); o.value = p.id; o.textContent = p.id + ' (' + p.columns.a + ' cols)'; $('profile').appendChild(o); });
  load();
  const want = new URLSearchParams(location.search).get('kind');
  if (want && want !== kind()) { tpl = JSON.parse(JSON.stringify(want === 'label' ? DEFAULT_LABEL : DEFAULT_RECEIPT)); data = want === 'label' ? SAMPLE_LABEL : SAMPLE_RECEIPT; selected = null; }
  $('data').value = JSON.stringify(data, null, 2);
  render();

  if (new URLSearchParams(location.search).has('selftest')) {
    const out = document.createElement('div'); out.id = 'selftest'; document.body.appendChild(out);
    const step = (name, fn) => { try { fn(); } catch (e) { throw new Error(name + ': ' + e.message); } };
    setTimeout(() => {
      try {
        if (kind() === 'receipt') {
          step('select first block', () => { $('tree').querySelector('.node').click(); if (!byPath(selected)) throw new Error('nothing selected'); });
          step('edit value', () => { const inp = $('props').querySelector('input'); inp.value = '{{store.name}} SELFTEST'; inp.dispatchEvent(new Event('input')); });
          step('preview updated', () => { if (!$('preview').querySelector('iframe').srcdoc.includes('My Store SELFTEST')) throw new Error('srcdoc lacks the edit'); });
          step('add qr', () => { selected = null; Array.from($('palette').children).find((b) => b.textContent === 'qr').click(); if (items()[items().length - 1].type !== 'qr') throw new Error('qr not appended'); });
          step('delete it', () => { $('tree').querySelector('.node:last-child .tools button:last-child').click(); if (items()[items().length - 1].type === 'qr') throw new Error('qr still there'); });
        } else {
          step('select price', () => { $('tree').querySelectorAll('.node')[2].click(); if (byPath(selected).value !== '{{price | money:$}}') throw new Error('wrong block'); });
          step('move x', () => { const x = $('props').querySelector('input[type=number]'); x.value = '120'; x.dispatchEvent(new Event('input')); if (tpl.elements[2].x !== 120) throw new Error('x not applied'); });
          step('svg has the price', () => { if (!$('preview').querySelector('svg').innerHTML.includes('$12.99')) throw new Error('no price in svg'); });
          step('drag maps to element', () => { const n = $('preview').querySelector('svg [data-i="2"]'); if (!n) throw new Error('price has no data-i'); });
          step('bytes', () => { $('code').click(); if (!$('bytes').textContent.startsWith('^XA')) throw new Error('no ZPL'); language = 'ezpl'; renderPreview(); if (!$('bytes').textContent.startsWith('^Q')) throw new Error('no EZPL'); });
        }
        out.textContent = 'selftest ok';
      } catch (e) { out.textContent = 'selftest fail: ' + e.message; }
    }, 50);
  }
})();
