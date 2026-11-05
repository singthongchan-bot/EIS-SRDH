import { getStore } from '@netlify/blobs';
import { compute } from './compute.mjs';
import { loadCompare, saveCompare, parseCompare, syncCompare, SEED, SOURCE_URL } from './compare.mjs';
const st = () => getStore({ name: 'opd', consistency: 'strong' }); // อ่านหลังเขียนต้องเห็นข้อมูลล่าสุดทันที
const J = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });
const KEY = { appt: r => r[0] + '|' + r[1] + '|' + r[2], walk: r => r[0] + '|' + r[1] + '|' + r[2], sched: r => r.slice(0, 5).join('|') + '|' + r[6] };
const load = async k => (await st().get(k, { type: 'json' })) || [];
const range = a => { const d = a.map(r => r[2]).filter(Boolean).sort(); return d.length ? [d[0], d[d.length - 1]] : null; };

async function rebuild() {
  const [appt, walk, sched] = await Promise.all([load('appt'), load('walk'), load('sched')]);
  const names = (await st().get('names', { type: 'json' })) || {};
  const out = { rows: compute({ appt, walk, sched, names }), meta: { v: 3, updated: new Date().toISOString(),
    counts: { appt: appt.length, walk: walk.length, sched: sched.length }, timed: { appt: appt.filter(r => r.length > 4).length, walk: walk.filter(r => r.length > 4).length }, range: { appt: range(appt), walk: range(walk) } } };
  await st().setJSON('result', out); return out.meta;
}
export default async (req) => {
  const p = new URL(req.url).pathname.replace(/^\/api\/?/, '');
  if (req.method === 'GET' && p === 'data') {
    let res = await st().get('result', { type: 'json' });
    if (res && res.rows?.length && res.meta?.v !== 3) { await rebuild(); res = await st().get('result', { type: 'json' }); } // ผลเก่ายังไม่มีข้อมูลรายเดือน/รายวัน
    return J(res || { rows: [], meta: { counts: { appt: 0, walk: 0, sched: 0 } } });
  }
  if (req.method === 'GET' && p === 'compare') return J({ ...(await loadCompare()), sourceUrl: SOURCE_URL });
  if (!p.startsWith('admin/')) return J({ error: 'not found' }, 404);
  const pw = Netlify.env.get('ADMIN_PASSWORD');
  if (!pw) return J({ error: 'ยังไม่ได้ตั้งค่า ADMIN_PASSWORD ใน Netlify' }, 500);
  if (req.headers.get('x-admin-password') !== pw) return J({ error: 'รหัสผ่านไม่ถูกต้อง' }, 401);
  const [, action, kind] = p.split('/');
  if (action === 'status') return J((await st().get('result', { type: 'json' }))?.meta || { counts: { appt: 0, walk: 0, sched: 0 } });
  if (action === 'compare' && req.method === 'GET') {
    const c = await loadCompare();
    return J({ meta: c.meta, rows: c.rows.length, periods: c.periods, sync: await st().get('compare-sync', { type: 'json' }), autoUrl: !!Netlify.env.get('COMPARE_CSV_URL') });
  }
  if (req.method !== 'POST') return J({ error: 'method' }, 405);
  if (action === 'clear') {
    const ks = kind === 'all' ? ['appt', 'walk', 'sched'] : KEY[kind] ? [kind] : null;
    if (!ks) return J({ error: 'ชนิดข้อมูลไม่ถูกต้อง' }, 400);
    if (kind === 'all') await st().delete('names');
    for (const k of ks) await st().delete(k);
    return J({ ok: true, meta: await rebuild() });
  }
  if (action === 'compare') {
    try {
      if (kind === 'sync') { const r = await syncCompare(); return J(r, r.ok ? 200 : 400); }
      if (kind === 'reset') { await st().delete('compare'); return J({ ok: true, meta: SEED.meta }); }
      const d = await saveCompare(parseCompare(await req.text()), 'upload');
      return J({ ok: true, rows: d.rows.length, periods: d.periods, meta: d.meta });
    } catch (e) { return J({ error: e.message }, 400); }
  }
  if (action === 'import' && KEY[kind]) {
    const { records = [], done = false, names } = await req.json();
    if (names && Object.keys(names).length) {
      const cn = (await st().get('names', { type: 'json' })) || {};
      for (const k in names) if (!(kind === 'sched' && cn[k])) cn[k] = names[k];
      await st().setJSON('names', cn);
    }
    const cur = await load(kind), pos = new Map(cur.map((r, i) => [KEY[kind](r), i])); let added = 0, updated = 0;
    for (const r of records) { const k = KEY[kind](r), i = pos.get(k);
      if (i === undefined) { pos.set(k, cur.length); cur.push(r); added++; }
      else if (kind !== 'sched' && r.length > cur[i].length) { cur[i] = r; updated++; } } // เติมข้อมูลเวลาให้รายการเดิม
    await st().setJSON(kind, cur);
    return J({ ok: true, added, updated, total: cur.length, meta: done ? await rebuild() : undefined });
  }
  return J({ error: 'not found' }, 404);
};
export const config = { path: '/api/*' };
