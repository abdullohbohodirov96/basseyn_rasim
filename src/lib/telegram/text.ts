export const TXT = {
  unauthorized:
    "⛔ Sizda ushbu botdan foydalanish uchun ruxsat mavjud emas. Administratorga murojaat qiling.",
  inactiveUser:
    "⛔ Sizning hisobingiz faol emas. Administratorga murojaat qiling.",
  welcome: (name: string) => `Assalomu alaykum, ${name}! Quyidagi menyudan foydalaning.`,
  mainMenuPrompt: "Asosiy menyu:",
  askObjectName: "Yangi obyekt nomini kiriting:",
  objectNameTooShort: "❌ Obyekt nomi kamida 2 ta belgidan iborat bo'lishi kerak. Qaytadan kiriting:",
  objectNameTooLong: "❌ Obyekt nomi 150 ta belgidan oshmasligi kerak. Qaytadan kiriting:",
  objectCreated: "✅ Obyekt muvaffaqiyatli qo'shildi.",
  askObjectRename: "Obyektning yangi nomini kiriting:",
  objectRenamed: "✅ Obyekt nomi muvaffaqiyatli o'zgartirildi.",
  noObjects: "Sizga biriktirilgan obyektlar mavjud emas.",
  objectsListTitle: "🏗 Obyektlar:",
  archiveConfirm:
    "Obyektni arxivlamoqchimisiz?\n\nObyekt, rasmlar va izohlar o'chmaydi. Keyinchalik obyektni qayta tiklash mumkin.",
  archived: "✅ Obyekt arxivlandi.",
  restoreConfirm: "Obyektni arxivdan qayta tiklamoqchimisiz?",
  restored: "✅ Obyekt qayta tiklandi.",
  deleteConfirm1:
    "⚠️ DIQQAT! Obyektni butunlay o'chirmoqchimisiz?\n\nBu amalni ORQAGA QAYTARIB BO'LMAYDI. Barcha rasmlar va izohlar butunlay o'chiriladi.",
  deleteConfirm2:
    "⚠️ OXIRGI TASDIQ. Obyekt va unga tegishli BARCHA ma'lumotlar butunlay o'chiriladi.\n\nRostdan ham davom etasizmi?",
  deleted: "✅ Obyekt butunlay o'chirildi.",
  cancelled: "❌ Bekor qilindi.",
  askPhoto:
    "Rasmni yuboring.\n\nEng yuqori sifatni saqlash uchun rasmni Telegram'da File yoki Document shaklida yuboring.\n\nBir yoki bir nechta rasm yuborishingiz mumkin.",
  photoTooLarge: (maxMb: number) => `❌ Fayl hajmi ${maxMb} MB dan katta. Kichikroq fayl yuboring.`,
  unsupportedFileType: "❌ Qo'llab-quvvatlanmaydigan fayl turi. JPEG, PNG, WEBP yoki HEIC yuboring.",
  duplicateFile: "⚠️ Bu fayl allaqachon shu obyektga yuklangan.",
  photoSaving: "⏳ Rasm saqlanmoqda...",
  photoSaved: (params: {
    objectName: string;
    date: string;
    time: string;
    uploader: string;
    comment: string;
  }) =>
    `✅ Rasm saqlandi\n\n🏗 Obyekt: ${params.objectName}\n📅 Sana: ${params.date}\n🕐 Vaqt: ${params.time}\n👤 Yuklagan: ${params.uploader}\n📝 Izoh: ${params.comment}`,
  noComment: "izohsiz",
  askComment: "Rasm uchun izoh yozing:",
  askBulkComment: "Barcha yuklangan rasmlar uchun umumiy izoh yozing:",
  noPhotosYet: "Bu obyektda hali rasmlar mavjud emas.",
  photoCaption: (params: {
    index: number;
    total: number;
    date: string;
    time: string;
    uploader: string;
    comment: string;
  }) =>
    `📷 ${params.index} / ${params.total}\n📅 ${params.date}\n🕐 ${params.time}\n👤 ${params.uploader}\n📝 ${params.comment}`,
  askFilterStartDate: "Boshlanish sanasini kiriting (KK.OO.YYYY):",
  askFilterEndDate: "Tugash sanasini kiriting (KK.OO.YYYY):",
  askFilterUploader: "Yuklovchi ismini kiriting:",
  askFilterKeyword: "Izohdagi kalit so'zni kiriting:",
  invalidDate: "❌ Sana formati noto'g'ri. Namuna: 16.07.2026",
  askUserTelegramId: "Yangi foydalanuvchining Telegram ID raqamini kiriting yoki xabarini forward qiling:",
  askUserFullName: "Foydalanuvchining to'liq ismini kiriting:",
  userAdded: "✅ Foydalanuvchi muvaffaqiyatli qo'shildi.",
  userAlreadyExists: "⚠️ Bu foydalanuvchi allaqachon mavjud.",
  userDeactivated: "✅ Foydalanuvchi faolsizlantirildi.",
  userActivated: "✅ Foydalanuvchi faollashtirildi.",
  usersMenu: "Foydalanuvchilar menyusi:",
  objectMenu: "Obyekt menyusi:",
  selectRole: "Foydalanuvchi uchun rol tanlang:",
  roleChanged: "✅ Foydalanuvchi roli o'zgartirildi.",
  genericError: "❌ Xatolik yuz berdi. Birozdan so'ng qayta urinib ko'ring.",
  settingsMenu: "⚙️ Sozlamalar",
  yourRole: (role: string) => `Sizning rolingiz: ${role}`,
} as const;

export const BTN = {
  objects: "🏗 Obyektlar",
  addObject: "➕ Obyekt qo'shish",
  archive: "🗂 Arxiv",
  users: "👥 Foydalanuvchilar",
  settings: "⚙️ Sozlamalar",
  addPhoto: "📷 Rasm qo'shish",
  viewPhotos: "🖼 Rasmlarni ko'rish",
  rename: "✏️ Nomini o'zgartirish",
  viewStaff: "👥 Xodimlarni ko'rish",
  archiveObject: "🗂 Arxivlash",
  back: "⬅️ Orqaga",
  confirmArchive: "✅ Arxivlash",
  cancel: "❌ Bekor qilish",
  writeComment: "✍️ Izoh yozish",
  skipComment: "⏭ Izohsiz saqlash",
  moreImages: "➕ Yana rasm",
  finish: "✅ Yakunlash",
  prevPage: "⬅️ Oldingi",
  nextPage: "➡️ Keyingi",
  downloadOriginal: "📥 Originalni olish",
  filter: "🔎 Filtrlash",
  backToObject: "⬅️ Obyektga qaytish",
  restore: "♻️ Qayta tiklash",
  permanentlyDelete: "🗑 Butunlay o'chirish",
  addUser: "➕ Foydalanuvchi qo'shish",
  usersList: "👤 Foydalanuvchilar ro'yxati",
  assignUserToObject: "🔗 Obyektga biriktirish",
  removeUser: "🚫 Foydalanuvchini o'chirish",
} as const;
