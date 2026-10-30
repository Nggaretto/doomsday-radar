import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import { getFirestore, doc, onSnapshot, setDoc, updateDoc, addDoc, collection, serverTimestamp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { getMessaging, getToken, onMessage, isSupported } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging.js';

const $ = (id) => document.getElementById(id);
const cfg = self.FIREBASE_CONFIG;
const configured = cfg && cfg.apiKey && !cfg.apiKey.startsWith('PASTE');

/* ========== Toast ========== */
let toastTimer;
function toast(msg) {
  const t = $('toast');
  t.textContent = msg;
  t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (t.hidden = true), 6000);
}

/* ========== صوت الإنذار (سارينة عالية) ========== */
const Siren = {
  ctx: null,
  nodes: null,
  vibTimer: null,
  playing: false,
  unlock() {
    if (!this.ctx) this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    if (this.ctx.state === 'suspended') this.ctx.resume();
  },
  start() {
    this.unlock();
    if (this.playing || !this.ctx) return;
    const ctx = this.ctx;
    const osc = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const lfo = ctx.createOscillator();
    const lfoGain = ctx.createGain();
    const gain = ctx.createGain();
    osc.type = 'square';
    osc2.type = 'sawtooth';
    osc.frequency.value = 900;
    osc2.frequency.value = 905;
    lfo.type = 'triangle';
    lfo.frequency.value = 1.6;
    lfoGain.gain.value = 380;
    lfo.connect(lfoGain);
    lfoGain.connect(osc.frequency);
    lfoGain.connect(osc2.frequency);
    gain.gain.value = 0.9;
    osc.connect(gain);
    osc2.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc2.start();
    lfo.start();
    this.nodes = [osc, osc2, lfo, gain];
    this.playing = true;
    const vib = () => navigator.vibrate && navigator.vibrate([500, 150, 500, 150, 800]);
    vib();
    this.vibTimer = setInterval(vib, 2400);
  },
  stop() {
    if (!this.playing) return;
    this.nodes.slice(0, 3).forEach((n) => {
      try { n.stop(); } catch {}
    });
    this.nodes = null;
    this.playing = false;
    clearInterval(this.vibTimer);
    navigator.vibrate && navigator.vibrate(0);
  },
};

function showAlarm(text) {
  $('alarmText').textContent = text || 'افتح واحجز دلوقتي';
  $('alarm').hidden = false;
  Siren.start();
}
function hideAlarm() {
  $('alarm').hidden = true;
  Siren.stop();
}

/* ========== إبقاء الشاشة صاحية ========== */
let wakeLock = null;
function setWake(on) {
  $('btnWake').classList.toggle('on', on);
  $('btnWake').setAttribute('aria-checked', String(on));
}
async function toggleWake() {
  try {
    if (wakeLock) {
      await wakeLock.release();
      wakeLock = null;
      setWake(false);
      return;
    }
    wakeLock = await navigator.wakeLock.request('screen');
    wakeLock.addEventListener('release', () => (wakeLock = null));
    setWake(true);
  } catch (e) {
    toast('المتصفح مش بيدعم إبقاء الشاشة صاحية');
  }
}
document.addEventListener('visibilitychange', async () => {
  if (document.visibilityState === 'visible' && $('btnWake').classList.contains('on') && !wakeLock) {
    try { wakeLock = await navigator.wakeLock.request('screen'); } catch {}
  }
});

/* ========== تثبيت التطبيق ========== */
let deferredInstall;
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredInstall = e;
  $('btnInstall').hidden = false;
});
$('btnInstall').onclick = async () => {
  if (!deferredInstall) return;
  deferredInstall.prompt();
  await deferredInstall.userChoice;
  deferredInstall = null;
  $('btnInstall').hidden = true;
};
const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
const standalone = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone;
if (isIOS && !standalone) $('iosHint').hidden = false;

/* ========== أزرار عامة ========== */
$('btnTest').onclick = () => showAlarm('ده صوت التجربة. لو سمعته يبقى تمام ✅');
$('alarmStop').onclick = () => {
  hideAlarm();
  $('results').scrollIntoView({ behavior: 'smooth' });
};
$('btnWake').onclick = toggleWake;

