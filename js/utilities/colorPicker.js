/**
 * Viewport3 - Color Picker, Palette & WCAG Contrast Utility
 */

export function initColorPicker(container) {
  container.innerHTML = `
    <div class="util-header">
      <div class="util-title-group">
        <h3>Color Picker & WCAG Contrast</h3>
        <span class="util-badge">Design & Accessibility</span>
      </div>
      <div class="util-actions">
        <button id="color-save-swatch-btn" class="btn btn-xs btn-primary">+ Save Color</button>
      </div>
    </div>

    <div class="util-body">
      <!-- Color Input & Preview Row -->
      <div class="color-picker-main">
        <div class="color-visual-box">
          <input type="color" id="color-picker-input" value="#38bdf8">
          <div id="color-preview-swatch" class="color-swatch-large" style="background-color: #38bdf8;"></div>
        </div>
        <div class="color-details-group">
          <div class="color-hex-row">
            <span class="input-prefix">HEX</span>
            <input type="text" id="color-hex-input" class="code-input" value="#38bdf8" maxlength="9">
          </div>
          <div class="color-formats-list">
            <div class="color-format-item">
              <span class="format-label">RGB:</span>
              <code id="color-rgb-val">rgb(56, 189, 248)</code>
              <button class="copy-icon-btn" data-copy="color-rgb-val" title="Copy RGB">📋</button>
            </div>
            <div class="color-format-item">
              <span class="format-label">HSL:</span>
              <code id="color-hsl-val">hsl(199, 95%, 60%)</code>
              <button class="copy-icon-btn" data-copy="color-hsl-val" title="Copy HSL">📋</button>
            </div>
            <div class="color-format-item">
              <span class="format-label">CSS:</span>
              <code id="color-css-val">--accent: #38bdf8;</code>
              <button class="copy-icon-btn" data-copy="color-css-val" title="Copy CSS">📋</button>
            </div>
          </div>
        </div>
      </div>

      <!-- WCAG Contrast Ratio Checker -->
      <div class="contrast-section">
        <label class="util-section-label">WCAG 2.1 Contrast Ratios</label>
        
        <div class="contrast-cards-grid">
          <!-- Against White Background -->
          <div class="contrast-card" id="contrast-on-white">
            <div class="contrast-card-header">
              <span>Against Pure White (#FFF)</span>
              <span id="contrast-ratio-white" class="contrast-ratio-val">--:1</span>
            </div>
            <div class="contrast-preview" style="background-color: #ffffff;">
              <span class="preview-text" id="preview-text-on-white" style="color: #38bdf8;">Sample Text Preview</span>
            </div>
            <div class="contrast-badges">
              <span class="badge-wcag" id="badge-aa-norm-white">AA 4.5:1</span>
              <span class="badge-wcag" id="badge-aa-lg-white">AA Lg 3:1</span>
              <span class="badge-wcag" id="badge-aaa-norm-white">AAA 7:1</span>
            </div>
          </div>

          <!-- Against Black Background -->
          <div class="contrast-card" id="contrast-on-black">
            <div class="contrast-card-header">
              <span>Against Dark Theme (#0F1118)</span>
              <span id="contrast-ratio-black" class="contrast-ratio-val">--:1</span>
            </div>
            <div class="contrast-preview" style="background-color: #0f1118;">
              <span class="preview-text" id="preview-text-on-black" style="color: #38bdf8;">Sample Text Preview</span>
            </div>
            <div class="contrast-badges">
              <span class="badge-wcag" id="badge-aa-norm-black">AA 4.5:1</span>
              <span class="badge-wcag" id="badge-aa-lg-black">AA Lg 3:1</span>
              <span class="badge-wcag" id="badge-aaa-norm-black">AAA 7:1</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Palette History Swatches -->
      <div class="palette-section">
        <div class="util-section-header">
          <label class="util-section-label">Saved & Recent Swatches</label>
          <button id="color-clear-palette-btn" class="btn btn-xs btn-outline">Clear</button>
        </div>
        <div id="palette-swatches-grid" class="palette-grid">
          <!-- Populated from localStorage -->
        </div>
      </div>
    </div>
  `;

  const pickerInput = container.querySelector('#color-picker-input');
  const hexInput = container.querySelector('#color-hex-input');
  const previewSwatch = container.querySelector('#color-preview-swatch');
  const rgbValEl = container.querySelector('#color-rgb-val');
  const hslValEl = container.querySelector('#color-hsl-val');
  const cssValEl = container.querySelector('#color-css-val');
  const saveSwatchBtn = container.querySelector('#color-save-swatch-btn');
  const clearPaletteBtn = container.querySelector('#color-clear-palette-btn');
  const swatchesGrid = container.querySelector('#palette-swatches-grid');

  const ratioWhiteEl = container.querySelector('#contrast-ratio-white');
  const ratioBlackEl = container.querySelector('#contrast-ratio-black');
  const previewTextWhite = container.querySelector('#preview-text-on-white');
  const previewTextBlack = container.querySelector('#preview-text-on-black');

  const badgeAaNormWhite = container.querySelector('#badge-aa-norm-white');
  const badgeAaLgWhite = container.querySelector('#badge-aa-lg-white');
  const badgeAaaNormWhite = container.querySelector('#badge-aaa-norm-white');

  const badgeAaNormBlack = container.querySelector('#badge-aa-norm-black');
  const badgeAaLgBlack = container.querySelector('#badge-aa-lg-black');
  const badgeAaaNormBlack = container.querySelector('#badge-aaa-norm-black');

  const STORAGE_KEY = 'viewport3_palette_history';
  const DEFAULT_PALETTE = ['#38bdf8', '#10b981', '#f59e0b', '#f43f5e', '#8b5cf6', '#a855f7', '#06b6d4', '#64748b'];

  function getPalette() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? JSON.parse(stored) : DEFAULT_PALETTE;
    } catch {
      return DEFAULT_PALETTE;
    }
  }

  function savePalette(list) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
    } catch {}
  }

  // Color conversion helpers
  function hexToRgb(hex) {
    let clean = hex.replace('#', '').trim();
    if (clean.length === 3) {
      clean = clean.split('').map(c => c + c).join('');
    }
    if (clean.length !== 6) return null;
    const num = parseInt(clean, 16);
    if (isNaN(num)) return null;
    return {
      r: (num >> 16) & 255,
      g: (num >> 8) & 255,
      b: num & 255
    };
  }

  function rgbToHsl(r, g, b) {
    r /= 255;
    g /= 255;
    b /= 255;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    let h, s, l = (max + min) / 2;

    if (max === min) {
      h = s = 0; // achromatic
    } else {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      switch (max) {
        case r: h = (g - b) / d + (g < b ? 6 : 0); break;
        case g: h = (b - r) / d + 2; break;
        case b: h = (r - g) / d + 4; break;
      }
      h /= 6;
    }
    return {
      h: Math.round(h * 360),
      s: Math.round(s * 100),
      l: Math.round(l * 100)
    };
  }

  // Relative luminance for WCAG 2.1
  function getLuminance(r, g, b) {
    const a = [r, g, b].map(v => {
      v /= 255;
      return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    });
    return a[0] * 0.2126 + a[1] * 0.7152 + a[2] * 0.0722;
  }

  function getContrastRatio(rgb1, rgb2) {
    const lum1 = getLuminance(rgb1.r, rgb1.g, rgb1.b);
    const lum2 = getLuminance(rgb2.r, rgb2.g, rgb2.b);
    const brightest = Math.max(lum1, lum2);
    const darkest = Math.min(lum1, lum2);
    return (brightest + 0.05) / (darkest + 0.05);
  }

  function updateColor(hexValue, updatePicker = true, updateHexInput = true) {
    let cleanHex = hexValue.startsWith('#') ? hexValue : `#${hexValue}`;
    const rgb = hexToRgb(cleanHex);
    if (!rgb) return;

    if (updatePicker) {
      // standard 6-digit hex for picker
      const sixHex = `#${((1 << 24) + (rgb.r << 16) + (rgb.g << 8) + rgb.b).toString(16).slice(1)}`;
      pickerInput.value = sixHex;
    }
    if (updateHexInput) {
      hexInput.value = cleanHex;
    }

    previewSwatch.style.backgroundColor = cleanHex;
    previewTextWhite.style.color = cleanHex;
    previewTextBlack.style.color = cleanHex;

    const rgbStr = `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`;
    const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);
    const hslStr = `hsl(${hsl.h}, ${hsl.s}%, ${hsl.l}%)`;
    const cssStr = `--color: ${cleanHex};`;

    rgbValEl.textContent = rgbStr;
    hslValEl.textContent = hslStr;
    cssValEl.textContent = cssStr;

    // Calculate contrast
    const whiteRgb = { r: 255, g: 255, b: 255 };
    const darkThemeRgb = { r: 15, g: 17, b: 24 };

    const ratioWhite = getContrastRatio(rgb, whiteRgb);
    const ratioBlack = getContrastRatio(rgb, darkThemeRgb);

    ratioWhiteEl.textContent = `${ratioWhite.toFixed(2)}:1`;
    ratioBlackEl.textContent = `${ratioBlack.toFixed(2)}:1`;

    // Badges update helper
    function setBadgeState(el, passed) {
      el.className = `badge-wcag ${passed ? 'wcag-pass' : 'wcag-fail'}`;
      el.textContent = `${el.textContent.split(' ')[0]} ${passed ? 'PASS' : 'FAIL'}`;
    }

    setBadgeState(badgeAaNormWhite, ratioWhite >= 4.5);
    setBadgeState(badgeAaLgWhite, ratioWhite >= 3.0);
    setBadgeState(badgeAaaNormWhite, ratioWhite >= 7.0);

    setBadgeState(badgeAaNormBlack, ratioBlack >= 4.5);
    setBadgeState(badgeAaLgBlack, ratioBlack >= 3.0);
    setBadgeState(badgeAaaNormBlack, ratioBlack >= 7.0);
  }

  function renderPalette() {
    const list = getPalette();
    swatchesGrid.innerHTML = '';
    list.forEach(hex => {
      const btn = document.createElement('button');
      btn.className = 'palette-swatch-btn';
      btn.style.backgroundColor = hex;
      btn.title = `Click to load ${hex}`;
      btn.addEventListener('click', () => {
        updateColor(hex, true, true);
      });
      swatchesGrid.appendChild(btn);
    });
  }

  pickerInput.addEventListener('input', e => {
    updateColor(e.target.value, false, true);
  });

  hexInput.addEventListener('input', e => {
    const val = e.target.value.trim();
    if (/^#?([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(val)) {
      updateColor(val, true, false);
    }
  });

  saveSwatchBtn.addEventListener('click', () => {
    const currentHex = hexInput.value.trim();
    const list = getPalette();
    if (!list.includes(currentHex)) {
      list.unshift(currentHex);
      if (list.length > 20) list.pop();
      savePalette(list);
      renderPalette();
    }
  });

  clearPaletteBtn.addEventListener('click', () => {
    savePalette([]);
    renderPalette();
  });

  container.addEventListener('click', e => {
    const copyBtn = e.target.closest('.copy-icon-btn');
    if (copyBtn) {
      const copyId = copyBtn.dataset.copy;
      const el = container.querySelector(`#${copyId}`);
      if (el && el.textContent) {
        navigator.clipboard.writeText(el.textContent);
        copyBtn.textContent = '✓';
        setTimeout(() => { copyBtn.textContent = '📋'; }, 1500);
      }
    }
  });

  // Initial render
  updateColor('#38bdf8', true, true);
  renderPalette();
}
