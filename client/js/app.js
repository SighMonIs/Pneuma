/* ── icons (Lucide, ISC license — see client/icons/LICENSE) ─────────────── */
const ICONS = {
  home:          '<path d="M7 21h10"/><rect width="20" height="14" x="2" y="3" rx="2"/>',
  settings:      '<path d="M14 17H5"/><path d="M19 7h-9"/><circle cx="17" cy="17" r="3"/><circle cx="7" cy="7" r="3"/>',
  list:          '<path d="M3 5h.01"/><path d="M3 12h.01"/><path d="M3 19h.01"/><path d="M8 5h13"/><path d="M8 12h13"/><path d="M8 19h13"/>',
  grid:          '<rect width="7" height="7" x="3" y="3" rx="1"/><rect width="7" height="7" x="14" y="3" rx="1"/><rect width="7" height="7" x="14" y="14" rx="1"/><rect width="7" height="7" x="3" y="14" rx="1"/>',
  refresh:       '<path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/>',
  plus:          '<path d="M5 12h14"/><path d="M12 5v14"/>',
  pencil:        '<path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z"/><path d="m15 5 4 4"/>',
  trash:         '<path d="M10 11v6"/><path d="M14 11v6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>',
  x:             '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
  check:         '<path d="M20 6 9 17l-5-5"/>',
  star:          '<path d="M11.525 2.295a.53.53 0 0 1 .95 0l2.31 4.679a2.123 2.123 0 0 0 1.595 1.16l5.166.756a.53.53 0 0 1 .294.904l-3.736 3.638a2.123 2.123 0 0 0-.611 1.878l.882 5.14a.53.53 0 0 1-.771.56l-4.618-2.428a2.122 2.122 0 0 0-1.973 0L6.396 21.01a.53.53 0 0 1-.77-.56l.881-5.139a2.122 2.122 0 0 0-.611-1.879L2.16 9.795a.53.53 0 0 1 .294-.906l5.165-.755a2.122 2.122 0 0 0 1.597-1.16z"/>',
  play:          '<path d="M5 5a2 2 0 0 1 3.008-1.728l11.997 6.998a2 2 0 0 1 .003 3.458l-12 7A2 2 0 0 1 5 19z"/>',
  arrowLeft:     '<path d="m12 19-7-7 7-7"/><path d="M19 12H5"/>',
  grip:          '<circle cx="9" cy="12" r="1"/><circle cx="9" cy="5" r="1"/><circle cx="9" cy="19" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="15" cy="5" r="1"/><circle cx="15" cy="19" r="1"/>',
  chevronDown:   '<path d="m6 9 6 6 6-6"/>',
  chevronRight:  '<path d="m9 18 6-6-6-6"/>',
  chevronUp:     '<path d="m18 15-6-6-6 6"/>',
  alertTriangle: '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4"/><path d="M12 17h.01"/>',
  copy:          '<rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>',
};

function icon(name, cls = '') {
  const body = ICONS[name];
  if (!body) return '';
  return `<svg class="icon${cls ? ' ' + cls : ''}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`;
}

/* ── state ────────────────────────────────────────────────────────────── */
const state = {
  view:        'home',   // 'home' | 'channel' | 'category' | 'settings' | 'watch'
  channelId:   null,
  categoryId:  null,
  filter:      'unwatched',
  sort:        'newest',
  categories:  [],
  channels:    [],
  settings:    {},
  videos:      [],
  total:       0,
  offset:      0,
  PAGE:        40,
  watchVideo:  null,  // currently playing video object
  canGoBack:   false, // true when watch was opened via navigation (not direct URL)
  settingsTab: 'playback',
  selectMode:  false,   // bulk-select mode toggled via the "Select" checkbox
  selectedIds: new Set(),
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
  state.sort     = localStorage.getItem('sort')     || state.settings.default_sort   || 'newest';
  state.autoplay = localStorage.getItem('autoplay') !== 'false';
}

// All/Unwatched/Watched is remembered separately per view (home vs a given channel/category page)
function applyFilterForView(view) {
  state.filter = localStorage.getItem(`filter:${view}`) || (view === 'home' ? state.settings.default_filter : null) || 'unwatched';
  document.getElementById('filterSelect').value = state.filter;
}

