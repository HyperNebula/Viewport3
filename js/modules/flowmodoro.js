/**
 * Viewport3 - Flowmodoro Timer & Chime Synthesizer
 */

export class FlowmodoroTimer {
  constructor(eventBus) {
    this.eventBus = eventBus;

    // State
    this.mode = localStorage.getItem('v3_timer_mode') || 'flowmodoro'; // 'flowmodoro' | 'classic'
    this.ratio = parseInt(localStorage.getItem('v3_timer_ratio') || '5', 10); // 5 means 5:1
    this.autoPauseMusic = localStorage.getItem('v3_timer_autopause') !== 'false';
    this.autoResumeMusic = localStorage.getItem('v3_timer_autoresume') === 'true';
    this.soundAlerts = localStorage.getItem('v3_timer_sound') !== 'false';

    this.classicFocusDuration = parseInt(localStorage.getItem('v3_classic_focus') || '25', 10) * 60;
    this.classicBreakDuration = parseInt(localStorage.getItem('v3_classic_break') || '5', 10) * 60;

    this.state = 'idle'; // 'idle' | 'focus' | 'break'
    this.elapsedSeconds = 0; // In flowmodoro focus: count up. In break / classic: remaining seconds.
    this.timerInterval = null;
    this.earnedBreakSeconds = 0;

    // Daily stats
    this.loadStats();

    // Web Audio Context for Chime
    this.audioCtx = null;

    // DOM Elements
    this.cardEl = document.getElementById('flowmodoro-card');
    this.timerDisplayEl = document.getElementById('flowmodoro-digits');
    this.statusBadgeEl = document.getElementById('flowmodoro-status-badge');
    this.modeBadgeEl = document.getElementById('flowmodoro-mode-badge');
    this.ratioDisplayEl = document.getElementById('flowmodoro-ratio-display');
    this.earnedDisplayEl = document.getElementById('flowmodoro-earned-display');

    this.startBtn = document.getElementById('flowmodoro-start-btn');
    this.breakBtn = document.getElementById('flowmodoro-break-btn');
    this.resetBtn = document.getElementById('flowmodoro-reset-btn');
    this.settingsBtn = document.getElementById('flowmodoro-settings-btn');

    this.statsFocusEl = document.getElementById('flowmodoro-stats-focus');
    this.statsSessionsEl = document.getElementById('flowmodoro-stats-sessions');

    // Settings Modal
    this.settingsModal = document.getElementById('timer-settings-modal');
    this.closeSettingsBtn = document.getElementById('close-timer-settings-btn');
    this.ratioSelect = document.getElementById('setting-ratio-select');
    this.modeSelect = document.getElementById('setting-mode-select');
    this.autopauseCheck = document.getElementById('setting-autopause-check');
    this.autoresumeCheck = document.getElementById('setting-autoresume-check');
    this.soundCheck = document.getElementById('setting-sound-check');
    this.testChimeBtn = document.getElementById('setting-test-chime-btn');

    this.init();
  }

  init() {
    this.bindEvents();
    this.updateUI();
    this.requestNotificationPermission();
  }

  loadStats() {
    const today = new Date().toISOString().split('T')[0];
    const savedDate = localStorage.getItem('v3_stats_date');

    if (savedDate !== today) {
      this.todayFocusSeconds = 0;
      this.sessionsCompleted = 0;
      this.saveStats();
    } else {
      this.todayFocusSeconds = parseInt(localStorage.getItem('v3_stats_focus_sec') || '0', 10);
      this.sessionsCompleted = parseInt(localStorage.getItem('v3_stats_sessions') || '0', 10);
    }
  }

  saveStats() {
    const today = new Date().toISOString().split('T')[0];
    localStorage.setItem('v3_stats_date', today);
    localStorage.setItem('v3_stats_focus_sec', this.todayFocusSeconds.toString());
    localStorage.setItem('v3_stats_sessions', this.sessionsCompleted.toString());
  }

  saveSettings() {
    localStorage.setItem('v3_timer_mode', this.mode);
    localStorage.setItem('v3_timer_ratio', this.ratio.toString());
    localStorage.setItem('v3_timer_autopause', this.autoPauseMusic.toString());
    localStorage.setItem('v3_timer_autoresume', this.autoResumeMusic.toString());
    localStorage.setItem('v3_timer_sound', this.soundAlerts.toString());
  }

