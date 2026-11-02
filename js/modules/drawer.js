/**
 * Viewport3 - Sliding Utility Drawer Controller
 */

import { initJsonFormatter } from '../utilities/jsonFormatter.js';
import { initRegexTester } from '../utilities/regexTester.js';
import { initTimestampConverter } from '../utilities/timestampConverter.js';
import { initBase64Converter } from '../utilities/base64Converter.js';
import { initColorPicker } from '../utilities/colorPicker.js';
import { initCronScheduler } from '../utilities/cronScheduler.js';

export class UtilityDrawer {
  constructor() {
    this.drawerEl = document.getElementById('utility-drawer');
    this.backdropEl = document.getElementById('drawer-backdrop');
    this.closeBtn = document.getElementById('drawer-close-btn');
    this.tabsContainer = document.getElementById('drawer-tabs');
    this.contentContainer = document.getElementById('drawer-content');
    this.toggleBtns = document.querySelectorAll('.js-drawer-toggle');

    this.isOpen = false;
    this.activeTab = localStorage.getItem('viewport3_active_util_tab') || 'json';
    this.initializedTabs = new Set();

    this.tabConfigs = {
      json: { label: 'JSON Formatter', init: initJsonFormatter },
      regex: { label: 'Regex Tester', init: initRegexTester },
      timestamp: { label: 'Unix & Clocks', init: initTimestampConverter },
      base64: { label: 'Base64 Tool', init: initBase64Converter },
      color: { label: 'Color & Contrast', init: initColorPicker },
      cron: { label: 'Cron Scheduler', init: initCronScheduler }
    };

    this.init();
  }

  init() {
    // Bind toggle buttons
    this.toggleBtns.forEach(btn => {
      btn.addEventListener('click', () => this.toggle());
    });

    // Close button & backdrop
    if (this.closeBtn) {
      this.closeBtn.addEventListener('click', () => this.close());
    }
    if (this.backdropEl) {
      this.backdropEl.addEventListener('click', () => this.close());
    }

    // Keyboard shortcuts: Alt+D or Ctrl+K to toggle, Esc to close
    window.addEventListener('keydown', e => {
      // Don't trigger Ctrl+K if typing in an input unless it's the specific hotkey
      if ((e.altKey && (e.key === 'd' || e.key === 'D')) || (e.ctrlKey && e.key === 'k')) {
        e.preventDefault();
        this.toggle();
      } else if (e.key === 'Escape' && this.isOpen) {
        this.close();
      }
    });

    // Bind tab clicks
    if (this.tabsContainer) {
      this.tabsContainer.addEventListener('click', e => {
        const tabBtn = e.target.closest('.drawer-tab-btn');
        if (tabBtn && tabBtn.dataset.tab) {
          this.switchTab(tabBtn.dataset.tab);
        }
      });
    }

    // Prepare tab panels
    this.renderPanels();
    this.switchTab(this.activeTab);
  }

  renderPanels() {
    this.contentContainer.innerHTML = '';
    Object.keys(this.tabConfigs).forEach(tabId => {
      const panel = document.createElement('div');
      panel.id = `panel-${tabId}`;
      panel.className = 'drawer-panel';
      panel.style.display = 'none';
      this.contentContainer.appendChild(panel);
    });
  }

  switchTab(tabId) {
    if (!this.tabConfigs[tabId]) tabId = 'json';
    this.activeTab = tabId;
    localStorage.setItem('viewport3_active_util_tab', tabId);

    // Update tab button active states
    const tabBtns = this.tabsContainer.querySelectorAll('.drawer-tab-btn');
    tabBtns.forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tab === tabId);
    });

    // Switch visible panel
    Object.keys(this.tabConfigs).forEach(id => {
      const panel = document.getElementById(`panel-${id}`);
      if (panel) {
        if (id === tabId) {
          panel.style.display = 'block';
          // Initialize tab if not already initialized
          if (!this.initializedTabs.has(id)) {
            this.tabConfigs[id].init(panel);
            this.initializedTabs.add(id);
          }
        } else {
          panel.style.display = 'none';
        }
      }
    });
  }

  open(tabId = null) {
    if (tabId && this.tabConfigs[tabId]) {
      this.switchTab(tabId);
    }
    this.isOpen = true;
    this.drawerEl.classList.add('open');
    this.backdropEl.classList.add('visible');
    document.body.classList.add('drawer-opened');
  }

  close() {
    this.isOpen = false;
    this.drawerEl.classList.remove('open');
    this.backdropEl.classList.remove('visible');
    document.body.classList.remove('drawer-opened');
  }

  toggle() {
    if (this.isOpen) {
      this.close();
    } else {
      this.open();
    }
  }
}
