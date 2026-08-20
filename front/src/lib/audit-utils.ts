import type { BadgeVariant } from '../components/ui/badge';

export interface AuditActionDetails {
  title: string;
  description: string;
  category: string;
  badgeVariant: BadgeVariant;
}

export function getResourceLabel(resource?: string): string {
  switch (resource?.toUpperCase()) {
    case 'USER':
    case 'USERS':
      return 'Xodim';
    case 'PRODUCT':
    case 'PRODUCTS':
      return 'Mahsulot';
    case 'ASSET':
    case 'ASSETS':
      return 'Jihoz';
    case 'DEPARTMENT':
    case 'DEPARTMENTS':
      return 'Bo\'lim';
    case 'INVENTORY':
      return 'Ombor';
    case 'OPERATION':
    case 'OPERATIONS':
      return 'Operatsiya';
    case 'DELETION_REQUEST':
      return 'So\'rov';
    case 'ORGANIZATION':
      return 'Tashkilot';
    case 'AUTH':
      return 'Autentifikatsiya';
    default:
      return resource || 'Resurs';
  }
}

export function getActionDetails(
  action: string,
  payload?: any,
  resource?: string,
  endpoint?: string,
): AuditActionDetails {
  const act = action?.toUpperCase() || '';
  const ep = endpoint?.toLowerCase() || '';

  // 1. Auth Operations
  if (act.includes('LOGIN') || ep.includes('/auth/login')) {
    const userStr = payload?.username ? `"${payload.username}"` : '';
    return {
      title: "🔑 Tizimga kirish (Login)",
      description: userStr
        ? `Foydalanuvchi ${userStr} tizimga muvaffaqiyatli kirdi`
        : "Foydalanuvchi tizimga muvaffaqiyatli kirdi",
      category: "Xavfsizlik",
      badgeVariant: "info",
    };
  }

  if (act.includes('LOGOUT') || ep.includes('/auth/logout')) {
    return {
      title: "🚪 Tizimdan chiqish (Logout)",
      description: "Foydalanuvchi tizim seansini yakunladi va tizimdan chiqdi",
      category: "Xavfsizlik",
      badgeVariant: "gray",
    };
  }

  // 2. Specific Operations Endpoints
  if (ep.includes('/operations/give-to-user')) {
    return {
      title: "📦 Xodimga jihoz berildi",
      description: "Ombordagi jihoz/aktiv xodimga rasman topshirildi va biriktirildi",
      category: "Jihoz Operatsiyasi",
      badgeVariant: "success",
    };
  }

  if (ep.includes('/operations/return-from-user')) {
    return {
      title: "📥 Xodimdan jihoz qaytarildi",
      description: "Xodim zimmasidagi jihoz omborchi tomonidan omborga qabul qilib olindi",
      category: "Jihoz Operatsiyasi",
      badgeVariant: "warning",
    };
  }

  if (ep.includes('/operations/give-tmz-user')) {
    return {
      title: "📋 Xodimga material (TMZ) berildi",
      description: "Xodimga foydalanish uchun sarflanuvchi material/TMZ berildi",
      category: "Material Operatsiyasi",
      badgeVariant: "info",
    };
  }

  if (ep.includes('/operations/assign-to-dept')) {
    return {
      title: "🏢 Bo'limga jihoz biriktirildi",
      description: "Bo'lim foydalanishi uchun umumiy jihoz/aktiv biriktirildi",
      category: "Bo'lim Operatsiyasi",
      badgeVariant: "purple",
    };
  }

  if (ep.includes('/operations/give-to-dept')) {
    return {
      title: "🏢 Bo'limga material (TMZ) berildi",
      description: "Bo'lim ehtiyojlari uchun sarflanuvchi materiallar topshirildi",
      category: "Bo'lim Operatsiyasi",
      badgeVariant: "purple",
    };
  }

  if (ep.includes('/operations/return-from-dept')) {
    return {
      title: "📥 Bo'limdan jihoz qaytarildi",
      description: "Bo'lim biriktiruvidagi jihoz omborga qaytarib olindi",
      category: "Bo'lim Operatsiyasi",
      badgeVariant: "warning",
    };
  }

  if (ep.includes('/operations/transfer-user')) {
    return {
      title: "🔄 Jihoz bir xodimdan boshqasiga o'tkazildi",
      description: "Jihoz bir xodim zimmasidan ikkinchi xodim zimmasiga qayta biriktirildi",
      category: "O'tkazma",
      badgeVariant: "purple",
    };
  }

  if (ep.includes('/operations/stock-in') || ep.includes('/inventory/stock-in')) {
    return {
      title: "📥 Omborga kirim qilindi",
      description: "Omborga yangi mahsulotlar/jihozlar kirim qilinib, balansga olindi",
      category: "Kirim Operatsiyasi",
      badgeVariant: "success",
    };
  }

  if (ep.includes('/operations/bulk-stock-in')) {
    return {
      title: "📦 Omborga ommaviy kirim qilindi",
      description: "Bir nechta turdagi mahsulotlar ommaviy tartibda omborga kirim qilindi",
      category: "Kirim Operatsiyasi",
      badgeVariant: "success",
    };
  }

  if (ep.includes('/operations/write-off') || ep.includes('/inventory/write-off')) {
    return {
      title: "🗑️ Ombordan hisobdan chiqarildi (Spisaniye)",
      description: payload?.reason
        ? `Hisobdan chiqarish sababi: "${payload.reason}"`
        : "Jihoz eskirganligi yoki yaroqsizligi sababli ombor balansidan chiqarildi",
      category: "Hisobdan Chiqarish",
      badgeVariant: "danger",
    };
  }

  // 3. Deletion Requests
  if (act.includes('CREATE_DELETION_REQUEST') || (ep.includes('/deletion-requests') && !ep.includes('/approve') && !ep.includes('/reject'))) {
    return {
      title: "📩 O'chirish/Qaytarish so'rovi yuborildi",
      description: payload?.reason
        ? `So'rov sababi: "${payload.reason}"`
        : "Jihozni omborga qaytarish yoki o'chirish bo'yicha so'rov yuborildi",
      category: "So'rovlar",
      badgeVariant: "warning",
    };
  }

  if (act.includes('APPROVE_DELETION_REQUEST') || ep.includes('/deletion-requests/') && ep.includes('/approve')) {
    return {
      title: "✅ O'chirish so'rovi tasdiqlandi",
      description: "Mas'ul admin tomonidan so'rov tasdiqlandi va jihoz hisobdan chiqarildi",
      category: "So'rovlar",
      badgeVariant: "success",
    };
  }

  if (act.includes('REJECT_DELETION_REQUEST') || ep.includes('/deletion-requests/') && ep.includes('/reject')) {
    return {
      title: "❌ O'chirish so'rovi rad etildi",
      description: payload?.rejectionReason
        ? `Rad etish sababi: "${payload.rejectionReason}"`
        : "O'chirish so'rovi rad etildi",
      category: "So'rovlar",
      badgeVariant: "danger",
    };
  }

  // 4. Users Management
  if (ep.includes('/users')) {
    if (act.startsWith('CREATE') || ep.endsWith('/users')) {
      const name = payload?.fullName || payload?.username;
      return {
        title: "👤 Yangi xodim qo'shildi",
        description: name ? `Xodim: "${name}"` : "Tizimga yangi xodim ro'yxatga olindi",
        category: "Xodimlarni Boshqarish",
        badgeVariant: "success",
      };
    }
    if (act.startsWith('UPDATE') || act.includes('STATUS')) {
      return {
        title: "✏️ Xodim ma'lumotlari yangilandi",
        description: "Xodim shaxsiy ma'lumotlari, roli yoki faollik holati o'zgartirildi",
        category: "Xodimlarni Boshqarish",
        badgeVariant: "warning",
      };
    }
    if (act.startsWith('DELETE')) {
      return {
        title: "🚫 Xodim tizimdan o'chirildi",
        description: "Xodim ma'lumotlar bazasidan hisobdan chiqarildi/o'chirildi",
        category: "Xodimlarni Boshqarish",
        badgeVariant: "danger",
      };
    }
  }

  // 5. Departments Management
  if (ep.includes('/departments')) {
    if (act.startsWith('CREATE')) {
      const name = payload?.name;
      return {
        title: "🏛️ Yangi bo'lim yaratildi",
        description: name ? `Bo'lim nomi: "${name}"` : "Tashkilot tarkibida yangi bo'lim tuzildi",
        category: "Bo'limlar Boshqaruvi",
        badgeVariant: "success",
      };
    }
    if (act.startsWith('UPDATE')) {
      return {
        title: "✏️ Bo'lim tahrirlandi",
        description: "Bo'lim nomi yoki tavsifi yangilandi",
        category: "Bo'limlar Boshqaruvi",
        badgeVariant: "warning",
      };
    }
    if (act.startsWith('DELETE')) {
      return {
        title: "🗑️ Bo'lim o'chirildi",
        description: "Bo'lim ma'lumotlar bazasidan o'chirildi",
        category: "Bo'limlar Boshqaruvi",
        badgeVariant: "danger",
      };
    }
  }

  // Fallback pattern matching
  if (act.startsWith('CREATE_')) {
    const resName = getResourceLabel(resource || act.replace('CREATE_', ''));
    const name = payload?.name || payload?.fullName || payload?.title || payload?.entityName;
    return {
      title: `✨ Yangi ${resName.toLowerCase()} qo'shildi`,
      description: name ? `Nomi: "${name}"` : `Yangi ${resName.toLowerCase()} qo'shildi`,
      category: "Yaratish",
      badgeVariant: "success",
    };
  }

  if (act.startsWith('UPDATE_')) {
    const resName = getResourceLabel(resource || act.replace('UPDATE_', ''));
    return {
      title: `✏️ ${resName} tahrirlandi`,
      description: `${resName} ma'lumotlari yangilandi va saqlandi`,
      category: "Tahrirlash",
      badgeVariant: "warning",
    };
  }

  if (act.startsWith('DELETE_')) {
    const resName = getResourceLabel(resource || act.replace('DELETE_', ''));
    return {
      title: `🗑️ ${resName} o'chirildi`,
      description: `${resName} ma'lumotlar bazasidan o'chirildi`,
      category: "O'chirish",
      badgeVariant: "danger",
    };
  }

  return {
    title: `⚡ ${action}`,
    description: "Tizimda amaliyot bajarildi",
    category: "Amaliyot",
    badgeVariant: "info",
  };
}

export function formatPayloadKey(key: string): string {
  const map: Record<string, string> = {
    username: "Login / Foydalanuvchi nomi",
    fullName: "F.I.SH (To'liq ismi)",
    name: "Nomi / Sarlavhasi",
    reason: "Asoslash sababi",
    rejectionReason: "Rad etish sababi",
    role: "Tizimdagi roli",
    phone: "Telefon raqami",
    position: "Lavozimi",
    entityType: "Resurs turi",
    entityId: "Resurs ID-si",
    entityName: "Resurs nomi",
    status: "Holati (Status)",
    quantity: "Soni / Miqdori",
    unitPrice: "Birlik narxi",
    totalValue: "Umumiy qiymati",
    description: "Izoh / Tavsifi",
    password: "Parol",
    documentNumber: "Hujjat № / AKT",
    inventoryNumber: "Inventar №",
    serialNumber: "Seriya №",
    userId: "Xodim ID-si",
    departmentId: "Bo'lim ID-si",
  };
  return map[key] || key;
}
