const fs = require('fs');
const path = require('path');
const admin = require('firebase-admin');
const { getFirestore } = require('firebase-admin/firestore');

function loadCredential() {
  if (process.env.FIREBASE_SERVICE_ACCOUNT) return JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
  const p = process.env.GOOGLE_APPLICATION_CREDENTIALS || path.join(__dirname, 'serviceAccountKey.json');
  if (!fs.existsSync(p)) {
    console.error('❌ مش لاقي serviceAccountKey.json — نزّله من Firebase Console > Project settings > Service accounts وحطه في فولدر checker');
    process.exit(1);
  }
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

if (!admin.apps.length) admin.initializeApp({ credential: admin.credential.cert(loadCredential()) });

// لازم يكون نفس اسم الداتابيز اللي التطبيق بيقرا منه (app.js: getFirestore(app, 'default'))
const DB_ID = process.env.FIRESTORE_DB || 'default';
const db = getFirestore(admin.app(), DB_ID);
console.log('🗄️  Firestore database:', DB_ID);

module.exports = { admin, db };