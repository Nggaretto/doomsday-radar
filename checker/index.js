const cfg = require('./config');
const { db } = require('./firebase');
const site = require('./site');
const { suggest, compactMap } = require('./seats');
const { pushAll } = require('./notify');
const { book } = require('./book');

const stateRef = db.doc('state/current');
const log = (...a) => console.log(new Date().toLocaleTimeString('ar-EG'), ...a);

async function tick() {
  const now = Date.now();
  const snap = await stateRef.get();
  const prev = snap.exists ? snap.data() : {};
  await stateRef.set({ lastCheck: now, bot: 'running', pollSeconds: cfg.pollSeconds }, { merge: true });

  const movie = await site.findMovie();
  if (!movie) {
    log('🔎 الفيلم لسه مش ظاهر في الموقع');
    await stateRef.set({ status: 'not_listed', statusNote: 'الفيلم لسه مش ظاهر في موقع جلاكسي طنطا' }, { merge: true });
    return;
  }

  const info = await site.getBookingInfo(movie.url);
  if (!info.shows.length) {
    log('⏳ الفيلم موجود بس مفيش حجز لسه —', movie.url);
    await stateRef.set(
      { status: 'waiting', movieUrl: movie.url, movieTitle: movie.title, statusNote: 'الفيلم نازل بس الحجز لسه مفتحش. البوت بيراقب…', shows: [] },
      { merge: true }
    );
    return;
  }

  // ===== الحجز اتفتح! =====
  log(`🎉 لقيت ${info.shows.length} عرض/لينك حجز`);
  const shows = [];
  for (const s of info.shows.slice(0, cfg.maxShows)) {
    try {
      const { seats, source } = await site.getSeatMap(s.url);
      const suggestions = suggest(seats, { count: cfg.seatCount, top: cfg.suggestions, idealRow: cfg.idealRow });
      shows.push({
        ...s,
        seatsFound: seats.length,
        seatsFree: seats.filter((x) => x.avail).length,
        source,
        suggestions,
        map: seats.length ? compactMap(seats) : null,
      });
    } catch (e) {
      log('⚠️ فشل قراءة خريطة', s.url, e.message);
      shows.push({ ...s, seatsFound: 0, seatsFree: 0, suggestions: [], map: null, error: e.message });
    }
  }

  const knownIds = prev.knownShowIds || [];
  const newIds = shows.map((s) => s.id).filter((id) => !knownIds.includes(id));
  const firstOpen = prev.status !== 'open';

  const next = {
    status: 'open',
    statusNote: 'الحجز اتفتح! 🎉',
    movieUrl: movie.url,
    movieTitle: movie.title,
    shows,
    knownShowIds: [...new Set([...knownIds, ...shows.map((s) => s.id)])],
    updatedAt: now,
  };

  let alerts = prev.alerts || 0;
  let lastAlertAt = prev.lastAlertAt || 0;
  let ack = prev.ack === true;
  let shouldAlert = false;

  if (firstOpen || newIds.length) {
    ack = false;
    alerts = 0;
    shouldAlert = true;
    next.openedAt = firstOpen ? now : prev.openedAt || now;
  } else if (!ack && alerts < cfg.maxAlerts && now - lastAlertAt >= cfg.repeatAlertSeconds * 1000) {
    shouldAlert = true; // إعادة الإنذار لحد ما تدوس "تمام شفت"
  }

  if (shouldAlert) {
    const best = shows.find((s) => s.suggestions.length)?.suggestions[0];
    const body = best
      ? `أحسن 3 كراسي جنب بعض: ${best.note}. افتح التطبيق واحجز بسرعة!`
      : 'افتح التطبيق دلوقتي واحجز قبل ما الأماكن تخلص!';
    await pushAll(db, { title: '🚨 الحجز فتح! Avengers: Doomsday', body, url: '/' });
    alerts += 1;
    lastAlertAt = now;
  }

  await stateRef.set({ ...next, ack, alerts, lastAlertAt }, { merge: true });
}

// طلبات الحجز اللي جاية من التطبيق
function listenBookRequests() {
  db.collection('bookRequests')
    .where('status', '==', 'pending')
    .onSnapshot((qs) => {
      qs.docChanges().forEach(async (ch) => {
        if (ch.type !== 'added') return;
        const ref = ch.doc.ref;
        const req = ch.doc.data();
        log('🎟️ طلب حجز جديد', req.seats.map((s) => `${s.r}${s.n}`).join(','));
        await ref.update({ status: 'working', message: 'البوت بيحجز دلوقتي…' });

        if (!cfg.autoBook) {
          await ref.update({ status: 'manual', message: 'الحجز الأوتوماتيك مقفول — افتح صفحة العرض واحجز الكراسي دي بإيدك', url: req.showUrl });
          return;
        }
        const res = await book({ showUrl: req.showUrl, seats: req.seats });
        if (res.ok) {
          await ref.update({ status: 'done', message: 'الكراسي اتحجزت مؤقتاً — كمّل الدفع بسرعة!', url: res.url });
          await pushAll(db, { title: '✅ الكراسي اتحجزت مؤقتاً', body: 'كمّل الدفع دلوقتي قبل ما الوقت يخلص!', url: res.url });
        } else {
          await ref.update({ status: 'failed', message: 'معرفتش أحجز أوتوماتيك: ' + res.reason, url: req.showUrl });
          await pushAll(db, { title: '⚠️ الحجز الأوتوماتيك فشل', body: 'افتح لينك العرض واحجز بإيدك بسرعة', url: req.showUrl });
        }
      });
    });
}

async function main() {
  log('🤖 البوت اشتغل — بيراقب', cfg.baseUrl);
  if (!cfg.once) listenBookRequests();
  for (;;) {
    try {
      await tick();
    } catch (e) {
      log('❌ خطأ في الفحص:', e.message);
      await stateRef.set({ lastError: e.message, lastErrorAt: Date.now() }, { merge: true }).catch(() => {});
    }
    if (cfg.once) break;
    const jitter = Math.floor(Math.random() * 5000);
    await new Promise((r) => setTimeout(r, cfg.pollSeconds * 1000 + jitter));
  }
  if (cfg.once) process.exit(0);
}

main();
