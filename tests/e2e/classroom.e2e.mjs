// To'liq sinf ssenariysi (E2E): 1 o'qituvchi konsoli + 1 arena displeyi + 10 o'quvchi brauzeri.
//
// Talab qilinadi: mock server va Vite ishga tushgan bo'lishi kerak:
//   node scripts/mock-supabase.mjs
//   VITE_SUPABASE_URL=http://localhost:54321 VITE_SUPABASE_ANON_KEY=mock npx vite --port 5173
// So'ng:
//   node tests/e2e/classroom.e2e.mjs        (skrinshotlar: e2e-screenshots/)
//
// Ssenariy: kirish → xona yaratish → 10 o'quvchi qo'shiladi → tasdiqlash → o'yin →
// test savoli, moslashtirish, ko'p bosqichli zanjir → o'yinni yakunlash → natijalar.
import { mkdirSync } from 'node:fs';
import { chromium } from 'playwright-core';

const BASE = process.env.E2E_BASE ?? 'http://localhost:5173';
const API = process.env.E2E_API ?? 'http://localhost:54321';
const SHOTS = process.env.E2E_SHOTS ?? 'e2e-screenshots';
const EXECUTABLE = process.env.E2E_CHROMIUM ?? '/opt/pw-browsers/chromium';
const STUDENTS = Number(process.env.E2E_STUDENTS ?? 10);
mkdirSync(SHOTS, { recursive: true });

const log = (...a) => console.log(`[${new Date().toISOString().slice(11, 19)}]`, ...a);
const shot = (page, name) => page.screenshot({ path: `${SHOTS}/${name}.png` });
function assert(cond, msg) {
  if (!cond) throw new Error(`TEKSHIRUV XATOSI: ${msg}`);
}

async function api(path, { token, method = 'GET', body } = {}) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: { 'content-type': 'application/json', apikey: 'mock', ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) throw new Error(`${method} ${path}: ${res.status} ${text}`);
  return data;
}

const browser = await chromium.launch({ executablePath: EXECUTABLE });
const errors = [];
const watch = (page, who) => {
  page.on('pageerror', (e) => errors.push(`${who}: ${e.message}`));
};

