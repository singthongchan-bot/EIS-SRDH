// ข้อมูลเปรียบเทียบเวลารอพบแพทย์ระหว่างโรงพยาบาล (แหล่งข้อมูล: Looker Studio "ระยะเวลารอคอย (DASHBOARD)")
// แถว: { h: โรงพยาบาล, p: ช่วงเวลา, n: ผู้ป่วยนัด, mean, median, pct60, early: มาก่อนนัด(มัธยฐาน นาที), start: แพทย์เริ่มตรวจ 'HH:MM' }
import { getStore } from '@netlify/blobs';

export const SOURCE_URL = 'https://datastudio.google.com/u/0/reporting/fd7a87db-4e41-4c0c-a23a-ee1ee3c4feae/page/p_4js8vyyh6d';
const store = () => getStore({ name: 'opd', consistency: 'strong' });

// ค่าเริ่มต้นจากภาพหน้าจอ Looker Studio (1-15 ก.ย. 69 และค่าเฉลี่ย มิ.ย. 69 ที่คำนวณจากคอลัมน์ "เปลี่ยนแปลงจาก มิ.ย.")
const S = [
  ['รพ.พระมงคลเทพมุนี', 249, 31.3, 17.0, 89.6, -162.8, 29, '08:13'],
  ['รพ.บางนา', 345, 47.5, 34.3, 73.9, -20.4, 18, '08:40'],
  ['รพ.นคราภิบาล', 1209, 63.0, 52.6, 56.2, -29.0, 98, '08:22'],
  ['รพ.หลวงพ่อทวีศักดิ์ฯ', 2360, 69.7, 54.9, 53.6, -9.1, 78, '08:14'],
  ['รพ.รัตนประชารักษ์', 1660, 73.3, 55.2, 52.5, -7.6, 49, '08:02'],
  ['รพ.ตากสิน', 8464, 76.0, 54.1, 54.4, -10.6, 89, '08:07'],
  ['รพ.ราชพิพัฒน์', 9368, 78.4, 54.6, 53.7, 1.3, 55, '08:03'],
  ['รพ.เวชการุณย์รัศมิ์', 2293, 81.1, 42.3, 65.7, 16.8, 62, '08:06'],
  ['รพ.กลาง', 7521, 89.8, 75.5, 39.8, -11.3, 72, '07:16'],
  ['รพ.เจริญกรุงประชารักษ์', 9827, 105.2, 86.7, 34.4, 4.0, 87, '08:00'],
  ['รพ.ผู้สูงอายุบางขุนเทียน', 2316, 109.5, 64.0, 47.2, 33.2, 51, '08:05'],
  ['รพ.สิรินธร', 9384, 123.7, 86.7, 32.8, 5.4, 91, '08:05'],
];
export const SEED = {
  periods: ['มิ.ย. 69', 'ก.ย. 1-15 69'],
  rows: [
    ...S.map(r => ({ h: r[0], p: 'มิ.ย. 69', mean: Math.round((r[2] - r[5]) * 10) / 10 })),
    ...S.map(r => ({ h: r[0], p: 'ก.ย. 1-15 69', n: r[1], mean: r[2], median: r[3], pct60: r[4], early: r[6], start: r[7] })),
  ],
  meta: { source: 'seed', note: 'ข้อมูลตั้งต้นจากภาพหน้าจอ Looker Studio', updated: null },
};

// จับคู่หัวคอลัมน์ (ไทย/อังกฤษ) → ฟิลด์
const COLS = [
  ['h', /โรงพยาบาล|hospital|^รพ/i], ['p', /ช่วง|period|เดือน|month|รอบ/i], ['n', /ผู้ป่วย|จำนวน|patients|count|ครั้ง/i],
  ['early', /ก่อน|early/i], ['pct60', /60|ร้อยละ|percent|%/i], ['median', /มัธยฐาน|median/i],
  ['start', /เริ่ม|start/i], ['mean', /เฉลี่ย|mean|avg|average|เวลารอ/i],
];
function splitCSV(text) {
  const out = []; let row = [], cur = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) { if (ch === '"') { if (text[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += ch; }
    else if (ch === '"') q = true; else if (ch === ',') { row.push(cur); cur = ''; }
    else if (ch === '\n' || ch === '\r') { if (ch === '\r' && text[i + 1] === '\n') i++; row.push(cur); out.push(row); row = []; cur = ''; }
    else cur += ch;
  }
  if (cur || row.length) { row.push(cur); out.push(row); }
  return out.filter(r => r.some(c => c.trim()));
}
const num = v => { const x = parseFloat(String(v ?? '').replace(/[,%\s]/g, '')); return Number.isFinite(x) ? x : undefined; };
const hhmm = v => { const m = String(v ?? '').match(/(\d{1,2})[:.](\d{2})/); return m ? m[1].padStart(2, '0') + ':' + m[2] : undefined; };

export function parseCompare(text) {
  const t = splitCSV(String(text).replace(/^﻿/, ''));
  if (t.length < 2) throw new Error('ไฟล์ไม่มีข้อมูล');
  const head = t[0].map(s => s.trim()), idx = {};
  head.forEach((hd, i) => { const f = COLS.find(([k, re]) => !(k in idx) && re.test(hd)); if (f) idx[f[0]] = i; });
  if (!('h' in idx) || !('mean' in idx)) throw new Error('ต้องมีคอลัมน์ โรงพยาบาล และ เวลารอเฉลี่ย (พบหัวคอลัมน์: ' + head.join(', ') + ')');
  const periods = [], rows = [];
  for (const r of t.slice(1)) {
    const h = (r[idx.h] || '').trim(), mean = num(r[idx.mean]); if (!h || mean === undefined) continue;
    const p = ('p' in idx ? r[idx.p] : '').trim() || 'ล่าสุด';
    if (!periods.includes(p)) periods.push(p);
    const o = { h, p, mean };
    for (const k of ['n', 'median', 'pct60', 'early']) if (k in idx) { const v = num(r[idx[k]]); if (v !== undefined) o[k] = v; }
    if ('start' in idx) { const v = hhmm(r[idx.start]); if (v) o.start = v; }
    rows.push(o);
  }
  if (!rows.length) throw new Error('ไม่พบแถวที่อ่านได้');
  return { periods, rows };
}

export async function loadCompare() { return (await store().get('compare', { type: 'json' })) || SEED; }
export async function saveCompare(d, source) {
  const out = { periods: d.periods, rows: d.rows, meta: { source, updated: new Date().toISOString() } };
  await store().setJSON('compare', out); return out;
}

// ดึงอัตโนมัติ: COMPARE_CSV_URL = ลิงก์ CSV ของแหล่งข้อมูลที่ Looker Studio ใช้ (เช่น Google Sheets → เผยแพร่ทางเว็บ → CSV)
export async function syncCompare() {
  const url = Netlify.env.get('COMPARE_CSV_URL');
  if (!url) return { ok: false, error: 'ยังไม่ได้ตั้งค่า COMPARE_CSV_URL' };
  try {
    const r = await fetch(url, { redirect: 'follow' });
    if (!r.ok) throw new Error('ดาวน์โหลดไม่สำเร็จ (HTTP ' + r.status + ')');
    const d = await saveCompare(parseCompare(await r.text()), 'auto');
    await store().setJSON('compare-sync', { ok: true, at: d.meta.updated, rows: d.rows.length });
    return { ok: true, rows: d.rows.length, meta: d.meta };
  } catch (e) {
    await store().setJSON('compare-sync', { ok: false, at: new Date().toISOString(), error: e.message });
    return { ok: false, error: e.message };
  }
}
