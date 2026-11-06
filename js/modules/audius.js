/**
 * Viewport3 - Audius Music Player & Web Audio Ambient Sound Generator
 */

export class AudiusPlayer {
  constructor(eventBus) {
    this.eventBus = eventBus;

    // State
    this.sourceMode = 'audius'; // 'audius' | 'ambient'
    this.activeGenre = localStorage.getItem('v3_audius_genre') || 'lofi';
    this.volume = parseFloat(localStorage.getItem('v3_audius_vol') || '0.7');
    this.isMuted = localStorage.getItem('v3_audius_muted') === 'true';

    this.tracks = [];
    this.currentTrackIndex = 0;
    this.isPlaying = false;
    this.isLoading = false;
    this.trackRequestController = null;
    this.loadedStreamUrl = null;
    this.pausedAt = null;
    this.pausedPosition = 0;
    this.streamPlayback = null;
    this.streamRevision = 0;
    this.fadeInterval = null;
    this.recentTracks = {};
    try {
      const history = JSON.parse(localStorage.getItem('v3_audius_recent_tracks') || '{}');
      if (history && typeof history === 'object' && !Array.isArray(history)) this.recentTracks = history;
    } catch {}
    this.audioEl = new Audio();
    this.audioEl.crossOrigin = 'anonymous';

    // Ambient noise synth state
    this.audioCtx = null;
    this.ambientSourceNode = null;
    this.ambientGainNode = null;
    this.ambientType = 'rain'; // 'rain' | 'brown' | 'pink' | 'white'

    // Visualizer state
    this.visualizerCanvas = document.getElementById('audius-visualizer');
    this.canvasCtx = this.visualizerCanvas ? this.visualizerCanvas.getContext('2d') : null;
    this.analyser = null;
    this.audioSourceNode = null;
    this.animFrameId = null;

    // DOM Elements
    this.cardEl = document.getElementById('audius-card');
    this.titleEl = document.getElementById('audius-track-title');
    this.artistEl = document.getElementById('audius-track-artist');
    this.genreBadgeEl = document.getElementById('audius-genre-badge');
    this.artImgEl = document.getElementById('audius-artwork-img');
    this.artWrapperEl = document.getElementById('audius-art-wrapper');

    this.playBtn = document.getElementById('audius-play-btn');
    this.prevBtn = document.getElementById('audius-prev-btn');
    this.nextBtn = document.getElementById('audius-next-btn');

    this.timeCurrentEl = document.getElementById('audius-time-current');
    this.timeTotalEl = document.getElementById('audius-time-total');
    this.seekBar = document.getElementById('audius-seek-bar');
    this.volumeSlider = document.getElementById('audius-volume-slider');
    this.muteBtn = document.getElementById('audius-mute-btn');

    this.genreSelect = document.getElementById('audius-genre-select');
    this.newMixBtn = document.getElementById('audius-new-mix-btn');
    this.sourceToggleBtn = document.getElementById('audius-source-toggle-btn');
    this.ambientControls = document.getElementById('audius-ambient-controls');
    this.ambientPills = document.querySelectorAll('.ambient-preset-pill');

    // Audius Public Discovery Host
    this.discoveryHost = 'https://api.audius.co';

    // Genre Mappings for Audius
    this.GENRE_MAP = {
      lofi: { name: 'Lo-Fi Beats', genre: 'Lo-Fi' },
      synthwave: { name: 'Synthwave / Cyberpunk', search: 'synthwave' },
      ambient: { name: 'Ambient & Drone', genre: 'Ambient' },
      techno: { name: 'Deep Focus / Techno', genre: 'Techno' },
      chiptune: { name: 'Chiptune / 8-bit', genre: 'Electronic' },
      jazz: { name: 'Jazz', genre: 'Jazz' },
      classical: { name: 'Classical', genre: 'Classical' },
      downtempo: { name: 'Downtempo', genre: 'Downtempo' },
      deep_house: { name: 'Deep House', genre: 'Deep House' },
      drum_bass: { name: 'Drum & Bass', genre: 'Drum & Bass' }
    };

    this.defaultArtwork = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" fill="%231e293b"/><circle cx="50" cy="50" r="30" fill="%2338bdf8" opacity="0.8"/></svg>';

    this.init();
  }

