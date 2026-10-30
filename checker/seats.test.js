// اختبار سريع لخوارزمية اختيار الكراسي: node seats.test.js
const { suggest } = require('./seats');

const rows = 'ABCDEFGHIJKL'.split('');
const seats = [];
let idx = 0;
rows.forEach((row, ri) => {
  for (let n = 1; n <= 16; n++) {
    // ممر في النص بين 8 و 9 (col بيقفز)
    const col = n <= 8 ? n : n + 1;
    const sold = (ri + n * 3) % 5 === 0 || (ri === 7 && n >= 6 && n <= 11); // صف H مزحوم
    seats.push({ row, num: String(n), col, rowIdx: ri, avail: !sold, idx: idx++ });
  }
});

const res = suggest(seats, { count: 3, top: 3, idealRow: 0.6 });
console.log(JSON.stringify(res.map((r) => ({ note: r.note, score: r.score, q: r.quality })), null, 2));

const assert = require('assert');
assert.strictEqual(res.length, 3, 'لازم 3 اقتراحات');
for (const r of res) {
  assert.strictEqual(r.seats.length, 3);
  const cols = r.seats.map((s) => s.c);
  assert.strictEqual(cols[2] - cols[0], 2, 'لازم جنب بعض بدون ممر');
  assert.ok(r.seats.every((s) => seats.find((x) => x.row === s.r && x.num === s.n).avail), 'لازم متاحة');
}
// مفيش تكرار كراسي
const keys = res.flatMap((r) => r.seats.map((s) => `${s.r}${s.n}`));
assert.strictEqual(new Set(keys).size, keys.length);
// لو القاعة كلها محجوزة
assert.deepStrictEqual(suggest(seats.map((s) => ({ ...s, avail: false }))), []);
console.log('✅ seats OK');
