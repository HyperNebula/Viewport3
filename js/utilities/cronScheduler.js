/**
 * Viewport3 - Cron Expression Explainer & Next Runs Calculator Utility
 */

export function initCronScheduler(container) {
  container.innerHTML = `
    <div class="util-header">
      <div class="util-title-group">
        <h3>Cron Scheduler & Explainer</h3>
        <span class="util-badge">5-Field UNIX Cron</span>
      </div>
      <div class="util-actions">
        <button id="cron-copy-expr-btn" class="btn btn-xs btn-outline">Copy Cron</button>
      </div>
    </div>

    <div class="util-body">
      <!-- Cron Input Field & Presets -->
      <div class="cron-input-section">
        <label class="util-section-label">Cron Expression (Minute Hour Dom Month Dow)</label>
        <div class="cron-input-wrapper">
          <input type="text" id="cron-input" class="cron-field-input" value="0 9 * * 1-5" spellcheck="false">
        </div>

        <div class="cron-fields-indicator">
          <span class="field-pill"><b>m:</b> 0-59</span>
          <span class="field-pill"><b>h:</b> 0-23</span>
          <span class="field-pill"><b>dom:</b> 1-31</span>
          <span class="field-pill"><b>mon:</b> 1-12</span>
          <span class="field-pill"><b>dow:</b> 0-6 (Sun-Sat)</span>
        </div>
      </div>

      <!-- Quick Preset Pills -->
      <div class="cron-presets-section">
        <span class="text-muted text-xs">Presets:</span>
        <div class="cron-presets-list" id="cron-presets-container">
          <button class="preset-pill" data-cron="* * * * *">Every minute</button>
          <button class="preset-pill" data-cron="*/15 * * * *">Every 15 mins</button>
          <button class="preset-pill" data-cron="0 * * * *">Hourly</button>
          <button class="preset-pill" data-cron="0 0 * * *">Daily midnight</button>
          <button class="preset-pill" data-cron="0 9 * * 1-5">Mon-Fri 9am</button>
          <button class="preset-pill" data-cron="0 12 * * 0">Weekly Sun 12pm</button>
          <button class="preset-pill" data-cron="0 0 1 * *">1st of Month</button>
        </div>
      </div>

      <!-- Human Translation Box -->
      <div class="cron-translation-box">
        <div class="util-section-header">
          <label class="util-section-label">Human Description</label>
          <span id="cron-valid-badge" class="badge-wcag wcag-pass">Valid</span>
        </div>
        <div id="cron-human-text" class="cron-human-display">
          At 09:00 AM, Monday through Friday
        </div>
      </div>

      <!-- Next Runs Execution Schedule -->
      <div class="cron-next-runs-section">
        <div class="util-section-header">
          <label class="util-section-label">Next 5 Scheduled Executions</label>
          <span class="text-muted text-xs" id="cron-timezone-label">Local Time</span>
        </div>
        <div id="cron-runs-list" class="cron-runs-list">
          <!-- Dynamically populated -->
        </div>
      </div>
    </div>
  `;

  const inputEl = container.querySelector('#cron-input');
  const humanTextEl = container.querySelector('#cron-human-text');
  const validBadgeEl = container.querySelector('#cron-valid-badge');
  const runsListEl = container.querySelector('#cron-runs-list');
  const presetsContainer = container.querySelector('#cron-presets-container');
  const copyExprBtn = container.querySelector('#cron-copy-expr-btn');

  const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

  // Parse a single cron field pattern into an array of allowed numbers or wildcard
  function parseField(fieldStr, min, max) {
    const values = new Set();
    const parts = fieldStr.split(',');

    for (const part of parts) {
      if (part === '*') {
        for (let i = min; i <= max; i++) values.add(i);
      } else if (part.startsWith('*/')) {
        const step = parseInt(part.slice(2), 10);
        if (isNaN(step) || step <= 0) return null;
        for (let i = min; i <= max; i += step) values.add(i);
      } else if (part.includes('-')) {
        const [startStr, endStr] = part.split('-');
        let start = parseInt(startStr, 10);
        let end = parseInt(endStr, 10);
        if (isNaN(start) || isNaN(end) || start > end || start < min || end > max) return null;
        for (let i = start; i <= end; i++) values.add(i);
      } else {
        const num = parseInt(part, 10);
        if (isNaN(num) || num < min || num > max) return null;
        values.add(num);
      }
    }
    return Array.from(values).sort((a, b) => a - b);
  }

  function describeCron(fields) {
    const [minStr, hourStr, domStr, monStr, dowStr] = fields;

    // Check common shorthands
    if (minStr === '*' && hourStr === '*' && domStr === '*' && monStr === '*' && dowStr === '*') {
      return 'Every minute, every hour, every day';
    }
    if (minStr.startsWith('*/') && hourStr === '*' && domStr === '*' && monStr === '*' && dowStr === '*') {
      return `Every ${minStr.slice(2)} minutes`;
    }
    if (minStr === '0' && hourStr === '*' && domStr === '*' && monStr === '*' && dowStr === '*') {
      return 'Every hour at minute 0';
    }

    let timeDesc = '';
    if (hourStr === '*' && minStr === '*') {
      timeDesc = 'Every minute';
    } else if (hourStr === '*') {
      timeDesc = `At minute ${minStr} past every hour`;
    } else if (minStr.startsWith('*/')) {
      timeDesc = `Every ${minStr.slice(2)} minutes during hour ${hourStr}`;
    } else {
      const pad = n => String(n).padStart(2, '0');
      let h = parseInt(hourStr, 10);
      let m = parseInt(minStr, 10);
      if (!isNaN(h) && !isNaN(m)) {
        let ampm = h >= 12 ? 'PM' : 'AM';
        let displayH = h % 12 || 12;
        timeDesc = `At ${pad(displayH)}:${pad(m)} ${ampm} (${pad(h)}:${pad(m)})`;
      } else {
        timeDesc = `At minute ${minStr}, hour ${hourStr}`;
      }
    }

    let dowDesc = '';
    if (dowStr !== '*') {
      if (dowStr === '1-5') {
        dowDesc = 'Monday through Friday';
      } else if (dowStr === '0,6' || dowStr === '6,0') {
        dowDesc = 'Saturday and Sunday';
      } else {
        const dows = dowStr.split(',').map(d => DAYS[parseInt(d, 10)] || d);
        dowDesc = dows.join(', ');
      }
    }

    let domDesc = '';
    if (domStr !== '*') {
      domDesc = `on day ${domStr} of the month`;
    }

    let monDesc = '';
    if (monStr !== '*') {
      const mons = monStr.split(',').map(m => MONTHS[parseInt(m, 10) - 1] || m);
      monDesc = `in ${mons.join(', ')}`;
    }

    let full = timeDesc;
    if (dowDesc) full += `, on ${dowDesc}`;
    if (domDesc) full += `, ${domDesc}`;
    if (monDesc) full += `, ${monDesc}`;
    return full;
  }

  function getNextRuns(parsed, maxRuns = 5) {
    const [minVals, hourVals, domVals, monVals, dowVals] = parsed;
    const runs = [];
    const current = new Date();
    // Advance to next clean minute
    current.setSeconds(0, 0);
    current.setMinutes(current.getMinutes() + 1);

    const safetyLimit = 100000; // max minutes to iterate (approx 70 days)
    let count = 0;

    while (runs.length < maxRuns && count++ < safetyLimit) {
      const minute = current.getMinutes();
      const hour = current.getHours();
      const dom = current.getDate();
      const month = current.getMonth() + 1; // 1-12
      const dow = current.getDay(); // 0-6

      const monthMatch = monVals.includes(month);
      const domMatch = domVals.includes(dom);
      const dowMatch = dowVals.includes(dow);
      const hourMatch = hourVals.includes(hour);
      const minMatch = minVals.includes(minute);

      if (monthMatch && domMatch && dowMatch && hourMatch && minMatch) {
        runs.push(new Date(current.getTime()));
      }

      current.setMinutes(current.getMinutes() + 1);
    }
    return runs;
  }

  function formatRelativeRun(targetDate) {
    const diffMs = targetDate.getTime() - Date.now();
    const diffMin = Math.round(diffMs / 60000);
    if (diffMin < 1) return 'in less than a minute';
    if (diffMin < 60) return `in ${diffMin} min`;
    const diffH = Math.floor(diffMin / 60);
    const remMin = diffMin % 60;
    if (diffH < 24) return `in ${diffH}h ${remMin}m`;
    const diffDays = Math.floor(diffH / 24);
    return `in ${diffDays} day${diffDays > 1 ? 's' : ''}`;
  }

  function evaluateCron() {
    const raw = inputEl.value.trim().replace(/\s+/g, ' ');
    const fields = raw.split(' ');

    if (fields.length !== 5) {
      validBadgeEl.className = 'badge-wcag wcag-fail';
      validBadgeEl.textContent = 'Invalid (Needs 5 fields)';
      humanTextEl.textContent = 'Please provide 5 fields separated by space: Minute Hour Dom Month Dow';
      runsListEl.innerHTML = '<div class="text-muted text-center py-2">No upcoming runs calculated</div>';
      return;
    }

    const minVals = parseField(fields[0], 0, 59);
    const hourVals = parseField(fields[1], 0, 23);
    const domVals = parseField(fields[2], 1, 31);
    const monVals = parseField(fields[3], 1, 12);
    const dowVals = parseField(fields[4], 0, 6);

    if (!minVals || !hourVals || !domVals || !monVals || !dowVals) {
      validBadgeEl.className = 'badge-wcag wcag-fail';
      validBadgeEl.textContent = 'Syntax Error';
      humanTextEl.textContent = 'One or more cron fields contain an out-of-range value or invalid syntax.';
      runsListEl.innerHTML = '<div class="text-muted text-center py-2">No upcoming runs calculated</div>';
      return;
    }

    validBadgeEl.className = 'badge-wcag wcag-pass';
    validBadgeEl.textContent = 'Valid ✓';
    humanTextEl.textContent = describeCron(fields);

    const nextRuns = getNextRuns([minVals, hourVals, domVals, monVals, dowVals]);
    runsListEl.innerHTML = '';

    if (nextRuns.length === 0) {
      runsListEl.innerHTML = '<div class="text-muted text-center py-2">No scheduled executions found within 70 days.</div>';
      return;
    }

    nextRuns.forEach((date, i) => {
      const item = document.createElement('div');
      item.className = 'cron-run-row';

      const options = {
        weekday: 'short',
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
      };

      const dateStr = date.toLocaleString('en-US', options);
      const relativeStr = formatRelativeRun(date);

      item.innerHTML = `
        <span class="run-idx">#${i + 1}</span>
        <code class="run-timestamp">${dateStr}</code>
        <span class="run-relative">${relativeStr}</span>
      `;
      runsListEl.appendChild(item);
    });
  }

  inputEl.addEventListener('input', evaluateCron);

  presetsContainer.addEventListener('click', e => {
    const pill = e.target.closest('.preset-pill');
    if (pill && pill.dataset.cron) {
      inputEl.value = pill.dataset.cron;
      evaluateCron();
    }
  });

  copyExprBtn.addEventListener('click', () => {
    navigator.clipboard.writeText(inputEl.value.trim());
    const original = copyExprBtn.textContent;
    copyExprBtn.textContent = '✓ Copied';
    setTimeout(() => { copyExprBtn.textContent = original; }, 1500);
  });

  evaluateCron();
}