  async init() {
    this.bindEvents();
    this.updateVolume();

    // Start Visualizer loop
    this.initVisualizer();

    // Listen to flowmodoro events
    if (this.eventBus) {
      this.eventBus.on('flowmodoro:break-start', data => {
        if (data && data.autoPause) {
          this.fadeOutAndPause(1500);
        }
      });

      this.eventBus.on('flowmodoro:focus-start', data => {
        if (data && data.autoResume && !this.isPlaying) {
          this.fadeInAndPlay(1200);
        }
      });
    }

    await this.fetchTracks();
  }

  bindEvents() {
    // Playback
    this.playBtn.addEventListener('click', () => this.togglePlay());
    this.prevBtn.addEventListener('click', () => this.prevTrack());
    this.nextBtn.addEventListener('click', () => this.nextTrack());

    // Audio element events
    this.audioEl.addEventListener('timeupdate', () => this.onTimeUpdate());
    this.audioEl.addEventListener('ended', () => this.nextTrack());
    this.audioEl.addEventListener('loadedmetadata', () => {
      this.timeTotalEl.textContent = this.formatTime(this.audioEl.duration);
      this.seekBar.max = Math.floor(this.audioEl.duration).toString();
    });
    this.audioEl.addEventListener('error', () => this.handlePlaybackError(this.audioEl.error));
    this.audioEl.addEventListener('waiting', () => this.watchStreamProgress());
    this.audioEl.addEventListener('stalled', () => this.watchStreamProgress());

    // Seek bar
    this.seekBar.addEventListener('input', () => {
      this.audioEl.currentTime = Number(this.seekBar.value);
      this.pausedPosition = this.audioEl.currentTime;
      if (this.streamPlayback) {
        this.streamPlayback.pendingSeek = null;
        clearTimeout(this.streamPlayback.watchdog);
        this.streamPlayback.watchdog = null;
        this.watchStreamProgress();
      }
    });

    // Volume
    this.volumeSlider.value = this.volume.toString();
    this.volumeSlider.addEventListener('input', () => {
      this.volume = parseFloat(this.volumeSlider.value);
      this.isMuted = false;
      this.updateVolume();
      localStorage.setItem('v3_audius_vol', this.volume.toString());
      localStorage.setItem('v3_audius_muted', 'false');
    });

    this.muteBtn.addEventListener('click', () => {
      this.isMuted = !this.isMuted;
      this.updateVolume();
      localStorage.setItem('v3_audius_muted', this.isMuted.toString());
    });

    // Genre selection
    if (this.genreSelect) {
      this.genreSelect.value = this.activeGenre;
      this.genreSelect.addEventListener('change', () => {
        this.activeGenre = this.genreSelect.value;
        localStorage.setItem('v3_audius_genre', this.activeGenre);
        this.newMix();
      });
    }

    this.newMixBtn?.addEventListener('click', () => this.newMix());

    // Source toggle (Audius Stream <-> Web Audio Ambient Synth)
    if (this.sourceToggleBtn) {
      this.sourceToggleBtn.addEventListener('click', () => {
        this.toggleSourceMode();
      });
    }

    // Ambient preset pills
    this.ambientPills.forEach(pill => {
      pill.addEventListener('click', () => {
        this.ambientPills.forEach(p => p.classList.remove('active'));
        pill.classList.add('active');
        this.ambientType = pill.dataset.ambient;
        if (this.sourceMode === 'ambient' && this.isPlaying) {
          this.startAmbientSynth();
        }
      });
    });

    // Global Space shortcut for play/pause when not in textarea or input
    window.addEventListener('keydown', e => {
      if (e.code === 'Space' && !['INPUT', 'TEXTAREA'].includes(e.target.tagName)) {
        e.preventDefault();
        this.togglePlay();
      }
    });
  }

  updateVolume() {
    const effectiveVol = this.isMuted ? 0 : this.volume;
    this.audioEl.volume = effectiveVol;

    if (this.ambientGainNode && this.audioCtx) {
      this.ambientGainNode.gain.setValueAtTime(effectiveVol * 0.35, this.audioCtx.currentTime);
    }

    if (this.isMuted || this.volume === 0) {
      this.muteBtn.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="1" y1="1" x2="23" y2="23"></line><path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6"></path><path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23"></path><line x1="12" y1="19" x2="12" y2="23"></line><line x1="8" y1="23" x2="16" y2="23"></line></svg>
      `;
      this.muteBtn.classList.add('text-muted');
    } else {
      this.muteBtn.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path></svg>
      `;
      this.muteBtn.classList.remove('text-muted');
    }
  }

