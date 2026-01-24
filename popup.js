const SYNC_KEY = 'yo_template_sync_v1';

function $(s){return document.querySelector(s);}
function el(t,c){const e=document.createElement(t); if(c) e.className=c; return e;}

function defaultState(){
  return {
    wish: [],
    sell: [],
    sellSets: [],
    buy: [],
    settings: {
      theme: 'classic'
    }
  };
}

let state = defaultState();

const ACTIVE_TAB_KEY = 'yo_template_active_tab_v1';
const TAB_DRAFTS_KEY = 'yo_template_tab_drafts_v1';

function safeJsonParse(s){
  try{ return JSON.parse(s); }catch{ return null; }
}

function loadTabDrafts(){
  const raw = (()=>{ try{ return localStorage.getItem(TAB_DRAFTS_KEY) || ''; }catch{ return ''; } })();
  const obj = safeJsonParse(raw);
  return (obj && typeof obj === 'object') ? obj : {};
}

function saveTabDrafts(drafts){
  try{ localStorage.setItem(TAB_DRAFTS_KEY, JSON.stringify(drafts || {})); }catch{}
}

function isListTab(tabName){
  return tabName === 'wish' || tabName === 'sell' || tabName === 'sellSets' || tabName === 'buy';
}

function persistDraftForTab(tabName){
  if(!isListTab(tabName)) return;
  const drafts = loadTabDrafts();
  drafts[tabName] = {
    query: ($('#in-query')?.value || ''),
    note: ($('#in-note')?.value || '')
  };
  saveTabDrafts(drafts);
}

function applyDraftForTab(tabName){
  if(!isListTab(tabName)) return;
  const drafts = loadTabDrafts();
  const d = drafts[tabName] || {};
  const q = $('#in-query');
  const n = $('#in-note');
  if(q) q.value = typeof d.query === 'string' ? d.query : '';
  if(n) n.value = typeof d.note === 'string' ? d.note : '';
}

let currentTab = 'wish';

function setActiveTab(tabName){
  // Save whatever was being typed for the previous tab.
  persistDraftForTab(currentTab);

  const tabs = Array.from(document.querySelectorAll('.tab[data-tab]'));
  const panels = Array.from(document.querySelectorAll('[data-panel]'));
  tabs.forEach(t => t.classList.toggle('is-active', t.dataset.tab === tabName));
  panels.forEach(p => { p.hidden = p.dataset.panel !== tabName; });
  try{ localStorage.setItem(ACTIVE_TAB_KEY, tabName); }catch{}

  currentTab = tabName;

  // Make Add Item default to the active list tab.
  if(isListTab(tabName)){
    const sel = $('#in-section');
    if(sel) sel.value = tabName;
    applyDraftForTab(tabName);
  }
}

function getActiveTab(){
  const active = document.querySelector('.tab.is-active[data-tab]');
  if(active?.dataset?.tab) return active.dataset.tab;
  try{ return localStorage.getItem(ACTIVE_TAB_KEY) || 'wish'; }catch{}
  return 'wish';
}

async function openSidePanel(){
  // Side panel API requires a windowId. Works in modern Chrome; degrade gracefully.
  try{
    if(!chrome?.windows?.getCurrent || !chrome?.sidePanel?.open){
      alert('Side panel is not available in this Chrome version.');
      return;
    }

    const win = await new Promise((resolve)=>{
      chrome.windows.getCurrent((w)=>resolve(w));
    });
    const windowId = win?.id;
    if(typeof windowId !== 'number'){
      alert('Could not determine current window.');
      return;
    }

    await new Promise((resolve, reject)=>{
      try{
        chrome.sidePanel.open({ windowId }, ()=>{
          const err = chrome.runtime?.lastError;
          if(err) reject(err);
          else resolve();
        });
      }catch(e){
        reject(e);
      }
    });
  }catch(e){
    console.error(e);
    alert('Failed to open side panel.');
  }
}

