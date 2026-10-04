// PGlite (WASM PostgreSQL) asosidagi integratsion test muhiti.
// Supabase'ning auth sxemasi, rollari va standart huquqlari taqlid qilinadi,
// soʻng haqiqiy migratsiyalar va seed qoʻllanadi.
import { PGlite } from '@electric-sql/pglite';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';

const ROOT = join(__dirname, '..', '..');

const SUPABASE_STUB = `
  create role anon nologin;
  create role authenticated nologin;
  create role service_role nologin bypassrls;
  create schema auth;
  create table auth.users (
    id uuid primary key,
    email text,
    raw_user_meta_data jsonb not null default '{}'::jsonb,
    is_anonymous boolean not null default false
  );
  create function auth.uid() returns uuid language sql stable as $$
    select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
  $$;
  grant usage on schema auth to anon, authenticated, service_role;
  grant execute on function auth.uid() to anon, authenticated, service_role;
  grant usage on schema public to anon, authenticated, service_role;
  alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
  alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
  alter default privileges in schema public grant execute on functions to anon, authenticated, service_role;
`;

export interface TestDb {
  db: PGlite;
  /** Superuser sifatida SQL */
  sql<T = Record<string, unknown>>(query: string, params?: unknown[]): Promise<T[]>;
  /** Berilgan foydalanuvchi (authenticated roli) sifatida SQL */
  as<T = Record<string, unknown>>(uid: string, query: string, params?: unknown[]): Promise<T[]>;
  /** Bitta qiymat qaytaruvchi RPC */
  rpc<T = unknown>(uid: string, fn: string, args?: unknown[]): Promise<T>;
  createUser(opts?: { email?: string; instructor?: boolean; name?: string }): Promise<string>;
}

export async function createTestDb(opts: { seed?: boolean } = {}): Promise<TestDb> {
  const db = new PGlite();
  await db.exec(SUPABASE_STUB);

  const migrationsDir = join(ROOT, 'supabase', 'migrations');
  for (const file of readdirSync(migrationsDir).filter((f) => f.endsWith('.sql')).sort()) {
    await db.exec(readFileSync(join(migrationsDir, file), 'utf8'));
  }
  if (opts.seed !== false) {
    await db.exec(readFileSync(join(ROOT, 'supabase', 'seed.sql'), 'utf8'));
  }

  const sql = async <T>(query: string, params: unknown[] = []) =>
    (await db.query<T>(query, params)).rows;

  const as = async <T>(uid: string, query: string, params: unknown[] = []) => {
    await db.query(`select set_config('request.jwt.claim.sub', $1, false)`, [uid]);
    await db.exec('set role authenticated');
    try {
      return (await db.query<T>(query, params)).rows;
    } finally {
      await db.exec('reset role');
      await db.query(`select set_config('request.jwt.claim.sub', '', false)`);
    }
  };

  // PostgREST kabi: kompozit natija obyekt, skalyar natija qiymat sifatida qaytadi
  const rpc = async <T>(uid: string, fn: string, args: unknown[] = []) => {
    const placeholders = args.map((_, i) => `$${i + 1}`).join(', ');
    await db.query(`select set_config('request.jwt.claim.sub', $1, false)`, [uid]);
    await db.exec('set role authenticated');
    try {
      const res = await db.query<Record<string, unknown>>(`select * from public.${fn}(${placeholders})`, args);
      const row = res.rows[0];
      if (res.fields.length === 1 && res.fields[0].name === fn) return row?.[fn] as T;
      return row as T;
    } finally {
      await db.exec('reset role');
      await db.query(`select set_config('request.jwt.claim.sub', '', false)`);
    }
  };

  const createUser = async (o: { email?: string; instructor?: boolean; name?: string } = {}) => {
    const id = randomUUID();
    const email = o.email ?? (o.instructor ? `teacher-${id.slice(0, 6)}@school.uz` : null);
    await db.query(
      `insert into auth.users (id, email, raw_user_meta_data, is_anonymous) values ($1, $2, $3, $4)`,
      [id, email, JSON.stringify(o.name ? { display_name: o.name } : {}), !email],
    );
    if (o.instructor) {
      await db.query(`select public.promote_to_instructor($1, $2)`, [email, o.name ?? 'Oʻqituvchi']);
    }
    return id;
  };

  return { db, sql, as, rpc, createUser };
}
