import assert from 'node:assert/strict';
import { test } from 'node:test';
import { FlowmodoroTimer } from '../js/modules/flowmodoro.js';

class Element extends EventTarget {
  value = '';
  textContent = '';
  innerHTML = '';
  classList = { add() {}, remove() {} };
}

function createTimer(t, mode = 'flowmodoro') {
  const elements = new Map();
  const stored = new Map([['v3_timer_mode', mode]]);
  const intervals = new Map();
  const events = [];
  let time = Date.UTC(2026, 10, 5, 12);
  let nextInterval = 1;
  const document = new EventTarget();
  document.getElementById = id => {
    if (!elements.has(id)) elements.set(id, new Element());
    return elements.get(id);
  };
  const globals = {
    document,
    window: new EventTarget(),
    localStorage: { getItem: key => stored.get(key) ?? null, setItem: (key, value) => stored.set(key, value) },
    alert: () => assert.fail('Unexpected alert')
  };
  for (const [key, value] of Object.entries(globals)) {
    const previous = Object.getOwnPropertyDescriptor(globalThis, key);
    Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
    t.after(() => {
      if (previous) Object.defineProperty(globalThis, key, previous);
      else delete globalThis[key];
    });
  }
  t.mock.method(Date, 'now', () => time);
  t.mock.method(globalThis, 'setInterval', callback => {
    const id = nextInterval++;
    intervals.set(id, callback);
    return id;
  });
  t.mock.method(globalThis, 'clearInterval', id => intervals.delete(id));
  const timer = new FlowmodoroTimer({ emit: (name, data) => events.push({ name, data }) });
  const advance = milliseconds => { time += milliseconds; };
  const tick = () => { [...intervals.values()].forEach(callback => callback()); };
  return { timer, advance, tick, events, intervals, stored };
}

test('focus counts all elapsed time when a hidden tab receives only one callback', t => {
  const { timer, advance, tick } = createTimer(t);
  timer.startFocus();
  advance(30 * 60 * 1000);
  tick();
  assert.equal(timer.elapsedSeconds, 1800);
  assert.equal(timer.todayFocusSeconds, 1800);
  assert.equal(timer.timerDisplayEl.textContent, '30:00');
});

test('irregular callbacks preserve fractional seconds without double counting', t => {
  const { timer, advance, tick } = createTimer(t);
  timer.startFocus();
  advance(1700);
  tick();
  advance(4500);
  tick();
  assert.equal(timer.elapsedSeconds, 6);
  assert.equal(timer.todayFocusSeconds, 6);
  tick();
  assert.equal(timer.elapsedSeconds, 6);
  advance(800);
  tick();
  assert.equal(timer.elapsedSeconds, 7);
});

test('visibility and page restoration catch up without waiting for another interval', t => {
  const { timer, advance } = createTimer(t);
  timer.startFocus();
  advance(120000);
  document.dispatchEvent(new Event('visibilitychange'));
  assert.equal(timer.elapsedSeconds, 120);
  advance(60000);
  window.dispatchEvent(new Event('pageshow'));
  assert.equal(timer.elapsedSeconds, 180);
  advance(30000);
  window.dispatchEvent(new Event('focus'));
  assert.equal(timer.elapsedSeconds, 210);
});

test('pause settles hidden focus time and resume excludes time spent paused', t => {
  const { timer, advance, tick, stored } = createTimer(t);
  timer.startFocus();
  advance(12500);
  timer.pause();
  assert.equal(timer.elapsedSeconds, 12);
  assert.equal(stored.get('v3_stats_focus_sec'), '12');
  advance(3600000);
  timer.startFocus();
  advance(500);
  tick();
  assert.equal(timer.elapsedSeconds, 13);
  assert.equal(timer.todayFocusSeconds, 13);
});

test('taking a break uses all focus time even if no interval ran in the background', t => {
  const { timer, advance } = createTimer(t);
  timer.startFocus();
  advance(300000);
  timer.startBreak();
  assert.equal(timer.state, 'break');
  assert.equal(timer.elapsedSeconds, 60);
  assert.equal(timer.earnedBreakSeconds, 60);
  assert.equal(timer.todayFocusSeconds, 300);
  assert.equal(timer.sessionsCompleted, 1);
});