function wireTabs(){
  const tabs = Array.from(document.querySelectorAll('.tab[data-tab]'));
  tabs.forEach(t => t.addEventListener('click', ()=>setActiveTab(t.dataset.tab)));
  let initial = 'wish';
  try{ initial = localStorage.getItem(ACTIVE_TAB_KEY) || 'wish'; }catch{}
  if(!['wish','sell','sellSets','buy','settings'].includes(initial)) initial = 'wish';
  currentTab = initial;
  setActiveTab(initial);
}

function themeFromState(){
  const t = state?.settings?.theme;
  return (t === 'classic' || t === 'dark' || t === 'valentine') ? t : 'classic';
}

function applyTheme(theme){
  if(!document?.body) return;
  if(theme === 'classic'){
    document.body.removeAttribute('data-theme');
  }else{
    document.body.setAttribute('data-theme', theme);
  }
}

function exportPalette(theme){
  if(theme === 'dark'){
    return {
      bg: '#0b1220',
      tileBg: '#0f172a',
      tileBorder: '#22304a',
      text: '#e5e7eb',
      muted: '#9ca3af',
      imgFallback: '#111c33',
      badgeBg: '#1f2a44',
      badgeBorder: '#14b8a6',
      badgeBorderAlt: '#ef4444',
      badgeText: '#e5e7eb',
      priceBg: '#1f2a44',
      priceBorder: '#14b8a6',
      priceText: '#e5e7eb'
    };
  }

  if(theme === 'valentine'){
    return {
      bg: '#fff1f2',
      tileBg: '#ffffff',
      tileBorder: '#fecdd3',
      text: '#1f2937',
      muted: '#6b7280',
      imgFallback: '#ffe4e6',
      badgeBg: '#ffe4e6',
      badgeBorder: '#e11d48',
      badgeBorderAlt: '#e11d48',
      badgeText: '#1f2937',
      priceBg: '#ffe4e6',
      priceBorder: '#e11d48',
      priceText: '#1f2937'
    };
  }

  // classic
  return {
    bg: '#ffffff',
    tileBg: '#ffffff',
    tileBorder: '#d1d5db',
    text: '#111827',
    muted: '#6b7280',
    imgFallback: '#f3f4f6',
    badgeBg: '#f3f4f6',
    badgeBorder: '#111827',
    badgeBorderAlt: '#111827',
    badgeText: '#111827',
    priceBg: '#f3f4f6',
    priceBorder: '#111827',
    priceText: '#111827'
  };
}

async function loadState(){
  return new Promise((resolve)=>{
    chrome.storage.sync.get([SYNC_KEY], (res)=>{
      const s = res[SYNC_KEY] || {};
      state = {
        wish: Array.isArray(s.wish) ? s.wish : [],
        sell: Array.isArray(s.sell) ? s.sell : [],
        sellSets: Array.isArray(s.sellSets) ? s.sellSets : [],
        buy: Array.isArray(s.buy) ? s.buy : [],
        settings: {
          theme: (s?.settings?.theme === 'classic' || s?.settings?.theme === 'dark' || s?.settings?.theme === 'valentine')
            ? s.settings.theme
            : 'classic'
        }
      };
      resolve();
    });
  });
}

async function saveState(){
  return new Promise((resolve)=>{
    chrome.storage.sync.set({[SYNC_KEY]: state}, ()=>resolve());
  });
}

function buildYwCdnImageUrlFromId(itemId){
  const id = Number(itemId);
  if(!Number.isFinite(id) || id <= 0) return '';
  const g1 = String(Math.floor(id / 10000)).padStart(2,'0');
  const g2 = String(Math.floor((id % 10000) / 100)).padStart(2,'0');
  return `https://yw-web.yoworld.com/cdn/items/${g1}/${g2}/${id}/${id}.png`;
}

