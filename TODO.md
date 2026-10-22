# 📋 Loyiha Rivojlantirish Rejasi va Bajariladigan Vazifalar

**Oxirgi yangilangan sana:** 2026-10-22  
**Loyiha:** WMS Platform (Vazirlik va Quyi Tashkilotlar Ombor Boshqaruv Tizimi)

---

## 🚀 ASOSIY AMALGA OSHIRILGAN YANGI BOSQICH:

### 🏛️ Choraklik (Kvartal / 3 oylik) TMZ Meʼyorlari Tizimi (Bajarildi ✅):
- [x] **Davlat va budjet standartlariga to'liq moslashtirildi:**
  - Oylik tor cheklov o'rniga, rasmiy kalendar choraklari (I, II, III, IV choraklar) bo'yicha 3 oylik limit tizimi joriy etildi.
  - Bo'lim yoki xodim 3 oy davomida xohlagan vaqtida (donada yoki pachkada) me'yor doirasida TMZ olishi mumkin.
  - Agar 3 oylik limit muddatidan oldin (masalan 1-2 oyda) tugasa, tizim avtomatik ravishda qolgan muddat davomida (yangi chorak 1-sanasigacha) TMZ berishni qat'iy bloklaydi.
  - Har chorak boshida (1-yanvar, 1-aprel, 1-iyul, 1-oktyabr) hisoblagichlar avtomatik 0 dan yangilanadi.
- [x] **Sanalar shaffofligi va ko'rgazmaliligi:**
  - `limitSetDate`: Me'yor belgilangan aniq sana ko'rsatiladi.
  - `nextResetDate`: Keyingi yangi chorak me'yori ochiladigan sana (masalan, `2027-yil 1-yanvar`) aniq aks etadi.
  - `periodName` & `periodRange`: Masalan, `2026-yil IV chorak (1-oktyabr – 31-dekabr)`.
- [x] **Minimal va professional Ogohlantirish modali (`OverLimitNoticeModal`):**
  - Ortiqcha ranglar va matnlar olib tashlandi, juda ixcham (`size="md"`), jiddiy davlat standarti ko'rinishiga keltirildi.
  - 4 ta asosiy katak: Choraklik me'yor (3 oylik), Chorakda olingan, Qolgan limit, So'ralayotgan miqdor.
  - Limitdan ortiqcha miqdor va rasmiy buyruq fayliga havola.
  - Berish modali yopilib, o'rniga markazda ushbu toza modal ochilishi ta'minlandi.
- [x] **Backend tozalash va yagona Super Admin seed:**
  - Barcha jadvallar 0 ga tushirildi, ortiqcha test ma'lumotlar tozalandi va faqat yagona Super Admin (`ahmadillohasanov099@gmail.com`) qoldirildi.

