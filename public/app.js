// Recipe Book App — frontend (vanilla JS, no build step).
const view = document.getElementById('view');
const tabbar = document.getElementById('tabbar');
const toastEl = document.getElementById('toast');

const state = {
  tab: 'home',
  q: '',
  category: '',
  maxTime: '',
  servesMin: '',
  favOnly: false,
  categories: [],
  recipes: [],
};

const CAT_COLORS = {
  'Soups': ['#e08e45', '#b25f1d'],
  'Rice & Grains': ['#c9a227', '#96700f'],
  'Chicken & Poultry': ['#a63d40', '#6f2426'],
  'Chutneys & Condiments': ['#6a9a5b', '#426b38'],
  'Curries': ['#b4552d', '#7c3a1d'],
  'Noodles': ['#7a6fc0', '#4e4390'],
};
const DEFAULT_CAT = ['#8a7d6b', '#5c554a'];

function catGradient(cat) {
  const [a, b] = CAT_COLORS[cat] || DEFAULT_CAT;
  return `linear-gradient(135deg, ${a}, ${b})`;
}

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

function pad2(n) { return String(n).padStart(2, '0'); }

// Link @handles in a source line to their Instagram profiles.
function linkHandles(text) {
  return esc(text).replace(/@([A-Za-z0-9._]+)/g, (m, h) => {
    const handle = h.replace(/[.]+$/, '');
    const tail = m.slice(1 + handle.length);
    return `<a href="https://instagram.com/${handle}" target="_blank" rel="noopener">@${handle}</a>${esc(tail)}`;
  });
}

