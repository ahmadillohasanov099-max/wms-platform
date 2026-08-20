# Ombor Boshqaruv Tizimi (Warehouse Management System) — Frontend Tavsifi & Qo'llanmasi

Ushbu hujjat frontend (React + Vite + TypeScript + Tailwind CSS) loyihasining to'liq me'morchiligi, sahifalar tafsilotlari, dizayn qarorlari va backend integratsiyasini tushuntiradi.

---

## 🛠️ QISM 1 — TEXNOLOGIYALAR

* **Framework:** React 18 + Vite + TypeScript
* **Stillashtirish:** Tailwind CSS
* **State Management:** Zustand (global holatlar: auth, UI), React Query (server/API caching)
* **HTTP Client:** Axios (avtomatik JWT token yangilash interceptor bilan)
* **Router:** React Router v6
* **Form validation:** React Hook Form + Zod
* **Jadval tizimi:** TanStack Table
* **Ikonkalar:** Lucide React
* **Bildirishnomalar:** React Hot Toast
* **PDF viewer:** `react-pdf` (dalolatnomalarni ko'rish va chop etish)
* **Tema:** Dark / Light (localStorage-da saqlanadi)

---

## 📂 QISM 2 — LOYIHA TUZILISHI

```text
src/
├── main.tsx                   # Kirish nuqtasi
├── App.tsx                    # Router va global provayderlar
│
├── api/
│   ├── axios.ts               # Axios interceptor va sozlashlar
│   └── endpoints/
│       ├── auth.api.ts        # Login, profil, parol o'zgartirish
│       ├── departments.api.ts # Bo'limlar boshqaruvi va Excel yuklash
│       ├── users.api.ts       # Xodimlar, jihozlar ro'yxati va Excel yuklash
│       ├── products.api.ts    # Mahsulot katalogi va tarix
│       ├── inventory.api.ts   # Ombor zaxiralari va bulk kirim
│       ├── operations.api.ts  # 8 turdagi operatsiyalar va PDF aktlar
│       ├── history.api.ts     # Amallar tarixi va CSV eksport
│       └── stats.api.ts       # Grafiklar va dashboard tahlillari
│
├── store/
│   ├── auth.store.ts          # Foydalanuvchi ma'lumotlari, tokenlar va rollar
│   └── ui.store.ts            # Sidebar holati va Dark/Light tema
│
├── hooks/                     # Custom react hooks (API integratsiyalari uchun)
│   ├── useAuth.ts
│   ├── useDepartments.ts
│   ├── useUsers.ts
│   ├── useProducts.ts
│   ├── useInventory.ts
│   ├── useOperations.ts
│   ├── useHistory.ts
│   └── useStats.ts
│
├── components/
│   ├── layout/
│   │   ├── AppLayout.tsx      # Sidebar + Topbar wrapper
│   │   ├── Sidebar.tsx        # Rol bo'yicha filtrlanuvchi navigatsiya paneli
│   │   └── Topbar.tsx         # Sarlavha, til tanlash dropdowni, bildirishnoma, profil
│   │
│   ├── ui/                    # Atomar UI komponentlar
│   │   ├── Button.tsx
│   │   ├── Input.tsx
│   │   ├── Select.tsx
│   │   ├── Modal.tsx
│   │   ├── Table.tsx
│   │   ├── Badge.tsx
│   │   ├── Card.tsx
│   │   ├── Spinner.tsx
│   │   ├── Pagination.tsx
│   │   └── ConfirmDialog.tsx
│   │
│   └── shared/
│       ├── StatCard.tsx
│       ├── ActivityFeed.tsx
│       └── RoleGuard.tsx      # Ruxsat etilgan rollarga qarab elementlarni ko'rsatish
│
├── pages/                     # Tizim sahifalari
│   ├── auth/
│   │   └── LoginPage.tsx      # Tizimga kirish oynasi
│   ├── dashboard/
│   │   └── DashboardPage.tsx  # Admin/Omborchi dashboardi
│   ├── inventory/
│   │   ├── InventoryPage.tsx  # Ombor qoldiqlari va sozlamalar
│   │   └── StockInModal.tsx   # Kirim qilish oynasi
│   ├── products/
│   │   ├── ProductsPage.tsx   # Mahsulot katalogi
│   │   ├── ProductFormModal.tsx
│   │   └── ProductHistoryModal.tsx
│   ├── departments/
│   │   ├── DepartmentsPage.tsx # Bo'limlar boshqaruvi
│   │   └── DepartmentFormModal.tsx
│   ├── users/
│   │   ├── UsersPage.tsx       # Xodimlar ro'yxati va eksporti
│   │   ├── UserFormModal.tsx
│   │   └── UserAssignmentsModal.tsx # Zimmasidagi jihozlar ro'yxati
│   ├── operations/
│   │   ├── OperationsPage.tsx  # Topshirish/qaytarish/o'tkazish markazi
│   │   ├── GiveToUserModal.tsx
│   │   ├── ReturnFromUserModal.tsx
│   │   ├── TransferUserModal.tsx
│   │   ├── GiveToDeptModal.tsx
│   │   └── BulkStockInPage.tsx
│   ├── history/
│   │   └── HistoryPage.tsx    # Amallar tarixi va CSV eksport
│   ├── stats/
│   │   └── StatsPage.tsx      # Tahliliy grafiklar (Recharts)
│   └── profile/
│       └── ProfilePage.tsx    # Xodim shaxsiy profili (faqat XODIMlar uchun)
│
└── types/                     # TypeScript tiplar va interfeyslar
```

---

## 🔒 QISM 3 — SAHIFALAR VA ROL RUXSATLARI

| Sahifa | URL | ADMIN | OMBORCHI | KADR | XODIM |
| :--- | :--- | :---: | :---: | :---: | :---: |
| Login | `/login` | Ha | Ha | Ha | Ha |
| Dashboard | `/dashboard` | Ha | Ha | Yo'q | Yo'q |
| Ombor | `/inventory` | Ha | Ha | Ha | Yo'q |
| Mahsulotlar | `/products` | Ha | Ha (Ko'rish) | Ha (Ko'rish) | Yo'q |
| Bo'limlar | `/departments` | Ha | Yo'q | Yo'q | Yo'q |
| Xodimlar | `/users` | Ha | Yo'q | Ha | Yo'q |
| Operatsiyalar | `/operations` | Ha | Ha | Yo'q | Yo'q |
| Tarix | `/history` | Ha | Ha | Ha | Yo'q |
| Statistika | `/stats` | Ha | Ha | Yo'q | Yo'q |
| Profil | `/profile` | Yo'q | Yo'q | Yo'q | Ha |

---

## 📝 QISM 4 — SAHIFALAR TAFSILOTI

### P-01. LOGIN SAHIFASI (`/login`)
* **Vizual:** Logotip, tizim nomi, kirish formasi.
* **Mantiq:**
  * Username va password kiritilib kirish tugmasi bosiladi (Zod orqali validatsiya qilinadi).
  * API: `POST /auth/login`
  * Muvaffaqiyatli login: tokenlar `localStorage`-da saqlanadi, `auth.store.ts` yangilanadi. `ADMIN` va `OMBORCHI` -> `/dashboard` sahifasiga, `XODIM` esa -> `/profile` shaxsiy profil sahifasiga yo'naltiriladi.

### P-02. DASHBOARD (`/dashboard`)
* **Vizual:** 4 ta asosiy tahlil kartochkalari (Jami tovarlar, faol xodimlar, kam qolgan tovarlar soni va umumiy ombor qiymati).
* **Kontent:**
  * Chap tomonda: So'nggi 10 ta operatsiya jadvali (batafsil ko'rish uchun `/history` ga havola).
  * O'ng tomonda: Tezkor amallar tugmalari (Jihoz berish, qaytarib olish, o'tkazish va kirim) hamda tizim faollik lenti.
