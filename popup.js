const SYNC_KEY = 'yo_template_sync_v1';
const LOCAL_KEY = 'yo_template_local_v1';
const SYNC_SETTINGS_KEY = 'yo_template_sync_settings_v1';

function $(s){return document.querySelector(s);}
function el(t,c){const e=document.createElement(t); if(c) e.className=c; return e;}

function defaultState(){
  return {
    wish: [],
    sell: [],
    sellSets: [],
    buy: [],
    pricecheck: [],
    settings: {
      theme: 'classic',
      imageSource: 'cdn' // 'cdn' | 'info' | 'auto'
    }
  };
}

let state = defaultState();

let lastPriceCheckItem = null;

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
  return tabName === 'wish' || tabName === 'sell' || tabName === 'sellSets' || tabName === 'buy' || tabName === 'pricecheck';
}

function isKnownTab(tabName){
  return tabName === 'wish' || tabName === 'sell' || tabName === 'sellSets' || tabName === 'buy' || tabName === 'pricecheck' || tabName === 'settings';
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
  // Use event delegation so tab switching keeps working even if the UI is re-rendered
  // or if individual listeners fail to attach for any reason.
  if(!wireTabs._delegated){
    document.addEventListener('click', (e)=>{
      const btn = e.target && e.target.closest ? e.target.closest('.tab[data-tab]') : null;
      if(!btn) return;
      const tabName = btn.dataset ? btn.dataset.tab : null;
      if(!tabName) return;
      setActiveTab(tabName);
    }, true);
    wireTabs._delegated = true;
  }
  let initial = 'wish';
  try{ initial = localStorage.getItem(ACTIVE_TAB_KEY) || 'wish'; }catch{}
  if(!isKnownTab(initial)) initial = 'wish';
  currentTab = initial;
  setActiveTab(initial);
}
wireTabs._delegated = false;

function isKnownThemeValue(t){
  return t === 'classic' || t === 'dark' || t === 'valentine' || t === 'ocean' || t === 'forest' || t === 'sunset';
}

function themeFromState(){
  const t = state?.settings?.theme;
  return isKnownThemeValue(t) ? t : 'classic';
}

function imageSourceFromState(){
  const v = state?.settings?.imageSource;
  return (v === 'cdn' || v === 'info' || v === 'auto') ? v : 'cdn';
}

function normalizeImportedState(maybe){
  // Accept either { data: <state>, ... } wrapper or raw state.
  const raw = (maybe && typeof maybe === 'object' && maybe.data && typeof maybe.data === 'object') ? maybe.data : maybe;
  const s = (raw && typeof raw === 'object') ? raw : {};

  return {
    wish: Array.isArray(s.wish) ? s.wish : [],
    sell: Array.isArray(s.sell) ? s.sell : [],
    sellSets: Array.isArray(s.sellSets) ? s.sellSets : [],
    buy: Array.isArray(s.buy) ? s.buy : [],
    pricecheck: Array.isArray(s.pricecheck) ? s.pricecheck : [],
    settings: {
      theme: isKnownThemeValue(s?.settings?.theme) ? s.settings.theme : 'classic',
      imageSource: (s?.settings?.imageSource === 'cdn' || s?.settings?.imageSource === 'info' || s?.settings?.imageSource === 'auto')
        ? s.settings.imageSource
        : 'cdn'
    }
  };
}

async function exportBackupJson(){
  const payload = {
    app: 'YoSelection',
    version: 1,
    exportedAt: new Date().toISOString(),
    data: state
  };

  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const stamp = new Date().toISOString().slice(0,19).replace(/[:T]/g,'-');
  a.href = url;
  a.download = `yoselection-backup-${stamp}.json`;
  a.click();
  setTimeout(()=>URL.revokeObjectURL(url), 2000);
}

