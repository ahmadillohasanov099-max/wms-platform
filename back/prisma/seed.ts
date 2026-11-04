import {
  PrismaClient,
  UserRole,
  OrganizationType,
  ProductType,
  UnitType,
  AssetStatus,
  OperationType,
  AssignmentStatus,
} from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { randomUUID } from 'crypto';

const prisma = new PrismaClient();

// ─── 10 TA STANDART BO'LIMLAR ─────────────────────────────
const DEPARTMENT_NAMES = [
  "Buxgalteriya va moliya bo'limi",
  "Inson resurslari va kadrlar bo'limi",
  "Axborot-kommunikatsiya texnologiyalari bo'limi",
  "Moddiy-texnik ta'minot va xo'jalik bo'limi",
  "Arxitektura va shaharsozlik monitoringi bo'limi",
  "Qurilish obyektlari texnik nazorati bo'limi",
  "Kommunal infratuzilma va uy-joy fondi bo'limi",
  "Yuridik xizmat va shartnomalar bo'limi",
  "Ijro intizomi, devonxona va murojaatlar bo'limi",
  "Davlat xaridlari va marketing bo'limi",
];

// ─── 5 TA BOSHQARMA (HUDUDIY TASHKILOTLAR) ────────────────
const ORGANIZATIONS_DATA = [
  {
    code: 'TSH_QURILISH',
    name: "Toshkent shahar Qurilish va uy-joy kommunal xo'jaligi boshqarmasi",
    address: "Toshkent shahri, Amir Temur shox ko'chasi 14",
    phone: '+998 71 233 11 22',
    prefix: 'TSH',
  },
  {
    code: 'SAM_QURILISH',
    name: "Samarqand viloyati Qurilish va uy-joy kommunal xo'jaligi boshqarmasi",
    address: "Samarqand shahri, Registon ko'chasi 25",
    phone: '+998 66 235 44 55',
    prefix: 'SAM',
  },
  {
    code: 'FAR_QURILISH',
    name: "Farg'ona viloyati Qurilish va uy-joy kommunal xo'jaligi boshqarmasi",
    address: "Farg'ona shahri, Alisher Navoiy ko'chasi 10",
    phone: '+998 73 244 33 22',
    prefix: 'FAR',
  },
  {
    code: 'BUX_QURILISH',
    name: "Buxoro viloyati Qurilish va uy-joy kommunal xo'jaligi boshqarmasi",
    address: "Buxoro shahri, Mustaqillik shox ko'chasi 8",
    phone: '+998 65 224 55 66',
    prefix: 'BUX',
  },
  {
    code: 'AND_QURILISH',
    name: "Andijon viloyati Qurilish va uy-joy kommunal xo'jaligi boshqarmasi",
    address: "Andijon shahri, Bobur shox ko'chasi 45",
    phone: '+998 74 223 77 88',
    prefix: 'AND',
  },
];

// ─── 70 TA TMZ (SARFLANADIGAN) SHABLONLARI ─────────────────
interface TmzTemplate {
  name: string;
  unit: UnitType;
  packageSize?: number;
  unitPrice: number;
  quantity: number;
  minLevel: number;
}

