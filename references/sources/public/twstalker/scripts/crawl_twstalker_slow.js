#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');

const root = process.env.ALEABITOREDDIT_OUTPUT_DIR || path.join(process.cwd(), 'references/sources/public/twstalker/raw');
const checkpointPath = path.join(root, 'aleabitoreddit-twstalker-slow-checkpoint.json');
const latestPath = path.join(root, 'aleabitoreddit-twstalker-slow-latest.json');
const session = 'twstalker-slow';
const profileUrl = 'https://twstalker.com/aleabitoreddit';

const maxPages = Number(process.argv.find(a => a.startsWith('--max-pages='))?.split('=')[1] || 40);
const delayMin = Number(process.argv.find(a => a.startsWith('--delay-min-ms='))?.split('=')[1] || 25000);
const delayMax = Number(process.argv.find(a => a.startsWith('--delay-max-ms='))?.split('=')[1] || 35000);
const targetOldest = process.argv.find(a => a.startsWith('--target-oldest='))?.split('=')[1] || '2025-07-01T00:00:00.000Z';
const fresh = process.argv.includes('--fresh');

fs.mkdirSync(root, { recursive: true });

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function runOpenCli(args, timeout = 120000, maxBuffer = 96 * 1024 * 1024) {
  return new Promise(resolve => {
    execFile('opencli', args, { timeout, maxBuffer }, (error, stdout, stderr) => {
      if (error) {
        resolve({ ok: false, error: String(error.message || error), stderr: String(stderr || '') });
      } else {
        resolve({ ok: true, stdout });
      }
    });
  });
}

function isoDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function loadCheckpoint() {
  if (fresh || !fs.existsSync(checkpointPath)) {
    return {
      capturedAt: new Date().toISOString(),
      account: 'aleabitoreddit',
      method: 'twstalker /service/api profile cursor, slow one-page requests',
      cursor: null,
      page: 2,
      done: false,
      chunks: [],
      items: []
    };
  }
  return JSON.parse(fs.readFileSync(checkpointPath, 'utf8'));
}

