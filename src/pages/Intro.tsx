import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronLeft, ChevronRight, Flame, Maximize, Minimize, Rocket, Shield, SkipForward, Swords, Target, Users, Zap } from 'lucide-react';
import { Logo, SpaceBackground } from '../components/ui/Basics';
import { MotionToggle } from '../components/ui/SoundControls';
import { Spaceship } from '../components/game/Spaceship';
import { ABILITIES, ABILITY_ORDER, ROUNDS, TAGLINE } from '../game/constants';
import { AbilityIcon } from '../components/game/AbilityPanel';
import { useDocumentTitle, useFullscreen, useStageScale } from '../hooks/useUi';

const ROUND_POINTS = [100, 150, 200, 250, 300];
const ROUND_TIMES = [20, 25, 10, 40, 45];

function SlideTitle({ kicker, children }: { kicker: string; children: ReactNode }) {
  return (
    <div className="mb-8">
      <div className="font-display text-sm font-bold uppercase tracking-[0.5em] text-arena-cyan">{kicker}</div>
      <h2 className="mt-2 font-logo text-[3rem] font-black leading-tight tracking-wide">{children}</h2>
    </div>
  );
}

function RuleCard({ icon, title, children, color = '#3EE7FF' }: { icon: ReactNode; title: string; children: ReactNode; color?: string }) {
  return (
    <div className="glass rounded-3xl p-6" style={{ borderColor: `${color}44` }}>
      <div className="mb-3 inline-flex rounded-2xl p-3" style={{ background: `${color}1f`, color }}>
        {icon}
      </div>
      <h3 className="font-display text-2xl font-bold">{title}</h3>
      <div className="mt-2 text-lg leading-relaxed text-arena-muted">{children}</div>
    </div>
  );
}