if (!configured) {
  $('setup').hidden = false;
  $('statusText').textContent = 'محتاج إعداد Firebase';
  $('statusSub').textContent = 'اتبع خطوات الـ README';
  $('btnEnable').disabled = true;
} else {
  init();
}

/* ========== Firebase ========== */
function init() {
  const app = initializeApp(cfg);
  const db = getFirestore(app, 'default'); // قاعدة البيانات اسمها default
  let lastStatus = null;
  let currentState = null;
  let activeTab = 0;

  /* ----- إشعارات ----- */
  const withTimeout = (p, ms, label) =>
    Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error(label || 'timeout')), ms))]);
  let listening = false;
  let busy = false;

  function setNotifyButtons(state) {
    // state: 'idle' | 'busy' | 'done'
    document.querySelectorAll('[data-notify]').forEach((b) => {
      b.disabled = state === 'busy';
      if (b.id === 'btnEnable') {
        b.textContent = state === 'done' ? '🔔 الإشعارات شغالة ✓' : state === 'busy' ? '⏳ جاري التفعيل…' : '🔔 فعّل الإشعارات';
      } else {
        b.textContent = state === 'done' ? 'شغّالة ✓' : state === 'busy' ? '…' : 'نبّهني';
      }
      b.classList.toggle('done', state === 'done');
      b.classList.toggle('primary', state !== 'done');
    });
  }
  const markEnabled = () => setNotifyButtons('done');

  // بيجيب التوكن ويسجّله في Firestore. silent=true يعني من غير رسائل (عند فتح الصفحة)
  async function syncToken({ silent = false } = {}) {
    const reg = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
    await withTimeout(navigator.serviceWorker.ready, 10000, 'service-worker-timeout');
    const messaging = getMessaging(app);
    const token = await withTimeout(
      getToken(messaging, { vapidKey: self.VAPID_KEY, serviceWorkerRegistration: reg }),
      15000,
      'مفيش رد من Firebase Messaging (اتأكد من VAPID_KEY ومن إعدادات المشروع)'
    );
    if (!token) throw new Error('no token');
    await withTimeout(
      setDoc(doc(db, 'tokens', token), { createdAt: Date.now(), ua: navigator.userAgent.slice(0, 120) }),
      10000,
      'مقدرتش أحفظ الجهاز في قاعدة البيانات (اتأكد من اسم الداتابيز وقواعد Firestore)'
    );
    localStorage.setItem('fcmToken', token);
    markEnabled();
    if (!listening) {
      listening = true;
      onMessage(messaging, (p) => showAlarm((p.data || {}).body));
    }
    if (!silent) toast('✅ الإشعارات اتفعلت على الجهاز ده');
  }

  async function enableNotifications() {
    if (busy) return;
    Siren.unlock();
    if (!('Notification' in window) || !('serviceWorker' in navigator) || !(await isSupported())) {
      toast('المتصفح ده مش بيدعم الإشعارات — جرّب Chrome (أندرويد) أو ثبّت التطبيق على الآيفون');
      return;
    }
    if (Notification.permission === 'denied') {
      toast('الإشعارات متبلّكة للموقع ده. دوس على أيقونة القفل جنب اللينك → الإشعارات → سماح، وبعدين جرّب تاني');
      return;
    }
    busy = true;
    setNotifyButtons('busy');
    try {
      const perm = await Notification.requestPermission();
      if (perm !== 'granted') {
        setNotifyButtons('idle');
        toast('لازم تسمح بالإشعارات عشان البوت ينبهك');
        return;
      }
      await syncToken();
    } catch (e) {
      console.error(e);
      setNotifyButtons('idle');
      toast('حصلت مشكلة في تفعيل الإشعارات: ' + (e.message || e));
    } finally {
      busy = false;
    }
  }
  document.querySelectorAll('[data-notify]').forEach((b) => (b.onclick = enableNotifications));

  // عند فتح/ريفريش الصفحة: لو الإذن متفعّل قبل كده، جدّد التوكن وسجّله تلقائياً
  if ('Notification' in window && Notification.permission === 'granted') {
    if (localStorage.getItem('fcmToken')) markEnabled();
    isSupported()
      .then((ok) => ok && syncToken({ silent: true }))
      .catch((e) => {
        console.warn('token sync failed', e);
        setNotifyButtons('idle');
      });
  }

  /* ----- الحالة من البوت ----- */
  $('btnAck').onclick = async () => {
    hideAlarm();
    try {
      await updateDoc(doc(db, 'state', 'current'), { ack: true });
      toast('تمام، البوت هيبطل يرن');
    } catch (e) {
      toast('مقدرتش أسجل التأكيد');
    }
  };

  onSnapshot(doc(db, 'state', 'current'), (snap) => {
    currentState = snap.exists() ? snap.data() : null;
    render(currentState);
  });
  setInterval(() => renderHeartbeat(currentState), 5000);

  function renderHeartbeat(s) {
    const hb = $('heartbeat');
    if (!s || !s.lastCheck) {
      hb.className = 'pill off';
      hb.querySelector('span').textContent = 'البوت مش متصل';
      return;
    }
    const ago = Math.round((Date.now() - s.lastCheck) / 1000);
    const alive = ago < Math.max(180, (s.pollSeconds || 30) * 4);
    hb.className = 'pill ' + (alive ? 'on' : 'off');
    hb.querySelector('span').textContent = alive ? `البوت شغال · من ${ago} ث` : `البوت واقف · من ${Math.round(ago / 60)} د`;
    $('lastCheck').textContent = s.lastError ? `آخر خطأ: ${s.lastError}` : `آخر فحص من ${ago} ثانية`;
  }

  function render(s) {
    renderHeartbeat(s);
    const badge = $('statusBadge');
    if (!s) {
      $('statusText').textContent = 'مستني أول تشغيل للبوت';
      $('statusSub').textContent = 'شغّل البوت من فولدر checker';
      return;
    }
    const open = s.status === 'open';
    badge.className = 'status ' + (open ? 'open' : s.status === 'error' ? 'error' : 'waiting');
    $('statusText').textContent = open ? 'الحجز مفتوح! 🎉' : s.status === 'not_listed' ? 'الفيلم لسه مش ظاهر' : 'الحجز لسه مفتحش';
    $('statusSub').textContent = s.statusNote || '';
    $('waitCard').hidden = open;
    $('results').hidden = !open;

    if (open) {
      const firstOpen = lastStatus !== 'open';
      if (!s.ack && firstOpen) {
        const best = (s.shows || []).find((x) => x.suggestions && x.suggestions.length);
        showAlarm(best ? `أحسن كراسي: ${best.suggestions[0].note}` : 'افتح واحجز دلوقتي');
      }
      if (s.ack) hideAlarm();
      renderShows(s);
    }
    lastStatus = s.status;
  }

  /* ----- العروض والاقتراحات ----- */
  function renderShows(s) {
    const shows = s.shows || [];
    if (activeTab >= shows.length) activeTab = 0;
    $('tabs').innerHTML = shows
      .map((x, i) => `<button class="tab ${i === activeTab ? 'active' : ''}" data-i="${i}">${esc(x.label || 'عرض ' + (i + 1))}${x.hall ? ' · ' + esc(x.hall) : ''}</button>`)
      .join('');
    $('tabs').querySelectorAll('.tab').forEach((b) => (b.onclick = () => { activeTab = +b.dataset.i; renderShows(s); }));

    const sh = shows[activeTab];
    if (!sh) {
      $('shows').innerHTML = `<div class="empty">مفيش عروض متاحة للعرض.</div>`;
      return;
    }
    const meta = `<div class="show-meta"><span>${sh.seatsFound ? `${sh.seatsFree} كرسي فاضي من ${sh.seatsFound}` : 'خريطة الكراسي مش متاحة'}</span><a href="${esc(sh.url)}" target="_blank" rel="noopener">افتح صفحة العرض ↗</a></div>`;

    if (!sh.suggestions || !sh.suggestions.length) {
      $('shows').innerHTML = `<div class="show">${meta}<div class="empty">${
        sh.seatsFound
          ? 'مفيش ٣ كراسي فاضيين جنب بعض في العرض ده 😕 جرّب عرض تاني.'
          : 'البوت مقدرش يقرا خريطة الكراسي لوحده. افتح <a href="' + esc(sh.url) + '" target="_blank" rel="noopener">صفحة العرض</a> واحجز بإيدك بسرعة.'
      }</div></div>`;
      return;
    }

    $('shows').innerHTML = `<div class="show">${meta}${sh.suggestions.map((sg, i) => sugCard(sh, sg, i)).join('')}</div>`;
    $('shows').querySelectorAll('[data-book]').forEach((b) => (b.onclick = () => bookSeats(sh, sh.suggestions[+b.dataset.book], b)));
  }

  function place(map, sg) {
    if (!map) return sg.quality;
    const is = map.rows.map((r) => r.i);
    const min = Math.min(...is);
    const max = Math.max(...is);
    const f = max === min ? 0.5 : (sg.rowIdx - min) / (max - min);
    const v = f < 0.34 ? 'قريب من الشاشة' : f > 0.72 ? 'في الخلف' : 'نص القاعة';
    const cs = map.rows.flatMap((r) => r.s.map((x) => x.c));
    const lo = Math.min(...cs);
    const hi = Math.max(...cs);
    const mid = (lo + hi) / 2;
    const half = Math.max((hi - lo) / 2, 1);
    const c = (sg.seats[0].c + sg.seats[sg.seats.length - 1].c) / 2;
    const h = Math.abs(c - mid) / half < 0.25 ? 'في المنتصف' : 'على الجنب';
    return `${v} · ${h}`;
  }

  function sugCard(sh, sg, i) {
    return `<article class="sug ${i === 0 ? 'best' : ''}">
      <div class="rank">${i + 1}</div>
      <div class="sug-body">
        <h3>الصف ${esc(sg.row)} · كراسي ${sg.seats.map((x) => esc(x.n)).join('، ')}</h3>
        <p class="where">${esc(place(sh.map, sg))}</p>
        <p class="view">رؤية ${esc(sg.quality)} · تقييم ${sg.score}</p>
        ${i === 0 ? '<span class="reco">★ موصى بيه</span>' : ''}
        <div class="chips">${sg.seats.map((x) => `<span class="chip">${esc(x.r)}${esc(x.n)}</span>`).join('')}</div>
      </div>
      ${sh.map ? miniMap(sh.map, sg) : ''}
      <button class="btn primary" data-book="${i}">احجز الآن</button>
      <div class="req-status" hidden></div>
    </article>`;
  }

  function miniMap(map, sg) {
    const pick = new Set(sg.seats.map((s) => `${s.i}:${s.c}`));
    const cs = map.rows.flatMap((r) => r.s.map((s) => s.c));
    const minC = Math.min(...cs);
    const maxC = Math.max(...cs);
    const n = maxC - minC + 1;
    let cells = '';
    for (const r of map.rows) {
      const by = new Map(r.s.map((s) => [s.c, s]));
      for (let c = minC; c <= maxC; c++) {
        const s = by.get(c);
        if (!s) cells += '<i class="g"></i>';
        else cells += `<i class="${pick.has(r.i + ':' + c) ? 'p' : s.a ? '' : 'x'}"></i>`;
      }
    }
    return `<div class="mm"><div class="mm-screen"></div><div class="mm-grid" style="grid-template-columns:repeat(${n},1fr)">${cells}</div><span class="mm-label">SCREEN</span></div>`;
  }

  async function bookSeats(sh, sg, btn) {
    btn.disabled = true;
    const box = btn.parentElement.querySelector('.req-status');
    box.hidden = false;
    box.className = 'req-status';
    box.textContent = '⏳ بيبعت الطلب للبوت…';
    try {
      const ref = await addDoc(collection(db, 'bookRequests'), {
        status: 'pending',
        showId: sh.id,
        showUrl: sh.url,
        seats: sg.seats,
        createdAt: serverTimestamp(),
      });
      onSnapshot(doc(db, 'bookRequests', ref.id), (d) => {
        const r = d.data();
        if (!r) return;
        box.className = 'req-status ' + (r.status === 'done' ? 'done' : r.status === 'failed' ? 'failed' : '');
        box.innerHTML = esc(r.message || 'في الانتظار…') + (r.url ? ` — <a href="${esc(r.url)}" target="_blank" rel="noopener">افتح الصفحة ↗</a>` : '');
        if (r.status === 'done' || r.status === 'failed' || r.status === 'manual') btn.disabled = false;
      });
    } catch (e) {
      box.className = 'req-status failed';
      box.textContent = 'مقدرتش أبعت الطلب: ' + (e.message || e);
      btn.disabled = false;
    }
  }
}

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}