function saveCheckpoint(state) {
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

async function initializeCursor(state) {
  if (state.cursor) return;
  const open = await runOpenCli(['browser', session, 'open', profileUrl], 90000, 2 * 1024 * 1024);
  if (!open.ok) throw new Error(`open failed: ${open.error}`);
  await sleep(2500);
  const init = await runOpenCli([
    'browser',
    session,
    'eval',
    `(() => {
      const a = document.querySelector('.add-nw-event');
      return {
        url: location.href,
        title: document.title,
        hasChallenge: /Just a moment|Verifying|Cloudflare/i.test(document.body.innerText + document.title),
        cursor: a?.getAttribute('data-cursor') || null,
        page: Number(a?.getAttribute('data-ec') || 2),
        data: a?.getAttribute('data-query') || '1940360837547565056'
      };
    })()`
  ], 60000, 2 * 1024 * 1024);
  if (!init.ok) throw new Error(`init failed: ${init.error}`);
  const parsed = JSON.parse(init.stdout);
  if (parsed.hasChallenge || !parsed.cursor) {
    throw new Error(`TwStalker not ready: ${JSON.stringify(parsed)}`);
  }
  state.cursor = parsed.cursor;
  state.page = parsed.page || 2;
  state.data = parsed.data || '1940360837547565056';
  saveCheckpoint(state);
}

async function fetchOnePage(state) {
  const js = `async () => {
    const clean = (value) => {
      const div = document.createElement('div');
      div.innerHTML = value || '';
      return div.innerText || div.textContent || '';
    };
    const params = new URLSearchParams({
      page: ${JSON.stringify(String(state.page))},
      cursor: ${JSON.stringify(state.cursor)},
      data: ${JSON.stringify(state.data || '1940360837547565056')},
      action: 'profile'
    });
    const response = await fetch('/service/api', {
      method: 'POST',
      headers: {
        'content-type': 'application/x-www-form-urlencoded; charset=UTF-8',
        'x-requested-with': 'XMLHttpRequest'
      },
      body: params
    });
    const text = await response.text();
    let json = null;
    try {
      json = JSON.parse(text);
    } catch (error) {
      return {
        ok: false,
        status: response.status,
        error: 'parse',
        sample: text.slice(0, 220),
        hasChallenge: /Just a moment|Verifying|Cloudflare/i.test(text)
      };
    }
    const tweets = json && json.tweets ? Object.values(json.tweets) : [];
    return {
      ok: response.ok,
      status: response.status,
      cursor: json?.cursor || null,
      tweetCount: tweets.length,
      rows: tweets.map(tweet => {
        const author = tweet.core?.screen_name || null;
        const id = String(tweet.conversation_id_str || tweet.rest_id || tweet.id_str || '');
        const text = clean(tweet.full_text || '');
        return {
          id,
          author,
          name: tweet.core?.name || null,
          created_at: tweet.created_at || null,
          text,
          textLength: text.length,
          is_retweet: Boolean(tweet.is_retweet),
          reply_count: tweet.reply_count ?? null,
          retweet_count: tweet.retweet_count ?? null,
          favorite_count: tweet.favorite_count ?? null,
          quote_count: tweet.quote_count ?? null,
          view_count: tweet.view_count ?? null,
          mediaCount: tweet.extended_entities?.media?.length || 0,
          url: author && id ? ('https://x.com/' + author + '/status/' + id) : null,
          source: 'twstalker service/api profile'
        };
      })
    };
  }`;
  const result = await runOpenCli(['browser', session, 'eval', js], 90000, 96 * 1024 * 1024);
  if (!result.ok) return { ok: false, error: result.error, stderr: result.stderr };
  return JSON.parse(result.stdout);
}

(async () => {
  const state = loadCheckpoint();
  await initializeCursor(state);

  let pagesFetched = 0;
  for (; pagesFetched < maxPages && state.cursor && !state.done; pagesFetched += 1) {
    const page = state.page;
    const result = await fetchOnePage(state);
    if (!result.ok) {
      state.chunks.push({
        page,
        ok: false,
        status: result.status || null,
        error: result.error || 'fetch failed',
        hasChallenge: Boolean(result.hasChallenge),
        sample: result.sample || result.stderr || '',
        at: new Date().toISOString()
      });
      saveCheckpoint(state);
      console.log(JSON.stringify({ event: 'stop', page, reason: state.chunks.at(-1) }));
      break;
    }

    const rows = result.rows
      .map(row => ({ ...row, datetime: isoDate(row.created_at) }))
      .filter(row => row.author === 'aleabitoreddit' && !row.is_retweet && row.id);

    const existing = new Set(state.items.map(item => item.id));
    let added = 0;
    for (const row of rows) {
      if (!existing.has(row.id)) {
        state.items.push(row);
        existing.add(row.id);
        added += 1;
      }
    }

    state.cursor = result.cursor;
    state.page = page + 1;
    state.emptyStreak = result.tweetCount === 0 ? (state.emptyStreak || 0) + 1 : 0;
    if (!result.cursor || state.emptyStreak >= 3) state.done = true;
    state.chunks.push({
      page,
      ok: true,
      tweetCount: result.tweetCount,
      ownCount: rows.length,
      added,
      emptyStreak: state.emptyStreak,
      nextPage: state.page,
      at: new Date().toISOString()
    });
    saveCheckpoint(state);

    const dates = state.items.map(item => item.datetime).filter(Boolean).sort();
    console.log(JSON.stringify({
      event: 'page',
      page,
      tweetCount: result.tweetCount,
      ownCount: rows.length,
      added,
      total: state.items.length,
      oldest: dates[0] || null,
      newest: dates.at(-1) || null
    }));

    if (dates[0] && dates[0] <= targetOldest) break;
    const wait = delayMin + Math.floor(Math.random() * Math.max(1, delayMax - delayMin));
    await sleep(wait);
  }

  saveCheckpoint(state);
  console.log(JSON.stringify({
    event: 'done',
    latestPath,
    checkpointPath,
    pagesFetched,
    count: state.count,
    oldest: state.oldest,
    newest: state.newest,
    noText: state.noText,
    nextPage: state.page,
    hasCursor: Boolean(state.cursor),
    stoppedByError: state.chunks.some(chunk => chunk.ok === false)
  }));
})().catch(error => {
  console.error(error);
  process.exit(1);
});
