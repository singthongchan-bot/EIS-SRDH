import { GROUPS } from './groups.mjs';
const WD = ['จันทร์','อังคาร','พุธ','พฤหัสบดี','ศุกร์'];
// appt: [vn,lct,date,dct]  walk: [vn,lct,date]  sched: [lct,day,doc,main,sub,quota,is1h]
export function compute({ appt = [], walk = [], sched = [] }) {
  const byL = new Map(); GROUPS.forEach((g, i) => g.codes.forEach(c => byL.set(c, i)));
  const gs = GROUPS.map(g => ({ name: g.name, codes: g.codes, ak: new Set(), wk: new Set(), dates: new Set(),
    wOnly: 0, doc: new Map(), sd: new Map(), qs: 0, qn: 0 }));
  for (const [vn, lct, d, dct] of appt) {
    const g = gs[byL.get(+lct)]; if (!g) continue;
    g.ak.add(vn + '|' + lct + '|' + d); g.dates.add(d);
    if (dct) { if (!g.doc.has(d)) g.doc.set(d, new Set()); g.doc.get(d).add(dct); }
  }
  for (const [vn, lct, d] of walk) {                 // ตัดซ้ำ: VN + lct + วันที่ ตรงกับไฟล์นัด
    const g = gs[byL.get(+lct)]; if (!g) continue;
    const k = vn + '|' + lct + '|' + d; if (g.wk.has(k)) continue;
    g.wk.add(k); g.dates.add(d); if (!g.ak.has(k)) g.wOnly++;
  }
  for (const [lct, day, doc, , , q, is1h] of sched) {
    const g = gs[byL.get(+lct)]; if (!g) continue;
    if (WD.includes(day)) { if (!g.sd.has(day)) g.sd.set(day, new Set()); g.sd.get(day).add(doc); }
    if (is1h && q > 0) { g.qs += q; g.qn++; }
  }
  const mean = a => a.length ? a.reduce((s, x) => s + x, 0) / a.length : null;
  return gs.filter(g => g.dates.size).map(g => ({
    name: g.name, codes: g.codes, days: g.dates.size, appt: g.ak.size, walkOnly: g.wOnly, walkAll: g.wk.size,
    rooms: Math.round((mean([...g.doc.values()].map(s => s.size)) || 1) * 100) / 100,
    schedDocs: g.sd.size ? Math.round(mean([...g.sd.values()].map(s => s.size)) * 10) / 10 : null,
    quota: g.qn ? Math.round(g.qs / g.qn * 10) / 10 : null }));
}