/* ── navigation ───────────────────────────────────────────────────────── */
function navigate(view, id = null, { push = true } = {}) {
  const prevView       = state.view;
  const prevSettingsTab = state.settingsTab;
  state.view      = view;
  state.offset    = 0;
  state.videos    = [];

  if (view === 'channel')  state.channelId  = id;
  if (view === 'category') state.categoryId = id;
  if (view === 'settings') state.settingsTab = id || state.settingsTab || 'playback';

  // Update active states in sidebar
  document.querySelectorAll('.nav-item, .category-header, .channel-item').forEach(el => el.classList.remove('active'));

  if (view === 'home') {
    document.querySelector('[data-view="home"]')?.classList.add('active');
  } else if (view === 'settings') {
    document.querySelector('[data-view="settings"]')?.classList.add('active');
  } else if (view === 'channel') {
    document.querySelector(`.channel-item[data-id="${id}"]`)?.classList.add('active');
  } else if (view === 'category') {
    document.querySelector(`.category-header[data-id="${id}"]`)?.classList.add('active');
  }

  // Push URL so refresh and back/forward work
  if (push) {
    let url = '/';
    if (view === 'settings') {
      url = state.settingsTab && state.settingsTab !== 'playback' ? `/settings/${state.settingsTab}` : '/settings';
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

  const main             = document.getElementById('main');
  const toolbar          = document.getElementById('toolbar');
  const videoContainer   = document.getElementById('videoContainer');
  const settingsPanel    = document.getElementById('settingsPanel');
  const watchPanel       = document.getElementById('watchPanel');
  const loadMoreWrap     = document.getElementById('loadMoreWrap');
  const channelBanner    = document.getElementById('channelBanner');
  const channelHeaderRow = document.getElementById('channelHeaderRow');
  const channelDescEl    = document.getElementById('channelDesc');

  // Helper to hide all secondary panels at once
  const hideAll = () => {
    toolbar.classList.add('hidden');
    videoContainer.classList.add('hidden');
    loadMoreWrap.classList.add('hidden');
    settingsPanel.classList.add('hidden');
    watchPanel.classList.add('hidden');
    channelBanner.classList.add('hidden');
    channelHeaderRow.classList.add('hidden');
    channelDescEl.classList.add('hidden');
  };

  // The sidebar channel tree switches into drag-handle mode while the Categories settings tab is open
  const wasDragMode = prevView === 'settings' && prevSettingsTab === 'categories';
  const isDragMode  = view === 'settings' && state.settingsTab === 'categories';

  if (view === 'settings') {
    hideAll();
    settingsPanel.classList.remove('hidden');
    stopPlayer();
    if (wasDragMode !== isDragMode) renderSidebar();
    renderSettings();
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
    watchPanel.classList.add('hidden');
    videoContainer.scrollTop = 0;
    main.scrollTop = 0;
    main.classList.toggle('channel-scroll', view === 'channel');
    stopPlayer();
    if (wasDragMode) renderSidebar(); // switch back to thumbnail mode
    if (view === 'channel') {
      renderChannelHeader(id);
    } else {
      channelBanner.classList.add('hidden');
      channelHeaderRow.classList.add('hidden');
      channelDescEl.classList.add('hidden');
      toolbar.style.top = ''; // only relevant in channel-scroll mode; avoid leaking a stale offset
    }
    applyFilterForView(view);
    loadVideos(true);
  }
}

/* ── render: channel header ───────────────────────────────────────────── */
async function renderChannelHeader(channelId) {
  const banner = document.getElementById('channelBanner');
  const row    = document.getElementById('channelHeaderRow');
  const desc   = document.getElementById('channelDesc');

  let ch;
  try {
    ch = await api(`/channels/${channelId}`);
  } catch {
    banner.classList.add('hidden');
    row.classList.add('hidden');
    desc.classList.add('hidden');
    return;
  }
  if (state.view !== 'channel' || state.channelId !== channelId) return; // navigated away while loading

  const metaParts = [];
  if (ch.handle) metaParts.push(escHtml(ch.handle));
  if (ch.subscriber_count != null) metaParts.push(`${formatCount(ch.subscriber_count)} subscribers`);
  metaParts.push(`${ch.video_count} video${ch.video_count !== 1 ? 's' : ''}`);

  banner.innerHTML = ch.banner_url ? `<img src="/api/channels/${ch.id}/banner" alt="" onerror="this.remove()">` : '';

  const ytUrl = ch.yt_channel_id.startsWith('@')
    ? `https://www.youtube.com/${ch.yt_channel_id}`
    : `https://www.youtube.com/channel/${ch.yt_channel_id}`;

  const favCat  = state.categories.find(c => c.name === 'Favourites');
  const isFav   = !!favCat && ch.category_id === favCat.id;

  row.innerHTML = `
    <img class="channel-header-avatar" src="/api/channels/${ch.id}/thumb" alt="" onerror="this.style.visibility='hidden'">
    <div class="channel-header-info">
      <div class="channel-header-name">
        ${escHtml(ch.name)}
        <button class="channel-fav-btn${isFav ? ' active' : ''}" id="favBtn" title="${isFav ? 'Remove from Favourites' : 'Add to Favourites'}">${icon('star')}</button>
      </div>
      <div class="channel-header-meta">${metaParts.join(' · ')}</div>
      ${ch.description ? `<button class="channel-header-desc-toggle" id="descToggle">Show description</button>` : ''}
    </div>
    <div class="channel-header-actions">
      <a class="btn-watch-yt" href="${ytUrl}" target="_blank" rel="noopener">View on YouTube</a>
      <button class="channel-header-desc-toggle" id="channelSettingsBtn" title="Channel settings">${icon('settings')} Settings</button>
    </div>
  `;

  row.querySelector('#favBtn').addEventListener('click', async () => {
    await api(`/channels/${ch.id}/favourite`, { method: 'POST' });
    await loadMeta();
    renderSidebar();
    if (state.view === 'channel' && state.channelId === channelId) renderChannelHeader(channelId);
  });

  row.querySelector('#channelSettingsBtn').addEventListener('click', () => openChannelSettingsModal(ch));

  if (ch.description) {
    desc.innerHTML = linkify(escHtml(ch.description));
    desc.classList.add('hidden');
    row.querySelector('#descToggle').addEventListener('click', () => {
      const toggle = document.getElementById('descToggle');
      const hidden = desc.classList.toggle('hidden');
      toggle.textContent = hidden ? 'Show description' : 'Hide description';
    });
  } else {
    desc.innerHTML = '';
    desc.classList.add('hidden');
  }

  banner.classList.remove('hidden');
  row.classList.remove('hidden');

  // Stack the sticky toolbar directly under the sticky channel-header-row
  document.getElementById('toolbar').style.top = `${row.offsetHeight}px`;
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

  if (path === '/settings') return { view: 'settings', id: null };
  const settingsTabMatch = path.match(/^\/settings\/(.+)$/);
  if (settingsTabMatch) return { view: 'settings', id: settingsTabMatch[1] };

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
    filter: state.filter,
    sort:   state.sort,
    limit:  state.PAGE,
    offset: state.offset,
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

/* ── infinite scroll ──────────────────────────────────────────────────── */
let _loadingMore = false;

async function maybeLoadMore(el) {
  if (_loadingMore || state.offset >= state.total) return;
  if (!['home', 'channel', 'category'].includes(state.view)) return;
  const nearBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 600;
  if (!nearBottom) return;

  _loadingMore = true;
  document.getElementById('loadMoreWrap').classList.remove('hidden');
  await loadVideos(false);
  document.getElementById('loadMoreWrap').classList.add('hidden');
  _loadingMore = false;
}

/* ── render: videos ───────────────────────────────────────────────────── */
function renderVideos(reset) {
  const container = document.getElementById('videoContainer');
  const lmw       = document.getElementById('loadMoreWrap');

  container.className = 'video-container';

  if (reset) {
    state.selectedIds.clear();
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
    frag.appendChild(makeVideoCard(v));
  });

  container.insertBefore(frag, lmw);
  lmw.classList.add('hidden'); // shown transiently by maybeLoadMore() while fetching the next page
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
  const avatarHtml = v.channel_thumbnail
    ? `<img class="video-channel-icon" src="/api/channels/${v.channel_id}/thumb" alt="" onerror="this.style.display='none'">`
    : '';
  return `<span class="video-channel-link" data-channel-id="${v.channel_id}">${avatarHtml}${escHtml(v.channel_name)}</span>`;
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
      <div class="video-play-btn">${icon('play')}</div>
      <button class="video-watched-btn" title="${v.watched_at ? 'Mark unwatched' : 'Mark watched'}">${icon('check')}</button>
      ${v.duration ? `<span class="video-duration">${formatDuration(v.duration)}</span>` : ''}
    </div>
    <div class="video-info">
      <div class="video-title">${escHtml(v.title)}</div>
      <div class="video-meta">${videoChannelLinkHtml(v)}<span class="video-time">${timeAgo(v.published_at)}</span></div>
    </div>`;

  el.querySelector('.video-watched-btn').addEventListener('click', async (e) => {
    e.stopPropagation();
    const watched = el.classList.contains('watched');
    await api(`/videos/${v.id}/watched`, { method: watched ? 'DELETE' : 'POST' });
    el.classList.toggle('watched', !watched);
    e.currentTarget.title = watched ? 'Mark watched' : 'Mark unwatched';
  });

  wireVideoChannelLink(el, v);
  el.addEventListener('click', () => {
    if (state.selectMode) toggleVideoSelection(el, v.id);
    else openVideo(v);
  });
  return el;
}

function toggleVideoSelection(el, id) {
  if (state.selectedIds.has(id)) {
    state.selectedIds.delete(id);
    el.classList.remove('selected');
  } else {
    state.selectedIds.add(id);
    el.classList.add('selected');
  }
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

  updateWatchMarkButton(v);
  const markBtn = document.getElementById('watchMarkWatchedBtn');
  markBtn.onclick = async () => {
    const watched = !!v.watched_at;
    await api(`/videos/${v.id}/watched`, { method: watched ? 'DELETE' : 'POST' });
    v.watched_at = watched ? null : new Date().toISOString();
    updateWatchMarkButton(v);
    document.querySelector(`.video-card[data-id="${v.id}"]`)?.classList.toggle('watched', !watched);
  };

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
    const markAtEnabled = state.settings.mark_watched_at_enabled !== 'false';
    const markAtPercent = parseInt(state.settings.mark_watched_at_percent || '90', 10) / 100;
    if (markAtEnabled && d > 0 && t / d >= markAtPercent) await markWatched(v);
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
  document.querySelector(`.video-card[data-id="${v.id}"]`)?.classList.add('watched');
  if (state.watchVideo === v) updateWatchMarkButton(v);
}

function updateWatchMarkButton(v) {
  const btn = document.getElementById('watchMarkWatchedBtn');
  btn.textContent = v.watched_at ? 'Mark unwatched' : 'Mark watched';
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
  const isDragMode = state.view === 'settings' && state.settingsTab === 'categories';
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
        <button class="category-chevron">${cat.collapsed ? icon('chevronRight') : icon('chevronDown')}</button>
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
        e.currentTarget.innerHTML = isOpen ? icon('chevronDown') : icon('chevronRight');
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
        el.innerHTML = `<span class="sidebar-drag-handle">${icon('grip')}</span><span class="channel-name">${escHtml(ch.name)}</span>${ch.unwatched_count > 0 ? `<span class="channel-unread">${ch.unwatched_count}</span>` : ''}`;
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
  const leadingHtml = draggable
    ? `<span class="sidebar-drag-handle">${icon('grip')}</span>`
    : channelThumbHtml(ch);
  return `
    <div class="channel-item" data-id="${ch.id}">
      ${leadingHtml}
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
const SETTINGS_TABS = [
  { key: 'playback',   label: 'Playback' },
  { key: 'feed',       label: 'Feed' },
  { key: 'search',     label: 'Search' },
  { key: 'categories', label: 'Categories' },
  { key: 'shortcut',   label: 'iOS Shortcut' },
];

function renderSettings() {
  const panel = document.getElementById('settingsPanel');
  const s     = state.settings;
  const tab   = state.settingsTab || 'playback';

  const tabsHtml = SETTINGS_TABS.map(t =>
    `<button class="settings-tab${t.key === tab ? ' active' : ''}" data-tab="${t.key}">${t.label}</button>`
  ).join('');

  const sections = {
    playback: `
      <div class="settings-section">
        <div class="setting-row" style="flex-direction:column;align-items:flex-start;gap:10px">
          <div>
            <div class="setting-label">Video playback</div>
            <div class="setting-desc">How videos open when you click them</div>
          </div>
          <div class="playback-options">
            <button class="playback-opt${s.playback_mode !== 'youtube' ? ' active' : ''}" data-mode="embed">
              <span class="playback-opt-title">Embedded player</span>
              <span class="playback-opt-desc">Tracks progress${s.mark_watched_at_enabled !== 'false' ? ` · auto-marks watched at ${parseInt(s.mark_watched_at_percent || '90', 10)}%` : ''} · resumes where you left off</span>
            </button>
            <button class="playback-opt${s.playback_mode === 'youtube' ? ' active' : ''}" data-mode="youtube">
              <span class="playback-opt-title">Open in YouTube</span>
              <span class="playback-opt-desc">Opens in a new tab · no progress tracking</span>
            </button>
          </div>
        </div>
        <div class="setting-row">
          <div>
            <div class="setting-label">Autoplay</div>
            <div class="setting-desc">Automatically start playing when you open a video</div>
          </div>
          <div class="setting-control">
            <label class="toggle">
              <input type="checkbox" id="autoplayToggle" ${state.autoplay ? 'checked' : ''}>
              <div class="toggle-track"></div>
            </label>
          </div>
        </div>
      </div>`,

    feed: `
      <div class="settings-section">
        <div class="setting-row">
          <div>
            <div class="setting-label">Refresh feeds</div>
            <div class="setting-desc">Manually check all channels for new videos now</div>
          </div>
          <div class="setting-control">
            <button class="btn-refresh" id="btnRefresh" title="Refresh all feeds">${icon('refresh')} Refresh now</button>
          </div>
        </div>
        <div class="setting-row">
          <div>
            <div class="setting-label">Clean up feeds</div>
            <div class="setting-desc">Remove feeds that are no longer active</div>
          </div>
          <div class="setting-control">
            <button class="btn-refresh" id="btnCleanupFeeds">Clean up feeds</button>
          </div>
        </div>
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
        <div class="setting-row">
          <div>
            <div class="setting-label">Mark videos watched at ${percentSelectHtml('mark_watched_at_percent', parseInt(s.mark_watched_at_percent || '90', 10))}%</div>
            <div class="setting-desc">Automatically mark a video watched once playback reaches this point</div>
          </div>
          <div class="setting-control">
            ${toggleHtml('mark_watched_at_enabled', s.mark_watched_at_enabled !== 'false')}
          </div>
        </div>
      </div>`,

    search: `
      <div class="settings-section">
        <div class="setting-row">
          <div>
            <div class="setting-label">Search YouTube</div>
            <div class="setting-desc">Include YouTube results in the sidebar search (uses yt-dlp)</div>
          </div>
          <div class="setting-control">
            ${toggleHtml('search_youtube', s.search_youtube !== 'false')}
          </div>
        </div>
      </div>`,

    categories: `
      <div class="settings-section">
        <div class="cat-add-row">
          <input class="cat-add-input" id="catAddInput" type="text" placeholder="New category name…" maxlength="80">
          <button class="btn btn-primary" id="catAddBtn">Add</button>
        </div>
        <div class="cat-list" id="catList">${categoriesListHtml()}</div>
      </div>`,

    shortcut: `
      <div class="settings-section">
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
      </div>`,
  };

  panel.innerHTML = `
    <h1>Settings</h1>
    <div class="settings-tabs">${tabsHtml}</div>
    <div class="settings-tab-body">${sections[tab] || ''}</div>`;

  panel.querySelectorAll('.settings-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      if (btn.dataset.tab !== tab) navigate('settings', btn.dataset.tab);
    });
  });

  const flashSaved = () => {
    showToast('settings-saved', { icon: icon('check'), title: 'Settings saved' });
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
      // These affect the "Embedded player" description text above, so re-render to keep it in sync
      if (key === 'mark_watched_at_enabled' || key === 'mark_watched_at_percent') renderSettings();
    });
  });

  if (tab === 'playback') {
    panel.querySelectorAll('.playback-opt').forEach(btn => {
      btn.addEventListener('click', () => {
        const mode = btn.dataset.mode;
        state.settings.playback_mode = mode;
        api('/settings', { method: 'PUT', body: { playback_mode: mode } });
        panel.querySelectorAll('.playback-opt').forEach(b => b.classList.toggle('active', b.dataset.mode === mode));
        flashSaved();
      });
    });

    // Autoplay — a client-only preference (localStorage), not a synced server setting
    document.getElementById('autoplayToggle').addEventListener('change', (e) => {
      state.autoplay = e.target.checked;
      localStorage.setItem('autoplay', state.autoplay);
    });
  }

  if (tab === 'feed') {
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

    // Refresh feeds — fires and forgets; progress comes back via SSE toast
    document.getElementById('btnRefresh').addEventListener('click', () => {
      api('/channels/refresh', { method: 'POST' });
    });

    document.getElementById('btnCleanupFeeds').addEventListener('click', openCleanupModal);
  }

  if (tab === 'categories') {
    wireUpCategoriesTab(panel);
  }

  if (tab === 'shortcut') {
    fetch(`${API}/settings/token`).then(r => r.json()).then(d => {
      const el = document.getElementById('tokenDisplay');
      if (el) el.textContent = d.token;
    });

    document.getElementById('btnRegen')?.addEventListener('click', async () => {
      if (!confirm('Regenerate token? Your existing iOS shortcut will stop working until you update it.')) return;
      const d = await api('/settings/regenerate-token', { method: 'POST' });
      document.getElementById('tokenDisplay').textContent = d.token;
    });
  }
}

