/* ── state ────────────────────────────────────────────────────────────── */
const state = {
  view:        'home',   // 'home' | 'channel' | 'category' | 'settings' | 'watch'
  channelId:   null,
  categoryId:  null,
  filter:      'all',
  sort:        'newest',
  duration:    'any',
  layout:      'grid',
  categories:  [],
  channels:    [],
  settings:    {},
  videos:      [],
  total:       0,
  offset:      0,
  PAGE:        40,
  watchVideo:  null,  // currently playing video object
  canGoBack:   false, // true when watch was opened via navigation (not direct URL)
};

/* ── YouTube IFrame player ────────────────────────────────────────────── */
let _ytApiReady = false;
let _ytPlayer   = null;
let _progressTimer = null;

window.onYouTubeIframeAPIReady = function() { _ytApiReady = true; };

const API = '/api';

/* ── fetch helpers ────────────────────────────────────────────────────── */
async function api(path, opts = {}) {
  const res = await fetch(`${API}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...opts,
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

/* ── init ─────────────────────────────────────────────────────────────── */
async function init() {
  await loadMeta();
  applyStoredPrefs();
  renderSidebar();

  // Navigate to wherever the URL says, without pushing a new history entry
  const { view, id } = parseUrl();
  history.replaceState({ view, id }, '', window.location.pathname);
  navigate(view, id, { push: false });

  setupEvents();
  connectPollStream();
  connectThumbStream();
  api('/channels/poll-errors').then(d => setFeedErrors(d.errors)).catch(() => {});
}

// Handle browser back / forward
window.addEventListener('popstate', (e) => {
  if (e.state) {
    navigate(e.state.view, e.state.id, { push: false });
  } else {
    navigate('home', null, { push: false });
  }
});

async function loadMeta() {
  const [cats, chans, settings] = await Promise.all([
    api('/categories'),
    api('/channels'),
    api('/settings'),
  ]);
  state.categories = cats;
  state.channels   = chans;
  state.settings   = settings;
}

function applyStoredPrefs() {
  state.layout   = localStorage.getItem('layout')   || state.settings.default_view   || 'grid';
  state.filter   = localStorage.getItem('filter')   || state.settings.default_filter || 'all';
  state.sort     = localStorage.getItem('sort')     || state.settings.default_sort   || 'newest';
  state.autoplay = localStorage.getItem('autoplay') !== 'false';
}

/* ── navigation ───────────────────────────────────────────────────────── */
function navigate(view, id = null, { push = true } = {}) {
  const prevView  = state.view;
  state.view      = view;
  state.offset    = 0;
  state.videos    = [];

  if (view === 'channel')  state.channelId  = id;
  if (view === 'category') state.categoryId = id;

  // Update active states in sidebar
  document.querySelectorAll('.nav-item, .category-header, .channel-item').forEach(el => el.classList.remove('active'));

  if (view === 'home') {
    document.querySelector('[data-view="home"]')?.classList.add('active');
  } else if (view === 'settings') {
    document.querySelector('[data-view="settings"]')?.classList.add('active');
  } else if (view === 'categories') {
    document.querySelector('[data-view="categories"]')?.classList.add('active');
  } else if (view === 'channel') {
    document.querySelector(`.channel-item[data-id="${id}"]`)?.classList.add('active');
  } else if (view === 'category') {
    document.querySelector(`.category-header[data-id="${id}"]`)?.classList.add('active');
  }

  // Push URL so refresh and back/forward work
  if (push) {
    let url = '/';
    if (view === 'settings') {
      url = '/settings';
    } else if (view === 'categories') {
      url = '/categories';
    } else if (view === 'watch' && id) {
      url = `/watch/${id}`;
    } else if (view === 'channel' && id) {
      const ch = state.channels.find(c => String(c.id) === String(id));
      if (ch) url = `/channel/${encodeURIComponent(ch.name)}`;
    } else if (view === 'category' && id) {
      const cat = state.categories.find(c => String(c.id) === String(id));
      if (cat) url = `/category/${encodeURIComponent(cat.name)}`;
    }
    history.pushState({ view, id }, '', url);
  }

  const toolbar          = document.getElementById('toolbar');
  const videoContainer   = document.getElementById('videoContainer');
  const settingsPanel    = document.getElementById('settingsPanel');
  const categoriesPanel  = document.getElementById('categoriesPanel');
  const watchPanel       = document.getElementById('watchPanel');
  const loadMoreWrap     = document.getElementById('loadMoreWrap');
  const channelHeader    = document.getElementById('channelHeader');

  // Helper to hide all secondary panels at once
  const hideAll = () => {
    toolbar.classList.add('hidden');
    videoContainer.classList.add('hidden');
    loadMoreWrap.classList.add('hidden');
    settingsPanel.classList.add('hidden');
    categoriesPanel.classList.add('hidden');
    watchPanel.classList.add('hidden');
    channelHeader.classList.add('hidden');
  };

  if (view === 'settings') {
    hideAll();
    settingsPanel.classList.remove('hidden');
    stopPlayer();
    renderSettings();
  } else if (view === 'categories') {
    hideAll();
    categoriesPanel.classList.remove('hidden');
    stopPlayer();
    if (prevView !== 'categories') renderSidebar(); // switch to drag-handle mode
    renderCategoriesPage();
  } else if (view === 'watch') {
    hideAll();
    watchPanel.classList.remove('hidden');
    if (state.watchVideo) {
      renderWatchView(state.watchVideo);
    } else if (id) {
      api(`/videos/by-yt-id/${id}`).then(v => {
        if (v && !v.error) { state.watchVideo = v; renderWatchView(v); }
      });
    }
  } else {
    toolbar.classList.remove('hidden');
    videoContainer.classList.remove('hidden');
    settingsPanel.classList.add('hidden');
    categoriesPanel.classList.add('hidden');
    watchPanel.classList.add('hidden');
    stopPlayer();
    if (prevView === 'categories') renderSidebar(); // switch back to thumbnail mode
    if (view === 'channel') {
      renderChannelHeader(id);
    } else {
      channelHeader.classList.add('hidden');
    }
    loadVideos(true);
  }
}

/* ── render: channel header ───────────────────────────────────────────── */
async function renderChannelHeader(channelId) {
  const header = document.getElementById('channelHeader');
  let ch;
  try { ch = await api(`/channels/${channelId}`); } catch { header.classList.add('hidden'); return; }
  if (state.view !== 'channel' || state.channelId !== channelId) return; // navigated away while loading

  const metaParts = [];
  if (ch.handle) metaParts.push(escHtml(ch.handle));
  if (ch.subscriber_count != null) metaParts.push(`${formatCount(ch.subscriber_count)} subscribers`);
  metaParts.push(`${ch.video_count} video${ch.video_count !== 1 ? 's' : ''}`);

  header.innerHTML = `
    ${ch.banner_url ? `<img class="channel-header-banner" src="/api/channels/${ch.id}/banner" alt="" onerror="this.remove()">` : ''}
    <div class="channel-header-row">
      <img class="channel-header-avatar" src="/api/channels/${ch.id}/thumb" alt="" onerror="this.style.visibility='hidden'">
      <div class="channel-header-info">
        <div class="channel-header-name">${escHtml(ch.name)}</div>
        <div class="channel-header-meta">${metaParts.join(' · ')}</div>
      </div>
    </div>
    ${ch.description ? `<div class="channel-header-desc">${linkify(escHtml(ch.description))}</div>` : ''}
  `;
  header.classList.remove('hidden');
}

function formatCount(n) {
  if (n >= 1e6) return (n / 1e6).toFixed(1).replace(/\.0$/, '') + 'M';
  if (n >= 1e3) return (n / 1e3).toFixed(1).replace(/\.0$/, '') + 'K';
  return String(n);
}

// Turn plain-text URLs into links and preserve line breaks — input must already be HTML-escaped
function linkify(escapedText) {
  return escapedText
    .replace(/(https?:\/\/[^\s<]+|www\.[^\s<]+)/g, (m) => {
      const href = m.startsWith('http') ? m : `https://${m}`;
      return `<a href="${href}" target="_blank" rel="noopener">${m}</a>`;
    })
    .replace(/\n/g, '<br>');
}

