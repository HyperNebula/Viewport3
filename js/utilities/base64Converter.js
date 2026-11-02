/**
 * Viewport3 - Base64 Encoder / Decoder Utility
 */

export function initBase64Converter(container) {
  container.innerHTML = `
    <div class="util-header">
      <div class="util-title-group">
        <h3>Base64 Encoder / Decoder</h3>
        <span class="util-badge">UTF-8 & URL-Safe</span>
      </div>
      <div class="util-actions">
        <button id="b64-swap-btn" class="btn btn-xs btn-outline" title="Swap Input & Output">Swap ⇅</button>
        <button id="b64-clear-btn" class="btn btn-xs btn-outline">Clear</button>
      </div>
    </div>

    <div class="util-body">
      <!-- Options Toolbar -->
      <div class="util-toolbar">
        <div class="btn-group">
          <button id="b64-encode-btn" class="btn btn-sm btn-primary">Encode Text $\rightarrow$ Base64</button>
          <button id="b64-decode-btn" class="btn btn-sm btn-secondary">Decode Base64 $\rightarrow$ Text</button>
        </div>
        <div class="util-toolbar-right">
          <label class="flag-label" title="Replace + with -, / with _, and trim =">
            <input type="checkbox" id="b64-url-safe"> URL-Safe
          </label>
        </div>
      </div>

      <div id="b64-hint-box" class="b64-hint-banner" style="display: none;">
        <span>Input appears to be Base64 encoded.</span>
        <button id="b64-hint-decode-btn" class="btn btn-xs btn-primary">Decode Now</button>
      </div>

      <!-- Input Textarea -->
      <div class="b64-section">
        <div class="util-section-header">
          <label class="util-section-label">Input</label>
          <span id="b64-input-stats" class="badge-count">0 chars</span>
        </div>
        <textarea id="b64-input" class="code-textarea" rows="4" placeholder="Enter text or Base64..." spellcheck="false"></textarea>
      </div>

      <!-- Output Textarea -->
      <div class="b64-section">
        <div class="util-section-header">
          <label class="util-section-label">Output</label>
          <div class="util-actions">
            <span id="b64-output-stats" class="badge-count">0 chars</span>
            <button id="b64-copy-btn" class="btn btn-xs btn-outline">Copy Output</button>
          </div>
        </div>
        <textarea id="b64-output" class="code-textarea" rows="4" readonly placeholder="Result will appear here..." spellcheck="false"></textarea>
      </div>

      <!-- File to Base64 Drop Area -->
      <div class="b64-file-dropzone">
        <div class="util-section-header">
          <label class="util-section-label">File to Base64 Data URI</label>
          <span class="text-muted text-xs">Images, SVGs, Fonts</span>
        </div>
        <div id="b64-drop-target" class="drop-target-box">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
          <p>Drag & drop a file here, or <label class="file-label-link" for="b64-file-input">browse file</label></p>
          <input type="file" id="b64-file-input" style="display: none;">
        </div>
      </div>
    </div>
  `;

  const inputEl = container.querySelector('#b64-input');
  const outputEl = container.querySelector('#b64-output');
  const inputStatsEl = container.querySelector('#b64-input-stats');
  const outputStatsEl = container.querySelector('#b64-output-stats');
  const urlSafeCheckbox = container.querySelector('#b64-url-safe');
  const encodeBtn = container.querySelector('#b64-encode-btn');
  const decodeBtn = container.querySelector('#b64-decode-btn');
  const swapBtn = container.querySelector('#b64-swap-btn');
  const clearBtn = container.querySelector('#b64-clear-btn');
  const copyBtn = container.querySelector('#b64-copy-btn');
  const hintBox = container.querySelector('#b64-hint-box');
  const hintDecodeBtn = container.querySelector('#b64-hint-decode-btn');
  const dropTarget = container.querySelector('#b64-drop-target');
  const fileInput = container.querySelector('#b64-file-input');

  function updateStats() {
    inputStatsEl.textContent = `${inputEl.value.length} chars`;
    outputStatsEl.textContent = `${outputEl.value.length} chars`;
  }

  // UTF-8 Safe Base64 Encoding
  function utf8ToBase64(str, isUrlSafe) {
    const bytes = new TextEncoder().encode(str);
    let binary = '';
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    let b64 = btoa(binary);
    if (isUrlSafe) {
      b64 = b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    }
    return b64;
  }

  // UTF-8 Safe Base64 Decoding
  function base64ToUtf8(b64, isUrlSafe) {
    let clean = b64.trim();
    if (isUrlSafe) {
      clean = clean.replace(/-/g, '+').replace(/_/g, '/');
      while (clean.length % 4) {
        clean += '=';
      }
    }
    const binary = atob(clean);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return new TextDecoder().decode(bytes);
  }

  function handleEncode() {
    const text = inputEl.value;
    if (!text) {
      outputEl.value = '';
      updateStats();
      return;
    }
    try {
      const encoded = utf8ToBase64(text, urlSafeCheckbox.checked);
      outputEl.value = encoded;
      updateStats();
      hintBox.style.display = 'none';
    } catch (err) {
      outputEl.value = `Encoding Error: ${err.message}`;
    }
  }

  function handleDecode() {
    const text = inputEl.value.trim();
    if (!text) {
      outputEl.value = '';
      updateStats();
      return;
    }
    try {
      const decoded = base64ToUtf8(text, urlSafeCheckbox.checked || /[-_]/.test(text));
      outputEl.value = decoded;
      updateStats();
      hintBox.style.display = 'none';
    } catch (err) {
      outputEl.value = `Decoding Error: Invalid Base64 input string (${err.message})`;
    }
  }

  function detectBase64(str) {
    const trimmed = str.trim();
    if (trimmed.length < 4 || trimmed.length % 4 !== 0 && !urlSafeCheckbox.checked) {
      return false;
    }
    // Base64 regex check
    const b64Regex = /^[A-Za-z0-9+/=]+$/;
    const urlSafeRegex = /^[A-Za-z0-9-_=]+$/;
    if (!b64Regex.test(trimmed) && !urlSafeRegex.test(trimmed)) {
      return false;
    }
    try {
      base64ToUtf8(trimmed, urlSafeRegex.test(trimmed));
      return true;
    } catch {
      return false;
    }
  }

  inputEl.addEventListener('input', () => {
    updateStats();
    const val = inputEl.value;
    if (val.length >= 8 && detectBase64(val)) {
      hintBox.style.display = 'flex';
    } else {
      hintBox.style.display = 'none';
    }
  });

  encodeBtn.addEventListener('click', handleEncode);
  decodeBtn.addEventListener('click', handleDecode);
  hintDecodeBtn.addEventListener('click', handleDecode);

  urlSafeCheckbox.addEventListener('change', () => {
    // If output exists, re-process with new flag
    if (outputEl.value && !outputEl.value.startsWith('Decoding Error') && !outputEl.value.startsWith('Encoding Error')) {
      handleEncode();
    }
  });

  swapBtn.addEventListener('click', () => {
    const tmp = inputEl.value;
    inputEl.value = outputEl.value;
    outputEl.value = tmp;
    updateStats();
  });

  clearBtn.addEventListener('click', () => {
    inputEl.value = '';
    outputEl.value = '';
    hintBox.style.display = 'none';
    updateStats();
  });

  copyBtn.addEventListener('click', async () => {
    const text = outputEl.value;
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      const original = copyBtn.textContent;
      copyBtn.textContent = '✓ Copied';
      setTimeout(() => { copyBtn.textContent = original; }, 1500);
    } catch {
      outputEl.select();
      document.execCommand('copy');
    }
  });

  // File to Base64 handler
  function processFile(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = e => {
      const dataUri = e.target.result;
      inputEl.value = `File: ${file.name} (${(file.size / 1024).toFixed(1)} KB, ${file.type || 'unknown'})`;
      outputEl.value = dataUri;
      updateStats();
    };
    reader.readAsDataURL(file);
  }

  fileInput.addEventListener('change', e => {
    const file = e.target.files[0];
    if (file) processFile(file);
  });

  dropTarget.addEventListener('dragover', e => {
    e.preventDefault();
    dropTarget.classList.add('drag-over');
  });

  dropTarget.addEventListener('dragleave', () => {
    dropTarget.classList.remove('drag-over');
  });

  dropTarget.addEventListener('drop', e => {
    e.preventDefault();
    dropTarget.classList.remove('drag-over');
    if (e.dataTransfer.files.length > 0) {
      processFile(e.dataTransfer.files[0]);
    }
  });

  // Initialize with sample text
  inputEl.value = "Hello, world!";
  handleEncode();
}