/* ── clean up feeds modal ─────────────────────────────────────────────── */
async function openCleanupModal() {
  showModal('Clean Up Feeds', `
    <div class="modal-body">
      <div class="form-field">
        <label>No activity in:</label>
        <select id="cleanupTimeframe">
          <option value="3">More than 3 months</option>
          <option value="6">More than 6 months</option>
          <option value="12">More than 1 year</option>
        </select>
      </div>
      <div class="cleanup-list-header">
        <button class="btn-secondary" id="cleanupSelectAll">Select All</button>
        <span class="setting-desc" id="cleanupCount"></span>
      </div>
      <div class="feed-error-list" id="cleanupList"></div>
    </div>
    <div class="modal-actions">
      <button class="btn-secondary" onclick="closeModal()">Cancel</button>
      <button class="btn-danger" id="cleanupDeleteBtn" disabled>Delete Selected</button>
    </div>
  `);

  async function loadInactive() {
    const months = document.getElementById('cleanupTimeframe').value;
    const list   = document.getElementById('cleanupList');
    list.innerHTML = `<div class="setting-desc">Loading…</div>`;
    const channels = await api(`/channels/inactive?months=${months}`);
    list.innerHTML = channels.length === 0
      ? `<div class="setting-desc">No inactive channels found.</div>`
      : channels.map(ch => `
        <label class="feed-error-row cleanup-row">
          <input type="checkbox" class="cleanup-checkbox" value="${ch.id}" data-name="${escHtml(ch.name)}">
          ${channelThumbHtml(ch)}
          <div class="feed-error-info">
            <div class="feed-error-name">${escHtml(ch.name)}</div>
            <div class="setting-desc">${ch.last_video_at ? 'Last video ' + timeAgo(ch.last_video_at) : 'No videos'}</div>
          </div>
        </label>`).join('');
    updateDeleteBtn();
  }

  function updateDeleteBtn() {
    const checked = document.querySelectorAll('.cleanup-checkbox:checked');
    const btn = document.getElementById('cleanupDeleteBtn');
    btn.disabled = checked.length === 0;
    btn.textContent = checked.length ? `Delete ${checked.length} channel${checked.length !== 1 ? 's' : ''}` : 'Delete Selected';
    document.getElementById('cleanupCount').textContent = `${document.querySelectorAll('.cleanup-checkbox').length} inactive`;
  }

  document.getElementById('cleanupTimeframe').addEventListener('change', loadInactive);

  document.getElementById('cleanupList').addEventListener('change', (e) => {
    if (e.target.classList.contains('cleanup-checkbox')) updateDeleteBtn();
  });

  document.getElementById('cleanupSelectAll').addEventListener('click', () => {
    const boxes = document.querySelectorAll('.cleanup-checkbox');
    const allChecked = boxes.length > 0 && [...boxes].every(b => b.checked);
    boxes.forEach(b => { b.checked = !allChecked; });
    updateDeleteBtn();
  });

  document.getElementById('cleanupDeleteBtn').addEventListener('click', () => {
    const checked = [...document.querySelectorAll('.cleanup-checkbox:checked')];
    if (checked.length === 0) return;
    openCleanupConfirmModal(checked.map(c => c.value), checked.map(c => c.dataset.name));
  });

  await loadInactive();
}