const TMZ_CATALOG: TmzTemplate[] = [
  // Qog'ozlar
  { name: 'SvetoCopy Classic A4 qog‘ozi (80g/m²)', unit: UnitType.PACHKA, packageSize: 500, unitPrice: 42000, quantity: 45, minLevel: 10 },
  { name: 'Double A A4 qog‘ozi (80g/m² premium)', unit: UnitType.PACHKA, packageSize: 500, unitPrice: 54000, quantity: 30, minLevel: 8 },
  { name: 'Ballet Brilliant A4 qog‘ozi', unit: UnitType.PACHKA, packageSize: 500, unitPrice: 46000, quantity: 25, minLevel: 5 },
  { name: 'SvetoCopy Premium A3 qog‘ozi (80g/m²)', unit: UnitType.PACHKA, packageSize: 500, unitPrice: 88000, quantity: 15, minLevel: 4 },
  { name: 'Xerox Performer A4 qog‘ozi', unit: UnitType.PACHKA, packageSize: 500, unitPrice: 43000, quantity: 35, minLevel: 10 },
  { name: 'Fotopog‘oz A4 porloq (Glossy 180g)', unit: UnitType.PACHKA, packageSize: 50, unitPrice: 65000, quantity: 12, minLevel: 3 },
  { name: 'Kassa termolentasi 57x40mm', unit: UnitType.DONA, unitPrice: 4500, quantity: 80, minLevel: 20 },
  { name: 'Kassa termolentasi 80x80mm', unit: UnitType.DONA, unitPrice: 12000, quantity: 50, minLevel: 15 },
  
  // Ruchkalar va yozuv qurollari
  { name: 'ErichKrause ko‘k sharikli ruchka 0.7mm', unit: UnitType.DONA, unitPrice: 2500, quantity: 250, minLevel: 50 },
  { name: 'Deli qora gel ruchka 0.5mm', unit: UnitType.DONA, unitPrice: 3500, quantity: 150, minLevel: 30 },
  { name: 'Qizil tekshiruv ruchkasi 0.7mm', unit: UnitType.DONA, unitPrice: 2500, quantity: 80, minLevel: 15 },
  { name: 'Liner (Kapillyar) qora ruchka 0.4mm', unit: UnitType.DONA, unitPrice: 6000, quantity: 60, minLevel: 10 },
  { name: 'Shtrix-korrektor suyuq Deli 20ml', unit: UnitType.DONA, unitPrice: 8000, quantity: 45, minLevel: 10 },
  { name: 'Lentali korrektor (Tape) 5mm x 8m', unit: UnitType.DONA, unitPrice: 11000, quantity: 40, minLevel: 10 },
  { name: 'Oddiy qalam HB (Koh-i-Noor)', unit: UnitType.DONA, unitPrice: 2000, quantity: 120, minLevel: 25 },
  { name: 'Rangli matn ajratgich (Tekstovydelitel) to‘plam', unit: UnitType.KOMPLEKT, unitPrice: 22000, quantity: 35, minLevel: 8 },
  { name: 'Doska markeri (Whiteboard) 4 rangli to‘plam', unit: UnitType.KOMPLEKT, unitPrice: 28000, quantity: 25, minLevel: 5 },
  { name: 'Doimiy marker (Permanent) qora 2mm', unit: UnitType.DONA, unitPrice: 5000, quantity: 55, minLevel: 10 },
  { name: 'O‘chirgich (Lastik) Milan oq', unit: UnitType.DONA, unitPrice: 3000, quantity: 70, minLevel: 15 },
  { name: 'Qalam yo‘ngich (Tochilka) konteynerli', unit: UnitType.DONA, unitPrice: 7500, quantity: 40, minLevel: 8 },

  // Papkalar va arxivlash
  { name: 'Fayl shaffof A4 (0.04mm, 100 dona)', unit: UnitType.PACHKA, packageSize: 100, unitPrice: 24000, quantity: 60, minLevel: 15 },
  { name: 'Registrator papka A4 75mm (Arxiv)', unit: UnitType.DONA, unitPrice: 18000, quantity: 95, minLevel: 20 },
  { name: 'Registrator papka A4 50mm ingichka', unit: UnitType.DONA, unitPrice: 17000, quantity: 60, minLevel: 15 },
  { name: 'Tugmali papka A4 plastmassa (Konvert)', unit: UnitType.DONA, unitPrice: 4000, quantity: 180, minLevel: 40 },
  { name: 'Skrosshivatel papka A4 shaffof', unit: UnitType.DONA, unitPrice: 3000, quantity: 200, minLevel: 50 },
  { name: 'Burchakli papka-ugolok A4 shaffof', unit: UnitType.DONA, unitPrice: 2000, quantity: 150, minLevel: 30 },
  { name: 'Konvert A4 oq pochta (50 dona)', unit: UnitType.PACHKA, packageSize: 50, unitPrice: 25000, quantity: 30, minLevel: 8 },
  { name: 'Konvert A5 oq (100 dona)', unit: UnitType.PACHKA, packageSize: 100, unitPrice: 28000, quantity: 25, minLevel: 6 },
  { name: 'Qisqichli papka (Klipbord) planshet A4', unit: UnitType.DONA, unitPrice: 16000, quantity: 30, minLevel: 5 },
  { name: 'Arxiv qutisi (Box) qattiq karton A4', unit: UnitType.DONA, unitPrice: 15000, quantity: 70, minLevel: 15 },

  // Kanselyariya anjomlari
  { name: 'Metall skrepka 28mm (100 dona)', unit: UnitType.PACHKA, packageSize: 100, unitPrice: 4500, quantity: 120, minLevel: 25 },
  { name: 'Metall skrepka 50mm katta (50 dona)', unit: UnitType.PACHKA, packageSize: 50, unitPrice: 6000, quantity: 80, minLevel: 15 },
  { name: 'Qog‘oz qisqich (Binder) 19mm (12 dona)', unit: UnitType.PACHKA, packageSize: 12, unitPrice: 9000, quantity: 65, minLevel: 15 },
  { name: 'Qog‘oz qisqich (Binder) 25mm (12 dona)', unit: UnitType.PACHKA, packageSize: 12, unitPrice: 12000, quantity: 50, minLevel: 12 },
  { name: 'Qog‘oz qisqich (Binder) 32mm (12 dona)', unit: UnitType.PACHKA, packageSize: 12, unitPrice: 15000, quantity: 40, minLevel: 10 },
  { name: 'Stepler o‘qi №10 (1000 dona)', unit: UnitType.PACHKA, packageSize: 1000, unitPrice: 3000, quantity: 140, minLevel: 30 },
  { name: 'Stepler o‘qi №24/6 (1000 dona)', unit: UnitType.PACHKA, packageSize: 1000, unitPrice: 4500, quantity: 160, minLevel: 35 },
  { name: 'Kanselyariya yelimi PVA 85g', unit: UnitType.DONA, unitPrice: 4000, quantity: 70, minLevel: 15 },
  { name: 'Yelim qalam (Glue stick) Deli 36g', unit: UnitType.DONA, unitPrice: 7000, quantity: 85, minLevel: 20 },
  { name: 'Skotch shaffof 48mm x 100m', unit: UnitType.DONA, unitPrice: 14000, quantity: 55, minLevel: 12 },
  { name: 'Skotch ingichka shaffof 18mm x 30m', unit: UnitType.DONA, unitPrice: 3500, quantity: 90, minLevel: 20 },
  { name: 'Skotch ikki tomonlama 24mm', unit: UnitType.DONA, unitPrice: 12000, quantity: 40, minLevel: 8 },
  { name: 'Kanselyariya pichog‘i 18mm metall', unit: UnitType.DONA, unitPrice: 9000, quantity: 50, minLevel: 10 },
  { name: 'Pichoq zaxira tig‘i 18mm (10 dona)', unit: UnitType.PACHKA, packageSize: 10, unitPrice: 6500, quantity: 60, minLevel: 12 },
  { name: 'Kanselyariya qaychisi 21sm po‘lat', unit: UnitType.DONA, unitPrice: 15000, quantity: 45, minLevel: 10 },

  // Bloknotlar va stikerlar
  { name: 'Stiker yopishqoq 76x76mm sariq (100 v)', unit: UnitType.PACHKA, packageSize: 100, unitPrice: 6000, quantity: 110, minLevel: 25 },
  { name: 'Stiker-zakladka rangli plastik (5 rang)', unit: UnitType.KOMPLEKT, unitPrice: 8500, quantity: 90, minLevel: 20 },
  { name: 'Qayd daftari A4 qattiq muqova 96 varaq', unit: UnitType.DONA, unitPrice: 18000, quantity: 75, minLevel: 15 },
  { name: 'Bloknot A5 spiral qattiq muqova', unit: UnitType.DONA, unitPrice: 12000, quantity: 80, minLevel: 18 },
  { name: 'Xodimlar uchun rejalashtirish daftari (Yejenedelnik)', unit: UnitType.DONA, unitPrice: 35000, quantity: 50, minLevel: 10 },

  // Kartrij va tonerlar
  { name: 'Toner kartrij HP 85A (CE285A)', unit: UnitType.DONA, unitPrice: 145000, quantity: 18, minLevel: 4 },
  { name: 'Toner kartrij HP 12A (Q2612A)', unit: UnitType.DONA, unitPrice: 135000, quantity: 22, minLevel: 5 },
  { name: 'Toner kartrij Canon 725', unit: UnitType.DONA, unitPrice: 140000, quantity: 16, minLevel: 4 },
  { name: 'Toner kartrij HP 05A (CE505A)', unit: UnitType.DONA, unitPrice: 190000, quantity: 12, minLevel: 3 },
  { name: 'Toner kartrij Xerox 3020/3025 (106R02773)', unit: UnitType.DONA, unitPrice: 160000, quantity: 14, minLevel: 3 },

  // Tozalash va gigiyena
  { name: 'Suyuq sovun antibakterial 5 litr', unit: UnitType.LITR, unitPrice: 38000, quantity: 25, minLevel: 5 },
  { name: 'Qo‘l yuvish sovuni Duru 90g', unit: UnitType.DONA, unitPrice: 6500, quantity: 120, minLevel: 30 },
  { name: 'Idish yuvish geli Fairy 1000ml', unit: UnitType.LITR, unitPrice: 26000, quantity: 35, minLevel: 8 },
  { name: 'Oyna tozalash vositasi Mister Muscle 500ml', unit: UnitType.DONA, unitPrice: 18000, quantity: 40, minLevel: 10 },
  { name: 'Xlorli tozalash vositasi Domestos 1000ml', unit: UnitType.LITR, unitPrice: 24000, quantity: 35, minLevel: 8 },
  { name: 'Universal pol yuvish konsentrati 5 litr', unit: UnitType.LITR, unitPrice: 55000, quantity: 15, minLevel: 4 },
  { name: 'Havo xushbo‘ylantirgich (Aerozol) 300ml', unit: UnitType.DONA, unitPrice: 19000, quantity: 45, minLevel: 10 },
  { name: 'Qog‘oz sochiq 2 qatlamli (rulon)', unit: UnitType.DONA, unitPrice: 9000, quantity: 95, minLevel: 20 },
  { name: 'Hojatxona qog‘ozi 2 qatlamli yumshoq', unit: UnitType.DONA, unitPrice: 3500, quantity: 250, minLevel: 50 },
  { name: 'Salfetka qog‘oz oq 100 dona', unit: UnitType.PACHKA, packageSize: 100, unitPrice: 5000, quantity: 120, minLevel: 25 },
  { name: 'Nam salfetka antibakterial (120 dona)', unit: UnitType.PACHKA, packageSize: 120, unitPrice: 14000, quantity: 65, minLevel: 15 },
  { name: 'Axlat qoplari mustahkam 30L (30 dona)', unit: UnitType.PACHKA, packageSize: 30, unitPrice: 11000, quantity: 80, minLevel: 20 },
  { name: 'Axlat qoplari katta 120L (10 dona)', unit: UnitType.PACHKA, packageSize: 10, unitPrice: 16000, quantity: 70, minLevel: 15 },
  { name: 'Pol artish lattasi mikrofibra 50x60sm', unit: UnitType.DONA, unitPrice: 14000, quantity: 50, minLevel: 12 },
  { name: 'Stol artish lattasi mikrofibra (4 dona)', unit: UnitType.KOMPLEKT, unitPrice: 18000, quantity: 45, minLevel: 10 },
  { name: 'Xo‘jalik qo‘lqopi rezina (L o‘lcham)', unit: UnitType.DONA, unitPrice: 8000, quantity: 60, minLevel: 15 },
  { name: 'Tibbiy bir martalik niqob (50 dona)', unit: UnitType.PACHKA, packageSize: 50, unitPrice: 20000, quantity: 40, minLevel: 10 },

  // Xo'jalik va elektr
  { name: 'Bir martalik qog‘oz stakan 200ml (100 dona)', unit: UnitType.PACHKA, packageSize: 100, unitPrice: 22000, quantity: 50, minLevel: 10 },
  { name: 'Duracell AA batareyka (4 dona)', unit: UnitType.KOMPLEKT, unitPrice: 28000, quantity: 45, minLevel: 10 },
  { name: 'Duracell AAA batareyka (4 dona)', unit: UnitType.KOMPLEKT, unitPrice: 28000, quantity: 45, minLevel: 10 },
  { name: 'LED lampochka 15W E27 oq yorug‘lik', unit: UnitType.DONA, unitPrice: 14000, quantity: 50, minLevel: 12 },
];