* **API:** `GET /stats/overview`, `GET /history?limit=10`

### P-03. OMBOR SAHIFASI (`/inventory`)
* **Vizual:** Ombor qoldiqlari ro'yxati, kam qolgan mahsulotlar uchun qizil ogohlantirish indikatorlari.
* **Filtrlar:** Mahsulot nomi bo'yicha qidiruv, `ProductType` filtri va faqat kam qolgan tovarlarni filtrlash.
* **Amallar:**
  * Mahsulot minimal darajasini inline tahrirlash (`PATCH /inventory/min-level`).
  * "Excelga yuklash" yashil tugmasi (backenddagi `GET /inventory/export` API orqali).
  * Yakka va ommaviy (Excel import) kirim qilish modallari.
* **API:** `GET /inventory`, `PATCH /inventory/min-level`, `GET /inventory/low-stock`

### P-04. MAHSULOTLAR SAHIFASI (`/products`)
* **Vizual:** Mahsulotlar katalogi jadvali, tur va o'lchov birliklari.
* **Mantiq:** `ADMIN` foydalanuvchilar mahsulot qo'shishi, tahrirlashi yoki o'chirishi mumkin. `OMBORCHI` esa faqat o'qiy oladi.
* **Amallar:** Tahrirlash modal oynasi, o'chirish tasdiqlash oynasi, harakatlar tarixi modal oynasi.
* **API:** `GET /products`, `PUT /products/:id`, `DELETE /products/:id`, `GET /products/:id/history`

