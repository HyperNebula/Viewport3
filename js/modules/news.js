/**
 * Viewport3 - Minimalist Programming News Feed (Hacker News Firebase API)
 */

export class NewsFeed {
  constructor() {
    this.storageKey = 'viewport3_hn_cache';
    this.storageTimeKey = 'viewport3_hn_cache_time';
    this.stories = [];
    this.isLoading = false;

    // DOM Elements
    this.listContainer = document.getElementById('news-list');
    this.refreshBtn = document.getElementById('news-refresh-btn');
    this.lastUpdatedEl = document.getElementById('news-last-updated');

    this.CURATED_FALLBACK = [
      {
        id: 40000001,
        title: 'Sample article 1',
        url: 'https://example.com/article-1',
        domain: 'example.com',
        score: 342,
        by: 'user',
        commentsCount: 98,
        time: Date.now() / 1000 - 3600 * 2
      },
      {
        id: 40000002,
        title: 'Sample article 2',
        url: 'https://example.com/article-2',
        domain: 'example.com',
        score: 512,
        by: 'user',
        commentsCount: 241,
        time: Date.now() / 1000 - 3600 * 4
      },
      {
        id: 40000003,
        title: 'Sample article 3',
        url: 'https://example.com/article-3',
        domain: 'example.com',
        score: 180,
        by: 'user',
        commentsCount: 76,
        time: Date.now() / 1000 - 3600 * 5
      },
      {
        id: 40000004,
        title: 'Sample article 4',
        url: 'https://example.com/article-4',
        domain: 'example.com',
        score: 295,
        by: 'user',
        commentsCount: 114,
        time: Date.now() / 1000 - 3600 * 7
      },
      {
        id: 40000005,
        title: 'Sample article 5',
        url: 'https://example.com/article-5',
        domain: 'example.com',
        score: 164,
        by: 'user',
        commentsCount: 52,
        time: Date.now() / 1000 - 3600 * 9
      }
    ];

    this.init();
  }

  init() {
    this.bindEvents();
    this.loadCachedStories();
    this.fetchTopStories();

    // Auto-refresh every 30 minutes
    setInterval(() => {
      this.fetchTopStories();
    }, 30 * 60 * 1000);
  }

  bindEvents() {
    if (this.refreshBtn) {
      this.refreshBtn.addEventListener('click', () => {
        if (!this.isLoading) {
          this.fetchTopStories(true);
        }
      });
    }
  }

  loadCachedStories() {
    try {
      const cached = localStorage.getItem(this.storageKey);
      const cacheTime = localStorage.getItem(this.storageTimeKey);
      if (cached) {
        this.stories = JSON.parse(cached);
        this.renderStories(true);
        if (cacheTime) {
          const d = new Date(parseInt(cacheTime, 10));
          this.lastUpdatedEl.textContent = `Cached ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
        }
      } else {
        this.stories = this.CURATED_FALLBACK;
        this.renderStories();
      }
    } catch {
      this.stories = this.CURATED_FALLBACK;
      this.renderStories();
    }
  }

  extractDomain(url) {
    if (!url) return 'news.ycombinator.com';
    try {
      const parsed = new URL(url);
      return parsed.hostname.replace(/^www\./, '');
    } catch {
      return 'external';
    }
  }

  formatRelativeTime(unixSec) {
    const diffSec = Math.floor(Date.now() / 1000 - unixSec);
    if (diffSec < 60) return 'just now';
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffH = Math.floor(diffMin / 60);
    if (diffH < 24) return `${diffH}h ago`;
    const diffD = Math.floor(diffH / 24);
    return `${diffD}d ago`;
  }

  async fetchTopStories(isManual = false) {
    this.isLoading = true;
    if (this.refreshBtn) this.refreshBtn.classList.add('spinning');
    if (this.lastUpdatedEl) this.lastUpdatedEl.textContent = 'Updating...';

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 7000);

      // Fetch the ranked ID list, then select five locally. Firebase rejects
      // limitToFirst without orderBy, and HN exposes this list as an array.
      const topUrl = 'https://hacker-news.firebaseio.com/v0/topstories.json';
      const topResp = await fetch(topUrl, { signal: controller.signal });
      clearTimeout(timeoutId);

      if (!topResp.ok) throw new Error(`HTTP ${topResp.status}`);
      const ids = await topResp.json();

      if (Array.isArray(ids) && ids.length > 0) {
        // Fetch top 5 items in parallel
        const itemPromises = ids.slice(0, 5).map(async id => {
          try {
            const itemResp = await fetch(`https://hacker-news.firebaseio.com/v0/item/${id}.json`);
            if (itemResp.ok) {
              return await itemResp.json();
            }
          } catch {
            return null;
          }
        });

        const items = await Promise.all(itemPromises);
        const validStories = items.filter(Boolean).map(item => ({
          id: item.id,
          title: item.title,
          url: item.url || `https://news.ycombinator.com/item?id=${item.id}`,
          domain: this.extractDomain(item.url),
          score: item.score || 0,
          by: item.by || 'anonymous',
          commentsCount: item.descendants || 0,
          time: item.time || (Date.now() / 1000)
        }));

        if (validStories.length > 0) {
          this.stories = validStories;
          localStorage.setItem(this.storageKey, JSON.stringify(validStories));
          localStorage.setItem(this.storageTimeKey, Date.now().toString());

          const now = new Date();
          this.lastUpdatedEl.textContent = `Updated ${now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
          this.renderStories();
        }
      }
    } catch (err) {
      console.info('HN feed offline or timeout; keeping cached stories:', err.message);
      if (this.stories.length === 0) {
        this.stories = this.CURATED_FALLBACK;
      }
      this.lastUpdatedEl.textContent = 'Offline (cached)';
      this.renderStories(true);
    } finally {
      this.isLoading = false;
      if (this.refreshBtn) this.refreshBtn.classList.remove('spinning');
    }
  }

  renderStories(isOffline = false) {
    this.listContainer.innerHTML = '';

    this.stories.slice(0, 5).forEach((story, idx) => {
      const itemEl = document.createElement('article');
      itemEl.className = 'news-item';

      const hnDiscussUrl = `https://news.ycombinator.com/item?id=${story.id}`;

      itemEl.innerHTML = `
        <div class="news-rank">${idx + 1}</div>
        <div class="news-content">
          <div class="news-title-row">
            <a href="${story.url}" target="_blank" rel="noopener noreferrer" class="news-title" title="${story.title}">
              ${story.title}
            </a>
            <span class="news-domain" title="Host">${story.domain}</span>
          </div>
          <div class="news-meta">
            <span class="news-score" title="Upvotes">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><polygon points="12 2 2 22 22 22"></polygon></svg>
              ${story.score} pts
            </span>
            <span class="news-author">by ${story.by}</span>
            <span class="news-time">${this.formatRelativeTime(story.time)}</span>
            <a href="${hnDiscussUrl}" target="_blank" rel="noopener noreferrer" class="news-comments-link" title="Discuss on Hacker News">
              💬 ${story.commentsCount}
            </a>
          </div>
        </div>
      `;
      this.listContainer.appendChild(itemEl);
    });
  }
}
