# 🏢 WMS Platform — Yagona Ombor va Moddiy Aktivlarni Boshqarish Tizimi

> **Holati:** Ishlab chiqishda
> **Versiya:** 1.0.0 (Multi-Tenant Enterprise Edition)  
> **Backend:** NestJS 11 + Prisma 6 + PostgreSQL + WebSockets (Socket.io)  
> **Frontend:** React 19 + Vite + TypeScript + Tailwind CSS  
> **Boshqaruv darajasi:** Vazirlik, Agentliklari va Quyi Tashkilotlari uchun  

---

## 📑 Mundarija

1. [Loyiha Haqida Umumiy Tavsif](#-1-loyiha-haqida-umumiy-tavsif)
2. [Multi-Tenant Arxitekturasi va Tashkilotlar Iyerarxiyasi](#-2-multi-tenant-arxitekturasi-va-tashkilotlar-iyerarxiyasi)
3. [Texnologiyalar Steki](#-3-texnologiyalar-steki)
4. [Rollar va Ruxsatlar Tizimi (RBAC)](#-4-rollar-va-ruxsatlar-tizimi-rbac)
5. [Asosiy Biznes Mantiqlari va Jarayonlar Reglamenti](#-5-asosiy-biznes-mantiqlari-va-jarayonlar-reglamenti)
6. [Ma'lumotlar Bazasi Sxemasi (ER Diagram & Modellar)](#-6-malumotlar-bazasi-sxemasi-er-diagram--modellar)
7. [Frontend Sahifalari va Foydalanuvchi Interfeysi](#-7-frontend-sahifalari-va-foydalanuvchi-interfeysi)
8. [Backend API Modullari va Endpointlar Katalogi](#-8-backend-api-modullari-va-endpointlar-katalogi)
9. [Xavfsizlik va Kiber-himoya Mexanizmlari](#-9-xavfsizlik-va-kiber-himoya-mexanizmlari)
10. [Mahalliy O'rnatish va Ishga Tushirish (Local Setup)](#-10-mahalliy-ornatish-va-ishga-tushirish-local-setup)
11. [Vaqtinchalik Prezentatsiya va Serverga O'rnatish (Deployment)](#-11-vaqtinchalik-prezentatsiya-va-serverga-ornatish-deployment)
12. [Foydali Buyruqlar va Skriptlar](#-12-foydali-buyruqlar-va-skriptlar)

---

## 🌟 1. LOYIHA HAQIDA UMUMIY TAVSIF

**WMS Platform** — bu davlat organlari, vazirliklar, departamentlar va ularning tizimidagi barcha quyi tashkilotlar (viloyat va tuman boshqarmalari) uchun mo'ljallangan yagona avtomatlashtirilgan axborot tizimi.

### Mazkur tizim qanday amaliy muammolarni hal etadi?
* **1C va Qog'ozbozlikdan voz kechish:** Moddiy javobgarlik shartnomalari, qabul qilish-topshirish dalolatnomalari va buyruqlar elektron formatga o'tkaziladi.
* **Haqiqiy Asosiy Vositalar (Jihozlar) Nazorati:** Kompyuterlar, monitorlar, mebellar va texnikalar har bir dona alohida unikal inventar raqam bilan qayd etiladi.
* **Xodimlar zimmisidagi aktivlar shaffofligi:** Xodim ishga kirganda jihozlar unga topshiriladi, o'z kabinetida tasdiqlaydi. Ishdan bo'shaganda (Offboarding) esa barcha jihozlar omborga qaytarilmaguncha tizim uni bo'shatishga ruxsat bermaydi.
* **Avtonomiya va Vazirlik Monitoringi:** Viloyat boshqarmalari o'z balansidagi tovarlar bilan erkin va mustaqil ishlaydi, Markaziy Vazirlik esa butun respublika bo'yicha real vaqtda audit va hisobotlarni kuzatib turadi.

---

## 🏛️ 2. MULTI-TENANT ARXITEKTURASI VA TASHKILOTLAR IYERARXIYASI

Tizim ko'p tarmoqli (Multi-Tenant) tuzilishga ega:

```mermaid
flowchart TD
    MINISTRY["🏛️ VAZIRLIK (MINISTRY)<br/>Markaziy Boshqarma<br/>(Barcha tizimni nazorat qiladi, audit yuritadi)"]
    
    SUB1["🏢 Toshkent shahar Boshqarmasi (SUB_ORG)<br/>Avtonom balans, o'z ombori va xodimlari"]
    SUB2["🏢 Samarqand viloyat Boshqarmasi (SUB_ORG)<br/>Avtonom balans, o'z ombori va xodimlari"]
    SUB3["🏢 Farg'ona viloyat Boshqarmasi (SUB_ORG)<br/>Avtonom balans, o'z ombori va xodimlari"]

    MINISTRY --> SUB1
    MINISTRY --> SUB2
    MINISTRY --> SUB3
```

### Izolyatsiya qoidalari:
1. **To'liq ma'lumotlar ajratilishi:** Har bir tashkilot (`Organization`) faqat o'zining bo'limlari, xodimlari, tovarlari va amallarini ko'radi.
2. **Mustaqillik:** Boshqarmalar o'z omboriga mustaqil kirim qiladi, xodimlariga jihoz biriktiradi va hisobdan chiqaradi. Vazirlikdan ruxsat so'rab o'tirish shart emas.
3. **Vazirlik nazorati:**
   * Markaziy Vazirlik xodimlari quyi tashkilotlar ro'yxatini, ularning ombor qoldiqlarini va operatsiyalar tarixini audit rejimida ko'ra oladi.
   * Xato kiritilgan tovarlar yoki yozuvlarni o'chirish uchun quyi tashkilotlar Vazirlikka **O'chirish so'rovi (DeletionRequest)** yuboradi.

---

## 🛠️ 3. TEXNOLOGIYALAR STEKI

### ⚙️ Backend (Server tomoni)
* **Asosiy freymvork:** [NestJS 11](https://nestjs.com/) (TypeScript)
* **Ma'lumotlar bazasi & ORM:** [PostgreSQL 15+](https://www.postgresql.org/) + [Prisma ORM 6](https://www.prisma.io/)
* **Real-vaqt aloqasi (WebSockets):** `@nestjs/websockets` + `Socket.io 4.8` (bildirishnomalar, jonli status yangilanishlari)
* **Autentifikatsiya:** Passport.js (JWT Access Token + Refresh Token Rotation mexanizmi), bcrypt
* **Eksport va Hisobotlar:** `ExcelJS` (haqiqiy formatlangan `.xlsx` jadvallari), `Puppeteer` (rasmiy PDF dalolatnomalar)
* **Xavfsizlik:** `Helmet` (HTTP xavfsizlik sarlavhalari), `@nestjs/throttler` (DDoS va brute-force dan himoya qiluvchi Rate Limiter), `compression` (Gzip/Brotli)
* **Xabarnomalar:** `nodemailer` (kam qolgan tovarlar bo'yicha email xabarnoma) va Telegram Bot integratsiyasi
* **Ko'p tillilik (i18n):** `nestjs-i18n` (xatoliklar va PDF hujjatlar uchun UZ, RU, EN)

### 🖥️ Frontend (Mijoz tomoni)
* **Kutubxona & Build Tool:** [React 19](https://react.dev/) + [Vite 8](https://vitejs.dev/) + TypeScript
* **Stillashtirish:** [Tailwind CSS 3](https://tailwindcss.com/) + Dark / Light temalar qo'llab-quvvatlashi
* **Holat boshqaruvi (State Management):**
  * `Zustand` — Mijoz holatlari (Auth, Foydalanuvchi ma'lumotlari, UI sozlamalari)
  * `TanStack React Query v5` — Server ma'lumotlarini keshlash va sinxronizatsiya
* **Tarmoq so'rovlari:** `Axios` (Token Mutex Queue — bir nechta parallel so'rovlarda tokenni takroriy yangilanishining oldini oladi)
* **Forma va Validatsiya:** `React Hook Form` + `Zod`
* **Vizual grafika va Ikonkalar:** `Recharts` (Dashboard tahlillari), `Lucide React`
* **Real-vaqt:** `socket.io-client`
* **Hujjatlar:** `html2pdf.js`, `exceljs`, `xlsx`

---

## 👥 4. ROLLAR VA RUXSATLAR TIZIMI (RBAC)

Tizimda 7 ta aniq chegaralangan foydalanuvchi roli mavjud:

| № | Rol kodi | Rol nomi | Tavsifi va vakolatlari |
|---|---|---|---|
| 1 | `SUPER_ADMIN` | Tizim Bosh Administratori | Barcha tashkilotlar, foydalanuvchilar, audit loglari va tizim sozlamalariga to'liq 100% cheklovsiz kirish huquqiga ega. |
| 2 | `RAHBAR` | Vazirlik Rahbariyati | **Faqat kuzatuv (Read-only)**. Butun respublika va quyi tashkilotlar statistikasi, harakatlar tarixi va hisobotlarini ko'radi. Ma'lumotlarni o'zgartirish yoki tovar biriktirish huquqi cheklangan. |
| 3 | `VAZIRLIK_OMBORCHI` | Markaziy Ombor Mudiri | Vazirlik markaziy ombori tovarlarini kiritish, saqlash, boshqarish, vazirlik xodimlariga jihoz biriktirish va qabul qilish. |
| 4 | `ORG_ADMIN` | Boshqarma Administratori | Quyi tashkilot (viloyat boshqarmasi) admini. O'z tashkilotiga yangi bo'limlar, `KADR`, `ORG_OMBORCHI` va `XODIM`larni qo'sha oladi. |
| 5 | `ORG_OMBORCHI` | Boshqarma Omborchisi | Quyi tashkilot omboridagi barcha kirim, chiqim, xodimga jihoz berish va qaytarish operatsiyalarini amalga oshiruvchi moddiy javobgar shaxs. |
| 6 | `KADR` | Kadrlar Bo'limi Mutaxassisi | Xodimlarni ishga qabul qilish, tahrirlash va ishdan bo'shatish (Offboarding) jarayonlarini rasmiylashtirish. |
| 7 | `XODIM` | Oddiy Xodim | O'z kabinetida faqat o'z zimmisidagi jihozlarni ko'rish, yangi biriktirilgan jihozlarni qabul qilish yoki rad etish, va o'z profilini ko'rish huquqi. |

### Rollar bo'yicha ruxsatlar matritsasi:

| Sahifa / Modul | SUPER_ADMIN | RAHBAR | VAZIRLIK_OMBORCHI | ORG_ADMIN | ORG_OMBORCHI | KADR | XODIM |
|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| Dashboard / Statistika | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |
| Ombor (Zaxiralar) | ✅ | ✅ (Ko'rish) | ✅ | ✅ | ✅ | ❌ | ❌ |
| Mahsulotlar Katalogi | ✅ | ✅ (Ko'rish) | ✅ | ✅ | ✅ | ❌ | ❌ |
| Bo'limlar Boshqaruvi | ✅ | ✅ (Ko'rish) | ❌ | ✅ | ❌ | ❌ | ❌ |
| Xodimlar Boshqaruvi | ✅ | ✅ (Ko'rish) | ❌ | ✅ | ❌ | ✅ | ❌ |
| Operatsiyalar (Kirim/Chiqim) | ✅ | ❌ | ✅ | ✅ | ✅ | ❌ | ❌ |
| Offboarding (Ishdan bo'shatish)| ✅ | ❌ | ❌ | ✅ | ❌ | ✅ | ❌ |
| Omborchi Offboarding Tasdig'i| ✅ | ❌ | ✅ | ✅ | ✅ | ❌ | ❌ |
| So'rovlar (Requests) | ✅ | ❌ | ✅ | ✅ | ✅ | ❌ | ✅ |
| O'chirish So'rovlari (Deletion)| ✅ | ✅ | ❌ | ✅ | ❌ | ❌ | ❌ |
| Audit Jurnali (AuditLog) | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Xodim Shaxsiy Kabineti | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |

---

## ⚡ 5. ASOSIY BIZNES MANTIQLARI VA JARAYONLAR REGLAMENTI

### 5.1. Mahsulot Turlari (ProductType)
1. **`BERILADIGAN` (Asosiy vositalar va Jihozlar):**
   * Masalan: noutbuk, stol, monitor, printer, xizmat mashinasi.
   * Har bir dona jismoniy jihoz alohida `Asset` sifatida yaratiladi va takrorlanmas **Inventar raqam** oladi.
   * Xodimlarga yoki bo'limlarga topshirilganda `Assignment` orqali zimmaga yoziladi va qaytarib olinmaguncha xodim nomida turadi.
2. **`SARFLANADIGAN` (TMZ va Materiallar):**
   * Masalan: A4 qog'oz, ruchka, batareya, tozalash vositalari.
   * Zaxirasi faqat miqdor (son/pachka) sifatida hisoblanadi.
   * Bo'limga berilganda sarflangan deb hisoblanadi va ombor qoldig'idan ayirilib, bo'lim qoldig'iga o'tadi.

### 5.2. Jihoz Biriktirish va Tasdiqlash Zanjiri (Ikki tomonlama ishonch)
* **O'zi berib o'zi tasdiqlash QAT'IYAN TAQIQLANGAN:** Omborchi xodimga jihoz berganda, tizim avtomatik tarzda `status: 'PENDING'` (kutilmoqda) qilib yaratadi.
* **Xodim tasdig'i:** Xodim o'z shaxsiy profiliga yoki "So'rovlar" bo'limiga kirib, o'ziga berilgan jihozning rusumi, holati va inventar raqamini ko'radi.
* Xodim **"Qabul qildim"** tugmasini bossa — `ACCEPTED` bo'ladi va moddiy javobgarlik rasman unga yuklanadi.
* Agar jihoz sinik bo'lsa yoki xodim uni olmagan bo'lsa — sababini yozib **"Rad etish"** tugmasini bosadi (`REJECTED`).

### 5.3. Xodimni Ishdan Bo'shatish (Offboarding) Reglamenti
Xodim ishdan bo'shayotganda davlat mulki yo'qolib ketmasligi uchun 4 bosqichli nazorat tizimi o'rnatilgan:
```mermaid
sequenceDiagram
    autonumber
    actor Kadr as 👤 Kadrlar Bo'limi
    actor Ombor as 📦 Omborchi
    actor User as 👨‍💼 Bo'shayotgan Xodim
    participant Sys as 💻 Tizim (WMS)

    Kadr->>Sys: Ishdan bo'shatish jarayonini boshlaydi (POST /users/:id/offboarding/start)
    Sys-->>User: Xodim statusi 'OFFBOARDING_PENDING' ga o'tadi
    Note over User,Ombor: Xodim omborga borib barcha jihozlarni topshiradi
    Ombor->>Sys: Jihozlarni qabul qilib oladi va tasdiqlaydi (POST /users/:id/offboarding/warehouse-approve)
    Sys->>Sys: Xodimda 0 ta faol jihoz qolganini avtomatik tekshiradi
    Sys-->>Kadr: Rasmiy Qabul-Topshirish Dalolatnomasi (PDF Akt) tayyor
    Kadr->>Sys: Jarayonni yakunlaydi (POST /users/:id/offboarding/complete)
    Sys-->>Sys: Xodim statusi 'OFFBOARDED' qilinadi va tizimdan chiqariladi
```

### 5.4. Ma'lumotlarni O'chirish So'rovlari (DeletionRequest)
* Quyi tashkilotlar muhim tovarlar, operatsiyalar yoki xodimlarni to'g'ridan-to'g'ri o'chirib yubora olmaydi (korrupsiya va ma'lumotlar buzilishining oldini olish uchun).
* Agar xatolik tufayli tovar kiritilgan bo'lsa, quyi admin Vazirlikka sababini ko'rsatib so'rov yuboradi.
* Vazirlik tekshirib, ma'qullasa (`APPROVED`), tovar xavfsiz tarzda soft-delete qilinadi.

### 5.5. To'liq Xavfsizlik Auditi (AuditLog)
Tizimdagi har bir o'zgartirish (`CREATE`, `UPDATE`, `DELETE`) alohida AuditLog jadvaliga tushadi:
* Amaliyotni bajargan foydalanuvchi ID, F.I.Sh va roli;
* IP-manzil va User-Agent;
* O'zgarishdan oldingi holat (`oldData`) va o'zgarishdan keyingi holat (`newData`);
* So'rov bajarilish vaqti va HTTP status kodi.

---

## 🗄️ 6. MA'LUMOTLAR BAZASI SXEMASI (ER DIAGRAM & MODELLAR)

```mermaid
erDiagram
    ORGANIZATION ||--o{ DEPARTMENT : "has"
    ORGANIZATION ||--o{ USER : "employs"
    ORGANIZATION ||--o{ PRODUCT : "owns"
    ORGANIZATION ||--o{ ASSET : "tracks"
    ORGANIZATION ||--o{ OPERATION : "logs"
    ORGANIZATION ||--o{ DELETION_REQUEST : "receives"
    ORGANIZATION ||--o{ AUDIT_LOG : "monitors"

    DEPARTMENT ||--o{ USER : "members"
    DEPARTMENT ||--o{ DEPARTMENT_ASSET : "supplies"
    DEPARTMENT ||--o{ ASSIGNMENT : "shared-assets"

    USER ||--o{ ASSIGNMENT : "assigned-assets"
    USER ||--o{ REFRESH_TOKEN : "tokens"
    USER ||--o{ OPERATION : "performs"

    PRODUCT ||--o| INVENTORY : "stock"
    PRODUCT ||--o{ ASSET : "physical-items"
    PRODUCT ||--o{ DEPARTMENT_ASSET : "allocated"
    PRODUCT ||--o{ OPERATION : "history"

    ASSET ||--o{ ASSIGNMENT : "history"
    ASSET ||--o{ OPERATION : "movements"
```

### Asosiy Jadvallar (Modellar):
1. **`Organization`** — Tashkilotlar (Vazirlik yoki viloyat boshqarmalari).
2. **`Department`** — Bo'limlar (Boshqarma ichidagi bo'lim va xizmatlar).
3. **`User`** — Foydalanuvchilar (7 xil roldagi barcha xodimlar).
4. **`Product`** — Tovar va materiallar yagona katalogi.
5. **`Inventory`** — Ombor qoldig'i, minimal xavfli miqdor (`minLevel`), narxlar.
6. **`Asset`** — Har bir jismoniy jihoz (inventar raqam, seriya raqam, kafolat muddati, narxi).
7. **`Assignment`** — Jihozning xodimga yoki bo'limga biriktirilish tarixi va tasdiq statusi.
8. **`DepartmentAsset`** — Bo'limga berilgan sarflanadigan materiallar balansi.
9. **`Operation`** — Tizimdagi 8 turdagi barcha operatsiyalar tarixi.
10. **`DeletionRequest`** — Vazirlikka yuborilgan o'chirish so'rovlari.
11. **`RefreshToken`** — Xavfsiz avtorizatsiya sessiyalari (hashlangan holda).
12. **`AuditLog`** — Xavfsizlik va nazorat amallari jurnali.

---

## 🖥️ 7. FRONTEND SAHIFALARI VA FOYDALANUVCHI INTERFEYSI

Loyiha frontend qismi 15 ta to'liq funksional sahifadan iborat:

| № | URL manzili | Sahifa nomi | Asosiy imkoniyatlari |
|---|---|---|---|
| 1 | `/login` | Kirish sahifasi | Zamonaviy fon rasmiga ega forma, til tanlash (UZ/RU/EN), xavfsiz JWT login. |
| 2 | `/dashboard` | Boshqaruv paneli | Asosiy ko'rsatkichlar kartalari, Recharts grafiklari, so'nggi harakatlar va tezkor amallar. |
| 3 | `/inventory` | Ombor zaxiralari | Qoldiqlarni ko'rish, tovar qidirish, minimal qoldiq ogohlantirishlari, Excel import/eksport. |
| 4 | `/products` | Mahsulotlar katalogi | Tovar turlari (`BERILADIGAN` / `SARFLANADIGAN`), filtrlar va inventar raqamlarni ko'rish. |
| 5 | `/departments` | Bo'limlar | Bo'limlar ro'yxati, rahbar tayinlash, bo'lim xodimlari va bo'lim jihozlari balansi. |
| 6 | `/users` | Xodimlar | Xodimlar ro'yxati, yangi xodim qo'shish, rol tayinlash, Excel eksport va Offboarding. |
| 7 | `/operations` | Harakatlar markazi | Kirim qilish (`STOCK_IN`), xodimga berish, qaytarish, o'tkazish, hisobdan chiqarish (`WRITE_OFF`). |
| 8 | `/assigned-assets` | Biriktirilgan jihozlar | Barcha xodimlardagi faol jihozlar ro'yxati, holati va qidiruv tizimi. |
| 9 | `/requests` | So'rov va Bildirishnomalar | Berilgan jihozlarni qabul qilish / rad etish va statuslarni kuzatish. |
| 10 | `/deletion-requests` | O'chirish so'rovlari | Xato ma'lumotlarni o'chirish bo'yicha Vazirlikka yuborilgan so'rovlar jurnali. |
| 11 | `/history` | Harakatlar tarixi | Barcha operatsiyalar arxivi, sana va tovar bo'yicha filtr, CSV/Excel yuklab olish. |
| 12 | `/stats` | Tahliliy statistika | Oylik dinamika, tovar turlari ulushi, bo'limlar yuklamasi va o'sish ko'rsatkichlari. |
| 13 | `/audit` | Xavfsizlik auditi | Admin uchun tizimdagi har bir foydalanuvchi qadami (IP, usul, ma'lumotlar) jurnali. |
| 14 | `/organizations` | Tashkilotlar | (Faqat Super Admin) Quyi boshqarmalar va vazirlik tuzilmasini boshqarish. |
| 15 | `/profile` | Shaxsiy kabinet | Xodimning o'z zimmisidagi jihozlar ro'yxati, qabul qilingan dalolatnomalar, parol o'zgartirish. |

---

## 🔌 8. BACKEND API MODULLARI VA ENDPOINTLAR KATALOGI

API prefiksi: `/api/v1`

### 8.1. Auth Moduli (`/auth`)
* `POST /auth/login` — Tizimga kirish (Access va Refresh token olish)
* `POST /auth/refresh` — Tokenni yangilash
* `POST /auth/logout` — Tizimdan chiqish (Sessiyani bekor qilish)
* `GET /auth/me` — Joriy kirgan foydalanuvchi ma'lumotlari
* `PUT /auth/change-password` — Parolni yangilash

### 8.2. Users Moduli (`/users`)
* `GET /users` — Xodimlar ro'yxati (Rol, bo'lim, tashkilot va qidiruv filtrlari bilan)
* `GET /users/export` — Xodimlarni Excelga eksport qilish
* `GET /users/:id` — Bitta xodim ma'lumotlari
* `POST /users` — Yangi xodim yaratish (Iyerarxik rol tekshiruvi bilan)
* `PUT /users/:id` — Xodim ma'lumotlarini tahrirlash
* `DELETE /users/:id` — Xodimni o'chirish (agar zimmasida faol jihoz bo'lmasa)
* `GET /users/:id/assignments` — Xodim zimmisidagi barcha jihozlar
* `PATCH /users/:id/status` — Xodimni bloklash / faollashtirish
* `GET /users/offboarding/pending` — Bo'shash jarayonidagi xodimlar
* `POST /users/:id/offboarding/start` — Ishdan bo'shatish jarayonini boshlash
* `POST /users/:id/offboarding/warehouse-approve` — Omborchi jihozlarni qabul qilib imzolashi
* `POST /users/:id/offboarding/complete` — Ishdan bo'shatishni yakunlash
* `GET /users/:id/offboarding/akt` — Bo'shash dalolatnomasini (PDF) yuklab olish

### 8.3. Departments Moduli (`/departments`)
* `GET /departments` — Bo'limlar ro'yxati
* `GET /departments/export` — Bo'limlarni Excelga eksport qilish
* `GET /departments/:id` — Bo'lim tafsilotlari
* `GET /departments/:id/stats` — Bo'lim yuklamasi statistikasi
* `POST /departments` — Yangi bo'lim qo'shish
* `PUT /departments/:id` — Bo'limni tahrirlash
* `DELETE /departments/:id` — Bo'limni o'chirish (agar xodimlari yoki jihozlari bo'lmasa)

### 8.4. Products Moduli (`/products`)
* `GET /products` — Mahsulotlar katalogi
* `GET /products/:id` — Bitta tovar ma'lumotlari va inventar raqamlari
* `PUT /products/:id` — Tovarni tahrirlash
* `DELETE /products/:id` — Tovarni o'chirish (omborda qoldig'i bo'lmasa)

### 8.5. Inventory Moduli (`/inventory`)
* `GET /inventory` — Ombor zaxiralari qoldiqlari
* `GET /inventory/export` — Zaxiralarni Excelga eksport qilish
* `POST /inventory/bulk-stock-in` — Ommaviy Excel fayli orqali kirim qilish
* `PUT /inventory/:id/min-level` — Minimal xavfli miqdor chegarasini belgilash

### 8.6. Operations Moduli (`/operations`)
* `POST /operations/stock-in` — Omborga tovar kirim qilish
* `POST /operations/give-to-user` — Xodimga jihoz biriktirish (`PENDING`)
* `POST /operations/return-from-user` — Xodimdan jihozni qaytarib olish
* `POST /operations/transfer-user` — Jihozni bir xodimdan boshqasiga o'tkazish
* `POST /operations/give-to-dept` — Bo'limga sarflanadigan material berish
* `POST /operations/return-from-dept` — Bo'limdan materialni omborga qaytarish
* `POST /operations/assign-to-dept` — Bo'limga umumiy foydalanish uchun jihoz biriktirish
* `POST /operations/write-off` — Yaroqsiz tovarlarni hisobdan chiqarish
* `GET /operations/:id/pdf` — Har qanday operatsiya uchun rasmiy Qabul-Topshirish Dalolatnomasini (PDF) olish

### 8.7. Requests Moduli (`/requests`)
* `GET /requests/my` — Xodimga biriktirilgan va tasdiqlanishi kutilayotgan jihozlar
* `POST /requests/:id/accept` — Jihozni qabul qilishni tasdiqlash
* `POST /requests/:id/reject` — Jihozni qabul qilishni rad etish (sababi bilan)

### 8.8. Deletion Requests Moduli (`/deletion-requests`)
* `GET /deletion-requests` — O'chirish so'rovlari ro'yxati
* `POST /deletion-requests` — Yangi o'chirish so'rovi yuborish
* `POST /deletion-requests/:id/review` — So'rovni ko'rib chiqish (`APPROVED` yoki `REJECTED`)

### 8.9. Organizations Moduli (`/organizations`)
* `GET /organizations` — Tashkilotlar ro'yxati va iyerarxiyasi
* `POST /organizations` — Yangi quyi tashkilot qo'shish
* `PUT /organizations/:id` — Tashkilotni tahrirlash

### 8.10. History, Audit va Stats Modullari
* `GET /history` — Operatsiyalar tarixi arxivi
* `GET /history/export` — Tarixni Excel / CSV eksport qilish
* `GET /audit` — Xavfsizlik auditi jurnali
* `GET /stats/overview` — Dashboard statistikasi
* `GET /stats/monthly` — Oylik harakatlar dinamikasi

---

## 🔒 9. XAVFSIZLIK VA KIBER-HIMOYA MEXANIZMLARI

1. **Token Mutex & Rotation (O(1) Token Rotation):**
   * Har bir login sessiyasi uchun unikal RefreshToken bazada saqlanadi. Token yangilanganda eskisining muddati darhol bekor qilinadi.
   * Agar foydalanuvchi bloklansa, uning barcha tokenlari 1 soniyada bekor qilinadi.
2. **Null-Byte Injection & Fuzzing Himoyasi:**
   * PostgreSQL va Node.js o'rtasida ma'lumotlar almashinuvida `\0` (null-byte) hujumlari global sanitization filtri orqali to'liq tozalanadi.
3. **DDoS & Brute-Force Himoyasi (`Throttler`):**
   * Har bir IP-manzil uchun so'rovlar chegarasi o'rnatilgan (Login urinishlari cheklangan).
4. **HTTP Xavfsizlik Sarlavhalari (`Helmet`):**
   * XSS, Clickjacking, MIME-sniffing hujumlarining oldi olingan.
5. **Parollar Kriptografiyasi:**
   * Barcha parollar `bcrypt` (10 rounds tuzlash) orqali saqlanadi.

---

## 💻 10. MAHALLIY O'RNATISH VA ISHGA TUSHIRISH (LOCAL SETUP)

### Talablar:
* **Node.js:** v20.x yoki v22.x
* **PostgreSQL:** v14 yoki undan yuqori
* **Git**

### 1-qadam: Repozitoriyani yuklab olish
```bash
git clone https://github.com/ahmadillohasanov099-max/wms-platform.git
cd wms-platform
```

### 2-qadam: Backendni sozlash va ishga tushirish
```bash
cd back
npm install

# .env faylini yarating
cp .env.example .env
```

`back/.env` faylini o'zingizning PostgreSQL bazangizga moslang:
```env
PORT=4000
NODE_ENV=development
DATABASE_URL="postgresql://postgres:parol@localhost:5432/wms_db?schema=public"
JWT_SECRET="super-secret-jwt-key-wms-2026"
JWT_EXPIRES_IN="1d"
CORS_ORIGIN="http://localhost:5173"
```

Baza jadvallarini yaratish va boshlang'ich Super Admin ma'lumotlarini yuklash:
```bash
npx prisma generate
npx prisma db push
npm run prisma:seed
```

Backendni ishlab chiqish rejimida ishga tushirish:
```bash
npm run dev
```
> Backend API: `http://localhost:4000/api/v1`  
> Swagger Hujjatlari: `http://localhost:4000/docs`

### 3-qadam: Frontendni sozlash va ishga tushirish
Yangi terminalda:
```bash
cd front
npm install

# .env faylini tekshiring (agar yo'q bo'lsa yarating)
# VITE_API_URL=http://localhost:4000/api/v1

npm run dev
```
> Frontend interfeysi: `http://localhost:5173`

---

## 🔑 Dastlabki Kirish Ma'lumotlari (Default Seed Credentials)

Tizim o'rnatilgandan so'ng quyidagi hisoblar orqali darhol kirishingiz mumkin:

| Foydalanuvchi | Login | Parol | Roli |
|---|---|---|---|
| **Bosh Administrator** | `ahmadillohasanov099@gmail.com` | `333053334aa` | `SUPER_ADMIN` |
| **Qulay Test Admin** | `superadmin` | `test12345` | `SUPER_ADMIN` |

---

## 🌐 11. VAQTINCHALIK PREZENTATSIYA VA SERVERGA O'RNATISH (DEPLOYMENT)

### Variant 1: O'z kompyuteringizdan tezkor Taqdimot (Cloudflare Tunnel)
Agar server sotib olmasdan noutbukingizdagi loyihani masofadan ko'rsatmoqchi bo'lsangiz:
1. `cloudflared` dasturini yuklab oling.
2. Backend va Frontendni yoqing.
3. Terminalda quyidagi buyruqni bering:
   ```bash
   cloudflared tunnel --url http://localhost:5173
   ```
4. Sizga berilgan bepul vaqtinchalik `https://xxx.trycloudflare.com` havolasini mijozga yoki taqdimotga berishingiz mumkin!

### Variant 2: Docker Compose orqali ishga tushirish (1 buyruq bilan)
`back` papkasida:
```bash
docker-compose up -d --build
```
Bu buyruq PostgreSQL va Backend konteynerlarini avtomatik ko'taradi.

### Variant 3: Haqiqiy Linux VPS (Ubuntu) Serverga O'rnatish
1. Serverda Node.js, PostgreSQL va Nginx o'rnating.
2. Backendni PM2 klaster rejimida ishga tushiring:
   ```bash
   cd /var/www/wms-platform/back
   npm run build
   pm2 start ecosystem.config.js
   pm2 save
   ```
3. Frontendni build qilib Nginx ga yo'naltiring:
   ```bash
   cd /var/www/wms-platform/front
   npm run build
   # Chiqqan dist/ papkasi Nginx root papkasi sifatida ko'rsatiladi
   ```
4. Bepul Let's Encrypt SSL sertifikatini o'rnating:
   ```bash
   sudo certbot --nginx -d sizning-domeningiz.uz
   ```

---

## ⚡ 12. FOYDALI BUYRUQLAR VA SKRIPTLAR

### Backend buyruqlari:
* `npm run build` — TypeScript kodini ishlab chiqarish uchun kompilyatsiya qilish (`dist/`)
* `npm run dev` — Ishlab chiqish rejimida jonli kuzatuv bilan ishga tushirish
* `npm run start:prod` — Kompilyatsiya qilingan loyihani ishga tushirish
* `npx prisma studio` — Ma'lumotlar bazasini brauzerda vizual ko'rish va tahrirlash
* `npx prisma db push` — Prisma sxemasidagi o'zgarishlarni bazaga qo'llash

### Frontend buyruqlari:
* `npm run dev` — Vite dev-serverni ishga tushirish
* `npm run build` — Loyihani to'liq tekshirish va production to'plamini yig'ish (`dist/`)
* `npm run preview` — Yig'ilgan `dist/` to'plamini lokal tekshirib ko'rish

---

## 📄 Litsenziya va Mualliflik Huquqi
Mazkur loyiha **O'zbekiston Respublikasi Qurilish va Uy-Joy Kommunal Xo'jaligi Vazirligi** va uning quyi tizimlari uchun maxsus arxitektura asosida yaratilgan. Barcha mualliflik huquqlari himoyalangan.
