// اختيار أحسن N كراسي جنب بعض.
// seat = { row:'F', num:'7', col:7, rowIdx:5, avail:true, idx:123 }
// rowIdx: 0 = أقرب صف للشاشة.

function isOrphan(byCol, adj, beyond) {
  const a = byCol.get(adj);
  if (!a || !a.avail) return false;
  const b = byCol.get(beyond);
  return !b || !b.avail; // هيسيب كرسي واحد لوحده
}

function suggest(seats, { count = 3, top = 3, idealRow = 0.6 } = {}) {
  const availCount = seats.filter((s) => s.avail).length;
  if (availCount < count) return [];

  const rowIdxs = seats.map((s) => s.rowIdx);
  const minR = Math.min(...rowIdxs);
  const maxR = Math.max(...rowIdxs);
  const cols = seats.map((s) => s.col);
  const minC = Math.min(...cols);
  const maxC = Math.max(...cols);
  const mid = (minC + maxC) / 2;
  const half = Math.max((maxC - minC) / 2, 1);

  const byRow = new Map();
  for (const s of seats) {
    if (!byRow.has(s.rowIdx)) byRow.set(s.rowIdx, []);
    byRow.get(s.rowIdx).push(s);
  }

  const groups = [];
  for (const [ri, list] of byRow) {
    const byCol = new Map(list.map((s) => [s.col, s]));
    for (const c of [...byCol.keys()].sort((a, b) => a - b)) {
      const grp = [];
      for (let k = 0; k < count; k++) {
        const s = byCol.get(c + k);
        if (!s || !s.avail) {
          grp.length = 0;
          break;
        }
        grp.push(s);
      }
      if (grp.length !== count) continue;

      const frac = maxR === minR ? 0.5 : (ri - minR) / (maxR - minR);
      const rowPen = Math.abs(frac - idealRow) * 100; // بعد عن أحسن صف
      const center = (grp[0].col + grp[count - 1].col) / 2;
      const hPen = (Math.abs(center - mid) / half) * 60; // بعد عن نص القاعة
      const orphan =
        (isOrphan(byCol, c - 1, c - 2) ? 8 : 0) + (isOrphan(byCol, c + count, c + count + 1) ? 8 : 0);
      const score = Math.round((100 - rowPen - hPen - orphan) * 10) / 10;
      groups.push({ seats: grp, score, rowIdx: ri });
    }
  }

  groups.sort((a, b) => b.score - a.score);

  const used = new Set();
  const picked = [];
  for (const g of groups) {
    if (g.seats.some((s) => used.has(`${s.rowIdx}:${s.col}`))) continue;
    g.seats.forEach((s) => used.add(`${s.rowIdx}:${s.col}`));
    picked.push(g);
    if (picked.length >= top) break;
  }

  return picked.map((g, i) => ({
    rank: i + 1,
    score: g.score,
    quality: g.score >= 85 ? 'ممتازة' : g.score >= 70 ? 'كويسة جداً' : g.score >= 55 ? 'كويسة' : 'مقبولة',
    rowIdx: g.rowIdx,
    row: g.seats[0].row,
    seats: g.seats.map((s) => ({ r: s.row, n: s.num, c: s.col, i: s.rowIdx, x: s.idx ?? -1 })),
    note: `الصف ${g.seats[0].row} — كراسي ${g.seats.map((s) => s.num).join('، ')}`,
  }));
}

// نسخة مضغوطة من الخريطة عشان تتخزن في Firestore وتتعرض في التطبيق
function compactMap(seats) {
  const rows = new Map();
  for (const s of seats) {
    if (!rows.has(s.rowIdx)) rows.set(s.rowIdx, { r: s.row, i: s.rowIdx, s: [] });
    rows.get(s.rowIdx).s.push({ c: s.col, n: String(s.num), a: s.avail ? 1 : 0, x: s.idx ?? -1 });
  }
  return { rows: [...rows.values()].sort((a, b) => a.i - b.i).map((r) => ({ ...r, s: r.s.sort((a, b) => a.c - b.c) })) };
}

module.exports = { suggest, compactMap };