// Resolve the current URL into a { view, id } pair after state has loaded
function parseUrl() {
  const path = decodeURIComponent(window.location.pathname);

  if (path === '/settings')   return { view: 'settings',   id: null };
  if (path === '/categories') return { view: 'categories', id: null };

  const watchMatch = path.match(/^\/watch\/(.+)$/);
  if (watchMatch) return { view: 'watch', id: watchMatch[1] };

  const chanMatch = path.match(/^\/channel\/(.+)$/);
  if (chanMatch) {
    const name = chanMatch[1];
    const ch   = state.channels.find(c => c.name === name);
    if (ch) return { view: 'channel', id: ch.id };
  }

  const catMatch = path.match(/^\/category\/(.+)$/);
  if (catMatch) {
    const name = catMatch[1];
    const cat  = state.categories.find(c => c.name === name);
    if (cat) return { view: 'category', id: cat.id };
  }

  return { view: 'home', id: null };
}

/* ── video loading ────────────────────────────────────────────────────── */
async function loadVideos(reset = false) {
  if (reset) {
    state.offset = 0;
    state.videos = [];
  }

  const params = new URLSearchParams({
    filter:   state.filter,
    sort:     state.sort,
    duration: state.duration,
    limit:    state.PAGE,
    offset:   state.offset,
  });

  if (state.view === 'channel')  params.set('channel_id',  state.channelId);
  if (state.view === 'category') params.set('category_id', state.categoryId);

  let data;
  try {
    data = await api(`/videos?${params}`);
  } catch (e) {
    console.error('loadVideos failed:', e);
    return;
  }
  state.videos = reset ? data.videos : [...state.videos, ...data.videos];
  state.total  = data.total;
  state.offset += data.videos.length;

  renderVideos(reset);
}

/* ── render: videos ───────────────────────────────────────────────────── */
function renderVideos(reset) {
  const container = document.getElementById('videoContainer');
  const lmw       = document.getElementById('loadMoreWrap');

  container.className = `video-container ${state.layout}`;

  if (reset) {
    // Remove all children except the load-more button
    Array.from(container.children)
      .filter(c => c.id !== 'loadMoreWrap')
      .forEach(c => c.remove());
  }

  if (state.videos.length === 0 && reset) {
    const empty = document.createElement('div');
    empty.className = 'empty-state';
    empty.innerHTML = '<h2>Nothing here yet</h2><p>Add some channels to get started.</p>';
    container.insertBefore(empty, lmw);
    lmw.classList.add('hidden');
    return;
  }

  const frag = document.createDocumentFragment();
  const batch = reset ? state.videos : state.videos.slice(state.offset - (state.offset % state.PAGE || state.PAGE));

  (reset ? state.videos : batch).forEach(v => {
    frag.appendChild(state.layout === 'grid' ? makeVideoCard(v) : makeVideoRow(v));
  });

  container.insertBefore(frag, lmw);
  lmw.classList.toggle('hidden', state.offset >= state.total);
}

function formatDuration(secs) {
  if (!secs) return '';
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  return h > 0
    ? `${h}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`
    : `${m}:${String(s).padStart(2,'0')}`;
}

function timeAgo(iso) {
  if (!iso) return '';
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 60)   return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24)   return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30)   return `${d}d ago`;
  return new Date(iso).toLocaleDateString();
}

// Icon + name for a video's channel, clickable to jump to that channel's page
function videoChannelLinkHtml(v) {
  const icon = v.channel_thumbnail
    ? `<img class="video-channel-icon" src="/api/channels/${v.channel_id}/thumb" alt="" onerror="this.style.display='none'">`
    : '';
  return `<span class="video-channel-link" data-channel-id="${v.channel_id}">${icon}${escHtml(v.channel_name)}</span>`;
}

function wireVideoChannelLink(el, v) {
  el.querySelector('.video-channel-link')?.addEventListener('click', (e) => {
    e.stopPropagation();
    navigate('channel', v.channel_id);
  });
}

function makeVideoCard(v) {
  const el = document.createElement('div');
  el.className = `video-card${v.watched_at ? ' watched' : ''}`;
  el.dataset.id = v.id;
  el.dataset.ytId = v.yt_id;
  el.innerHTML = `
    <div class="video-thumb-wrap">
      <img class="video-thumb" src="${v.thumbnail_url || ''}" alt="" loading="lazy" onerror="this.style.opacity=0">
      <div class="video-play-btn">&#9654;</div>
      <button class="video-watched-btn" title="${v.watched_at ? 'Mark unwatched' : 'Mark watched'}">&#10003;</button>
      ${v.duration ? `<span class="video-duration">${formatDuration(v.duration)}</span>` : ''}
    </div>
    <div class="video-info">
      <div class="video-title">${escHtml(v.title)}</div>
      <div class="video-meta">${videoChannelLinkHtml(v)} · ${timeAgo(v.published_at)}</div>
    </div>`;

  el.querySelector('.video-watched-btn').addEventListener('click', async (e) => {
    e.stopPropagation();
    const watched = el.classList.contains('watched');
    await api(`/videos/${v.id}/watched`, { method: watched ? 'DELETE' : 'POST' });
    el.classList.toggle('watched', !watched);
    e.currentTarget.title = watched ? 'Mark watched' : 'Mark unwatched';
  });

  wireVideoChannelLink(el, v);
  el.addEventListener('click', () => openVideo(v));
  return el;
}

function makeVideoRow(v) {
  const el = document.createElement('div');
  el.className = `video-row${v.watched_at ? ' watched' : ''}`;
  el.dataset.id = v.id;
  el.dataset.ytId = v.yt_id;
  el.innerHTML = `
    <img class="video-row-thumb" src="${v.thumbnail_url || ''}" alt="" loading="lazy" onerror="this.style.opacity=0">
    <div class="video-row-info">
      <div class="video-row-title">${escHtml(v.title)}</div>
      <div class="video-row-meta">${videoChannelLinkHtml(v)} · ${timeAgo(v.published_at)}</div>
    </div>
    ${v.duration ? `<span class="video-row-duration">${formatDuration(v.duration)}</span>` : ''}`;
  wireVideoChannelLink(el, v);
  el.addEventListener('click', () => openVideo(v));
  return el;
}

/* ── video playback ───────────────────────────────────────────────────── */
function openVideo(v) {
  const mode = state.settings.playback_mode || 'embed';
  if (mode === 'youtube') {
    window.open(`https://www.youtube.com/watch?v=${v.yt_id}`, '_blank');
  } else {
    state.watchVideo = v;
    state.canGoBack  = true;
    navigate('watch', v.yt_id);
  }
}

function renderWatchView(v) {
  document.getElementById('watchTitle').textContent = v.title;
  const watchMeta = document.getElementById('watchMeta');
  watchMeta.innerHTML = `${videoChannelLinkHtml(v)} · ${timeAgo(v.published_at)}${v.duration ? ' · ' + formatDuration(v.duration) : ''}`;
  wireVideoChannelLink(watchMeta, v);
  document.getElementById('watchYtLink').href = `https://www.youtube.com/watch?v=${v.yt_id}`;

  stopPlayer();

  const wrap = document.getElementById('watchPlayerWrap');
  wrap.innerHTML = '<div id="ytPlayerEl"></div>';

  const startSecs = v.watch_progress_secs || 0;

  function createPlayer() {
    _ytPlayer = new YT.Player('ytPlayerEl', {
      videoId: v.yt_id,
      width:   '100%',
      height:  '100%',
      playerVars: { autoplay: state.autoplay ? 1 : 0, start: Math.floor(startSecs), rel: 0, modestbranding: 1 },
      events: {
        onReady:       () => startProgressTracking(v),
        onStateChange: (e) => {
          if (e.data === YT.PlayerState.ENDED) {
            saveProgress(v, _ytPlayer.getDuration());
            markWatched(v);
          }
        },
      },
    });
  }

  if (_ytApiReady) {
    createPlayer();
  } else {
    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = function() {
      _ytApiReady = true;
      if (prev) prev();
      createPlayer();
    };
  }
}

function startProgressTracking(v) {
  if (_progressTimer) clearInterval(_progressTimer);
  _progressTimer = setInterval(async () => {
    if (!_ytPlayer || typeof _ytPlayer.getPlayerState !== 'function') return;
    if (_ytPlayer.getPlayerState() !== YT.PlayerState.PLAYING) return;
    const t = _ytPlayer.getCurrentTime();
    const d = _ytPlayer.getDuration();
    await saveProgress(v, t);
    if (d > 0 && t / d >= 0.9) await markWatched(v);
  }, 5000);
}

