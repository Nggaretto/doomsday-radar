const admin = require('firebase-admin');

// بيبعت إشعار FCM لكل الأجهزة المسجلة (data-only عشان الـ Service Worker يعرضه بصوت وإلحاح)
async function pushAll(db, { title, body, url, alarm = '1' }) {
  const snap = await db.collection('tokens').get();
  const tokens = snap.docs.map((d) => d.id);
  if (!tokens.length) {
    console.log('⚠️  مفيش أجهزة مسجلة للإشعارات لسه (افتح التطبيق على الموبايل وفعّل الإشعارات)');
    return 0;
  }

  const res = await admin.messaging().sendEachForMulticast({
    tokens,
    data: { title, body, url: url || '/', alarm },
    webpush: { headers: { Urgency: 'high', TTL: '3600' } },
    android: { priority: 'high' },
  });

  // نظّف التوكنز الميتة
  const dead = [];
  res.responses.forEach((r, i) => {
    const code = r.error && r.error.code;
    if (!r.success && /registration-token-not-registered|invalid-registration-token|invalid-argument/.test(code || '')) dead.push(tokens[i]);
  });
  await Promise.all(dead.map((t) => db.collection('tokens').doc(t).delete()));

  console.log(`🔔 اتبعت إشعار لـ ${res.successCount}/${tokens.length} جهاز`);
  return res.successCount;
}

module.exports = { pushAll };