function openCleanupConfirmModal(ids, names) {
  showModal('Confirm Delete', `
    <div class="modal-body">
      <p style="font-size:13px">Delete ${ids.length} channel${ids.length !== 1 ? 's' : ''} and all their videos? This cannot be undone.</p>
      <ul class="cleanup-confirm-list">${names.map(n => `<li>${escHtml(n)}</li>`).join('')}</ul>
    </div>
    <div class="modal-actions">
      <button class="btn-secondary" id="cleanupConfirmBack">Back</button>
      <button class="btn-danger" id="cleanupConfirmDelete">Delete</button>
    </div>
  `);

  document.getElementById('cleanupConfirmBack').addEventListener('click', openCleanupModal);

  document.getElementById('cleanupConfirmDelete').addEventListener('click', async () => {
    const btn = document.getElementById('cleanupConfirmDelete');
    btn.disabled = true;
    btn.textContent = 'Deleting…';
    for (const id of ids) {
      await api(`/channels/${id}`, { method: 'DELETE' });
    }
    closeModal();
    await loadMeta();
    renderSidebar();
    if (state.view === 'home') loadVideos(true);
  });
}

function numInput(id, value, min, max) {
  return `<div class="num-input-wrap">
    <input type="number" id="${id}" value="${value}" min="${min}" max="${max}">
    <div class="num-input-btns">
      <button class="num-btn" data-target="${id}" data-delta="1">${icon('chevronUp')}</button>
      <button class="num-btn" data-target="${id}" data-delta="-1">${icon('chevronDown')}</button>
    </div>
  </div>`;
}