async function saveProgress(v, secs) {
  if (!secs || secs <= 0) return;
  v.watch_progress_secs = Math.floor(secs);
  await api(`/videos/${v.id}/progress`, {
    method: 'PATCH',
    body: JSON.stringify({ progress_secs: Math.floor(secs) }),
  });
}

async function markWatched(v) {
  if (v.watched_at) return;
  v.watched_at = new Date().toISOString();
  await api(`/videos/${v.id}/watched`, { method: 'POST' });
  const card = document.querySelector(`.video-card[data-id="${v.id}"]`);
  if (card) card.classList.add('watched');
}

function stopPlayer() {
  if (_progressTimer) { clearInterval(_progressTimer); _progressTimer = null; }
  if (_ytPlayer) {
    try {
      const t = _ytPlayer.getCurrentTime();
      if (t > 0 && state.watchVideo) saveProgress(state.watchVideo, t);
      _ytPlayer.destroy();
    } catch (_) {}
    _ytPlayer = null;
  }
}

/* ── render: sidebar ──────────────────────────────────────────────────── */
function renderSidebar() {
  const tree       = document.getElementById('categoryTree');
  const isDragMode = state.view === 'categories';
  tree.innerHTML   = '';

  const byCategory  = {};
  const uncategorised = [];
  for (const ch of state.channels) {
    if (ch.category_id) (byCategory[ch.category_id] = byCategory[ch.category_id] || []).push(ch);
    else uncategorised.push(ch);
  }

  for (const cat of state.categories) {
    const channels = byCategory[cat.id] || [];
    const unread   = channels.reduce((n, c) => n + (c.unwatched_count || 0), 0);

    const item = document.createElement('div');
    item.className = `category-item${cat.collapsed ? '' : ' open'}`;

    const chListAttrs = isDragMode ? ` data-cat-id="${cat.id}"` : '';
    item.innerHTML = `
      <div class="category-header" data-id="${cat.id}">
        <button class="category-chevron">${cat.collapsed ? '+' : '&#8722;'}</button>
        <span class="category-name">${escHtml(cat.name)}</span>
        ${unread > 0 ? `<span class="category-badge has-unread">${unread}</span>` : `<span class="category-badge">${channels.length}</span>`}
      </div>
      <div class="channel-list"${chListAttrs}>
        ${channels.map(ch => channelItemHtml(ch, isDragMode)).join('')}
      </div>`;

    if (!isDragMode) {
      // Chevron: expand/collapse only
      item.querySelector('.category-chevron').addEventListener('click', (e) => {
        e.stopPropagation();
        item.classList.toggle('open');
        const isOpen = item.classList.contains('open');
        e.currentTarget.innerHTML = isOpen ? '&#8722;' : '+';
        toggleCategoryCollapsed(cat.id, !isOpen);
      });
      // Header (excluding chevron): navigate to category
      item.querySelector('.category-header').addEventListener('click', (e) => {
        if (e.target.closest('.category-chevron') || e.target.closest('.channel-item')) return;
        navigate('category', cat.id);
        document.querySelectorAll('.category-header').forEach(h => h.classList.remove('active'));
        item.querySelector('.category-header').classList.add('active');
      });
      item.querySelectorAll('.channel-item').forEach(el => {
        el.addEventListener('click', (e) => { e.stopPropagation(); navigate('channel', parseInt(el.dataset.id)); });
      });
    }

    tree.appendChild(item);
  }

  // Uncategorised
  if (uncategorised.length > 0 || isDragMode) {
    const div = document.createElement('div');
    div.innerHTML = `<div class="uncategorised-header">Uncategorised</div>`;
    // Use a plain div (not .channel-list) so the max-height:0 rule doesn't apply
    const chList = document.createElement('div');
    if (isDragMode) {
      chList.dataset.catId = 'null';
      chList.style.cssText = 'min-height:28px;border-radius:6px;transition:background .15s,outline .15s';
    }
    for (const ch of uncategorised) {
      const el = document.createElement('div');
      el.className  = 'channel-item';
      el.dataset.id = ch.id;
      if (isDragMode) {
        el.innerHTML = `<span class="sidebar-drag-handle">&#8942;&#8942;</span><span class="channel-name">${escHtml(ch.name)}</span>${ch.unwatched_count > 0 ? `<span class="channel-unread">${ch.unwatched_count}</span>` : ''}`;
      } else {
        el.innerHTML = channelThumbHtml(ch) + `<span class="channel-name">${escHtml(ch.name)}</span>${ch.unwatched_count > 0 ? `<span class="channel-unread">${ch.unwatched_count}</span>` : ''}`;
        el.addEventListener('click', () => navigate('channel', ch.id));
      }
      chList.appendChild(el);
    }
    div.appendChild(chList);
    tree.appendChild(div);
  }

  if (isDragMode) wireUpSidebarDrag(tree);
}

function channelItemHtml(ch, draggable = false) {
  const icon = draggable
    ? `<span class="sidebar-drag-handle">&#8942;&#8942;</span>`
    : channelThumbHtml(ch);
  return `
    <div class="channel-item" data-id="${ch.id}">
      ${icon}
      <span class="channel-name">${escHtml(ch.name)}</span>
      ${ch.unwatched_count > 0 ? `<span class="channel-unread">${ch.unwatched_count}</span>` : ''}
    </div>`;
}

function wireUpSidebarDrag(tree) {
  let dragSrc = null;
  const allChLists = tree.querySelectorAll('[data-cat-id]');

  tree.querySelectorAll('.channel-item').forEach(chItem => {
    const handle = chItem.querySelector('.sidebar-drag-handle');
    if (!handle) return;

    handle.addEventListener('mousedown', () => { chItem.draggable = true; });

    chItem.addEventListener('dragstart', (e) => {
      dragSrc = chItem;
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', chItem.dataset.id);
      setTimeout(() => chItem.classList.add('dragging'), 0);
    });

    chItem.addEventListener('dragend', async () => {
      chItem.draggable = false;
      chItem.classList.remove('dragging');
      allChLists.forEach(l => l.classList.remove('drag-over'));
      if (!dragSrc) { dragSrc = null; return; }

      const chId     = parseInt(chItem.dataset.id);
      const newList  = chItem.closest('[data-cat-id]');
      const catIdStr = newList?.dataset.catId;
      const newCatId = (catIdStr && catIdStr !== 'null') ? parseInt(catIdStr) : null;
      dragSrc = null;

      await api(`/channels/${chId}`, { method: 'PUT', body: { category_id: newCatId } });
      const ch = state.channels.find(c => c.id === chId);
      if (ch) ch.category_id = newCatId;
      renderSidebar();
    });
  });

  allChLists.forEach(chList => {
    chList.addEventListener('dragover', (e) => {
      if (!dragSrc) return;
      e.preventDefault();
      allChLists.forEach(l => l.classList.remove('drag-over'));
      chList.classList.add('drag-over');
      const rows = [...chList.querySelectorAll(':scope > .channel-item')].filter(r => r !== dragSrc);
      let before = null;
      for (const row of rows) {
        const rect = row.getBoundingClientRect();
        if (e.clientY < rect.top + rect.height / 2) { before = row; break; }
      }
      chList.insertBefore(dragSrc, before);
    });
    chList.addEventListener('dragleave', (e) => { if (!chList.contains(e.relatedTarget)) chList.classList.remove('drag-over'); });
    chList.addEventListener('drop', (e) => { e.preventDefault(); chList.classList.remove('drag-over'); });
  });

  // Category headers are also valid drop targets (handles collapsed categories)
  tree.querySelectorAll('.category-header[data-id]').forEach(header => {
    header.addEventListener('dragover', (e) => {
      if (!dragSrc) return;
      e.preventDefault();
      allChLists.forEach(l => l.classList.remove('drag-over'));
      header.classList.add('drag-over');
    });
    header.addEventListener('dragleave', () => header.classList.remove('drag-over'));
    header.addEventListener('drop', async (e) => {
      if (!dragSrc) return;
      e.preventDefault();
      header.classList.remove('drag-over');
      const chId  = parseInt(dragSrc.dataset.id);
      const catId = parseInt(header.dataset.id);
      // Null out dragSrc so the natural dragend that follows skips the API call
      dragSrc = null;
      await api(`/channels/${chId}`, { method: 'PUT', body: { category_id: catId } });
      const ch = state.channels.find(c => c.id === chId);
      if (ch) ch.category_id = catId;
      renderSidebar();
    });
  });
}

