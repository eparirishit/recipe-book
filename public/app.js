// Recipe Book App — frontend (vanilla JS, no build step).
const view = document.getElementById('view');
const tabbar = document.getElementById('tabbar');
const toastEl = document.getElementById('toast');

const state = {
  tab: 'home',
  q: '',
  category: '',
  maxTime: '',
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

let toastTimer;
function toast(msg) {
  toastEl.textContent = msg;
  toastEl.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove('show'), 2200);
}

const ICONS = {
  clock: '<svg viewBox="0 0 24 24"><path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm1 10.6l4 2.4-.8 1.3L11 13.5V7h2v5.6z"/></svg>',
  serves: '<svg viewBox="0 0 24 24"><path d="M16 11a4 4 0 1 0-4-4 4 4 0 0 0 4 4zm-8 0a4 4 0 1 0-.6-7.96A5.99 5.99 0 0 1 12 5a6 6 0 0 1-.4 11.96A3.99 3.99 0 0 0 8 11zm8 2c-2.7 0-8 1.3-8 4v3h16v-3c0-2.7-5.3-4-8-4z"/></svg>',
  heart: '<svg viewBox="0 0 24 24"><path d="M12 21s-7.5-4.9-9.7-9.2C.7 8.6 2.6 5 6 5c2 0 3.4 1.1 4 2.2C10.6 6.1 12 5 14 5c3.4 0 5.3 3.6 3.7 6.8C19.5 16.1 12 21 12 21z"/></svg>',
  search: '<svg viewBox="0 0 24 24"><path d="M10 2a8 8 0 1 0 4.9 14.3l5 5 1.4-1.4-5-5A8 8 0 0 0 10 2zm0 2a6 6 0 1 1 0 12 6 6 0 0 1 0-12z"/></svg>',
  back: '<svg viewBox="0 0 24 24"><path d="M15 5l-7 7 7 7 1.4-1.4L10.8 12l5.6-5.6L15 5z"/></svg>',
};

// ---------------- home feed ----------------
async function loadHomeData() {
  const params = new URLSearchParams();
  if (state.q) params.set('q', state.q);
  if (state.category) params.set('category', state.category);
  if (state.maxTime) params.set('maxTime', state.maxTime);
  if (state.tab === 'favorites') params.set('favoritesOnly', '1');
  state.recipes = await api('/api/recipes?' + params.toString());
}

function cardHTML(r) {
  return `
  <button class="card" data-id="${r.id}">
    <div class="card-art" style="background:${catGradient(r.category)}">
      <span class="num">${pad2(r.number)}</span>
      <span class="cat">${esc(r.category)}</span>
    </div>
    <div class="card-body">
      <h2>${r.favorite ? ICONS.heart.replace('<svg', '<svg class="fav-dot"') : ''}${esc(r.title)}</h2>
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
      <h1>${isFav ? 'Saved Recipes' : 'Recipe Book'}</h1>
      <p class="sub">${isFav ? 'Your favorited recipes, one tap away.' : 'Every recipe worth keeping.'}</p>
    </div>
    <div class="search-wrap">
      <div class="search-box">${ICONS.search}<input id="q" type="search" placeholder="Search recipes or ingredients…" value="${esc(state.q)}" autocomplete="off"></div>
    </div>
    <div class="chips" id="chips">
      <button class="chip ${!state.category ? 'active' : ''}" data-cat="">All</button>
      ${state.categories.map(c => `<button class="chip ${state.category === c ? 'active' : ''}" data-cat="${esc(c)}">${esc(c)}</button>`).join('')}
    </div>
    <div class="filters-row">
      <select id="maxTime" aria-label="Max cooking time">
        <option value="">Any time</option>
        <option value="15" ${state.maxTime === '15' ? 'selected' : ''}>Under 15 min</option>
        <option value="30" ${state.maxTime === '30' ? 'selected' : ''}>Under 30 min</option>
        <option value="45" ${state.maxTime === '45' ? 'selected' : ''}>Under 45 min</option>
        <option value="60" ${state.maxTime === '60' ? 'selected' : ''}>Under 1 hour</option>
      </select>
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

// ---------------- navigation ----------------
const routes = { home: renderHome, favorites: renderHome };

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
  await fn(param);
}

tabbar.addEventListener('click', e => {
  const btn = e.target.closest('.tab');
  if (!btn) return;
  const tab = btn.dataset.tab;
  if (tab === 'home') { state.q = ''; state.category = ''; state.maxTime = ''; }
  go(tab);
});

async function init() {
  try {
    state.categories = await api('/api/categories');
  } catch (e) {
    view.innerHTML = `<div class="empty"><div class="big">Couldn't reach the server</div><p>${esc(e.message)}</p></div>`;
    return;
  }
  await go('home');
}

init();
