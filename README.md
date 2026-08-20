# 🏢 WMS Platform — Ombor va Moddiy Aktivlarni Boshqarish Tizimi

Zamonaviy, xavfsiz va to'liq multi-tenant arxitekturaga ega **Ombor va Moddiy Aktivlarni Boshqarish Tizimi (WMS)**. Mazkur platforma davlat tashkilotlari, vazirliklar va yirik korxonalarda asosiy vositalar (jihozlar), TMZ tovarlari, ombor kirim-chiqim operatsiyalari hamda xodimlar balansini hisobga olish va nazorat qilish uchun mo'ljallangan.

---

## 🚀 Texnologiyalar Steki

### 🖥️ Frontend
- **Framework:** React 18 + TypeScript + Vite
- **Styling:** Tailwind CSS + Lucide Icons + Radix UI
- **State & Data Fetching:** TanStack React Query + Axios (avtomatik Token Mutex Queue bilan)
- **Export & Import:** ExcelJS (haqiqiy .xlsx), jsPDF, html2canvas

### ⚙️ Backend
- **Framework:** NestJS + TypeScript
- **Database & ORM:** PostgreSQL + Prisma ORM (Composite Indexes bilan optimallashtirilgan)
- **Security & Protection:** Helmet, Throttler (Rate Limiting), PostgreSQL Null-Byte sanitization, bcrypt, JWT Authentication
- **Reporting & File Processing:** ExcelJS, Puppeteer, Multer

---

## 📁 Loyiha Strukturasi

```text
wms-platform/
├── back/                      # NestJS Backend API
│   ├── prisma/                # Prisma schema va migratsiyalar
│   ├── src/
│   │   ├── modules/           # Auth, Users, Departments, Products, Assets, Operations, Audit, Excel
│   │   └── common/            # Guards, Interceptors, Decorators, Filters
│   └── package.json
├── front/                     # React + Vite Frontend
│   ├── src/
│   │   ├── api/               # Axios sozlamalari va API integratsiyalar
│   │   ├── components/        # UI komponentlar, modallar, jadvallar
│   │   ├── pages/             # Tizim sahifalari (Dashboard, Ombor, Jihozlar, Xodimlar, Audit)
│   │   └── context/           # Auth, Theme va Til (i18n) kontekstlari
│   └── package.json
├── .gitignore
└── README.md
```

---

## ⚙️ O'rnatish va Ishga Tushirish

### 1. Repozitoriyani klonlash
```bash
git clone https://github.com/ahmadillohasanov099-max/wms-platform.git
cd wms-platform
```

### 2. Backendni ishga tushirish
```bash
cd back
npm install

# .env faylini to'ldiring (.env.example asosida)
npx prisma generate
npx prisma db push

npm run start:dev
```
*Backend sukut bo'yicha `http://localhost:4000` portida ishga tushadi.*

### 3. Frontendni ishga tushirish
```bash
cd ../front
npm install

# .env faylini sozlang (VITE_API_URL=http://localhost:4000/api/v1)
npm run dev
```
*Frontend sukut bo'yicha `http://localhost:5173` portida ishga tushadi.*

---

## 🔒 Asosiy Xususiyatlar va Xavfsizlik

- **Multi-Tenant Izolyatsiyasi:** Har bir hududiy boshqarma va tashkilot o'z ma'lumotlarini to'liq ajratilgan holda ko'radi.
- **Rollar va Vakolatlar Boshqaruvi:** `SUPER_ADMIN`, `ADMIN`, `HR / KADR`, `WAREHOUSEMAN (Omborchi)`, `ACCOUNTANT (Buxgalter)`, `EMPLOYEE (Xodim)`.
- **Hujjatlar va Dalolatnomalar:** Qabul qilish-topshirish dalolatnomalari, elektron tilxatlar va QR-kodli yorliqlar.
- **Mukammal Eksport/Import:** 1C va buxgalteriya standartlariga mos to'liq `.xlsx` formatdagi eksport va massiv import.
- **Kiber-Himoya:** Null-byte fuzzing, XSS, DDoS va Brute-force hujumlariga qarshi ko'p bosqichli himoya tizimi.

---

## 📄 Litsenziya
Ushbu loyiha maxsus buyurtma asosida ishlab chiqilgan va barcha huquqlar himoyalangan.