// ─── 100 TA ASOSIY VOSITALAR SHABLONLARI ───────────────────
interface AssetTemplate {
  name: string;
  unitPrice: number;
  year: string;
  count: number; // Ushbu mahsulotdan nechta dona asset yaratilsin
}

const ASSET_CATALOG: AssetTemplate[] = [
  // 1-10: Monobloklar va Kompyuterlar
  { name: 'HP ProOne 440 G9 All-in-One i5 16GB 512GB', unitPrice: 9400000, year: '2026', count: 3 },
  { name: 'Lenovo IdeaCentre AIO 3 24IAP7 i5 16GB', unitPrice: 8800000, year: '2026', count: 3 },
  { name: 'Dell OptiPlex 7400 AIO 24" Touch i7 16GB', unitPrice: 12500000, year: '2026', count: 2 },
  { name: 'Artel Monoblok 23.8" FHD Core i5 8GB 256GB', unitPrice: 6200000, year: '2025', count: 4 },
  { name: 'HP 280 Pro G8 Microtower i5 8GB 1TB+256SSD', unitPrice: 7100000, year: '2025', count: 3 },
  { name: 'Lenovo ThinkCentre Neo 50s Gen 3 i5', unitPrice: 7600000, year: '2026', count: 3 },
  { name: 'Dell Vostro 3910 Tower Core i5 16GB 512SSD', unitPrice: 8300000, year: '2026', count: 3 },
  { name: 'Apple iMac 24" M3 8-core CPU 8GB 256GB', unitPrice: 19800000, year: '2026', count: 1 },
  { name: 'Asus ExpertCenter D5 Mini Tower i5', unitPrice: 7300000, year: '2025', count: 2 },
  { name: 'Acer Veriton Essential M200 i3 8GB 256GB', unitPrice: 5600000, year: '2025', count: 2 },

  // 11-20: Noutbuklar
  { name: 'HP ProBook 450 G9 Core i5 16GB 512SSD 15.6"', unitPrice: 8900000, year: '2026', count: 3 },
  { name: 'Lenovo ThinkPad E15 Gen 4 Core i7 16GB', unitPrice: 11200000, year: '2026', count: 2 },
  { name: 'Dell Latitude 3520 15.6" Core i5 16GB 512SSD', unitPrice: 8700000, year: '2025', count: 3 },
  { name: 'Apple MacBook Pro 14" M2 Pro 16GB 512GB', unitPrice: 24500000, year: '2025', count: 1 },
  { name: 'Apple MacBook Air 13" M2 8GB 256GB Midnight', unitPrice: 14200000, year: '2026', count: 1 },
  { name: 'Asus VivoBook 15 X1502 Core i5 16GB 512SSD', unitPrice: 7500000, year: '2026', count: 3 },
  { name: 'Acer Aspire 5 A515 Core i5 8GB 512GB', unitPrice: 6800000, year: '2025', count: 3 },
  { name: 'HP Pavilion 15-eg2000 Core i7 16GB 512SSD', unitPrice: 9800000, year: '2026', count: 2 },
  { name: 'Lenovo V15 G3 IAP Core i3 8GB 256SSD', unitPrice: 5200000, year: '2025', count: 2 },
  { name: 'Dell Inspiron 3511 Core i5 8GB 512SSD', unitPrice: 6900000, year: '2025', count: 2 },

  // 21-30: Monitorlar
  { name: 'Dell 24" P2422H IPS Professional Monitor', unitPrice: 2600000, year: '2026', count: 4 },
  { name: 'HP 24mh FHD 23.8" IPS Monitor bilan dinamik', unitPrice: 2400000, year: '2026', count: 3 },
  { name: 'Samsung 27" Curved Odyssey G3 Gaming/Office', unitPrice: 3200000, year: '2026', count: 2 },
  { name: 'LG 24MP400-B 23.8" IPS FHD Monitor', unitPrice: 2100000, year: '2025', count: 4 },
  { name: 'Philips 271V8L 27" VA Full HD Monitor', unitPrice: 2700000, year: '2026', count: 2 },
  { name: 'BenQ 24" GW2480 IPS Eye-Care Monitor', unitPrice: 2250000, year: '2025', count: 3 },
  { name: 'Asus 27" VA27EHE Eye Care IPS Monitor', unitPrice: 2850000, year: '2026', count: 2 },
  { name: 'AOC 24B2XH 23.8" Frameless IPS Monitor', unitPrice: 1950000, year: '2025', count: 3 },
  { name: 'ViewSonic 24" VA2432-MHD IPS Monitor', unitPrice: 2150000, year: '2025', count: 2 },
  { name: 'Xiaomi Mi Desktop Monitor 27" IPS 75Hz', unitPrice: 2500000, year: '2026', count: 2 },

  // 31-40: Printerlar va MFU
  { name: 'HP LaserJet Pro MFP M428dw Ko‘p tarmoqli MFU', unitPrice: 6500000, year: '2026', count: 2 },
  { name: 'Canon imageRUNNER 2206 A3 Formatli Ofis MFU', unitPrice: 11800000, year: '2025', count: 1 },
  { name: 'HP LaserJet Pro M404dn Tarmoq printeri', unitPrice: 4200000, year: '2026', count: 2 },
  { name: 'Epson L3250 Rangli Wi-Fi MFU (SNPB tizimli)', unitPrice: 2900000, year: '2026', count: 3 },
  { name: 'Xerox WorkCentre 3025NI Lazerli Wi-Fi MFU', unitPrice: 3400000, year: '2025', count: 2 },
  { name: 'Pantum M6500W Monoxrom Lazerli MFU', unitPrice: 2450000, year: '2026', count: 3 },
  { name: 'Kyocera ECOSYS M2040dn Yuqori tezlikli MFU', unitPrice: 7800000, year: '2026', count: 1 },
  { name: 'Brother DCP-L2520D Dupleks lazerli MFU', unitPrice: 3800000, year: '2025', count: 2 },
  { name: 'Canon PIXMA G3411 Rangli MFU', unitPrice: 2600000, year: '2025', count: 2 },
  { name: 'HP Color LaserJet Pro M283fdw Rangli lazer MFU', unitPrice: 7900000, year: '2026', count: 1 },

  // 41-50: Server va Tarmoq uskunalari
  { name: 'Server HPE ProLiant DL380 Gen10 2x Xeon 64GB', unitPrice: 48000000, year: '2025', count: 1 },
  { name: 'Server Dell PowerEdge R740 Rack 2U', unitPrice: 44000000, year: '2025', count: 1 },
  { name: 'Kommutator Cisco Catalyst 2960-X 24 Port Gigabit', unitPrice: 14500000, year: '2025', count: 1 },
  { name: 'Kommutator MikroTik CRS326-24G-2S+RM 24 Port', unitPrice: 3200000, year: '2026', count: 2 },
  { name: 'Marshrutizator MikroTik RB4011iGS+RM', unitPrice: 4100000, year: '2026', count: 2 },
  { name: 'Wi-Fi Router TP-Link Archer AX73 Wi-Fi 6', unitPrice: 1850000, year: '2026', count: 3 },
  { name: 'Wi-Fi Kirish nuqtasi Ubiquiti UniFi 6 Pro', unitPrice: 3100000, year: '2026', count: 3 },
  { name: 'Tarmoq shkafi (Server rack) Toten 42U 600x800', unitPrice: 6500000, year: '2025', count: 1 },
  { name: 'UPS APC Smart-UPS 1500VA LCD 230V', unitPrice: 8500000, year: '2026', count: 2 },
  { name: 'UPS APC Back-UPS 650VA BV650I-MS', unitPrice: 950000, year: '2026', count: 5 },

  // 51-60: Konferentsiya va taqdimot
  { name: 'Proyektor Epson EB-E01 3LCD 3300 Lumens', unitPrice: 5600000, year: '2026', count: 1 },
  { name: 'Proyektor ViewSonic PA503W 3800 ANSI', unitPrice: 6100000, year: '2026', count: 1 },
  { name: 'Motorli proyektor ekrani 200x200cm masofaviy pult', unitPrice: 1800000, year: '2025', count: 1 },
  { name: 'Interaktiv sensorli panel SMART Board 75" 4K', unitPrice: 36000000, year: '2026', count: 1 },
  { name: 'Video konferentsiya kamerasi Logitech MeetUp 4K', unitPrice: 14800000, year: '2026', count: 1 },
  { name: 'Veb-kamera Logitech C920 HD Pro 1080p', unitPrice: 1250000, year: '2026', count: 4 },
  { name: 'Spikerfon Jabra Speak 710 Bluetooth/USB', unitPrice: 3400000, year: '2026', count: 2 },
  { name: 'Televizor Artel 65" Smart Android 4K UHD', unitPrice: 7200000, year: '2026', count: 1 },
  { name: 'Televizor Samsung 55" Crystal UHD 4K', unitPrice: 6800000, year: '2026', count: 2 },
  { name: 'Televizor LG 50" Smart webOS 4K UHD', unitPrice: 5900000, year: '2025', count: 2 },

  // 61-75: Mebel va ofis jihozlari
  { name: 'Rahbar kreslosi charm qora (Executive Lux)', unitPrice: 3800000, year: '2026', count: 2 },
  { name: 'Xodim ergonomik to‘rli kreslosi (Ergo Mesh)', unitPrice: 1450000, year: '2026', count: 6 },
  { name: 'Mehmonlar uchun stul ISO qora metall ramkali', unitPrice: 320000, year: '2025', count: 10 },
  { name: 'Rahbar ish stoli 180x90 sm qora eman yog‘och', unitPrice: 5200000, year: '2026', count: 1 },
  { name: 'Xodim ish stoli 140x70 sm tumbasi bilan', unitPrice: 1800000, year: '2026', count: 6 },
  { name: 'Qabulxona (Reception) stoli zamonaviy dizayn', unitPrice: 4500000, year: '2025', count: 1 },
  { name: 'Hujjatlar seyfi Valberg ASM-63T elektron qulf', unitPrice: 3100000, year: '2025', count: 2 },
  { name: 'O‘tga chidamli katta seyf Valberg FRS-51 EL', unitPrice: 5800000, year: '2026', count: 1 },
  { name: 'Hujjatlar shkafi oyna eshikli 4 tokchali', unitPrice: 2200000, year: '2025', count: 4 },
  { name: 'Kiyimlar shkafi 2 eshikli kiyim osgich bilan', unitPrice: 1900000, year: '2025', count: 3 },
  { name: 'Metall arxiv javoni 5 tokchali mustahkam', unitPrice: 1350000, year: '2025', count: 4 },
  { name: 'Qabulxona divani 3 o‘rinli qora ekocharm', unitPrice: 3600000, year: '2026', count: 2 },
  { name: 'Jurnal stoli qora shisha va metall oyoqli', unitPrice: 950000, year: '2025', count: 2 },
  { name: 'Qog‘oz maydalagich (Shredder) Rexel Secure X10', unitPrice: 1850000, year: '2026', count: 2 },
  { name: 'Laminator A3 Geha Basic tezkor qizdirish', unitPrice: 1200000, year: '2025', count: 2 },

  // 76-90: Iqlim va maishiy texnika
  { name: 'Broshyurator (Muqovalash) DSB CB-180 metall', unitPrice: 1650000, year: '2025', count: 1 },
  { name: 'Konditsioner Artel Grand Inverter 18 BTU', unitPrice: 6500000, year: '2026', count: 2 },
  { name: 'Konditsioner Gree Fairy Inverter 12 BTU', unitPrice: 5400000, year: '2026', count: 2 },
  { name: 'Konditsioner Midea Mission 24 BTU katta zal uchun', unitPrice: 8900000, year: '2025', count: 1 },
  { name: 'Suv kuler (Dispenser) Vatti sovitish va isitish', unitPrice: 1750000, year: '2026', count: 3 },
  { name: 'Muzlatgich Artel HD-276FN 2 kamerali 212L', unitPrice: 3900000, year: '2025', count: 1 },
  { name: 'Mini muzlatgich Artel 90L ofis uchun', unitPrice: 2100000, year: '2026', count: 2 },
  { name: 'Mikroto‘lqinli pech Samsung MS23K3513 23L', unitPrice: 1450000, year: '2026', count: 2 },
  { name: 'Kofe mashinasi DeLonghi Magnifica S avtomat', unitPrice: 6800000, year: '2026', count: 1 },
  { name: 'Elektr choynak Tefal Element 1.7L po‘lat', unitPrice: 650000, year: '2026', count: 3 },
  { name: 'Havo namlagich Xiaomi Smart Humidifier 2', unitPrice: 680000, year: '2026', count: 3 },
  { name: 'Elektr konvektor isitgich Ballu 2000W', unitPrice: 850000, year: '2025', count: 3 },
  { name: 'Sanoat changyutgichi Karcher WD 3 V-17', unitPrice: 1950000, year: '2026', count: 1 },
  { name: 'Ofis changyutgichi Samsung VC18M3120', unitPrice: 1350000, year: '2025', count: 2 },
  { name: 'Kuchlanish stabilizatori Voltron 10kVA', unitPrice: 3800000, year: '2025', count: 1 },

  // 91-100: Maxsus qurilish/o'lchov va xavfsizlik asboblari
  { name: 'Lazerli masofa o‘lchagich (Dalnomer) Bosch GLM 50', unitPrice: 1650000, year: '2026', count: 2 },
  { name: 'Lazerli sath o‘lchagich (Nivelir) Bosch GCL 2-15', unitPrice: 2300000, year: '2026', count: 2 },
  { name: 'Optik nivelir Setl AL-32 stativi bilan', unitPrice: 3400000, year: '2025', count: 1 },
  { name: 'Dron DJI Mini 4 Pro obyektlar monitoringi uchun', unitPrice: 14500000, year: '2026', count: 1 },
  { name: 'Avtoturargoh shlagbaumi CAME G4000 komplekt', unitPrice: 16800000, year: '2025', count: 1 },
  { name: 'Turniket tripod Oxgard Praktika T-01', unitPrice: 12500000, year: '2025', count: 1 },
  { name: 'Biometrik kirish nazorati terminali ZKTeco Face', unitPrice: 4200000, year: '2026', count: 2 },
  { name: 'Video kuzatuv IP kamerasi Hikvision 4MP po‘lat', unitPrice: 950000, year: '2026', count: 6 },
  { name: 'DVR Videoregistrator Hikvision 16 kanalli 4K', unitPrice: 3200000, year: '2025', count: 1 },
  { name: 'Benzinli generator Huter DY6500LX 5kW', unitPrice: 7800000, year: '2025', count: 1 },
];

