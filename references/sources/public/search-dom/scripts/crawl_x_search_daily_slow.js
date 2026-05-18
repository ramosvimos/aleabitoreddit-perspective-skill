#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');

const root = process.env.ALEABITOREDDIT_OUTPUT_DIR || path.join(process.cwd(), 'references/sources/public/search-dom/raw');
const checkpointPath = path.join(root, 'aleabitoreddit-public-search-dom-slow-checkpoint.json');
const latestPath = path.join(root, 'aleabitoreddit-public-search-dom-slow-latest.json');
const session = 'xsearch-dom-slow';
const dayMs = 24 * 60 * 60 * 1000;

const startDate = process.argv.find(arg => arg.startsWith('--start-date='))?.split('=')[1] || '2025-07-01';
const endDate = process.argv.find(arg => arg.startsWith('--end-date='))?.split('=')[1] || '2026-02-09';
const maxDays = Number(process.argv.find(arg => arg.startsWith('--max-days='))?.split('=')[1] || 10);
const delayMin = Number(process.argv.find(arg => arg.startsWith('--delay-min-ms='))?.split('=')[1] || 45000);
const delayMax = Number(process.argv.find(arg => arg.startsWith('--delay-max-ms='))?.split('=')[1] || 60000);
const fresh = process.argv.includes('--fresh');

fs.mkdirSync(root, { recursive: true });

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function ymd(ms) {
  return new Date(ms).toISOString().slice(0, 10);
}

function runOpenCli(args, timeout = 150000, maxBuffer = 96 * 1024 * 1024) {
  return new Promise(resolve => {
    execFile('opencli', args, { timeout, maxBuffer }, (error, stdout, stderr) => {
      if (error) resolve({ ok: false, error: String(error.message || error), stderr: String(stderr || '') });
      else resolve({ ok: true, stdout });
    });
  });
}

function loadState() {
  if (fresh || !fs.existsSync(checkpointPath)) {
    return {
      capturedAt: new Date().toISOString(),
      account: 'aleabitoreddit',
      method: 'x.com search DOM daily slow scroll',
      nextEndDate: endDate,
      startDate,
      days: [],
      items: []
    };
  }
  return JSON.parse(fs.readFileSync(checkpointPath, 'utf8'));
}

function saveState(state) {
  state.updatedAt = new Date().toISOString();
  const ids = new Set();
  state.items = state.items
    .filter(item => {
      if (!item.id || ids.has(item.id)) return false;
      ids.add(item.id);
      return true;
    })
    .sort((a, b) => String(b.datetime || '').localeCompare(String(a.datetime || '')));
  state.count = state.items.length;
  state.oldest = state.items.map(item => item.datetime).filter(Boolean).sort()[0] || null;
  state.newest = state.items.map(item => item.datetime).filter(Boolean).sort().at(-1) || null;
  state.noText = state.items.filter(item => !(item.text || '').length).length;
  fs.writeFileSync(checkpointPath, JSON.stringify(state, null, 2));
  fs.copyFileSync(checkpointPath, latestPath);
}

