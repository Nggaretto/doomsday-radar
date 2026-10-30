// بيبعت إشعار تجريبي لكل الموبايلات المسجلة: npm run test-push
const { db } = require('./firebase');
const { pushAll } = require('./notify');

(async () => {
  await pushAll(db, {
    title: '🚨 تجربة إنذار — Doomsday Watch',
    body: 'لو سمعت الصوت ده يبقى كله تمام. الحجز الحقيقي هيجيلك بنفس الشكل.',
    url: '/',
  });
  process.exit(0);
})();
