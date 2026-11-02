/**
 * Viewport3 - LocalStorage Monospace Scratchpad
 */

export class Scratchpad {
  constructor() {
    this.storageKey = 'viewport3_scratchpad_content';
    this.lastClearedContent = null;
    this.saveTimeout = null;

    // DOM Elements
    this.textarea = document.getElementById('scratchpad-textarea');
    this.charCountEl = document.getElementById('scratchpad-char-count');
    this.wordCountEl = document.getElementById('scratchpad-word-count');
    this.lineCountEl = document.getElementById('scratchpad-line-count');
    this.cursorPosEl = document.getElementById('scratchpad-cursor-pos');
    this.saveStatusEl = document.getElementById('scratchpad-save-status');

    this.copyBtn = document.getElementById('scratchpad-copy-btn');
    this.clearBtn = document.getElementById('scratchpad-clear-btn');
    this.downloadBtn = document.getElementById('scratchpad-download-btn');
    this.templateSelect = document.getElementById('scratchpad-template-select');

    this.init();
  }

  init() {
    this.loadSavedContent();
    this.bindEvents();
    this.updateStats();
  }

  loadSavedContent() {
    const saved = localStorage.getItem(this.storageKey);
    if (saved !== null) {
      this.textarea.value = saved;
    } else {
      // Generic starting note
      this.textarea.value = `# Notes

Write your notes here.

- [ ] Task 1
- [ ] Task 2
- [ ] Task 3`;
    }
  }

  bindEvents() {
    // Auto-save on input
    this.textarea.addEventListener('input', () => {
      this.updateStats();
      this.debouncedSave();
    });

    // Cursor position tracking
    this.textarea.addEventListener('keyup', () => this.updateCursorPos());
    this.textarea.addEventListener('click', () => this.updateCursorPos());

    // Tab key support (insert 2 spaces instead of switching focus)
    this.textarea.addEventListener('keydown', e => {
      if (e.key === 'Tab') {
        e.preventDefault();
        const start = this.textarea.selectionStart;
        const end = this.textarea.selectionEnd;
        const value = this.textarea.value;

        // Insert 2 spaces
        this.textarea.value = value.substring(0, start) + '  ' + value.substring(end);
        this.textarea.selectionStart = this.textarea.selectionEnd = start + 2;
        this.updateStats();
        this.debouncedSave();
      }
    });

    // Copy All
    this.copyBtn.addEventListener('click', () => this.copyToClipboard());

    // Clear with undo
    this.clearBtn.addEventListener('click', () => this.clearContent());

    // Download
    this.downloadBtn.addEventListener('click', () => this.downloadAsFile());

    // Template selection
    if (this.templateSelect) {
      this.templateSelect.addEventListener('change', () => {
        const val = this.templateSelect.value;
        if (val) {
          this.insertTemplate(val);
          this.templateSelect.value = '';
        }
      });
    }
  }

  debouncedSave() {
    this.showSaveStatus('Saving...', 'saving');
    clearTimeout(this.saveTimeout);
    this.saveTimeout = setTimeout(() => {
      localStorage.setItem(this.storageKey, this.textarea.value);
      this.showSaveStatus('Auto-saved', 'saved');
      setTimeout(() => {
        this.showSaveStatus('', '');
      }, 2500);
    }, 300);
  }

  showSaveStatus(text, className) {
    if (this.saveStatusEl) {
      this.saveStatusEl.textContent = text;
      this.saveStatusEl.className = `scratchpad-save-indicator ${className}`;
    }
  }

  updateStats() {
    const text = this.textarea.value;
    const charCount = text.length;
    const words = text.trim() ? text.trim().split(/\s+/).length : 0;
    const lines = text ? text.split('\n').length : 0;

    if (this.charCountEl) this.charCountEl.textContent = `${charCount} chars`;
    if (this.wordCountEl) this.wordCountEl.textContent = `${words} words`;
    if (this.lineCountEl) this.lineCountEl.textContent = `${lines} lines`;

    this.updateCursorPos();
  }

  updateCursorPos() {
    if (!this.cursorPosEl) return;
    const pos = this.textarea.selectionStart;
    const textBefore = this.textarea.value.substring(0, pos);
    const lines = textBefore.split('\n');
    const currentLine = lines.length;
    const currentCol = lines[lines.length - 1].length + 1;
    this.cursorPosEl.textContent = `Ln ${currentLine}, Col ${currentCol}`;
  }

  async copyToClipboard() {
    const text = this.textarea.value;
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      const original = this.copyBtn.innerHTML;
      this.copyBtn.innerHTML = `
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"></polyline></svg>
        Copied!
      `;
      setTimeout(() => { this.copyBtn.innerHTML = original; }, 1800);
    } catch {
      this.textarea.select();
      document.execCommand('copy');
    }
  }

  clearContent() {
    if (!this.textarea.value.trim()) return;

    if (confirm('Clear scratchpad? (You can undo this immediately)')) {
      this.lastClearedContent = this.textarea.value;
      this.textarea.value = '';
      this.updateStats();
      this.debouncedSave();

      // Show Undo button inside save status
      if (this.saveStatusEl) {
        this.saveStatusEl.innerHTML = `Cleared. <button id="scratchpad-undo-btn" class="link-btn">Undo</button>`;
        const undoBtn = document.getElementById('scratchpad-undo-btn');
        if (undoBtn) {
          undoBtn.addEventListener('click', () => {
            if (this.lastClearedContent !== null) {
              this.textarea.value = this.lastClearedContent;
              this.lastClearedContent = null;
              this.updateStats();
              this.debouncedSave();
              this.showSaveStatus('Restored!', 'saved');
            }
          });
        }
      }
    }
  }

  downloadAsFile() {
    const text = this.textarea.value;
    const blob = new Blob([text], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10);
    a.href = url;
    a.download = `notes-${dateStr}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  insertTemplate(templateName) {
    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10);
    const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    let snippet = '';
    switch (templateName) {
      case 'todo':
        snippet = `\n## Tasks (${dateStr})\n- [ ] Task 1\n- [ ] Task 2\n- [ ] Task 3\n`;
        break;
      case 'meeting':
        snippet = `\n## Log: ${dateStr} ${timeStr}\n- **Participants:** \n- **Objectives:** \n- **Key Decisions:** \n- **Action Items:** \n  - [ ] \n`;
        break;
      case 'code':
        snippet = `\n\`\`\`\n\n\`\`\`\n`;
        break;
      case 'timestamp':
        snippet = `\n--- [${dateStr} ${timeStr}] ---\n`;
        break;
    }

    const start = this.textarea.selectionStart;
    const current = this.textarea.value;
    this.textarea.value = current.substring(0, start) + snippet + current.substring(start);
    this.textarea.selectionStart = this.textarea.selectionEnd = start + snippet.length;
    this.updateStats();
    this.debouncedSave();
  }
}