// O'zbek ism-familiyalari generatori
const FIRST_NAMES_M = [
  'Jasur', 'Dilshod', 'Sherzod', 'Sardor', 'Bekzod', 'Rustam', 'Farrux', 'Ulug‘bek',
  'Jamshid', 'Otabek', 'Bobur', 'Sanjar', 'Shohrux', 'Akmal', 'Botir', 'Aziz',
  'Alisher', 'Javohir', 'Nodir', 'Mansur', 'Davron', 'Umid', 'Muzaffar', 'Eldor',
  'Shuhrat', 'Ilhom', 'Bahodir', 'Ravshan', 'Xurshid', 'Doniyor',
];

const LAST_NAMES_M = [
  'Karimov', 'Alimov', 'Rustamov', 'Mahmudov', 'Toshpo‘latov', 'Qodirov', 'Yusupov',
  'Hasanov', 'Ibragimov', 'Rahimov', 'Nazarov', 'Sultonov', 'Saidov', 'Xoliqov',
  'Nurmatov', 'Abdullayev', 'Sobirov', 'Ergashev', 'G‘aniyev', 'Tursunov',
];

const FIRST_NAMES_F = [
  'Nilufar', 'Malika', 'Nodira', 'Gulnoza', 'Shahnoza', 'Dildora', 'Zilola',
  'Umida', 'Feruza', 'Kamola', 'Rayhona', 'Barno', 'Dilfuza', 'Munira', 'Madina',
];

