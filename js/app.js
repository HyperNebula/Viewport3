/**
 * Viewport3 - Main Application Orchestrator
 */

import { FlowmodoroTimer } from './modules/flowmodoro.js';
import { AudiusPlayer } from './modules/audius.js';
import { Scratchpad } from './modules/scratchpad.js';
import { NewsFeed } from './modules/news.js';
import { UtilityDrawer } from './modules/drawer.js';

class EventBus {
  constructor() {
    this.listeners = {};
  }

  on(event, callback) {
    if (!this.listeners[event]) this.listeners[event] = [];
    this.listeners[event].push(callback);
  }

  off(event, callback) {
    if (!this.listeners[event]) return;
    this.listeners[event] = this.listeners[event].filter(cb => cb !== callback);
  }

  emit(event, data) {
    if (this.listeners[event]) {
      this.listeners[event].forEach(cb => {
        try {
          cb(data);
        } catch (err) {
          console.error(`Error in event listener for ${event}:`, err);
        }
      });
    }
  }
}

class App {
  constructor() {
    this.eventBus = new EventBus();
    this.themes = ['oled', 'nord', 'cyberpunk', 'amber'];
    this.currentTheme = localStorage.getItem('viewport3_theme') || 'oled';

    // DOM Header Elements
    this.clockEl = document.getElementById('header-clock');
    this.clockTzEl = document.getElementById('header-clock-tz');
    this.statusPillEl = document.getElementById('header-flow-status');
    this.themeSelect = document.getElementById('header-theme-select');
    this.fullscreenBtn = document.getElementById('header-fullscreen-btn');

    this.init();
  }

  init() {
    this.applyTheme(this.currentTheme);
    this.initClock();
    this.initModules();
    this.bindGlobalEvents();
  }

  applyTheme(themeName) {
    if (!this.themes.includes(themeName)) themeName = 'oled';
    this.currentTheme = themeName;
    document.documentElement.dataset.theme = themeName;
    localStorage.setItem('viewport3_theme', themeName);

    if (this.themeSelect) {
      this.themeSelect.value = themeName;
    }
  }

  cycleTheme() {
    const idx = this.themes.indexOf(this.currentTheme);
    const nextTheme = this.themes[(idx + 1) % this.themes.length];
    this.applyTheme(nextTheme);
  }

  initClock() {
    const update = () => {
      const now = new Date();
      const pad = n => String(n).padStart(2, '0');

      const hours = pad(now.getHours());
      const minutes = pad(now.getMinutes());
      const seconds = pad(now.getSeconds());

      // Timezone offset representation (e.g. UTC-7 or UTC+1)
      const offsetMinutes = -now.getTimezoneOffset();
      const offsetH = Math.floor(Math.abs(offsetMinutes) / 60);
      const offsetM = Math.abs(offsetMinutes) % 60;
      const sign = offsetMinutes >= 0 ? '+' : '-';
      const offsetStr = `UTC${sign}${offsetH}${offsetM > 0 ? `:${pad(offsetM)}` : ''}`;

      if (this.clockEl) {
        this.clockEl.textContent = `${hours}:${minutes}:${seconds}`;
      }
      if (this.clockTzEl) {
        this.clockTzEl.textContent = offsetStr;
      }
    };

    update();
    setInterval(update, 1000);
  }

  initModules() {
    // Instantiate all modules
    this.flowmodoro = new FlowmodoroTimer(this.eventBus);
    this.audius = new AudiusPlayer(this.eventBus);
    this.scratchpad = new Scratchpad();
    this.news = new NewsFeed();
    this.drawer = new UtilityDrawer();

    // Listen to flowmodoro status changes to update top bar
    this.eventBus.on('flowmodoro:status-change', data => {
      this.updateHeaderStatus(data);
    });
  }

  updateHeaderStatus(data) {
    if (!this.statusPillEl) return;
    const { state, formattedTime } = data;

    if (state === 'focus') {
      this.statusPillEl.className = 'header-status-pill status-focus';
      this.statusPillEl.innerHTML = `<span class="pulse-dot"></span> In Flow: ${formattedTime}`;
    } else if (state === 'break') {
      this.statusPillEl.className = 'header-status-pill status-break';
      this.statusPillEl.innerHTML = `<span class="pulse-dot"></span> On Break: ${formattedTime}`;
    } else {
      this.statusPillEl.className = 'header-status-pill status-idle';
      this.statusPillEl.innerHTML = `<span class="idle-dot"></span> Idle`;
    }
  }

  bindGlobalEvents() {
    // Theme select dropdown
    if (this.themeSelect) {
      this.themeSelect.addEventListener('change', e => {
        this.applyTheme(e.target.value);
      });
    }

    // Fullscreen toggle
    if (this.fullscreenBtn) {
      this.fullscreenBtn.addEventListener('click', () => {
        this.toggleFullscreen();
      });
    }

    // Keyboard Shortcuts
    window.addEventListener('keydown', e => {
      // Alt+T: Cycle Theme
      if (e.altKey && (e.key === 't' || e.key === 'T')) {
        e.preventDefault();
        this.cycleTheme();
      }
    });
  }

  toggleFullscreen() {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(err => {
        console.warn('Fullscreen request declined:', err.message);
      });
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      }
    }
  }
}

// Bootstrap on DOM Ready
window.addEventListener('DOMContentLoaded', () => {
  window.viewport3App = new App();
});