  formatTime(sec) {
    if (!sec || isNaN(sec)) return '00:00';
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }

  newMix() {
    const wasPlaying = this.isPlaying;
    this.pause();
    if (this.sourceMode === 'ambient') this.toggleSourceMode();
    return this.fetchTracks(wasPlaying);
  }

  selectMix(tracks) {
    const shuffled = [...new Map(tracks.map(track => [String(track.id), track])).values()];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }

    const history = Array.isArray(this.recentTracks[this.activeGenre]) ? this.recentTracks[this.activeGenre] : [];
    const heard = new Set(history);
    const recent = new Set(history.slice(-15));
    const unheard = shuffled.filter(track => !heard.has(String(track.id)));
    const older = shuffled.filter(track => heard.has(String(track.id)) && !recent.has(String(track.id)));
    const repeats = shuffled.filter(track => recent.has(String(track.id)));
    const mix = [...unheard, ...older, ...repeats].slice(0, 15);

    // Small catalogs can run out of alternatives; avoid repeating the last song immediately.
    if (mix.length > 1 && String(mix[0].id) === history.at(-1)) [mix[0], mix[1]] = [mix[1], mix[0]];
    return mix;
  }

  rememberTrack(id, genre) {
    const history = Array.isArray(this.recentTracks[genre]) ? this.recentTracks[genre] : [];
    this.recentTracks[genre] = [...history.filter(previous => previous !== String(id)), String(id)].slice(-100);
    try {
      localStorage.setItem('v3_audius_recent_tracks', JSON.stringify(this.recentTracks));
    } catch {}
  }

  async fetchTracks(resumePlayback = false) {
    this.trackRequestController?.abort();
    const controller = new AbortController();
    this.trackRequestController = controller;
    const timeoutId = setTimeout(() => controller.abort(), 10000);
    const genreConfig = this.GENRE_MAP[this.activeGenre] || this.GENRE_MAP.lofi;
    const endpoint = genreConfig.search ? 'search' : 'trending';
    const params = new URLSearchParams({ app_name: 'viewport3', limit: '100' });
    params.set(genreConfig.search ? 'query' : 'genre', genreConfig.search || genreConfig.genre);
    const url = `${this.discoveryHost}/v1/tracks/${endpoint}?${params}`;

    this.pause();
    this.isLoading = true;
    this.tracks = [];
    this.currentTrackIndex = 0;
    this.audioEl.removeAttribute('src');
    this.audioEl.load();
    this.loadedStreamUrl = null;
    this.pausedAt = null;
    this.pausedPosition = 0;
    if (this.sourceMode === 'audius') this.showTrackStatus('Loading tracks...', '');

    try {
      const resp = await fetch(url, { signal: controller.signal });
      if (!resp.ok) throw new Error(`HTTP error ${resp.status}`);
      const data = await resp.json();
      if (this.trackRequestController !== controller) return;

      const playableTracks = Array.isArray(data?.data) ? data.data.filter(t =>
        t && t.id && t.is_streamable && t.access?.stream !== false && !t.is_stream_gated
      ) : [];
      if (playableTracks.length === 0) throw new Error('No playable tracks returned');

      this.tracks = this.selectMix(playableTracks).map(t => {
        let artwork = '';
        if (t.artwork) {
          artwork = t.artwork['480x480'] || t.artwork['150x150'] || Object.values(t.artwork)[0] || '';
        }
        return {
          id: t.id,
          title: t.title || 'Untitled Track',
          artist: (t.user && t.user.name) ? t.user.name : 'Unknown Artist',
          duration: t.duration || 180,
          artwork: artwork || this.defaultArtwork,
          streamUrl: `${this.discoveryHost}/v1/tracks/${t.id}/stream?app_name=viewport3`
        };
      });

      if (this.sourceMode === 'audius') this.displayTrack(this.tracks[0]);
    } catch (err) {
      if (this.trackRequestController !== controller) return;
      console.warn('Audius tracks unavailable:', err.message);
      if (this.sourceMode === 'audius') {
        this.showTrackStatus('No tracks available', 'Try another genre or use ambient sound.');
      }
    } finally {
      clearTimeout(timeoutId);
      if (this.trackRequestController === controller) {
        this.trackRequestController = null;
        this.isLoading = false;
      }
    }

    if (resumePlayback && this.tracks.length > 0 && this.sourceMode === 'audius') this.play();
  }

  showTrackStatus(title, message) {
    this.titleEl.textContent = title;
    this.artistEl.textContent = message;
    this.genreBadgeEl.textContent = (this.GENRE_MAP[this.activeGenre] || this.GENRE_MAP.lofi).name;
    this.artImgEl.src = this.defaultArtwork;
    this.timeCurrentEl.textContent = '00:00';
    this.timeTotalEl.textContent = '00:00';
    this.seekBar.value = '0';
    this.seekBar.max = '0';
  }

  displayTrack(track) {
    if (!track) {
      this.showTrackStatus(this.isLoading ? 'Loading tracks...' : 'No tracks available',
        this.isLoading ? '' : 'Try another genre or use ambient sound.');
      return;
    }
    this.titleEl.textContent = track.title;
    this.artistEl.textContent = track.artist;
    this.genreBadgeEl.textContent = this.sourceMode === 'ambient'
      ? `AMBIENT • ${this.ambientType.toUpperCase()}`
      : (this.GENRE_MAP[this.activeGenre] ? this.GENRE_MAP[this.activeGenre].name : 'LO-FI');

    if (track.artwork) {
      this.artImgEl.src = track.artwork;
      this.artImgEl.style.display = 'block';
    } else {
      this.artImgEl.src = this.defaultArtwork;
    }

    this.timeCurrentEl.textContent = '00:00';
    this.timeTotalEl.textContent = this.formatTime(track.duration);
    this.seekBar.value = '0';
    this.seekBar.max = track.duration ? track.duration.toString() : '180';
  }

  toggleSourceMode() {
    const wasPlaying = this.isPlaying;
    this.pause();

    if (this.sourceMode === 'audius') {
      this.sourceMode = 'ambient';
      this.sourceToggleBtn.textContent = '🎵 Switch to Audius Stream';
      this.ambientControls.style.display = 'flex';
      this.genreBadgeEl.textContent = `AMBIENT • ${this.ambientType.toUpperCase()}`;
      this.titleEl.textContent = `Generative ${this.ambientType.charAt(0).toUpperCase() + this.ambientType.slice(1)} Noise`;
      this.artistEl.textContent = 'Native Web Audio Synthesizer';
    } else {
      this.sourceMode = 'audius';
      this.sourceToggleBtn.textContent = '🌧️ Ambient Sound Generator';
      this.ambientControls.style.display = 'none';
      const cur = this.tracks[this.currentTrackIndex];
      this.displayTrack(cur);
    }

    if (wasPlaying) {
      this.play();
    }
  }

  togglePlay() {
    if (this.isPlaying) {
      this.pause();
    } else {
      this.play();
    }
  }

  play() {
    if (this.sourceMode === 'audius' && (this.isLoading || !this.tracks[this.currentTrackIndex]?.streamUrl)) return;
    this.cancelFade();
    this.updateVolume();
    this.cancelStreamPlayback();
    this.isPlaying = true;
    this.updatePlayBtnState(true);
    this.artWrapperEl.classList.add('playing');

    if (this.sourceMode === 'ambient') {
      this.startAmbientSynth();
    } else {
      const cur = this.tracks[this.currentTrackIndex];
      const sameStream = this.loadedStreamUrl === cur.streamUrl && Boolean(this.audioEl.src);
      const refresh = sameStream && (Boolean(this.audioEl.error) ||
        (this.pausedAt !== null && Date.now() - this.pausedAt >= 60000) ||
        Math.abs(this.audioEl.currentTime - this.pausedPosition) > 0.1);
      const playback = {
        track: cur, genre: this.activeGenre, generation: 0, retried: false,
        position: sameStream ? this.pausedPosition : 0,
        pendingSeek: null, metadataHandler: null, watchdog: null
      };
      this.streamPlayback = playback;
      this.pausedAt = null;
      this.startStreamPlayback(playback, refresh);
    }
  }

  cancelStreamPlayback() {
    const playback = this.streamPlayback;
    if (!playback) return;
    clearTimeout(playback.watchdog);
    if (playback.metadataHandler) this.audioEl.removeEventListener('loadedmetadata', playback.metadataHandler);
    this.streamPlayback = null;
  }

  isCurrentPlayback(playback, generation = playback?.generation) {
    return Boolean(playback && this.streamPlayback === playback && playback.generation === generation &&
      this.sourceMode === 'audius' && this.isPlaying);
  }

  startStreamPlayback(playback, refresh) {
    clearTimeout(playback.watchdog);
    playback.watchdog = null;
    if (playback.metadataHandler) this.audioEl.removeEventListener('loadedmetadata', playback.metadataHandler);
    const generation = ++playback.generation;
    const { track, genre } = playback;
    if (refresh || this.loadedStreamUrl !== track.streamUrl || !this.audioEl.src) {
      const url = new URL(track.streamUrl);
      if (refresh) {
        // Re-enter Audius discovery instead of reusing an old redirected stream.
        url.searchParams.set('_resume', `${Date.now()}-${++this.streamRevision}`);
        playback.retried = true;
      }
      playback.pendingSeek = playback.position > 0 ? playback.position : null;
      playback.metadataHandler = () => {
        if (!this.isCurrentPlayback(playback, generation)) return;
        if (playback.pendingSeek !== null) {
          const duration = this.audioEl.duration;
          const position = Number.isFinite(duration) && duration > 0
            ? Math.min(playback.pendingSeek, Math.max(0, duration - 0.1)) : playback.pendingSeek;
          this.audioEl.currentTime = position;
          this.timeCurrentEl.textContent = this.formatTime(position);
          this.seekBar.value = position.toString();
          playback.pendingSeek = null;
        }
      };
      this.audioEl.addEventListener('loadedmetadata', playback.metadataHandler, { once: true });
      this.loadedStreamUrl = track.streamUrl;
      this.audioEl.src = url.href;
      this.audioEl.load();
    }
    this.watchStreamProgress();
    this.audioEl.play().then(() => {
      if (!this.isCurrentPlayback(playback, generation)) return;
      this.artistEl.textContent = track.artist;
      this.rememberTrack(track.id, genre);
    }, error => {
      if (this.isCurrentPlayback(playback, generation)) this.handlePlaybackError(error);
    });
  }

  watchStreamProgress() {
    const playback = this.streamPlayback;
    if (!this.isCurrentPlayback(playback) || playback.watchdog !== null) return;
    playback.progressFrom = playback.pendingSeek ?? this.audioEl.currentTime;
    playback.watchdog = setTimeout(() => {
      playback.watchdog = null;
      if (!this.isCurrentPlayback(playback)) return;
      // A hidden page can delay timeupdate events even while audio advances.
      if (playback.pendingSeek === null && this.audioEl.currentTime > playback.progressFrom + 0.05) return;
      this.handlePlaybackError(new Error('Audio stream stalled'));
    }, 12000);
  }

  handlePlaybackError(error) {
    if (this.sourceMode !== 'audius' || !this.isPlaying || !error || error.name === 'AbortError') return;
    const playback = this.streamPlayback;
    if (playback && !playback.retried && error.name !== 'NotAllowedError') {
      playback.position = playback.pendingSeek ?? this.audioEl.currentTime;
      this.startStreamPlayback(playback, true);
      return;
    }
    console.warn('Audio playback error:', error);
    this.pause();
    this.artistEl.textContent = error?.name === 'NotAllowedError'
      ? 'Press Play to start audio.'
      : 'Unable to play this track. Try Next or ambient sound.';
  }

  pause() {
    this.cancelFade();
    if (this.sourceMode === 'audius') {
      this.pausedPosition = this.streamPlayback?.pendingSeek ?? this.audioEl.currentTime;
      if (this.isPlaying) this.pausedAt = Date.now();
    }
    this.cancelStreamPlayback();
    this.isPlaying = false;
    this.updatePlayBtnState(false);
    this.artWrapperEl.classList.remove('playing');

    if (this.sourceMode === 'ambient') {
      this.stopAmbientSynth();
    } else {
      this.audioEl.pause();
    }
  }

  fadeOutAndPause(durationMs = 1000) {
    if (!this.isPlaying) return;
    this.cancelFade();
    const initialVol = this.audioEl.volume;
    const steps = 20;
    const stepTime = durationMs / steps;
    let currentStep = 0;

    this.fadeInterval = setInterval(() => {
      currentStep++;
      const factor = 1 - currentStep / steps;
      if (this.sourceMode === 'ambient' && this.ambientGainNode && this.audioCtx) {
        this.ambientGainNode.gain.setValueAtTime(Math.max(0, initialVol * 0.35 * factor), this.audioCtx.currentTime);
      } else {
        this.audioEl.volume = Math.max(0, initialVol * factor);
      }

      if (currentStep >= steps) {
        this.cancelFade();
        this.pause();
        this.updateVolume(); // Restore target volume setting
      }
    }, stepTime);
  }

  fadeInAndPlay(durationMs = 1000) {
    this.play();
    if (!this.isPlaying) return;
    const targetVol = this.isMuted ? 0 : this.volume;
    const steps = 20;
    const stepTime = durationMs / steps;
    let currentStep = 0;

    this.audioEl.volume = 0;
    if (this.ambientGainNode && this.audioCtx) {
      this.ambientGainNode.gain.setValueAtTime(0, this.audioCtx.currentTime);
    }

    this.fadeInterval = setInterval(() => {
      currentStep++;
      const factor = currentStep / steps;
      if (this.sourceMode === 'ambient' && this.ambientGainNode && this.audioCtx) {
        this.ambientGainNode.gain.setValueAtTime(targetVol * 0.35 * factor, this.audioCtx.currentTime);
      } else {
        this.audioEl.volume = targetVol * factor;
      }

      if (currentStep >= steps) {
        this.cancelFade();
        this.updateVolume();
      }
    }, stepTime);
  }

  cancelFade() {
    if (this.fadeInterval !== null) clearInterval(this.fadeInterval);
    this.fadeInterval = null;
  }

  prevTrack() {
    if (this.sourceMode === 'ambient' || this.tracks.length === 0) return;
    this.currentTrackIndex = (this.currentTrackIndex - 1 + this.tracks.length) % this.tracks.length;
    const track = this.tracks[this.currentTrackIndex];
    this.displayTrack(track);
    if (this.isPlaying) {
      this.play();
    }
  }

  nextTrack() {
    if (this.sourceMode === 'ambient' || this.tracks.length === 0) return;
    if (this.currentTrackIndex === this.tracks.length - 1) return this.fetchTracks(this.isPlaying);
    this.currentTrackIndex++;
    const track = this.tracks[this.currentTrackIndex];
    this.displayTrack(track);
    if (this.isPlaying) {
      this.play();
    }
  }

  onTimeUpdate() {
    if (this.sourceMode === 'ambient') return;
    const cur = this.audioEl.currentTime;
    const playback = this.streamPlayback;
    if (this.isCurrentPlayback(playback) && playback.pendingSeek === null && cur > playback.progressFrom + 0.05) {
      clearTimeout(playback.watchdog);
      playback.watchdog = null;
    }
    this.timeCurrentEl.textContent = this.formatTime(cur);
    if (!this.seekBar.matches(':active')) {
      this.seekBar.value = Math.floor(cur).toString();
    }
  }

  updatePlayBtnState(playing) {
    if (playing) {
      this.playBtn.innerHTML = `
        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"></rect><rect x="14" y="4" width="4" height="16"></rect></svg>
      `;
      this.playBtn.title = 'Pause (Space)';
    } else {
      this.playBtn.innerHTML = `
        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
      `;
      this.playBtn.title = 'Play (Space)';
    }
  }

  // --- Web Audio Synthesizer: Rain, Brown, Pink & White Noise ---
  getAudioContext() {
    if (!this.audioCtx || this.audioCtx.state === 'closed') {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      this.audioCtx = new AudioCtx();
    }
    if (this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }
    return this.audioCtx;
  }

  startAmbientSynth() {
    this.stopAmbientSynth();
    const ctx = this.getAudioContext();
    const bufferSize = 2 * ctx.sampleRate;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);

    if (this.ambientType === 'white') {
      // White noise: flat random spectrum
      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
      }
    } else if (this.ambientType === 'pink') {
      // Pink noise (Paul Kellet's filtered method)
      let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
      for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        b0 = 0.99886 * b0 + white * 0.0555179;
        b1 = 0.99332 * b1 + white * 0.0750759;
        b2 = 0.96900 * b2 + white * 0.1538520;
        b3 = 0.86650 * b3 + white * 0.3104856;
        b4 = 0.55000 * b4 + white * 0.5329522;
        b5 = -0.7616 * b5 - white * 0.0168980;
        data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.11;
        b6 = white * 0.115926;
      }
    } else if (this.ambientType === 'brown') {
      // Brown noise: integrated random walk
      let lastOut = 0.0;
      for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        data[i] = (lastOut + 0.02 * white) / 1.02;
        lastOut = data[i];
        data[i] *= 3.5; // Gain boost
      }
    } else {
      // Rain mode: Brown noise rumble + high frequency soft droplets
      let lastOut = 0.0;
      for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        // Low rumble
        let brown = (lastOut + 0.02 * white) / 1.02;
        lastOut = brown;
        // Droplets: occasional bursts
        const droplet = Math.random() > 0.997 ? (Math.random() * 0.8) : 0;
        data[i] = (brown * 2.5) + droplet;
      }
    }

    const noiseSource = ctx.createBufferSource();
    noiseSource.buffer = buffer;
    noiseSource.loop = true;

    // Filter to soften ambient noise
    const filter = ctx.createBiquadFilter();
    filter.type = this.ambientType === 'white' ? 'lowpass' : 'bandpass';
    filter.frequency.setValueAtTime(this.ambientType === 'rain' ? 800 : 450, ctx.currentTime);
    filter.Q.setValueAtTime(1.0, ctx.currentTime);

    const gainNode = ctx.createGain();
    const targetVol = this.isMuted ? 0 : this.volume * 0.35;
    gainNode.gain.setValueAtTime(targetVol, ctx.currentTime);

    noiseSource.connect(filter);
    filter.connect(gainNode);
    gainNode.connect(ctx.destination);

    // Also connect to visualizer analyser
    if (this.analyser) {
      gainNode.connect(this.analyser);
    }

    noiseSource.start();
    this.ambientSourceNode = noiseSource;
    this.ambientGainNode = gainNode;
  }

  stopAmbientSynth() {
    if (this.ambientSourceNode) {
      try {
        this.ambientSourceNode.stop();
        this.ambientSourceNode.disconnect();
      } catch {}
      this.ambientSourceNode = null;
    }
  }

  // --- Real-time Canvas Audio Visualizer ---
  initVisualizer() {
    if (!this.visualizerCanvas || !this.canvasCtx) return;

    // Set canvas dimensions
    const resizeCanvas = () => {
      this.visualizerCanvas.width = this.visualizerCanvas.clientWidth * window.devicePixelRatio || 260;
      this.visualizerCanvas.height = this.visualizerCanvas.clientHeight * window.devicePixelRatio || 48;
    };
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    // Setup Analyser
    try {
      const ctx = this.getAudioContext();
      this.analyser = ctx.createAnalyser();
      this.analyser.fftSize = 64;
    } catch {}

    const bufferLength = 32;
    const dataArray = new Uint8Array(bufferLength);
    let proceduralTime = 0;

    const render = () => {
      this.animFrameId = requestAnimationFrame(render);
      const width = this.visualizerCanvas.width;
      const height = this.visualizerCanvas.height;

      this.canvasCtx.clearRect(0, 0, width, height);

      if (this.isPlaying) {
        proceduralTime += 0.08;
        if (this.analyser) {
          this.analyser.getByteFrequencyData(dataArray);
        }

        const barCount = 24;
        const barWidth = width / barCount - 2;

        for (let i = 0; i < barCount; i++) {
          // Combine analyser data or procedural harmonic wave
          const freqVal = dataArray[i % bufferLength] || 0;
          const waveHeight = Math.sin(proceduralTime + i * 0.35) * 0.5 + 0.5;
          const effectiveHeight = Math.max(4, (freqVal / 255) * height * 0.85 + (waveHeight * height * 0.25));

          const x = i * (barWidth + 2);
          const y = height - effectiveHeight;

          // Gradient color styling matching active theme
          const grad = this.canvasCtx.createLinearGradient(0, height, 0, 0);
          grad.addColorStop(0, 'rgba(56, 189, 248, 0.2)');
          grad.addColorStop(1, 'rgba(56, 189, 248, 0.9)');

          this.canvasCtx.fillStyle = grad;
          this.canvasCtx.beginPath();
          this.canvasCtx.roundRect ? this.canvasCtx.roundRect(x, y, barWidth, effectiveHeight, 2) : this.canvasCtx.rect(x, y, barWidth, effectiveHeight);
          this.canvasCtx.fill();
        }
      } else {
        // Idle gentle baseline pulse
        this.canvasCtx.fillStyle = 'rgba(100, 116, 139, 0.2)';
        this.canvasCtx.fillRect(0, height - 2, width, 2);
      }
    };

    render();
  }
}