function toggleHtml(key, checked) {
  return `<label class="toggle">
    <input type="checkbox" data-key="${key}" ${checked ? 'checked' : ''}>
    <div class="toggle-track"></div>
  </label>`;
}

function percentSelectHtml(key, selected) {
  const options = [];
  for (let p = 5; p <= 100; p += 5) {
    options.push(`<option value="${p}"${p === selected ? ' selected' : ''}>${p}</option>`);
  }
  return `<select class="inline-select" data-key="${key}">${options.join('')}</select>`;
}

/* ── render: categories management (Settings → Categories tab) ───────── */
function categoriesListHtml() {
  return state.categories.length
    ? state.categories.map(cat => {
        const count   = state.channels.filter(c => c.category_id === cat.id).length;
        const pinned  = cat.name === 'Favourites';
        return `
          <div class="cat-row${pinned ? ' cat-row-pinned' : ''}" data-id="${cat.id}">
            ${pinned
              ? `<span class="cat-drag-handle cat-pinned-icon" title="Favourites always stays at the top">${icon('star')}</span>`
              : `<span class="cat-drag-handle" title="Drag to reorder">${icon('grip')}</span>`}
            <span class="cat-name" contenteditable="false">${escHtml(cat.name)}</span>
            <span class="cat-count">${count} channel${count !== 1 ? 's' : ''}</span>
            <div class="cat-actions">
              <button class="cat-btn-rename" title="Rename">${icon('pencil')}</button>
              <button class="cat-btn-delete" title="Delete">${icon('trash')}</button>
            </div>
          </div>`;
      }).join('')
    : '<div class="cat-empty">No categories yet. Add one above.</div>';
}