async function apiSearch(query){
  const url = `https://api.yoworld.info/api/items/search?query=${encodeURIComponent(query)}&page=1&itemsPerPage=12&itemCategoryId=-1`;
  const res = await fetch(url, { credentials: 'omit' });
  if(!res.ok) throw new Error('Search failed');
  const json = await res.json();
  return json?.data?.pagination?.data || [];
}

async function apiItemDetail(id){
  const url = `https://api.yoworld.info/api/items/${encodeURIComponent(String(id))}`;
  const res = await fetch(url, { credentials: 'omit' });
  if(!res.ok) throw new Error('Item detail failed');
  const json = await res.json();
  return json?.data?.item || null;
}

function storeBadge(active){
  const span = el('span', 'badge ' + (active ? 'instore' : 'notstore'));
  span.textContent = active ? 'IN STORE' : 'NOT IN STORE';
  return span;
}

function render(){
  renderGrid('wish', $('#grid-wish'));
  renderGrid('sell', $('#grid-sell'));
  renderGrid('sellSets', $('#grid-sellSets'));
  renderGrid('buy', $('#grid-buy'));
}

function renderGrid(section, root){
  if(!root) return;
  root.innerHTML = '';
  const items = state[section] || [];
  for(const item of items){
    const tile = el('div','tile');
    const img = el('img');
    img.src = item.imageUrl || '';
    img.alt = item.name || 'Item';
    img.loading = 'lazy';
    img.referrerPolicy = 'no-referrer';
    tile.appendChild(img);

    const pad = el('div','tpad');
    const name = el('div','tname');
    name.textContent = item.name || '(Unnamed)';
    name.title = item.name || '';
    pad.appendChild(name);

    const note = el('div','tnote');
    note.textContent = item.note || '';
    pad.appendChild(note);

    const row = el('div','trow');
    row.appendChild(storeBadge(!!item.activeInStore));

    const x = el('button','x');
    x.type = 'button';
    x.textContent = '×';
    x.title = 'Remove';
    x.addEventListener('click', async()=>{
      state[section] = (state[section]||[]).filter(it=>it.key !== item.key);
      await saveState();
      render();
    });
    row.appendChild(x);

    pad.appendChild(row);
    tile.appendChild(pad);
    root.appendChild(tile);
  }
}

function keyFor(section, id){
  return `${section}:${id}:${Date.now().toString(36)}:${Math.random().toString(36).slice(2,7)}`;
}

async function doSearch(){
  const q = ($('#in-query')?.value || '').trim();
  const resultsRoot = $('#results');
  if(!resultsRoot) return;
  resultsRoot.innerHTML = '';
  if(!q){
    const d = el('div');
    d.className = 'hint';
    d.textContent = 'Type a search term.';
    resultsRoot.appendChild(d);
    return;
  }

  try{
    const items = await apiSearch(q);
    if(!items.length){
      const d = el('div');
      d.className = 'hint';
      d.textContent = 'No results.';
      resultsRoot.appendChild(d);
      return;
    }

    for(const it of items){
      const row = el('div','result');
      const thumb = el('img','thumb');
      thumb.src = buildYwCdnImageUrlFromId(it.id);
      thumb.alt = it.name || 'Item';
      thumb.loading = 'lazy';
      thumb.referrerPolicy = 'no-referrer';
      row.appendChild(thumb);

      const meta = el('div','meta');
      const name = el('div','name');
      name.textContent = it.name || '(Unnamed)';
      meta.appendChild(name);

      const small = el('div','small');
      small.textContent = `ID: ${it.id}`;
      meta.appendChild(small);
      row.appendChild(meta);

      const add = el('button');
      add.type = 'button';
      add.textContent = 'Add';
      add.addEventListener('click', async()=>{
        const section = $('#in-section')?.value || 'wish';
        const note = ($('#in-note')?.value || '').trim();

        // Fetch detail to get active_in_store + the full item name reliably.
        let activeInStore = false;
        let fullName = it.name || '';
        try{
          const detail = await apiItemDetail(it.id);
          activeInStore = !!detail?.active_in_store;
          if(detail?.name) fullName = detail.name;
        }catch{
          activeInStore = false;
        }

        const entry = {
          key: keyFor(section, it.id),
          id: it.id,
          name: fullName,
          note,
          imageUrl: buildYwCdnImageUrlFromId(it.id),
          activeInStore,
          addedAt: Date.now()
        };

        state[section] = state[section] || [];
        state[section].push(entry);
        await saveState();
        render();
      });
      row.appendChild(add);

      resultsRoot.appendChild(row);
    }
  }catch(e){
    console.error(e);
    const d = el('div');
    d.className = 'hint';
    d.textContent = 'Search failed.';
    resultsRoot.appendChild(d);
  }
}