function channelThumbHtml(ch) {
  return ch.thumbnail_url
    ? `<img class="channel-thumb" src="/api/channels/${ch.id}/thumb" alt="" onerror="this.style.display='none'">`
    : `<div class="channel-thumb" style="background:var(--surface-3)"></div>`;
}

async function toggleCategoryCollapsed(id, collapsed) {
  await api(`/categories/${id}`, { method: 'PUT', body: { collapsed: collapsed ? 1 : 0 } });
}

function updateSidebarCounts() {
  loadMeta().then(renderSidebar);
}

/* ── render: settings ─────────────────────────────────────────────────── */
function renderSettings() {
  const panel = document.getElementById('settingsPanel');
  const s     = state.settings;

  panel.innerHTML = `
    <h1>Settings</h1>

    <div class="settings-section">
      <h2>Playback</h2>
      <div class="setting-row" style="flex-direction:column;align-items:flex-start;gap:10px">
        <div>
          <div class="setting-label">Video playback</div>
          <div class="setting-desc">How videos open when you click them</div>
        </div>
        <div class="playback-options">
          <button class="playback-opt${s.playback_mode !== 'youtube' ? ' active' : ''}" data-mode="embed">
            <span class="playback-opt-title">Embedded player</span>
            <span class="playback-opt-desc">Tracks progress · auto-marks watched at 90% · resumes where you left off</span>
          </button>
          <button class="playback-opt${s.playback_mode === 'youtube' ? ' active' : ''}" data-mode="youtube">
            <span class="playback-opt-title">Open in YouTube</span>
            <span class="playback-opt-desc">Opens in a new tab · no progress tracking</span>
          </button>
        </div>
      </div>
    </div>

    <div class="settings-section">
      <h2>Feed</h2>
      <div class="setting-row">
        <div>
          <div class="setting-label">Poll interval</div>
          <div class="setting-desc">How often to check for new videos</div>
        </div>
        <div class="setting-control poll-interval-wrap">
          ${numInput('pollHours',   Math.floor((s.poll_interval || 3600) / 3600),        0, 23)} <span class="poll-unit">h</span>
          ${numInput('pollMinutes', Math.floor(((s.poll_interval || 3600) % 3600) / 60), 0, 59)} <span class="poll-unit">m</span>
        </div>
      </div>
      <div class="setting-row">
        <div>
          <div class="setting-label">Show Shorts</div>
          <div class="setting-desc">Include YouTube Shorts in the feed</div>
        </div>
        <div class="setting-control">
          ${toggleHtml('show_shorts', s.show_shorts !== 'false')}
        </div>
      </div>
      <div class="setting-row">
        <div>
          <div class="setting-label">Auto-mark watched</div>
          <div class="setting-desc">Mark videos as watched automatically when opened</div>
        </div>
        <div class="setting-control">
          ${toggleHtml('auto_mark_watched', s.auto_mark_watched === 'true')}
        </div>
      </div>
    </div>

    <div class="settings-section">
      <h2>Search</h2>
      <div class="setting-row">
        <div>
          <div class="setting-label">Search YouTube</div>
          <div class="setting-desc">Include YouTube results in the sidebar search (uses yt-dlp)</div>
        </div>
        <div class="setting-control">
          ${toggleHtml('search_youtube', s.search_youtube !== 'false')}
        </div>
      </div>
    </div>

    <div class="settings-section">
      <h2>iOS Shortcut</h2>
      <div class="setting-row" style="flex-direction:column;align-items:flex-start;gap:10px">
        <div class="setting-label">Add channels from iPhone share sheet</div>
        <div class="shortcut-qr">
          <img src="/api/shortcut/qr" alt="QR Code" width="160" height="160">
          <div class="setting-desc" style="margin-top:6px">Scan with your iPhone to open the setup page</div>
        </div>
        <a class="btn-setup" href="/api/shortcut/setup" target="_blank">Open Setup Page</a>
        <div>
          <div class="setting-desc">Your unique token:</div>
          <div class="token-display" id="tokenDisplay">loading…</div>
          <button class="btn-regen" id="btnRegen">Regenerate token</button>
        </div>
      </div>
    </div>`;

  // Load token
  fetch(`${API}/settings/token`).then(r => r.json()).then(d => {
    const el = document.getElementById('tokenDisplay');
    if (el) el.textContent = d.token;
  });

  // Regen token
  document.getElementById('btnRegen')?.addEventListener('click', async () => {
    if (!confirm('Regenerate token? Your existing iOS shortcut will stop working until you update it.')) return;
    const d = await api('/settings/regenerate-token', { method: 'POST' });
    document.getElementById('tokenDisplay').textContent = d.token;
  });

  const flashSaved = () => {
    showToast('settings-saved', { icon: '✓', title: 'Settings saved' });
    dismissToast('settings-saved', 1500);
  };

  // Save on change for inputs/selects/checkboxes
  panel.querySelectorAll('[data-key]').forEach(el => {
    el.addEventListener('change', () => {
      const key   = el.dataset.key;
      const value = el.type === 'checkbox' ? String(el.checked) : el.value;
      state.settings[key] = value;
      api('/settings', { method: 'PUT', body: { [key]: value } });
      flashSaved();
    });
  });

  // Poll interval — convert h+m to seconds on save
  const savePollInterval = () => {
    const h = parseInt(document.getElementById('pollHours').value)   || 0;
    const m = parseInt(document.getElementById('pollMinutes').value) || 0;
    const secs = Math.max(300, h * 3600 + m * 60);
    state.settings.poll_interval = String(secs);
    api('/settings', { method: 'PUT', body: { poll_interval: String(secs) } });
    flashSaved();
  };
  document.getElementById('pollHours')?.addEventListener('change', savePollInterval);
  document.getElementById('pollMinutes')?.addEventListener('change', savePollInterval);

  panel.querySelectorAll('.num-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const input = document.getElementById(btn.dataset.target);
      const val   = parseInt(input.value) + parseInt(btn.dataset.delta);
      input.value = Math.min(parseInt(input.max), Math.max(parseInt(input.min), val));
      input.dispatchEvent(new Event('change'));
    });
  });

  // Playback mode buttons
  panel.querySelectorAll('.playback-opt').forEach(btn => {
    btn.addEventListener('click', () => {
      const mode = btn.dataset.mode;
      state.settings.playback_mode = mode;
      api('/settings', { method: 'PUT', body: { playback_mode: mode } });
      panel.querySelectorAll('.playback-opt').forEach(b => b.classList.toggle('active', b.dataset.mode === mode));
      flashSaved();
    });
  });
}

function numInput(id, value, min, max) {
  return `<div class="num-input-wrap">
    <input type="number" id="${id}" value="${value}" min="${min}" max="${max}">
    <div class="num-input-btns">
      <button class="num-btn" data-target="${id}" data-delta="1">▲</button>
      <button class="num-btn" data-target="${id}" data-delta="-1">▼</button>
    </div>
  </div>`;
}

function toggleHtml(key, checked) {
  return `<label class="toggle">
    <input type="checkbox" data-key="${key}" ${checked ? 'checked' : ''}>
    <div class="toggle-track"></div>
  </label>`;
}

