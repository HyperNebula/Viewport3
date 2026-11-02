import assert from 'node:assert/strict';
import { test } from 'node:test';
import { AudiusPlayer } from '../js/modules/audius.js';

class Element extends EventTarget {
  value = '';
  textContent = '';
  innerHTML = '';
  style = {};
  classList = { add() {}, remove() {} };
}

class AudioElement extends Element {
  src = '';
  currentTime = 0;
  playCalls = 0;
  play() { this.playCalls++; return Promise.resolve(); }
  pause() {}
  load() {}
  removeAttribute(name) { if (name === 'src') this.src = ''; }
}

// Skip automatic startup so each test can control requests and playback.
class TestPlayer extends AudiusPlayer {
  init() {}
}

function createPlayer(t) {
  const elements = new Map();
  const globals = {
    Audio: AudioElement,
    localStorage: { getItem: () => null, setItem() {} },
    document: {
      getElementById(id) {
        if (id === 'audius-visualizer') return null;
        if (!elements.has(id)) elements.set(id, new Element());
        return elements.get(id);
      },
      querySelectorAll: () => []
    },
    window: new EventTarget()
  };
  for (const [key, value] of Object.entries(globals)) {
    const previous = Object.getOwnPropertyDescriptor(globalThis, key);
    Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
    t.after(() => {
      if (previous) Object.defineProperty(globalThis, key, previous);
      else delete globalThis[key];
    });
  }
  t.mock.method(console, 'warn', () => {});
  return new TestPlayer();
}

const track = (id = 'track-1', extra = {}) => ({
  id, title: `Track ${id}`, user: { name: 'Artist' }, duration: 120,
  is_streamable: true, access: { stream: true }, ...extra
});
const response = data => ({ ok: true, json: async () => ({ data }) });

test('Lo-Fi uses the exact genre and excludes unavailable or gated tracks', async t => {
  const player = createPlayer(t);
  t.mock.method(globalThis, 'fetch', async url => {
    const parsed = new URL(url);
    assert.equal(parsed.pathname, '/v1/tracks/trending');
    assert.equal(parsed.searchParams.get('genre'), 'Lo-Fi');
    return response([
      track(), track('unavailable', { is_streamable: false }),
      track('gated', { is_stream_gated: true }), track('denied', { access: { stream: false } })
    ]);
  });
  await player.fetchTracks();
  assert.deepEqual(player.tracks.map(t => t.id), ['track-1']);
  assert.equal(player.titleEl.textContent, 'Track track-1');
  assert.equal(player.isLoading, false);
  assert.equal(player.audioEl.playCalls, 0);
});

test('Synthwave searches for tracks and can start the returned stream', async t => {
  const player = createPlayer(t);
  player.activeGenre = 'synthwave';
  t.mock.method(globalThis, 'fetch', async url => {
    const parsed = new URL(url);
    assert.equal(parsed.pathname, '/v1/tracks/search');
    assert.equal(parsed.searchParams.get('query'), 'synthwave');
    assert.equal(parsed.searchParams.has('genre'), false);
    return response([track()]);
  });
  await player.fetchTracks();
  player.play();
  assert.equal(player.audioEl.src, 'https://api.audius.co/v1/tracks/track-1/stream?app_name=viewport3');
  assert.equal(player.audioEl.playCalls, 1);
  assert.equal(player.sourceMode, 'audius');
});

test('empty results show an unavailable state and do not play fake tracks or switch to noise', async t => {
  const player = createPlayer(t);
  t.mock.method(globalThis, 'fetch', async () => response([]));
  await player.fetchTracks(true);
  player.play();
  player.nextTrack();
  player.prevTrack();
  assert.deepEqual(player.tracks, []);
  assert.equal(player.titleEl.textContent, 'No tracks available');
  assert.equal(player.currentTrackIndex, 0);
  assert.equal(player.isLoading, false);
  assert.equal(player.isPlaying, false);
  assert.equal(player.sourceMode, 'audius');
});

test('HTTP failures clear the loading state and display recovery options', async t => {
  const player = createPlayer(t);
  t.mock.method(globalThis, 'fetch', async () => ({ ok: false, status: 503 }));
  await player.fetchTracks();
  assert.equal(player.isLoading, false);
  assert.equal(player.titleEl.textContent, 'No tracks available');
  assert.match(player.artistEl.textContent, /another genre.*ambient/);
});

