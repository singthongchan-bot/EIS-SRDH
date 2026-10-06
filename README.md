# OPD Dashboard รพ.สิรินธร (Netlify)
1. ใส่โฟลเดอร์นี้ใน Git (GitHub) แล้วเชื่อมกับ Netlify (หรือใช้ `netlify deploy --prod`) – Netlify Drop ใช้ไม่ได้เพราะมี Functions
2. Site settings → Environment variables → เพิ่ม `ADMIN_PASSWORD` (รหัสผ่านผู้ดูแล) แล้ว deploy ใหม่
3. เปิด `/admin` เพื่อนำเข้า/ล้างข้อมูล, หน้าแรก `/` คือแดชบอร์ด
การจัดกลุ่มรหัสคลินิก → แผนก แก้ที่ `netlify/functions/groups.mjs`
