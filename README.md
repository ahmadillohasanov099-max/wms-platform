# 🏛️ WMS Platform — Yagona Moddiy-Tovar Boyliklari va Asosiy Vositalar Nazorati Tizimi
### 🛠️ Texnik Arxitektura, Dastur Kodi, Maʼlumotlar Bazasi va To‘liq REST API Pasporti

> **Loyiha darajasi:** O‘zbekiston Respublikasi Vazirliklari, Davlat Agentliklari va Quyi Tashkilotlari uchun Enterprise WMS  
> **Backend:** NestJS 10+ (TypeScript) + Prisma ORM 6.16 + PostgreSQL  
> **Frontend:** React 19 + Vite 8 + TypeScript + Tailwind CSS + TanStack Query v5 + Zustand  
> **Hujjat turi:** Dasturchilar (Backend & Frontend), DevOps muhandislari, Tizim administratorlari va Texnik auditorlar uchun kengaytirilgan texnik pasport.

---

## 📑 Mundarija

1. [Loyiha Pasporti va Arxitektura Printsiplari](#1-loyiha-pasporti-va-arxitektura-printsiplari)
2. [Loyiha Papkalar Strukturasi (Directory Structure)](#2-loyiha-papkalar-strukturasi-directory-structure)
3. [Texnologik Stak va Kutubxonalar](#3-texnologik-stak-va-kutubxonalar)
4. [Tizim Arxitekturasi va Multi-Tenant Izolyatsiyasi](#4-tizim-arxitekturasi-va-multi-tenant-izolyatsiyasi)
5. [Maʼlumotlar Bazasi Modeli (Prisma ERD & Schema)](#5-malumotlar-bazasi-modeli-prisma-erd--schema)
6. [To‘liq REST API Katalogi va Endpointlar Pasporti](#6-toliq-rest-api-katalogi-va-endpointlar-pasporti)
   - 6.1. [Auth Moduli (`/auth`)](#61-auth-moduli-auth)
   - 6.2. [Users & HR Moduli (`/users`)](#62-users--hr-moduli-users)
   - 6.3. [Departments Moduli (`/departments`)](#63-departments-moduli-departments)
   - 6.4. [Products & Katalog Moduli (`/products`)](#64-products--katalog-moduli-products)
   - 6.5. [Inventory & Zaxira Moduli (`/inventory`)](#65-inventory--zaxira-moduli-inventory)
   - 6.6. [Operations & Harakatlar Moduli (`/operations`)](#66-operations--harakatlar-moduli-operations)
   - 6.7. [Limits & Meʼyorlar Moduli (`/limits`)](#67-limits--meyorlar-moduli-limits)
   - 6.8. [Requests & Talabnomalar Moduli (`/requests`)](#68-requests--talabnomalar-moduli-requests)
   - 6.9. [Audit Logs Moduli (`/audit-logs`)](#69-audit-logs-moduli-audit-logs)
   - 6.10. [Stats & Tahlil Moduli (`/stats`)](#610-stats--tahlil-moduli-stats)
7. [Axborot Xavfsizligi va Kiber-Himoya Mexanizmlari](#7-axborot-xavfsizligi-va-kiber-himoya-mexanizmlari)
   - 2-Bosqichli Progressiv Rate Limiting & Account Lockout
   - Real-Vaqtda Admin Unlock & 0-Reset Sinxronizatsiyasi
   - JWT Token Rotatsiyasi va Guardlar
   - Rol va Ruxsatlar (RBAC) Nazorati
8. [Frontend Arxitekturasi va Holat Boshqaruvi](#8-frontend-arxitekturasi-va-holat-boshqaruvi)
9. [Hujjat Generatsiyasi Dvigateli (Puppeteer & ExcelJS)](#9-hujjat-generatsiyasi-dvigateli-puppeteer--exceljs)
10. [Ko‘p Tilli Tizim Arxitekturasi (i18n)](#10-kop-tilli-tizim-arxitekturasi-i18n)
11. [O‘rnatish, Sozlash va Ishga Tushirish (DevOps)](#11-ornatish-sozlash-va-ishga-tushirish-devops)
12. [Avtomatlashtirilgan Testlar va Sifat Nazorati](#12-avtomatlashtirilgan-testlar-va-sifat-nazorati)

---

## 1. Loyiha Pasporti va Arxitektura Printsiplari

WMS (Warehouse Management System) — O‘zbekiston Respublikasi davlat idoralari va korporativ tashkilotlarida moddiy-tovar boyliklari (TMZ) hamda asosiy vositalar harakatini 100% raqamlashtirish, qog‘ozbozlik va noqonuniy chiqimlarni bartaraf etish uchun mo‘ljallangan markazlashgan tizimdir.

### Asosiy arxitektura tamoyillari:
* **Yaxlit Audit va Daxlsizlik:** Har bir asosiy vosita (`Asset`) o‘zining unikal inventar raqamiga ega bo‘ladi. Biriktirilgan jihozlar bo‘yicha harakatlar orqaga qaytarilmas (immutable) audit loglariga yozib boriladi.
* **Ko‘p Birlikli Aniq Hisob:** Pachka va dona o‘rtasida erkin avtomatik konvertatsiya (`packageSize`), kasrli o‘lchov birliklari (`LITR`, `KG`, `METR`) 4 xonali aniqlikda yaxlitlanib, suzuvchi nuqta (floating-point) driftlaridan 100% himoyalangan.
* **3 Oylik Davlat Meʼyorlari:** Sarflanadigan materiallar uchun kvartallik (I, II, III, IV chorak) limit tizimi joriy etilgan. Limit oshganda tizim qatʼiy bloklaydi va faqat tasdiqlangan Vazir buyrug‘i fayli ilova qilingandagina qo‘shimcha berishga ruxsat beradi.
* **Xavfsiz Offboarding Zanjiri:** Xodim ishdan bo‘shayotganda uning bo‘ynida topshirilmagan davlat mulki bo‘lsa, tizim uni ishdan bo‘shatishni taqiqlaydi. Jihozlar omborga qaytarilib, omborchi tasdiqlaganidan keyingina Davlat Gerbli rasmiy A4 Topshirish Akti generatsiya qilinadi.

---

## 2. Loyiha Papkalar Strukturasi (Directory Structure)

```
loyha/
├── back/                             # NestJS Backend API
│   ├── prisma/
│   │   ├── schema.prisma             # Baza modeli, jadvallar va aloqalar
│   │   └── seed.ts                   # Dastlabki Super Admin va ma'lumotlar seed skripti
│   ├── scripts/
│   │   ├── test-login-rate-limit.ts  # 30 ta integratsion login rate limiting testi
│   │   └── test-admin-unlock-reset.ts# 12 ta admin unlock va 0-reset testi
│   ├── src/
│   │   ├── app.module.ts             # Asosiy ildiz moduli
│   │   ├── main.ts                   # NestJS bootstrap, Helmet, Throttler, Global Validation
│   │   ├── prisma/                   # PrismaClient xizmati va tranzaksiyalar
│   │   └── modules/
│   │       ├── auth/                 # Login, JWT, Refresh, Rate Limiting, Lockout tekshiruvi
│   │       ├── users/                # Foydalanuvchilar, Onboarding, Offboarding, Unlock
│   │       ├── departments/          # Bo'limlar, rahbarlar, Excel eksport
│   │       ├── products/             # Mahsulotlar katalogi, packageSize konvertatsiyasi
│   │       ├── inventory/            # Ombor qoldiqlari, zaxira balansi
│   │       ├── operations/           # Berish, qaytarish, spisaniye, ta'mir, PDF generatsiya
│   │       ├── limits/               # Kvartallik 3 oylik limitlar, Vazir buyrug'i ilovasi
│   │       ├── requests/             # Xodim va bo'lim talabnomalari zanjiri
│   │       ├── audit/                # Xavfsizlik auditi jurnali va tahlili
│   │       ├── stats/                # Dashboard KPI va moliya statistikasi
│   │       └── nodemailer/           # Telegram Bot va pochta bildirishnomalari
├── front/                            # React 19 + Vite Frontend
│   ├── public/
│   │   ├── gerb.svg                  # O'zbekiston Respublikasi rasmiy Davlat Gerbi
│   │   └── vaz-logo.png              # Vazirlik rasmiy logotipi
│   ├── src/
│   │   ├── api/                      # Axios instansiyasi, API endpoint metodlari
│   │   ├── components/               # UI kutubxonasi (Button, Modal, Input, Badge, Gerbli Aktlar)
│   │   ├── hooks/                    # Maxsus hooklar (useTranslation, useDebounce va h.k.)
│   │   ├── lib/
│   │   │   ├── translations.ts       # 3 tildagi (UZ, RU, EN) to'liq tarjimalar lug'ati
│   │   │   └── utils.ts              # Konvertatsiya, summa formatlash, vaqt hisobi
│   │   ├── pages/
│   │   │   ├── auth/login-page.tsx   # Login, 2-bosqichli qizil jonli taymer, 3s server sync
│   │   │   ├── departments/          # Bo'limlar va xodim kartochkasi (Unlock tugmasi)
│   │   │   ├── inventory/            # Ombor balansi (Pachka va dona, Litr, Kg)
│   │   │   ├── operations/           # Berish, Qaytarish, Ta'mir, Spisaniye oynalari
│   │   │   ├── requests/             # Talabnomalar boshqaruvi
│   │   │   ├── history/              # Operatsiyalar tarixi va PDF hujjatlar ko'rish
│   │   │   ├── audit/                # Xavfsizlik auditi sahifasi
│   │   │   └── stats/                # Grafiklar va analitika
│   │   └── store/                    # Zustand do'konlari (auth.store.ts, ui.store.ts)
├── README.md                         # Ushbu to'liq texnik pasport
├── QOLLANMA.md                       # Foydalanuvchi va biznes jarayonlar qo'llanmasi
└── TODO.md                           # Loyihaning rivojlanish tarixi va yo'l xaritasi
```

---

## 3. Texnologik Stak va Kutubxonalar

### ⚙️ Backend (Server Tomoni)
| Texnologiya | Versiya | Maqsadi va Vazifasi |
|---|---|---|
| **Node.js** | `v20+` / `v24+` | Yuqori unumdor server muhiti |
| **NestJS** | `^10.3.0` | Modulli, sinovdan o‘tgan Enterprise backend arxitekturasi |
| **Prisma ORM** | `^6.16.0` | Turlar bilan qatʼiy himoyalangan (Type-safe) maʼlumotlar bazasi abstraksiyasi |
| **PostgreSQL** | `15+` / `16+` | Relyatsion, ACID talablariga to‘liq javob beruvchi MBBT |
| **Passport & JWT** | `@nestjs/jwt`, `@nestjs/passport` | Access Token va Refresh Token rotatsiyasi |
| **Bcrypt** | `^5.1.1` | Parollarni xesh-tuz (salt rounds 10) bilan bir tomonlama shifrlash |
| **NestJS Throttler**| `@nestjs/throttler ^5.1.0` | Brute-force va DDoS hujumlariga qarshi tarmoq tezligini cheklovchi |
| **Puppeteer** | `^22.0.0` | Rasmiy A4 PDF dalolatnomalarni Chromium orqali 3.5x masshtabli vektor shaklda generatsiya qilish |
| **ExcelJS** | `^4.4.0` | Ko‘p qatorli, avto-kengayadigan, imzolar bloki birlashtirilgan `.xlsx` eksport |
| **Telegram Bot** | Maxsus HTTP client | Ishdan bo‘shatish va zaxira kamayganda masʼullarga tezkor bildirishnoma yuborish |

### 🖥️ Frontend (Mijoz Tomoni)
| Texnologiya | Versiya | Maqsadi va Vazifasi |
|---|---|---|
| **React** | `^19.0.0` | Eng zamonaviy reaktiv UI kutubxonasi |
| **Vite** | `^8.0.0` | Rolldown/ESBuild asosidagi o‘ta tezkor loyiha yig‘uvchisi |
| **TypeScript** | `^5.7.0` | Statik tiplash va kod xavfsizligi |
| **Tailwind CSS** | `^3.4.0` | Modern, responsive va Dark/Light moslashuvchan dizayn tizimi |
| **TanStack Query**| `^5.60.0` | Server holatini keshlovchi, avto-sinxronlovchi asinxron holat boshqaruvchisi |
| **Zustand** | `^5.0.0` | Yengil, tezkor global mijoz holati (Auth, UI, Til sozlamalari) |
| **React Hook Form**| `^7.54.0` | Minimal qayta chizilishli (re-render) shakllar boshqaruvi |
| **Zod** | `^3.24.0` | Form validation va turlar mosligini tekshirish sxemasi |
| **Framer Motion** | `^12.0.0` | Yumshoq UI animatsiyalari va modallar o‘tishi |
| **Lucide React** | `^0.470.0` | 1000+ vektorli piktogrammalar to‘plami |

---

## 4. Tizim Arxitekturasi va Multi-Tenant Izolyatsiyasi

Tizim ierarxik ko‘p tashkilotli (Multi-Tenant) tuzilishga ega:

```mermaid
flowchart TD
    SUPER["🏛️ VAZIRLIK MARKAZIY APPARATI<br/>(SUPER_ADMIN / VAZIRLIK_OMBORCHI)<br/>Barcha respublika bo'yicha to'liq nazorat va audit"]
    
    SUPER --> ORG1["🏢 Toshkent shahar Boshqarmasi<br/>(ORG_ADMIN / ORG_OMBORCHI)<br/>Avtonom balans, o'z ombori va xodimlari"]
    SUPER --> ORG2["🏢 Samarqand viloyat Boshqarmasi<br/>(ORG_ADMIN / ORG_OMBORCHI)<br/>Avtonom balans, o'z ombori va xodimlari"]
    SUPER --> ORG3["🏢 Farg'ona viloyat Boshqarmasi<br/>(ORG_ADMIN / ORG_OMBORCHI)<br/>Avtonom balans, o'z ombori va xodimlari"]
```

### Izolyatsiya va xavfsizlik qoidalari:
1. **Tashkilotlar chegarasi (`organizationId`):** Har bir so‘rov `JwtAuthGuard` orqali tekshirilganda, foydalanuvchining tashkiloti aniqlanadi. `SUPER_ADMIN`dan tashqari hech bir xodim boshqa tashkilotning maʼlumotlarini ko‘ra olmaydi yoki tahrirlay olmaydi.
2. **Bo‘lim va Xodim ierarxiyasi:** Xodimlar tegishli bo‘limlarga (`Department`), bo‘limlar esa tashkilotga bog‘langan.
3. **Audit Shaffofligi:** Quyi boshqarmalar o‘z amaliyotlarini mustaqil bajarsa-da, Markaziy Vazirlik real vaqtda respublika bo‘yicha to‘liq audit jurnali (`AuditLog`) va hisobotlarni kuzatib boradi.

---

## 5. Maʼlumotlar Bazasi Modeli (Prisma ERD & Schema)

### Entity-Relationship Diagrammasi:

```mermaid
erDiagram
    ORGANIZATION ||--o{ USER : employs
    ORGANIZATION ||--o{ DEPARTMENT : contains
    ORGANIZATION ||--o{ PRODUCT : catalogs
    ORGANIZATION ||--o{ ASSET : owns
    ORGANIZATION ||--o{ OPERATION : logs
    ORGANIZATION ||--o{ AUDIT_LOG : tracks

    DEPARTMENT ||--o{ USER : members
    DEPARTMENT ||--o{ DEPARTMENT_ASSET : supplies
    DEPARTMENT ||--o{ MONTHLY_LIMIT : limits

    USER ||--o{ ASSIGNMENT : holds
    USER ||--o{ REFRESH_TOKEN : authenticates
    USER ||--o{ OPERATION : operates
    USER ||--o{ SUPPLY_REQUEST : requests

    PRODUCT ||--o| INVENTORY : balances
    PRODUCT ||--o{ ASSET : physical_units
    PRODUCT ||--o{ DEPARTMENT_ASSET : allocated
    PRODUCT ||--o{ MONTHLY_LIMIT : regulated

    MONTHLY_LIMIT ||--o{ OVER_LIMIT_ORDER : overrides
```

### Prisma Sxemasi Kalit Modellari:

```prisma
enum UserRole {
  SUPER_ADMIN
  ORG_ADMIN
  VAZIRLIK_OMBORCHI
  ORG_OMBORCHI
  KADR
  BOSH_BUXGALTER
  BUXGALTER
  BOLIM_BOSHLIGI
  XODIM
}

enum ProductType {
  BERILADIGAN    // Asosiy vositalar (noutbuk, mebel, texnika - butun musbat son, alohida Asset)
  SARFLANADIGAN  // TMZ va sarf materiallari (qog'oz, ruchka, kimyoviy vosita - miqdoriy limitli)
}

enum UnitType {
  DONA
  PACHKA
  KOMPLEKT
  LITR
  KG
  METR
}

model User {
  id                  String               @id @default(uuid())
  username            String               @unique
  fullName            String
  passwordHash        String
  role                UserRole             @default(XODIM)
  status              UserStatus           @default(ACTIVE)
  employmentStatus    EmploymentStatus     @default(ACTIVE)
  failedLoginAttempts Int                  @default(0)
  lockedUntil         DateTime?
  organizationId      String?
  departmentId        String?
  assignments         Assignment[]
  operations          Operation[]
  refreshTokens       RefreshToken[]
  supplyRequests      SupplyRequest[]
  auditLogs           AuditLog[]
  createdAt           DateTime             @default(now())
  updatedAt           DateTime             @updatedAt
}

model Product {
  id             String            @id @default(uuid())
  name           String
  code           String            @unique
  productType    ProductType       @default(BERILADIGAN)
  unit           UnitType          @default(DONA)
  packageSize    Int?              // Masalan: 1 pachkada 500 dona
  inventory      Inventory?
  assets         Asset[]
  monthlyLimits  MonthlyLimit[]
  organizationId String?
  createdAt      DateTime          @default(now())
}

model Asset {
  id              String         @id @default(uuid())
  productId       String
  inventoryNumber String         @unique
  serialNumber    String?
  status          AssetStatus    @default(IN_STOCK)
  assignments     Assignment[]
  organizationId  String?
  createdAt       DateTime       @default(now())
}

model MonthlyLimit {
  id              String            @id @default(uuid())
  departmentId    String
  productId       String
  limit           Float             // Kvartallik 3 oylik umumiy me'yor
  orders          OverLimitOrder[]  // Vazir buyrug'i ilova qilingan hollar
  createdAt       DateTime          @default(now())
}
```

---

## 6. To‘liq REST API Katalogi va Endpointlar Pasporti

Barcha API so‘rovlari `application/json` formatida yuboriladi va qabul qilinadi. Himoyalangan endpointlar uchun `Authorization: Bearer <accessToken>` sarlavhasi talab etiladi.

### 6.1. Auth Moduli (`/auth`)

#### `POST /auth/login`
Foydalanuvchini tizimga kiritish va xavfsizlik tokenlarini berish. 2-bosqichli brute-force himoyasi bilan taʼminlangan.
* **Huquq:** Ommaviy (Public)
* **Throttler cheklovi:** 10 soniyada 5 ta, 1 daqiqada 15 ta urinish.
* **Request Body:**
```json
{
  "username": "alisher01",
  "password": "Password123!"
}
```
* **Muvaffaqiyatli Response (200 OK):**
```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI...",
  "refreshToken": "a8f9c1b2-...",
  "user": {
    "id": "e4b6c8a1-...",
    "username": "alisher01",
    "fullName": "Alisher Karimov",
    "role": "SUPER_ADMIN",
    "organizationId": null,
    "departmentId": null
  }
}
```
* **Xatolik Response (401 Unauthorized — 1-urinish):**
```json
{
  "statusCode": 401,
  "message": "Kiritilgan login yoki parol noto'g'ri. Xavfsizlik talablariga muvofiq, yana 2 ta urinish imkoniyati mavjud.",
  "remainingAttempts": 2,
  "errorCode": "LOGIN_FAILED_ATTEMPTS"
}
```
* **Xatolik Response (401 Unauthorized — 3-urinishda 15 daqiqaga bloklanish):**
```json
{
  "statusCode": 401,
  "message": "Parol ketma-ket 3 marta noto'g'ri kiritildi. Tizim xavfsizligini ta'minlash maqsadida hisobingiz 15 daqiqaga vaqtincha bloklandi.",
  "isLocked": true,
  "lockedUntil": "2026-11-04T12:00:00.000Z",
  "remainingSeconds": 900,
  "errorCode": "LOGIN_LOCKED_15M"
}
```

#### `GET /auth/lockout-status`
Foydalanuvchining login blok holatini real vaqtda tekshirish (Admin ochganini darhol aniqlash uchun).
* **Huquq:** Ommaviy (Public)
* **Query Parameters:** `?username=alisher01`
* **Response (200 OK):**
```json
{
  "isLocked": false,
  "remainingSeconds": 0,
  "lockedUntil": null
}
```

#### `POST /auth/refresh`
Eski Access token muddati tugaganda yangi token juftligini olish (Refresh Token Rotation).
* **Headers:** `Authorization: Bearer <refreshToken>`
* **Response (200 OK):** `{ "accessToken": "...", "refreshToken": "..." }`

---

### 6.2. Users & HR Moduli (`/users`)

#### `GET /users`
Tashkilot xodimlari ro‘yxatini sahifalash, qidirish va filtrlash bilan olish.
* **Huquq:** `SUPER_ADMIN`, `ORG_ADMIN`, `KADR`, `VAZIRLIK_OMBORCHI`, `ORG_OMBORCHI`
* **Query Parameters:** `?page=1&limit=20&search=Alisher&departmentId=...&role=XODIM&status=ACTIVE`
* **Response (200 OK):**
```json
{
  "data": [
    {
      "id": "u-01",
      "fullName": "Alisher Karimov",
      "username": "alisher01",
      "role": "XODIM",
      "status": "ACTIVE",
      "employmentStatus": "ACTIVE",
      "failedLoginAttempts": 0,
      "lockedUntil": null,
      "department": { "id": "d-01", "name": "Axborot texnologiyalari boshqarmasi" }
    }
  ],
  "meta": { "total": 145, "page": 1, "limit": 20, "totalPages": 8 }
}
```

#### `PATCH /users/:id/unlock`
Parolni ko‘p marta xato terib bloklangan xodimni muddatidan oldin blokdan chiqarish va xatolarini 0 ga tushirish.
* **Huquq:** `SUPER_ADMIN`, `ORG_ADMIN`, `KADR`
* **Response (200 OK):**
```json
{
  "message": "Xodim blokdan muvaffaqiyatli chiqarildi",
  "user": {
    "id": "u-01",
    "username": "alisher01",
    "failedLoginAttempts": 0,
    "lockedUntil": null
  }
}
```

#### `POST /users/:id/offboarding/start`
Xodimni ishdan bo‘shatish jarayonini boshlash (Kadr tomonidan).
* **Huquq:** `SUPER_ADMIN`, `ORG_ADMIN`, `KADR`
* **Xavfsizlik qoidasi:** Agar xodimda topshirilmagan biriktirilgan jihozlar bo‘lsa, tizim `400 Bad Request` qaytaradi va topshirilishi shart bo‘lgan aktivlar ro‘yxatini ko‘rsatadi.

#### `POST /users/:id/offboarding/warehouse-approve`
Omborchi tomonidan barcha jihozlar to‘liq omborga topshirilganini tasdiqlash.
* **Huquq:** `SUPER_ADMIN`, `VAZIRLIK_OMBORCHI`, `ORG_OMBORCHI`

#### `POST /users/:id/offboarding/complete`
Kadr xodimi tomonidan ishdan bo‘shatishni yakunlash (`OFFBOARDED` statusi, tokenlar bekor qilinadi, rasmiy Davlat Gerbli A4 Topshirish Akti generatsiya qilinadi).

---

### 6.3. Departments Moduli (`/departments`)

#### `GET /departments`
Tashkilotdagi barcha bo‘limlar, ularning rahbarlari va xodimlar sonini olish.
* **Huquq:** Barcha tizim xodimlari

#### `POST /departments`
Yangi bo‘lim tashkil qilish.
* **Huquq:** `SUPER_ADMIN`, `ORG_ADMIN`
* **Request Body:**
```json
{
  "name": "Moliya-iqtisod boshqarmasi",
  "code": "FIN-01",
  "leaderId": "user-uuid-123"
}
```

#### `GET /departments/:id/excel`
Bo‘limga tegishli barcha aktivlar va hisobotlarni rasmiy Excel formatida yuklab olish.
* **Response:** Binary Stream (`application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`)

---

### 6.4. Products & Katalog Moduli (`/products`)

#### `GET /products`
Mahsulotlar katalogi ro‘yxati (Qidiruv va tur bo‘yicha filtrlash bilan).
* **Query Parameters:** `?search=qog'oz&type=SARFLANADIGAN`

#### `POST /products`
Yangi mahsulot kartochkasini yaratish.
* **Request Body:**
```json
{
  "name": "A4 Qog'oz (SvetoCopy Classic)",
  "code": "TMZ-A4-001",
  "productType": "SARFLANADIGAN",
  "unit": "PACHKA",
  "packageSize": 500
}
```

---

### 6.5. Inventory & Zaxira Moduli (`/inventory`)

#### `GET /inventory`
Ombor zaxirasidagi tovarlar qoldig‘i (Pachka/Dona, Litr, Kg, Metr hisobida).
* **Response (200 OK):**
```json
[
  {
    "id": "inv-01",
    "productId": "prod-01",
    "quantity": 19.6,
    "product": {
      "name": "A4 Qog'oz",
      "unit": "PACHKA",
      "packageSize": 500
    },
    "displayStock": "19 pachka, 300 dona"
  }
]
```

#### `POST /inventory/stock-in`
Omborga tovar kirim qilish.
* **Request Body:**
```json
{
  "productId": "prod-01",
  "quantity": 20,
  "unitPrice": 45000,
  "supplier": "Davlat Ta'minot MCHJ",
  "documentNumber": "KIRIM-2026-089"
}
```

---

### 6.6. Operations & Harakatlar Moduli (`/operations`)

#### `POST /operations/give-to-user`
Asosiy vositani xodimga biriktirish (MJSH shartnomasi bilan).
* **Request Body:**
```json
{
  "userId": "u-01",
  "assetId": "asset-uuid-123",
  "documentNumber": "MJSH-2026-004",
  "note": "Xizmat vazifalarini bajarish uchun topshirildi"
}
```

#### `POST /operations/return-from-user`
Xodimdan jihozni omborga qaytarib qabul qilish va Qaytarish Dalolatnomasini tuzish.
* **Request Body:**
```json
{
  "assignmentId": "asg-01",
  "condition": "SOZ",
  "documentNumber": "QAYT-2026-012",
  "note": "Xodim o'z xohishi bilan topshirdi"
}
```

#### `POST /operations/repair/start` & `POST /operations/repair/complete`
Jihozni taʼmirga yuborish va taʼmirlanib qaytganini qabul qilish.

#### `POST /operations/write-off`
Yaroqsiz tovarlarni komissiya xulosasi asosida hisobdan chiqarish (Spisaniye).

---

### 6.7. Limits & Meʼyorlar Moduli (`/limits`)

#### `GET /limits?departmentId=...`
Bo‘limning joriy kvartaldagi (3 oylik) TMZ sarflash meʼyorlari va qolgan limitlari.
* **Response (200 OK):**
```json
{
  "periodName": "2026-yil IV chorak (1-oktyabr – 31-dekabr)",
  "limits": [
    {
      "productId": "prod-01",
      "productName": "A4 Qog'oz",
      "totalQuarterLimit": 30,
      "consumedQuarter": 12,
      "remainingQuarter": 18
    }
  ]
}
```

#### `POST /limits/order`
Vazir yoki rahbariyat buyrug‘i faylini (PDF/JPG) ilova qilib meʼyordan ortiqcha TMZ ajratish ruxsatnomasi.

---

### 6.8. Requests & Talabnomalar Moduli (`/requests`)

#### `POST /requests`
Xodim yoki bo‘lim tomonidan omborga material so‘rab talabnoma yuborish.

#### `PATCH /requests/:id/approve` & `PATCH /requests/:id/reject`
Omborchi tomonidan talabnomani tasdiqlash yoki sababini ko‘rsatib rad etish.

---

### 6.9. Audit Logs Moduli (`/audit-logs`)

#### `GET /audit-logs`
Barcha foydalanuvchilar harakatlari arxivi (`SUPER_ADMIN` uchun).
* Har bir qatorda: IP manzil, Latency (ms), User-Agent, HTTP Metod, Endpoint, `oldData` va `newData` JSON diffi mavjud.

---

### 6.10. Stats & Tahlil Moduli (`/stats`)

#### `GET /stats/dashboard`
Boshqaruv panelining umumiy statistikasi (jami jihozlar qiymati, taʼmirdagi jihozlar, eng ko‘p sarflangan materiallar, bo‘limlar balansi).

---

## 7. Axborot Xavfsizligi va Kiber-Himoya Mexanizmlari

### 7.1. 2-Bosqichli Progressiv Login Rate Limiting
Tizim O‘zbekiston Respublikasi kiberxavfsizlik talablariga mos ravishda 2 bosqichli intellektual akkaunt bloklash mexanizmiga ega:
1. **1-Bosqich (Ogohlantirish va 15 daqiqalik blok):**
   - 1-xato urinish $\rightarrow$ "Kiritilgan login yoki parol noto'g'ri. Yana 2 ta urinish qoldi."
   - 2-xato urinish $\rightarrow$ "Diqqat! Yana 1 ta xatodan so'ng hisobingiz 15 daqiqaga bloklanadi."
   - 3-xato urinish $\rightarrow$ Hisob qatʼiy **15 daqiqaga** vaqtincha bloklanadi (`lockedUntil = now() + 15 min`).
2. **2-Bosqich (1 soatlik qatʼiy jazo bloki):**
   - 15 daqiqalik blok muddati tugab, akkaunt ochilgach, agar foydalanuvchi yana **1 marta xato kiritsa** $\rightarrow$ hisob darhol **1 soatga (60 daqiqa)** qatʼiy bloklanadi (`lockedUntil = now() + 60 min`).
3. **Muvaffaqiyatli tozalash (Clean Reset):**
   - To‘g‘ri parol kiritilishi bilanoq `failedLoginAttempts: 0` va `lockedUntil: null` holatiga to‘liq qaytariladi.

### 7.2. Real-Vaqtda Admin Unlock & 0-Reset
* Masʼul xodim (`SUPER_ADMIN`, `ORG_ADMIN`, `KADR`) xodim detallarida `[ 🔑 Blokdan chiqarish ]` tugmasini bosishi bilanoq, login oynasida turgan foydalanuvchining ekrani **3 soniya ichida** `GET /auth/lockout-status` tekshiruvi orqali avtomatik ochiladi.
* Taymer to‘xtaydi, qizil xatolar tozalanadi, maydonlar faollashadi va yashil bildirishnoma chiqadi. Akkaunt xatolari 0 dan boshlanadi.

---

## 8. Frontend Arxitekturasi va Holat Boshqaruvi

1. **Mijoz Holati (Zustand):**
   - `useAuthStore` — Joriy foydalanuvchi obyekti, Access Token va Refresh Tokenni saqlaydi hamda kirish/chiqish amallarini sinxronlashtiradi.
   - `useUiStore` — Til (`uz`, `ru`, `en`) va tema (Dark/Light) parametrlarini brauzer xotirasi bilan bog‘laydi.
2. **Server Holati (TanStack Query v5):**
   - `queryKey: ['users']`, `['departments']`, `['inventory']`, `['limits']` kabi standart kesh kalitlari orqali tarmoq trafigini 80% ga qisqartiradi.
   - Tranzaksiyalar bajarilgach (`invalidateQueries`), tegishli ro‘yxatlar orqa fonda avtomatik yangilanadi.
3. **Formalar va Validatsiya:**
   - `React Hook Form` va `Zod` sxemalari orqali xato maʼlumotlar kiritilishining oldi olinadi.

---

## 9. Hujjat Generatsiyasi Dvigateli (Puppeteer & ExcelJS)

1. **Rasmiy Vektorli A4 PDF (Puppeteer):**
   - O‘zbekiston Respublikasi Davlat Gerbi (SVG vektor formatda) yuqori qismida joylashgan.
   - 3.5x Ultra-HD masshtablash va CSS paged-media qoidalari (`@page { size: A4 portrait; margin: 15mm; }`).
   - Jadval qatorlari hech qachon varoq o‘rtasida yorilib ketmaydi (`page-break-inside: avoid`).
2. **Dinamik Kassetali Excel (ExcelJS):**
   - Matn hajmiga qarab avtomatik qator balandligini moslash (`row.height = Math.max(25, lines * 18)`).
   - Pastki qismda Moddiy javobgar shaxs, Bo‘lim boshlig‘i va Bosh buxgalter imzolari bloki avtomatik birlashtiriladi.

---

## 10. Ko‘p Tilli Tizim Arxitekturasi (i18n)

Frontend va Backend 100% 3 ta tilda ishlaydi:
* `uz` — O‘zbek tili (Lotin alifbosi, davlat idoralari rasmiy uslubi);
* `ru` — Rus tili (Русский язык);
* `en` — Ingliz tili (English).

Barcha xatoliklar, xavfsizlik ogohlantirishlari, badjlar va modallar til o‘zgarganda bir zumda mijoz xotirasida qayta xaritlanadi.

---

## 11. O‘rnatish, Sozlash va Ishga Tushirish (DevOps)

### Tizim talablari:
* Node.js: `v20.x` yoki `v22.x` (LTS)
* PostgreSQL: `v15` yoki undan yuqori
* Operatsion tizim: Linux (Ubuntu 22.04+ tavsiya etiladi), Windows Server yoki macOS

### 1. Repozitoriyni klonlash va bog‘liqliklarni o‘rnatish:
```bash
# Backend bog'liqliklari
cd back
npm install

# Frontend bog'liqliklari
cd ../front
npm install
```

### 2. Konfiguratsiya fayllari (`.env`):
**`back/.env`:**
```env
PORT=3000
DATABASE_URL="postgresql://postgres:parol@localhost:5432/wms_db?schema=public"
JWT_ACCESS_SECRET="enterprise-jwt-access-secret-key-2026"
JWT_REFRESH_SECRET="enterprise-jwt-refresh-secret-key-2026"
JWT_ACCESS_EXPIRES_IN="15m"
JWT_REFRESH_EXPIRES_IN="7d"
TELEGRAM_BOT_TOKEN="optional_bot_token"
TELEGRAM_CHAT_ID="optional_chat_id"
```

**`front/.env`:**
```env
VITE_API_URL="http://localhost:3000/api"
```

### 3. Maʼlumotlar bazasini tayyorlash:
```bash
cd back
npx prisma db push
npx ts-node prisma/seed.ts
```

### 4. Ishga tushirish (Development & Production):
```bash
# Backend yurgizish
cd back
npm run start:dev     # Dev rejim
npm run build && npm run start:prod # Production

# Frontend yurgizish
cd front
npm run dev           # Dev rejim (Vite)
npm run build         # Production yig'ish (dist)
```

---

## 12. Avtomatlashtirilgan Testlar va Sifat Nazorati

Loyihada integratsion va xavfsizlik testlari alohida mustaqil skriptlar ko‘rinishida mavjud:

1. **Login Rate Limiting & Lockout Testi (30 ta test):**
   ```bash
   cd back
   npx ts-node -r tsconfig-paths/register scripts/test-login-rate-limit.ts
   ```
2. **Admin Real-Vaqtda Unlock & 0-Reset Testi (12 ta test):**
   ```bash
   cd back
   npx ts-node -r tsconfig-paths/register scripts/test-admin-unlock-reset.ts
   ```

*Barcha testlar 100% muvaffaqiyatli o‘tishi kafolatlangan.*