/* ── render: categories management ───────────────────────────────────── */
function renderCategoriesPage() {
  const panel = document.getElementById('categoriesPanel');

  const listHtml = state.categories.length
    ? state.categories.map(cat => {
        const count = state.channels.filter(c => c.category_id === cat.id).length;
        return `
          <div class="cat-row" data-id="${cat.id}">
            <span class="cat-drag-handle" title="Drag to reorder">&#8942;&#8942;</span>
            <span class="cat-name" contenteditable="false">${escHtml(cat.name)}</span>
            <span class="cat-count">${count} channel${count !== 1 ? 's' : ''}</span>
            <div class="cat-actions">
              <button class="cat-btn-rename" title="Rename">&#9998;</button>
              <button class="cat-btn-delete" title="Delete">&#10005;</button>
            </div>
          </div>`;
      }).join('')
    : '<div class="cat-empty">No categories yet. Add one above.</div>';

  panel.innerHTML = `
    <h1>Categories</h1>
    <div class="settings-section">
      <div class="cat-add-row">
        <input class="cat-add-input" id="catAddInput" type="text" placeholder="New category name…" maxlength="80">
        <button class="btn btn-primary" id="catAddBtn">Add</button>
      </div>
      <div class="cat-list" id="catList">${listHtml}</div>
    </div>`;

  const addInput = panel.querySelector('#catAddInput');
  panel.querySelector('#catAddBtn').addEventListener('click', async () => {
    const name = addInput.value.trim();
    if (!name) return;
    await api('/categories', { method: 'POST', body: { name } });
    addInput.value = '';
    await reloadCategoriesPage();
  });
  addInput.addEventListener('keydown', e => { if (e.key === 'Enter') panel.querySelector('#catAddBtn').click(); });

  panel.querySelectorAll('.cat-row').forEach(row => {
    const id     = parseInt(row.dataset.id);
    const nameEl = row.querySelector('.cat-name');
    const renBtn = row.querySelector('.cat-btn-rename');

    const startEditing = () => {
      nameEl.contentEditable = 'true';
      nameEl.focus();
      const range = document.createRange();
      range.selectNodeContents(nameEl);
      window.getSelection().removeAllRanges();
      window.getSelection().addRange(range);
      renBtn.textContent = '✓';
    };
    const saveEdit = async () => {
      const newName = nameEl.textContent.trim();
      nameEl.contentEditable = 'false';
      renBtn.innerHTML = '&#9998;';
      if (!newName) return reloadCategoriesPage();
      await api(`/categories/${id}`, { method: 'PUT', body: { name: newName } });
      await reloadCategoriesPage();
    };

    renBtn.addEventListener('click', () => nameEl.contentEditable === 'true' ? saveEdit() : startEditing());
    nameEl.addEventListener('keydown', e => {
      if (e.key === 'Enter')  { e.preventDefault(); saveEdit(); }
      if (e.key === 'Escape') { nameEl.contentEditable = 'false'; renBtn.innerHTML = '&#9998;'; reloadCategoriesPage(); }
    });
    row.querySelector('.cat-btn-delete').addEventListener('click', async () => {
      const name  = nameEl.textContent.trim();
      const count = state.channels.filter(c => c.category_id === id).length;
      const msg   = count ? `Delete "${name}"? Its ${count} channel${count !== 1 ? 's' : ''} will become uncategorised.` : `Delete "${name}"?`;
      if (!confirm(msg)) return;
      await api(`/categories/${id}`, { method: 'DELETE' });
      await reloadCategoriesPage();
    });
  });

  wireUpCatDrag(panel.querySelector('#catList'));
}

function wireUpCatDrag(catList) {
  let dragSrc = null;

  catList.querySelectorAll('.cat-row').forEach(row => {
    const handle = row.querySelector('.cat-drag-handle');

    handle.addEventListener('mousedown', () => { row.draggable = true; });
    row.addEventListener('dragend', async () => {
      row.draggable = false;
      row.classList.remove('dragging');
      catList.querySelectorAll('.cat-row').forEach(r => r.classList.remove('drag-over'));
      dragSrc = null;
      const order = [...catList.querySelectorAll('.cat-row')].map((r, i) => ({
        id: parseInt(r.dataset.id), position: i,
      }));
      await api('/categories/reorder', { method: 'PUT', body: { order } });
      await loadMeta();
      renderSidebar();
    });

    row.addEventListener('dragstart', (e) => {
      dragSrc = row;
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', row.dataset.id);
      setTimeout(() => row.classList.add('dragging'), 0);
    });

    row.addEventListener('dragover', (e) => {
      e.preventDefault();
      if (!dragSrc || row === dragSrc) return;
      catList.querySelectorAll('.cat-row').forEach(r => r.classList.remove('drag-over'));
      row.classList.add('drag-over');
      const rect = row.getBoundingClientRect();
      catList.insertBefore(dragSrc, e.clientY < rect.top + rect.height / 2 ? row : row.nextSibling);
    });

    row.addEventListener('dragleave', () => row.classList.remove('drag-over'));
    row.addEventListener('drop',      (e) => { e.preventDefault(); row.classList.remove('drag-over'); });
  });
}

async function reloadCategoriesPage() {
  await loadMeta();
  renderSidebar();
  if (state.view === 'categories') renderCategoriesPage();
}

/* ── add channel modal ────────────────────────────────────────────────── */
function openAddChannelModal() {
  const cats = state.categories.map(c => `<option value="${c.id}">${escHtml(c.name)}</option>`).join('');

  showModal('Add Channel', `
    <div class="modal-tabs">
      <button class="modal-tab active" data-tab="manual">Manual</button>
      <button class="modal-tab" data-tab="search">Search</button>
      <button class="modal-tab" data-tab="csv">Import CSV</button>
    </div>

    <div data-panel="manual">
      <div class="modal-body">
        <div class="form-field">
          <label>YouTube Channel URL or ID</label>
          <input type="text" id="addUrl" placeholder="https://youtube.com/@channel or channel ID">
        </div>
        <div class="form-field">
          <label>Category (optional)</label>
          <select id="addCategory"><option value="">None</option>${cats}</select>
        </div>
      </div>
      <div class="modal-actions">
        <button class="btn-secondary" onclick="closeModal()">Cancel</button>
        <button class="btn-primary" id="btnConfirmAdd">Add Channel</button>
      </div>
    </div>

    <div data-panel="search" class="hidden">
      <div class="modal-body">
        <div class="form-field">
          <label>Search YouTube</label>
          <input type="text" id="modalSearchInput" placeholder="Channel name…">
        </div>
        <div id="modalSearchResults" style="max-height:220px;overflow-y:auto;margin-top:4px"></div>
        <div class="form-field">
          <label>Category (optional)</label>
          <select id="searchAddCategory"><option value="">None</option>${cats}</select>
        </div>
      </div>
      <div class="modal-actions">
        <button class="btn-secondary" onclick="closeModal()">Cancel</button>
      </div>
    </div>

    <div data-panel="csv" class="hidden">
      <div class="modal-body">
        <p style="font-size:12px;color:var(--text-muted);line-height:1.6">
          Supports <strong>Google Takeout</strong> exports directly (the <code>subscriptions.csv</code> file inside your YouTube data zip).<br><br>
          Custom CSV columns: <code>name</code>, <code>channel_id</code> (or <code>channel_url</code>), <code>category</code> (optional)
        </p>
        <div class="form-field">
          <label>CSV File</label>
          <input type="file" id="csvFile" accept=".csv">
        </div>
      </div>
      <div class="modal-actions">
        <button class="btn-secondary" onclick="closeModal()">Cancel</button>
        <button class="btn-primary" id="btnImportCsv">Import</button>
      </div>
    </div>
  `);

  // Tab switching
  document.querySelectorAll('.modal-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.modal-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      document.querySelectorAll('[data-panel]').forEach(p => p.classList.add('hidden'));
      document.querySelector(`[data-panel="${tab.dataset.tab}"]`)?.classList.remove('hidden');
    });
  });

  // Manual add
  document.getElementById('btnConfirmAdd')?.addEventListener('click', async () => {
    const url = document.getElementById('addUrl').value.trim();
    const cat = document.getElementById('addCategory').value;
    if (!url) return;
    try {
      await api('/channels/add', { method: 'POST', body: { url, category_id: cat || null } });
      closeModal();
      await loadMeta();
      renderSidebar();
    } catch (e) {
      alert('Error: ' + e.message);
    }
  });

  // CSV import
  document.getElementById('btnImportCsv')?.addEventListener('click', async () => {
    const file = document.getElementById('csvFile').files[0];
    if (!file) return;
    const form = new FormData();
    form.append('file', file);
    const res = await fetch(`${API}/channels/import`, { method: 'POST', body: form });
    const data = await res.json();
    alert(`Imported ${data.imported}, skipped ${data.skipped}.${data.errors.length ? '\n\nErrors:\n' + data.errors.join('\n') : ''}`);
    closeModal();
    await loadMeta();
    renderSidebar();
  });

  // Search tab
  let searchTimeout;
  document.getElementById('modalSearchInput')?.addEventListener('input', (e) => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => runModalSearch(e.target.value), 400);
  });
}

