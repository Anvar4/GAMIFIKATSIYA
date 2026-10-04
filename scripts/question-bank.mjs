// IT ARENA — savollar banki (manba).
// Har bir tanlovli savolda TOʻGʻRI JAVOB `o` massivining BIRINCHI elementi.
// scripts/build-seed.mjs variantlarni deterministik aralashtirib,
// supabase/seed.sql va supabase/seed/question_bank.json fayllarini yaratadi.
//
// Maydonlar:
//   c  — kategoriya, d — qiyinlik (easy|medium|hard), t — savol turi,
//   q  — savol matni, o — variantlar (birinchisi toʻgʻri),
//   a  — true_false uchun true/false; short_answer uchun qabul qilinadigan javoblar,
//   e  — izoh, h — maslahat (HINT SCAN), img — /assets/devices/<img>.webp, r — tavsiya etilgan raund
//   pairs — moslashtirish (matching) uchun [chap, oʻng] juftliklar
//   steps — koʻp bosqichli zanjir uchun [{ q, o }] (har bir qadamda o[0] — toʻgʻri javob)

const TF = 'true_false';
const SC = 'single_choice';
const IMG = 'image_identification';
const SA = 'short_answer';
const LP = 'logical_puzzle';
const MATCH = 'matching';
const CHAIN = 'multi_step';

