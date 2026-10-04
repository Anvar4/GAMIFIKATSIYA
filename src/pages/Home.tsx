import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { GraduationCap, Presentation, Rocket } from 'lucide-react';
import { Logo, SpaceBackground } from '../components/ui/Basics';
import { TAGLINE } from '../game/constants';
import { useDocumentTitle } from '../hooks/useUi';

const CARDS = [
  {
    to: '/join',
    title: 'Oʻyinga qoʻshilish',
    text: 'Oʻquvchilar uchun: xona kodini kiriting yoki QR kodni skanerlang.',
    icon: <Rocket className="h-7 w-7" />,
    accent: '#3EE7FF',
    primary: true,
  },
  {
    to: '/teacher',
    title: 'Oʻqituvchi paneli',
    text: 'Xona yaratish, jamoalar, savollar banki va jonli boshqaruv.',
    icon: <GraduationCap className="h-7 w-7" />,
    accent: '#2583FF',
  },
  {
    to: '/intro',
    title: 'Qoidalar taqdimoti',
    text: 'Katta ekran uchun oʻyin qoidalari va raundlar bilan tanishtiruv.',
    icon: <Presentation className="h-7 w-7" />,
    accent: '#FF455A',
  },
];

export default function Home() {
  useDocumentTitle('');
  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center px-4 py-12">
      <SpaceBackground image="intro" dim={0.62} />
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8 }} className="text-center">
        <Logo size="xl" className="justify-center" />
        <p className="mt-6 font-display text-xl font-semibold tracking-[0.2em] text-arena-warning sm:text-2xl">{TAGLINE}</p>
        <p className="mx-auto mt-3 max-w-xl text-arena-muted">
          Ikki jamoa, ikki kosmik kema va bitta maqsad — bilim orqali galaktik jangda gʻolib chiqish.
        </p>
      </motion.div>
      <div className="mt-12 grid w-full max-w-5xl gap-4 md:grid-cols-3">
        {CARDS.map((c, i) => (
          <motion.div key={c.to} initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 + i * 0.12 }}>
            <Link
              to={c.to}
              className="glass group flex h-full flex-col rounded-3xl p-6 transition hover:-translate-y-1"
              style={{ borderColor: `${c.accent}55` }}
            >
              <div className="mb-4 inline-flex w-fit rounded-2xl p-3" style={{ background: `${c.accent}1f`, color: c.accent }}>
                {c.icon}
              </div>
              <h2 className="font-display text-xl font-bold">{c.title}</h2>
              <p className="mt-2 flex-1 text-sm leading-relaxed text-arena-muted">{c.text}</p>
              <span className="mt-5 font-display text-sm font-bold tracking-widest" style={{ color: c.accent }}>
                {c.primary ? 'QOʻSHILISH →' : 'OCHISH →'}
              </span>
            </Link>
          </motion.div>
        ))}
      </div>
    </main>
  );
}