### P-05. BO'LIMLAR SAHIFASI (`/departments`)
* **Vizual:** Tashkilot bo'limlari jadvali va xodimlar soni.
* **Amallar:** 
  * Yangi bo'lim yaratish va tahrirlash.
  * "Excelga yuklash" (backenddagi `GET /departments/export` API orqali).
  * Bo'lim statistikasi: xodimlar soni, jami jihozlar va moddiy yuklama summasi.
* **API:** `GET /departments`, `POST /departments`, `PUT /departments/:id`, `DELETE /departments/:id`, `GET /departments/:id/stats`

### P-06. XODIMLAR SAHIFASI (`/users`)
* **Vizual:** Xodimlar ro'yxati, ularning rollari va bo'limlari. Lavozim va telefon raqamlari.
* **Amallar:**
  * Yangi xodim qo'shish/tahrirlash.
  * "Excelga yuklash" (backenddagi `GET /users/export` API orqali).
  * Xodimni bloklash/faollashtirish toggli (`PATCH /users/:id/status`).
  * "Jihozlari" tugmasi: xodimdi hozirda nimalar borligini vizual jadvalda va umumiy qiymatda ko'rish (`GET /users/:id/assignments`).
  * "Barcha jihozlarni qaytarish" (bulk-return) va "boshqa xodimga o'tkazish" (bulk-transfer) tezkor tugmalari.
* **API:** `GET /users`, `POST /users`, `PUT /users/:id`, `PATCH /users/:id/status`, `GET /users/:id/assignments`, `POST /users/:id/bulk-return`