async function runModalSearch(q) {
  const container = document.getElementById('modalSearchResults');
  if (!q || q.length < 2) { container.innerHTML = ''; return; }

  container.innerHTML = '<div class="search-yt-loading"><div class="spinner"></div> Searching YouTube…</div>';

  try {
    const results = await api(`/search/youtube?q=${encodeURIComponent(q)}`);
    if (!Array.isArray(results)) { container.innerHTML = '<p style="color:var(--text-muted);font-size:12px;padding:8px">Search disabled in settings.</p>'; return; }

    // Deduplicate by channel
    const seen = new Set();
    const channels = results.filter(r => {
      if (!r.channel_id || seen.has(r.channel_id)) return false;
      seen.add(r.channel_id);
      return true;
    });

    container.innerHTML = channels.map(c => `
      <div class="search-result-item" style="border-radius:6px;background:var(--surface-2);margin-bottom:4px">
        <img class="search-result-thumb" src="https://yt3.ggpht.com/ytc/${c.channel_id}" onerror="this.src=''" alt="">
        <div class="search-result-info">
          <div class="search-result-name">${escHtml(c.channel)}</div>
        </div>
        <button class="search-add-btn" data-channel-id="${c.channel_id}" data-channel-name="${escHtml(c.channel)}">+</button>
      </div>`).join('');

    container.querySelectorAll('.search-add-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const cat = document.getElementById('searchAddCategory').value;
        const chId = btn.dataset.channelId;
        await api('/channels', { method: 'POST', body: {
          yt_channel_id: chId,
          name: btn.dataset.channelName,
          rss_url: `https://www.youtube.com/feeds/videos.xml?channel_id=${chId}`,
          category_id: cat || null,
        }});
        btn.textContent = '✓';
        btn.disabled = true;
        await loadMeta();
        renderSidebar();
      });
    });
  } catch (e) {
    container.innerHTML = `<p style="color:var(--text-muted);font-size:12px;padding:8px">Error: ${e.message}</p>`;
  }
}

/* ── sidebar search ───────────────────────────────────────────────────── */
let searchTimeout;

function setupSearch() {
  const input      = document.getElementById('searchInput');
  const sidebar    = document.getElementById('sidebar');
  const results    = document.getElementById('searchResults');
  const catTree    = document.getElementById('categoryTree');
  const clearBtn   = document.getElementById('searchClear');
  const brand      = document.getElementById('brand');

  let blurTimer;

  function collapseSearch() {
    sidebar.classList.remove('searching');
    results.classList.add('hidden');
    catTree.classList.remove('hidden');
  }

  function clearSearch() {
    input.value = '';
    document.getElementById('searchLocal').innerHTML    = '';
    document.getElementById('searchYoutube').innerHTML  = '';
    document.getElementById('searchDetected').innerHTML = '';
    document.getElementById('searchDivider').classList.add('hidden');
    document.getElementById('searchDetected').classList.add('hidden');
    collapseSearch();
    input.blur();
  }

  input.addEventListener('focus', () => {
    clearTimeout(blurTimer);
    sidebar.classList.add('searching');
    results.classList.remove('hidden');
    catTree.classList.add('hidden');
    // Re-run search if box has text (results were hidden while collapsed)
    if (input.value.trim()) {
      clearTimeout(searchTimeout);
      searchTimeout = setTimeout(() => runSidebarSearch(input.value), 0);
    }
  });

  input.addEventListener('blur', () => {
    blurTimer = setTimeout(collapseSearch, 150);
  });

  // Prevent blur-collapse when the user clicks within the results panel
  results.addEventListener('mousedown', () => clearTimeout(blurTimer));

  clearBtn.addEventListener('click', clearSearch);

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') clearSearch();
  });

  input.addEventListener('input', () => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => runSidebarSearch(input.value), 300);
  });
}

async function runSidebarSearch(q) {
  const localEl    = document.getElementById('searchLocal');
  const ytEl       = document.getElementById('searchYoutube');
  const detectedEl = document.getElementById('searchDetected');
  const divider    = document.getElementById('searchDivider');

  if (!q || q.trim().length < 1) {
    localEl.innerHTML = ytEl.innerHTML = detectedEl.innerHTML = '';
    divider.classList.add('hidden');
    detectedEl.classList.add('hidden');
    return;
  }

  // 1. Local results (instant)
  const local = await api(`/search?q=${encodeURIComponent(q)}`);
  renderLocalResults(local.local, localEl);

  // 2. Detect if it looks like a URL / channel
  runDetection(q, detectedEl);

  // 3. YouTube results (async)
  const ytEnabled = state.settings.search_youtube !== 'false';
  if (ytEnabled) {
    divider.classList.remove('hidden');
    ytEl.innerHTML = '<div class="search-yt-loading"><div class="spinner"></div> Searching YouTube…</div>';
    try {
      const ytResults = await api(`/search/youtube?q=${encodeURIComponent(q)}`);
      if (Array.isArray(ytResults)) {
        renderYoutubeResults(ytResults, ytEl);
      } else {
        ytEl.innerHTML = '';
        divider.classList.add('hidden');
      }
    } catch {
      ytEl.innerHTML = '';
    }
  }
}

function renderLocalResults(local, container) {
  const { channels, videos } = local;
  if (!channels.length && !videos.length) { container.innerHTML = ''; return; }

  let html = '';
  if (channels.length) {
    html += '<div class="search-section-title">Channels</div>';
    html += channels.map(c => `
      <div class="search-result-item" data-channel-id="${c.id}">
        ${c.thumbnail_url ? `<img class="search-result-thumb" src="/api/channels/${c.id}/thumb" alt="">` : '<div class="search-result-thumb"></div>'}
        <div class="search-result-info">
          <div class="search-result-name">${escHtml(c.name)}</div>
        </div>
      </div>`).join('');
  }
  if (videos.length) {
    html += '<div class="search-section-title">Videos</div>';
    html += videos.map(v => `
      <div class="search-result-item" data-video-id="${v.id}">
        <img class="search-result-thumb video" src="${v.thumbnail_url || ''}" alt="" onerror="this.style.opacity=0">
        <div class="search-result-info">
          <div class="search-result-name">${escHtml(v.title)}</div>
          <div class="search-result-sub">${escHtml(v.channel_name)}</div>
        </div>
      </div>`).join('');
  }

  container.innerHTML = html;

  container.querySelectorAll('[data-channel-id]').forEach(el => {
    el.addEventListener('click', () => {
      document.getElementById('searchClear').click();
      navigate('channel', parseInt(el.dataset.channelId));
    });
  });

  container.querySelectorAll('[data-video-id]').forEach(el => {
    el.addEventListener('click', async () => {
      const vid = state.videos.find(v => v.id === parseInt(el.dataset.videoId));
      if (vid) openVideo(vid);
    });
  });
}

function renderYoutubeResults(results, container) {
  if (!results.length) { container.innerHTML = ''; return; }

  const seen = new Set();
  const dedupedChannels = results.filter(r => {
    if (!r.channel_id || seen.has(r.channel_id)) return false;
    seen.add(r.channel_id);
    return true;
  });

  let html = '<div class="search-section-title">YouTube</div>';
  html += dedupedChannels.slice(0, 5).map(r => `
    <div class="search-result-item">
      <img class="search-result-thumb" src="${r.thumbnail}" alt="" onerror="this.style.opacity=0">
      <div class="search-result-info">
        <div class="search-result-name">${escHtml(r.channel)}</div>
        <div class="search-result-sub">YouTube channel</div>
      </div>
      <button class="search-add-btn" data-channel-id="${r.channel_id}" data-channel-name="${escHtml(r.channel)}" title="Add channel">+</button>
    </div>`).join('');

  container.innerHTML = html;

  container.querySelectorAll('.search-add-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const chId = btn.dataset.channelId;
      await api('/channels', { method: 'POST', body: {
        yt_channel_id: chId,
        name: btn.dataset.channelName,
        rss_url: `https://www.youtube.com/feeds/videos.xml?channel_id=${chId}`,
      }});
      btn.textContent = '✓';
      btn.disabled = true;
      await loadMeta();
      renderSidebar();
    });
  });
}