function wrapText(ctx, text, x, y, maxWidth, lineHeight, maxLines){
  const words = String(text||'').split(/\s+/).filter(Boolean);
  let line = '';
  let lines = 0;

  for(const w of words){
    const test = line ? (line + ' ' + w) : w;
    if(ctx.measureText(test).width <= maxWidth){
      line = test;
      continue;
    }
    ctx.fillText(line, x, y);
    y += lineHeight;
    lines += 1;
    line = w;
    if(lines >= maxLines - 1) break;
  }
  if(lines < maxLines){
    ctx.fillText(line, x, y);
  }
}

function wrapLines(ctx, text, maxWidth, maxLines){
  const words = String(text||'').split(/\s+/).filter(Boolean);
  const lines = [];
  let line = '';
  let truncated = false;

  for(const w of words){
    const test = line ? (line + ' ' + w) : w;
    if(ctx.measureText(test).width <= maxWidth){
      line = test;
      continue;
    }

    if(line) lines.push(line);
    line = w;

    if(lines.length >= maxLines - 1){
      // Last line: fit remaining with ellipsis.
      const rest = [line, ...words.slice(words.indexOf(w)+1)].join(' ');
      const fitted = fitTextToWidth(ctx, rest, maxWidth);
      lines.push(fitted);
      truncated = fitted.endsWith('…');
      return { lines, truncated };
    }
  }

  if(line) lines.push(line);
  // If we used up maxLines but still had words, we'd have returned above.
  return { lines: lines.slice(0, maxLines), truncated };
}

function fitTextToWidth(ctx, text, maxWidth){
  const t = String(text || '');
  if(ctx.measureText(t).width <= maxWidth) return t;
  const ell = '…';
  let lo = 0;
  let hi = t.length;
  while(lo < hi){
    const mid = Math.floor((lo + hi) / 2);
    const cand = t.slice(0, mid) + ell;
    if(ctx.measureText(cand).width <= maxWidth) lo = mid + 1;
    else hi = mid;
  }
  const n = Math.max(0, lo - 1);
  return (n <= 0) ? ell : (t.slice(0, n) + ell);
}

function drawCenteredPillText(ctx, text, x, y, w, h, bg, border, color){
  ctx.save();
  const padX = 10;
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'center';

  const maxTextW = Math.max(0, w - padX * 2);
  const fitted = fitTextToWidth(ctx, text, maxTextW);
  const textW = ctx.measureText(fitted).width;
  const pillW = Math.min(w, Math.max(44, textW + padX * 2));
  const px = x + (w - pillW) / 2;

  ctx.fillStyle = bg;
  roundRect(ctx, px, y, pillW, h, Math.floor(h / 2));
  ctx.fill();
  ctx.strokeStyle = border;
  ctx.lineWidth = 2;
  roundRect(ctx, px, y, pillW, h, Math.floor(h / 2));
  ctx.stroke();

  ctx.fillStyle = color;
  ctx.fillText(fitted, x + w / 2, y + h / 2);
  ctx.restore();
}

