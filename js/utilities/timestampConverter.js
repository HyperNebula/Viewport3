/**
 * Viewport3 - Unix Timestamp & Multi-Timezone Converter Utility
 */

export function initTimestampConverter(container) {
  container.innerHTML = `
    <div class="util-header">
      <div class="util-title-group">
        <h3>Unix Timestamp & Timezones</h3>
        <span class="util-badge">Epoch & Clocks</span>
      </div>
      <div class="util-actions">
        <button id="ts-now-btn" class="btn btn-xs btn-primary">Refresh Now</button>
      </div>
    </div>

    <div class="util-body">
      <!-- Live Epoch Cards -->
      <div class="ts-live-grid">
        <div class="ts-live-card">
          <div class="ts-card-label">CURRENT UNIX TIME (SECONDS)</div>
          <div class="ts-card-value-row">
            <span id="ts-live-sec" class="ts-live-digits">--</span>
            <button class="btn btn-xs btn-outline ts-copy-btn" data-target="ts-live-sec" title="Copy Seconds">Copy</button>
          </div>
        </div>
        <div class="ts-live-card">
          <div class="ts-card-label">CURRENT UNIX TIME (MILLISECONDS)</div>
          <div class="ts-card-value-row">
            <span id="ts-live-ms" class="ts-live-digits">--</span>
            <button class="btn btn-xs btn-outline ts-copy-btn" data-target="ts-live-ms" title="Copy Milliseconds">Copy</button>
          </div>
        </div>
      </div>

      <!-- Converter Section -->
      <div class="ts-converter-box">
        <label class="util-section-label">Convert Timestamp $\leftrightarrow$ Human Date</label>
        
        <div class="ts-input-row">
          <div class="input-labeled">
            <span class="input-prefix">Timestamp</span>
            <input type="text" id="ts-input-val" class="code-input" placeholder="Enter seconds or milliseconds...">
          </div>
          <div class="btn-group">
            <button id="ts-set-now-btn" class="btn btn-sm btn-secondary">Now</button>
            <button id="ts-plus-1h-btn" class="btn btn-sm btn-secondary">+1h</button>
            <button id="ts-plus-1d-btn" class="btn btn-sm btn-secondary">+1d</button>
          </div>
        </div>

        <div class="ts-results-grid">
          <div class="ts-result-item">
            <span class="ts-res-label">ISO 8601 (UTC):</span>
            <code id="ts-res-iso" class="ts-res-val">--</code>
            <button class="copy-icon-btn" data-copy="ts-res-iso" title="Copy">📋</button>
          </div>
          <div class="ts-result-item">
            <span class="ts-res-label">Local Time:</span>
            <code id="ts-res-local" class="ts-res-val">--</code>
            <button class="copy-icon-btn" data-copy="ts-res-local" title="Copy">📋</button>
          </div>
          <div class="ts-result-item">
            <span class="ts-res-label">UTC String:</span>
            <code id="ts-res-utc" class="ts-res-val">--</code>
            <button class="copy-icon-btn" data-copy="ts-res-utc" title="Copy">📋</button>
          </div>
          <div class="ts-result-item">
            <span class="ts-res-label">Relative:</span>
            <span id="ts-res-relative" class="ts-res-badge">--</span>
          </div>
        </div>
      </div>

      <!-- Human to Timestamp Section -->
      <div class="ts-human-box">
        <label class="util-section-label">Date Picker to Unix Timestamp</label>
        <div class="ts-human-row">
          <input type="datetime-local" id="ts-human-input" class="code-input">
          <div class="ts-human-output">
            <span>Sec: <code id="ts-human-sec">--</code></span>
            <span>Ms: <code id="ts-human-ms">--</code></span>
          </div>
        </div>
      </div>

      <!-- World Timezone Board -->
      <div class="ts-tz-board">
        <div class="util-section-header">
          <label class="util-section-label">Global Timezone Board</label>
          <span class="text-muted text-xs" id="ts-tz-update-time">Auto-updating</span>
        </div>
        <div class="tz-grid" id="tz-cards-grid">
          <!-- Dynamically populated timezone cards -->
        </div>
      </div>
    </div>
  `;

  const liveSecEl = container.querySelector('#ts-live-sec');
  const liveMsEl = container.querySelector('#ts-live-ms');
  const inputValEl = container.querySelector('#ts-input-val');
  const resIsoEl = container.querySelector('#ts-res-iso');
  const resLocalEl = container.querySelector('#ts-res-local');
  const resUtcEl = container.querySelector('#ts-res-utc');
  const resRelativeEl = container.querySelector('#ts-res-relative');
  const humanInputEl = container.querySelector('#ts-human-input');
  const humanSecEl = container.querySelector('#ts-human-sec');
  const humanMsEl = container.querySelector('#ts-human-ms');
  const tzCardsGrid = container.querySelector('#tz-cards-grid');

  const TIMEZONES = [
    { name: 'Local', tz: undefined, flag: '📍' },
    { name: 'UTC', tz: 'UTC', flag: '🌐' },
    { name: 'San Francisco (PT)', tz: 'America/Los_Angeles', flag: '🌉' },
    { name: 'New York (ET)', tz: 'America/New_York', flag: '🗽' },
    { name: 'London (GMT/BST)', tz: 'Europe/London', flag: '🇬🇧' },
    { name: 'Berlin / Paris (CET)', tz: 'Europe/Berlin', flag: '🇪🇺' },
    { name: 'Tokyo (JST)', tz: 'Asia/Tokyo', flag: '🇯🇵' },
    { name: 'Sydney (AEST)', tz: 'Australia/Sydney', flag: '🇦🇺' }
  ];

  function formatRelative(msDiff) {
    const isFuture = msDiff > 0;
    const diffSec = Math.floor(Math.abs(msDiff) / 1000);

    if (diffSec < 5) return 'Just now';
    if (diffSec < 60) return isFuture ? `in ${diffSec} seconds` : `${diffSec} seconds ago`;

    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return isFuture ? `in ${diffMin}m` : `${diffMin}m ago`;

    const diffHours = Math.floor(diffMin / 60);
    if (diffHours < 24) return isFuture ? `in ${diffHours}h` : `${diffHours}h ago`;

    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 30) return isFuture ? `in ${diffDays} days` : `${diffDays} days ago`;

    const diffMonths = Math.floor(diffDays / 30);
    return isFuture ? `in ${diffMonths} months` : `${diffMonths} months ago`;
  }

  function updateLiveClock() {
    const now = Date.now();
    const sec = Math.floor(now / 1000);
    if (liveSecEl) liveSecEl.textContent = sec.toString();
    if (liveMsEl) liveMsEl.textContent = now.toString();
    renderTimezoneGrid();
  }

  function convertTimestampInput() {
    let raw = inputValEl.value.trim();
    if (!raw) {
      resIsoEl.textContent = '--';
      resLocalEl.textContent = '--';
      resUtcEl.textContent = '--';
      resRelativeEl.textContent = '--';
      return;
    }

    let num = Number(raw);
    if (isNaN(num)) {
      resIsoEl.textContent = 'Invalid number';
      resLocalEl.textContent = 'Invalid number';
      resUtcEl.textContent = 'Invalid number';
      resRelativeEl.textContent = 'Invalid';
      return;
    }

    // Heuristic: if <= 10 digits (under 100,000,000,000), it's seconds
    let ms = num < 100000000000 ? num * 1000 : num;
    const date = new Date(ms);

    if (isNaN(date.getTime())) {
      resIsoEl.textContent = 'Out of range';
      resLocalEl.textContent = 'Out of range';
      resUtcEl.textContent = 'Out of range';
      resRelativeEl.textContent = 'Out of range';
      return;
    }

    resIsoEl.textContent = date.toISOString();
    resLocalEl.textContent = date.toLocaleString();
    resUtcEl.textContent = date.toUTCString();

    const diff = ms - Date.now();
    resRelativeEl.textContent = formatRelative(diff);
  }

  function renderTimezoneGrid() {
    const now = new Date();
    tzCardsGrid.innerHTML = '';

    TIMEZONES.forEach(tzObj => {
      const card = document.createElement('div');
      card.className = 'tz-card';

      const options = {
        timeZone: tzObj.tz,
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
      };

      const dateOptions = {
        timeZone: tzObj.tz,
        weekday: 'short',
        month: 'short',
        day: 'numeric'
      };

      let timeStr = '--';
      let dateStr = '--';
      try {
        timeStr = new Intl.DateTimeFormat('en-US', options).format(now);
        dateStr = new Intl.DateTimeFormat('en-US', dateOptions).format(now);
      } catch {
        timeStr = now.toLocaleTimeString();
        dateStr = now.toLocaleDateString();
      }

      card.innerHTML = `
        <div class="tz-card-header">
          <span class="tz-flag">${tzObj.flag}</span>
          <span class="tz-name">${tzObj.name}</span>
        </div>
        <div class="tz-time">${timeStr}</div>
        <div class="tz-date">${dateStr}</div>
      `;
      tzCardsGrid.appendChild(card);
    });
  }

  function setupHumanInput() {
    const now = new Date();
    // format as YYYY-MM-DDTHH:mm
    const pad = n => String(n).padStart(2, '0');
    const localIso = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`;
    humanInputEl.value = localIso;

    function onHumanChange() {
      const val = humanInputEl.value;
      if (!val) {
        humanSecEl.textContent = '--';
        humanMsEl.textContent = '--';
        return;
      }
      const d = new Date(val);
      if (!isNaN(d.getTime())) {
        const ms = d.getTime();
        humanSecEl.textContent = Math.floor(ms / 1000).toString();
        humanMsEl.textContent = ms.toString();
      }
    }

    humanInputEl.addEventListener('input', onHumanChange);
    onHumanChange();
  }

  // Event Listeners
  inputValEl.addEventListener('input', convertTimestampInput);

  container.querySelector('#ts-set-now-btn').addEventListener('click', () => {
    inputValEl.value = Math.floor(Date.now() / 1000);
    convertTimestampInput();
  });

  container.querySelector('#ts-plus-1h-btn').addEventListener('click', () => {
    let current = Number(inputValEl.value) || Math.floor(Date.now() / 1000);
    let isMs = current > 100000000000;
    inputValEl.value = isMs ? current + 3600000 : current + 3600;
    convertTimestampInput();
  });

  container.querySelector('#ts-plus-1d-btn').addEventListener('click', () => {
    let current = Number(inputValEl.value) || Math.floor(Date.now() / 1000);
    let isMs = current > 100000000000;
    inputValEl.value = isMs ? current + 86400000 : current + 86400;
    convertTimestampInput();
  });

  container.querySelector('#ts-now-btn').addEventListener('click', () => {
    updateLiveClock();
    inputValEl.value = Math.floor(Date.now() / 1000);
    convertTimestampInput();
  });

  // Copy helper
  container.addEventListener('click', e => {
    const btn = e.target.closest('.ts-copy-btn');
    if (btn) {
      const targetId = btn.dataset.target;
      const el = container.querySelector(`#${targetId}`);
      if (el && el.textContent) {
        navigator.clipboard.writeText(el.textContent);
        const originalText = btn.textContent;
        btn.textContent = '✓ Copied';
        setTimeout(() => { btn.textContent = originalText; }, 1500);
      }
    }

    const copyIcon = e.target.closest('.copy-icon-btn');
    if (copyIcon) {
      const copyId = copyIcon.dataset.copy;
      const el = container.querySelector(`#${copyId}`);
      if (el && el.textContent && el.textContent !== '--') {
        navigator.clipboard.writeText(el.textContent);
        copyIcon.textContent = '✓';
        setTimeout(() => { copyIcon.textContent = '📋'; }, 1500);
      }
    }
  });

  // Initialize
  updateLiveClock();
  inputValEl.value = Math.floor(Date.now() / 1000);
  convertTimestampInput();
  setupHumanInput();

  // Tick interval for live clocks
  const intervalId = setInterval(updateLiveClock, 1000);
  return () => clearInterval(intervalId);
}