async function api(path, opts = {}) {
  const res = await fetch(path, {
    ...opts,
    headers: { 'Content-Type': 'application/json', ...(opts.headers || {}) },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Request failed (${res.status})`);
  }
  return res.json();
}

async function updateGroceryBadge() {
  try {
    const groups = await api('/api/grocery');
    const n = groups.reduce((s, g) => s + g.items.length, 0);
    const b = document.getElementById('groceryBadge');
    if (!b) return;
    b.hidden = n === 0;
    b.textContent = n;
  } catch (e) { /* badge stays as-is */ }
}

let toastTimer;
function toast(msg) {
  toastEl.textContent = msg;
  toastEl.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove('show'), 3000);
}

const ICONS = {
  search: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>',
  heart: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M12 20.7C6.4 17 3 13.6 3 9.9 3 7.2 5.1 5 7.7 5c1.7 0 3.3.9 4.3 2.3C13 5.9 14.6 5 16.3 5 18.9 5 21 7.2 21 9.9c0 3.7-3.4 7.1-9 10.8Z"/></svg>',
  heartSolid: '<svg viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M12 20.7C6.4 17 3 13.6 3 9.9 3 7.2 5.1 5 7.7 5c1.7 0 3.3.9 4.3 2.3C13 5.9 14.6 5 16.3 5 18.9 5 21 7.2 21 9.9c0 3.7-3.4 7.1-9 10.8Z"/></svg>',
  back: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 5l-7 7 7 7"/></svg>',
  clock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="13" r="7.5"/><path d="M12 9.5V13l2.5 2M9.5 2.5h5"/></svg>',
  serves: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
  basket: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M5 8h14l-1.2 11a2 2 0 0 1-2 1.8H8.2a2 2 0 0 1-2-1.8Z"/><path d="M8.5 10V6.5a3.5 3.5 0 0 1 7 0V10"/></svg>',
  x: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>',
  list: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"><path d="M8 6h13M8 12h13M8 18h13"/><circle cx="4" cy="6" r="1" fill="currentColor"/><circle cx="4" cy="12" r="1" fill="currentColor"/><circle cx="4" cy="18" r="1" fill="currentColor"/></svg>',
};

// Decorative banner motif (from the prototype) for recipe card art.
const DECO = '<svg class="deco" width="150" height="150" viewBox="0 0 24 24" fill="none" stroke="rgba(255,252,240,0.85)" stroke-width="1.1" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20c6-1 14-7 16-16-9 2-15 10-16 16Z"/><path d="M4 20C7 14 11 9 17 5"/></svg>';

// ---------------- home feed ----------------
async function loadHomeData() {
  const params = new URLSearchParams();
  if (state.q) params.set('q', state.q);
  if (state.category) params.set('category', state.category);
  if (state.maxTime) params.set('maxTime', state.maxTime);
  if (state.servesMin) params.set('servesMin', state.servesMin);
  if (state.tab === 'favorites' || state.favOnly) params.set('favoritesOnly', '1');
  state.recipes = await api('/api/recipes?' + params.toString());
}

function cardHTML(r) {
  return `
  <button class="card" data-id="${r.id}">
    <div class="card-art" style="background:${catGradient(r.category)}">
      ${DECO}
      <span class="num">${pad2(r.number)}</span>
      <span class="cat">${esc(r.category)}</span>
    </div>
    <div class="card-body">
      <h2>${r.favorite ? ICONS.heartSolid.replace('<svg', '<svg class="fav-dot"') : ''}${esc(r.title)}</h2>
      <div class="meta">
        ${r.time ? `<span>${ICONS.clock}${esc(r.time)}</span>` : ''}
        ${r.serves ? `<span>${ICONS.serves}Serves ${esc(r.serves)}</span>` : ''}
      </div>
    </div>
  </button>`;
}

function renderHome() {
  const isFav = state.tab === 'favorites';
  view.innerHTML = `
    <div class="page-head">
      <div class="kicker">Personal Collection</div>
      <h1>${isFav ? 'Favorites' : 'Recipe Book'}</h1>
      <p class="sub">${isFav ? 'Your favorited recipes, one tap away.' : 'Every recipe worth keeping.'}</p>
    </div>
    <div class="search-wrap">
      <div class="search-box">${ICONS.search}<input id="q" type="search" placeholder="Search recipes or ingredients…" value="${esc(state.q)}" autocomplete="off"></div>
    </div>
    <div class="chips" id="chips">
      <button class="chip ${!state.category ? 'active' : ''}" data-cat="">All</button>
      ${state.categories.map(c => `<button class="chip ${state.category === c ? 'active' : ''}" data-cat="${esc(c)}">${esc(c)}</button>`).join('')}
    </div>
    <button class="fav-toggle" id="favToggle" aria-pressed="${state.favOnly}">${ICONS.heart}Favorites only</button>
    <div class="filter-row">
      <div class="field">
        <label for="maxTime">Max time</label>
        <select id="maxTime">
          <option value="">Any time</option>
          <option value="20" ${state.maxTime === '20' ? 'selected' : ''}>Up to 20 min</option>
          <option value="35" ${state.maxTime === '35' ? 'selected' : ''}>Up to 35 min</option>
          <option value="60" ${state.maxTime === '60' ? 'selected' : ''}>Up to 1 hour</option>
        </select>
      </div>
      <div class="field">
        <label for="servesMin">Serves at least</label>
        <select id="servesMin">
          <option value="">Any servings</option>
          <option value="1" ${state.servesMin === '1' ? 'selected' : ''}>1 person</option>
          <option value="2" ${state.servesMin === '2' ? 'selected' : ''}>2 people</option>
          <option value="3" ${state.servesMin === '3' ? 'selected' : ''}>3 people</option>
        </select>
      </div>
    </div>
    <div class="result-count">${state.recipes.length} recipe${state.recipes.length === 1 ? '' : 's'}</div>
    <div class="cards" id="cards">
      ${state.recipes.length ? state.recipes.map(cardHTML).join('') : `
        <div class="empty"><div class="big">Nothing here yet</div>
        <p>${isFav ? 'Tap the heart on any recipe to save it here.' : 'Try a different search or filter.'}</p></div>`}
    </div>`;

  const qInput = document.getElementById('q');
  let debounce;
  qInput.addEventListener('input', e => {
    clearTimeout(debounce);
    debounce = setTimeout(() => { state.q = e.target.value.trim(); refreshHome(false); }, 250);
  });
  // keep focus after re-render
  qInput.focus();
  qInput.setSelectionRange(qInput.value.length, qInput.value.length);

  document.getElementById('chips').addEventListener('click', e => {
    const btn = e.target.closest('.chip');
    if (!btn) return;
    state.category = btn.dataset.cat;
    refreshHome();
  });
  document.getElementById('maxTime').addEventListener('change', e => {
    state.maxTime = e.target.value;
    refreshHome();
  });
  document.getElementById('servesMin').addEventListener('change', e => {
    state.servesMin = e.target.value;
    refreshHome();
  });
  document.getElementById('favToggle').addEventListener('click', e => {
    state.favOnly = !state.favOnly;
    const btn = e.currentTarget;
    btn.setAttribute('aria-pressed', String(state.favOnly));
    refreshHome();
  });
  document.getElementById('cards').addEventListener('click', e => {
    const card = e.target.closest('.card');
    if (card) go('detail', card.dataset.id);
  });
}

async function refreshHome(rerenderShell = true) {
  await loadHomeData();
  if (rerenderShell) { renderHome(); }
  else {
    // light update: cards + count only, so typing isn't interrupted
    const wrap = document.getElementById('cards');
    const count = document.querySelector('.result-count');
    if (wrap) wrap.innerHTML = state.recipes.length ? state.recipes.map(cardHTML).join('')
      : `<div class="empty"><div class="big">Nothing here yet</div><p>Try a different search or filter.</p></div>`;
    if (count) count.textContent = `${state.recipes.length} recipe${state.recipes.length === 1 ? '' : 's'}`;
  }
}

// ---------------- recipe detail ----------------
let detailRecipe = null;
const checkedIng = new Set();

async function renderDetail(id) {
  detailRecipe = await api('/api/recipes/' + id);
  checkedIng.clear();
  const r = detailRecipe;

  view.innerHTML = `
    <button class="back-link" id="backBtn">${ICONS.back}All recipes</button>
    <div class="detail-hero" style="background:${catGradient(r.category)}">
      ${DECO}
      <div class="crumb">Recipe ${pad2(r.number)} · ${esc(r.category)}</div>
      <h1>${esc(r.title)}</h1>
      <div class="meta">
        ${r.time ? `<span>${ICONS.clock}${esc(r.time)}</span>` : ''}
        ${r.serves ? `<span>${ICONS.serves}Serves ${esc(r.serves)}</span>` : ''}
      </div>
    </div>
    ${r.description ? `<div class="detail-sec"><p class="desc">${esc(r.description)}</p></div>` : ''}
    <div class="action-bar">
      <button class="btn btn-primary" id="cookBtn">Start cooking</button>
      <button class="btn btn-outline ${r.favorite ? 'active' : ''}" id="favBtn" aria-label="Toggle favorite">${r.favorite ? ICONS.heartSolid : ICONS.heart}</button>
      <button class="btn btn-outline" id="grocBtn" aria-label="Add ingredients to grocery list" title="Add ingredients to grocery list">${ICONS.basket}</button>
    </div>
    ${r.source ? `<p class="source-line">${linkHandles(r.source)}${r.sourceUrl ? ` · <a class="watch-link" href="${esc(r.sourceUrl)}" target="_blank" rel="noopener">Watch the reel ↗</a>` : ''}</p>` : ''}
    <div class="detail-sec">
      <h3>Ingredients <span class="count">${r.ingredients.length}</span></h3>
      <ul class="ing-list" id="ingList">
        ${r.ingredients.map((ing, i) => `<li data-i="${i}"><span class="checkbox"></span><span>${esc(ing)}</span></li>`).join('')}
      </ul>
    </div>
    <div class="detail-sec">
      <h3>Method <span class="count">${r.method.length} steps</span></h3>
      <ol class="method-list">
        ${r.method.map(s => `<li>${esc(s)}</li>`).join('')}
      </ol>
    </div>
    <div class="note-box">
      <h3 style="font-family:'Playfair Display',serif;font-size:20px;margin-bottom:12px;">My notes</h3>
      <textarea id="noteText" placeholder="How did it turn out? Tweaks for next time…">${esc(r.note || '')}</textarea>
      <button class="btn btn-primary" id="noteSave">Save note</button>
    </div>`;

  document.getElementById('backBtn').addEventListener('click', () => go('home'));
  document.getElementById('cookBtn').addEventListener('click', () => go('cooking', r.id));
  document.getElementById('favBtn').addEventListener('click', async (e) => {
    try {
      const updated = await api('/api/recipes/' + r.id, {
        method: 'PATCH', body: JSON.stringify({ favorite: !r.favorite }),
      });
      detailRecipe = updated;
      e.currentTarget.classList.toggle('active', updated.favorite);
      e.currentTarget.innerHTML = updated.favorite ? ICONS.heartSolid : ICONS.heart;
      toast(updated.favorite ? 'Saved to favorites' : 'Removed from favorites');
    } catch (err) { toast(err.message); }
  });
  document.getElementById('grocBtn').addEventListener('click', async () => {
    try {
      const res = await api('/api/grocery', { method: 'POST', body: JSON.stringify({ recipeId: r.id }) });
      toast(`${res.added} ingredient${res.added === 1 ? '' : 's'} added to grocery list`);
      updateGroceryBadge();
    } catch (err) { toast(err.message); }
  });
  document.getElementById('ingList').addEventListener('click', e => {
    const li = e.target.closest('li');
    if (!li) return;
    li.classList.toggle('done');
  });
  document.getElementById('noteSave').addEventListener('click', async () => {
    const note = document.getElementById('noteText').value;
    try {
      detailRecipe = await api('/api/recipes/' + r.id, {
        method: 'PATCH', body: JSON.stringify({ note }),
      });
      toast('Note saved');
    } catch (err) { toast(err.message); }
  });
}

// ---------------- cooking mode ----------------
let cookRecipe = null;
let cookIdx = 0;
let cookShowIng = false;
let wakeLock = null;
let timerState = null; // { total, remaining, intervalId, label }

function findDurations(step) {
  // matches "10–12 minutes", "2-3 mins", "30 minutes", "1 hour"
  const re = /(\d+)\s*(?:[-–—]|to)\s*(\d+)\s*(minutes?|mins?|hours?|hrs?)|(\d+)\s*(minutes?|mins?|hours?|hrs?)/gi;
  const out = [];
  let m;
  while ((m = re.exec(step)) !== null) {
    const unit = (m[3] || m[5] || '').toLowerCase();
    const mult = unit.startsWith('h') ? 3600 : 60;
    const secs = parseInt(m[2] || m[4], 10) * mult; // upper bound of a range
    const label = m[2] ? `${m[1]}–${m[2]} ${m[3]}` : `${m[4]} ${m[5]}`;
    if (secs > 0 && secs <= 12 * 3600) out.push({ label, seconds: secs });
  }
  return out;
}

function fmtClock(s) {
  s = Math.max(0, Math.ceil(s));
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  return (h ? h + ':' + String(m).padStart(2, '0') : m) + ':' + String(sec).padStart(2, '0');
}

function beep() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.connect(g); g.connect(ctx.destination);
    o.frequency.value = 880;
    g.gain.setValueAtTime(0.001, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.5, ctx.currentTime + 0.05);
    [0, 0.35, 0.7].forEach(t => {
      o.frequency.setValueAtTime(880, ctx.currentTime + t);
    });
    o.start(); o.stop(ctx.currentTime + 1.1);
  } catch (e) { /* audio unavailable */ }
}

async function requestWakeLock() {
  try {
    if ('wakeLock' in navigator) {
      wakeLock = await navigator.wakeLock.request('screen');
    }
  } catch (e) { /* not supported / denied */ }
}

function releaseWakeLock() {
  try { if (wakeLock) { wakeLock.release(); wakeLock = null; } } catch (e) {}
  stopTimer();
}

function stopTimer() {
  if (timerState && timerState.intervalId) clearInterval(timerState.intervalId);
  timerState = null;
}

function renderCookStep() {
  const steps = cookRecipe.method;
  const step = steps[cookIdx];
  const timers = findDurations(step);

  document.getElementById('cookStepCount').textContent = `Step ${cookIdx + 1} of ${steps.length}`;
  document.getElementById('cookStepText').textContent = step;
  document.getElementById('cookBar').style.width = `${((cookIdx + 1) / steps.length) * 100}%`;
  document.getElementById('prevBtn').disabled = cookIdx === 0;
  document.getElementById('nextBtn').textContent = cookIdx === steps.length - 1 ? 'Finish' : 'Next step';

  const chipWrap = document.getElementById('timerChip');
  stopTimer();
  if (timers.length) {
    const t = timers[0];
    chipWrap.innerHTML = `
      <button class="timer-chip" id="tBtn">${ICONS.clock}<span id="tLabel">Start ${esc(t.label)} timer</span></button>`;
    document.getElementById('tBtn').addEventListener('click', () => toggleTimer(t));
  } else {
    chipWrap.innerHTML = '';
  }
}

function toggleTimer(t) {
  const labelEl = document.getElementById('tLabel');
  if (timerState && timerState.running) {
    clearInterval(timerState.intervalId);
    timerState.running = false;
    if (labelEl) labelEl.textContent = `Resume · ${fmtClock(timerState.remaining)}`;
    return;
  }
  if (!timerState) timerState = { remaining: t.seconds, running: false, intervalId: null };
  timerState.running = true;
  const endAt = Date.now() + timerState.remaining * 1000;
  const tick = () => {
    timerState.remaining = Math.max(0, (endAt - Date.now()) / 1000);
    if (labelEl) labelEl.textContent = fmtClock(timerState.remaining);
    if (timerState.remaining <= 0) {
      clearInterval(timerState.intervalId);
      timerState = null;
      if (labelEl) labelEl.textContent = "Time's up — tap to restart";
      beep();
      toast("Time's up!");
    }
  };
  timerState.intervalId = setInterval(tick, 250);
  tick();
}

async function renderCooking(id) {
  if (!detailRecipe || detailRecipe.id !== Number(id)) {
    detailRecipe = await api('/api/recipes/' + id);
  }
  cookRecipe = detailRecipe;
  cookIdx = 0;
  cookShowIng = false;
  tabbar.style.display = 'none';

  view.innerHTML = `
    <div class="cook">
      <div class="cook-top">
        <span class="title">${esc(cookRecipe.title)}</span>
        <button class="icon-btn" id="ingToggle" aria-label="Toggle ingredients" aria-pressed="false">${ICONS.list}</button>
        <button class="icon-btn" id="cookExit" aria-label="Exit cooking mode">${ICONS.x}</button>
      </div>
      <div class="cook-progress"><div class="bar"><i id="cookBar"></i></div></div>
      <div class="cook-step-count" id="cookStepCount"></div>
      <div class="cook-body">
        <p class="cook-step" id="cookStepText"></p>
        <div id="timerChip"></div>
        <div class="cook-ing" id="cookIng" hidden>
          <h4>Ingredients</h4>
          <ul>${cookRecipe.ingredients.map(i => `<li>${esc(i)}</li>`).join('')}</ul>
        </div>
      </div>
      <div class="cook-nav">
        <button class="btn btn-outline" id="prevBtn">Back</button>
        <button class="btn btn-primary" id="nextBtn">Next step</button>
      </div>
    </div>`;

  renderCookStep();
  requestWakeLock();

  document.getElementById('cookExit').addEventListener('click', () => {
    releaseWakeLock();
    go('detail', cookRecipe.id);
  });
  document.getElementById('ingToggle').addEventListener('click', e => {
    cookShowIng = !cookShowIng;
    document.getElementById('cookIng').hidden = !cookShowIng;
    e.currentTarget.setAttribute('aria-pressed', String(cookShowIng));
    e.currentTarget.classList.toggle('active', cookShowIng);
  });
  document.getElementById('prevBtn').addEventListener('click', () => {
    if (cookIdx > 0) { stopTimer(); cookIdx--; renderCookStep(); }
  });
  document.getElementById('nextBtn').addEventListener('click', () => {
    stopTimer();
    if (cookIdx < cookRecipe.method.length - 1) { cookIdx++; renderCookStep(); }
    else { renderCookDone(); }
  });
}

function renderCookDone() {
  releaseWakeLock();
  view.innerHTML = `
    <div class="cook">
      <div class="cook-top">
        <span class="title">${esc(cookRecipe.title)}</span>
        <button class="icon-btn" id="cookExit" aria-label="Exit cooking mode">${ICONS.x}</button>
      </div>
      <div class="cook-progress"><div class="bar"><i style="width:100%"></i></div></div>
      <div class="cook-body"><div class="cook-done">
        <p class="done-title">That's the last step.</p>
        <p>Plate it up while it's hot — and jot a note on the recipe page so next time is even better.</p>
        <button class="btn btn-primary" id="cookDoneBtn">Back to the recipe</button>
      </div></div>
    </div>`;
  const back = () => go('detail', cookRecipe.id);
  document.getElementById('cookExit').addEventListener('click', back);
  document.getElementById('cookDoneBtn').addEventListener('click', back);
}

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && state.tab === 'cooking') requestWakeLock();
});

// ---------------- grocery list ----------------
async function renderGrocery() {
  const groups = await api('/api/grocery');
  const total = groups.reduce((n, g) => n + g.items.length, 0);

  view.innerHTML = `
    <div class="page-head">
      <div class="kicker">Shopping</div>
      <h1>Grocery List</h1>
      <p class="sub">Ingredients gathered from your recipes, grouped by dish.</p>
    </div>
    <div id="grocery-body">
    ${groups.length ? groups.map(g => `
      <div class="grocery-group">
        <header>
          ${g.recipeNumber != null ? `<span class="g-num">No. ${pad2(g.recipeNumber)}</span>` : ''}
          <span class="g-title">${esc(g.recipeTitle)}</span>
          <button class="g-remove" data-gr="${g.recipeId}">Remove</button>
        </header>
        <ul>
          ${g.items.map(it => `
            <li class="${it.checked ? 'done' : ''}" data-id="${it.id}">
              <span class="checkbox" data-check></span><span class="g-label">${esc(it.label)}</span>
            </li>`).join('')}
        </ul>
      </div>`).join('') + `
      <div class="grocery-actions">
        <button class="btn btn-outline" id="gClearDone">Clear ticked items</button>
        <button class="btn btn-outline" id="gClearAll">Clear list</button>
      </div>`
      : `<div class="empty"><div class="big">The basket is empty</div>
        <p>Open a recipe and tap the basket icon — everything you need lands here, grouped by dish.</p></div>`}
    </div>`;

  const doneBtn = document.getElementById('gClearDone');
  if (doneBtn) doneBtn.addEventListener('click', async () => {
    await api('/api/grocery?checked=1', { method: 'DELETE' });
    toast('Ticked items cleared');
    updateGroceryBadge();
    renderGrocery();
  });
  const allBtn = document.getElementById('gClearAll');
  if (allBtn) allBtn.addEventListener('click', async () => {
    await api('/api/grocery', { method: 'DELETE' });
    toast('Grocery list cleared');
    updateGroceryBadge();
    renderGrocery();
  });

  view.querySelectorAll('[data-gr]').forEach(btn => {
    btn.addEventListener('click', async e => {
      e.stopPropagation();
      await api('/api/grocery?recipeId=' + btn.dataset.gr, { method: 'DELETE' });
      toast('Removed from grocery list');
      updateGroceryBadge();
      renderGrocery();
    });
  });

  view.querySelectorAll('#grocery-body li[data-id]').forEach(li => {
    li.addEventListener('click', async () => {
      const id = li.dataset.id;
      const nowDone = !li.classList.contains('done');
      const updated = await api('/api/grocery/' + id, {
        method: 'PATCH', body: JSON.stringify({ checked: nowDone }),
      });
      li.classList.toggle('done', updated.checked);
    });
  });
}

// ---------------- add recipe ----------------
const SEED_CATEGORIES = ['Soups', 'Rice & Grains', 'Chicken & Poultry', 'Chutneys & Condiments', 'Curries', 'Noodles'];

function renderAdd() {
  const cats = [...new Set([...SEED_CATEGORIES, ...state.categories])];
  view.innerHTML = `
    <div class="page-head">
      <div class="kicker">New entry</div>
      <h1>Add a Recipe</h1>
      <p class="sub">It gets the next permanent recipe number automatically.</p>
    </div>
    <form class="form" id="addForm">
      <div><label for="fTitle">Title</label><input id="fTitle" required maxlength="120" placeholder="e.g. Tomato Bath"></div>
      <div><label for="fCat">Category</label>
        <select id="fCat">${cats.map(c => `<option>${esc(c)}</option>`).join('')}<option value="__new">+ New category…</option></select>
      </div>
      <div id="newCatWrap" style="display:none"><label for="fNewCat">New category name</label><input id="fNewCat" maxlength="60"></div>
      <div class="row2">
        <div><label for="fServes">Serves</label><input id="fServes" maxlength="30" placeholder="2–3"></div>
        <div><label for="fTime">Time</label><input id="fTime" maxlength="40" placeholder="30 min"></div>
      </div>
      <div><label for="fDesc">Description</label><textarea id="fDesc" style="min-height:70px" maxlength="500" placeholder="One or two lines about the dish"></textarea></div>
      <div><label for="fIng">Ingredients — one per line</label><textarea id="fIng" required placeholder="Chicken, 500 g&#10;Onion, 2"></textarea></div>
      <div><label for="fMethod">Method — one step per line</label><textarea id="fMethod" required placeholder="Marinate the chicken…&#10;Heat oil in a pan…"></textarea></div>
      <div><label for="fSource">Source (optional)</label><input id="fSource" maxlength="200" placeholder="Instagram reel by @…"></div>
      <button class="btn btn-primary" type="submit">Save recipe</button>
    </form>
    <div class="roadmap">
      <strong>Coming soon:</strong> import straight from an Instagram reel link —
      paste a link and the recipe fills itself in, just like the chat workflow today.
    </div>`;

  document.getElementById('fCat').addEventListener('change', e => {
    document.getElementById('newCatWrap').style.display = e.target.value === '__new' ? '' : 'none';
  });

  document.getElementById('addForm').addEventListener('submit', async e => {
    e.preventDefault();
    const catSel = document.getElementById('fCat').value;
    const category = catSel === '__new'
      ? document.getElementById('fNewCat').value.trim()
      : catSel;
    if (!category) { toast('Pick or name a category'); return; }
    try {
      const created = await api('/api/recipes', {
        method: 'POST',
        body: JSON.stringify({
          title: document.getElementById('fTitle').value.trim(),
          category,
          serves: document.getElementById('fServes').value.trim(),
          time: document.getElementById('fTime').value.trim(),
          description: document.getElementById('fDesc').value.trim(),
          ingredients: document.getElementById('fIng').value,
          method: document.getElementById('fMethod').value,
          source: document.getElementById('fSource').value.trim(),
        }),
      });
      state.categories = await api('/api/categories');
      toast(`Recipe ${pad2(created.number)} saved`);
      go('detail', created.id);
    } catch (err) { toast(err.message); }
  });
}

// ---------------- navigation ----------------
const routes = { home: renderHome, favorites: renderHome, detail: renderDetail, cooking: renderCooking, grocery: renderGrocery, add: renderAdd };

function setActiveTab() {
  document.querySelectorAll('#tabbar .tab').forEach(t => {
    t.classList.toggle('active', t.dataset.tab === state.tab ||
      (state.tab === 'detail' && t.dataset.tab === 'home'));
  });
  tabbar.style.display = '';
}

async function go(tab, param) {
  const fn = routes[tab];
  if (!fn) return; // view not implemented yet
  state.tab = tab;
  window.scrollTo(0, 0);
  setActiveTab();
  if (tab === 'home' || tab === 'favorites') await loadHomeData();
  await fn(param);
}

tabbar.addEventListener('click', e => {
  const btn = e.target.closest('.tab');
  if (!btn) return;
  const tab = btn.dataset.tab;
  if (tab === 'home') { state.q = ''; state.category = ''; state.maxTime = ''; state.servesMin = ''; state.favOnly = false; }
  go(tab);
});

async function init() {
  try {
    state.categories = await api('/api/categories');
  } catch (e) {
    view.innerHTML = `<div class="empty"><div class="big">Couldn't reach the server</div><p>${esc(e.message)}</p></div>`;
    return;
  }
  updateGroceryBadge();
  await go('home');
}

init();