export const QUESTION_BANK = [
  // =================================================================
  // 1-RAUND — BILIMLAR SINOVI (asosiy bilimlar)
  // =================================================================

  // --- Kompyuter qurilmalari va dasturiy taʼminot ---
  {
    c: 'devices_software', d: 'easy', t: SC, r: 1,
    q: 'Kompyuterning qoʻl bilan ushlash mumkin boʻlgan fizik qismlari qanday ataladi?',
    o: ['Apparat taʼminoti (hardware)', 'Dasturiy taʼminot (software)', 'Operatsion tizim', 'Drayver'],
    e: 'Apparat taʼminoti — kompyuterning fizik qismlari: korpus, monitor, klaviatura, protsessor va boshqalar.',
    h: 'Bu qismlarni koʻrish va ushlash mumkin.',
  },
  {
    c: 'devices_software', d: 'easy', t: SC, r: 1,
    q: 'Quyidagilardan qaysi biri amaliy dasturiy taʼminotga misol boʻladi?',
    o: ['Matn muharriri', 'Operatsion tizim', 'Qurilma drayveri', 'Kompyuterni yuklovchi dastur (BIOS)'],
    e: 'Amaliy dasturlar foydalanuvchiga aniq vazifani bajarishda yordam beradi: matn yozish, jadval tuzish, rasm chizish.',
    h: 'Foydalanuvchi oʻz ishini bajarish uchun ishlatadigan dasturni toping.',
  },
  {
    c: 'devices_software', d: 'medium', t: SC, r: 1,
    q: 'Tizim dasturiy taʼminotining asosiy vazifasi nima?',
    o: [
      'Kompyuter apparatini boshqarish va boshqa dasturlar ishlashi uchun muhit yaratish',
      'Faqat kompyuter oʻyinlarini ishga tushirish',
      'Hujjatlarni chiroyli bezash',
      'Internetdan rasmlarni yuklab olish',
    ],
    e: 'Tizim dasturlari (operatsion tizim, drayverlar, utilitalar) apparatni boshqaradi va amaliy dasturlarga xizmat qiladi.',
    h: 'Operatsion tizim ham shu guruhga kiradi.',
  },
  {
    c: 'devices_software', d: 'easy', t: TF, r: 1, a: true,
    q: 'Drayver — bu qurilma bilan operatsion tizim oʻrtasida aloqa oʻrnatadigan dastur.',
    e: 'Toʻgʻri. Drayver operatsion tizimga printer, skaner kabi qurilmani qanday boshqarishni “tushuntiradi”.',
    h: 'Yangi printer ulanganda kompyuter nimani oʻrnatadi?',
  },
  {
    c: 'devices_software', d: 'medium', t: SC, r: 1,
    q: 'Mikrofondan kelgan analog ovoz signalini kompyuter qayta ishlashi uchun u qanday shaklga oʻtkazilishi kerak?',
    o: ['Raqamli (ikkilik) shaklga', 'Optik shaklga', 'Mexanik shaklga', 'Hech qanday oʻzgartirish kerak emas'],
    e: 'Kompyuter faqat raqamli (0 va 1) maʼlumot bilan ishlaydi. Analog-raqamli oʻzgartirgich (ADC) signalni raqamliga aylantiradi.',
    h: 'Kompyuter faqat 0 va 1 ni tushunadi.',
  },

  // --- Kompyuter tizimining asosiy komponentlari ---
  {
    c: 'system_components', d: 'easy', t: SC, r: 1,
    q: 'Kompyuterning “miyasi” deb ataladigan, buyruqlarni bajaradigan qismi qaysi?',
    o: ['Markaziy protsessor (CPU)', 'Monitor', 'Qattiq disk', 'Klaviatura'],
    e: 'Markaziy protsessor dastur buyruqlarini bajaradi va hisob-kitoblarni amalga oshiradi.',
    h: 'Uning qisqartmasi uch harfdan iborat.',
  },
  {
    c: 'system_components', d: 'easy', t: SC, r: 1,
    q: 'Kompyuter oʻchirilganda operativ xotira (RAM)dagi maʼlumotlar bilan nima sodir boʻladi?',
    o: ['Oʻchib ketadi', 'Toʻliq saqlanib qoladi', 'Avtomatik ravishda ROMga koʻchadi', 'Internetga yuboriladi'],
    e: 'RAM — energiyaga bogʻliq (volatile) xotira: elektr oʻchishi bilan undagi maʼlumot yoʻqoladi.',
    h: 'Shuning uchun hujjatni oʻchirishdan oldin saqlash kerak.',
  },
  {
    c: 'system_components', d: 'medium', t: SC, r: 1,
    q: 'ROM xotirasining asosiy xususiyati qaysi?',
    o: [
      'Asosan oʻqish uchun moʻljallangan va elektr oʻchganda ham maʼlumot saqlanadi',
      'Elektr oʻchishi bilan tozalanadi',
      'Foydalanuvchi har kuni unga oʻyin yozadi',
      'Faqat videofayllarni saqlaydi',
    ],
    e: 'ROM (Read Only Memory) — doimiy xotira. Unda kompyuterni ishga tushirish dasturi (BIOS/UEFI) saqlanadi.',
    h: 'Read Only Memory — “faqat oʻqish uchun xotira”.',
  },
  {
    c: 'system_components', d: 'medium', t: SC, r: 1,
    q: 'Kompyuter yoqilganda uni ishga tushirish (boot) koʻrsatmalari odatda qayerda saqlanadi?',
    o: ['ROM xotirada', 'RAM xotirada', 'Monitorda', 'Sichqonchada'],
    e: 'Yuklovchi koʻrsatmalar ROMda saqlanadi, chunki ular elektr oʻchganda ham yoʻqolmasligi kerak.',
    h: 'Bu xotira elektr oʻchganda ham maʼlumotni yoʻqotmaydi.',
  },
  {
    c: 'system_components', d: 'medium', t: SC, r: 1,
    q: 'Quyidagilardan qaysi biri kompyuterning ICHKI xotirasiga kiradi?',
    o: ['RAM va ROM', 'USB fleshka', 'DVD disk', 'Tashqi qattiq disk'],
    e: 'Ichki (asosiy) xotira — protsessor bevosita foydalanadigan RAM va ROM. Qolganlari tashqi (yordamchi) xotira.',
    h: 'Ular ona platada joylashgan.',
  },
  {
    c: 'system_components', d: 'easy', t: SC, r: 1,
    q: 'Tashqi (yordamchi) xotira qurilmalarining asosiy vazifasi nima?',
    o: ['Maʼlumotlarni uzoq muddat saqlash', 'Dastur buyruqlarini bajarish', 'Tasvirni ekranda koʻrsatish', 'Ovozni yozib olish'],
    e: 'Qattiq disk, SSD, fleshka kabi qurilmalar maʼlumotni elektr oʻchganda ham uzoq muddat saqlaydi.',
    h: 'Fayllaringiz kompyuter oʻchganda qayerda qoladi?',
  },

  // --- Operatsion tizimlar ---
  {
    c: 'operating_systems', d: 'easy', t: SC, r: 1,
    q: 'Quyidagilardan qaysi biri operatsion tizim?',
    o: ['Linux', 'Microsoft Word', 'Google Chrome', 'Paint'],
    e: 'Linux — operatsion tizim. Qolganlari operatsion tizim ichida ishlaydigan amaliy dasturlar.',
    h: 'Uning ramzi — pingvin.',
  },
  {
    c: 'operating_systems', d: 'easy', t: SC, r: 1,
    q: 'GUI qisqartmasi nimani anglatadi?',
    o: ['Grafik foydalanuvchi interfeysi', 'Buyruqlar satri interfeysi', 'Global foydalanuvchi interneti', 'Grafik ulanish indeksi'],
    e: 'GUI (Graphical User Interface) — oynalar, belgilar (ikonkalar) va menyular orqali boshqariladigan interfeys.',
    h: 'G — Graphical.',
  },
  {
    c: 'operating_systems', d: 'medium', t: SC, r: 1,
    q: 'Buyruqlar satri interfeysi (CLI)ning GUIga nisbatan afzalligi qaysi?',
    o: [
      'Tajribali foydalanuvchiga tizimni toʻliqroq va tezroq boshqarish imkonini beradi',
      'Yangi boshlovchilar uchun oʻrganish juda oson',
      'Buyruqlarni yodlash umuman shart emas',
      'Faqat sichqoncha bilan boshqariladi',
    ],
    e: 'CLIda buyruqlar yoziladi: u kam resurs talab qiladi va mutaxassisga koʻproq imkoniyat beradi, lekin buyruqlarni bilish kerak.',
    h: 'Bu interfeysdan koʻpincha tizim administratorlari foydalanadi.',
  },
  {
    c: 'operating_systems', d: 'hard', t: SC, r: 1,
    q: 'WIMP interfeysi qaysi elementlardan iborat?',
    o: [
      'Oynalar, belgilar (ikonkalar), menyular, koʻrsatkich',
      'Veb, internet, pochta, printer',
      'Wi-Fi, kiritish, xotira, protsessor',
      'Soʻz, rasm, musiqa, foto',
    ],
    e: 'WIMP — Windows, Icons, Menus, Pointer. Bu grafik interfeysning klassik koʻrinishi.',
    h: 'W — Windows, P — Pointer.',
  },
  {
    c: 'operating_systems', d: 'easy', t: TF, r: 1, a: true,
    q: 'Operatsion tizim xotirani, fayllarni va ulangan qurilmalarni boshqaradi.',
    e: 'Toʻgʻri. Bular operatsion tizimning asosiy vazifalari.',
    h: 'Operatsion tizim — kompyuterning “boshqaruvchisi”.',
  },

  // --- Kompyuter turlari ---
  {
    c: 'computer_types', d: 'medium', t: SC, r: 1,
    q: 'Mainframe kompyuterlar asosan qayerda ishlatiladi?',
    o: [
      'Banklar va yirik tashkilotlarda juda koʻp tranzaksiyalarni qayta ishlashda',
      'Uyda kompyuter oʻyinlari oʻynashda',
      'Qoʻl soatida qadamlarni sanashda',
      'Fleshkada fayl saqlashda',
    ],
    e: 'Mainframe — bir vaqtda minglab foydalanuvchi va tranzaksiyalarga xizmat qiladigan kuchli kompyuter.',
    h: 'Bank kartangiz bilan toʻlov qilganingizda shunday tizim ishlaydi.',
  },
  {
    c: 'computer_types', d: 'easy', t: SC, r: 1,
    q: 'Noutbukning stol kompyuteriga nisbatan asosiy afzalligi qaysi?',
    o: ['Koʻchma — uni osongina olib yurish mumkin', 'Har doim kuchliroq', 'Qismlarini almashtirish osonroq', 'Elektr energiyasini koʻproq sarflaydi'],
    e: 'Noutbukda batareya, ekran va klaviatura bitta korpusda — uni istalgan joyga olib borish mumkin.',
    h: 'Uni sumkada olib yurish mumkin.',
  },
  {
    c: 'computer_types', d: 'medium', t: SC, r: 1,
    q: 'Stol kompyuterining (desktop) noutbukka nisbatan afzalligi qaysi?',
    o: [
      'Qismlarini almashtirish va kengaytirish osonroq',
      'Batareyada uzoq ishlaydi',
      'Choʻntakka sigʻadi',
      'Unda doim sensorli ekran boʻladi',
    ],
    e: 'Stol kompyuterining korpusi katta, shuning uchun xotira, videokarta kabi qismlarni oson almashtirish mumkin; u yaxshiroq sovutiladi.',
    h: 'Korpusi katta va ochiladi.',
  },
  {
    c: 'computer_types', d: 'easy', t: SC, r: 1,
    q: 'Smart soat qaysi kompyuter turiga kiradi?',
    o: ['Taqiladigan qurilma (wearable)', 'Mainframe', 'Superkompyuter', 'Stol kompyuteri'],
    e: 'Smart soat — tanaga taqiladigan kichik kompyuter: puls, qadamlar va xabarlarni kuzatadi.',
    h: 'Uni qoʻlga taqib yurish mumkin.',
  },

  // --- Yangi texnologiyalarning taʼsiri ---
  {
    c: 'new_technologies', d: 'easy', t: SC, r: 1,
    q: 'Sunʼiy intellekt (AI) deganda nima tushuniladi?',
    o: [
      'Inson tafakkuriga oʻxshab oʻrganadigan va qaror qabul qiladigan kompyuter tizimlari',
      'Faqat juda tez ishlaydigan protsessor',
      'Internet tezligining oʻlchov birligi',
      'Qogʻozga chop etishning yangi usuli',
    ],
    e: 'Sunʼiy intellekt — nutqni tanish, tasvirni aniqlash, tarjima qilish kabi “aqlli” vazifalarni bajaradigan tizimlar.',
    h: 'Ovozli yordamchilar va tarjimonlar shunga misol.',
  },
  {
    c: 'new_technologies', d: 'medium', t: SC, r: 1,
    q: 'Qaysi texnologiya real dunyo tasviri ustiga virtual obyektlarni qoʻshib koʻrsatadi?',
    o: ['Kengaytirilgan reallik (AR)', 'Virtual reallik (VR)', 'Bulutli saqlash', 'Bluetooth'],
    e: 'AR real muhitni saqlab, ustiga raqamli obyektlar qoʻshadi. VR esa foydalanuvchini butunlay virtual dunyoga olib kiradi.',
    h: 'Telefon kamerasida real xona koʻrinadi, ustida esa virtual mebel paydo boʻladi.',
  },
  {
    c: 'new_technologies', d: 'medium', t: SC, r: 1,
    q: 'Robotlarning ishlab chiqarishdagi afzalligi qaysi?',
    o: [
      'Charchamasdan, bir xil aniqlikda uzoq ishlay oladi',
      'Hech qachon taʼmir talab qilmaydi',
      'Ularni oʻrnatish hech qanday xarajat talab qilmaydi',
      'Har qanday kutilmagan vaziyatda inson kabi qaror qabul qiladi',
    ],
    e: 'Robotlar takroriy ishlarni yuqori aniqlikda bajaradi, lekin ular qimmat va texnik xizmat talab qiladi.',
    h: 'Robot dam olishga muhtoj emas.',
  },
  {
    c: 'new_technologies', d: 'hard', t: SC, r: 1,
    q: 'Avtonom (oʻzi boshqariladigan) avtomobillarning kamchiliklaridan biri qaysi?',
    o: [
      'Sensor yoki dasturiy xatolik baxtsiz hodisaga olib kelishi mumkin',
      'Ular umuman energiya sarflamaydi',
      'Ular faqat kechasi harakatlana oladi',
      'Ular hech qanday sensor ishlatmaydi',
    ],
    e: 'Avtonom avtomobillar sensorlar va dasturga tayanadi: ulardagi nosozlik xavfli boʻlishi mumkin, xakerlik hujumi xavfi ham bor.',
    h: 'Kamera yoki radar xato qilsa nima boʻladi?',
  },

  // --- Kiritish qurilmalari ---
  {
    c: 'input_devices', d: 'easy', t: SC, r: 1,
    q: 'Quyidagilardan qaysi biri kiritish qurilmasi?',
    o: ['Mikrofon', 'Monitor', 'Printer', 'Karnay'],
    e: 'Mikrofon ovozni kompyuterga kiritadi. Monitor, printer va karnay — chiqarish qurilmalari.',
    h: 'U ovozni “tinglaydi”.',
  },
  {
    c: 'input_devices', d: 'medium', t: SC, r: 1,
    q: 'Grafik planshet asosan kimlar uchun qulay?',
    o: ['Rassom va dizaynerlar', 'Faqat buxgalterlar', 'Ovoz yozuvchi musiqachilar', 'Server administratorlari'],
    e: 'Grafik planshetda maxsus qalam bilan chizish mumkin — bu qoʻl harakatini aniq kiritadi.',
    h: 'Unda qalam bilan chiziladi.',
  },
  {
    c: 'input_devices', d: 'medium', t: SC, r: 1,
    q: 'Sensorli ekran qanday qurilma hisoblanadi?',
    o: ['Ham kiritish, ham chiqarish qurilmasi', 'Faqat kiritish qurilmasi', 'Faqat chiqarish qurilmasi', 'Saqlash qurilmasi'],
    e: 'Sensorli ekran barmoq teginishini qabul qiladi (kiritish) va tasvirni koʻrsatadi (chiqarish).',
    h: 'U ham koʻrsatadi, ham teginishni sezadi.',
  },
  {
    c: 'input_devices', d: 'easy', t: SC, r: 1,
    q: 'Raqamli fotokamera kompyuterga nimani kiritadi?',
    o: ['Tasvir va videoni', 'Faqat matnni', 'Faqat ovozni', 'Elektr energiyasini'],
    e: 'Raqamli kamera tasvirni raqamli faylga aylantiradi va uni kompyuterga uzatish mumkin.',
    h: 'U suratga oladi.',
  },

  // --- Bevosita kiritish qurilmalari ---
  {
    c: 'direct_entry', d: 'medium', t: SC, r: 1,
    q: 'Test javob varaqalaridagi qora qilib boʻyalgan kataklarni oʻqiydigan texnologiya qaysi?',
    o: ['OMR (optik belgilarni oʻqish)', 'OCR (optik belgilarni tanish)', 'MICR (magnit siyohni oʻqish)', 'RFID (radiochastotali identifikatsiya)'],
    e: 'OMR qogʻozdagi belgilangan joylarni (kataklarni) aniqlaydi. Test va soʻrovnomalarni tez tekshirishda ishlatiladi.',
    h: 'Bu texnologiya harflarni emas, belgilangan kataklarni oʻqiydi.',
  },
  {
    c: 'direct_entry', d: 'hard', t: SC, r: 1,
    q: 'Bank cheklaridagi maxsus magnit siyoh bilan yozilgan raqamlarni oʻqiydigan texnologiya qaysi?',
    o: ['MICR', 'OMR', 'QR kod', 'Bluetooth'],
    e: 'MICR (Magnetic Ink Character Recognition) magnit siyohli belgilarni oʻqiydi; ular ustiga yozilsa ham oʻqiladi.',
    h: 'Qisqartmadagi M — Magnetic.',
  },
  {
    c: 'direct_entry', d: 'medium', t: SC, r: 1,
    q: 'Bosma matnli qogʻozni skanerlab, uni tahrirlanadigan matnga aylantiruvchi texnologiya qaysi?',
    o: ['OCR', 'OMR', 'GPS', 'RFID'],
    e: 'OCR (Optical Character Recognition) skanerlangan tasvirdagi harflarni taniydi va matn fayliga aylantiradi.',
    h: 'C — Character, yaʼni “belgi/harf”.',
  },
  {
    c: 'direct_entry', d: 'medium', t: SC, r: 1,
    q: 'Kontaktsiz toʻlov kartalari va tovar yorliqlarini masofadan radiotoʻlqin orqali oʻqiydigan texnologiya qaysi?',
    o: ['RFID / NFC', 'OMR', 'MICR', 'Matritsali printer'],
    e: 'RFID radiotoʻlqinlar orqali chipdagi maʼlumotni oʻqiydi. NFC — uning juda qisqa masofali turi (kontaktsiz toʻlov).',
    h: 'Kartani terminalga tekkizish shart emas, yaqinlashtirish kifoya.',
  },
  {
    c: 'direct_entry', d: 'easy', t: SC, r: 1,
    q: 'Shtrix-kod oʻquvchi asosan qayerda ishlatiladi?',
    o: ['Doʻkon kassalarida tovarlarni aniqlashda', 'Musiqa tinglashda', 'Rasm chizishda', 'Ovoz yozishda'],
    e: 'Shtrix-kod oʻquvchi tovar kodini bir zumda oʻqiydi, kompyuter esa narxini topadi.',
    h: 'Tovarlardagi qora-oq chiziqlarni eslang.',
  },

  // --- Chiqarish qurilmalari ---
  {
    c: 'output_devices', d: 'easy', t: SC, r: 1,
    q: 'Quyidagilardan qaysi biri chiqarish qurilmasi?',
    o: ['Printer', 'Skaner', 'Klaviatura', 'Mikrofon'],
    e: 'Printer kompyuterdagi maʼlumotni qogʻozga chiqaradi. Qolganlari kiritish qurilmalari.',
    h: 'U qogʻozga chop etadi.',
  },
  {
    c: 'output_devices', d: 'medium', t: SC, r: 1,
    q: 'Koʻp sahifali hujjatlarni tez va sifatli chop etish uchun qaysi printer eng mos?',
    o: ['Lazerli printer', 'Matritsali printer', '3D printer', 'Plotter'],
    e: 'Lazerli printer tez ishlaydi, sifati yuqori va katta hajmdagi hujjatlar uchun tejamkor.',
    h: 'Ofislarda eng koʻp uchraydigan printer.',
  },
  {
    c: 'output_devices', d: 'hard', t: SC, r: 1,
    q: 'Matritsali (nuqtali) printer hozir ham ishlatilishining sababi nima?',
    o: [
      'U zarb bilan chop etadi va koʻp qatlamli (kopirkali) blankalarni bir yoʻla toʻldira oladi',
      'U eng sokin ishlaydigan printer',
      'U rangli fotosuratlarni eng sifatli chiqaradi',
      'U uch oʻlchamli obyektlar yasaydi',
    ],
    e: 'Matritsali printer igna bilan lenta orqali urib chop etadi: shovqinli, lekin koʻp nusxali blankalar uchun qulay va chidamli.',
    h: 'U lentaga igna bilan uradi.',
  },
  {
    c: 'output_devices', d: 'medium', t: SC, r: 1,
    q: '3D printer nima qiladi?',
    o: [
      'Material qatlamlarini ketma-ket qoʻyib uch oʻlchamli obyekt yasaydi',
      'Qogʻozga uch xil rangda chop etadi',
      'Uch oʻlchamli tasvirni skanerlaydi',
      'Ovozni uch kanalda chiqaradi',
    ],
    e: '3D printer plastik yoki boshqa materialni qatlamma-qatlam qoʻyib, raqamli modeldan real buyum yasaydi.',
    h: 'Natijani qoʻlga olib ushlash mumkin.',
  },
  {
    c: 'output_devices', d: 'hard', t: SC, r: 1,
    q: 'Aktuator (ijro mexanizmi) qanday qurilma?',
    o: [
      'Kompyuter signaliga koʻra harakat hosil qiluvchi chiqarish qurilmasi (masalan, motor yoki klapan)',
      'Haroratni oʻlchaydigan sensor',
      'Maʼlumot saqlaydigan disk',
      'Tarmoq kabeli',
    ],
    e: 'Aktuatorlar boshqaruv tizimlarida ishlatiladi: kompyuter buyrugʻi bilan eshikni ochadi, motorni aylantiradi, klapanni yopadi.',
    h: 'U “harakat” qiladi.',
  },

  // --- Saqlash qurilmalari va maʼlumot almashish ---
  {
    c: 'storage_devices', d: 'medium', t: SC, r: 1,
    q: 'Qaysi saqlash qurilmasida maʼlumot aylanuvchi magnitlangan disklarda saqlanadi?',
    o: ['HDD (qattiq disk)', 'SSD', 'USB fleshka', 'Blu-ray disk'],
    e: 'HDD ichida aylanuvchi magnit plastinalar va oʻqish-yozish kallagi bor.',
    h: 'Bu qurilma ichida tez aylanadigan plastinalar bor.',
  },
  {
    c: 'storage_devices', d: 'medium', t: SC, r: 1,
    q: 'Quyidagi optik disklardan qaysi biri eng katta sigʻimga ega?',
    o: ['Blu-ray', 'DVD', 'CD', 'Barchasining sigʻimi bir xil'],
    e: 'Odatda: CD ≈ 700 MB, DVD ≈ 4,7 GB, Blu-ray ≈ 25 GB (bir qatlamli).',
    h: 'Uning nomida “koʻk nur” bor.',
  },
  {
    c: 'storage_devices', d: 'easy', t: SC, r: 1,
    q: 'Optik disklardan maʼlumot qanday oʻqiladi?',
    o: ['Lazer nuri yordamida', 'Magnit kallak bilan', 'Elektr zaryadi bilan', 'Radiotoʻlqin bilan'],
    e: 'Optik diskovod lazer nurini disk sirtiga yoʻnaltiradi va qaytgan nurdan maʼlumotni oʻqiydi.',
    h: '“Optik” soʻzi yorugʻlik bilan bogʻliq.',
  },
  {
    c: 'storage_devices', d: 'medium', t: SC, r: 1,
    q: 'SSD maʼlumotni qanday saqlaydi?',
    o: [
      'Flesh-xotira mikrosxemalarida, harakatlanuvchi qismlarsiz',
      'Aylanuvchi magnit disklarda',
      'Lazer bilan yoziladigan diskda',
      'Magnit lentada',
    ],
    e: 'SSD — qattiq jismli (solid state) xotira: unda mexanik qismlar yoʻq, shuning uchun u tez va zarbaga chidamli.',
    h: 'Solid State — “qattiq jismli”.',
  },
  {
    c: 'storage_devices', d: 'easy', t: SC, r: 1,
    q: 'Bulutli saqlash (cloud storage) nima?',
    o: [
      'Maʼlumotlarni internet orqali uzoqdagi serverlarda saqlash',
      'Maʼlumotlarni faqat fleshkada saqlash',
      'Ob-havo maʼlumotlarini saqlash',
      'Kompyuterning operativ xotirasi',
    ],
    e: 'Bulutli xizmatlarda fayllar provayder serverlarida saqlanadi va ularga istalgan qurilmadan internet orqali kirish mumkin.',
    h: 'Fayllarga internet orqali istalgan joydan kirish mumkin.',
  },

  // --- Saqlash qurilmalarining afzallik va kamchiliklari ---
  {
    c: 'storage_pros_cons', d: 'medium', t: SC, r: 1,
    q: 'SSDning HDDga nisbatan afzalligi qaysi?',
    o: ['Tezroq ishlaydi va zarbaga chidamliroq', 'Har doim arzonroq', 'Sigʻimi har doim kattaroq', 'Faqat bir marta yoziladi'],
    e: 'SSDda harakatlanuvchi qismlar yoʻq: u tezroq, sokinroq va zarbaga chidamli. Lekin bir gigabayt hajmi odatda HDDdan qimmatroq.',
    h: 'Unda aylanadigan qismlar yoʻq.',
  },
  {
    c: 'storage_pros_cons', d: 'hard', t: SC, r: 1,
    q: 'Magnit lentaning afzalligi qaysi?',
    o: [
      'Juda katta hajmdagi maʼlumotni arzon zaxiralash (backup)',
      'Kerakli faylga bir zumda toʻgʻridan-toʻgʻri kirish',
      'Choʻntakda olib yurish uchun eng qulay',
      'Sensorli boshqaruvga ega',
    ],
    e: 'Magnit lenta juda katta sigʻimli va arzon, shuning uchun yirik tashkilotlar undan zaxira nusxalar uchun foydalanadi.',
    h: 'Yirik tashkilotlar zaxira nusxalarni unda saqlaydi.',
  },
  {
    c: 'storage_pros_cons', d: 'hard', t: SC, r: 1,
    q: 'Magnit lentaning asosiy kamchiligi nimada?',
    o: [
      'Maʼlumotga faqat ketma-ket kirish mumkin, shuning uchun kerakli faylni topish sekin',
      'U juda qimmat',
      'Unga maʼlumot yozib boʻlmaydi',
      'U faqat bitta faylni saqlay oladi',
    ],
    e: 'Lentada kerakli joyga yetish uchun undan oldingi qismni “oʻrab oʻtish” kerak — bu ketma-ket (sequential) kirish.',
    h: 'Eski audiokassetani eslang.',
  },
  {
    c: 'storage_pros_cons', d: 'easy', t: SC, r: 1,
    q: 'USB fleshkaning afzalligi qaysi?',
    o: [
      'Kichik, yengil, koʻchma va aksariyat kompyuterlarga mos',
      'Sigʻimi har doim qattiq diskdan katta',
      'Uni hech qachon yoʻqotib boʻlmaydi',
      'Unga faqat bir marta yozish mumkin',
    ],
    e: 'Fleshka choʻntakka sigʻadi va USB porti bor deyarli har qanday kompyuterda ishlaydi. Kamchiligi — kichikligi tufayli oson yoʻqoladi.',
    h: 'Uni kalitlar bilan birga olib yurish mumkin.',
  },
  {
    c: 'storage_pros_cons', d: 'medium', t: SC, r: 1,
    q: 'Bulutli saqlashning kamchiligi qaysi?',
    o: [
      'Internet aloqasi boʻlmasa, fayllarga kirish qiyin',
      'Maʼlumot hech qayerda saqlanmaydi',
      'Undan faqat bitta qurilmada foydalanish mumkin',
      'U har doim bepul va cheksiz',
    ],
    e: 'Bulutli xotira internetga bogʻliq; maʼlumot xavfsizligi esa provayderga ham bogʻliq boʻladi.',
    h: 'Bu xizmatga nima orqali ulanamiz?',
  },
  {
    c: 'storage_pros_cons', d: 'medium', t: SC, r: 1,
    q: 'Optik disklarning (CD/DVD) kamchiligi qaysi?',
    o: [
      'Tirnalsa, maʼlumot oʻqilmay qolishi mumkin',
      'Ular magnit maydonidan darrov buziladi',
      'Ularni hech bir kompyuter oʻqiy olmaydi',
      'Ular elektr oʻchganda maʼlumotni yoʻqotadi',
    ],
    e: 'Optik disk sirtidagi tirnalishlar lazer nurini buzadi. Ularning sigʻimi ham zamonaviy qurilmalarga nisbatan kichik.',
    h: 'Disk sirtiga nima zarar yetkazadi?',
  },

  // =================================================================
  // 2-RAUND — TECH HUNTER (rasmli savollar)
  // =================================================================
  {
    c: 'input_devices', d: 'easy', t: IMG, r: 2, img: 'keyboard',
    q: 'Rasmda qanday qurilma tasvirlangan?',
    o: ['Klaviatura', 'Grafik planshet', 'Sensorli panel', 'Skaner'],
    e: 'Klaviatura — matn, raqam va buyruqlarni kiritish qurilmasi.',
    h: 'Unda harf va raqamli tugmalar bor.',
  },
  {
    c: 'input_devices', d: 'easy', t: IMG, r: 2, img: 'mouse',
    q: 'Rasmdagi qurilma qaysi turkumga kiradi?',
    o: ['Kiritish qurilmasi', 'Chiqarish qurilmasi', 'Saqlash qurilmasi', 'Tarmoq qurilmasi'],
    e: 'Sichqoncha — koʻrsatkich (kursor)ni boshqaradigan kiritish qurilmasi.',
    h: 'U kursorni boshqaradi.',
  },
  {
    c: 'output_devices', d: 'easy', t: IMG, r: 2, img: 'monitor',
    q: 'Rasmdagi qurilmaning asosiy vazifasi nima?',
    o: ['Tasvir va matnni ekranda koʻrsatish', 'Ovozni yozib olish', 'Maʼlumotni uzoq muddat saqlash', 'Hujjatni skanerlash'],
    e: 'Monitor — kompyuter natijalarini ekranda koʻrsatadigan chiqarish qurilmasi.',
    h: 'U koʻrish uchun.',
  },
  {
    c: 'output_devices', d: 'medium', t: IMG, r: 2, img: 'laser_printer',
    q: 'Rasmda qanday qurilma tasvirlangan?',
    o: ['Lazerli printer', 'Proyektor', 'Server', 'Planshetli skaner'],
    e: 'Lazerli printer toner kukuni va lazer yordamida qogʻozga tez va sifatli chop etadi.',
    h: 'Undan qogʻoz chiqadi.',
  },
  {
    c: 'input_devices', d: 'medium', t: IMG, r: 2, img: 'scanner',
    q: 'Rasmdagi qurilma nima uchun ishlatiladi?',
    o: [
      'Qogʻozdagi hujjat va rasmlarni raqamli koʻrinishga oʻtkazish',
      'Hujjatni qogʻozga chop etish',
      'Ovozni kuchaytirish',
      'Tasvirni devorga tushirish',
    ],
    e: 'Planshetli skaner qogʻoz hujjatni “suratga oladi” va kompyuterga raqamli tasvir sifatida kiritadi.',
    h: 'Hujjat shisha ustiga qoʻyiladi.',
  },
  {
    c: 'input_devices', d: 'easy', t: IMG, r: 2, img: 'webcam',
    q: 'Rasmda qanday qurilma tasvirlangan?',
    o: ['Veb-kamera', 'Mikrofon', 'Proyektor', 'Shtrix-kod oʻquvchi'],
    e: 'Veb-kamera video qoʻngʻiroqlar va onlayn darslar uchun tasvirni kompyuterga kiritadi.',
    h: 'U odatda monitor ustiga oʻrnatiladi.',
  },
  {
    c: 'input_devices', d: 'easy', t: IMG, r: 2, img: 'microphone',
    q: 'Rasmdagi qurilma kompyuterga nimani kiritadi?',
    o: ['Ovozni', 'Tasvirni', 'Matnni', 'Harakatni'],
    e: 'Mikrofon ovoz toʻlqinlarini elektr signaliga, soʻng raqamli maʼlumotga aylantiradi.',
    h: 'Unga gapiriladi.',
  },
  {
    c: 'output_devices', d: 'easy', t: IMG, r: 2, img: 'speakers',
    q: 'Rasmdagi qurilmalar qaysi turkumga kiradi?',
    o: ['Chiqarish qurilmalari', 'Kiritish qurilmalari', 'Saqlash qurilmalari', 'Hisoblash qurilmalari'],
    e: 'Karnaylar kompyuterdagi raqamli ovozni eshitiladigan tovushga aylantiradi.',
    h: 'Ulardan musiqa eshitiladi.',
  },
  {
    c: 'output_devices', d: 'easy', t: IMG, r: 2, img: 'headphones',
    q: 'Rasmdagi qurilma qanday vazifani bajaradi?',
    o: ['Ovozni faqat foydalanuvchiga eshittiradi', 'Ovozni kompyuterga kiritadi', 'Fayllarni saqlaydi', 'Tasvirni koʻrsatadi'],
    e: 'Quloqchinlar chiqarish qurilmasi: ovozni atrofdagilarni bezovta qilmasdan eshittiradi.',
    h: 'Ular quloqqa taqiladi.',
  },
  {
    c: 'storage_devices', d: 'medium', t: IMG, r: 2, img: 'hdd',
    q: 'Rasmda ochiq holda koʻrsatilgan saqlash qurilmasi qaysi?',
    o: ['Qattiq disk (HDD)', 'SSD', 'Operativ xotira (RAM)', 'Optik diskovod'],
    e: 'HDD ichida aylanuvchi magnit plastina va oʻqish-yozish kallagi joylashgan qoʻl koʻrinadi.',
    h: 'Ichida yaltiroq aylanuvchi plastina bor.',
  },
  {
    c: 'storage_devices', d: 'hard', t: IMG, r: 2, img: 'ssd',
    q: 'Rasmdagi qurilma qaysi?',
    o: ['SSD (M.2 formatidagi)', 'Operativ xotira (RAM)', 'Videokarta', 'Tarmoq kartasi'],
    e: 'M.2 SSD — ona plataga toʻgʻridan-toʻgʻri ulanadigan ixcham va juda tez saqlash qurilmasi.',
    h: 'Bu qurilma fayllarni doimiy saqlaydi.',
  },
  {
    c: 'storage_devices', d: 'easy', t: IMG, r: 2, img: 'usb_flash',
    q: 'Rasmda qanday qurilma tasvirlangan?',
    o: ['USB fleshka', 'Xotira kartasi (SD)', 'Bluetooth adapter', 'Zaryadlovchi kabel'],
    e: 'USB fleshka — flesh-xotiraga asoslangan koʻchma saqlash qurilmasi.',
    h: 'U USB portga ulanadi va fayllarni olib yurishga xizmat qiladi.',
  },
  {
    c: 'storage_devices', d: 'easy', t: IMG, r: 2, img: 'dvd',
    q: 'Rasmdagi saqlash vositasi qaysi turga kiradi?',
    o: ['Optik', 'Magnit', 'Qattiq jismli (flesh)', 'Bulutli'],
    e: 'CD/DVD/Blu-ray — optik saqlash vositalari: ular lazer bilan oʻqiladi.',
    h: 'Uni lazer oʻqiydi.',
  },
  {
    c: 'storage_devices', d: 'medium', t: IMG, r: 2, img: 'sd_card',
    q: 'Rasmdagi qurilma koʻproq qayerda ishlatiladi?',
    o: ['Fotoapparat va smartfonlarda', 'Kassada tovar skanerlashda', 'Monitor sifatida', 'Printer kartriji sifatida'],
    e: 'Xotira kartasi (SD) — kichik flesh-xotira; fotoapparat, smartfon va dronlarda fayllarni saqlaydi.',
    h: 'U juda kichik va yassi.',
  },
  {
    c: 'direct_entry', d: 'easy', t: IMG, r: 2, img: 'barcode_scanner',
    q: 'Rasmda qanday qurilma tasvirlangan?',
    o: ['Shtrix-kod oʻquvchi', 'Sensorli qalam', 'Veb-kamera', 'Joystik'],
    e: 'Shtrix-kod oʻquvchi tovar kodini qizil nur yordamida oʻqiydi — bu bevosita maʼlumot kiritish.',
    h: 'Kassirlar undan foydalanadi.',
  },
  {
    c: 'output_devices', d: 'medium', t: IMG, r: 2, img: 'projector',
    q: 'Rasmdagi qurilmaning vazifasi nima?',
    o: ['Tasvirni katta ekranga yoki devorga tushirish', 'Hujjatlarni skanerlash', 'Ovozni yozib olish', 'Maʼlumotni saqlash'],
    e: 'Proyektor — kompyuter tasvirini katta ekranga chiqaradigan chiqarish qurilmasi.',
    h: 'Sinfda taqdimot koʻrsatish uchun ishlatiladi.',
  },
  {
    c: 'input_devices', d: 'medium', t: IMG, r: 2, img: 'joystick',
    q: 'Rasmda qanday qurilma tasvirlangan?',
    o: ['Joystik', 'Sichqoncha', 'Trekbol', 'Grafik planshet'],
    e: 'Joystik — dastak yordamida harakat yoʻnalishini kiritadigan qurilma; oʻyinlar va simulyatorlarda ishlatiladi.',
    h: 'Uchuvchilar simulyatorida shunga oʻxshash dastak bor.',
  },
  {
    c: 'input_devices', d: 'medium', t: IMG, r: 2, img: 'graphics_tablet',
    q: 'Rasmda qanday qurilma tasvirlangan?',
    o: ['Grafik planshet', 'Sensorli monitor', 'Klaviatura', 'Skaner'],
    e: 'Grafik planshet maxsus qalam harakatini kompyuterga aniq uzatadi.',
    h: 'U qalam bilan birga keladi.',
  },
  {
    c: 'system_components', d: 'medium', t: IMG, r: 2, img: 'ram',
    q: 'Rasmdagi kompyuter qismi qaysi?',
    o: ['Operativ xotira (RAM)', 'Markaziy protsessor (CPU)', 'Qattiq disk (HDD)', 'Quvvat bloki'],
    e: 'RAM moduli — mikrosxemalar oʻrnatilgan uzun plata; u ishlayotgan dasturlarni vaqtincha saqlaydi.',
    h: 'U ona plataga uzun uyachaga oʻrnatiladi.',
  },
  {
    c: 'system_components', d: 'medium', t: IMG, r: 2, img: 'cpu',
    q: 'Rasmdagi qism qaysi?',
    o: ['Markaziy protsessor (CPU)', 'Operativ xotira (RAM)', 'SSD', 'Tarmoq adapteri'],
    e: 'Protsessor — kvadrat shakldagi mikrosxema; u dastur buyruqlarini bajaradi.',
    h: 'Bu kompyuterning “miyasi”.',
  },
  {
    c: 'output_devices', d: 'easy', t: IMG, r: 2, img: 'printer_3d',
    q: 'Rasmdagi qurilma nima yasaydi?',
    o: ['Uch oʻlchamli (3D) obyektlarni', 'Qogʻoz hujjatlarni', 'Ovozli fayllarni', 'Fotosuratlarni'],
    e: '3D printer raqamli modeldan plastikni qatlamma-qatlam eritib qoʻyib, haqiqiy buyum yasaydi.',
    h: 'Natija — qoʻlda ushlasa boʻladigan buyum.',
  },
  {
    c: 'direct_entry', d: 'medium', t: IMG, r: 2, img: 'pos_terminal',
    q: 'Rasmdagi qurilma qayerda ishlatiladi?',
    o: ['Doʻkonda bank kartasi bilan toʻlov qilishda', 'Ovoz yozishda', 'Rasm chizishda', 'Hujjat chop etishda'],
    e: 'Toʻlov terminali karta chipini (chip va PIN) yoki kontaktsiz (NFC) maʼlumotni oʻqiydi.',
    h: 'Unda PIN-kod teriladi.',
  },
  {
    c: 'new_technologies', d: 'easy', t: IMG, r: 2, img: 'vr_headset',
    q: 'Rasmdagi qurilma qaysi texnologiyaga tegishli?',
    o: ['Virtual reallik (VR)', 'Bulutli saqlash', 'Shtrix-kod', 'Lazerli chop etish'],
    e: 'VR koʻzoynak foydalanuvchini toʻliq virtual muhitga olib kiradi: taʼlim, tibbiyot va oʻyinlarda qoʻllanadi.',
    h: 'U koʻzga taqiladi va boshqa dunyoni koʻrsatadi.',
  },
  {
    c: 'new_technologies', d: 'easy', t: IMG, r: 2, img: 'drone',
    q: 'Rasmdagi uchuvchi qurilma qanday ataladi?',
    o: ['Dron (uchuvchisiz uchish apparati)', 'Vertolyot modeli', 'Sunʼiy yoʻldosh', 'Proyektor'],
    e: 'Dronlar kamera va sensorlar bilan jihozlanadi: xaritalash, yetkazib berish, qishloq xoʻjaligida qoʻllanadi.',
    h: 'Unda bir nechta parrak bor va u masofadan boshqariladi.',
  },

  // =================================================================
  // 3-RAUND — SPEED BATTLE (qisqa va tezkor)
  // =================================================================
  {
    c: 'system_components', d: 'easy', t: SC, r: 3,
    q: '1 bayt necha bitdan iborat?',
    o: ['8', '4', '16', '10'],
    e: '1 bayt = 8 bit. Bit — eng kichik maʼlumot birligi (0 yoki 1).',
    h: 'Bu son 2 ning kubiga teng.',
  },
  {
    c: 'output_devices', d: 'easy', t: SC, r: 3,
    q: 'Qaysi biri chiqarish qurilmasi?',
    o: ['Karnay', 'Sichqoncha', 'Skaner', 'Mikrofon'],
    e: 'Karnay ovozni chiqaradi.',
    h: 'Undan musiqa eshitiladi.',
  },
  {
    c: 'input_devices', d: 'easy', t: SC, r: 3,
    q: 'Klaviatura qanday qurilma?',
    o: ['Kiritish qurilmasi', 'Chiqarish qurilmasi', 'Saqlash qurilmasi', 'Protsessor'],
    e: 'Klaviatura orqali matn va buyruqlar kiritiladi.',
    h: 'Biz unda yozamiz.',
  },
  {
    c: 'system_components', d: 'easy', t: SC, r: 3,
    q: 'CPU qisqartmasi nimani bildiradi?',
    o: ['Markaziy protsessor', 'Kompyuter quvvat bloki', 'Markaziy printer', 'Rangli ekran'],
    e: 'CPU — Central Processing Unit, yaʼni markaziy protsessor.',
    h: 'C — Central.',
  },
  {
    c: 'system_components', d: 'easy', t: TF, r: 3, a: false,
    q: 'RAM — elektr oʻchganda ham maʼlumotni saqlaydigan doimiy xotira.',
    e: 'Notoʻgʻri. RAM energiyaga bogʻliq xotira: elektr oʻchsa, maʼlumot yoʻqoladi.',
    h: 'Saqlanmagan hujjat nima boʻladi?',
  },
  {
    c: 'operating_systems', d: 'easy', t: SC, r: 3,
    q: 'Qaysi biri operatsion tizim EMAS?',
    o: ['Microsoft Excel', 'Windows', 'Linux', 'Android'],
    e: 'Excel — elektron jadval dasturi (amaliy dastur). Qolganlari operatsion tizimlar.',
    h: 'Bu dasturda jadvallar tuziladi.',
  },
  {
    c: 'operating_systems', d: 'easy', t: SC, r: 3,
    q: 'Android qaysi qurilmalar uchun mashhur operatsion tizim?',
    o: ['Smartfon va planshetlar', 'Faqat superkompyuterlar', 'Printerlar', 'Fleshkalar'],
    e: 'Android — mobil qurilmalar uchun eng keng tarqalgan operatsion tizimlardan biri.',
    h: 'Choʻntagingizdagi qurilmani eslang.',
  },
  {
    c: 'storage_devices', d: 'easy', t: SC, r: 3,
    q: 'DVD qanday saqlash vositasi?',
    o: ['Optik', 'Magnit', 'Flesh', 'Bulutli'],
    e: 'DVD lazer nuri bilan oʻqiladi — u optik vosita.',
    h: 'Lazer!',
  },
  {
    c: 'output_devices', d: 'easy', t: SC, r: 3,
    q: 'Qaysi qurilma hujjatni qogʻozga chiqaradi?',
    o: ['Printer', 'Skaner', 'Monitor', 'Router'],
    e: 'Printer — qogʻozga chop etuvchi chiqarish qurilmasi.',
    h: 'Chop etish.',
  },
  {
    c: 'input_devices', d: 'easy', t: TF, r: 3, a: false,
    q: 'Skaner — chiqarish qurilmasi.',
    e: 'Notoʻgʻri. Skaner qogʻozdagi maʼlumotni kompyuterga KIRITADI.',
    h: 'Maʼlumot qaysi tomonga harakatlanadi?',
  },
  {
    c: 'system_components', d: 'medium', t: SC, r: 3,
    q: 'Maktab informatika kursida 1 KB necha baytga teng deb olinadi?',
    o: ['1024', '100', '512', '8'],
    e: '1 KB = 1024 bayt (2¹⁰). Xalqaro SI tizimida 1 kB = 1000 bayt deb ham yoziladi.',
    h: 'Bu 2 ning 10-darajasi.',
  },
  {
    c: 'input_devices', d: 'easy', t: SC, r: 3,
    q: 'Qaysi qurilma ovozni kompyuterga kiritadi?',
    o: ['Mikrofon', 'Karnay', 'Monitor', 'Printer'],
    e: 'Mikrofon — ovozli kiritish qurilmasi.',
    h: 'Unga gapiriladi.',
  },
  {
    c: 'input_devices', d: 'medium', t: SC, r: 3,
    q: 'Smartfon ekrani telefon burilganda ham aylanishi uchun qaysi sensor ishlaydi?',
    o: ['Akselerometr', 'Termometr', 'Mikrofon', 'Barmoq izi skaneri'],
    e: 'Akselerometr qurilmaning holati va harakatini aniqlaydi.',
    h: 'U tezlanishni oʻlchaydi.',
  },
  {
    c: 'storage_devices', d: 'easy', t: SC, r: 3,
    q: 'USB fleshka qanday xotira turiga asoslangan?',
    o: ['Flesh-xotira (qattiq jismli)', 'Magnit disk', 'Optik disk', 'Magnit lenta'],
    e: 'Fleshka — flesh-xotira mikrosxemasiga ega qattiq jismli qurilma.',
    h: 'Nomi oʻzida.',
  },
  {
    c: 'storage_devices', d: 'medium', t: SC, r: 3,
    q: 'Bluetooth nima uchun ishlatiladi?',
    o: [
      'Qurilmalar orasida qisqa masofada simsiz maʼlumot almashish uchun',
      'Uzoq masofaga elektr energiyasini uzatish uchun',
      'Hujjatlarni chop etish uchun',
      'Maʼlumotni magnit lentaga yozish uchun',
    ],
    e: 'Bluetooth — qisqa masofali (odatda 10 m atrofida) simsiz aloqa texnologiyasi.',
    h: 'Simsiz quloqchinlar shu orqali ulanadi.',
  },
  {
    c: 'computer_types', d: 'easy', t: SC, r: 3,
    q: 'Qaysi qurilma eng koʻchma (mobil) hisoblanadi?',
    o: ['Smartfon', 'Stol kompyuteri', 'Mainframe', 'Server shkafi'],
    e: 'Smartfon choʻntakka sigʻadi va doimiy internetga ulanishi mumkin.',
    h: 'U choʻntakka sigʻadi.',
  },

  // =================================================================
  // 4-RAUND — HACK THE SYSTEM (mantiq, nosozliklar, qulflar)
  // =================================================================
  {
    c: 'system_components', d: 'medium', t: LP, r: 4,
    q: 'Ketma-ketlikni davom ettiring: 1, 2, 4, 8, 16, ?',
    o: ['32', '24', '20', '64'],
    e: 'Har bir son oldingisidan 2 marta katta. Bu ikkilik sanoq tizimidagi razryad qiymatlari: 2⁰, 2¹, 2², …',
    h: 'Har safar ikkiga koʻpaytiring.',
  },
  {
    c: 'system_components', d: 'hard', t: SA, r: 4, a: ['10'],
    q: 'RAQAMLI QULF: Ikkilik sanoq tizimidagi 1010 sonini oʻnlik tizimga oʻtkazing. Natija — qulf kodi.',
    e: '1010₂ = 1·8 + 0·4 + 1·2 + 0·1 = 10.',
    h: 'Razryadlar qiymati chapdan oʻngga: 8, 4, 2, 1.',
  },
  {
    c: 'system_components', d: 'medium', t: SA, r: 4, a: ['32'],
    q: 'QULF KODI: 1 bayt = 8 bit. 4 bayt necha bitga teng? Javobni raqam bilan kiriting.',
    e: '4 × 8 = 32 bit.',
    h: '4 ni 8 ga koʻpaytiring.',
  },
  {
    c: 'output_devices', d: 'medium', t: SC, r: 4,
    q: 'NOSOZLIK: kompyuter yoqildi, ventilyator aylanyapti, lekin monitor qop-qora. Birinchi navbatda nimani tekshirish kerak?',
    o: [
      'Monitor kabeli ulanganini va monitor yoqilganini',
      'Klaviatura tugmalarini',
      'Printer siyohini',
      'Internet tezligini',
    ],
    e: 'Eng oddiy sabablardan boshlash kerak: monitor quvvati va video kabel ulanishi.',
    h: 'Eng oddiy sababdan boshlang.',
  },
  {
    c: 'output_devices', d: 'easy', t: SC, r: 4,
    q: 'NOSOZLIK: printer “Qogʻoz tiqilib qoldi” xabarini bermoqda. Toʻgʻri harakat qaysi?',
    o: [
      'Printerni oʻchirib, tiqilgan qogʻozni ehtiyotkorlik bilan chiqarish',
      'Printerni qattiq silkitish',
      'Kompyuterni formatlash',
      'Yangi monitor sotib olish',
    ],
    e: 'Avval qurilmani xavfsiz holatga keltirib, qogʻozni yirtmasdan chiqarish kerak.',
    h: 'Xavfsizlik birinchi oʻrinda.',
  },
  {
    c: 'input_devices', d: 'easy', t: SC, r: 4,
    q: 'NOSOZLIK: sichqoncha kursori ekranda harakatlanmayapti. Eng oddiy birinchi qadam qaysi?',
    o: [
      'Sichqoncha ulanishini yoki batareyasini tekshirish',
      'Operatsion tizimni qayta oʻrnatish',
      'Protsessorni almashtirish',
      'Monitorni oʻchirib qoʻyish',
    ],
    e: 'Koʻp hollarda sabab oddiy: kabel chiqib qolgan yoki simsiz sichqoncha batareyasi tugagan.',
    h: 'Simsiz sichqonchaga nima kerak?',
  },
  {
    c: 'storage_pros_cons', d: 'medium', t: SC, r: 4,
    q: 'NOSOZLIK: noutbuk juda sekinlashgan, qattiq disk deyarli toʻlib qolgan. Eng toʻgʻri yechim qaysi?',
    o: [
      'Keraksiz fayllarni oʻchirish yoki ularni tashqi/bulutli xotiraga koʻchirish',
      'Ekran yorugʻligini oshirish',
      'Klaviaturani almashtirish',
      'Wi-Fi ni oʻchirib qoʻyish',
    ],
    e: 'Diskda boʻsh joy yetishmasa, tizim sekinlashadi. Joy boʻshatish yoki maʼlumotni boshqa xotiraga koʻchirish kerak.',
    h: 'Muammo xotirada.',
  },
  {
    c: 'input_devices', d: 'medium', t: LP, r: 4,
    q: 'MANTIQ: qurilma maʼlumotni kompyuterga KIRITADI va kompyuterdan CHIQARADI ham. Bu qaysi qurilma boʻlishi mumkin?',
    o: ['Sensorli ekran', 'Klaviatura', 'Karnay', 'Skaner'],
    e: 'Sensorli ekran teginishni qabul qiladi (kiritish) va tasvirni koʻrsatadi (chiqarish).',
    h: 'Smartfon ekranini eslang.',
  },
  {
    c: 'system_components', d: 'easy', t: TF, r: 4, a: false,
    q: 'Kompyuter oʻchganda ROMdagi maʼlumotlar yoʻqoladi.',
    e: 'Notoʻgʻri. ROM — doimiy xotira, undagi maʼlumot elektr oʻchganda ham saqlanadi.',
    h: 'ROM qanday xotira?',
  },
  {
    c: 'storage_pros_cons', d: 'medium', t: TF, r: 4, a: true,
    q: 'HDD harakatlanuvchi mexanik qismlarga ega, shuning uchun u SSDga qaraganda zarbaga sezgirroq.',
    e: 'Toʻgʻri. Zarba paytida HDD kallagi aylanuvchi plastinaga tegib, uni shikastlashi mumkin.',
    h: 'Qaysi biri ichida aylanadi?',
  },
  {
    c: 'input_devices', d: 'medium', t: LP, r: 4,
    q: 'MANTIQ: qaysi qatordagi BARCHA qurilmalar kiritish qurilmalari?',
    o: [
      'Klaviatura, mikrofon, skaner',
      'Monitor, printer, karnay',
      'Klaviatura, monitor, printer',
      'Mikrofon, karnay, proyektor',
    ],
    e: 'Klaviatura, mikrofon va skaner maʼlumotni kompyuterga kiritadi.',
    h: 'Har bir qurilma kompyuterga nimadir “beradimi”?',
  },
  {
    c: 'storage_devices', d: 'hard', t: LP, r: 4,
    q: 'MANTIQ: qaysi qatorda optik disklar sigʻimi KICHIKDAN KATTAGA toʻgʻri tartiblangan?',
    o: ['CD → DVD → Blu-ray', 'Blu-ray → DVD → CD', 'DVD → CD → Blu-ray', 'CD → Blu-ray → DVD'],
    e: 'CD ≈ 700 MB < DVD ≈ 4,7 GB < Blu-ray ≈ 25 GB.',
    h: 'Eng eskisi — eng kichigi.',
  },
  {
    c: 'system_components', d: 'medium', t: SA, r: 4, a: ['48'],
    q: 'QULF KODI: ketma-ketlikning keyingi sonini kiriting: 3, 6, 12, 24, ?',
    e: 'Har bir son oldingisidan 2 marta katta: 24 × 2 = 48.',
    h: 'Oldingi sonni ikkiga koʻpaytiring.',
  },
  {
    c: 'direct_entry', d: 'hard', t: SA, r: 4, a: ['MICR'],
    q: 'PAROL: bank cheklaridagi magnit siyohli raqamlarni oʻqiydigan texnologiyaning 4 harfli qisqartmasini yozing.',
    e: 'MICR — Magnetic Ink Character Recognition.',
    h: 'M… I… C… R…',
  },
  {
    c: 'direct_entry', d: 'hard', t: LP, r: 4,
    q: 'MANTIQ: kassir tovarni skanerlaydi, ekranda narx chiqadi va chek chop etiladi. Qurilmalar qaysi tartibda ishladi?',
    o: [
      'Shtrix-kod oʻquvchi → protsessor → ekran va printer',
      'Printer → protsessor → shtrix-kod oʻquvchi',
      'Ekran → shtrix-kod oʻquvchi → printer',
      'Protsessor → printer → shtrix-kod oʻquvchi',
    ],
    e: 'Kiritish (shtrix-kod) → qayta ishlash (protsessor narxni topadi) → chiqarish (ekran va chek printeri).',
    h: 'Kiritish → qayta ishlash → chiqarish.',
  },
  {
    c: 'direct_entry', d: 'medium', t: TF, r: 4, a: true,
    q: 'OCR texnologiyasi skanerlangan bosma matnni tahrirlanadigan matnga aylantira oladi.',
    e: 'Toʻgʻri. OCR tasvirdagi harflarni taniydi.',
    h: 'C — Character.',
  },

  // =================================================================
  // 5-RAUND — GALACTIC BOSS (murakkab, vaziyatli savollar)
  // =================================================================
  {
    c: 'storage_pros_cons', d: 'hard', t: SC, r: 5,
    q: 'Qaysi vaziyatda magnit lenta eng mos saqlash vositasi hisoblanadi?',
    o: [
      'Yirik tashkilotning har kungi toʻliq zaxira nusxasini arzon saqlash',
      'Smartfonda tez-tez ochiladigan rasmlarni saqlash',
      'Kompyuter oʻyinlarini tez yuklash',
      'Doʻstga bitta faylni tez uzatish',
    ],
    e: 'Lenta katta hajmni arzon saqlaydi, zaxira nusxadan esa kamdan-kam va ketma-ket foydalaniladi.',
    h: 'Zaxira nusxa (backup) haqida oʻylang.',
  },
  {
    c: 'system_components', d: 'hard', t: SC, r: 5,
    q: 'Nima uchun kompyuterni yuklovchi dastur RAMda emas, balki ROMda saqlanadi?',
    o: [
      'Chunki u elektr oʻchganda ham yoʻqolmasligi kerak',
      'Chunki RAM juda sekin ishlaydi',
      'Chunki ROMga foydalanuvchi oʻyinlarini yozadi',
      'Chunki RAM faqat rasmlarni saqlaydi',
    ],
    e: 'Kompyuter yoqilishi bilan ishga tushirish dasturi tayyor turishi kerak — buni faqat doimiy xotira (ROM) taʼminlaydi.',
    h: 'RAM va ROMning asosiy farqi nimada?',
  },
  {
    c: 'direct_entry', d: 'hard', t: SC, r: 5,
    q: 'Kutubxona javondagi kitoblarni har birini qoʻlga olmasdan, masofadan hisobga olmoqchi. Qaysi texnologiya eng mos?',
    o: ['RFID', 'Shtrix-kod', 'OMR', 'MICR'],
    e: 'RFID yorliqlari radiotoʻlqin orqali oʻqiladi va toʻgʻridan-toʻgʻri koʻrinishni talab qilmaydi; bir vaqtda koʻp yorliqni oʻqish mumkin.',
    h: 'Bu texnologiya radiotoʻlqindan foydalanadi.',
  },
  {
    c: 'computer_types', d: 'hard', t: SC, r: 5,
    q: 'Ilmiy markaz har kuni ulkan hajmdagi ob-havo maʼlumotlarini juda tez hisoblashi kerak. Qaysi kompyuter turi eng mos?',
    o: ['Superkompyuter', 'Planshet', 'Smart soat', 'Noutbuk'],
    e: 'Superkompyuterlar soniyasiga trillionlab amal bajaradi va ob-havo modellashtirishda ishlatiladi.',
    h: 'Eng kuchli kompyuter turi.',
  },
  {
    c: 'input_devices', d: 'hard', t: SC, r: 5,
    q: 'Shifoxonada bemorning yurak urishi doimiy kuzatiladi va xavfli holatda signal chalinadi. Bu tizimda qaysi qurilmalar ishlaydi?',
    o: [
      'Sensor (kiritish) hamda ekran va signal (chiqarish)',
      'Faqat printer',
      'Faqat klaviatura',
      'Faqat DVD disk',
    ],
    e: 'Sensor maʼlumotni uzluksiz kiritadi, kompyuter uni tahlil qiladi, ekran va signal esa natijani chiqaradi.',
    h: 'Kiritish → qayta ishlash → chiqarish.',
  },
  {
    c: 'new_technologies', d: 'medium', t: SC, r: 5,
    q: 'Sunʼiy intellekt keng qoʻllanilishining salbiy taʼsirlaridan biri qaysi?',
    o: [
      'Baʼzi kasblarda ish oʻrinlarining qisqarishi',
      'Kompyuterlarning butunlay ishlamay qolishi',
      'Internetning yoʻqolib ketishi',
      'Elektr energiyasining bepul boʻlib qolishi',
    ],
    e: 'Avtomatlashtirish takroriy ishlarda inson mehnatiga ehtiyojni kamaytiradi, ammo yangi kasblar ham paydo boʻladi.',
    h: 'Mehnat bozori haqida oʻylang.',
  },
  {
    c: 'storage_pros_cons', d: 'hard', t: SC, r: 5,
    q: 'Fotograf 200 GB fotosuratni mijozga tez yetkazmoqchi, lekin internet juda sekin. Eng qulay yechim qaysi?',
    o: [
      'Tashqi SSD yoki katta sigʻimli fleshka',
      '300 ta CD disk',
      'Magnit lenta',
      'Har bir rasmni elektron pochtada alohida yuborish',
    ],
    e: 'Koʻchma SSD/fleshka katta hajmni tez yozadi va oʻqiydi, internetga bogʻliq emas.',
    h: 'Tezkor va koʻchma xotira kerak.',
  },
  {
    c: 'operating_systems', d: 'hard', t: SC, r: 5,
    q: 'Koʻrish qobiliyati cheklangan foydalanuvchi uchun qaysi interfeys eng qulay boʻlishi mumkin?',
    o: [
      'Ovozli boshqaruv interfeysi',
      'Faqat kichik ikonkali grafik menyu',
      'Faqat mayda shriftli buyruqlar satri',
      'Faqat sichqoncha bilan boshqaruv',
    ],
    e: 'Ovozli interfeys ekranga qaramasdan buyruq berish va javobni eshitish imkonini beradi.',
    h: 'Koʻz oʻrniga qaysi sezgi ishlatiladi?',
  },
  {
    c: 'system_components', d: 'hard', t: SA, r: 5, a: ['15'],
    q: 'BOSS QULFI: ikkilik sanoq tizimidagi 1111 sonini oʻnlik tizimga oʻtkazing.',
    e: '1111₂ = 8 + 4 + 2 + 1 = 15.',
    h: 'Razryadlar qiymati: 8, 4, 2, 1.',
  },
  {
    c: 'storage_pros_cons', d: 'hard', t: SC, r: 5,
    q: 'Nima uchun planshetlarda HDD emas, balki flesh-xotira ishlatiladi?',
    o: [
      'U yengil, kam energiya sarflaydi va zarbaga chidamli',
      'U har doim HDDdan arzonroq',
      'U magnit maydonida yaxshiroq ishlaydi',
      'Unga faqat bir marta yozish mumkin',
    ],
    e: 'Mobil qurilmalarda vazn, batareya sarfi va chidamlilik muhim — flesh-xotira bularning barchasida ustun.',
    h: 'Planshet tushib ketsa nima boʻladi?',
  },
  {
    c: 'operating_systems', d: 'hard', t: LP, r: 5,
    q: 'Operatsion tizimning qaysi funksiyasi bir vaqtda bir nechta dastur ishlashini taʼminlaydi?',
    o: [
      'Jarayonlar va xotirani boshqarish (koʻp vazifalilik)',
      'Faqat fayllarni oʻchirish',
      'Printerga siyoh qoʻshish',
      'Ekran yorugʻligini oshirish',
    ],
    e: 'OT protsessor vaqtini va xotirani dasturlar orasida taqsimlaydi — bu multitasking.',
    h: 'Musiqa tinglab, bir vaqtda matn yozish.',
  },
  {
    c: 'new_technologies', d: 'medium', t: SC, r: 5,
    q: 'Qaysi texnologiya ishlab chiqarishda ham, tibbiyotda ham (masalan, protez yasashda) katta oʻzgarish yasadi?',
    o: ['3D chop etish', 'Matritsali printer', 'Disketa', 'Elektron-nurli (CRT) monitor'],
    e: '3D printerlar shaxsga moslashtirilgan protezlar, ehtiyot qismlar va prototiplarni tez yasash imkonini beradi.',
    h: 'U qatlamma-qatlam “quradi”.',
  },

  // =================================================================
  // QOʻSHIMCHA SAVOLLAR (bankning oxiriga qoʻshiladi — mavjud savollar
  // variantlarining tartibi oʻzgarmasligi uchun). Raund `r` maydonida.
  // =================================================================

  // --- Higgsfield'da yaratilgan qoʻshimcha rasmlar (bevosita kiritish, chiqarish, saqlash, kompyuter turlari) ---
  {
    c: 'direct_entry', d: 'medium', t: IMG, r: 2, img: 'magnetic_stripe_reader',
    q: 'Rasmdagi qurilma bank kartasidan maʼlumotni qanday oʻqiydi?',
    o: ['Kartadagi magnit tasmani oʻqib', 'Kartani rasmga olib', 'Ovozli buyruq orqali', 'Kartadagi yozuvni chop etib'],
    e: 'Magnit tasmali karta oʻquvchi karta tirqishdan oʻtkazilganda magnit tasmadagi maʼlumotni avtomatik oʻqiydi — bu bevosita maʼlumot kiritish usuli.',
    h: 'Kartaning orqa tomonidagi qora chiziqqa eʼtibor bering.',
  },
  {
    c: 'direct_entry', d: 'medium', t: IMG, r: 2, img: 'rfid_reader',
    q: 'Rasmdagi qurilma qaysi texnologiya asosida ishlaydi?',
    o: ['RFID — radiochastotali identifikatsiya', 'Shtrix-kod', 'OMR — optik belgilarni tanish', 'Lazerli chop etish'],
    e: 'RFID oʻquvchi karta yoki brelok ichidagi mikrochipdan maʼlumotni radio toʻlqinlar orqali kontaktsiz oʻqiydi: kirish tizimlari, kutubxonalar, transport kartalari.',
    h: 'Kartani tegizmasdan yaqinlashtirishning oʻzi kifoya.',
  },
  {
    c: 'direct_entry', d: 'medium', t: IMG, r: 2, img: 'omr_sheet',
    q: 'Rasmdagi test javob varaqasi qaysi usul bilan avtomatik tekshiriladi?',
    o: ['OMR — optik belgilarni tanish', 'OCR — matnni tanish', 'MICR — magnit siyohli belgilarni tanish', 'RFID'],
    e: 'OMR (Optical Mark Recognition) qurilmasi qalam bilan boʻyalgan doirachalar joyini aniqlaydi. Test va soʻrovnomalar shu usulda tez tekshiriladi.',
    h: 'Muhimi — matn emas, boʻyalgan doirachalar.',
  },
  {
    c: 'direct_entry', d: 'easy', t: IMG, r: 2, img: 'qr_scan',
    q: 'Rasmda smartfon kamerasi nimani skanerlamoqda?',
    o: ['QR-kodni', 'Barmoq izini', 'Magnit tasmani', 'Ovozni'],
    e: 'QR-kod — ikki oʻlchamli shtrix-kod. Uni smartfon kamerasi oʻqiydi; unda havola, matn yoki toʻlov maʼlumoti boʻlishi mumkin.',
    h: 'Kvadrat shakldagi qora-oq naqsh.',
  },
  {
    c: 'input_devices', d: 'medium', t: IMG, r: 2, img: 'fingerprint_scanner',
    q: 'Rasmdagi qurilma foydalanuvchini nimasiga qarab aniqlaydi?',
    o: ['Barmoq iziga', 'Ovoziga', 'Yozgan matniga', 'Kiyimining rangiga'],
    e: 'Biometrik skaner har bir insonda takrorlanmas boʻlgan barmoq izini oʻqiydi. U kirishni nazorat qilish va qurilmani qulfdan ochishda ishlatiladi.',
    h: 'Biometrik maʼlumot.',
  },
  {
    c: 'output_devices', d: 'medium', t: IMG, r: 2, img: 'inkjet_printer',
    q: 'Rasmdagi printer tasvirni qanday hosil qiladi?',
    o: ['Mayda siyoh tomchilarini qogʻozga purkab', 'Lazer nuri va kukun (toner) yordamida', 'Ignalar bilan lentaga urib', 'Plastikni qatlamma-qatlam eritib'],
    e: 'Purkagichli (inkjet) printer kartrijlardagi siyohni juda mayda tomchilar holida qogʻozga purkaydi. Rangli fotosuratlarni chop etish uchun qulay.',
    h: 'Rangli siyoh kartrijlariga qarang.',
  },
  {
    c: 'output_devices', d: 'hard', t: IMG, r: 2, img: 'plotter',
    q: 'Katta chizmalarni chiqaruvchi rasmdagi qurilma qanday ataladi?',
    o: ['Plotter', 'Proyektor', 'Skaner', 'Matritsali printer'],
    e: 'Plotter katta formatdagi chizmalar, xaritalar va plakatlarni yuqori aniqlikda chiqaradi. Uni muhandislar va arxitektorlar ishlatadi.',
    h: 'Arxitektorlar chizmasi uchun.',
  },
  {
    c: 'input_devices', d: 'easy', t: IMG, r: 2, img: 'touchscreen',
    q: 'Rasmdagi sensorli ekran qanday qurilma hisoblanadi?',
    o: ['Ham kiritish, ham chiqarish qurilmasi', 'Faqat kiritish qurilmasi', 'Faqat chiqarish qurilmasi', 'Saqlash qurilmasi'],
    e: 'Sensorli ekran tasvirni koʻrsatadi (chiqarish) va barmoq teginishini qabul qiladi (kiritish).',
    h: 'U ham koʻrsatadi, ham teginishni sezadi.',
  },
  {
    c: 'input_devices', d: 'medium', t: IMG, r: 2, img: 'trackball',
    q: 'Rasmdagi koʻrsatkich qurilmasi qanday ataladi?',
    o: ['Trekbol', 'Joystik', 'Sensorli panel (touchpad)', 'Grafik planshet'],
    e: 'Trekbolda shar barmoq bilan aylantiriladi, qurilmaning oʻzi esa joyida turadi. U kam joy egallaydi va qoʻl harakati cheklangan foydalanuvchilarga qulay.',
    h: 'Sichqonchaga oʻxshaydi, lekin ustida katta shar bor.',
  },
  {
    c: 'input_devices', d: 'easy', t: IMG, r: 2, img: 'digital_camera',
    q: 'Rasmdagi raqamli fotoapparat qaysi turdagi qurilma?',
    o: ['Kiritish qurilmasi', 'Chiqarish qurilmasi', 'Saqlash qurilmasi', 'Tarmoq qurilmasi'],
    e: 'Raqamli fotoapparat tasvirni raqamli maʼlumotga aylantiradi va xotira kartasiga yozadi; keyin rasmlar kompyuterga kiritiladi.',
    h: 'U tasvirni raqamlarga aylantiradi.',
  },
  {
    c: 'storage_pros_cons', d: 'hard', t: IMG, r: 2, img: 'magnetic_tape',
    q: 'Rasmdagi magnit lenta kartrijlari asosan nima uchun ishlatiladi?',
    o: [
      'Katta hajmdagi maʼlumotlarning zaxira nusxasini saqlash uchun',
      'Musiqa tinglash uchun',
      'Matnni chop etish uchun',
      'Internetga ulanish uchun',
    ],
    e: 'Magnit lenta arzon va juda katta sigʻimli, lekin maʼlumotga faqat ketma-ket kirish mumkin. Shuning uchun u server maʼlumotlarini zaxiralash (arxivlash) uchun ishlatiladi.',
    h: 'Maʼlumotlar markazlari tungi zaxira nusxalar uchun foydalanadi.',
  },
  {
    c: 'system_components', d: 'medium', t: IMG, r: 2, img: 'motherboard',
    q: 'Rasmdagi kompyuter qismi qanday ataladi?',
    o: ['Ona plata (motherboard)', 'Videokarta', 'Quvvat bloki', 'Qattiq disk'],
    e: 'Ona plata — kompyuterning asosiy platasi: unga protsessor, operativ xotira, kengaytirish platalari va portlar ulanadi.',
    h: 'Barcha qismlar unga ulanadi.',
  },
  {
    c: 'computer_types', d: 'medium', t: IMG, r: 2, img: 'server_rack',
    q: 'Rasmdagi shkafda qaysi turdagi kompyuterlar joylashgan?',
    o: ['Serverlar', 'Planshetlar', 'Noutbuklar', 'Oʻyin konsollari'],
    e: 'Serverlar boshqa kompyuterlarga xizmat koʻrsatadi: saytlar, pochta va maʼlumotlar bazalarini saqlaydi. Ular maxsus shkaflarda kecha-kunduz ishlaydi.',
    h: 'Ular maʼlumotlar markazida turadi.',
  },
  {
    c: 'computer_types', d: 'easy', t: IMG, r: 2, img: 'laptop',
    q: 'Rasmdagi kompyuter turi qanday ataladi?',
    o: ['Noutbuk (laptop)', 'Stol kompyuteri', 'Mainframe', 'Smart soat'],
    e: 'Noutbuk — klaviatura, sensorli panel, ekran va batareya bitta korpusda boʻlgan koʻchma kompyuter.',
    h: 'U ochiladi va yopiladi.',
  },
  {
    c: 'new_technologies', d: 'easy', t: IMG, r: 2, img: 'smartwatch',
    q: 'Rasmdagi qurilma qaysi turdagi texnologiyaga kiradi?',
    o: ['Taqiladigan (wearable) qurilma', 'Saqlash qurilmasi', 'Chop etish qurilmasi', 'Tarmoq kabeli'],
    e: 'Smart soat — qoʻlga taqiladigan kichik kompyuter: yurak urishi va qadamlarni oʻlchaydi, smartfon bilan bogʻlanadi.',
    h: 'U qoʻlga taqiladi.',
  },
  {
    c: 'new_technologies', d: 'medium', t: IMG, r: 2, img: 'robot_arm',
    q: 'Rasmdagi sanoat robot-qoʻli zavodlarda qanday foyda beradi?',
    o: [
      'Takrorlanuvchi ishlarni tez va aniq bajaradi (yigʻish, payvandlash)',
      'Faqat matn chop etadi',
      'Faqat musiqa ijro etadi',
      'Internet tarqatadi',
    ],
    e: 'Sanoat robotlari kompyuter dasturi boʻyicha ishlaydi: charchamaydi, kam xato qiladi va xavfli ishlarni bajaradi. Bu ishlab chiqarishni avtomatlashtiradi.',
    h: 'Avtomatlashtirish.',
  },

  // --- Moslashtirish (matching) va koʻp bosqichli zanjirlar ---
  {
    c: 'input_devices', d: 'medium', t: MATCH, r: 4,
    q: 'MOSLASHTIRISH: Qurilmalarni vazifasiga moslang.',
    pairs: [
      ['Klaviatura', 'Kiritish'],
      ['Printer', 'Chiqarish'],
      ['Fleshka', 'Saqlash'],
      ['Mikrofon', 'Kiritish'],
    ],
    e: 'Kiritish qurilmalari maʼlumotni kompyuterga kiritadi, chiqarish qurilmalari natijani koʻrsatadi, saqlash qurilmalari maʼlumotni uzoq saqlaydi.',
    h: 'Maʼlumot qaysi tomonga harakatlanadi?',
  },
  {
    c: 'storage_devices', d: 'medium', t: MATCH, r: 4,
    q: 'MOSLASHTIRISH: Saqlash qurilmalarini ishlash usuliga moslang.',
    pairs: [
      ['Qattiq disk (HDD)', 'Magnit'],
      ['DVD disk', 'Optik (lazer)'],
      ['SSD', 'Flesh-xotira'],
      ['Magnit lenta', 'Magnit'],
    ],
    e: 'HDD va lenta maʼlumotni magnitlangan sirtga yozadi, CD/DVD lazer nuri bilan oʻqiladi, SSD va fleshka esa harakatlanuvchi qismlarsiz flesh-xotiradan foydalanadi.',
    h: 'Magnit, lazer yoki mikrosxema?',
  },
  {
    c: 'devices_software', d: 'medium', t: MATCH, r: 4,
    q: 'MOSLASHTIRISH: Dasturlarni turiga moslang.',
    pairs: [
      ['Windows', 'Operatsion tizim'],
      ['Matn muharriri', 'Amaliy dastur'],
      ['Antivirus', 'Utilita (xizmat dasturi)'],
      ['Linux', 'Operatsion tizim'],
    ],
    e: 'Operatsion tizim kompyuterni boshqaradi, amaliy dasturlar foydalanuvchi vazifasini bajaradi, utilitalar esa tizimga xizmat koʻrsatadi (himoya, tozalash, arxivlash).',
    h: 'Kim kompyuterni boshqaradi, kim foydalanuvchiga xizmat qiladi?',
  },
  {
    c: 'direct_entry', d: 'hard', t: MATCH, r: 4,
    q: 'MOSLASHTIRISH: Bevosita kiritish usullarini qoʻllanish joyiga moslang.',
    pairs: [
      ['Shtrix-kod skaneri', 'Doʻkon kassasi'],
      ['OMR', 'Test varaqalarini tekshirish'],
      ['RFID', 'Kontaktsiz kirish kartasi'],
      ['Chip va PIN', 'Bank kartasi bilan toʻlov'],
    ],
    e: 'Bevosita kiritish qurilmalari maʼlumotni klaviaturasiz, tez va xatosiz kiritadi: shtrix-kod — tovarlar, OMR — belgilangan javoblar, RFID — radio metkalar, chip va PIN — bank kartasi.',
    h: 'Har bir texnologiya qayerda koʻp uchraydi?',
  },
  {
    c: 'computer_types', d: 'medium', t: MATCH, r: 4,
    q: 'MOSLASHTIRISH: Kompyuter turlarini tavsifiga moslang.',
    pairs: [
      ['Mainframe', 'Minglab foydalanuvchiga xizmat qiluvchi kuchli kompyuter'],
      ['Noutbuk', 'Batareyali koʻchma kompyuter'],
      ['Smartfon', 'Choʻntakdagi mobil qurilma'],
      ['Stol kompyuteri', 'Doimiy joyda turadigan shaxsiy kompyuter'],
    ],
    e: 'Kompyuterlar oʻlchami, quvvati va koʻchmaligi boʻyicha farq qiladi.',
    h: 'Eng kattasi va eng kichigini toping.',
  },
  {
    c: 'output_devices', d: 'medium', t: CHAIN, r: 4,
    q: 'NOSOZLIK ZANJIRI: Printer hujjatni chop etmayapti. Muammoni bosqichma-bosqich toping.',
    steps: [
      { q: 'Avval nimani tekshirasiz?', o: ['Printer yoqilgan va kompyuterga ulanganini', 'Kompyuter protsessorini', 'Monitor yorugʻligini'] },
      { q: 'Printer yoqilgan va ulangan, lekin ekranda “Qogʻoz tugadi” xabari chiqdi. Nima qilasiz?', o: ['Lotokka qogʻoz solaman', 'Operatsion tizimni qayta oʻrnataman', 'Klaviaturani almashtiraman'] },
      { q: 'Qogʻoz solindi, lekin sahifa juda xira chiqyapti. Ehtimoliy sabab?', o: ['Siyoh yoki toner tugayapti', 'Sichqoncha buzilgan', 'Internet sekin'] },
    ],
    e: 'Nosozlik eng oddiy sabablardan boshlab tekshiriladi: quvvat va ulanish → qogʻoz → siyoh yoki toner.',
    h: 'Oddiydan murakkabga.',
  },
  {
    c: 'storage_devices', d: 'hard', t: CHAIN, r: 4,
    q: 'RAQAMLI ZANJIR: Hajmi 2 GB boʻlgan videoni 8 GB lik fleshkaga yozmoqchisiz. Hisobni qadamma-qadam bajaring.',
    steps: [
      { q: '1 GB necha MB ga teng?', o: ['1024 MB', '1000 KB', '100 MB', '8 MB'] },
      { q: 'Demak, 2 GB lik video necha MB?', o: ['2048 MB', '1024 MB', '4096 MB', '2000 KB'] },
      { q: '8 GB lik fleshkaga shunday videolardan nechtasi sigʻadi?', o: ['4 ta', '2 ta', '8 ta', '16 ta'] },
    ],
    e: '1 GB = 1024 MB, shuning uchun 2 GB = 2048 MB. 8 GB ÷ 2 GB = 4 ta video.',
    h: 'Har bir birlik oldingisidan 1024 marta katta.',
  },

  {
    c: 'operating_systems', d: 'hard', t: CHAIN, r: 5,
    q: 'BOSS ZANJIRI: Kompyuter yoqilgandan to dastur ishga tushguncha nima sodir boʻladi?',
    steps: [
      { q: 'Kompyuter yoqilganda birinchi boʻlib nima ishga tushadi?', o: ['BIOS/UEFI — qurilmalarni tekshiradi', 'Matn muharriri', 'Brauzer'] },
      { q: 'Shundan keyin qaysi dastur xotiraga yuklanadi?', o: ['Operatsion tizim', 'Antivirus bazasi', 'Fotosuratlar papkasi'] },
      { q: 'Foydalanuvchi dastur belgisini bosganda uni nima ishga tushiradi?', o: ['Operatsion tizim — dasturni xotiraga yuklaydi', 'Monitor', 'Sichqoncha'] },
    ],
    e: 'Yuklanish ketma-ketligi: BIOS/UEFI qurilmalarni tekshiradi → operatsion tizim yuklanadi → OT foydalanuvchi dasturlarini xotiraga yuklab ishga tushiradi.',
    h: 'Avval apparat, keyin OT, keyin dasturlar.',
  },
  {
    c: 'direct_entry', d: 'hard', t: CHAIN, r: 5,
    q: 'BOSS ZANJIRI: Xaridor doʻkonda tovar sotib olmoqda. Maʼlumot qanday harakatlanishini kuzating.',
    steps: [
      { q: 'Kassir tovarni qanday tez kiritadi?', o: ['Shtrix-kodni skaner bilan oʻqiydi', 'Nomini klaviaturada yozadi', 'Mikrofonga aytadi'] },
      { q: 'Tovar narxi qayerdan olinadi?', o: ['Doʻkonning maʼlumotlar bazasidan', 'Xaridorning telefonidan', 'Printer xotirasidan'] },
      { q: 'Xaridor bank kartasi bilan toʻlaydi. Karta maʼlumoti qanday oʻqiladi?', o: ['Chip va PIN yoki kontaktsiz (NFC) terminal orqali', 'Skaner bilan rasmga olib', 'Kassir qoʻlda yozib'] },
    ],
    e: 'Doʻkonda maʼlumot avtomatik kiritiladi: shtrix-kod → maʼlumotlar bazasidan narx → chip va PIN yoki NFC orqali toʻlov.',
    h: 'Har qadamda eng tez va xatosiz usulni tanlang.',
  },
];
