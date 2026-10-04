// Savollar banki CRUD (RLS: faqat oʻqituvchilar oʻqiy va yoza oladi)
import type { SupabaseClient } from '@supabase/supabase-js';
import type { QuestionInput, QuestionRecord } from '../game/types';

const COLUMNS =
  'id, created_by, subject, grade, category, difficulty, question_type, question_text, options, correct_answer, explanation, hint, image_url, default_points, default_time_limit, recommended_round, is_active, created_at, updated_at';

export async function listQuestions(client: SupabaseClient): Promise<QuestionRecord[]> {
  const all: QuestionRecord[] = [];
  const page = 1000;
  for (let from = 0; ; from += page) {
    const { data, error } = await client
      .from('questions')
      .select(COLUMNS)
      .order('subject')
      .order('grade', { nullsFirst: true })
      .order('category')
      .order('created_at')
      .range(from, from + page - 1);
    if (error) throw error;
    all.push(...((data ?? []) as QuestionRecord[]));
    if (!data || data.length < page) break;
  }
  return all;
}

export async function createQuestion(client: SupabaseClient, q: QuestionInput, userId: string): Promise<QuestionRecord> {
  const { data, error } = await client.from('questions').insert({ ...q, created_by: userId }).select(COLUMNS).single();
  if (error) throw error;
  return data as QuestionRecord;
}

export async function updateQuestion(client: SupabaseClient, id: string, q: Partial<QuestionInput>): Promise<QuestionRecord> {
  const { data, error } = await client.from('questions').update(q).eq('id', id).select(COLUMNS).single();
  if (error) throw error;
  return data as QuestionRecord;
}

/** Oʻyinda ishlatilgan savol oʻchirilmaydi, balki faolsizlantiriladi */
export async function deleteQuestion(client: SupabaseClient, id: string): Promise<'deleted' | 'archived'> {
  const { error } = await client.from('questions').delete().eq('id', id);
  if (!error) return 'deleted';
  if (error.code === '23503') {
    const { error: e2 } = await client.from('questions').update({ is_active: false }).eq('id', id);
    if (e2) throw e2;
    return 'archived';
  }
  throw error;
}

export async function bulkInsertQuestions(
  client: SupabaseClient,
  questions: QuestionInput[],
  userId: string,
  onProgress?: (done: number) => void,
): Promise<number> {
  let done = 0;
  const chunk = 50;
  for (let i = 0; i < questions.length; i += chunk) {
    const slice = questions.slice(i, i + chunk).map((q) => ({ ...q, created_by: userId }));
    const { error } = await client.from('questions').insert(slice);
    if (error) throw new Error(`${i + 1}–${i + slice.length}-savollarni saqlashda xato: ${error.message}`);
    done += slice.length;
    onProgress?.(done);
  }
  return done;
}

/** Kompyuterdan rasm yuklash (Supabase Storage, "question-images" bucket) */
export async function uploadQuestionImage(client: SupabaseClient, file: File): Promise<string> {
  if (!/^image\/(png|jpe?g|webp|gif)$/.test(file.type)) throw new Error('Faqat PNG, JPG, WEBP yoki GIF rasm yuklash mumkin');
  if (file.size > 2 * 1024 * 1024) throw new Error('Rasm hajmi 2 MB dan oshmasligi kerak');
  const ext = file.name.split('.').pop()?.toLowerCase().replace(/[^a-z0-9]/g, '') || 'png';
  const path = `${new Date().toISOString().slice(0, 10)}/${crypto.randomUUID()}.${ext}`;
  const { error } = await client.storage.from('question-images').upload(path, file, {
    cacheControl: '31536000',
    upsert: false,
    contentType: file.type,
  });
  if (error) throw error;
  return client.storage.from('question-images').getPublicUrl(path).data.publicUrl;
}