async function runDetection(input, container) {
  const trimmed = input.trim();
  const isUrl = /^https?:\/\//.test(trimmed);
  if (!isUrl) { container.innerHTML = ''; container.classList.add('hidden'); return; }

  container.classList.remove('hidden');
  container.innerHTML = '<div class="search-yt-loading"><div class="spinner"></div> Resolving…</div>';

  try {
    const result = await api('/channels/resolve', { method: 'POST', body: { input: trimmed } });
    if (!result.detected) { container.innerHTML = ''; container.classList.add('hidden'); return; }

    container.innerHTML = `
      <div class="search-section-title">Detected channel</div>
      <div class="search-detected-item">
        <div class="search-result-info">
          <div class="search-result-name">${escHtml(result.name || result.yt_channel_id)}</div>
          <div class="search-result-sub">${escHtml(result.yt_channel_id || '')}</div>
        </div>
        <button class="search-add-btn" id="btnAddDetected" title="Add channel">+</button>
      </div>`;

    document.getElementById('btnAddDetected')?.addEventListener('click', async () => {
      await api('/channels', { method: 'POST', body: {
        yt_channel_id: result.yt_channel_id,
        name: result.name || result.yt_channel_id,
        rss_url: result.rss_url,
      }});
      document.getElementById('btnAddDetected').textContent = '✓';
      await loadMeta();
      renderSidebar();
    });
  } catch {
    container.innerHTML = '';
    container.classList.add('hidden');
  }
}

/* ── modal helpers ────────────────────────────────────────────────────── */
function showModal(title, bodyHtml) {
  const overlay = document.getElementById('modalOverlay');
  const modal   = document.getElementById('modal');
  modal.innerHTML = `<h2>${escHtml(title)}</h2>${bodyHtml}`;
  overlay.classList.remove('hidden');
}

function closeModal() {
  document.getElementById('modalOverlay').classList.add('hidden');
  document.getElementById('modal').innerHTML = '';
}

/* ── events ───────────────────────────────────────────────────────────── */
function setupEvents() {
  // Nav items
  document.querySelectorAll('[data-view]').forEach(el => {
    el.addEventListener('click', (e) => {
      e.preventDefault();
      navigate(el.dataset.view);
    });
  });

  // Category tree collapse toggle
  const catToggleBtn = document.getElementById('btnToggleCategories');
  const catTree      = document.getElementById('categoryTree');
  const catExpanded  = localStorage.getItem('catTreeExpanded') !== 'false';
  if (!catExpanded) {
    catTree.classList.add('hidden');
    catToggleBtn.innerHTML = '+';
  }
  catToggleBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    const open = catTree.classList.toggle('hidden');
    catToggleBtn.innerHTML = open ? '+' : '&#8722;';
    localStorage.setItem('catTreeExpanded', open ? 'false' : 'true');
  });

  // Filter buttons
  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.filter = btn.dataset.filter;
      localStorage.setItem('filter', state.filter);
      loadVideos(true);
    });
  });

  // Sort
  document.getElementById('sortSelect').addEventListener('change', (e) => {
    state.sort = e.target.value;
    localStorage.setItem('sort', state.sort);
    loadVideos(true);
  });

  // Duration
  document.getElementById('durationSelect').addEventListener('change', (e) => {
    state.duration = e.target.value;
    loadVideos(true);
  });

  // Layout toggle
  document.querySelectorAll('.layout-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.layout-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.layout = btn.dataset.layout;
      localStorage.setItem('layout', state.layout);
      renderVideos(true);
    });
  });

  // Load more
  document.getElementById('btnLoadMore').addEventListener('click', () => loadVideos(false));

  // Refresh feeds — fires and forgets; progress comes back via SSE
  document.getElementById('btnRefresh').addEventListener('click', () => {
    api('/channels/refresh', { method: 'POST' });
  });

  // Feed errors button
  document.getElementById('btnFeedErrors').addEventListener('click', openFeedErrorsModal);

  // Add channel
  document.getElementById('btnAddChannel').addEventListener('click', openAddChannelModal);

  // Modal overlay close
  document.getElementById('modalOverlay').addEventListener('click', (e) => {
    if (e.target === e.currentTarget) closeModal();
  });

  // Watch page back button
  document.getElementById('watchBack').addEventListener('click', () => {
    if (state.canGoBack) {
      state.canGoBack = false;
      history.back();
    } else {
      navigate('home');
    }
  });

  // Sidebar search
  setupSearch();

  // Autoplay toggle
  const btnAutoplay = document.getElementById('btnAutoplay');
  btnAutoplay.classList.toggle('active', state.autoplay);
  btnAutoplay.addEventListener('click', () => {
    state.autoplay = !state.autoplay;
    localStorage.setItem('autoplay', state.autoplay);
    btnAutoplay.classList.toggle('active', state.autoplay);
  });

  // Apply saved layout/filter/sort to UI — clear HTML defaults first
  document.querySelectorAll('.layout-btn').forEach(b => b.classList.remove('active'));
  document.querySelector(`[data-layout="${state.layout}"]`)?.classList.add('active');
  document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
  document.querySelector(`[data-filter="${state.filter}"]`)?.classList.add('active');
  document.getElementById('sortSelect').value = state.sort;
}

