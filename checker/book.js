// حجز الكراسي عن طريق متصفح حقيقي (Playwright).
// البوت بيدخل بحسابك، يختار الكراسي، ويكمّل لحد صفحة الدفع ويقف هناك (الدفع بإيديك).
// الكراسي غالباً بتتحجز مؤقتاً (دقائق) لحد ما تدفع.
const fs = require('fs');
const path = require('path');
const cfg = require('./config');

async function book({ showUrl, seats }) {
  let chromium;
  try {
    ({ chromium } = require('playwright'));
  } catch {
    return { ok: false, reason: 'playwright مش متسطب. شغّل: npm i playwright && npx playwright install chromium' };
  }

  const browser = await chromium.launch({ headless: true });
  const dir = path.join(__dirname, 'debug');
  fs.mkdirSync(dir, { recursive: true });
  try {
    const ctx = await browser.newContext({ locale: 'ar-EG', viewport: { width: 1280, height: 900 } });
    const page = await ctx.newPage();

    // تسجيل الدخول (لو متظبط)
    if (cfg.login.url && cfg.login.user) {
      await page.goto(cfg.login.url, { waitUntil: 'networkidle', timeout: 45000 });
      await page.locator(cfg.login.userSelector).first().fill(cfg.login.user);
      await page.locator(cfg.login.passSelector).first().fill(cfg.login.pass);
      await Promise.all([
        page.waitForLoadState('networkidle').catch(() => {}),
        page.locator(cfg.login.submitSelector).first().click(),
      ]);
    }

    await page.goto(showUrl, { waitUntil: 'networkidle', timeout: 45000 });

    const all = page.locator(cfg.seatSelector);
    const total = await all.count();
    if (!total) return { ok: false, reason: 'مش لاقي خريطة الكراسي في الصفحة (السلكتور محتاج ضبط)' };

    for (const s of seats) {
      if (s.x === undefined || s.x < 0) return { ok: false, reason: 'ترتيب الكرسي مش معروف' };
      await all.nth(s.x).click({ timeout: 8000 });
      await page.waitForTimeout(250);
    }

    await page.screenshot({ path: path.join(dir, 'booking-seats.png'), fullPage: true });

    const cont = page.locator(cfg.continueSelector).first();
    if (await cont.count()) {
      await cont.click({ timeout: 8000 }).catch(() => {});
      await page.waitForLoadState('networkidle').catch(() => {});
    }
    await page.screenshot({ path: path.join(dir, 'booking-after.png'), fullPage: true });

    return { ok: true, url: page.url() };
  } catch (e) {
    return { ok: false, reason: e.message };
  } finally {
    await browser.close();
  }
}

module.exports = { book };
