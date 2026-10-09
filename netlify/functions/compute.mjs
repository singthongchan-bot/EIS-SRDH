const WD = ['จันทร์','อังคาร','พุธ','พฤหัสบดี','ศุกร์'];
// 1 รหัสคลินิก (lct) = 1 แถว  |  appt: [vn,lct,date,dct]  walk: [vn,lct,date]  sched: [lct,day,doc,main,sub,quota,is1h]
export function compute({ appt = [], walk = [], sched = [], names = {} }) {
  const m = new Map();
  const g = l => { l = +l; if (!m.has(l)) m.set(l, { lct: l, ak: new Set(), wk: new Set(), dates: new Set(), wOnly: 0, doc: new Map(), sd: new Map(), qs: 0, qn: 0 }); return m.get(l); };
  for (const [vn, lct, d, dct] of appt) {
    const c = g(lct); c.ak.add(vn + '|' + lct + '|' + d); c.dates.add(d);
    if (dct) { if (!c.doc.has(d)) c.doc.set(d, new Set()); c.doc.get(d).add(dct); }
  }
  for (const [vn, lct, d] of walk) {                 // ตัดซ้ำ: VN + lct + วันที่ ตรงกับไฟล์นัด
    const c = g(lct), k = vn + '|' + lct + '|' + d; if (c.wk.has(k)) continue;
    c.wk.add(k); c.dates.add(d); if (!c.ak.has(k)) c.wOnly++;
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
    quota: c.qn ? Math.round(c.qs / c.qn * 10) / 10 : null }))
    .sort((a, b) => (b.appt + b.walkOnly) / b.days - (a.appt + a.walkOnly) / a.days);
}