function wireUpCategoriesTab(panel) {
  const addInput = panel.querySelector('#catAddInput');
  panel.querySelector('#catAddBtn').addEventListener('click', async () => {
    const name = addInput.value.trim();
    if (!name) return;
    await api('/categories', { method: 'POST', body: { name } });
    addInput.value = '';
    await reloadCategoriesTab();
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
      renBtn.innerHTML = icon('check');
    };
    const saveEdit = async () => {
      const newName = nameEl.textContent.trim();
      nameEl.contentEditable = 'false';
      renBtn.innerHTML = icon('pencil');
      if (!newName) return reloadCategoriesTab();
      await api(`/categories/${id}`, { method: 'PUT', body: { name: newName } });
      await reloadCategoriesTab();
    };

    renBtn.addEventListener('click', () => nameEl.contentEditable === 'true' ? saveEdit() : startEditing());
    nameEl.addEventListener('keydown', e => {
      if (e.key === 'Enter')  { e.preventDefault(); saveEdit(); }
      if (e.key === 'Escape') { nameEl.contentEditable = 'false'; renBtn.innerHTML = icon('pencil'); reloadCategoriesTab(); }
    });
    row.querySelector('.cat-btn-delete').addEventListener('click', async () => {
      const name  = nameEl.textContent.trim();
      const count = state.channels.filter(c => c.category_id === id).length;
      const msg   = count ? `Delete "${name}"? Its ${count} channel${count !== 1 ? 's' : ''} will become uncategorised.` : `Delete "${name}"?`;
      if (!confirm(msg)) return;
      await api(`/categories/${id}`, { method: 'DELETE' });
      await reloadCategoriesTab();
    });
  });

  wireUpCatDrag(panel.querySelector('#catList'));
}