test('timeouts also cover reading the response body', async t => {
  const player = createPlayer(t);
  t.mock.timers.enable({ apis: ['setTimeout'] });
  let signal;
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    signal = options.signal;
    return { ok: true, json: () => new Promise((resolve, reject) => {
      signal.addEventListener('abort', () => reject(new DOMException('Timed out', 'AbortError')));
    }) };
  });
  const loading = player.fetchTracks();
  await Promise.resolve();
  t.mock.timers.tick(10000);
  await loading;
  assert.equal(signal.aborted, true);
  assert.equal(player.isLoading, false);
  assert.equal(player.titleEl.textContent, 'No tracks available');
});

test('a slower previous genre request cannot overwrite the latest selection', async t => {
  const player = createPlayer(t);
  const requests = [];
  t.mock.method(globalThis, 'fetch', (url, options) => new Promise(resolve => {
    requests.push({ resolve, signal: options.signal });
  }));
  const first = player.fetchTracks();
  player.activeGenre = 'synthwave';
  const second = player.fetchTracks();
  assert.equal(requests[0].signal.aborted, true);
  requests[1].resolve(response([track('new')]));
  await second;
  requests[0].resolve(response([track('old')]));
  await first;
  assert.equal(player.tracks[0].id, 'new');
  assert.equal(player.titleEl.textContent, 'Track new');
});

test('loading tracks does not overwrite ambient playback selected during the request', async t => {
  const player = createPlayer(t);
  let resolve;
  t.mock.method(globalThis, 'fetch', () => new Promise(r => { resolve = r; }));
  const loading = player.fetchTracks(true);
  player.toggleSourceMode();
  const ambientTitle = player.titleEl.textContent;
  resolve(response([track()]));
  await loading;
  assert.equal(player.sourceMode, 'ambient');
  assert.equal(player.titleEl.textContent, ambientTitle);
  assert.equal(player.audioEl.playCalls, 0);
});

test('changing a music genre exits ambient mode and resumes the selected stream', async t => {
  const player = createPlayer(t);
  player.bindEvents();
  player.toggleSourceMode();
  player.isPlaying = true;
  t.mock.method(globalThis, 'fetch', async () => response([track('selected')]));
  player.genreSelect.value = 'synthwave';
  player.genreSelect.dispatchEvent(new Event('change'));
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(player.sourceMode, 'audius');
  assert.equal(player.activeGenre, 'synthwave');
  assert.equal(player.tracks[0].id, 'selected');
  assert.equal(player.isPlaying, true);
  assert.equal(player.audioEl.playCalls, 1);
});

test('a failed stream stops playback with an error instead of switching sources or looping', async t => {
  const player = createPlayer(t);
  player.bindEvents();
  t.mock.method(globalThis, 'fetch', async () => response([track()]));
  await player.fetchTracks();
  player.play();
  player.audioEl.dispatchEvent(new Event('error'));
  assert.equal(player.isPlaying, false);
  assert.equal(player.sourceMode, 'audius');
  assert.equal(player.audioEl.playCalls, 1);
  assert.match(player.artistEl.textContent, /Unable to play/);
});

test('browser autoplay rejection keeps the track ready for a manual Play click', async t => {
  const player = createPlayer(t);
  t.mock.method(globalThis, 'fetch', async () => response([track()]));
  await player.fetchTracks();
  player.audioEl.play = () => Promise.reject(new DOMException('Blocked', 'NotAllowedError'));
  player.play();
  await Promise.resolve();
  assert.equal(player.isPlaying, false);
  assert.equal(player.sourceMode, 'audius');
  assert.equal(player.artistEl.textContent, 'Press Play to start audio.');
});

test('fresh mixes draw from a larger pool without duplicate or recently heard tracks', async t => {
  const player = createPlayer(t);
  const catalog = Array.from({ length: 50 }, (_, i) => track(`track-${i}`));
  player.recentTracks.lofi = catalog.slice(0, 15).map(t => t.id);
  t.mock.method(globalThis, 'fetch', async url => {
    assert.equal(new URL(url).searchParams.get('limit'), '100');
    return response([...catalog, catalog[20]]);
  });
  await player.fetchTracks();
  assert.equal(player.tracks.length, 15);
  assert.equal(new Set(player.tracks.map(t => t.id)).size, 15);
  assert.ok(player.tracks.every(t => !player.recentTracks.lofi.includes(t.id)));
});