const LAST_NAMES_F = [
  'Karimova', 'Alimova', 'Rustamova', 'Mahmudova', 'Qodirova', 'Yusupova',
  'Hasanova', 'Ibragimova', 'Rahimova', 'Saidova', 'Abdullayeva', 'Ergasheva',
];

const POSITIONS = [
  'Bosh mutaxassis',
  'Yetakchi mutaxassis',
  'Katta inspektor',
  'Texnik nazorat muhandisi',
  'Loyiha koordinatori',
  'Axborot xavfsizligi bo‘yicha mutaxassis',
  'Dasturiy ta’minot muhandisi',
  'Bosh yuriskonsult',
  'Yetakchi hisobchi',
  'Moddiy hisobchi',
  'Devonxona mudiri',
  'Davlat xaridlari mutaxassisi',
  'Arxitektura nazorati inspektori',
  'Kommunal soha monitoringi mutaxassisi',
];

async function main() {
  console.log('================================================================');
  console.log('  WMS BAZASINI 0 GA TUSHIRISH VA KATTA TEST TAQDIMOT SEEDINI BOSHLASH');
  console.log('================================================================');

  // 1. Truncate all tables
  await prisma.$executeRawUnsafe(`
    TRUNCATE TABLE 
      "TmzLimitException",
      "TmzMonthlyLimit",
      "AuditLog", 
      "RefreshToken", 
      "DeletionRequest", 
      "Operation", 
      "DepartmentAsset", 
      "Assignment", 
      "Asset", 
      "Inventory", 
      "Product", 
      "User", 
      "Department", 
      "Organization" 
    CASCADE;
  `);

  console.log('✅ Barcha jadvallar tozalandi.');

  // 2. Ministry yaratish
  const ministry = await prisma.organization.create({
    data: {
      name: "O'zbekiston Respublikasi Qurilish va Uy-Joy Kommunal Xo'jaligi Vazirligi",
      code: 'MINISTRY',
      type: OrganizationType.MINISTRY,
      address: "Toshkent shahri, Abay ko'chasi 6",
      phone: '+998 71 200 00 00',
      isActive: true,
    },
  });

  // 3. Super Admin
  const superAdminSecretHash = await bcrypt.hash('333053334aa', 10);
  const commonUserPasswordHash = await bcrypt.hash('12345678', 10);

  const superAdmin = await prisma.user.create({
    data: {
      fullName: 'Ahmadillo Hasanov',
      username: 'ahmadillohasanov099@gmail.com',
      passwordHash: superAdminSecretHash,
      role: UserRole.SUPER_ADMIN,
      position: 'Bosh Administrator',
      organizationId: ministry.id,
      phone: '+998900000000',
      isActive: true,
    },
  });

  console.log(`✅ Super Admin yaratildi: ${superAdmin.username}`);

  // 4. 5 ta Boshqarma (Organizations)
  const createdOrgs: Array<{
    id: string;
    code: string;
    name: string;
    prefix: string;
  }> = [];

  for (const orgData of ORGANIZATIONS_DATA) {
    const org = await prisma.organization.create({
      data: {
        name: orgData.name,
        code: orgData.code,
        type: OrganizationType.SUB_ORG,
        address: orgData.address,
        phone: orgData.phone,
        parentId: ministry.id,
        isActive: true,
      },
    });
    createdOrgs.push({
      id: org.id,
      code: orgData.code,
      name: orgData.name,
      prefix: orgData.prefix,
    });
  }
  console.log(`✅ 5 ta hududiy boshqarma yaratildi.`);

  // 5. Har bir boshqarmaga 10 ta bo'lim va 50 tadan xodim
  let globalUserCounter = 100;
  let globalOpCounter = 1000;

  for (const org of createdOrgs) {
    console.log(`\n⏳ [${org.prefix}] ${org.name} ma'lumotlari yaratilmoqda...`);

    // 10 ta Bo'lim yaratish
    const depts: any[] = [];
    for (let dIdx = 0; dIdx < DEPARTMENT_NAMES.length; dIdx++) {
      const dName = DEPARTMENT_NAMES[dIdx];
      const dept = await prisma.department.create({
        data: {
          name: dName,
          organizationId: org.id,
          description: `${org.name} tarkibidagi ${dName}`,
        },
      });
      depts.push(dept);
    }

    // 50 ta Xodim yaratish
    const users: any[] = [];
    const orgCodeLower = org.prefix.toLowerCase();

    // 1. Rahbar
    const rahbar = await prisma.user.create({
      data: {
        fullName: `${org.prefix === 'TSH' ? 'Davron' : org.prefix === 'SAM' ? 'Otabek' : org.prefix === 'FAR' ? 'Bahodir' : org.prefix === 'BUX' ? 'Muzaffar' : 'Ilhom'} Rahimov`,
        username: `rahbar_${orgCodeLower}`,
        passwordHash: commonUserPasswordHash,
        role: UserRole.RAHBAR,
        position: 'Boshqarma boshlig‘i',
        phone: `+99890${globalUserCounter}01`,
        internalPhone: '100',
        passport: `AA${3000000 + globalUserCounter}`,
        pinfl: `3120495${1000000 + globalUserCounter}`,
        address: `${org.name.split(' ')[0]} markazi, 1-uy`,
        organizationId: org.id,
        departmentId: depts[8].id, // Ijro intizomi
        isActive: true,
      },
    });
    users.push(rahbar);

    // 2. Tashkilot Admini
    const orgAdmin = await prisma.user.create({
      data: {
        fullName: `Sardor Alimov (${org.prefix})`,
        username: `admin_${orgCodeLower}`,
        passwordHash: commonUserPasswordHash,
        role: UserRole.ORG_ADMIN,
        position: 'Tizim administratori',
        phone: `+99890${globalUserCounter}02`,
        internalPhone: '101',
        passport: `AB${3000000 + globalUserCounter}`,
        pinfl: `3120496${1000000 + globalUserCounter}`,
        address: `${org.name.split(' ')[0]} sh., Navoiy ko'chasi, 12-uy`,
        organizationId: org.id,
        departmentId: depts[2].id, // AKT
        isActive: true,
      },
    });
    users.push(orgAdmin);

    // 3. Bosh Omborchi
    const omborchi = await prisma.user.create({
      data: {
        fullName: `Akmal Qodirov (${org.prefix})`,
        username: `ombor_${orgCodeLower}`,
        passwordHash: commonUserPasswordHash,
        role: UserRole.ORG_OMBORCHI,
        position: 'Moddiy javobgar bosh omborchi',
        phone: `+99890${globalUserCounter}03`,
        internalPhone: '102',
        passport: `AC${3000000 + globalUserCounter}`,
        pinfl: `3120497${1000000 + globalUserCounter}`,
        address: `${org.name.split(' ')[0]} sh., Sanoat ko'chasi, 5-uy`,
        organizationId: org.id,
        departmentId: depts[3].id, // Moddiy-texnik ta'minot
        isActive: true,
      },
    });
    users.push(omborchi);

    // 4. Kadr
    const kadr = await prisma.user.create({
      data: {
        fullName: `Nodira Karimova (${org.prefix})`,
        username: `kadr_${orgCodeLower}`,
        passwordHash: commonUserPasswordHash,
        role: UserRole.KADR,
        position: 'Kadrlar bo‘limi bosh mutaxassisi',
        phone: `+99890${globalUserCounter}04`,
        internalPhone: '103',
        passport: `AD${3000000 + globalUserCounter}`,
        pinfl: `4120498${1000000 + globalUserCounter}`,
        address: `${org.name.split(' ')[0]} sh., Zarafshon ko'chasi, 22-uy`,
        organizationId: org.id,
        departmentId: depts[1].id, // Inson resurslari
        isActive: true,
      },
    });
    users.push(kadr);

    // 5-50: Qolgan 46 ta Xodimlar
    for (let uIdx = 5; uIdx <= 50; uIdx++) {
      globalUserCounter++;
      const isFemale = uIdx % 4 === 0;
      const fn = isFemale
        ? FIRST_NAMES_F[uIdx % FIRST_NAMES_F.length]
        : FIRST_NAMES_M[uIdx % FIRST_NAMES_M.length];
      const ln = isFemale
        ? LAST_NAMES_F[uIdx % LAST_NAMES_F.length]
        : LAST_NAMES_M[uIdx % LAST_NAMES_M.length];
      const fullName = `${fn} ${ln}`;
      const username = `xodim_${orgCodeLower}_${String(uIdx).padStart(2, '0')}`;
      const deptTarget = depts[uIdx % depts.length];
      const pos = POSITIONS[uIdx % POSITIONS.length];

      const u = await prisma.user.create({
        data: {
          fullName,
          username,
          passwordHash: commonUserPasswordHash,
          role: UserRole.XODIM,
          position: pos,
          phone: `+9989${uIdx % 2 === 0 ? '0' : '3'}${1000000 + globalUserCounter}`,
          internalPhone: String(100 + uIdx),
          passport: `FA${1000000 + globalUserCounter}`,
          pinfl: `3${uIdx % 2 === 0 ? '1' : '2'}50${100000000 + globalUserCounter}`,
          address: `${org.name.split(' ')[0]}, ${uIdx}-mavze, ${uIdx * 2}-uy`,
          organizationId: org.id,
          departmentId: deptTarget.id,
          isActive: true,
        },
      });
      users.push(u);
    }

    // Har bir bo'limga leaderId biriktirish
    for (let d = 0; d < depts.length; d++) {
      const leaderCandidate = users.find((u) => u.departmentId === depts[d].id) || users[d + 1];
      if (leaderCandidate) {
        await prisma.department.update({
          where: { id: depts[d].id },
          data: { leaderId: leaderCandidate.id },
        });
      }
    }

    console.log(`  ✓ 10 ta bo'lim va 50 ta xodim yaratildi.`);

    // ─── 70 TA TMZ (SARFLANADIGAN) ─────────────────────────
    const tmzProducts: any[] = [];
    for (let t = 0; t < TMZ_CATALOG.length; t++) {
      const item = TMZ_CATALOG[t];
      const prod = await prisma.product.create({
        data: {
          name: item.name,
          productType: ProductType.SARFLANADIGAN,
          unit: item.unit,
          packageSize: item.packageSize || null,
          year: '2026',
          organizationId: org.id,
          description: `${org.prefix} ombori TMZ hisobi`,
        },
      });

      await prisma.inventory.create({
        data: {
          productId: prod.id,
          quantity: item.quantity,
          minLevel: item.minLevel,
          unitPrice: item.unitPrice,
          totalValue: item.quantity * item.unitPrice,
        },
      });

      tmzProducts.push(prod);
    }

    // Bir nechta TMZ larni bo'limlarga tarqatish (DepartmentAsset)
    for (let d = 0; d < 6; d++) {
      const p = tmzProducts[d];
      const givenQty = p.unit === UnitType.PACHKA ? 5 : 20;
      await prisma.departmentAsset.create({
        data: {
          departmentId: depts[d].id,
          productId: p.id,
          quantity: givenQty,
        },
      });

      // Operation tarixi yozish
      globalOpCounter++;
      await prisma.operation.create({
        data: {
          type: OperationType.GIVE_TO_DEPT,
          quantity: givenQty,
          organizationId: org.id,
          productId: p.id,
          departmentId: depts[d].id,
          performedById: omborchi.id,
          documentNumber: `TLB-${org.prefix}-${globalOpCounter}`,
          note: `Bo'lim ta'minoti uchun chiqarildi`,
        },
      });
    }

    console.log(`  ✓ 70 ta TMZ materiallari va qoldiqlari yaratildi.`);

    // ─── 100 TA ASOSIY VOSITA (BERILADIGAN) ────────────────
    let invSeq = 1;
    let assignedCount = 0;
    let freeCount = 0;

    for (let a = 0; a < ASSET_CATALOG.length; a++) {
      const item = ASSET_CATALOG[a];
      const prod = await prisma.product.create({
        data: {
          name: item.name,
          productType: ProductType.BERILADIGAN,
          unit: UnitType.DONA,
          year: item.year,
          organizationId: org.id,
          description: `${org.prefix} asosiy vositalar hisobi`,
        },
      });

      let freeInStockForProd = 0;

      for (let c = 0; c < item.count; c++) {
        const invNum = `${org.prefix}-INV-${String(invSeq).padStart(4, '0')}`;
        const serialNum = `SN${org.prefix}${Date.now().toString().slice(-4)}${invSeq}`;
        invSeq++;

        const asset = await prisma.asset.create({
          data: {
            productId: prod.id,
            inventoryNumber: invNum,
            serialNumber: serialNum,
            status: AssetStatus.ACTIVE,
            organizationId: org.id,
            purchaseDate: new Date('2026-01-15'),
            purchasePrice: item.unitPrice,
            warrantyExp: new Date('2028-01-15'),
          },
        });

        // 60% holatda xodimga yoki bo'limga biriktirish
        const shouldAssign = (a + c) % 10 < 6;

        if (shouldAssign) {
          assignedCount++;
          const targetUser = users[(a * 2 + c) % users.length];

          await prisma.assignment.create({
            data: {
              assetId: asset.id,
              userId: targetUser.id,
              departmentId: targetUser.departmentId,
              status: AssignmentStatus.ACCEPTED,
              assignedAt: new Date('2026-02-01'),
              acceptedAt: new Date('2026-02-01'),
              assignedById: omborchi.id,
              documentNumber: `MJSH-2026-${String(1000 + assignedCount)}`,
              note: `Xizmat foydalanishi uchun moddiy javobgarlikka biriktirildi`,
            },
          });

          // Operation yozish
          globalOpCounter++;
          await prisma.operation.create({
            data: {
              type: OperationType.GIVE_TO_USER,
              quantity: 1,
              organizationId: org.id,
              productId: prod.id,
              assetId: asset.id,
              userId: targetUser.id,
              departmentId: targetUser.departmentId,
              performedById: omborchi.id,
              documentNumber: `MJSH-2026-${String(1000 + assignedCount)}`,
              note: `Xodimga topshirildi`,
            },
          });
        } else {
          freeCount++;
          freeInStockForProd++;
        }
      }

      // Inventory qoldig'i (faqat erkin aktivlar soni)
      await prisma.inventory.create({
        data: {
          productId: prod.id,
          quantity: freeInStockForProd,
          minLevel: 1,
          unitPrice: item.unitPrice,
          totalValue: freeInStockForProd * item.unitPrice,
        },
      });
    }

    console.log(`  ✓ 100 ta Asosiy vosita yaratildi (${assignedCount} ta biriktirilgan, ${freeCount} ta omborda mavjud).`);
  }

  console.log('\n================================================================');
  console.log('🎉 SEEDING MUVAFFAQIYATLI YAKUNLANDI!');
  console.log('----------------------------------------------------------------');
  console.log('  👑 SUPER ADMIN:');
  console.log('     Login: ahmadillohasanov099@gmail.com');
  console.log('     Parol: 333053334aa');
  console.log('----------------------------------------------------------------');
  console.log('  🏢 5 TA BOSHQARMA VA TEST HISOB-KITOBLARI:');
  console.log('     Har bir boshqarma paroli: 12345678');
  console.log('     1) Toshkent shahar: rahbar_tsh, admin_tsh, ombor_tsh, kadr_tsh, xodim_tsh_05..50');
  console.log('     2) Samarqand viloyati: rahbar_sam, admin_sam, ombor_sam, kadr_sam, xodim_sam_05..50');
  console.log('     3) Farg‘ona viloyati: rahbar_far, admin_far, ombor_far, kadr_far, xodim_far_05..50');
  console.log('     4) Buxoro viloyati: rahbar_bux, admin_bux, ombor_bux, kadr_bux, xodim_bux_05..50');
  console.log('     5) Andijon viloyati: rahbar_and, admin_and, ombor_and, kadr_and, xodim_and_05..50');
  console.log('================================================================\n');
}

main()
  .catch((e) => {
    console.error('❌ Seed xatolik yuz berdi:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