function wireUpCatDrag(catList) {
  let dragSrc = null;

  // Favourites (.cat-row-pinned) is excluded entirely — never draggable, and
  // since it never gets a dragover listener, nothing can be dropped above it.
  catList.querySelectorAll('.cat-row:not(.cat-row-pinned)').forEach(row => {
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

async function reloadCategoriesTab() {
  await loadMeta();
  renderSidebar();
  if (state.view === 'settings' && state.settingsTab === 'categories') renderSettings();
}

/* ── channel settings modal ───────────────────────────────────────────── */
function openChannelSettingsModal(ch) {
  const favCat = state.categories.find(c => c.name === 'Favourites');
  const catOptions = state.categories
    .filter(c => c.id !== favCat?.id)
    .map(c => `<option value="${c.id}"${ch.category_id === c.id ? ' selected' : ''}>${escHtml(c.name)}</option>`)
    .join('');

  showModal('Channel Settings', `
    <div class="modal-body">
      <div class="form-field">
        <label>Feed URL</label>
        <div class="channel-settings-url-row">
          <input type="text" id="settingsFeedUrl" value="${escHtml(ch.rss_url || '')}" readonly>
          <button class="btn-secondary" id="btnCopyFeedUrl" title="Copy feed URL">${icon('copy')}</button>
        </div>
      </div>
      <div class="form-field">
        <label>Category</label>
        <select id="settingsCategory"><option value="">None</option><option value="__new__">-- New Category --</option>${catOptions}</select>
        <input type="text" id="settingsNewCategory" placeholder="New category name" class="hidden">
      </div>
    </div>
    <div class="modal-actions">
      <button class="btn-secondary modal-actions-left" id="btnRefreshChannel">${icon('refresh')} Refresh feed</button>
      <button class="btn-danger" id="btnUnsubscribeChannel">Unsubscribe</button>
      <button class="btn-secondary" onclick="closeModal()">Cancel</button>
      <button class="btn-primary" id="btnSaveChannelSettings">Save</button>
    </div>
  `);

  document.getElementById('settingsCategory').addEventListener('change', (e) => {
    document.getElementById('settingsNewCategory').classList.toggle('hidden', e.target.value !== '__new__');
  });

  document.getElementById('btnCopyFeedUrl').addEventListener('click', async () => {
    const btn = document.getElementById('btnCopyFeedUrl');
    await navigator.clipboard.writeText(ch.rss_url || '');
    btn.innerHTML = icon('check');
    setTimeout(() => { btn.innerHTML = icon('copy'); }, 1500);
  });

  document.getElementById('btnRefreshChannel').addEventListener('click', async () => {
    const btn = document.getElementById('btnRefreshChannel');
    btn.disabled = true;
    btn.textContent = 'Refreshing…';
    try {
      const res = await api(`/channels/${ch.id}/poll`, { method: 'POST' });
      btn.textContent = res.ok ? `Added ${res.added}` : (res.error || 'Failed');
    } catch (e) {
      btn.textContent = e.message || 'Failed';
    }
    setTimeout(() => {
      btn.disabled = false;
      btn.innerHTML = `${icon('refresh')} Refresh feed`;
    }, 1500);
    if (state.view === 'channel' && state.channelId === ch.id) loadVideos(true);
  });

  document.getElementById('btnUnsubscribeChannel').addEventListener('click', async () => {
    if (!confirm(`Unsubscribe from "${ch.name}"? This deletes the channel and all its videos.`)) return;
    await api(`/channels/${ch.id}`, { method: 'DELETE' });
    state.channels = state.channels.filter(c => String(c.id) !== String(ch.id));
    closeModal();
    await loadMeta();
    renderSidebar();
    navigate('home');
  });

  document.getElementById('btnSaveChannelSettings').addEventListener('click', async () => {
    const val = document.getElementById('settingsCategory').value;
    let newCatId = val ? Number(val) : null;

    if (val === '__new__') {
      const name = document.getElementById('settingsNewCategory').value.trim();
      if (!name) return;
      const created = await api('/categories', { method: 'POST', body: { name } });
      newCatId = created.id;
    }

    if (newCatId !== (ch.category_id ?? null)) {
      await api(`/channels/${ch.id}`, { method: 'PUT', body: { category_id: newCatId } });
    }
    closeModal();
    await loadMeta();
    renderSidebar();
    if (state.view === 'channel' && state.channelId === ch.id) renderChannelHeader(ch.id);
  });
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
        <button class="search-add-btn" data-channel-id="${c.channel_id}" data-channel-name="${escHtml(c.channel)}">${icon('plus')}</button>
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
        btn.innerHTML = icon('check');
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
      <button class="search-add-btn" data-channel-id="${r.channel_id}" data-channel-name="${escHtml(r.channel)}" title="Add channel">${icon('plus')}</button>
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
      btn.innerHTML = icon('check');
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
        <button class="search-add-btn" id="btnAddDetected" title="Add channel">${icon('plus')}</button>
      </div>`;

    document.getElementById('btnAddDetected')?.addEventListener('click', async () => {
      await api('/channels', { method: 'POST', body: {
        yt_channel_id: result.yt_channel_id,
        name: result.name || result.yt_channel_id,
        rss_url: result.rss_url,
      }});
      document.getElementById('btnAddDetected').innerHTML = icon('check');
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

  // Expand/collapse all categories at once
  const catToggleBtn = document.getElementById('btnToggleCategories');
  let catAllExpanded  = localStorage.getItem('catTreeExpanded') !== 'false';
  catToggleBtn.innerHTML = icon(catAllExpanded ? 'chevronDown' : 'chevronRight');
  catToggleBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    catAllExpanded = !catAllExpanded;
    localStorage.setItem('catTreeExpanded', catAllExpanded ? 'true' : 'false');
    catToggleBtn.innerHTML = icon(catAllExpanded ? 'chevronDown' : 'chevronRight');
    document.querySelectorAll('#categoryTree .category-item').forEach(item => {
      item.classList.toggle('open', catAllExpanded);
      const chevron = item.querySelector('.category-chevron');
      if (chevron) chevron.innerHTML = icon(catAllExpanded ? 'chevronDown' : 'chevronRight');
    });
    for (const cat of state.categories) {
      cat.collapsed = catAllExpanded ? 0 : 1;
      toggleCategoryCollapsed(cat.id, !catAllExpanded);
    }
  });

  // Filter dropdown
  document.getElementById('filterSelect').addEventListener('change', (e) => {
    state.filter = e.target.value;
    localStorage.setItem(`filter:${state.view}`, state.filter);
    loadVideos(true);
  });

  // Mark all (or, in select mode, only the selected videos) as watched/unwatched
  document.getElementById('markAllSelect').addEventListener('change', async (e) => {
    const action = e.target.value;
    e.target.value = ''; // reset immediately so the same action can be re-run once more videos load in
    const ids = state.selectMode ? [...state.selectedIds] : state.videos.map(v => v.id);
    if (!action || ids.length === 0) return;
    await api(`/videos/${action}-bulk`, { method: 'POST', body: { ids } });
    state.selectedIds.clear();
    await loadVideos(true);
    refreshSidebarCounts();
    showToast('mark-all', { icon: icon('check'), title: `Marked ${ids.length} video${ids.length !== 1 ? 's' : ''} as ${action}` });
    dismissToast('mark-all', 1500);
  });

  // Select mode — click videos to select them, then bulk-mark only those
  document.getElementById('selectModeToggle').addEventListener('change', (e) => {
    state.selectMode = e.target.checked;
    state.selectedIds.clear();
    document.querySelectorAll('.video-card.selected').forEach(el => el.classList.remove('selected'));
    const placeholder = document.querySelector('#markAllSelect option[value=""]');
    if (placeholder) placeholder.textContent = state.selectMode ? 'Mark selected as…' : 'Mark all as…';
  });

  // Sort
  document.getElementById('sortSelect').addEventListener('change', (e) => {
    state.sort = e.target.value;
    localStorage.setItem('sort', state.sort);
    loadVideos(true);
  });

  // Infinite scroll — videoContainer scrolls on home/category, .main scrolls on channel pages
  document.getElementById('videoContainer').addEventListener('scroll', (e) => maybeLoadMore(e.target));
  document.getElementById('main').addEventListener('scroll', (e) => maybeLoadMore(e.target));

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

  // Apply saved sort to UI (filter is handled per-view by applyFilterForView)
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
      showToast('thumb', { title: 'Channel icons', message: `${remaining} remaining` });
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

function showToast(id, { icon: iconHtml, title, message, progress } = {}) {
  let toast = document.getElementById(`toast-${id}`);
  if (!toast) {
    toast = document.createElement('div');
    toast.className = 'toast';
    toast.id = `toast-${id}`;
    toast.innerHTML = `
      <div class="toast-header">
        <button class="toast-close" title="Hide">${icon('x')}</button>
        <span class="toast-icon">${iconHtml ?? ''}</span>
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
      showToast('poll', { icon: icon('refresh'), title: 'Refreshing feeds', message: `0 / ${msg.total}`, progress: 0 });
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
