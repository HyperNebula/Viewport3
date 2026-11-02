/**
 * Viewport3 - Regex Tester & Group Visualizer Utility
 */

export function initRegexTester(container) {
  container.innerHTML = `
    <div class="util-header">
      <div class="util-title-group">
        <h3>Regex Tester & Visualizer</h3>
        <span class="util-badge">Pattern Matcher</span>
      </div>
      <div class="util-actions">
        <select id="regex-presets" class="input-select-sm">
          <option value="">Quick Presets...</option>
          <option value="email">Email Address</option>
          <option value="url">URL (HTTP/S)</option>
          <option value="ipv4">IPv4 Address</option>
          <option value="uuid">UUID v4</option>
          <option value="isodate">ISO 8601 Date</option>
          <option value="hex">Hex Color</option>
        </select>
        <button id="regex-clear-btn" class="btn btn-xs btn-outline">Clear</button>
      </div>
    </div>

    <div class="util-body">
      <!-- Pattern Input with Flags -->
      <div class="regex-pattern-row">
        <div class="regex-input-group">
          <span class="regex-delim">/</span>
          <input type="text" id="regex-pattern" class="regex-pattern-input" placeholder="Enter a pattern..." spellcheck="false" value="([a-zA-Z0-9._-]+)@([a-zA-Z0-9.-]+\\.[a-zA-Z]{2,})">
          <span class="regex-delim">/</span>
        </div>
        <div class="regex-flags-group">
          <label class="flag-label" title="Global search"><input type="checkbox" id="flag-g" checked> g</label>
          <label class="flag-label" title="Case-insensitive"><input type="checkbox" id="flag-i" checked> i</label>
          <label class="flag-label" title="Multiline"><input type="checkbox" id="flag-m"> m</label>
          <label class="flag-label" title="Dot matches all"><input type="checkbox" id="flag-s"> s</label>
          <label class="flag-label" title="Unicode"><input type="checkbox" id="flag-u"> u</label>
        </div>
      </div>

      <div id="regex-error-msg" class="regex-error-box" style="display: none;"></div>

      <!-- Test String Editor -->
      <div class="regex-test-section">
        <label class="util-section-label">Test Text</label>
        <textarea id="regex-test-text" class="code-textarea" rows="4" placeholder="Enter text to match..." spellcheck="false">user@example.com
other@example.org</textarea>
      </div>

      <!-- Match Visualizer -->
      <div class="regex-preview-section">
        <div class="util-section-header">
          <label class="util-section-label">Highlighted Matches</label>
          <span id="regex-match-count" class="badge-count">0 matches</span>
        </div>
        <div id="regex-highlight-box" class="regex-highlight-display"></div>
      </div>

      <!-- Groups Breakdown Table -->
      <div class="regex-groups-section">
        <label class="util-section-label">Captured Groups</label>
        <div class="regex-table-wrapper">
          <table id="regex-groups-table" class="util-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Full Match</th>
                <th>Index</th>
                <th>Groups</th>
              </tr>
            </thead>
            <tbody id="regex-groups-tbody">
              <!-- Dynamically populated -->
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `;

  const patternInput = container.querySelector('#regex-pattern');
  const testTextarea = container.querySelector('#regex-test-text');
  const highlightBox = container.querySelector('#regex-highlight-box');
  const matchCountEl = container.querySelector('#regex-match-count');
  const groupsTbody = container.querySelector('#regex-groups-tbody');
  const errorMsgEl = container.querySelector('#regex-error-msg');
  const presetsSelect = container.querySelector('#regex-presets');
  const clearBtn = container.querySelector('#regex-clear-btn');

  const flagCheckboxes = {
    g: container.querySelector('#flag-g'),
    i: container.querySelector('#flag-i'),
    m: container.querySelector('#flag-m'),
    s: container.querySelector('#flag-s'),
    u: container.querySelector('#flag-u')
  };

  const PRESETS = {
    email: {
      pattern: '([a-zA-Z0-9._%+-]+)@([a-zA-Z0-9.-]+\\.[a-zA-Z]{2,})',
      flags: { g: true, i: true, m: false, s: false, u: false },
      test: 'user@example.com other@example.org'
    },
    url: {
      pattern: 'https?:\\/\\/([\\w.-]+)(:[0-9]+)?(\\/[^\\s]*)?',
      flags: { g: true, i: true, m: false, s: false, u: false },
      test: 'https://example.com http://example.org/path'
    },
    ipv4: {
      pattern: '\\b(?:[0-9]{1,3}\\.){3}[0-9]{1,3}\\b',
      flags: { g: true, i: false, m: false, s: false, u: false },
      test: '192.0.2.1 198.51.100.2 203.0.113.3'
    },
    uuid: {
      pattern: '[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}',
      flags: { g: true, i: true, m: false, s: false, u: false },
      test: 'c3a4e98f-410a-4a27-a00e-e5e6628b7a42 8a55a638-00b9-4edd-9f78-99abaef6f976'
    },
    isodate: {
      pattern: '(\\d{4})-(0[1-9]|1[0-2])-(0[1-9]|[12]\\d|3[01])(?:T(\\d{2}):(\\d{2}):(\\d{2}))?',
      flags: { g: true, i: false, m: false, s: false, u: false },
      test: '2024-01-01T12:00:00 2024-01-02'
    },
    hex: {
      pattern: '#([a-fA-F0-9]{6}|[a-fA-F0-9]{3})\\b',
      flags: { g: true, i: true, m: false, s: false, u: false },
      test: '#123456 #abcdef #fff'
    }
  };

  function getActiveFlags() {
    let flags = '';
    if (flagCheckboxes.g.checked) flags += 'g';
    if (flagCheckboxes.i.checked) flags += 'i';
    if (flagCheckboxes.m.checked) flags += 'm';
    if (flagCheckboxes.s.checked) flags += 's';
    if (flagCheckboxes.u.checked) flags += 'u';
    return flags;
  }

  function escapeHtml(str) {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function runRegex() {
    const patternStr = patternInput.value;
    const testText = testTextarea.value;
    const flags = getActiveFlags();

    errorMsgEl.style.display = 'none';
    errorMsgEl.textContent = '';
    groupsTbody.innerHTML = '';

    if (!patternStr) {
      matchCountEl.textContent = '0 matches';
      highlightBox.innerHTML = escapeHtml(testText) || '<span class="text-muted">Enter text above...</span>';
      return;
    }

    let regex;
    try {
      regex = new RegExp(patternStr, flags);
    } catch (err) {
      errorMsgEl.style.display = 'block';
      errorMsgEl.textContent = `Regex Error: ${err.message}`;
      matchCountEl.textContent = 'Invalid regex';
      highlightBox.innerHTML = escapeHtml(testText);
      return;
    }

    if (!testText) {
      matchCountEl.textContent = '0 matches';
      highlightBox.innerHTML = '<span class="text-muted">Enter test text above...</span>';
      return;
    }

    const matches = [];
    let match;

    if (regex.global) {
      let lastIdx = 0;
      // Guard against infinite loop with zero-length matches
      let safetyCounter = 0;
      while ((match = regex.exec(testText)) !== null && safetyCounter++ < 2000) {
        matches.push(match);
        if (match.index === regex.lastIndex) {
          regex.lastIndex++;
        }
      }
    } else {
      match = regex.exec(testText);
      if (match) matches.push(match);
    }

    matchCountEl.textContent = `${matches.length} ${matches.length === 1 ? 'match' : 'matches'}`;

    // Build highlighted HTML
    let highlightedHtml = '';
    let cursor = 0;

    matches.forEach((m, idx) => {
      const matchStart = m.index;
      const matchEnd = m.index + m[0].length;

      // Append text before match
      if (matchStart > cursor) {
        highlightedHtml += escapeHtml(testText.slice(cursor, matchStart));
      }

      // Append highlighted match
      highlightedHtml += `<mark class="regex-match" title="Match #${idx + 1} at index ${matchStart}">${escapeHtml(m[0])}</mark>`;
      cursor = matchEnd;
    });

    if (cursor < testText.length) {
      highlightedHtml += escapeHtml(testText.slice(cursor));
    }

    highlightBox.innerHTML = highlightedHtml || '<span class="text-muted">No matches</span>';

    // Populate Groups Table
    if (matches.length === 0) {
      groupsTbody.innerHTML = '<tr><td colspan="4" class="text-muted text-center">No matches found</td></tr>';
    } else {
      matches.slice(0, 100).forEach((m, idx) => {
        const tr = document.createElement('tr');
        const groupsList = [];
        for (let i = 1; i < m.length; i++) {
          if (m[i] !== undefined) {
            groupsList.push(`<span class="group-pill">$${i}: <code>${escapeHtml(m[i])}</code></span>`);
          }
        }
        if (m.groups) {
          for (const [key, val] of Object.entries(m.groups)) {
            groupsList.push(`<span class="group-pill named-group">&lt;${escapeHtml(key)}&gt;: <code>${escapeHtml(val)}</code></span>`);
          }
        }

        tr.innerHTML = `
          <td><strong>#${idx + 1}</strong></td>
          <td class="match-text-cell"><code>${escapeHtml(m[0])}</code></td>
          <td>${m.index}</td>
          <td>${groupsList.length > 0 ? groupsList.join(' ') : '<span class="text-muted">None</span>'}</td>
        `;
        groupsTbody.appendChild(tr);
      });
    }
  }

  patternInput.addEventListener('input', runRegex);
  testTextarea.addEventListener('input', runRegex);
  Object.values(flagCheckboxes).forEach(cb => cb.addEventListener('change', runRegex));

  presetsSelect.addEventListener('change', () => {
    const val = presetsSelect.value;
    if (val && PRESETS[val]) {
      const p = PRESETS[val];
      patternInput.value = p.pattern;
      testTextarea.value = p.test;
      Object.keys(flagCheckboxes).forEach(flag => {
        flagCheckboxes[flag].checked = Boolean(p.flags[flag]);
      });
      runRegex();
    }
  });

  clearBtn.addEventListener('click', () => {
    patternInput.value = '';
    testTextarea.value = '';
    runRegex();
  });

  runRegex();
}
