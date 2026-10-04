import { lazy, Suspense, type ReactNode } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { InstructorAuthProvider, useInstructorAuth } from './context/InstructorAuth';
import { FeedbackProvider } from './context/Feedback';
import { ErrorState, LoadingScreen } from './components/ui/Basics';
import { env } from './lib/env';
import { useReducedMotion } from './hooks/useUi';
import Home from './pages/Home';

const Intro = lazy(() => import('./pages/Intro'));
const Login = lazy(() => import('./pages/instructor/Login'));
const Dashboard = lazy(() => import('./pages/instructor/Dashboard'));
const QuestionBank = lazy(() => import('./pages/instructor/QuestionBank'));
const RoomConsole = lazy(() => import('./pages/instructor/RoomConsole'));
const Arena = lazy(() => import('./pages/arena/Arena'));
const Join = lazy(() => import('./pages/student/Join'));
const Play = lazy(() => import('./pages/student/Play'));

function RequireInstructor({ children }: { children: ReactNode }) {
  const auth = useInstructorAuth();
  const location = useLocation();
  if (auth.loading) return <LoadingScreen text="Sessiya tekshirilmoqda…" />;
  if (!auth.session) return <Navigate to={`/login?next=${encodeURIComponent(location.pathname)}`} replace />;
  if (!auth.isInstructor) {
    return (
      <ErrorState
        title="Oʻqituvchi huquqi yoʻq"
        message="Bu hisobga oʻqituvchi roli berilmagan. Administrator SQL Editor orqali promote_to_instructor() funksiyasini ishga tushirishi kerak (README ga qarang)."
        action={
          <button className="btn btn-ghost" onClick={() => void auth.signOut()}>
            Chiqish
          </button>
        }
      />
    );
  }
  return <>{children}</>;
}

function ConfigMissing() {
  return (
    <ErrorState
      title="Supabase sozlanmagan"
      message="VITE_SUPABASE_URL va VITE_SUPABASE_ANON_KEY muhit oʻzgaruvchilari topilmadi. Loyiha ildizida .env faylini yarating (.env.example ga qarang) yoki Netlify sozlamalarida kiriting, soʻng ilovani qayta ishga tushiring."
    />
  );
}

export default function App() {
  useReducedMotion();
  return (
    <FeedbackProvider>
      <InstructorAuthProvider>
        <Suspense fallback={<LoadingScreen />}>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/intro" element={<Intro />} />
            {env.isConfigured ? (
              <>
                <Route path="/login" element={<Login />} />
                <Route
                  path="/teacher"
                  element={
                    <RequireInstructor>
                      <Dashboard />
                    </RequireInstructor>
                  }
                />
                <Route
                  path="/teacher/questions"
                  element={
                    <RequireInstructor>
                      <QuestionBank />
                    </RequireInstructor>
                  }
                />
                <Route
                  path="/teacher/room/:roomId"
                  element={
                    <RequireInstructor>
                      <RoomConsole />
                    </RequireInstructor>
                  }
                />
                <Route
                  path="/arena/:roomId"
                  element={
                    <RequireInstructor>
                      <Arena />
                    </RequireInstructor>
                  }
                />
                <Route path="/join" element={<Join />} />
                <Route path="/join/:code" element={<Join />} />
                <Route path="/play/:roomId" element={<Play />} />
              </>
            ) : (
              <Route path="*" element={<ConfigMissing />} />
            )}
            <Route
              path="*"
              element={
                <ErrorState
                  title="Sahifa topilmadi"
                  message="Bunday manzil mavjud emas."
                  action={
                    <a className="btn btn-primary" href="/">
                      Bosh sahifa
                    </a>
                  }
                />
              }
            />
          </Routes>
        </Suspense>
      </InstructorAuthProvider>
    </FeedbackProvider>
  );
}
