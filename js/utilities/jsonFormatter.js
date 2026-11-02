/**
 * Viewport3 - JSON Formatter & Minifier Utility
 */

export function initJsonFormatter(container) {
  container.innerHTML = `
    <div class="util-header">
      <div class="util-title-group">
        <h3>JSON Formatter & Minifier</h3>
        <span class="util-badge">Syntax & Formatting</span>
      </div>
      <div class="util-actions">
        <button id="json-sample-btn" class="btn btn-xs btn-outline" title="Load sample JSON">Sample</button>
        <button id="json-clear-btn" class="btn btn-xs btn-outline" title="Clear inputs">Clear</button>
      </div>
    </div>

    <div class="util-body">
      <div class="util-toolbar">
        <div class="btn-group">
          <button id="json-pretty-2-btn" class="btn btn-sm btn-primary">Prettify (2 spaces)</button>
          <button id="json-pretty-4-btn" class="btn btn-sm btn-secondary">4 spaces</button>
          <button id="json-minify-btn" class="btn btn-sm btn-secondary">Minify</button>
          <button id="json-validate-btn" class="btn btn-sm btn-secondary">Validate</button>
        </div>
        <div class="util-toolbar-right">
          <button id="json-copy-btn" class="btn btn-sm btn-outline">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
            Copy
          </button>
        </div>
      </div>

      <div class="util-editor-wrapper">
        <textarea id="json-input" class="code-textarea" placeholder="Enter JSON..." spellcheck="false"></textarea>
      </div>

      <div id="json-status" class="util-status-bar">
        <span id="json-stats">0 chars | 0 lines</span>
        <span id="json-feedback" class="status-msg"></span>
      </div>
    </div>
  `;

  const inputEl = container.querySelector('#json-input');
  const statsEl = container.querySelector('#json-stats');
  const feedbackEl = container.querySelector('#json-feedback');
  const copyBtn = container.querySelector('#json-copy-btn');
  const sampleBtn = container.querySelector('#json-sample-btn');
  const clearBtn = container.querySelector('#json-clear-btn');
  const pretty2Btn = container.querySelector('#json-pretty-2-btn');
  const pretty4Btn = container.querySelector('#json-pretty-4-btn');
  const minifyBtn = container.querySelector('#json-minify-btn');
  const validateBtn = container.querySelector('#json-validate-btn');

  function updateStats() {
    const val = inputEl.value;
    const chars = val.length;
    const lines = val ? val.split('\n').length : 0;
    const size = new Blob([val]).size;
    let sizeStr = size < 1024 ? `${size} B` : `${(size / 1024).toFixed(1)} KB`;
    statsEl.textContent = `${chars} chars | ${lines} lines | ${sizeStr}`;
  }

  function showStatus(msg, type = 'info') {
    feedbackEl.textContent = msg;
    feedbackEl.className = `status-msg status-${type}`;
    if (type !== 'error') {
      setTimeout(() => {
        if (feedbackEl.textContent === msg) {
          feedbackEl.textContent = '';
        }
      }, 4000);
    }
  }

  function formatJSON(indent) {
    const val = inputEl.value.trim();
    if (!val) {
      showStatus('Please paste or type JSON first.', 'warning');
      return;
    }
    try {
      const parsed = JSON.parse(val);
      inputEl.value = JSON.stringify(parsed, null, indent);
      updateStats();
      showStatus(`Valid JSON formatted cleanly.`, 'success');
    } catch (err) {
      parseAndShowError(err, val);
    }
  }

  function parseAndShowError(err, text) {
    let message = err.message;
    // Attempt to extract position from "at position X"
    const posMatch = message.match(/at position (\d+)/i);
    if (posMatch) {
      const pos = parseInt(posMatch[1], 10);
      const lines = text.slice(0, pos).split('\n');
      const lineNum = lines.length;
      const colNum = lines[lines.length - 1].length + 1;
      showStatus(`Invalid JSON at Line ${lineNum}, Col ${colNum}: ${message}`, 'error');
    } else {
      showStatus(`JSON Syntax Error: ${message}`, 'error');
    }
  }

  pretty2Btn.addEventListener('click', () => formatJSON(2));
  pretty4Btn.addEventListener('click', () => formatJSON(4));
  minifyBtn.addEventListener('click', () => formatJSON(0));

  validateBtn.addEventListener('click', () => {
    const val = inputEl.value.trim();
    if (!val) {
      showStatus('Editor is empty.', 'warning');
      return;
    }
    try {
      JSON.parse(val);
      showStatus('Valid JSON syntax confirmed ✓', 'success');
    } catch (err) {
      parseAndShowError(err, val);
    }
  });

  inputEl.addEventListener('input', updateStats);

  copyBtn.addEventListener('click', async () => {
    const text = inputEl.value;
    if (!text) {
      showStatus('Nothing to copy.', 'warning');
      return;
    }
    try {
      await navigator.clipboard.writeText(text);
      copyBtn.innerHTML = `
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"></polyline></svg>
        Copied!
      `;
      setTimeout(() => {
        copyBtn.innerHTML = `
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
          Copy
        `;
      }, 2000);
      showStatus('Copied to clipboard!', 'success');
    } catch {
      inputEl.select();
      document.execCommand('copy');
      showStatus('Copied to clipboard!', 'success');
    }
  });

  sampleBtn.addEventListener('click', () => {
    const sample = {
      name: "Example",
      count: 3,
      enabled: true,
      items: ["Item 1", "Item 2", "Item 3"],
      settings: {
        option: "value",
        limit: 10
      },
      metadata: null
    };
    inputEl.value = JSON.stringify(sample, null, 2);
    updateStats();
    showStatus('Loaded sample JSON payload.', 'info');
  });

  clearBtn.addEventListener('click', () => {
    inputEl.value = '';
    updateStats();
    showStatus('Cleared editor.', 'info');
  });

  updateStats();
}