### 2. 🧪 Ombor o'lchov birliklarini to'liq test qilish (Bajarildi ✅):
- [x] **Pachka va dona konvertatsiyasini amalda testlash:**
  - Omborda 20 pachka A4 qog'oz (1 pachka = 500 dona) bo'lganda, xodimga 200 dona berilganda omborda qoldiq aynan **`19 pachka, 300 dona`** (`19.6 pachka`) qolishini amalda tekshirish (Avtomatik 23 ta testdan 100% muvaffaqiyatli o'tdi).
  - "Pachkada" va "Donalab" rejimlarida kiritish, real-vaqtda konvertatsiya qilinishi va bazaga 4 xonali aniqlikda to'g'ri yozilishini tekshirish.
- [x] **Kasrli o'lchov birliklarini testlash (`LITR`, `KG`, `METR`):**
  - Butun son bo'lmagan miqdorlar (masalan `3.6 litr`, `5.8 litr`, `0.75 kg`) bo'yicha omborga kirim qilish, xodimga berish, bo'limga berish, bo'limdan qaytarish va hisobdan chiqarish amallarini test qilish.
  - Floating-point xatoliklari (masalan `19.599999999998` kabi drift) yo'qligini, `3.6 litr` deb toza ko'rsatilishini va backendda `cleanQty` (4 xonali aniqlik) bilan 100% yaxlitlanishini ta'minlash.
- [x] **Asosiy vositalar (`BERILADIGAN`) daxlsizligi:**
  - Asosiy vositalar faqat va faqat butun musbat son (1, 2, 3...) va alohida inventar raqam bilan ishlashi, kasr son kiritish imkoni yo'qligini tekshirish.
- [x] **Komplekt birligi yaxlitligi:**
  - Komplekt butun va daxlsiz to'plam sifatida hisobga olinishi, tarkibi tavsifda yuritilishi mustahkamlandi.
- [x] **Moslashuvchan ishlab chiqarilgan sana/yil (`year`):**
  - Omborchilar uchun mahsulot kirimida faqat yil (masalan `2026`) yoki aniq sana (masalan `2026.09.12`) kiritish imkoniyati yaratildi, bazada va interfeysda to'liq qo'llab-quvvatlandi.

---

### 3. 🛡️ Xodimga va Bo'limga Oylik TMZ Limitlarini Boshqarish va Nazorati:
- [x] **Oylik limit boshqaruvi (Monthly TMZ Consumption Limits - Bajarildi ✅):**
  - Xodim va bo‘limlar uchun mahsulotlar (A4 qog‘oz, ruchka, kanselyariya va h.k.) kesimida oylik isteʼmol meʼyorlarini belgilash (CRUD).
  - Meʼyorlar jadvalida oxirgi belgilangan sana, masʼul shaxs va tasdiqlangan buyruq fayliga to‘g‘ridan-to‘g‘ri havola (`[ 📄 Buyruq fayli (PDF) ↗ ]`).
- [x] **Qatʼiy limit nazorati va bloklash (Over-limit Prevention - Bajarildi ✅):**
  - Omborchi TMZ berayotganda joriy oydagi sarflangan miqdor + yangi berilayotgan miqdor oylik limitdan oshib ketsa, tizim darhol bloklaydi ("Oylik limitdan oshib ketdi! Qolgan limit: X dona").
  - Avtomatlashtirilgan 20 ta integratsion testdan 100% muvaffaqiyatli o‘tdi.
- [x] **Vazir / Rahbariyat buyrug‘i bilan limitni oshirish (Bajarildi ✅):**
  - Qo‘shimcha ehtiyoj yuzaga kelganda, faqatgina tasdiqlangan Buyruq fayli (PDF yoki rasm) yuklanadi va yangi miqdor belgilanadi (qo‘lda buyruq raqami va sanasini qayta yozish talabi olib tashlandi).
  - Backend toza arxitekturaga keltirildi: ortiqcha jadvallar va maydonlar o‘chirildi.
- [ ] **Oylik limitlarni testlash, to‘g‘rilash va takomillashtirish (Navbatdagi vazifa ⏳):**
  - [ ] Real ombor sharoitida xodim va bo‘limlarga turli TMZ larni (qog‘oz, ruchka va boshqalar) tarqatishda oylik limit hisob-kitobini to‘liq amaliy testdan o‘tkazish.
  - [ ] Cheklov yuzaga kelganda Vazir buyrug‘ini biriktirish modali va jarayonini foydalanuvchilar tajribasi (UX) asosida doimiy to‘g‘rilash va takomillashtirib borish.
  - [ ] Har oyning 1-sanasida hisoblagich avtomatik 0 dan boshlanishini monitoring qilish va zarur hisobotlarni shakllantirish.

---

### 4. 🔍 Bildirishnoma va Bo'lim TMZ balansi testlari (Keyingi vazifa):
- [ ] **Bildirishnomalar (Notification Engine) testi:**
  - 5-6 kundan keyin tizimga kirganda eski o'qilgan bildirishnomalar qayta chiqib qolmasligini, 7 kunlik vaqt oynasi va `markAllAsRead` to'g'ri ishlashini rollar bo'yicha testlash.
- [ ] **Bo'lim TMZ balansi (`departmentAsset`) testi:**
  - Bo'limga berilgan sarflanadigan materiallar bo'lim balansiga tushishi va bo'limdan omborga qaytarish to'g'ri ishlashini testlash.

---

## 🎯 Boshqa Navbatdagi Bosqich Vazifalari:

### 1. 👥 Kadr (HR) roli va Xodimlar boshqaruvi (100% to'liq ishlashi):
- [x] **Kadrlar bo'limi interfeyslari:**
  - [x] Xodimlar ro'yxati sahifasi (filtrlash, qidiruv, bo'lim va lavozim bo'yicha saralash, tablar: Faol xodimlar, Jarayondagilar, Arxiv).
  - [x] Yangi xodimni ishga qabul qilish (Onboarding) formasi va logikasi (FISH, lavozim, bo'lim, pasport/PINFL, telefon, ichki raqam).
  - [x] Bo'limlar va lavozimlar boshqaruvi (yaratish, tahrirlash, bo'lim rahbarini belgilash).
- [x] **Xodimni ishdan bo'shatish (Offboarding) 100% himoyalangan tizimi:**
  - [x] Offboarding boshlanganda xodim hisobidagi barcha jihozlar (aktivlar) ro'yxatini avtomatik tekshirish (`OffboardingConfirmModal`).
  - [x] **Xavfsizlik nazorati:** Xodimda topshirilmagan biriktirilgan jihozlar bo'lsa, tizim ishdan bo'shatishni bloklaydi ("Avval barcha jihozlar omborga topshirilishi shart" ogohlantirishi va 3 bosqichli qat'iy nazorat).
  - [x] Jihozlarni omborga qaytarish jarayoni: Omborchi jihozlarni tekshirib qabul qilib oladi va tizimda tasdiqlaydi (`warehouseApproveOffboarding`).
  - [x] Omborchi tasdiqlaganidan so'ng Kadr xodimi yakuniy ishdan bo'shatishni tasdiqlaydi (`OFFBOARDED` maqomi, login/parol va tokenlarni avtomatik bekor qilish, arxivga o'tkazish).
  - [x] Rasmiy A4 formatdagi Davlat Gerbi bilan "Topshirish-qabul qilish dalolatnomasi (Akt)" ko'rish, chop etish va PDF yuklab olish (`OffboardingAktModal`).
  - [x] Xato boshlangan jarayonni orqaga qaytarish / bekor qilish imkoniyati (`cancelOffboarding`).
  - [x] Telegram bot tezkor bildirishnomalari (jarayon boshlanishi, omborchi qabuli, yakuniy bo'shatish).
- [x] **Aktivlarni biriktirish/qaytarishda Kadr ishtiroki:**
  - [x] Kadr xodimi xodimlarning barcha biriktirilgan moddiy javobgarlik kartochkalarini ko'rish va nazorat qilish imkoniyati.

---

### 2. 🏢 Bo'lim Boshliqlari (Department Leader) & Omborchi So'rovlar Tizimi:
- [x] **Bo'lim boshlig'i uchun ehtiyoj so'rovi (Material/Jihoz so'rash / Talabnoma):**
  - [x] Bo'lim boshlig'i omborchiga mahsulot so'rovi yuborishi (masalan: A4 qog'oz, kompyuter, printer, kanselyariya).
  - [x] **Muhim shart:** Bo'lim boshlig'iga ombor qoldig'i (ombor holati/soni) ko'rinmaydi — faqat mahsulot nomi, kerakli miqdor va sabab/tavsif yozib talabnoma yuboradi (`DepartmentSupplyRequestModal`).
- [x] **Omborchi tomonidan so'rovni ko'rib chiqish va boshqarish:**
  - [x] Omborchiga yangi kelib tushgan ehtiyoj so'rovlari paneli va Talabnomalar jadvali (`DepartmentRequestsTab`).
  - [x] Omborchi va Admin so'rovni ko'rib chiqishda **majburiy/aniq izoh (komentariya)** kiritadi (ikkala holatda ham backend va frontendda izoh majburiy):
    - [x] **Default holat:** Textarea bo'sh turadi, hech narsa oldindan yozilmagan bo'ladi.
    - [x] **2 ta aniq tezkor javob (Quick Responses):**
      - [x] *Tasdiqlanganda (Approve):* `"Omborda bor, kelib olib ketishingiz mumkin."`
      - [x] *Rad etilganda (Reject):* `"Hozirda omborda mavjud emas."`
    - [x] **Rollar va Access nazorati:**
      - [x] Admin va Omborchiga "So'rov yuborish" tugmasi ko'rinmaydi va bloklangan (ular faqat tasdiqlovchi/moderator).
      - [x] Faqat Bo'lim boshlig'i (Department Leader) o'z bo'limi uchun talabnoma yubora oladi (backend va frontendda to'liq nazorat).
      - [x] Oddiy xodimlar (`XODIM`, `KADR`) ushbu funksiyadan mutlaqo foydalana olmaydi.
- [x] **Bo'limga biriktirilgan mahsulotlarni omborga qaytarish va tuzatish (ta'mirlash) so'rovi:**
  - [x] **Rollar xavfsizligi:** Bo'lim jihozlarini omborga qaytarish yoki ta'mirlash so'rovini **faqat bo'lim boshlig'i (Department Leader)** yuborishi mumkin (oddiy xodimlar uchun frontend va backendda qat'iy cheklandi).
  - [x] **Dublikatdan 100% himoya:** So'rov yuborilgach, jihoz holati darhol `"Ta'mirlash so'rovi yuborilgan ⏳"` yoki `"Qaytarish so'rovi yuborilgan ⏳"` holatiga o'tadi va qayta so'rov yuborish tugmasi bloklanadi (bazani dublikat bilan to'ldirib tashlashning oldi olindi).
  - [x] Bo'limga tegishli buzilgan yoki ta'mirtalab jihozlarni ta'mirlash so'rovi bilan omborga yuborish va omborda ta'mirlanayotgan paytda `"Ta'mirlashda 🛠"` maqomida turishi.
  - [x] Ortiqcha jihozlarni omborga qaytarish so'rovi bilan jo'natish va omborchi qabul qilishi.
- [x] **Bildirishnomalar (In-App & Telegram):**
  - [x] Yangi talabnoma yuborilganda omborchilarga Telegram bildirishnoma borishi.
  - [x] Omborchi qaror qabul qilishi bilanoq, bo'lim boshlig'iga omborchining izohi bilan birgalikda Telegram bildirishnoma yetib borishi.
- [x] **🔔 Senior darajadagi Topbar Bildirishnomalar Dvigateli (Notification Engine):**
  - [x] **Vaqt gorizonti (Strict 7-Day Window):** Xabardor qiluvchi bildirishnomalar (so'rov tasdiqlandi/rad etildi, xodim rad etdi) faqat oxirgi 7 kun ichida sodir bo'lgan bo'lsa ko'rsatiladi. 7 kundan oshgan eski ma'lumotlar arxivlanadi va qo'ng'iroqdagi qizil sonda yig'ilib qolmaydi.
  - [x] **Foydalanuvchi doirasidagi xotira (User-scoped storage):** Har bir akkaunt uchun `read_notif_ids_${user.id}` va `last_read_notif_time_${user.id}` saqlanadi. 5-6 kundan keyin qayta kirganda yoki kesh tozalanganda ham boshqa foydalanuvchilar bilan aralashib ketmaydi.
  - [x] **Barchasini o'qildi qilish (Mark All As Read):** Qo'ng'iroqcha ochilganda yagona "Barchasini o'qildi qilish" tugmasi qo'shildi. 1 bosishda barcha axborotiy bildirishnomalar o'qilgan holatga o'tadi va badge 0 bo'ladi.
  - [x] **Anti-self va Anti-department leak nazorati:** Omborchi o'zi tasdiqlagan so'rovlarni shaxsiy bildirishnoma sifatida olmaydi; oddiy xodimlar faqat o'zlari yuborgan so'rovlar natijasini ko'radi.

---

### 3. 🤖 Telegram Bot Mantiqi (Tekshirish, To'g'irlash va Takomillashtirish):
- [ ] **Mavjud Telegram bot arxitekturasini tekshirish va xatolarni tuzatish:**
  - [ ] Bot ulanishi, webhook / polling holati, avtorizatsiya (/login) va sessiyalar barqarorligini tekshirish.
  - [ ] Xodimlarni Telegram akkauntiga bog'lash mexanizmini soddalashtirish va xatosiz ishlashini ta'minlash.
- [ ] **Tezkor xabarnomalar (Notification Service) integratsiyasi:**
  - [ ] **Omborchiga:** Bo'lim boshlig'i yangi mahsulot yoki ta'mirlash so'rovi yuborganda zudlik bilan Telegram xabar borishi.
  - [ ] **Bo'lim boshlig'iga:** Omborchi so'rovni tasdiqlaganda yoki rad etganda omborchining izohi (komentariyasi) bilan birga xabar borishi.
  - [ ] **Xodimga:** Yangi jihoz biriktirilganda "Jihozni qabul qiling" xabari va qabul qilish/rad etish havolasi.
  - [ ] **Kadrga:** Xodim ishdan bo'shatish jarayonidagi bosqichlar bo'yicha xabarlar.
- [ ] **Bot komandalarini boyitish:**
  - [ ] Bo'lim boshliqlari uchun o'z bo'limi so'rovlari holatini ko'rish komandalari.

---

### 4. Rate limiting qoyish

login parolni 3 marta notogri terilsa 1 soatga bloklash 

---

### 5. 💼 Buxgalter roli (Keyingi bosqich):
- [ ] Buxgalteriya talablari va moddiy aktivlar hisobi (asosiy vositalar, inventarizatsiya).
- [ ] Hisobdan chiqarish (spisaniye) jarayonlari va buxgalter tasdiqlash mexanizmi.
- [ ] Buxgalteriya uchun moslashtirilgan eksport va hisobotlar (inventarizatsiya dalolatnomalari, balans hisoboti).



---

## ✅ Bajarilgan ishlar:

### 🔐 1. RBAC (Role-Based Access Control — Rollar huquqlari va xavfsizlik):
- [x] **Backend xavfsizlik nazorati:**
  - `requests.service.ts`: So'rovlarni tasdiqlash va rad etishda faqat vakolatli rollarga ruxsat berildi (`SUPER_ADMIN`, `VAZIRLIK_OMBORCHI`, `ORG_ADMIN`, `ORG_OMBORCHI`). Begona rollar (masalan, `XODIM`, `KADR`) so'rovlarni o'zboshimchalik bilan tasdiqlay olmaydi.
  - `operations.controller.ts`: Biriktirilgan jihozni qabul qilish (`acceptAssignment`) va rad etish (`rejectAssignment`) endpointlariga qat'iy rollar biriktirildi.
- [x] **Frontend rollar va sahifalar cheklovi:**
  - `App.tsx`: Profil va xavfsizlik (`/profile/*`) marshrutlari barcha tizim foydalanuvchilariga ochildi.
  - `sidebar.tsx` & `App.tsx`: `/assigned-assets` (Biriktirilgan jihozlar) ro'yxatiga `VAZIRLIK_OMBORCHI` va `ORG_OMBORCHI` huquqlari berildi.
  - `departments-page.tsx`: Bo'lim boshqaruvi (`canManage`) faqat `SUPER_ADMIN`, `ORG_ADMIN`, `KADR` ga qoldirildi (omborchilar bo'lim yarata olmasligi uchun).
  - `requests-page.tsx`: Kadr xodimiga so'rovlar jurnalini ko'rish huquqi ochildi (`canViewAll`).
  - `topbar-search.tsx`: Global qidiruv komponenti tozalab optimallashtirildi.

### 📄 2. Hisobotlar va Eksport Tizimi:
- [x] O'zbekiston Respublikasi rasmiy Davlat Gerbi (vektorli shaffof SVG) joylashtirildi.
- [x] So'rov turi va holati ustunlari davlat idoralari rasmiy uslubiga moslandi.
- [x] PDF hisobotida har bir varoqqa qat'iy 10 tadan so'rov tafsilotlari joylashtirildi.
- [x] PDF tiniqligi Ultra-HD 3.5x masshtab va 100% Vektorli chop etish (Save as PDF) orqali ta'minlandi.
- [x] Excel eksportida ortiqcha statistika satri olib tashlandi, kataklar kengaytirildi, dinamik qator balandligi kiritildi va imzolar bloki birlashtirildi.

### 🔄 3. Xodimni Ishdan Bo'shatish (Offboarding) & Tarix (History) Mantiqi:
- [x] 3 bosqichli xavfsiz offboarding tizimi (Kadr boshlashi -> Omborchi barcha aktivlarni qabul qilishi -> Kadr yakuniy bo'shatishi).
- [x] Ishdan bo'shatilgan xodim bo'ynida jihoz bo'lmasa ham tarixda (History) offboarding amali `AKT-YYYY-XXXXXX` bilan qayd etilishi va 0 ta jihoz bo'lsa "Hisobida topshirilishi lozim jihoz bo'lmagan" ko'rinishida ko'rinishi.
- [x] Tarixda (History) noo'rin shartnoma ochilishining oldi olindi: Shartnoma faqat biriktirishda ochiladi; qaytarishda "Qaytarish Akti (Dalolatnoma)", offboardingda esa "Topshirish Akti (Davlat Gerbli rasmiy hujjat)" ochiladi.

### 🌐 4. To'liq 3 Tilli (O'zbek, Rus, Ingliz) Lokalizatsiya:
- [x] Yangi qo'shilgan barcha funksiyalar va modallar 3 tilda (`uz`, `ru`, `en`) to'liq tarjima qilindi:
  - `pending-offboardings-view`: Bo'shash jarayonidagi xodimlar monitoringi, 3 qadamli vizual stepper, tasdiqlash dialoglari.
  - `approve-supply-modal`: Omborchi tomonidan talabnomani tasdiqlash modali, tezkor sharhlar va izohlar.
  - `department-requests-tab` & `department-supply-request-modal`: Bo'lim talabnomalari jadvali va yangi talabnoma yuborish formasi.
  - `history-page`: Ishdan bo'shatish badgelari, Topshirish Akti va Qaytarish Akti tugmalari.

### 📦 5. Ko'p Birlikli Ombor Hisobi & Bildirishnomalar Tizimi (2026-10-14):
- [x] **Pachka va dona o'rtasidagi erkin konvertatsiya:**
  - Mahsulotga `packageSize` parametri qo'shildi (masalan, 1 pachkada 500 dona A4 qog'oz).
  - Xodimga va bo'limga TMZ berish oynalarida "Pachkada" va "Donalab" o'tkazgichlari yaratildi.
  - 20 pachka A4 qog'ozdan xodimga 200 dona berilganda, tizim avtomatik `0.4 pachka` sarf hisoblab, qoldiqni `19.6 pachka` qilib, interfeysda **`19 pachka, 300 dona`** ko'rinishida aniq ko'rsatadi.
- [x] **Kasrli o'lchov birliklari (`LITR`, `KG`, `METR`):**
  - Database, Prisma sxemasi va barcha DTO-lar `Float` (kasr son) qilib yangilandi.
  - `3.6 litr`, `5.8 litr`, `0.75 kg` kabi miqdorlarda kirim, sarf va qoldiq hisobi yo'lga qo'yildi.
- [x] **Floating-point xatoliklaridan 100% himoya:**
  - 4 xonali aniqlikdagi yaxlitlash (`roundQuantity`) va `quantity-utils.ts` ishlab chiqildi.
- [x] **Asosiy vositalar (`BERILADIGAN`) butunligi:**
  - Asosiy vositalar faqat va faqat musbat butun son va unikal inventar raqam bilan ishlashi qat'iy saqlab qolindi.
- [x] **Bo'lim TMZ zaxirasi (`departmentAsset`):**
  - Bo'limga berilgan materiallar bo'lim hisobiga (`departmentAsset`) to'g'ri o'tishi va bo'limdan omborga qaytarish mexanizmi ta'minlandi.
- [x] **Senior darajadagi Bildirishnomalar Dvigateli (Notification Engine):**
  - 7 kunlik vaqt gorizonti, user-scoped storage va "Barchasini o'qildi qilish" (`markAllAsRead`) integratsiya qilindi.