async function loadImage(url){
  return new Promise((resolve, reject)=>{
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = ()=>resolve(img);
    img.onerror = ()=>reject(new Error('img load fail'));
    img.src = url;
  });
}

function exportSectionsForScope(scope){
  const all = [
    { key: 'wish', title: 'Wish List' },
    { key: 'sell', title: 'Sell' },
    { key: 'sellSets', title: 'Sell Sets' },
    { key: 'buy', title: 'Buy' }
  ];

  let s = scope;
  if(s === 'active') s = getActiveTab();
  if(s === 'all' || !s) return all;

  const one = all.find(x=>x.key === s);
  return one ? [one] : all;
}

async function exportPng(scope){
  const canvas = $('#export-canvas');
  if(!canvas) return;
  const ctx = canvas.getContext('2d');

  const theme = themeFromState();
  const pal = exportPalette(theme);

  const COLS = 5;
  const TILE_W = 160;
  const TILE_H = 238;
  const PAD = 20;
  const GAP = 12;
  const HEADER_H = 44;

  const sections = exportSectionsForScope(scope);

  const sectionHeights = sections.map(s=>{
    const n = (state[s.key]||[]).length;
    const rows = Math.max(1, Math.ceil(n / COLS));
    return HEADER_H + rows * TILE_H + (rows-1)*GAP + PAD;
  });

  const width = PAD*2 + COLS*TILE_W + (COLS-1)*GAP;
  const height = PAD + sectionHeights.reduce((a,b)=>a+b,0);

  canvas.width = width;
  canvas.height = height;

  // Background
  ctx.fillStyle = pal.bg;
  ctx.fillRect(0,0,width,height);

  ctx.textBaseline = 'top';

  let y = PAD;

  for(const s of sections){
    // Header
    ctx.fillStyle = pal.text;
    ctx.font = 'bold 20px system-ui, -apple-system, Segoe UI, sans-serif';
    ctx.fillText(s.title, PAD, y);
    y += HEADER_H;

    const items = state[s.key] || [];
    const rows = Math.max(1, Math.ceil(items.length / COLS));

    for(let r=0; r<rows; r++){
      for(let c=0; c<COLS; c++){
        const idx = r*COLS + c;
        const x = PAD + c*(TILE_W+GAP);
        const ty = y + r*(TILE_H+GAP);

        // Tile background
        ctx.fillStyle = pal.tileBg;
        roundRect(ctx, x, ty, TILE_W, TILE_H, 14);
        ctx.fill();

        ctx.strokeStyle = pal.tileBorder;
        ctx.lineWidth = 2;
        roundRect(ctx, x, ty, TILE_W, TILE_H, 14);
        ctx.stroke();

        const item = items[idx];
        if(!item) continue;

        // Store badge (draw first so layout stays consistent)
        const badgeText = item.activeInStore ? 'IN STORE' : 'NOT IN STORE';
        ctx.font = 'bold 15px system-ui, -apple-system, Segoe UI, sans-serif';
        const bw = ctx.measureText(badgeText).width + 16;
        const bx = x + (TILE_W - bw) / 2;
        const by = ty + 10;
        ctx.fillStyle = pal.badgeBg;
        roundRect(ctx, bx, by, bw, 18, 9);
        ctx.fill();
        ctx.strokeStyle = item.activeInStore ? pal.badgeBorder : pal.badgeBorderAlt;
        ctx.lineWidth = 2;
        roundRect(ctx, bx, by, bw, 18, 9);
        ctx.stroke();
        ctx.fillStyle = pal.badgeText;
        ctx.fillText(badgeText, bx+8, by+3);

        // Image area (contain: do not crop)
        const imgX = x + 10;
        const imgY = ty + 34;
        const imgW = TILE_W - 20;
        const imgH = 88;

        try{
          const img = await loadImage(item.imageUrl);
          drawContain(ctx, img, imgX, imgY, imgW, imgH);
          ctx.strokeStyle = pal.tileBorder;
          ctx.lineWidth = 2;
          roundRect(ctx, imgX, imgY, imgW, imgH, 12);
          ctx.stroke();
        }catch{
          ctx.fillStyle = pal.imgFallback;
          roundRect(ctx, imgX, imgY, imgW, imgH, 12);
          ctx.fill();
        }

        // Price / note (centered, prominent) — fixed position
        const price = String(item.note || '').trim();
        const priceX = x + 10;
        const priceW = TILE_W - 20;
        const priceH = 22;
        const priceY = ty + TILE_H - 10 - priceH;
        if(price){
          ctx.font = '800 17px "Segoe UI", system-ui, -apple-system, sans-serif';
          drawCenteredPillText(ctx, price, priceX, priceY, priceW, priceH, pal.priceBg, pal.priceBorder, pal.priceText);
        }

        // Name — fit into the fixed space above the price pill
        ctx.fillStyle = pal.text;
        const nameX = x + 10;
        const nameY = ty + 126;
        const nameW = TILE_W - 20;
        const nameBottom = (price ? (priceY - 8) : (ty + TILE_H - 10));
        const availableH = Math.max(18, nameBottom - nameY);

        let nameFontSize = 17;
        let nameLineH = 22;
        let nameLines = [];

        for(let fs = 17; fs >= 12; fs--){
          nameLineH = Math.max(18, fs + 5);
          const maxLines = Math.max(1, Math.min(3, Math.floor(availableH / nameLineH)));
          ctx.font = `600 ${fs}px "Segoe UI", system-ui, -apple-system, sans-serif`;
          const wrapped = wrapLines(ctx, item.name || '', nameW, maxLines);
          nameLines = wrapped.lines;
          nameFontSize = fs;
          if(!wrapped.truncated) break;
        }

        ctx.font = `600 ${nameFontSize}px "Segoe UI", system-ui, -apple-system, sans-serif`;
        for(let i=0; i<nameLines.length; i++){
          const yy = nameY + i * nameLineH;
          if(yy + nameLineH > nameBottom + 2) break;
          ctx.fillText(nameLines[i], nameX, yy);
        }
      }
    }

    y += rows*TILE_H + (rows-1)*GAP + PAD;
  }

  const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  if(sections.length === 1){
    a.download = `yo-template-${sections[0].key}.png`;
  }else{
    a.download = 'yo-template.png';
  }
  a.click();
  setTimeout(()=>URL.revokeObjectURL(url), 2000);
}