try {
  // ------------------------------------------------------------ O'qituvchi
  const teacherCtx = await browser.newContext({ viewport: { width: 1600, height: 950 } });
  const teacher = await teacherCtx.newPage();
  watch(teacher, 'teacher');
  await teacher.goto(`${BASE}/login`);
  await teacher.fill('#email', 'teacher@itarena.uz');
  await teacher.fill('#password', 'arena12345');
  await teacher.click('button[type=submit]');
  await teacher.waitForURL(/\/teacher$/, { timeout: 20_000 });
  log('O‘qituvchi kirdi');
  await teacher.getByRole('button', { name: /YANGI OʻYIN YARATISH/ }).click();
  await teacher.waitForURL(/\/teacher\/room\//, { timeout: 20_000 });
  const roomId = teacher.url().split('/').pop();
  const login = await api('/auth/v1/token?grant_type=password', { method: 'POST', body: { email: 'teacher@itarena.uz', password: 'arena12345' } });
  const token = login.access_token;
  const [room] = await api(`/rest/v1/game_rooms?select=id,room_code&id=eq.${roomId}`, { token });
  log('Xona yaratildi:', room.room_code);

  // 1-raund rejasi: oddiy test + moslashtirish + ko'p bosqichli zanjir
  const pick = async (type) => (await api(`/rest/v1/questions?select=id&question_type=eq.${type}&is_active=eq.true&limit=1`, { token }))[0].id;
  const plan = [await pick('single_choice'), await pick('matching'), await pick('multi_step')];
  await api('/rest/v1/rpc/set_round_questions', { token, method: 'POST', body: { p_room: roomId, p_round: 1, p_question_ids: plan, p_points: null, p_time_limit: 120 } });

  // ------------------------------------------------------------ Arena displeyi
  const arena = await teacherCtx.newPage();
  watch(arena, 'arena');
  await arena.setViewportSize({ width: 1920, height: 1080 });
  await arena.goto(`${BASE}/arena/${roomId}`);
  await arena.getByText(room.room_code).first().waitFor({ timeout: 20_000 });

  // ------------------------------------------------------------ 10 o'quvchi
  const students = [];
  for (let i = 0; i < STUDENTS; i++) {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 860 } });
    const page = await ctx.newPage();
    watch(page, `student${i + 1}`);
    await page.goto(`${BASE}/join/${room.room_code}`);
    await page.fill('#nick', `Oʻquvchi ${i + 1}`);
    await page.getByRole('button', { name: /OʻYINGA QOʻSHILISH/ }).click();
    await page.waitForURL(/\/play\//, { timeout: 20_000 });
    students.push(page);
  }
  log(`${STUDENTS} ta o‘quvchi qo‘shildi`);
  await shot(students[0], '01-student-waiting-approval');

  await teacher.getByRole('button', { name: /Hammasini tasdiqlash/ }).click();
  await teacher.getByText('BARCHA TAYYOR').first().waitFor({ timeout: 20_000 });
  await arena.getByText('BARCHA TAYYOR!').waitFor({ timeout: 20_000 });
  await shot(teacher, '02-teacher-lobby');
  await shot(arena, '03-arena-lobby');
  await students[0].getByText(/Jamoadoshlar/).waitFor({ timeout: 20_000 });
  await shot(students[0], '04-student-lobby');

  await teacher.getByRole('button', { name: /OʻYINNI BOSHLASH/ }).click();
  await teacher.getByRole('button', { name: /^Boshlash$/ }).click();
  await teacher.getByRole('button', { name: /savolni boshlash/ }).waitFor({ timeout: 20_000 });
  log('O‘yin boshlandi');

  const questionSection = (p) => p.locator('section.glass').first();

  // ------------------------------------------------------------ 1) Oddiy test savoli
  await teacher.getByRole('button', { name: /savolni boshlash/ }).click();
  // barcha o'quvchilar bir vaqtda javob beradi (bir vaqtdagi yuborishlar sinovi)
  await Promise.all(
    students.map(async (p, i) => {
      const opts = questionSection(p).locator('button[aria-pressed]');
      await opts.first().waitFor({ timeout: 20_000 });
      await opts.nth(i % 4).click();
      if (i === 0) await shot(p, '05-student-question-selected');
      await p.getByRole('button', { name: /JAVOBNI YUBORISH/ }).click();
      await p.getByText(/Javobingiz qabul qilindi|Toʻgʻri!|Notoʻgʻri/).first().waitFor({ timeout: 30_000 });
    }),
  );
  await arena.getByText(/Izoh:/).waitFor({ timeout: 25_000 });
  await arena.waitForTimeout(2500); // zarba animatsiyasi
  await shot(arena, '06-arena-reveal-single');
  await students[0].getByText(/Toʻgʻri!|Notoʻgʻri/).first().waitFor({ timeout: 20_000 });
  await shot(students[0], '07-student-reveal-single');
  await shot(teacher, '08-teacher-live-after-q1');
  log('1-savol yakunlandi');

  // ------------------------------------------------------------ 2) Moslashtirish
  await teacher.getByRole('button', { name: /savolni boshlash/ }).click();
  await arena.getByText('Javoblar').waitFor({ timeout: 25_000 });
  await shot(arena, '09-arena-matching');
  await Promise.all(
    students.map(async (p, i) => {
      const group = p.getByRole('group', { name: 'Moslashtirish' });
      await group.waitFor({ timeout: 20_000 });
      const rows = group.locator(':scope > div');
      const n = await rows.count();
      for (let r = 0; r < n; r++) {
        const chips = rows.nth(r).locator('button');
        await chips.nth((r + i) % (await chips.count())).click();
      }
      if (i === 0) await shot(p, '10-student-matching');
      await p.getByRole('button', { name: /JAVOBNI YUBORISH/ }).click();
      await p.getByText(/Javobingiz qabul qilindi|Toʻgʻri!|Qisman|Notoʻgʻri/).first().waitFor({ timeout: 30_000 });
    }),
  );
  await arena.locator('li').filter({ hasText: '→' }).first().waitFor({ timeout: 25_000 }).catch(() => undefined);
  await arena.waitForTimeout(2500);
  await shot(arena, '11-arena-reveal-matching');
  await students[0].getByText(/Toʻgʻri!|Qisman|Notoʻgʻri/).first().waitFor({ timeout: 20_000 });
  await shot(students[0], '12-student-reveal-matching');
  log('Moslashtirish savoli yakunlandi');

  // ------------------------------------------------------------ 3) Ko'p bosqichli zanjir
  await teacher.getByRole('button', { name: /savolni boshlash/ }).click();
  await arena.getByText(/qadamli zanjir/).waitFor({ timeout: 25_000 });
  await Promise.all(
    students.map(async (p, i) => {
      for (let step = 0; step < 5; step++) {
        const submitBtn = p.getByRole('button', { name: /QADAMNI TASDIQLASH|ZANJIRNI YAKUNLASH/ });
        const done = p.getByText(/zanjir yakunlandi|Zanjir toʻliq bajarildi|1-qadam/).first();
        await Promise.race([submitBtn.waitFor({ timeout: 20_000 }), done.waitFor({ timeout: 20_000 })]).catch(() => undefined);
        if (!(await submitBtn.isVisible()) || !(await submitBtn.isEnabled())) {
          // oldingi qadam hali qayta ishlanmoqda yoki zanjir tugagan
          await p.waitForTimeout(700);
          if (!(await submitBtn.isVisible())) break;
        }
        const opts = questionSection(p).locator('button[aria-pressed]');
        // birinchi o'quvchi to'g'ri javoblarni bilmaydi — variantlar navbat bilan tanlanadi
        await opts.nth((i + step) % Math.max(1, await opts.count())).click();
        if (i === 0 && step === 0) await shot(p, '13-student-multistep');
        await submitBtn.click();
        await p.waitForTimeout(600);
      }
      if (i === 0) await shot(p, '14-student-multistep-finished');
    }),
  );
  await arena.getByText(/1-qadam/).first().waitFor({ timeout: 25_000 });
  await arena.waitForTimeout(2500);
  await shot(arena, '15-arena-reveal-multistep');
  await shot(teacher, '16-teacher-live-multistep');
  log('Zanjir savoli yakunlandi');

  // ------------------------------------------------------------ Yakun
  await teacher.getByRole('button', { name: /Oʻyinni yakunlash/ }).click();
  await teacher.getByRole('button', { name: /^Yakunlash$/ }).click();
  await arena.getByText(/GALACTIC CHAMPIONS/).waitFor({ timeout: 25_000 });
  await arena.waitForTimeout(2000);
  await shot(arena, '17-arena-victory');
  await students[0].getByText(/GʻALABA!|YAXSHI JANG!|DURANG!/).waitFor({ timeout: 25_000 });
  await shot(students[0], '18-student-results');
  await teacher.getByText(/CSV yuklab olish/).waitFor({ timeout: 25_000 });
  await shot(teacher, '19-teacher-results');

  const snapshot = await api('/rest/v1/rpc/get_room_snapshot', { token, method: 'POST', body: { p_room: roomId } });
  assert(snapshot.room.status === 'finished', 'o‘yin yakunlanmadi');
  assert(snapshot.results?.statistics?.players?.length === STUDENTS, 'natijalarda barcha o‘quvchilar yo‘q');
  const questions = snapshot.plan.filter((q) => q.status === 'revealed');
  assert(questions.length === 3, `3 ta savol ochilishi kerak edi, ochildi: ${questions.length}`);
  const totalPlayers = snapshot.players.reduce((n, p) => n + p.score, 0);
  const totalTeams = snapshot.teams.reduce((n, t) => n + t.score, 0);
  assert(totalPlayers === totalTeams, `jamoa va o‘quvchi ballari mos emas: ${totalTeams} ≠ ${totalPlayers}`);
  log('Natijalar tekshirildi: jamoalar balli =', totalTeams);

  // Qo'shimcha sahifalar
  const misc = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  watch(misc, 'misc');
  await misc.goto(`${BASE}/`);
  await misc.waitForTimeout(1200);
  await shot(misc, '20-home');
  await misc.goto(`${BASE}/intro`);
  await misc.waitForTimeout(1200);
  for (let i = 0; i < 6; i++) await misc.keyboard.press('ArrowRight');
  await misc.waitForTimeout(1200);
  await shot(misc, '21-intro-abilities');

  if (errors.length) throw new Error(`Brauzer xatolari:\n${errors.join('\n')}`);
  log('✔ E2E ssenariy muvaffaqiyatli yakunlandi');
} finally {
  await browser.close();
}