async function scrapeDay(date) {
  const start = Date.parse(`${date}T00:00:00.000Z`);
  const next = ymd(start + dayMs);
  const query = `from:aleabitoreddit since:${date} until:${next}`;
  const url = `https://x.com/search?q=${encodeURIComponent(query)}&f=live`;
  const open = await runOpenCli(['browser', session, 'open', url], 90000, 2 * 1024 * 1024);
  if (!open.ok) return { ok: false, date, stage: 'open', error: open.error, stderr: open.stderr };
  await sleep(1400);

  const js = `async () => {
    const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
    const seen = new Map();
    const errorHints = () => ['Something went wrong', 'Try again', 'Rate limit', '出错', '重试']
      .filter(text => document.body.innerText.includes(text));
    const collect = () => {
      for (const article of document.querySelectorAll('article')) {
        const time = article.querySelector('time');
        const href = time?.closest('a')?.href ||
          [...article.querySelectorAll('a[href*="/status/"]')].map(a => a.href).find(Boolean) || '';
        const id = (href.match(/status\\/(\\d+)/) || [])[1];
        if (!id) continue;
        const text = article.querySelector('[data-testid="tweetText"]')?.innerText || '';
        seen.set(id, {
          id,
          url: href,
          datetime: time?.getAttribute('datetime') || null,
          text,
          textLength: text.length,
          has_media: article.querySelectorAll('img[src*="twimg.com/media"],video').length > 0,
          mediaCount: article.querySelectorAll('img[src*="twimg.com/media"],video').length,
          source: 'x.com search DOM daily slow'
        });
      }
    };
    window.scrollTo(0, 0);
    await sleep(1200);
    if (errorHints().length && !document.querySelectorAll('article').length) {
      return { ok: false, errorHints: errorHints(), count: 0, items: [], title: document.title, bodyLen: document.body.innerText.length };
    }
    let stagnant = 0;
    let previousCount = -1;
    let previousY = -1;
    for (let i = 0; i < 95; i++) {
      collect();
      window.scrollBy(0, Math.max(620, Math.floor(window.innerHeight * 0.9)));
      await sleep(520 + Math.random() * 420);
      collect();
      const y = window.scrollY;
      const nearBottom = y + window.innerHeight >= document.body.scrollHeight - 80;
      if (seen.size === previousCount && (Math.abs(y - previousY) < 8 || nearBottom)) stagnant += 1;
      else stagnant = 0;
      previousCount = seen.size;
      previousY = y;
      if (stagnant >= 6) break;
    }
    const items = [...seen.values()].sort((a, b) => String(b.datetime || '').localeCompare(String(a.datetime || '')));
    return {
      ok: true,
      count: items.length,
      oldest: items.map(item => item.datetime).filter(Boolean).sort()[0] || null,
      newest: items.map(item => item.datetime).filter(Boolean).sort().at(-1) || null,
      height: document.body.scrollHeight,
      scrollY: window.scrollY,
      items
    };
  }`;

  const result = await runOpenCli(['browser', session, 'eval', js], 150000, 96 * 1024 * 1024);
  if (!result.ok) return { ok: false, date, stage: 'eval', error: result.error, stderr: result.stderr };
  const parsed = JSON.parse(result.stdout);
  if (!parsed.ok) return { ok: false, date, stage: 'page_error', error: parsed.errorHints?.join(', ') || 'page error', parsed };
  const items = (parsed.items || []).filter(item => item.datetime && item.datetime.slice(0, 10) === date);
  return { ok: true, date, count: items.length, rawCount: parsed.count, oldest: parsed.oldest, newest: parsed.newest, height: parsed.height, scrollY: parsed.scrollY, items };
}

(async () => {
  const state = loadState();
  let endMs = Date.parse(`${state.nextEndDate || endDate}T00:00:00.000Z`);
  const startMs = Date.parse(`${state.startDate || startDate}T00:00:00.000Z`);

  for (let i = 0; i < maxDays && endMs > startMs; i++) {
    const date = ymd(endMs - dayMs);
    const result = await scrapeDay(date);
    if (!result.ok) {
      state.days.push(result);
      saveState(state);
      console.log(JSON.stringify({ event: 'stop', date, result }));
      break;
    }
    const existing = new Set(state.items.map(item => item.id));
    let added = 0;
    for (const item of result.items) {
      if (!existing.has(item.id)) {
        state.items.push(item);
        existing.add(item.id);
        added += 1;
      }
    }
    state.days.push({ ...result, items: undefined, added });
    endMs -= dayMs;
    state.nextEndDate = ymd(endMs);
    saveState(state);
    console.log(JSON.stringify({ event: 'day', date, count: result.count, added, total: state.items.length, oldest: state.oldest, newest: state.newest }));
    const wait = delayMin + Math.floor(Math.random() * Math.max(1, delayMax - delayMin));
    await sleep(wait);
  }

  saveState(state);
  console.log(JSON.stringify({ event: 'done', latestPath, checkpointPath, count: state.count, oldest: state.oldest, newest: state.newest, nextEndDate: state.nextEndDate, noText: state.noText }));
})().catch(error => {
  console.error(error);
  process.exit(1);
});