function roundRect(ctx, x, y, w, h, r){
  const rr = Math.min(r, w/2, h/2);
  ctx.beginPath();
  ctx.moveTo(x+rr, y);
  ctx.arcTo(x+w, y, x+w, y+h, rr);
  ctx.arcTo(x+w, y+h, x, y+h, rr);
  ctx.arcTo(x, y+h, x, y, rr);
  ctx.arcTo(x, y, x+w, y, rr);
  ctx.closePath();
}

function drawCover(ctx, img, x, y, w, h){
  const ir = img.width / img.height;
  const tr = w / h;
  let sw, sh, sx, sy;
  if(ir > tr){
    sh = img.height;
    sw = sh * tr;
    sx = (img.width - sw) / 2;
    sy = 0;
  }else{
    sw = img.width;
    sh = sw / tr;
    sx = 0;
    sy = (img.height - sh) / 2;
  }
  ctx.save();
  roundRect(ctx, x, y, w, h, 12);
  ctx.clip();
  ctx.drawImage(img, sx, sy, sw, sh, x, y, w, h);
  ctx.restore();
}

function drawContain(ctx, img, x, y, w, h){
  const ir = img.width / img.height;
  const tr = w / h;
  let dw, dh;
  if(ir > tr){
    dw = w;
    dh = w / ir;
  }else{
    dh = h;
    dw = h * ir;
  }
  const dx = x + (w - dw) / 2;
  const dy = y + (h - dh) / 2;
  ctx.save();
  roundRect(ctx, x, y, w, h, 12);
  ctx.clip();
  ctx.drawImage(img, dx, dy, dw, dh);
  ctx.restore();
}