### P-07. OPERATSIYALAR SAHIFASI (`/operations`)
* **Vizual:** Tizimda amallarni bajarish markazi (6 ta asosiy kartochka ko'rinishida):
  1. Xodimga jihoz biriktirish (`GIVE_TO_USER`)
  2. Xodimdan jihoz qaytarish (`RETURN_FROM_USER`)
  3. Xodimdan xodimga o'tkazish (`TRANSFER_USER`)
  4. Bo'limga material berish (`GIVE_TO_DEPT`)
  5. Bo'limga umumiy jihoz biriktirish (`ASSIGN_TO_DEPT`)
  6. Bo'limdan jihoz/material qaytarish (`RETURN_FROM_DEPT`)
* **Forma:** Har bir operatsiya bosilganda mos modal oyna ochiladi, Zod orqali inventar raqami, unikal seriya raqamlari tekshiriladi va backendga jo'natiladi.
* **API:** `POST /operations/*` API endpointlari chaqiriladi.

### P-08. TARIX SAHIFASI (`/history`)
* **Vizual:** Tizimdagi barcha operatsiyalar tarixi jadvali.
* **Filtrlar:** Operatsiya turi, xodim, bo'lim, mahsulot va sana oralig'i (from - to) bo'yicha mukammal qidiruv.
* **Amallar:** 
  * "Excelga yuklash" (backenddagi `GET /history/export` API orqali).
  * Har bir operatsiya qatorida **"PDF AKT"** tugmasi bo'ladi. Bosilganda puppeteer orqali generatsiya qilingan aktni yuklab beradi.
* **API:** `GET /history`

### P-09. STATISTIKA SAHIFASI (`/stats`)
* **Vizual:** Dashboard va tahlillar uchun oylik grafiklar, bo'limlar yuklamasi solishtiruvlari.
* **Grafiklar (Recharts):**
  * Bo'limlar kesimida jihozlar soni va qiymati ustunli grafiki (Bar Chart).
  * So'nggi 6 oylik operatsiyalar dinamikasi chiziqli grafiki (Line Chart).
  * Kam qolgan mahsulotlar ogohlantirish doirasi (Pie Chart).
* **API:** `GET /stats/overview`, `GET /stats/by-department`, `GET /stats/by-user`, `GET /stats/monthly`

### P-10. PROFIL SAHIFASI (`/profile`)
* **Foydalanuvchi:** Faqat `XODIM` roli uchun (boshqa sahifalar bu rolga yopiq bo'ladi).
* **Vizual:** Shaxsiy ism, lavozim va bo'lim ma'lumotlari.
  * **Mening jihozlarim jadvali:** Xodim zimmasida hozirda turgan barcha jihozlar (inventar raqami, narxi, berilgan sana).
  * **Mening tarixim:** Xodim bilan bog'liq so'nggi 20 ta operatsiyalar ro'yxati.
  * **Parolni o'zgartirish:** Xavfsiz parolni o'zgartirish formasi.
* **API:** `GET /auth/me`, `GET /users/:id/assignments`, `GET /users/:id/history`, `PUT /auth/change-password`

---

## 🌐 QISM 5 — KO'P TILLILIK (i18n) INTEGRATSIYASI

Backend qismida ko'p tillilik tayyor bo'lgani sababli, frontendda quyidagi integratsiyalar amalga oshiriladi:
1. **Til tanlash dropdowni:** [Topbar.tsx](file:///C:/Users/User/Desktop/work/loyha/front/src/components/layout/Topbar.tsx) komponentida til tanlash menyusi (Bayroqlar bilan: UZ, RU, EN) qo'yiladi. Tanlangan til `localStorage`-da va `ui.store.ts` global state-da saqlanadi.
2. **Axios interceptor o'zgarishi:** [axios.ts](file:///C:/Users/User/Desktop/work/loyha/front/src/api/axios.ts) faylida har bir API so'roviga avtomatik ravishda `Accept-Language: uz | ru | en` sarlavhasi (Header) qo'shib yuboriladi.
3. **i18n Kutubxonasi:** Static matnlar (tugma matnlari, jadval sarlavhalari) frontendda `react-i18next` JSON tarjima fayllari orqali alohida o'zgartiriladi.

---

## 🎨 QISM 6 — DIZAYN QARORLARI

* **Tema:** Dark / Light rejimi. Foydalanuvchi interfeysi tungi va kunduzgi rejimda chiroyli moslashuvchan.
* **Asosiy rang:** Yashil (`#1D9E75`) — davlat tashkilotlari talablariga mos, chiroyli va qulay rang palitrasi.
* **Shrift:** `Inter` (Google Fonts).
* **Komponentlar:** Striped rows (yo'l-yo'l jadvallar), hover animatsiyalari, overlay modal oynalari.
* **Badge ranglari (Turlarga qarab):**
  * `BERILADIGAN` (Jihoz) ➡️ Ko'k (Blue)
  * `SARFLANADIGAN` (Material) ➡️ To'q sariq (Orange)
  * `SHARED` (Bo'limga biriktirilgan) ➡️ Binafsha (Purple)
  * Omborda qolgan ➡️ Kulrang (Gray)
  * Yetishmovchilik (Kam qoldi) ➡️ Qizil (Red)

---

## 🚀 QISM 7 — ISHGA TUSHIRISH (GETTING STARTED)

1. **Paketlarni o'rnatish:**
   ```bash
   npm install
   ```
2. **Lokal ishga tushirish (Development mode):**
   ```bash
   npm run dev
   ```
3. **Production uchun build tayyorlash:**
   ```bash
   npm run build
   ```