async function importBackupJsonFromFile(file){
  if(!file){
    alert('Choose a backup .json file first.');
    return;
  }

  let text = '';
  try{
    text = await file.text();
  }catch{
    alert('Could not read file.');
    return;
  }

  let parsed;
  try{
    parsed = JSON.parse(text);
  }catch{
    alert('Invalid JSON file.');
    return;
  }

  const next = normalizeImportedState(parsed);

  const count = (next.wish.length + next.sell.length + next.sellSets.length + next.buy.length + next.pricecheck.length);
  const ok = confirm(`Import backup and replace your current saved data?\n\nItems in backup: ${count}`);
  if(!ok) return;

  state = next;
  applyTheme(themeFromState());
  await saveState();

  // Sync UI controls
  const themeSelect = $('#theme-select');
  if(themeSelect) themeSelect.value = themeFromState();
  const imgSourceSelect = $('#image-source-select');
  if(imgSourceSelect) imgSourceSelect.value = imageSourceFromState();

  render();
  alert('Backup imported successfully.');
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

  if(theme === 'ocean'){
    return {
      bg: '#ecfeff',
      tileBg: '#ffffff',
      tileBorder: '#a5f3fc',
      text: '#0f172a',
      muted: '#475569',
      imgFallback: '#cffafe',
      badgeBg: '#cffafe',
      badgeBorder: '#0891b2',
      badgeBorderAlt: '#ef4444',
      badgeText: '#0f172a',
      priceBg: '#cffafe',
      priceBorder: '#0891b2',
      priceText: '#0f172a'
    };
  }

  if(theme === 'forest'){
    return {
      bg: '#f0fdf4',
      tileBg: '#ffffff',
      tileBorder: '#bbf7d0',
      text: '#052e16',
      muted: '#166534',
      imgFallback: '#dcfce7',
      badgeBg: '#dcfce7',
      badgeBorder: '#16a34a',
      badgeBorderAlt: '#ef4444',
      badgeText: '#052e16',
      priceBg: '#dcfce7',
      priceBorder: '#16a34a',
      priceText: '#052e16'
    };
  }

  if(theme === 'sunset'){
    return {
      bg: '#fff7ed',
      tileBg: '#ffffff',
      tileBorder: '#fed7aa',
      text: '#1f2937',
      muted: '#6b7280',
      imgFallback: '#ffedd5',
      badgeBg: '#ffedd5',
      badgeBorder: '#f97316',
      badgeBorderAlt: '#ef4444',
      badgeText: '#1f2937',
      priceBg: '#ffedd5',
      priceBorder: '#f97316',
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

function normalizeStateFromStorage(maybe){
  const s = (maybe && typeof maybe === 'object') ? maybe : {};
  return {
    wish: Array.isArray(s.wish) ? s.wish : [],
    sell: Array.isArray(s.sell) ? s.sell : [],
    sellSets: Array.isArray(s.sellSets) ? s.sellSets : [],
    buy: Array.isArray(s.buy) ? s.buy : [],
    pricecheck: Array.isArray(s.pricecheck) ? s.pricecheck : [],
    settings: {
      theme: isKnownThemeValue(s?.settings?.theme) ? s.settings.theme : 'classic',
      imageSource: (s?.settings?.imageSource === 'cdn' || s?.settings?.imageSource === 'info' || s?.settings?.imageSource === 'auto')
        ? s.settings.imageSource
        : 'cdn'
    }
  };
}

function countItemsInState(s){
  if(!s) return 0;
  return (Number(s?.wish?.length) || 0) + (Number(s?.sell?.length) || 0) + (Number(s?.sellSets?.length) || 0) + (Number(s?.buy?.length) || 0) + (Number(s?.pricecheck?.length) || 0);
}

function storageGet(area, key){
  return new Promise((resolve)=>{
    try{
      chrome.storage[area].get([key], (res)=>{
        const err = chrome.runtime?.lastError;
        resolve({ value: res ? res[key] : undefined, error: err ? String(err.message || err) : '' });
      });
    }catch(e){
      resolve({ value: undefined, error: String(e && e.message ? e.message : e) });
    }
  });
}

function storageSet(area, key, value){
  return new Promise((resolve)=>{
    try{
      chrome.storage[area].set({ [key]: value }, ()=>{
        const err = chrome.runtime?.lastError;
        resolve({ ok: !err, error: err ? String(err.message || err) : '' });
      });
    }catch(e){
      resolve({ ok: false, error: String(e && e.message ? e.message : e) });
    }
  });
}

async function loadState(){
  const [legacySyncRes, localRes, syncSettingsRes] = await Promise.all([
    storageGet('sync', SYNC_KEY),
    storageGet('local', LOCAL_KEY),
    storageGet('sync', SYNC_SETTINGS_KEY)
  ]);

  if(legacySyncRes.error) console.warn('sync get failed:', legacySyncRes.error);
  if(syncSettingsRes.error) console.warn('sync settings get failed:', syncSettingsRes.error);
  if(localRes.error) console.warn('local get failed:', localRes.error);

  // Lists live in local. For backward compatibility, we still *read* legacy sync full-state.
  const legacySyncState = normalizeStateFromStorage(legacySyncRes.value);
  const localState = normalizeStateFromStorage(localRes.value);

  const legacyCount = countItemsInState(legacySyncState);
  const localCount = countItemsInState(localState);
  const listState = (localCount >= legacyCount) ? localState : legacySyncState;

  // Settings are small enough to sync reliably.
  const syncedSettingsOnly = normalizeStateFromStorage({ settings: syncSettingsRes.value }).settings;
  const haveSyncedSettings = !!(syncSettingsRes.value && typeof syncSettingsRes.value === 'object');

  state = {
    wish: listState.wish,
    sell: listState.sell,
    sellSets: listState.sellSets,
    buy: listState.buy,
    pricecheck: listState.pricecheck,
    settings: haveSyncedSettings ? syncedSettingsOnly : listState.settings
  };
}

async function saveState(){
  // Always persist locally (higher quotas; reliable across extension reload).
  const local = await storageSet('local', LOCAL_KEY, state);
  if(!local.ok) console.warn('local set failed:', local.error);

  // Sync only lightweight settings (theme/image source). Lists stay local to avoid sync quota errors.
  const syncSettings = await storageSet('sync', SYNC_SETTINGS_KEY, state.settings || {});
  if(!syncSettings.ok) console.warn('sync settings set failed:', syncSettings.error);
}

function buildYwCdnImageUrlFromId(itemId){
  const id = Number(itemId);
  if(!Number.isFinite(id) || id <= 0) return '';

  // YoWorld CDN pathing uses the first 4 digits of the item id (zero-padded)
  // as folder segments, e.g. 26295 -> /26/29/26295/26295.png
  // This matches how yoworld.info constructs CDN URLs.
  const s = String(Math.trunc(id)).padStart(4, '0');
  const g1 = s.substring(0, 2);
  const g2 = s.substring(2, 4);
  return `https://yw-web.yoworld.com/cdn/items/${g1}/${g2}/${id}/${id}.png`;
}

function yoworldInfoProxyUrlForImageUrl(imageUrl){
  const u = (typeof imageUrl === 'string') ? imageUrl.trim() : '';
  if(!u) return '';
  if(/^https?:\/\/api\.yoworld\.info\/extension\.php\?x=/i.test(u)) return u;
  if(!/^https?:\/\//i.test(u)) return '';
  return `https://api.yoworld.info/extension.php?x=${encodeURIComponent(u)}`;
}

function deepFindImageUrl(obj){
  // Best-effort: crawl a few levels looking for an absolute URL that looks like an image.
  const isImageUrl = (s)=>{
    if(typeof s !== 'string') return false;
    const u = s.trim();
    if(!/^https?:\/\//i.test(u)) return false;
    if(/\.(png|jpg|jpeg|webp)(\?|#|$)/i.test(u)) return true;
    // Some services omit extensions but still serve images.
    if(/image|cdn\/items|thumbnail|icon/i.test(u)) return true;
    return false;
  };

  const seen = new Set();
  const q = [{ v: obj, d: 0 }];
  while(q.length){
    const { v, d } = q.shift();
    if(!v || d > 4) continue;
    if(typeof v === 'string'){
      if(isImageUrl(v)) return v.trim();
      continue;
    }
    if(typeof v !== 'object') continue;
    if(seen.has(v)) continue;
    seen.add(v);

    if(Array.isArray(v)){
      for(const x of v) q.push({ v: x, d: d + 1 });
    }else{
      for(const k of Object.keys(v)) q.push({ v: v[k], d: d + 1 });
    }
  }
  return '';
}

function extractYoWorldInfoImageUrl(detail, itemId){
  const candidates = [
    detail?.image_url,
    detail?.imageUrl,
    detail?.image,
    detail?.image_path,
    detail?.img,
    detail?.icon,
    detail?.icon_url,
    detail?.thumbnail,
    detail?.thumbnail_url,
    detail?.cdn_image_url,
    detail?.cdnImageUrl
  ].filter(Boolean);

  for(const c of candidates){
    if(typeof c !== 'string') continue;
    const u = c.trim();
    if(!u) continue;
    if(/^https?:\/\//i.test(u)) return u;
    // Some APIs return relative paths
    if(u.startsWith('/')) return `https://yoworld.info${u}`;
  }

  const deep = deepFindImageUrl(detail);
  if(deep) return deep;

  // Fallback: if not provided, leave empty.
  // (We still have the YoWorld CDN derived URL.)
  void itemId;
  return '';
}

function bestImageUrlForItem(item){
  if(!item) return '';
  const s = (v)=> (typeof v === 'string' ? v.trim() : '');
  const source = imageSourceFromState();
  const direct = s(item.imageUrl);
  const cdn = s(item.ywCdnImageUrl) || buildYwCdnImageUrlFromId(item.id);
  const info = s(item.ywInfoImageUrl) || yoworldInfoProxyUrlForImageUrl(cdn || direct);

  if(source === 'info') return info || direct || cdn;
  if(source === 'auto') return direct || cdn || info;
  return direct || cdn || info;
}

async function ensureInfoImageUrl(entry){
  if(!entry || !entry.id) return '';
  if(typeof entry.ywInfoImageUrl === 'string' && entry.ywInfoImageUrl.trim()) return entry.ywInfoImageUrl.trim();

  // Primary strategy: use YoWorld.info's image proxy for the derived CDN URL.
  // This endpoint often returns a valid PNG even when the direct CDN URL 404s.
  const cdn = entry.ywCdnImageUrl || buildYwCdnImageUrlFromId(entry.id);
  if(cdn && !entry.ywCdnImageUrl) entry.ywCdnImageUrl = cdn;
  const proxied = yoworldInfoProxyUrlForImageUrl(cdn || entry.imageUrl);
  if(proxied){
    entry.ywInfoImageUrl = proxied;
    return proxied;
  }

  try{
    const detail = await apiItemDetail(entry.id);
    const u = extractYoWorldInfoImageUrl(detail, entry.id);
    if(u){
      entry.ywInfoImageUrl = u;
      return u;
    }
  }catch{}
  return '';
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

const ITEM_DETAIL_CACHE = new Map();
function apiItemDetailCached(id){
  const key = String(id);
  if(ITEM_DETAIL_CACHE.has(key)) return ITEM_DETAIL_CACHE.get(key);
  const p = apiItemDetail(id).catch((e)=>{
    ITEM_DETAIL_CACHE.delete(key);
    throw e;
  });
  ITEM_DETAIL_CACHE.set(key, p);
  return p;
}

function firstUrlFromText(text){
  const s = String(text || '');
  const m = s.match(/https?:\/\/[^\s"'<>]+/i);
  return m ? m[0] : '';
}

function extractItemIdFromUrl(url){
  const u = String(url || '').trim();
  if(!u) return 0;

  // Unwrap YoWorld.info image proxy URLs (these often wrap the CDN URL in x=...)
  // Example: https://api.yoworld.info/extension.php?x=<encoded-cdn-url>
  try{
    const proxyMatch = u.match(/api\.yoworld\.info\/extension\.php\?[^\s#]*\bx=([^&\s#]+)/i);
    if(proxyMatch && proxyMatch[1]){
      const inner = decodeURIComponent(proxyMatch[1]);
      const innerId = extractItemIdFromUrl(inner);
      if(innerId) return innerId;
    }
  }catch{}

  // api.yoworld.info item endpoint
  let m = u.match(/api\.yoworld\.info\/api\/items\/(\d+)/i);
  if(m) return Number(m[1]) || 0;

  // yoworld.info item pages commonly include an ID in the path
  m = u.match(/yoworld\.info\/(?:item|items)\/(\d+)/i);
  if(m) return Number(m[1]) || 0;

  // Sometimes it's a slug with an ID in it
  m = u.match(/yoworld\.info\/[^\s\/]+\/(\d+)[^\s\/]*$/i);
  if(m) return Number(m[1]) || 0;

  // CDN URL ends with /<id>/<id>.png
  m = u.match(/\/cdn\/items\/[0-9]{2}\/[0-9]{2}\/(\d+)\/(\d+)\.png/i);
  if(m) return Number(m[2] || m[1]) || 0;

  // Some CDN variants / formats
  m = u.match(/\/cdn\/items\/[0-9]{2}\/[0-9]{2}\/(\d+)\/(\d+)\.(png|jpg|jpeg|webp)/i);
  if(m) return Number(m[2] || m[1]) || 0;

  // Fallback: first long-ish number in URL
  m = u.match(/\b(\d{4,})\b/);
  if(m) return Number(m[1]) || 0;
  return 0;
}

async function addItemById(section, itemId, note){
  const id = Number(itemId);
  if(!Number.isFinite(id) || id <= 0){
    alert('Could not detect an item ID from the dropped content.');
    return;
  }

  state[section] = state[section] || [];

  // Duplicate detection
  const existing = (state[section] || []).find(e=>String(e?.id) === String(id));
  if(existing){
    const n = String(note || '').trim();
    if(n){
      const ok = confirm('This item is already in this section. Update its note instead?');
      if(ok){
        existing.note = n;
        await saveState();
        render();
      }
    }else{
      alert('Duplicate detected: this item is already in this section.');
    }
    return;
  }

  let activeInStore = false;
  let fullName = '';
  let infoImageUrl = '';
  try{
    const detail = await apiItemDetail(id);
    activeInStore = !!detail?.active_in_store;
    if(detail?.name) fullName = detail.name;
  }catch{}

  const cdnImageUrl = buildYwCdnImageUrlFromId(id);
  infoImageUrl = yoworldInfoProxyUrlForImageUrl(cdnImageUrl);
  const source = imageSourceFromState();
  let chosenImageUrl = cdnImageUrl;
  if(source === 'info'){
    chosenImageUrl = infoImageUrl || cdnImageUrl;
  }else if(source === 'auto'){
    chosenImageUrl = cdnImageUrl || infoImageUrl;
  }

  const entry = {
    key: keyFor(section, id),
    id,
    name: fullName || `Item ${id}`,
    note: String(note || '').trim(),
    imageUrl: chosenImageUrl,
    ywCdnImageUrl: cdnImageUrl,
    ywInfoImageUrl: infoImageUrl,
    activeInStore,
    addedAt: Date.now()
  };

  state[section].push(entry);
  await saveState();
  render();
}

function wireSidePanelDrop(){
  const zone = $('#drop-zone');
  if(!zone || wireSidePanelDrop._wired) return;
  wireSidePanelDrop._wired = true;

  zone.addEventListener('dragover', (e)=>{
    e.preventDefault();
    zone.classList.add('is-over');
    try{ e.dataTransfer.dropEffect = 'copy'; }catch{}
  });
  zone.addEventListener('dragleave', ()=>zone.classList.remove('is-over'));
  zone.addEventListener('drop', async(e)=>{
    e.preventDefault();
    zone.classList.remove('is-over');

    let url = '';
    try{
      url = e.dataTransfer.getData('text/uri-list') || '';
      if(!url) url = firstUrlFromText(e.dataTransfer.getData('text/plain'));
      if(!url) url = firstUrlFromText(e.dataTransfer.getData('text/html'));
    }catch{}

    if(!url){
      alert('Drop a YoWorld.info item link (URL).');
      return;
    }

    const id = extractItemIdFromUrl(url);
    const section = $('#in-section')?.value || getActiveTab() || 'wish';
    const note = ($('#in-note')?.value || '').trim();
    await addItemById(section, id, note);
  });
}
wireSidePanelDrop._wired = false;

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
  renderGrid('pricecheck', $('#grid-pricecheck'));
}

let dragState = {
  section: null,
  key: null
};

function reorderByKey(section, fromKey, toKey){
  if(!section || !fromKey || !toKey) return false;
  const arr = (state[section] || []).slice();
  const fromIndex = arr.findIndex(x=>x && x.key === fromKey);
  const toIndex = arr.findIndex(x=>x && x.key === toKey);
  if(fromIndex < 0 || toIndex < 0 || fromIndex === toIndex) return false;
  const [moved] = arr.splice(fromIndex, 1);
  arr.splice(toIndex, 0, moved);
  state[section] = arr;
  return true;
}

function renderGrid(section, root){
  if(!root) return;
  root.innerHTML = '';
  const items = state[section] || [];
  for(const item of items){
    const tile = el('div','tile');
    tile.draggable = true;
    tile.dataset.key = item.key;
    tile.dataset.section = section;

    tile.addEventListener('dragstart', (e)=>{
      dragState = { section, key: item.key };
      tile.classList.add('is-dragging');
      try{
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', item.key);
      }catch{}
    });

    tile.addEventListener('dragend', ()=>{
      tile.classList.remove('is-dragging');
      dragState = { section: null, key: null };
      root.querySelectorAll('.tile.is-drop-target').forEach(t=>t.classList.remove('is-drop-target'));
    });

    tile.addEventListener('dragover', (e)=>{
      if(dragState.section !== section) return;
      if(!dragState.key || dragState.key === item.key) return;
      e.preventDefault();
      try{ e.dataTransfer.dropEffect = 'move'; }catch{}
      tile.classList.add('is-drop-target');
    });

    tile.addEventListener('dragleave', ()=>{
      tile.classList.remove('is-drop-target');
    });

    tile.addEventListener('drop', async (e)=>{
      if(dragState.section !== section) return;
      e.preventDefault();
      tile.classList.remove('is-drop-target');
      const fromKey = dragState.key;
      const toKey = item.key;
      if(reorderByKey(section, fromKey, toKey)){
        await saveState();
        render();
      }
    });

    const imgWrap = el('div','imgwrap');

    const img = el('img');
    img.src = bestImageUrlForItem(item);
    img.alt = item.name || 'Item';
    img.loading = 'lazy';
    img.referrerPolicy = 'no-referrer';
    img.addEventListener('error', async()=>{
      // Try to repair broken images by swapping to YoWorld.info URL.
      if(img.dataset.fallbackTried === '1') return;
      img.dataset.fallbackTried = '1';
      const fallback = await ensureInfoImageUrl(item);
      if(fallback){
        if(item.imageUrl !== fallback){
          item.imageUrl = fallback;
          img.src = fallback;
          try{ await saveState(); }catch{}
        }
        return;
      }

      // As a last resort, retry derived CDN URL if we weren't already using it.
      const cdn = buildYwCdnImageUrlFromId(item?.id);
      if(cdn && img.src !== cdn){
        item.imageUrl = cdn;
        img.src = cdn;
        try{ await saveState(); }catch{}
      }
    });
    imgWrap.appendChild(img);

    const edit = el('button','imgedit');
    edit.type = 'button';
    edit.title = 'Edit note/price';
    edit.setAttribute('aria-label', 'Edit note/price');
    edit.textContent = 'Edit';
    edit.addEventListener('mousedown', (e)=>{
      // Prevent drag from starting when pressing the button.
      e.stopPropagation();
      e.preventDefault();
    });
    edit.addEventListener('click', async(e)=>{
      e.stopPropagation();
      const current = String(item.note || '');
      const next = prompt('Note / price (leave blank to clear):', current);
      if(next === null) return;
      item.note = String(next).trim();
      await saveState();
      render();
    });
    imgWrap.appendChild(edit);

    tile.appendChild(imgWrap);

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

function clearAddItemFields(){
  const q = $('#in-query');
  const n = $('#in-note');
  const r = $('#results');
  if(q) q.value = '';
  if(n) n.value = '';
  if(r) r.innerHTML = '';
  persistDraftForTab(getActiveTab());
}

function clearPriceCheckFields(){
  const q = $('#pc-query');
  if(q) q.value = '';
}

async function tryQuickAddFromAddItemInputs(){
  const raw = ($('#in-query')?.value || '').trim();
  if(!raw) return false;

  const maybeUrl = firstUrlFromText(raw) || raw;
  const idFromUrl = /^https?:\/\//i.test(maybeUrl) ? extractItemIdFromUrl(maybeUrl) : 0;
  const fromNum = Number(raw);
  const id = (idFromUrl > 0) ? idFromUrl : (Number.isFinite(fromNum) ? fromNum : 0);
  if(!(id > 0)) return false;

  const section = $('#in-section')?.value || getActiveTab() || 'wish';
  const note = ($('#in-note')?.value || '').trim();
  await addItemById(section, id, note);
  clearAddItemFields();
  return true;
}

async function tryQuickAddFromPriceCheckInputs(){
  const raw = ($('#pc-query')?.value || '').trim();
  if(!raw) return false;
  const fromUrl = extractItemIdFromUrl(raw);
  const fromNum = Number(raw);
  const id = (fromUrl > 0) ? fromUrl : (Number.isFinite(fromNum) ? fromNum : 0);
  if(!(id > 0)) return false;

  await addItemById('pricecheck', id, '');
  clearPriceCheckFields();
  return true;
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

  // Support pasting an item link OR an image link.
  // Even if the image URL is dead, it often contains the item ID.
  const maybeUrl = firstUrlFromText(q) || q;
  if(/^https?:\/\//i.test(maybeUrl)){
    const id = extractItemIdFromUrl(maybeUrl);
    if(id > 0){
      const row = el('div','result');
      const thumb = el('img','thumb');
      thumb.src = buildYwCdnImageUrlFromId(id);
      thumb.alt = `Item ${id}`;
      thumb.loading = 'lazy';
      thumb.referrerPolicy = 'no-referrer';
      thumb.addEventListener('error', async()=>{
        if(thumb.dataset.fallbackTried === '1') return;
        thumb.dataset.fallbackTried = '1';
        const u = yoworldInfoProxyUrlForImageUrl(buildYwCdnImageUrlFromId(id));
        if(u) thumb.src = u;
      });
      row.appendChild(thumb);

      const meta = el('div','meta');
      const name = el('div','name');
      name.textContent = `Item ${id}`;
      meta.appendChild(name);
      const small = el('div','small');
      small.textContent = `ID: ${id}`;
      meta.appendChild(small);

      const store = el('div','small');
      store.textContent = 'In store: ...';
      meta.appendChild(store);
      row.appendChild(meta);

      // Try to resolve a friendly name, but don't block Add.
      void (async()=>{
        try{
          const detail = await apiItemDetailCached(id);
          const resolved = String(pick(detail, ['name','item_name','title']) || '').trim();
          if(resolved){
            name.textContent = resolved;
            thumb.alt = resolved;
          }

          if(store.isConnected){
            store.textContent = `In store: ${detail?.active_in_store ? 'Yes' : 'No'}`;
          }
        }catch{}
      })();

      const add = el('button');
      add.type = 'button';
      add.textContent = 'Add';
      add.addEventListener('click', async()=>{
        const section = $('#in-section')?.value || 'wish';
        const note = ($('#in-note')?.value || '').trim();
        await addItemById(section, id, note);
        clearAddItemFields();
      });
      row.appendChild(add);

      resultsRoot.appendChild(row);
      return;
    }
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
      thumb.addEventListener('error', async()=>{
        if(thumb.dataset.fallbackTried === '1') return;
        thumb.dataset.fallbackTried = '1';
        const u = yoworldInfoProxyUrlForImageUrl(buildYwCdnImageUrlFromId(it.id));
        if(u) thumb.src = u;
      });
      row.appendChild(thumb);

      const meta = el('div','meta');
      const name = el('div','name');
      name.textContent = it.name || '(Unnamed)';
      meta.appendChild(name);

      const small = el('div','small');
      small.textContent = `ID: ${it.id}`;
      meta.appendChild(small);

      const store = el('div','small');
      store.textContent = 'In store: ...';
      meta.appendChild(store);
      row.appendChild(meta);

      // Fetch store status asynchronously so results render fast.
      void (async()=>{
        try{
          const detail = await apiItemDetailCached(it.id);
          if(store.isConnected){
            store.textContent = `In store: ${detail?.active_in_store ? 'Yes' : 'No'}`;
          }
        }catch{
          if(store.isConnected){
            store.textContent = 'In store: No';
          }
        }
      })();

      const add = el('button');
      add.type = 'button';
      add.textContent = 'Add';
      add.addEventListener('click', async()=>{
        const section = $('#in-section')?.value || 'wish';
        const note = ($('#in-note')?.value || '').trim();

        state[section] = state[section] || [];

        // Duplicate detection
        const existing = (state[section] || []).find(e=>String(e?.id) === String(it.id));
        if(existing){
          if(note){
            const ok = confirm('This item is already in this section. Update its note instead?');
            if(ok){
              existing.note = note;
              await saveState();
              render();
            }
          }else{
            alert('Duplicate detected: this item is already in this section.');
          }
          return;
        }

        let activeInStore = false;
        let fullName = it.name || '';
        let infoImageUrl = '';
        try{
          const detail = await apiItemDetailCached(it.id);
          activeInStore = !!detail?.active_in_store;
          if(detail?.name) fullName = detail.name;
        }catch{
          activeInStore = false;
        }

        const cdnImageUrl = buildYwCdnImageUrlFromId(it.id);
        infoImageUrl = yoworldInfoProxyUrlForImageUrl(cdnImageUrl);
        const source = imageSourceFromState();
        let chosenImageUrl = cdnImageUrl;
        if(source === 'info'){
          chosenImageUrl = infoImageUrl || cdnImageUrl;
        }else if(source === 'auto'){
          chosenImageUrl = cdnImageUrl || infoImageUrl;
        }

        const entry = {
          key: keyFor(section, it.id),
          id: it.id,
          name: fullName,
          note,
          imageUrl: chosenImageUrl,
          ywCdnImageUrl: cdnImageUrl,
          ywInfoImageUrl: infoImageUrl,
          activeInStore,
          addedAt: Date.now()
        };

        state[section].push(entry);
        await saveState();
        render();
        clearAddItemFields();
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
    img.referrerPolicy = 'no-referrer';
    img.onload = ()=>resolve(img);
    img.onerror = ()=>reject(new Error('img load fail'));
    img.src = url;
  });
}

async function canLoadImage(url, timeoutMs){
  const u = String(url || '').trim();
  if(!u) return false;
  const ms = Number.isFinite(timeoutMs) ? timeoutMs : 4500;
  return new Promise((resolve)=>{
    const img = new Image();
    img.referrerPolicy = 'no-referrer';
    let done = false;
    const finish = (ok)=>{
      if(done) return;
      done = true;
      try{ img.onload = null; img.onerror = null; }catch{}
      resolve(!!ok);
    };
    const t = setTimeout(()=>finish(false), ms);
    img.onload = ()=>{ clearTimeout(t); finish(true); };
    img.onerror = ()=>{ clearTimeout(t); finish(false); };
    // Bust caches so we don't get stuck on a cached broken response.
    const sep = u.includes('?') ? '&' : '?';
    img.src = u + sep + 'cb=' + Date.now().toString(36);
  });
}

function exportSectionsForScope(scope){
  const allLists = [
    { key: 'wish', title: 'Wish List' },
    { key: 'sell', title: 'Sell' },
    { key: 'sellSets', title: 'Sets' },
    { key: 'buy', title: 'Buy' },
    { key: 'pricecheck', title: 'Price Check' }
  ];

  let s = scope;
  if(s === 'active') s = getActiveTab();
  if(!['wish','sell','sellSets','buy','pricecheck','all'].includes(s)) s = 'wish';
  if(s === 'all' || !s) return allLists;

  const one = allLists.find(x=>x.key === s);
  return one ? [one] : allLists;
}

function pick(obj, keys){
  for(const k of keys){
    if(obj && Object.prototype.hasOwnProperty.call(obj, k)) return obj[k];
  }
  return undefined;
}

async function copyTextToClipboard(text){
  const t = String(text || '');
  if(!t) return false;
  try{
    if(navigator?.clipboard?.writeText){
      await navigator.clipboard.writeText(t);
      return true;
    }
  }catch{}

  try{
    const ta = document.createElement('textarea');
    ta.value = t;
    ta.style.position = 'fixed';
    ta.style.left = '-9999px';
    ta.style.top = '0';
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return !!ok;
  }catch{}
  return false;
}

function yoworldInfoItemPageUrl(itemId){
  const id = Number(itemId);
  if(!Number.isFinite(id) || id <= 0) return '';
  // Best guess; even if this path differs, we still show the API-based info.
  return `https://yoworld.info/items/${id}`;
}

async function priceCheckShowDetail(itemId){
  const root = $('#pc-detail');
  if(!root) return;
  root.innerHTML = '';

  const id = Number(itemId);
  if(!Number.isFinite(id) || id <= 0){
    root.appendChild(Object.assign(el('div','hint'), { textContent: 'Invalid item id.' }));
    return;
  }

  let detail = null;
  try{ detail = await apiItemDetail(id); }catch{}
  if(!detail){
    root.appendChild(Object.assign(el('div','hint'), { textContent: 'Could not load item details.' }));
    return;
  }

  const name = String(pick(detail, ['name','item_name','title']) || `Item ${id}`);
  const cdnImageUrl = buildYwCdnImageUrlFromId(id);
  const infoImageUrl = yoworldInfoProxyUrlForImageUrl(cdnImageUrl);
  const imgUrl = bestImageUrlForItem({ id, imageUrl: '', ywCdnImageUrl: cdnImageUrl, ywInfoImageUrl: infoImageUrl });
  const link = yoworldInfoItemPageUrl(id);

  // Remember last selected item (used as a convenience; not required for exporting).
  lastPriceCheckItem = {
    id,
    name,
    note: '',
    imageUrl: imgUrl,
    ywCdnImageUrl: cdnImageUrl,
    ywInfoImageUrl: infoImageUrl,
    activeInStore: !!detail?.active_in_store
  };

  const head = el('div');
  head.className = 'result';
  const img = el('img','thumb');
  img.src = imgUrl;
  img.alt = name;
  img.loading = 'lazy';
  img.referrerPolicy = 'no-referrer';
  head.appendChild(img);
  const meta = el('div','meta');
  meta.appendChild(Object.assign(el('div','name'), { textContent: name }));
  meta.appendChild(Object.assign(el('div','small'), { textContent: `ID: ${id}` }));
  if(link){
    const a = document.createElement('a');
    a.href = link;
    a.target = '_blank';
    a.rel = 'noreferrer';
    a.textContent = 'Open on YoWorld.info';
    a.style.display = 'inline-block';
    a.style.marginTop = '4px';
    meta.appendChild(a);
  }
  head.appendChild(meta);
  root.appendChild(head);

  // Quick action: save this item to the Price Check list (works like Wish List).
  {
    const actionsRow = el('div','inline');
    actionsRow.style.marginTop = '8px';
    const addBtn = el('button');
    addBtn.type = 'button';
    addBtn.textContent = 'Add to Price Check list';
    addBtn.addEventListener('click', async()=>{
      state.pricecheck = state.pricecheck || [];
      const existing = (state.pricecheck || []).find(e=>String(e?.id) === String(id));
      if(existing){
        alert('Already in your Price Check list.');
        return;
      }

      const entry = {
        key: keyFor('pricecheck', id),
        id,
        name,
        note: '',
        imageUrl: imgUrl,
        ywCdnImageUrl: cdnImageUrl,
        ywInfoImageUrl: infoImageUrl,
        activeInStore: !!detail?.active_in_store,
        addedAt: Date.now()
      };
      state.pricecheck.push(entry);
      await saveState();
      render();
      setActiveTab('pricecheck');
    });
    actionsRow.appendChild(addBtn);
    root.appendChild(actionsRow);
  }

  const msg = `PC: ${name} (ID ${id}) — what’s the current price?`;

  const box = el('div');
  box.className = 'row';
  box.style.marginTop = '10px';
  const lbl = el('div','lbl');
  lbl.textContent = 'Copy message';
  box.appendChild(lbl);

  const ta = document.createElement('textarea');
  ta.value = msg;
  ta.rows = 3;
  ta.style.width = '100%';
  ta.style.resize = 'vertical';
  ta.style.padding = '8px';
  ta.style.borderRadius = '10px';
  ta.style.border = '1px solid var(--border)';
  ta.style.background = 'var(--surface)';
  ta.style.color = 'var(--text)';
  box.appendChild(ta);

  const actions = el('div','inline');
  actions.style.marginTop = '8px';
  const copyBtn = el('button');
  copyBtn.type = 'button';
  copyBtn.textContent = 'Copy';
  copyBtn.addEventListener('click', async()=>{
    const ok = await copyTextToClipboard(ta.value);
    if(!ok) alert('Copy failed. You can manually select and copy the text.');
  });
  actions.appendChild(copyBtn);

  const addToNoteBtn = el('button');
  addToNoteBtn.type = 'button';
  addToNoteBtn.textContent = 'Use as note';
  addToNoteBtn.title = 'Copies the message into the Note box in the Add item section.';
  addToNoteBtn.addEventListener('click', ()=>{
    const n = $('#in-note');
    if(n) n.value = ta.value;
  });
  actions.appendChild(addToNoteBtn);
  box.appendChild(actions);

  root.appendChild(box);
}

async function priceCheckSearch(){
  const q = ($('#pc-query')?.value || '').trim();
  const resultsRoot = $('#pc-results');
  const detailRoot = $('#pc-detail');
  if(resultsRoot) resultsRoot.innerHTML = '';
  if(detailRoot) detailRoot.innerHTML = '<div class="hint">Select an item to view details.</div>';
  lastPriceCheckItem = null;

  if(!q){
    resultsRoot?.appendChild(Object.assign(el('div','hint'), { textContent: 'Type a search term or paste an item link/ID.' }));
    return;
  }

  // If the user pasted an ID or URL, go straight to detail.
  const fromUrl = extractItemIdFromUrl(q);
  const fromNum = Number(q);
  const id = (fromUrl > 0) ? fromUrl : (Number.isFinite(fromNum) ? fromNum : 0);
  if(id > 0){
    await priceCheckShowDetail(id);
    return;
  }

  try{
    const items = await apiSearch(q);
    if(!items.length){
      resultsRoot?.appendChild(Object.assign(el('div','hint'), { textContent: 'No results.' }));
      return;
    }

    for(const it of items){
      const row = el('div','result');
      const thumb = el('img','thumb');
      thumb.src = buildYwCdnImageUrlFromId(it.id);
      thumb.alt = it.name || 'Item';
      thumb.loading = 'lazy';
      thumb.referrerPolicy = 'no-referrer';
      thumb.addEventListener('error', async()=>{
        if(thumb.dataset.fallbackTried === '1') return;
        thumb.dataset.fallbackTried = '1';
        try{
          const detail = await apiItemDetail(it.id);
          const u = extractYoWorldInfoImageUrl(detail, it.id);
          if(u) thumb.src = u;
        }catch{}
      });
      row.appendChild(thumb);

      const meta = el('div','meta');
      meta.appendChild(Object.assign(el('div','name'), { textContent: it.name || '(Unnamed)' }));
      meta.appendChild(Object.assign(el('div','small'), { textContent: `ID: ${it.id}` }));
      row.appendChild(meta);

      const btn = el('button');
      btn.type = 'button';
      btn.textContent = 'Check';
      btn.addEventListener('click', ()=>priceCheckShowDetail(it.id));
      row.appendChild(btn);

      resultsRoot?.appendChild(row);
    }
  }catch(e){
    console.error(e);
    resultsRoot?.appendChild(Object.assign(el('div','hint'), { textContent: 'Price check search failed.' }));
  }
}

async function exportPng(scope){
  const canvas = $('#export-canvas');
  if(!canvas) return;
  const ctx = canvas.getContext('2d');

  const theme = themeFromState();
  const pal = exportPalette(theme);

  const COLS = 5;
  const DEFAULT_PAGE_SIZE = 20; // 5 cols x 4 rows
  const WISH_PAGE_SIZE = 50; // 5 cols x 10 rows (single image)
  const TILE_W = 160;
  const TILE_H_DEFAULT_WITH_NOTE = 238;
  const TILE_H_DEFAULT_NO_NOTE = 220;
  const TILE_H_WISH_WITH_NOTE = 220;
  const TILE_H_WISH_NO_NOTE = 200;
  const PAD = 20;
  const GAP = 12;
  const HEADER_H = 44;

  function pageSizeForSection(sectionKey){
    return (sectionKey === 'wish' || sectionKey === 'pricecheck') ? WISH_PAGE_SIZE : DEFAULT_PAGE_SIZE;
  }

  function sleep(ms){ return new Promise(r=>setTimeout(r, ms)); }

  async function downloadCurrentCanvas(filename){
    const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    setTimeout(()=>URL.revokeObjectURL(url), 2000);
  }

  async function renderAndDownloadSectionPage(sectionKey, title, items, pageIndex, totalPages){
    const pageHasAnyNote = (items || []).some(it => String(it?.note || '').trim());

    const cols = COLS;
    const tileW = TILE_W;

    const rows = Math.max(1, Math.ceil(items.length / cols));
    const width = PAD*2 + cols*tileW + (cols-1)*GAP;
    const tileH = (sectionKey === 'wish' || sectionKey === 'pricecheck')
      ? (pageHasAnyNote ? TILE_H_WISH_WITH_NOTE : TILE_H_WISH_NO_NOTE)
      : (pageHasAnyNote ? TILE_H_DEFAULT_WITH_NOTE : TILE_H_DEFAULT_NO_NOTE);
    const height = PAD + HEADER_H + rows * tileH + (rows-1)*GAP + PAD;

    canvas.width = width;
    canvas.height = height;

    // Background
    ctx.fillStyle = pal.bg;
    ctx.fillRect(0,0,width,height);

    ctx.textBaseline = 'top';

    // Header
    ctx.fillStyle = pal.text;
    ctx.font = 'bold 20px system-ui, -apple-system, Segoe UI, sans-serif';
    ctx.fillText(title, PAD, PAD);

    const y = PAD + HEADER_H;
    for(let r=0; r<rows; r++){
      for(let c=0; c<cols; c++){
        const idx = r*cols + c;
        const x = PAD + c*(tileW+GAP);
        const ty = y + r*(tileH+GAP);

        // Tile background
        ctx.fillStyle = pal.tileBg;
        roundRect(ctx, x, ty, tileW, tileH, 14);
        ctx.fill();

        ctx.strokeStyle = pal.tileBorder;
        ctx.lineWidth = 2;
        roundRect(ctx, x, ty, tileW, tileH, 14);
        ctx.stroke();

        const item = items[idx];
        if(!item) continue;

        // Store badge
        const badgeText = item.activeInStore ? 'IN STORE' : 'NOT IN STORE';
        ctx.font = 'bold 15px system-ui, -apple-system, Segoe UI, sans-serif';
        const bw = ctx.measureText(badgeText).width + 16;
        const bx = x + (tileW - bw) / 2;
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

        // Price / note
        const price = String(item.note || '').trim();
        const hasPrice = !!price;
        const priceX = x + 10;
        const priceW = tileW - 20;
        const priceH = 22;
        const priceY = ty + tileH - 10 - priceH;
        if(price){
          ctx.font = '800 17px "Segoe UI", system-ui, -apple-system, sans-serif';
          drawCenteredPillText(ctx, price, priceX, priceY, priceW, priceH, pal.priceBg, pal.priceBorder, pal.priceText);
        }

        // Image area (contain: do not crop)
        // When there's no price/note (common for wish exports), expand the image area a bit
        // so we don't end up with a large empty gap under short names.
        const imgX = x + 10;
        const imgY = ty + 34;
        const imgW = tileW - 20;
        const imgH = (sectionKey === 'wish' || sectionKey === 'pricecheck')
          ? (pageHasAnyNote ? (!hasPrice ? 110 : 88) : 104)
          : (pageHasAnyNote ? 88 : 96);

        try{
          let img;
          try{
            img = await loadImage(bestImageUrlForItem(item));
          }catch{
            // If export hits broken CDN URLs, try YoWorld.info as fallback.
            const fallback = await ensureInfoImageUrl(item);
            if(fallback) img = await loadImage(fallback);
            else throw new Error('no fallback');
          }
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

        // Name
        ctx.fillStyle = pal.text;
        const nameX = x + 10;
        const nameY = imgY + imgH + 6;
        const nameW = tileW - 20;
        const nameBottom = (hasPrice ? (priceY - 8) : (ty + tileH - 10));
        const availableH = Math.max(18, nameBottom - nameY);

        const startFontSize = (sectionKey === 'wish' || sectionKey === 'pricecheck') ? 16 : 17;
        const minFontSize = (sectionKey === 'wish' || sectionKey === 'pricecheck') ? 11 : 12;

        let nameFontSize = startFontSize;
        let nameLineH = 22;
        let nameLines = [];

        for(let fs = startFontSize; fs >= minFontSize; fs--){
          nameLineH = Math.max(16, fs + 4);
          const maxLines = Math.max(1, Math.min(3, Math.floor(availableH / nameLineH)));
          ctx.font = `600 ${fs}px "Segoe UI", system-ui, -apple-system, sans-serif`;
          const wrapped = wrapLines(ctx, item.name || '', nameW, maxLines);
          nameLines = wrapped.lines;
          nameFontSize = fs;
          if(!wrapped.truncated) break;
        }

        ctx.font = `600 ${nameFontSize}px "Segoe UI", system-ui, -apple-system, sans-serif`;
        ctx.save();
        ctx.textAlign = 'center';

        // If there are no notes on this Wish List export page, keep the name
        // top-aligned so the overall template can be shorter.
        const textBlockH = nameLines.length * nameLineH;
        const shouldBottomAlign = pageHasAnyNote;
        const nameStartY = shouldBottomAlign
          ? Math.max(nameY, nameBottom - textBlockH)
          : nameY;
        for(let i=0; i<nameLines.length; i++){
          const yy = nameStartY + i * nameLineH;
          if(yy + nameLineH > nameBottom + 2) break;
          ctx.fillText(nameLines[i], nameX + nameW / 2, yy);
        }
        ctx.restore();
      }
    }

    const suffix = totalPages > 1 ? `-p${pageIndex+1}` : '';
    await downloadCurrentCanvas(`yoselection-${sectionKey}${suffix}.png`);
  }

  const sections = exportSectionsForScope(scope);
  const sectionJobs = sections.map(s=>{
    let allItems = [];

    allItems = state[s.key] || [];

    if(s.key === 'wish' || s.key === 'pricecheck'){
      allItems = allItems.slice(0, 50);
    }

    const pageSize = pageSizeForSection(s.key);
    const pages = [];
    for(let i=0; i<Math.max(1, allItems.length); i += pageSize){
      pages.push(allItems.slice(i, i + pageSize));
      if(allItems.length === 0) break;
    }
    return { key: s.key, title: s.title, pages };
  });

  const totalDownloads = sectionJobs.reduce((sum, j)=>sum + (j.pages.length || 1), 0);
  if(totalDownloads > 1){
    const ok = confirm(
      `This export will download ${totalDownloads} PNG files.\n\n` +
      `Wish List: up to 50 items per image\n` +
      `Other sections: 20 items per image\n\n` +
      `Continue?`
    );
    if(!ok) return;
  }

  for(const job of sectionJobs){
    const totalPages = job.pages.length || 1;
    for(let pi=0; pi<totalPages; pi++){
      const items = job.pages[pi] || [];
      await renderAndDownloadSectionPage(job.key, job.title, items, pi, totalPages);
      await sleep(90);
    }
  }
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

function isKnownSection(section){
  return section === 'wish' || section === 'sell' || section === 'sellSets' || section === 'buy' || section === 'pricecheck';
}

function getList(section){
  if(!isKnownSection(section)) return [];
  const arr = state?.[section];
  return Array.isArray(arr) ? arr : [];
}

function setList(section, items){
  if(!isKnownSection(section)) return;
  state[section] = Array.isArray(items) ? items : [];
}

async function clearSection(section){
  if(!confirm('Clear this section?')) return;
  setList(section, []);
  await saveState();
  render();
}

async function refreshSection(section){
  const items = getList(section);
  if(!items.length){
    alert('Nothing to refresh in this section.');
    return;
  }

  // Keep it simple + reliable: re-check active_in_store for each item.
  // (Sequential to avoid hammering the API.)
  for(const entry of items){
    if(!entry?.id) continue;
    try{
      const detail = await apiItemDetailCached(entry.id);
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

async function repairImagesInSection(section){
  const items = state[section] || [];
  if(!items.length){
    alert('Nothing to repair in this section.');
    return;
  }

  const ok = confirm('This will check each item image and swap to the YoWorld.info image link when broken. Continue?');
  if(!ok) return;

  let changed = 0;
  let checked = 0;

  for(const entry of items){
    if(!entry?.id) continue;
    checked++;

    const currentUrl = String(entry.imageUrl || '').trim();
    const good = await canLoadImage(currentUrl, 4500);
    if(good) continue;

    const fallback = await ensureInfoImageUrl(entry);
    if(fallback && fallback !== currentUrl){
      entry.imageUrl = fallback;
      changed++;
    }
  }

  if(changed){
    await saveState();
    render();
  }

  alert(`Repair complete. Checked ${checked} items; updated ${changed} image links.`);
}

document.addEventListener('DOMContentLoaded', async()=>{
  await loadState();
  applyTheme(themeFromState());
  // Wire tabs early so navigation works even if rendering hits a bad state.
  wireTabs();
  try{ render(); }catch(e){ console.error('render failed', e); }

  // Side panel only: allow dropping YoWorld.info links to add items.
  if(document.body?.dataset?.page === 'sidepanel'){
    wireSidePanelDrop();
  }

  // Persist drafts as the user types.
  $('#in-query')?.addEventListener('input', ()=>persistDraftForTab(getActiveTab()));
  $('#in-note')?.addEventListener('input', ()=>persistDraftForTab(getActiveTab()));

  const themeSelect = $('#theme-select');
  if(themeSelect){
    themeSelect.value = themeFromState();
    themeSelect.addEventListener('change', async()=>{
      const t = themeSelect.value;
      state.settings = state.settings || {};
      state.settings.theme = isKnownThemeValue(t) ? t : 'classic';
      applyTheme(themeFromState());
      await saveState();
    });
  }

  const imgSourceSelect = $('#image-source-select');
  if(imgSourceSelect){
    imgSourceSelect.value = imageSourceFromState();
    imgSourceSelect.addEventListener('change', async()=>{
      const v = imgSourceSelect.value;
      state.settings = state.settings || {};
      state.settings.imageSource = (v === 'cdn' || v === 'info' || v === 'auto') ? v : 'cdn';
      await saveState();
      render();
    });
  }

  // Backup UI
  $('#btn-backup-export')?.addEventListener('click', exportBackupJson);
  $('#btn-backup-import')?.addEventListener('click', async()=>{
    const file = $('#backup-file')?.files?.[0] || null;
    await importBackupJsonFromFile(file);
  });

  $('#btn-search')?.addEventListener('click', doSearch);
  $('#in-query')?.addEventListener('keydown', (e)=>{
    if(e.key !== 'Enter') return;
    e.preventDefault();
    void (async()=>{
      const added = await tryQuickAddFromAddItemInputs();
      if(!added) await doSearch();
    })();
  });

  // Enter in Note should also attempt to save.
  $('#in-note')?.addEventListener('keydown', (e)=>{
    if(e.key !== 'Enter') return;
    e.preventDefault();
    void (async()=>{
      const added = await tryQuickAddFromAddItemInputs();
      if(!added) await doSearch();
    })();
  });

  // Price Check tab
  $('#pc-btn-search')?.addEventListener('click', priceCheckSearch);
  $('#pc-query')?.addEventListener('keydown', (e)=>{
    if(e.key !== 'Enter') return;
    e.preventDefault();
    void (async()=>{
      const added = await tryQuickAddFromPriceCheckInputs();
      if(!added) await priceCheckSearch();
    })();
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
  $('#btn-clear-pricecheck')?.addEventListener('click', ()=>clearSection('pricecheck'));

  $('#btn-refresh-wish')?.addEventListener('click', ()=>refreshSection('wish'));
  $('#btn-refresh-sell')?.addEventListener('click', ()=>refreshSection('sell'));
  $('#btn-refresh-sellSets')?.addEventListener('click', ()=>refreshSection('sellSets'));
  $('#btn-refresh-buy')?.addEventListener('click', ()=>refreshSection('buy'));
  $('#btn-refresh-pricecheck')?.addEventListener('click', ()=>refreshSection('pricecheck'));

  $('#btn-repair-wish')?.addEventListener('click', ()=>repairImagesInSection('wish'));
  $('#btn-repair-sell')?.addEventListener('click', ()=>repairImagesInSection('sell'));
  $('#btn-repair-sellSets')?.addEventListener('click', ()=>repairImagesInSection('sellSets'));
  $('#btn-repair-buy')?.addEventListener('click', ()=>repairImagesInSection('buy'));
  $('#btn-repair-pricecheck')?.addEventListener('click', ()=>repairImagesInSection('pricecheck'));

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
      pricecheck: Array.isArray(s.pricecheck) ? s.pricecheck : [],
      settings: {
        theme: isKnownThemeValue(s?.settings?.theme) ? s.settings.theme : 'classic',
        imageSource: (s?.settings?.imageSource === 'cdn' || s?.settings?.imageSource === 'info' || s?.settings?.imageSource === 'auto')
          ? s.settings.imageSource
          : 'cdn'
      }
    };
    applyTheme(themeFromState());
    const themeSelect = $('#theme-select');
    if(themeSelect) themeSelect.value = themeFromState();
    const imgSourceSelect = $('#image-source-select');
    if(imgSourceSelect) imgSourceSelect.value = imageSourceFromState();
    render();
  });
});