async function clearSection(section){
  if(!confirm('Clear this section?')) return;
  state[section] = [];
  await saveState();
  render();
}

async function refreshSection(section){
  const items = state[section] || [];
  if(!items.length){
    alert('Nothing to refresh in this section.');
    return;
  }

  // Keep it simple + reliable: re-check active_in_store for each item.
  // (Sequential to avoid hammering the API.)
  for(const entry of items){
    if(!entry?.id) continue;
    try{
      const detail = await apiItemDetail(entry.id);
      if(detail){
        entry.activeInStore = !!detail.active_in_store;
        // If the name changes upstream, keep ours in sync.
        if(detail.name) entry.name = detail.name;
      }
    }catch{
      // Leave existing values as-is on failures.
    }
  }

  await saveState();
  render();
}

document.addEventListener('DOMContentLoaded', async()=>{
  await loadState();
  applyTheme(themeFromState());
  render();

  wireTabs();

  // Persist drafts as the user types.
  $('#in-query')?.addEventListener('input', ()=>persistDraftForTab(getActiveTab()));
  $('#in-note')?.addEventListener('input', ()=>persistDraftForTab(getActiveTab()));

  const themeSelect = $('#theme-select');
  if(themeSelect){
    themeSelect.value = themeFromState();
    themeSelect.addEventListener('change', async()=>{
      const t = themeSelect.value;
      state.settings = state.settings || {};
      state.settings.theme = (t === 'classic' || t === 'dark' || t === 'valentine') ? t : 'classic';
      applyTheme(themeFromState());
      await saveState();
    });
  }

  $('#btn-search')?.addEventListener('click', doSearch);
  $('#in-query')?.addEventListener('keydown', (e)=>{
    if(e.key === 'Enter') doSearch();
  });

  $('#btn-export')?.addEventListener('click', ()=>{
    const scope = $('#export-scope')?.value || 'active';
    exportPng(scope);
  });

  $('#btn-open-sidebar')?.addEventListener('click', openSidePanel);
  $('#btn-clear-wish')?.addEventListener('click', ()=>clearSection('wish'));
  $('#btn-clear-sell')?.addEventListener('click', ()=>clearSection('sell'));
  $('#btn-clear-sellSets')?.addEventListener('click', ()=>clearSection('sellSets'));
  $('#btn-clear-buy')?.addEventListener('click', ()=>clearSection('buy'));

  $('#btn-refresh-wish')?.addEventListener('click', ()=>refreshSection('wish'));
  $('#btn-refresh-sell')?.addEventListener('click', ()=>refreshSection('sell'));
  $('#btn-refresh-sellSets')?.addEventListener('click', ()=>refreshSection('sellSets'));
  $('#btn-refresh-buy')?.addEventListener('click', ()=>refreshSection('buy'));

  // Keep state updated across devices.
  chrome.storage.onChanged.addListener((changes, area)=>{
    if(area !== 'sync') return;
    if(!changes[SYNC_KEY]) return;
    const s = changes[SYNC_KEY].newValue || {};
    state = {
      wish: Array.isArray(s.wish) ? s.wish : [],
      sell: Array.isArray(s.sell) ? s.sell : [],
      sellSets: Array.isArray(s.sellSets) ? s.sellSets : [],
      buy: Array.isArray(s.buy) ? s.buy : [],
      settings: {
        theme: (s?.settings?.theme === 'classic' || s?.settings?.theme === 'dark' || s?.settings?.theme === 'valentine')
          ? s.settings.theme
          : 'classic'
      }
    };
    applyTheme(themeFromState());
    const themeSelect = $('#theme-select');
    if(themeSelect) themeSelect.value = themeFromState();
    render();
  });
});
