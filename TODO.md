# 📋 Loyiha Rivojlantirish Rejasi va Bajariladigan Vazifalar

**Oxirgi yangilangan sana:** 2026-09-25  
**Loyiha:** WMS Platform (Vazirlik va Quyi Tashkilotlar Ombor Boshqaruv Tizimi)

---

## 🎯 Navbatdagi Bosqich Vazifalari (Amalga oshirilishi kerak bo'lgan ishlar):

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
  - [x] Omborchi so'rovni tasdiqlashda yoki rad etishda **majburiy/aniq izoh (komentariya)** kiritadi:
    - [x] *Tasdiqlanganda (mahsulot bor bo'lsa):* "Omborda bor, 5 ta kelib olib ketishingiz mumkin" ko'rinishidagi izoh (`ApproveSupplyModal`).
    - [x] *Rad etilganda yoki kutish rejimiga olinganda:* "Hozir bizda siz so'ragan mahsulot yo'q, keyinroq omborga keladi, o'shanda olib ketishingiz mumkin" ko'rinishidagi tezkor sabablar va erkin izoh.
- [x] **Bo'limga biriktirilgan mahsulotlarni omborga qaytarish va tuzatish (ta'mirlash) so'rovi:**
  - [x] **Rollar xavfsizligi:** Bo'lim jihozlarini omborga qaytarish yoki ta'mirlash so'rovini **faqat bo'lim boshlig'i (Department Leader)** yuborishi mumkin (oddiy xodimlar uchun frontend va backendda qat'iy cheklandi).
  - [x] **Dublikatdan 100% himoya:** So'rov yuborilgach, jihoz holati darhol `"Ta'mirlash so'rovi yuborilgan ⏳"` yoki `"Qaytarish so'rovi yuborilgan ⏳"` holatiga o'tadi va qayta so'rov yuborish tugmasi bloklanadi (bazani dublikat bilan to'ldirib tashlashning oldi olindi).
  - [x] Bo'limga tegishli buzilgan yoki ta'mirtalab jihozlarni ta'mirlash so'rovi bilan omborga yuborish va omborda ta'mirlanayotgan paytda `"Ta'mirlashda 🛠"` maqomida turishi.
  - [x] Ortiqcha jihozlarni omborga qaytarish so'rovi bilan jo'natish va omborchi qabul qilishi.
- [ ] **Bildirishnomalar (In-App & Telegram):**
  - [ ] Omborchi qaror qabul qilishi bilanoq, bo'lim boshlig'iga omborchining izohi bilan birgalikda Telegram bildirishnoma yetib borishi.

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
