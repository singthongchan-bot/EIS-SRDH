// ซิงก์ข้อมูลเปรียบเทียบโรงพยาบาลอัตโนมัติวันละครั้ง (06:00 น. เวลาไทย = 23:00 UTC)
import { syncCompare } from './compare.mjs';
export default async () => { const r = await syncCompare(); console.log('sync-compare', JSON.stringify(r)); };
export const config = { schedule: '0 23 * * *' };
