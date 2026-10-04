import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { env } from './env';
import { readSession, writeSession } from './storage';

// Oʻqituvchi va oʻquvchi sessiyalari alohida saqlanadi: oʻqituvchi bitta brauzerda
// konsol va arenani ochib, boshqa oynada oʻquvchi sifatida sinab koʻra oladi.
let instructorClient: SupabaseClient | null = null;
let studentClient: SupabaseClient | null = null;

const SLOT_KEY = 'it-arena-test-slot';

/**
 * Sinov rejimi: bitta brauzerda bir nechta oʻquvchini sinash uchun
 * /join?slot=3 kabi parametr beriladi — har bir slot alohida anonim sessiyaga ega.
 */
export function studentSlot(): string | null {
  try {
    const fromUrl = new URLSearchParams(window.location.search).get('slot');
    if (fromUrl && /^[a-z0-9-]{1,12}$/i.test(fromUrl)) {
      writeSession(SLOT_KEY, fromUrl);
      return fromUrl;
    }
  } catch {
    /* eʼtiborsiz */
  }
  return readSession(SLOT_KEY);
}

function makeClient(storageKey: string) {
  return createClient(env.supabaseUrl, env.supabaseAnonKey, {
    auth: {
      storageKey,
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
    },
    realtime: {
      params: { eventsPerSecond: 20 },
    },
  });
}

export function getInstructorClient(): SupabaseClient {
  if (!instructorClient) instructorClient = makeClient('it-arena-instructor');
  return instructorClient;
}

export function getStudentClient(): SupabaseClient {
  if (!studentClient) {
    const slot = studentSlot();
    studentClient = makeClient(slot ? `it-arena-student-${slot}` : 'it-arena-student');
  }
  return studentClient;
}

/** Oʻquvchi uchun anonim sessiya (Supabase Auth → Anonymous sign-ins yoqilgan boʻlishi kerak) */
export async function ensureStudentSession(): Promise<string> {
  const client = getStudentClient();
  const { data } = await client.auth.getSession();
  if (data.session?.user) return data.session.user.id;
  const { data: signed, error } = await client.auth.signInAnonymously();
  if (error) throw error;
  if (!signed.user) throw new Error('Anonim sessiya yaratilmadi');
  return signed.user.id;
}
