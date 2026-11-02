# Viewport3 - Secondary Monitor Developer Dashboard

> **Viewport3** is a lightweight, zero-dependency static web application designed to live on a secondary monitor while programming. It balances glanceability, low resource usage, and productivity utilities into a cohesive dark-mode dashboard.

```
+-----------------------------------------------------------------------------------------+
| VIEWPORT3                                  14:28:45 UTC-7   [In Flow: 42m]   [Drawer: Alt+D] |
+---------------------------------------------------+-------------------------------------+
|                  FLOWMODORO TIMER                 |             AUDIUS MUSIC            |
|  [ FOCUS: 00:42:15 ]       (Ratio: 5:1 -> 08:27)  |  "Chill Synthwave Beats #4"         |
|  [ Take Break ]  [ Reset ] [ Settings ]           |  Artist: LofiCoder | Genre: Synth    |
|  Status: Deep Focus (Music playing)               |  [<<] [ |> ] [>>]  [=====o====] Vol |
+---------------------------------------------------+-------------------------------------+
|                     SCRATCHPAD                    |          TOP PROGRAMMING NEWS       |
|  Quick dump (auto-saved to localStorage)...       |  1. Show HN: Fast SQLite WASM [98p] |
|                                                   |  2. LLM Latency Benchmarks 2026 [241p]
|  [Copy] [Clear] [Download]       Chars: 120 Words: 24 |  3. Memory Safety in Systems [180p]|
+---------------------------------------------------+-------------------------------------+
|  SLIDING UTILITY DRAWER: [JSON] [Regex] [Timestamp/TZ] [Base64] [Color] [Cron]         |
+-----------------------------------------------------------------------------------------+
```

---

## Key Features

### 1. Flowmodoro Timer
- **Flowmodoro Paradigm**: Counts **UP** while in deep work. When you decide to take a break, it calculates your earned break duration proportionally (default 5:1 ratio: 50m focus $\rightarrow$ 10m break) and counts **DOWN**.
- **Classic Pomodoro Toggle**: Switch to fixed 25/5 or 50/10 intervals at any time.
- **Music Auto-Pause**: Automatically fades down and pauses Audius playback when a break starts.
- **Harmonic Zen Bell Chime**: Synthesized dual-tone bell using the native Web Audio API (zero external audio files needed).
- **Daily Focus Tracking**: Preserves total minutes and completed sessions in `localStorage`.

### 2. Audius Focus Music & Ambient Synthesizer
- **Zero API Key Stream**: Queries public Audius discovery nodes (`api.audius.co/v1`) for music across ten listening options: *Lo-Fi Beats, Synthwave / Cyberpunk, Ambient & Drone, Deep Focus / Techno, Chiptune / 8-bit, Jazz, Classical, Downtempo, Deep House, and Drum & Bass*.
- **Offline Ambient Synthesizer**: Generative Web Audio API noise generator featuring *Binaural Rain & Storm, Brown Noise, Pink Noise, and White Noise*.
- **Subtle Audio Visualizer**: Live canvas-based frequency spectrum bar visualizer.
- **Playback Controls**: Seekbar, volume slider with mute, prev/next track, auto-advance on track completion.

### 3. Persistent Monospace Scratchpad
- **Instant Auto-Save**: Debounced persistence to `localStorage` on every keystroke.
- **Monospace Code Feel**: Tab key indenting (2 spaces), live character/word/line counters, cursor line & column position.
- **Quick Snippet Templates**: Daily TODO checklist, Meeting/Scratch log with timestamp, Code snippet block.
- **One-Click Actions**: Copy to clipboard, export as Markdown (`.md`), and clear with instant Undo.

### 4. Hacker News Programming Radar
- **Live Top Stories**: Fetches top 5 programming stories from the public Hacker News Firebase API.
- **High Glanceability**: Rank badges, point counts, host domain tags, relative timestamps, and direct discussion comment links.
- **Offline Caching**: Automatically caches stories for offline resilience.

### 5. Slide-Out Developer Utility Drawer (`Alt+D` or `Ctrl+K`)
Six dedicated developer tools accessible instantly without context switching:
1. **JSON Formatter & Minifier**: Prettify (2 or 4 spaces), Minify, Validate with exact error line/column detection, sample loader.
2. **Regex Tester & Visualizer**: Live pattern highlighting, flag toggles (`g`, `i`, `m`, `s`, `u`), capture groups inspection table, and common presets.
3. **Unix Timestamp & World Timezones**: Live ticking epoch seconds and milliseconds, bidirectional conversion, human date picker, and 8-city world timezone board.
4. **Base64 Tool**: UTF-8 safe encoder/decoder, URL-safe toggle, auto-detection, and file-to-Data-URI dropzone.
5. **Color Picker & WCAG 2.1 Contrast**: Live HEX/RGB/HSL/CSS conversion, WCAG AA & AAA contrast ratios against light/dark themes, recent palette history.
6. **Cron Expression Explainer**: Standard 5-field cron parser, natural English translation, next 5 execution times calculator, and common presets.

---

## Dark-Mode Optimized Themes

Designed specifically for secondary displays with 4 glanceable themes:
- **OLED Dark (Default)**: Pitch black background (`#050608`) with electric cyan & emerald accents.
- **Nord Deep**: Arctic dark theme (`#1e222a` / `#2e3440`) with frost blue accents.
- **Cyberpunk Slate**: High-contrast obsidian with neon pink & cyan accents.
- **Amber CRT**: Retro phosphor amber terminal with subtle scanline overlay.

---

## Keyboard Shortcuts

| Shortcut | Action |
|---|---|
| `Alt + D` or `Ctrl + K` | Toggle Developer Utilities Drawer |
| `Alt + F` | Start / Pause Flowmodoro Focus Timer |
| `Alt + T` | Cycle Color Theme |
| `Space` | Play / Pause Music (when not typing in an editor) |
| `Esc` | Close Drawer or Modal |
| `F11` | Toggle Fullscreen Mode |

---

## Quick Start

Viewport3 is a **zero-dependency static web application**. You do not need to install `npm` packages or build tools.

Simply open `index.html` in any modern web browser, or serve it locally:

```bash
# Using Node.js
npx serve .

# Or using Python (if available)
python -m http.server 8080
```

Open `http://localhost:3000` (or `http://localhost:8080`) on your secondary monitor, press `F11` for fullscreen, and enter the flow!
