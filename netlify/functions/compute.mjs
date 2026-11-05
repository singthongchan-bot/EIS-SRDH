const WD = ['จันทร์','อังคาร','พุธ','พฤหัสบดี','ศุกร์'];
export const EB = [5, 10, 15, 20, 30];
export const WB = [30, 60, 90, 120]; // ช่วงเวลารอพบแพทย์ (นาที, ส่งตรวจ → พบแพทย์): ≤30, 31–60, 61–90, 91–120, >120 · เป้าหมาย ≤ 60 // ช่วงเวลาตรวจ (นาที): <5, 5–10, 10–15, 15–20, 20–30, ≥30
// 1 รหัสคลินิก (lct) = 1 แถว  |  appt: [vn,lct,date,dct,...เวลา 5 ค่า]  walk: [vn,lct,date]  sched: [lct,day,doc,main,sub,quota,is1h]
export function compute({ appt = [], walk = [], sched = [], names = {} }) {
  const m = new Map();
  // แยกรายเดือน (YYYY-MM) และรายวันในสัปดาห์ (0=อาทิตย์) : [นัด, walk-in ที่ไม่ซ้ำ, ชุดวันที่]
  const tally = (c, d, i) => { const ym = d.slice(0, 7); if (!c.mon.has(ym)) c.mon.set(ym, [0, 0, new Set()]);
    const mo = c.mon.get(ym); mo[i]++; mo[2].add(d); const w = c.wd[new Date(d + 'T00:00:00Z').getUTCDay()]; if (w) { w[i]++; w[2].add(d); } };
  // เวลาแต่ละขั้นตอน (นาที): t = [ส่งตรวจ, ซักประวัติ, พบแพทย์, ตรวจเสร็จ, รับยา] → 4 ช่วง เก็บ [ผลรวม, จำนวน] ×4 ต่อเดือน
  const dur = (t, i) => { const a = t[i], b = t[i + 1]; if (a == null || b == null) return null; const x = b - a; return x >= 0 && x <= 600 ? x : null; };
  const steps = (c, d, t) => { if (!t.length) return; const ym = d.slice(0, 7); if (!c.stm.has(ym)) c.stm.set(ym, Array(8).fill(0));
    const a = c.stm.get(ym); for (let i = 0; i < 4; i++) { const x = dur(t, i); if (x != null) { a[i * 2] += x; a[i * 2 + 1]++; } } };
  const g = l => { l = +l; if (!m.has(l)) m.set(l, { lct: l, ak: new Set(), wk: new Set(), dates: new Set(), wOnly: 0, doc: new Map(), sd: new Map(), qs: 0, qn: 0, mon: new Map(), stm: new Map(), dr: new Map(), wd: Array.from({ length: 7 }, () => [0, 0, new Set()]) }); return m.get(l); };
  for (const r of appt) {
    const [vn, lct, d, dct] = r, t = r.slice(4);
    const c = g(lct), k = vn + '|' + lct + '|' + d; if (c.ak.has(k)) continue;
    c.ak.add(k); c.dates.add(d); tally(c, d, 0); steps(c, d, t);
    if (dct) { if (!c.dr.has(dct)) c.dr.set(dct, { n: 0, d: new Set(), e: 0, en: 0, w: 0, wn: 0, mo: new Map(), h: Array(EB.length + 1).fill(0), wq: new Map() });   // รายแพทย์ (เฉพาะผู้ป่วยนัด)
      const o = c.dr.get(dct), ym = d.slice(0, 7); o.n++; o.d.add(d); const e = dur(t, 2), w = dur(t, 1);
      if (!o.mo.has(ym)) o.mo.set(ym, [0, new Set(), 0, 0, 0, 0]); const om = o.mo.get(ym); om[0]++; om[1].add(d);
      if (e != null) { o.e += e; o.en++; om[2] += e; om[3]++; let b = 0; while (b < EB.length && e >= EB[b]) b++; o.h[b]++; }
      if (w != null) { o.w += w; o.wn++; om[4] += w; om[5]++; }
      const wt = t[0] != null && t[2] != null ? t[2] - t[0] : null; // รอพบแพทย์รวม: ส่งตรวจ → พบแพทย์ (แยกครึ่งเดือน YYYY-MM-1 = 1–15, -2 = 16–สิ้นเดือน)
      if (wt != null && wt >= 0 && wt <= 600) { const hk = ym + (+d.slice(8, 10) <= 15 ? '-1' : '-2'); if (!o.wq.has(hk)) o.wq.set(hk, Array(WB.length + 1).fill(0));
        let b = 0; while (b < WB.length && wt > WB[b]) b++; o.wq.get(hk)[b]++; } }
    if (dct) { if (!c.doc.has(d)) c.doc.set(d, new Set()); c.doc.get(d).add(dct); }
  }
  for (const r of walk) {
    const [vn, lct, d] = r;                 // ตัดซ้ำ: VN + lct + วันที่ ตรงกับไฟล์นัด
    const c = g(lct), k = vn + '|' + lct + '|' + d; if (c.wk.has(k)) continue;
    c.wk.add(k); c.dates.add(d); if (!c.ak.has(k)) { c.wOnly++; tally(c, d, 1); steps(c, d, r.slice(4)); }
  }
  for (const [lct, day, doc, , , q, is1h] of sched) {
    const c = g(lct);
    if (WD.includes(day)) { if (!c.sd.has(day)) c.sd.set(day, new Set()); c.sd.get(day).add(doc); }
    if (is1h && q > 0) { c.qs += q; c.qn++; }
  }
  const mean = a => a.length ? a.reduce((s, x) => s + x, 0) / a.length : null;
  return [...m.values()].filter(c => c.dates.size).map(c => ({
    name: names[c.lct] || ('คลินิก ' + c.lct), codes: [c.lct], days: c.dates.size, appt: c.ak.size, walkOnly: c.wOnly, walkAll: c.wk.size,
    rooms: Math.round((mean([...c.doc.values()].map(s => s.size)) || 1) * 100) / 100,
    schedDocs: c.sd.size ? Math.round(mean([...c.sd.values()].map(s => s.size)) * 10) / 10 : null,
    quota: c.qn ? Math.round(c.qs / c.qn * 10) / 10 : null,
    months: Object.fromEntries([...c.mon].sort().map(([k, v]) => [k, [v[0], v[1], v[2].size]])), wdays: c.wd.map(v => [v[0], v[1], v[2].size]),
    steps: Object.fromEntries([...c.stm].sort()),
    // docs[dct] = [ราย, วัน, ผลรวมเวลาตรวจ, n, ผลรวมรอพบแพทย์, n, {YYYY-MM: [ราย, วัน, เวลาตรวจ, n, รอ, n]}, การกระจายเวลาตรวจ, {YYYY-MM-1|2: การกระจายเวลารอพบแพทย์}]
    docs: Object.fromEntries([...c.dr].map(([k, o]) => [k, [o.n, o.d.size, o.e, o.en, o.w, o.wn,
      Object.fromEntries([...o.mo].sort().map(([m, v]) => [m, [v[0], v[1].size, v[2], v[3], v[4], v[5]]])), o.h,
      Object.fromEntries([...o.wq].sort())]])) }))
    .sort((a, b) => (b.appt + b.walkOnly) / b.days - (a.appt + a.walkOnly) / a.days);
}