/* ── utils ────────────────────────────────────────────────────────────── */
function escHtml(str) {
  return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/* ── thumbnail sync (SSE) ────────────────────────────────────────────── */
function connectThumbStream() {
  const es = new EventSource('/api/channels/thumb-events');
  let remaining = 0;

  es.onmessage = (e) => {
    const msg = JSON.parse(e.data);

    if (msg.type === 'start') {
      remaining = msg.remaining;
      showToast('thumb', { icon: '◎', title: 'Channel icons', message: `${remaining} remaining` });
    }

    if (msg.type === 'fetched') {
      const item = document.querySelector(`.channel-item[data-id="${msg.channel_id}"]`);
      if (item) {
        const thumb = item.querySelector('.channel-thumb');
        if (thumb?.tagName === 'DIV') {
          const img = document.createElement('img');
          img.className = 'channel-thumb';
          img.alt = '';
          img.onerror = () => { img.style.display = 'none'; };
          img.src = `/api/channels/${msg.channel_id}/thumb`;
          thumb.replaceWith(img);
        }
      }
      const ch = state.channels.find(c => c.id === msg.channel_id);
      if (ch) ch.thumbnail_url = msg.url;
      remaining = Math.max(0, remaining - 1);
      showToast('thumb', { message: `${remaining} remaining` });
    }

    if (msg.type === 'done') {
      if (msg.remaining === 0) {
        showToast('thumb', { message: 'All icons loaded' });
        dismissToast('thumb', 1500);
      } else {
        showToast('thumb', { message: `${msg.remaining} remaining` });
      }
    }
  };

  es.onerror = () => {}; // SSE auto-reconnects
}

/* ── Toast system ────────────────────────────────────────────────────── */
const _toastTimers = {};

function showToast(id, { icon, title, message, progress } = {}) {
  let toast = document.getElementById(`toast-${id}`);
  if (!toast) {
    toast = document.createElement('div');
    toast.className = 'toast';
    toast.id = `toast-${id}`;
    toast.innerHTML = `
      <div class="toast-header">
        <button class="toast-close" title="Hide">&times;</button>
        <span class="toast-icon">${icon ?? ''}</span>
        <span class="toast-title">${title ?? ''}</span>
      </div>
      <div class="toast-message"></div>
      <div class="toast-bar"><div class="toast-bar-fill"></div></div>
    `;
    // Hiding only removes the toast — the underlying background job keeps running
    toast.querySelector('.toast-close').addEventListener('click', () => {
      clearTimeout(_toastTimers[id]);
      removeToast(id);
    });
    document.getElementById('toastContainer').appendChild(toast);
  }
  if (message !== undefined) toast.querySelector('.toast-message').textContent = message;
  if (progress !== undefined) {
    toast.querySelector('.toast-bar-fill').style.width = `${Math.round(progress * 100)}%`;
    toast.querySelector('.toast-bar').style.display = '';
  } else {
    toast.querySelector('.toast-bar').style.display = 'none';
  }
  toast.classList.remove('toast-hiding');
  clearTimeout(_toastTimers[id]);
}

function removeToast(id) {
  const toast = document.getElementById(`toast-${id}`);
  if (!toast) return;
  toast.classList.add('toast-hiding');
  setTimeout(() => toast.remove(), 280);
}

function dismissToast(id, delay = 1500) {
  clearTimeout(_toastTimers[id]);
  _toastTimers[id] = setTimeout(() => removeToast(id), delay);
}

/* ── poll progress (SSE) ──────────────────────────────────────────────── */
function connectPollStream() {
  const es = new EventSource('/api/channels/poll-events');

  es.onmessage = (e) => {
    const msg = JSON.parse(e.data);

    if (msg.type === 'start') {
      showToast('poll', { icon: '↻', title: 'Refreshing feeds', message: `0 / ${msg.total}`, progress: 0 });
    }

    if (msg.type === 'progress') {
      const pct = msg.total > 0 ? msg.done / msg.total : 0;
      showToast('poll', { message: `${msg.done} / ${msg.total}`, progress: pct });
    }

    if (msg.type === 'complete') {
      showToast('poll', { message: `${msg.total} feeds refreshed`, progress: 1 });
      dismissToast('poll', 1500);
      setTimeout(() => {
        refreshSidebarCounts();
        if (state.view === 'home' || state.view === 'category') {
          loadVideos(true);
        }
      }, 800);
      if (msg.errors) setFeedErrors(msg.errors);
    }
  };

  es.onerror = () => {
    // SSE auto-reconnects; nothing to do
  };
}


async function refreshSidebarCounts() {
  const channels = await api('/channels');
  state.channels = channels;

  // Update channel badge numbers and thumbnails in-place (categories stay open)
  for (const ch of channels) {
    const item = document.querySelector(`.channel-item[data-id="${ch.id}"]`);
    if (!item) continue;

    // Swap in thumbnail once it arrives
    if (ch.thumbnail_url) {
      const thumb = item.querySelector('.channel-thumb');
      if (thumb) {
        if (thumb.tagName === 'DIV') {
          const img = document.createElement('img');
          img.className = 'channel-thumb';
          img.alt = '';
          img.src = `/api/channels/${ch.id}/thumb`;
          thumb.replaceWith(img);
        } else {
          thumb.src = `/api/channels/${ch.id}/thumb`;
        }
      }
    }

    let badge = item.querySelector('.channel-unread');
    if (ch.unwatched_count > 0) {
      if (!badge) {
        badge = document.createElement('span');
        badge.className = 'channel-unread';
        item.appendChild(badge);
      }
      badge.textContent = ch.unwatched_count;
    } else {
      badge?.remove();
    }
  }

  // Update category badges
  for (const cat of state.categories) {
    const catChannels = channels.filter(c => c.category_id === cat.id);
    const unread = catChannels.reduce((n, c) => n + (c.unwatched_count || 0), 0);
    const header = document.querySelector(`.category-header[data-id="${cat.id}"]`);
    if (!header) continue;
    const badge = header.querySelector('.category-badge');
    if (badge) {
      badge.textContent = unread > 0 ? unread : catChannels.length;
      badge.classList.toggle('has-unread', unread > 0);
    }
  }
}

/* ── feed errors ─────────────────────────────────────────────────────── */
let _feedErrors = [];

function setFeedErrors(errors) {
  _feedErrors = errors || [];
  const btn   = document.getElementById('btnFeedErrors');
  const count = document.getElementById('feedErrorCount');
  if (_feedErrors.length > 0) {
    count.textContent = _feedErrors.length;
    btn.classList.remove('hidden');
  } else {
    btn.classList.add('hidden');
  }
}

function openFeedErrorsModal() {
  if (_feedErrors.length === 0) return;

  const rows = _feedErrors.map(e => `
    <div class="feed-error-row" data-id="${e.id}">
      <div class="feed-error-info">
        <div class="feed-error-name">${escHtml(e.name)}</div>
        <div class="feed-error-msg">${escHtml(e.error)}</div>
        <div class="feed-relink-wrap hidden">
          <input class="feed-relink-input" type="text" placeholder="Paste new YouTube URL or @handle…">
          <button class="btn-primary btn-relink-confirm" data-id="${e.id}">Update</button>
          <button class="btn-secondary btn-relink-cancel">Cancel</button>
        </div>
      </div>
      <div class="feed-error-actions">
        <button class="btn-secondary btn-retry-feed" data-id="${e.id}" data-name="${escHtml(e.name)}">Retry</button>
        <button class="btn-secondary btn-fix-feed" data-id="${e.id}">Fix URL</button>
        <button class="btn-danger btn-delete-feed" data-id="${e.id}" data-name="${escHtml(e.name)}">Delete</button>
      </div>
    </div>`).join('');

  showModal('Feed Errors', `
    <p style="font-size:13px;color:var(--text-muted);margin-bottom:16px">
      ${_feedErrors.length} channel${_feedErrors.length > 1 ? 's' : ''} failed to load.
    </p>
    <div class="feed-error-list">${rows}</div>
    <div class="modal-actions"><button class="btn-secondary" id="closeFeedErrors">Close</button></div>
  `);

  document.getElementById('closeFeedErrors')?.addEventListener('click', closeModal);

  document.querySelectorAll('.btn-retry-feed').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id   = btn.dataset.id;
      const name = btn.dataset.name;
      btn.textContent = '…';
      btn.disabled = true;
      try {
        const res = await api(`/channels/${id}/poll`, { method: 'POST' });
        if (res.ok) {
          // Remove from error list
          _feedErrors = _feedErrors.filter(e => String(e.id) !== String(id));
          setFeedErrors(_feedErrors);
          const row = document.querySelector(`.feed-error-row[data-id="${id}"]`);
          row?.remove();
          if (_feedErrors.length === 0) closeModal();
        } else {
          btn.textContent = 'Retry';
          btn.disabled = false;
          // Update error message
          const row = document.querySelector(`.feed-error-row[data-id="${id}"]`);
          if (row) row.querySelector('.feed-error-msg').textContent = res.error;
        }
      } catch {
        btn.textContent = 'Retry';
        btn.disabled = false;
      }
    });
  });

  document.querySelectorAll('.btn-delete-feed').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id   = btn.dataset.id;
      const name = btn.dataset.name;
      if (!confirm(`Delete "${name}" and all its videos?`)) return;
      try {
        await api(`/channels/${id}`, { method: 'DELETE' });
        _feedErrors = _feedErrors.filter(e => String(e.id) !== String(id));
        state.channels = state.channels.filter(c => String(c.id) !== String(id));
        setFeedErrors(_feedErrors);
        renderSidebar();
        const row = document.querySelector(`.feed-error-row[data-id="${id}"]`);
        row?.remove();
        if (_feedErrors.length === 0) closeModal();
        if (state.view === 'home') loadVideos(true);
      } catch (err) {
        alert('Delete failed: ' + err.message);
      }
    });
  });

  document.querySelectorAll('.btn-fix-feed').forEach(btn => {
    btn.addEventListener('click', () => {
      const row  = btn.closest('.feed-error-row');
      const wrap = row.querySelector('.feed-relink-wrap');
      wrap.classList.remove('hidden');
      btn.classList.add('hidden');
      row.querySelector('.feed-relink-input').focus();
    });
  });

  document.querySelectorAll('.btn-relink-cancel').forEach(btn => {
    btn.addEventListener('click', () => {
      const row  = btn.closest('.feed-error-row');
      row.querySelector('.feed-relink-wrap').classList.add('hidden');
      row.querySelector('.btn-fix-feed').classList.remove('hidden');
    });
  });

  document.querySelectorAll('.btn-relink-confirm').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id    = btn.dataset.id;
      const row   = btn.closest('.feed-error-row');
      const input = row.querySelector('.feed-relink-input');
      const url   = input.value.trim();
      if (!url) return;
      btn.textContent = 'Updating…';
      btn.disabled = true;
      try {
        const res = await api(`/channels/${id}/relink`, { method: 'POST', body: { url } });
        if (res.ok) {
          _feedErrors = _feedErrors.filter(e => String(e.id) !== String(id));
          setFeedErrors(_feedErrors);
          row.remove();
          if (_feedErrors.length === 0) closeModal();
          await loadMeta();
          renderSidebar();
        } else {
          row.querySelector('.feed-error-msg').textContent = res.error || 'Failed to resolve URL';
          btn.textContent = 'Update';
          btn.disabled = false;
        }
      } catch (e) {
        row.querySelector('.feed-error-msg').textContent = e.message;
        btn.textContent = 'Update';
        btn.disabled = false;
      }
    });
  });
}

/* ── boot ─────────────────────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', init);