test('an overdue earned break completes once without accumulating more focus', t => {
  const { timer, advance, tick, events, intervals } = createTimer(t);
  timer.startFocus();
  advance(300000);
  timer.startBreak();
  advance(120000);
  document.dispatchEvent(new Event('visibilitychange'));
  tick();
  window.dispatchEvent(new Event('focus'));
  assert.equal(timer.state, 'idle');
  assert.equal(timer.elapsedSeconds, 0);
  assert.equal(timer.todayFocusSeconds, 300);
  assert.equal(intervals.size, 0);
  assert.equal(events.filter(e => e.name === 'flowmodoro:break-end').length, 1);
});

test('classic focus countdown remains accurate after a background gap', t => {
  const { timer, advance, tick } = createTimer(t, 'classic');
  timer.startFocus();
  advance(10 * 60 * 1000);
  tick();
  assert.equal(timer.state, 'focus');
  assert.equal(timer.elapsedSeconds, 15 * 60);
  assert.equal(timer.todayFocusSeconds, 10 * 60);
});

test('classic catch-up includes elapsed break time and counts the session only once', t => {
  const { timer, advance, tick, events, intervals, stored } = createTimer(t, 'classic');
  timer.startFocus();
  advance(26 * 60 * 1000);
  tick();
  assert.equal(timer.state, 'break');
  assert.equal(timer.elapsedSeconds, 4 * 60);
  assert.equal(timer.todayFocusSeconds, 25 * 60);
  assert.equal(timer.sessionsCompleted, 1);
  assert.equal(stored.get('v3_stats_sessions'), '1');
  assert.equal(intervals.size, 1);
  assert.equal(events.filter(e => e.name === 'flowmodoro:break-start').length, 1);
});

test('classic catch-up carries fractional time across the focus-to-break boundary', t => {
  const { timer, advance, tick } = createTimer(t, 'classic');
  timer.startFocus();
  advance(1500500);
  tick();
  assert.equal(timer.state, 'break');
  assert.equal(timer.elapsedSeconds, 300);
  advance(500);
  tick();
  assert.equal(timer.elapsedSeconds, 299);
});

test('a long suspension that spans classic focus and break stops at idle', t => {
  const { timer, advance, tick, events, intervals } = createTimer(t, 'classic');
  timer.startFocus();
  advance(2 * 60 * 60 * 1000);
  tick();
  window.dispatchEvent(new Event('pageshow'));
  assert.equal(timer.state, 'idle');
  assert.equal(timer.elapsedSeconds, 0);
  assert.equal(timer.todayFocusSeconds, 1500);
  assert.equal(timer.sessionsCompleted, 1);
  assert.equal(intervals.size, 0);
  assert.equal(events.filter(e => e.name === 'flowmodoro:break-start').length, 1);
  assert.equal(events.filter(e => e.name === 'flowmodoro:break-end').length, 1);
});

test('reset settles pending focus time and prevents future background catch-up', t => {
  const { timer, advance, tick, intervals, stored } = createTimer(t);
  timer.startFocus();
  advance(12500);
  timer.reset();
  advance(60000);
  tick();
  document.dispatchEvent(new Event('visibilitychange'));
  assert.equal(timer.state, 'idle');
  assert.equal(timer.elapsedSeconds, 0);
  assert.equal(timer.todayFocusSeconds, 12);
  assert.equal(stored.get('v3_stats_focus_sec'), '12');
  assert.equal(intervals.size, 0);
});

test('returning from an earned break starts a fresh focus timer', t => {
  const { timer, advance, tick } = createTimer(t);
  timer.startFocus();
  advance(300000);
  timer.startBreak();
  advance(20000);
  timer.startFocus();
  assert.equal(timer.elapsedSeconds, 0);
  advance(1000);
  tick();
  assert.equal(timer.elapsedSeconds, 1);
  assert.equal(timer.todayFocusSeconds, 301);
});

test('returning from a classic break starts the full configured focus duration', t => {
  const { timer, advance, tick } = createTimer(t, 'classic');
  timer.startFocus();
  advance(1500000);
  tick();
  advance(10000);
  timer.startFocus();
  assert.equal(timer.state, 'focus');
  assert.equal(timer.elapsedSeconds, 1500);
  assert.equal(timer.todayFocusSeconds, 1500);
});

test('changing mode settles elapsed time under the previous mode before resetting', t => {
  const { timer, advance } = createTimer(t);
  timer.startFocus();
  advance(120000);
  timer.modeSelect.value = 'classic';
  timer.modeSelect.dispatchEvent(new Event('change'));
  assert.equal(timer.mode, 'classic');
  assert.equal(timer.state, 'idle');
  assert.equal(timer.elapsedSeconds, 0);
  assert.equal(timer.todayFocusSeconds, 120);
});
