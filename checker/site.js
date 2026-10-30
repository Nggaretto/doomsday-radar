// قراءة موقع جلاكسي: دوّر على الفيلم -> مواعيد الحجز -> خريطة المقاعد.
// ملاحظة: الحجز لسه مفتحش وقت كتابة الكود، فالقراءة عامة (Generic) وبتتظبط بالـ SELECTORS في config.js.
// شغّل `npm run debug` أول ما الحجز يفتح وهيحفظ الصفحات في checker/debug عشان نظبط الدقة.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const cheerio = require('cheerio');
const cfg = require('./config');

const UA =
  'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Mobile Safari/537.36';

const clean = (s) => (s || '').replace(/\s+/g, ' ').trim();
const hash = (s) => crypto.createHash('sha1').update(s).digest('hex').slice(0, 8);

function abs(base, href) {
  if (!href || /^(javascript:|mailto:|tel:|#)/i.test(href)) return null;
  try {
    return new URL(href, base).href;
  } catch {
    return null;
  }
}

function saveDebug(name, html) {
  if (!cfg.debug) return;
  const dir = path.join(__dirname, 'debug');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, name.replace(/[^a-z0-9._-]/gi, '_').slice(0, 80) + '.html'), html);
}

async function getHtml(url) {
  let out;
  if (cfg.useBrowser) {
    const { chromium } = require('playwright');
    const browser = await chromium.launch();
    try {
      const page = await browser.newPage({ locale: 'ar-EG' });
      await page.goto(url, { waitUntil: 'networkidle', timeout: 45000 });
      out = { html: await page.content(), url: page.url() };
    } finally {
      await browser.close();
    }
  } else {
    const r = await fetch(url, {
      headers: { 'user-agent': UA, 'accept-language': 'ar-EG,ar;q=0.9,en;q=0.8' },
      redirect: 'follow',
      signal: AbortSignal.timeout(20000),
    });
    if (!r.ok) throw new Error(`HTTP ${r.status} for ${url}`);
    out = { html: await r.text(), url: r.url };
  }
  saveDebug(new URL(out.url).pathname + '_' + hash(out.url), out.html);
  return out;
}

// 1) دوّر على صفحة الفيلم
async function findMovie() {
  const home = await getHtml(cfg.baseUrl);
  const pages = [home];
  const $h = cheerio.load(home.html);
  const nav = new Set();
  $h('a[href]').each((_, a) => {
    const t = ($h(a).text() + ' ' + ($h(a).attr('href') || '')).toLowerCase();
    if (/now|showing|coming|movie|فيلم|افلام|أفلام|قريب|يعرض/.test(t)) {
      const u = abs(home.url, $h(a).attr('href'));
      if (u && new URL(u).origin === new URL(home.url).origin) nav.add(u);
    }
  });
  for (const u of [...nav].slice(0, 5)) {
    try {
      pages.push(await getHtml(u));
    } catch (e) {
      /* تجاهل */
    }
  }

  for (const p of pages) {
    const $ = cheerio.load(p.html);
    let found = null;
    $('a[href]').each((_, a) => {
      if (found) return;
      const el = $(a);
      const blob = [el.text(), el.attr('href'), el.attr('title'), el.find('img').attr('alt')].join(' ');
      if (cfg.movieRegex.test(blob)) {
        const href = abs(p.url, el.attr('href'));
        if (href) found = { url: href, title: clean(el.text()).slice(0, 80) || 'Avengers: Doomsday', comingSoon: /coming/i.test(p.url) };
      }
    });
    if (found) return found;
  }
  return null;
}

// 2) مواعيد/لينكات الحجز في صفحة الفيلم (بنتجاهل الهيدر والفوتر)
async function getBookingInfo(movieUrl) {
  const page = await getHtml(movieUrl);
  const $ = cheerio.load(page.html);
  $('header, nav, footer').remove();

  const shows = [];
  const seen = new Set();
  $('a[href], button[data-href], [data-url], [data-session], [data-showtime]').each((_, node) => {
    const el = $(node);
    const href = el.attr('href') || el.attr('data-href') || el.attr('data-url');
    const url = abs(page.url, href);
    if (!url || seen.has(url)) return;
    if (url === page.url || url === abs(page.url, '/') || url === cfg.baseUrl) return;
    const blob = [el.text(), href, el.attr('class'), el.attr('title')].join(' ');
    const isShowEl = el.is('[data-session], [data-showtime]') || /showtime|session|time/i.test(el.attr('class') || '');
    if (!isShowEl && !cfg.bookingRegex.test(blob)) return;
    // تجاهل لينكات سوشيال/خارجية
    if (/facebook|instagram|youtube|twitter|wa\.me|whatsapp/i.test(url)) return;
    seen.add(url);
    shows.push({ id: hash(url), url, label: clean(el.text()).slice(0, 60) || 'عرض', hall: clean(el.closest('[class*="hall"], [class*="cinema"], [class*="screen"]').find('h3,h4,.title').first().text()).slice(0, 40) });
  });
  return { shows, pageUrl: page.url };
}

// ===== خريطة المقاعد =====

