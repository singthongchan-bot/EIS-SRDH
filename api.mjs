import { getStore } from '@netlify/blobs';
import { compute } from './compute.mjs';
const st = () => getStore('opd');
const J = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });
const KEY = { appt: r => r[0] + '|' + r[1] + '|' + r[2], walk: r => r[0] + '|' + r[1] + '|' + r[2], sched: r => r.slice(0, 5).join('|') + '|' + r[6] };
const load = async k => (await st().get(k, { type: 'json' })) || [];
const range = a => { const d = a.map(r => r[2]).filter(Boolean).sort(); return d.length ? [d[0], d[d.length - 1]] : null; };

async function rebuild() {
  const [appt, walk, sched] = await Promise.all([load('appt'), load('walk'), load('sched')]);
  const out = { rows: compute({ appt, walk, sched }), meta: { updated: new Date().toISOString(),
    counts: { appt: appt.length, walk: walk.length, sched: sched.length }, range: { appt: range(appt), walk: range(walk) } } };
  await st().setJSON('result', out); return out.meta;
}
export default async (req) => {
  const p = new URL(req.url).pathname.replace(/^\/api\/?/, '');
  if (req.method === 'GET' && p === 'data')
    return J((await st().get('result', { type: 'json' })) || { rows: [], meta: { counts: { appt: 0, walk: 0, sched: 0 } } });
  if (!p.startsWith('admin/')) return J({ error: 'not found' }, 404);
  const pw = Netlify.env.get('ADMIN_PASSWORD');
  if (!pw) return J({ error: 'ยังไม่ได้ตั้งค่า ADMIN_PASSWORD ใน Netlify' }, 500);
  if (req.headers.get('x-admin-password') !== pw) return J({ error: 'รหัสผ่านไม่ถูกต้อง' }, 401);
  const [, action, kind] = p.split('/');
  if (action === 'status') return J((await st().get('result', { type: 'json' }))?.meta || { counts: { appt: 0, walk: 0, sched: 0 } });
  if (req.method !== 'POST') return J({ error: 'method' }, 405);
  if (action === 'clear') {
    const ks = kind === 'all' ? ['appt', 'walk', 'sched'] : KEY[kind] ? [kind] : null;
    if (!ks) return J({ error: 'ชนิดข้อมูลไม่ถูกต้อง' }, 400);
    for (const k of ks) await st().delete(k);
    return J({ ok: true, meta: await rebuild() });
  }
  if (action === 'import' && KEY[kind]) {
    const { records = [], done = false } = await req.json();
    const cur = await load(kind), seen = new Set(cur.map(KEY[kind])); let added = 0;
    for (const r of records) { const k = KEY[kind](r); if (!seen.has(k)) { seen.add(k); cur.push(r); added++; } }
    await st().setJSON(kind, cur);
    return J({ ok: true, added, total: cur.length, meta: done ? await rebuild() : undefined });
  }
  return J({ error: 'not found' }, 404);
};
export const config = { path: '/api/*' };