test('heard tracks remain excluded after a page reload and histories stay separate per genre', async t => {
  const player = createPlayer(t);
  let saved;
  t.mock.method(localStorage, 'setItem', (key, value) => { saved = value; });
  t.mock.method(globalThis, 'fetch', async () => response([track('heard')]));
  await player.fetchTracks();
  player.play();
  await Promise.resolve();
  assert.deepEqual(JSON.parse(saved).lofi, ['heard']);
  t.mock.method(localStorage, 'getItem', key => key === 'v3_audius_recent_tracks' ? saved : null);
  const reloaded = new TestPlayer();
  const catalog = [track('heard'), ...Array.from({ length: 15 }, (_, i) => track(`new-${i}`))];
  assert.ok(reloaded.selectMix(catalog).every(t => t.id !== 'heard'));
  reloaded.activeGenre = 'jazz';
  assert.equal(reloaded.selectMix([track('heard')])[0].id, 'heard');
});

test('a small catalog still plays and avoids starting with the last song heard', t => {
  const player = createPlayer(t);
  player.recentTracks.lofi = ['first', 'last'];
  t.mock.method(Math, 'random', () => 0);
  const mix = player.selectMix([track('first'), track('last')]);
  assert.deepEqual(mix.map(t => t.id), ['first', 'last']);
  assert.deepEqual(player.selectMix([track('last')]).map(t => t.id), ['last']);
});

test('pause and resume keep the current track and position without another request', async t => {
  const player = createPlayer(t);
  const request = t.mock.method(globalThis, 'fetch', async () => response([track()]));
  await player.fetchTracks();
  player.togglePlay();
  player.audioEl.currentTime = 42;
  const currentUrl = player.audioEl.src;
  player.togglePlay();
  player.togglePlay();
  assert.equal(request.mock.callCount(), 1);
  assert.equal(player.audioEl.src, currentUrl);
  assert.equal(player.audioEl.currentTime, 42);
  assert.equal(player.isPlaying, true);
});

test('New mix loads another selection and resumes active playback', async t => {
  const player = createPlayer(t);
  player.bindEvents();
  const catalog = Array.from({ length: 40 }, (_, i) => track(`track-${i}`));
  const request = t.mock.method(globalThis, 'fetch', async () => response(catalog));
  await player.fetchTracks();
  player.play();
  await Promise.resolve();
  const previous = player.tracks[0].id;
  player.newMixBtn.dispatchEvent(new Event('click'));
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(request.mock.callCount(), 2);
  assert.equal(player.isPlaying, true);
  assert.ok(player.tracks.every(t => t.id !== previous));
});

test('finishing the queue loads fresh songs instead of looping the same selection', async t => {
  const player = createPlayer(t);
  player.bindEvents();
  const catalog = Array.from({ length: 40 }, (_, i) => track(`track-${i}`));
  const request = t.mock.method(globalThis, 'fetch', async () => response(catalog));
  await player.fetchTracks();
  const oldIds = player.tracks.map(t => t.id);
  for (let i = 0; i < player.tracks.length; i++) {
    player.currentTrackIndex = i;
    player.play();
    await Promise.resolve();
  }
  player.audioEl.dispatchEvent(new Event('ended'));
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(request.mock.callCount(), 2);
  assert.equal(player.currentTrackIndex, 0);
  assert.equal(player.isPlaying, true);
  assert.ok(player.tracks.every(t => !oldIds.includes(t.id)));
});

test('storage failures and malformed listening history do not prevent playback', async t => {
  const player = createPlayer(t);
  player.recentTracks.lofi = 'invalid';
  t.mock.method(localStorage, 'setItem', () => { throw new Error('Storage unavailable'); });
  t.mock.method(globalThis, 'fetch', async () => response([track()]));
  await player.fetchTracks();
  player.play();
  await Promise.resolve();
  assert.equal(player.isPlaying, true);
  assert.deepEqual(player.recentTracks.lofi, ['track-1']);
});