  formatTime(totalSec) {
    totalSec = Math.max(0, Math.floor(totalSec));
    const h = Math.floor(totalSec / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const s = totalSec % 60;
    const pad = n => String(n).padStart(2, '0');

    if (h > 0) {
      return `${pad(h)}:${pad(m)}:${pad(s)}`;
    }
    return `${pad(m)}:${pad(s)}`;
  }

  formatDuration(seconds) {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    if (h > 0) {
      return `${h}h ${m}m`;
    }
    return `${m}m`;
  }

  bindEvents() {
    this.startBtn.addEventListener('click', () => this.toggleFocus());
    this.breakBtn.addEventListener('click', () => this.startBreak());
    this.resetBtn.addEventListener('click', () => this.reset());

    // Settings
    this.settingsBtn.addEventListener('click', () => this.openSettings());
    if (this.closeSettingsBtn) {
      this.closeSettingsBtn.addEventListener('click', () => this.closeSettings());
    }

    if (this.ratioSelect) {
      this.ratioSelect.value = this.ratio.toString();
      this.ratioSelect.addEventListener('change', () => {
        this.ratio = parseInt(this.ratioSelect.value, 10);
        this.saveSettings();
        this.updateUI();
      });
    }

    if (this.modeSelect) {
      this.modeSelect.value = this.mode;
      this.modeSelect.addEventListener('change', () => {
        this.mode = this.modeSelect.value;
        this.saveSettings();
        this.reset();
      });
    }

    if (this.autopauseCheck) {
      this.autopauseCheck.checked = this.autoPauseMusic;
      this.autopauseCheck.addEventListener('change', () => {
        this.autoPauseMusic = this.autopauseCheck.checked;
        this.saveSettings();
      });
    }

    if (this.autoresumeCheck) {
      this.autoresumeCheck.checked = this.autoResumeMusic;
      this.autoresumeCheck.addEventListener('change', () => {
        this.autoResumeMusic = this.autoresumeCheck.checked;
        this.saveSettings();
      });
    }

    if (this.soundCheck) {
      this.soundCheck.checked = this.soundAlerts;
      this.soundCheck.addEventListener('change', () => {
        this.soundAlerts = this.soundCheck.checked;
        this.saveSettings();
      });
    }

    if (this.testChimeBtn) {
      this.testChimeBtn.addEventListener('click', () => {
        this.playZenChime();
      });
    }

    // Keyboard shortcut: Alt+F to toggle focus
    window.addEventListener('keydown', e => {
      if (e.altKey && (e.key === 'f' || e.key === 'F')) {
        e.preventDefault();
        this.toggleFocus();
      }
    });
  }

  requestNotificationPermission() {
    if ('Notification' in window && Notification.permission === 'default') {
      // Prompt casually after user interaction
      const promptOnce = () => {
        Notification.requestPermission();
        window.removeEventListener('click', promptOnce);
      };
      window.addEventListener('click', promptOnce, { once: true });
    }
  }

  notify(title, body) {
    if ('Notification' in window && Notification.permission === 'granted') {
      try {
        new Notification(title, {
          body,
          icon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="50" cy="50" r="45" fill="%2338bdf8"/></svg>'
        });
      } catch {}
    }
  }

  // Web Audio Zen Bell Chime Synthesizer
  playZenChime() {
    if (!this.soundAlerts) return;
    try {
      const AudioCtxClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtxClass) return;
      if (!this.audioCtx || this.audioCtx.state === 'closed') {
        this.audioCtx = new AudioCtxClass();
      }
      if (this.audioCtx.state === 'suspended') {
        this.audioCtx.resume();
      }

      const now = this.audioCtx.currentTime;

      // Harmonic bell overtone frequencies (D5 chord tone: 587.33Hz, 880Hz, 1174.66Hz)
      const freqs = [587.33, 880.0, 1174.66, 1760.0];
      const gains = [0.4, 0.25, 0.15, 0.08];

      freqs.forEach((freq, i) => {
        const osc = this.audioCtx.createOscillator();
        const gainNode = this.audioCtx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now);

        // Exponential decay envelope
        gainNode.gain.setValueAtTime(0.001, now);
        gainNode.gain.linearRampToValueAtTime(gains[i], now + 0.03 + (i * 0.01));
        gainNode.gain.exponentialRampToValueAtTime(0.0001, now + 2.5 + (i * 0.4));

        osc.connect(gainNode);
        gainNode.connect(this.audioCtx.destination);

        osc.start(now);
        osc.stop(now + 3.0);
      });
    } catch (err) {
      console.warn('Web Audio chime synth warning:', err);
    }
  }

  toggleFocus() {
    if (this.state === 'focus') {
      this.pause();
    } else {
      this.startFocus();
    }
  }

  startFocus() {
    if (this.state === 'break') {
      // Switching from break directly to focus
      this.stopTimer();
    }

    this.state = 'focus';
    this.cardEl.classList.remove('state-break', 'state-idle');
    this.cardEl.classList.add('state-focus');

    if (this.mode === 'classic' && this.elapsedSeconds === 0) {
      this.elapsedSeconds = this.classicFocusDuration;
    }

    this.startTimerInterval();
    this.updateUI();

    // Emit event
    if (this.eventBus) {
      this.eventBus.emit('flowmodoro:focus-start', {
        autoResume: this.autoResumeMusic
      });
      this.emitStatusChange();
    }
  }

  pause() {
    this.stopTimer();
    this.state = 'idle';
    this.cardEl.classList.remove('state-focus', 'state-break');
    this.cardEl.classList.add('state-idle');
    this.updateUI();
    this.emitStatusChange();
  }

  startBreak() {
    if (this.state === 'break') return;

    if (this.mode === 'flowmodoro') {
      // Compute earned break based on ratio
      const earned = Math.floor(this.elapsedSeconds / this.ratio);
      if (earned <= 0) {
        alert('You need at least 1 second of focus time before taking an earned break!');
        return;
      }
      this.earnedBreakSeconds = earned;
      this.elapsedSeconds = earned; // Now counting down!
    } else {
      // Classic Pomodoro break
      this.elapsedSeconds = this.classicBreakDuration;
    }

    // Save focus session stats
    this.sessionsCompleted++;
    this.saveStats();

    this.stopTimer();
    this.state = 'break';
    this.cardEl.classList.remove('state-focus', 'state-idle');
    this.cardEl.classList.add('state-break');

    this.startTimerInterval();
    this.updateUI();

    // Auto-pause music
    if (this.eventBus) {
      this.eventBus.emit('flowmodoro:break-start', {
        autoPause: this.autoPauseMusic
      });
      this.emitStatusChange();
    }
  }

  startTimerInterval() {
    if (this.timerInterval) clearInterval(this.timerInterval);

    this.timerInterval = setInterval(() => {
      if (this.state === 'focus') {
        if (this.mode === 'flowmodoro') {
          // Flowmodoro counts UP
          this.elapsedSeconds++;
          this.todayFocusSeconds++;
          if (this.elapsedSeconds % 10 === 0) this.saveStats();
        } else {
          // Classic counts DOWN
          this.elapsedSeconds--;
          this.todayFocusSeconds++;
          if (this.elapsedSeconds <= 0) {
            this.handleClassicFocusComplete();
            return;
          }
        }
      } else if (this.state === 'break') {
        // Break always counts DOWN
        this.elapsedSeconds--;
        if (this.elapsedSeconds <= 0) {
          this.handleBreakComplete();
          return;
        }
      }

      this.updateUI();
      this.emitStatusChange();
    }, 1000);
  }

  stopTimer() {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
  }

  reset() {
    this.stopTimer();
    this.state = 'idle';
    this.elapsedSeconds = 0;
    this.earnedBreakSeconds = 0;
    this.cardEl.classList.remove('state-focus', 'state-break');
    this.cardEl.classList.add('state-idle');
    this.updateUI();
    this.emitStatusChange();
  }

  handleBreakComplete() {
    this.stopTimer();
    this.state = 'idle';
    this.elapsedSeconds = 0;
    this.cardEl.classList.remove('state-break');
    this.cardEl.classList.add('state-idle');

    this.playZenChime();
    this.notify('Break Complete! 🔔', 'Your break has finished. Ready to get back into deep flow?');

    this.updateUI();
    this.emitStatusChange();

    if (this.eventBus) {
      this.eventBus.emit('flowmodoro:break-end');
    }
  }

  handleClassicFocusComplete() {
    this.stopTimer();
    this.sessionsCompleted++;
    this.saveStats();
    this.playZenChime();
    this.notify('Focus Session Done! 🎯', 'Great work. Time to take a well-deserved break!');
    this.startBreak();
  }

  emitStatusChange() {
    if (!this.eventBus) return;
    this.eventBus.emit('flowmodoro:status-change', {
      state: this.state,
      mode: this.mode,
      formattedTime: this.formatTime(this.elapsedSeconds),
      elapsedSeconds: this.elapsedSeconds
    });
  }

  updateUI() {
    // Digits
    this.timerDisplayEl.textContent = this.formatTime(this.elapsedSeconds);

    // Badges & Info
    if (this.mode === 'flowmodoro') {
      this.modeBadgeEl.textContent = 'FLOWMODORO (COUNT-UP)';
      this.ratioDisplayEl.textContent = `Ratio: ${this.ratio}:1`;

      if (this.state === 'focus') {
        const earned = Math.floor(this.elapsedSeconds / this.ratio);
        this.earnedDisplayEl.textContent = `Earned Break: ${this.formatTime(earned)}`;
        this.statusBadgeEl.textContent = 'DEEP FOCUS';
        this.statusBadgeEl.className = 'status-pill status-focus';
      } else if (this.state === 'break') {
        this.earnedDisplayEl.textContent = `Resting duration...`;
        this.statusBadgeEl.textContent = 'ON BREAK';
        this.statusBadgeEl.className = 'status-pill status-break';
      } else {
        this.earnedDisplayEl.textContent = `Earned Break: 00:00`;
        this.statusBadgeEl.textContent = 'IDLE';
        this.statusBadgeEl.className = 'status-pill status-idle';
      }
    } else {
      this.modeBadgeEl.textContent = 'CLASSIC POMODORO';
      this.ratioDisplayEl.textContent = `25m / 5m Interval`;
      this.earnedDisplayEl.textContent = this.state === 'break' ? 'Break Countdown' : 'Focus Countdown';

      if (this.state === 'focus') {
        this.statusBadgeEl.textContent = 'POMODORO FOCUS';
        this.statusBadgeEl.className = 'status-pill status-focus';
      } else if (this.state === 'break') {
        this.statusBadgeEl.textContent = 'POMODORO BREAK';
        this.statusBadgeEl.className = 'status-pill status-break';
      } else {
        this.statusBadgeEl.textContent = 'READY';
        this.statusBadgeEl.className = 'status-pill status-idle';
      }
    }

    // Button states
    if (this.state === 'focus') {
      this.startBtn.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"></rect><rect x="14" y="4" width="4" height="16"></rect></svg>
        Pause
      `;
      this.startBtn.className = 'btn btn-primary btn-lg';
      this.breakBtn.disabled = this.elapsedSeconds < (this.mode === 'flowmodoro' ? this.ratio : 10);
    } else if (this.state === 'break') {
      this.startBtn.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
        Back to Focus
      `;
      this.startBtn.className = 'btn btn-primary btn-lg';
      this.breakBtn.disabled = true;
    } else {
      this.startBtn.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
        Start Focus
      `;
      this.startBtn.className = 'btn btn-primary btn-lg';
      this.breakBtn.disabled = this.elapsedSeconds === 0;
    }

    // Stats
    this.statsFocusEl.textContent = this.formatDuration(this.todayFocusSeconds);
    this.statsSessionsEl.textContent = `${this.sessionsCompleted} session${this.sessionsCompleted === 1 ? '' : 's'}`;
  }

  openSettings() {
    if (this.settingsModal) {
      this.settingsModal.classList.add('visible');
    }
  }

  closeSettings() {
    if (this.settingsModal) {
      this.settingsModal.classList.remove('visible');
    }
  }
}