function extractJsonArrayAfter(text, key) {
  const re = new RegExp(`"${key}"\\s*:\\s*\\[`, 'g');
  const out = [];
  let m;
  while ((m = re.exec(text))) {
    let i = m.index + m[0].length - 1;
    let depth = 0;
    let inStr = false;
    for (let j = i; j < text.length; j++) {
      const ch = text[j];
      if (inStr) {
        if (ch === '\\') j++;
        else if (ch === '"') inStr = false;
      } else if (ch === '"') inStr = true;
      else if (ch === '[') depth++;
      else if (ch === ']' && --depth === 0) {
        try {
          out.push(JSON.parse(text.slice(i, j + 1)));
        } catch {}
        break;
      }
    }
  }
  return out;
}

function normalizeJsonSeats(arr) {
  const seats = [];
  const rowOrder = new Map();
  const walk = (items, parentRow) => {
    for (const it of items) {
      if (!it || typeof it !== 'object') continue;
      const row = it.row ?? it.rowName ?? it.rowLabel ?? it.r ?? parentRow;
      if (Array.isArray(it.seats)) {
        walk(it.seats, row);
        continue;
      }
      const num = it.number ?? it.seatNumber ?? it.seat ?? it.num ?? it.n ?? it.name;
      if (row === undefined || num === undefined) continue;
      const col = Number(it.col ?? it.column ?? it.x ?? num);
      let avail = it.available ?? it.isAvailable;
      if (avail === undefined && it.status !== undefined) avail = /^(available|free|open|0|a)$/i.test(String(it.status));
      if (avail === undefined) avail = true;
      if (!rowOrder.has(String(row))) rowOrder.set(String(row), rowOrder.size);
      seats.push({ row: String(row), num: String(num), col: Number.isFinite(col) ? col : seats.length, rowIdx: rowOrder.get(String(row)), avail: !!avail, idx: seats.length });
    }
  };
  walk(arr);
  return seats;
}

function parseSeatsFromScripts($) {
  let best = [];
  $('script').each((_, s) => {
    const txt = $(s).html() || '';
    if (!/seat/i.test(txt)) return;
    const candidates = [];
    const t = ($(s).attr('type') || '').toLowerCase();
    if (t.includes('json') || $(s).attr('id') === '__NEXT_DATA__') {
      try {
        candidates.push(...extractJsonArrayAfter(txt, 'seats'));
      } catch {}
    } else {
      candidates.push(...extractJsonArrayAfter(txt, 'seats'), ...extractJsonArrayAfter(txt, 'rows'));
    }
    for (const c of candidates) {
      const seats = normalizeJsonSeats(c);
      if (seats.length > best.length) best = seats;
    }
  });
  return best;
}

function parseSeatsFromDom($) {
  const legend = cfg.legendExclude;
  const els = $(cfg.seatSelector).filter((_, e) => !$(e).closest(legend).length && !$(e).is(legend));
  if (!els.length) return [];

  const rowOrder = new Map();
  const colCounter = new Map();
  const seats = [];

  els.each((i, node) => {
    const el = $(node);
    const parent = el.parent();
    const rowKeyNode = el.closest('[data-row], [data-row-name], tr, [class*="row"], [class*="Row"]');
    const rowKey = rowKeyNode.length ? rowKeyNode.get(0) : parent.get(0);
    const rowLabel =
      el.attr('data-row') ||
      el.attr('data-row-name') ||
      (rowKeyNode.attr && (rowKeyNode.attr('data-row') || rowKeyNode.attr('data-row-name'))) ||
      clean(rowKeyNode.find('[class*="label"], [class*="row-name"], th').first().text()) ||
      '';
    if (!rowOrder.has(rowKey)) rowOrder.set(rowKey, rowOrder.size);
    const rowIdx = rowOrder.get(rowKey);

    const cls = (el.attr('class') || '') + ' ' + (el.attr('data-status') || '') + ' ' + (el.attr('title') || '');
    const disabled = el.is('[disabled]') || el.attr('aria-disabled') === 'true';
    const avail = !disabled && !cfg.unavailableRegex.test(cls);

    const numAttr = el.attr('data-seat') || el.attr('data-number') || el.attr('data-seat-number') || el.attr('data-col');
    const text = clean(el.text());
    // id زي A5 / F12
    const idMatch = (el.attr('data-seat-id') || el.attr('id') || '').match(/^([A-Za-z؀-ۿ]+)[-_ ]?(\d+)$/);
    const row = rowLabel || (idMatch && idMatch[1]) || String.fromCharCode(65 + (rowIdx % 26));
    const num = numAttr || (idMatch && idMatch[2]) || text || String((colCounter.get(rowKey) || 0) + 1);

    // العمود: لو في رقم استخدمه (عشان الممرات تبان كفجوة)، وإلا ترتيب العنصر
    const n = parseInt(num, 10);
    const siblingsBefore = el.prevAll().length;
    const col = Number.isFinite(n) ? n : siblingsBefore + 1;
    colCounter.set(rowKey, (colCounter.get(rowKey) || 0) + 1);

    seats.push({ row: String(row), num: String(num), col, rowIdx, avail, idx: i });
  });

  if (cfg.reverseRows) {
    const max = Math.max(...seats.map((s) => s.rowIdx));
    seats.forEach((s) => (s.rowIdx = max - s.rowIdx));
  }
  return seats;
}

async function getSeatMap(showUrl) {
  const page = await getHtml(showUrl);
  const $ = cheerio.load(page.html);
  let seats = parseSeatsFromScripts($);
  let source = 'json';
  if (seats.length < 6) {
    seats = parseSeatsFromDom($);
    source = 'dom';
  }
  return { seats: seats.length >= 6 ? seats : [], source };
}

module.exports = { findMovie, getBookingInfo, getSeatMap };