export default function Intro() {
  useDocumentTitle('Qoidalar taqdimoti');
  useStageScale();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const roomId = params.get('room');
  const { active: fs, toggle: toggleFs } = useFullscreen();
  const [index, setIndex] = useState(0);

  const goGame = useCallback(() => navigate(roomId ? `/teacher/room/${roomId}` : '/teacher'), [navigate, roomId]);

  const slides: { key: string; bg?: 'intro' | 'arena'; body: ReactNode }[] = [
    {
      key: 'title',
      bg: 'intro',
      body: (
        <div className="flex h-full flex-col items-center justify-center text-center">
          <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ duration: 1 }}>
            <Logo size="xl" className="justify-center" />
          </motion.div>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
            className="mt-10 font-display text-[2.6rem] font-bold tracking-[0.15em] text-arena-warning"
          >
            {TAGLINE}
          </motion.p>
          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1 }} className="mt-4 text-2xl text-arena-muted">
            Galaktik bilimlar jangiga xush kelibsiz!
          </motion.p>
        </div>
      ),
    },
    {
      key: 'about',
      body: (
        <div>
          <SlideTitle kicker="Oʻyin haqida">Bilim — kemangiz yoqilgʻisi</SlideTitle>
          <div className="grid grid-cols-3 gap-6">
            <RuleCard icon={<Users className="h-8 w-8" />} title="2 jamoa × 5 oʻquvchi">
              Har bir oʻquvchi oʻz kompyuterida savollarga mustaqil javob beradi.
            </RuleCard>
            <RuleCard icon={<Zap className="h-8 w-8" />} title="Toʻgʻri javob = energiya" color="#FFC857">
              Har bir toʻgʻri javob jamoa kemasiga energiya va ball beradi.
            </RuleCard>
            <RuleCard icon={<Swords className="h-8 w-8" />} title="Energiya = zarba" color="#FF455A">
              Kema raqib qalqoniga zarba beradi. Katta ekranda jangni kuzating!
            </RuleCard>
          </div>
        </div>
      ),
    },
    {
      key: 'teams',
      bg: 'arena',
      body: (
        <div className="flex h-full flex-col">
          <SlideTitle kicker="Jamoalar">Kim gʻolib boʻladi?</SlideTitle>
          <div className="grid flex-1 grid-cols-[1fr_auto_1fr] items-center gap-8">
            <div className="text-center">
              <Spaceship skin="falcon" color="blue" facing="right" className="mx-auto w-full max-w-lg" />
              <div className="mt-4 font-logo text-4xl font-black text-arena-blue text-glow-blue">KOʻK JAMOA</div>
            </div>
            <div className="font-logo text-6xl font-black text-arena-warning">VS</div>
            <div className="text-center">
              <Spaceship skin="phoenix" color="red" facing="left" className="mx-auto w-full max-w-lg" />
              <div className="mt-4 font-logo text-4xl font-black text-arena-red text-glow-red">QIZIL JAMOA</div>
            </div>
          </div>
          <p className="text-center text-xl text-arena-muted">Jamoa nomlari, ranglari va kemalarini oʻqituvchi tanlaydi.</p>
        </div>
      ),
    },
    {
      key: 'battle',
      body: (
        <div>
          <SlideTitle kicker="Jang mexanikasi">Kosmik kemalar jangi</SlideTitle>
          <div className="grid grid-cols-2 gap-6">
            <RuleCard icon={<Shield className="h-8 w-8" />} title="Qalqon — 100">
              Har bir kema 100 birlik qalqon bilan boshlaydi. Har raund boshida qalqon biroz tiklanadi.
            </RuleCard>
            <RuleCard icon={<Zap className="h-8 w-8" />} title="Energiya" color="#FFC857">
              Har bir toʻgʻri javob +10 energiya. Energiya 100 ga yetsa — kuchli <b className="text-arena-text">PLAZMA ZARBA</b>.
            </RuleCard>
            <RuleCard icon={<Flame className="h-8 w-8" />} title="Kritik zarba" color="#FF455A">
              Jamoa ketma-ket 3 savolda yaxshi natija koʻrsatsa (kamida yarmi toʻgʻri), zarbalar ×1,5 kuchli boʻladi.
            </RuleCard>
            <RuleCard icon={<Target className="h-8 w-8" />} title="Adolatli balans" color="#35D49A">
              Bitta xato jamoani magʻlub qilmaydi. Gʻolib — <b className="text-arena-text">eng koʻp ball</b> toʻplagan jamoa; qalqon esa jang tomoshasi.
            </RuleCard>
          </div>
        </div>
      ),
    },
    {
      key: 'scoring',
      body: (
        <div>
          <SlideTitle kicker="Ball qoidalari">Qanday ball olinadi?</SlideTitle>
          <div className="grid grid-cols-[1.2fr_1fr] gap-6">
            <div className="glass rounded-3xl p-6">
              <table className="w-full text-xl">
                <thead className="text-base uppercase tracking-widest text-arena-muted">
                  <tr>
                    <th className="pb-3 text-left">Raund</th>
                    <th className="pb-3 text-right">Toʻgʻri javob</th>
                    <th className="pb-3 text-right">Vaqt</th>
                  </tr>
                </thead>
                <tbody>
                  {ROUNDS.map((r, i) => (
                    <tr key={r.number} className="border-t border-white/10">
                      <td className="py-2.5">
                        <span className="font-display font-bold" style={{ color: r.accent }}>
                          {r.number}. {r.title}
                        </span>
                      </td>
                      <td className="py-2.5 text-right font-display font-bold">+{ROUND_POINTS[i]}</td>
                      <td className="py-2.5 text-right text-arena-muted">{ROUND_TIMES[i]} s</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="mt-4 text-lg text-arena-muted">Notoʻgʻri yoki javobsiz qolgan savol: 0 ball (minus yoʻq).</p>
            </div>
            <div className="glass rounded-3xl p-6" style={{ borderColor: '#FFC85755' }}>
              <h3 className="font-display text-2xl font-bold text-arena-warning">Tezlik bonusi (3-raund)</h3>
              <div className="mt-4 rounded-2xl bg-space-950/70 p-5 text-center font-display text-2xl font-bold">
                Ball = 200 + 100 × <span className="text-arena-cyan">qolgan vaqt</span> / <span className="text-arena-muted">umumiy vaqt</span>
              </div>
              <p className="mt-4 text-lg leading-relaxed text-arena-muted">
                Tez javob bergan koʻproq oladi, lekin kechroq toʻgʻri javob ham kamida <b className="text-arena-text">200 ball</b> oladi. Notoʻgʻri tez javob — 0 ball.
              </p>
            </div>
          </div>
        </div>
      ),
    },
    {
      key: 'rounds',
      body: (
        <div>
          <SlideTitle kicker="5 ta raund">Galaktika boʻylab sayohat</SlideTitle>
          <div className="grid grid-cols-5 gap-4">
            {ROUNDS.map((r, i) => (
              <motion.div
                key={r.number}
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.12 }}
                className="overflow-hidden rounded-3xl border bg-space-950/60"
                style={{ borderColor: `${r.accent}55` }}
              >
                <img src={r.banner} alt="" className="h-36 w-full object-cover" />
                <div className="p-4">
                  <div className="font-display text-xs font-bold tracking-[0.3em]" style={{ color: r.accent }}>
                    {r.number}-RAUND • {r.code}
                  </div>
                  <div className="mt-1 font-display text-xl font-extrabold">{r.title}</div>
                  <p className="mt-2 text-sm leading-relaxed text-arena-muted">{r.description}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      ),
    },
    {
      key: 'abilities',
      body: (
        <div>
          <SlideTitle kicker="Maxsus qobiliyatlar">Energiyani oqilona sarflang</SlideTitle>
          <div className="grid grid-cols-5 gap-4">
            {ABILITY_ORDER.map((k) => {
              const a = ABILITIES[k];
              return (
                <div key={k} className="glass rounded-3xl p-5" style={{ borderColor: `${a.color}55` }}>
                  <AbilityIcon ability={k} size="lg" />
                  <div className="mt-3 font-display text-lg font-extrabold tracking-wider">{a.title}</div>
                  <div className="text-sm font-semibold" style={{ color: a.color }}>
                    {a.short}
                  </div>
                  <p className="mt-2 text-sm leading-relaxed text-arena-muted">{a.description}</p>
                </div>
              );
            })}
          </div>
          <p className="mt-6 text-center text-lg text-arena-muted">
            Har bir qobiliyat energiya talab qiladi va cheklangan marta ishlatiladi. Qobiliyatlarni oʻqituvchi faollashtiradi.
          </p>
        </div>
      ),
    },
    {
      key: 'fair',
      body: (
        <div>
          <SlideTitle kicker="Adolatli oʻyin">Galaktika qonunlari</SlideTitle>
          <ul className="grid grid-cols-2 gap-4 text-xl">
            {[
              'Har bir oʻquvchi faqat oʻz kompyuterida, oʻz javobini beradi.',
              'Javob yuborilgach, uni oʻzgartirib boʻlmaydi.',
              'Javob vaqtida boshqalarga javobni aytmang (5-raunddagi jamoaviy muhokama bundan mustasno).',
              'Telefon va internetdan javob qidirish taqiqlanadi.',
              'Taymer serverda hisoblanadi — vaqt tugagach javob qabul qilinmaydi.',
              'Raqibni hurmat qiling. Oʻqituvchi qarori yakuniy.',
            ].map((t, i) => (
              <li key={i} className="glass flex items-start gap-4 rounded-2xl p-5">
                <span className="font-logo text-2xl font-black text-arena-cyan">{String(i + 1).padStart(2, '0')}</span>
                <span className="leading-relaxed">{t}</span>
              </li>
            ))}
          </ul>
        </div>
      ),
    },
    {
      key: 'start',
      bg: 'intro',
      body: (
        <div className="flex h-full flex-col items-center justify-center text-center">
          <Logo size="lg" className="justify-center" />
          <h2 className="mt-10 font-logo text-[4rem] font-black tracking-wider text-glow-cyan">TAYYORMISIZ?</h2>
          <p className="mt-4 text-2xl text-arena-muted">Kompyuteringizda saytni oching va xona kodini kiriting.</p>
          <button className="btn btn-primary mt-12 px-12 py-6 text-2xl font-black tracking-[0.2em]" onClick={goGame}>
            <Rocket className="h-8 w-8" />
            OʻYINNI BOSHLASH
          </button>
        </div>
      ),
    },
  ];

  const last = slides.length - 1;
  const go = useCallback((d: number) => setIndex((i) => Math.max(0, Math.min(last, i + d))), [last]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (['ArrowRight', 'PageDown', ' ', 'Enter'].includes(e.key)) {
        e.preventDefault();
        go(1);
      } else if (['ArrowLeft', 'PageUp', 'Backspace'].includes(e.key)) {
        e.preventDefault();
        go(-1);
      } else if (e.key.toLowerCase() === 'f') void toggleFs();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [go, toggleFs]);

  const slide = slides[index];
  return (
    <main className="relative h-screen w-screen overflow-hidden">
      <SpaceBackground image={slide.bg ?? 'arena'} dim={slide.bg === 'intro' ? 0.55 : 0.78} />
      <div className="absolute inset-0 flex flex-col px-[5%] pb-[6.5rem] pt-[4%]">
        <AnimatePresence mode="wait">
          <motion.div
            key={slide.key}
            className="flex-1"
            initial={{ opacity: 0, x: 60 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -60 }}
            transition={{ duration: 0.45, ease: 'easeOut' }}
          >
            {slide.body}
          </motion.div>
        </AnimatePresence>
      </div>

      <nav className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-3 px-6 pb-5" aria-label="Taqdimot boshqaruvi">
        <div className="flex gap-2">
          <button className="btn btn-ghost" onClick={() => go(-1)} disabled={index === 0} aria-label="Oldingi slayd">
            <ChevronLeft className="h-5 w-5" /> Oldingi
          </button>
          <button className="btn btn-primary" onClick={() => go(1)} disabled={index === last} aria-label="Keyingi slayd">
            Keyingi <ChevronRight className="h-5 w-5" />
          </button>
        </div>
        <div className="flex items-center gap-1.5" aria-hidden>
          {slides.map((s, i) => (
            <button
              key={s.key}
              onClick={() => setIndex(i)}
              className={i === index ? 'h-2 w-8 rounded-full bg-arena-cyan' : 'h-2 w-2 rounded-full bg-white/25 hover:bg-white/50'}
              tabIndex={-1}
            />
          ))}
        </div>
        <div className="flex gap-2">
          <MotionToggle showLabel={false} className="h-full" />
          <button className="btn btn-ghost" onClick={() => void toggleFs()} title="Toʻliq ekran (F)">
            {fs ? <Minimize className="h-5 w-5" /> : <Maximize className="h-5 w-5" />}
          </button>
          <button className="btn btn-ghost" onClick={() => setIndex(last)} title="Kirishni oʻtkazib yuborish">
            <SkipForward className="h-5 w-5" /> Oʻtkazib yuborish
          </button>
          <button className="btn btn-success" onClick={goGame}>
            <Users className="h-5 w-5" /> Jamoalarni roʻyxatga olish
          </button>
        </div>
      </nav>
    </main>
  );
}
